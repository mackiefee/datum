// Pure schema definitions, code dictionaries, CSV parser & rulebook for BIM Element Naming Conventions
// Web Standard & Next.js Edge Runtime safe (no DOM/window/localStorage references).

export const WALL_SLOTS = [
  { num: 1, key: 'unicode', label: 'Unicode', desc: 'Uniformat classification (e.g. C1010.10.01)' },
  { num: 2, key: 'partitionType', label: 'Partition Type', desc: 'Assembly category mapped to Unicode' },
  { num: 3, key: 'fireRating', label: 'Fire Rating', desc: 'HR / NR / SR (combine as 2HR/SR)' },
  { num: 4, key: 'ext1', label: 'Side 1 · 1st', desc: 'Outer layer 1 thickness + material or 0' },
  { num: 5, key: 'ext2', label: 'Side 1 · 2nd', desc: 'Outer layer 2 thickness + material or 0' },
  { num: 6, key: 'ext3', label: 'Side 1 · 3rd', desc: 'Outer layer 3 (innermost on Side 1) or 0' },
  { num: 7, key: 'stud', label: 'Stud / Core', desc: 'Stud size + type, composite /, or Air Gap (AG)' },
  { num: 8, key: 'insulation', label: 'Insulation', desc: 'BI / AI / FI / 0I (CMU must use 0I)' },
  { num: 9, key: 'int1', label: 'Side 2 · 1st', desc: 'Innermost Side 2 layer or 0' },
  { num: 10, key: 'int2', label: 'Side 2 · 2nd', desc: 'Middle Side 2 layer or 0' },
  { num: 11, key: 'int3', label: 'Side 2 · 3rd', desc: 'Outermost Side 2 layer or 0' },
  { num: 12, key: 'oc', label: 'O.C.', desc: 'Stud spacing (16OC, 24OC, 0OC for CMU)' },
  { num: 13, key: 'tag', label: 'Tag per DD', desc: 'Wall tag (+ Smoke/note), omit if by assumption' },
];

export const WALL_TYPES = [
  { unicode: 'C1010.10.01', type: 'PartitionWall', group: 'Metal / Wood Stud Walls', label: 'Partition Wall', aliases: ['partitionwall', 'partition'] },
  { unicode: 'C1010.10.02', type: 'DemisingWall', group: 'Metal / Wood Stud Walls', label: 'Demising Wall', aliases: ['demisingwall', 'demising'] },
  { unicode: 'C1010.10.03', type: 'ShaftWall', group: 'Metal Stud Walls', label: 'Shaft Wall', aliases: ['shaftwall', 'shaft'] },
  { unicode: 'C1010.10.04', type: 'FurredWall', group: 'Metal Stud Walls', label: 'Furred Wall', aliases: ['furredwall', 'furred'] },
  { unicode: 'C1010.10.05', type: 'DoubleStudWall', group: 'Metal / Wood Stud Walls', label: 'Double Stud Wall', aliases: ['doublestudwall', 'doublestud'] },
  { unicode: 'C1010.10.06', type: 'CMUWall', group: 'Masonry (CMU)', label: 'CMU Wall', aliases: ['cmuwall', 'cmu'] },
  { unicode: 'C1070.20.03', type: 'GWBSoffitWall', group: 'Soffits', label: 'GWB Soffit Wall', aliases: ['gwbsoffitwall', 'interiorgwbsoffits', 'gwbsoffit'] },
  { unicode: 'C1070.20.04', type: 'PlasterSoffitWall', group: 'Soffits', label: 'Plaster Soffit Wall', aliases: ['plastersoffitwall', 'plastersoffit'] },
  { unicode: 'C1010.90.05', type: 'GypsumLayer', group: 'Additional Layer', label: 'Gypsum Layer (Short 6-slot)', shortFormat: true, aliases: ['gypsumlayer'] },
];

