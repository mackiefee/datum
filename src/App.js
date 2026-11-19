'use client';

import { html, Fragment, useState, useMemo, useEffect, useRef } from './lib/react.js';
import { TODAY, KB, ST, TY, STG, DISC, DC, RD, ROLES, can, normRole, isDocType, isResType } from './config/constants.js';
import { TREE, buildFlat, sub, byId } from './data/spaces.js';
import { IMG0, GUIDE, SEED, USERS, SEED_TEAMS, SEED_COLLECTIONS } from './data/seed.js';
import { db } from './lib/db.js';
import { edgeClient } from './lib/edgeClient.js';
import {
  loadStoredSession,
  saveStoredSession,
  consumeSupabaseOAuthHash,
  startSupabaseGoogleOAuth,
  signOutAuth,
  makeGooglePhotoFallback,
} from './lib/auth.js';
import { fmt, pl, relTime } from './utils/format.js';
import { hay, scoreDocument, tokenizeUnique } from './utils/search.js';
import {
  loadChats,
  saveChats,
  loadActiveChatId,
  saveActiveChatId,
  createPendingChatTurn,
  resolvePendingChatTurn,
} from './utils/chats.js';
import { docxImport } from './utils/docx.js';
import { Ic, DatumMark } from './components/Icon.js';
import { Pill, VisPill } from './components/Badge.js';
import { FilterPopover, SortPopover, ViewModeSwitch, UserSwitcher } from './components/Select.js';
import { Node } from './components/SpaceTree.js';
import { Pal } from './components/CommandPalette.js';
import { Drawer } from './components/ResourceDrawer.js';
import { PublicPreviewModal } from './components/PublicPreviewModal.js';
import { RevitLinkModal, parseRevitLinkUrl } from './components/RevitLinkModal.js';
import { LoginView } from './components/LoginView.js';
import { CategoryModal } from './components/CategoryModal.js';
import { Reader } from './features/reader/Reader.js';
import { Graph } from './features/graph/GraphView.js';
import { CollectionsView } from './features/collections/CollectionsView.js';
import { RevitTypeView } from './features/revitType/RevitTypeView.js';
import { NamingStudioView } from './features/naming/NamingStudioView.js';
import { KnowledgeSpaceView } from './features/space/KnowledgeSpaceView.js';
import { AdminView } from './features/admin/AdminView.js';
import { TeamView } from './features/team/TeamView.js';
import { SecondBrainView } from './features/brain/SecondBrainView.js';
import { QuickCaptureModal } from './components/QuickCaptureModal.js';
import { PlannerManageSheet } from './components/PlannerManageSheet.js';
import { normalizePlannerPrefs, isDoneStatus, getFirstActiveStatus } from './utils/planner.js';

const DATASET_VER = "c10-interior-v3";
const RESET_KEYS_ON_CUTOVER = [
  "kb2-res", "kb2-tree", "kb2-cols", "kb2-acts", "kb2-notes",
  "kb2-pins", "kb2-fav", "kb2-req", "kb2-ack",
  "kb2-hist", "kb2-chk", "kb2-img", "kb2-users", "kb2-teams",
];

function ensureDatasetVersion() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("kb2-watch");
    if (localStorage.getItem("kb2-dataset-ver") !== DATASET_VER) {
      RESET_KEYS_ON_CUTOVER.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem("kb2-dataset-ver", DATASET_VER);
    }
  } catch (e) {}
}

