import {
  APP_TO_DB_ROLE,
  DB_TO_APP_ROLE,
  authenticateEdgeRequest,
  fetchServerAccessPolicy,
  getSupabaseAdmin,
  isAdminRole,
  saveServerAccessPolicy,
} from '../../../lib/edgeAuth.js';

export const runtime = 'edge';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function mapUserRow(row, teamsById, membersByUserId) {
  const primaryTeam = row.primary_team_id ? teamsById.get(row.primary_team_id) : null;
  const memberTeamNames = membersByUserId.get(row.id) || [];
  const teamNames = [];
  if (primaryTeam && primaryTeam.name) teamNames.push(primaryTeam.name);
  memberTeamNames.forEach((tn) => {
    if (tn && !teamNames.includes(tn)) teamNames.push(tn);
  });

  const dept =
    (primaryTeam && primaryTeam.name) ||
    (row.role === 'guest' ? 'External' : row.hosted_domain || 'Team');

  return {
    id: row.id,
    authUid: row.auth_uid || null,
    name: row.name || (row.email ? row.email.split('@')[0] : 'User'),
    email: row.email || '',
    avatar: row.avatar_url || '',
    role: DB_TO_APP_ROLE[row.role] || 'Member',
    status: row.status || 'active',
    primaryTeamId: row.primary_team_id || null,
    dept,
    teams: teamNames,
    title: row.title || '',
    hostedDomain: row.hosted_domain || '',
    emailVerified: Boolean(row.email_verified),
    provider: row.role === 'guest' ? 'guest' : 'google',
    lastLoginAt: row.last_login_at || null,
    lastSeenAt: row.last_seen_at || null,
    createdAt: row.created_at || null,
  };
}

async function fetchDirectoryPayload(admin) {
  const [usersRes, teamsRes, membersRes] = await Promise.all([
    fetch(
      `${admin.url}/rest/v1/users?select=id,auth_uid,name,email,avatar_url,role,status,primary_team_id,title,hosted_domain,email_verified,last_login_at,last_seen_at,created_at&order=created_at.asc,name.asc`,
      { headers: admin.headers }
    ),
    fetch(
      `${admin.url}/rest/v1/teams?select=id,name,group_type,color,lead_user_id,created_at&order=name.asc`,
      { headers: admin.headers }
    ),
    fetch(`${admin.url}/rest/v1/team_members?select=team_id,user_id,team_role`, {
      headers: admin.headers,
    }),
  ]);

  if (!usersRes.ok) {
    const msg = await usersRes.text().catch(() => '');
    throw new Error(`Supabase users query failed (${usersRes.status}): ${msg.slice(0, 140)}`);
  }

  const rawUsers = await usersRes.json();
  const rawTeams = teamsRes.ok ? await teamsRes.json() : [];
  const rawMembers = membersRes.ok ? await membersRes.json() : [];

  const usersList = Array.isArray(rawUsers) ? rawUsers : [];
  const teamsList = Array.isArray(rawTeams) ? rawTeams : [];
  const membersList = Array.isArray(rawMembers) ? rawMembers : [];

  const teamsById = new Map(teamsList.map((t) => [t.id, t]));
  const usersById = new Map(usersList.map((u) => [u.id, u]));
  const membersByUserId = new Map();
  const membersByTeamId = new Map();

  for (const m of membersList) {
    const tm = teamsById.get(m.team_id);
    const usr = usersById.get(m.user_id);
    if (tm && usr) {
      const arr = membersByUserId.get(usr.id) || [];
      arr.push(tm.name);
      membersByUserId.set(usr.id, arr);

      const uArr = membersByTeamId.get(tm.id) || [];
      uArr.push(usr.name);
      membersByTeamId.set(tm.id, uArr);
    }
  }

  for (const u of usersList) {
    if (u.primary_team_id && teamsById.has(u.primary_team_id) && u.status !== 'deactivated') {
      const uArr = membersByTeamId.get(u.primary_team_id) || [];
      if (!uArr.includes(u.name)) uArr.push(u.name);
      membersByTeamId.set(u.primary_team_id, uArr);
    }
  }

  const mappedUsers = usersList.map((row) => mapUserRow(row, teamsById, membersByUserId));
  const mappedTeams = teamsList.map((t) => {
    const leadUser = t.lead_user_id ? usersById.get(t.lead_user_id) : null;
    return {
      id: t.id,
      name: t.name,
      groupType: t.group_type || 'department',
      color: t.color || '#0a84ff',
      leadUserId: t.lead_user_id || null,
      lead: (leadUser && leadUser.name) || 'Workspace Lead',
      members: membersByTeamId.get(t.id) || [],
    };
  });

  return { configured: true, users: mappedUsers, teams: mappedTeams };
}