export const FIRE_RATINGS = [
  { code: 'NR', label: 'Non Rated', desc: 'Unrated partition assembly' },
  { code: '1/2HR', label: '1/2 Hour Rated', desc: '30-minute fire barrier / partition' },
  { code: '1HR', label: '1 Hour', desc: 'Standard 1-HR fire partition or corridor' },
  { code: '1-1/2HR', label: '1-1/2 Hour Rated', desc: '90-minute assembly' },
  { code: '2HR', label: '2 Hour', desc: '2-HR fire barrier, shaft or demising' },
  { code: '3HR', label: '3 Hour', desc: '3-HR fire wall' },
  { code: '4HR', label: '4 Hour', desc: '4-HR fire wall' },
  { code: 'SR', label: 'Smoke Resistant', desc: 'Combine after HR as 2HR/SR when dual-rated' },
];

export const LAYER_THICKNESSES = ['0', '3/8', '1/2', '5/8', '3/4', '7/8', '1'];

export const LAYER_CODES = [
  { code: '0', label: 'None (0)', desc: 'Use "0" symbol for empty/lost layer slots', color: '#8e8e93' },
  { code: 'G', label: 'GWB', desc: 'Gypsum Wall Board (Regular / Type X / Type C)', color: '#d8dee9' },
  { code: 'T', label: 'Tile Backer', desc: 'Moisture/tile backer board', color: '#93c5fd' },
  { code: 'GL', label: 'Gypsum Liner', desc: '1" or 5/8" shaftwall liner panel', color: '#4ade80' },
  { code: 'P', label: 'Plywood', desc: 'Structural / backing plywood sheathing', color: '#d4a373' },
  { code: 'M', label: 'Moisture Resistant GWB', desc: 'MR / greenboard for wet zones', color: '#2dd4bf' },
  { code: 'C', label: 'Cement Board', desc: 'Cementitious tile/wet-area board', color: '#94a3b8' },
  { code: 'O', label: 'OSB Panel Board', desc: 'Oriented Strand Board panel', color: '#e9c46a' },
  { code: 'AR', label: 'Abuse Resistant GWB', desc: 'High-impact / corridor abuse-resistant GWB', color: '#f59e0b' },
  { code: 'PL', label: 'Plaster Layer', desc: 'Traditional plaster finish layer', color: '#cbd5e1' },
];

export const STUD_CODES = [
  { code: 'S', label: 'Metal Frame Stud', desc: 'Light-gauge steel C-stud (e.g. 3-5/8S, 6S)', pattern: 'studs', color: '#64748b', defaultSizes: ['1-5/8', '2-1/2', '3-5/8', '4', '6', '8'] },
  { code: 'W', label: 'Wood Frame Stud', desc: 'Dimensional lumber stud (e.g. 2x4W, 2x6W)', pattern: 'studs', color: '#b47b44', defaultSizes: ['2x4', '2x6', '2x8'] },
  { code: 'F', label: 'U Furring', desc: 'Hat / U-shaped furring channel (e.g. 7/8F)', pattern: 'channel', color: '#78909c', defaultSizes: ['7/8', '1-1/2'] },
  { code: 'Z', label: 'Z Furring', desc: 'Z-furring bar over CMU/concrete', pattern: 'channel', color: '#607d8b', defaultSizes: ['1', '1-1/2', '2'] },
  { code: 'R', label: 'Resilient Channel', desc: 'Acoustic resilient isolation channel (e.g. 1/2R)', pattern: 'channel', color: '#38bdf8', defaultSizes: ['1/2'] },
  { code: 'CH', label: 'CH Stud', desc: 'C-H shaft wall stud for gypsum liner (e.g. 4CH)', pattern: 'studs', color: '#475569', defaultSizes: ['2-1/2', '4', '6'] },
  { code: 'CMU', label: 'Concrete Masonry Unit', desc: 'Nominal CMU block (7-5/8CMU); requires 0I and 0OC', pattern: 'solid', color: '#7c8594', defaultSizes: ['5-5/8', '7-5/8', '11-5/8'] },
  { code: 'AG', label: 'Air Gap (between studs)', desc: 'Placed between double studs: 2-1/2S/1AG/2-1/2S; removed for 5D&BD', pattern: 'solid', color: '#38bdf8', defaultSizes: ['1', '1-1/2', '2'] },
  { code: '0S', label: 'None (0S)', desc: 'Use 0S for lost stud parameter (soffit/demising/furred without stud)', pattern: 'solid', color: '#94a3b8', defaultSizes: ['0'] },
];

