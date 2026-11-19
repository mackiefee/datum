import { plain } from './markdown.js';

const SHORT_BIM_TOKENS = new Set([
  'ch', 'bi', 'ai', 'fi', '0i', '0s', '0g', 'ag', 'gl', 'ar', 'pl',
  'sr', 'nr', 'oc', '5d', 'bd', '2s', '3s', '4s', '6s', '8s', '2w', '4w', '6w', '8w',
  '1hr', '2hr', '3hr', 'qa', 'qc', 'cl', 'ui',
]);

const STOP_WORDS = new Set([
  'how', 'should', 'what', 'when', 'where', 'why', 'who', 'which', 'whom',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'the', 'and', 'for',
  'with', 'this', 'that', 'these', 'those', 'from', 'into', 'can', 'could',
  'would', 'does', 'did', 'has', 'have', 'had', 'not', 'but', 'our', 'your',
  'about', 'there', 'their', 'explain', 'summarize', 'tell', 'show', 'find',
  'як', 'що', 'які', 'який', 'яка', 'яке', 'коли', 'де', 'чому', 'чи', 'про',
  'для', 'або', 'та', 'і', 'й', 'в', 'у', 'на', 'з', 'із', 'до', 'від',
  'по', 'це', 'той', 'ця', 'ці', 'так', 'ні', 'можна', 'треба', 'потрібно',
  'мені', 'нам', 'тут', 'там',
]);

const SYNONYM_GROUPS = [
  ['стіна', 'стіни', 'стін', 'перегородка', 'перегородки', 'перегородок', 'wall', 'walls', 'partition', 'partitionwall', 'demising', 'shaftwall', 'furred'],
  ['гіпсокартон', 'гіпсокартонні', 'гкл', 'гіпс', 'лист', 'листи', 'gwb', 'gypsum', 'gypsumlayer', 'drywall', 'board'],
  ['вогнестійкість', 'вогнезахист', 'пожеж', 'протипожеж', 'рейтинг', 'fire', 'rated', 'rating', 'smoke', 'resistance', '1hr', '2hr', '3hr'],
  ['двері', 'дверей', 'дверний', 'отвір', 'отвори', 'проріз', 'поріг', 'door', 'doors', 'opening', 'openings', 'threshold', 'swing', 'ada', 'hardware', 'clearance'],
  ['колізія', 'колізії', 'колізій', 'перетин', 'перетини', 'перевірка', 'clash', 'clashes', 'detection', 'interference', 'navisworks'],
  ['найменування', 'назва', 'назви', 'називати', 'формула', 'код', 'коди', 'слот', 'слоти', 'префікс', 'параметр', 'naming', 'name', 'named', 'convention', 'unicode', 'slot', 'slots', 'parameter', 'workset', 'c1010', 'c1070'],
  ['беп', 'bep', 'шаблон', 'старт', 'початок', 'чеклист', 'план', 'template', 'checklist', 'start', 'setup', 'kickoff'],
  ['стеля', 'стелі', 'софіт', 'софіти', 'ceiling', 'ceilings', 'rcp', 'soffit', 'soffits', 'fixture', 'fixtures', 'lighting'],
  ['каркас', 'стійка', 'стійки', 'крок', 'ізоляція', 'утеплювач', 'вату', 'вата', 'stud', 'studs', 'framing', 'insulation', '16oc', '24oc', '12oc'],
  ['помилка', 'помилки', 'аудит', 'увага', 'зауваження', 'рфі', 'rfi', 'mistake', 'mistakes', 'audit', 'qa', 'qc', 'protocol'],
  ['ревіт', 'revit', 'родина', 'родини', 'сімейство', 'сімейства', 'тип', 'типи', 'family', 'families', 'nested', 'type'],
  ['бетон', 'залізобетон', 'цегла', 'блок', 'блоки', 'перемичка', 'плита', 'concrete', 'cmu', 'masonry', 'lintel', 'lintels', 'pouring', 'slab'],
  ['кухня', 'кухні', 'меблі', 'обладнання', 'прилади', 'техніка', 'kitchen', 'kitchens', 'millwork', 'casework', 'appliance', 'appliances', 'fec'],
  ['електрика', 'сантехніка', 'вентиляція', 'інженерія', 'труби', 'кабель', 'mep', 'plumbing', 'hvac', 'electrical', 'pipe', 'piping'],
  ['висота', 'висоти', 'висоту', 'висоті', 'height', 'heights'],
  ['товщина', 'товщини', 'товщину', 'thickness', 'thick'],
  ['ширина', 'ширини', 'ширину', 'width', 'wide'],
  ['розмір', 'розміри', 'розмірів', 'допуск', 'допуски', 'допусків', 'dimension', 'dimensions', 'tolerance', 'tolerances'],
  ['аксесуари', 'доступність', 'інклюзивність', 'пандус', 'санвузол', 'accessibility', 'egress', 'corridor', 'ada'],
  ['креслення', 'аркуш', 'аркуші', 'штамп', 'легенда', 'специфікація', 'sheet', 'sheets', 'plan', 'plans', 'legend', 'legends', 'title', 'blocks', 'specs', 'schedule'],
  ['скрипт', 'скрипти', 'скриптів', 'код', 'макрос', 'дінамо', 'пайтон', 'піревіт', 'посилання', 'лінк', 'лінки', 'ресурс', 'ресурси', 'script', 'scripts', 'snippet', 'snippets', 'dynamo', 'pyrevit', 'python', 'macro', 'link', 'links', 'portal', 'tool', 'tools'],
];

