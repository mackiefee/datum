import { SEED, IMG0 } from '../../../../data/seed.js';
import { ASSEMBLIES_3D, matchAssemblyForRevit } from '../../../../data/assemblies3d.js';
import { verifyRevitJwt } from '../auth/route.js';

export const runtime = 'edge';

const CATEGORY_BOOSTS = {
  walls: ['wall', 'partition', 'gwb', 'stud', 'shaft', 'furring', 'fire', 'acoustic', 'c1010'],
  doors: ['door', 'ada', 'threshold', 'frame', 'opening', 'won-door', 'c1020'],
  ceilings: ['ceiling', 'soffit', 'plenum', 'grid'],
  floors: ['floor', 'slab', 'finish'],
  plumbing: ['plumbing', 'wet-wall', 'bathroom', 'fixture', 'chase'],
  fixtures: ['plumbing', 'bathroom', 'backing', 'blocking'],
  'casework': ['backing', 'blocking', 'millwork', 'casework'],
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

async function resolveRole(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return { role: 'Guest', user: null };
  const checked = await verifyRevitJwt(token);
  if (!checked.valid || !checked.claims) return { role: 'Guest', user: null };
  return {
    role: checked.claims.role || 'Member',
    user: {
      name: checked.claims.name,
      email: checked.claims.email,
      role: checked.claims.role || 'Member',
    },
  };
}

function filterByRole(items, role) {
  return items.filter((r) => {
    if (r.st === 'Draft' && !['Admin', 'SuperAdmin', 'Editor'].includes(role)) return false;
    if (role === 'Guest' && r.vis !== 'Public') return false;
    return true;
  });
}

function runLookup({ category = '', family = '', typeName = '', params = {}, query = '' }, role) {
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

  const visible = filterByRole(SEED, role);

  const scored = visible
    .map((doc) => {
      const titleLow = String(doc.title || '').toLowerCase();
      const sumLow = String(doc.sum || '').toLowerCase();
      const tagsLow = (doc.tags || []).join(' ').toLowerCase();
      const bodyLow = String(doc.body || '').toLowerCase();

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
      if (!rawText && doc.st === 'Approved') score += 1;

      return { doc, score };
    })
    .filter((x) => (rawText ? x.score > 0 : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      disc: doc.disc || 'BIM',
      status: doc.st || 'Approved',
      vis: doc.vis || 'Internal',
      summary: doc.sum || '',
      keyRules: extractKeyRules(doc.body),
      image: extractFirstImage(doc.body),
      score,
      url: `/?read=${doc.id}`,
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
    const body = await req.json();
    const { role, user } = await resolveRole(req);
    const result = runLookup(body || {}, role);
    return new Response(JSON.stringify({ ...result, user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message || 'Lookup failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const { role, user } = await resolveRole(req);
  const result = runLookup(
    {
      category: url.searchParams.get('category') || '',
      family: url.searchParams.get('family') || '',
      typeName: url.searchParams.get('typeName') || '',
      query: url.searchParams.get('query') || '',
    },
    role
  );
  return new Response(JSON.stringify({ ...result, user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
