import { IMG0, SEED } from '../../../../data/seed.js';
import { ASSEMBLIES_3D, matchAssemblyForRevit } from '../../../../data/assemblies3d.js';
import {
  authenticateEdgeRequest,
  getSupabaseAdmin,
  mapDbRole,
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

const CATEGORY_BOOSTS = {
  walls: ['wall', 'partition', 'gwb', 'stud', 'shaft', 'furring', 'fire', 'acoustic', 'c1010'],
  doors: ['door', 'ada', 'threshold', 'frame', 'opening', 'won-door', 'c1020'],
  ceilings: ['ceiling', 'soffit', 'plenum', 'grid'],
  floors: ['floor', 'slab', 'finish'],
  plumbing: ['plumbing', 'wet-wall', 'bathroom', 'fixture', 'chase'],
  fixtures: ['plumbing', 'bathroom', 'backing', 'blocking'],
  casework: ['backing', 'blocking', 'millwork', 'casework'],
  'specialty equipment': ['backing', 'blocking', 'equipment'],
};

function extractKeyRules(body = '') {
  const lines = String(body)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s+/.test(l) && l.length > 14 && !l.includes('img:'))
    .slice(0, 3)
    .map((l) => l.replace(/^[-*•]\s+/, '').replace(/\*\*/g, '').replace(/`/g, '').slice(0, 140));
  return lines;
}

function extractFirstImage(body = '') {
  const m = String(body).match(/\(img:([^)]+)\)/);
  if (m && IMG0[m[1]]) return IMG0[m[1]];
  return null;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

async function resolveRevitCaller(req) {
  const admin = getSupabaseAdmin();
  const auth = await authenticateEdgeRequest(req, admin, {
    allowGuest: true,
    allowUnauthenticatedGuest: true,
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
  return {
    ok: true,
    admin,
    role: appRole,
    user: appRole === 'Guest' ? null : { name: auth.caller.name, email: auth.caller.email, role: appRole },
  };
}

async function fetchLiveStandards(admin, role) {
  if (!admin) return null;
  try {
    const query =
      role === 'Guest'
        ? `${admin.url}/rest/v1/shared_catalog_items?status=eq.Approved&vis=eq.Public&select=id,data,status,vis&order=id.desc`
        : `${admin.url}/rest/v1/shared_catalog_items?status=neq.Deleted&select=id,data,status,vis&order=id.desc`;
    const res = await fetch(query, { headers: admin.headers, cache: 'no-store' });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    return rows.map((row) => ({
      ...(row.data || {}),
      id: row.id,
      status: row.status || (row.data && row.data.status) || 'Draft',
      vis: row.vis || (row.data && row.data.vis) || 'Internal',
    }));
  } catch {
    return null;
  }
}

function filterByRole(items, role) {
  return items.filter((r) => {
    const st = r.status || r.st || 'Approved';
    const vis = r.vis || 'Internal';
    if (st === 'Deleted') return false;
    if (st !== 'Approved' && !['Admin', 'SuperAdmin', 'Editor'].includes(role)) return false;
    if (role === 'Guest' && (vis !== 'Public' || st !== 'Approved')) return false;
    return true;
  });
}

async function runLookup(admin, { category = '', family = '', typeName = '', params = {}, query = '' }, role) {
  const paramStr =
    params && typeof params === 'object'
      ? Object.entries(params)
          .map(([k, v]) => `${k} ${v}`)
          .join(' ')
      : String(params || '');

  const rawText = `${category} ${family} ${typeName} ${paramStr} ${query}`.trim();
  const tokens = tokenize(rawText);
  const catKey = String(category || '').trim().toLowerCase();
  const catBoosts = CATEGORY_BOOSTS[catKey] || [];

  const liveItems = await fetchLiveStandards(admin, role);
  const sourceList = liveItems !== null ? liveItems : role === 'Guest' ? [] : SEED;
  const visible = filterByRole(sourceList, role);

  const scored = visible
    .map((doc) => {
      const titleLow = String(doc.title || '').toLowerCase();
      const sumStr = doc.desc || doc.sum || '';
      const sumLow = String(sumStr).toLowerCase();
      const tagsLow = (doc.tags || []).join(' ').toLowerCase();
      const bodyLow = String(doc.body || '').toLowerCase();
      const st = doc.status || doc.st || 'Approved';

      let score = 0;
      for (const t of tokens) {
        if (titleLow.includes(t)) score += 9;
        if (tagsLow.includes(t)) score += 7;
        if (sumLow.includes(t)) score += 5;
        if (bodyLow.includes(t)) score += 2;
      }
      for (const b of catBoosts) {
        if (titleLow.includes(b) || tagsLow.includes(b)) score += 4;
      }
      if (!rawText && st === 'Approved') score += 1;

      return { doc, score };
    })
    .filter((x) => (rawText ? x.score > 0 : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      disc: doc.disc || 'BIM',
      status: doc.status || doc.st || 'Approved',
      vis: doc.vis || 'Internal',
      summary: doc.desc || doc.sum || '',
      keyRules: extractKeyRules(doc.body),
      image: extractFirstImage(doc.body),
      score,
      url: `/?doc=${doc.id}`,
    }));

  const matchedAsm = matchAssemblyForRevit({ category, family, typeName, query });
  const assemblies = matchedAsm
    ? [matchedAsm, ...ASSEMBLIES_3D.filter((a) => a.id !== matchedAsm.id).slice(0, 1)]
    : ASSEMBLIES_3D.slice(0, 2);

  const typeQs = new URLSearchParams({ view: 'type' });
  if (category) typeQs.set('category', category);
  if (family) typeQs.set('family', family);
  if (typeName) typeQs.set('type', typeName);
  const revitType =
    typeName || family || category
      ? {
          category,
          family,
          typeName,
          params,
          url: `/?${typeQs.toString()}`,
        }
      : null;

  return {
    ok: true,
    source: liveItems !== null ? 'supabase' : role === 'Guest' ? 'none' : 'seed',
    role,
    context: { category, family, typeName, query },
    revitType,
    assembly3d: assemblies.map((a) => ({
      id: a.id,
      code: a.code,
      title: a.title,
      fireRating: a.fireRating,
      stc: a.stc,
      thickness: a.thickness,
      layersCount: a.layers.length,
      url: `/?view=3d&assembly=${a.id}`,
    })),
    standards: scored,
  };
}

export async function POST(req) {
  try {
    const auth = await resolveRevitCaller(req);
    if (!auth.ok) {
      return jsonResp(
        { ok: false, error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' },
        auth.status
      );
    }
    const body = await req.json();
    const result = await runLookup(auth.admin, body || {}, auth.role);
    return jsonResp({ ...result, user: auth.user });
  } catch (e) {
    return jsonResp({ ok: false, error: e.message || 'Lookup failed' }, 400);
  }
}

export async function GET(req) {
  const auth = await resolveRevitCaller(req);
  if (!auth.ok) {
    return jsonResp(
      { ok: false, error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' },
      auth.status
    );
  }
  const url = new URL(req.url);
  const result = await runLookup(
    auth.admin,
    {
      category: url.searchParams.get('category') || '',
      family: url.searchParams.get('family') || '',
      typeName: url.searchParams.get('typeName') || '',
      query: url.searchParams.get('query') || '',
    },
    auth.role
  );
  return jsonResp({ ...result, user: auth.user });
}
