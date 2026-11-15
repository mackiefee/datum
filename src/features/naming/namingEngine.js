import {
  WALL_TYPES,
  FIRE_RATINGS,
  LAYER_CODES,
  STUD_CODES,
  INSULATION_CODES,
  OC_CODES,
  BIM_CODE_LOOKUP,
} from '../../data/namingSchemas.js';

const CYRILLIC_TO_LATIN = {
  '\u0410': 'A', '\u0430': 'a',
  '\u0412': 'B',
  '\u0421': 'C', '\u0441': 'c',
  '\u0415': 'E', '\u0435': 'e',
  '\u0406': 'I', '\u0456': 'i',
  '\u041a': 'K', '\u043a': 'k',
  '\u041c': 'M',
  '\u041d': 'H',
  '\u041e': 'O', '\u043e': 'o',
  '\u0420': 'P', '\u0440': 'p',
  '\u0422': 'T',
  '\u0425': 'X', '\u0445': 'x',
};

const VALID_LAYER_CODE_SET = new Set(LAYER_CODES.filter((c) => c.code !== '0').map((c) => c.code));
const VALID_STUD_CODE_SET = new Set(STUD_CODES.filter((c) => c.code !== '0S').map((c) => c.code));
const VALID_INSUL_CODE_SET = new Set(INSULATION_CODES.map((c) => c.code));
const VALID_FIRE_BASE_SET = new Set(FIRE_RATINGS.map((f) => f.code));

export const DEFAULT_WALL_STATE = {
  unicode: 'C1010.10.01',
  partitionType: 'PartitionWall',
  fireRating: '1HR',
  smokeResistant: false,
  ext1: '0',
  ext2: '0',
  ext3: '5/8G',
  doubleStudMode: false,
  stud1: '3-5/8S',
  airGap: '',
  stud2: '',
  fiveDBd: false,
  insulation: 'AI',
  insulation2: '',
  int1: '5/8G',
  int2: '0',
  int3: '0',
  oc: '16OC',
  byAssumption: true,
  tag: '',
  tagNote: '',
};

export function findWallTypeDef(value = '') {
  const clean = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  return WALL_TYPES.find(
    (t) =>
      t.unicode.toLowerCase() === clean ||
      t.type.toLowerCase() === clean ||
      (t.aliases && t.aliases.includes(clean))
  ) || null;
}

export function fixHomoglyphs(input = '') {
  let found = [];
  const fixed = String(input || '').replace(/[\u0400-\u04FF]/g, (ch, idx) => {
    const rep = CYRILLIC_TO_LATIN[ch];
    if (rep) {
      found.push({ ch, rep, index: idx });
      return rep;
    }
    return ch;
  });
  return { fixed, found };
}

export function parseFractionInches(raw = '') {
  const s = String(raw || '').trim();
  if (!s || s === '0') return 0;
  // Dimensional lumber: 2x4 -> 3.5", 2x6 -> 5.5", 2x8 -> 7.25"
  const lumber = s.match(/^2x(3|4|6|8|10|12)$/i);
  if (lumber) {
    const map = { 3: 2.5, 4: 3.5, 6: 5.5, 8: 7.25, 10: 9.25, 12: 11.25 };
    return map[Number(lumber[1])] || 3.5;
  }
  const mixed = s.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / (Number(mixed[3]) || 1);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / (Number(frac[2]) || 1);
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : 0;
}

export function inchesToMm(inches) {
  return Math.round(inches * 25.4);
}

export function parseLayerToken(token = '0') {
  const raw = String(token || '0').trim();
  if (!raw || raw === '0') {
    return { raw: '0', isZero: true, thickness: '0', code: '0', inches: 0, mm: 0, valid: true };
  }
  const m = raw.match(/^([0-9]+(?:-[0-9]+\/[0-9]+|\/[0-9]+|\.[0-9]+)?)(GL|AR|PL|G|T|P|M|C|O)$/i);
  if (!m) {
    return { raw, isZero: false, thickness: '', code: '', inches: 0, mm: 0, valid: false };
  }
  const thickness = m[1];
  const code = m[2].toUpperCase();
  const inches = parseFractionInches(thickness);
  return {
    raw: `${thickness}${code}`,
    isZero: false,
    thickness,
    code,
    inches,
    mm: Math.max(3, inchesToMm(inches)),
    valid: VALID_LAYER_CODE_SET.has(code),
  };
}

export function parseStudPart(part = '') {
  const raw = String(part || '').trim();
  if (!raw || raw === '0S') {
    return { raw: '0S', isZero: true, size: '0', code: '0S', inches: 0, mm: 0, valid: true };
  }
  const m = raw.match(/^([0-9]+(?:x[0-9]+|-[0-9]+\/[0-9]+|\/[0-9]+|\.[0-9]+)?)(CMU|CH|AG|S|W|F|Z|R)$/i);
  if (!m) {
    return { raw, isZero: false, size: '', code: '', inches: 0, mm: 0, valid: false };
  }
  const size = m[1].toLowerCase().includes('x') ? m[1].toLowerCase() : m[1];
  const code = m[2].toUpperCase();
  const inches = parseFractionInches(size);
  return {
    raw: `${size}${code}`,
    isZero: false,
    size,
    code,
    inches,
    mm: Math.max(10, inchesToMm(inches)),
    valid: VALID_STUD_CODE_SET.has(code),
  };
}

