'use client';

import { html, useState, useMemo, useEffect, useRef } from './lib/react.js';
import { TODAY, KB, ST, TY, STG, DISC, DC, ROLES, can, normRole, isDocType, isResType } from './config/constants.js';
import { TREE, buildFlat, sub, byId } from './data/spaces.js';
import { IMG0, GUIDE, SEED, NOTES, USERS, SEED_TEAMS, SEED_COLLECTIONS, SEED_ACTIVITIES } from './data/seed.js';
import { db } from './lib/db.js';
import { edgeClient } from './lib/edgeClient.js';
import {
  loadStoredSession,
  saveStoredSession,
  consumeSupabaseOAuthHash,
  signOutAuth,
  makeGooglePhotoFallback,
} from './lib/auth.js';
import { fmt, pl } from './utils/format.js';
import { hay } from './utils/search.js';
import { docxImport } from './utils/docx.js';
import { Ic, DatumMark } from './components/Icon.js';
import { Pill, VisPill } from './components/Badge.js';
import { Select, UserSwitcher } from './components/Select.js';
import { Node } from './components/SpaceTree.js';
import { Pal } from './components/CommandPalette.js';
import { Drawer } from './components/ResourceDrawer.js';
import { AI } from './components/AiDrawer.js';
import { PublicPreviewModal } from './components/PublicPreviewModal.js';
import { LoginView } from './components/LoginView.js';
import { CategoryModal } from './components/CategoryModal.js';
import { Home } from './features/home/Home.js';
import { Reader } from './features/reader/Reader.js';
import { Editor } from './features/editor/Editor.js';
import { Graph } from './features/graph/GraphView.js';
import { fromLib } from './features/boards/boardUtils.js';
import { BoardEd } from './features/boards/BoardEditor.js';
import { CollectionsView } from './features/collections/CollectionsView.js';
import { AdminView } from './features/admin/AdminView.js';
import { TeamView } from './features/team/TeamView.js';

const DATASET_VER = "c10-interior-v2";
const RESET_KEYS_ON_CUTOVER = [
  "kb2-res", "kb2-tree", "kb2-cols", "kb2-acts", "kb2-notes",
  "kb2-pins", "kb2-fav", "kb2-watch", "kb2-req", "kb2-ack",
  "kb2-hist", "kb2-chk", "kb2-img", "kb2-users", "kb2-teams",
];