async function resolveFallbackUserId(admin, targetId, preferredFallbackId = '') {
  if (preferredFallbackId && UUID_RE.test(preferredFallbackId) && preferredFallbackId !== targetId) {
    const chk = await fetch(
      `${admin.url}/rest/v1/users?id=eq.${encodeURIComponent(preferredFallbackId)}&status=eq.active&select=id&limit=1`,
      { headers: admin.headers }
    );
    if (chk.ok) {
      const rows = await chk.json();
      if (Array.isArray(rows) && rows[0]) return rows[0].id;
    }
  }
  const candRes = await fetch(
    `${admin.url}/rest/v1/users?status=eq.active&id=neq.${encodeURIComponent(targetId)}&role=in.(super_admin,admin,editor)&select=id,role&order=role.asc,created_at.asc&limit=1`,
    { headers: admin.headers }
  );
  if (candRes.ok) {
    const rows = await candRes.json();
    if (Array.isArray(rows) && rows[0]) return rows[0].id;
  }
  return null;
}

async function supaReq(admin, path, init = {}) {
  const res = await fetch(`${admin.url}${path}`, {
    ...init,
    headers: { ...admin.headers, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase ${init.method || 'GET'} ${path} failed (${res.status}): ${txt.slice(0, 180)}`);
  }
  return res;
}

export async function GET(req) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return jsonResp({ configured: false, users: [], teams: [] });
  }
  try {
    const auth = await authenticateEdgeRequest(req, admin, { allowGuest: false });
    if (!auth.ok) {
      return jsonResp(
        { error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' },
        auth.status
      );
    }
    if (auth.caller.role === 'guest') {
      return jsonResp({ error: 'External guests cannot browse internal directory', accessDenied: true }, 403);
    }
    const payload = await fetchDirectoryPayload(admin);
    return jsonResp(payload);
  } catch (err) {
    return jsonResp({ error: err.message || 'Failed to load directory' }, 500);
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
    if (!isAdminRole(auth.caller.role)) {
      return jsonResp({ error: 'Administrator privileges required' }, 403);
    }

    const body = await req.json();
    const action = body?.action || 'invite';

    if (action === 'team_create') {
      const name = String(body.name || '').trim().slice(0, 80);
      if (!name) return jsonResp({ error: 'Team name is required' }, 400);
      const leadUserId = body.leadUserId && UUID_RE.test(body.leadUserId) ? body.leadUserId : auth.caller.id;
      const color = String(body.color || '#0a84ff').slice(0, 24);
      const tRes = await supaReq(admin, '/rest/v1/teams', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          name,
          group_type: body.groupType === 'functional_team' ? 'functional_team' : 'department',
          color,
          lead_user_id: leadUserId,
        }),
      });
      const createdTeamRows = await tRes.json();
      const createdTeam = Array.isArray(createdTeamRows) ? createdTeamRows[0] : createdTeamRows;
      if (createdTeam && leadUserId) {
        await supaReq(admin, '/rest/v1/team_members?on_conflict=team_id,user_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ team_id: createdTeam.id, user_id: leadUserId, team_role: 'lead' }),
        }).catch(() => null);
      }
      const payload = await fetchDirectoryPayload(admin);
      return jsonResp({ ok: true, team: createdTeam, ...payload });
    }

    // Invite / Add user to public.users
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return jsonResp({ error: 'Valid Google email is required' }, 400);
    }
    const name = String(body.name || email.split('@')[0]).trim().slice(0, 120);
    const title = String(body.title || '').trim().slice(0, 140);
    let dbRole = APP_TO_DB_ROLE[body.role] || 'member';
    if (dbRole === 'super_admin' && auth.caller.role !== 'super_admin') {
      dbRole = 'admin';
    }
    const domain = email.split('@')[1] || '';

    const dupRes = await fetch(
      `${admin.url}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      { headers: admin.headers }
    );
    const dupRows = dupRes.ok ? await dupRes.json() : [];
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      return jsonResp({ error: 'A user with this email already exists in database' }, 409);
    }

    let primaryTeamId = null;
    if (body.dept) {
      const tmRes = await fetch(
        `${admin.url}/rest/v1/teams?name=eq.${encodeURIComponent(String(body.dept).trim())}&select=id&limit=1`,
        { headers: admin.headers }
      );
      const tmRows = tmRes.ok ? await tmRes.json() : [];
      if (Array.isArray(tmRows) && tmRows[0]) primaryTeamId = tmRows[0].id;
    }

    const insRes = await supaReq(admin, '/rest/v1/users', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        email,
        name,
        title,
        role: dbRole,
        status: 'active',
        primary_team_id: primaryTeamId,
        hosted_domain: domain,
        email_verified: true,
      }),
    });
    const inserted = await insRes.json();
    const row = Array.isArray(inserted) ? inserted[0] : inserted;

    if (row && primaryTeamId) {
      await supaReq(admin, '/rest/v1/team_members?on_conflict=team_id,user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ team_id: primaryTeamId, user_id: row.id, team_role: 'member' }),
      }).catch(() => null);
    }

    // Also add invited email to access_policy whitelist (and un-block if previously blocked)
    let updatedPolicy = null;
    if (body.addToWhitelist !== false) {
      try {
        const curPolicy = await fetchServerAccessPolicy(admin, { force: true });
        const nextAllowed = [...new Set([...(curPolicy.allowedEmails || []), email])];
        const nextBlocked = (curPolicy.blockedEmails || []).filter((e) => e !== email);
        updatedPolicy = await saveServerAccessPolicy(
          admin,
          { ...curPolicy, allowedEmails: nextAllowed, blockedEmails: nextBlocked },
          auth.caller.email
        );
      } catch (e) {
        // Non-fatal if meta update fails
      }
    }

    await supaReq(admin, '/rest/v1/activities', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        actor_id: auth.caller.id,
        actor_name: auth.caller.name || auth.caller.email,
        action_type: 'user_invited',
        target_type: 'user',
        target_id: row.id,
        target_title: `${name} (${email})`,
        details: { role: dbRole, dept: body.dept || '', addedToWhitelist: body.addToWhitelist !== false },
      }),
    }).catch(() => null);

    const payload = await fetchDirectoryPayload(admin);
    return jsonResp({
      ok: true,
      userId: row.id,
      ...(updatedPolicy ? { accessPolicy: updatedPolicy } : {}),
      ...payload,
    });
  } catch (err) {
    return jsonResp({ error: err.message || 'User invite failed' }, 500);
  }
}

