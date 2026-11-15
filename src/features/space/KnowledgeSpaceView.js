import { html, useEffect, useLayoutEffect, useMemo, useRef, useState } from '../../lib/react.js';
import { TODAY, DC, DISC, TY, CITE, can, normRole, isResType } from '../../config/constants.js';
import { byId, buildFlat } from '../../data/spaces.js';
import { fmt } from '../../utils/format.js';
import { hay } from '../../utils/search.js';
import { plain } from '../../utils/markdown.js';
import { edgeClient } from '../../lib/edgeClient.js';
import { Ic } from '../../components/Icon.js';
import { Pill, VisPill } from '../../components/Badge.js';

const PITCH_MAX = 4.5;
const ZOOM_MIN = -220;
const ZOOM_MAX = 240;

const AI_PROMPTS = [
  { label: 'Model naming', query: 'How should model files be named?' },
  { label: 'Clash detection', query: 'When is clash detection run?' },
  { label: 'BEP template', query: 'What is the BEP template?' },
];

const STOP_WORDS = new Set([
  'how', 'should', 'what', 'when', 'where', 'why', 'who', 'which', 'whom',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'the', 'and', 'for',
  'with', 'this', 'that', 'these', 'those', 'from', 'into', 'can', 'could',
  'would', 'does', 'did', 'has', 'have', 'had', 'not', 'but', 'our', 'your',
]);

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function wrapDeg(deg) {
  return ((((deg % 360) + 540) % 360) - 180);
}

function tokenizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function scoreItemForQuery(r, rawQuery, tokens) {
  const s = rawQuery.trim().toLowerCase();
  if (!s) return { score: 0, matched: 0 };

  const titleL = (r.title || '').toLowerCase();
  const descL = (r.desc || '').toLowerCase();
  const tagsL = (r.tags || []).join(' ').toLowerCase();
  const discL = (r.disc || '').toLowerCase();
  const hayL = hay(r);

  let score = 0;
  let matched = 0;

  if (titleL.includes(s)) score += 16;
  else if (hayL.includes(s)) score += 7;

  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    const stem = w.length >= 4 ? w.slice(0, w.length - 1) : w;
    let hit = false;

    if (titleL.includes(w)) {
      score += 7;
      hit = true;
    } else if (stem.length >= 3 && titleL.includes(stem)) {
      score += 4.5;
      hit = true;
    }

    if (tagsL.includes(w) || (stem.length >= 3 && tagsL.includes(stem))) {
      score += 5;
      hit = true;
    }
    if (discL.includes(w)) {
      score += 3.5;
      hit = true;
    }
    if (descL.includes(w) || (stem.length >= 3 && descL.includes(stem))) {
      score += 3;
      hit = true;
    }
    if (hayL.includes(w) || (stem.length >= 3 && hayL.includes(stem))) {
      score += 1.5;
      hit = true;
    }

    if (hit) matched++;
  }

  return { score, matched };
}

/**
 * Apple visionOS-inspired 360° Spatial Knowledge Space + Reactive AI Dock
 */