export const INSULATION_CODES = [
  { code: '0I', label: 'No Insulation', desc: 'Required on CMU walls and uninsulated partitions', color: '#94a3b8' },
  { code: 'BI', label: 'Batts and Rolls / Blanket', desc: 'Thermal/fiberglass batt insulation (BI or BI/BI)', color: '#f9a8d4' },
  { code: 'AI', label: 'Acoustical Insulation', desc: 'Mineral wool / sound attenuation blanket (AI or AI/AI)', color: '#fda4af' },
  { code: 'FI', label: 'Foam Insulation', desc: 'Rigid or spray foam insulation (FI)', color: '#fcd34d' },
];

export const OC_CODES = [
  { code: '16OC', label: '16" O.C.', desc: 'Standard 16 inch on-center stud spacing' },
  { code: '24OC', label: '24" O.C.', desc: '24 inch on-center stud/furring spacing' },
  { code: '12OC', label: '12" O.C.', desc: 'Heavy-load 12 inch on-center spacing' },
  { code: '16OC/24OC', label: '16OC / 24OC', desc: 'Mixed spacing across double studs' },
  { code: '16OC/16OC', label: '16OC / 16OC', desc: 'Matched spacing on both double stud lines' },
  { code: '0OC', label: '0OC (None)', desc: 'Required for CMU walls or lost O.C. parameter' },
];

export const WALL_NOTES = [
  { id: 'fire-dual', title: 'Dual Fire + Smoke Parameters', text: 'When a wall has both fire rating and smoke resistance, combine with a slash: 2HR/SR.' },
  { id: 'zero-layers', title: 'Lost Parameters Symbol', text: 'Use "0" for absent finish/substrate layers, "0S" for absent stud, "0I" for no insulation, and "0OC" for no stud spacing.' },
  { id: 'double-ag', title: 'Double Studs & Air Gap (AG)', text: 'Place Air Gaps between studs: e.g. 2-1/2S/1AG/2-1/2S. Use "/" for differing double studs (2x6W/3-1/2S) or insulations (BI/AI).' },
  { id: 'five-d-bd', title: '5D & BD Deliverables Rule', text: 'For 5D & BD models, the Air Gap parameter (/1AG/) MUST be removed from the stud slot.' },
  { id: 'cmu-rule', title: 'CMU Mandatory Suffixes', text: 'For C1010.10.06 CMUWall, always include Insulation = 0I and Spacing = 0OC.' },
  { id: 'tag-rule', title: 'DD Tag & By-Assumption Walls', text: 'If the wall tag is absent or wall is modeled by assumption, leave Tag per DD empty (no trailing " - "). Smoke notes can follow the tag (e.g. " - B6 Smoke").' },
  { id: 'short-layer', title: 'Additional Gypsum Layer (C1010.90.05)', text: 'GypsumLayer uses the short 6-slot formula stopping right after Side 1 · 3rd layer (no Stud, Insulation, Side 2, or O.C.).' },
];

// Audit discrepancies spotted in the original source CSV (helpful reference notes for BIM/PE engineers)
export const WALL_CSV_DISCREPANCIES = [
  { row: 'Row 18 & 87', issue: 'Cyrillic letter "С" (U+0421) instead of Latin "C" in С1010.90.05 and С1010.10.01 — breaks Revit schedules & filters.' },
  { row: 'Example 3 (Rows 62–63)', issue: 'Cells list Insulation = AI/AI and OC = 16OC, whereas the combined example string uses _AI_ and _16OC/16OC.' },
  { row: 'Example 5 (Rows 78–79)', issue: 'Unicode cell is blank, cell 6 shows 1/2PL while output uses 1/2P, BI/BI collapses to _BI_, and 16OC expands to 16OC/16OC.' },
  { row: 'Example 6 (Rows 93–95)', issue: 'Type cell says "InteriorGWB Soffits" (with space), whereas the rule table & final string require "GWBSoffitWall".' },
];