export async function PATCH(req) {
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
    if (!isAdminRole(auth.caller.role)) {
      return jsonResp({ error: 'Administrator privileges required' }, 403);
    }

    const body = await req.json();
    const action = body?.action || 'update';

    if (action === 'team_toggle_member') {
      const teamId = String(body.teamId || '').trim();
      const userId = String(body.userId || '').trim();
      const member = Boolean(body.member);
      if (!UUID_RE.test(teamId) || !UUID_RE.test(userId)) {
        return jsonResp({ error: 'Invalid team or user UUID' }, 400);
      }
      if (member) {
        await supaReq(admin, '/rest/v1/team_members?on_conflict=team_id,user_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ team_id: teamId, user_id: userId, team_role: 'member' }),
        });
      } else {
        await supaReq(
          admin,
          `/rest/v1/team_members?team_id=eq.${encodeURIComponent(teamId)}&user_id=eq.${encodeURIComponent(userId)}`,
          { method: 'DELETE' }
        );
      }
      const payload = await fetchDirectoryPayload(admin);
      return jsonResp({ ok: true, ...payload });
    }

    const rawId = String(body.id || '').trim();
    const rawEmail = String(body.email || '').trim().toLowerCase();
    const lookupFilter = UUID_RE.test(rawId)
      ? `id=eq.${encodeURIComponent(rawId)}`
      : rawEmail && rawEmail.includes('@')
      ? `email=eq.${encodeURIComponent(rawEmail)}`
      : '';
    if (!lookupFilter) {
      return jsonResp({ error: 'Valid user UUID required' }, 400);
    }

    const tgtRes = await fetch(
      `${admin.url}/rest/v1/users?${lookupFilter}&select=id,email,name,role,status,session_version&limit=1`,
      { headers: admin.headers }
    );
    const tgtRows = tgtRes.ok ? await tgtRes.json() : [];
    const target = Array.isArray(tgtRows) && tgtRows[0] ? tgtRows[0] : null;
    if (!target) {
      return jsonResp({ error: 'User not found in database' }, 404);
    }
    if (target.role === 'super_admin' && auth.caller.role !== 'super_admin') {
      return jsonResp({ error: 'Only Super Admin can modify another Super Admin' }, 403);
    }

    if (action === 'deactivate') {
      if (target.id === auth.caller.id) {
        return jsonResp({ error: 'You cannot deactivate your own active account' }, 400);
      }
      const fallbackId = await resolveFallbackUserId(admin, target.id, body.fallbackUserId);
      if (fallbackId) {
        await supaReq(admin, '/rest/v1/rpc/deactivate_user_and_transfer_ownership', {
          method: 'POST',
          body: JSON.stringify({
            p_user_id: target.id,
            p_fallback_user_id: fallbackId,
            p_actor_id: auth.caller.id,
          }),
        });
      } else {
        await supaReq(admin, `/rest/v1/users?id=eq.${encodeURIComponent(target.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'deactivated' }),
        });
      }
      await supaReq(admin, `/rest/v1/users?id=eq.${encodeURIComponent(target.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ session_version: Number(target.session_version || 1) + 1 }),
      }).catch(() => null);
      const payload = await fetchDirectoryPayload(admin);
      return jsonResp({ ok: true, ...payload });
    }

    if (action === 'reactivate') {
      await supaReq(admin, `/rest/v1/users?id=eq.${encodeURIComponent(target.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      });
      const payload = await fetchDirectoryPayload(admin);
      return jsonResp({ ok: true, ...payload });
    }

    const patch = {};
    if (body.role !== undefined) {
      const nextDbRole = APP_TO_DB_ROLE[body.role];
      if (!nextDbRole) return jsonResp({ error: 'Invalid role value' }, 400);
      if (nextDbRole === 'super_admin' && auth.caller.role !== 'super_admin') {
        return jsonResp({ error: 'Only Super Admin can assign Super Admin role' }, 403);
      }
      patch.role = nextDbRole;
      patch.session_version = Number(target.session_version || 1) + 1;
    }
    if (body.name !== undefined && String(body.name).trim()) {
      patch.name = String(body.name).trim().slice(0, 120);
    }
    if (body.title !== undefined) {
      patch.title = String(body.title).trim().slice(0, 140);
    }

    if (Object.keys(patch).length > 0) {
      await supaReq(admin, `/rest/v1/users?id=eq.${encodeURIComponent(target.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    }

    const payload = await fetchDirectoryPayload(admin);
    return jsonResp({ ok: true, ...payload });
  } catch (err) {
    return jsonResp({ error: err.message || 'Failed to update user' }, 500);
  }
}

export async function DELETE(req) {
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
    if (!isAdminRole(auth.caller.role)) {
      return jsonResp({ error: 'Administrator privileges required' }, 403);
    }

    let body = {};
    try {
      body = await req.json();
    } catch {}
    const urlId = new URL(req.url).searchParams.get('id') || '';
    const urlFallback = new URL(req.url).searchParams.get('fallbackUserId') || '';
    const rawId = String(body?.id || urlId || '').trim();
    const rawEmail = String(body?.email || '').trim().toLowerCase();
    const preferredFallback = String(body?.fallbackUserId || urlFallback || '').trim();

    const lookupFilter = UUID_RE.test(rawId)
      ? `id=eq.${encodeURIComponent(rawId)}`
      : rawEmail && rawEmail.includes('@')
      ? `email=eq.${encodeURIComponent(rawEmail)}`
      : '';
    if (!lookupFilter) {
      return jsonResp({ error: 'Valid user UUID is required' }, 400);
    }

    const tgtRes = await fetch(
      `${admin.url}/rest/v1/users?${lookupFilter}&select=id,auth_uid,email,name,role&limit=1`,
      { headers: admin.headers }
    );
    const tgtRows = tgtRes.ok ? await tgtRes.json() : [];
    const target = Array.isArray(tgtRows) && tgtRows[0] ? tgtRows[0] : null;
    if (!target) {
      return jsonResp({ error: 'User not found in database' }, 404);
    }
    const id = target.id;
    if (id === auth.caller.id) {
      return jsonResp({ error: 'You cannot delete your own account' }, 400);
    }
    if (target.role === 'super_admin' && auth.caller.role !== 'super_admin') {
      return jsonResp({ error: 'Only Super Admin can delete another Super Admin' }, 403);
    }

    const fallbackId = await resolveFallbackUserId(admin, target.id, preferredFallback);
    if (!fallbackId) {
      return jsonResp(
        { error: 'Cannot delete the last remaining active owner in database' },
        409
      );
    }

    await Promise.all([
      supaReq(admin, `/rest/v1/catalog_items?owner_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ owner_id: fallbackId }),
      }),
      supaReq(admin, `/rest/v1/categories?owner_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ owner_id: fallbackId }),
      }),
      supaReq(admin, `/rest/v1/collections?owner_id=eq.${encodeURIComponent(id)}&tier=neq.personal`, {
        method: 'PATCH',
        body: JSON.stringify({ owner_id: fallbackId }),
      }),
      supaReq(admin, `/rest/v1/collections?owner_id=eq.${encodeURIComponent(id)}&tier=eq.personal`, {
        method: 'DELETE',
      }),
      supaReq(admin, `/rest/v1/teams?lead_user_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ lead_user_id: null }),
      }),
      supaReq(admin, `/rest/v1/shares?grantee_type=eq.user&grantee_id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
      supaReq(admin, `/rest/v1/personal_tasks?user_id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => null),
      supaReq(admin, `/rest/v1/personal_notes?user_id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => null),
      supaReq(admin, `/rest/v1/user_brain_state?user_id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => null),
    ]);

    await supaReq(admin, `/rest/v1/users?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    // Remove deleted user email from access_policy.allowedEmails so deleted users cannot re-enter via whitelist
    let updatedPolicy = null;
    if (target.email) {
      try {
        const curPolicy = await fetchServerAccessPolicy(admin, { force: true });
        const cleanTarget = String(target.email).trim().toLowerCase();
        if (curPolicy.allowedEmails.includes(cleanTarget)) {
          updatedPolicy = await saveServerAccessPolicy(
            admin,
            { ...curPolicy, allowedEmails: curPolicy.allowedEmails.filter((e) => e !== cleanTarget) },
            auth.caller.email
          );
        }
      } catch (e) {
        // Non-fatal
      }
    }

    if (target.auth_uid && UUID_RE.test(target.auth_uid)) {
      await fetch(`${admin.url}/auth/v1/admin/users/${encodeURIComponent(target.auth_uid)}`, {
        method: 'DELETE',
        headers: {
          apikey: admin.serviceKey,
          Authorization: `Bearer ${admin.serviceKey}`,
        },
      }).catch(() => null);
    }

    await supaReq(admin, '/rest/v1/activities', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        actor_id: auth.caller.id,
        actor_name: auth.caller.name || auth.caller.email,
        action_type: 'user_deleted',
        target_type: 'user',
        target_id: id,
        target_title: `${target.name} (${target.email})`,
        details: { deleted_email: target.email, fallback_owner_id: fallbackId },
      }),
    }).catch(() => null);

    const payload = await fetchDirectoryPayload(admin);
    return jsonResp({
      ok: true,
      deletedId: id,
      deletedEmail: target.email,
      ...(updatedPolicy ? { accessPolicy: updatedPolicy } : {}),
      ...payload,
    });
  } catch (err) {
    return jsonResp({ error: err.message || 'Failed to delete user' }, 500);
  }
}
