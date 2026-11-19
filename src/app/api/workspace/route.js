export const runtime = 'edge';

const FALLBACK_SECRET = 'planit-edge-dev-hmac-secret-rotate-in-production-2026';
const enc = new TextEncoder();

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function getSecret() {
  return (typeof process !== 'undefined' && process.env && process.env.AUTH_SECRET) || FALLBACK_SECRET;
}

function fromBase64Url(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyHmacJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { valid: false };
  const [header, body, sig] = parts;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const ok = await crypto.subtle.verify('HMAC', key, fromBase64Url(sig), enc.encode(`${header}.${body}`));
    if (!ok) return { valid: false };
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (claims.exp && Date.now() > claims.exp) return { valid: false };
    return { valid: true, claims };
  } catch (e) {
    return { valid: false };
  }
}

function getSupabaseAdmin() {
  const url = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : '';
  const serviceKey = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
  const anonKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : '';
  if (!url || !serviceKey) return null;
  const headers = { 'Content-Type': 'application/json', apikey: serviceKey };
  if (serviceKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${serviceKey}`;
  }
  return { url, headers, anonKey: anonKey || serviceKey };
}

async function verifySupabaseOAuthJwt(admin, token) {
  if (!admin || !token || !token.startsWith('eyJ')) return null;
  try {
    const res = await fetch(`${admin.url}/auth/v1/user`, {
      headers: { apikey: admin.anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return u && u.email ? String(u.email).trim().toLowerCase() : null;
  } catch (e) {
    return null;
  }
}

function isLocalhostRequest(req) {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
}

async function resolveCaller(req, admin) {
  const authHdr = req.headers.get('authorization') || '';
  const bearer = authHdr.toLowerCase().startsWith('bearer ') ? authHdr.slice(7).trim() : '';
  const supaTok = String(req.headers.get('x-datum-supa-token') || '').trim();
  const requestedEmail = String(req.headers.get('x-datum-user-email') || '').trim().toLowerCase();

  let verifiedEmail = '';

  if (bearer && bearer !== 'local-dev-session' && bearer !== 'local-fallback-token') {
    const hmac = await verifyHmacJwt(bearer);
    if (hmac.valid && hmac.claims?.email) {
      verifiedEmail = String(hmac.claims.email).trim().toLowerCase();
    } else if (bearer.startsWith('eyJ')) {
      const oauthEmail = await verifySupabaseOAuthJwt(admin, bearer);
      if (oauthEmail) verifiedEmail = oauthEmail;
    }
  }

  if (!verifiedEmail && supaTok && supaTok.startsWith('eyJ')) {
    const oauthEmail = await verifySupabaseOAuthJwt(admin, supaTok);
    if (oauthEmail) verifiedEmail = oauthEmail;
  }

  if (
    !verifiedEmail &&
    isLocalhostRequest(req) &&
    (!bearer || bearer === 'local-dev-session' || bearer === 'local-fallback-token')
  ) {
    if (requestedEmail && requestedEmail.includes('@')) {
      verifiedEmail = requestedEmail;
    }
  }

  if (!verifiedEmail) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const uRes = await fetch(
    `${admin.url}/rest/v1/users?email=eq.${encodeURIComponent(verifiedEmail)}&select=id,email,name,role,status&limit=1`,
    { headers: admin.headers }
  );
  const rows = uRes.ok ? await uRes.json() : [];
  const dbUser = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (dbUser && dbUser.status === 'deactivated') {
    return { ok: false, status: 403, error: 'Account deactivated' };
  }
  return {
    ok: true,
    caller: {
      id: dbUser ? dbUser.id : null,
      email: verifiedEmail,
      name: (dbUser && dbUser.name) || verifiedEmail.split('@')[0],
      role: (dbUser && dbUser.role) || 'member',
    },
  };
}

function isEditorOrAbove(role) {
  return role === 'super_admin' || role === 'admin' || role === 'editor';
}

function isAdminRole(role) {
  return role === 'super_admin' || role === 'admin';
}

export async function GET(req) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return jsonResp({ configured: false, needsSeed: false, items: [], collections: [], meta: {} });
  }

  try {
    const auth = await resolveCaller(req, admin);
    if (!auth.ok) return jsonResp({ error: auth.error }, auth.status);

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

    // Check if DB has ever been seeded at all (even for filtered views)
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
      tree: Array.isArray(meta.categories_tree) ? meta.categories_tree : null,
      activities: cleanActivities,
      requiredIds: Array.isArray(meta.required_ids) ? meta.required_ids : null,
      flaggedIds: Array.isArray(meta.flagged_ids) ? meta.flagged_ids : null,
      searchLogs: Array.isArray(meta.search_logs) ? meta.search_logs : null,
      shares: Array.isArray(meta.direct_shares) ? meta.direct_shares : null,
      namingSchemas: Array.isArray(meta.naming_schemas) ? meta.naming_schemas : null,
      teamAcks: meta.team_acks && typeof meta.team_acks === 'object' ? meta.team_acks : null,
    });
  } catch (err) {
    return jsonResp({ error: err.message || 'Workspace load failed' }, 500);
  }
}

export async function POST(req) {
  const admin = getSupabaseAdmin();
  if (!admin) return jsonResp({ error: 'Supabase not configured' }, 503);

  try {
    const auth = await resolveCaller(req, admin);
    if (!auth.ok) return jsonResp({ error: auth.error }, auth.status);
    if (auth.caller.role === 'guest') {
      return jsonResp({ error: 'External guests have read-only portal access' }, 403);
    }

    const body = await req.json();
    const action = String(body?.action || '').trim();

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
      const isSuggest = body.mode === 'suggest' || auth.caller.role === 'member';
      if (!isEditorOrAbove(auth.caller.role) && body.mode !== 'suggest') {
        return jsonResp({ error: 'Editors or Admins can edit library standards' }, 403);
      }

      // Members can only create suggestions under Review status
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
            status: item.status || 'Draft',
            vis: item.vis || 'Internal',
          };

      if (cleanItem.status === 'Approved' && !isAdminRole(auth.caller.role)) {
        // Check if already Approved or user is Editor publishing allowed item? Keep Editor Draft/Review; Admin publishes unless existing
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
        if (!cur || cur.status !== 'Draft' || cur.data?.author !== auth.caller.name) {
          return jsonResp({ error: 'Only Admins or Draft authors can delete' }, 403);
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
