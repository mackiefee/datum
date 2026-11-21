export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function wrapDeg(deg) {
  return ((((deg % 360) + 540) % 360) - 180);
}

/**
 * Compute adaptive visionOS cylindrical 3D Space carousel positions (preserving tuned presets & arc geometry).
 */
export function computeSpaceLayout(displayItems, vpWidth, vpHeight, isCompact) {
  const count = displayItems.length;
  let screenMaxRows;
  if (isCompact) {
    screenMaxRows = vpHeight >= 860 && vpWidth > 720 ? 3 : vpHeight >= 600 ? 2 : 1;
  } else if (vpHeight < 560) {
    screenMaxRows = 1;
  } else if (vpHeight < 740) {
    screenMaxRows = 2;
  } else if (vpHeight < 900) {
    screenMaxRows = 3;
  } else if (vpHeight < 1260 || vpWidth < 1400) {
    screenMaxRows = 4;
  } else {
    screenMaxRows = 5;
  }

  const countMaxRows =
    count <= 6 ? 1 : count <= 17 ? 2 : count <= 31 ? 3 : count <= 45 ? 4 : 5;
  const rows = Math.max(1, Math.min(screenMaxRows, countMaxRows));

  const cols = Math.max(1, Math.ceil(count / rows));
  const fullRing = cols >= 18;

  const presets = isCompact
    ? [
        { cardW: 260, cardH: 152, gapX: 16, gapY: 0, camDist: 415 },
        { cardW: 252, cardH: 150, gapX: 16, gapY: 14, camDist: 415 },
        { cardW: 244, cardH: 148, gapX: 15, gapY: 12, camDist: 425 },
        { cardW: 240, cardH: 146, gapX: 14, gapY: 11, camDist: 440 },
        { cardW: 236, cardH: 146, gapX: 14, gapY: 10, camDist: 465 },
      ]
    : [
        { cardW: 324, cardH: 164, gapX: 24, gapY: 0, camDist: 420 },
        { cardW: 316, cardH: 162, gapX: 24, gapY: 18, camDist: 425 },
        { cardW: 304, cardH: 158, gapX: 22, gapY: 14, camDist: 440 },
        { cardW: 296, cardH: 154, gapX: 20, gapY: 13, camDist: 480 },
        { cardW: 290, cardH: 152, gapX: 19, gapY: 12, camDist: 525 },
      ];
  const { cardW, cardH, gapX, gapY, camDist } = presets[rows - 1];

  const effCols = fullRing ? cols : Math.max(cols, 18);
  const stepDeg = 360 / effCols;
  const arcSlot = cardW + gapX;
  const radius = Math.round(arcSlot / (2 * Math.sin(Math.PI / effCols)));
  const sceneZ = radius - camDist;

  const maxYawBound = fullRing
    ? Infinity
    : cols <= 1
    ? 0
    : Math.max(stepDeg * 0.5, ((cols - 1) * stepDeg) / 2 + 6);

  const colAngles = Array.from({ length: cols }, (_, c) => {
    const angle = fullRing ? c * stepDeg : (c - (cols - 1) / 2) * stepDeg;
    const norm = fullRing ? wrapDeg(angle) : angle;
    return { col: c, angle, abs: Math.abs(norm), sign: norm >= 0 ? 0 : 1 };
  });

  const colOrder = [...colAngles]
    .sort((a, b) => a.abs - b.abs || a.sign - b.sign)
    .map((x) => x.col);

  const rawSlots = displayItems.map((item, idx) => {
    const row = Math.floor(idx / cols);
    const col = colOrder[idx % cols];
    return { id: item.id, col, row };
  });
  const positions = rawSlots.map((s) => {
    const angle = colAngles[s.col].angle;
    const y = (s.row - (rows - 1) / 2) * (cardH + gapY);
    return { id: s.id, col: s.col, row: s.row, angle, y };
  });

  return {
    mode: 'space',
    rows,
    cols,
    fullRing,
    cardW,
    cardH,
    gapY,
    stepDeg,
    radius,
    sceneZ,
    maxYawBound,
    colAngles,
    positions,
  };
}
