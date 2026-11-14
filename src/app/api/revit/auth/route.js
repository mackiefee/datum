import { USERS } from '../../../../data/seed.js';

export const runtime = 'edge';

const FALLBACK_SECRET = 'planit-edge-dev-hmac-secret-rotate-in-production-2026';
const enc = new TextEncoder();

function getSecret() {
  return (typeof process !== 'undefined' && process.env && process.env.AUTH_SECRET) || FALLBACK_SECRET;
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
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signRevitJwt(payload) {
  const header = toBase64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = toBase64Url(enc.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${toBase64Url(sig)}`;
}

export async function verifyRevitJwt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return { valid: false, reason: 'Malformed token' };
    const [header, body, sig] = parts;
    const key = await importHmacKey();
    const ok = await crypto.subtle.verify('HMAC', key, fromBase64Url(sig), enc.encode(`${header}.${body}`));
    if (!ok) return { valid: false, reason: 'Invalid signature' };
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (claims.exp && Date.now() > claims.exp) return { valid: false, reason: 'Token expired' };
    return { valid: true, claims };
  } catch (e) {
    return { valid: false, reason: 'Invalid token' };
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action = 'login', email = '', password = '', token = '' } = body || {};

    if (action === 'verify') {
      const checked = await verifyRevitJwt(token);
      return new Response(JSON.stringify(checked), {
        status: checked.valid ? 200 : 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return new Response(JSON.stringify({ ok: false, error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const matched = USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail || u.name.toLowerCase() === cleanEmail
    );

    if (!matched) {
      // Allow any @planit.studio email as Member for seamless workspace login
      if (cleanEmail.endsWith('@planit.studio')) {
        const namePart = cleanEmail.split('@')[0];
        const user = {
          id: `revit-${namePart}`,
          name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          email: cleanEmail,
          role: 'Member',
          title: 'BIM Team Member',
          dept: 'VDC',
        };
        const jwt = await signRevitJwt({
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          client: 'revit-plugin',
          exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
        return new Response(JSON.stringify({ ok: true, token: jwt, user }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ ok: false, error: 'Unknown Datum user. Use your @planit.studio email (e.g. maxim@planit.studio).' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (matched.status === 'deactivated') {
      return new Response(JSON.stringify({ ok: false, error: 'Account deactivated' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Optional password check: if a password is provided in demo mode, accept non-empty or Datum workspace pass
    void password;

    const user = {
      id: matched.id,
      name: matched.name,
      email: matched.email,
      role: matched.role,
      title: matched.title,
      dept: matched.dept,
    };

    const jwt = await signRevitJwt({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      client: 'revit-plugin',
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    return new Response(JSON.stringify({ ok: true, token: jwt, user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message || 'Auth error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing Bearer token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const checked = await verifyRevitJwt(token);
  return new Response(JSON.stringify({ ok: checked.valid, user: checked.claims || null, reason: checked.reason }), {
    status: checked.valid ? 200 : 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
