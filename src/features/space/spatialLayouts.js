import { DC, DISC } from '../../config/constants.js';

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
  const bottomClear = hasOverlaySheet ? 348 : 156;
  const availH = Math.max(220, vpHeight - topClear - bottomClear);
  const totalH = rows * cardH + Math.max(0, rows - 1) * gapY;

  const minTopY = -vpHeight / 2 + topClear + cardH / 2;
  const centerMidY = (topClear - bottomClear) / 2;
  const startY =
    totalH <= availH
      ? centerMidY - totalH / 2 + cardH / 2
      : minTopY;

  const maxScrollY = Math.max(0, totalH - availH + 56);

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

const FLOW_STAGE_LABELS = [
  'Foundation',
  'Core Standards',
  'Specs & Assemblies',
  'Detailing & Guides',
  'QA & Deliverables',
];

function discOrderIndex(disc) {
  const idx = DISC.indexOf(disc || 'VDC');
  return idx >= 0 ? idx : DISC.length;
}

/**
 * Structured spatial graph layout for live tile cards.
 * Supports two clean, non-chaotic modes:
 * - 'flow': Left-to-right hierarchical dependency columns with crossing minimization
 * - 'clusters': Discipline/category grouped mini-grids with bounding frames
 */
export function computeGraphData(displayItems, options = {}) {
  const {
    includeSoft = true,
    includeOrphans = true,
    layoutMode = 'flow',
  } = options;
  const byId = new Map();
  displayItems.forEach((r) => byId.set(r.id, r));

  const edgeMap = new Map();
  displayItems.forEach((r) => {
    (r.links || []).forEach(([toId, rawKind]) => {
      if (!byId.has(toId) || toId === r.id) return;
      const targetDoc = byId.get(toId);
      const isPrivEdge = Boolean(r.isPrivate || (targetDoc && targetDoc.isPrivate));
      const kind = isPrivEdge ? 'private' : rawKind === 'hard' ? 'hard' : 'soft';
      if (kind === 'soft' && !includeSoft) return;
      const key = String(r.id) < String(toId) ? `${r.id}|${toId}` : `${toId}|${r.id}`;
      const existing = edgeMap.get(key);
      if (!existing) {
        edgeMap.set(key, {
          id: key,
          a: r.id,
          b: toId,
          from: r.id,
          to: toId,
          kind,
          isPrivate: isPrivEdge,
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

  const cardW = 238;
  const cardH = 112;

  const nodes = [];
  const clusters = [];

  if (layoutMode === 'clusters') {
    const groupsMap = new Map();
    activeItems.forEach((r) => {
      const d = r.disc || 'VDC';
      if (!groupsMap.has(d)) groupsMap.set(d, []);
      groupsMap.get(d).push(r);
    });

    const groups = [...groupsMap.entries()]
      .sort(([da, la], [db, lb]) => {
        const diff = discOrderIndex(da) - discOrderIndex(db);
        return diff !== 0 ? diff : lb.length - la.length;
      })
      .map(([disc, list]) => {
        const sorted = [...list].sort((a, b) => {
          const da = fullAdj.get(a.id)?.size || 0;
          const db = fullAdj.get(b.id)?.size || 0;
          return db - da || String(a.title || '').localeCompare(String(b.title || ''));
        });
        const colsInGrp = sorted.length <= 2 ? sorted.length : sorted.length <= 8 ? 2 : sorted.length <= 15 ? 3 : 4;
        const rowsInGrp = Math.ceil(sorted.length / Math.max(1, colsInGrp));
        const gapX = 18;
        const gapY = 18;
        const padX = 22;
        const padTop = 50;
        const padBottom = 22;
        const w = colsInGrp * cardW + Math.max(0, colsInGrp - 1) * gapX + padX * 2;
        const h = rowsInGrp * cardH + Math.max(0, rowsInGrp - 1) * gapY + padTop + padBottom;
        return { disc, items: sorted, colsInGrp, rowsInGrp, gapX, gapY, padX, padTop, w, h };
      });

    const topCount = groups.length <= 3 ? groups.length : Math.ceil(groups.length / 2);
    const rowBuckets = [groups.slice(0, topCount), groups.slice(topCount)].filter((row) => row.length > 0);
    const clusterGapX = 58;
    const clusterGapY = 62;

    let curY = 0;
    const rowMeta = rowBuckets.map((rowGrps) => {
      const totalW = rowGrps.reduce((sum, g) => sum + g.w, 0) + Math.max(0, rowGrps.length - 1) * clusterGapX;
      const maxH = rowGrps.reduce((mx, g) => Math.max(mx, g.h), 0);
      const yTop = curY;
      curY += maxH + clusterGapY;
      return { rowGrps, totalW, maxH, yTop };
    });

    rowMeta.forEach(({ rowGrps, totalW, yTop }) => {
      let curX = -totalW / 2;
      rowGrps.forEach((g) => {
        const gx = curX;
        const gy = yTop;
        clusters.push({
          id: `cluster-${g.disc}`,
          label: `${g.disc} · ${g.items.length}`,
          color: DC[g.disc] || '#2997ff',
          x: gx,
          y: gy,
          w: g.w,
          h: g.h,
        });
        g.items.forEach((r, idx) => {
          const c = idx % g.colsInGrp;
          const row = Math.floor(idx / g.colsInGrp);
          const nx = gx + g.padX + c * (cardW + g.gapX) + cardW / 2;
          const ny = gy + g.padTop + row * (cardH + g.gapY) + cardH / 2;
          nodes.push({
            id: r.id,
            disc: r.disc || 'VDC',
            deg: fullAdj.get(r.id)?.size || 0,
            x: nx,
            y: ny,
          });
        });
        curX += g.w + clusterGapX;
      });
    });
  } else {
    // Layered Hierarchical Flow (Left-to-Right DAG + barycenter crossing reduction)
    const connected = activeItems.filter((r) => (fullAdj.get(r.id)?.size || 0) > 0);
    const orphans = activeItems.filter((r) => (fullAdj.get(r.id)?.size || 0) === 0);

    const authMap = new Map();
    connected.forEach((r) => {
      const ins = inMap.get(r.id) || [];
      const outs = outMap.get(r.id) || [];
      const hardIn = ins.filter((x) => x.kind === 'hard').length;
      const totalIn = ins.length;
      const totalOut = outs.length;
      const rootBoost = r.id === 100 ? 14 : r.id <= 104 ? 4 : 0;
      authMap.set(r.id, hardIn * 3.5 + totalIn * 2.0 + rootBoost - totalOut * 0.25);
    });

    // Build acyclic directed edges from higher authority -> lower authority
    const dagChildren = new Map();
    const dagParents = new Map();
    connected.forEach((r) => {
      dagChildren.set(r.id, []);
      dagParents.set(r.id, []);
    });
    edges.forEach((e) => {
      if (!dagChildren.has(e.a) || !dagChildren.has(e.b)) return;
      const authA = authMap.get(e.a) || 0;
      const authB = authMap.get(e.b) || 0;
      const fromId = authA > authB || (authA === authB && String(e.a) < String(e.b)) ? e.a : e.b;
      const toId = fromId === e.a ? e.b : e.a;
      dagChildren.get(fromId).push(toId);
      dagParents.get(toId).push(fromId);
    });

    // Topological longest-path layer assignment
    const topoOrder = [...connected].sort(
      (a, b) => (authMap.get(b.id) || 0) - (authMap.get(a.id) || 0) || String(a.id).localeCompare(String(b.id))
    );
    const rawLayer = new Map();
    topoOrder.forEach((r) => {
      const parents = dagParents.get(r.id) || [];
      let lvl = 0;
      parents.forEach((pId) => {
        const pl = rawLayer.get(pId) || 0;
        if (pl + 1 > lvl) lvl = pl + 1;
      });
      rawLayer.set(r.id, lvl);
    });

    const maxRawLayer = Math.max(1, ...[...rawLayer.values(), 0]);
    const targetCols = connected.length <= 6 ? Math.min(3, Math.max(2, maxRawLayer + 1)) : connected.length <= 16 ? 4 : 5;
    const columns = Array.from({ length: targetCols }, () => []);

    if (connected.length > 0) {
      // Compress raw DAG levels cleanly across targetCols while keeping foundation nodes at col 0
      const ranked = [...connected].sort((a, b) => {
        const la = rawLayer.get(a.id) || 0;
        const lb = rawLayer.get(b.id) || 0;
        if (la !== lb) return la - lb;
        return (authMap.get(b.id) || 0) - (authMap.get(a.id) || 0);
      });

      const maxPerCol = Math.max(4, Math.ceil(connected.length / targetCols) + 1);
      ranked.forEach((r, idx) => {
        const rLvl = rawLayer.get(r.id) || 0;
        let cIdx =
          rLvl === 0
            ? 0
            : Math.min(targetCols - 1, Math.max(1, Math.round((rLvl / Math.max(1, maxRawLayer)) * (targetCols - 1))));
        // Keep columns balanced so no column grows too tall
        while (cIdx < targetCols - 1 && columns[cIdx].length >= maxPerCol) {
          cIdx++;
        }
        // Fallback if trailing column filled up
        if (columns[cIdx].length >= maxPerCol + 1) {
          let best = cIdx;
          for (let k = targetCols - 1; k >= 0; k--) {
            if (columns[k].length < columns[best].length) best = k;
          }
          cIdx = best;
        }
        columns[cIdx].push(r);
      });
    }

    const nonEmptyCols = columns.filter((c) => c.length > 0);
    // Initial discipline + degree sort per column
    nonEmptyCols.forEach((colItems) => {
      colItems.sort((a, b) => {
        const dd = discOrderIndex(a.disc) - discOrderIndex(b.disc);
        if (dd !== 0) return dd;
        const da = fullAdj.get(a.id)?.size || 0;
        const db = fullAdj.get(b.id)?.size || 0;
        return db - da || String(a.id).localeCompare(String(b.id));
      });
    });

    // Barycenter crossing reduction passes (left->right, right->left)
    const rowPosMap = new Map();
    const syncRowPos = () => {
      nonEmptyCols.forEach((colItems) => {
        colItems.forEach((r, rowIdx) => {
          rowPosMap.set(r.id, rowIdx - (colItems.length - 1) / 2);
        });
      });
    };
    syncRowPos();

    if (nonEmptyCols.length > 1) {
      for (let pass = 0; pass < 4; pass++) {
        const forward = pass % 2 === 0;
        const start = forward ? 1 : nonEmptyCols.length - 2;
        const end = forward ? nonEmptyCols.length : -1;
        const step = forward ? 1 : -1;
        for (let c = start; c !== end; c += step) {
          const colItems = nonEmptyCols[c];
          const neighborCol = nonEmptyCols[c - step];
          if (!colItems || !neighborCol) continue;
          const neighborColSet = new Set(neighborCol.map((x) => x.id));
          const scored = colItems.map((r, idx) => {
            const adj = fullAdj.get(r.id);
            let sum = 0;
            let cnt = 0;
            if (adj) {
              adj.forEach((nId) => {
                if (neighborColSet.has(nId) && rowPosMap.has(nId)) {
                  sum += rowPosMap.get(nId);
                  cnt++;
                }
              });
            }
            const origKey = idx - (colItems.length - 1) / 2;
            const bary = cnt > 0 ? sum / cnt : origKey;
            return { r, key: bary * 0.78 + origKey * 0.22 };
          });
          scored.sort((a, b) => a.key - b.key);
          nonEmptyCols[c] = scored.map((x) => x.r);
          syncRowPos();
        }
      }
    }

    const colPitchX = cardW + 96;
    const rowPitchY = cardH + 26;
    let maxFlowY = 0;

    nonEmptyCols.forEach((colItems, cIdx) => {
      const cx = (cIdx - (nonEmptyCols.length - 1) / 2) * colPitchX;
      const colH = colItems.length * cardH + Math.max(0, colItems.length - 1) * 26;
      const topY = -colH / 2 + cardH / 2;
      const stageLabel =
        cIdx === nonEmptyCols.length - 1 && nonEmptyCols.length > 2
          ? FLOW_STAGE_LABELS[4]
          : FLOW_STAGE_LABELS[Math.min(cIdx, FLOW_STAGE_LABELS.length - 1)];

      clusters.push({
        id: `flow-col-${cIdx}`,
        label: `${stageLabel} · ${colItems.length}`,
        color: null,
        x: cx - cardW / 2 - 14,
        y: -colH / 2 - 40,
        w: cardW + 28,
        h: colH + 54,
      });

      colItems.forEach((r, rIdx) => {
        const ny = topY + rIdx * rowPitchY;
        if (ny + cardH / 2 > maxFlowY) maxFlowY = ny + cardH / 2;
        nodes.push({
          id: r.id,
          disc: r.disc || 'VDC',
          deg: fullAdj.get(r.id)?.size || 0,
          x: cx,
          y: ny,
        });
      });
    });

    if (orphans.length > 0) {
      const sortedOrphans = [...orphans].sort((a, b) => {
        const dd = discOrderIndex(a.disc) - discOrderIndex(b.disc);
        return dd !== 0 ? dd : String(a.title || '').localeCompare(String(b.title || ''));
      });
      const oCols = Math.min(Math.max(4, nonEmptyCols.length), Math.max(1, sortedOrphans.length));
      const oRows = Math.ceil(sortedOrphans.length / oCols);
      const oGapX = 22;
      const oGapY = 20;
      const oW = oCols * cardW + Math.max(0, oCols - 1) * oGapX + 36;
      const oH = oRows * cardH + Math.max(0, oRows - 1) * oGapY + 62;
      const oTop = (nonEmptyCols.length > 0 ? maxFlowY + 84 : -oH / 2) + 42;

      clusters.push({
        id: 'flow-standalone',
        label: `Standalone Docs · ${sortedOrphans.length}`,
        color: null,
        x: -oW / 2,
        y: oTop - 42,
        w: oW,
        h: oH,
      });

      sortedOrphans.forEach((r, idx) => {
        const c = idx % oCols;
        const row = Math.floor(idx / oCols);
        const rowLen = Math.min(oCols, sortedOrphans.length - row * oCols);
        const rowW = rowLen * cardW + Math.max(0, rowLen - 1) * oGapX;
        const nx = -rowW / 2 + c * (cardW + oGapX) + cardW / 2;
        const ny = oTop + row * (cardH + oGapY) + cardH / 2;
        nodes.push({
          id: r.id,
          disc: r.disc || 'VDC',
          deg: 0,
          x: nx,
          y: ny,
        });
      });
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const simEdges = edges.map((e, ei) => ({
    ...e,
    s: nodeById.get(e.from),
    t: nodeById.get(e.to),
    curveSign: ei % 2 === 0 ? 1 : -1,
  }));

  // Center the entire bounding box cleanly
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    if (n.x - cardW / 2 < minX) minX = n.x - cardW / 2;
    if (n.x + cardW / 2 > maxX) maxX = n.x + cardW / 2;
    if (n.y - cardH / 2 < minY) minY = n.y - cardH / 2;
    if (n.y + cardH / 2 > maxY) maxY = n.y + cardH / 2;
  });
  clusters.forEach((c) => {
    if (c.x < minX) minX = c.x;
    if (c.x + c.w > maxX) maxX = c.x + c.w;
    if (c.y < minY) minY = c.y;
    if (c.y + c.h > maxY) maxY = c.y + c.h;
  });

  if (nodes.length > 0 && Number.isFinite(minX)) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    nodes.forEach((n) => {
      n.x -= cx;
      n.y -= cy;
    });
    clusters.forEach((c) => {
      c.x -= cx;
      c.y -= cy;
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

  const worldW = Math.max(360, maxX - minX + 56);
  const worldH = Math.max(240, maxY - minY + 56);

  const fitCamera = (vpW, vpH, hasOverlaySheet, topOffset = 0) => {
    const topClear = (vpW <= 768 ? 64 : 74) + topOffset;
    const bottomClear = hasOverlaySheet ? 348 : 138;
    const availW = Math.max(320, vpW - 88);
    const availH = Math.max(220, vpH - topClear - bottomClear);
    const zoom = clamp(Math.min(availW / worldW, availH / worldH), 0.34, 1.04);
    const panX = 0;
    const panY = (topClear - bottomClear) / 2;
    return { panX, panY, zoom };
  };

  return {
    mode: 'graph',
    layoutMode,
    cardW,
    cardH,
    nodes,
    nodeById,
    clusters,
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
 * Compute crisp Bezier edge + arrowhead between two graph cards.
 * Uses left-to-right orthogonal port curves in 'flow' mode and smart perimeter arcs otherwise.
 */
export function computeGraphEdgeSvg(
  ax,
  ay,
  hwA,
  hhA,
  bx,
  by,
  hwB,
  hhB,
  curveSign = 1,
  arrowSize = 6.5,
  layoutMode = 'flow'
) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) return null;

  if (layoutMode === 'flow') {
    const colGap = hwA + hwB + 14;
    if (dx > colGap) {
      // Standard left-to-right flow curve
      const sx = ax + hwA;
      const sy = ay;
      const tx = bx - hwB;
      const ty = by;
      const span = Math.max(36, Math.min(130, (tx - sx) * 0.46));
      const cx1 = sx + span;
      const cx2 = tx - span;
      const pathD = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${sy.toFixed(1)}, ${cx2.toFixed(1)} ${ty.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      const adx = tx - cx2;
      const ady = ty - ty;
      const alen = Math.hypot(adx, ady) || 1;
      const aux = adx / alen;
      const auy = ady / alen;
      const p1x = tx - aux * arrowSize + auy * (arrowSize * 0.56);
      const p1y = ty - auy * arrowSize - aux * (arrowSize * 0.56);
      const p2x = tx - aux * arrowSize - auy * (arrowSize * 0.56);
      const p2y = ty - auy * arrowSize + aux * (arrowSize * 0.56);
      return {
        pathD,
        arrowPoints: `${tx.toFixed(1)},${ty.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`,
      };
    }
    if (dx < -colGap) {
      // Reverse dependency right-to-left curve
      const sx = ax - hwA;
      const sy = ay;
      const tx = bx + hwB;
      const ty = by;
      const span = Math.max(36, Math.min(130, (sx - tx) * 0.46));
      const cx1 = sx - span;
      const cx2 = tx + span;
      const pathD = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx1.toFixed(1)} ${sy.toFixed(1)}, ${cx2.toFixed(1)} ${ty.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;
      const p1x = tx + arrowSize;
      const p1y = ty - arrowSize * 0.56;
      const p2x = tx + arrowSize;
      const p2y = ty + arrowSize * 0.56;
      return {
        pathD,
        arrowPoints: `${tx.toFixed(1)},${ty.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`,
      };
    }
    // Same-column connection: route gently around the side gutter
    const sideSign = curveSign >= 0 ? 1 : -1;
    const sx = ax + hwA * sideSign;
    const sy = ay;
    const tx = bx + hwB * sideSign;
    const ty = by;
    const gutter = clamp(Math.abs(dy) * 0.24, 34, 88) * sideSign;
    const cx = Math.max(sx, tx) * (sideSign > 0 ? 1 : 0) + Math.min(sx, tx) * (sideSign < 0 ? 1 : 0) + gutter;
    const pathD = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${cx.toFixed(1)} ${sy.toFixed(1)}, ${cx.toFixed(1)} ${ty.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`;
    const aux = -sideSign;
    const p1x = tx - aux * arrowSize;
    const p1y = ty - arrowSize * 0.56;
    const p2x = tx - aux * arrowSize;
    const p2y = ty + arrowSize * 0.56;
    return {
      pathD,
      arrowPoints: `${tx.toFixed(1)},${ty.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`,
    };
  }

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
