export const runtime = 'edge';

const FALLBACK_SECRET = 'planit-edge-dev-hmac-secret-rotate-in-production-2026';

function getSecret() {
  return (typeof process !== 'undefined' && process.env && process.env.AUTH_SECRET) || FALLBACK_SECRET;
}

const enc = new TextEncoder();

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
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signJwt(payload) {
  const header = toBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = toBase64Url(enc.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${toBase64Url(sig)}`;
}

async function verifyJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { valid: false, reason: 'Malformed token' };
  const [header, body, sig] = parts;
  const key = await importHmacKey();
  const ok = await crypto.subtle.verify('HMAC', key, fromBase64Url(sig), enc.encode(`${header}.${body}`));
  if (!ok) return { valid: false, reason: 'Invalid HMAC signature' };
  const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
  if (claims.exp && Date.now() > claims.exp) return { valid: false, reason: 'Session expired' };
  return { valid: true, claims };
}

function getSupabaseAdmin() {
  const url = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : '';
  const serviceKey = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
  if (!url || !serviceKey) return null;
  const headers = { 'Content-Type': 'application/json', apikey: serviceKey };
  if (serviceKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${serviceKey}`;
  }
  return { url, headers };
}

async function lookupDbUser(admin, email) {
  if (!admin || !email) return null;
  try {
    const res = await fetch(
      `${admin.url}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,role,status,session_version&limit=1`,
      { headers: admin.headers }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

async function writeAuditLog(admin, entry) {
  if (!admin) return;
  try {
    await fetch(`${admin.url}/rest/v1/auth_audit_logs`, {
      method: 'POST',
      headers: { ...admin.headers, Prefer: 'return=minimal' },
      body: JSON.stringify(entry),
    });
  } catch (e) {
    // Best-effort audit logging when Supabase schema is deployed
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action = 'issue', profile, token, enforceDomain = false, allowedDomains = ['planit.studio'] } = body || {};
    const admin = getSupabaseAdmin();

    if (action === 'verify') {
      const checked = await verifyJwt(token);
      if (checked.valid && checked.claims?.email) {
        const dbUser = await lookupDbUser(admin, checked.claims.email);
        if (dbUser && dbUser.status === 'deactivated') {
          return new Response(JSON.stringify({ valid: false, reason: 'Account deactivated' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (dbUser && checked.claims.sv && dbUser.session_version > checked.claims.sv) {
          return new Response(JSON.stringify({ valid: false, reason: 'Session revoked' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify(checked), {
        status: checked.valid ? 200 : 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify_supabase_token') {
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supaAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supaUrl || !supaAnon || !token) {
        return new Response(JSON.stringify({ error: 'Supabase environment not configured' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const userRes = await fetch(`${supaUrl}/auth/v1/user`, {
        headers: { apikey: supaAnon, Authorization: `Bearer ${token}` },
      });
      if (!userRes.ok) {
        return new Response(JSON.stringify({ error: 'Invalid Supabase OAuth token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const supaUser = await userRes.json();
      const meta = supaUser.user_metadata || {};
      const email = String(supaUser.email || meta.email || '').trim().toLowerCase();
      const verified = Boolean(supaUser.email_confirmed_at || meta.email_verified);
      if (!verified) {
        return new Response(JSON.stringify({ error: 'Google email address is not verified' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const dbUser = await lookupDbUser(admin, email);
      if (dbUser && dbUser.status === 'deactivated') {
        return new Response(JSON.stringify({ error: 'Account deactivated by administrator.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const claims = {
        sub: meta.provider_id || meta.sub || supaUser.id,
        email,
        name: meta.full_name || meta.name || email.split('@')[0],
        avatar: meta.avatar_url || meta.picture || '',
        hd: meta.hd || email.split('@')[1] || '',
        provider: 'google',
        emailVerified: true,
        role: (dbUser && dbUser.role) || 'Member',
        sv: (dbUser && dbUser.session_version) || 1,
        iat: Date.now(),
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
      };
      const signedToken = await signJwt(claims);
      await writeAuditLog(admin, {
        email,
        provider: 'google',
        event_type: 'login_success',
        hosted_domain: claims.hd,
        metadata: { google_sub: claims.sub, source: 'oauth' },
      });
      return new Response(JSON.stringify({ ok: true, claims, token: signedToken }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Issue verified session token from Google Identity profile
    if (!profile || !profile.email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const email = String(profile.email).trim().toLowerCase();
    const domain = email.split('@')[1] || '';
    const isGuest = profile.provider === 'guest';

    if (!isGuest && profile.emailVerified === false) {
      return new Response(JSON.stringify({ error: 'Security block: Google account email must be verified.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isGuest && enforceDomain && allowedDomains.length && !allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
      return new Response(
        JSON.stringify({ error: `Security block: Domain @${domain} is not in allowed workspace domains (${allowedDomains.join(', ')}).` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const dbUser = !isGuest ? await lookupDbUser(admin, email) : null;
    if (profile.status === 'deactivated' || (dbUser && dbUser.status === 'deactivated')) {
      return new Response(JSON.stringify({ error: 'Account deactivated by administrator.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const claims = {
      sub: profile.googleSub || `${isGuest ? 'guest' : 'g'}-${Date.now()}`,
      email,
      name: String(profile.name || email.split('@')[0]).trim(),
      avatar: profile.avatar || '',
      hd: domain,
      provider: isGuest ? 'guest' : 'google',
      emailVerified: !isGuest,
      role: (dbUser && dbUser.role) || profile.role || (isGuest ? 'Guest' : 'Member'),
      sv: (dbUser && dbUser.session_version) || 1,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };

    const signedToken = await signJwt(claims);
    if (!isGuest) {
      await writeAuditLog(admin, {
        email,
        provider: claims.provider,
        event_type: 'login_success',
        hosted_domain: domain,
        metadata: { google_sub: claims.sub, source: 'edge_session' },
      });
    }
    return new Response(JSON.stringify({ ok: true, claims, token: signedToken }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
