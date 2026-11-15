import { DISC } from '../../config/constants.js';

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

/**
 * Compute flat non-rotated 2D Grid coordinates inside the unified stage.
 */
export function computeGridLayout(displayItems, vpWidth, vpHeight, hasOverlaySheet, topOffset = 0) {
  const n = displayItems.length;
  const cardW = vpWidth <= 680 ? 256 : 292;
  const cardH = vpWidth <= 680 ? 142 : 152;
  const gapX = vpWidth <= 680 ? 12 : 16;
  const gapY = vpWidth <= 680 ? 12 : 16;

  const availW = Math.min(1260, Math.max(280, vpWidth - (vpWidth <= 768 ? 36 : 72)));
  const cols = clamp(Math.floor((availW + gapX) / (cardW + gapX)), 1, 4);
  const rows = Math.max(1, Math.ceil(n / cols));

  const topClear = (vpWidth <= 768 ? 64 : 74) + topOffset;
  const bottomClear = hasOverlaySheet ? 348 : 132;
  const availH = Math.max(220, vpHeight - topClear - bottomClear);
  const totalH = rows * cardH + Math.max(0, rows - 1) * gapY;

  const minTopY = -vpHeight / 2 + topClear + cardH / 2;
  const centerMidY = (topClear - bottomClear) / 2;
  const startY =
    totalH <= availH
      ? centerMidY - totalH / 2 + cardH / 2
      : minTopY;

  const maxScrollY = Math.max(0, totalH - availH + 12);

  const positions = displayItems.map((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    return { id: item.id, col, row, x, y };
  });

  return {
    mode: 'grid',
    cols,
    rows,
    cardW,
    cardH,
    gapX,
    gapY,
    topClear,
    bottomClear,
    totalH,
    availH,
    maxScrollY,
    positions,
  };
}

/**
 * Deterministic force-directed spatial graph layout for live tile cards.
 */
export function computeGraphData(displayItems, options = {}) {
  const { includeSoft = true, includeOrphans = true, discFocus = '' } = options;
  const byId = new Map();
  displayItems.forEach((r) => byId.set(r.id, r));

  const edgeMap = new Map();
  displayItems.forEach((r) => {
    (r.links || []).forEach(([toId, rawKind]) => {
      if (!byId.has(toId) || toId === r.id) return;
      const kind = rawKind === 'hard' ? 'hard' : 'soft';
      if (kind === 'soft' && !includeSoft) return;
      const key = r.id < toId ? `${r.id}|${toId}` : `${toId}|${r.id}`;
      const existing = edgeMap.get(key);
      if (!existing) {
        edgeMap.set(key, {
          id: key,
          a: r.id,
          b: toId,
          from: r.id,
          to: toId,
          kind,
          both: false,
        });
      } else if (kind === 'hard' && existing.kind === 'soft') {
        existing.kind = 'hard';
        existing.from = r.id;
        existing.to = toId;
      } else if (kind === 'hard' && existing.kind === 'hard' && existing.from !== r.id) {
        existing.both = true;
      }
    });
  });

  let edges = [...edgeMap.values()];
  const fullAdj = new Map();
  const outMap = new Map();
  const inMap = new Map();
  edges.forEach((e) => {
    if (!fullAdj.has(e.a)) fullAdj.set(e.a, new Set());
    if (!fullAdj.has(e.b)) fullAdj.set(e.b, new Set());
    fullAdj.get(e.a).add(e.b);
    fullAdj.get(e.b).add(e.a);

    if (!outMap.has(e.from)) outMap.set(e.from, []);
    outMap.get(e.from).push({ id: e.to, kind: e.kind });
    if (!inMap.has(e.to)) inMap.set(e.to, []);
    inMap.get(e.to).push({ id: e.from, kind: e.kind });
    if (e.both) {
      if (!outMap.has(e.to)) outMap.set(e.to, []);
      outMap.get(e.to).push({ id: e.from, kind: e.kind });
      if (!inMap.has(e.from)) inMap.set(e.from, []);
      inMap.get(e.from).push({ id: e.to, kind: e.kind });
    }
  });

  const activeItems = includeOrphans
    ? displayItems
    : displayItems.filter((r) => (fullAdj.get(r.id)?.size || 0) > 0);
  const activeSet = new Set(activeItems.map((r) => r.id));
  edges = edges.filter((e) => activeSet.has(e.a) && activeSet.has(e.b));

  const cardW = 228;
  const cardH = 92;
  const minSepW = 266;
  const minSepH = 122;

  const discAngles = new Map();
  DISC.forEach((d, idx) => {
    discAngles.set(d, (idx / Math.max(1, DISC.length)) * Math.PI * 2 - Math.PI / 2);
  });

  const nodes = activeItems.map((r, idx) => {
    const deg = fullAdj.get(r.id)?.size || 0;
    const baseAngle = discAngles.has(r.disc) ? discAngles.get(r.disc) : idx * 2.399963;
    const jitterAngle = baseAngle + ((idx % 7) - 3) * 0.24 + idx * 0.17;
    const ring = deg > 0 ? Math.max(120, 440 - Math.sqrt(deg) * 95 + (idx % 5) * 42) : 640 + (idx % 6) * 58;
    return {
      id: r.id,
      disc: r.disc || 'VDC',
      deg,
      x: Math.cos(jitterAngle) * ring,
      y: Math.sin(jitterAngle) * ring * 0.78,
      vx: 0,
      vy: 0,
    };
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const simEdges = edges.map((e, ei) => ({
    ...e,
    s: nodeById.get(e.from),
    t: nodeById.get(e.to),
    curveSign: ei % 2 === 0 ? 1 : -1,
  }));

  // Warm-start deterministic force simulation (~220 steps)
  const steps = Math.min(240, Math.max(110, 90 + nodes.length * 3));
  for (let step = 0; step < steps; step++) {
    const alpha = Math.max(0.06, 1 - step / steps);
    const idealLen = 295;

    for (const e of simEdges) {
      const s = e.s;
      const t = e.t;
      if (!s || !t) continue;
      let dx = t.x - s.x;
      let dy = t.y - s.y;
      const dist = Math.hypot(dx, dy) || 1e-4;
      const pull = ((dist - idealLen) / dist) * alpha * (e.kind === 'hard' ? 0.34 : 0.2);
      dx *= pull;
      dy *= pull;
      const bias = (s.deg + 1) / (s.deg + t.deg + 2);
      t.vx -= dx * bias;
      t.vy -= dy * bias;
      s.vx += dx * (1 - bias);
      s.vy += dy * (1 - bias);
    }

    for (let i = 0; i < nodes.length; i++) {
      const A = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const B = nodes[j];
        let dx = B.x - A.x;
        let dy = B.y - A.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = (j - i) * 0.7 || 0.5;
          dy = 0.5;
          d2 = dx * dx + dy * dy + 0.1;
        }
        if (d2 < 460000) {
          const sameDisc = A.disc === B.disc;
          const rep = (sameDisc ? 9500 : 14500) * alpha / d2;
          A.vx -= dx * rep;
          A.vy -= dy * rep;
          B.vx += dx * rep;
          B.vy += dy * rep;
        }
        // Strict card bounding-box separation so node tiles never overlap
        const ox = minSepW - Math.abs(dx);
        const oy = minSepH - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox * 0.55 < oy) {
            const pushX = ox * 0.28 * (dx < 0 ? -1 : 1);
            A.vx -= pushX;
            B.vx += pushX;
          } else {
            const pushY = oy * 0.28 * (dy < 0 ? -1 : 1);
            A.vy -= pushY;
            B.vy += pushY;
          }
        }
      }
    }

    for (const n of nodes) {
      const grav = n.deg > 0 ? 0.045 : 0.03;
      const discCenter = discFocus && n.disc === discFocus ? 0.08 : grav;
      n.vx -= n.x * discCenter * alpha * 0.7;
      n.vy -= n.y * discCenter * alpha * 1.05;
      n.vx *= 0.58;
      n.vy *= 0.58;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  // Final overlap-free pass & centering
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  });

  if (nodes.length > 0 && Number.isFinite(minX)) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    nodes.forEach((n) => {
      n.x -= cx;
      n.y -= cy;
    });
    minX -= cx;
    maxX -= cx;
    minY -= cy;
    maxY -= cy;
  } else {
    minX = -200;
    maxX = 200;
    minY = -120;
    maxY = 120;
  }

  const worldW = Math.max(320, maxX - minX + cardW + 40);
  const worldH = Math.max(220, maxY - minY + cardH + 40);

  const fitCamera = (vpW, vpH, hasOverlaySheet, topOffset = 0) => {
    const topClear = (vpW <= 768 ? 64 : 74) + topOffset;
    const bottomClear = hasOverlaySheet ? 348 : 138;
    const availW = Math.max(320, vpW - 88);
    const availH = Math.max(220, vpH - topClear - bottomClear);
    const zoom = clamp(Math.min(availW / worldW, availH / worldH), 0.36, 1.06);
    const panX = 0;
    const panY = (topClear - bottomClear) / 2;
    return { panX, panY, zoom };
  };

  return {
    mode: 'graph',
    cardW,
    cardH,
    nodes,
    nodeById,
    activeSet,
    edges: simEdges,
    adjMap: fullAdj,
    outMap,
    inMap,
    worldW,
    worldH,
    fitCamera,
  };
}