export const WALL_EXAMPLES = [
  {
    id: 'ex-1',
    label: 'Ex 1 · Metal Corridor 2HR/SR',
    expected: 'C1010.10.01_PartitionWall_2HR/SR_0_5/8G_5/8G_6S_AI_5/8G_5/8G_0_16OC - B6 Smoke',
    state: {
      unicode: 'C1010.10.01',
      partitionType: 'PartitionWall',
      fireRating: '2HR',
      smokeResistant: true,
      ext1: '0',
      ext2: '5/8G',
      ext3: '5/8G',
      doubleStudMode: false,
      stud1: '6S',
      airGap: '',
      stud2: '',
      fiveDBd: false,
      insulation: 'AI',
      insulation2: '',
      int1: '5/8G',
      int2: '5/8G',
      int3: '0',
      oc: '16OC',
      byAssumption: false,
      tag: 'B6',
      tagNote: 'Smoke',
    },
  },
  {
    id: 'ex-2',
    label: 'Ex 2 · CMU 1HR (0I / 0OC)',
    expected: 'C1010.10.06_CMUWall_1HR_0_0_0_7-5/8CMU_0I_0_0_0_0OC - 70B',
    state: {
      unicode: 'C1010.10.06',
      partitionType: 'CMUWall',
      fireRating: '1HR',
      smokeResistant: false,
      ext1: '0',
      ext2: '0',
      ext3: '0',
      doubleStudMode: false,
      stud1: '7-5/8CMU',
      airGap: '',
      stud2: '',
      fiveDBd: false,
      insulation: '0I',
      insulation2: '',
      int1: '0',
      int2: '0',
      int3: '0',
      oc: '0OC',
      byAssumption: false,
      tag: '70B',
      tagNote: '',
    },
  },
  {
    id: 'ex-3',
    label: 'Ex 3 · Double Stud + 1AG',
    expected: 'C1010.10.05_DoubleStudWall_1HR_0_5/8G_5/8G_2-1/2S/1AG/2-1/2S_AI_5/8G_5/8G_0_16OC/16OC - 1MG2',
    state: {
      unicode: 'C1010.10.05',
      partitionType: 'DoubleStudWall',
      fireRating: '1HR',
      smokeResistant: false,
      ext1: '0',
      ext2: '5/8G',
      ext3: '5/8G',
      doubleStudMode: true,
      stud1: '2-1/2S',
      airGap: '1AG',
      stud2: '2-1/2S',
      fiveDBd: false,
      insulation: 'AI',
      insulation2: '',
      int1: '5/8G',
      int2: '5/8G',
      int3: '0',
      oc: '16OC/16OC',
      byAssumption: false,
      tag: '1MG2',
      tagNote: '',
    },
  },
  {
    id: 'ex-4',
    label: 'Ex 4 · Demising Lost Stud (0S)',
    expected: 'C1010.10.02_DemisingWall_1HR_0_0_5/8G_0S_0I_0_0_0_0OC',
    state: {
      unicode: 'C1010.10.02',
      partitionType: 'DemisingWall',
      fireRating: '1HR',
      smokeResistant: false,
      ext1: '0',
      ext2: '0',
      ext3: '5/8G',
      doubleStudMode: false,
      stud1: '0S',
      airGap: '',
      stud2: '',
      fiveDBd: false,
      insulation: '0I',
      insulation2: '',
      int1: '0',
      int2: '0',
      int3: '0',
      oc: '0OC',
      byAssumption: true,
      tag: '',
      tagNote: '',
    },
  },
  {
    id: 'ex-5',
    label: 'Ex 5 · Wood Double Stud 2HR',
    expected: 'C1010.10.05_DoubleStudWall_2HR_5/8G_5/8G_1/2PL_2x4W/1AG/2x4W_BI_5/8G_5/8G_0_16OC/16OC - 29',
    state: {
      unicode: 'C1010.10.05',
      partitionType: 'DoubleStudWall',
      fireRating: '2HR',
      smokeResistant: false,
      ext1: '5/8G',
      ext2: '5/8G',
      ext3: '1/2PL',
      doubleStudMode: true,
      stud1: '2x4W',
      airGap: '1AG',
      stud2: '2x4W',
      fiveDBd: false,
      insulation: 'BI',
      insulation2: '',
      int1: '5/8G',
      int2: '5/8G',
      int3: '0',
      oc: '16OC/16OC',
      byAssumption: false,
      tag: '29',
      tagNote: '',
    },
  },
  {
    id: 'ex-6',
    label: 'Ex 5b · Wood Single 2x6',
    expected: 'C1010.10.01_PartitionWall_NR_0_0_5/8G_2x6W_BI_5/8G_0_0_16OC - 23',
    state: {
      unicode: 'C1010.10.01',
      partitionType: 'PartitionWall',
      fireRating: 'NR',
      smokeResistant: false,
      ext1: '0',
      ext2: '0',
      ext3: '5/8G',
      doubleStudMode: false,
      stud1: '2x6W',
      airGap: '',
      stud2: '',
      fiveDBd: false,
      insulation: 'BI',
      insulation2: '',
      int1: '5/8G',
      int2: '0',
      int3: '0',
      oc: '16OC',
      byAssumption: false,
      tag: '23',
      tagNote: '',
    },
  },
  {
    id: 'ex-7',
    label: 'Ex 6 · GWB Soffit Wall',
    expected: 'C1070.20.03_GWBSoffitWall_NR_0_0_5/8G_3-5/8S_0I_0_0_0_16OC',
    state: {
      unicode: 'C1070.20.03',
      partitionType: 'GWBSoffitWall',
      fireRating: 'NR',
      smokeResistant: false,
      ext1: '0',
      ext2: '0',
      ext3: '5/8G',
      doubleStudMode: false,
      stud1: '3-5/8S',
      airGap: '',
      stud2: '',
      fiveDBd: false,
      insulation: '0I',
      insulation2: '',
      int1: '0',
      int2: '0',
      int3: '0',
      oc: '16OC',
      byAssumption: true,
      tag: '',
      tagNote: '',
    },
  },
  {
    id: 'ex-8',
    label: 'Ex 7 · Gypsum Layer (Short)',
    expected: 'C1010.90.05_GypsumLayer_2HR_0_5/8G_5/8G',
    state: {
      unicode: 'C1010.90.05',
      partitionType: 'GypsumLayer',
      fireRating: '2HR',
      smokeResistant: false,
      ext1: '0',
      ext2: '5/8G',
      ext3: '5/8G',
      doubleStudMode: false,
      stud1: '0S',
      airGap: '',
      stud2: '',
      fiveDBd: false,
      insulation: '0I',
      insulation2: '',
      int1: '0',
      int2: '0',
      int3: '0',
      oc: '0OC',
      byAssumption: true,
      tag: '',
      tagNote: '',
    },
  },
];

