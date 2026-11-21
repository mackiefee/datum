import {
  DEFAULT_ACCESS_POLICY,
  evaluateAccessPolicy,
  normalizeAccessPolicy,
  normalizeEmail,
  toPublicLoginPolicy,
} from './accessPolicy.js';

export {
  DEFAULT_ACCESS_POLICY,
  evaluateAccessPolicy,
  normalizeAccessPolicy,
  toPublicLoginPolicy,
};

const DEV_FALLBACK_SECRET = 'planit-edge-dev-hmac-secret-rotate-in-production-2026';
const enc = new TextEncoder();

export const DB_TO_APP_ROLE = {
  super_admin: 'SuperAdmin',
  admin: 'Admin',
  editor: 'Editor',
  member: 'Member',
  guest: 'Guest',
};

export const APP_TO_DB_ROLE = {
  SuperAdmin: 'super_admin',
  super_admin: 'super_admin',
  Admin: 'admin',
  admin: 'admin',
  Editor: 'editor',
  editor: 'editor',
  Member: 'member',
  member: 'member',
  Guest: 'guest',
  guest: 'guest',
};

export function mapDbRole(r, fallback = 'Member') {
  if (!r) return fallback;
  return DB_TO_APP_ROLE[r] || r;
}

export function isAdminRole(dbRole) {
  return dbRole === 'super_admin' || dbRole === 'admin';
}

export function isEditorOrAbove(dbRole) {
  return dbRole === 'super_admin' || dbRole === 'admin' || dbRole === 'editor';
}

function getHmacSecret() {
  const configured = typeof process !== 'undefined' && process.env ? process.env.AUTH_SECRET : '';
  if (configured) return configured;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    // Require AUTH_SECRET in production when possible, keeping non-empty fallback only to prevent runtime crash if unset in preview
    return DEV_FALLBACK_SECRET;
  }
  return DEV_FALLBACK_SECRET;
}

function toBase64Url(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey() {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(getHmacSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signHmacJwt(payload) {
  const header = toBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = toBase64Url(enc.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${toBase64Url(sig)}`;
}

export async function verifyHmacJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { valid: false, reason: 'Malformed token' };
  const [header, body, sig] = parts;
  try {
    const key = await importHmacKey();
    const ok = await crypto.subtle.verify('HMAC', key, fromBase64Url(sig), enc.encode(`${header}.${body}`));
    if (!ok) return { valid: false, reason: 'Invalid HMAC signature' };
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (claims.exp && Date.now() > claims.exp) return { valid: false, reason: 'Session expired' };
    return { valid: true, claims };
  } catch (e) {
    return { valid: false, reason: 'Invalid token' };
  }
}

export function getSupabaseAdmin() {
  const url = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : '';
  const serviceKey = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
  const anonKey = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : '';
  if (!url || !serviceKey) return null;
  const headers = { 'Content-Type': 'application/json', apikey: serviceKey };
  if (serviceKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${serviceKey}`;
  }
  return { url, headers, serviceKey, anonKey: anonKey || serviceKey };
}

function isLocalHostnameHeader(h) {
  const v = String(h || '').trim().toLowerCase();
  return (
    v === 'localhost' ||
    v.startsWith('localhost:') ||
    v === '127.0.0.1' ||
    v.startsWith('127.0.0.1:') ||
    v === '[::1]' ||
    v.startsWith('[::1]:')
  );
}

/**
 * Strict localhost development check:
 * - Only active when NODE_ENV === 'development'
 * - Rejects requests where Host is non-local even if X-Forwarded-Host is spoofed
 */
export function isStrictLocalhostDev(req) {
  if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'development') {
    return false;
  }
  const host = String(req?.headers?.get('host') || '').trim().toLowerCase();
  const fwdHost = String(req?.headers?.get('x-forwarded-host') || '').trim().toLowerCase();
  if (!isLocalHostnameHeader(host)) return false;
  if (fwdHost && !isLocalHostnameHeader(fwdHost)) return false;
  return true;
}

export async function verifySupabaseOAuthJwt(admin, token) {
  const supaUrl = (admin && admin.url) || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supaAnon = (admin && admin.anonKey) || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supaUrl || !supaAnon || !token || !String(token).startsWith('eyJ')) return null;
  try {
    const res = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: {
        apikey: supaAnon,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const u = await res.json();
    const meta = (u && u.user_metadata) || {};
    const email = normalizeEmail((u && u.email) || meta.email || '');
    const emailVerified = Boolean(u && (u.email_confirmed_at || meta.email_verified));
    if (!email || !emailVerified) return null;
    return {
      sub: meta.provider_id || meta.sub || u.id || '',
      email,
      name: meta.full_name || meta.name || email.split('@')[0],
      avatar: meta.avatar_url || meta.picture || '',
      hd: meta.hd || email.split('@')[1] || '',
      emailVerified: true,
    };
  } catch (e) {
    return null;
  }
}

export async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const info = await res.json();
    const expectedClientId = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '' : '';
    if (expectedClientId && info.aud && info.aud !== expectedClientId) {
      return null;
    }
    const email = normalizeEmail(info.email || '');
    const verified = info.email_verified === true || info.email_verified === 'true';
    if (!email || !verified) return null;
    return {
      sub: info.sub || '',
      email,
      name: info.name || email.split('@')[0],
      avatar: info.picture || '',
      hd: info.hd || email.split('@')[1] || '',
      emailVerified: true,
    };
  } catch (e) {
    return null;
  }
}

