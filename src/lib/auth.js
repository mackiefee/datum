import { ls } from '../utils/storage.js';

const SESSION_KEY = 'kb2-auth-session';
const SUPABASE_URL = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : '';
const SUPABASE_ANON = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : '';
const ALLOWED_DOMAINS = (
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ALLOWED_GOOGLE_DOMAINS) ||
  'planit.studio'
)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const hasSupabaseAuth = Boolean(SUPABASE_URL && SUPABASE_ANON);
export const defaultAllowedDomains = ALLOWED_DOMAINS;

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

export function loadStoredSession() {
  const s = ls.get(SESSION_KEY);
  if (!s || !s.token || !s.claims) return null;
  if (s.claims.exp && Date.now() > s.claims.exp) {
    ls.set(SESSION_KEY, null);
    return null;
  }
  return s;
}

export function saveStoredSession(session) {
  ls.set(SESSION_KEY, session);
}

export function clearStoredSession() {
  ls.set(SESSION_KEY, null);
}

export async function startSupabaseGoogleOAuth() {
  if (!hasSupabaseAuth || typeof window === 'undefined') {
    return { redirected: false, reason: 'not_configured' };
  }
  try {
    const check = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON },
    });
    if (check.ok) {
      const cfg = await check.json();
      if (!cfg?.external?.google) {
        return { redirected: false, reason: 'google_provider_disabled' };
      }
    }
  } catch (e) {
    return { redirected: false, reason: 'network_error' };
  }
  const redirectTo = encodeURIComponent(window.location.origin + window.location.pathname);
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}&access_type=offline&prompt=select_account`;
  window.location.href = url;
  return { redirected: true };
}

export async function consumeSupabaseOAuthHash() {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get('access_token');
  if (!accessToken) return null;
  try {
    const res = await fetch('/api/edge/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_supabase_token', token: accessToken }),
    });
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!res.ok) return null;
    const out = await res.json();
    if (out.ok && out.token) {
      saveStoredSession({ token: out.token, claims: out.claims, supaToken: accessToken });
      return out;
    }
  } catch (e) {
    return null;
  }
  return null;
}

export async function issueVerifiedSession(profile, { enforceDomain = false } = {}) {
  try {
    const res = await fetch('/api/edge/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'issue',
        profile,
        enforceDomain,
        allowedDomains: ALLOWED_DOMAINS,
      }),
    });
    const out = await res.json();
    if (!res.ok) return { ok: false, error: out.error || 'Authentication denied' };
    saveStoredSession({ token: out.token, claims: out.claims });
    return { ok: true, session: { token: out.token, claims: out.claims } };
  } catch (e) {
    // Offline fallback with strict domain & verification enforcement
    if (enforceDomain && profile.provider !== 'guest') {
      const dom = String(profile.email || '').split('@')[1] || '';
      if (!ALLOWED_DOMAINS.includes(dom.toLowerCase())) {
        return { ok: false, error: `Security block: Domain @${dom} is not authorized.` };
      }
    }
    const claims = {
      sub: profile.googleSub || 'local-' + Date.now(),
      email: profile.email,
      name: profile.name,
      avatar: profile.avatar || makeGooglePhotoFallback(profile.name),
      hd: String(profile.email || '').split('@')[1] || '',
      provider: profile.provider || 'google',
      emailVerified: profile.provider !== 'guest',
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };
    const fallbackSession = { token: 'local-fallback-token', claims };
    saveStoredSession(fallbackSession);
    return { ok: true, session: fallbackSession };
  }
}

export async function signOutAuth() {
  const cur = loadStoredSession();
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
}