// Built-in extensible registry so future CSV standards (Doors, Ceilings, Materials) register cleanly
export const BUILTIN_NAMING_SCHEMAS = [
  {
    id: 'walls-soffits',
    name: 'Wall & Soffit Naming',
    category: 'Walls & Soffits',
    docId: 137,
    delimiter: '_',
    slotCount: 13,
    slots: WALL_SLOTS,
    builtInEngine: 'walls',
    version: 'C1010 / C1070 v1',
    description: '13-slot Interior PE naming standard for Metal, Wood, CMU, Double Stud, Shaft, Furred, Soffit & Gypsum Layer assemblies.',
  },
];

// Short BIM code lookup table so 2-character tokens (CH, BI, 0I, AG, AR, PL, etc.) are searchable across Datum AI & Search
export const BIM_CODE_LOOKUP = [
  ...WALL_TYPES.map((t) => ({ code: t.unicode, alt: t.type, kind: 'Partition / Unicode', meaning: `${t.label} (${t.group})${t.shortFormat ? ' — uses short 6-slot format stopping at 3rd layer' : ''}` })),
  ...LAYER_CODES.filter((c) => c.code !== '0').map((c) => ({ code: c.code, kind: 'Layer Material Code', meaning: `${c.label} — ${c.desc}` })),
  ...STUD_CODES.map((c) => ({ code: c.code, kind: 'Stud / Core Code', meaning: `${c.label} — ${c.desc}` })),
  ...INSULATION_CODES.map((c) => ({ code: c.code, kind: 'Insulation Code', meaning: `${c.label} — ${c.desc}` })),
  ...FIRE_RATINGS.map((c) => ({ code: c.code, kind: 'Fire Rating Code', meaning: `${c.label} — ${c.desc}` })),
  ...OC_CODES.map((c) => ({ code: c.code, kind: 'Stud Spacing (O.C.)', meaning: `${c.label} — ${c.desc}` })),
];

