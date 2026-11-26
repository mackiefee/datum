import {
  authenticateEdgeRequest,
  evaluateAccessPolicy,
  fetchServerAccessPolicy,
  getSupabaseAdmin,
  lookupDbUser,
  mapDbRole,
  signHmacJwt,
  verifyHmacJwt,
} from '../../../../lib/edgeAuth.js';

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

export async function verifyRevitTokenAgainstPolicy(token, admin) {
  const checked = await verifyHmacJwt(token, { ignoreExp: true });
  if (!checked.valid || !checked.claims) {
    return { valid: false, status: 401, reason: checked.reason || 'Invalid token' };
  }
  const policy = await fetchServerAccessPolicy(admin, { force: true });
  if (policy.allowRevitPlugin === false) {
    return {
      valid: false,
      status: 403,
      accessDenied: true,
      code: 'REVIT_DISABLED',
      reason: 'Revit plugin access is disabled by SuperAdmin policy',
    };
  }
  const email = String(checked.claims.email || '').trim().toLowerCase();
  const isGuest = checked.claims.provider === 'guest' || checked.claims.role === 'Guest' || checked.claims.role === 'guest';
  const dbUser = !isGuest && email ? await lookupDbUser(admin, email) : null;
  if (dbUser && checked.claims.sv && Number(dbUser.session_version || 1) > Number(checked.claims.sv)) {
    return { valid: false, status: 401, accessDenied: true, code: 'SESSION_REVOKED', reason: 'Session revoked' };
  }
  const verdict = evaluateAccessPolicy({ email, isGuest, dbUser, policy });
  if (!verdict.allowed) {
    return { valid: false, status: 403, accessDenied: true, code: verdict.code, reason: verdict.reason };
  }
  const role = isGuest ? 'Guest' : mapDbRole(verdict.effectiveRole || (dbUser && dbUser.role), checked.claims.role || 'Member');
  return {
    valid: true,
    policy,
    claims: {
      ...checked.claims,
      role,
    },
  };
}

export async function POST(req) {
  const admin = getSupabaseAdmin();
  try {
    const body = await req.json();
    const { action = 'login', email = '', token = '' } = body || {};

    if (action === 'verify') {
      const checked = await verifyRevitTokenAgainstPolicy(token, admin);
      return jsonResp(
        {
          ok: checked.valid,
          valid: checked.valid,
          claims: checked.claims || null,
          reason: checked.reason,
          accessDenied: Boolean(checked.accessDenied),
          code: checked.code,
        },
        checked.valid ? 200 : checked.status || 401
      );
    }

    // Require an authenticated web session (or strict localhost dev header) to issue a revit_lookup_only token
    const auth = await authenticateEdgeRequest(req, admin, {
      allowGuest: false,
      allowRevitScope: true,
      forcePolicyRefresh: true,
    });
    if (!auth.ok) {
      return jsonResp(
        { ok: false, error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' },
        auth.status
      );
    }
    if (auth.policy && auth.policy.allowRevitPlugin === false) {
      return jsonResp(
        {
          ok: false,
          accessDenied: true,
          code: 'REVIT_DISABLED',
          error: 'Revit plugin API access is disabled by SuperAdmin policy',
        },
        403
      );
    }

    const appRole = mapDbRole(auth.caller.role, 'Member');
    const user = {
      id: auth.caller.id || `revit-${auth.caller.email.split('@')[0]}`,
      name: auth.caller.name,
      email: auth.caller.email,
      role: appRole,
    };

    const jwt = await signHmacJwt({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      scope: 'revit_lookup_only',
      client: 'revit-plugin',
      sv: (auth.dbUser && auth.dbUser.session_version) || 1,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    return jsonResp({ ok: true, token: jwt, user });
  } catch (e) {
    return jsonResp({ ok: false, error: e.message || 'Auth error' }, 500);
  }
}

export async function GET(req) {
  const admin = getSupabaseAdmin();
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return jsonResp({ ok: false, error: 'Missing Bearer token' }, 401);
  }
  const checked = await verifyRevitTokenAgainstPolicy(token, admin);
  return jsonResp(
    {
      ok: checked.valid,
      user: checked.claims || null,
      reason: checked.reason,
      accessDenied: Boolean(checked.accessDenied),
      code: checked.code,
    },
    checked.valid ? 200 : checked.status || 401
  );
}