export function splitStudSlot(studRaw = '') {
  const s = String(studRaw || '').trim();
  if (!s || s === '0' || s.toUpperCase() === '0S') return ['0S'];
  const out = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    // Split composite stud segments only after a trailing letter code (e.g. 2-1/2S/1AG/2-1/2S),
    // never on fractional inch slashes like 3-5/8S or 7-5/8CMU.
    if (ch === '/' && cur && /[A-Za-z]$/.test(cur)) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : ['0S'];
}

export function composeStudSlot(state) {
  if (!state.doubleStudMode) {
    return (state.stud1 || '0S').trim() || '0S';
  }
  const parts = [];
  if (state.stud1 && state.stud1 !== '0S') parts.push(state.stud1.trim());
  if (!state.fiveDBd && state.airGap && state.airGap !== '0') parts.push(state.airGap.trim());
  if (state.stud2 && state.stud2 !== '0S') parts.push(state.stud2.trim());
  return parts.length ? parts.join('/') : '0S';
}

export function buildWallTypeName(rawState) {
  const s = { ...DEFAULT_WALL_STATE, ...(rawState || {}) };
  const def = findWallTypeDef(s.partitionType) || findWallTypeDef(s.unicode) || WALL_TYPES[0];
  const unicode = def.unicode;
  const partitionType = def.type;
  const isCmu = partitionType === 'CMUWall';
  const isShort = Boolean(def.shortFormat);

  const fire = s.fireRating === 'SR'
    ? 'SR'
    : s.smokeResistant && s.fireRating !== 'SR'
    ? `${s.fireRating}/SR`
    : s.fireRating || 'NR';

  const ext1 = (s.ext1 || '0').trim() || '0';
  const ext2 = (s.ext2 || '0').trim() || '0';
  const ext3 = (s.ext3 || '0').trim() || '0';

  const rulesApplied = [];
  if (isShort) {
    rulesApplied.push('GypsumLayer uses short 6-slot format (stops after Side 1 · 3rd layer)');
    const segs = [unicode, partitionType, fire, ext1, ext2, ext3];
    return {
      name: segs.join('_'),
      slots: [
        { num: 1, key: 'unicode', label: 'Unicode', value: unicode },
        { num: 2, key: 'partitionType', label: 'Partition Type', value: partitionType },
        { num: 3, key: 'fireRating', label: 'Fire Rating', value: fire },
        { num: 4, key: 'ext1', label: 'Side 1 · 1st', value: ext1, muted: ext1 === '0' },
        { num: 5, key: 'ext2', label: 'Side 1 · 2nd', value: ext2, muted: ext2 === '0' },
        { num: 6, key: 'ext3', label: 'Side 1 · 3rd', value: ext3, muted: ext3 === '0' },
      ],
      rulesApplied,
    };
  }

  const stud = composeStudSlot(s);
  if (s.doubleStudMode && s.fiveDBd && s.airGap) {
    rulesApplied.push('5D&BD mode removed Air Gap (AG) from stud slot');
  } else if (s.doubleStudMode && s.airGap) {
    rulesApplied.push('Air Gap placed between double studs per C1010 note');
  }

  let insulation = isCmu ? '0I' : (s.insulation || '0I').trim() || '0I';
  if (!isCmu && s.doubleStudMode && s.insulation2 && s.insulation2 !== insulation) {
    insulation = `${insulation}/${s.insulation2}`;
  }
  if (isCmu) rulesApplied.push('CMUWall forces Insulation = 0I & O.C. = 0OC');

  const int1 = (s.int1 || '0').trim() || '0';
  const int2 = (s.int2 || '0').trim() || '0';
  const int3 = (s.int3 || '0').trim() || '0';
  const oc = isCmu ? '0OC' : (s.oc || '16OC').trim() || '0OC';

  const baseName = [
    unicode,
    partitionType,
    fire,
    ext1,
    ext2,
    ext3,
    stud,
    insulation,
    int1,
    int2,
    int3,
    oc,
  ].join('_');

  const tagClean = s.byAssumption ? '' : String(s.tag || '').trim();
  const noteClean = !s.byAssumption && tagClean ? String(s.tagNote || '').trim() : '';
  const suffix = tagClean ? ` - ${tagClean}${noteClean ? ' ' + noteClean : ''}` : '';
  if (s.byAssumption || !tagClean) {
    rulesApplied.push('Tag per DD omitted (wall has no tag / by assumption)');
  }

  const slots = [
    { num: 1, key: 'unicode', label: 'Unicode', value: unicode },
    { num: 2, key: 'partitionType', label: 'Partition Type', value: partitionType },
    { num: 3, key: 'fireRating', label: 'Fire Rating', value: fire },
    { num: 4, key: 'ext1', label: 'Side 1 · 1st', value: ext1, muted: ext1 === '0' },
    { num: 5, key: 'ext2', label: 'Side 1 · 2nd', value: ext2, muted: ext2 === '0' },
    { num: 6, key: 'ext3', label: 'Side 1 · 3rd', value: ext3, muted: ext3 === '0' },
    { num: 7, key: 'stud', label: 'Stud / Core', value: stud, muted: stud === '0S' },
    { num: 8, key: 'insulation', label: 'Insulation', value: insulation, muted: insulation === '0I' },
    { num: 9, key: 'int1', label: 'Side 2 · 1st', value: int1, muted: int1 === '0' },
    { num: 10, key: 'int2', label: 'Side 2 · 2nd', value: int2, muted: int2 === '0' },
    { num: 11, key: 'int3', label: 'Side 2 · 3rd', value: int3, muted: int3 === '0' },
    { num: 12, key: 'oc', label: 'O.C.', value: oc, muted: oc === '0OC' },
  ];
  if (suffix) {
    slots.push({ num: 13, key: 'tag', label: 'Tag per DD', value: suffix.replace(/^ - /, '') });
  }

  return { name: baseName + suffix, slots, rulesApplied };
}