/**
 * Compute smooth quadratic Bezier edge + edge-intersected arrowhead between two cards.
 */
export function computeGraphEdgeSvg(ax, ay, hwA, hhA, bx, by, hwB, hhB, curveSign = 1, arrowSize = 6.5) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) return null;

  const ux = dx / dist;
  const uy = dy / dist;

  // Clip line start/end to outer rectangle border of cards A & B
  const tA = Math.min(hwA / Math.max(0.01, Math.abs(dx)), hhA / Math.max(0.01, Math.abs(dy)), 0.44);
  const tB = Math.min(hwB / Math.max(0.01, Math.abs(dx)), hhB / Math.max(0.01, Math.abs(dy)), 0.44);

  const sx = ax + dx * tA;
  const sy = ay + dy * tA;
  const tx = bx - dx * tB;
  const ty = by - dy * tB;

  if (Math.hypot(tx - sx, ty - sy) < 6) return null;

  const nx = -uy;
  const ny = ux;
  const bend = Math.min(34, dist * 0.11) * curveSign;
  const cx = (sx + tx) / 2 + nx * bend;
  const cy = (sy + ty) / 2 + ny * bend;

  const pathD = `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`;

  // Arrowhead tangent at end t=1 points along (tx - cx, ty - cy)
  const adx = tx - cx;
  const ady = ty - cy;
  const alen = Math.hypot(adx, ady) || 1;
  const aux = adx / alen;
  const auy = ady / alen;
  const p1x = tx - aux * arrowSize + auy * (arrowSize * 0.56);
  const p1y = ty - auy * arrowSize - aux * (arrowSize * 0.56);
  const p2x = tx - aux * arrowSize - auy * (arrowSize * 0.56);
  const p2y = ty - auy * arrowSize + aux * (arrowSize * 0.56);

  const arrowPoints = `${tx.toFixed(1)},${ty.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`;
  return { pathD, arrowPoints };
}