const STEM_INDEX = new Map();
SYNONYM_GROUPS.forEach((group, groupIdx) => {
  group.forEach((term) => {
    const key = term.toLowerCase();
    if (!STEM_INDEX.has(key)) STEM_INDEX.set(key, []);
    STEM_INDEX.get(key).push(groupIdx);
  });
});

export const hasCyrillic = (s = '') => /[а-яіїєґА-ЯІЇЄҐ]/.test(String(s));

export const tok = (s = '') =>
  String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/._-]/gu, ' ')
    .split(/\s+/)
    .flatMap((chunk) => [chunk, ...chunk.split(/[/._-]+/)])
    .filter((w) => w && !STOP_WORDS.has(w) && (w.length >= 2 || SHORT_BIM_TOKENS.has(w)));

export const tokenizeUnique = (s = '') => [...new Set(tok(s))];

/**
 * Expands original tokens with bilingual UA/EN & BIM synonyms while preserving
 * which original query token index (`origins`) produced each expanded term.
 * Original terms receive full weight (1), synonyms receive 0.65 so exact matches win ties.
 */
export function expandTokens(tokens = []) {
  const entries = new Map();
  const upsert = (term, weight, originIdx) => {
    const existing = entries.get(term);
    if (!existing) {
      entries.set(term, { term, weight, origins: new Set([originIdx]) });
    } else {
      if (weight > existing.weight) existing.weight = weight;
      existing.origins.add(originIdx);
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const raw = String(tokens[i] || '').toLowerCase();
    if (!raw) continue;
    upsert(raw, 1, i);

    const matchedGroups = new Set(STEM_INDEX.get(raw) || []);
    if (!matchedGroups.size && raw.length >= 4) {
      for (const [dictTerm, groups] of STEM_INDEX.entries()) {
        if (dictTerm.startsWith(raw.slice(0, 4)) || raw.startsWith(dictTerm.slice(0, 4))) {
          groups.forEach((g) => matchedGroups.add(g));
        }
      }
    }
    matchedGroups.forEach((gIdx) => {
      const group = SYNONYM_GROUPS[gIdx] || [];
      for (let j = 0; j < group.length; j++) {
        upsert(group[j], 0.65, i);
      }
    });
  }
  return [...entries.values()];
}

const QUESTION_RE =
  /\?|^(?:how|what|when|where|why|which|who|can|should|does|do|is|are|explain|summarize|compare|difference|як|що|які|який|яка|яке|коли|де|чому|чи|можна|поясни|підсумуй|розшифруй|порівняй)\b/i;

/**
 * Distinguishes instant keyword lookup (`search`) from conversational prompt (`question`)
 * so typing a question does not abruptly collapse the 3D Space before submit.
 */
export function detectSearchIntent(rawQuery = '') {
  const q = String(rawQuery || '').trim();
  if (!q) return 'search';
  if (QUESTION_RE.test(q)) return 'question';
  const words = tokenizeUnique(q);
  if (words.length >= 4) return 'question';
  return 'search';
}

const hayCache = new WeakMap();
const tokCache = new WeakMap();

export const hay = (r) => {
  if (!r || typeof r !== 'object') return '';
  const hit = hayCache.get(r);
  const sig = `${r.upd || ''}|${(r.title || '').length}|${(r.body || '').length}`;
  if (hit && hit.sig === sig) return hit.val;
  const val = `${r.title} ${r.desc} ${r.body} ${(r.tags || []).join(' ')} ${r.author}`.toLowerCase();
  hayCache.set(r, { sig, val });
  return val;
};

export const getCachedTokens = (r) => {
  if (!r || typeof r !== 'object') return [];
  const sig = `${r.upd || ''}|${(r.title || '').length}|${(r.body || '').length}`;
  const hit = tokCache.get(r);
  if (hit && hit.sig === sig) return hit.val;
  const val = tok(hay(r));
  tokCache.set(r, { sig, val });
  return val;
};

/**
 * Shared bilingual + stem-aware document scorer used by Space live search,
 * Command Palette, Catalog search, and Edge AI retrieval.
 */
export function scoreDocument(r, rawQuery = '', precomputedTokens = null) {
  const s = String(rawQuery || '').trim().toLowerCase();
  if (!s || !r) return { score: 0, matched: 0, exactHits: 0 };

  const tokens = precomputedTokens || tokenizeUnique(s);
  const expanded = expandTokens(tokens);
  const titleL = (r.title || '').toLowerCase();
  const descL = (r.desc || '').toLowerCase();
  const tagsL = (r.tags || []).join(' ').toLowerCase();
  const discL = (r.disc || '').toLowerCase();
  const hayL = hay(r);

  let score = 0;
  let exactHits = 0;

  if (titleL.includes(s)) score += 18;
  else if (hayL.includes(s)) score += 8;

  // Count distinct original query tokens satisfied (either directly or via that token's synonyms)
  // and track how many matched via the exact query terms themselves (`directMatched`).
  const hitTokenIndices = new Set();
  const directHitIndices = new Set();
  const bestPerOrigin = new Map();

  for (let i = 0; i < expanded.length; i++) {
    const { term: w, weight, origins } = expanded[i];
    const allowStem = weight >= 1 && w.length >= 4;
    const stem = allowStem ? w.slice(0, w.length - 1) : w;
    let termScore = 0;

    if (titleL.includes(w)) termScore += 8 * weight;
    else if (allowStem && stem.length >= 3 && titleL.includes(stem)) termScore += 4.5 * weight;

    if (tagsL.includes(w) || (allowStem && stem.length >= 3 && tagsL.includes(stem))) termScore += 5.5 * weight;
    if (discL.includes(w)) termScore += 3.5 * weight;
    if (descL.includes(w) || (allowStem && stem.length >= 3 && descL.includes(stem))) termScore += 3 * weight;
    if (hayL.includes(w) || (allowStem && stem.length >= 3 && hayL.includes(stem))) termScore += 1.5 * weight;

    if (termScore > 0) {
      if (weight >= 1) exactHits++;
      const originList = origins && origins.size ? origins : [i];
      originList.forEach((originIdx) => {
        hitTokenIndices.add(originIdx);
        if (weight >= 1) directHitIndices.add(originIdx);
        const prev = bestPerOrigin.get(originIdx) || 0;
        if (termScore > prev) bestPerOrigin.set(originIdx, termScore);
      });
    }
  }

  bestPerOrigin.forEach((v) => {
    score += v;
  });

  return {
    score,
    matched: hitTokenIndices.size,
    directMatched: directHitIndices.size,
    exactHits,
  };
}

export const ask = (q, res) => {
  const tokens = tokenizeUnique(q);
  return res
    .map((r) => [r, scoreDocument(r, q, tokens).score])
    .filter((x) => x[1] > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map((x) => x[0]);
};

export const summ = (r) => {
  const b = plain(r.body);
  return (b.match(/[^.!?]+[.!?]/g) || [b]).slice(0, 2).join(' ').trim();
};

export const sugTags = (r) => {
  const c = {};
  tok(`${r.title} ${r.body}`).forEach((w) => {
    if (w.length > 5) c[w] = (c[w] || 0) + 1;
  });
  return Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map((x) => x[0]);
};
