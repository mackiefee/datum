import { html, useState, useEffect, useLayoutEffect, useRef, useMemo } from '../lib/react.js';
import { DC, TODAY, CITE, can } from '../config/constants.js';
import { byId, buildFlat } from '../data/spaces.js';
import { hay, scoreDocument, tokenizeUnique } from '../utils/search.js';
import { plain } from '../utils/markdown.js';
import { edgeClient } from '../lib/edgeClient.js';
import { Ic } from './Icon.js';

const PAL_PROMPTS = [
  { label: 'Model naming', query: 'How should model files be named?' },
  { label: 'Clash detection', query: 'When is clash detection run?' },
  { label: 'BEP template', query: 'What is the BEP template?' },
];

export function Pal(p) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [aiAns, setAiAns] = useState(null);
  const ref = useRef(null);
  const rootRef = useRef(null);
  const morphRef = useRef(null);
  const headRef = useRef(null);
  const animRef = useRef(null);
  const wasDockedRef = useRef(Boolean(p.isSpaceDockActive));
  const s = q.trim().toLowerCase();

  const flatCats = useMemo(() => buildFlat(p.tree || []), [p.tree]);
  const allowedCats = useMemo(
    () => flatCats.filter((c) => can.viewCat(c, p.role, p.userName)).map((c) => c.id),
    [flatCats, p.role, p.userName]
  );

  const recordTopbarRect = () => {
    if (!p.omniRectRef || p.isSpaceDockActive) return;
    const targetEl = (!p.open && rootRef.current) || headRef.current;
    if (!targetEl) return;
    const r = targetEl.getBoundingClientRect();
    if (r.width > 10 && r.height > 10) {
      p.omniRectRef.current = {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        w: r.width,
        h: r.height,
        mode: 'topbar',
      };
    }
  };

  useEffect(() => {
    if (p.isSpaceDockActive) return undefined;
    recordTopbarRect();
    const ro = typeof ResizeObserver !== 'undefined' && rootRef.current ? new ResizeObserver(recordTopbarRect) : null;
    if (ro && rootRef.current) ro.observe(rootRef.current);
    window.addEventListener('resize', recordTopbarRect, { passive: true });
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', recordTopbarRect);
    };
  }, [p.isSpaceDockActive, p.open]);

  // FLIP flight from Bottom Spatial Dock -> Topbar Center Pill when leaving 3D Space
  useLayoutEffect(() => {
    const isDocked = Boolean(p.isSpaceDockActive);
    const wasDocked = wasDockedRef.current;
    wasDockedRef.current = isDocked;
    if (isDocked || !wasDocked || !morphRef.current) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      recordTopbarRect();
      return;
    }

    const prev =
      p.omniRectRef && p.omniRectRef.current && p.omniRectRef.current.mode === 'space'
        ? p.omniRectRef.current
        : {
            x: window.innerWidth / 2,
            y: window.innerHeight - 76,
            w: Math.min(860, window.innerWidth - 96),
            h: 48,
          };

    const t = morphRef.current.getBoundingClientRect();
    if (t.width > 0 && t.height > 0 && morphRef.current.animate) {
      const dx = prev.x - (t.left + t.width / 2);
      const dy = prev.y - (t.top + t.height / 2);
      const sx = Math.min(2.4, Math.max(1, prev.w / t.width));
      const sy = Math.min(1.5, Math.max(1, prev.h / t.height));

      if (animRef.current) animRef.current.cancel();
      const anim = morphRef.current.animate(
        [
          {
            transform: `translateX(-50%) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.65), 0 0 32px rgba(99, 102, 241, 0.45)',
          },
          {
            transform: 'translateX(-50%) translate3d(0, -2px, 0) scale(0.985, 0.98)',
            offset: 0.8,
          },
          {
            transform: 'translateX(-50%) translate3d(0, 0, 0) scale(1, 1)',
          },
        ],
        {
          duration: 480,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }
      );
      animRef.current = anim;
      anim.onfinish = () => {
        animRef.current = null;
        recordTopbarRect();
      };
    } else {
      recordTopbarRect();
    }
  }, [p.isSpaceDockActive]);

  const isGuest = p.role === "Guest";

  const runInlineAi = async (question) => {
    const t = String(question || '').trim();
    if (!t) return;
    if (!p.open && p.onOpen) p.onOpen();
    setAiAns({ q: t, src: [], text: '', busy: true });
    const out = await edgeClient.ai({
      action: 'qa',
      query: t,
      userRole: p.role,
      userName: p.userName,
      allowedCategories: allowedCats,
      items: p.res || [],
      personalTasks: p.privTasks || [],
      personalNotes: p.privNotes || [],
      personalResources: p.privResources || [],
      today: TODAY,
    });
    setAiAns({
      q: t,
      src: out.sources || [],
      text: out.answer || '',
      actions: out.actions || null,
      busy: false,
    });
  };

  const A = [
    ...(can.createDraft(p.role) ? [["Create article or resource", "plus", "new"]] : []),
    ...(!isGuest
      ? [
          ["My Tasks & Second Brain", "check", "tasks"],
          ["Morning Focus Dashboard", "spark", "focus"],
          ["New Personal Task (Alt+N)", "plus", "quick-task"],
          ["New Private Note", "note", "quick-note"],
          ["Save Personal Resource", "link", "quick-resource"],
        ]
      : []),
    ["Knowledge Space (3D)", "globe", "kb-space"],
    ["Team Resources & Catalog", "folder", "team-resources"],
    ["Naming Studio (Wall & Element Builder)", "layers", "view", "naming"],
    ["Knowledge Base (Grid)", "layout", "view", "kb"],
    ["Playbooks & Kits", "folder", "kits"],
    ["Dependency Graph", "graph", "kb-graph"],
    ...(can.admin(p.role) ? [["Administration & Governance", "shield", "view", "admin"]] : []),
    ["Change theme", "spark", "theme"],
  ];

  const arts = (
    s
      ? (() => {
          const tokens = tokenizeUnique(s);
          return (p.res || [])
            .map((r) => ({ r, ...scoreDocument(r, s, tokens) }))
            .filter((x) => x.score > 0 || hay(x.r).includes(s))
            .sort((a, b) => b.matched - a.matched || b.score - a.score)
            .map((x) => x.r);
        })()
      : [...(p.res || [])].sort((a, b) => (b.upd || '').localeCompare(a.upd || ''))
  ).slice(0, 6);

  const brainMatches = (() => {
    if (isGuest || !s) return [];
    const out = [];
    const tokens = tokenizeUnique(s);
    const matchesText = (txt) => {
      const low = String(txt || "").toLowerCase();
      if (low.includes(s)) return true;
      return tokens.length > 0 && tokens.every((tk) => low.includes(tk));
    };

    for (const r of p.privResources || []) {
      const hayStr = `${r.title || ""} ${r.url || ""} ${r.notes || ""} ${r.project || ""} ${r.kind || ""}`;
      if (matchesText(hayStr)) {
        out.push({
          t: r.title || "Personal Resource",
          d: `Personal Resource${r.project ? ` · ${r.project}` : r.kind ? ` · ${r.kind}` : ""}`,
          n: "link",
          c: "#30d158",
          run: () => p.act("open-brain-resource", r.id),
        });
      }
    }
    for (const n of p.privNotes || []) {
      const hayStr = `${n.title || ""} ${n.body || ""} ${n.project || ""} ${(n.tags || []).join(" ")}`;
      if (matchesText(hayStr)) {
        out.push({
          t: n.title || "Private Note",
          d: `Private Note${n.project ? ` · ${n.project}` : ""}`,
          n: "note",
          c: "#bf5af2",
          run: () => p.act("open-brain-note", n.id),
        });
      }
    }
    for (const t of p.privTasks || []) {
      const hayStr = `${t.title || ""} ${t.notes || ""} ${t.project || ""} ${t.priority || ""}`;
      if (matchesText(hayStr)) {
        out.push({
          t: t.title || "Personal Task",
          d: `Personal Task${t.project ? ` · ${t.project}` : t.due ? ` · Due ${t.due}` : ""}`,
          n: "check",
          c: t.done ? "#34c759" : "#0a84ff",
          run: () => p.act("open-brain-task", t.id),
        });
      }
    }
    return out.slice(0, 5);
  })();

  const snip = (r) => {
    const cat = byId(r.node, p.tree);
    if (!s) return (cat && cat.path.join(" › ")) || "Library";
    const b = plain(r.body),
      k = b.toLowerCase().indexOf(s);
    return k < 0 ? r.desc : (k > 40 ? "…" : "") + b.slice(Math.max(0, k - 40), k + 90);
  };

  const recentItems =
    !s && p.recentSearches && p.recentSearches.length
      ? p.recentSearches.slice(0, 3).map((term) => ({
          t: `Recent search: “${term}”`,
          d: "Re-run search",
          n: "clock",
          run: () => setQ(term),
        }))
      : [];

  const it = [
    ...recentItems,
    ...arts.map((r) => ({ t: r.title, d: snip(r), n: r.type, c: DC[r.disc], run: () => p.act("read", r.id) })),
    ...brainMatches,
    ...A.filter((a) => !s || a[0].toLowerCase().includes(s)).map((a) => ({
      t: a[0],
      d: "Navigation / Action",
      n: a[1],
      run: () => {
        recordTopbarRect();
        p.act(a[2], a[3]);
      },
    })),
    ...(s
      ? [
          { t: "Ask AI: “" + q.trim() + "”", d: "Permission-filtered inline answer", n: "spark", c: "#bf5af2", run: () => runInlineAi(q.trim()) },
          { t: "All results for “" + q.trim() + "”", d: "Search full catalog", n: "search", run: () => p.act("all", q.trim()) },
        ]
      : []),
  ];

  useEffect(() => {
    if (p.open && !p.isSpaceDockActive) {
      if (p.catalogQ && !q) setQ(p.catalogQ);
      ref.current && ref.current.focus();
    } else {
      ref.current && ref.current.blur();
      if (!p.open) setAiAns(null);
    }
  }, [p.open, p.isSpaceDockActive]);
  useEffect(() => {
    setI(0);
  }, [q]);

  const HL = (t) => {
    const idx = s ? t.toLowerCase().indexOf(s) : -1;
    return idx < 0 ? t : html`${t.slice(0, idx)}<mark>${t.slice(idx, idx + s.length)}</mark>${t.slice(idx + s.length)}`;
  };

  const key = (e) => {
    if (!p.open) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        p.onOpen && p.onOpen();
      }
      return;
    }
    if (e.key === "Enter" && e.shiftKey && q.trim()) {
      e.preventDefault();
      runInlineAi(q.trim());
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setI((x) => Math.min(x + 1, it.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setI((x) => Math.max(x - 1, 0));
    } else if (e.key === "Enter") {
      if (s && p.onLogSearch) p.onLogSearch(q.trim(), arts.length);
      it[i] && it[i].run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (aiAns) setAiAns(null);
      else p.close && p.close();
    }
  };

  const bookmarksCount = Array.isArray(p.favs) ? p.favs.length : 0;
  const kitsCount = Array.isArray(p.cols)
    ? p.cols.filter((c) => c.tier === 'official' || c.tier === 'shared').length
    : 0;
  const isDocked = Boolean(p.isSpaceDockActive);

  return html`<div
    ref=${rootRef}
    className=${"sw" + (p.open ? " open" : "") + (isDocked ? " sw-docked" : "")}
    aria-hidden=${isDocked ? "true" : undefined}
  >
    <div
      className=${"sw-ov" + (p.open ? " on" : "")}
      onClick=${p.close}
      aria-hidden="true"
    ></div>
    <div
      ref=${morphRef}
      className="sw-morph"
      role=${p.open ? "dialog" : "search"}
      aria-expanded=${p.open}
      aria-modal=${p.open ? "true" : undefined}
    >
      <div
        ref=${headRef}
        className="sw-head"
        onClick=${() => {
          if (!isDocked && !p.open && p.onOpen) p.onOpen();
        }}
      >
        <span className=${"sw-ico" + (aiAns ? " ai" : "")}>
          <${Ic} n=${aiAns ? "spark" : "search"} s=${16} />
        </span>
        <input
          ref=${ref}
          tabIndex=${isDocked ? -1 : 0}
          value=${p.open ? q : p.catalogQ || q}
          onFocus=${() => {
            if (!isDocked && !p.open && p.onOpen) p.onOpen();
          }}
          onChange=${(e) => {
            if (isDocked) return;
            if (!p.open && p.onOpen) p.onOpen();
            setQ(e.target.value);
            if (aiAns && e.target.value.trim() !== aiAns.q) setAiAns(null);
          }}
          onKeyDown=${key}
          placeholder=${p.open ? "Search docs, ask Library AI, or run a command…" : "Search or ask AI…"}
          aria-label="Search or ask Library AI"
        />
        ${!p.open && (p.catalogQ || q)
          ? html`<button
              type="button"
              tabIndex=${isDocked ? -1 : 0}
              className="sw-clr"
              onClick=${(e) => {
                e.stopPropagation();
                setQ("");
                p.onClearCatalogQ && p.onClearCatalogQ();
              }}
              title="Clear search"
              aria-label="Clear search"
            >×</button>`
          : p.open && q
          ? html`<button
              type="button"
              tabIndex=${isDocked ? -1 : 0}
              className="sw-clr"
              onClick=${(e) => {
                e.stopPropagation();
                setQ("");
                setAiAns(null);
                ref.current && ref.current.focus();
              }}
              title="Clear query"
              aria-label="Clear query"
            >×</button>`
          : null}
        <button
          type="button"
          tabIndex=${isDocked ? -1 : 0}
          className=${"sw-ask-btn" + (aiAns && aiAns.busy ? " busy" : "")}
          title="Ask Library AI inline (Shift+Enter)"
          onClick=${(e) => {
            e.stopPropagation();
            if (isDocked) return;
            if (!p.open && p.onOpen) p.onOpen();
            const activeQ = (p.open ? q : p.catalogQ || q).trim();
            if (activeQ) runInlineAi(activeQ);
            else ref.current && ref.current.focus();
          }}
        >
          <${Ic} n="spark" s=${11} />
          <span>Ask</span>
        </button>
        ${p.open &&
        html`<kbd
          onClick=${(e) => {
            e.stopPropagation();
            p.close && p.close();
          }}
          style=${{ cursor: "pointer" }}
        >Esc</kbd>`}
      </div>
      <div className="sw-body" aria-hidden=${!p.open}>
        <div className="sw-body-in">
          <div className="sw-chips">
            <button
              type="button"
              tabIndex=${p.open ? 0 : -1}
              className="sw-chip sw-chip-acc"
              onClick=${() => {
                recordTopbarRect();
                p.act("kb-space");
              }}
            >
              <${Ic} n="globe" s=${11} />
              <span>3D Space</span>
            </button>
            <button
              type="button"
              tabIndex=${p.open ? 0 : -1}
              className="sw-chip"
              onClick=${() => {
                recordTopbarRect();
                p.act("go", "fav");
              }}
            >
              <${Ic} n="star" s=${11} f=${true} />
              <span>Bookmarks${bookmarksCount ? ` (${bookmarksCount})` : ""}</span>
            </button>
            <button
              type="button"
              tabIndex=${p.open ? 0 : -1}
              className="sw-chip sw-chip-kit"
              onClick=${() => {
                recordTopbarRect();
                p.act("kits");
              }}
            >
              <${Ic} n="folder" s=${11} />
              <span>Starter Kits${kitsCount ? ` (${kitsCount})` : ""}</span>
            </button>
            ${PAL_PROMPTS.map(
              (prompt) => html`<button
                key=${prompt.label}
                type="button"
                tabIndex=${p.open ? 0 : -1}
                className="sw-chip"
                title=${prompt.query}
                onClick=${() => {
                  setQ(prompt.query);
                  runInlineAi(prompt.query);
                }}
              >
                <${Ic} n="spark" s=${10} />
                <span>${prompt.label}</span>
              </button>`
            )}
          </div>

          ${aiAns &&
          html`<div className="sw-ai-card" role="region" aria-label="Library AI Answer">
            <div className="sw-ai-head">
              <span className="sw-ai-badge"><${Ic} n="spark" s=${11} /> Library AI</span>
              <span className="sw-ai-q">${aiAns.q}</span>
              <button
                type="button"
                className="sw-ai-x"
                aria-label="Close AI answer"
                onClick=${() => setAiAns(null)}
              >×</button>
            </div>
            <div className="sw-ai-body">
              ${aiAns.busy && !aiAns.text
                ? html`<div className="dots"><i></i><i></i><i></i></div>`
                : html`<p>
                    ${aiAns.text.split(CITE).map((x, idx) =>
                      idx % 2
                        ? html`<sup
                            key=${idx}
                            className="sw-cite"
                            onClick=${() => {
                              const src = aiAns.src[Number(x) - 1];
                              if (src) p.act("read", src.id, src.sectionId);
                            }}
                          >[${x}]</sup>`
                        : x
                    )}
                  </p>`}
            </div>
            ${!aiAns.busy &&
            html`<div className="sw-ai-foot">
              <div className="sw-ai-srcs">
                ${aiAns.src.map(
                  (src) => html`<button
                    key=${`${src.id}-${src.sectionId || ''}`}
                    type="button"
                    className="sw-src-pill"
                    onClick=${() => p.act("read", src.id, src.sectionId)}
                  >
                    <b>${src.index}</b>
                    <span>
                      ${src.brainKind === 'task'
                        ? 'Task · '
                        : src.brainKind === 'note'
                        ? 'Note · '
                        : src.brainKind === 'resource'
                        ? 'Resource · '
                        : ''}${src.title}${src.sectionTitle ? ` · § ${src.sectionTitle}` : ''}
                    </span>
                  </button>`
                )}
              </div>
              <div style=${{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                ${!isGuest &&
                p.onSaveAiNote &&
                aiAns.text &&
                html`<button
                  type="button"
                  className="sw-ai-space"
                  onClick=${() => p.onSaveAiNote({ query: aiAns.q, text: aiAns.text, src: aiAns.src })}
                >
                  + Save Note
                </button>`}
                ${aiAns.actions &&
                aiAns.actions.suggestNamingStudio &&
                p.onOpenNamingStudio &&
                html`<button
                  type="button"
                  className="sw-ai-space"
                  onClick=${() => {
                    p.close && p.close();
                    p.onOpenNamingStudio(aiAns.actions.namingCode || '');
                  }}
                >
                  Naming Studio ↗
                </button>`}
                <button
                  type="button"
                  className="sw-ai-space"
                  onClick=${() => {
                    recordTopbarRect();
                    p.act("ask", aiAns.q);
                  }}
                >
                  Continue in Space Chat ↗
                </button>
              </div>
            </div>`}
          </div>`}

          <div className="pl2">
            ${it.map(
              (x, k) => html`<button
                key=${k}
                type="button"
                tabIndex=${p.open ? 0 : -1}
                className=${"pi" + (k === i ? " on" : "")}
                onMouseMove=${() => setI(k)}
                onClick=${() => {
                  if (s && p.onLogSearch) p.onLogSearch(q.trim(), arts.length);
                  x.run();
                }}
              >
                <span className="tile" style=${{ "--c": x.c || "#8e8e93" }}><${Ic} n=${x.n} s=${14} /></span>
                <span className="pt"><b>${HL(x.t)}</b><small>${x.d}</small></span>
              </button>`
            )}
          </div>
          <div className="pf"><span>↑↓ select</span><span>↵ open</span><span>⇧↵ ask AI</span><span>esc close</span></div>
        </div>
      </div>
    </div>
  </div>`;
}