function validateFireToken(raw = '') {
  const clean = String(raw || '').trim().toUpperCase();
  if (!clean) return { valid: false, normalized: 'NR', fire: 'NR', sr: false };
  const parts = clean.split('/').map((x) => x.trim()).filter(Boolean);
  const allValid = parts.every((p) => VALID_FIRE_BASE_SET.has(p));
  const sr = parts.includes('SR');
  const base = parts.find((p) => p !== 'SR') || (sr ? 'SR' : 'NR');
  return { valid: allValid && parts.length <= 2, normalized: parts.join('/'), fire: base, sr: sr && base !== 'SR' };
}

function compareWithRevitLayers(parsedState, revitLayers, revitFire) {
  if (!Array.isArray(revitLayers) || !revitLayers.length) return null;
  const diffs = [];

  const extDeclared = [parsedState.ext1, parsedState.ext2, parsedState.ext3]
    .map(parseLayerToken)
    .filter((l) => !l.isZero);
  const intDeclared = [parsedState.int1, parsedState.int2, parsedState.int3]
    .map(parseLayerToken)
    .filter((l) => !l.isZero);
  const studParts = composeStudSlot(parsedState)
    .split('/')
    .map(parseStudPart)
    .filter((p) => !p.isZero);

  // Sum declared finish vs Revit non-core / core layers
  const revitBoardLayers = revitLayers.filter((l) => !l.core && !/insul|batt|wool|air|stud|cmu|frame/i.test(l.n || ''));
  const revitCoreLayers = revitLayers.filter((l) => l.core || /stud|cmu|frame/i.test(l.n || ''));
  const revitHasInsul = revitLayers.some((l) => /insul|batt|wool|thermal|foam/i.test(`${l.n || ''} ${l.f || ''}`));

  const declaredBoardCount = extDeclared.length + intDeclared.length;
  if (declaredBoardCount !== revitBoardLayers.length) {
    diffs.push({
      level: 'warn',
      message: `Name declares ${declaredBoardCount} board layers (${[...extDeclared, ...intDeclared].map((x) => x.raw).join(', ') || 'none'}), while Revit CompoundStructure has ${revitBoardLayers.length} non-core finish/substrate layers.`,
    });
  }

  const declaredBoardMm = [...extDeclared, ...intDeclared].reduce((s, l) => s + l.mm, 0);
  const revitBoardMm = Math.round(revitBoardLayers.reduce((s, l) => s + (Number(l.mm) || 0), 0));
  if (declaredBoardMm > 0 && revitBoardMm > 0 && Math.abs(declaredBoardMm - revitBoardMm) > 4) {
    diffs.push({
      level: 'warn',
      message: `Declared board total is ~${declaredBoardMm} mm vs Revit ${revitBoardMm} mm.`,
    });
  }

  const declaredStudMm = studParts.reduce((s, p) => s + p.mm, 0);
  const revitCoreMm = Math.round(revitCoreLayers.reduce((s, l) => s + (Number(l.mm) || 0), 0));
  if (declaredStudMm > 0 && revitCoreMm > 0 && Math.abs(declaredStudMm - revitCoreMm) > 6) {
    diffs.push({
      level: 'warn',
      message: `Stud/core in name is ~${declaredStudMm} mm (${composeStudSlot(parsedState)}) vs Revit core ${revitCoreMm} mm.`,
    });
  }

  const nameHasInsul = parsedState.insulation && parsedState.insulation !== '0I';
  if (nameHasInsul && !revitHasInsul) {
    diffs.push({
      level: 'warn',
      message: `Name specifies insulation (${parsedState.insulation}), but no thermal/insulation layer was detected in Revit layers.`,
    });
  } else if (!nameHasInsul && revitHasInsul) {
    diffs.push({
      level: 'warn',
      message: `Name says 0I (no insulation), but Revit layers include an insulation/thermal membrane.`,
    });
  }

  if (revitFire) {
    const rf = String(revitFire).toUpperCase().replace(/\s+/g, '');
    const nf = (parsedState.fireRating || '').toUpperCase();
    const numRevit = (rf.match(/[\d\-/]+/) || [])[0];
    const numName = (nf.match(/[\d\-/]+/) || [])[0];
    if (numRevit && nf === 'NR') {
      diffs.push({ level: 'error', message: `Revit Fire Rating parameter is "${revitFire}" while Type Name says NR.` });
    } else if (numRevit && numName && numRevit !== numName) {
      diffs.push({ level: 'error', message: `Fire Rating mismatch: Revit parameter is "${revitFire}" vs Type Name "${parsedState.fireRating}".` });
    }
  }

  return {
    match: diffs.length === 0,
    diffs,
    revitLayerCount: revitLayers.length,
    declaredLayerCount: declaredBoardCount + studParts.length,
  };
}

