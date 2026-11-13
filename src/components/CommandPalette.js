import { html, useState, useEffect, useRef } from '../lib/react.js';
import { DC, can } from '../config/constants.js';
import { byId } from '../data/spaces.js';
import { hay } from '../utils/search.js';
import { plain } from '../utils/markdown.js';
import { Ic } from './Icon.js';

export function Pal(p) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const ref = useRef(null);
  const s = q.trim().toLowerCase();

  const A = [
    ...(can.createDraft(p.role) ? [["Create article or resource", "plus", "new"]] : []),
    ["Dashboard (Home)", "home", "home"],
    ["Knowledge Base", "doc", "view", "kb"],
    ["Collections & Link Boards", "boards", "view", "boards"],
    ["Dependency graph", "graph", "view", "graph"],
    ...(can.admin(p.role) ? [["Administration & Governance", "shield", "view", "admin"]] : []),
    ["Change theme", "spark", "theme"],
  ];

  const arts = (
    s
      ? p.res.filter((r) => hay(r).toLowerCase().includes(s))
      : [...p.res].sort((a, b) => b.upd.localeCompare(a.upd))
  ).slice(0, 6);

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
    ...A.filter((a) => !s || a[0].toLowerCase().includes(s)).map((a) => ({
      t: a[0],
      d: "Navigation / Action",
      n: a[1],
      run: () => p.act(a[2], a[3]),
    })),
    ...(s
      ? [
          { t: "Ask AI: “" + q.trim() + "”", d: "Permission-filtered answer", n: "spark", c: "#bf5af2", run: () => p.act("ask", q.trim()) },
          { t: "All results for “" + q.trim() + "”", d: "Search full catalog", n: "search", run: () => p.act("all", q.trim()) },
        ]
      : []),
  ];

  useEffect(() => {
    ref.current.focus();
  }, []);
  useEffect(() => {
    setI(0);
  }, [q]);

  const HL = (t) => {
    const idx = s ? t.toLowerCase().indexOf(s) : -1;
    return idx < 0 ? t : html`${t.slice(0, idx)}<mark>${t.slice(idx, idx + s.length)}</mark>${t.slice(idx + s.length)}`;
  };

  const key = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setI((x) => Math.min(x + 1, it.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setI((x) => Math.max(x - 1, 0));
    } else if (e.key === "Enter") {
      if (s && p.onLogSearch) p.onLogSearch(q.trim(), arts.length);
      it[i] && it[i].run();
    } else if (e.key === "Escape") p.close();
  };

  return html`<div>
    <div className="ov" style=${{ background: "rgba(0,0,0,.22)", zIndex: 75 }} onClick=${p.close}></div>
    <div className="pal" role="dialog" aria-modal="true">
      <div className="pq">
        <${Ic} n="search" s=${20} />
        <input ref=${ref} value=${q} onChange=${(e) => setQ(e.target.value)} onKeyDown=${key} placeholder="Search documents, resources, collections & actions" />
        <kbd>Esc</kbd>
      </div>
      <div className="pl2">
        ${it.map(
          (x, k) => html`<button
            key=${k}
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
      <div className="pf"><span>↑↓ select</span><span>↵ open</span></div>
    </div>
  </div>`;
}
