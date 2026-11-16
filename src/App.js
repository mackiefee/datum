'use client';

import { html, Fragment, useState, useMemo, useEffect, useRef } from './lib/react.js';
import { TODAY, KB, ST, TY, STG, DISC, DC, RD, ROLES, can, normRole, isDocType, isResType } from './config/constants.js';
import { TREE, buildFlat, sub, byId } from './data/spaces.js';
import { IMG0, GUIDE, SEED, NOTES, USERS, SEED_TEAMS, SEED_COLLECTIONS, SEED_ACTIVITIES } from './data/seed.js';
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
import { fmt, pl } from './utils/format.js';
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
    if (!saved || !Array.isArray(saved)) return USERS;
    return saved.map((u) => {
      if (u && (u.id === "local-dev-superadmin" || u.id === "local-dev-member" || (u.email && u.email.toLowerCase() === "maf@planit-inc.com"))) {
        return { ...u, id: "local-dev-superadmin", role: "SuperAdmin", title: "Head of VDC & SuperAdmin" };
      }
      const def = USERS.find((d) => d.id === u.id || (u.email && d.email === u.email));
      return def
        ? {
            ...def,
            ...u,
            avatar: u.avatar || def.avatar,
            title: u.title || def.title,
            provider: u.provider || def.provider,
            emailVerified: u.emailVerified ?? def.emailVerified,
          }
        : u;
    });
  });
  const [teams, setTeams] = useState(() => db.load("kb2-teams", null) || SEED_TEAMS);
  const [activeUserId, setActiveUserId] = useState(() => db.load("kb2-uid", "u1"));
  const [authSession, setAuthSession] = useState(() => loadStoredSession());
  const [catModal, setCatModal] = useState(null);
  const [cols, setCols] = useState(() => db.load("kb2-cols", null) || SEED_COLLECTIONS);
  const [shares, setShares] = useState(() => db.load("kb2-shares", null) || []);
  const [activities, setActivities] = useState(() => db.load("kb2-acts", null) || SEED_ACTIVITIES);
  const [searchLogs, setSearchLogs] = useState(() => db.load("kb2-slogs", null) || []);
  const [flaggedIds, setFlaggedIds] = useState(() => db.load("kb2-flags", null) || []);
  const [pinned, setPinned] = useState(() => db.load("kb2-pins", null) || [100, 113, 129, 132]);

  const [favs, setFavs] = useState(() => db.load("kb2-fav", null) || [102, 118, 123]);
  const [notes, setNotes] = useState(() => db.load("kb2-notes", null) || NOTES);

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
  const kbDisplayLoaded = useRef(false);
  useEffect(() => {
    if (!kbDisplayLoaded.current) {
      kbDisplayLoaded.current = true;
      const saved = db.load("kb2-display-v2", "space");
      if (saved === "grid" || saved === "space" || saved === "graph") {
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
  useEffect(() => { db.save("kb2-notes", notes); }, [notes]);
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
          teams: ["t-vdc"],
          status: "active",
        }
      : users.find((u) => u.id === activeUserId) || users[0]);
  const userName = activeUser.name;
  const role = activeUser.status === "deactivated" ? "Guest" : normRole(activeUser.role);
  const userTeams = activeUser.teams || [];
  const isGuest = role === "Guest";

  useEffect(() => {
    if (!sessionClaims || matchedUser) return;
    const sub = sessionClaims.sub || "";
    const name = sessionClaims.name || (sessionEmail ? sessionEmail.split("@")[0] : "Google User");
    const email = sessionClaims.email || "";
    const roleVal = normRole(sessionClaims.role);
    const avatar = sessionClaims.avatar || makeGooglePhotoFallback(name);
    setUsers((prev) => {
      const exists = prev.some(
        (u) =>
          (sub && (u.id === sub || u.googleSub === sub)) ||
          (sessionEmail && u.email && u.email.toLowerCase() === sessionEmail)
      );
      if (exists) return prev;
      return [
        {
          id: sub || activeUserId || "u-" + Date.now(),
          googleSub: sub || undefined,
          name,
          email,
          role: roleVal,
          title: sessionClaims.title || "Team Member",
          dept: "VDC",
          teams: ["t-vdc"],
          avatar,
          provider: sessionClaims.provider || "google",
          emailVerified: sessionClaims.emailVerified !== false,
          status: "active",
        },
        ...prev,
      ];
    });
  }, [sessionClaims, matchedUser, sessionEmail, activeUserId]);

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
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(r);
      r = requestAnimationFrame(upd);
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    upd();
    return () => mo.disconnect();
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

  const logAct = (action, targetType, targetId, targetTitle, note = "") => {
    setActivities((prev) => [
      { id: "act-" + Date.now() + Math.random().toString(36).slice(2, 5), actor: userName, action, targetType, targetId: String(targetId), targetTitle, note, at: TODAY },
      ...prev,
    ]);
  };

  const tgl = (set, id) => set((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const push = (text, rid) => {
    flash(text);
    setNotes((n) => [{ id: Date.now() + Math.random(), text, rid, t: "just now", un: 1 }, ...n]);
  };
  const upd = (id, fn) => {
    db.invalidateArticle(id);
    edgeClient.clearAiCache();
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
      upd(id, (r) => ({ ...r, c: [...r.c, { by: userName, d: TODAY, t }] }));
      push(`Commented on “${titleOf(id)}”`, id);
    },
    onLink: (id, to, t) => {
      upd(id, (r) => ({ ...r, links: [...r.links, [to, t]] }));
      push(`Linked “${titleOf(id)}” → “${titleOf(to)}”`, id);
    },
    onVerify: (id) => {
      upd(id, (r) => ({ ...r, verified: TODAY }));
      setFlaggedIds((fl) => fl.filter((x) => x !== id));
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
    setRes((rs) => [
      {
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
      },
      ...rs,
    ]);
    logAct("Created", "item", id, title || "Untitled", "Draft");
    push(title ? `Created “${title}”` : "Created new live draft", id);
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
    setRes((rs) => rs.filter((x) => x.id !== id).map((x) => ({ ...x, links: x.links.filter((l) => l[0] !== id) })));
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
    setAcks((a) => ({ ...a, [id]: TODAY }));
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
    setView(v);
    setNav(false);
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
    setKbDisplay(mode === "grid" || mode === "graph" ? mode : "space");
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
    if (k === "read") rd(a, b ? { sectionId: b } : undefined);
    else if (k === "new") createNewDoc();
    else if (k === "quick-task") setQcModal({ mode: "task", doc: null });
    else if (k === "quick-note") setQcModal({ mode: "note", doc: null });
    else if (k === "tasks") {
      setBrainTabSeed(a || "all");
      goV("tasks");
    }
    else if (k === "home") goHome();
    else if (k === "kits") {
      selectSpatialMode("kits");
    } else if (k === "kb-space") {
      setActiveKitId(null);
      if (catFilter === "kits") setCatFilter("all");
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
    setSearchLogs((prev) => [{ query: cleaned, resultCount: count, at: TODAY }, ...prev.filter((x) => x.query !== cleaned)].slice(0, 20));
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
  const [brainSyncState, setBrainSyncState] = useState("synced");
  const [brainTabSeed, setBrainTabSeed] = useState("all");
  const [brainHighlightId, setBrainHighlightId] = useState(null);
  const [qcModal, setQcModal] = useState(null);
  const brainHydratedEmailRef = useRef("");
  const brainStateSyncTimerRef = useRef(null);

  useEffect(() => {
    if (!brainOwnerEmail || isGuest) {
      setTasks([]);
      setPrivNotes([]);
      brainHydratedEmailRef.current = "";
      return;
    }
    let alive = true;
    brainHydratedEmailRef.current = "";
    const local = db.brain.loadLocal(brainOwnerEmail);
    setTasks(Array.isArray(local.tasks) ? local.tasks : []);
    setPrivNotes(Array.isArray(local.notes) ? local.notes : []);
    setBrainHighlightId(null);

    db.brain
      .fetchSnapshot(brainOwnerEmail)
      .then((snap) => {
        if (!alive || !snap) return;
        if (Array.isArray(snap.tasks)) setTasks(snap.tasks);
        if (Array.isArray(snap.notes)) setPrivNotes(snap.notes);
        if (snap.state && snap.state.exists) {
          if (Array.isArray(snap.state.favs)) setFavs(snap.state.favs);
          if (Array.isArray(snap.state.pinned)) setPinned(snap.state.pinned);
          if (snap.state.acks && typeof snap.state.acks === "object") setAcks(snap.state.acks);
          if (snap.state.chk && typeof snap.state.chk === "object") setChk(snap.state.chk);
          if (Array.isArray(snap.state.chats) && snap.state.chats.length > 0) {
            setChats(snap.state.chats);
            saveChats(snap.state.chats, chatOwnerKey);
            if (snap.state.activeChatId) {
              setActiveChatId(snap.state.activeChatId);
              saveActiveChatId(snap.state.activeChatId, chatOwnerKey);
            }
          }
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
    const payload = { favs, pinned, acks, chk, chats, activeChatId };
    db.brain.saveLocalState(brainOwnerEmail, payload);
    clearTimeout(brainStateSyncTimerRef.current);
    brainStateSyncTimerRef.current = setTimeout(() => {
      db.brain.syncState(brainOwnerEmail, payload).catch(() => {});
    }, 900);
    return () => clearTimeout(brainStateSyncTimerRef.current);
  }, [favs, pinned, acks, chk, chats, activeChatId, brainOwnerEmail, isGuest]);

  const saveTask = async (taskInput) => {
    if (!brainOwnerEmail || isGuest) return null;
    const id = taskInput.id || makeUuid();
    const nowIso = new Date().toISOString();
    const nextStatus = taskInput.status || "todo";
    const pri = Number.isFinite(Number(taskInput.priority)) ? Math.max(0, Math.min(3, Math.trunc(Number(taskInput.priority)))) : (taskInput.isUrgent ? 3 : 0);
    const isUrgent = Boolean(taskInput.isUrgent || pri >= 3);
    const optimistic = {
      id,
      ownerEmail: brainOwnerEmail,
      title: String(taskInput.title || "").trim(),
      notes: taskInput.notes || "",
      project: taskInput.project || "General",
      category: taskInput.category || "",
      priority: isUrgent && pri === 0 ? 3 : pri,
      dueDate: taskInput.dueDate || "",
      isUrgent,
      status: nextStatus,
      linkedItemId: taskInput.linkedItemId ?? null,
      linkedItemTitle: taskInput.linkedItemTitle || "",
      sortOrder: Number(taskInput.sortOrder || 0),
      completedAt: nextStatus === "done" ? taskInput.completedAt || nowIso : null,
      createdAt: taskInput.createdAt || nowIso,
      updatedAt: nowIso,
    };
    if (!optimistic.title) return null;
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
      const next = prev.filter((x) => x.id !== id);
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
    return false;
  };

  const openBrainSource = (s) => {
    if (!s || !s.id) return;
    const raw = String(s.id);
    if (raw.startsWith("task:")) {
      setRead(null);
      setBrainHighlightId(raw.slice(5));
      setBrainTabSeed("all");
      goV("tasks");
      return true;
    }
    if (raw.startsWith("note:")) {
      setRead(null);
      setBrainHighlightId(raw.slice(5));
      setBrainTabSeed("notes");
      goV("tasks");
      return true;
    }
    return false;
  };

  const brainProjects = useMemo(() => {
    const s = new Set(["General", "P&C", "Warehouse R21", "CL-RFI Standards"]);
    tasks.forEach((t) => t.project && s.add(t.project));
    privNotes.forEach((n) => n.project && s.add(n.project));
    return [...s].sort();
  }, [tasks, privNotes]);

  const todayIso = localIsoToday();
  const todayPendingTasksCount = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate <= todayIso).length,
    [tasks, todayIso]
  );
  const openTasksCount = useMemo(
    () => tasks.filter((t) => t.status !== "done").length,
    [tasks]
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
      personalTasks: isGuest ? [] : tasks,
      personalNotes: isGuest ? [] : privNotes,
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
  const unread = notes.filter((n) => n.un).length;
  const pendingApprovalCount = res.filter((r) => {
    if (r.status !== "Review") return false;
    const cat = byId(r.node, tree);
    return can.status(role, cat, userName);
  }).length;
  const isGovCapable = can.admin(role);

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
      : kbDisplay === "grid" || kbDisplay === "graph"
      ? kbDisplay
      : "space";
  const isSpaceDockActive = Boolean(isSpaceView && !rr);
  const pageTitle =
    view === "kb" || view === "home" || view === "space"
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
      ? "Tasks & Brain"
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

  const addCol = (c) => setCols((prev) => [c, ...prev]);
  const saveCol = (c) => setCols((prev) => prev.map((x) => (x.id === c.id ? c : x)));
  const delCol = (id) => setCols((prev) => prev.filter((x) => x.id !== id));

  // Deactivate User + Transfer Ownership
  const handleDeactivateUser = (uid, oldName, targetName) => {
    setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, status: "deactivated" } : u)));
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
    logAct("Deactivated User & Transferred Ownership", "user", uid, oldName, `Items reassigned → ${targetName}`);
    flash(`Deactivated ${oldName}; ownership transferred to ${targetName}`);
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
      : view === "naming" || view === "team" || view === "admin" || view === "tasks"
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
      setKbDisplay("space");
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
        <button type="button" className=${"ti" + (view === "tasks" ? " on" : "")} style=${{ paddingLeft: 10 }} onClick=${() => handleNavSwitch("tasks")}>
          <span className="side-ico"><${Ic} n="check" s=${15} /></span>
          <span className="tn">Tasks & Notes</span>
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
          recentSearches=${recentSearches}
          onLogSearch=${logSearch}
          onOpenNamingStudio=${openNamingFromChat}
          act=${pa}
        />

        <div className="bar-r">
          ${!rr &&
          can.createDraft(role) &&
          html`<button
            className="btn p cr"
            title="Create Document or Resource"
            onClick=${() => createNewDoc()}
          >
            <${Ic} n="plus" s=${16} /><span>Create</span>
          </button>

          <button className="ib" title="Import article from .docx" aria-label="Import from .docx" onClick=${() => dxr.current && dxr.current.click()}>
            ${html`<${Ic} n="doc" s=${18} />`}
          </button>`}
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
        onAddTaskForDoc=${!isGuest ? (doc) => setQcModal({ mode: "task", doc }) : null}
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
          onReadDoc=${rd}
          onToast=${setToast}
        />`}

        ${view === "tasks" &&
        !isGuest &&
        html`<${SecondBrainView}
          tasks=${tasks}
          notes=${privNotes}
          docs=${visibleRes}
          ownerName=${userName}
          syncState=${brainSyncState}
          canPromote=${can.createDraft(role)}
          initialTab=${brainTabSeed}
          highlightId=${brainHighlightId}
          onSaveTask=${saveTask}
          onDeleteTask=${deleteTask}
          onSaveNote=${savePrivNote}
          onDeleteNote=${deletePrivNote}
          onOpenSheet=${(payload) => setQcModal(payload)}
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
          setUsers=${setUsers}
          teams=${teams}
          setTeams=${setTeams}
          res=${visibleRes}
          tree=${tree}
          role=${role}
          userName=${userName}
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
          setUsers=${setUsers}
          cols=${cols}
          activities=${activities}
          searchLogs=${searchLogs}
          acks=${acks}
          req=${req}
          role=${role}
          userName=${userName}
          flaggedIds=${flaggedIds}
          onRead=${rd}
          onApprove=${(id) => act.onStatus(id, "Approved")}
          onReject=${(id) => act.onStatus(id, "Draft")}
          onVerify=${act.onVerify}
          onRevokePublic=${(kind, id) => {
            if (kind === "item") act.onChangeVis(id, "Internal");
            else setCols((prev) => prev.map((c) => (c.id === id ? { ...c, vis: "Internal" } : c)));
            flash("Public access revoked");
          }}
          onOpenPublic=${(t) => setPubTarget(t)}
          onRenameTag=${(oldT, nextT) => {
            if (!nextT || oldT === nextT) return;
            setRes((prev) =>
              prev.map((r) =>
                r.tags.includes(oldT)
                  ? { ...r, tags: [...new Set(r.tags.map((x) => (x === oldT ? nextT : x)))] }
                  : r
              )
            );
            flash(`Merged #${oldT} → #${nextT}`);
          }}
          onDeleteTag=${(t) => {
            setRes((prev) => prev.map((r) => ({ ...r, tags: r.tags.filter((x) => x !== t) })));
            flash(`Removed #${t}`);
          }}
          onDeactivateUser=${handleDeactivateUser}
          onCreateForTopic=${(topic) => createNewDoc({ title: topic })}
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
          <button className="mn" style=${{ padding: 8, fontSize: 13 }} onClick=${() => setNotes((n) => n.map((x) => ({ ...x, un: 0 })))}>Mark all as read</button>
        </div>
        ${notes.length
          ? notes.map(
              (n) => html`<button
                key=${n.id}
                className=${"nt" + (n.un ? " un" : "")}
                onClick=${() => {
                  setNotes((a) => a.map((x) => (x.id === n.id ? { ...x, un: 0 } : x)));
                  pick(n.rid);
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
      initialNote=${qcModal.note || null}
      initialProject=${qcModal.project || ""}
      projects=${brainProjects}
      docs=${visibleRes}
      onClose=${() => setQcModal(null)}
      onSaveTask=${async (taskObj) => {
        await saveTask(taskObj);
        flash(taskObj.id ? `Updated “${taskObj.title}”` : `Task saved · ${taskObj.project || "General"}`);
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
    />`}
    ${toast && html`<div className="toast" role="status">${toast}</div>`}
  </div>`;
}