export function parseAndValidateWallName(rawName, revitLayers = null, revitFire = '') {
  const original = String(rawName || '');
  const trimmed = original.trim();
  const issues = [];

  if (!trimmed) {
    return {
      raw: original,
      status: 'error',
      issues: [{ level: 'error', slot: 0, message: 'Type name is empty.' }],
      slots: [],
      autoFixed: '',
      parsedState: { ...DEFAULT_WALL_STATE },
      revitAudit: null,
    };
  }

  if (original !== trimmed) {
    issues.push({ level: 'warn', slot: 0, message: 'Leading or trailing whitespace detected around type name.' });
  }

  const { fixed: latinized, found: homoglyphs } = fixHomoglyphs(trimmed);
  if (homoglyphs.length > 0) {
    const chars = [...new Set(homoglyphs.map((h) => `"${h.ch}" → "${h.rep}"`))].join(', ');
    issues.push({
      level: 'error',
      slot: 1,
      message: `Cyrillic homoglyph detected (${chars}) — breaks Revit schedules & filters.`,
    });
  }

  // Split optional " - Tag" suffix carefully
  let coreStr = latinized;
  let tagPart = '';
  let tagNote = '';
  const dashIdx = latinized.indexOf(' - ');
  if (dashIdx !== -1) {
    coreStr = latinized.slice(0, dashIdx).trim();
    const fullTag = latinized.slice(dashIdx + 3).trim();
    if (!fullTag) {
      issues.push({ level: 'error', slot: 13, message: 'Dangling " - " without a DD Tag. Omit " - " when wall has no tag / by assumption.' });
    } else {
      const spIdx = fullTag.indexOf(' ');
      if (spIdx > 0) {
        tagPart = fullTag.slice(0, spIdx).trim();
        tagNote = fullTag.slice(spIdx + 1).trim();
      } else {
        tagPart = fullTag;
      }
    }
  } else if (/\s+-$/.test(latinized)) {
    coreStr = latinized.replace(/\s+-$/, '').trim();
    issues.push({ level: 'error', slot: 13, message: 'Trailing "-" should be omitted when Tag per DD is empty.' });
  }

  const rawSegments = coreStr.split('_').map((x) => x.trim());
  if (rawSegments.some((seg, i) => coreStr.split('_')[i] !== seg)) {
    issues.push({ level: 'warn', slot: 0, message: 'Extra spaces around "_" delimiter.' });
  }

  // Extract slot 1..12 with graceful recovery
  const def1 = findWallTypeDef(rawSegments[0]);
  const def2 = findWallTypeDef(rawSegments[1]);
  const matchedDef = def2 || def1;

  let unicode = rawSegments[0] || '';
  let partitionType = rawSegments[1] || '';

  if (matchedDef) {
    if (unicode !== matchedDef.unicode) {
      issues.push({
        level: 'error',
        slot: 1,
        message: `Unicode "${unicode || '(empty)'}" should be "${matchedDef.unicode}" for ${matchedDef.type}.`,
      });
      unicode = matchedDef.unicode;
    }
    if (partitionType !== matchedDef.type) {
      issues.push({
        level: 'error',
        slot: 2,
        message: `Partition Type "${partitionType}" should match canonical "${matchedDef.type}".`,
      });
      partitionType = matchedDef.type;
    }
  } else {
    if (!/^C\d{4}\.\d{2}\.\d{2}$/i.test(unicode)) {
      issues.push({ level: 'error', slot: 1, message: `Invalid Uniformat code "${unicode}". Expected C1010.10.xx / C1070.20.xx / C1010.90.05.` });
    }
    if (!partitionType || /\s/.test(partitionType)) {
      issues.push({ level: 'error', slot: 2, message: `Unrecognized or spaced Partition Type "${partitionType}".` });
    }
  }

  const isShort = (matchedDef && matchedDef.shortFormat) || unicode === 'C1010.90.05' || partitionType === 'GypsumLayer';
  const expectedSegments = isShort ? 6 : 12;

  if (rawSegments.length !== expectedSegments) {
    if (isShort && rawSegments.length === 12) {
      issues.push({ level: 'warn', slot: 7, message: 'C1010.90.05 GypsumLayer should use short 6-slot format ending after 3rd layer (drop trailing _0_0...).' });
    } else {
      issues.push({
        level: 'error',
        slot: 0,
        message: `Expected ${expectedSegments} "_" segments (${isShort ? 'GypsumLayer short format' : 'standard wall'}), got ${rawSegments.length}.`,
      });
    }
  }

  const fireInfo = validateFireToken(rawSegments[2] || 'NR');
  if (!fireInfo.valid) {
    issues.push({ level: 'error', slot: 3, message: `Invalid Fire Rating "${rawSegments[2] || ''}". Allowed: NR, 1/2HR, 1HR, 1-1/2HR, 2HR, 3HR, 4HR, SR or HR/SR.` });
  }

  const ext1Tok = parseLayerToken(rawSegments[3] || '0');
  const ext2Tok = parseLayerToken(rawSegments[4] || '0');
  const ext3Tok = parseLayerToken(rawSegments[5] || '0');
  [
    [4, ext1Tok, 'Side 1 · 1st layer'],
    [5, ext2Tok, 'Side 1 · 2nd layer'],
    [6, ext3Tok, 'Side 1 · 3rd layer'],
  ].forEach(([slot, tok, lbl]) => {
    if (!tok.valid) {
      issues.push({ level: 'error', slot, message: `${lbl} "${tok.raw}" is invalid. Use "0" or thickness+code (e.g. 5/8G, 1/2PL, 1GL).` });
    }
  });

  // Build parsedState cleanly
  const studRaw = isShort ? '0S' : (rawSegments[6] || '0S');
  const insRaw = isShort ? '0I' : (rawSegments[7] || '0I');
  const int1Tok = parseLayerToken(isShort ? '0' : (rawSegments[8] || '0'));
  const int2Tok = parseLayerToken(isShort ? '0' : (rawSegments[9] || '0'));
  const int3Tok = parseLayerToken(isShort ? '0' : (rawSegments[10] || '0'));
  let ocRaw = isShort ? '0OC' : (rawSegments[11] || '0OC');

  const studParts = splitStudSlot(studRaw);
  let doubleStudMode = studParts.length > 1;
  let stud1 = studParts[0] || '0S';
  let airGap = '';
  let stud2 = '';

  if (!isShort) {
    if (studRaw === '0') {
      issues.push({ level: 'error', slot: 7, message: 'Lost stud parameter should be "0S" instead of "0".' });
      stud1 = '0S';
    } else if (studParts.length === 1) {
      const parsedS = parseStudPart(studParts[0]);
      if (!parsedS.valid) {
        issues.push({ level: 'error', slot: 7, message: `Invalid Stud/Core "${studParts[0]}". Expected size + code (e.g. 3-5/8S, 6S, 7-5/8CMU, 2x4W, 0S).` });
      } else if (parsedS.code === 'AG') {
        issues.push({ level: 'error', slot: 7, message: 'Air Gap (AG) cannot stand alone — place it between studs (e.g. 2-1/2S/1AG/2-1/2S).' });
      }
      stud1 = parsedS.valid ? parsedS.raw : studParts[0];
    } else {
      const parsedAll = studParts.map(parseStudPart);
      parsedAll.forEach((ps, i) => {
        if (!ps.valid) {
          issues.push({ level: 'error', slot: 7, message: `Invalid composite stud piece "${studParts[i]}".` });
        }
      });
      const agIdx = parsedAll.findIndex((p) => p.code === 'AG');
      if (agIdx === 0 || agIdx === parsedAll.length - 1) {
        issues.push({ level: 'error', slot: 7, message: 'Air Gap (AG) must be positioned BETWEEN studs (e.g. 2-1/2S/1AG/2-1/2S).' });
      } else if (agIdx > 0) {
        issues.push({ level: 'info', slot: 7, message: 'Contains Air Gap (AG) — remember to remove "/' + parsedAll[agIdx].raw + '" when exporting for 5D&BD.' });
        stud1 = parsedAll[0].valid ? parsedAll[0].raw : studParts[0];
        airGap = parsedAll[agIdx].raw;
        stud2 = parsedAll[2] && parsedAll[2].valid ? parsedAll[2].raw : studParts[2] || '';
      } else {
        stud1 = parsedAll[0].valid ? parsedAll[0].raw : studParts[0];
        stud2 = parsedAll[1] && parsedAll[1].valid ? parsedAll[1].raw : studParts[1] || '';
      }
    }

    // Insulation check (slot 8)
    const isCmu = partitionType === 'CMUWall';
    const insParts = insRaw.toUpperCase().split('/').map((x) => x.trim()).filter(Boolean);
    if (!insParts.length || insRaw === '0') {
      issues.push({ level: 'error', slot: 8, message: 'Lost insulation parameter should be "0I" instead of "0" or empty.' });
    } else if (!insParts.every((p) => VALID_INSUL_CODE_SET.has(p))) {
      issues.push({ level: 'error', slot: 8, message: `Invalid Insulation "${insRaw}". Allowed: BI, AI, FI, 0I.` });
    }
    if (isCmu && insRaw.toUpperCase() !== '0I') {
      issues.push({ level: 'error', slot: 8, message: 'CMUWall requires Insulation = "0I".' });
    }

    // Side 2 layer checks (slots 9..11)
    [
      [9, int1Tok, 'Side 2 · 1st layer'],
      [10, int2Tok, 'Side 2 · 2nd layer'],
      [11, int3Tok, 'Side 2 · 3rd layer'],
    ].forEach(([slot, tok, lbl]) => {
      if (!tok.valid) {
        issues.push({ level: 'error', slot, message: `${lbl} "${tok.raw}" is invalid. Use "0" or thickness+code.` });
      }
    });

    // O.C. check (slot 12)
    const ocClean = ocRaw.toUpperCase();
    const ocParts = ocClean.split('/').map((x) => x.trim()).filter(Boolean);
    if (!ocParts.length || ocClean === '0') {
      issues.push({ level: 'error', slot: 12, message: 'Lost spacing parameter should be "0OC" instead of "0".' });
      ocRaw = '0OC';
    } else if (!ocParts.every((p) => /^(\d+OC|0OC)$/.test(p))) {
      issues.push({ level: 'error', slot: 12, message: `Invalid O.C. spacing "${ocRaw}". Expected 16OC, 24OC, 16OC/24OC, or 0OC.` });
    } else {
      ocRaw = ocParts.join('/');
    }
    if (isCmu && ocRaw !== '0OC') {
      issues.push({ level: 'error', slot: 12, message: 'CMUWall requires Spacing = "0OC".' });
    }
  }

  const insCleanParts = insRaw.toUpperCase().split('/').map((x) => (x === '0' ? '0I' : x));
  const normalizedIns = VALID_INSUL_CODE_SET.has(insCleanParts[0]) ? insCleanParts[0] : '0I';

  const parsedState = {
    unicode: unicode || 'C1010.10.01',
    partitionType: partitionType || 'PartitionWall',
    fireRating: fireInfo.fire,
    smokeResistant: fireInfo.sr,
    ext1: ext1Tok.valid ? ext1Tok.raw : rawSegments[3] || '0',
    ext2: ext2Tok.valid ? ext2Tok.raw : rawSegments[4] || '0',
    ext3: ext3Tok.valid ? ext3Tok.raw : rawSegments[5] || '0',
    doubleStudMode,
    stud1,
    airGap,
    stud2,
    fiveDBd: false,
    insulation: partitionType === 'CMUWall' ? '0I' : normalizedIns,
    insulation2: insCleanParts[1] && VALID_INSUL_CODE_SET.has(insCleanParts[1]) ? insCleanParts[1] : '',
    int1: int1Tok.valid ? int1Tok.raw : rawSegments[8] || '0',
    int2: int2Tok.valid ? int2Tok.raw : rawSegments[9] || '0',
    int3: int3Tok.valid ? int3Tok.raw : rawSegments[10] || '0',
    oc: partitionType === 'CMUWall' ? '0OC' : ocRaw || '16OC',
    byAssumption: !tagPart,
    tag: tagPart,
    tagNote,
  };

  const built = buildWallTypeName(parsedState);
  const revitAudit = compareWithRevitLayers(parsedState, revitLayers, revitFire);
  if (revitAudit && revitAudit.diffs.length) {
    revitAudit.diffs.forEach((d) => issues.push({ level: d.level, slot: 0, message: d.message }));
  }

  const hasError = issues.some((i) => i.level === 'error');
  const hasWarn = issues.some((i) => i.level === 'warn');
  const status = hasError ? 'error' : hasWarn ? 'warn' : 'valid';

  return {
    raw: original,
    status,
    issues,
    slots: built.slots,
    autoFixed: built.name,
    changedByFix: built.name !== trimmed,
    parsedState,
    revitAudit,
  };
}

