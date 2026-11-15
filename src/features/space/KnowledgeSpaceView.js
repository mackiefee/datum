import { html, Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from '../../lib/react.js';
import { DC, DISC, TY, can, normRole, isResType } from '../../config/constants.js';
import { byId } from '../../data/spaces.js';
import { fmt } from '../../utils/format.js';
import { scoreDocument, tokenizeUnique, detectSearchIntent } from '../../utils/search.js';
import { plain } from '../../utils/markdown.js';
import { Ic, DatumMark } from '../../components/Icon.js';
import { Pill, VisPill } from '../../components/Badge.js';
import { ChatMessages } from '../../components/ChatMessages.js';
import { Select } from '../../components/Select.js';
import { TIER_LABEL, TIER_COL, canEditCol, KitComposerModal } from '../collections/CollectionsView.js';
import {
  clamp,
  wrapDeg,
  computeSpaceLayout,
  computeGridLayout,
  computeGraphData,
  computeGraphEdgeSvg,
} from './spatialLayouts.js';

const AI_PROMPTS = [
  { label: 'Model naming', query: 'How should model files be named?' },
  { label: 'Clash detection', query: 'When is clash detection run?' },
  { label: 'BEP template', query: 'What is the BEP template?' },
];

/**
 * Unified Spatial Knowledge Canvas (Minimal Chat-First Hero · 3D Space · Flat Grid · Live Card Graph · Starter Kits)
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
  viewMode = 'space',
  onSelectViewMode,
  stageOpen = true,
  onStageOpenChange,
  heroResetSignal = 0,
  activeKitId = null,
  onSelectKit,
  kitTier = 'all',
  onKitTierChange,
  creatingKit = false,
  onCreatingKitChange,
  onAddCol,
  onSaveCol,
  onDelCol,
  onOpenPublic,
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
  const dockWrapRef = useRef(null);
  const dockFlipPrevRef = useRef(null);
  const wasHeroRef = useRef(null);
  const cardRefs = useRef([]);
  const cardAnimRef = useRef(new Map());
  const edgePathRefs = useRef([]);
  const edgeArrowRefs = useRef([]);
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
  const wasStageOpenAnimRef = useRef(false);
  const graphCustomPosRef = useRef(new Map());
  const graphNodesRef = useRef([]);
  const graphNodeByIdRef = useRef(new Map());
  const graphEdgesRef = useRef([]);
  const graphEdgeGroupRefs = useRef([]);
  const gridHudRef = useRef(null);

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
  const [desktopChatOpen, setDesktopChatOpen] = useState(false);
  const [desktopHistoryOpen, setDesktopHistoryOpen] = useState(false);
  const [mobBrowseOpen, setMobBrowseOpen] = useState(false);
  const [mobMenuOpen, setMobMenuOpen] = useState(false);
  const [mobHistoryOpen, setMobHistoryOpen] = useState(false);
  const desktopChatEndRef = useRef(null);
  const mobChatEndRef = useRef(null);
  const [hoveredSourceId, setHoveredSourceId] = useState(null);
  const [cmdIdx, setCmdIdx] = useState(0);

  // Graph & Kits spatial interaction states
  const [graphSelectedId, setGraphSelectedId] = useState(null);
  const [graphHoverId, setGraphHoverId] = useState(null);
  const [graphIncludeSoft, setGraphIncludeSoft] = useState(true);
  const [graphIncludeOrphans, setGraphIncludeOrphans] = useState(true);
  const [graphOptsOpen, setGraphOptsOpen] = useState(false);
  const [graphZoomPct, setGraphZoomPct] = useState(78);
  const [graphLayoutRev, setGraphLayoutRev] = useState(0);
  const [addingToKitOpen, setAddingToKitOpen] = useState(false);
  const [kitAddItemId, setKitAddItemId] = useState('');
  const [kitAddNote, setKitAddNote] = useState('');
  const [confirmDelKitId, setConfirmDelKitId] = useState(null);
  const [localCreatingKit, setLocalCreatingKit] = useState(false);

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

  const visibleKits = cols;

  const activeKit = useMemo(
    () => (activeKitId ? cols.find((c) => c.id === activeKitId) || null : null),
    [cols, activeKitId]
  );

  const filteredKits = useMemo(() => {
    const qLow = spaceQuery.trim().toLowerCase();
    return visibleKits.filter((c) => {
      if (kitTier !== 'all' && c.tier !== kitTier) return false;
      if (qLow) {
        const hay = `${c.name || ''} ${c.desc || ''} ${c.owner || ''}`.toLowerCase();
        if (!hay.includes(qLow)) return false;
      }
      return true;
    });
  }, [visibleKits, kitTier, spaceQuery]);

  const sourceBaseItems = useMemo(() => {
    if (!activeKit) return items;
    const discFilter = f && f.disc;
    const res = [];
    (activeKit.items || []).forEach((entry, idx) => {
      const doc = poolById.get(entry.id) || items.find((r) => r.id === entry.id);
      if (!doc) return;
      if (discFilter && doc.disc !== discFilter) return;
      res.push({
        ...doc,
        _kitStep: idx + 1,
        _kitNote: entry.note || '',
      });
    });
    return res;
  }, [activeKit, items, poolById, f]);

  const isKitsOverview = viewMode === 'kits' && !activeKit;
  const isHeroMode = !isMobile && !stageOpen && !isKitsOverview && !activeKit;
  const activeFormation = isKitsOverview
    ? 'kits'
    : viewMode === 'grid'
    ? 'grid'
    : viewMode === 'graph'
    ? 'graph'
    : 'space';

  const ensureStageOpen = () => {
    if (!stageOpen && onStageOpenChange) onStageOpenChange(true);
  };

  const queryIntent = useMemo(() => detectSearchIntent(spaceQuery), [spaceQuery]);

  // Reactive items: responds to AI citations, live keyword search, Bookmarks spotlight, or Active Kit items
  const reactive = useMemo(() => {
    const base = sourceBaseItems;
    const sourceOrderMap = new Map();
    const aiSpotlightOn = !isMobile && desktopChatOpen && activeAiTurn;
    if (aiSpotlightOn && Array.isArray(activeAiTurn.src)) {
      activeAiTurn.src.forEach((s, i) => sourceOrderMap.set(s.id, s.index || i + 1));
    }

    const rawQ = spaceQuery.trim();
    const tokens = tokenizeUnique(rawQ);
    const matchMap = new Map();

    if (rawQ) {
      const searchSource = base.length ? base : poolAll;
      const scored = searchSource
        .map((r) => ({ r, ...scoreDocument(r, rawQ, tokens) }))
        .filter((x) => x.score > 0);
      scored.sort((a, b) => b.matched - a.matched || b.score - a.score);
      scored.forEach((x) => matchMap.set(x.r.id, x));
    }

    // Mode 1: Personal Bookmarks spotlight
    if (spaceFilterMode === 'bookmarks') {
      const bmList = (base.length ? base : poolAll).filter((r) => favs.includes(r.id));
      return {
        displayItems: bmList,
        sourceOrderMap,
        matchMap,
        mode: 'bookmarks',
      };
    }

    // Mode 2: Desktop AI Answer Source Spotlight
    if (aiSpotlightOn && !activeAiTurn.busy && sourceOrderMap.size > 0 && !showAllAfterAi) {
      const citedItems = [];
      const seenIds = new Set();

      activeAiTurn.src.forEach((s) => {
        const doc = base.find((r) => r.id === s.id) || poolAll.find((r) => r.id === s.id);
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

    // Show all alongside open Desktop AI chat, cited items prioritized first
    if (aiSpotlightOn && sourceOrderMap.size > 0 && showAllAfterAi) {
      const front = [];
      const rest = [];
      activeAiTurn.src.forEach((s) => {
        const doc = base.find((r) => r.id === s.id) || poolAll.find((r) => r.id === s.id);
        if (doc && !front.some((x) => x.id === doc.id)) front.push(doc);
      });
      base.forEach((r) => {
        if (!front.some((x) => x.id === r.id)) rest.push(r);
      });
      return {
        displayItems: [...front, ...rest],
        sourceOrderMap,
        matchMap,
        mode: 'ai-all',
      };
    }

    // Mode 3: Live smart keyword search filtering
    if (rawQ && (isMobile || (!desktopChatOpen && queryIntent === 'search')) && !isKitsOverview) {
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

    return {
      displayItems: base,
      sourceOrderMap,
      matchMap,
      mode: 'gallery',
    };
  }, [sourceBaseItems, poolAll, favs, spaceQuery, queryIntent, isMobile, desktopChatOpen, activeAiTurn, spaceFilterMode, showAllAfterAi, isKitsOverview]);

  const displayItems = reactive.displayItems;
  const count = displayItems.length;
  const isCompact = vpWidth <= 920;

  const runAi = async (question) => {
    const t = String(question || '').trim();
    if (!t || !onSendChat) return;
    ensureStageOpen();
    setSpaceFilterMode('all');
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
      setCmdIdx(0);
      askInputRef.current && askInputRef.current.focus();
    }
  }, [cmdOpen, active]);

  useEffect(() => {
    setCmdIdx(0);
  }, [spaceQuery]);

  // Reset local Space state when user returns to Clean Chat-First view via logo
  useEffect(() => {
    if (!heroResetSignal) return;
    setSpaceQuery('');
    setDesktopChatOpen(false);
    setDesktopHistoryOpen(false);
    setSpaceFilterMode('all');
    setShowAllAfterAi(false);
    setMobBrowseOpen(false);
    setMobMenuOpen(false);
    setMobHistoryOpen(false);
    setHoveredSourceId(null);
    setGraphSelectedId(null);
    setGraphHoverId(null);
    setGraphOptsOpen(false);
    setAddingToKitOpen(false);
    setConfirmDelKitId(null);
    const m = motionRef.current;
    m.velYaw = 0;
    m.targetYaw = 0;
    m.targetScrollY = 0;
    m.velScrollY = 0;
  }, [heroResetSignal]);

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
    const syncRect = () => {
      recordAskBarRect();
      if (dockWrapRef.current && !isMobile) {
        dockFlipPrevRef.current = dockWrapRef.current.getBoundingClientRect();
      }
    };
    syncRect();
    const ro = typeof ResizeObserver !== 'undefined' && askBarRef.current ? new ResizeObserver(syncRect) : null;
    if (ro && askBarRef.current) ro.observe(askBarRef.current);
    window.addEventListener('resize', syncRect, { passive: true });
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', syncRect);
    };
  }, [active, desktopChatOpen, activeChat?.id, activeAiTurn?.id, cmdOpen, isHeroMode, isMobile]);

  // Smooth vertical FLIP glide between Hero Center <-> Bottom Dock when stage reveals or returns clean
  useLayoutEffect(() => {
    const prevHero = wasHeroRef.current;
    wasHeroRef.current = isHeroMode;
    if (!active || isMobile || reducedMotion || !dockWrapRef.current) return;
    const nextRect = dockWrapRef.current.getBoundingClientRect();
    if (prevHero !== null && prevHero !== isHeroMode && dockFlipPrevRef.current && dockWrapRef.current.animate) {
      const dy = dockFlipPrevRef.current.top - nextRect.top;
      if (Math.abs(dy) > 4) {
        dockWrapRef.current.animate(
          [
            { transform: `translate3d(0, ${dy.toFixed(1)}px, 0)` },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          {
            duration: 460,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }
        );
      }
    }
    dockFlipPrevRef.current = nextRect;
  }, [isHeroMode, active, isMobile, reducedMotion]);

  // FLIP flight from Topbar Center Pill -> Spatial Dock when entering from non-space view
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
    }
    if (askInputRef.current) {
      askInputRef.current.focus();
    }
  }, [focusSignal]);

  useEffect(() => {
    if (!openChatSignal) return;
    ensureStageOpen();
    setSpaceFilterMode('all');
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

  const hasOverlaySheet = Boolean(!isMobile && desktopChatOpen && activeChat);
  const hasOverlaySheetRef = useRef(false);
  hasOverlaySheetRef.current = hasOverlaySheet;

  const kitTopOffset = activeKit ? (addingToKitOpen ? 92 : 46) : 0;

  // Layout computations per formation
  const spaceLayout = useMemo(
    () => computeSpaceLayout(displayItems, vpWidth, vpHeight, isCompact),
    [displayItems, isCompact, vpWidth, vpHeight]
  );

  const gridLayout = useMemo(
    () => computeGridLayout(displayItems, vpWidth, vpHeight, hasOverlaySheet, kitTopOffset),
    [displayItems, vpWidth, vpHeight, hasOverlaySheet, kitTopOffset]
  );

  const graphData = useMemo(
    () =>
      computeGraphData(displayItems, {
        includeSoft: graphIncludeSoft,
        includeOrphans: graphIncludeOrphans,
        discFocus: f && f.disc ? f.disc : '',
      }),
    [displayItems, graphIncludeSoft, graphIncludeOrphans, f?.disc, graphLayoutRev]
  );

  const activeLayout =
    activeFormation === 'graph'
      ? graphData
      : activeFormation === 'grid'
      ? gridLayout
      : spaceLayout;

  const layout = spaceLayout;
  const layoutRef = useRef(spaceLayout);
  layoutRef.current = spaceLayout;
  const gridLayoutRef = useRef(gridLayout);
  gridLayoutRef.current = gridLayout;
  const graphDataRef = useRef(graphData);
  graphDataRef.current = graphData;
  const activeFormationRef = useRef(activeFormation);
  activeFormationRef.current = activeFormation;
  const isHeroModeRef = useRef(isHeroMode);
  isHeroModeRef.current = isHeroMode;
  const displayItemsRef = useRef(displayItems);
  displayItemsRef.current = displayItems;
  const reactiveRef = useRef(reactive);
  reactiveRef.current = reactive;

  graphNodesRef.current = graphData.nodes;
  graphNodeByIdRef.current = graphData.nodeById;
  graphEdgesRef.current = graphData.edges;

  const cardW = activeLayout.cardW;
  const cardH = activeLayout.cardH;

  // Graph neighborhood highlighting set (hover takes precedence over selected for crisp preview)
  const graphFocusId =
    activeFormation === 'graph'
      ? (graphHoverId && graphData.activeSet.has(graphHoverId)
          ? graphHoverId
          : graphSelectedId && graphData.activeSet.has(graphSelectedId)
          ? graphSelectedId
          : null)
      : null;
  const graphFocusNeighbors = useMemo(() => {
    if (!graphFocusId) return null;
    const set = new Set([graphFocusId]);
    const adj = graphData.adjMap.get(graphFocusId);
    if (adj) adj.forEach((nId) => set.add(nId));
    return set;
  }, [graphFocusId, graphData]);
  const graphFocusIdRef = useRef(null);
  graphFocusIdRef.current = graphFocusId;
  const graphFocusNeighborsRef = useRef(null);
  graphFocusNeighborsRef.current = graphFocusNeighbors;
  const graphSelectedIdRef = useRef(null);
  graphSelectedIdRef.current = graphSelectedId;
  const activeKitRef = useRef(activeKit);
  activeKitRef.current = activeKit;

  if (cardRefs.current.length > displayItems.length) {
    cardRefs.current.length = displayItems.length;
  }
  if (hoverLiftRef.current.length > displayItems.length) {
    hoverLiftRef.current.length = displayItems.length;
  }
  if (dotRefs.current.length > spaceLayout.cols) {
    dotRefs.current.length = spaceLayout.cols;
  }
  if (edgePathRefs.current.length > graphData.edges.length) {
    edgePathRefs.current.length = graphData.edges.length;
  }
  if (edgeArrowRefs.current.length > graphData.edges.length) {
    edgeArrowRefs.current.length = graphData.edges.length;
  }
  if (graphEdgeGroupRefs.current.length > graphData.edges.length) {
    graphEdgeGroupRefs.current.length = graphData.edges.length;
  }

  const motionRef = useRef({
    yaw: 0,
    targetYaw: 0,
    velYaw: 0,
    sceneZOffset: 0,
    targetSceneZOffset: 0,
    sceneY: -28,
    scrollY: 0,
    targetScrollY: 0,
    velScrollY: 0,
    panX: 0,
    panY: 0,
    targetPanX: 0,
    targetPanY: 0,
    zoom: 0.78,
    targetZoom: 0.78,
    dragging: false,
    didDrag: false,
    dragMode: null, // 'yaw' | 'grid-scroll' | 'graph-pan' | 'graph-node'
    dragNodeId: null,
    dragNodeOrigX: 0,
    dragNodeOrigY: 0,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    dragDist: 0,
    lastColShown: -1,
    lastMovedShown: false,
    lastZoomShown: 78,
  });

  // Reset local Space / Grid / Graph camera when filter, chat spotlight, or active kit changes
  useEffect(() => {
    const m = motionRef.current;
    m.lastColShown = -1;
    hoveredIdxRef.current = -1;
    m.velYaw = 0;
    m.targetYaw = 0;
    m.targetScrollY = 0;
    m.velScrollY = 0;
    const isFocusedSet = Boolean(
      (spaceQuery.trim() && (isMobile || (!desktopChatOpen && queryIntent === 'search'))) ||
        (!isMobile && desktopChatOpen && activeAiTurn) ||
        spaceFilterMode === 'bookmarks' ||
        activeKit
    );
    m.targetSceneZOffset = isFocusedSet && count > 0 && count <= 6 ? 55 : 0;
    wakeMotionRef.current();
  }, [
    spaceQuery,
    queryIntent,
    isMobile,
    activeAiTurn?.id,
    activeAiTurn?.busy,
    spaceFilterMode,
    activeKit?.id,
    pageTitle,
  ]);

  // Fit Graph camera cleanly whenever entering Graph or updating graph topology
  useEffect(() => {
    if (activeFormation !== 'graph' || isMobile) return;
    const m = motionRef.current;
    const fit = graphData.fitCamera(vpWidth, vpHeight, hasOverlaySheet, kitTopOffset);
    m.targetPanX = fit.panX;
    m.targetPanY = fit.panY;
    m.targetZoom = fit.zoom;
    if (reducedMotion) {
      m.panX = fit.panX;
      m.panY = fit.panY;
      m.zoom = fit.zoom;
    }
    const pct = Math.round(fit.zoom * 100);
    m.lastZoomShown = pct;
    setGraphZoomPct(pct);
    wakeMotionRef.current();
  }, [activeFormation, graphData, isMobile]);

  // Clamp Grid vertical scroll when bottom dock sheet or viewport height changes
  useEffect(() => {
    if (activeFormation !== 'grid') return;
    const m = motionRef.current;
    m.targetScrollY = clamp(m.targetScrollY, 0, gridLayout.maxScrollY);
    wakeMotionRef.current();
  }, [activeFormation, gridLayout.maxScrollY]);

  // Keep Space yaw bounds sane if item count changes
  useEffect(() => {
    const m = motionRef.current;
    if (!spaceLayout.fullRing) {
      m.targetYaw = clamp(m.targetYaw, -spaceLayout.maxYawBound, spaceLayout.maxYawBound);
      m.yaw = clamp(m.yaw, -spaceLayout.maxYawBound, spaceLayout.maxYawBound);
    }
    wakeMotionRef.current();
  }, [spaceLayout.cols, spaceLayout.fullRing, spaceLayout.maxYawBound]);

  // Wake sleeping spatial loop when mode, reveal state, graph selection, or items change
  useEffect(() => {
    wakeMotionRef.current();
  }, [
    hasOverlaySheet,
    displayItems,
    active,
    activeFormation,
    isHeroMode,
    graphSelectedId,
    graphHoverId,
    graphData,
    gridLayout,
  ]);

  // Schedule smooth settle onto nearest column after pointer drag momentum in Space
  const scheduleSnap = (delayMs = 190) => {
    clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      if (activeFormationRef.current !== 'space') return;
      const l = layoutRef.current;
      const m = motionRef.current;
      if (m.dragging || Math.abs(m.velYaw) > 0.08) return;
      const snapped = Math.round(m.targetYaw / l.stepDeg) * l.stepDeg;
      m.targetYaw = l.fullRing ? snapped : clamp(snapped, -l.maxYawBound, l.maxYawBound);
      wakeMotionRef.current();
    }, delayMs);
  };

  // On-demand unified 60fps spatial morphing loop: sleeps at 0fps when idle or hidden
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
      const mode = activeFormationRef.current;
      const isHero = isHeroModeRef.current;
      const l = layoutRef.current;
      const gL = gridLayoutRef.current;
      const grD = graphDataRef.current;
      const itemsArr = displayItemsRef.current;
      const m = motionRef.current;
      let moving = m.dragging;

      const justRevealed = wasStageOpenAnimRef.current && !isHero && mode !== 'kits';
      if (isHero || mode === 'kits') {
        wasStageOpenAnimRef.current = true;
      } else if (justRevealed) {
        wasStageOpenAnimRef.current = false;
      }

      // 1. Update active camera state per formation
      if (mode === 'space' && !isHero) {
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
        if (sceneRef.current) {
          sceneRef.current.style.transform = `translate3d(0, ${m.sceneY.toFixed(1)}px, ${(l.sceneZ + m.sceneZOffset).toFixed(1)}px)`;
        }
      } else if (mode === 'grid' && !isHero) {
        if (!m.dragging && Math.abs(m.velScrollY) > 0.25) {
          m.targetScrollY = clamp(m.targetScrollY + m.velScrollY, 0, gL.maxScrollY);
          m.velScrollY *= 0.88;
          moving = true;
        } else if (!m.dragging && m.velScrollY !== 0) {
          m.velScrollY = 0;
        }
        const dSy = m.targetScrollY - m.scrollY;
        if (Math.abs(dSy) < 0.15 || reducedMotion) {
          m.scrollY = m.targetScrollY;
        } else {
          m.scrollY += dSy * (m.dragging ? 0.45 : 0.22);
          moving = true;
        }
        if (sceneRef.current) {
          sceneRef.current.style.transform = 'translate3d(0, 0, 0)';
        }
        if (gridHudRef.current) {
          const pct = gL.maxScrollY > 2 ? Math.round((m.scrollY / gL.maxScrollY) * 100) : 0;
          gridHudRef.current.textContent = gL.maxScrollY > 2 ? `${pct}%` : `${itemsArr.length} flat`;
        }
      } else if (mode === 'graph' && !isHero) {
        const gEase = reducedMotion ? 1 : m.dragging && m.dragMode === 'graph-pan' ? 0.55 : 0.22;
        const dPx = m.targetPanX - m.panX;
        const dPy = m.targetPanY - m.panY;
        const dZm = m.targetZoom - m.zoom;
        if (Math.abs(dPx) < 0.15 || reducedMotion) m.panX = m.targetPanX;
        else {
          m.panX += dPx * gEase;
          moving = true;
        }
        if (Math.abs(dPy) < 0.15 || reducedMotion) m.panY = m.targetPanY;
        else {
          m.panY += dPy * gEase;
          moving = true;
        }
        if (Math.abs(dZm) < 0.001 || reducedMotion) m.zoom = m.targetZoom;
        else {
          m.zoom += dZm * 0.24;
          moving = true;
        }
        const pct = Math.round(m.zoom * 100);
        if (pct !== m.lastZoomShown) {
          m.lastZoomShown = pct;
          setGraphZoomPct(pct);
        }
        if (sceneRef.current) {
          sceneRef.current.style.transform = 'translate3d(0, 0, 0)';
        }
      } else {
        if (sceneRef.current) {
          sceneRef.current.style.transform = `translate3d(0, 0, ${(mode === 'space' ? l.sceneZ : 0).toFixed(1)}px)`;
        }
      }

      // 2. Compute targets & smoothly morph every live card tile by ID
      const cardAnimMap = cardAnimRef.current;
      const curFrameById = new Map();
      const positions = l.positions;
      const R = l.radius;
      const cullDeg = isCompact ? 88 : 98;
      const focusDeg = Math.max(26, l.stepDeg * 0.85);
      const gFocId = graphFocusIdRef.current;
      const gFocSet = graphFocusNeighborsRef.current;
      const gSelId = graphSelectedIdRef.current;
      const aiSrcMap = reactiveRef.current.sourceOrderMap;

      for (let i = 0; i < itemsArr.length; i++) {
        const r = itemsArr[i];
        const el = cardRefs.current[i];
        if (!el) continue;

        const targetLift = hoveredIdxRef.current === i && !m.dragging && !isHero && mode !== 'kits' ? 1 : 0;
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

        let tx = 0;
        let ty = 0;
        let tz = 0;
        let trotY = 0;
        let tsc = 1;
        let top = 1;
        let wantHidden = false;
        let targetZIdx = 50;
        let isCenterCol = false;
        let isPeripheral = false;
        let snapImmediate = false;

        if (isHero || mode === 'kits') {
          const prev = cardAnimMap.get(r.id);
          tx = prev ? prev.x * 0.68 : 0;
          ty = prev ? prev.y * 0.68 + 26 : 36;
          tz = -240;
          trotY = 0;
          tsc = 0.78;
          top = 0;
          wantHidden = true;
        } else if (mode === 'space') {
          const pos = positions[i];
          if (!pos) continue;
          const rel = l.fullRing ? wrapDeg(pos.angle - m.yaw) : pos.angle - m.yaw;
          const absRel = Math.abs(rel);
          const rad = (rel * Math.PI) / 180;
          tx = R * Math.sin(rad);
          ty = pos.y;
          const centerPresence =
            Math.max(0, Math.cos((Math.min(absRel, l.stepDeg) / Math.max(1, l.stepDeg)) * (Math.PI / 2))) * 14;
          tz = -R * Math.cos(rad) + centerPresence + lift * 9;
          trotY = -rel * 0.7;

          if (absRel > cullDeg) {
            tsc = 0.76;
            top = 0;
            wantHidden = true;
          } else {
            const t = Math.min(1, absRel / cullDeg);
            tsc = 1.03 - 0.24 * Math.pow(t, 1.35) + lift * 0.015;
            const baseOp = Math.max(0.24, 1 - 0.7 * Math.pow(t, 1.75));
            top = lift > 0.05 ? Math.max(baseOp, Math.min(1, baseOp + lift * 0.08)) : baseOp;
            targetZIdx = Math.round(200 - absRel + lift * 20);
            isCenterCol = absRel < l.stepDeg * 0.45;
            isPeripheral = absRel > focusDeg;
          }
        } else if (mode === 'grid') {
          const pos = gL.positions[i];
          if (!pos) continue;
          tx = pos.x;
          ty = pos.y - m.scrollY;
          tz = 0;
          trotY = 0;
          tsc = 1 + lift * 0.018;
          top = 1;
          targetZIdx = Math.round(60 + lift * 30);
          isCenterCol = true;
          const outOfView = ty < -vpHeight * 0.65 || ty > vpHeight * 0.65;
          if (outOfView) {
            top = 0;
            wantHidden = true;
          }
        } else if (mode === 'graph') {
          const gn = grD.nodeById.get(r.id);
          if (!gn) {
            const prev = cardAnimMap.get(r.id);
            tx = prev ? prev.x : 0;
            ty = prev ? prev.y : 0;
            tsc = 0.5;
            top = 0;
            wantHidden = true;
          } else {
            const custom = graphCustomPosRef.current.get(r.id);
            const wx = custom ? custom.x : gn.x;
            const wy = custom ? custom.y : gn.y;
            tx = wx * m.zoom + m.panX;
            ty = wy * m.zoom + m.panY;
            tz = 0;
            trotY = 0;
            const isSel = gSelId === r.id;
            const isFocNode = gFocId === r.id;
            const isNbr = Boolean(gFocSet && gFocSet.has(r.id));
            const baseSc = clamp(m.zoom, 0.44, 1.42);
            tsc = baseSc + lift * 0.07 + (isSel ? 0.045 : 0);
            if (gFocSet) {
              top = isNbr ? 1 : 0.16;
            } else if (aiSrcMap && aiSrcMap.size > 0) {
              top = aiSrcMap.has(r.id) ? 1 : 0.28;
            } else {
              top = 1;
            }
            targetZIdx = isFocNode || isSel ? 260 : isNbr ? 170 : Math.round(70 + lift * 40);
            isCenterCol = isSel || isFocNode || m.zoom >= 0.85;
            if (m.dragging && m.dragMode === 'graph-node' && m.dragNodeId === r.id) {
              snapImmediate = true;
            }
          }
        }

        let cur = cardAnimMap.get(r.id);
        if (!cur) {
          cur = {
            x: tx * 0.55,
            y: ty * 0.55 + 28,
            z: tz - 200,
            rotY: trotY * 0.4,
            sc: Math.max(0.55, tsc * 0.84),
            op: isHero || mode === 'kits' ? 0 : 0.01,
          };
          cardAnimMap.set(r.id, cur);
        } else if (justRevealed && cur.op < 0.05 && !wantHidden) {
          cur.x = tx * 0.52;
          cur.y = ty * 0.52 + 28;
          cur.z = tz - 210;
          cur.rotY = trotY * 0.45;
          cur.sc = Math.max(0.55, tsc * 0.84);
        }

        const staggerSp = clamp(0.22 - (i % 7) * 0.011, 0.14, 0.24);
        const cardSp = reducedMotion || snapImmediate ? 1 : mode === 'grid' && m.dragging ? 0.5 : mode === 'graph' && (m.dragging || Math.abs(m.targetPanX - m.panX) > 2 || Math.abs(m.targetZoom - m.zoom) > 0.01) ? 0.42 : staggerSp;

        const lerpProp = (key, target, eps) => {
          const d = target - cur[key];
          if (Math.abs(d) <= eps || cardSp >= 1) {
            cur[key] = target;
            return false;
          }
          cur[key] += d * cardSp;
          return true;
        };

        const c1 = lerpProp('x', tx, 0.25);
        const c2 = lerpProp('y', ty, 0.25);
        const c3 = lerpProp('z', tz, 0.4);
        const c4 = lerpProp('rotY', trotY, 0.08);
        const c5 = lerpProp('sc', tsc, 0.002);
        const c6 = lerpProp('op', top, 0.005);
        if (c1 || c2 || c3 || c4 || c5 || c6) moving = true;

        curFrameById.set(r.id, cur);

        if (wantHidden && cur.op < 0.025) {
          if (el.style.visibility !== 'hidden') {
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
            el.tabIndex = -1;
          }
          el.style.opacity = '0';
          continue;
        }

        if (el.style.visibility === 'hidden') {
          el.style.visibility = 'visible';
          el.style.pointerEvents = 'auto';
          el.tabIndex = 0;
        }

        el.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px, ${cur.z.toFixed(1)}px) rotateY(${cur.rotY.toFixed(2)}deg) scale3d(${cur.sc.toFixed(3)}, ${cur.sc.toFixed(3)}, 1)`;
        el.style.opacity = cur.op.toFixed(3);
        el.style.zIndex = String(targetZIdx);

        if (isCenterCol) {
          if (!el.classList.contains('is-focus')) el.classList.add('is-focus');
        } else if (el.classList.contains('is-focus')) {
          el.classList.remove('is-focus');
        }

        if (isPeripheral) {
          if (!el.classList.contains('is-peripheral')) el.classList.add('is-peripheral');
        } else if (el.classList.contains('is-peripheral')) {
          el.classList.remove('is-peripheral');
        }
      }

      // 3. Synchronize Graph SVG edges seamlessly to exact live card positions
      if (mode === 'graph' && !isHero) {
        const hwVp = vpWidth / 2;
        const hhVp = vpHeight / 2;
        const gEdges = grD.edges;
        for (let k = 0; k < gEdges.length; k++) {
          const e = gEdges[k];
          const grpEl = graphEdgeGroupRefs.current[k];
          const pEl = edgePathRefs.current[k];
          const aEl = edgeArrowRefs.current[k];
          if (!grpEl || !pEl || !aEl) continue;

          const cA = curFrameById.get(e.from);
          const cB = curFrameById.get(e.to);
          if (!cA || !cB || Math.min(cA.op, cB.op) < 0.04) {
            grpEl.style.opacity = '0';
            continue;
          }

          const ax = hwVp + cA.x;
          const ay = hhVp + cA.y;
          const bx = hwVp + cB.x;
          const by = hhVp + cB.y;
          const hwA = grD.cardW * cA.sc * 0.5 + 3;
          const hhA = grD.cardH * cA.sc * 0.5 + 3;
          const hwB = grD.cardW * cB.sc * 0.5 + 3;
          const hhB = grD.cardH * cB.sc * 0.5 + 3;
          const arrowSz = clamp(6.8 * ((cA.sc + cB.sc) * 0.5), 5.2, 8.5);
          const svgRes = computeGraphEdgeSvg(ax, ay, hwA, hhA, bx, by, hwB, hhB, e.curveSign, arrowSz);
          if (!svgRes) {
            grpEl.style.opacity = '0';
            continue;
          }

          pEl.setAttribute('d', svgRes.pathD);
          aEl.setAttribute('points', svgRes.arrowPoints);

          const isOut = gFocId && e.from === gFocId;
          const isIn = gFocId && e.to === gFocId;
          const isHot = Boolean(isOut || isIn);
          const isAiHot = Boolean(aiSrcMap && aiSrcMap.size > 0 && aiSrcMap.has(e.from) && aiSrcMap.has(e.to));

          grpEl.classList.toggle('is-out', Boolean(isOut));
          grpEl.classList.toggle('is-in', Boolean(isIn));
          grpEl.classList.toggle('is-ai', isAiHot);

          const targetEdgeOp = gFocId ? (isHot ? 0.96 : 0.09) : isAiHot ? 0.92 : e.kind === 'hard' ? 0.42 : 0.24;
          const minNodeOp = Math.min(cA.op, cB.op);
          grpEl.style.opacity = (targetEdgeOp * minNodeOp).toFixed(3);
        }
      }

      // 4. Update active column index, scrubber dots & compact HUD label in Space
      if (mode === 'space' && l.cols > 0) {
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
        const isMoved =
          mode === 'space'
            ? Math.abs(m.yaw) > 4
            : mode === 'grid'
            ? m.scrollY > 24
            : false;
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
  }, [active, spaceLayout, gridLayout, graphData, reducedMotion, isCompact, isMobile, vpWidth, vpHeight]);

  // Unified Wheel handler: rotates Space | scrolls Grid vertically | zooms Graph toward cursor
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;

    const onWheel = (e) => {
      if (isHeroModeRef.current || activeFormationRef.current === 'kits') return;
      if (document.querySelector('.side.open, .ov')) return;
      if (e.target && e.target.closest && e.target.closest('.asel-menu,.pop,.dr,.kspace-dock,.kspace-cmd-pop,.kspace-graph-selbar,.kspace-kit-crumb')) return;

      const mode = activeFormationRef.current;
      if (mode === 'graph') {
        e.preventDefault();
        const m = motionRef.current;
        const rect = vp.getBoundingClientRect();
        const modeScale = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 320 : 1;
        const dy = (e.deltaY || 0) * modeScale;
        if (!dy) return;
        const factor = Math.exp(-clamp(dy, -160, 160) * (e.ctrlKey ? 0.008 : 0.0022));
        const prevZ = m.targetZoom;
        const nextZ = clamp(prevZ * factor, 0.36, 1.65);
        const ratio = nextZ / Math.max(0.01, prevZ);
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;
        m.targetPanX = mx - (mx - m.targetPanX) * ratio;
        m.targetPanY = my - (my - m.targetPanY) * ratio;
        m.targetZoom = nextZ;
        wakeMotionRef.current();
        return;
      }

      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const m = motionRef.current;
      const modeScale = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 320 : 1;
      const dx = (e.deltaX || 0) * modeScale;
      const dy = (e.deltaY || 0) * modeScale;

      if (mode === 'grid') {
        const gL = gridLayoutRef.current;
        const dScroll = dy || dx;
        if (!dScroll) return;
        m.velScrollY = 0;
        m.targetScrollY = clamp(m.targetScrollY + clamp(dScroll, -220, 220) * 0.9, 0, gL.maxScrollY);
        wakeMotionRef.current();
        return;
      }

      // Default 'space': smooth horizontal carousel yaw
      const l = layoutRef.current;
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
    const mode = activeFormationRef.current;
    const m = motionRef.current;
    if (mode === 'grid') {
      m.velScrollY = 0;
      m.targetScrollY = clamp(m.targetScrollY + dir * 220, 0, gridLayoutRef.current.maxScrollY);
      wakeMotionRef.current();
      return;
    }
    const l = layoutRef.current;
    m.velYaw = 0;
    const curSnap = Math.round(m.targetYaw / l.stepDeg) * l.stepDeg;
    const nextYaw = curSnap + dir * l.stepDeg;
    m.targetYaw = l.fullRing ? nextYaw : clamp(nextYaw, -l.maxYawBound, l.maxYawBound);
    wakeMotionRef.current();
  };

  const resetCamera = () => {
    const mode = activeFormationRef.current;
    const m = motionRef.current;
    if (mode === 'graph') {
      const fit = graphDataRef.current.fitCamera(vpWidth, vpHeight, hasOverlaySheetRef.current, activeKitRef.current ? 46 : 0);
      m.targetPanX = fit.panX;
      m.targetPanY = fit.panY;
      m.targetZoom = fit.zoom;
      wakeMotionRef.current();
      return;
    }
    if (mode === 'grid') {
      m.velScrollY = 0;
      m.targetScrollY = 0;
      wakeMotionRef.current();
      return;
    }
    m.velYaw = 0;
    m.targetYaw = 0;
    wakeMotionRef.current();
  };

  const zoomGraphBy = (factor) => {
    const m = motionRef.current;
    const prevZ = m.targetZoom;
    const nextZ = clamp(prevZ * factor, 0.36, 1.65);
    const ratio = nextZ / Math.max(0.01, prevZ);
    m.targetPanX *= ratio;
    m.targetPanY *= ratio;
    m.targetZoom = nextZ;
    wakeMotionRef.current();
  };

  const focusGraphNode = (nodeId) => {
    const gn = graphDataRef.current.nodeById.get(nodeId);
    if (!gn) return;
    const custom = graphCustomPosRef.current.get(nodeId);
    const wx = custom ? custom.x : gn.x;
    const wy = custom ? custom.y : gn.y;
    const m = motionRef.current;
    const targetZ = Math.max(m.targetZoom, 0.88);
    m.targetZoom = targetZ;
    m.targetPanX = -wx * targetZ;
    m.targetPanY = -wy * targetZ - (hasOverlaySheetRef.current ? 80 : 12);
    setGraphSelectedId(nodeId);
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
    ensureStageOpen();
    if (activeFormationRef.current === 'graph') {
      setGraphHoverId(itemId);
      setHoveredSourceId(itemId);
      wakeMotionRef.current();
      return;
    }
    const idx = displayItems.findIndex((x) => x.id === itemId);
    if (idx < 0) return;
    if (activeFormationRef.current === 'space') {
      const pos = layoutRef.current.positions[idx];
      if (pos) rotateToAngle(pos.angle);
    } else if (activeFormationRef.current === 'grid') {
      const gPos = gridLayoutRef.current.positions[idx];
      if (gPos) {
        motionRef.current.targetScrollY = clamp(gPos.y, 0, gridLayoutRef.current.maxScrollY);
      }
    }
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
    const colAngle = idx >= 0 && spaceLayout.positions[idx] ? spaceLayout.positions[idx].angle : undefined;
    triggerOpenCard(s.id, idx, colAngle, s.sectionId || null);
  };

  // User Decision #2: Clear returns to full 3D tile library (clean Hero is triggered by Brand Logo)
  const clearSpaceSearch = () => {
    ensureStageOpen();
    setSpaceQuery('');
    setDesktopChatOpen(false);
    setDesktopHistoryOpen(false);
    setSpaceFilterMode('all');
    setShowAllAfterAi(false);
    setMobBrowseOpen(false);
    setMobMenuOpen(false);
    setMobHistoryOpen(false);
    setHoveredSourceId(null);
    setGraphSelectedId(null);
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
    setSpaceFilterMode('all');
    setShowAllAfterAi(false);
    setSpaceQuery('');
    setHoveredSourceId(null);
    if (catalogQ && onCatalogQChange) onCatalogQChange('');
    askInputRef.current && askInputRef.current.focus();
  };

  const onPointerDown = (e) => {
    if (e.button !== 0 || isHeroModeRef.current || activeFormationRef.current === 'kits') return;
    if (document.querySelector('.side.open, .ov')) return;
    if (e.target && e.target.closest && e.target.closest('button,a,input')) {
      if (e.target.closest('.acts,.kspace-open-link,.kspace-dock,.kspace-topbar,.kspace-graph-selbar,.kspace-kit-crumb')) return;
    }
    const m = motionRef.current;
    const mode = activeFormationRef.current;
    clearTimeout(snapTimerRef.current);
    m.dragging = true;
    m.didDrag = false;
    m.pointerId = e.pointerId;
    m.startX = e.clientX;
    m.startY = e.clientY;
    m.lastX = e.clientX;
    m.lastY = e.clientY;
    m.lastT = performance.now();
    m.dragDist = 0;
    m.velYaw = 0;
    m.velScrollY = 0;

    if (mode === 'graph') {
      const cardEl = e.target && e.target.closest && e.target.closest('.kspace-card');
      if (cardEl && cardEl.dataset && cardEl.dataset.docId) {
        const docId = Number(cardEl.dataset.docId) || cardEl.dataset.docId;
        const gn = graphNodeByIdRef.current.get(docId);
        if (gn) {
          const custom = graphCustomPosRef.current.get(docId);
          m.dragMode = 'graph-node';
          m.dragNodeId = docId;
          m.dragNodeOrigX = custom ? custom.x : gn.x;
          m.dragNodeOrigY = custom ? custom.y : gn.y;
          return;
        }
      }
      m.dragMode = 'graph-pan';
      m.dragNodeId = null;
      return;
    }

    m.dragMode = mode === 'grid' ? 'grid-scroll' : 'yaw';
    m.dragNodeId = null;
  };

  const onPointerMove = (e) => {
    const m = motionRef.current;
    if (!m.dragging || e.pointerId !== m.pointerId) return;
    const dxTotal = e.clientX - m.startX;
    const dyTotal = e.clientY - m.startY;
    m.dragDist = Math.hypot(dxTotal, dyTotal);

    if (m.dragDist > 7) {
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

      if (m.dragMode === 'graph-node' && m.dragNodeId != null) {
        const z = Math.max(0.25, m.zoom);
        graphCustomPosRef.current.set(m.dragNodeId, {
          x: m.dragNodeOrigX + dxTotal / z,
          y: m.dragNodeOrigY + dyTotal / z,
        });
      } else if (m.dragMode === 'graph-pan') {
        const stepX = e.clientX - m.lastX;
        const stepY = e.clientY - m.lastY;
        m.targetPanX += stepX;
        m.targetPanY += stepY;
      } else if (m.dragMode === 'grid-scroll') {
        const stepY = e.clientY - m.lastY;
        const gL = gridLayoutRef.current;
        m.targetScrollY = clamp(m.targetScrollY - stepY, 0, gL.maxScrollY);
        m.velScrollY = clamp((-stepY / dt) * 16, -28, 28);
      } else {
        const stepX = e.clientX - m.lastX;
        const l = layoutRef.current;
        const degDelta = -stepX * (isCompact ? 0.28 : 0.22);
        const nextYaw = m.targetYaw + degDelta;
        m.targetYaw = l.fullRing ? nextYaw : clamp(nextYaw, -l.maxYawBound, l.maxYawBound);
        m.velYaw = clamp((degDelta / dt) * 16, -5.5, 5.5);
      }

      m.lastX = e.clientX;
      m.lastY = e.clientY;
      m.lastT = now;
      wakeMotionRef.current();
    }
  };

  const onPointerUp = (e) => {
    const m = motionRef.current;
    if (!m.dragging || e.pointerId !== m.pointerId) return;
    const prevMode = m.dragMode;
    m.dragging = false;
    m.dragMode = null;
    m.dragNodeId = null;
    if (viewportRef.current) {
      viewportRef.current.classList.remove('dragging');
      try {
        viewportRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
    if (m.didDrag) {
      suppressClickUntilRef.current = performance.now() + 180;
      if (prevMode === 'yaw') scheduleSnap(200);
      wakeMotionRef.current();
    } else if (
      prevMode === 'graph-pan' &&
      !(e.target && e.target.closest && e.target.closest('.kspace-card'))
    ) {
      setGraphSelectedId(null);
    }
    m.didDrag = false;
  };

  const onViewportPointerLeave = () => {
    if (hoveredIdxRef.current !== -1) {
      hoveredIdxRef.current = -1;
      setGraphHoverId(null);
      wakeMotionRef.current();
    }
  };

  // Global keyboard shortcuts across Space, Grid & Graph formations
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

      const mode = activeFormationRef.current;
      if (e.key === '/') {
        e.preventDefault();
        askInputRef.current && askInputRef.current.focus();
      } else if (e.key === 'Escape' && mode === 'graph' && graphSelectedIdRef.current) {
        e.preventDefault();
        setGraphSelectedId(null);
      } else if (e.key === 'Enter' && mode === 'graph' && graphSelectedIdRef.current) {
        e.preventDefault();
        triggerOpenCard(graphSelectedIdRef.current);
      } else if (e.key === 'ArrowRight' && mode === 'space' && !isHeroModeRef.current) {
        e.preventDefault();
        stepRotate(1);
      } else if (e.key === 'ArrowLeft' && mode === 'space' && !isHeroModeRef.current) {
        e.preventDefault();
        stepRotate(-1);
      } else if (e.key === 'ArrowDown' && mode === 'grid' && !isHeroModeRef.current) {
        e.preventDefault();
        stepRotate(1);
      } else if (e.key === 'ArrowUp' && mode === 'grid' && !isHeroModeRef.current) {
        e.preventDefault();
        stepRotate(-1);
      } else if ((e.key === '=' || e.key === '+') && mode === 'graph') {
        e.preventDefault();
        zoomGraphBy(1.22);
      } else if (e.key === '-' && mode === 'graph') {
        e.preventDefault();
        zoomGraphBy(1 / 1.22);
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
      ['3D Space Carousel', 'globe', 'view-mode', 'space'],
      ['Grid View (Flat Matrix)', 'layout', 'view-mode', 'grid'],
      ['Dependency Graph', 'graph', 'view-mode', 'graph'],
      ['Playbooks & Kits', 'folder', 'view-mode', 'kits'],
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
          ensureStageOpen();
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
          if (a[2] === 'view-mode') {
            if (a[3] !== 'kits') ensureStageOpen();
            onSelectViewMode && onSelectViewMode(a[3]);
            return;
          }
          onCommand && onCommand(a[2], a[3]);
        },
      })),
      ...(qLow
        ? [
            {
              t: `Ask Library AI: “${qTrim}”`,
              d: 'Permission-filtered synthesis & spotlight',
              n: 'spark',
              c: '#bf5af2',
              run: () => {
                onSetCmdOpen && onSetCmdOpen(false);
                runAi(qTrim);
              },
            },
            {
              t: `All results for “${qTrim}”`,
              d: 'Show all matching cards in Flat Grid',
              n: 'search',
              run: () => {
                ensureStageOpen();
                onSetCmdOpen && onSetCmdOpen(false);
                onSelectViewMode && onSelectViewMode('grid');
              },
            },
          ]
        : []),
    ];
  }, [spaceQuery, recentSearches, displayItems, tree, role, layout, onCommand, onSetCmdOpen, onSelectViewMode]);

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
  const kitCreateOpen = Boolean(creatingKit || localCreatingKit);
  const closeKitCreate = () => {
    if (onCreatingKitChange) onCreatingKitChange(false);
    setLocalCreatingKit(false);
  };
  const handleCreateKit = (col) => {
    onAddCol && onAddCol(col);
    closeKitCreate();
  };
  const canEditActiveKit = activeKit ? canEditCol(activeKit, role, userName) : false;
  const availableKitDocs = useMemo(() => {
    if (!activeKit) return [];
    const existingIds = new Set((activeKit.items || []).map((it) => it.id));
    return items.filter((d) => !existingIds.has(d.id));
  }, [activeKit, items]);

  const removeItemFromActiveKit = (docId) => {
    if (!activeKit || !canEditActiveKit || !onSaveCol) return;
    onSaveCol({
      ...activeKit,
      items: (activeKit.items || []).filter((it) => it.id !== docId),
    });
  };

  const submitAddToActiveKit = (e) => {
    e && e.preventDefault();
    if (!activeKit || !canEditActiveKit || !onSaveCol || !availableKitDocs.length) return;
    const rawChosen = kitAddItemId || availableKitDocs[0].id;
    const matchedDoc = availableKitDocs.find((d) => String(d.id) === String(rawChosen)) || availableKitDocs[0];
    if (!matchedDoc) return;
    onSaveCol({
      ...activeKit,
      items: [...(activeKit.items || []), { id: matchedDoc.id, note: kitAddNote.trim() }],
    });
    setKitAddItemId('');
    setKitAddNote('');
    setAddingToKitOpen(false);
  };

  return html`<section
    className=${'kspace-stage' +
      (isHeroMode ? ' is-hero' : '') +
      (activeFormation !== 'space' || isKitsOverview ? ' is-flat' : '') +
      (isKitsOverview ? ' is-kits' : '') +
      (activeKit ? ' has-kit' : '')}
    style=${{ '--env-accent': envAccent }}
    aria-label=${`${pageTitle} — Spatial Knowledge View`}
  >
    <div className="kspace-topbar">
      <div className="kspace-head">
        <div className="kspace-title-row">
          ${spaceLeftNav || html`<h1>${pageTitle}</h1>`}
          ${!isHeroMode &&
          curCat &&
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
          ${!isHeroMode &&
          activeDisc &&
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
          ${!isHeroMode &&
          !isKitsOverview &&
          isNarrowed &&
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

    ${!isMobile &&
    activeKit &&
    html`<div className="kspace-kit-crumb" onPointerDown=${(e) => e.stopPropagation()}>
      <div className="kspace-kit-crumb-main">
        <button
          type="button"
          className="kspace-mini-btn"
          onClick=${() => {
            setAddingToKitOpen(false);
            setConfirmDelKitId(null);
            onSelectKit && onSelectKit(null);
            onSelectViewMode && onSelectViewMode('kits');
          }}
        >
          ← All Kits
        </button>
        <span className="pill" style=${{ '--c': TIER_COL[activeKit.tier] || '#0a84ff' }}>
          ${TIER_LABEL[activeKit.tier] || 'Kit'}
        </span>
        <strong className="kspace-kit-crumb-t">${activeKit.name}</strong>
        <span className="kspace-kit-crumb-cnt">${sourceBaseItems.length} ${sourceBaseItems.length === 1 ? 'item' : 'items'}</span>
        ${activeKit.desc && html`<span className="kspace-kit-crumb-d">${activeKit.desc}</span>`}
      </div>
      <div className="kspace-kit-crumb-acts">
        ${canEditActiveKit &&
        html`<button
          type="button"
          className=${'kspace-mini-btn' + (addingToKitOpen ? ' on' : '')}
          onClick=${() => setAddingToKitOpen((v) => !v)}
        >
          + Add doc
        </button>`}
        ${canEditActiveKit &&
        activeKit.vis !== 'Public' &&
        can.publicize(role) &&
        onOpenPublic &&
        html`<button
          type="button"
          className="kspace-mini-btn"
          onClick=${() => onOpenPublic(activeKit.id)}
        >
          Publish
        </button>`}
        ${canEditActiveKit &&
        onDelCol &&
        html`<button
          type="button"
          className=${'kspace-mini-btn' + (confirmDelKitId === activeKit.id ? ' is-danger' : '')}
          onClick=${() => {
            if (confirmDelKitId === activeKit.id) {
              setConfirmDelKitId(null);
              onDelCol(activeKit.id);
              onSelectKit && onSelectKit(null);
              onSelectViewMode && onSelectViewMode('kits');
            } else {
              setConfirmDelKitId(activeKit.id);
            }
          }}
        >
          ${confirmDelKitId === activeKit.id ? 'Confirm delete' : 'Delete'}
        </button>`}
      </div>

      ${addingToKitOpen &&
      canEditActiveKit &&
      html`<form className="kspace-kit-addbar" onSubmit=${submitAddToActiveKit}>
        ${availableKitDocs.length
          ? html`<${Select}
              variant="field"
              ariaLabel="Document to add"
              value=${kitAddItemId || String(availableKitDocs[0].id)}
              minMenuWidth=${260}
              options=${availableKitDocs.map((d) => [String(d.id), `${d.title} (${d.disc || 'General'})`])}
              onChange=${(v) => setKitAddItemId(v)}
            />`
          : html`<span className="kspace-kit-crumb-d">All visible documents are already in this kit.</span>`}
        ${availableKitDocs.length > 0 &&
        html`<input
          type="text"
          className="kspace-kit-note-in"
          placeholder="Curator note (optional)…"
          value=${kitAddNote}
          onChange=${(e) => setKitAddNote(e.target.value)}
        />`}
        ${availableKitDocs.length > 0 &&
        html`<button type="submit" className="btn p sm">
          Add
        </button>`}
        <button
          type="button"
          className="kspace-mini-btn"
          onClick=${() => setAddingToKitOpen(false)}
        >
          Cancel
        </button>
      </form>`}
    </div>`}

    ${!isMobile &&
    isKitsOverview &&
    html`<div className="kspace-kits-showcase" onPointerDown=${(e) => e.stopPropagation()}>
      <div className="kspace-kits-head">
        <div>
          <h2>Starter Kits & Playbooks</h2>
          <p>Curated onboarding sequences & QA packs — open any pack to explore in Space, Grid, or Graph.</p>
        </div>
        <div className="kspace-kits-tools">
          <div className="seg" role="group" aria-label="Filter kits by tier">
            ${[
              ['all', 'All'],
              ['official', 'Official'],
              ['shared', 'Shared'],
              ['personal', 'Personal'],
            ].map(
              ([id, label]) => html`<button
                key=${id}
                type="button"
                className=${kitTier === id ? 'on' : ''}
                onClick=${() => onKitTierChange && onKitTierChange(id)}
              >
                ${label}
              </button>`
            )}
          </div>
          ${!isGuest &&
          normRole(role) !== 'Guest' &&
          html`<button
            type="button"
            className="btn p sm"
            onClick=${() => (onCreatingKitChange ? onCreatingKitChange(true) : setLocalCreatingKit(true))}
          >
            <${Ic} n="plus" s=${14} />
            <span>New Kit</span>
          </button>`}
        </div>
      </div>

      ${filteredKits.length
        ? html`<div className="kspace-kits-deck">
            ${filteredKits.map((c) => {
              const kitDocs = (c.items || [])
                .map((it) => poolById.get(it.id) || items.find((d) => d.id === it.id))
                .filter(Boolean);
              const tCol = TIER_COL[c.tier] || '#0a84ff';
              return html`<div
                key=${c.id}
                className="kspace-kit-pack"
                role="button"
                tabIndex="0"
                style=${{ '--kit-c': tCol }}
                onClick=${() => {
                  ensureStageOpen();
                  onSelectKit && onSelectKit(c.id);
                }}
                onKeyDown=${(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    ensureStageOpen();
                    onSelectKit && onSelectKit(c.id);
                  }
                }}
              >
                <div className="kspace-kit-pack-top">
                  <span className="pill" style=${{ '--c': tCol }}>${TIER_LABEL[c.tier] || 'Kit'}</span>
                  ${c.vis && c.vis !== 'Internal' && html`<${VisPill} v=${c.vis} />`}
                  <span className="kspace-kit-cnt">${kitDocs.length} ${kitDocs.length === 1 ? 'doc' : 'docs'}</span>
                </div>
                <h3>${c.name}</h3>
                <p>${c.desc || 'Curated resource and document playbook.'}</p>
                <div className="kspace-kit-preview">
                  ${kitDocs.slice(0, 3).map(
                    (d, dIdx) => html`<div key=${`${d.id}-${dIdx}`} className="kspace-kit-mini">
                      <span className="kspace-kit-mini-n">${String(dIdx + 1).padStart(2, '0')}</span>
                      <i className="kspace-mob-dot" style=${{ background: DC[d.disc] || '#0a84ff' }} />
                      <span>${d.title}</span>
                    </div>`
                  )}
                  ${kitDocs.length > 3 &&
                  html`<div className="kspace-kit-mini-more">+${kitDocs.length - 3} more standards</div>`}
                </div>
                <div className="kspace-kit-pack-foot">
                  <span>${c.owner || 'Curated'}</span>
                  <span className="kspace-kit-go">Unpack Kit →</span>
                </div>
              </div>`;
            })}
          </div>`
        : html`<div className="kspace-empty" style=${{ position: 'relative', inset: 'auto', minHeight: 260 }}>
            <div className="empty">
              <${Ic} n="folder" s=${30} />
              <b>No kits match this filter</b>
              <span>Switch tier filter or create a new kit for your team.</span>
            </div>
          </div>`}
    </div>`}

    ${!isMobile &&
    (count
      ? html`<div
          ref=${viewportRef}
          aria-hidden=${isHeroMode || isKitsOverview ? 'true' : undefined}
          className=${'kspace-viewport' +
            (activeFormation === 'grid' ? ' is-grid' : '') +
            (activeFormation === 'graph' ? ' is-graph' : '')}
          onPointerDown=${onPointerDown}
          onPointerMove=${onPointerMove}
          onPointerUp=${onPointerUp}
          onPointerCancel=${onPointerUp}
          onPointerLeave=${onViewportPointerLeave}
        >
          ${activeFormation === 'graph' &&
          !isHeroMode &&
          !isKitsOverview &&
          html`<svg className="kspace-graph-svg" aria-hidden="true">
            ${graphData.edges.map(
              (e, eIdx) => html`<g
                key=${`${e.from}-${e.to}-${e.kind}-${eIdx}`}
                ref=${(el) => {
                  graphEdgeGroupRefs.current[eIdx] = el;
                }}
                className=${'kspace-graph-edge' + (e.kind === 'hard' ? ' is-hard' : ' is-soft')}
              >
                <path
                  ref=${(el) => {
                    edgePathRefs.current[eIdx] = el;
                  }}
                  fill="none"
                />
                <polygon
                  ref=${(el) => {
                    edgeArrowRefs.current[eIdx] = el;
                  }}
                />
              </g>`
            )}
          </svg>`}

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
              const isGraphSelected = activeFormation === 'graph' && graphSelectedId === r.id;
              const isGraphHover = activeFormation === 'graph' && graphHoverId === r.id;
              const isGraphNeighbor = Boolean(
                activeFormation === 'graph' && graphFocusNeighbors && graphFocusNeighbors.has(r.id) && graphFocusId !== r.id
              );
              const isGraphDim = Boolean(
                activeFormation === 'graph' && graphFocusNeighbors && !graphFocusNeighbors.has(r.id)
              );
              const gDeg = activeFormation === 'graph' ? graphData.adjMap.get(r.id)?.size || 0 : 0;

              return html`<div
                key=${r.id}
                data-doc-id=${r.id}
                ref=${(el) => {
                  cardRefs.current[idx] = el;
                }}
                className=${'card kspace-card' +
                  (activeFormation === 'graph' ? ' is-graph-node' : '') +
                  (isGraphSelected ? ' is-graph-selected' : '') +
                  (isGraphHover ? ' is-graph-hover' : '') +
                  (isGraphNeighbor ? ' is-graph-neighbor' : '') +
                  (isGraphDim ? ' is-graph-dim' : '') +
                  (isAiSource ? ' is-ai-source' : '') +
                  (isSearchMatch ? ' is-search-match' : '') +
                  (isHighlighted ? ' is-spotlight' : '')}
                role="button"
                tabIndex="0"
                aria-label=${`${r.title} (${r.disc || 'VDC'})`}
                style=${{
                  width: cardW + 'px',
                  height: cardH + 'px',
                  marginLeft: -(cardW / 2) + 'px',
                  marginTop: -(cardH / 2) + 'px',
                }}
                onPointerEnter=${() => {
                  hoveredIdxRef.current = idx;
                  if (activeFormation === 'graph') setGraphHoverId(r.id);
                  wakeMotionRef.current();
                }}
                onPointerLeave=${() => {
                  if (hoveredIdxRef.current === idx) {
                    hoveredIdxRef.current = -1;
                    wakeMotionRef.current();
                  }
                  if (activeFormation === 'graph') {
                    setGraphHoverId((cur) => (cur === r.id ? null : cur));
                  }
                }}
                onFocus=${(e) => {
                  if (e.currentTarget.matches && e.currentTarget.matches(':focus-visible')) {
                    if (activeFormation === 'space') rotateToAngle(colAngle);
                  }
                }}
                onClick=${() => {
                  if (performance.now() < suppressClickUntilRef.current) return;
                  if (activeFormation === 'graph') {
                    if (graphSelectedId !== r.id) {
                      setGraphSelectedId(r.id);
                      return;
                    }
                    triggerOpenCard(r.id, idx, colAngle);
                    return;
                  }
                  triggerOpenCard(r.id, idx, colAngle);
                }}
                onDoubleClick=${() => {
                  if (activeFormation === 'graph') {
                    triggerOpenCard(r.id, idx, colAngle);
                  }
                }}
                onKeyDown=${(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (activeFormation === 'graph' && graphSelectedId !== r.id) {
                      setGraphSelectedId(r.id);
                      return;
                    }
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
                  ${activeKit &&
                  canEditActiveKit &&
                  html`<button
                    type="button"
                    title="Remove from Kit"
                    aria-label="Remove from Kit"
                    onClick=${(e) => {
                      e.stopPropagation();
                      removeItemFromActiveKit(r.id);
                    }}
                  >
                    <${Ic} n="x" s=${13} />
                  </button>`}
                </div>

                <div className="ch2">
                  <span className="tl" style=${{ '--c': DC[r.disc] || '#0a84ff' }}>
                    <${Ic} n=${r.type} s=${activeFormation === 'graph' ? 14 : 17} />
                  </span>
                  <span className="who">
                    <b>
                      ${r._kitStep &&
                      html`<span className="kspace-kit-step-inline">#${String(r._kitStep).padStart(2, '0')}</span>`}
                      <span>${r.disc || 'VDC'}</span>
                    </b>
                    <small>${catName ? `${TY[r.type] || 'Document'} · ${catName}` : TY[r.type] || 'Document'}</small>
                  </span>
                </div>

                <h3>${r.title || 'Untitled standard'}</h3>
                <p>${r.desc || 'No summary added yet.'}</p>
                ${r._kitNote && activeFormation !== 'graph' && html`<div className="kspace-kit-note">${r._kitNote}</div>`}

                <div className="row">
                  <${Pill} s=${r.status} />
                  ${r.vis && r.vis !== 'Internal' && activeFormation !== 'graph' && html`<${VisPill} v=${r.vis} />`}
                  <span>v${(r.v && r.v.length) || 1}</span>
                  ${activeFormation === 'graph' &&
                  gDeg > 0 &&
                  html`<span className="kspace-graph-deg" style=${{ marginLeft: 'auto' }}>${gDeg} links</span>`}
                  ${activeFormation !== 'graph' &&
                  (r.url && isResType(r.type)
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
                      </span>`)}
                </div>
              </div>`;
            })}
          </div>
        </div>`
      : !isHeroMode &&
        !isKitsOverview &&
        html`<div className="kspace-empty">
          <div className="empty">
            <${Ic} n="search" s=${34} />
            <b>${activeKit ? 'This Starter Kit has no visible standards' : 'No matching standards in view'}</b>
            <span>${activeKit ? 'Add documents to this kit or clear discipline filters.' : 'Try another phrasing, press Ask for AI synthesis, or clear the query.'}</span>
            <div style=${{ display: 'flex', gap: 8, marginTop: 6 }}>
              ${activeKit &&
              canEditActiveKit &&
              html`<button type="button" className="btn p" onClick=${() => setAddingToKitOpen(true)}>
                <${Ic} n="plus" s=${14} /><span>Add doc to Kit</span>
              </button>`}
              ${!activeKit &&
              spaceQuery.trim() &&
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
        </div>`)}

    <${KitComposerModal}
      open=${kitCreateOpen}
      role=${role}
      userName=${userName}
      onClose=${closeKitCreate}
      onCreate=${handleCreateKit}
    />

    <div className="kspace-vignette" aria-hidden="true"></div>

    ${cmdOpen &&
    html`<div
      className="kspace-cmd-ov"
      onClick=${() => onSetCmdOpen && onSetCmdOpen(false)}
      aria-hidden="true"
    ></div>`}

    <div
      ref=${dockWrapRef}
      className=${'kspace-dock' + (isHeroMode ? ' is-hero' : '')}
      onPointerDown=${(e) => e.stopPropagation()}
    >
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

      ${isHeroMode &&
      !cmdOpen &&
      !desktopChatOpen &&
      html`<div className="kspace-hero-head">
        <span className="kspace-ai-badge"><${Ic} n="spark" s=${12} /> Datum Knowledge · Chat-First</span>
        <h1 className="kspace-hero-title">Ask standards, explore spatial knowledge</h1>
        <p className="kspace-hero-sub">Start typing to bloom matching tiles in 3D, ask Datum AI, or choose a formation below.</p>
      </div>`}

      ${!isMobile &&
      activeFormation === 'graph' &&
      !isHeroMode &&
      !isKitsOverview &&
      !desktopChatOpen &&
      !cmdOpen &&
      graphSelectedId &&
      (() => {
        const selDoc = poolById.get(graphSelectedId) || displayItems.find((d) => d.id === graphSelectedId);
        if (!selDoc) return null;
        const outIds = graphData.edges.filter((e) => e.from === selDoc.id).map((e) => e.to);
        const inIds = graphData.edges.filter((e) => e.to === selDoc.id).map((e) => e.from);
        return html`<div className="kspace-graph-selbar" role="region" aria-label="Selected graph standard connections">
          <div className="kspace-gs-head">
            <span className="kspace-gs-node">
              <i className="kspace-mob-dot" style=${{ background: DC[selDoc.disc] || '#0a84ff' }} />
              <span className="kspace-gs-disc">${selDoc.disc || 'VDC'}</span>
              <b>${selDoc.title}</b>
            </span>
            <span className="kspace-gs-meta">${outIds.length} deps · ${inIds.length} inbound</span>
            <div className="kspace-gs-acts">
              <button
                type="button"
                className="kspace-mini-btn"
                onClick=${() => focusGraphNode(selDoc.id)}
              >
                Focus
              </button>
              <button
                type="button"
                className="btn p sm"
                onClick=${() => triggerOpenCard(selDoc.id)}
              >
                Open Standard ↗
              </button>
              <button
                type="button"
                className="kspace-pop-x"
                aria-label="Clear selection"
                onClick=${() => setGraphSelectedId(null)}
              >
                <${Ic} n="x" s=${12} />
              </button>
            </div>
          </div>

          <div className="kspace-gs-rels">
            ${outIds.length > 0 &&
            html`<div className="kspace-gs-group">
              <span className="kspace-gs-lbl">Depends on →</span>
              ${outIds.map((id, oIdx) => {
                const d = poolById.get(id);
                if (!d) return null;
                return html`<button
                  key=${`out-${id}-${oIdx}`}
                  type="button"
                  className="kspace-gs-chip"
                  style=${{ '--c': DC[d.disc] || '#0a84ff' }}
                  onMouseEnter=${() => setGraphHoverId(id)}
                  onMouseLeave=${() => setGraphHoverId((cur) => (cur === id ? null : cur))}
                  onClick=${() => focusGraphNode(id)}
                >
                  <i className="kspace-mob-dot" />
                  <span>${d.title}</span>
                </button>`;
              })}
            </div>`}
            ${inIds.length > 0 &&
            html`<div className="kspace-gs-group">
              <span className="kspace-gs-lbl">← Used by</span>
              ${inIds.map((id, iIdx) => {
                const d = poolById.get(id);
                if (!d) return null;
                return html`<button
                  key=${`in-${id}-${iIdx}`}
                  type="button"
                  className="kspace-gs-chip"
                  style=${{ '--c': DC[d.disc] || '#0a84ff' }}
                  onMouseEnter=${() => setGraphHoverId(id)}
                  onMouseLeave=${() => setGraphHoverId((cur) => (cur === id ? null : cur))}
                  onClick=${() => focusGraphNode(id)}
                >
                  <i className="kspace-mob-dot" />
                  <span>${d.title}</span>
                </button>`;
              })}
            </div>`}
            ${outIds.length === 0 &&
            inIds.length === 0 &&
            html`<span className="kspace-gs-empty">Standalone node in current view · click again or press Open Standard ↗</span>`}
          </div>
        </div>`;
      })()}

      ${!isMobile &&
      !desktopChatOpen &&
      !cmdOpen &&
      !isHeroMode &&
      !isKitsOverview &&
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
              title="Hover to center · Click to open"
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
      !isKitsOverview &&
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
      (activeChat || mobHistoryOpen || mobBrowseOpen || isKitsOverview || activeKit || spaceFilterMode === 'bookmarks' || Boolean(f && f.disc)) &&
      html`<div className="kspace-mob-toprow">
        ${chats.length > 0 &&
        html`<button
          type="button"
          className=${'kspace-mob-top-pill' + (mobHistoryOpen ? ' on' : '')}
          onClick=${() => {
            setMobHistoryOpen((v) => !v);
            setMobBrowseOpen(false);
            setMobMenuOpen(false);
            if (isKitsOverview || activeKit) {
              onSelectKit && onSelectKit(null);
              onSelectViewMode && onSelectViewMode('space');
            }
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
                onSelectKit && onSelectKit(null);
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
                onSelectKit && onSelectKit(null);
                onSelectViewMode && onSelectViewMode('space');
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
                setMobHistoryOpen(false);
                setMobBrowseOpen(false);
                onSelectKit && onSelectKit(null);
                onSelectViewMode && onSelectViewMode('kits');
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
                onSelectKit && onSelectKit(null);
                onSelectViewMode && onSelectViewMode('space');
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
      !cmdOpen &&
      (isKitsOverview || activeKit) &&
      html`<div className="kspace-mob-results">
        <div className="kspace-mob-res-head">
          <div className="kspace-mob-res-title">
            <b>${activeKit ? activeKit.name : 'Starter Kits'}</b>
            <span>${activeKit ? sourceBaseItems.length : filteredKits.length}</span>
          </div>
          <div className="kspace-mob-res-acts">
            ${activeKit
              ? html`<button
                  type="button"
                  className="kspace-mini-btn"
                  onClick=${() => {
                    onSelectKit && onSelectKit(null);
                    onSelectViewMode && onSelectViewMode('kits');
                  }}
                >
                  ← All Kits
                </button>`
              : !isGuest &&
                normRole(role) !== 'Guest' &&
                html`<button
                  type="button"
                  className="kspace-mini-btn"
                  onClick=${() => (onCreatingKitChange ? onCreatingKitChange(true) : setLocalCreatingKit(true))}
                >
                  + New Kit
                </button>`}
            <button
              type="button"
              className="kspace-mini-btn"
              onClick=${() => {
                onSelectKit && onSelectKit(null);
                onSelectViewMode && onSelectViewMode('space');
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div className="kspace-mob-list">
          ${isKitsOverview
            ? filteredKits.map((c) => {
                const kitCount = (c.items || []).length;
                return html`<button
                  key=${c.id}
                  type="button"
                  className="kspace-mob-card"
                  style=${{ '--c': TIER_COL[c.tier] || '#0a84ff' }}
                  onClick=${() => onSelectKit && onSelectKit(c.id)}
                >
                  <div className="kspace-mob-card-top">
                    <span className="kspace-mob-disc">
                      <i className="kspace-mob-dot" />
                      <span>${TIER_LABEL[c.tier] || 'Kit'}</span>
                    </span>
                    <span className="kspace-mob-meta">${kitCount} ${kitCount === 1 ? 'item' : 'items'}</span>
                  </div>
                  <div className="kspace-mob-card-title">${c.name}</div>
                  ${c.desc && html`<div className="kspace-mob-card-desc">${c.desc}</div>`}
                </button>`;
              })
            : sourceBaseItems.map(
                (r) => html`<button
                  key=${r.id}
                  type="button"
                  className="kspace-mob-card"
                  style=${{ '--c': DC[r.disc] || '#0a84ff' }}
                  onClick=${() => triggerOpenCard(r.id)}
                >
                  <div className="kspace-mob-card-top">
                    <span className="kspace-mob-disc">
                      <i className="kspace-mob-dot" />
                      <span>#${String(r._kitStep || 1).padStart(2, '0')} · ${r.disc || 'General'}</span>
                    </span>
                    <span className="kspace-mob-meta">${TY[r.type] || 'Document'}</span>
                  </div>
                  <div className="kspace-mob-card-title">${r.title}</div>
                  ${r._kitNote && html`<div className="kspace-mob-card-desc">${r._kitNote}</div>`}
                </button>`
              )}
        </div>
      </div>`}

      ${isMobile &&
      !mobHistoryOpen &&
      !isKitsOverview &&
      !activeKit &&
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
                setMobMenuOpen(false);
                onSelectKit && onSelectKit(null);
                onSelectViewMode && onSelectViewMode('kits');
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
            if (val.trim()) ensureStageOpen();
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
            : isHeroMode
            ? 'Ask Datum AI anything or type to reveal 3D Space (EN/UA)…'
            : isKitsOverview
            ? 'Search Starter Kits or ask Datum AI…'
            : activeFormation === 'graph'
            ? 'Filter Graph nodes or ask Datum AI (EN/UA)…'
            : activeFormation === 'grid'
            ? 'Filter Grid or ask Datum AI (EN/UA)…'
            : 'Search 3D Space, ask Datum AI (EN/UA), or press Ctrl+K…'}
          aria-label="Search Knowledge Base, ask Datum AI, or open commands"
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
        ${(spaceQuery || (!isMobile && desktopChatOpen && activeChat) || spaceFilterMode !== 'all' || (!isMobile && graphSelectedId)) &&
        html`<button
          type="button"
          className="kspace-ask-clr"
          aria-label="Clear search and show full library"
          title="Reset filter & show library"
          onClick=${clearSpaceSearch}
        >
          <${Ic} n="x" s=${13} />
        </button>`}
        <button
          type="button"
          className=${'kspace-ask-kbd' + (cmdOpen ? ' on' : '')}
          title=${`Quick commands & instant hits (${kb})`}
          aria-expanded=${cmdOpen}
          onClick=${() => onSetCmdOpen && onSetCmdOpen(!cmdOpen)}
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
          ${!isMobile &&
          isHeroMode &&
          html`<${Fragment}>
            <button
              type="button"
              className="kspace-pchip kspace-pchip-hero"
              onClick=${() => {
                ensureStageOpen();
                onSelectViewMode && onSelectViewMode('space');
              }}
              title="Bloom all standards into 3D Space"
            >
              <${Ic} n="globe" s=${12} />
              <span>Explore Space (${allCount || items.length})</span>
            </button>
            <button
              type="button"
              className="kspace-pchip"
              onClick=${() => {
                ensureStageOpen();
                onSelectViewMode && onSelectViewMode('grid');
              }}
              title="Open flat card matrix"
            >
              <${Ic} n="layout" s=${11} />
              <span>Grid</span>
            </button>
            <button
              type="button"
              className="kspace-pchip"
              onClick=${() => {
                ensureStageOpen();
                onSelectViewMode && onSelectViewMode('graph');
              }}
              title="Open live dependency graph"
            >
              <${Ic} n="graph" s=${11} />
              <span>Graph</span>
            </button>
          </${Fragment}>`}

          ${!isGuest &&
          favs.length > 0 &&
          html`<button
            type="button"
            className=${'kspace-pchip kspace-pchip-acc' + (spaceFilterMode === 'bookmarks' ? ' on' : '')}
            onClick=${() => {
              ensureStageOpen();
              setDesktopChatOpen(false);
              setSpaceFilterMode((m) => (m === 'bookmarks' ? 'all' : 'bookmarks'));
            }}
            title="Spotlight your bookmarked standards"
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
              ensureStageOpen();
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
            className=${'kspace-pchip kspace-pchip-kit' + (isKitsOverview || activeKit ? ' on' : '')}
            onClick=${() => {
              if (isKitsOverview) {
                ensureStageOpen();
                onSelectViewMode && onSelectViewMode('space');
              } else {
                onSelectKit && onSelectKit(null);
                onSelectViewMode && onSelectViewMode('kits');
              }
            }}
            title="Starter Kits & Playbooks"
          >
            <${Ic} n="folder" s=${11} />
            <span>Starter Kits (${visibleKits.length})</span>
          </button>`}

          ${!desktopChatOpen &&
          !spaceQuery.trim() &&
          !isKitsOverview &&
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

        ${!isMobile &&
        !isHeroMode &&
        !isKitsOverview &&
        (activeFormation === 'graph'
          ? html`<div className="kspace-hud is-graph-hud" role="toolbar" aria-label="Graph navigation controls">
              <button
                type="button"
                className="kspace-hud-btn"
                aria-label="Zoom out graph"
                title="Zoom out"
                onClick=${() => zoomGraphBy(0.84)}
              >
                <${Ic} n="minus" s=${12} />
              </button>
              <span className="kspace-hud-col show">${graphZoomPct}%</span>
              <button
                type="button"
                className="kspace-hud-btn"
                aria-label="Zoom in graph"
                title="Zoom in"
                onClick=${() => zoomGraphBy(1.19)}
              >
                <${Ic} n="plus" s=${12} />
              </button>
              <button
                type="button"
                className="kspace-hud-reset"
                title="Fit graph to view"
                onClick=${resetCamera}
              >
                Fit
              </button>
              <div className="kspace-graph-opts-wrap">
                <button
                  type="button"
                  className=${'kspace-hud-reset' + (graphOptsOpen ? ' on' : '')}
                  title="Graph visibility options"
                  onClick=${() => setGraphOptsOpen((v) => !v)}
                >
                  Links
                </button>
                ${graphOptsOpen &&
                html`<div className="kspace-graph-opts-pop" role="menu">
                  <button
                    type="button"
                    className=${'kspace-gopt-row' + (graphIncludeSoft ? ' on' : '')}
                    onClick=${() => setGraphIncludeSoft((v) => !v)}
                  >
                    <span>Soft references</span>
                    <span>${graphIncludeSoft ? 'On' : 'Off'}</span>
                  </button>
                  <button
                    type="button"
                    className=${'kspace-gopt-row' + (graphIncludeOrphans ? ' on' : '')}
                    onClick=${() => setGraphIncludeOrphans((v) => !v)}
                  >
                    <span>Standalone docs</span>
                    <span>${graphIncludeOrphans ? 'On' : 'Off'}</span>
                  </button>
                  <button
                    type="button"
                    className="kspace-gopt-row"
                    onClick=${() => {
                      graphCustomPosRef.current.clear();
                      setGraphLayoutRev((r) => r + 1);
                      setGraphOptsOpen(false);
                      wakeMotionRef.current();
                    }}
                  >
                    <span>Reset node layout</span>
                    <span>↺</span>
                  </button>
                </div>`}
              </div>
            </div>`
          : activeFormation === 'grid'
          ? html`<div className="kspace-hud is-grid-hud" role="toolbar" aria-label="Grid scroll controls">
              <button
                type="button"
                className="kspace-hud-btn up"
                aria-label="Scroll up"
                title="Scroll up"
                onClick=${() => stepRotate(-1)}
              >
                <${Ic} n="chev" s=${13} />
              </button>
              <span className="kspace-hud-col show">${count} cards</span>
              <button
                type="button"
                className="kspace-hud-btn down"
                aria-label="Scroll down"
                title="Scroll down"
                onClick=${() => stepRotate(1)}
              >
                <${Ic} n="chev" s=${13} />
              </button>
              <button
                ref=${resetBtnRef}
                type="button"
                className="kspace-hud-reset"
                hidden
                title="Back to top"
                onClick=${resetCamera}
              >
                Top
              </button>
            </div>`
          : html`<div className="kspace-hud" role="toolbar" aria-label="Spatial navigation controls">
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
            </div>`)}
      </div>
    </div>
  </section>`;
}
