import { html, Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from '../../lib/react.js';
import { DC, DISC, TY, can, normRole, isResType } from '../../config/constants.js';
import { byId } from '../../data/spaces.js';
import { fmt } from '../../utils/format.js';
import { scoreDocument, tokenizeUnique, detectSearchIntent } from '../../utils/search.js';
import { plain } from '../../utils/markdown.js';
import { Ic } from '../../components/Icon.js';
import { Pill, VisPill } from '../../components/Badge.js';
import { ChatMessages } from '../../components/ChatMessages.js';

const AI_PROMPTS = [
  { label: 'Model naming', query: 'How should model files be named?' },
  { label: 'Clash detection', query: 'When is clash detection run?' },
  { label: 'BEP template', query: 'What is the BEP template?' },
];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function wrapDeg(deg) {
  return ((((deg % 360) + 540) % 360) - 180);
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
  onToggleFav,
  onRead,
  onInspect,
  isGuest = false,
  hasFilters = false,
  onResetFilters,
  f = {},
  setF,
  toolbarRight = null,
  spaceLeftNav = null,
  spaceActions = null,
  onClearCategory = null,
  onImportDocx = null,
  openChatSignal = 0,
  active = true,
  cmdOpen = false,
  onSetCmdOpen,
  recentSearches = [],
  onLogSearch,
  chats = [],
  activeChatId = null,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClearChats,
  onSendChat,
  onOpenNamingStudio,
  onFlagGap,
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
  const wakeMotionRef = useRef(() => {});
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
  const isMobile = vpWidth <= 768;
  const [reducedMotion, setReducedMotion] = useState(false);

  const [spaceQuery, setSpaceQuery] = useState(() => catalogQ || '');
  const [spaceFilterMode, setSpaceFilterMode] = useState('all'); // 'all' | 'bookmarks'
  const [showAllAfterAi, setShowAllAfterAi] = useState(false);
  const [kitsOpen, setKitsOpen] = useState(false);
  const [desktopChatOpen, setDesktopChatOpen] = useState(false);
  const [desktopHistoryOpen, setDesktopHistoryOpen] = useState(false);
  const [mobBrowseOpen, setMobBrowseOpen] = useState(false);
  const [mobMenuOpen, setMobMenuOpen] = useState(false);
  const [mobHistoryOpen, setMobHistoryOpen] = useState(false);
  const desktopChatEndRef = useRef(null);
  const mobChatEndRef = useRef(null);
  const [hoveredSourceId, setHoveredSourceId] = useState(null);
  const [cmdIdx, setCmdIdx] = useState(0);

  const activeChat = useMemo(
    () => (activeChatId ? chats.find((c) => c.id === activeChatId) || null : null),
    [chats, activeChatId]
  );

  useEffect(() => {
    if (!isMobile) {
      setMobMenuOpen(false);
      setMobBrowseOpen(false);
      setMobHistoryOpen(false);
    } else {
      setDesktopChatOpen(false);
      setDesktopHistoryOpen(false);
    }
  }, [isMobile]);

  const lastChatMsg =
    activeChat && activeChat.messages && activeChat.messages.length
      ? activeChat.messages[activeChat.messages.length - 1]
      : null;

  const activeAiTurn = useMemo(() => {
    if (!activeChat || !Array.isArray(activeChat.messages)) return null;
    for (let i = activeChat.messages.length - 1; i >= 0; i--) {
      if (activeChat.messages[i] && activeChat.messages[i].role === 'assistant') {
        return activeChat.messages[i];
      }
    }
    return null;
  }, [activeChat]);

  useEffect(() => {
    if (isMobile && activeChat && mobChatEndRef.current) {
      mobChatEndRef.current.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'end',
      });
    } else if (!isMobile && desktopChatOpen && activeChat && desktopChatEndRef.current) {
      desktopChatEndRef.current.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'end',
      });
    }
  }, [isMobile, desktopChatOpen, activeChat?.id, activeChat?.messages?.length, lastChatMsg?.busy, reducedMotion]);

  const suppressClickUntilRef = useRef(0);
  const snapTimerRef = useRef(null);

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
  const poolById = useMemo(() => {
    const map = new Map();
    (poolAll || []).forEach((r) => map.set(r.id, r));
    return map;
  }, [poolAll]);

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

  const queryIntent = useMemo(() => detectSearchIntent(spaceQuery), [spaceQuery]);

  // Reactive 3D Space items: responds to AI citations, live keyword search, or Bookmarks spotlight
  const reactive = useMemo(() => {
    const sourceOrderMap = new Map();
    const aiSpotlightOn = !isMobile && desktopChatOpen && activeAiTurn;
    if (aiSpotlightOn && Array.isArray(activeAiTurn.src)) {
      activeAiTurn.src.forEach((s, i) => sourceOrderMap.set(s.id, s.index || i + 1));
    }

    const rawQ = spaceQuery.trim();
    const tokens = tokenizeUnique(rawQ);
    const matchMap = new Map();

    if (rawQ) {
      const searchSource = items.length ? items : poolAll;
      const scored = searchSource
        .map((r) => ({ r, ...scoreDocument(r, rawQ, tokens) }))
        .filter((x) => x.score > 0);
      scored.sort((a, b) => b.matched - a.matched || b.score - a.score);
      scored.forEach((x) => matchMap.set(x.r.id, x));
    }

    // Mode 1: Personal Bookmarks spotlight in 3D Space / Mobile
    if (spaceFilterMode === 'bookmarks') {
      const bmList = (items.length ? items : poolAll).filter((r) => favs.includes(r.id));
      return {
        displayItems: bmList,
        sourceOrderMap,
        matchMap,
        mode: 'bookmarks',
      };
    }

    // Mode 2: Desktop AI Answer Source Spotlight in 3D Space
    if (aiSpotlightOn && !activeAiTurn.busy && sourceOrderMap.size > 0 && !showAllAfterAi) {
      const citedItems = [];
      const seenIds = new Set();

      activeAiTurn.src.forEach((s) => {
        const doc = poolAll.find((r) => r.id === s.id) || items.find((r) => r.id === s.id);
        if (doc && !seenIds.has(doc.id)) {
          seenIds.add(doc.id);
          citedItems.push(doc);
        }
      });

      return {
        displayItems: citedItems,
        sourceOrderMap,
        matchMap,
        mode: 'ai',
      };
    }

    // When showing all items alongside an open Desktop AI chat, bring cited items to the front columns
    if (aiSpotlightOn && sourceOrderMap.size > 0 && showAllAfterAi) {
      const front = [];
      const rest = [];
      activeAiTurn.src.forEach((s) => {
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

    // Mode 3: Live smart keyword search filtering (never jitters 3D cards when typing conversational questions)
    if (rawQ && (isMobile || (!desktopChatOpen && queryIntent === 'search'))) {
      const scoredList = [];
      matchMap.forEach((entry) => scoredList.push(entry));
      scoredList.sort((a, b) => b.matched - a.matched || b.score - a.score);
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
  }, [items, poolAll, favs, spaceQuery, queryIntent, isMobile, desktopChatOpen, activeAiTurn, spaceFilterMode, showAllAfterAi]);

  const displayItems = reactive.displayItems;
  const count = displayItems.length;
  const isCompact = vpWidth <= 920;

  const runAi = async (question) => {
    const t = String(question || '').trim();
    if (!t || !onSendChat) return;
    setSpaceFilterMode('all');
    setKitsOpen(false);
    setMobMenuOpen(false);
    setMobBrowseOpen(false);
    setMobHistoryOpen(false);
    setDesktopHistoryOpen(false);
    setShowAllAfterAi(false);
    if (!isMobile) setDesktopChatOpen(true);

    setSpaceQuery('');
    if (catalogQ && onCatalogQChange) onCatalogQChange('');

    await onSendChat({ query: t });
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
    if (!omniRectRef || !active || !askBarRef.current || dockAnimRef.current) return;
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
  }, [active, desktopChatOpen, activeChat?.id, activeAiTurn?.id, kitsOpen, cmdOpen]);

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
    if (!focusSignal) return;
    if (!activeChatId) {
      setDesktopChatOpen(false);
      setDesktopHistoryOpen(false);
      setMobBrowseOpen(false);
      setMobHistoryOpen(false);
      setMobMenuOpen(false);
      setKitsOpen(false);
    }
    if (askInputRef.current) {
      askInputRef.current.focus();
    }
  }, [focusSignal]);

  useEffect(() => {
    if (!openChatSignal) return;
    setSpaceFilterMode('all');
    setKitsOpen(false);
    setMobMenuOpen(false);
    setMobBrowseOpen(false);
    setMobHistoryOpen(false);
    setDesktopHistoryOpen(false);
    setShowAllAfterAi(false);
    if (!isMobile) setDesktopChatOpen(true);
  }, [openChatSignal, isMobile]);

  useEffect(() => {
    if (aq && aq.q) {
      setSpaceQuery(aq.q);
      runAi(aq.q);
    }
  }, [aq]);

  // Slightly shift scene up smoothly when a bottom glass sheet (Desktop Chat / Starter Kits) is open
  const hasOverlaySheet = Boolean((!isMobile && desktopChatOpen && activeChat) || kitsOpen);
  const hasOverlaySheetRef = useRef(false);
  hasOverlaySheetRef.current = hasOverlaySheet;

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
    sceneZOffset: 0,
    targetSceneZOffset: 0,
    sceneY: -28,
    dragging: false,
    didDrag: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastT: 0,
    dragDist: 0,
    lastColShown: -1,
    lastMovedShown: false,
  });

  // Automatically center the 3D carousel when query, AI spotlight, or filter changes (not when merely toggling chat)
  useEffect(() => {
    const m = motionRef.current;
    m.lastColShown = -1;
    hoveredIdxRef.current = -1;
    m.velYaw = 0;
    m.targetYaw = 0;
    const isFocusedSet = Boolean(
      (spaceQuery.trim() && (isMobile || (!desktopChatOpen && queryIntent === 'search'))) ||
        (!isMobile && desktopChatOpen && activeAiTurn) ||
        spaceFilterMode === 'bookmarks'
    );
    m.targetSceneZOffset = isFocusedSet && count > 0 && count <= 5 ? 55 : 0;
    wakeMotionRef.current();
  }, [
    spaceQuery,
    queryIntent,
    isMobile,
    activeAiTurn?.id,
    activeAiTurn?.busy,
    spaceFilterMode,
    pageTitle,
  ]);

  // Keep bounds sane if item count changes without query change
  useEffect(() => {
    const m = motionRef.current;
    if (!layout.fullRing) {
      m.targetYaw = clamp(m.targetYaw, -layout.maxYawBound, layout.maxYawBound);
      m.yaw = clamp(m.yaw, -layout.maxYawBound, layout.maxYawBound);
    }
    wakeMotionRef.current();
  }, [layout.cols, layout.fullRing, layout.maxYawBound]);

  // Wake sleeping 3D motion loop when bottom sheets toggle or items re-order
  useEffect(() => {
    wakeMotionRef.current();
  }, [hasOverlaySheet, displayItems, active]);

  // Schedule smooth settle onto nearest column after pointer drag momentum
  const scheduleSnap = (delayMs = 190) => {
    clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      const l = layoutRef.current;
      const m = motionRef.current;
      if (m.dragging || Math.abs(m.velYaw) > 0.08) return;
      const snapped = Math.round(m.targetYaw / l.stepDeg) * l.stepDeg;
      m.targetYaw = l.fullRing ? snapped : clamp(snapped, -l.maxYawBound, l.maxYawBound);
      wakeMotionRef.current();
    }, delayMs);
  };

  // On-demand 3D spatial loop: sleeps at 0fps when idle or hidden behind Reader/other views
  useEffect(() => {
    if (isMobile || !active) {
      wakeMotionRef.current = () => {};
      return undefined;
    }
    let rafId = 0;
    let alive = true;

    const scheduleFrame = () => {
      if (!alive || rafId) return;
      rafId = requestAnimationFrame(frame);
    };

    const frame = () => {
      rafId = 0;
      if (!alive) return;
      const l = layoutRef.current;
      const m = motionRef.current;
      let moving = m.dragging;

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
          moving = true;
        } else if (m.velYaw !== 0) {
          m.velYaw = 0;
        }
      }

      const ease = reducedMotion ? 1 : m.dragging ? 0.44 : 0.18;
      const dYaw = m.targetYaw - m.yaw;
      if (Math.abs(dYaw) < 0.01 || reducedMotion) {
        m.yaw = m.targetYaw;
      } else {
        m.yaw += dYaw * ease;
        moving = true;
      }

      const dZ = m.targetSceneZOffset - m.sceneZOffset;
      if (Math.abs(dZ) < 0.1 || reducedMotion) {
        m.sceneZOffset = m.targetSceneZOffset;
      } else {
        m.sceneZOffset += dZ * 0.18;
        moving = true;
      }

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
        const dSceneY = targetSceneY - m.sceneY;
        if (Math.abs(dSceneY) < 0.08 || reducedMotion) {
          m.sceneY = targetSceneY;
        } else {
          m.sceneY += dSceneY * 0.18;
          moving = true;
        }
        sceneRef.current.style.transform = `translate3d(0, ${m.sceneY.toFixed(1)}px, ${(l.sceneZ + m.sceneZOffset).toFixed(1)}px)`;
      }

      const positions = l.positions;
      const R = l.radius;
      const cullDeg = isCompact ? 88 : 98;
      const focusDeg = Math.max(26, l.stepDeg * 0.85);

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

        const targetLift = hoveredIdxRef.current === i && !m.dragging ? 1 : 0;
        const prevLift = hoverLiftRef.current[i] || 0;
        const liftDiff = targetLift - prevLift;
        let lift;
        if (Math.abs(liftDiff) < 0.005 || reducedMotion) {
          lift = targetLift;
        } else {
          lift = prevLift + liftDiff * 0.24;
          moving = true;
        }
        hoverLiftRef.current[i] = lift;

        const rad = (rel * Math.PI) / 180;
        const x = R * Math.sin(rad);
        const centerPresence =
          Math.max(0, Math.cos((Math.min(absRel, l.stepDeg) / Math.max(1, l.stepDeg)) * (Math.PI / 2))) * 14;
        const zDelta = lift * 9;
        const z = -R * Math.cos(rad) + centerPresence + zDelta;
        const rotY = -rel * 0.7;

        const t = Math.min(1, absRel / cullDeg);
        const sc = 1.03 - 0.24 * Math.pow(t, 1.35) + lift * 0.015;
        const baseOp = Math.max(0.24, 1 - 0.7 * Math.pow(t, 1.75));
        const op = lift > 0.05 ? Math.max(baseOp, Math.min(1, baseOp + lift * 0.08)) : baseOp;

        el.style.transform = `translate3d(${x.toFixed(1)}px, ${pos.y.toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${rotY.toFixed(2)}deg) scale3d(${sc.toFixed(3)}, ${sc.toFixed(3)}, 1)`;
        el.style.opacity = op.toFixed(3);
        el.style.zIndex = String(Math.round(200 - absRel + lift * 20));

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

      if (resetBtnRef.current) {
        const isMoved = Math.abs(m.yaw) > 4;
        if (isMoved !== m.lastMovedShown) {
          m.lastMovedShown = isMoved;
          resetBtnRef.current.hidden = !isMoved;
        }
      }

      if (moving) {
        scheduleFrame();
      }
    };

    wakeMotionRef.current = scheduleFrame;
    scheduleFrame();
    return () => {
      alive = false;
      wakeMotionRef.current = () => {};
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(snapTimerRef.current);
    };
  }, [active, layout, reducedMotion, isCompact, isMobile]);

  // Wheel navigation: vertical/horizontal scroll rotates carousel cleanly across mouse & trackpad
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) return;
      if (document.querySelector('.side.open, .ov')) return;
      if (e.target && e.target.closest && e.target.closest('.asel-menu,.pop,.dr,.kspace-dock,.kspace-cmd-pop')) return;
      e.preventDefault();
      const m = motionRef.current;
      const l = layoutRef.current;
      const modeScale = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 320 : 1;
      const dx = (e.deltaX || 0) * modeScale;
      const dy = (e.deltaY || 0) * modeScale;
      const dominant = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (!dominant) return;
      const rawDelta = clamp(dominant, -140, 140);
      clearTimeout(snapTimerRef.current);
      m.velYaw = 0;
      const nextYaw = m.targetYaw + rawDelta * 0.14;
      m.targetYaw = l.fullRing ? nextYaw : clamp(nextYaw, -l.maxYawBound, l.maxYawBound);
      wakeMotionRef.current();
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
    wakeMotionRef.current();
  };

  const resetCamera = () => {
    const m = motionRef.current;
    m.velYaw = 0;
    m.targetYaw = 0;
    wakeMotionRef.current();
  };

  const rotateToAngle = (colAngle) => {
    const l = layoutRef.current;
    const m = motionRef.current;
    if (!l.cols) return;
    m.velYaw = 0;
    if (!l.fullRing) {
      m.targetYaw = clamp(colAngle, -l.maxYawBound, l.maxYawBound);
      wakeMotionRef.current();
      return;
    }
    const diff = wrapDeg(colAngle - m.yaw);
    m.targetYaw = m.yaw + diff;
    wakeMotionRef.current();
  };

  const focusItemInSpace = (itemId) => {
    const idx = displayItems.findIndex((x) => x.id === itemId);
    if (idx < 0) return;
    const pos = layoutRef.current.positions[idx];
    if (pos) rotateToAngle(pos.angle);
    hoveredIdxRef.current = idx;
    setHoveredSourceId(itemId);
    wakeMotionRef.current();
  };

  const triggerOpenCard = (itemId, _idx = -1, _colAngle, sectionId = null) => {
    if (!onRead || !itemId) return;
    recordAskBarRect();
    if (onSetCmdOpen) onSetCmdOpen(false);
    const readOpts = sectionId ? { sectionId } : undefined;
    onRead(itemId, readOpts);
  };

  const openSourceFromChat = (s) => {
    if (!s || !s.id) return;
    if (isMobile) {
      triggerOpenCard(s.id, -1, undefined, s.sectionId || null);
      return;
    }
    const idx = displayItems.findIndex((x) => x.id === s.id);
    const colAngle = idx >= 0 && layout.positions[idx] ? layout.positions[idx].angle : undefined;
    triggerOpenCard(s.id, idx, colAngle, s.sectionId || null);
  };

  const clearSpaceSearch = () => {
    setSpaceQuery('');
    setDesktopChatOpen(false);
    setDesktopHistoryOpen(false);
    setSpaceFilterMode('all');
    setShowAllAfterAi(false);
    setMobBrowseOpen(false);
    setMobMenuOpen(false);
    setMobHistoryOpen(false);
    setHoveredSourceId(null);
    if (catalogQ && onCatalogQChange) onCatalogQChange('');
    resetCamera();
  };

  const startNewChatView = () => {
    if (onNewChat) onNewChat();
    setDesktopChatOpen(false);
    setDesktopHistoryOpen(false);
    setMobHistoryOpen(false);
    setMobBrowseOpen(false);
    setMobMenuOpen(false);
    setKitsOpen(false);
    setSpaceFilterMode('all');
    setShowAllAfterAi(false);
    setSpaceQuery('');
    setHoveredSourceId(null);
    if (catalogQ && onCatalogQChange) onCatalogQChange('');
    askInputRef.current && askInputRef.current.focus();
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    if (document.querySelector('.side.open, .ov')) return;
    if (e.target && e.target.closest && e.target.closest('button,a,input')) {
      if (e.target.closest('.acts,.kspace-open-link,.kspace-dock,.kspace-topbar')) return;
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
    if (!m.dragging || e.pointerId !== m.pointerId) return;
    const dxTotal = e.clientX - m.startX;
    const dyTotal = e.clientY - m.startY;
    m.dragDist = Math.hypot(dxTotal, dyTotal);

    if (m.dragDist > 9) {
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

      m.lastX = e.clientX;
      m.lastT = now;
      wakeMotionRef.current();
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
      wakeMotionRef.current();
    }
    m.didDrag = false;
  };

  const onViewportPointerLeave = () => {
    if (hoveredIdxRef.current !== -1) {
      hoveredIdxRef.current = -1;
      wakeMotionRef.current();
    }
  };

  // Global keyboard shortcuts when desktop 3D Space stage is active and unobscured
  useEffect(() => {
    if (!active || isMobile) return undefined;
    const onWinKeyDown = (e) => {
      if (e.defaultPrevented || cmdOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t &&
        (t.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) ||
          (t.closest && t.closest('.kspace-dock, .kspace-cmd-pop, .pop, .asel-menu, .dr')))
      ) {
        return;
      }
      if (document.querySelector('.side.open, .ov, .pop, .asel-menu')) return;

      if (e.key === '/') {
        e.preventDefault();
        askInputRef.current && askInputRef.current.focus();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepRotate(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepRotate(-1);
      } else if (e.key === '0' || e.key === 'Home') {
        e.preventDefault();
        resetCamera();
      }
    };
    window.addEventListener('keydown', onWinKeyDown);
    return () => window.removeEventListener('keydown', onWinKeyDown);
  }, [active, isMobile, cmdOpen]);

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
      ? queryIntent === 'question'
        ? items
            .map((r) => {
              const sc = scoreDocument(r, qTrim);
              return sc.matched > 0 ? { r, sc } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.sc.matched - a.sc.matched || b.sc.score - a.sc.score)
            .slice(0, 5)
            .map((x) => x.r)
        : displayItems.slice(0, 5)
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
      ...(onImportDocx ? [['Import .docx document', 'doc', 'import-docx']] : []),
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
          if (a[2] === 'import-docx') {
            onImportDocx && onImportDocx();
            return;
          }
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

  const activeDisc = f.disc || '';
  const envAccent = (f.disc && DC[f.disc]) || (curCat && curCat.color) || '#2997ff';
  const hasReactiveFilter = Boolean(
    (spaceQuery.trim() && (isMobile || (!desktopChatOpen && queryIntent === 'search'))) ||
      (!isMobile && desktopChatOpen && activeAiTurn) ||
      spaceFilterMode === 'bookmarks'
  );
  const isNarrowed = Boolean(hasReactiveFilter || curCat || activeDisc || (allCount > 0 && count !== allCount));

  return html`<section
    className="kspace-stage"
    style=${{ '--env-accent': envAccent }}
    aria-label=${`${pageTitle} — Spatial Knowledge View`}
  >
    <div className="kspace-topbar">
      <div className="kspace-head">
        <div className="kspace-title-row">
          ${spaceLeftNav || html`<h1>${pageTitle}</h1>`}
          ${curCat &&
          html`<span className="kspace-cat-pill" style=${{ '--cc': curCat.color || '#0a84ff' }}>
            <i></i>
            <span>${curCat.path ? curCat.path.join(' › ') : curCat.name}</span>
            ${onClearCategory &&
            html`<button
              type="button"
              className="kspace-cat-clr"
              title="Show all items"
              aria-label="Clear category filter"
              onClick=${onClearCategory}
            >
              <${Ic} n="x" s=${11} />
            </button>`}
          </span>`}
          ${activeDisc &&
          html`<span className="kspace-cat-pill" style=${{ '--cc': DC[activeDisc] || '#0a84ff' }}>
            <i></i>
            <span>${activeDisc}</span>
            ${setF &&
            html`<button
              type="button"
              className="kspace-cat-clr"
              title="Clear discipline filter"
              aria-label="Clear discipline filter"
              onClick=${() => setF({ ...f, disc: undefined })}
            >
              <${Ic} n="x" s=${11} />
            </button>`}
          </span>`}
          ${isNarrowed &&
          html`<span
            className="kspace-cnt"
            title=${`${count} in view of ${allCount} items`}
          >${`${count}/${allCount || items.length}`}</span>`}
        </div>
      </div>

      ${(toolbarRight || spaceActions) &&
      html`<div className="kspace-controls">
        ${toolbarRight}
        ${spaceActions}
      </div>`}
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
                  (isHighlighted ? ' is-spotlight' : '')}
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
                  wakeMotionRef.current();
                }}
                onPointerLeave=${() => {
                  if (hoveredIdxRef.current === idx) {
                    hoveredIdxRef.current = -1;
                    wakeMotionRef.current();
                  }
                }}
                onFocus=${(e) => {
                  if (e.currentTarget.matches && e.currentTarget.matches(':focus-visible')) {
                    rotateToAngle(colAngle);
                  }
                }}
                onClick=${() => {
                  if (performance.now() < suppressClickUntilRef.current) return;
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

      ${!isMobile &&
      !desktopChatOpen &&
      !cmdOpen &&
      !kitsOpen &&
      spaceQuery.trim() &&
      queryIntent === 'search' &&
      displayItems.length > 0 &&
      html`<div className="kspace-quick-hits" role="region" aria-label="Quick matching standards">
        <span className="kspace-qh-label">Quick hits</span>
        <div className="kspace-qh-list">
          ${displayItems.slice(0, 4).map(
            (r) => html`<button
              key=${r.id}
              type="button"
              className=${'kspace-qh-pill' + (hoveredSourceId === r.id ? ' on' : '')}
              style=${{ '--c': DC[r.disc] || '#0a84ff' }}
              onMouseEnter=${() => focusItemInSpace(r.id)}
              onMouseLeave=${() => setHoveredSourceId(null)}
              onClick=${() => {
                if (onLogSearch) onLogSearch(spaceQuery.trim(), displayItems.length);
                openSourceFromChat({ id: r.id });
              }}
              title="Hover to center in 3D Space · Click to open"
            >
              <i className="kspace-mob-dot" />
              <span className="kspace-qh-title">${r.title}</span>
              <span className="kspace-qh-disc">${r.disc || 'General'}</span>
              <span className="kspace-src-go">↗</span>
            </button>`
          )}
        </div>
        <button
          type="button"
          className="kspace-qh-ask"
          onClick=${() => {
            if (onLogSearch) onLogSearch(spaceQuery.trim(), displayItems.length);
            runAi(spaceQuery);
          }}
        >
          <${Ic} n="spark" s=${12} />
          <span>Ask AI ↵</span>
        </button>
      </div>`}

      ${!isMobile &&
      desktopChatOpen &&
      activeChat &&
      !kitsOpen &&
      html`<div className="kspace-chat-panel" role="region" aria-label="Datum AI Chat">
        <div className="kspace-ai-head">
          <span className="kspace-ai-badge">
            <${Ic} n="spark" s=${13} /> Datum AI
          </span>
          <span className="kspace-ai-q">${activeChat.title || 'Conversation'}</span>
          <div className="kspace-pop-acts">
            ${chats.length > 0 &&
            html`<div className="kspace-hist-wrap">
              <button
                type="button"
                className=${'kspace-mini-btn' + (desktopHistoryOpen ? ' on' : '')}
                onClick=${() => setDesktopHistoryOpen((v) => !v)}
              >
                Chats (${chats.length})
              </button>
              ${desktopHistoryOpen &&
              html`<div className="kspace-hist-pop" role="menu" aria-label="Saved conversations">
                <div className="kspace-hist-head">
                  <b>Recent Chats (${chats.length})</b>
                  ${onClearChats &&
                  html`<button
                    type="button"
                    className="kspace-mini-btn"
                    onClick=${() => {
                      onClearChats();
                      setDesktopHistoryOpen(false);
                      setDesktopChatOpen(false);
                    }}
                  >
                    Clear all
                  </button>`}
                </div>
                <div className="kspace-hist-list">
                  ${chats.map((c) => {
                    const isCur = c.id === activeChatId;
                    const turnCount = (c.messages || []).filter((m) => m.role === 'user').length;
                    return html`<div key=${c.id} className=${'kspace-hist-row' + (isCur ? ' on' : '')}>
                      <button
                        type="button"
                        className="kspace-hist-pick"
                        onClick=${() => {
                          onSelectChat && onSelectChat(c.id);
                          setDesktopHistoryOpen(false);
                          setShowAllAfterAi(false);
                        }}
                      >
                        <span className="kspace-hist-t">${c.title}</span>
                        <span className="kspace-hist-m">${turnCount} ${turnCount === 1 ? 'turn' : 'turns'}</span>
                      </button>
                      ${onDeleteChat &&
                      html`<button
                        type="button"
                        className="kspace-hist-del"
                        aria-label="Delete conversation"
                        onClick=${() => {
                          onDeleteChat(c.id);
                          if (chats.length <= 1) {
                            setDesktopHistoryOpen(false);
                            setDesktopChatOpen(false);
                          }
                        }}
                      >
                        <${Ic} n="trash" s=${12} />
                      </button>`}
                    </div>`;
                  })}
                </div>
              </div>`}
            </div>`}
            <button
              type="button"
              className="kspace-mini-btn"
              onClick=${startNewChatView}
              title="Start a new chat thread"
            >
              + New
            </button>
            ${activeAiTurn &&
            activeAiTurn.src &&
            activeAiTurn.src.length > 0 &&
            items.length > activeAiTurn.src.length &&
            html`<button
              type="button"
              className="kspace-mini-btn"
              onClick=${() => setShowAllAfterAi((v) => !v)}
            >
              ${showAllAfterAi ? `Focus sources (${activeAiTurn.src.length})` : `Show all (${items.length})`}
            </button>`}
            <button
              type="button"
              className="kspace-pop-x"
              aria-label="Minimize AI chat"
              title="Minimize chat panel"
              onClick=${() => {
                setDesktopChatOpen(false);
                setDesktopHistoryOpen(false);
                setShowAllAfterAi(false);
                setHoveredSourceId(null);
                resetCamera();
              }}
            >
              <${Ic} n="x" s=${13} />
            </button>
          </div>
        </div>

        <div className="kspace-chat-body">
          <${ChatMessages}
            messages=${activeChat.messages || []}
            poolById=${poolById}
            favs=${favs}
            isGuest=${isGuest}
            compact=${true}
            onSelectSource=${openSourceFromChat}
            onHoverSource=${(id) => (id ? focusItemInSpace(id) : setHoveredSourceId(null))}
            onOpenCard=${(id) => openSourceFromChat({ id })}
            onToggleFav=${onToggleFav}
            onOpenNamingStudio=${onOpenNamingStudio}
            onFlagGap=${onFlagGap}
            endRef=${desktopChatEndRef}
          />
        </div>
      </div>`}

      ${isMobile &&
      (activeChat || mobHistoryOpen || mobBrowseOpen || spaceFilterMode === 'bookmarks' || Boolean(f && f.disc)) &&
      html`<div className="kspace-mob-toprow">
        ${chats.length > 0 &&
        html`<button
          type="button"
          className=${'kspace-mob-top-pill' + (mobHistoryOpen ? ' on' : '')}
          onClick=${() => {
            setMobHistoryOpen((v) => !v);
            setMobBrowseOpen(false);
            setMobMenuOpen(false);
            setKitsOpen(false);
          }}
        >
          <${Ic} n="clock" s=${14} />
          <span>Chats (${chats.length})</span>
        </button>`}
        <button
          type="button"
          className="kspace-mob-top-pill is-accent"
          aria-label="New chat"
          onClick=${startNewChatView}
        >
          <${Ic} n="plus" s=${14} />
          <span>New</span>
        </button>
      </div>`}

      ${isMobile &&
      mobMenuOpen &&
      html`<${Fragment}>
        <div
          className="kspace-mob-scrim"
          aria-hidden="true"
          onClick=${() => setMobMenuOpen(false)}
        />
        <div className="kspace-mob-sheet" role="dialog" aria-label="Quick menu">
          <div className="kspace-pop-head">
            <div>
              <b>Quick Menu</b>
              <small>Chats, Bookmarks, Naming Studio & Filters</small>
            </div>
            <button
              type="button"
              className="kspace-pop-x"
              aria-label="Close menu"
              onClick=${() => setMobMenuOpen(false)}
            >
              <${Ic} n="x" s=${14} />
            </button>
          </div>

          <div className="kspace-mob-discs" role="group" aria-label="Filter by discipline">
            <button
              type="button"
              className=${'kspace-disc-btn' + (!f || !f.disc ? ' on' : '')}
              onClick=${() => {
                if (setF) setF((prev) => ({ ...prev, disc: undefined }));
                setMobMenuOpen(false);
              }}
            >
              All
            </button>
            ${DISC.map(
              (d) => html`<button
                key=${d}
                type="button"
                className=${'kspace-disc-btn' + (f && f.disc === d ? ' on' : '')}
                style=${{ '--dc': DC[d] }}
                onClick=${() => {
                  const next = f && f.disc === d ? undefined : d;
                  if (setF) setF((prev) => ({ ...prev, disc: next }));
                  setSpaceFilterMode('all');
                  setMobHistoryOpen(false);
                  setMobBrowseOpen(Boolean(next));
                  setMobMenuOpen(false);
                }}
              >
                <span className="kspace-disc-dot" />
                <span>${d}</span>
              </button>`
            )}
          </div>

          <div className="kspace-mob-sheet-list">
            ${(activeChat || mobBrowseOpen || mobHistoryOpen) &&
            html`<button
              type="button"
              className="kspace-mob-sheet-row"
              onClick=${startNewChatView}
            >
              <${Ic} n="plus" s=${16} />
              <span>New Search Chat</span>
            </button>`}
            <button
              type="button"
              className="kspace-mob-sheet-row"
              onClick=${() => {
                setMobMenuOpen(false);
                setKitsOpen(false);
                setMobBrowseOpen(false);
                setMobHistoryOpen(true);
              }}
            >
              <${Ic} n="clock" s=${16} />
              <span>Saved Chats (${chats.length})</span>
            </button>
            ${!isGuest &&
            html`<button
              type="button"
              className="kspace-mob-sheet-row"
              onClick=${() => {
                setMobMenuOpen(false);
                setMobHistoryOpen(false);
                setMobBrowseOpen(false);
                setSpaceFilterMode((m) => (m === 'bookmarks' ? 'all' : 'bookmarks'));
              }}
            >
              <${Ic} n="star" s=${16} />
              <span>Bookmarks (${favs.length})</span>
              ${spaceFilterMode === 'bookmarks' && html`<span className="kspace-mob-sheet-tag">Active</span>`}
            </button>`}
            <button
              type="button"
              className="kspace-mob-sheet-row"
              onClick=${() => {
                setMobMenuOpen(false);
                setKitsOpen(true);
              }}
            >
              <${Ic} n="folder" s=${16} />
              <span>Starter Kits (${visibleKits.length})</span>
            </button>
            <button
              type="button"
              className="kspace-mob-sheet-row"
              onClick=${() => {
                setMobMenuOpen(false);
                setMobHistoryOpen(false);
                setMobBrowseOpen(true);
              }}
            >
              <${Ic} n="book" s=${16} />
              <span>Browse Standards (${items.length})</span>
            </button>
            <button
              type="button"
              className="kspace-mob-sheet-row"
              onClick=${() => {
                setMobMenuOpen(false);
                onCommand && onCommand('view', 'naming');
              }}
            >
              <${Ic} n="sliders" s=${16} />
              <span>Wall Naming Studio</span>
            </button>
            ${can.createDraft(role) &&
            html`<button
              type="button"
              className="kspace-mob-sheet-row"
              onClick=${() => {
                setMobMenuOpen(false);
                onCommand && onCommand('new');
              }}
            >
              <${Ic} n="plus" s=${16} />
              <span>New Document / Standard</span>
            </button>`}
            <button
              type="button"
              className="kspace-mob-sheet-row"
              onClick=${() => {
                setMobMenuOpen(false);
                onCommand && onCommand('theme');
              }}
            >
              <${Ic} n="spark" s=${16} />
              <span>Switch Light / Dark Theme</span>
            </button>
          </div>

          <div className="kspace-mob-prompts">
            ${AI_PROMPTS.map(
              (prompt) => html`<button
                key=${prompt.label}
                type="button"
                className="kspace-pchip kspace-pchip-acc"
                onClick=${() => {
                  if (onLogSearch) onLogSearch(prompt.query, displayItems.length);
                  runAi(prompt.query);
                }}
              >
                <${Ic} n="spark" s=${12} />
                <span>${prompt.label}</span>
              </button>`
            )}
          </div>
        </div>
      </${Fragment}>`}

      ${isMobile &&
      mobHistoryOpen &&
      !kitsOpen &&
      !cmdOpen &&
      html`<div className="kspace-mob-results">
        <div className="kspace-mob-res-head">
          <div className="kspace-mob-res-title">
            <b>Saved Chats</b>
            <span>${chats.length}</span>
          </div>
          <div className="kspace-mob-res-acts">
            ${chats.length > 0 &&
            onClearChats &&
            html`<button
              type="button"
              className="kspace-mini-btn"
              onClick=${onClearChats}
            >
              Clear all
            </button>`}
            <button
              type="button"
              className="kspace-mini-btn"
              onClick=${() => setMobHistoryOpen(false)}
            >
              Close
            </button>
          </div>
        </div>

        <div className="kspace-mob-list">
          ${chats.length === 0
            ? html`<div className="kspace-mob-empty">
                <p>Your conversations across Mobile, Desktop, and Reader are saved here.</p>
                <button
                  type="button"
                  className="btn p"
                  onClick=${() => {
                    setMobHistoryOpen(false);
                    askInputRef.current && askInputRef.current.focus();
                  }}
                >
                  <${Ic} n="spark" s=${14} />
                  <span>Start a chat</span>
                </button>
              </div>`
            : chats.map((c) => {
                const lastBot = [...(c.messages || [])].reverse().find((m) => m.role === 'assistant');
                const preview = lastBot && lastBot.text ? plain(lastBot.text).slice(0, 110) : '';
                const turnCount = (c.messages || []).filter((m) => m.role === 'user').length;
                const isCur = c.id === activeChatId;
                return html`<div
                  key=${c.id}
                  className=${'kspace-mob-hist-item' + (isCur ? ' on' : '')}
                >
                  <button
                    type="button"
                    className="kspace-mob-hist-main"
                    onClick=${() => {
                      onSelectChat && onSelectChat(c.id);
                      setMobHistoryOpen(false);
                      setMobBrowseOpen(false);
                      setSpaceFilterMode('all');
                    }}
                  >
                    <div className="kspace-mob-card-top">
                      <span className="kspace-mob-disc">
                        <${Ic} n="clock" s=${12} />
                        <span>${turnCount} ${turnCount === 1 ? 'query' : 'queries'}</span>
                      </span>
                      <span className="kspace-mob-meta">
                        ${c.updatedAt ? new Date(c.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                    <div className="kspace-mob-card-title">${c.title}</div>
                    ${preview && html`<div className="kspace-mob-card-desc">${preview}</div>`}
                  </button>
                  ${onDeleteChat &&
                  html`<button
                    type="button"
                    className="kspace-mob-hist-del"
                    aria-label="Delete saved search"
                    onClick=${() => onDeleteChat(c.id)}
                  >
                    <${Ic} n="trash" s=${14} />
                  </button>`}
                </div>`;
              })}
        </div>
      </div>`}

      ${isMobile &&
      !mobHistoryOpen &&
      !kitsOpen &&
      !cmdOpen &&
      (() => {
        const showResults =
          mobBrowseOpen ||
          spaceFilterMode === 'bookmarks' ||
          Boolean(f && f.disc) ||
          (!activeChat && Boolean(spaceQuery.trim()));

        if (showResults) {
          const mobHeading =
            spaceFilterMode === 'bookmarks'
              ? 'Bookmarks'
              : f && f.disc
              ? f.disc
              : spaceQuery.trim()
              ? 'Matching Standards'
              : 'All Standards';
          return html`<div className="kspace-mob-results">
            <div className="kspace-mob-res-head">
              <div className="kspace-mob-res-title">
                <b>${mobHeading}</b>
                <span>${displayItems.length}</span>
              </div>
              <div className="kspace-mob-res-acts">
                ${spaceQuery.trim() &&
                html`<button
                  type="button"
                  className="kspace-mini-btn"
                  onClick=${() => {
                    if (onLogSearch) onLogSearch(spaceQuery.trim(), displayItems.length);
                    runAi(spaceQuery);
                  }}
                >
                  Ask AI
                </button>`}
                <button
                  type="button"
                  className="kspace-mini-btn"
                  onClick=${() => {
                    clearSpaceSearch();
                    if (setF && f && f.disc) setF((prev) => ({ ...prev, disc: undefined }));
                  }}
                >
                  ${activeChat ? 'Back to chat' : 'Close'}
                </button>
              </div>
            </div>

            <div className="kspace-mob-list">
              ${displayItems.length === 0
                ? html`<div className="kspace-mob-empty">
                    <p>No matching standards for “${spaceQuery.trim() || mobHeading}”.</p>
                    <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      ${spaceQuery.trim() &&
                      html`<button
                        type="button"
                        className="btn p"
                        onClick=${() => runAi(spaceQuery)}
                      >
                        <${Ic} n="spark" s=${14} />
                        <span>Ask Datum AI</span>
                      </button>`}
                      ${spaceQuery.trim() &&
                      onFlagGap &&
                      html`<button
                        type="button"
                        className="btn"
                        onClick=${() => onFlagGap(spaceQuery.trim())}
                      >
                        <${Ic} n="plus" s=${14} />
                        <span>Flag missing standard</span>
                      </button>`}
                    </div>
                  </div>`
                : displayItems.map(
                    (r) => html`<button
                      key=${r.id}
                      type="button"
                      className="kspace-mob-card"
                      style=${{ '--c': DC[r.disc] || '#0a84ff' }}
                      onClick=${() => {
                        if (spaceQuery.trim() && onLogSearch) {
                          onLogSearch(spaceQuery.trim(), displayItems.length);
                        }
                        triggerOpenCard(r.id);
                      }}
                    >
                      <div className="kspace-mob-card-top">
                        <span className="kspace-mob-disc">
                          <i className="kspace-mob-dot" />
                          <span>${r.disc || 'General'}</span>
                        </span>
                        <span className="kspace-mob-meta">
                          ${TY[r.type] || 'Document'}${r.upd ? ` · ${fmt(r.upd)}` : ''}
                        </span>
                      </div>
                      <div className="kspace-mob-card-title">${r.title}</div>
                      ${r.desc && html`<div className="kspace-mob-card-desc">${r.desc}</div>`}
                    </button>`
                  )}
            </div>
          </div>`;
        }

        if (activeChat && activeChat.messages && activeChat.messages.length > 0) {
          return html`<div className="kspace-mob-chat">
            <${ChatMessages}
              messages=${activeChat.messages}
              poolById=${poolById}
              favs=${favs}
              isGuest=${isGuest}
              onSelectSource=${openSourceFromChat}
              onOpenCard=${(id) => triggerOpenCard(id)}
              onToggleFav=${onToggleFav}
              onOpenNamingStudio=${onOpenNamingStudio}
              onFlagGap=${onFlagGap}
              endRef=${mobChatEndRef}
            />
          </div>`;
        }

        return html`<div className="kspace-mob-welcome">
          <div className="kspace-mob-hero">
            <span className="kspace-ai-badge"><${Ic} n="spark" s=${12} /> Datum Chat-First</span>
            <h2>Ask or search standards</h2>
            <p>13-slot naming rules, wall assemblies & BIM QA — ask in English or Ukrainian.</p>
            <div className="kspace-mob-hero-chips">
              ${AI_PROMPTS.slice(0, 3).map(
                (p) => html`<button
                  key=${p.label}
                  type="button"
                  className="kspace-pchip kspace-pchip-acc"
                  onClick=${() => {
                    if (onLogSearch) onLogSearch(p.query, displayItems.length);
                    runAi(p.query);
                  }}
                >
                  <${Ic} n="spark" s=${11} />
                  <span>${p.label}</span>
                </button>`
              )}
            </div>
          </div>

          <div className="kspace-mob-actions" role="group" aria-label="Quick actions">
            ${chats.length > 0
              ? html`<button
                  type="button"
                  className="kspace-mob-act"
                  onClick=${() => {
                    setMobHistoryOpen(true);
                    setMobMenuOpen(false);
                  }}
                >
                  <span className="kspace-mob-act-ico"><${Ic} n="clock" s=${19} /></span>
                  <span>Saved chats (${chats.length})</span>
                </button>`
              : !isGuest &&
                html`<button
                  type="button"
                  className="kspace-mob-act"
                  onClick=${() => {
                    setSpaceFilterMode('bookmarks');
                    setMobMenuOpen(false);
                  }}
                >
                  <span className="kspace-mob-act-ico"><${Ic} n="star" s=${19} /></span>
                  <span>Bookmarks (${favs.length})</span>
                </button>`}
            <button
              type="button"
              className="kspace-mob-act"
              onClick=${() => onCommand && onCommand('view', 'naming')}
            >
              <span className="kspace-mob-act-ico"><${Ic} n="sliders" s=${19} /></span>
              <span>Wall Naming Studio</span>
            </button>
            <button
              type="button"
              className="kspace-mob-act"
              onClick=${() => {
                setKitsOpen(true);
                setMobMenuOpen(false);
              }}
            >
              <span className="kspace-mob-act-ico"><${Ic} n="folder" s=${19} /></span>
              <span>Starter Kits (${visibleKits.length})</span>
            </button>
            <button
              type="button"
              className="kspace-mob-act"
              onClick=${() => setMobBrowseOpen(true)}
            >
              <span className="kspace-mob-act-ico"><${Ic} n="book" s=${19} /></span>
              <span>Browse Standards (${items.length})</span>
            </button>
          </div>
        </div>`;
      })()}

      <div ref=${askBarRef} className=${'kspace-ask-bar' + ((lastChatMsg && lastChatMsg.busy && (desktopChatOpen || isMobile)) ? ' is-busy' : '')}>
        ${isMobile
          ? html`<button
              type="button"
              className="kspace-mob-plus"
              aria-label=${mobMenuOpen ? 'Close quick menu' : 'Open quick menu'}
              aria-expanded=${mobMenuOpen}
              onClick=${() => {
                setMobMenuOpen((v) => !v);
                setKitsOpen(false);
                if (onSetCmdOpen) onSetCmdOpen(false);
              }}
            >
              <${Ic} n=${mobMenuOpen ? 'x' : 'plus'} s=${18} />
            </button>`
          : html`<span className="kspace-ask-ico" aria-hidden="true">
              <${Ic} n="spark" s=${17} />
            </span>`}
        <input
          ref=${askInputRef}
          type="text"
          value=${spaceQuery}
          onChange=${(e) => {
            const val = e.target.value;
            setSpaceQuery(val);
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
            } else if (e.key === 'Escape' && (spaceQuery || desktopChatOpen || spaceFilterMode !== 'all')) {
              e.preventDefault();
              clearSpaceSearch();
            }
          }}
          placeholder=${isMobile
            ? activeChat
              ? 'Ask follow-up or search…'
              : 'Search Datum or ask AI (EN/UA)…'
            : desktopChatOpen && activeChat
            ? 'Ask follow-up, paste wall code, or search section…'
            : 'Search 3D Space, ask Datum AI (EN/UA), or press Ctrl+K…'}
          aria-label="Search 3D Space, ask Datum AI, or open commands"
        />
        ${hasReactiveFilter &&
        (isMobile
          ? html`<button
              type="button"
              className="kspace-match-pill"
              onClick=${() => {
                setMobHistoryOpen(false);
                setMobBrowseOpen((v) => !v);
              }}
            >
              ${count} ${count === 1 ? 'match' : 'matches'}
            </button>`
          : html`<span className="kspace-match-pill">
              ${count} ${count === 1 ? 'match' : 'matches'}
            </span>`)}
        ${(spaceQuery || (!isMobile && desktopChatOpen && activeChat) || spaceFilterMode !== 'all') &&
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
          aria-label="Ask Datum AI"
          onClick=${() => {
            if (isMobile && !spaceQuery.trim()) {
              setMobMenuOpen((v) => !v);
              setKitsOpen(false);
              return;
            }
            if (spaceQuery.trim() && onLogSearch) onLogSearch(spaceQuery.trim(), displayItems.length);
            if (onSetCmdOpen) onSetCmdOpen(false);
            runAi(spaceQuery);
          }}
        >
          ${isMobile ? html`<${Ic} n="spark" s=${16} />` : 'Ask'}
        </button>
      </div>

      <div ref=${dockBarRef} className="kspace-dock-bar">
        <div className="kspace-chips-scroll">
          ${!isGuest &&
          favs.length > 0 &&
          html`<button
            type="button"
            className=${'kspace-pchip kspace-pchip-acc' + (spaceFilterMode === 'bookmarks' ? ' on' : '')}
            onClick=${() => {
              setKitsOpen(false);
              setDesktopChatOpen(false);
              setSpaceFilterMode((m) => (m === 'bookmarks' ? 'all' : 'bookmarks'));
            }}
            title="Spotlight your bookmarked standards in 3D Space"
          >
            <${Ic} n="star" s=${11} f=${true} />
            <span>Bookmarks (${favs.length})</span>
          </button>`}

          ${!isMobile &&
          chats.length > 0 &&
          html`<button
            type="button"
            className=${'kspace-pchip kspace-pchip-acc' + (desktopChatOpen ? ' on' : '')}
            onClick=${() => {
              setKitsOpen(false);
              setSpaceFilterMode('all');
              if (!activeChatId && chats[0] && onSelectChat) {
                onSelectChat(chats[0].id);
              }
              setDesktopChatOpen((v) => !v);
            }}
            title="Reopen threaded AI conversations"
          >
            <${Ic} n="spark" s=${11} />
            <span>Chats (${chats.length})</span>
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

          ${!desktopChatOpen &&
          !spaceQuery.trim() &&
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

          <span ref=${hudColRef} className=${'kspace-hud-col' + (layout.cols <= 1 || layout.cols > 18 ? ' show' : '')}>1/${layout.cols}</span>

          <button
            type="button"
            className="kspace-hud-btn next"
            aria-label="Rotate right"
            title="Rotate right (→)"
            onClick=${() => stepRotate(1)}
          >
            <${Ic} n="chev" s=${13} />
          </button>

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