export function buildAssemblyFromWallState(state, customName = '') {
  const s = { ...DEFAULT_WALL_STATE, ...(state || {}) };
  const def = findWallTypeDef(s.partitionType) || WALL_TYPES[0];
  const { name } = buildWallTypeName(s);
  const typeLabel = customName || name;
  const fireLabel = s.fireRating === 'SR' ? 'SR' : `${s.fireRating}${s.smokeResistant ? '/SR' : ''}`;

  const layerColor = (code) => (LAYER_CODES.find((c) => c.code === code) || {}).color || '#d8dee9';
  const layerLabel = (code) => (LAYER_CODES.find((c) => c.code === code) || {}).label || code;
  const studMeta = (code) => STUD_CODES.find((c) => c.code === code) || STUD_CODES[0];

  const layers = [];
  let idx = 0;

  const pushBoardLayer = (tokStr, sideLabel, fn) => {
    const tok = parseLayerToken(tokStr);
    if (!tok.valid || tok.isZero) return;
    const depth = Math.max(8, Math.min(48, Math.round(tok.mm * 0.55)));
    layers.push({
      id: `nm-ly-${idx++}`,
      name: `${tok.thickness}" ${layerLabel(tok.code)} (${tok.code})`,
      role: `${sideLabel} · ${fn}`,
      thicknessMm: tok.mm,
      width: 260,
      height: 190,
      depth,
      color: layerColor(tok.code),
      edgeColor: '#93c5fd',
      opacity: 0.94,
      pattern: 'solid',
      revitMaterial: `${layerLabel(tok.code)} - ${tok.thickness}"`,
      param: `Code = ${tok.raw} (${sideLabel})`,
      rule: `Named "${tok.raw}" in ${sideLabel.toLowerCase()} slot.`,
    });
  };

  // Side 1 (Exterior / Finish 1 -> innermost)
  [s.ext1, s.ext2, s.ext3].forEach((val, i) => pushBoardLayer(val, `Side 1 #${i + 1}`, i === 0 ? 'Finish1' : 'Substrate'));

  if (!def.shortFormat) {
    const studStr = composeStudSlot(s);
    const studParts = splitStudSlot(studStr).map(parseStudPart).filter((p) => !p.isZero);
    const insParts = (s.insulation || '0I').split('/').filter((x) => x && x !== '0I');

    if (studParts.length === 0) {
      // Lost stud 0S placeholder visualization
      layers.push({
        id: `nm-ly-${idx++}`,
        name: 'No Stud / Existing Support (0S)',
        role: 'Core Reference',
        thicknessMm: 12,
        width: 260,
        height: 190,
        depth: 10,
        color: '#64748b',
        edgeColor: '#cbd5e1',
        opacity: 0.45,
        pattern: 'solid',
        revitMaterial: '0S (Omitted Stud)',
        param: 'Stud = 0S',
        rule: 'Slot 7 uses 0S when stud thickness is omitted or hosted.',
      });
    } else {
      let insIdx = 0;
      studParts.forEach((sp, pIdx) => {
        const sm = studMeta(sp.code);
        const depth = Math.max(14, Math.min(68, Math.round((sp.mm || 92) * 0.36)));
        const isAg = sp.code === 'AG';
        layers.push({
          id: `nm-ly-${idx++}`,
          name: isAg ? `${sp.size}" Air Gap (AG)` : `${sp.size}" ${sm.label} (${sp.code})`,
          role: isAg ? 'ThermalOrAir · Cavity' : `Core · Structure (${s.oc || '0OC'})`,
          thicknessMm: sp.mm,
          width: 260,
          height: 190,
          depth,
          color: sm.color,
          edgeColor: isAg ? '#7dd3fc' : '#cbd5e1',
          opacity: isAg ? 0.42 : 0.88,
          pattern: isAg ? 'solid' : sm.pattern,
          revitMaterial: isAg ? `Air Gap ${sp.size}"` : `${sm.label} ${sp.size}" ${s.oc || ''}`.trim(),
          param: `Stud Slot = ${sp.raw} · OC = ${s.oc || '0OC'}`,
          rule: isAg
            ? 'Air Gap placed between double studs. Must be removed for 5D&BD exports.'
            : sp.code === 'CMU'
            ? 'CMU Core forces 0I insulation and 0OC spacing.'
            : `Core framing (${sm.label}) spaced at ${s.oc || 'N/A'}.`,
        });

        if (!isAg && insParts[insIdx]) {
          const icCode = insParts[insIdx++];
          const insMeta = INSULATION_CODES.find((x) => x.code === icCode) || INSULATION_CODES[1];
          layers.push({
            id: `nm-ly-${idx++}`,
            name: `${insMeta.label} (${icCode})`,
            role: 'ThermalOrAir · Cavity Fill',
            inStudCavity: true,
            thicknessMm: Math.min(sp.mm, 64),
            width: 248,
            height: 184,
            depth: 16,
            color: insMeta.color,
            edgeColor: '#fbcfe8',
            opacity: 0.78,
            pattern: 'insulation',
            revitMaterial: `${insMeta.label} (${icCode})`,
            param: `Insulation = ${icCode}`,
            rule: insMeta.desc,
          });
        }
      });
    }

    // Side 2 (Interior / Finish 2 -> outermost)
    [s.int1, s.int2, s.int3].forEach((val, i) => pushBoardLayer(val, `Side 2 #${i + 1}`, i === 2 ? 'Finish2' : 'Substrate'));
  }

  if (layers.length === 0) {
    layers.push({
      id: 'nm-ly-empty',
      name: 'No layers configured',
      role: 'Preview Placeholder',
      thicknessMm: 25,
      width: 240,
      height: 180,
      depth: 18,
      color: '#94a3b8',
      edgeColor: '#cbd5e1',
      opacity: 0.5,
      pattern: 'solid',
      revitMaterial: 'Select a layer or stud',
      param: 'Add at least 1 layer or stud',
      rule: 'Configure Side 1, Stud, or Side 2 layers to preview 3D thickness.',
    });
  }

  const totalMm = layers.reduce((acc, l) => acc + (l.inStudCavity ? 0 : Number(l.thicknessMm) || 0), 0);
  const totalIn = (totalMm / 25.4).toFixed(2);

  return {
    id: `naming-live-${typeLabel}`,
    docId: 137,
    code: s.unicode || def.unicode,
    title: `${def.label}${s.tag && !s.byAssumption ? ` · Tag ${s.tag}` : ''}`,
    revitCategory: def.group.includes('Soffit') ? 'Ceilings / Soffit Walls' : 'Walls',
    revitType: typeLabel,
    fireRating: fireLabel,
    stc: s.insulation === 'AI' ? 'STC 45–55 (Acoustical)' : s.doubleStudMode ? 'STC 55+ (Double Stud)' : 'Standard',
    thickness: `${totalMm} mm (~${totalIn}")`,
    summary: `Live parametric 3D assembly built from 13-slot naming rule (${layers.length} layer${layers.length === 1 ? '' : 's'}).`,
    layers,
  };
}

