import { ls } from '../utils/storage.js';
import { DEFAULT_ACCESS_POLICY, toPublicLoginPolicy } from './accessPolicy.js';

const SESSION_KEY = 'kb2-auth-session';
const LOCAL_SIGNOUT_KEY = 'kb2-local-signed-out';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://knxyslvecmjhvlgapoyl.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_XQFm2PK27ZDiEMOz3BQe7A_7KuqHNnt';

const SENSITIVE_STORAGE_KEYS = [
  'kb2-res',
  'kb2-tree',
  'kb2-users',
  'kb2-teams',
  'kb2-cols',
  'kb2-acts',
  'kb2-slogs',
  'kb2-flags',
  'kb2-shares',
  'kb2-team-acks',
  'kb2-ack',
  'kb2-req',
  'kb2-hist',
  'kb2-chk',
  'datum-naming-custom-schemas-v1',
  'kb2-uid',
];
const SENSITIVE_STORAGE_PREFIXES = [
  'kb2-tasks:',
  'kb2-privnotes:',
  'kb2-privres:',
  'kb2-brain-state:',
  'kb2-chats',
];

export const hasSupabaseAuth = Boolean(SUPABASE_URL && SUPABASE_ANON);
export const defaultAllowedDomains = [...DEFAULT_ACCESS_POLICY.allowedDomains];

export function makeGooglePhotoFallback(name = 'User', color = '#0a84ff') {
  const init = String(name || 'U')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#5e5ce6"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g)"/><text x="40" y="49" text-anchor="middle" fill="#fff" font-family="-apple-system,Inter,sans-serif" font-weight="700" font-size="26">${init}</text></svg>`
    )
  );
}

export function isLocalhostEnv() {
  return (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  );
}

export function purgeSensitiveLocalCache() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    SENSITIVE_STORAGE_KEYS.forEach((k) => window.localStorage.removeItem(k));
    const allKeys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) allKeys.push(k);
    }
    allKeys.forEach((k) => {
      if (SENSITIVE_STORAGE_PREFIXES.some((pref) => k.startsWith(pref))) {
        window.localStorage.removeItem(k);
      }
    });
  } catch (e) {}
}

export function loadStoredSession() {
  const s = ls.get(SESSION_KEY);
  if (s && s.token && s.claims) {
    if (s.token === 'local-fallback-token') {
      ls.set(SESSION_KEY, null);
      return null;
    }
    if (s.claims.exp && Date.now() > s.claims.exp) {
      ls.set(SESSION_KEY, null);
    } else {
      return s;
    }
  }
  if (isLocalhostEnv()) {
    let signedOut = false;
    try {
      signedOut = sessionStorage.getItem(LOCAL_SIGNOUT_KEY) === '1';
    } catch (e) {}
    if (signedOut) return null;

    const claims = {
      sub: 'local-dev-superadmin',
      email: 'maf@planit-inc.com',
      name: 'Maksym Fedorenko',
      avatar: makeGooglePhotoFallback('Maksym Fedorenko', '#0a84ff'),
      hd: 'planit-inc.com',
      provider: 'google',
      emailVerified: true,
      role: 'SuperAdmin',
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };
    const devSession = { token: 'local-dev-session', claims };
    saveStoredSession(devSession);
    return devSession;
  }
  return null;
}

export function saveStoredSession(session) {
  if (session && typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(LOCAL_SIGNOUT_KEY);
    } catch (e) {}
  }
  ls.set(SESSION_KEY, session);
}

export function clearStoredSession() {
  ls.set(SESSION_KEY, null);
}