export function KnowledgeSpaceView({
  items = [],
  allItems = [],
  allCount = 0,
  pageTitle = 'Knowledge Space',
  curCat = null,
  tree = [],
  role = 'Member',
  userName = '',
  pinned = [],
  cols = [],
  aq = null,
  focusSignal = 0,
  catalogQ = '',
  onCatalogQChange,
  onOpenKit,
  onOpenAllKits,
  favs = [],
  watch = [],
  onToggleFav,
  onToggleWatch,
  onRead,
  onInspect,
  isGuest = false,
  hasFilters = false,
  onResetFilters,
  f = {},
  setF,
  toolbarRight = null,
  active = true,
  cmdOpen = false,
  onSetCmdOpen,
  recentSearches = [],
  onLogSearch,
  onCommand,
  kb = 'Ctrl K',
  omniRectRef = null,
}) {
  const viewportRef = useRef(null);
  const sceneRef = useRef(null);
  const cardRefs = useRef([]);
  const hoverLiftRef = useRef([]);
  const hoveredIdxRef = useRef(-1);
  const dotRefs = useRef([]);
  const hudColRef = useRef(null);
  const hudZoomRef = useRef(null);
  const resetBtnRef = useRef(null);
  const askInputRef = useRef(null);
  const askBarRef = useRef(null);
  const dockBarRef = useRef(null);
  const dockAnimRef = useRef(null);
  const wasActiveRef = useRef(Boolean(active));

  const [vpSize, setVpSize] = useState(() =>
    typeof window !== 'undefined'
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1280, h: 800 }
  );
  const vpWidth = vpSize.w;
  const vpHeight = vpSize.h;
  const [reducedMotion, setReducedMotion] = useState(false);

  const [spaceQuery, setSpaceQuery] = useState(() => catalogQ || '');
  const [aiAns, setAiAns] = useState(null);
  const [spaceFilterMode, setSpaceFilterMode] = useState('all'); // 'all' | 'pinned'
  const [showAllAfterAi, setShowAllAfterAi] = useState(false);
  const [kitsOpen, setKitsOpen] = useState(false);
  const [hoveredSourceId, setHoveredSourceId] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [cmdIdx, setCmdIdx] = useState(0);

  const suppressClickUntilRef = useRef(0);
  const snapTimerRef = useRef(null);
  const openingIdxRef = useRef(-1);
  const openTimerRef = useRef(null);

  // Sync external catalog search resets
  useEffect(() => {
    if (catalogQ && catalogQ !== spaceQuery) {
      setSpaceQuery(catalogQ);
    }
  }, [catalogQ]);

  // Measure viewport & watch prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReducedMotion(Boolean(mq.matches));
    onMq();
    if (mq.addEventListener) mq.addEventListener('change', onMq);

    const onResize = () =>
      setVpSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onMq);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const poolAll = allItems && allItems.length ? allItems : items;

  const flatCats = useMemo(() => buildFlat(tree), [tree]);
  const allowedCats = useMemo(
    () => flatCats.filter((c) => can.viewCat(c, role, userName)).map((c) => c.id),
    [flatCats, role, userName]
  );

  const visibleKits = useMemo(
    () =>
      cols.filter((c) => {
        if (c.tier !== 'official' && c.tier !== 'shared') return false;
        const r = normRole(role);
        if (r === 'SuperAdmin' || r === 'Admin') return true;
        if (r === 'Guest') return c.vis === 'Public';
        if (c.vis === 'Restricted') return c.owner === userName || (c.coEditors || []).includes(userName);
        return true;
      }),
    [cols, role, userName]
  );

  const pinnedData = useMemo(() => {
    const officialHighlights = poolAll
      .filter((r) => r.status === 'Approved' && (r.id === 100 || r.id === 9 || r.id === 1))
      .slice(0, 3);
    const pinnedItems = pinned
      .map((id) => poolAll.find((r) => r.id === id))
      .filter((r) => r && !officialHighlights.some((o) => o.id === r.id))
      .slice(0, 6);
    const combined = [...officialHighlights, ...pinnedItems];
    const idSet = new Set(combined.map((x) => x.id));
    return { officialHighlights, pinnedItems, combined, idSet };
  }, [poolAll, pinned]);

  // Reactive 3D Space items: responds to AI citations, live natural-language/keyword search, or Pinned spotlight
  const reactive = useMemo(() => {
    const sourceOrderMap = new Map();
    if (aiAns && Array.isArray(aiAns.src)) {
      aiAns.src.forEach((s, i) => sourceOrderMap.set(s.id, s.index || i + 1));
    }

    const rawQ = spaceQuery.trim();
    const tokens = tokenizeQuery(rawQ);
    const matchMap = new Map();

    if (rawQ) {
      const searchSource = items.length ? items : poolAll;
      const scored = searchSource
        .map((r) => ({ r, ...scoreItemForQuery(r, rawQ, tokens) }))
        .filter((x) => x.score > 0);
      scored.sort((a, b) => b.matched - a.matched || b.score - a.score);
      scored.forEach((x) => matchMap.set(x.r.id, x));
    }

    // Mode 1: Highlights & Pinned spotlight in 3D Space
    if (spaceFilterMode === 'pinned') {
      const inItems = items.filter((r) => pinnedData.idSet.has(r.id));
      const pinnedList = inItems.length ? inItems : pinnedData.combined;
      return {
        displayItems: pinnedList,
        sourceOrderMap,
        matchMap,
        mode: 'pinned',
      };
    }

    // Mode 2: AI Answer Source Spotlight in 3D Space
    if (aiAns && !aiAns.busy && sourceOrderMap.size > 0 && !showAllAfterAi) {
      const citedItems = [];
      const seenIds = new Set();

      aiAns.src.forEach((s) => {
        const doc = poolAll.find((r) => r.id === s.id) || items.find((r) => r.id === s.id);
        if (doc && !seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          citedItems.push(doc);
        }
      });

      // Add up to 4 related high-scoring matches around the cited sources so the arc feels rich
      if (rawQ) {
        const extras = [];
        matchMap.forEach((entry, id) => {
          if (!seenIds.has(id) && entry.score >= 4) extras.push(entry);
        });
        extras
          .sort((a, b) => b.matched - a.matched || b.score - a.score)
          .slice(0, 4)
          .forEach((entry) => {
            seenIds.add(entry.r.id);
            citedItems.push(entry.r);
          });
      }

      return {
        displayItems: citedItems,
        sourceOrderMap,
        matchMap,
        mode: 'ai',
      };
    }

    // When showing all items alongside an AI answer, bring cited items to the front columns
    if (aiAns && sourceOrderMap.size > 0 && showAllAfterAi) {
      const front = [];
      const rest = [];
      aiAns.src.forEach((s) => {
        const doc = items.find((r) => r.id === s.id) || poolAll.find((r) => r.id === s.id);
        if (doc && !front.some((x) => x.id === doc.id)) front.push(doc);
      });
      items.forEach((r) => {
        if (!front.some((x) => x.id === r.id)) rest.push(r);
      });
      return {
        displayItems: [...front, ...rest],
        sourceOrderMap,
        matchMap,
        mode: 'ai-all',
      };
    }

    // Mode 3: Live smart search filtering & front-ranking
    if (rawQ) {
      const scoredList = [];
      matchMap.forEach((entry) => scoredList.push(entry));
      scoredList.sort((a, b) => b.matched - a.matched || b.score - a.score);
      // Require strong relevance for multi-word queries if top hit matched >= 2 tokens
      const topMatched = scoredList[0] ? scoredList[0].matched : 0;
      const filtered =
        tokens.length >= 2 && topMatched >= 2
          ? scoredList.filter((x) => x.matched >= Math.max(1, topMatched - 1))
          : scoredList;
      return {
        displayItems: filtered.map((x) => x.r),
        sourceOrderMap,
        matchMap,
        mode: 'search',
      };
    }

    // Default full 360° gallery
    return {
      displayItems: items,
      sourceOrderMap,
      matchMap,
      mode: 'gallery',
    };
  }, [items, poolAll, spaceQuery, aiAns, spaceFilterMode, showAllAfterAi, pinnedData]);

  const displayItems = reactive.displayItems;
  const count = displayItems.length;
  const isCompact = vpWidth <= 920;

  const runAi = async (question) => {
    const t = String(question || '').trim();
    if (!t) return;
    setSpaceFilterMode('all');
    setKitsOpen(false);
    setShowAllAfterAi(false);
    setAiAns({ q: t, src: [], text: '', busy: true });

    const out = await edgeClient.ai({
      action: 'qa',
      query: t,
      userRole: role,
      userName,
      allowedCategories: allowedCats,
      items: poolAll,
      today: TODAY,
    });
    setAiAns({
      q: t,
      src: out.sources || [],
      text: out.answer || '',
      busy: false,
    });
  };

  useEffect(() => {
    if (cmdOpen && active) {
      setKitsOpen(false);
      setCmdIdx(0);
      askInputRef.current && askInputRef.current.focus();
    }
  }, [cmdOpen, active]);

  useEffect(() => {
    setCmdIdx(0);
  }, [spaceQuery]);

  const recordAskBarRect = () => {
    if (!omniRectRef || !active || !askBarRef.current || openingIdxRef.current !== -1 || dockAnimRef.current) return;
    const r = askBarRef.current.getBoundingClientRect();
    if (r.width > 10 && r.height > 10) {
      omniRectRef.current = {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        w: r.width,
        h: r.height,
        mode: 'space',
      };
    }
  };

  useEffect(() => {
    if (!active) return undefined;
    const syncRect = () => recordAskBarRect();
    syncRect();
    const ro = typeof ResizeObserver !== 'undefined' && askBarRef.current ? new ResizeObserver(syncRect) : null;
    if (ro && askBarRef.current) ro.observe(askBarRef.current);
    window.addEventListener('resize', syncRect, { passive: true });
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', syncRect);
    };
  }, [active, aiAns, kitsOpen, cmdOpen]);

  // FLIP flight from Topbar Center Pill -> Bottom Spatial Dock when entering 3D Space
  useLayoutEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = Boolean(active);
    if (!active || !askBarRef.current) return;

    const prev = omniRectRef && omniRectRef.current;
    const shouldAnimate = !reducedMotion && prev && prev.mode === 'topbar' && (!wasActive || askBarRef.current.isConnected);
    if (!shouldAnimate || !askBarRef.current.animate) {
      recordAskBarRect();
      return;
    }

    const t = askBarRef.current.getBoundingClientRect();
    if (t.width > 0 && t.height > 0) {
      const dx = prev.x - (t.left + t.width / 2);
      const dy = prev.y - (t.top + t.height / 2);
      const sx = Math.max(0.35, Math.min(1, prev.w / t.width));
      const sy = Math.max(0.6, Math.min(1, prev.h / t.height));

      if (dockAnimRef.current) dockAnimRef.current.cancel();
      const anim = askBarRef.current.animate(
        [
          {
            transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
            opacity: 0.92,
          },
          {
            transform: 'translate3d(0, 3px, 0) scale(1.008, 1.02)',
            offset: 0.78,
          },
          {
            transform: 'translate3d(0, 0, 0) scale(1, 1)',
            opacity: 1,
          },
        ],
        {
          duration: 500,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      );
      dockAnimRef.current = anim;
      if (omniRectRef) {
        omniRectRef.current = {
          x: t.left + t.width / 2,
          y: t.top + t.height / 2,
          w: t.width,
          h: t.height,
          mode: 'space',
        };
      }
      anim.onfinish = () => {
        dockAnimRef.current = null;
        recordAskBarRect();
      };
      anim.oncancel = () => {
        dockAnimRef.current = null;
      };

      if (dockBarRef.current && dockBarRef.current.animate) {
        dockBarRef.current.animate(
          [
            { opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: 380,
            delay: 110,
            fill: 'backwards',
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }
        );
      }
    } else {
      recordAskBarRect();
    }
  }, [active, reducedMotion]);

  useEffect(() => {
    if (focusSignal && askInputRef.current) {
      askInputRef.current.focus();
    }
  }, [focusSignal]);

  useEffect(() => {
    if (aq && aq.q) {
      setSpaceQuery(aq.q);
      runAi(aq.q);
    }
  }, [aq]);

  // Slightly shift scene up smoothly when a bottom glass sheet (AI Answer / Starter Kits) is open
  const hasOverlaySheetRef = useRef(false);
  hasOverlaySheetRef.current = Boolean(aiAns || kitsOpen);

  // Adaptive visionOS cylindrical layout: scales 1..5 rows by viewport height & item count
  const layout = useMemo(() => {
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

    // Round down rows based on item count so each active row maintains a balanced horizontal arc
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

    // Populate front-facing columns first while keeping horizontal row tracks aligned
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
  }, [displayItems, count, isCompact, vpWidth, vpHeight]);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  if (cardRefs.current.length > displayItems.length) {
    cardRefs.current.length = displayItems.length;
  }
  if (hoverLiftRef.current.length > displayItems.length) {
    hoverLiftRef.current.length = displayItems.length;
  }
  if (dotRefs.current.length > layout.cols) {
    dotRefs.current.length = layout.cols;
  }

  const motionRef = useRef({
    yaw: 0,
    targetYaw: 0,
    velYaw: 0,
    zoom: 0,
    targetZoom: 0,
    sceneY: -28,
    pitch: 0,
    targetPitch: 0,
    lookYaw: 0,
    targetLookYaw: 0,
    lookPitch: 0,
    targetLookPitch: 0,
    dragging: false,
    didDrag: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastT: 0,
    dragDist: 0,
    lastColShown: -1,
    lastZoomShown: -999,
    lastMovedShown: false,
  });

  // Automatically center the 3D carousel when query, AI spotlight, or filter changes
  useEffect(() => {
    const m = motionRef.current;
    m.lastColShown = -1;
    hoveredIdxRef.current = -1;
    m.velYaw = 0;
    m.targetYaw = 0;
    const isFocusedSet = Boolean(
      spaceQuery.trim() || aiAns || spaceFilterMode === 'pinned'
    );
    m.targetZoom = isFocusedSet && count > 0 && count <= 5 ? 55 : 0;
  }, [spaceQuery, aiAns?.q, aiAns?.busy, spaceFilterMode, showAllAfterAi, pageTitle]);

  // Keep bounds sane if item count changes without query change
  useEffect(() => {
    const m = motionRef.current;
    if (!layout.fullRing) {
      m.targetYaw = clamp(m.targetYaw, -layout.maxYawBound, layout.maxYawBound);
      m.yaw = clamp(m.yaw, -layout.maxYawBound, layout.maxYawBound);
    }
  }, [layout.cols, layout.fullRing, layout.maxYawBound]);

  // Schedule smooth settle onto nearest column
  const scheduleSnap = (delayMs = 190) => {
    clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      const l = layoutRef.current;
      const m = motionRef.current;
      if (m.dragging || Math.abs(m.velYaw) > 0.08) return;
      const snapped = Math.round(m.targetYaw / l.stepDeg) * l.stepDeg;
      m.targetYaw = l.fullRing ? snapped : clamp(snapped, -l.maxYawBound, l.maxYawBound);
    }, delayMs);
  };

  // High-frequency 60fps 3D spatial transform loop (imperative DOM writes, zero React re-renders)
  useEffect(() => {
    let rafId = 0;
    let alive = true;

    const frame = () => {
      if (!alive) return;
      const l = layoutRef.current;
      const m = motionRef.current;

      if (!m.dragging) {
        if (Math.abs(m.velYaw) > 0.015) {
          m.targetYaw += m.velYaw;
          m.velYaw *= 0.92;
          if (!l.fullRing) {
            m.targetYaw = clamp(m.targetYaw, -l.maxYawBound, l.maxYawBound);
            if (Math.abs(m.targetYaw) >= l.maxYawBound) m.velYaw *= 0.4;
          }
          if (Math.abs(m.velYaw) <= 0.06) {
            m.velYaw = 0;
            const snapped = Math.round(m.targetYaw / l.stepDeg) * l.stepDeg;
            m.targetYaw = l.fullRing ? snapped : clamp(snapped, -l.maxYawBound, l.maxYawBound);
          }
        }
        m.targetPitch *= 0.94;
      }

      const ease = reducedMotion ? 1 : m.dragging ? 0.44 : 0.16;
      m.yaw += (m.targetYaw - m.yaw) * ease;
      m.zoom += (m.targetZoom - m.zoom) * (reducedMotion ? 1 : 0.16);
      m.pitch += (m.targetPitch - m.pitch) * (reducedMotion ? 1 : 0.14);
      m.lookYaw += (m.targetLookYaw - m.lookYaw) * (reducedMotion ? 1 : 0.09);
      m.lookPitch += (m.targetLookPitch - m.lookPitch) * (reducedMotion ? 1 : 0.09);

      if (sceneRef.current) {
        const targetSceneY = hasOverlaySheetRef.current
          ? isCompact
            ? -78
            : -102
          : isCompact
          ? -16
          : l.rows >= 4
          ? -32
          : -28;
        m.sceneY += (targetSceneY - m.sceneY) * (reducedMotion ? 1 : 0.16);
        sceneRef.current.style.transform = `translate3d(0, ${m.sceneY.toFixed(1)}px, ${(l.sceneZ + m.zoom).toFixed(1)}px) rotateX(${(m.pitch + m.lookPitch).toFixed(2)}deg) rotateY(${m.lookYaw.toFixed(2)}deg)`;
      }

      const positions = l.positions;
      const R = l.radius;
      const cullDeg = isCompact ? 88 : 98;
      const focusDeg = Math.max(26, l.stepDeg * 0.85);
      const openIdx = openingIdxRef.current;
      const openProgress = openIdx >= 0 ? Math.min(1, (hoverLiftRef.current[openIdx] || 0) / 1.8) : 0;

      for (let i = 0; i < positions.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const pos = positions[i];
        const rel = l.fullRing ? wrapDeg(pos.angle - m.yaw) : pos.angle - m.yaw;
        const absRel = Math.abs(rel);

        if (absRel > cullDeg) {
          hoverLiftRef.current[i] = 0;
          if (el.style.visibility !== 'hidden') {
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
            el.tabIndex = -1;
          }
          continue;
        }

        if (el.style.visibility === 'hidden') {
          el.style.visibility = 'visible';
          el.style.pointerEvents = 'auto';
          el.tabIndex = 0;
        }

        const isOpening = openIdx === i;
        const targetLift = isOpening ? 2.6 : hoveredIdxRef.current === i && !m.dragging && openIdx === -1 ? 1 : 0;
        const prevLift = hoverLiftRef.current[i] || 0;
        const liftEase = isOpening ? 0.28 : 0.22;
        const lift = reducedMotion ? targetLift : prevLift + (targetLift - prevLift) * liftEase;
        hoverLiftRef.current[i] = Math.abs(lift) < 0.002 ? 0 : lift;

        const rad = (rel * Math.PI) / 180;
        const x = isOpening ? R * Math.sin(rad) * Math.max(0.15, 1 - openProgress * 0.85) : R * Math.sin(rad);
        const centerPresence =
          Math.max(0, Math.cos((Math.min(absRel, l.stepDeg) / Math.max(1, l.stepDeg)) * (Math.PI / 2))) * 14;
        const zDelta = isOpening ? lift * 88 : openIdx !== -1 ? -openProgress * 82 : lift * 32;
        const z = -R * Math.cos(rad) + centerPresence + zDelta;
        const rotY = isOpening
          ? -rel * 0.7 * Math.max(0, 1 - openProgress)
          : -rel * (0.7 - Math.min(1, lift) * 0.14);

        const t = Math.min(1, absRel / cullDeg);
        const sc = 1.03 - 0.24 * Math.pow(t, 1.35) + (isOpening ? lift * 0.1 : lift * 0.045 - openProgress * 0.05);
        const baseOp = Math.max(0.24, 1 - 0.7 * Math.pow(t, 1.75));
        let op = lift > 0.05 ? Math.max(baseOp, 0.92 + Math.min(0.08, lift * 0.08)) : baseOp;
        if (openIdx !== -1 && !isOpening) {
          op *= Math.max(0.12, 1 - openProgress * 0.85);
        }

        el.style.transform = `translate3d(${x.toFixed(1)}px, ${(isOpening ? pos.y * (1 - openProgress * 0.65) : pos.y).toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${rotY.toFixed(2)}deg) scale3d(${sc.toFixed(3)}, ${sc.toFixed(3)}, 1)`;
        el.style.opacity = op.toFixed(3);
        el.style.zIndex = String(isOpening ? 999 : Math.round(200 - absRel + lift * 120));

        const isCenterCol = absRel < l.stepDeg * 0.45;
        if (isCenterCol) {
          if (!el.classList.contains('is-focus')) el.classList.add('is-focus');
        } else if (el.classList.contains('is-focus')) {
          el.classList.remove('is-focus');
        }

        const isPeripheral = absRel > focusDeg;
        if (isPeripheral) {
          if (!el.classList.contains('is-peripheral')) el.classList.add('is-peripheral');
        } else if (el.classList.contains('is-peripheral')) {
          el.classList.remove('is-peripheral');
        }

        const blurTier =
          reducedMotion || lift > 0.2
            ? '0'
            : t > 0.8
            ? '2'
            : t > 0.65
            ? '1'
            : '0';
        if (el.dataset.blur !== blurTier) {
          el.dataset.blur = blurTier;
          el.style.filter =
            blurTier === '2'
              ? 'blur(2px)'
              : blurTier === '1'
              ? 'blur(1px)'
              : 'none';
        }
      }

      // Update active column index, scrubber dots & compact HUD label
      if (l.cols > 0) {
        let colIdx = l.fullRing
          ? Math.round(m.yaw / l.stepDeg) % l.cols
          : Math.round(m.yaw / l.stepDeg + (l.cols - 1) / 2);
        if (colIdx < 0) colIdx += l.cols;
        colIdx = clamp(colIdx, 0, Math.max(0, l.cols - 1));
        if (colIdx !== m.lastColShown) {
          m.lastColShown = colIdx;
          if (hudColRef.current) {
            hudColRef.current.textContent = `${colIdx + 1}/${l.cols}`;
          }
          for (let d = 0; d < l.cols; d++) {
            const dot = dotRefs.current[d];
            if (!dot) continue;
            if (d === colIdx) {
              dot.classList.add('on');
              dot.setAttribute('aria-current', 'true');
            } else {
              dot.classList.remove('on');
              dot.removeAttribute('aria-current');
            }
          }
        }
      }

      if (hudZoomRef.current) {
        const zPct = Math.round(100 + (m.zoom / ZOOM_MAX) * 28);
        if (zPct !== m.lastZoomShown) {
          m.lastZoomShown = zPct;
          hudZoomRef.current.textContent = `${zPct}%`;
        }
      }

      if (resetBtnRef.current) {
        const isMoved = Math.abs(m.yaw) > 4 || Math.abs(m.zoom) > 12;
        if (isMoved !== m.lastMovedShown) {
          m.lastMovedShown = isMoved;
          resetBtnRef.current.hidden = !isMoved;
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      clearTimeout(snapTimerRef.current);
      clearTimeout(openTimerRef.current);
    };
  }, [layout, reducedMotion, isCompact]);

  // Wheel navigation: vertical/horizontal scroll rotates 360° carousel; Ctrl/Meta/Alt + scroll zooms
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;

    const onWheel = (e) => {
      if (e.target && e.target.closest && e.target.closest('.asel-menu,.pop,.dr,.kspace-dock')) return;
      e.preventDefault();
      const m = motionRef.current;
      const l = layoutRef.current;
      const dx = e.deltaX || 0;
      const dy = e.deltaY || 0;

      if (e.ctrlKey || e.metaKey || e.altKey) {
        m.targetZoom = clamp(m.targetZoom - dy * 0.85, ZOOM_MIN, ZOOM_MAX);
        return;
      }

      const rawDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      m.velYaw = 0;
      const nextYaw = m.targetYaw + rawDelta * 0.16;
      m.targetYaw = l.fullRing ? nextYaw : clamp(nextYaw, -l.maxYawBound, l.maxYawBound);
      scheduleSnap(190);
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  const stepRotate = (dir) => {
    const l = layoutRef.current;
    const m = motionRef.current;
    m.velYaw = 0;
    const curSnap = Math.round(m.targetYaw / l.stepDeg) * l.stepDeg;
    const nextYaw = curSnap + dir * l.stepDeg;
    m.targetYaw = l.fullRing ? nextYaw : clamp(nextYaw, -l.maxYawBound, l.maxYawBound);
  };

  const stepZoom = (delta) => {
    const m = motionRef.current;
    m.targetZoom = clamp(m.targetZoom + delta, ZOOM_MIN, ZOOM_MAX);
  };

  const resetCamera = () => {
    const m = motionRef.current;
    m.velYaw = 0;
    m.targetYaw = 0;
    m.targetZoom = 0;
    m.targetPitch = 0;
  };

  const rotateToAngle = (colAngle) => {
    const l = layoutRef.current;
    const m = motionRef.current;
    if (!l.cols) return;
    m.velYaw = 0;
    if (!l.fullRing) {
      m.targetYaw = clamp(colAngle, -l.maxYawBound, l.maxYawBound);
      return;
    }
    const diff = wrapDeg(colAngle - m.yaw);
    m.targetYaw = m.yaw + diff;
  };

  const focusItemInSpace = (itemId) => {
    const idx = displayItems.findIndex((x) => x.id === itemId);
    if (idx < 0) return;
    const pos = layoutRef.current.positions[idx];
    if (pos) rotateToAngle(pos.angle);
    hoveredIdxRef.current = idx;
    setHoveredSourceId(itemId);
  };

  const triggerOpenCard = (itemId, idx = -1, colAngle) => {
    if (!onRead) return;
    recordAskBarRect();
    if (onSetCmdOpen) onSetCmdOpen(false);
    if (reducedMotion || idx < 0) {
      onRead(itemId);
      return;
    }
    if (openingIdxRef.current !== -1) return;
    openingIdxRef.current = idx;
    setOpeningId(itemId);
    if (typeof colAngle === 'number') {
      rotateToAngle(colAngle);
    }
    clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      openingIdxRef.current = -1;
      setOpeningId(null);
      onRead(itemId);
    }, 220);
  };

  const clearSpaceSearch = () => {
    setSpaceQuery('');
    setAiAns(null);
    setSpaceFilterMode('all');
    setShowAllAfterAi(false);
    setHoveredSourceId(null);
    if (catalogQ && onCatalogQChange) onCatalogQChange('');
    resetCamera();
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('button,a,input')) {
      if (e.target.closest('.acts,.kspace-read-btn,.kspace-dock,.kspace-topbar')) return;
    }
    const m = motionRef.current;
    clearTimeout(snapTimerRef.current);
    m.dragging = true;
    m.didDrag = false;
    m.pointerId = e.pointerId;
    m.startX = e.clientX;
    m.startY = e.clientY;
    m.lastX = e.clientX;
    m.lastT = performance.now();
    m.dragDist = 0;
    m.velYaw = 0;
  };

  const onPointerMove = (e) => {
    const m = motionRef.current;

    if (!m.dragging && !reducedMotion && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        m.targetLookYaw = clamp(nx * 3.2, -1.6, 1.6);
        m.targetLookPitch = clamp(-ny * 3.6, -1.8, 1.8);
      }
    }

    if (!m.dragging || e.pointerId !== m.pointerId) return;
    const dxTotal = e.clientX - m.startX;
    const dyTotal = e.clientY - m.startY;
    m.dragDist = Math.hypot(dxTotal, dyTotal);

    if (m.dragDist > 6) {
      if (!m.didDrag) {
        m.didDrag = true;
        if (viewportRef.current) {
          viewportRef.current.classList.add('dragging');
          try {
            viewportRef.current.setPointerCapture(e.pointerId);
          } catch {}
        }
      }
      const now = performance.now();
      const dt = Math.max(8, now - m.lastT);
      const stepX = e.clientX - m.lastX;
      const l = layoutRef.current;

      const degDelta = -stepX * (isCompact ? 0.28 : 0.22);
      const nextYaw = m.targetYaw + degDelta;
      m.targetYaw = l.fullRing ? nextYaw : clamp(nextYaw, -l.maxYawBound, l.maxYawBound);
      m.velYaw = clamp((degDelta / dt) * 16, -5.5, 5.5);
      m.targetPitch = clamp(-dyTotal * 0.028, -PITCH_MAX, PITCH_MAX);

      m.lastX = e.clientX;
      m.lastT = now;
    }
  };

  const onPointerUp = (e) => {
    const m = motionRef.current;
    if (!m.dragging || e.pointerId !== m.pointerId) return;
    m.dragging = false;
    if (viewportRef.current) {
      viewportRef.current.classList.remove('dragging');
      try {
        viewportRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
    if (m.didDrag) {
      suppressClickUntilRef.current = performance.now() + 180;
      scheduleSnap(200);
    }
    m.didDrag = false;
  };

  const onViewportPointerLeave = () => {
    const m = motionRef.current;
    m.targetLookYaw = 0;
    m.targetLookPitch = 0;
    hoveredIdxRef.current = -1;
  };

  const onStageKeyDown = (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === '/') {
      e.preventDefault();
      askInputRef.current && askInputRef.current.focus();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepRotate(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepRotate(-1);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      stepZoom(70);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      stepZoom(-70);
    } else if (e.key === '0' || e.key === 'Home') {
      e.preventDefault();
      resetCamera();
    }
  };

  const cmdItems = useMemo(() => {
    const qTrim = spaceQuery.trim();
    const qLow = qTrim.toLowerCase();
    const recentEntries =
      !qLow && recentSearches.length
        ? recentSearches.slice(0, 3).map((term) => ({
            t: `Recent search: “${term}”`,
            d: 'Re-run search',
            n: 'clock',
            run: () => setSpaceQuery(term),
          }))
        : [];

    const docPool = qLow
      ? displayItems.slice(0, 5)
      : [...displayItems].sort((a, b) => (b.upd || '').localeCompare(a.upd || '')).slice(0, 4);

    const snip = (r) => {
      const cat = byId(r.node, tree);
      if (!qLow) return (cat && cat.path.join(' › ')) || 'Library';
      const b = plain(r.body);
      const k = b.toLowerCase().indexOf(qLow);
      return k < 0 ? r.desc : (k > 40 ? '…' : '') + b.slice(Math.max(0, k - 40), k + 90);
    };

    const actions = [
      ...(can.createDraft(role) ? [['Create article or resource', 'plus', 'new']] : []),
      ['Knowledge Base (Grid)', 'layout', 'view', 'kb'],
      ['Playbooks & Kits', 'folder', 'kits'],
      ['Dependency Graph', 'graph', 'kb-graph'],
      ...(can.admin(role) ? [['Administration & Governance', 'shield', 'view', 'admin']] : []),
      ['Change theme', 'spark', 'theme'],
    ].filter((a) => !qLow || a[0].toLowerCase().includes(qLow));

    return [
      ...recentEntries,
      ...docPool.map((r) => ({
        docId: r.id,
        t: r.title,
        d: snip(r),
        n: r.type,
        c: DC[r.disc],
        run: () => {
          const idx = displayItems.findIndex((x) => x.id === r.id);
          const colAngle = idx >= 0 && layout.positions[idx] ? layout.positions[idx].angle : undefined;
          triggerOpenCard(r.id, idx, colAngle);
        },
      })),
      ...actions.map((a) => ({
        t: a[0],
        d: 'Navigation / Action',
        n: a[1],
        run: () => {
          recordAskBarRect();
          onSetCmdOpen && onSetCmdOpen(false);
          onCommand && onCommand(a[2], a[3]);
        },
      })),
      ...(qLow
        ? [
            {
              t: `Ask Library AI: “${qTrim}”`,
              d: 'Permission-filtered synthesis & 3D spotlight',
              n: 'spark',
              c: '#bf5af2',
              run: () => {
                onSetCmdOpen && onSetCmdOpen(false);
                runAi(qTrim);
              },
            },
            {
              t: `All results for “${qTrim}”`,
              d: 'Search full catalog in Grid',
              n: 'search',
              run: () => {
                recordAskBarRect();
                onSetCmdOpen && onSetCmdOpen(false);
                onCommand && onCommand('all', qTrim);
              },
            },
          ]
        : []),
    ];
  }, [spaceQuery, recentSearches, displayItems, tree, role, layout, onCommand, onSetCmdOpen]);

  const highlightCmdText = (text) => {
    const qLow = spaceQuery.trim().toLowerCase();
    const idx = qLow ? text.toLowerCase().indexOf(qLow) : -1;
    return idx < 0
      ? text
      : html`${text.slice(0, idx)}<mark>${text.slice(idx, idx + qLow.length)}</mark>${text.slice(idx + qLow.length)}`;
  };

  const discChips = DISC;
  const activeDisc = f.disc || '';
  const envAccent = (f.disc && DC[f.disc]) || (curCat && curCat.color) || '#2997ff';
  const hasReactiveFilter = Boolean(spaceQuery.trim() || aiAns || spaceFilterMode === 'pinned');

  return html`<section
    className=${'kspace-stage' + (openingId !== null ? ' is-opening' : '')}
    style=${{ '--env-accent': envAccent }}
    aria-label=${`${pageTitle} — Apple visionOS Spatial View`}
    onKeyDown=${onStageKeyDown}
  >
    <div className="kspace-topbar">
      <div className="kspace-head">
        <div className="kspace-title-row">
          <h1>${pageTitle}</h1>
          <span
            className="kspace-cnt"
            title=${`${count} in view of ${allCount} items`}
          >${hasReactiveFilter ? `${count}/${items.length || allCount}` : count}</span>
          ${curCat &&
          html`<span className="kspace-cat-pill" style=${{ '--cc': curCat.color || '#0a84ff' }}>
            <i></i>
            <span>${curCat.path ? curCat.path.join(' › ') : curCat.name}</span>
          </span>`}
        </div>
      </div>

      <div className="kspace-disc-strip" role="group" aria-label="Quick discipline filter">
        <button
          type="button"
          className=${'kspace-dchip' + (!activeDisc ? ' on' : '')}
          onClick=${() => setF && setF({ ...f, disc: undefined })}
        >
          All
        </button>
        ${discChips.map(
          (d) => html`<button
            key=${d}
            type="button"
            className=${'kspace-dchip' + (activeDisc === d ? ' on' : '')}
            style=${{ '--dc': DC[d] }}
            onClick=${() => setF && setF({ ...f, disc: activeDisc === d ? undefined : d })}
          >
            <i></i>
            <span>${d}</span>
          </button>`
        )}
      </div>

      ${toolbarRight && html`<div className="kspace-controls">${toolbarRight}</div>`}
    </div>

    ${count
      ? html`<div
          ref=${viewportRef}
          className="kspace-viewport"
          onPointerDown=${onPointerDown}
          onPointerMove=${onPointerMove}
          onPointerUp=${onPointerUp}
          onPointerCancel=${onPointerUp}
          onPointerLeave=${onViewportPointerLeave}
        >
          <div ref=${sceneRef} className="kspace-scene">
            ${displayItems.map((r, idx) => {
              const cat = byId(r.node, tree);
              const catName = cat ? cat.name : '';
              const isWatch = watch.includes(r.id);
              const isFav = favs.includes(r.id);
              const colAngle = layout.positions[idx] ? layout.positions[idx].angle : 0;
              const citeNum = reactive.sourceOrderMap.get(r.id);
              const isAiSource = Boolean(citeNum);
              const isSearchMatch = Boolean(!isAiSource && spaceQuery.trim() && reactive.matchMap.has(r.id));
              const isHighlighted = hoveredSourceId === r.id;

              return html`<div
                key=${r.id}
                ref=${(el) => {
                  cardRefs.current[idx] = el;
                }}
                className=${'card kspace-card' +
                  (isAiSource ? ' is-ai-source' : '') +
                  (isSearchMatch ? ' is-search-match' : '') +
                  (isHighlighted ? ' is-spotlight' : '') +
                  (openingId === r.id ? ' is-opening-card' : '')}
                role="button"
                tabIndex="0"
                aria-label=${`${r.title} (${r.disc || 'VDC'})`}
                style=${{
                  width: layout.cardW + 'px',
                  height: layout.cardH + 'px',
                  marginLeft: -(layout.cardW / 2) + 'px',
                  marginTop: -(layout.cardH / 2) + 'px',
                }}
                onPointerEnter=${() => {
                  hoveredIdxRef.current = idx;
                }}
                onPointerLeave=${() => {
                  if (hoveredIdxRef.current === idx) hoveredIdxRef.current = -1;
                }}
                onFocus=${() => rotateToAngle(colAngle)}
                onClick=${() => {
                  if (performance.now() < suppressClickUntilRef.current) return;
                  const m = motionRef.current;
                  const l = layoutRef.current;
                  const rel = l.fullRing ? wrapDeg(colAngle - m.yaw) : colAngle - m.yaw;
                  const focusThresh = Math.max(26, l.stepDeg * 0.85);
                  if (Math.abs(rel) > focusThresh) {
                    rotateToAngle(colAngle);
                    return;
                  }
                  triggerOpenCard(r.id, idx, colAngle);
                }}
                onKeyDown=${(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerOpenCard(r.id, idx, colAngle);
                  }
                }}
              >
                ${isAiSource &&
                html`<span className="kspace-cite-badge">
                  <${Ic} n="spark" s=${10} /> Source [${citeNum}]
                </span>`}

                <div className="acts" onPointerDown=${(e) => e.stopPropagation()}>
                  ${!isGuest &&
                  html`<button
                    type="button"
                    className=${isWatch ? 'on' : ''}
                    title=${isWatch ? 'Watching' : 'Watch'}
                    aria-label="Watch"
                    onClick=${(e) => {
                      e.stopPropagation();
                      onToggleWatch && onToggleWatch(r.id);
                    }}
                  >
                    <${Ic} n="eye" s=${15} />
                  </button>`}
                  ${!isGuest &&
                  html`<button
                    type="button"
                    className=${isFav ? 'on' : ''}
                    title=${isFav ? 'Remove bookmark' : 'Bookmark'}
                    aria-label="Bookmark"
                    onClick=${(e) => {
                      e.stopPropagation();
                      onToggleFav && onToggleFav(r.id);
                    }}
                  >
                    <${Ic} n="star" s=${15} f=${isFav} />
                  </button>`}
                  ${!isGuest &&
                  onInspect &&
                  html`<button
                    type="button"
                    title="Inspect details"
                    aria-label="Inspect details"
                    onClick=${(e) => {
                      e.stopPropagation();
                      onInspect(r.id);
                    }}
                  >
                    <${Ic} n="sliders" s=${14} />
                  </button>`}
                </div>

                <div className="ch2">
                  <span className="tl" style=${{ '--c': DC[r.disc] || '#0a84ff' }}>
                    <${Ic} n=${r.type} s=${17} />
                  </span>
                  <span className="who">
                    <b>${r.disc || 'VDC'}</b>
                    <small>${catName ? `${TY[r.type] || 'Document'} · ${catName}` : TY[r.type] || 'Document'}</small>
                  </span>
                </div>

                <h3>${r.title || 'Untitled standard'}</h3>
                <p>${r.desc || 'No summary added yet.'}</p>

                <div className="row">
                  <${Pill} s=${r.status} />
                  ${r.vis && r.vis !== 'Internal' && html`<${VisPill} v=${r.vis} />`}
                  <span>v${(r.v && r.v.length) || 1}</span>
                  ${r.url && isResType(r.type)
                    ? html`<a
                        className="mn kspace-open-link"
                        style=${{ marginLeft: 'auto' }}
                        href=${r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onPointerDown=${(e) => e.stopPropagation()}
                        onClick=${(e) => e.stopPropagation()}
                      >
                        Open ↗
                      </a>`
                    : html`<span className="kspace-foot-r" style=${{ marginLeft: 'auto' }}>
                        <span className="kspace-date">${fmt(r.upd)}</span>
                        <button
                          type="button"
                          className="kspace-read-btn"
                          onPointerDown=${(e) => e.stopPropagation()}
                          onClick=${(e) => {
                            e.stopPropagation();
                            triggerOpenCard(r.id, idx, colAngle);
                          }}
                        >
                          Read ›
                        </button>
                      </span>`}
                </div>
              </div>`;
            })}
          </div>
        </div>`
      : html`<div className="kspace-empty">
          <div className="empty">
            <${Ic} n="search" s=${34} />
            <b>No matching standards in Space</b>
            <span>Try another phrasing, press Ask for AI synthesis, or clear the query.</span>
            <div style=${{ display: 'flex', gap: 8, marginTop: 6 }}>
              ${spaceQuery.trim() &&
              html`<button type="button" className="btn p" onClick=${() => runAi(spaceQuery)}>
                <${Ic} n="spark" s=${14} /><span>Ask Library AI</span>
              </button>`}
              ${(hasFilters || hasReactiveFilter) &&
              html`<button
                type="button"
                className="btn"
                onClick=${() => {
                  clearSpaceSearch();
                  onResetFilters && onResetFilters();
                }}
              >
                Show all items
              </button>`}
            </div>
          </div>
        </div>`}

    <div className="kspace-vignette" aria-hidden="true"></div>
    <div className="kspace-reticle" aria-hidden="true"><span></span></div>

    ${cmdOpen &&
    html`<div
      className="kspace-cmd-ov"
      onClick=${() => onSetCmdOpen && onSetCmdOpen(false)}
      aria-hidden="true"
    ></div>`}

    <div className="kspace-dock" onPointerDown=${(e) => e.stopPropagation()}>
      ${cmdOpen &&
      html`<div className="kspace-cmd-pop" role="dialog" aria-label="Unified Command & Instant Search">
        <div className="kspace-cmd-head">
          <span>Quick Navigation, Instant Hits & AI Commands</span>
          <button
            type="button"
            className="kspace-pop-x"
            aria-label="Close command palette"
            onClick=${() => onSetCmdOpen && onSetCmdOpen(false)}
          >
            <${Ic} n="x" s=${13} />
          </button>
        </div>
        <div className="kspace-cmd-list">
          ${cmdItems.map(
            (item, k) => html`<button
              key=${k}
              type="button"
              className=${'kspace-cmd-item' + (k === cmdIdx ? ' on' : '')}
              onMouseMove=${() => setCmdIdx(k)}
              onMouseEnter=${() => {
                setCmdIdx(k);
                if (item.docId) focusItemInSpace(item.docId);
              }}
              onClick=${() => {
                if (spaceQuery.trim() && onLogSearch) onLogSearch(spaceQuery.trim(), displayItems.length);
                item.run();
              }}
            >
              <span className="tile" style=${{ '--c': item.c || '#8e8e93' }}>
                <${Ic} n=${item.n} s=${14} />
              </span>
              <span className="pt">
                <b>${highlightCmdText(item.t)}</b>
                <small>${item.d}</small>
              </span>
            </button>`
          )}
        </div>
        <div className="kspace-cmd-foot">
          <span>↑↓ select</span>
          <span>↵ open / run</span>
          <span>esc close</span>
        </div>
      </div>`}

      ${kitsOpen &&
      visibleKits.length > 0 &&
      html`<div className="kspace-kits-pop" role="dialog" aria-label="Starter Kits and Playbooks">
        <div className="kspace-pop-head">
          <div>
            <b>Starter Kits & Playbooks</b>
            <small>Curated standard sequences for onboarding & QA gates</small>
          </div>
          <div className="kspace-pop-acts">
            ${onOpenAllKits &&
            html`<button
              type="button"
              className="kspace-mini-btn"
              onClick=${() => {
                setKitsOpen(false);
                onOpenAllKits();
              }}
            >
              All Kits (${visibleKits.length})
            </button>`}
            <button
              type="button"
              className="kspace-pop-x"
              aria-label="Close Starter Kits"
              onClick=${() => setKitsOpen(false)}
            >
              <${Ic} n="x" s=${13} />
            </button>
          </div>
        </div>
        <div className="kspace-kits-grid">
          ${visibleKits.slice(0, 3).map((c) => {
            const isOfficial = c.tier === 'official';
            const kitCount = (c.items || []).length;
            return html`<button
              key=${c.id}
              type="button"
              className="kspace-kit-card"
              onClick=${() => {
                setKitsOpen(false);
                onOpenKit && onOpenKit(c.id);
              }}
            >
              <div className="kspace-kit-top">
                <span className="pill" style=${{ '--c': isOfficial ? '#0a84ff' : '#34c759' }}>
                  ${isOfficial ? 'Official' : 'Shared'}
                </span>
                <span className="kspace-kit-cnt">${kitCount} ${kitCount === 1 ? 'item' : 'items'}</span>
              </div>
              <strong>${c.name}</strong>
              <span>${c.desc || 'Curated resource and standard kit.'}</span>
            </button>`;
          })}
        </div>
      </div>`}

      ${aiAns &&
      html`<div className="kspace-ai-panel" role="region" aria-label="Library AI Answer">
        <div className="kspace-ai-head">
          <span className="kspace-ai-badge">
            <${Ic} n="spark" s=${13} /> Library Intelligence
          </span>
          <span className="kspace-ai-q">${aiAns.q}</span>
          <div className="kspace-pop-acts">
            ${aiAns.src.length > 0 &&
            items.length > aiAns.src.length &&
            html`<button
              type="button"
              className="kspace-mini-btn"
              onClick=${() => setShowAllAfterAi((v) => !v)}
            >
              ${showAllAfterAi ? `Focus sources (${aiAns.src.length})` : `Show all (${items.length})`}
            </button>`}
            <button
              type="button"
              className="kspace-pop-x"
              aria-label="Clear answer and show all"
              onClick=${clearSpaceSearch}
            >
              <${Ic} n="x" s=${13} />
            </button>
          </div>
        </div>

        <div className="kspace-ai-body">
          ${aiAns.busy && !aiAns.text
            ? html`<div className="dots"><i></i><i></i><i></i></div>`
            : html`<p>
                ${aiAns.text.split(CITE).map((x, i) =>
                  i % 2
                    ? html`<sup
                        key=${i}
                        className="kspace-cite-sup"
                        onClick=${() => {
                          const s = aiAns.src[Number(x) - 1];
                          if (s) focusItemInSpace(s.id);
                        }}
                      >[${x}]</sup>`
                    : x
                )}
              </p>`}
        </div>

        ${aiAns.src.length > 0 &&
        html`<div className="kspace-ai-srcs">
          ${aiAns.src.map(
            (s) => html`<button
              key=${s.id}
              type="button"
              className=${'kspace-src-pill' + (hoveredSourceId === s.id ? ' on' : '')}
              onMouseEnter=${() => focusItemInSpace(s.id)}
              onMouseLeave=${() => setHoveredSourceId(null)}
              onClick=${() => {
                const idx = displayItems.findIndex((x) => x.id === s.id);
                const colAngle = idx >= 0 && layout.positions[idx] ? layout.positions[idx].angle : undefined;
                triggerOpenCard(s.id, idx, colAngle);
              }}
              title="Hover to center in 3D Space · Click to open"
            >
              <b>${s.index}</b>
              <span>${s.title}${s.stale ? ' (Review)' : ''}</span>
              <span className="kspace-src-go">↗</span>
            </button>`
          )}
        </div>`}
      </div>`}

      <div ref=${askBarRef} className=${'kspace-ask-bar' + (aiAns && aiAns.busy ? ' is-busy' : '')}>
        <span className="kspace-ask-ico" aria-hidden="true">
          <${Ic} n="spark" s=${17} />
        </span>
        <input
          ref=${askInputRef}
          type="text"
          value=${spaceQuery}
          onChange=${(e) => {
            const val = e.target.value;
            setSpaceQuery(val);
            if (aiAns && val.trim() !== aiAns.q) setAiAns(null);
            if (spaceFilterMode !== 'all') setSpaceFilterMode('all');
            if (!val.trim() && catalogQ && onCatalogQChange) onCatalogQChange('');
          }}
          onKeyDown=${(e) => {
            if (cmdOpen) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCmdIdx((x) => Math.min(x + 1, Math.max(0, cmdItems.length - 1)));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCmdIdx((x) => Math.max(x - 1, 0));
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                if (spaceQuery.trim() && onLogSearch) onLogSearch(spaceQuery.trim(), displayItems.length);
                cmdItems[cmdIdx] && cmdItems[cmdIdx].run();
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onSetCmdOpen && onSetCmdOpen(false);
                return;
              }
            }
            if (e.key === 'ArrowUp' && !cmdOpen && onSetCmdOpen) {
              e.preventDefault();
              onSetCmdOpen(true);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (spaceQuery.trim() && onLogSearch) onLogSearch(spaceQuery.trim(), displayItems.length);
              runAi(spaceQuery);
            } else if (e.key === 'Escape' && (spaceQuery || aiAns)) {
              e.preventDefault();
              clearSpaceSearch();
            }
          }}
          placeholder="Search 3D Space, ask Library AI, or press Ctrl+K for commands…"
          aria-label="Search 3D Space, ask Library AI, or open commands"
        />
        ${hasReactiveFilter &&
        html`<span className="kspace-match-pill">
          ${count} ${count === 1 ? 'match' : 'matches'}
        </span>`}
        ${(spaceQuery || aiAns || spaceFilterMode !== 'all') &&
        html`<button
          type="button"
          className="kspace-ask-clr"
          aria-label="Clear search and AI filter"
          title="Reset 3D Space"
          onClick=${clearSpaceSearch}
        >
          <${Ic} n="x" s=${13} />
        </button>`}
        <button
          type="button"
          className=${'kspace-ask-kbd' + (cmdOpen ? ' on' : '')}
          title=${`Quick commands & instant hits (${kb})`}
          aria-expanded=${cmdOpen}
          onClick=${() => {
            setKitsOpen(false);
            onSetCmdOpen && onSetCmdOpen(!cmdOpen);
          }}
        >
          ${cmdOpen ? 'Esc' : kb}
        </button>
        <button
          type="button"
          className="kspace-ask-btn"
          onClick=${() => {
            if (spaceQuery.trim() && onLogSearch) onLogSearch(spaceQuery.trim(), displayItems.length);
            if (onSetCmdOpen) onSetCmdOpen(false);
            runAi(spaceQuery);
          }}
        >
          Ask
        </button>
      </div>

      <div ref=${dockBarRef} className="kspace-dock-bar">
        <div className="kspace-chips-scroll">
          ${pinnedData.combined.length > 0 &&
          html`<button
            type="button"
            className=${'kspace-pchip kspace-pchip-acc' + (spaceFilterMode === 'pinned' ? ' on' : '')}
            onClick=${() => {
              setKitsOpen(false);
              setAiAns(null);
              setSpaceFilterMode((m) => (m === 'pinned' ? 'all' : 'pinned'));
            }}
            title="Spotlight highlights and pinned standards in 3D Space"
          >
            <${Ic} n="star" s=${11} f=${true} />
            <span>Pinned (${pinnedData.combined.length})</span>
          </button>`}

          ${visibleKits.length > 0 &&
          html`<button
            type="button"
            className=${'kspace-pchip kspace-pchip-kit' + (kitsOpen ? ' on' : '')}
            onClick=${() => setKitsOpen((v) => !v)}
            title="Starter Kits & Playbooks"
          >
            <${Ic} n="folder" s=${11} />
            <span>Starter Kits (${visibleKits.length})</span>
          </button>`}

          ${!aiAns &&
          AI_PROMPTS.map(
            (prompt) => html`<button
              key=${prompt.label}
              type="button"
              className="kspace-pchip"
              title=${prompt.query}
              onClick=${() => {
                setSpaceQuery(prompt.query);
                runAi(prompt.query);
              }}
            >
              ${prompt.label}
            </button>`
          )}
        </div>

        <div className="kspace-hud" role="toolbar" aria-label="Spatial navigation controls">
          <button
            type="button"
            className="kspace-hud-btn"
            aria-label="Rotate left"
            title="Rotate left (←)"
            onClick=${() => stepRotate(-1)}
          >
            <${Ic} n="chev" s=${13} />
          </button>

          ${layout.cols > 1 && layout.cols <= 18
            ? html`<div className="kspace-scrubber" role="group" aria-label="Jump to column">
                ${layout.colAngles.map(
                  (ca, cIdx) => html`<button
                    key=${ca.col}
                    ref=${(el) => {
                      dotRefs.current[cIdx] = el;
                    }}
                    type="button"
                    className=${'kspace-dot' + (cIdx === 0 ? ' on' : '')}
                    aria-label=${`Column ${cIdx + 1} of ${layout.cols}`}
                    title=${`Column ${cIdx + 1}/${layout.cols}`}
                    onClick=${() => rotateToAngle(ca.angle)}
                  ></button>`
                )}
              </div>`
            : null}

          <span ref=${hudColRef} className="kspace-hud-col">1/${layout.cols}</span>

          <button
            type="button"
            className="kspace-hud-btn next"
            aria-label="Rotate right"
            title="Rotate right (→)"
            onClick=${() => stepRotate(1)}
          >
            <${Ic} n="chev" s=${13} />
          </button>



          <span className="kspace-hud-sep" aria-hidden="true"></span>

          <div className="kspace-zoom-grp" role="group" aria-label="Spatial depth zoom">
            <button
              type="button"
              className="kspace-zoom-btn"
              aria-label="Zoom out"
              title="Zoom out (−)"
              onClick=${() => stepZoom(-65)}
            >
              −
            </button>
            <span ref=${hudZoomRef} className="kspace-hud-meta">100%</span>
            <button
              type="button"
              className="kspace-zoom-btn"
              aria-label="Zoom in"
              title="Zoom in (+)"
              onClick=${() => stepZoom(65)}
            >
              +
            </button>
          </div>

          <button
            ref=${resetBtnRef}
            type="button"
            className="kspace-hud-reset"
            hidden
            title="Center view (0)"
            onClick=${resetCamera}
          >
            Center
          </button>
        </div>
      </div>
    </div>
  </section>`;
}