export function batchAuditWallNames(rawText = '') {
  const lines = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const candidates = [];
  for (const line of lines) {
    // Support CSV/TSV pasted rows: pick the cell looking like a Revit Wall type (contains _)
    if (line.includes(',') || line.includes('\t')) {
      const sep = line.includes('\t') ? '\t' : ',';
      const cells = line.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
      const typeCell = cells.find((c) => /^[CС]\d{4}\./i.test(c) || c.includes('_'));
      if (typeCell && !/^unicode$|^type name$/i.test(typeCell)) {
        candidates.push(typeCell);
      }
    } else if (!/^#|^\/\//.test(line)) {
      candidates.push(line);
    }
  }

  return candidates.map((raw, idx) => ({
    rowNum: idx + 1,
    ...parseAndValidateWallName(raw),
  }));
}

export function batchAuditToCsv(results = []) {
  const escCsv = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
  const header = ['Row', 'Status', 'Original Type Name', 'Auto-Fixed Name', 'Issues'].join(',');
  const body = results.map((r) =>
    [
      r.rowNum,
      r.status.toUpperCase(),
      escCsv(r.raw),
      escCsv(r.autoFixed),
      escCsv(r.issues.map((i) => `[${i.level}] ${i.message}`).join(' | ')),
    ].join(',')
  );
  return [header, ...body].join('\n');
}