let cachedPolicy = null;
let cachedPolicyAt = 0;
const POLICY_CACHE_TTL_MS = 5000;

export function invalidateAccessPolicyCache() {
  cachedPolicy = null;
  cachedPolicyAt = 0;
}

export async function fetchServerAccessPolicy(admin, { force = false } = {}) {
  if (!force && cachedPolicy && Date.now() - cachedPolicyAt < POLICY_CACHE_TTL_MS) {
    return cachedPolicy;
  }
  if (!admin) {
    return normalizeAccessPolicy(DEFAULT_ACCESS_POLICY);
  }
  try {
    const res = await fetch(
      `${admin.url}/rest/v1/shared_workspace_meta?key=eq.access_policy&select=data,updated_at&limit=1`,
      { headers: admin.headers, cache: 'no-store' }
    );
    if (!res.ok) {
      return cachedPolicy || normalizeAccessPolicy(DEFAULT_ACCESS_POLICY);
    }
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    const normalized = normalizeAccessPolicy({
      ...DEFAULT_ACCESS_POLICY,
      ...(row && row.data && typeof row.data === 'object' ? row.data : {}),
      ...(row && row.updated_at && !(row.data && row.data.updatedAt) ? { updatedAt: row.updated_at } : {}),
    });
    cachedPolicy = normalized;
    cachedPolicyAt = Date.now();
    return normalized;
  } catch (e) {
    return cachedPolicy || normalizeAccessPolicy(DEFAULT_ACCESS_POLICY);
  }
}

