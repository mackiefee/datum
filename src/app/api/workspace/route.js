import {
  authenticateEdgeRequest,
  getSupabaseAdmin,
  isAdminRole,
  isEditorOrAbove,
  saveServerAccessPolicy,
  toPublicLoginPolicy,
  writeAuthAuditLog,
} from '../../../lib/edgeAuth.js';

export const runtime = 'edge';

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return jsonResp({ configured: false, needsSeed: false, items: [], collections: [], meta: {} });
  }

  try {
    const auth = await authenticateEdgeRequest(req, admin, { allowGuest: true });
    if (!auth.ok) {
      return jsonResp(
        { error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' },
        auth.status
      );
    }

    const callerEmail = auth.caller.email;
    const isGuest = auth.caller.role === 'guest';
    const isMemberOnly = !isGuest && !isEditorOrAbove(auth.caller.role);

    const itemsQuery = isGuest
      ? `${admin.url}/rest/v1/shared_catalog_items?status=eq.Approved&vis=eq.Public&select=id,data,status,vis&order=id.desc`
      : isMemberOnly
      ? `${admin.url}/rest/v1/shared_catalog_items?status=eq.Approved&select=id,data,status,vis&order=id.desc`
      : `${admin.url}/rest/v1/shared_catalog_items?status=neq.Deleted&select=id,data,status,vis&order=id.desc`;

    const colQuery = isGuest
      ? `${admin.url}/rest/v1/shared_collections?vis=eq.Public&select=id,tier,vis,owner_email,data&order=updated_at.desc`
      : `${admin.url}/rest/v1/shared_collections?or=(tier.in.(official,shared),owner_email.eq.${encodeURIComponent(callerEmail)})&select=id,tier,vis,owner_email,data&order=updated_at.desc`;

    const [itemsRes, colsRes, metaRes] = await Promise.all([
      fetch(itemsQuery, { headers: admin.headers }),
      fetch(colQuery, { headers: admin.headers }),
      isGuest
        ? Promise.resolve(null)
        : fetch(`${admin.url}/rest/v1/shared_workspace_meta?select=key,data`, { headers: admin.headers }),
    ]);

    if (!itemsRes.ok || !colsRes.ok) {
      return jsonResp({ error: 'Failed to load shared workspace from Supabase' }, 502);
    }

    const rawItems = await itemsRes.json();
    const rawCols = await colsRes.json();
    const rawMeta = metaRes && metaRes.ok ? await metaRes.json() : [];

    const items = (Array.isArray(rawItems) ? rawItems : []).map((row) => ({
      ...(row.data || {}),
      id: row.id,
      status: row.status || (row.data && row.data.status) || 'Draft',
      vis: row.vis || (row.data && row.data.vis) || 'Internal',
    }));

    const collections = (Array.isArray(rawCols) ? rawCols : []).map((row) => ({
      ...(row.data || {}),
      id: row.id,
      tier: row.tier || (row.data && row.data.tier) || 'shared',
      vis: row.vis || (row.data && row.data.vis) || 'Internal',
      ownerEmail: row.owner_email || '',
    }));

    const meta = {};
    (Array.isArray(rawMeta) ? rawMeta : []).forEach((m) => {
      if (m && m.key) meta[m.key] = m.data;
    });

    const anyCheck = await fetch(`${admin.url}/rest/v1/shared_catalog_items?select=id&limit=1`, {
      headers: admin.headers,
    });
    const anyRows = anyCheck.ok ? await anyCheck.json() : [];
    const needsSeed = Array.isArray(anyRows) && anyRows.length === 0;

    const cleanActivities = Array.isArray(meta.activities)
      ? meta.activities.filter((a) => a && !['act-1', 'act-2', 'act-3', 'act-4'].includes(String(a.id)))
      : null;

    return jsonResp({
      configured: true,
      needsSeed,
      items,
      collections,
      tree: !isGuest && Array.isArray(meta.categories_tree) ? meta.categories_tree : null,
      activities: !isGuest ? cleanActivities : null,
      requiredIds: !isGuest && Array.isArray(meta.required_ids) ? meta.required_ids : null,
      flaggedIds: !isGuest && Array.isArray(meta.flagged_ids) ? meta.flagged_ids : null,
      searchLogs: !isGuest && Array.isArray(meta.search_logs) ? meta.search_logs : null,
      shares: !isGuest && Array.isArray(meta.direct_shares) ? meta.direct_shares : null,
      namingSchemas: !isGuest && Array.isArray(meta.naming_schemas) ? meta.naming_schemas : null,
      teamAcks: !isGuest && meta.team_acks && typeof meta.team_acks === 'object' ? meta.team_acks : null,
      accessPolicy: isAdminRole(auth.caller.role) ? auth.policy : toPublicLoginPolicy(auth.policy),
    });
  } catch (err) {
    return jsonResp({ error: err.message || 'Workspace load failed' }, 500);
  }
}

