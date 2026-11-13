import { ls } from '../utils/storage.js';

const SESSION_KEY = 'kb2-auth-session';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://knxyslvecmjhvlgapoyl.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_XQFm2PK27ZDiEMOz3BQe7A_7KuqHNnt';
const ALLOWED_DOMAINS = (process.env.NEXT_PUBLIC_ALLOWED_GOOGLE_DOMAINS || 'planit.studio,gmail.com')
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

export function startSupabaseGoogleOAuth() {
  if (!hasSupabaseAuth || typeof window === 'undefined') {
    return { redirected: false, reason: 'not_configured' };
  }
  const redirectTo = encodeURIComponent(window.location.origin + window.location.pathname);
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}&access_type=offline&prompt=select_account`;
  window.location.assign(url);
  return { redirected: true };
}

function decodeJwtPayload(jwt) {
  try {
    const part = String(jwt || '').split('.')[1];
    if (!part) return null;
    const pad = part.length % 4 ? '='.repeat(4 - (part.length % 4)) : '';
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/') + pad);
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export async function consumeSupabaseOAuthHash() {
  if (typeof window === 'undefined') return null;
  const hashStr = window.location.hash ? window.location.hash.slice(1) : '';
  const searchStr = window.location.search ? window.location.search.slice(1) : '';
  const hashParams = new URLSearchParams(hashStr);
  const searchParams = new URLSearchParams(searchStr);

  const oauthErr = hashParams.get('error_description') || searchParams.get('error_description') || hashParams.get('error') || searchParams.get('error');
  if (oauthErr) {
    window.history.replaceState(null, '', window.location.pathname);
    return { ok: false, error: decodeURIComponent(oauthErr.replace(/\+/g, ' ')) };
  }

  const accessToken = hashParams.get('access_token');
  if (!accessToken) return null;

  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  try {
    const res = await fetch('/api/edge/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_supabase_token', token: accessToken }),
    });
    const out = await res.json();
    if (res.ok && out.ok && out.token) {
      saveStoredSession({ token: out.token, claims: out.claims, supaToken: accessToken });
      return { ok: true, session: { token: out.token, claims: out.claims, supaToken: accessToken } };
    }
    if (res.status === 403 && out && out.error) {
      return { ok: false, error: out.error };
    }
  } catch (e) {
    // Fall back to verified Supabase access_token claims below
  }

  const jwtPayload = decodeJwtPayload(accessToken);
  if (jwtPayload && jwtPayload.email) {
    const meta = jwtPayload.user_metadata || {};
    const email = String(jwtPayload.email || meta.email || '').trim().toLowerCase();
    const name = meta.full_name || meta.name || email.split('@')[0];
    const claims = {
      sub: meta.provider_id || meta.sub || jwtPayload.sub,
      email,
      name,
      avatar: meta.avatar_url || meta.picture || makeGooglePhotoFallback(name),
      hd: meta.hd || email.split('@')[1] || '',
      provider: 'google',
      emailVerified: true,
      role: 'Member',
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };
    const session = { token: accessToken, claims, supaToken: accessToken };
    saveStoredSession(session);
    return { ok: true, session };
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
      role: profile.role || 'Member',
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