export async function saveServerAccessPolicy(admin, nextPolicy, actorEmail = '') {
  if (!admin) throw new Error('Supabase admin configuration missing');
  const nowIso = new Date().toISOString();
  const normalized = normalizeAccessPolicy({
    ...(nextPolicy || {}),
    updatedAt: nowIso,
    updatedBy: normalizeEmail(actorEmail) || '',
  });
  const res = await fetch(`${admin.url}/rest/v1/shared_workspace_meta?on_conflict=key`, {
    method: 'POST',
    headers: { ...admin.headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      key: 'access_policy',
      data: normalized,
      updated_at: nowIso,
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Failed to persist access policy (${res.status}): ${msg.slice(0, 140)}`);
  }
  cachedPolicy = normalized;
  cachedPolicyAt = Date.now();
  return normalized;
}

export async function lookupDbUser(admin, email) {
  const cleanEmail = normalizeEmail(email);
  if (!admin || !cleanEmail) return null;
  try {
    const res = await fetch(
      `${admin.url}/rest/v1/users?email=eq.${encodeURIComponent(cleanEmail)}&select=id,email,name,role,status,session_version,created_at,auth_uid&limit=1`,
      { headers: admin.headers, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

export async function revokeUnauthorizedAutoProvision(admin, dbUser, policy) {
  if (!admin || !dbUser || !dbUser.id) return false;
  if (dbUser.role === 'super_admin' || dbUser.status === 'deactivated') return false;
  const cleanEmail = normalizeEmail(dbUser.email || '');
  if (!cleanEmail || (policy && Array.isArray(policy.allowedEmails) && policy.allowedEmails.includes(cleanEmail))) {
    return false;
  }
  const createdMs = dbUser.created_at ? new Date(dbUser.created_at).getTime() : 0;
  const isRecentlyAutoCreated = Boolean(dbUser.auth_uid && createdMs && Date.now() - createdMs < 300_000);
  if (!isRecentlyAutoCreated) return false;
  try {
    await fetch(`${admin.url}/rest/v1/users?id=eq.${encodeURIComponent(dbUser.id)}`, {
      method: 'PATCH',
      headers: admin.headers,
      body: JSON.stringify({
        status: 'deactivated',
        session_version: Number(dbUser.session_version || 1) + 1,
      }),
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function writeAuthAuditLog(admin, entry) {
  if (!admin) return;
  try {
    await fetch(`${admin.url}/rest/v1/auth_audit_logs`, {
      method: 'POST',
      headers: { ...admin.headers, Prefer: 'return=minimal' },
      body: JSON.stringify(entry),
    });
  } catch (e) {
    // Best-effort audit logging
  }
}

export async function authenticateEdgeRequest(
  req,
  admin,
  { allowGuest = false, allowUnauthenticatedGuest = false, allowRevitScope = false, forcePolicyRefresh = false } = {}
) {
  const authHdr = req.headers.get('authorization') || '';
  const bearer = authHdr.toLowerCase().startsWith('bearer ') ? authHdr.slice(7).trim() : '';
  const supaTok = String(req.headers.get('x-datum-supa-token') || '').trim();
  // Never trust JSON body or query string params as an identity claim; localhost dev strictly requires the explicit header
  const requestedEmail = normalizeEmail(req.headers.get('x-datum-user-email') || '');

  let verifiedEmail = '';
  let hmacClaims = null;
  let isGuestSession = false;

  if (bearer && bearer !== 'local-dev-session' && bearer !== 'local-fallback-token') {
    const hmac = await verifyHmacJwt(bearer);
    if (hmac.valid && hmac.claims) {
      hmacClaims = hmac.claims;
      if (hmac.claims.scope === 'revit_lookup_only' && !allowRevitScope) {
        return {
          ok: false,
          status: 403,
          accessDenied: true,
          code: 'SCOPE_FORBIDDEN',
          error: 'Revit plugin token cannot access web workspace APIs',
        };
      }
      isGuestSession = hmac.claims.provider === 'guest' || hmac.claims.role === 'Guest' || hmac.claims.role === 'guest';
      verifiedEmail = normalizeEmail(hmac.claims.email || '');
    } else if (bearer.startsWith('eyJ')) {
      const oauth = await verifySupabaseOAuthJwt(admin, bearer);
      if (oauth && oauth.email) {
        verifiedEmail = oauth.email;
      }
    }
  }

  if (!verifiedEmail && !isGuestSession && supaTok && supaTok.startsWith('eyJ')) {
    const oauth = await verifySupabaseOAuthJwt(admin, supaTok);
    if (oauth && oauth.email) {
      verifiedEmail = oauth.email;
    }
  }

  // Strictly scoped localhost dev bypass: NEVER allowed when Host is non-local or NODE_ENV !== 'development',
  // and NEVER bypasses explicit malformed/forged bearer tokens.
  if (
    !verifiedEmail &&
    !isGuestSession &&
    isStrictLocalhostDev(req) &&
    (!bearer || bearer === 'local-dev-session') &&
    requestedEmail
  ) {
    verifiedEmail = requestedEmail;
  }

  const policy = await fetchServerAccessPolicy(admin, { force: forcePolicyRefresh });

  if (!verifiedEmail && !isGuestSession) {
    if (allowUnauthenticatedGuest) {
      const guestVerdict = evaluateAccessPolicy({ isGuest: true, policy });
      if (!guestVerdict.allowed) {
        return {
          ok: false,
          status: 403,
          accessDenied: true,
          code: guestVerdict.code,
          error: guestVerdict.reason,
          policy,
        };
      }
      return {
        ok: true,
        caller: { id: null, email: '', name: 'External Guest', role: 'guest', status: 'active' },
        policy,
        verdict: guestVerdict,
      };
    }
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  if (isGuestSession && !allowGuest) {
    return {
      ok: false,
      status: 403,
      accessDenied: true,
      code: 'GUEST_FORBIDDEN',
      error: 'External guests cannot access internal endpoints',
      policy,
    };
  }

  const dbUser = !isGuestSession && verifiedEmail ? await lookupDbUser(admin, verifiedEmail) : null;

  if (dbUser && hmacClaims && hmacClaims.sv && Number(dbUser.session_version || 1) > Number(hmacClaims.sv)) {
    return {
      ok: false,
      status: 401,
      accessDenied: true,
      code: 'SESSION_REVOKED',
      error: 'Session has been revoked by an administrator. Please sign in again.',
      policy,
    };
  }

  const verdict = evaluateAccessPolicy({
    email: verifiedEmail,
    isGuest: isGuestSession,
    dbUser,
    policy,
  });

  if (!verdict.allowed) {
    if (dbUser) {
      await revokeUnauthorizedAutoProvision(admin, dbUser, policy);
    }
    return {
      ok: false,
      status: 403,
      accessDenied: true,
      code: verdict.code,
      error: verdict.reason,
      policy,
    };
  }

  const effectiveRole = isGuestSession ? 'guest' : verdict.effectiveRole || (dbUser && dbUser.role) || 'member';

  return {
    ok: true,
    caller: {
      id: dbUser ? dbUser.id : null,
      email: verifiedEmail,
      name: (dbUser && dbUser.name) || (hmacClaims && hmacClaims.name) || (verifiedEmail ? verifiedEmail.split('@')[0] : 'External Guest'),
      role: effectiveRole,
      status: (dbUser && dbUser.status) || 'active',
    },
    dbUser,
    policy,
    verdict,
  };
}