export async function POST(req) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonResp({ error: 'Supabase not configured' }, 503);

  try {
    const auth = await authenticateEdgeRequest(req, admin, { allowGuest: false });
    if (!auth.ok) {
      return jsonResp(
        { error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' },
        auth.status
      );
    }
    if (auth.caller.role === 'guest') {
      return jsonResp({ error: 'External guests have read-only portal access' }, 403);
    }

    const body = await req.json();
    const action = String(body?.action || '').trim();

    if (action === 'access_policy_save') {
      if (auth.caller.role !== 'super_admin') {
        return jsonResp({ error: 'Only SuperAdmin can modify workspace whitelist & access policy' }, 403);
      }
      const saved = await saveServerAccessPolicy(admin, body.policy || {}, auth.caller.email);
      await writeAuthAuditLog(admin, {
        email: auth.caller.email,
        user_id: auth.caller.id,
        provider: 'google',
        event_type: 'access_policy_updated',
        metadata: {
          enabled: saved.enabled,
          mode: saved.mode,
          allowedDomains: saved.allowedDomains,
          allowedEmailsCount: saved.allowedEmails.length,
          blockedEmailsCount: saved.blockedEmails.length,
          allowGuestPortal: saved.allowGuestPortal,
          autoApproveDomainUsers: saved.autoApproveDomainUsers,
        },
      });
      return jsonResp({ ok: true, accessPolicy: saved });
    }

    if (action === 'seed_if_empty') {
      const anyCheck = await fetch(`${admin.url}/rest/v1/shared_catalog_items?select=id&limit=1`, {
        headers: admin.headers,
      });
      const anyRows = anyCheck.ok ? await anyCheck.json() : [];
      if (Array.isArray(anyRows) && anyRows.length > 0) {
        return jsonResp({ ok: true, alreadySeeded: true });
      }

      const items = Array.isArray(body.items) ? body.items : [];
      const collections = Array.isArray(body.collections) ? body.collections : [];
      const metaEntries = [];
      if (Array.isArray(body.tree)) metaEntries.push({ key: 'categories_tree', data: body.tree });
      if (Array.isArray(body.activities)) metaEntries.push({ key: 'activities', data: body.activities.slice(0, 60) });
      if (Array.isArray(body.requiredIds)) metaEntries.push({ key: 'required_ids', data: body.requiredIds });

      if (items.length > 0) {
        const rows = items.map((it) => ({
          id: Number(it.id),
          data: it,
          status: it.status || 'Approved',
          vis: it.vis || 'Internal',
        }));
        await fetch(`${admin.url}/rest/v1/shared_catalog_items?on_conflict=id`, {
          method: 'POST',
          headers: { ...admin.headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(rows),
        });
      }

      if (collections.length > 0) {
        const cRows = collections.map((c) => ({
          id: String(c.id),
          tier: c.tier || 'shared',
          vis: c.vis || 'Internal',
          owner_email: String(c.ownerEmail || '').toLowerCase(),
          owner_name: c.owner || '',
          data: c,
        }));
        await fetch(`${admin.url}/rest/v1/shared_collections?on_conflict=id`, {
          method: 'POST',
          headers: { ...admin.headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(cRows),
        });
      }

      if (metaEntries.length > 0) {
        await fetch(`${admin.url}/rest/v1/shared_workspace_meta?on_conflict=key`, {
          method: 'POST',
          headers: { ...admin.headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(metaEntries),
        });
      }

      return jsonResp({ ok: true, seeded: true });
    }

    if (action === 'item_upsert') {
      const item = body.item;
      if (!item || item.id == null) {
        return jsonResp({ error: 'Valid item payload required' }, 400);
      }
      const itemId = Number(item.id);
      const isSharedResource = ['script', 'link', 'service', 'template', 'media'].includes(item.type);
      const isSuggest =
        !isSharedResource && (body.mode === 'suggest' || auth.caller.role === 'member');
      if (!isSharedResource && !isEditorOrAbove(auth.caller.role) && body.mode !== 'suggest') {
        return jsonResp({ error: 'Editors or Admins can edit library standards' }, 403);
      }

      const cleanItem = isSuggest
        ? {
            ...item,
            id: itemId,
            status: 'Review',
            vis: 'Internal',
            author: auth.caller.name || item.author || 'Member',
            authorEmail: auth.caller.email,
          }
        : {
            ...item,
            id: itemId,
            status: item.status || (isSharedResource ? 'Approved' : 'Draft'),
            vis: item.vis || 'Internal',
            author: item.author || auth.caller.name || 'Team',
            authorEmail: item.authorEmail || auth.caller.email,
          };

      if (cleanItem.status === 'Approved' && !isAdminRole(auth.caller.role) && !isSharedResource) {
        const existingRes = await fetch(
          `${admin.url}/rest/v1/shared_catalog_items?id=eq.${itemId}&select=status&limit=1`,
          { headers: admin.headers }
        );
        const existingRows = existingRes.ok ? await existingRes.json() : [];
        if (!Array.isArray(existingRows) || existingRows[0]?.status !== 'Approved') {
          cleanItem.status = 'Review';
        }
      }

      const row = {
        id: itemId,
        data: cleanItem,
        status: cleanItem.status,
        vis: cleanItem.vis,
        updated_at: new Date().toISOString(),
      };

      const res = await fetch(`${admin.url}/rest/v1/shared_catalog_items?on_conflict=id`, {
        method: 'POST',
        headers: { ...admin.headers, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        return jsonResp({ error: `Item save failed (${res.status})` }, 502);
      }
      return jsonResp({ ok: true, item: cleanItem });
    }

    if (action === 'item_comment') {
      const itemId = Number(body.itemId);
      const comment = body.comment;
      if (!Number.isFinite(itemId) || !comment || !comment.t) {
        return jsonResp({ error: 'Valid itemId and comment required' }, 400);
      }
      const curRes = await fetch(
        `${admin.url}/rest/v1/shared_catalog_items?id=eq.${itemId}&select=id,data,status,vis&limit=1`,
        { headers: admin.headers }
      );
      const curRows = curRes.ok ? await curRes.json() : [];
      if (!Array.isArray(curRows) || !curRows[0]) {
        return jsonResp({ error: 'Item not found' }, 404);
      }
      const existingData = curRows[0].data || {};
      const nextComments = [...(Array.isArray(existingData.c) ? existingData.c : []), { ...comment, by: auth.caller.name || comment.by }];
      const updated = { ...existingData, c: nextComments };
      await fetch(`${admin.url}/rest/v1/shared_catalog_items?id=eq.${itemId}`, {
        method: 'PATCH',
        headers: admin.headers,
        body: JSON.stringify({ data: updated, updated_at: new Date().toISOString() }),
      });
      return jsonResp({ ok: true, item: updated });
    }

    if (action === 'item_delete') {
      const itemId = Number(body.id);
      if (!Number.isFinite(itemId)) return jsonResp({ error: 'Valid item id required' }, 400);
      if (!isAdminRole(auth.caller.role)) {
        const curRes = await fetch(
          `${admin.url}/rest/v1/shared_catalog_items?id=eq.${itemId}&select=status,data&limit=1`,
          { headers: admin.headers }
        );
        const curRows = curRes.ok ? await curRes.json() : [];
        const cur = Array.isArray(curRows) && curRows[0];
        const isAuthorSharedRes =
          cur &&
          ['script', 'link', 'service', 'template', 'media'].includes(cur.data?.type) &&
          (cur.data?.authorEmail === auth.caller.email || cur.data?.author === auth.caller.name);
        if (!cur || (!isAuthorSharedRes && (cur.status !== 'Draft' || cur.data?.author !== auth.caller.name))) {
          return jsonResp({ error: 'Only Admins or authors can delete' }, 403);
        }
      }
      await fetch(`${admin.url}/rest/v1/shared_catalog_items?id=eq.${itemId}`, {
        method: 'PATCH',
        headers: admin.headers,
        body: JSON.stringify({ status: 'Deleted', updated_at: new Date().toISOString() }),
      });
      return jsonResp({ ok: true, deletedId: itemId });
    }

    if (action === 'collection_upsert') {
      const col = body.collection;
      if (!col || !col.id) return jsonResp({ error: 'Collection id required' }, 400);
      const tier = col.tier === 'official' || col.tier === 'shared' ? col.tier : 'personal';
      if (tier === 'official' && !isAdminRole(auth.caller.role)) {
        return jsonResp({ error: 'Only Admins can manage Official Kits' }, 403);
      }
      if (tier === 'shared' && !isEditorOrAbove(auth.caller.role)) {
        return jsonResp({ error: 'Editors or Admins can manage Shared Kits' }, 403);
      }
      const payload = {
        ...col,
        tier,
        ownerEmail: tier === 'personal' ? auth.caller.email : col.ownerEmail || auth.caller.email,
        owner: col.owner || auth.caller.name,
      };
      const row = {
        id: String(col.id),
        tier,
        vis: tier === 'personal' ? 'Restricted' : col.vis || 'Internal',
        owner_email: String(payload.ownerEmail || '').toLowerCase(),
        owner_name: String(payload.owner || ''),
        data: payload,
        updated_at: new Date().toISOString(),
      };
      const res = await fetch(`${admin.url}/rest/v1/shared_collections?on_conflict=id`, {
        method: 'POST',
        headers: { ...admin.headers, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row),
      });
      if (!res.ok) return jsonResp({ error: `Collection save failed (${res.status})` }, 502);
      return jsonResp({ ok: true, collection: payload });
    }

    if (action === 'collection_delete') {
      const id = String(body.id || '').trim();
      if (!id) return jsonResp({ error: 'Collection id required' }, 400);
      const curRes = await fetch(
        `${admin.url}/rest/v1/shared_collections?id=eq.${encodeURIComponent(id)}&select=id,tier,owner_email&limit=1`,
        { headers: admin.headers }
      );
      const curRows = curRes.ok ? await curRes.json() : [];
      const cur = Array.isArray(curRows) && curRows[0];
      if (!cur) return jsonResp({ ok: true, deletedId: id });
      if (!isAdminRole(auth.caller.role)) {
        if (cur.tier !== 'personal' && !isEditorOrAbove(auth.caller.role)) {
          return jsonResp({ error: 'Forbidden' }, 403);
        }
        if (cur.tier === 'personal' && String(cur.owner_email || '').toLowerCase() !== auth.caller.email) {
          return jsonResp({ error: 'Forbidden' }, 403);
        }
      }
      await fetch(`${admin.url}/rest/v1/shared_collections?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: admin.headers,
      });
      return jsonResp({ ok: true, deletedId: id });
    }

    if (action === 'meta_sync') {
      const key = String(body.key || '').trim();
      const memberAllowedKeys = ['activities', 'flagged_ids', 'search_logs', 'team_acks'];
      const editorAllowedKeys = ['categories_tree', 'required_ids', 'direct_shares', 'naming_schemas'];
      if (!memberAllowedKeys.includes(key) && !editorAllowedKeys.includes(key)) {
        return jsonResp({ error: 'Invalid metadata key' }, 400);
      }
      if (editorAllowedKeys.includes(key) && !isEditorOrAbove(auth.caller.role)) {
        return jsonResp({ error: 'Editor or Admin privileges required' }, 403);
      }
      await fetch(`${admin.url}/rest/v1/shared_workspace_meta?on_conflict=key`, {
        method: 'POST',
        headers: { ...admin.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key, data: body.data, updated_at: new Date().toISOString() }),
      });
      return jsonResp({ ok: true });
    }

    return jsonResp({ error: `Unknown workspace action: ${action}` }, 400);
  } catch (err) {
    return jsonResp({ error: err.message || 'Workspace mutation failed' }, 500);
  }
}