/**
 * Resolves concise queries about BIM short codes (CH, BI, 0I, AG, AR, CMU, GypsumLayer, etc.)
 * Used inside Edge AI & Search so short 2-char codes return authoritative standard rules.
 */
export function lookupNamingQuery(query = '') {
  const q = String(query || '').trim();
  if (!q) return null;
  const upperTokens = q
    .toUpperCase()
    .split(/[^A-Z0-9./]+/)
    .filter(Boolean);

  const hits = [];
  for (const entry of BIM_CODE_LOOKUP) {
    const c = entry.code.toUpperCase();
    const alt = (entry.alt || '').toUpperCase();
    const exactMatch = upperTokens.includes(c) || (alt && upperTokens.includes(alt));
    const looseMatch =
      !exactMatch &&
      q.length >= 3 &&
      (entry.meaning.toLowerCase().includes(q.toLowerCase()) || c.toLowerCase() === q.toLowerCase());
    if (exactMatch || looseMatch) {
      hits.push(entry);
    }
  }

  const isNamingTopic =
    hits.length > 0 ||
    /\b(wall naming|soffit naming|cmu|gypsumlayer|5d&bd|air gap|double stud|partitionwall|demising|shaftwall|furred|unicode)\b/i.test(q);

  if (!isNamingTopic) return null;

  const uniqueHits = hits.slice(0, 5);
  if (uniqueHits.length > 0) {
    return uniqueHits
      .map((h) => `${h.code}${h.alt ? ` (${h.alt})` : ''} [${h.kind}]: ${h.meaning}`)
      .join(' · ');
  }

  return 'Wall/Soffit 13-slot formula: <Unicode>_<PartitionType>_<FireRating>_<Ext1>_<Ext2>_<Ext3>_<Stud>_<Insulation>_<Int1>_<Int2>_<Int3>_<OC> - <Tag>. Use "0" for absent layers, "0S"/"0I"/"0OC" for lost parameters (CMU forces 0I & 0OC; C1010.90.05 GypsumLayer stops at Ext3).';
}