export function startSupabaseGoogleOAuth() {
  if (!hasSupabaseAuth || typeof window === 'undefined') {
    return { redirected: false, reason: 'not_configured' };
  }
  try {
    sessionStorage.removeItem(LOCAL_SIGNOUT_KEY);
  } catch (e) {}
  const redirectTo = encodeURIComponent(window.location.origin + window.location.pathname);
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}&access_type=offline&prompt=select_account`;
  window.location.assign(url);
  return { redirected: true };
}

export async function fetchPublicLoginPolicy() {
  try {
    const res = await fetch('/api/edge/auth?action=login_policy', {
      method: 'GET',
      cache: 'no-store',
    });
    const out = await res.json().catch(() => null);
    if (res.ok && out && out.policy) {
      return out.policy;
    }
  } catch (e) {}
  return {
    ...toPublicLoginPolicy(DEFAULT_ACCESS_POLICY),
    isLocalDev: isLocalhostEnv(),
  };
}

let inflightOAuthPromise = null;

export function formatLoginError(rawError = '', code = '') {
  const raw = String(rawError || '').trim();
  const c = String(code || '').trim().toUpperCase();

  if (c === 'ACCOUNT_DEACTIVATED' || /deactivated/i.test(raw)) {
    return {
      title: 'Account Deactivated',
      message: 'Your Datum workspace account has been deactivated. Contact your administrator to restore access.',
      kind: 'deactivated',
    };
  }

  if (/access_denied|cancelled|canceled/i.test(raw) && !/explicitly|not on the|policy|whitelist|domain|blocked/i.test(raw)) {
    return {
      title: 'Sign-in Cancelled',
      message: 'Google sign-in was cancelled before completion. You can try again whenever you’re ready.',
      kind: 'neutral',
    };
  }

  if (c === 'SESSION_REVOKED' || /session revoked|no longer authorized|expired|session has ended/i.test(raw)) {
    return {
      title: 'Session Ended',
      message: 'Your workspace session has ended or your access permissions were updated. Please sign in again.',
      kind: 'neutral',
    };
  }

  if (
    ['NOT_WHITELISTED', 'DOMAIN_NOT_ALLOWED', 'DIRECTORY_REQUIRED', 'EMAIL_BLOCKED', 'OAUTH_DENIED', 'GUEST_DISABLED', 'UNEXPECTED_FAILURE', 'SERVER_ERROR'].includes(c) ||
    /database error saving new user|unexpected_failure|server_error|not on the approved|not in allowed|must be invited|whitelist|strict policy blocked|explicitly blocked|access denied|403|unauthorized|isn['’]?t authorized|not authorized|access restricted|approved workspace email/i.test(raw)
  ) {
    return {
      title: 'Access Restricted',
      message: 'This Google account isn’t authorized to access Datum. Please sign in with an approved workspace email or ask your administrator for an invitation.',
      kind: 'restricted',
    };
  }

  return {
    title: 'Unable to Sign In',
    message: raw || 'We couldn’t complete sign-in right now. Please try again.',
    kind: 'restricted',
  };
}

export async function consumeSupabaseOAuthHash() {
  if (typeof window === 'undefined') return null;
  if (inflightOAuthPromise) return inflightOAuthPromise;

  const hashStr = window.location.hash ? window.location.hash.slice(1) : '';
  const searchStr = window.location.search ? window.location.search.slice(1) : '';
  const hashParams = new URLSearchParams(hashStr);
  const searchParams = new URLSearchParams(searchStr);

  const oauthErr =
    hashParams.get('error_description') ||
    searchParams.get('error_description') ||
    hashParams.get('error') ||
    searchParams.get('error');
  const errCode =
    hashParams.get('error_code') ||
    searchParams.get('error_code') ||
    hashParams.get('error') ||
    searchParams.get('error') ||
    '';
  const accessToken = hashParams.get('access_token');
  if (!oauthErr && !accessToken) return null;

  inflightOAuthPromise = (async () => {
    if (oauthErr) {
      window.history.replaceState(null, '', window.location.pathname);
      clearStoredSession();
      purgeSensitiveLocalCache();
      const decoded = decodeURIComponent(oauthErr.replace(/\+/g, ' '));
      const formatted = formatLoginError(decoded, errCode);
      return {
        ok: false,
        accessDenied: true,
        code: 'OAUTH_DENIED',
        error: formatted.message,
        errorTitle: formatted.title,
      };
    }

    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    try {
      const res = await fetch('/api/edge/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ action: 'verify_supabase_token', token: accessToken }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok && out.token) {
        const session = { token: out.token, claims: out.claims, supaToken: accessToken };
        saveStoredSession(session);
        return { ok: true, session, policy: out.policy || null };
      }
      clearStoredSession();
      purgeSensitiveLocalCache();
      const formatted = formatLoginError(out?.error || 'Sign-in rejected by workspace whitelist policy.', out?.code);
      return {
        ok: false,
        accessDenied: true,
        code: out?.code || 'OAUTH_DENIED',
        error: formatted.message,
        errorTitle: formatted.title,
      };
    } catch (e) {
      clearStoredSession();
      purgeSensitiveLocalCache();
      return {
        ok: false,
        accessDenied: true,
        error: 'Unable to verify Google OAuth session with workspace server.',
      };
    }
  })();

  return inflightOAuthPromise;
}

export async function issueVerifiedSession(profile, { idToken } = {}) {
  try {
    const res = await fetch('/api/edge/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        action: 'issue',
        profile,
        ...(idToken ? { idToken } : {}),
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok || !out.token) {
      return {
        ok: false,
        accessDenied: Boolean(out?.accessDenied || res.status === 403),
        code: out?.code || '',
        error: out?.error || 'Authentication denied by server policy',
      };
    }
    const nextSession = { token: out.token, claims: out.claims };
    saveStoredSession(nextSession);
    return { ok: true, session: nextSession, policy: out.policy || null };
  } catch (e) {
    return {
      ok: false,
      accessDenied: true,
      error: 'Unable to reach workspace authentication server.',
    };
  }
}

export async function verifyStoredSessionWithServer(session) {
  if (!session || !session.claims) return { ok: false, reason: 'No active session' };
  if (session.token === 'local-dev-session' && isLocalhostEnv()) {
    return issueVerifiedSession({
      email: session.claims.email,
      name: session.claims.name,
      googleSub: session.claims.sub,
      provider: 'google',
      emailVerified: true,
    });
  }
  if (!session.token) return { ok: false, reason: 'Missing session token' };
  try {
    const res = await fetch('/api/edge/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ action: 'verify', token: session.token }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.valid) {
      return {
        ok: false,
        accessDenied: Boolean(out?.accessDenied || res.status === 403 || res.status === 401),
        code: out?.code || '',
        error: out?.reason || out?.error || 'Session is no longer authorized.',
      };
    }
    const updatedSession = {
      ...session,
      claims: out.claims || session.claims,
    };
    saveStoredSession(updatedSession);
    return { ok: true, session: updatedSession, policy: out.policy || null };
  } catch (e) {
    // Allow offline survival ONLY if token wasn't rejected by server
    return { ok: true, session, offline: true };
  }
}

export async function signOutAuth({ markLocalSignOut = true } = {}) {
  inflightOAuthPromise = null;
  if (markLocalSignOut && typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(LOCAL_SIGNOUT_KEY, '1');
    } catch (e) {}
  }
  const cur = ls.get(SESSION_KEY);
  if (hasSupabaseAuth && cur && cur.supaToken) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${cur.supaToken}` },
      });
    } catch (e) {
      // Ignore network logout failures
    }
  }
  clearStoredSession();
  purgeSensitiveLocalCache();
}