export function App() {
  ensureDatasetVersion();
  const [res, setRes] = useState(() => {
    const a = db.load("kb2-res", null);
    if (!a || !Array.isArray(a) || !a.length) return [GUIDE, ...SEED];
    let list = a.some((x) => x.id === 100) ? a : [GUIDE, ...a];
    // Non-destructively ensure newly added standard naming doc (#137) is available in existing sessions
    const seed137 = SEED.find((x) => x.id === 137);
    if (seed137 && !list.some((x) => x.id === 137)) {
      list = [...list, seed137];
    }
    return list;
  });
  const [tree, setTree] = useState(() => db.load("kb2-tree", null) || TREE);
  const [users, setUsers] = useState(() => {
    const saved = db.load("kb2-users", null);
    if (!saved || !Array.isArray(saved) || saved.length === 0) return USERS;
    return saved;
  });
  const [directorySyncState, setDirectorySyncState] = useState("synced");
  const [adminTabSeed, setAdminTabSeed] = useState("gov");
  const [teams, setTeams] = useState(() => db.load("kb2-teams", null) || SEED_TEAMS);
  const [activeUserId, setActiveUserId] = useState(() => db.load("kb2-uid", "u1"));
  const [authSession, setAuthSession] = useState(() => loadStoredSession());
  const [catModal, setCatModal] = useState(null);
  const [cols, setCols] = useState(() => db.load("kb2-cols", null) || SEED_COLLECTIONS);
  const [shares, setShares] = useState(() => db.load("kb2-shares", null) || []);
  const [activities, setActivities] = useState(() => {
    const saved = db.load("kb2-acts", null);
    if (!Array.isArray(saved)) return [];
    return saved.filter((a) => a && !["act-1", "act-2", "act-3", "act-4"].includes(String(a.id)));
  });
  const [searchLogs, setSearchLogs] = useState(() => db.load("kb2-slogs", null) || []);
  const [flaggedIds, setFlaggedIds] = useState(() => db.load("kb2-flags", null) || []);
  const [namingSchemas, setNamingSchemas] = useState(() => {
    const saved = db.load("datum-naming-custom-schemas-v1", null);
    return Array.isArray(saved) ? saved : [];
  });
  const [teamAcks, setTeamAcks] = useState(() => db.load("kb2-team-acks", null) || {});
  const [pinned, setPinned] = useState(() => db.load("kb2-pins", null) || [100, 113, 129, 132]);

  const [favs, setFavs] = useState(() => db.load("kb2-fav", null) || [102, 118, 123]);

  const [view, setView] = useState("kb");
  const [assemblyId, setAssemblyId] = useState(null);
  const [revitTypeCtx, setRevitTypeCtx] = useState(null);
  const [namingTypeSeed, setNamingTypeSeed] = useState("");
  const [revitLinkCtx, setRevitLinkCtx] = useState(null);
  const closeRevitLink = () => {
    setRevitLinkCtx(null);
    if (typeof window !== "undefined") {
      try {
        window.history.replaceState({}, "", "/");
      } catch {}
    }
  };
  const [cur, setCur] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [kbDisplay, setKbDisplay] = useState("space");
  const [brainLayer, setBrainLayer] = useState("all"); // 'all' | 'mine' | 'team'
  const [spaceProject, setSpaceProject] = useState("all");
  const kbDisplayLoaded = useRef(false);
  useEffect(() => {
    if (!kbDisplayLoaded.current) {
      kbDisplayLoaded.current = true;
      const saved = db.load("kb2-display-v2", "space");
      if (saved === "grid" || saved === "space" || saved === "graph" || saved === "tasks") {
        setKbDisplay(saved);
      }
      return;
    }
    db.save("kb2-display-v2", kbDisplay);
  }, [kbDisplay]);
  const [activeKitId, setActiveKitId] = useState(null);
  const [kitTier, setKitTier] = useState("all");
  const [creatingKit, setCreatingKit] = useState(false);
  const [spaceStageOpen, setSpaceStageOpen] = useState(false);
  const [heroResetSig, setHeroResetSig] = useState(0);
  const [open, setOpen] = useState([]);
  const [q, setQ] = useState("");
  const [f, setF] = useState({});
  const [sel, setSel] = useState(null);
  const [bell, setBell] = useState(false);
  const [nav, setNav] = useState(false);
  const [spaceChatSig, setSpaceChatSig] = useState(0);
  const navRef = useRef(false);
  navRef.current = nav;

  const [pubTarget, setPubTarget] = useState(null);
  const [acks, setAcks] = useState(() => db.load("kb2-ack", null) || {});
  const [req, setReq] = useState(() => db.load("kb2-req", null) || [100, 112, 127]);
  const [hist, setHist] = useState(() => db.load("kb2-hist", null) || []);
  const [seen, setSeen] = useState(() => db.load("kb2-seen", null) || "2026-11-13");
  const [chk, setChk] = useState(() => db.load("kb2-chk", null) || {});
  const [pal, setPal] = useState(false);
  const [aq, setAq] = useState(null);
  const [hf, setHf] = useState(0);
  const [read, setRead] = useState(null);
  const [readSection, setReadSection] = useState(null);
  const [imgs, setImgs] = useState(() => ({ ...IMG0, ...(db.load("kb2-img", null) || {}) }));
  const [sort, setSort] = useState("new");
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [toast, setToast] = useState(null);

  useEffect(() => { db.save("kb2-res", res); }, [res]);
  useEffect(() => { db.save("kb2-tree", tree); }, [tree]);
  useEffect(() => { db.save("kb2-users", users); }, [users]);
  useEffect(() => { db.save("kb2-teams", teams); }, [teams]);
  useEffect(() => { db.save("kb2-uid", activeUserId); }, [activeUserId]);
  const signedInRef = useRef(null);
  const readerBridgeRef = useRef(null);
  const omniRectRef = useRef(null);
  useEffect(() => {
    let alive = true;
    consumeSupabaseOAuthHash().then((out) => {
      if (!alive) return;
      if (out && out.ok && out.session && signedInRef.current) {
        signedInRef.current(out.session);
      } else if (out && out.error) {
        setToast(out.error);
      } else {
        const stored = loadStoredSession();
        if (stored) setAuthSession(stored);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search || "");
      const qCb = sp.get("revit_auth_cb") || "";
      if (qCb && /^http:\/\/(127\.0\.0\.1|localhost):\d+\/cb$/i.test(qCb)) {
        window.sessionStorage.setItem("datum-revit-auth-cb", qCb);
        window.sessionStorage.removeItem("datum-revit-oauth-started");
        sp.delete("revit_auth_cb");
        const cleanQs = sp.toString();
        window.history.replaceState(null, "", window.location.pathname + (cleanQs ? "?" + cleanQs : "") + (window.location.hash || ""));
      }
      const cbUrl = window.sessionStorage.getItem("datum-revit-auth-cb");
      if (!cbUrl) return;
      if (authSession && authSession.claims && authSession.claims.email) {
        window.sessionStorage.removeItem("datum-revit-auth-cb");
        window.sessionStorage.removeItem("datum-revit-oauth-started");
        const email = authSession.claims.email;
        const name = authSession.claims.name || email.split("@")[0];
        const role = authSession.claims.role || "Member";
        fetch("/api/revit/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
          .then((r) => r.json())
          .catch(() => null)
          .then((res) => {
            const tok = (res && res.token) || authSession.token || "";
            const u = (res && res.user) || {};
            const qs = new URLSearchParams({
              token: tok,
              email: u.email || email,
              name: u.name || name,
              role: u.role || role,
            });
            window.location.replace(`${cbUrl}?${qs.toString()}`);
          });
      } else if (
        !(window.location.hash || "").includes("access_token=") &&
        !window.sessionStorage.getItem("datum-revit-oauth-started")
      ) {
        window.sessionStorage.setItem("datum-revit-oauth-started", "1");
        startSupabaseGoogleOAuth();
      }
    } catch (e) {}
  }, [authSession]);
  useEffect(() => { db.save("kb2-cols", cols); }, [cols]);
  useEffect(() => { db.save("kb2-shares", shares); }, [shares]);
  useEffect(() => { db.save("kb2-acts", activities); }, [activities]);
  useEffect(() => { db.save("kb2-slogs", searchLogs); }, [searchLogs]);
  useEffect(() => { db.save("kb2-flags", flaggedIds); }, [flaggedIds]);
  useEffect(() => { db.save("kb2-pins", pinned); }, [pinned]);
  useEffect(() => { db.save("kb2-fav", favs); }, [favs]);
  useEffect(() => { db.save("datum-naming-custom-schemas-v1", namingSchemas); }, [namingSchemas]);
  useEffect(() => { db.save("kb2-team-acks", teamAcks); }, [teamAcks]);
  useEffect(() => { db.save("kb2-ack", acks); }, [acks]);
  useEffect(() => { db.save("kb2-req", req); }, [req]);
  useEffect(() => { db.save("kb2-hist", hist); }, [hist]);
  useEffect(() => { db.save("kb2-seen", seen); }, [seen]);
  useEffect(() => { db.save("kb2-chk", chk); }, [chk]);
  useEffect(() => { db.save("kb2-img", imgs); }, [imgs]);
  useEffect(() => {
    let alive = true;
    db.hydrateImages(imgs).then((hydrated) => {
      if (alive && hydrated) setImgs((o) => ({ ...o, ...hydrated }));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const qView = sp.get("view");
    const qAsm = sp.get("assembly");
    const qRead = sp.get("doc") || sp.get("read");
    const qType = sp.get("type");
    const qQuery = sp.get("q");
    const qAsk = sp.get("ask");
    const hashSec = (window.location.hash || "").match(/^#(s\d+|impact-graph)$/i);
    if (qView === "naming") {
      if (qType) setNamingTypeSeed(qType);
      setView("naming");
    } else if (qView === "3d") {
      if (qAsm) setAssemblyId(qAsm);
      setRevitTypeCtx({ category: "Walls", family: "Basic Wall", typeName: "3D Assembly & Wall Standards" });
      setView("type");
    } else if (qView === "wall") {
      setRevitTypeCtx({ category: "Walls", family: "Basic Wall", typeName: "Architectural Detail Reference" });
      setView("type");
    } else if (qView === "type") {
      let parsedLayers = [];
      const rawLayers = sp.get("layers");
      if (rawLayers) {
        try {
          const arr = JSON.parse(rawLayers);
          if (Array.isArray(arr)) parsedLayers = arr;
        } catch (e) {}
      }
      setRevitTypeCtx({
        category: sp.get("category") || "",
        family: sp.get("family") || "",
        typeName: sp.get("type") || "",
        fire: sp.get("fire") || "",
        func: sp.get("func") || "",
        width: sp.get("width") || "",
        acoustic: sp.get("acoustic") || "",
        layers: parsedLayers,
      });
      setView("type");
    }
    if (qQuery) {
      setQ(qQuery);
      setSpaceStageOpen(true);
    }
    if (qAsk) {
      setKbDisplay("space");
      setView("kb");
      setSpaceStageOpen(true);
      setAq({ q: qAsk, n: Date.now() });
    }
    if (qRead) {
      const docId = Number(qRead);
      if (!Number.isNaN(docId)) {
        setRead(docId);
        if (hashSec) {
          setReadSection({ docId, sectionId: hashSec[1], n: Date.now() });
        }
      }
    }
  }, []);

  useEffect(() => {
    const syncRevitLink = () => {
      const parsed = parseRevitLinkUrl(window.location.search, window.location.hash);
      if (parsed) {
        setRevitLinkCtx(parsed);
        return true;
      }
      return false;
    };
    syncRevitLink();
    const onRevitLoc = () => {
      if (!syncRevitLink() && window.location.pathname !== "/open") {
        setRevitLinkCtx(null);
      }
    };
    const onRevitLinkClick = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target && typeof e.target.closest === "function" ? e.target.closest("a[href]") : null;
      if (!a || a.closest(".rvt-lk-card")) return;
      const href = a.getAttribute("href") || "";
      const isUtk = /^utk:\/\/open\?/i.test(href);
      const isOpenPath = /^(?:https?:\/\/[^/]+)?\/open(?:[?#].*)$/i.test(href);
      if (!isUtk && !isOpenPath) return;
      const parsed = parseRevitLinkUrl(href);
      if (!parsed) return;
      e.preventDefault();
      try {
        window.history.pushState({}, "", `/open#${parsed.cleanFullRaw}`);
      } catch {}
      setRevitLinkCtx(parsed);
    };
    window.addEventListener("hashchange", onRevitLoc);
    window.addEventListener("popstate", onRevitLoc);
    document.addEventListener("click", onRevitLinkClick);
    return () => {
      window.removeEventListener("hashchange", onRevitLoc);
      window.removeEventListener("popstate", onRevitLoc);
      document.removeEventListener("click", onRevitLinkClick);
    };
  }, []);

  const sessionClaims = authSession && authSession.claims;
  const sessionEmail = sessionClaims && sessionClaims.email ? sessionClaims.email.trim().toLowerCase() : "";
  const matchedUser = sessionClaims
    ? users.find(
        (u) =>
          (sessionClaims.sub && (u.id === sessionClaims.sub || u.googleSub === sessionClaims.sub)) ||
          (sessionEmail && u.email && u.email.toLowerCase() === sessionEmail)
      )
    : null;
  const emptyFallbackUser = { id: "u-anon", name: "User", email: "", role: "Member", teams: [], status: "active" };
  const activeUser =
    matchedUser ||
    (sessionClaims
      ? {
          id: sessionClaims.sub || activeUserId || "u-session",
          name: sessionClaims.name || (sessionEmail ? sessionEmail.split("@")[0] : "Google User"),
          email: sessionClaims.email || "",
          role: normRole(sessionClaims.role),
          avatar: sessionClaims.avatar || makeGooglePhotoFallback(sessionClaims.name || "Google User"),
          provider: sessionClaims.provider || "google",
          emailVerified: sessionClaims.emailVerified !== false,
          teams: ["VDC"],
          status: "active",
        }
      : users.find((u) => u.id === activeUserId) || users[0] || emptyFallbackUser);
  const userName = activeUser.name;
  const role = activeUser.status === "deactivated" ? "Guest" : normRole(activeUser.role);
  const userTeams = activeUser.teams || [];
  const isGuest = role === "Guest";

  const applyDirectoryPayload = (data) => {
    if (!data || !data.configured || !Array.isArray(data.users)) return;
    setUsers(data.users);
    db.save("kb2-users", data.users);
    if (Array.isArray(data.teams) && data.teams.length > 0) {
      const mergedTeams = data.teams.map((tm) => {
        const seedMatch = SEED_TEAMS.find(
          (st) => st.name.toLowerCase() === tm.name.toLowerCase() ||
                  (tm.name.toLowerCase() === "interior" && st.name.toLowerCase().startsWith("interior"))
        );
        return {
          ...tm,
          desc: tm.desc || (seedMatch && seedMatch.desc) || "Workspace department & content contributors.",
        };
      });
      setTeams(mergedTeams);
      db.save("kb2-teams", mergedTeams);
    }
  };

  const refreshDirectory = async (emailOverride = "") => {
    const callerEmail = (emailOverride || sessionEmail || "").trim().toLowerCase();
    if (!callerEmail) return null;
    setDirectorySyncState((prev) => (prev === "saving" ? prev : "loading"));
    try {
      const data = await db.directory.fetchAll(callerEmail);
      applyDirectoryPayload(data);
      setDirectorySyncState("synced");
      return data;
    } catch (e) {
      setDirectorySyncState("error");
      return null;
    }
  };

  const resRef = useRef(res);
  resRef.current = res;
  const workspaceHydratedRef = useRef(false);
  const lastMetaSyncRef = useRef({
    tree: "",
    activities: "",
    req: "",
    flaggedIds: "",
    searchLogs: "",
    shares: "",
    namingSchemas: "",
    teamAcks: "",
  });

  const refreshWorkspace = async (emailOverride = "") => {
    const callerEmail = (emailOverride || sessionEmail || "").trim().toLowerCase();
    if (!callerEmail) return null;
    try {
      let snap = await db.workspace.fetchSnapshot(callerEmail);
      if (snap && snap.configured && snap.needsSeed) {
        await db.workspace
          .seedIfEmpty(
            {
              items: [GUIDE, ...SEED],
              collections: SEED_COLLECTIONS,
              tree: TREE,
              activities: [],
              requiredIds: req,
            },
            callerEmail
          )
          .catch(() => null);
        snap = await db.workspace.fetchSnapshot(callerEmail);
      }
      if (!snap || !snap.configured) return snap;

      if (Array.isArray(snap.items) && snap.items.length > 0) {
        edgeClient.clearAiCache();
        setRes(snap.items);
        resRef.current = snap.items;
      }
      if (Array.isArray(snap.collections) && snap.collections.length > 0) {
        setCols(snap.collections);
      }
      if (Array.isArray(snap.tree) && snap.tree.length > 0) {
        setTree(snap.tree);
        lastMetaSyncRef.current.tree = JSON.stringify(snap.tree);
      }
      if (Array.isArray(snap.activities)) {
        const cleanActs = snap.activities.filter((a) => a && !["act-1", "act-2", "act-3", "act-4"].includes(String(a.id)));
        setActivities(cleanActs);
        lastMetaSyncRef.current.activities = JSON.stringify(cleanActs);
      }
      if (Array.isArray(snap.requiredIds)) {
        setReq(snap.requiredIds);
        lastMetaSyncRef.current.req = JSON.stringify(snap.requiredIds);
      }
      if (Array.isArray(snap.flaggedIds)) {
        setFlaggedIds(snap.flaggedIds);
        lastMetaSyncRef.current.flaggedIds = JSON.stringify(snap.flaggedIds);
      }
      if (Array.isArray(snap.searchLogs)) {
        setSearchLogs(snap.searchLogs);
        lastMetaSyncRef.current.searchLogs = JSON.stringify(snap.searchLogs);
      }
      if (Array.isArray(snap.shares)) {
        setShares(snap.shares);
        lastMetaSyncRef.current.shares = JSON.stringify(snap.shares);
      }
      if (Array.isArray(snap.namingSchemas)) {
        setNamingSchemas(snap.namingSchemas);
        db.save("datum-naming-custom-schemas-v1", snap.namingSchemas);
        lastMetaSyncRef.current.namingSchemas = JSON.stringify(snap.namingSchemas);
      }
      if (snap.teamAcks && typeof snap.teamAcks === "object") {
        setTeamAcks(snap.teamAcks);
        db.save("kb2-team-acks", snap.teamAcks);
        lastMetaSyncRef.current.teamAcks = JSON.stringify(snap.teamAcks);
      }
      workspaceHydratedRef.current = true;
      return snap;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    if (!sessionEmail || isGuest) return;
    refreshDirectory(sessionEmail);
    refreshWorkspace(sessionEmail);
  }, [sessionEmail, isGuest]);

  const dxr = useRef(null);
  const [sc, setSc] = useState(false);

  useEffect(() => {
    const fn = () => setSc(window.scrollY > 6);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    let r = 0;
    const upd = () => {
      document.querySelectorAll(".seg,.tabs").forEach((sg) => {
        let th = sg.querySelector(":scope>.thumb");
        if (!th) {
          th = document.createElement("i");
          th.className = "thumb";
          sg.prepend(th);
        }
        const on = sg.querySelector(":scope>button.on");
        if (!on || !on.offsetWidth) {
          th.style.opacity = 0;
          return;
        }
        th.style.opacity = 1;
        th.style.width = on.offsetWidth + "px";
        th.style.transform = "translateX(" + on.offsetLeft + "px)";
        if (!th.dataset.r) {
          th.dataset.r = 1;
          requestAnimationFrame(() => th.classList.add("rdy"));
        }
      });
    };
    const schedule = () => {
      cancelAnimationFrame(r);
      r = requestAnimationFrame(upd);
    };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    if (ro) ro.observe(document.body);
    window.addEventListener("resize", schedule);
    upd();
    return () => {
      cancelAnimationFrame(r);
      mo.disconnect();
      if (ro) ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPal((x) => !x);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setNav((v) => !v);
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setQcModal((prev) => (prev ? null : { mode: "task", doc: null }));
      }
      if (e.key === "Escape" && navRef.current) {
        e.preventDefault();
        setNav(false);
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const flash = (t) => {
    setToast(t);
    clearTimeout(window.__t);
    window.__t = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!workspaceHydratedRef.current || !sessionEmail || isGuest) return;
    const t = setTimeout(() => {
      const serialized = JSON.stringify(activities.slice(0, 60));
      if (serialized !== lastMetaSyncRef.current.activities) {
        lastMetaSyncRef.current.activities = serialized;
        db.workspace.syncMeta("activities", activities.slice(0, 60), sessionEmail).catch(() => {});
      }
    }, 900);
    return () => clearTimeout(t);
  }, [activities, sessionEmail, isGuest]);

  useEffect(() => {
    if (!workspaceHydratedRef.current || !sessionEmail || !can.createDraft(role)) return;
    const t = setTimeout(() => {
      const serialized = JSON.stringify(tree);
      if (serialized !== lastMetaSyncRef.current.tree) {
        lastMetaSyncRef.current.tree = serialized;
        db.workspace.syncMeta("categories_tree", tree, sessionEmail).catch(() => {});
      }
    }, 800);
    return () => clearTimeout(t);
  }, [tree, sessionEmail, role]);

  useEffect(() => {
    if (!workspaceHydratedRef.current || !sessionEmail || !can.createDraft(role)) return;
    const t = setTimeout(() => {
      const serialized = JSON.stringify(req);
      if (serialized !== lastMetaSyncRef.current.req) {
        lastMetaSyncRef.current.req = serialized;
        db.workspace.syncMeta("required_ids", req, sessionEmail).catch(() => {});
      }
    }, 600);
    return () => clearTimeout(t);
  }, [req, sessionEmail, role]);

  useEffect(() => {
    if (!workspaceHydratedRef.current || !sessionEmail || isGuest) return;
    const t = setTimeout(() => {
      const serialized = JSON.stringify(flaggedIds);
      if (serialized !== lastMetaSyncRef.current.flaggedIds) {
        lastMetaSyncRef.current.flaggedIds = serialized;
        db.workspace.syncMeta("flagged_ids", flaggedIds, sessionEmail).catch(() => {});
      }
    }, 700);
    return () => clearTimeout(t);
  }, [flaggedIds, sessionEmail, isGuest]);

  useEffect(() => {
    if (!workspaceHydratedRef.current || !sessionEmail || isGuest) return;
    const t = setTimeout(() => {
      const serialized = JSON.stringify(searchLogs);
      if (serialized !== lastMetaSyncRef.current.searchLogs) {
        lastMetaSyncRef.current.searchLogs = serialized;
        db.workspace.syncMeta("search_logs", searchLogs.slice(0, 40), sessionEmail).catch(() => {});
      }
    }, 900);
    return () => clearTimeout(t);
  }, [searchLogs, sessionEmail, isGuest]);

  useEffect(() => {
    if (!workspaceHydratedRef.current || !sessionEmail || isGuest) return;
    const t = setTimeout(() => {
      const serialized = JSON.stringify(teamAcks);
      if (serialized !== lastMetaSyncRef.current.teamAcks) {
        lastMetaSyncRef.current.teamAcks = serialized;
        db.workspace.syncMeta("team_acks", teamAcks, sessionEmail).catch(() => {});
      }
    }, 700);
    return () => clearTimeout(t);
  }, [teamAcks, sessionEmail, isGuest]);

  useEffect(() => {
    if (!workspaceHydratedRef.current || !sessionEmail || !can.createDraft(role)) return;
    const t = setTimeout(() => {
      const serialized = JSON.stringify(shares);
      if (serialized !== lastMetaSyncRef.current.shares) {
        lastMetaSyncRef.current.shares = serialized;
        db.workspace.syncMeta("direct_shares", shares, sessionEmail).catch(() => {});
      }
    }, 700);
    return () => clearTimeout(t);
  }, [shares, sessionEmail, role]);

  useEffect(() => {
    if (!workspaceHydratedRef.current || !sessionEmail || !can.createDraft(role)) return;
    const t = setTimeout(() => {
      const serialized = JSON.stringify(namingSchemas);
      if (serialized !== lastMetaSyncRef.current.namingSchemas) {
        lastMetaSyncRef.current.namingSchemas = serialized;
        db.workspace.syncMeta("naming_schemas", namingSchemas, sessionEmail).catch(() => {});
      }
    }, 800);
    return () => clearTimeout(t);
  }, [namingSchemas, sessionEmail, role]);

  const syncSharedItem = (item, mode = "save") => {
    if (!item || !sessionEmail || isGuest) return;
    db.workspace.upsertItem(item, mode, sessionEmail).catch(() => {});
  };

  const logAct = (action, targetType, targetId, targetTitle, note = "") => {
    setActivities((prev) => [
      {
        id: "act-" + Date.now() + Math.random().toString(36).slice(2, 5),
        actor: userName,
        actorEmail: sessionEmail || "",
        action,
        targetType,
        targetId: String(targetId),
        targetTitle,
        note,
        at: TODAY,
        ts: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const tgl = (set, id) => set((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const push = (text) => {
    flash(text);
  };
  const upd = (id, fn) => {
    db.invalidateArticle(id);
    edgeClient.clearAiCache();
    const prevItem = resRef.current.find((r) => r.id === id);
    if (prevItem) {
      const nextItem = fn(prevItem);
      const nextList = resRef.current.map((r) => (r.id === id ? nextItem : r));
      resRef.current = nextList;
      setRes(nextList);
      syncSharedItem(nextItem, "save");
      return;
    }
    setRes((rs) => rs.map((r) => (r.id === id ? fn(r) : r)));
  };
  const titleOf = (id) => (res.find((r) => r.id === id) || {}).title || "";

  const act = {
    onStatus: (id, s) => {
      upd(id, (r) => ({ ...r, status: s, vis: s !== "Approved" && r.vis === "Public" ? "Internal" : r.vis, upd: TODAY }));
      push(`Status of “${titleOf(id)}” → ${ST[s][0]}`, id);
      logAct("Status Changed", "item", id, titleOf(id), ST[s][0]);
    },
    onSave: (id, b) => {
      upd(id, (r) => ({
        ...r,
        body: b,
        upd: TODAY,
        verified: TODAY,
        v: [...r.v, { n: r.v.length + 1, by: userName, d: TODAY, note: "Edit", body: b }],
      }));
      push(`Updated “${titleOf(id)}”`, id);
      logAct("Edited", "item", id, titleOf(id));
    },
    onRollback: (id, v) => {
      upd(id, (r) => ({
        ...r,
        body: v.body,
        upd: TODAY,
        v: [...r.v, { n: r.v.length + 1, by: userName, d: TODAY, note: "Rollback to v" + v.n, body: v.body }],
      }));
      push(`Rolled back “${titleOf(id)}” to v${v.n}`, id);
      logAct("Rolled Back", "item", id, titleOf(id), "to v" + v.n);
    },
    onComment: (id, t) => {
      const nextComment = { by: userName, d: TODAY, t };
      db.invalidateArticle(id);
      edgeClient.clearAiCache();
      setRes((rs) => rs.map((r) => (r.id === id ? { ...r, c: [...(r.c || []), nextComment] } : r)));
      if (sessionEmail && !isGuest) {
        db.workspace.addComment(id, nextComment, sessionEmail).catch(() => {});
      }
      logAct("Commented", "item", id, titleOf(id), t.slice(0, 80));
      push(`Commented on “${titleOf(id)}”`, id);
    },
    onLink: (id, to, t) => {
      upd(id, (r) => ({ ...r, links: [...r.links, [to, t]] }));
      logAct("Linked", "item", id, titleOf(id), `→ ${titleOf(to)}`);
      push(`Linked “${titleOf(id)}” → “${titleOf(to)}”`, id);
    },
    onVerify: (id) => {
      upd(id, (r) => ({ ...r, verified: TODAY }));
      setFlaggedIds((fl) => fl.filter((x) => Number(x) !== Number(id)));
      flash("Verified as up to date");
      logAct("Verified", "item", id, titleOf(id), "Confirmed current");
    },
    onChangeVis: (id, vis) => {
      upd(id, (r) => ({ ...r, vis }));
      flash(`Visibility changed to ${vis}`);
      logAct("Visibility Changed", "item", id, titleOf(id), vis);
    },
    onChangeOwner: (id, nextOwner) => {
      upd(id, (r) => ({ ...r, author: nextOwner }));
      flash(`Owner assigned to ${nextOwner}`);
      logAct("Ownership Assigned", "item", id, titleOf(id), `→ ${nextOwner}`);
    },
    onTogglePublicAtt: (id, attId) => {
      upd(id, (r) => {
        const curAtts = r.publicAttachments || [];
        return {
          ...r,
          publicAttachments: curAtts.includes(attId) ? curAtts.filter((x) => x !== attId) : [...curAtts, attId],
        };
      });
    },
    onGrantShare: (itemId, grantee) => {
      setShares((prev) => [
        ...prev,
        { id: "sh-" + Date.now(), targetType: "item", targetId: itemId, grantee, role: "viewer", grantedBy: userName },
      ]);
      flash(`Direct access granted to ${grantee}`);
      logAct("Shared", "item", itemId, titleOf(itemId), `Pinpoint share → ${grantee}`);
    },
    onRevokeShare: (shareId) => {
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      flash("Share revoked");
    },
  };

  const rd = (id, opts = {}) => {
    setRead(id);
    if (opts && opts.sectionId) {
      setReadSection({ docId: id, sectionId: opts.sectionId, n: Date.now() });
    } else {
      setReadSection(null);
    }
    setSel(null);
    setBell(false);
    window.scrollTo({ top: 0 });
  };

  const createNewDoc = (initial = {}) => {
    if (!can.createDraft(role)) return;
    const id = Date.now();
    const node = initial.node || (byId(cur, tree) ? cur : "c10-ovw-std");
    const catObj = byId(node, tree);
    const title = initial.title || "";
    const body = initial.body || "";
    db.invalidateArticle(id);
    edgeClient.clearAiCache();
    const newItem = {
      id,
      node,
      title,
      desc: initial.desc || "",
      url: initial.url || "",
      body,
      type: initial.type || "doc",
      status: "Draft",
      vis: (catObj && catObj.vis) || "Internal",
      stage: STG[0],
      disc: (catObj && catObj.path && RD[catObj.path[0]]) || "VDC",
      tags: initial.tags || [],
      links: [],
      c: [],
      publicAttachments: [],
      author: userName,
      upd: TODAY,
      verified: TODAY,
      v: [{ n: 1, by: userName, d: TODAY, note: "Created", body }],
    };
    const nextList = [newItem, ...resRef.current];
    resRef.current = nextList;
    setRes(nextList);
    syncSharedItem(newItem, "save");
    if (title) logAct("Created", "item", id, title, "Draft");
    flash(title ? `Created “${title}”` : "New draft opened");
    rd(id);
  };

  const autoSaveItem = (id, patch, options = {}) => {
    if (!id || !patch) return;
    const prev = res.find((x) => x.id === id);
    upd(id, (r) => ({
      ...r,
      ...patch,
      upd: TODAY,
      verified: patch.status === "Approved" ? TODAY : r.verified,
    }));
    if (!options.silent && patch.status && prev && prev.status !== patch.status) {
      push(`Status of “${prev.title || "Untitled"}” → ${(ST[patch.status] && ST[patch.status][0]) || patch.status}`, id);
      logAct("Status Changed", "item", id, prev.title || "Untitled", patch.status);
    }
  };

  const saveSnapshot = (id, bodyStr) => {
    upd(id, (r) => ({
      ...r,
      body: bodyStr,
      upd: TODAY,
      verified: TODAY,
      v: [...(r.v || []), { n: (r.v || []).length + 1, by: userName, d: TODAY, note: "Snapshot", body: bodyStr }],
    }));
    push(`Saved snapshot of “${titleOf(id) || "Untitled"}”`, id);
    logAct("Updated", "item", id, titleOf(id) || "Untitled", "Snapshot");
  };

  const delItem = (id) => {
    const t = titleOf(id);
    db.invalidateArticle(id);
    edgeClient.clearAiCache();
    const nextList = resRef.current
      .filter((x) => x.id !== id)
      .map((x) => ({ ...x, links: (x.links || []).filter((l) => l[0] !== id) }));
    resRef.current = nextList;
    setRes(nextList);
    if (sessionEmail && !isGuest) {
      db.workspace.deleteItem(id, sessionEmail).catch(() => {});
    }
    setFavs((a) => a.filter((x) => x !== id));
    setPinned((a) => a.filter((x) => x !== id));
    setRead(null);
    flash("Item deleted");
    logAct("Deleted", "item", id, t);
  };

  const goHome = (focusAi) => {
    setRead(null);
    setActiveKitId(null);
    setCatFilter("all");
    setView("kb");
    setNav(false);
    window.scrollTo({ top: 0 });
    if (focusAi) setHf((n) => n + 1);
  };

  const recRead = (id, pct) =>
    setHist((h) => {
      const o = h.find((x) => x.id === id);
      const nextPct = Math.max(o ? o.pct : 0, pct);
      if (h[0] && h[0].id === id && h[0].pct >= nextPct) return h;
      return [{ id, pct: nextPct, at: Date.now() }, ...h.filter((x) => x.id !== id)].slice(0, 12);
    });

  const ack = (id) => {
    setAcks((prevAcks) => {
      const nextAcks = { ...(prevAcks || {}), [id]: TODAY };
      if (brainOwnerEmail && !isGuest) {
        setTeamAcks((prevTeam) => ({
          ...(prevTeam || {}),
          [brainOwnerEmail]: {
            ...((prevTeam && prevTeam[brainOwnerEmail]) || {}),
            ...nextAcks,
          },
        }));
      }
      return nextAcks;
    });
    flash("Required reading confirmed");
    logAct("Confirmed Reading", "item", id, titleOf(id));
  };

  const togReq = (id) => setReq((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const togChk = (id, k) => setChk((c) => { const a = c[id] || []; return { ...c, [id]: a.includes(k) ? a.filter((x) => x !== k) : [...a, k] }; });

  const theme = () => {
    const d = document.documentElement;
    const t = d.dataset.theme || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
    d.dataset.theme = t === "dark" ? "light" : "dark";
  };

  const go = (id) => {
    setRead(null);
    if (view === "space" && kbDisplay !== "space") setKbDisplay("space");
    setCur(id);
    setCatFilter("all");
    setActiveKitId(null);
    setView("lib");
    setSpaceStageOpen(true);
    setNav(false);
    setQ("");
    window.scrollTo({ top: 0 });
  };

  const goV = (v) => {
    setRead(null);
    if (v === "admin") setAdminTabSeed("gov");
    setView(v);
    setNav(false);
    if ((v === "team" || v === "admin") && !isGuest) {
      refreshDirectory();
    }
    window.scrollTo({ top: 0 });
  };

  const switchKbDisplay = (nextMode) => {
    if (catFilter === "kits" && !activeKitId) setCatFilter("all");
    setKbDisplay(nextMode);
    setSpaceStageOpen(true);
    if (view === "space" && nextMode !== "space") {
      setView("kb");
    }
  };

  const selectSpatialMode = (mode) => {
    setRead(null);
    setNav(false);
    if (view === "naming" || view === "team" || view === "admin" || view === "type") {
      setView("kb");
    }
    if (mode === "kits") {
      setActiveKitId(null);
      setCatFilter("kits");
      setSpaceStageOpen(true);
      return;
    }
    if (catFilter === "kits" && !activeKitId) {
      setCatFilter("all");
    }
    setKbDisplay(mode === "grid" || mode === "graph" || mode === "tasks" ? mode : "space");
    setSpaceStageOpen(true);
  };

  const returnCleanChatHero = () => {
    setNav(false);
    setBell(false);
    setPal(false);
    setRead(null);
    setActiveKitId(null);
    setCatFilter("all");
    setCur("all");
    setF({});
    setQ("");
    setKbDisplay("space");
    setView("kb");
    setSpaceStageOpen(false);
    setHeroResetSig((n) => n + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const handleSetCatFilter = (nextCat) => {
    setCatFilter(nextCat);
    if (nextCat !== "all") setSpaceStageOpen(true);
    if (view === "space" && nextCat === "kits") {
      setView("kb");
    }
  };

  const setSpaceF = (nextF) => {
    setF(nextF);
    if (nextF && Object.values(nextF).some(Boolean)) {
      setSpaceStageOpen(true);
    }
  };

  const pa = (k, a, b) => {
    setPal(false);
    if (k === "read") {
      if (
        String(a).startsWith("task:") ||
        String(a).startsWith("note:") ||
        String(a).startsWith("res:")
      ) {
        openBrainSource({ id: String(a) });
      } else {
        rd(a, b ? { sectionId: b } : undefined);
      }
    }
    else if (k === "new") createNewDoc();
    else if (k === "quick-task") setQcModal({ mode: "task", doc: null });
    else if (k === "quick-note") setQcModal({ mode: "note", doc: null });
    else if (k === "quick-resource") setQcModal({ mode: "resource", doc: null });
    else if (k === "focus") {
      setBrainTabSeed("focus");
      setBrainLayer("mine");
      setKbDisplay("tasks");
      setSpaceStageOpen(true);
      goV("kb");
    }
    else if (k === "team-resources") handleNavSwitch("team-resources");
    else if (k === "open-brain-task") openBrainSource({ id: "task:" + a });
    else if (k === "open-brain-note") openBrainSource({ id: "note:" + a });
    else if (k === "open-brain-resource") openBrainSource({ id: "res:" + a });
    else if (k === "tasks") {
      setBrainTabSeed(a || "all");
      setBrainLayer("mine");
      setKbDisplay("tasks");
      setSpaceStageOpen(true);
      goV("kb");
    }
    else if (k === "home") goHome();
    else if (k === "kits") {
      selectSpatialMode("kits");
    } else if (k === "kb-space") {
      setActiveKitId(null);
      if (catFilter === "kits") setCatFilter("all");
      setBrainLayer("all");
      setKbDisplay("space");
      setSpaceStageOpen(true);
      goV("kb");
    } else if (k === "grid") {
      selectSpatialMode("grid");
    } else if (k === "kb-graph") {
      selectSpatialMode("graph");
    } else if (k === "view") goV(a);
    else if (k === "go") go(a);
    else if (k === "theme") theme();
    else if (k === "ask") {
      setKbDisplay("space");
      setSpaceStageOpen(true);
      goHome(true);
      setAq({ q: a, n: Date.now() });
    } else if (k === "all") {
      setQ(a);
      setRead(null);
      setCatFilter("all");
      setActiveKitId(null);
      setKbDisplay("grid");
      setSpaceStageOpen(true);
      setView("lib");
      setCur("all");
    }
  };

  const logSearch = (query, count) => {
    const cleaned = (query || "").trim();
    if (!cleaned) return;
    setSearchLogs((prev) => [{ query: cleaned, resultCount: count, at: TODAY, ts: new Date().toISOString() }, ...prev.filter((x) => x.query !== cleaned)].slice(0, 20));
  };

  const dismissSearchGap = (queryStr) => {
    const clean = String(queryStr || "").trim();
    if (!clean) return;
    setSearchLogs((prev) => prev.filter((x) => x.query !== clean));
    flash("Search gap dismissed");
  };

  const flatCats = useMemo(() => buildFlat(tree), [tree]);

  // Strict permission-aware catalog filtering
  const visibleRes = useMemo(
    () => res.filter((r) => can.view(r, role, userName, byId(r.node, tree), shares, userTeams)),
    [res, role, userName, tree, shares, userTeams]
  );

  const visibleCols = useMemo(
    () =>
      cols.filter((c) => {
        const r = normRole(role);
        if (r === "SuperAdmin" || r === "Admin") return true;
        if (r === "Guest") return c.vis === "Public";
        if (c.tier === "personal") return c.owner === userName;
        if (c.vis === "Restricted") return c.owner === userName || (c.coEditors || []).includes(userName);
        return true;
      }),
    [cols, role, userName]
  );

  const visibleTree = useMemo(() => {
    const filterNodes = (nodes) =>
      nodes
        .map((n) => {
          const full = flatCats.find((c) => c.id === n.id);
          if (!can.viewCat(full, role, userName, userTeams)) return null;
          return { ...n, kids: n.kids ? filterNodes(n.kids) : [] };
        })
        .filter(Boolean);
    return filterNodes(tree);
  }, [tree, flatCats, role, userName, userTeams]);

  const allowedCatIds = useMemo(
    () => flatCats.filter((c) => can.viewCat(c, role, userName, userTeams)).map((c) => c.id),
    [flatCats, role, userName, userTeams]
  );

  const chatOwnerKey = sessionEmail || activeUser.id || "";
  const [chats, setChats] = useState(() => loadChats(chatOwnerKey));
  const [activeChatId, setActiveChatId] = useState(() => loadActiveChatId(chatOwnerKey));
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;

  useEffect(() => {
    saveChats(chats, chatOwnerKey);
  }, [chats, chatOwnerKey]);

  useEffect(() => {
    saveActiveChatId(activeChatId, chatOwnerKey);
  }, [activeChatId, chatOwnerKey]);

  // Reload user-scoped chats cleanly when switching account/session
  const loadedChatKeyRef = useRef(chatOwnerKey);
  useEffect(() => {
    if (loadedChatKeyRef.current === chatOwnerKey) return;
    loadedChatKeyRef.current = chatOwnerKey;
    setChats(loadChats(chatOwnerKey));
    setActiveChatId(loadActiveChatId(chatOwnerKey));
  }, [chatOwnerKey]);

  const localIsoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const makeUuid = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "00000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0").slice(-12);

  const brainOwnerEmail = db.brain.normalizeEmail(activeUser?.email || (activeUser?.id ? `${activeUser.id}@datum.local` : ""));
  const [tasks, setTasks] = useState(() => db.brain.loadLocal(brainOwnerEmail).tasks);
  const [privNotes, setPrivNotes] = useState(() => db.brain.loadLocal(brainOwnerEmail).notes);
  const [privResources, setPrivResources] = useState(() => db.brain.loadLocal(brainOwnerEmail).resources || []);
  const [plannerPrefs, setPlannerPrefs] = useState(() =>
    normalizePlannerPrefs(db.brain.loadLocal(brainOwnerEmail).state?.plannerPrefs, db.brain.loadLocal(brainOwnerEmail).tasks)
  );
  const [brainSyncState, setBrainSyncState] = useState("synced");
  const [brainTabSeed, setBrainTabSeed] = useState("all");
  const [brainHighlightId, setBrainHighlightId] = useState(null);
  const [qcModal, setQcModal] = useState(null);
  const [manageSheetMode, setManageSheetMode] = useState(null); // 'statuses' | 'lists' | null
  const brainHydratedEmailRef = useRef("");
  const brainStateSyncTimerRef = useRef(null);

  useEffect(() => {
    if (!brainOwnerEmail || isGuest) {
      setTasks([]);
      setPrivNotes([]);
      setPrivResources([]);
      setPlannerPrefs(normalizePlannerPrefs(null, []));
      brainHydratedEmailRef.current = "";
      return;
    }
    let alive = true;
    brainHydratedEmailRef.current = "";
    const local = db.brain.loadLocal(brainOwnerEmail);
    const localTasks = Array.isArray(local.tasks) ? local.tasks : [];
    setTasks(localTasks);
    setPrivNotes(Array.isArray(local.notes) ? local.notes : []);
    setPrivResources(Array.isArray(local.resources) ? local.resources : []);
    setPlannerPrefs(normalizePlannerPrefs(local.state?.plannerPrefs, localTasks));
    setBrainHighlightId(null);

    db.brain
      .fetchSnapshot(brainOwnerEmail)
      .then((snap) => {
        if (!alive || !snap) return;
        const remoteTasks = Array.isArray(snap.tasks) ? snap.tasks : localTasks;
        if (Array.isArray(snap.tasks)) setTasks(snap.tasks);
        if (Array.isArray(snap.notes)) setPrivNotes(snap.notes);
        if (Array.isArray(snap.resources)) setPrivResources(snap.resources);
        if (snap.state && snap.state.exists) {
          if (Array.isArray(snap.state.favs)) setFavs(snap.state.favs);
          if (Array.isArray(snap.state.pinned)) setPinned(snap.state.pinned);
          if (snap.state.acks && typeof snap.state.acks === "object") setAcks(snap.state.acks);
          if (snap.state.chk && typeof snap.state.chk === "object") setChk(snap.state.chk);
          if (Array.isArray(snap.state.history) && snap.state.history.length > 0) setHist(snap.state.history);
          setPlannerPrefs(normalizePlannerPrefs(snap.state.plannerPrefs, remoteTasks));
          if (Array.isArray(snap.state.chats) && snap.state.chats.length > 0) {
            setChats(snap.state.chats);
            saveChats(snap.state.chats, chatOwnerKey);
            if (snap.state.activeChatId) {
              setActiveChatId(snap.state.activeChatId);
              saveActiveChatId(snap.state.activeChatId, chatOwnerKey);
            }
          }
        } else {
          setPlannerPrefs(normalizePlannerPrefs(null, remoteTasks));
        }
        brainHydratedEmailRef.current = brainOwnerEmail;
        setBrainSyncState("synced");
      })
      .catch(() => {
        if (!alive) return;
        brainHydratedEmailRef.current = brainOwnerEmail;
        setBrainSyncState("error");
      });

    return () => {
      alive = false;
    };
  }, [brainOwnerEmail, isGuest]);

  useEffect(() => {
    if (!brainOwnerEmail || isGuest || brainHydratedEmailRef.current !== brainOwnerEmail) return;
    const payload = { favs, pinned, acks, chk, chats, activeChatId, plannerPrefs, history: hist };
    db.brain.saveLocalState(brainOwnerEmail, payload);
    clearTimeout(brainStateSyncTimerRef.current);
    brainStateSyncTimerRef.current = setTimeout(() => {
      db.brain.syncState(brainOwnerEmail, payload).catch(() => {});
    }, 700);
    return () => clearTimeout(brainStateSyncTimerRef.current);
  }, [favs, pinned, acks, chk, chats, activeChatId, plannerPrefs, hist, brainOwnerEmail, isGuest]);

  const rememberCategoryAndProject = (projectVal, categoryVal) => {
    const cleanP = String(projectVal || "").trim();
    const cleanC = String(categoryVal || "").trim();
    if (!cleanP && !cleanC) return;
    setPlannerPrefs((prev) => {
      const hasP = !cleanP || prev.projects.includes(cleanP);
      const hasC = !cleanC || prev.categories.includes(cleanC);
      if (hasP && hasC) return prev;
      return {
        ...prev,
        projects: cleanP && !hasP ? [...prev.projects, cleanP] : prev.projects,
        categories: cleanC && !hasC ? [...prev.categories, cleanC] : prev.categories,
      };
    });
  };

  const saveTask = async (taskInput) => {
    if (!brainOwnerEmail || isGuest) return null;
    const id = taskInput.id || makeUuid();
    const nowIso = new Date().toISOString();
    const nextStatus = taskInput.status || getFirstActiveStatus(plannerPrefs.statuses).id;
    const nextDone = isDoneStatus(plannerPrefs.statuses, nextStatus);
    const pri = Number.isFinite(Number(taskInput.priority)) ? Math.max(0, Math.min(3, Math.trunc(Number(taskInput.priority)))) : (taskInput.isUrgent ? 3 : 0);
    const isUrgent = Boolean(taskInput.isUrgent || pri >= 3);
    const optimistic = {
      id,
      ownerEmail: brainOwnerEmail,
      title: String(taskInput.title || "").trim(),
      notes: taskInput.notes || "",
      project: taskInput.project || "General",
      category: String(taskInput.category || "").trim(),
      priority: isUrgent && pri === 0 ? 3 : pri,
      dueDate: taskInput.dueDate || "",
      isUrgent,
      status: nextStatus,
      parentTaskId: taskInput.parentTaskId || null,
      revNumber: Number(taskInput.revNumber || 0),
      requestedAt: taskInput.requestedAt || "",
      links: Array.isArray(taskInput.links) ? taskInput.links : [],
      linkedItemId: taskInput.linkedItemId ?? null,
      linkedItemTitle: taskInput.linkedItemTitle || "",
      sortOrder: Number(taskInput.sortOrder || 0),
      completedAt: nextDone ? taskInput.completedAt || nowIso : null,
      createdAt: taskInput.createdAt || nowIso,
      updatedAt: nowIso,
    };
    if (!optimistic.title) return null;
    rememberCategoryAndProject(optimistic.project, optimistic.category);
    edgeClient.clearAiCache();
    setTasks((prev) => {
      const exists = prev.some((x) => x.id === id);
      const next = exists ? prev.map((x) => (x.id === id ? optimistic : x)) : [optimistic, ...prev];
      db.brain.saveLocalTasks(brainOwnerEmail, next);
      return next;
    });
    setBrainSyncState("saving");
    try {
      const resSync = await db.brain.upsertTask(brainOwnerEmail, optimistic);
      if (resSync && resSync.task) {
        setTasks((prev) => {
          const next = prev.map((x) => (x.id === id ? resSync.task : x));
          db.brain.saveLocalTasks(brainOwnerEmail, next);
          return next;
        });
      }
      setBrainSyncState("synced");
      return (resSync && resSync.task) || optimistic;
    } catch (e) {
      setBrainSyncState("error");
      return optimistic;
    }
  };

  const deleteTask = async (id) => {
    if (!brainOwnerEmail || isGuest || !id) return;
    edgeClient.clearAiCache();
    setTasks((prev) => {
      const next = prev.filter((x) => x.id !== id && x.parentTaskId !== id);
      db.brain.saveLocalTasks(brainOwnerEmail, next);
      return next;
    });
    setBrainSyncState("saving");
    try {
      await db.brain.deleteTask(brainOwnerEmail, id);
      setBrainSyncState("synced");
    } catch (e) {
      setBrainSyncState("error");
    }
  };

  const savePlannerStatuses = async (nextStatuses) => {
    const firstActiveId = getFirstActiveStatus(nextStatuses).id;
    const validIds = new Set(nextStatuses.map((s) => s.id));
    setPlannerPrefs((prev) => ({ ...prev, statuses: nextStatuses }));
    const affected = tasks.filter((t) => !validIds.has(t.status));
    if (affected.length) {
      for (const t of affected) {
        await saveTask({ ...t, status: firstActiveId });
      }
    }
    flash("Custom statuses updated");
  };

  const savePlannerLists = async ({ projects: nextProjects, categories: nextCategories, projRenameMap, catRenameMap, keptOldProjects }) => {
    setPlannerPrefs((prev) => ({
      ...prev,
      projects: nextProjects,
      categories: nextCategories,
    }));
    const keptSet = new Set(keptOldProjects || []);
    const toDelete = [];
    const toUpdate = [];
    tasks.forEach((t) => {
      const oldP = t.project || "General";
      if (keptSet.size && oldP && !keptSet.has(oldP) && !nextProjects.includes(oldP)) {
        toDelete.push(t.id);
        return;
      }
      let nextP = oldP;
      let nextC = t.category || "";
      let changed = false;
      if (projRenameMap && projRenameMap[oldP]) {
        nextP = projRenameMap[oldP];
        changed = true;
      }
      if (nextC && catRenameMap && Object.prototype.hasOwnProperty.call(catRenameMap, nextC)) {
        nextC = catRenameMap[nextC];
        changed = true;
      } else if (nextC && !nextCategories.includes(nextC)) {
        nextC = "";
        changed = true;
      }
      if (changed) {
        toUpdate.push({ ...t, project: nextP, category: nextC });
      }
    });
    for (const delId of toDelete) await deleteTask(delId);
    for (const updTask of toUpdate) await saveTask(updTask);
    flash("Projects & categories saved");
  };

  const savePrivNote = async (noteInput) => {
    if (!brainOwnerEmail || isGuest) return null;
    const id = noteInput.id || makeUuid();
    const nowIso = new Date().toISOString();
    const optimistic = {
      id,
      ownerEmail: brainOwnerEmail,
      title: String(noteInput.title || "").trim() || "Quick Note",
      body: String(noteInput.body || ""),
      project: String(noteInput.project || "General").trim() || "General",
      tags: Array.isArray(noteInput.tags) ? noteInput.tags : [],
      isPinned: Boolean(noteInput.isPinned),
      linkedItemIds: Array.isArray(noteInput.linkedItemIds) ? noteInput.linkedItemIds : [],
      createdAt: noteInput.createdAt || nowIso,
      updatedAt: nowIso,
    };
    edgeClient.clearAiCache();
    setPrivNotes((prev) => {
      const exists = prev.some((x) => x.id === id);
      const next = exists ? prev.map((x) => (x.id === id ? optimistic : x)) : [optimistic, ...prev];
      db.brain.saveLocalNotes(brainOwnerEmail, next);
      return next;
    });
    setBrainSyncState("saving");
    try {
      const resSync = await db.brain.upsertNote(brainOwnerEmail, optimistic);
      if (resSync && resSync.note) {
        setPrivNotes((prev) => {
          const next = prev.map((x) => (x.id === id ? resSync.note : x));
          db.brain.saveLocalNotes(brainOwnerEmail, next);
          return next;
        });
      }
      setBrainSyncState("synced");
      return (resSync && resSync.note) || optimistic;
    } catch (e) {
      setBrainSyncState("error");
      return optimistic;
    }
  };

  const deletePrivNote = async (id) => {
    if (!brainOwnerEmail || isGuest || !id) return;
    edgeClient.clearAiCache();
    setPrivNotes((prev) => {
      const next = prev.filter((x) => x.id !== id);
      db.brain.saveLocalNotes(brainOwnerEmail, next);
      return next;
    });
    setBrainSyncState("saving");
    try {
      await db.brain.deleteNote(brainOwnerEmail, id);
      setBrainSyncState("synced");
    } catch (e) {
      setBrainSyncState("error");
    }
  };

  const savePrivResource = async (resInput) => {
    if (!brainOwnerEmail || isGuest) return null;
    const id = resInput.id || makeUuid();
    const nowIso = new Date().toISOString();
    const optimistic = {
      id,
      ownerEmail: resInput.ownerEmail || brainOwnerEmail,
      title: String(resInput.title || "").trim() || String(resInput.url || "").trim() || "Saved Resource",
      url: String(resInput.url || "").trim(),
      kind: ["link", "tool", "snippet", "template"].includes(resInput.kind) ? resInput.kind : "link",
      snippet: String(resInput.snippet || ""),
      notes: String(resInput.notes || ""),
      project: String(resInput.project || "General").trim() || "General",
      tags: Array.isArray(resInput.tags) ? resInput.tags : [],
      sharedWithEmails: Array.isArray(resInput.sharedWithEmails) ? resInput.sharedWithEmails : [],
      isPinned: Boolean(resInput.isPinned),
      linkedItemId: resInput.linkedItemId ?? null,
      linkedItemTitle: resInput.linkedItemTitle || "",
      linkedSection: resInput.linkedSection || "",
      createdAt: resInput.createdAt || nowIso,
      updatedAt: nowIso,
    };
    rememberCategoryAndProject(optimistic.project, "");
    edgeClient.clearAiCache();
    setPrivResources((prev) => {
      const exists = prev.some((x) => x.id === id);
      const next = exists ? prev.map((x) => (x.id === id ? optimistic : x)) : [optimistic, ...prev];
      db.brain.saveLocalResources(brainOwnerEmail, next);
      return next;
    });
    setBrainSyncState("saving");
    try {
      const resSync = await db.brain.upsertResource(brainOwnerEmail, optimistic);
      if (resSync && resSync.resource) {
        setPrivResources((prev) => {
          const next = prev.map((x) => (x.id === id ? resSync.resource : x));
          db.brain.saveLocalResources(brainOwnerEmail, next);
          return next;
        });
      }
      setBrainSyncState("synced");
      return (resSync && resSync.resource) || optimistic;
    } catch (e) {
      setBrainSyncState("error");
      return optimistic;
    }
  };

  const deletePrivResource = async (id) => {
    if (!brainOwnerEmail || isGuest || !id) return;
    edgeClient.clearAiCache();
    setPrivResources((prev) => {
      const next = prev.filter((x) => x.id !== id);
      db.brain.saveLocalResources(brainOwnerEmail, next);
      return next;
    });
    setBrainSyncState("saving");
    try {
      await db.brain.deleteResource(brainOwnerEmail, id);
      setBrainSyncState("synced");
    } catch (e) {
      setBrainSyncState("error");
    }
  };

  const shareResourceWithTeammates = async (resObj, nextEmails) => {
    if (!resObj || !resObj.id) return;
    await savePrivResource({ ...resObj, sharedWithEmails: nextEmails });
    flash(nextEmails.length ? `Shared with ${nextEmails.length} teammate(s)` : "Sharing removed");
  };

  const suggestItemToGovernance = async ({ title, desc, url, body, project, kindTag, label }) => {
    if (!sessionEmail || isGuest) return;
    const id = Date.now();
    const defaultNode = "c10-ovw-std";
    const catObj = byId(defaultNode, tree);
    const suggestedItem = {
      id,
      node: defaultNode,
      title: String(title || "Suggested Knowledge Item").trim(),
      desc: String(desc || "Submitted from Personal Second Brain for Governance review").trim().slice(0, 180),
      url: String(url || "").trim(),
      body: String(body || "").trim(),
      type: url ? "link" : "doc",
      status: "Review",
      vis: "Internal",
      stage: STG[0],
      disc: (catObj && catObj.path && RD[catObj.path[0]]) || "VDC",
      tags: [...new Set([project || "General", kindTag].filter(Boolean))],
      links: [],
      c: [],
      publicAttachments: [],
      author: userName,
      authorEmail: sessionEmail,
      upd: TODAY,
      verified: TODAY,
      v: [{ n: 1, by: userName, d: TODAY, note: `Suggested from Personal ${label}`, body: String(body || "") }],
    };
    const nextList = [suggestedItem, ...resRef.current];
    resRef.current = nextList;
    setRes(nextList);
    try {
      await db.workspace.upsertItem(suggestedItem, "suggest", sessionEmail);
      logAct(`Suggested Team ${label}`, "item", id, suggestedItem.title, "Pending Governance Review");
      flash(`Submitted “${suggestedItem.title}” to Administration → Governance`);
    } catch (e) {
      flash(e.message || "Suggestion saved locally — check connection");
    }
  };

  const suggestResourceToTeamKb = (resObj) =>
    suggestItemToGovernance({
      title: resObj.title,
      desc: resObj.notes || resObj.url || `Personal ${resObj.kind || "resource"}`,
      url: resObj.url,
      body: [
        resObj.notes || "",
        resObj.snippet ? `\n\`\`\`\n${resObj.snippet}\n\`\`\`` : "",
        resObj.url ? `\nReference URL: ${resObj.url}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      project: resObj.project,
      kindTag: resObj.kind || "resource",
      label: "Resource",
    });

  const suggestNoteToTeamKb = (noteObj) =>
    suggestItemToGovernance({
      title: noteObj.title || "Suggested Standard Note",
      desc: (noteObj.body || "").replace(/[#*`>\[\]]/g, "").slice(0, 160),
      url: "",
      body: noteObj.body || "",
      project: noteObj.project,
      kindTag: "note",
      label: "Note",
    });

  const saveAiMessageToNote = (msg) => {
    if (isGuest || !msg) return;
    const rawSrcs = Array.isArray(msg.src) ? msg.src : [];
    const docSrcs = rawSrcs.filter(
      (s) =>
        s &&
        s.id &&
        !String(s.id).startsWith("task:") &&
        !String(s.id).startsWith("note:") &&
        !String(s.id).startsWith("res:")
    );
    const linkedItemIds = docSrcs.map((s) => Number(s.id)).filter(Number.isFinite);
    const citationsBlock = docSrcs.length
      ? `\n\nSources:\n${docSrcs.map((s) => `- [[${s.title}|${s.id}]]${s.sectionTitle ? ` · § ${s.sectionTitle}` : ""}`).join("\n")}`
      : "";
    setQcModal({
      mode: "note",
      doc: linkedItemIds[0] ? res.find((x) => Number(x.id) === linkedItemIds[0]) || null : null,
      note: {
        title: msg.query ? `AI: ${String(msg.query).slice(0, 64)}` : msg.scopeDocTitle ? `AI: ${msg.scopeDocTitle}` : "AI Research Note",
        body: `${String(msg.text || "").trim()}${citationsBlock}`,
        project: "General",
        isPinned: false,
        linkedItemIds,
      },
    });
  };

  const saveAiMessageToTask = (msg) => {
    if (isGuest || !msg) return;
    const rawSrcs = Array.isArray(msg.src) ? msg.src : [];
    const firstDoc = rawSrcs.find(
      (s) =>
        s &&
        s.id &&
        !String(s.id).startsWith("task:") &&
        !String(s.id).startsWith("note:") &&
        !String(s.id).startsWith("res:")
    );
    setQcModal({
      mode: "task",
      doc: firstDoc ? res.find((x) => Number(x.id) === Number(firstDoc.id)) || null : null,
      task: {
        title: msg.query ? `Follow up: ${String(msg.query).slice(0, 72)}` : "Follow up AI answer",
        notes: String(msg.text || "").trim().slice(0, 600),
        project: "General",
        dueDate: localIsoToday(),
        linkedItemId: firstDoc ? Number(firstDoc.id) : null,
        linkedItemTitle: firstDoc ? firstDoc.title : "",
      },
    });
  };

  const handleQuickCommand = (rawText) => {
    if (isGuest) return false;
    const t = String(rawText || "").trim();
    const todoM = t.match(/^\/(?:todo|task|таск|задача)\s+(.+)$/i);
    if (todoM) {
      let title = todoM[1].trim();
      let isUrgent = false;
      let project = "General";
      if (/\s!(?:urgent|терміново)\b/i.test(title)) {
        isUrgent = true;
        title = title.replace(/\s!(?:urgent|терміново)\b/gi, "").trim();
      }
      const pM = title.match(/\s#([A-Za-z0-9_&-]+)$/);
      if (pM) {
        project = pM[1];
        title = title.slice(0, pM.index).trim();
      }
      if (!title) return false;
      saveTask({
        title,
        project,
        dueDate: localIsoToday(),
        isUrgent,
        status: "todo",
      });
      flash(`Task saved to Supabase · ${project}${isUrgent ? " · Urgent" : ""}`);
      return true;
    }
    const noteM = t.match(/^\/(?:note|нотатка)\s+(.+)$/i);
    if (noteM) {
      const body = noteM[1].trim();
      const firstLine = body.split("\n")[0].slice(0, 64);
      savePrivNote({
        title: firstLine || "Quick Note",
        body,
        project: "General",
      });
      flash("Private note saved to Supabase");
      return true;
    }
    const resM = t.match(/^\/(?:res|link|ресурс)\s+(.+)$/i);
    if (resM) {
      const raw = resM[1].trim();
      const urlMatch = raw.match(/(https?:\/\/\S+)/i);
      const url = urlMatch ? urlMatch[1] : "";
      const title = url ? raw.replace(url, "").trim() || url : raw;
      savePrivResource({
        title,
        url,
        kind: url ? "link" : "snippet",
        notes: url ? "" : raw,
        project: spaceProject !== "all" ? spaceProject : "General",
      });
      flash("Personal resource saved to Supabase");
      return true;
    }
    return false;
  };

  const openBrainSource = (s) => {
    if (!s || !s.id) return;
    const raw = String(s.id);
    if (raw.startsWith("task:") || raw.startsWith("note:") || raw.startsWith("res:")) {
      setRead(null);
      setActiveKitId(null);
      setCatFilter("all");
      setBrainLayer("mine");
      setKbDisplay("tasks");
      setSpaceStageOpen(true);
      if (raw.startsWith("task:")) {
        setBrainHighlightId(raw.slice(5));
        setBrainTabSeed("all");
      } else if (raw.startsWith("note:")) {
        setBrainHighlightId(raw.slice(5));
        setBrainTabSeed("notes");
      } else {
        setBrainHighlightId(raw.slice(4));
        setBrainTabSeed("resources");
      }
      goV("kb");
      return true;
    }
    return false;
  };

  const brainProjects = useMemo(() => {
    const s = new Set([...(plannerPrefs.projects || [])]);
    tasks.forEach((t) => t.project && s.add(t.project));
    privNotes.forEach((n) => n.project && s.add(n.project));
    privResources.forEach((r) => r.project && s.add(r.project));
    return [...s].sort();
  }, [plannerPrefs.projects, tasks, privNotes, privResources]);

  const brainCategories = useMemo(() => {
    const s = new Set([...(plannerPrefs.categories || [])]);
    tasks.forEach((t) => t.category && s.add(t.category));
    return [...s].sort();
  }, [plannerPrefs.categories, tasks]);

  const todayIso = localIsoToday();
  const todayPendingTasksCount = useMemo(
    () => tasks.filter((t) => !isDoneStatus(plannerPrefs.statuses, t.status) && t.dueDate && t.dueDate <= todayIso).length,
    [tasks, plannerPrefs.statuses, todayIso]
  );
  const openTasksCount = useMemo(
    () => tasks.filter((t) => !isDoneStatus(plannerPrefs.statuses, t.status)).length,
    [tasks, plannerPrefs.statuses]
  );

  // Sync URL ?doc=#section when reading/closing a standard (keeps /open Revit links untouched)
  const didInitDocSyncRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!didInitDocSyncRef.current) {
      didInitDocSyncRef.current = true;
      return;
    }
    if (window.location.pathname === "/open" || revitLinkCtx) return;
    try {
      const sp = new URLSearchParams(window.location.search || "");
      sp.delete("read");
      if (read != null) sp.set("doc", String(read));
      else sp.delete("doc");
      const qs = sp.toString();
      const nextHash = read != null && readSection && String(readSection.docId) === String(read) && readSection.sectionId
        ? "#" + readSection.sectionId
        : "";
      const nextUrl = window.location.pathname + (qs ? "?" + qs : "") + nextHash;
      window.history.replaceState(null, "", nextUrl);
    } catch {}
  }, [read, readSection, revitLinkCtx]);

  const sendUnifiedChat = async ({ query: rawQuery, scopeDocId = null, scopeDocTitle = "", scope = "all", forceNew = false } = {}) => {
    const cleanQ = String(rawQuery || "").trim();
    if (!cleanQ) return null;

    const searchPool = scope === "doc" && scopeDocId != null
      ? visibleRes.filter((r) => String(r.id) === String(scopeDocId))
      : visibleRes;
    const tokens = tokenizeUnique(cleanQ);
    const matchIds = searchPool
      .map((r) => ({ id: r.id, ...scoreDocument(r, cleanQ, tokens) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.matched - a.matched || b.score - a.score)
      .slice(0, 8)
      .map((x) => x.id);

    const turn = createPendingChatTurn({
      chats: chatsRef.current,
      activeChatId: forceNew ? null : activeChatIdRef.current,
      query: cleanQ,
      matchIds,
      scopeDocId,
      scopeDocTitle,
    });

    chatsRef.current = turn.nextChats;
    activeChatIdRef.current = turn.targetChatId;
    setChats(turn.nextChats);
    setActiveChatId(turn.targetChatId);

    const directShareIds = shares.filter((s) => s.grantee === userName).map((s) => s.targetId);
    const out = await edgeClient.ai({
      action: "qa",
      query: cleanQ,
      userRole: role,
      userName,
      allowedCategories: allowedCatIds,
      directShareIds,
      items: visibleRes,
      personalTasks: isGuest
        ? []
        : tasks.map((t) => {
            const st = plannerPrefs.statuses.find((s) => s.id === t.status);
            return {
              ...t,
              statusLabel: (st && st.label) || t.status,
              isDone: Boolean(st && st.isDone),
            };
          }),
      personalNotes: isGuest ? [] : privNotes,
      personalResources: isGuest ? [] : privResources,
      clientDate: todayIso,
      targetDocId: scopeDocId,
      scope,
      history: turn.historyBeforeTurn,
      today: TODAY,
    });

    const hasHits = (out && Array.isArray(out.sources) && out.sources.length > 0) || matchIds.length > 0;
    logSearch(cleanQ, hasHits ? Math.max(matchIds.length, (out && out.sources && out.sources.length) || 0) : 0);

    setChats((prev) => resolvePendingChatTurn(prev, turn.targetChatId, turn.botMsgId, out));
    return { chatId: turn.targetChatId, result: out };
  };

  const startNewChat = () => {
    setActiveChatId(null);
  };

  const deleteChatThread = (chatId) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== chatId);
      if (activeChatIdRef.current === chatId) {
        setActiveChatId(next[0] ? next[0].id : null);
      }
      return next;
    });
  };

  const clearAllChats = () => {
    setChats([]);
    setActiveChatId(null);
  };

  const flagMissingStandard = (topic) => {
    const clean = String(topic || "").trim();
    if (!clean) return;
    logSearch(clean, 0);
    logAct("Requested Standard", "gap", clean.toLowerCase().slice(0, 48), clean, "Flagged from Datum AI");
    push(`Knowledge gap flagged: “${clean}”`, null);
  };

  const openNamingFromChat = (typeCode = "") => {
    if (typeCode) setNamingTypeSeed(typeCode);
    setRead(null);
    goV("naming");
  };

  const tags = useMemo(() => [...new Set(visibleRes.flatMap((r) => r.tags))].sort(), [visibleRes]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const isCategoryScope = view === "lib" && !["all", "fav", "drafts", "recent"].includes(cur);
    const catNode = isCategoryScope ? flatCats.find((c) => c.id === cur) : null;
    const ids = catNode ? sub(catNode) : null;

    return visibleRes.filter((r) => {
      if ((view === "kb" || view === "space" || isCategoryScope) && catFilter === "docs" && !isDocType(r.type)) return false;
      if ((view === "kb" || view === "space" || isCategoryScope) && catFilter === "res" && !isResType(r.type)) return false;
      if (view === "lib") {
        if (cur === "fav" && !favs.includes(r.id)) return false;
        if (cur === "drafts" && !(r.author === userName && r.status !== "Approved")) return false;
        if (cur === "recent" && !hist.some((h) => h.id === r.id)) return false;
        if (ids && !ids.includes(r.node)) return false;
      }
      if (f.status && r.status !== f.status) return false;
      if (f.type && r.type !== f.type) return false;
      if (f.stage && r.stage !== f.stage) return false;
      if (f.disc && r.disc !== f.disc) return false;
      if (f.tag && !r.tags.includes(f.tag)) return false;
      if (f.author && r.author !== f.author) return false;
      if (s && !hay(r).includes(s)) return false;
      return true;
    });
  }, [visibleRes, q, view, cur, catFilter, f, favs, hist, userName, flatCats]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [view, cur, catFilter, q, f, sort]);

  const recentSearches = useMemo(() => [...new Set(searchLogs.map((l) => l.query))].slice(0, 5), [searchLogs]);
  const pendingApprovalCount = res.filter((r) => {
    if (r.status !== "Review") return false;
    const cat = byId(r.node, tree);
    return can.status(role, cat, userName);
  }).length;
  const isGovCapable = can.admin(role);

  const readNotifSet = useMemo(
    () => new Set(Array.isArray(plannerPrefs.readNotifIds) ? plannerPrefs.readNotifIds : []),
    [plannerPrefs.readNotifIds]
  );

  const notifications = useMemo(() => {
    if (isGuest) return [];
    const list = [];
    const seenIds = new Set();
    const pushNotif = (entry) => {
      if (!entry || !entry.id || seenIds.has(entry.id)) return;
      seenIds.add(entry.id);
      list.push({ ...entry, un: !readNotifSet.has(entry.id) });
    };

    if (isGovCapable) {
      res
        .filter((r) => r.status === "Review")
        .slice(0, 6)
        .forEach((r) => {
          pushNotif({
            id: `rev-${r.id}-${r.upd || ""}`,
            text: `Approval needed: “${r.title || "Untitled"}” (${r.author || "Team"})`,
            t: relTime(r.upd) || "In review",
            run: () => rd(r.id),
          });
        });
    }

    (flaggedIds || []).slice(0, 6).forEach((fid) => {
      const doc = visibleRes.find((x) => Number(x.id) === Number(fid));
      if (!doc || (!isGovCapable && doc.author !== userName)) return;
      pushNotif({
        id: `flag-${doc.id}`,
        text: `Flagged outdated: “${doc.title || `#${doc.id}`}”`,
        t: relTime(doc.upd) || "Review",
        run: () => pick(doc.id),
      });
    });

    (privResources || [])
      .filter((r) => r && r.isSharedWithMe)
      .slice(0, 6)
      .forEach((r) => {
        pushNotif({
          id: `share-${r.id}-${r.updatedAt || ""}`,
          text: `${r.ownerEmail} shared resource “${r.title}”`,
          t: relTime(r.updatedAt || r.createdAt),
          run: () => openBrainSource({ id: "res:" + r.id }),
        });
      });

    (req || [])
      .filter((id) => !acks[id])
      .slice(0, 5)
      .forEach((id) => {
        const doc = visibleRes.find((x) => Number(x.id) === Number(id));
        if (!doc) return;
        pushNotif({
          id: `req-${doc.id}`,
          text: `Required reading: “${doc.title}”`,
          t: "Pending",
          run: () => rd(doc.id),
        });
      });

    (tasks || [])
      .filter((t) => !isDoneStatus(plannerPrefs.statuses, t.status) && t.dueDate && t.dueDate <= todayIso)
      .slice(0, 5)
      .forEach((t) => {
        pushNotif({
          id: `due-${t.id}-${t.dueDate}`,
          text: `Due ${t.dueDate === todayIso ? "today" : t.dueDate}: “${t.title}”`,
          t: t.dueDate === todayIso ? "Today" : t.dueDate,
          run: () => openBrainSource({ id: "task:" + t.id }),
        });
      });

    (activities || [])
      .filter(
        (a) =>
          a &&
          !["act-1", "act-2", "act-3", "act-4"].includes(String(a.id)) &&
          !(a.action === "Created" && (!a.targetTitle || a.targetTitle === "Untitled"))
      )
      .slice(0, 10)
      .forEach((a) => {
        const isDocTarget =
          (a.targetType === "item" || a.targetType === "document") &&
          Number.isFinite(Number(a.targetId)) &&
          Number(a.targetId) > 0;
        const noteSuffix = a.note ? ` · ${a.note}` : "";
        pushNotif({
          id: `act-${a.id}`,
          text: `${a.actor} ${String(a.action || "").toLowerCase()} “${a.targetTitle || "item"}”${noteSuffix}`,
          t: relTime(a.ts || a.at),
          run: () => {
            if (isDocTarget) rd(Number(a.targetId));
            else if (a.targetType === "category" && a.targetId) go(a.targetId);
            else if (isGovCapable) goV("admin");
          },
        });
      });

    return list.slice(0, 20);
  }, [
    isGuest,
    isGovCapable,
    res,
    visibleRes,
    flaggedIds,
    privResources,
    req,
    acks,
    tasks,
    plannerPrefs.statuses,
    todayIso,
    activities,
    readNotifSet,
    userName,
  ]);

  const unread = notifications.filter((n) => n.un).length;

  const markNotifRead = (nid) => {
    if (!nid) return;
    setPlannerPrefs((prev) => {
      const existing = Array.isArray(prev.readNotifIds) ? prev.readNotifIds : [];
      if (existing.includes(nid)) return prev;
      return { ...prev, readNotifIds: [nid, ...existing].slice(0, 200) };
    });
  };

  const markAllNotifsRead = () => {
    const allIds = notifications.map((n) => n.id);
    if (!allIds.length) return;
    setPlannerPrefs((prev) => ({
      ...prev,
      readNotifIds: [...new Set([...allIds, ...(prev.readNotifIds || [])])].slice(0, 200),
      notifsClearedAt: Date.now(),
    }));
  };

  useEffect(() => {
    if (view === "admin" && !isGovCapable) setView("kb");
    if (view === "lib" && cur === "drafts" && !can.createDraft(role)) setCur("all");
  }, [role, view, cur, isGovCapable]);

  const pick = (id) => {
    setSel(id);
    setBell(false);
  };

  const sr = visibleRes.find((r) => r.id === sel);
  const rr = visibleRes.find((r) => r.id === read);
  const cnt = (n) => {
    const s = sub(n);
    return visibleRes.filter((r) => s.includes(r.node)).length;
  };
  const treeCtx = {
    cur,
    view,
    open,
    go,
    cnt,
    tg: (id) => tgl(setOpen, id),
    canManageNode: (n) => can.admin(role) || (normRole(role) === "Editor" && n.owner === userName),
    onColorCat: (catId, color) => {
      const updCol = (nodes) =>
        nodes.map((x) => (x.id === catId ? { ...x, color } : x.kids ? { ...x, kids: updCol(x.kids) } : x));
      setTree((prev) => updCol(prev));
      const cNode = byId(catId, tree);
      flash(`Updated “${cNode ? cNode.name : catId}” color`);
    },
    onAddChildCat: (n) => setCatModal({ mode: "create", parentId: n.id }),
    onEditCat: (n) => setCatModal({ mode: "edit", cat: byId(n.id, tree) || n }),
    onToggleVisCat: (n) => {
      const nextVis = n.vis === "Restricted" ? "Internal" : "Restricted";
      const updVis = (nodes) =>
        nodes.map((x) => (x.id === n.id ? { ...x, vis: nextVis } : x.kids ? { ...x, kids: updVis(x.kids) } : x));
      setTree((prev) => updVis(prev));
      logAct("Category Visibility Changed", "category", n.id, n.name, nextVis);
      flash(`“${n.name}” visibility → ${nextVis}`);
    },
    onDeleteCat: (n) => setCatModal({ mode: "delete", cat: byId(n.id, tree) || n }),
  };

  const curCat = view === "lib" && !["all", "fav", "drafts", "recent"].includes(cur) ? byId(cur, tree) : null;
  const isSpaceView =
    view === "space" || view === "lib" || view === "kb" || view === "home" || view === "reslib";
  const activeViewMode =
    (view === "kb" || view === "space" || view === "lib" || view === "home" || view === "reslib") &&
    catFilter === "kits" &&
    !activeKitId
      ? "kits"
      : kbDisplay === "tasks" && !isGuest
      ? "tasks"
      : kbDisplay === "grid" || kbDisplay === "graph"
      ? kbDisplay
      : "space";
  const isSpaceDockActive = Boolean(isSpaceView && !rr);
  const pageTitle =
    activeViewMode === "tasks" && isSpaceView
      ? "My Work"
      : catFilter === "res" && (view === "kb" || view === "home" || view === "space" || view === "lib")
      ? "Team Resources"
      : view === "kb" || view === "home" || view === "space"
      ? "Knowledge Space"
      : view === "wall"
      ? "Detail Wall"
      : view === "3d"
      ? "3D Assemblies"
      : view === "type"
      ? (revitTypeCtx && revitTypeCtx.typeName) || "Revit Type"
      : view === "naming"
      ? "Naming Studio"
      : view === "tasks"
      ? "Second Brain"
      : view === "reslib"
      ? "Resource Library"
      : view === "boards"
      ? "Collections & Link Boards"
      : view === "graph"
      ? "Dependency Graph"
      : view === "team"
      ? "People & Teams"
      : view === "admin"
      ? "Administration & Governance"
      : view === "lib"
      ? cur === "all"
        ? "All Catalog Items"
        : cur === "fav"
        ? "Bookmarks"
        : cur === "drafts"
        ? "My Drafts"
        : cur === "recent"
        ? "Recently Viewed"
        : (curCat && curCat.name) || "Category"
      : "Dashboard";

  const hasF = Object.values(f).some(Boolean) || catFilter !== "all";
  const showFeat = (view === "kb" || view === "reslib" || (view === "lib" && cur === "all")) && !q.trim() && !hasF && !isGuest;
  const rec = [...visibleRes].filter((r) => r.status === "Approved").sort((a, b) => b.upd.localeCompare(a.upd)).slice(0, 3);
  const shown = [...list].sort(
    sort === "az"
      ? (a, b) => a.title.localeCompare(b.title, "en")
      : sort === "links"
      ? (a, b) => ((b.links && b.links.length) || 0) - ((a.links && a.links.length) || 0)
      : (a, b) => b.upd.localeCompare(a.upd)
  );

  const addCol = (c) => {
    const colObj = { ...c, ownerEmail: c.ownerEmail || sessionEmail || "" };
    setCols((prev) => [colObj, ...prev]);
    if (sessionEmail && !isGuest) db.workspace.upsertCollection(colObj, sessionEmail).catch(() => {});
  };
  const saveCol = (c) => {
    setCols((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    if (sessionEmail && !isGuest) db.workspace.upsertCollection(c, sessionEmail).catch(() => {});
  };
  const delCol = (id) => {
    setCols((prev) => prev.filter((x) => x.id !== id));
    if (sessionEmail && !isGuest) db.workspace.deleteCollection(id, sessionEmail).catch(() => {});
  };

  // Sync Directory Handlers (Live Supabase public.users + auth.users)
  const reassignLocalOwnership = (oldName, targetName) => {
    if (!oldName || !targetName || oldName === targetName) return;
    setRes((prev) => prev.map((r) => (r.author === oldName ? { ...r, author: targetName } : r)));
    const reassignCats = (nodes) =>
      nodes.map((n) => ({
        ...n,
        owner: n.owner === oldName ? targetName : n.owner,
        kids: n.kids ? reassignCats(n.kids) : [],
      }));
    setTree(reassignCats(tree));
    setCols((prev) => prev.map((c) => (c.owner === oldName && c.tier !== "personal" ? { ...c, owner: targetName } : c)));
    setShares((prev) => prev.filter((s) => s.grantee !== oldName));
  };

  const handleInviteUser = async (payload) => {
    setDirectorySyncState("saving");
    try {
      const data = await db.directory.invite(payload, sessionEmail);
      applyDirectoryPayload(data);
      setDirectorySyncState("synced");
      logAct("Invited Member", "user", data.userId || payload.email, payload.name, payload.email);
      flash(`Invited ${payload.name || payload.email} (saved to Supabase)`);
      return true;
    } catch (e) {
      setDirectorySyncState("error");
      flash(e.message || "Failed to invite user");
      return false;
    }
  };

  const handleUpdateUserRole = async (targetUser, nextRole) => {
    if (nextRole === "SuperAdmin" && !can.superAdmin(role)) {
      flash("Only Super Admin can assign Super Admin role");
      return;
    }
    setDirectorySyncState("saving");
    try {
      const data = await db.directory.updateUser({ id: targetUser.id, email: targetUser.email, role: nextRole }, sessionEmail);
      applyDirectoryPayload(data);
      setDirectorySyncState("synced");
      logAct("Updated User Role", "user", targetUser.id, targetUser.name, `Role → ${ROLES[nextRole]}`);
      flash(`Updated ${targetUser.name} role to ${ROLES[nextRole]}`);
    } catch (e) {
      setDirectorySyncState("error");
      flash(e.message || "Failed to update role");
    }
  };

  const handleDeactivateUser = async (uid, oldName, targetName, fallbackUserId = "") => {
    setDirectorySyncState("saving");
    try {
      const data = await db.directory.deactivateUser(uid, fallbackUserId, sessionEmail);
      applyDirectoryPayload(data);
      reassignLocalOwnership(oldName, targetName);
      setDirectorySyncState("synced");
      logAct("Deactivated User & Transferred Ownership", "user", uid, oldName, `Items reassigned → ${targetName}`);
      flash(`Deactivated ${oldName}; ownership transferred to ${targetName}`);
    } catch (e) {
      setDirectorySyncState("error");
      flash(e.message || "Failed to deactivate user");
    }
  };

  const handleReactivateUser = async (targetUser) => {
    setDirectorySyncState("saving");
    try {
      const data = await db.directory.reactivateUser(targetUser.id, sessionEmail);
      applyDirectoryPayload(data);
      setDirectorySyncState("synced");
      logAct("Reactivated User", "user", targetUser.id, targetUser.name, targetUser.email);
      flash(`Reactivated ${targetUser.name}`);
    } catch (e) {
      setDirectorySyncState("error");
      flash(e.message || "Failed to reactivate user");
    }
  };

  const handleDeleteUser = async (targetUser, fallbackUserId = "", fallbackName = userName) => {
    setDirectorySyncState("saving");
    try {
      const data = await db.directory.deleteUser(targetUser.id, fallbackUserId, sessionEmail, targetUser.email);
      applyDirectoryPayload(data);
      reassignLocalOwnership(targetUser.name, fallbackName);
      setDirectorySyncState("synced");
      logAct("Deleted User", "user", targetUser.id, targetUser.name, `Ownership reassigned → ${fallbackName}`);
      flash(`Deleted ${targetUser.name} from database`);
    } catch (e) {
      setDirectorySyncState("error");
      flash(e.message || "Failed to delete user");
    }
  };

  const handleCreateTeamDb = async (teamPayload) => {
    setDirectorySyncState("saving");
    try {
      const data = await db.directory.createTeam(teamPayload, sessionEmail);
      applyDirectoryPayload(data);
      setDirectorySyncState("synced");
      flash(`Created team “${teamPayload.name}”`);
      return true;
    } catch (e) {
      setDirectorySyncState("error");
      flash(e.message || "Failed to create team");
      return false;
    }
  };

  const handleToggleTeamMemberDb = async (tm, usr, add) => {
    setDirectorySyncState("saving");
    try {
      const data = await db.directory.toggleTeamMember(tm.id, usr.id, add, sessionEmail);
      applyDirectoryPayload(data);
      setDirectorySyncState("synced");
      flash(add ? `Added ${usr.name} to ${tm.name}` : `Removed ${usr.name} from ${tm.name}`);
    } catch (e) {
      setDirectorySyncState("error");
      flash(e.message || "Failed to update team membership");
    }
  };

  // Google Auth + Session Handlers
  const handleSignedIn = (session) => {
    const claims = (session && session.claims) || {};
    const email = (claims.email || "").trim().toLowerCase();
    const isGuestAuth = claims.provider === "guest" || normRole(claims.role) === "Guest";
    const existing = users.find(
      (u) =>
        (claims.sub && (u.id === claims.sub || u.googleSub === claims.sub)) ||
        (email && u.email && u.email.toLowerCase() === email)
    );
    if (existing && existing.status === "deactivated") {
      flash("This workspace account is deactivated.");
      return;
    }
    const targetId = existing ? existing.id : claims.sub || "u-g-" + Date.now().toString(36);
    const targetRole = existing ? normRole(existing.role) : isGuestAuth ? "Guest" : "Member";

    setUsers((prev) => {
      const found = prev.find((u) => u.id === targetId || (email && u.email && u.email.toLowerCase() === email));
      if (found) {
        return prev.map((u) =>
          u.id === found.id
            ? {
                ...u,
                name: claims.name || u.name,
                email: claims.email || u.email,
                avatar: claims.avatar || u.avatar,
                provider: claims.provider || u.provider || "google",
                emailVerified: claims.emailVerified !== false,
                googleSub: claims.sub || u.googleSub,
                lastLoginAt: TODAY,
              }
            : u
        );
      }
      return [
        ...prev,
        {
          id: targetId,
          name: claims.name || (email ? email.split("@")[0] : "Google User"),
          email: claims.email || "",
          role: targetRole,
          title: isGuestAuth ? "External Partner" : "Google Workspace Member",
          teams: isGuestAuth ? [] : ["t-vdc"],
          avatar: claims.avatar || makeGooglePhotoFallback(claims.name || "Google User"),
          provider: claims.provider || "google",
          emailVerified: claims.emailVerified !== false,
          googleSub: claims.sub || null,
          status: "active",
          lastLoginAt: TODAY,
        },
      ];
    });

    setActiveUserId(targetId);
    const syncedSession = { ...session, claims: { ...claims, role: targetRole } };
    saveStoredSession(syncedSession);
    setAuthSession(syncedSession);
    if (!isGuestAuth && email) {
      refreshDirectory(email);
      refreshWorkspace(email);
    }
    setRead(null);
    setSel(null);
    setView(normRole(targetRole) === "Guest" ? "kb" : "home");
    setActivities((prev) => [
      {
        id: "act-" + Date.now() + Math.random().toString(36).slice(2, 5),
        actor: claims.name || email || "User",
        action: isGuestAuth ? "Signed in as External Guest" : "Signed in with Google",
        targetType: "auth",
        targetId: String(targetId),
        targetTitle: claims.email || claims.name || "Google Workspace",
        note: claims.hd ? `@${claims.hd}` : "Verified session",
        at: TODAY,
      },
      ...prev,
    ]);
    flash(`Signed in as ${claims.name || claims.email || "User"}`);
  };
  signedInRef.current = handleSignedIn;

  const handleLogout = async () => {
    await signOutAuth();
    setAuthSession(null);
    setRead(null);
    setSel(null);
    setPal(false);
    setBell(false);
    setAi(false);
    flash("Signed out");
  };

  // Category CRUD Handlers
  const saveCategory = ({ mode, id, name, parentId, owner, vis, color, reqApproval, reviewDays }) => {
    let baseNode = {
      id: id || "cat-" + Date.now().toString(36),
      name,
      color: color || "#0a84ff",
      owner: owner || userName,
      vis: vis || "Internal",
      reqApproval: Boolean(reqApproval),
      reviewDays: Number(reviewDays) || 90,
      kids: [],
    };

    const detach = (nodes) => {
      const out = [];
      for (const n of nodes) {
        if (n.id === id) {
          baseNode = { ...n, ...baseNode, kids: n.kids || [] };
          continue;
        }
        out.push(n.kids ? { ...n, kids: detach(n.kids) } : n);
      }
      return out;
    };

    const insertUnder = (nodes) => {
      if (!parentId) return [...nodes, baseNode];
      let inserted = false;
      const walk = (arr) =>
        arr.map((n) => {
          if (n.id === parentId) {
            inserted = true;
            return { ...n, kids: [...(n.kids || []), baseNode] };
          }
          return n.kids ? { ...n, kids: walk(n.kids) } : n;
        });
      const resTree = walk(nodes);
      return inserted ? resTree : [...resTree, baseNode];
    };

    setTree((prev) => insertUnder(mode === "edit" && id ? detach(prev) : prev));
    if (parentId) {
      setOpen((prev) => (prev.includes(parentId) ? prev : [...prev, parentId]));
    }
    setCatModal(null);
    logAct(mode === "edit" ? "Updated Category" : "Created Category", "category", baseNode.id, name, vis);
    flash(`${mode === "edit" ? "Updated" : "Created"} category “${name}”`);
  };

  const deleteCategory = (catId, reassignToCatId) => {
    const target = byId(catId, tree);
    if (!target) {
      setCatModal(null);
      return;
    }
    const descIds = sub(target);
    if (reassignToCatId) {
      setRes((prev) => prev.map((r) => (descIds.includes(r.node) ? { ...r, node: reassignToCatId } : r)));
    }
    const prune = (nodes) =>
      nodes
        .filter((n) => n.id !== catId)
        .map((n) => (n.kids ? { ...n, kids: prune(n.kids) } : n));
    setTree((prev) => prune(prev));
    if (descIds.includes(cur)) {
      setCur("all");
    }
    setCatModal(null);
    logAct("Deleted Category", "category", catId, target.name, reassignToCatId ? `Items moved → ${reassignToCatId}` : "");
    flash(`Deleted category “${target.name}”`);
  };

  if (!authSession) {
    return html`<${Fragment}>
      <${LoginView} users=${users} onSignedIn=${handleSignedIn} />
      ${revitLinkCtx &&
      html`<${RevitLinkModal}
        linkCtx=${revitLinkCtx}
        res=${[]}
        onClose=${closeRevitLink}
        flash=${flash}
      />`}
      ${toast && html`<div className="toast" role="status">${toast}</div>`}
    </${Fragment}>`;
  }

  const draftCount = visibleRes.filter((r) => r.author === userName && r.status !== "Approved").length;
  const activeUserCount = users.filter((u) => u.status === "active").length;
  const drawerKb = String(KB || "").includes("⌘") ? "⌘\\" : "Ctrl+\\";
  const activeSwitcherKey =
    view === "kb" && catFilter === "kits"
      ? "kits"
      : (view === "kb" || view === "lib") && catFilter === "res"
      ? "team-resources"
      : (view === "kb" && kbDisplay === "tasks") || view === "tasks"
      ? "my-work"
      : view === "naming" || view === "team" || view === "admin"
      ? view
      : view === "lib" && (cur === "fav" || cur === "drafts" || cur === "recent")
      ? cur
      : "kb-space";

  const handleNavSwitch = (key) => {
    setNav(false);
    if (key === "kb-space") {
      setRead(null);
      setActiveKitId(null);
      setCatFilter("all");
      setCur("all");
      setBrainLayer("all");
      if (kbDisplay === "tasks") setKbDisplay("space");
      setSpaceStageOpen(true);
      goV("kb");
    } else if (key === "my-work" || key === "tasks") {
      setRead(null);
      setActiveKitId(null);
      setCatFilter("all");
      setCur("all");
      setBrainTabSeed("tasks");
      setBrainLayer("mine");
      setKbDisplay("tasks");
      setSpaceStageOpen(true);
      goV("kb");
    } else if (key === "team-resources") {
      setRead(null);
      setActiveKitId(null);
      setCur("all");
      setCatFilter("res");
      setKbDisplay("grid");
      setSpaceStageOpen(true);
      goV("kb");
    } else if (key === "kits") {
      setRead(null);
      setActiveKitId(null);
      setCatFilter("kits");
      setSpaceStageOpen(true);
      goV("kb");
    } else if (key === "naming" || key === "team" || key === "admin" || key === "tasks") {
      if (key === "tasks") setBrainTabSeed("all");
      goV(key);
    } else if (key === "fav" || key === "drafts" || key === "recent") {
      setSpaceStageOpen(true);
      go(key);
    }
  };

  const selectChatFromDrawer = (chatId) => {
    setActiveChatId(chatId);
    setRead(null);
    setActiveKitId(null);
    setCatFilter("all");
    setCur("all");
    setKbDisplay("space");
    setSpaceStageOpen(true);
    setView("kb");
    setSpaceChatSig((n) => n + 1);
    setNav(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const startNewChatFromDrawer = () => {
    setActiveChatId(null);
    setRead(null);
    setActiveKitId(null);
    setCatFilter("all");
    setCur("all");
    setF({});
    setQ("");
    setKbDisplay("space");
    setSpaceStageOpen(false);
    setHeroResetSig((n) => n + 1);
    setView("kb");
    setNav(false);
    setHf((n) => n + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  return html`<div className="app">
    ${nav && html`<div className="ov side-ov" onClick=${() => setNav(false)}></div>`}

    <aside className=${"side" + (nav ? " open" : "")} aria-label="Chats and Workspace Navigation" aria-hidden=${!nav}>
      <div className="logo">
        <div className="logo-b">
          <${DatumMark} s=${24} />
          <span>Datum</span>
        </div>
        <button
          type="button"
          className="sb-tgl"
          title=${`Close drawer (${drawerKb})`}
          aria-label="Close navigation drawer"
          onClick=${() => setNav(false)}
        >
          <${Ic} n="x" s=${15} />
        </button>
      </div>

      <div className="side-chats">
        <div className="sec-row">
          <div className="sec" style=${{ margin: 0, padding: "10px 8px 6px 10px" }}>Chats</div>
          <button
            type="button"
            className="side-new-chat"
            title="Start a new AI search thread"
            onClick=${startNewChatFromDrawer}
          >
            <${Ic} n="plus" s=${11} />
            <span>New</span>
          </button>
        </div>
        ${chats.length > 0
          ? html`<div className="side-chat-list">
              ${chats.slice(0, 8).map((c) => {
                const isCurChat = c.id === activeChatId && isSpaceDockActive;
                const turnCount = (c.messages || []).filter((m) => m.role === "user").length;
                return html`<div key=${c.id} className=${"side-chat-row" + (isCurChat ? " on" : "")}>
                  <button
                    type="button"
                    className="side-chat-pick"
                    title=${c.title}
                    onClick=${() => selectChatFromDrawer(c.id)}
                  >
                    <span className="side-ico"><${Ic} n="spark" s=${13} /></span>
                    <span className="side-chat-title">${c.title}</span>
                    <span className="ct">${turnCount}</span>
                  </button>
                  <button
                    type="button"
                    className="side-chat-del"
                    title="Delete chat"
                    aria-label=${`Delete ${c.title}`}
                    onClick=${(e) => {
                      e.stopPropagation();
                      deleteChatThread(c.id);
                    }}
                  >
                    <${Ic} n="trash" s=${12} />
                  </button>
                </div>`;
              })}
            </div>`
          : html`<button type="button" className="side-chat-empty" onClick=${startNewChatFromDrawer}>
              <${Ic} n="spark" s=${13} />
              <span>Ask Datum AI (EN/UA)…</span>
            </button>`}
      </div>

      <div className="sec">Workspace</div>
      <button
        type="button"
        className=${"ti" + (activeSwitcherKey === "kb-space" || activeSwitcherKey === "kits" ? " on" : "")}
        style=${{ paddingLeft: 10 }}
        onClick=${() => handleNavSwitch("kb-space")}
      >
        <span className="side-ico"><${Ic} n="globe" s=${15} /></span>
        <span className="tn">Knowledge Space</span>
      </button>

      <button
        type="button"
        className=${"ti" + (activeSwitcherKey === "team-resources" ? " on" : "")}
        style=${{ paddingLeft: 10 }}
        onClick=${() => handleNavSwitch("team-resources")}
      >
        <span className="side-ico"><${Ic} n="link" s=${15} /></span>
        <span className="tn">Team Resources</span>
      </button>

      <button
        type="button"
        className=${"ti" + (view === "naming" ? " on" : "")}
        style=${{ paddingLeft: 10 }}
        onClick=${() => handleNavSwitch("naming")}
      >
        <span className="side-ico"><${Ic} n="sliders" s=${15} /></span>
        <span className="tn">Naming Studio</span>
      </button>

      ${!isGuest &&
      html`<button
        type="button"
        className=${"ti" + (view === "team" ? " on" : "")}
        style=${{ paddingLeft: 10 }}
        onClick=${() => handleNavSwitch("team")}
      >
        <span className="side-ico"><${Ic} n="teams" s=${15} /></span>
        <span className="tn">People & Teams</span>
      </button>`}

      ${isGovCapable &&
      html`<button
        type="button"
        className=${"ti" + (view === "admin" ? " on" : "")}
        style=${{ paddingLeft: 10 }}
        onClick=${() => goV("admin")}
      >
        <span className="side-ico"><${Ic} n="shield" s=${15} /></span>
        <span className="tn">Administration</span>
        ${pendingApprovalCount > 0 && html`<span className="ct" style=${{ color: "#ff9f0a", fontWeight: 600 }}>${pendingApprovalCount}</span>`}
      </button>`}

      ${!isGuest &&
      html`<div className="side-cats">
        <div className="sec-row">
          <div className="sec" style=${{ margin: 0, padding: "16px 8px 6px 10px" }}>Categories</div>
          ${can.admin(role) &&
          html`<button
            type="button"
            className="sec-add"
            title="New Category"
            aria-label="New Category"
            onClick=${() => setCatModal({ mode: "create", parentId: "" })}
          >
            <${Ic} n="plus" s=${12} />
          </button>`}
        </div>
        ${visibleTree.map((n) => html`<${Node} key=${n.id} n=${n} d=${0} c=${treeCtx} />`)}
      </div>`}

      ${!isGuest &&
      html`<div>
        <div className="sec">Personal</div>
        <button type="button" className=${"ti" + (activeSwitcherKey === "my-work" ? " on" : "")} style=${{ paddingLeft: 10 }} onClick=${() => handleNavSwitch("my-work")}>
          <span className="side-ico"><${Ic} n="check" s=${15} /></span>
          <span className="tn">My Work</span>
          ${openTasksCount > 0 && html`<span className="ct">${openTasksCount}</span>`}
        </button>
        <button type="button" className=${"ti" + (view === "lib" && cur === "fav" ? " on" : "")} style=${{ paddingLeft: 10 }} onClick=${() => go("fav")}>
          <span className="side-ico"><${Ic} n="star" s=${15} /></span>
          <span className="tn">Bookmarks</span>
        </button>
        ${can.createDraft(role) &&
        html`<button type="button" className=${"ti" + (view === "lib" && cur === "drafts" ? " on" : "")} style=${{ paddingLeft: 10 }} onClick=${() => go("drafts")}>
          <span className="side-ico"><${Ic} n="pencil" s=${15} /></span>
          <span className="tn">My Drafts</span>
        </button>`}
        <button type="button" className=${"ti" + (view === "lib" && cur === "recent" ? " on" : "")} style=${{ paddingLeft: 10 }} onClick=${() => go("recent")}>
          <span className="side-ico"><${Ic} n="clock" s=${15} /></span>
          <span className="tn">Recently Viewed</span>
        </button>
      </div>`}

      <${UserSwitcher}
        variant="drawer"
        className="side-mobile-user"
        users=${users}
        activeUserId=${activeUser.id}
        activeUser=${activeUser}
        authClaims=${sessionClaims}
        onToggleTheme=${theme}
        onLogout=${handleLogout}
      />
    </aside>

    <div className="main">
      ${can.createDraft(role) &&
      html`<input
        ref=${dxr}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange=${async (e) => {
          const file = e.target.files[0];
          e.target.value = "";
          if (!file) return;
          if (!/\.docx$/i.test(file.name)) {
            flash("A .docx file is required");
            return;
          }
          flash("Importing “" + file.name + "”…");
          try {
            const r = await docxImport(file);
            setImgs((o) => ({ ...o, ...r.imgs }));
            createNewDoc({ title: r.title, desc: r.desc, body: r.body });
            flash("Document imported into live editor");
            db.uploadImagesMap(r.imgs).then((uploaded) => {
              if (uploaded && Object.keys(uploaded).length) {
                setImgs((o) => ({ ...o, ...uploaded }));
              }
            });
          } catch (x) {
            flash("Could not read the .docx");
          }
        }}
      />`}

      <div className=${"bar" + (sc ? " sc" : "") + (pal ? " pal-open" : "") + (isSpaceDockActive ? " bar-space" : "")}>
        <div className="bar-l">
          <button
            type="button"
            className="ib menu nav-drawer-btn"
            title=${`Chats & Categories (${drawerKb})`}
            aria-label="Open Chats and Navigation Drawer"
            onClick=${() => {
              setBell(false);
              setNav((v) => !v);
            }}
          >
            ${html`<${Ic} n="sidebar" s=${16} />`}
          </button>
          <button
            type="button"
            className="nav-brand-btn"
            title="Return to clean Chat-First view"
            onClick=${returnCleanChatHero}
          >
            <${DatumMark} s=${20} />
            <span className="nav-brand-label">${rr ? "Datum" : pageTitle}</span>
          </button>
          ${rr &&
          html`<nav className="bar-crumb" aria-label="Breadcrumb">
            <span className="bar-crumb-sep">/</span>
            <button
              type="button"
              className="bar-crumb-btn"
              onClick=${() => {
                setRead(null);
                if (rr.node) go(rr.node);
              }}
            >
              ${(byId(rr.node, tree) && byId(rr.node, tree).name) || pageTitle}
            </button>
            <span className="bar-crumb-sep">/</span>
            <span className="bar-crumb-cur">${rr.title}</span>
          </nav>`}
        </div>

        <${Pal}
          open=${pal && !isSpaceDockActive}
          isSpaceDockActive=${isSpaceDockActive}
          omniRectRef=${omniRectRef}
          onOpen=${() => setPal(true)}
          close=${() => setPal(false)}
          catalogQ=${q}
          onCatalogQChange=${setQ}
          onClearCatalogQ=${() => setQ("")}
          kb=${KB}
          res=${visibleRes}
          tree=${tree}
          role=${role}
          userName=${userName}
          cols=${visibleCols}
          favs=${favs}
          privTasks=${isGuest ? [] : tasks}
          privNotes=${isGuest ? [] : privNotes}
          privResources=${isGuest ? [] : privResources}
          onSaveAiNote=${!isGuest ? saveAiMessageToNote : null}
          recentSearches=${recentSearches}
          onLogSearch=${logSearch}
          onOpenNamingStudio=${openNamingFromChat}
          act=${pa}
        />

        <div className="bar-r">
          ${!rr &&
          !["tasks", "team", "admin"].includes(view) &&
          can.createDraft(role) &&
          html`<${Fragment}>
            <button
              className="btn p cr"
              title="Create Document or Resource"
              onClick=${() => createNewDoc()}
            >
              <${Ic} n="plus" s=${16} /><span>Create</span>
            </button>

            <button className="ib" title="Import article from .docx" aria-label="Import from .docx" onClick=${() => dxr.current && dxr.current.click()}>
              ${html`<${Ic} n="doc" s=${18} />`}
            </button>
          </${Fragment}>`}
          ${!isGuest &&
          html`<button className="ib bar-r-bell" title="Notifications" aria-label="Notifications" onClick=${() => setBell(!bell)}>
            ${html`<${Ic} n="bell" s=${18} />`}${unread > 0 && html`<span className="dot">${unread}</span>`}
          </button>`}
          <${UserSwitcher}
            variant="topbar"
            users=${users}
            activeUserId=${activeUser.id}
            activeUser=${activeUser}
            authClaims=${sessionClaims}
            onToggleTheme=${theme}
            onLogout=${handleLogout}
          />
        </div>
      </div>

      ${rr &&
      html`<${Reader}
        key=${rr.id}
        r=${rr}
        initialSection=${readSection && String(readSection.docId) === String(rr.id) ? readSection : null}
        bridgeRef=${readerBridgeRef}
        res=${visibleRes}
        tree=${tree}
        imgs=${imgs}
        setImgs=${setImgs}
        role=${role}
        userName=${userName}
        userAvatar=${activeUser.avatar || ""}
        fav=${favs.includes(rr.id)}
        favs=${favs}
        pinned=${pinned.includes(rr.id)}
        tf=${(id) => tgl(setFavs, id)}
        onTogglePin=${(id) => tgl(setPinned, id)}
        back=${() => setRead(null)}
        go=${rd}
        info=${pick}
        rec=${recRead}
        chk=${chk}
        togChk=${togChk}
        ack=${ack}
        acks=${acks}
        req=${req}
        togReq=${togReq}
        onVerify=${act.onVerify}
        onInlineUpdate=${autoSaveItem}
        onSaveSnapshot=${saveSnapshot}
        onDelete=${delItem}
        flash=${flash}
        chats=${chats}
        activeChatId=${activeChatId}
        onSelectChat=${setActiveChatId}
        onNewChat=${startNewChat}
        onSendChat=${sendUnifiedChat}
        onOpenNamingStudio=${openNamingFromChat}
        onFlagGap=${flagMissingStandard}
        onFlagOutdated=${(id) => {
          if (!flaggedIds.includes(id)) setFlaggedIds((fl) => [...fl, id]);
          flash("Flagged for Category Owner review");
          logAct("Flagged Outdated", "item", id, titleOf(id));
        }}
        onOpenPublic=${(t) => setPubTarget(t)}
        privNotes=${isGuest ? [] : privNotes}
        privResources=${isGuest ? [] : privResources}
        onAddTaskForDoc=${!isGuest ? (doc, sec) => setQcModal({ mode: "task", doc, linkedSection: sec?.title || "" }) : null}
        onAddNoteForDoc=${!isGuest ? (doc, sec) => setQcModal({ mode: "note", doc, linkedSection: sec?.title || "" }) : null}
        onSaveToNote=${!isGuest ? saveAiMessageToNote : null}
        onSaveToTask=${!isGuest ? saveAiMessageToTask : null}
        onOpenNote=${(noteId) => openBrainSource({ id: "note:" + noteId })}
        onOpenBrainSource=${openBrainSource}
      />`}

      <div className=${"pad" + (isSpaceView ? " pad-space" : "")} hidden=${!!rr}>
        ${(view === "home" || view === "lib" || view === "kb" || view === "space" || view === "reslib") &&
        (() => {
          const catalogToolbarControls = html`<${Fragment}>
            <${ViewModeSwitch}
              viewMode=${activeViewMode}
              stageOpen=${spaceStageOpen}
              visibleColsCount=${visibleCols.length}
              showTasks=${!isGuest}
              onSelectMode=${selectSpatialMode}
            />
            <${FilterPopover}
              view=${view}
              curCat=${curCat}
              catFilter=${catFilter}
              setCatFilter=${handleSetCatFilter}
              setActiveKitId=${setActiveKitId}
              visibleColsCount=${visibleCols.length}
              kitTier=${kitTier}
              setKitTier=${setKitTier}
              f=${f}
              setF=${setSpaceF}
              disciplines=${DISC}
              discColors=${DC}
              canFilterStatus=${can.createDraft(role)}
              statuses=${Object.entries(ST).map(([k, v]) => [k, v[0]])}
              types=${Object.entries(TY)}
              tags=${tags}
            />
            <${SortPopover}
              view=${view}
              catFilter=${catFilter}
              setCatFilter=${handleSetCatFilter}
              setActiveKitId=${setActiveKitId}
              activeKitId=${activeKitId}
              kbDisplay=${kbDisplay}
              setKbDisplay=${switchKbDisplay}
              onSelectViewMode=${selectSpatialMode}
              stageOpen=${spaceStageOpen}
              hideViewDesktop=${true}
              sort=${sort}
              setSort=${setSort}
              visibleColsCount=${visibleCols.length}
            />
          <//>`;

          const spaceLeftNav = html`<${Fragment}>
            <button
              type="button"
              className="nav-drawer-btn kspace-head-drawer-btn"
              title=${`Menu, Chats & Categories (${drawerKb})`}
              aria-label="Open Navigation Drawer"
              onClick=${() => {
                setBell(false);
                setNav((v) => !v);
              }}
            >
              <${Ic} n="sidebar" s=${15} />
            </button>
            <button
              type="button"
              className="nav-brand-btn"
              title=${spaceStageOpen ? "Clean Chat-First view" : "Knowledge Space"}
              onClick=${returnCleanChatHero}
            >
              <${DatumMark} s=${20} />
              <span className="nav-brand-label">${pageTitle}</span>
            </button>
          </${Fragment}>`;

          const spaceHeaderActions = html`<${Fragment}>
            ${can.createDraft(role) &&
            html`<button
              type="button"
              className="kspace-create-btn"
              title="Create Document or Resource"
              aria-label="Create Document or Resource"
              onClick=${() => createNewDoc()}
            >
              <${Ic} n="plus" s=${15} />
            </button>`}
            ${!isGuest &&
            html`<button
              type="button"
              className="kspace-bell-btn"
              title="Notifications"
              aria-label="Notifications"
              onClick=${() => setBell(!bell)}
            >
              <${Ic} n="bell" s=${15} />
              ${unread > 0 && html`<span className="dot">${unread}</span>`}
            </button>`}
            <${UserSwitcher}
              variant="topbar"
              users=${users}
              activeUserId=${activeUser.id}
              activeUser=${activeUser}
              authClaims=${sessionClaims}
              onToggleTheme=${theme}
              onLogout=${handleLogout}
            />
          </${Fragment}>`;

          if (isSpaceView) {
            return html`<${KnowledgeSpaceView}
              items=${shown}
              allItems=${visibleRes}
              allCount=${list.length}
              pageTitle=${pageTitle}
              curCat=${curCat}
              tree=${tree}
              role=${role}
              userName=${userName}
              pinned=${pinned}
              cols=${visibleCols}
              viewMode=${activeViewMode}
              onSelectViewMode=${selectSpatialMode}
              stageOpen=${spaceStageOpen}
              onStageOpenChange=${setSpaceStageOpen}
              heroResetSignal=${heroResetSig}
              activeKitId=${activeKitId}
              onSelectKit=${(kitId) => {
                setActiveKitId(kitId || null);
                setCatFilter("kits");
                setSpaceStageOpen(true);
              }}
              kitTier=${kitTier}
              onKitTierChange=${setKitTier}
              creatingKit=${creatingKit}
              onCreatingKitChange=${setCreatingKit}
              onAddCol=${addCol}
              onSaveCol=${saveCol}
              onDelCol=${delCol}
              onOpenPublic=${(t) => setPubTarget(t)}
              aq=${aq}
              focusSignal=${hf}
              openChatSignal=${spaceChatSig}
              catalogQ=${q}
              onCatalogQChange=${setQ}
              onOpenKit=${(kitId) => {
                setActiveKitId(kitId);
                setCatFilter("kits");
                setSpaceStageOpen(true);
              }}
              onOpenAllKits=${() => {
                setActiveKitId(null);
                setCatFilter("kits");
                setSpaceStageOpen(true);
              }}
              favs=${favs}
              onToggleFav=${(id) => tgl(setFavs, id)}
              onRead=${rd}
              onInspect=${pick}
              isGuest=${isGuest}
              hasFilters=${hasF || Boolean(q.trim())}
              onResetFilters=${() => {
                setF({});
                setQ("");
                if (catFilter !== "kits") setCatFilter("all");
              }}
              onClearCategory=${() => goHome()}
              f=${f}
              setF=${setSpaceF}
              toolbarRight=${catalogToolbarControls}
              spaceLeftNav=${spaceLeftNav}
              spaceActions=${spaceHeaderActions}
              onImportDocx=${can.createDraft(role) ? () => dxr.current && dxr.current.click() : null}
              active=${isSpaceDockActive}
              cmdOpen=${pal && isSpaceDockActive}
              onSetCmdOpen=${setPal}
              recentSearches=${recentSearches}
              onLogSearch=${logSearch}
              chats=${chats}
              activeChatId=${activeChatId}
              onSelectChat=${setActiveChatId}
              onNewChat=${startNewChat}
              onDeleteChat=${deleteChatThread}
              onClearChats=${clearAllChats}
              onSendChat=${sendUnifiedChat}
              onOpenNamingStudio=${openNamingFromChat}
              onFlagGap=${flagMissingStandard}
              onCommand=${pa}
              kb=${KB}
              omniRectRef=${omniRectRef}
              todayTaskCount=${todayPendingTasksCount}
              openTasksCount=${openTasksCount}
              onOpenTasks=${() => handleNavSwitch("tasks")}
              onOpenQuickCapture=${(mode = "task") => setQcModal({ mode, doc: null })}
              onQuickCommand=${handleQuickCommand}
              onOpenBrainSource=${openBrainSource}
              onSaveToNote=${!isGuest ? saveAiMessageToNote : null}
              onSaveToTask=${!isGuest ? saveAiMessageToTask : null}
              brainLayer=${brainLayer}
              onBrainLayerChange=${setBrainLayer}
              projectFilter=${spaceProject}
              brainProjects=${brainProjects}
              onProjectFilterChange=${setSpaceProject}
              privTasks=${isGuest ? [] : tasks}
              privNotes=${isGuest ? [] : privNotes}
              privResources=${isGuest ? [] : privResources}
              brainUsers=${users}
              currentEmail=${brainOwnerEmail}
              activities=${activities}
              requiredIds=${req}
              acks=${Object.keys(acks || {}).filter((k) => acks[k]).map(Number)}
              plannerPrefs=${plannerPrefs}
              brainCategories=${brainCategories}
              brainSyncState=${brainSyncState}
              canPromote=${can.createDraft(role)}
              brainInitialTab=${brainTabSeed}
              brainHighlightId=${brainHighlightId}
              onSaveTask=${saveTask}
              onDeleteTask=${deleteTask}
              onSaveNote=${savePrivNote}
              onDeleteNote=${deletePrivNote}
              onSaveResource=${savePrivResource}
              onDeleteResource=${deletePrivResource}
              onShareResource=${shareResourceWithTeammates}
              onSuggestResourceToTeam=${suggestResourceToTeamKb}
              onSuggestNoteToTeam=${suggestNoteToTeamKb}
              onOpenManageSheet=${(mode) => setManageSheetMode(mode)}
              onStartRevision=${(parentTask) => setQcModal({ mode: "task", revisionParent: parentTask })}
              onPromoteNoteToDoc=${(note) =>
                createNewDoc({
                  title: note.title || "From Private Note",
                  body: note.body || "",
                  tags: [note.project || "General", ...(note.tags || [])].filter(Boolean),
                })
              }
              onOpenBrainSheet=${(payload) => setQcModal(payload)}
            />`;
          }

          return html`<div>
            <div className="pdl-top">
              <div className="pdl-top-l">
                <h1>${pageTitle}</h1>
                <span className="pdl-cnt">
                  ${view === "kb" && catFilter === "kits"
                    ? visibleCols.filter((c) => kitTier === "all" || c.tier === kitTier).length
                    : list.length}
                </span>
              </div>
              <div className="pdl-top-r">${catalogToolbarControls}</div>
            </div>

          ${view === "kb" && catFilter === "kits"
            ? html`<${CollectionsView}
                embedded=${true}
                hideSubbar=${true}
                externalTab=${kitTier}
                onExternalTabChange=${setKitTier}
                externalCreating=${creatingKit}
                onExternalCreatingChange=${setCreatingKit}
                initialColId=${activeKitId}
                onClearInitialCol=${() => setActiveKitId(null)}
                cols=${cols}
                res=${visibleRes}
                role=${role}
                userName=${userName}
                onAddCol=${addCol}
                onSaveCol=${saveCol}
                onDelCol=${delCol}
                onRead=${rd}
                onOpenPublic=${(t) => setPubTarget(t)}
              />`
            : kbDisplay === "graph"
            ? html`<div className="gxw kb-gxw">
                <${Graph} res=${shown.length ? shown : visibleRes} selId=${sel} pick=${pick} />
              </div>`
            : html`<div>
                ${showFeat &&
                rec.length > 0 &&
                html`<section>
                  <h2>Recently published</h2>
                  <div className="feat">
                    ${rec.map(
                      (r) => html`<button key=${r.id} className="big" style=${{ "--c": DC[r.disc] }} onClick=${() => rd(r.id)}>
                        <span className="bt"><${Ic} n=${r.type} s=${20} /></span>
                        <span className="bm"><small>${r.disc}, ${fmt(r.upd)}</small><b>${r.title}</b><span>${r.desc}</span></span>
                      </button>`
                    )}
                  </div>
                  <h2>All items</h2>
                </section>`}

                ${(() => {
                  const gridItems = showFeat ? shown.filter((r) => !rec.includes(r)) : shown;
                  const pageItems = gridItems.slice(0, visibleCount);
                  const remaining = gridItems.length - pageItems.length;
                  return list.length
                    ? html`<div>
                        <div className="grid">
                          ${pageItems.map(
                            (r) => html`<div
                              key=${r.id}
                              className="card"
                              role="button"
                              tabIndex="0"
                              onClick=${() => rd(r.id)}
                              onKeyDown=${(e) => e.key === "Enter" && rd(r.id)}
                            >
                              ${!isGuest &&
                              html`<div className="acts">
                                <button
                                  className=${favs.includes(r.id) ? "on" : ""}
                                  aria-label="Bookmark"
                                  onClick=${(e) => {
                                    e.stopPropagation();
                                    tgl(setFavs, r.id);
                                  }}
                                >
                                  ${html`<${Ic} n="star" s=${16} f=${favs.includes(r.id)} />`}
                                </button>
                              </div>`}
                              <div className="ch2">
                                <span className="tl" style=${{ "--c": DC[r.disc] }}><${Ic} n=${r.type} s=${18} /></span>
                                <span className="who"><b>${r.disc}</b><small>${TY[r.type] || "Document"}</small></span>
                              </div>
                              <h3>${r.title}</h3>
                              <p>${r.desc}</p>
                              <div className="row">
                                <${Pill} s=${r.status} />
                                ${r.vis && r.vis !== "Internal" && html`<${VisPill} v=${r.vis} />`}
                                <span>v${r.v.length}</span>
                                ${r.url &&
                                isResType(r.type) &&
                                html`<a
                                  className="mn"
                                  style=${{ marginLeft: "auto" }}
                                  href=${r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick=${(e) => e.stopPropagation()}
                                >
                                  Open ↗
                                </a>`}
                                ${(!r.url || !isResType(r.type)) && html`<span style=${{ marginLeft: "auto" }}>${fmt(r.upd)}</span>`}
                              </div>
                            </div>`
                          )}
                        </div>
                        ${remaining > 0 &&
                        html`<div style=${{ display: "flex", justifyContent: "center", marginTop: 22 }}>
                          <button className="btn" onClick=${() => setVisibleCount((c) => c + PAGE_SIZE)}>
                            Show more (${remaining} remaining)
                          </button>
                        </div>`}
                      </div>`
                    : html`<div className="empty">
                        <${Ic} n="search" s=${34} />
                        <b>Nothing found</b>
                        <span>Try adjusting your query or filters.</span>
                        ${hasF && html`<button className="btn" onClick=${() => setF({})}>Reset filters</button>`}
                      </div>`;
                })()}
              </div>`}
        </div>`;
        })()}

        ${view === "type" &&
        html`<${RevitTypeView}
          ctx=${revitTypeCtx}
          initialAssemblyId=${assemblyId}
          res=${visibleRes}
          imgs=${imgs}
          tree=${tree}
          favs=${favs}
          onToggleFav=${(id) => tgl(setFavs, id)}
          onRead=${rd}
          onOpenNamingStudio=${(tName, rCtx) => {
            setNamingTypeSeed(tName || "");
            if (rCtx) setRevitTypeCtx(rCtx);
            goV("naming");
          }}
          onToast=${setToast}
        />`}

        ${view === "naming" &&
        html`<${NamingStudioView}
          initialTypeName=${namingTypeSeed}
          revitCtx=${revitTypeCtx}
          customSchemas=${namingSchemas}
          onChangeCustomSchemas=${setNamingSchemas}
          onReadDoc=${rd}
          onToast=${setToast}
        />`}

        ${view === "tasks" &&
        !isGuest &&
        html`<${SecondBrainView}
          tasks=${tasks}
          notes=${privNotes}
          resources=${privResources}
          docs=${visibleRes}
          users=${users}
          currentEmail=${brainOwnerEmail}
          activities=${activities}
          requiredIds=${req}
          acks=${Object.keys(acks || {}).filter((k) => acks[k]).map(Number)}
          statuses=${plannerPrefs.statuses}
          categories=${brainCategories}
          projects=${brainProjects}
          ownerName=${userName}
          syncState=${brainSyncState}
          canPromote=${can.createDraft(role)}
          initialTab=${brainTabSeed}
          highlightId=${brainHighlightId}
          onSaveTask=${saveTask}
          onDeleteTask=${deleteTask}
          onSaveNote=${savePrivNote}
          onDeleteNote=${deletePrivNote}
          onSaveResource=${savePrivResource}
          onDeleteResource=${deletePrivResource}
          onShareResource=${shareResourceWithTeammates}
          onSuggestResourceToTeam=${suggestResourceToTeamKb}
          onSuggestNoteToTeam=${suggestNoteToTeamKb}
          onOpenSheet=${(payload) => setQcModal(payload)}
          onOpenManageSheet=${(mode) => setManageSheetMode(mode)}
          onStartRevision=${(parentTask) => setQcModal({ mode: "task", revisionParent: parentTask })}
          onOpenDoc=${(id) => rd(id)}
          onPromoteNoteToDoc=${(note) =>
            createNewDoc({
              title: note.title || "From Private Note",
              body: note.body || "",
              tags: [note.project || "General", ...(note.tags || [])].filter(Boolean),
            })
          }
        />`}

        ${view === "team" &&
        !isGuest &&
        html`<${TeamView}
          users=${users}
          teams=${teams}
          res=${visibleRes}
          tree=${tree}
          role=${role}
          userName=${userName}
          currentUserId=${activeUser.id}
          directorySyncState=${directorySyncState}
          onInviteUser=${handleInviteUser}
          onDeactivateUser=${handleDeactivateUser}
          onDeleteUser=${handleDeleteUser}
          onCreateTeam=${handleCreateTeamDb}
          onToggleTeamMember=${handleToggleTeamMemberDb}
          onOpenAdminUsers=${() => {
            setAdminTabSeed("users");
            setView("admin");
          }}
          onFilterByOwner=${(authorName) => {
            setF({ author: authorName });
            setCur("all");
            setQ("");
            setView("lib");
            flash(`Filtered catalog by ${authorName}`);
          }}
          onSelectCat=${(catId) => go(catId)}
          flash=${flash}
        />`}

        ${view === "admin" &&
        isGovCapable &&
        html`<${AdminView}
          res=${res}
          tree=${tree}
          setTree=${setTree}
          users=${users}
          teams=${teams}
          cols=${cols}
          activities=${activities}
          searchLogs=${searchLogs}
          acks=${acks}
          teamAcks=${teamAcks}
          req=${req}
          role=${role}
          userName=${userName}
          currentUserId=${activeUser.id}
          flaggedIds=${flaggedIds}
          initialTab=${adminTabSeed}
          directorySyncState=${directorySyncState}
          onRead=${rd}
          onApprove=${(id) => act.onStatus(id, "Approved")}
          onReject=${(id) => act.onStatus(id, "Draft")}
          onVerify=${act.onVerify}
          onRevokePublic=${(kind, id) => {
            if (kind === "item") act.onChangeVis(id, "Internal");
            else {
              const targetCol = cols.find((c) => c.id === id);
              if (targetCol) saveCol({ ...targetCol, vis: "Internal" });
              else setCols((prev) => prev.map((c) => (c.id === id ? { ...c, vis: "Internal" } : c)));
            }
            flash("Public access revoked");
          }}
          onOpenPublic=${(t) => setPubTarget(t)}
          onRenameTag=${(oldT, nextT) => {
            if (!nextT || oldT === nextT) return;
            const changed = [];
            const nextList = resRef.current.map((r) => {
              if (!r.tags || !r.tags.includes(oldT)) return r;
              const nextTags = [...new Set(r.tags.map((x) => (x === oldT ? nextT : x)))];
              const updated = { ...r, tags: nextTags, upd: TODAY };
              changed.push(updated);
              return updated;
            });
            resRef.current = nextList;
            setRes(nextList);
            changed.forEach((item) => {
              db.invalidateArticle(item.id);
              syncSharedItem(item, "save");
            });
            edgeClient.clearAiCache();
            logAct("Merged Tag", "tag", oldT, `#${oldT} → #${nextT}`);
            flash(`Merged #${oldT} → #${nextT}`);
          }}
          onDeleteTag=${(t) => {
            const changed = [];
            const nextList = resRef.current.map((r) => {
              if (!r.tags || !r.tags.includes(t)) return r;
              const updated = { ...r, tags: r.tags.filter((x) => x !== t), upd: TODAY };
              changed.push(updated);
              return updated;
            });
            resRef.current = nextList;
            setRes(nextList);
            changed.forEach((item) => {
              db.invalidateArticle(item.id);
              syncSharedItem(item, "save");
            });
            edgeClient.clearAiCache();
            logAct("Removed Tag", "tag", t, `#${t}`);
            flash(`Removed #${t}`);
          }}
          onInviteUser=${handleInviteUser}
          onUpdateUserRole=${handleUpdateUserRole}
          onDeactivateUser=${handleDeactivateUser}
          onReactivateUser=${handleReactivateUser}
          onDeleteUser=${handleDeleteUser}
          onFilterByOwner=${(authorName) => {
            setF({ author: authorName });
            setCur("all");
            setQ("");
            setView("lib");
            flash(`Filtered catalog by ${authorName}`);
          }}
          onCreateForTopic=${(topic) => createNewDoc({ title: topic })}
          onDismissSearchGap=${dismissSearchGap}
          flash=${flash}
        />`}
      </div>
    </div>

    ${bell &&
    html`<div>
      <div className="ov" style=${{ background: "transparent", backdropFilter: "none", WebkitBackdropFilter: "none", zIndex: 54 }} onClick=${() => setBell(false)}></div>
      <div className="pop">
        <div style=${{ display: "flex", alignItems: "center" }}>
          <h4 style=${{ flex: 1 }}>Updates</h4>
          ${notifications.length > 0 &&
          html`<button className="mn" style=${{ padding: 8, fontSize: 13 }} onClick=${markAllNotifsRead}>Mark all as read</button>`}
        </div>
        ${notifications.length
          ? notifications.map(
              (n) => html`<button
                key=${n.id}
                className=${"nt" + (n.un ? " un" : "")}
                onClick=${() => {
                  markNotifRead(n.id);
                  setBell(false);
                  n.run && n.run();
                }}
              >
                <span>${n.text}<small>${n.t}</small></span>
              </button>`
            )
          : html`<div className="empty" style=${{ padding: 30 }}>All quiet</div>`}
      </div>
    </div>`}

    ${sr &&
    html`<${Drawer}
      r=${sr}
      res=${visibleRes}
      tree=${tree}
      role=${role}
      userName=${userName}
      users=${users}
      shares=${shares}
      fav=${favs.includes(sr.id)}
      pinned=${pinned.includes(sr.id)}
      isReq=${req.includes(sr.id)}
      isCurrentDoc=${Boolean(rr && rr.id === sr.id)}
      bridgeRef=${readerBridgeRef}
      tf=${(id) => tgl(setFavs, id)}
      onTogglePin=${(id) => tgl(setPinned, id)}
      onToggleReq=${togReq}
      onInlineUpdate=${autoSaveItem}
      onSaveSnapshot=${saveSnapshot}
      onDelete=${(id) => {
        setSel(null);
        delItem(id);
      }}
      onFlagOutdated=${(id) => {
        if (!flaggedIds.includes(id)) setFlaggedIds((fl) => [...fl, id]);
        flash("Flagged for Category Owner review");
        logAct("Flagged Outdated", "item", id, titleOf(id));
      }}
      close=${() => setSel(null)}
      pick=${pick}
      read=${rd}
      onOpenPublic=${(t) => setPubTarget(t)}
      ...${act}
    />`}

    ${pubTarget &&
    html`<${PublicPreviewModal} target=${pubTarget} res=${res} imgs=${imgs} close=${() => setPubTarget(null)} />`}

    ${catModal &&
    html`<${CategoryModal}
      modal=${catModal}
      tree=${tree}
      res=${res}
      users=${users}
      role=${role}
      userName=${userName}
      onClose=${() => setCatModal(null)}
      onSave=${saveCategory}
      onDelete=${deleteCategory}
    />`}

    ${revitLinkCtx &&
    html`<${RevitLinkModal}
      linkCtx=${revitLinkCtx}
      res=${visibleRes}
      onClose=${closeRevitLink}
      onOpenDoc=${(id) => pick(id)}
      onOpenType=${(ctx) => {
        setRevitTypeCtx(ctx);
        setView("type");
      }}
      flash=${flash}
    />`}
    ${!isGuest &&
    qcModal &&
    html`<${QuickCaptureModal}
      open=${true}
      initialMode=${qcModal.mode || "task"}
      initialDoc=${qcModal.doc || null}
      initialTask=${qcModal.task || null}
      initialRevisionParent=${qcModal.revisionParent || null}
      initialNote=${qcModal.note || null}
      initialResource=${qcModal.resource || null}
      initialProject=${qcModal.project || ""}
      initialLinkedSection=${qcModal.linkedSection || ""}
      statuses=${plannerPrefs.statuses}
      categories=${brainCategories}
      projects=${brainProjects}
      tasks=${tasks}
      docs=${visibleRes}
      onClose=${() => setQcModal(null)}
      onStartRevision=${(parentTask) => setQcModal({ mode: "task", revisionParent: parentTask })}
      onSaveTask=${async (taskObj) => {
        await saveTask(taskObj);
        flash(taskObj.revNumber > 0 && !taskObj.id ? `Added revision R${taskObj.revNumber}` : taskObj.id ? `Updated “${taskObj.title}”` : `Task saved · ${taskObj.project || "General"}`);
      }}
      onDeleteTask=${async (id) => {
        await deleteTask(id);
        flash("Task deleted");
      }}
      onSaveNote=${async (noteObj) => {
        await savePrivNote(noteObj);
        flash(noteObj.id ? "Note updated" : "Private note saved");
      }}
      onDeleteNote=${async (id) => {
        await deletePrivNote(id);
        flash("Note deleted");
      }}
      onSaveResource=${async (resObj) => {
        await savePrivResource(resObj);
        flash(resObj.id ? "Resource updated" : `Resource saved · ${resObj.project || "General"}`);
      }}
      onDeleteResource=${async (id) => {
        await deletePrivResource(id);
        flash("Resource deleted");
      }}
    />`}
    ${!isGuest &&
    manageSheetMode &&
    html`<${PlannerManageSheet}
      open=${true}
      mode=${manageSheetMode}
      statuses=${plannerPrefs.statuses}
      projects=${brainProjects}
      categories=${brainCategories}
      tasks=${tasks}
      onClose=${() => setManageSheetMode(null)}
      onSaveStatuses=${savePlannerStatuses}
      onSaveLists=${savePlannerLists}
    />`}
    ${toast && html`<div className="toast" role="status">${toast}</div>`}
  </div>`;
}