function ensureDatasetVersion() {
  if (typeof window === "undefined") return;
  try {
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
    return a.some((x) => x.id === 100) ? a : [GUIDE, ...a];
  });
  const [tree, setTree] = useState(() => db.load("kb2-tree", null) || TREE);
  const [users, setUsers] = useState(() => {
    const saved = db.load("kb2-users", null);
    if (!saved || !Array.isArray(saved)) return USERS;
    return saved.map((u) => {
      if (u && u.id === "local-dev-superadmin") {
        return { ...u, id: "local-dev-member", role: "Member", title: "Team Member" };
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
  const [watch, setWatch] = useState(() => db.load("kb2-watch", null) || [113, 129, 131]);
  const [notes, setNotes] = useState(() => db.load("kb2-notes", null) || NOTES);

  const [view, setView] = useState("home");
  const [cur, setCur] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(["int", "c10-ovw", "c10-doc", "c10-mod", "c10-crd", "c10-drw"]);
  const [q, setQ] = useState("");
  const [f, setF] = useState({});
  const [sel, setSel] = useState(null);
  const [ai, setAi] = useState(false);
  const [bell, setBell] = useState(false);
  const [nav, setNav] = useState(false);
  const [sbCol, setSbCol] = useState(() => db.load("kb2-sb-col", false));

  const [bid, setBid] = useState(null);
  const [retB, setRetB] = useState(null);
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
  const [edt, setEdt] = useState(null);
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
  useEffect(() => { db.save("kb2-cols", cols); }, [cols]);
  useEffect(() => { db.save("kb2-shares", shares); }, [shares]);
  useEffect(() => { db.save("kb2-acts", activities); }, [activities]);
  useEffect(() => { db.save("kb2-slogs", searchLogs); }, [searchLogs]);
  useEffect(() => { db.save("kb2-flags", flaggedIds); }, [flaggedIds]);
  useEffect(() => { db.save("kb2-pins", pinned); }, [pinned]);
  useEffect(() => { db.save("kb2-fav", favs); }, [favs]);
  useEffect(() => { db.save("kb2-watch", watch); }, [watch]);
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
  useEffect(() => { db.save("kb2-sb-col", sbCol); }, [sbCol]);

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
          role: normRole(sessionClaims.role) === "Guest" ? "Guest" : "Member",
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
    const roleVal = normRole(sessionClaims.role) === "Guest" ? "Guest" : "Member";
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
        setSbCol((v) => !v);
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

  const rd = (id) => {
    setRetB(null);
    setRead(id);
    setSel(null);
    setAi(false);
    setBell(false);
    window.scrollTo({ top: 0 });
  };

  const saveItem = (d) => {
    if (res.find((x) => x.id === d.id)) {
      upd(d.id, (r) => ({
        ...r,
        ...d,
        upd: TODAY,
        verified: d.status === "Approved" ? TODAY : r.verified,
        v: d.body !== r.body ? [...r.v, { n: r.v.length + 1, by: userName, d: TODAY, note: "Edit", body: d.body }] : r.v,
      }));
      push(`Saved “${d.title}”`, d.id);
      logAct("Updated", "item", d.id, d.title);
      setEdt(null);
    } else {
      const id = Date.now();
      db.invalidateArticle(id);
      edgeClient.clearAiCache();
      setRes((rs) => [
        {
          links: [],
          c: [],
          publicAttachments: [],
          ...d,
          id,
          author: userName,
          upd: TODAY,
          verified: TODAY,
          v: [{ n: 1, by: userName, d: TODAY, note: "Created", body: d.body }],
        },
        ...rs,
      ]);
      push(`Created “${d.title}”`, id);
      logAct("Created", "item", id, d.title, d.status);
      setEdt(null);
      rd(id);
    }
  };

  const delItem = (id) => {
    const t = titleOf(id);
    db.invalidateArticle(id);
    edgeClient.clearAiCache();
    setRes((rs) => rs.filter((x) => x.id !== id).map((x) => ({ ...x, links: x.links.filter((l) => l[0] !== id) })));
    setFavs((a) => a.filter((x) => x !== id));
    setWatch((a) => a.filter((x) => x !== id));
    setPinned((a) => a.filter((x) => x !== id));
    setEdt(null);
    setRead(null);
    flash("Item deleted");
    logAct("Deleted", "item", id, t);
  };

  const goHome = (focusAi) => {
    setRead(null);
    setView("home");
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
    setCur(id);
    setCatFilter("all");
    setView("lib");
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

  const pa = (k, a) => {
    setPal(false);
    if (k === "read") rd(a);
    else if (k === "new") can.createDraft(role) && setEdt({});
    else if (k === "home") goHome();
    else if (k === "view") goV(a);
    else if (k === "go") go(a);
    else if (k === "theme") theme();
    else if (k === "ask") {
      goHome();
      setAq({ q: a, n: Date.now() });
    } else if (k === "all") {
      setQ(a);
      setRead(null);
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

  const tags = useMemo(() => [...new Set(visibleRes.flatMap((r) => r.tags))].sort(), [visibleRes]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const isCategoryScope = view === "lib" && !["all", "fav", "watch", "drafts", "recent"].includes(cur);
    const catNode = isCategoryScope ? flatCats.find((c) => c.id === cur) : null;
    const ids = catNode ? sub(catNode) : null;

    return visibleRes.filter((r) => {
      if ((view === "kb" || isCategoryScope) && catFilter === "docs" && !isDocType(r.type)) return false;
      if ((view === "kb" || isCategoryScope) && catFilter === "res" && !isResType(r.type)) return false;
      if (view === "lib") {
        if (cur === "fav" && !favs.includes(r.id)) return false;
        if (cur === "watch" && !watch.includes(r.id)) return false;
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
  }, [visibleRes, q, view, cur, catFilter, f, favs, watch, hist, userName, flatCats]);

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
    if (edt && !can.createDraft(role)) setEdt(null);
    if (view === "admin" && !isGovCapable) setView("home");
    if (view === "lib" && cur === "drafts" && !can.createDraft(role)) setCur("all");
  }, [role, edt, view, cur, isGovCapable]);

  const pick = (id) => {
    setSel(id);
    setAi(false);
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

  const curCat = view === "lib" && !["all", "fav", "watch", "drafts", "recent"].includes(cur) ? byId(cur, tree) : null;
  const pageTitle =
    view === "kb"
      ? "Knowledge Base"
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
        : cur === "watch"
        ? "Watching"
        : cur === "drafts"
        ? "My Drafts"
        : cur === "recent"
        ? "Recently Viewed"
        : (curCat && curCat.name) || "Category"
      : "Dashboard";

  const SelF = ({ k, ph, opts }) =>
    html`<${Select}
      variant="filter"
      placeholder=${ph}
      ariaLabel=${ph}
      value=${f[k] || ""}
      options=${[["", `All (${ph})`], ...opts]}
      onChange=${(v) => setF({ ...f, [k]: v || undefined })}
      minMenuWidth=${190}
    />`;

  const hasF = Object.values(f).some(Boolean) || catFilter !== "all";
  const showFeat = (view === "kb" || view === "reslib" || (view === "lib" && cur === "all")) && !q.trim() && !hasF && !isGuest;
  const rec = [...visibleRes].filter((r) => r.status === "Approved").sort((a, b) => b.upd.localeCompare(a.upd)).slice(0, 3);
  const shown = [...list].sort(sort === "az" ? (a, b) => a.title.localeCompare(b.title, "en") : (a, b) => b.upd.localeCompare(a.upd));

  const addCol = (c) => setCols((prev) => [c, ...prev]);
  const saveCol = (c) => setCols((prev) => prev.map((x) => (x.id === c.id ? c : x)));
  const delCol = (id) => setCols((prev) => prev.filter((x) => x.id !== id));
  const fromBoard = (id) => {
    const cur0 = bid;
    setBid(null);
    rd(id);
    setRetB(cur0);
  };

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
    setEdt(null);
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
    setEdt(null);
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
    return html`<${LoginView} users=${users} onSignedIn=${handleSignedIn} />`;
  }

  return html`<div className=${"app" + (sbCol ? " sb-col" : "")}>
    ${nav && html`<div className="ov" style=${{ zIndex: 57 }} onClick=${() => setNav(false)}></div>`}

    <aside className=${"side" + (nav ? " open" : "")}>
      <div className="logo">
        <div className="logo-b" onClick=${() => sbCol && setSbCol(false)} title=${sbCol ? "Expand sidebar" : "Datum"}>
          <${DatumMark} s=${26} />
          <span>Datum</span>
        </div>
        <button
          type="button"
          className="sb-tgl"
          title=${(sbCol ? "Expand" : "Collapse") + " sidebar (Ctrl+\\)"}
          aria-label=${sbCol ? "Expand sidebar" : "Collapse sidebar"}
          onClick=${() => setSbCol((v) => !v)}
        >
          <${Ic} n="sidebar" s=${16} />
        </button>
      </div>

      ${!isGuest &&
      html`<button className=${"ti" + (view === "home" ? " on" : "")} style=${{ paddingLeft: 10 }} title="Dashboard" onClick=${() => goV("home")}>
        <span className="tile" style=${{ "--c": "#0a84ff" }}><${Ic} n="home" s=${14} /></span>
        <span className="tn">Dashboard</span>
        ${req.filter((id) => !acks[id]).length > 0 &&
        html`<span className="ct" style=${{ color: "#ff3b30", fontWeight: 600 }}>${req.filter((id) => !acks[id]).length}</span>`}
      </button>`}

      <button className=${"ti" + (view === "kb" ? " on" : "")} style=${{ paddingLeft: 10 }} title="Knowledge Base" onClick=${() => { setCatFilter("all"); goV("kb"); }}>
        <span className="tile" style=${{ "--c": "#5e5ce6" }}><${Ic} n="doc" s=${14} /></span>
        <span className="tn">Knowledge Base</span>
        <span className="ct">${visibleRes.length}</span>
      </button>

      <button className=${"ti" + (view === "boards" ? " on" : "")} style=${{ paddingLeft: 10 }} title="Collections & Boards" onClick=${() => goV("boards")}>
        <span className="tile" style=${{ "--c": "#a2845e" }}><${Ic} n="boards" s=${14} /></span>
        <span className="tn">Collections & Boards</span>
        <span className="ct">${cols.filter((c) => (role === "SuperAdmin" || role === "Admin" ? true : role === "Guest" ? c.vis === "Public" : c.tier === "personal" ? c.owner === userName : c.vis === "Restricted" ? c.owner === userName || (c.coEditors || []).includes(userName) : true)).length}</span>
      </button>

      ${!isGuest &&
      html`<button className=${"ti" + (view === "graph" ? " on" : "")} style=${{ paddingLeft: 10 }} title="Dependency Graph" onClick=${() => goV("graph")}>
        <span className="tile" style=${{ "--c": "#34c759" }}><${Ic} n="graph" s=${14} /></span>
        <span className="tn">Dependency Graph</span>
      </button>`}

      ${!isGuest &&
      html`<button className=${"ti" + (view === "team" ? " on" : "")} style=${{ paddingLeft: 10 }} title="People & Teams" onClick=${() => goV("team")}>
        <span className="tile" style=${{ "--c": "#ff9f0a" }}><${Ic} n="teams" s=${14} /></span>
        <span className="tn">People & Teams</span>
        <span className="ct">${users.filter((u) => u.status === "active").length}</span>
      </button>`}

      ${!isGuest &&
      html`<div>
        <div className="sec-row">
          <div className="sec" style=${{ margin: 0, padding: "18px 8px 6px 10px" }}>Categories</div>
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
        <div className="sec">Personal Workspace</div>
        <button className=${"ti" + (view === "lib" && cur === "fav" ? " on" : "")} style=${{ paddingLeft: 10 }} title="Bookmarks" onClick=${() => go("fav")}>
          <span className="tile" style=${{ "--c": "#ff9f0a" }}><${Ic} n="star" s=${14} f=${true} /></span>
          <span className="tn">Bookmarks</span>
          <span className="ct">${favs.length}</span>
        </button>
        <button className=${"ti" + (view === "lib" && cur === "watch" ? " on" : "")} style=${{ paddingLeft: 10 }} title="Watching" onClick=${() => go("watch")}>
          <span className="tile" style=${{ "--c": "#bf5af2" }}><${Ic} n="eye" s=${14} /></span>
          <span className="tn">Watching</span>
          <span className="ct">${watch.length}</span>
        </button>
        ${can.createDraft(role) &&
        html`<button className=${"ti" + (view === "lib" && cur === "drafts" ? " on" : "")} style=${{ paddingLeft: 10 }} title="My Drafts" onClick=${() => go("drafts")}>
          <span className="tile" style=${{ "--c": "#8e8e93" }}><${Ic} n="pencil" s=${14} /></span>
          <span className="tn">My Drafts</span>
          <span className="ct">${visibleRes.filter((r) => r.author === userName && r.status !== "Approved").length}</span>
        </button>`}
        <button className=${"ti" + (view === "lib" && cur === "recent" ? " on" : "")} style=${{ paddingLeft: 10 }} title="Recently Viewed" onClick=${() => go("recent")}>
          <span className="tile" style=${{ "--c": "#64d2ff" }}><${Ic} n="clock" s=${14} /></span>
          <span className="tn">Recently Viewed</span>
          <span className="ct">${hist.length}</span>
        </button>
      </div>`}

      ${isGovCapable &&
      html`<div>
        <div className="sec">Governance</div>
        <button className=${"ti" + (view === "admin" ? " on" : "")} style=${{ paddingLeft: 10 }} title="Administration" onClick=${() => goV("admin")}>
          <span className="tile" style=${{ "--c": "#ff6482" }}><${Ic} n="shield" s=${14} /></span>
          <span className="tn">Administration</span>
          ${pendingApprovalCount > 0 && html`<span className="ct" style=${{ color: "#ff9f0a", fontWeight: 600 }}>${pendingApprovalCount}</span>`}
        </button>
      </div>`}

      <${UserSwitcher}
        users=${users}
        activeUserId=${activeUser.id}
        activeUser=${activeUser}
        authClaims=${sessionClaims}
        onLogout=${handleLogout}
      />
    </aside>

    <div className="main">
      <div className=${"bar" + (sc ? " sc" : "") + (pal ? " pal-open" : "")}>
        <div className="bar-l">
          <button className="ib menu" aria-label="Menu" onClick=${() => setNav(true)}>${html`<${Ic} n="menu" s=${18} />`}</button>
          <nav className="bar-crumb" aria-label="Breadcrumb">
            <button
              type="button"
              className="bar-crumb-btn"
              onClick=${() => {
                if (edt) setEdt(null);
                else if (rr) setRead(null);
                else goHome();
              }}
            >
              Datum
            </button>
            ${edt
              ? html`<span className="bar-crumb-sep">/</span>
                  <button type="button" className="bar-crumb-btn" onClick=${() => setEdt(null)}>
                    ${edt.id ? "Edit Document" : "New Draft"}
                  </button>
                  <span className="bar-crumb-sep">/</span>
                  <span className="bar-crumb-cur">${edt.title || "Untitled"}</span>`
              : rr
              ? html`<span className="bar-crumb-sep">/</span>
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
                  <span className="bar-crumb-cur">${rr.title}</span>`
              : curCat && curCat.path && curCat.path.length > 1
              ? html`<span className="bar-crumb-sep">/</span>
                  <span className="bar-crumb-btn" style=${{ pointerEvents: "none" }}>${curCat.path[0]}</span>
                  <span className="bar-crumb-sep">/</span>
                  <span className="bar-crumb-cur">${pageTitle}</span>`
              : html`<span className="bar-crumb-sep">/</span>
                  <span className="bar-crumb-cur">${pageTitle}</span>`}
          </nav>
        </div>

        <${Pal}
          open=${pal}
          onOpen=${() => setPal(true)}
          close=${() => setPal(false)}
          catalogQ=${q}
          onClearCatalogQ=${() => setQ("")}
          kb=${KB}
          res=${visibleRes}
          tree=${tree}
          role=${role}
          recentSearches=${recentSearches}
          onLogSearch=${logSearch}
          act=${pa}
        />

        <div className="bar-r">
          ${can.createDraft(role) &&
          html`<button
            className="btn p cr"
            title="Create Document or Resource"
            onClick=${() => setEdt({})}
          >
            <${Ic} n="plus" s=${16} /><span>Create</span>
          </button>

          <input
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
                setEdt({ title: r.title, desc: r.desc, body: r.body, k: Date.now() });
                flash("Document imported — review and save");
                db.uploadImagesMap(r.imgs).then((uploaded) => {
                  if (uploaded && Object.keys(uploaded).length) {
                    setImgs((o) => ({ ...o, ...uploaded }));
                  }
                });
              } catch (x) {
                flash("Could not read the .docx");
              }
            }}
          />
          <button className="ib" title="Import article from .docx" aria-label="Import from .docx" onClick=${() => dxr.current.click()}>
            ${html`<${Ic} n="doc" s=${18} />`}
          </button>`}
          ${!isGuest &&
          html`<button className="ib" title="Edge AI assistant" aria-label="AI assistant" onClick=${() => setAi(true)}>
            ${html`<${Ic} n="spark" s=${18} />`}
          </button>`}
          ${!isGuest &&
          html`<button className="ib" title="Notifications" aria-label="Notifications" onClick=${() => setBell(!bell)}>
            ${html`<${Ic} n="bell" s=${18} />`}${unread > 0 && html`<span className="dot">${unread}</span>`}
          </button>`}
        </div>
      </div>

      ${edt &&
      can.createDraft(role) &&
      html`<${Editor}
        key=${edt.id || "new" + (edt.k || "")}
        init=${edt}
        res=${res}
        tree=${tree}
        imgs=${imgs}
        setImgs=${setImgs}
        role=${role}
        userName=${userName}
        cur=${cur}
        save=${saveItem}
        del=${delItem}
        close=${() => setEdt(null)}
      />`}

      ${rr &&
      !edt &&
      html`<${Reader}
        r=${rr}
        res=${visibleRes}
        tree=${tree}
        imgs=${imgs}
        role=${role}
        userName=${userName}
        fav=${favs.includes(rr.id)}
        watch=${watch.includes(rr.id)}
        pinned=${pinned.includes(rr.id)}
        tf=${(id) => tgl(setFavs, id)}
        tw=${(id) => tgl(setWatch, id)}
        onTogglePin=${(id) => tgl(setPinned, id)}
        back=${() => {
          setRead(null);
          if (retB) {
            setBid(retB);
            setRetB(null);
          }
        }}
        go=${rd}
        info=${pick}
        edit=${() => setEdt(rr)}
        rec=${recRead}
        chk=${chk}
        togChk=${togChk}
        ack=${ack}
        acks=${acks}
        req=${req}
        togReq=${togReq}
        onVerify=${act.onVerify}
        onFlagOutdated=${(id) => {
          if (!flaggedIds.includes(id)) setFlaggedIds((fl) => [...fl, id]);
          flash("Flagged for Category Owner review");
          logAct("Flagged Outdated", "item", id, titleOf(id));
        }}
        onOpenPublic=${(t) => setPubTarget(t)}
      />`}

      <div className=${"pad" + (view === "home" ? " ph" : "") + (view === "graph" ? " pgx" : "")} hidden=${!!rr || !!edt}>
        ${view === "home" &&
        html`<${Home}
          res=${visibleRes}
          tree=${tree}
          role=${role}
          userName=${userName}
          req=${req}
          acks=${acks}
          hist=${hist}
          seen=${seen}
          pinned=${pinned}
          aq=${aq}
          focus=${hf}
          read=${rd}
          flash=${flash}
          markSeen=${() => setSeen(TODAY)}
        />`}

        ${(view === "lib" || view === "kb" || view === "reslib") &&
        html`<div>
          <div className="pdl-top">
            <div className="pdl-top-l">
              <h1>${pageTitle}</h1>
              <span className="pdl-cnt">${list.length}</span>
            </div>
            <div className="pdl-top-r">
              ${(view === "kb" || curCat) &&
              html`<div className="seg">
                ${[
                  ["all", "All"],
                  ["docs", "Docs"],
                  ["res", "Resources"],
                ].map(([k, lb]) => html`<button key=${k} className=${catFilter === k ? "on" : ""} onClick=${() => setCatFilter(k)}>${lb}</button>`)}
              </div>`}
              ${can.createDraft(role) &&
              html`<${SelF} k="status" ph="Status" opts=${Object.entries(ST).map(([k, v]) => [k, v[0]])} />`}
              <${SelF} k="type" ph="Type" opts=${Object.entries(TY)} />
              <${SelF} k="tag" ph="Tag" opts=${tags.map((x) => [x, "#" + x])} />
              <${Select}
                variant="pill"
                ariaLabel="Sorting"
                placeholder="Sort"
                displayLabel=${sort === "az" ? "A–Z" : "Newest"}
                value=${sort}
                options=${[
                  ["new", "Newest first"],
                  ["az", "By title (A–Z)"],
                ]}
                onChange=${setSort}
                minMenuWidth=${175}
              />
              ${hasF && html`<button className="clr" onClick=${() => { setF({}); setCatFilter("all"); }}>Reset</button>`}
            </div>
          </div>

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
                            className=${watch.includes(r.id) ? "on" : ""}
                            aria-label="Watch"
                            onClick=${(e) => {
                              e.stopPropagation();
                              tgl(setWatch, r.id);
                            }}
                          >
                            ${html`<${Ic} n="eye" s=${16} />`}
                          </button>
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

        ${view === "boards" &&
        html`<${CollectionsView}
          cols=${cols}
          res=${visibleRes}
          role=${role}
          userName=${userName}
          onOpenBoard=${setBid}
          onAddCol=${addCol}
          onSaveCol=${saveCol}
          onDelCol=${delCol}
          onRead=${rd}
          onOpenPublic=${(t) => setPubTarget(t)}
          onBuildLibBoard=${() => {
            const b = fromLib(visibleRes);
            const col = { ...b, tier: "shared", mode: "board", owner: userName, vis: "Internal", desc: "Generated from dependency links." };
            addCol(col);
            setBid(col.id);
          }}
        />`}

        ${view === "graph" && html`<div className="gxw"><${Graph} res=${visibleRes} selId=${sel} pick=${pick} /></div>`}

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
          onCreateForTopic=${(topic) => setEdt({ title: topic, k: Date.now() })}
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
      watch=${watch.includes(sr.id)}
      tf=${(id) => tgl(setFavs, id)}
      tw=${(id) => tgl(setWatch, id)}
      close=${() => setSel(null)}
      pick=${pick}
      read=${rd}
      edit=${(id) => {
        setSel(null);
        setEdt(res.find((x) => x.id === id));
      }}
      onOpenPublic=${(t) => setPubTarget(t)}
      ...${act}
    />`}

    ${bid &&
    cols.find((b) => b.id === bid) &&
    html`<${BoardEd}
      key=${bid}
      b=${cols.find((b) => b.id === bid)}
      res=${visibleRes}
      tree=${tree}
      save=${saveCol}
      close=${() => setBid(null)}
      openRes=${fromBoard}
      flash=${flash}
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

    ${toast && html`<div className="toast" role="status">${toast}</div>`}
    ${ai && html`<${AI} res=${visibleRes} tree=${tree} role=${role} userName=${userName} close=${() => setAi(false)} pick=${pick} />`}
  </div>`;
}
