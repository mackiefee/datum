import { SEED } from '../../../../data/seed.js';
import {
  authenticateEdgeRequest,
  getSupabaseAdmin,
  mapDbRole,
} from '../../../../lib/edgeAuth.js';

export const runtime = 'edge';

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

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function safePyFileName(title = '', fallbackId = '') {
  const cleaned = String(title || '')
    .trim()
    .replace(/\.py$/i, '')
    .replace(/[^A-Za-z0-9_\u0400-\u04FF-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return `${cleaned || `script_${fallbackId || 'datum'}`}.py`;
}

function extractTeamCode(r) {
  if (!r) return '';
  if (r.snippet && String(r.snippet).trim()) {
    return String(r.snippet).trim();
  }
  const str = String(r.body || '');
  const openIdx = str.indexOf('```');
  if (openIdx !== -1) {
    const nlIdx = str.indexOf('\n', openIdx + 3);
    const closeIdx = nlIdx !== -1 ? str.indexOf('```', nlIdx + 1) : -1;
    if (closeIdx > nlIdx) {
      const code = str.slice(nlIdx + 1, closeIdx).trim();
      if (code) return code;
    }
  }
  if (r.type === 'script' && str.trim()) {
    return str.trim();
  }
  return '';
}

function extractHeaderDesc(code = '') {
  if (!code) return '';
  const head = String(code).slice(0, 1800);
  const m = head.match(/^[ \t]*#\s*(?:desc|description|опис)\s*:\s*(.+?)\s*$/im);
  return m && m[1] ? m[1].trim() : '';
}

function cleanHumanDesc(rawDesc = '', code = '') {
  const fromCode = extractHeaderDesc(code);
  if (fromCode) return fromCode;
  const d = String(rawDesc || '').trim();
  if (!d || /^(?:Script|Snippet|Team resource)\s*·\s*\d+\s*lines$/i.test(d)) {
    return '';
  }
  return d;
}

async function resolveRevitCaller(req, { requireAuth = false } = {}) {
  const admin = getSupabaseAdmin();
  const auth = await authenticateEdgeRequest(req, admin, {
    allowGuest: !requireAuth,
    allowUnauthenticatedGuest: !requireAuth,
    allowRevitScope: true,
    forcePolicyRefresh: true,
  });
  if (!auth.ok) {
    return auth;
  }
  if (auth.policy && auth.policy.allowRevitPlugin === false) {
    return {
      ok: false,
      status: 403,
      accessDenied: true,
      code: 'REVIT_DISABLED',
      error: 'Revit plugin API access is disabled by SuperAdmin policy',
    };
  }
  const appRole = mapDbRole(auth.caller.role, 'Guest');
  if (requireAuth && (appRole === 'Guest' || !auth.caller.email)) {
    return {
      ok: false,
      status: 401,
      error: 'Please sign in to Datum in the Revit plugin to publish scripts',
    };
  }
  return {
    ok: true,
    admin,
    role: appRole,
    userId: auth.caller.id || null,
    email: String(auth.caller.email || '').trim().toLowerCase(),
    user:
      appRole === 'Guest'
        ? null
        : {
            id: auth.caller.id || null,
            name: auth.caller.name || auth.caller.email,
            email: auth.caller.email,
            role: appRole,
          },
  };
}

function filterByRole(items, role) {
  return (items || []).filter((r) => {
    if (!r) return false;
    const st = r.status || r.st || 'Approved';
    const vis = r.vis || 'Internal';
    if (st === 'Deleted') return false;
    if (st !== 'Approved' && !['Admin', 'SuperAdmin', 'Editor'].includes(role)) return false;
    if (role === 'Guest' && (vis !== 'Public' || st !== 'Approved')) return false;
    return true;
  });
}

async function fetchTeamScripts(admin, role) {
  let rawItems = null;
  if (admin) {
    try {
      const query =
        role === 'Guest'
          ? `${admin.url}/rest/v1/shared_catalog_items?status=eq.Approved&vis=eq.Public&select=id,data,status,vis&order=id.desc`
          : `${admin.url}/rest/v1/shared_catalog_items?status=neq.Deleted&select=id,data,status,vis&order=id.desc`;
      const res = await fetch(query, { headers: admin.headers, cache: 'no-store' });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          rawItems = rows.map((row) => ({
            ...(row.data || {}),
            id: row.id,
            status: row.status || (row.data && row.data.status) || 'Draft',
            vis: row.vis || (row.data && row.data.vis) || 'Internal',
          }));
        }
      }
    } catch {
      rawItems = null;
    }
  }
  const sourceList = rawItems !== null ? rawItems : role === 'Guest' ? [] : SEED;
  const visible = filterByRole(sourceList, role);

  const out = [];
  for (const r of visible) {
    const isScriptType = r.type === 'script' || r.type === 'service';
    if (!isScriptType) continue;
    const code = extractTeamCode(r);
    if (!code && !r.url) continue;
    const lineCount = code ? code.split(/\r?\n/).length : 0;
    const sizeBytes = code ? enc.encode(code).length : 0;
    out.push({
      id: `team:${r.id}`,
      rawId: String(r.id),
      source: 'team',
      sourceLabel: 'Team',
      kind: r.type === 'service' ? 'tool' : 'script',
      title: String(r.title || 'Untitled Script'),
      fileName: safePyFileName(r.title, r.id),
      desc: cleanHumanDesc(r.desc, code),
      project: String(r.disc || 'General'),
      author: String(r.author || 'Team'),
      updatedAt: String(r.upd || ''),
      isPinned: Boolean(r.pinned),
      lineCount,
      sizeBytes,
      code,
      url: String(r.url || ''),
      webUrl: `/?view=scripts`,
    });
  }
  return out;
}

async function fetchPersonalScripts(admin, email) {
  if (!admin || !email) return [];
  const emailEq = encodeURIComponent(email);
  const sharedJson = encodeURIComponent(JSON.stringify([email]));
  try {
    const [ownRes, sharedRes] = await Promise.all([
      fetch(
        `${admin.url}/rest/v1/personal_resources?owner_email=eq.${emailEq}&select=*&order=is_pinned.desc,updated_at.desc`,
        { headers: admin.headers, cache: 'no-store' }
      ),
      fetch(
        `${admin.url}/rest/v1/personal_resources?shared_with_emails=cs.${sharedJson}&select=*&order=updated_at.desc`,
        { headers: admin.headers, cache: 'no-store' }
      ),
    ]);
    const ownRows = ownRes.ok ? await ownRes.json() : [];
    const sharedRows = sharedRes.ok ? await sharedRes.json() : [];
    const seen = new Set();
    const out = [];
    for (const row of [...(Array.isArray(ownRows) ? ownRows : []), ...(Array.isArray(sharedRows) ? sharedRows : [])]) {
      if (!row || !row.id || seen.has(row.id)) continue;
      seen.add(row.id);
      const kind = String(row.kind || 'link');
      if (!['script', 'snippet', 'tool'].includes(kind)) continue;
      const code = String(row.notes || '').trim();
      if (!code && !row.url) continue;
      const owner = String(row.owner_email || '').trim().toLowerCase();
      const isShared = Boolean(owner && owner !== email);
      const lineCount = code ? code.split(/\r?\n/).length : 0;
      const sizeBytes = code ? enc.encode(code).length : 0;
      const upd = row.updated_at ? String(row.updated_at).slice(0, 10) : row.created_at ? String(row.created_at).slice(0, 10) : '';
      out.push({
        id: `${isShared ? 'shared' : 'mine'}:${row.id}`,
        rawId: String(row.id),
        source: isShared ? 'shared' : 'mine',
        sourceLabel: isShared ? 'Shared' : 'Personal',
        kind,
        title: String(row.title || 'Untitled Script'),
        fileName: safePyFileName(row.title, String(row.id).slice(0, 8)),
        desc: extractHeaderDesc(code),
        project: String(row.project || 'General'),
        author: isShared ? owner.split('@')[0] : 'Me',
        updatedAt: upd,
        isPinned: Boolean(row.is_pinned),
        lineCount,
        sizeBytes,
        code,
        url: String(row.url || ''),
        webUrl: `/?view=scripts`,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(req) {
  const auth = await resolveRevitCaller(req, { requireAuth: false });
  if (!auth.ok) {
    return jsonResp(
      { ok: false, error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' },
      auth.status
    );
  }
  const url = new URL(req.url);
  const metaOnly = url.searchParams.get('metaOnly') === '1';

  const [teamScripts, personalScripts] = await Promise.all([
    fetchTeamScripts(auth.admin, auth.role),
    auth.email && auth.role !== 'Guest' ? fetchPersonalScripts(auth.admin, auth.email) : Promise.resolve([]),
  ]);

  const allScripts = [...personalScripts, ...teamScripts].map((s) =>
    metaOnly ? { ...s, code: undefined } : s
  );

  return jsonResp({
    ok: true,
    role: auth.role,
    user: auth.user,
    count: allScripts.length,
    scripts: allScripts,
  });
}

export async function POST(req) {
  const auth = await resolveRevitCaller(req, { requireAuth: true });
  if (!auth.ok) {
    return jsonResp(
      { ok: false, error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' },
      auth.status
    );
  }
  if (!auth.admin) {
    return jsonResp({ ok: false, error: 'Supabase admin is not configured' }, 503);
  }

  try {
    const body = await req.json();
    const title = String(body?.title || '').trim().replace(/\.py$/i, '');
    const code = String(body?.code || '').slice(0, 1500000);
    const project = String(body?.project || 'General').trim() || 'General';
    const scope = body?.scope === 'mine' ? 'mine' : 'team';
    const rawDesc = String(body?.desc || '').trim();

    if (!title || !code.trim()) {
      return jsonResp({ ok: false, error: 'Script title and Python code are required' }, 400);
    }

    const lineCount = code.split(/\r?\n/).length;
    const sizeBytes = enc.encode(code).length;
    const headerDesc = extractHeaderDesc(code);
    const shortDesc = (rawDesc || headerDesc || `Script · ${lineCount} lines`).slice(0, 180);
    const today = getTodayIso();

    if (scope === 'mine') {
      const payload = {
        user_id: auth.userId,
        owner_email: auth.email,
        title: title.slice(0, 240),
        url: '',
        kind: 'script',
        notes: code,
        project: project.slice(0, 80),
        tags: ['revit-plugin', 'script'],
        is_pinned: false,
      };
      const insRes = await fetch(`${auth.admin.url}/rest/v1/personal_resources`, {
        method: 'POST',
        headers: { ...auth.admin.headers, Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!insRes.ok) {
        const errTxt = await insRes.text().catch(() => '');
        return jsonResp({ ok: false, error: `Failed to save personal script (${insRes.status}): ${errTxt.slice(0, 120)}` }, 502);
      }
      const rows = await insRes.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      return jsonResp({
        ok: true,
        script: {
          id: `mine:${row ? row.id : Date.now()}`,
          rawId: String(row ? row.id : Date.now()),
          source: 'mine',
          sourceLabel: 'Personal',
          kind: 'script',
          title,
          fileName: safePyFileName(title, row ? row.id : ''),
          desc: cleanHumanDesc(shortDesc, code),
          project,
          author: auth.user ? auth.user.name : 'Me',
          updatedAt: today,
          isPinned: false,
          lineCount,
          sizeBytes,
          code,
          webUrl: `/?view=scripts`,
        },
      });
    }

    // Default: publish to Team Scripts & Links (shared_catalog_items)
    const itemId = Date.now();
    const fullBody = [
      rawDesc || headerDesc ? rawDesc || headerDesc : '',
      '```python\n' + code + '\n```',
    ]
      .filter(Boolean)
      .join('\n\n');

    const itemData = {
      id: itemId,
      node: 'c10-ovw-std',
      title: title.slice(0, 240),
      desc: shortDesc,
      url: '',
      snippet: code,
      body: fullBody,
      type: 'script',
      status: 'Approved',
      vis: 'Internal',
      stage: 'Approved Standard',
      disc: project === 'General' ? 'VDC' : project,
      tags: [project, 'script'],
      links: [],
      c: [],
      publicAttachments: [],
      author: (auth.user && auth.user.name) || auth.email,
      authorEmail: auth.email,
      upd: today,
      verified: today,
      v: [
        {
          n: 1,
          by: (auth.user && auth.user.name) || auth.email,
          d: today,
          note: 'Published from Revit Plugin',
          body: fullBody.slice(0, 20000),
        },
      ],
    };

    const upRes = await fetch(`${auth.admin.url}/rest/v1/shared_catalog_items?on_conflict=id`, {
      method: 'POST',
      headers: {
        ...auth.admin.headers,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        id: itemId,
        status: 'Approved',
        vis: 'Internal',
        data: itemData,
        updated_at: new Date().toISOString(),
        updated_by: auth.email,
      }),
    });

    if (!upRes.ok) {
      const errTxt = await upRes.text().catch(() => '');
      return jsonResp({ ok: false, error: `Failed to publish team script (${upRes.status}): ${errTxt.slice(0, 120)}` }, 502);
    }

    return jsonResp({
      ok: true,
      script: {
        id: `team:${itemId}`,
        rawId: String(itemId),
        source: 'team',
        sourceLabel: 'Team',
        kind: 'script',
        title,
        fileName: safePyFileName(title, itemId),
        desc: cleanHumanDesc(shortDesc, code),
        project: itemData.disc,
        author: itemData.author,
        updatedAt: today,
        isPinned: false,
        lineCount,
        sizeBytes,
        code,
        webUrl: `/?view=scripts`,
      },
    });
  } catch (e) {
    return jsonResp({ ok: false, error: e.message || 'Failed to save script' }, 400);
  }
}
