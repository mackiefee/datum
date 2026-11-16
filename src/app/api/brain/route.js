export const runtime = 'edge';

const FALLBACK_SECRET = 'planit-edge-dev-hmac-secret-rotate-in-production-2026';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeStatus(s) {
  const clean = String(s || 'todo').trim().slice(0, 64);
  return clean || 'todo';
}

function sanitizeLinks(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && x.u)
    .slice(0, 30)
    .map((x) => ({
      u: String(x.u || '').trim().slice(0, 1200),
      l: String(x.l || '').trim().slice(0, 120),
    }))
    .filter((x) => x.u);
}

function sanitizePlannerPrefs(p) {
  if (!p || typeof p !== 'object') return {};
  const out = {};
  if (Array.isArray(p.statuses)) {
    out.statuses = p.statuses
      .filter((s) => s && s.id && s.label)
      .slice(0, 25)
      .map((s) => ({
        id: String(s.id).trim().slice(0, 64),
        label: String(s.label).trim().slice(0, 40),
        color: String(s.color || '#8e8e93').slice(0, 24),
        isDone: Boolean(s.isDone),
        isRevision: Boolean(s.isRevision),
      }));
  }
  if (Array.isArray(p.categories)) {
    out.categories = [...new Set(p.categories.map((c) => String(c || '').trim().slice(0, 60)).filter(Boolean))].slice(0, 60);
  }
  if (Array.isArray(p.projects)) {
    out.projects = [...new Set(p.projects.map((x) => String(x || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 60);
  }
  return out;
}

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
      headers: {
        apikey: admin.anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && user.email ? String(user.email).trim().toLowerCase() : null;
  } catch (e) {
    return null;
  }
}

function isLocalhostRequest(req) {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
}

async function resolveOwnerIdentity(req, admin, bodyEmail = '') {
  const authHdr = req.headers.get('authorization') || '';
  const bearer = authHdr.toLowerCase().startsWith('bearer ') ? authHdr.slice(7).trim() : '';
  const requestedEmail = String(
    req.headers.get('x-datum-user-email') ||
      bodyEmail ||
      new URL(req.url).searchParams.get('email') ||
      ''
  )
    .trim()
    .toLowerCase();

  let verifiedEmail = '';

  if (bearer && bearer !== 'local-dev-session') {
    const hmac = await verifyHmacJwt(bearer);
    if (hmac.valid && hmac.claims?.email) {
      verifiedEmail = String(hmac.claims.email).trim().toLowerCase();
    } else if (bearer.startsWith('eyJ')) {
      const oauthEmail = await verifySupabaseOAuthJwt(admin, bearer);
      if (oauthEmail) verifiedEmail = oauthEmail;
    }
  }

  // Strictly only allow unverified dev identity switching on localhost
  if (!verifiedEmail && isLocalhostRequest(req) && (!bearer || bearer === 'local-dev-session')) {
    if (requestedEmail && requestedEmail.includes('@')) {
      verifiedEmail = requestedEmail;
    }
  }

  if (!verifiedEmail) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  let dbUser = null;
  try {
    const uRes = await fetch(
      `${admin.url}/rest/v1/users?email=eq.${encodeURIComponent(verifiedEmail)}&select=id,status,role&limit=1`,
      { headers: admin.headers }
    );
    if (uRes.ok) {
      const rows = await uRes.json();
      dbUser = Array.isArray(rows) && rows[0] ? rows[0] : null;
    }
  } catch (e) {
    // Non-fatal: table lookup fallback
  }

  if (dbUser && dbUser.status === 'deactivated') {
    return { ok: false, status: 403, error: 'Account deactivated' };
  }

  return {
    ok: true,
    ownerEmail: verifiedEmail,
    userId: dbUser ? dbUser.id : null,
  };
}

function mapTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    title: row.title || '',
    notes: row.notes || '',
    project: row.project || 'General',
    category: row.category || '',
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : (row.is_urgent ? 3 : 0),
    dueDate: row.due_date || '',
    isUrgent: Boolean(row.is_urgent || Number(row.priority) >= 3),
    status: sanitizeStatus(row.status),
    parentTaskId: row.parent_task_id || null,
    revNumber: Number(row.rev_number || 0),
    requestedAt: row.requested_at || '',
    links: Array.isArray(row.links_json) ? row.links_json : [],
    linkedItemId: row.linked_item_id != null ? Number(row.linked_item_id) : null,
    linkedItemTitle: row.linked_item_title || '',
    sortOrder: Number(row.sort_order || 0),
    completedAt: row.completed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    title: row.title || '',
    body: row.body || '',
    project: row.project || 'General',
    tags: Array.isArray(row.tags) ? row.tags : [],
    isPinned: Boolean(row.is_pinned),
    linkedItemIds: Array.isArray(row.linked_item_ids) ? row.linked_item_ids : [],
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapState(row, ownerEmail) {
  if (!row) {
    return {
      ownerEmail,
      favs: null,
      pinned: null,
      acks: null,
      chk: null,
      chats: null,
      activeChatId: null,
      plannerPrefs: null,
      exists: false,
    };
  }
  return {
    ownerEmail: row.owner_email || ownerEmail,
    favs: Array.isArray(row.favs) ? row.favs : [],
    pinned: Array.isArray(row.pinned) ? row.pinned : [],
    acks: row.acks && typeof row.acks === 'object' ? row.acks : {},
    chk: row.chk && typeof row.chk === 'object' ? row.chk : {},
    chats: Array.isArray(row.chats) ? row.chats : [],
    activeChatId: row.active_chat_id || null,
    plannerPrefs: row.planner_prefs && typeof row.planner_prefs === 'object' ? row.planner_prefs : null,
    updatedAt: row.updated_at || null,
    exists: true,
  };
}

function sanitizeChats(chats) {
  if (!Array.isArray(chats)) return [];
  return chats.slice(0, 15).map((c) => ({
    id: String(c?.id || ''),
    title: String(c?.title || 'Chat').slice(0, 140),
    scopeDocId: c?.scopeDocId ?? null,
    scopeDocTitle: String(c?.scopeDocTitle || '').slice(0, 160),
    updatedAt: Number(c?.updatedAt || Date.now()),
    messages: Array.isArray(c?.messages)
      ? c.messages.slice(-20).map((m) => ({
          id: String(m?.id || ''),
          role: m?.role === 'user' ? 'user' : 'assistant',
          text: String(m?.text || '').slice(0, 6000),
          query: m?.query ? String(m.query).slice(0, 400) : undefined,
          matchIds: Array.isArray(m?.matchIds) ? m.matchIds.slice(0, 12) : undefined,
          src: Array.isArray(m?.src) ? m.src.slice(0, 8) : undefined,
          actions: m?.actions || undefined,
          scopeDocTitle: m?.scopeDocTitle || undefined,
          createdAt: Number(m?.createdAt || Date.now()),
        }))
      : [],
  }));
}

async function fetchRowOwner(admin, table, id) {
  const res = await fetch(
    `${admin.url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=id,owner_email&limit=1`,
    { headers: admin.headers }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function GET(req) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return jsonResp({ configured: false, tasks: [], notes: [], state: null });
  }

  const ident = await resolveOwnerIdentity(req, admin);
  if (!ident.ok) {
    return jsonResp({ error: ident.error }, ident.status);
  }

  const emailEq = encodeURIComponent(ident.ownerEmail);
  try {
    const [tasksRes, notesRes, stateRes] = await Promise.all([
      fetch(
        `${admin.url}/rest/v1/personal_tasks?owner_email=eq.${emailEq}&select=*&order=is_urgent.desc,due_date.asc.nullslast,created_at.desc`,
        { headers: admin.headers }
      ),
      fetch(
        `${admin.url}/rest/v1/personal_notes?owner_email=eq.${emailEq}&select=*&order=is_pinned.desc,updated_at.desc`,
        { headers: admin.headers }
      ),
      fetch(
        `${admin.url}/rest/v1/user_brain_state?owner_email=eq.${emailEq}&select=*&limit=1`,
        { headers: admin.headers }
      ),
    ]);

    if (!tasksRes.ok || !notesRes.ok || !stateRes.ok) {
      return jsonResp(
        {
          error: 'Failed to load Second Brain snapshot from Supabase',
          statuses: [tasksRes.status, notesRes.status, stateRes.status],
        },
        502
      );
    }

    const [tasksRows, notesRows, stateRows] = await Promise.all([
      tasksRes.json(),
      notesRes.json(),
      stateRes.json(),
    ]);

    return jsonResp({
      configured: true,
      ownerEmail: ident.ownerEmail,
      userId: ident.userId,
      tasks: (Array.isArray(tasksRows) ? tasksRows : []).map(mapTask),
      notes: (Array.isArray(notesRows) ? notesRows : []).map(mapNote),
      state: mapState(Array.isArray(stateRows) ? stateRows[0] : null, ident.ownerEmail),
    });
  } catch (e) {
    return jsonResp({ error: 'Brain snapshot error' }, 500);
  }
}

export async function POST(req) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return jsonResp({ configured: false, offline: true }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return jsonResp({ error: 'Invalid JSON body' }, 400);
  }

  const ident = await resolveOwnerIdentity(req, admin, body?.ownerEmail || '');
  if (!ident.ok) {
    return jsonResp({ error: ident.error }, ident.status);
  }

  const action = String(body?.action || '').trim();

  try {
    if (action === 'task_upsert') {
      const t = body.task || {};
      const title = String(t.title || '').trim();
      if (!title) return jsonResp({ error: 'Task title is required' }, 400);

      const status = sanitizeStatus(t.status);
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(t.dueDate || '')) ? String(t.dueDate) : null;
      const requestedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(t.requestedAt || '')) ? String(t.requestedAt) : null;
      const linkedNum = t.linkedItemId != null && t.linkedItemId !== '' ? Number(t.linkedItemId) : null;
      const rawPri = Number.isFinite(Number(t.priority)) ? Math.max(0, Math.min(3, Math.trunc(Number(t.priority)))) : (t.isUrgent ? 3 : 0);
      const isUrgent = Boolean(t.isUrgent || rawPri >= 3);
      const priority = isUrgent && rawPri === 0 ? 3 : rawPri;

      let parentTaskId = UUID_RE.test(String(t.parentTaskId || '')) ? String(t.parentTaskId) : null;
      if (parentTaskId) {
        const parentOwner = await fetchRowOwner(admin, 'personal_tasks', parentTaskId);
        if (parentOwner && String(parentOwner.owner_email || '').toLowerCase() !== ident.ownerEmail) {
          return jsonResp({ error: 'Forbidden parent task reference' }, 403);
        }
        if (!parentOwner) parentTaskId = null;
      }

      const payload = {
        user_id: ident.userId,
        owner_email: ident.ownerEmail,
        title: title.slice(0, 300),
        notes: String(t.notes || '').slice(0, 8000),
        project: String(t.project || 'General').trim().slice(0, 80) || 'General',
        category: String(t.category || '').trim().slice(0, 60),
        priority,
        due_date: dueDate,
        is_urgent: isUrgent,
        status,
        parent_task_id: parentTaskId,
        rev_number: Number.isFinite(Number(t.revNumber)) ? Math.max(0, Math.trunc(Number(t.revNumber))) : 0,
        requested_at: requestedAt,
        links_json: sanitizeLinks(t.links),
        linked_item_id: Number.isFinite(linkedNum) && linkedNum > 0 ? Math.trunc(linkedNum) : null,
        linked_item_title: String(t.linkedItemTitle || '').slice(0, 220),
        sort_order: Number.isFinite(Number(t.sortOrder)) ? Math.trunc(Number(t.sortOrder)) : 0,
        completed_at: t.completedAt || (status === 'done' ? new Date().toISOString() : null),
      };

      const candidateId = UUID_RE.test(String(t.id || '')) ? String(t.id) : '';
      if (candidateId) {
        const existing = await fetchRowOwner(admin, 'personal_tasks', candidateId);
        if (existing) {
          if (String(existing.owner_email || '').toLowerCase() !== ident.ownerEmail) {
            return jsonResp({ error: 'Forbidden' }, 403);
          }
          const patchRes = await fetch(
            `${admin.url}/rest/v1/personal_tasks?id=eq.${encodeURIComponent(candidateId)}&owner_email=eq.${encodeURIComponent(ident.ownerEmail)}`,
            {
              method: 'PATCH',
              headers: { ...admin.headers, Prefer: 'return=representation' },
              body: JSON.stringify(payload),
            }
          );
          if (!patchRes.ok) {
            return jsonResp({ error: `Task update failed (${patchRes.status})` }, 502);
          }
          const rows = await patchRes.json();
          return jsonResp({ ok: true, task: mapTask(rows[0]) });
        }
        payload.id = candidateId;
      }

      const insRes = await fetch(`${admin.url}/rest/v1/personal_tasks`, {
        method: 'POST',
        headers: { ...admin.headers, Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!insRes.ok) {
        return jsonResp({ error: `Task create failed (${insRes.status})` }, 502);
      }
      const rows = await insRes.json();
      return jsonResp({ ok: true, task: mapTask(rows[0]) });
    }

    if (action === 'task_delete') {
      const id = String(body.id || '').trim();
      if (!UUID_RE.test(id)) return jsonResp({ error: 'Valid task UUID required' }, 400);
      const delRes = await fetch(
        `${admin.url}/rest/v1/personal_tasks?id=eq.${encodeURIComponent(id)}&owner_email=eq.${encodeURIComponent(ident.ownerEmail)}`,
        {
          method: 'DELETE',
          headers: admin.headers,
        }
      );
      if (!delRes.ok) return jsonResp({ error: `Task delete failed (${delRes.status})` }, 502);
      return jsonResp({ ok: true, deletedId: id });
    }

    if (action === 'note_upsert') {
      const n = body.note || {};
      const title = String(n.title || '').trim();
      const noteBody = String(n.body || '');
      if (!title && !noteBody.trim()) {
        return jsonResp({ error: 'Note content cannot be empty' }, 400);
      }

      const payload = {
        user_id: ident.userId,
        owner_email: ident.ownerEmail,
        title: (title || 'Untitled Note').slice(0, 240),
        body: noteBody.slice(0, 30000),
        project: String(n.project || 'General').trim().slice(0, 80) || 'General',
        tags: Array.isArray(n.tags) ? n.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 16) : [],
        is_pinned: Boolean(n.isPinned),
        linked_item_ids: Array.isArray(n.linkedItemIds)
          ? [...new Set(n.linkedItemIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))]
          : [],
      };

      const candidateId = UUID_RE.test(String(n.id || '')) ? String(n.id) : '';
      if (candidateId) {
        const existing = await fetchRowOwner(admin, 'personal_notes', candidateId);
        if (existing) {
          if (String(existing.owner_email || '').toLowerCase() !== ident.ownerEmail) {
            return jsonResp({ error: 'Forbidden' }, 403);
          }
          const patchRes = await fetch(
            `${admin.url}/rest/v1/personal_notes?id=eq.${encodeURIComponent(candidateId)}&owner_email=eq.${encodeURIComponent(ident.ownerEmail)}`,
            {
              method: 'PATCH',
              headers: { ...admin.headers, Prefer: 'return=representation' },
              body: JSON.stringify(payload),
            }
          );
          if (!patchRes.ok) {
            return jsonResp({ error: `Note update failed (${patchRes.status})` }, 502);
          }
          const rows = await patchRes.json();
          return jsonResp({ ok: true, note: mapNote(rows[0]) });
        }
        payload.id = candidateId;
      }

      const insRes = await fetch(`${admin.url}/rest/v1/personal_notes`, {
        method: 'POST',
        headers: { ...admin.headers, Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!insRes.ok) {
        return jsonResp({ error: `Note create failed (${insRes.status})` }, 502);
      }
      const rows = await insRes.json();
      return jsonResp({ ok: true, note: mapNote(rows[0]) });
    }

    if (action === 'note_delete') {
      const id = String(body.id || '').trim();
      if (!UUID_RE.test(id)) return jsonResp({ error: 'Valid note UUID required' }, 400);
      const delRes = await fetch(
        `${admin.url}/rest/v1/personal_notes?id=eq.${encodeURIComponent(id)}&owner_email=eq.${encodeURIComponent(ident.ownerEmail)}`,
        {
          method: 'DELETE',
          headers: admin.headers,
        }
      );
      if (!delRes.ok) return jsonResp({ error: `Note delete failed (${delRes.status})` }, 502);
      return jsonResp({ ok: true, deletedId: id });
    }

    if (action === 'state_sync') {
      const s = body.state || {};
      const payload = {
        owner_email: ident.ownerEmail,
        user_id: ident.userId,
        favs: Array.isArray(s.favs) ? s.favs.slice(0, 500) : [],
        pinned: Array.isArray(s.pinned) ? s.pinned.slice(0, 500) : [],
        acks: s.acks && typeof s.acks === 'object' ? s.acks : {},
        chk: s.chk && typeof s.chk === 'object' ? s.chk : {},
        chats: sanitizeChats(s.chats),
        active_chat_id: s.activeChatId ? String(s.activeChatId) : null,
        planner_prefs: sanitizePlannerPrefs(s.plannerPrefs),
      };
      const upRes = await fetch(`${admin.url}/rest/v1/user_brain_state?on_conflict=owner_email`, {
        method: 'POST',
        headers: {
          ...admin.headers,
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      });
      if (!upRes.ok) {
        return jsonResp({ error: `State sync failed (${upRes.status})` }, 502);
      }
      const rows = await upRes.json();
      return jsonResp({ ok: true, state: mapState(rows[0], ident.ownerEmail) });
    }

    return jsonResp({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return jsonResp({ error: 'Second Brain request failed' }, 500);
  }
}