/**
 * RFC-4180 compliant CSV parser handling quoted multiline cells.
 */
export function parseCsvRows(text = '') {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/**
 * Parses a Naming Convention CSV (like P_U_Interior_Naming...Wall Naming.csv or future Doors/Ceilings/Materials CSVs)
 * into a structured schema spec + extracted legends + examples + candidate type strings.
 */
export function importNamingSchemaFromCsv(csvText, fileName = 'Custom Naming Standard.csv') {
  const rows = parseCsvRows(csvText);
  if (!rows.length) return null;

  const titleRow = rows[0].find((c) => c.length > 2) || fileName.replace(/\.csv$/i, '');
  let slotNumbersRow = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const nums = rows[i].filter((c) => /^\d{1,2}$/.test(c));
    if (nums.length >= 4) {
      slotNumbersRow = i;
      break;
    }
  }

  const slots = [];
  const headerRow = slotNumbersRow >= 0 && rows[slotNumbersRow + 1] ? rows[slotNumbersRow + 1] : rows[0];
  const numberRow = slotNumbersRow >= 0 ? rows[slotNumbersRow] : [];
  const colCount = Math.max(headerRow.length, numberRow.length);

  for (let c = 0; c < colCount; c++) {
    const num = numberRow[c] && /^\d{1,2}$/.test(numberRow[c]) ? Number(numberRow[c]) : null;
    const lbl = (headerRow[c] || '').trim();
    if (num || (lbl && !/^wood|^metal|^soffit/i.test(lbl))) {
      slots.push({
        num: num || slots.length + 1,
        key: `slot_${c}`,
        label: lbl || `Slot ${num || c + 1}`,
        colIdx: c,
      });
    }
  }

  const codes = [];
  const notes = [];
  const examples = [];
  const typeCandidates = [];

  for (const r of rows) {
    for (const rawCell of r) {
      if (!rawCell) continue;
      // Legend definitions like "G = GWB" or "BI = Batts..."
      const legendMatch = rawCell.match(/^([A-Za-z0-9/\-]{1,12})\s*=\s*(.{2,90})$/);
      if (legendMatch && !rawCell.includes('_')) {
        const [, code, meaning] = legendMatch;
        if (!codes.some((x) => x.code === code && x.meaning === meaning)) {
          codes.push({ code: code.trim(), meaning: meaning.trim() });
        }
      }
      // Example / assembled BIM type strings containing underscore slots
      const lines = rawCell.split('\n').map((x) => x.trim()).filter(Boolean);
      for (const line of lines) {
        if (/^[CС]\d{4}\./i.test(line) && line.includes('_')) {
          if (!examples.includes(line)) examples.push(line);
          if (!typeCandidates.includes(line)) typeCandidates.push(line);
        } else if (line.length > 18 && /(case|note|should|remove|omit|gap|must|clarify|assumed|empty)/i.test(line) && !line.includes('_')) {
          if (!notes.includes(line)) notes.push(line);
        }
      }
    }
  }

  const slug = titleRow.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `schema-${Date.now()}`;
  return {
    id: `csv-${slug}`,
    name: titleRow,
    category: 'Imported CSV Spec',
    fileName,
    delimiter: '_',
    slotCount: slots.length || 13,
    slots: slots.length ? slots : WALL_SLOTS,
    codes,
    notes: notes.slice(0, 12),
    examples,
    typeCandidates,
    importedAt: new Date().toISOString().slice(0, 10),
  };
}
