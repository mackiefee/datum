import { createPortal } from 'react-dom';
import { html, Fragment, useState, useEffect, useRef } from '../lib/react.js';
import { RC } from '../config/constants.js';
import { Ic } from './Icon.js';

const CAT_COLORS = ["#0071e3", "#8e5cf7", "#ff375f", "#ff9f0a", "#34c759", "#30b0c7", "#8e8e93"];

export function Node({ n, d, c }) {
  const has = Boolean(n.kids && n.kids.length);
  const o = c.open.includes(n.id);
  const rootName = n.path ? n.path[0] : n.name;
  const col = n.color || RC[rootName] || "#8e8e93";
  const [ctx, setCtx] = useState(null);
  const menuRef = useRef(null);

  const canManageNode = c.canManageNode ? c.canManageNode(n) : false;

  const openMenuAt = (x, y) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(8, Math.min(x, vw - 236));
    const top = Math.max(8, Math.min(y, vh - 290));
    setCtx({ x: left, y: top });
  };

  useEffect(() => {
    if (!ctx) return;
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setCtx(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setCtx(null);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [ctx]);

  return html`<${Fragment}>
    <div className="st-row-wrap">
      <button
        type="button"
        className=${"ti st-btn" + (c.cur === n.id && (c.view === "lib" || c.view === "kb" || c.view === "reslib") ? " on" : "")}
        style=${{ paddingLeft: 6 + d * 14 }}
        onClick=${() => c.go(n.id)}
        onContextMenu=${(e) => {
          e.preventDefault();
          e.stopPropagation();
          openMenuAt(e.clientX, e.clientY);
        }}
      >
        <span
          className=${"ch" + (o ? " o" : "")}
          onClick=${(e) => {
            e.stopPropagation();
            has && c.tg(n.id);
          }}
        >
          ${has ? html`<${Ic} n="chev" s=${12} />` : ""}
        </span>
        <span className="fi" style=${{ color: col }}>
          <${Ic} n=${o && has ? "folderopen" : "folder"} s=${18} />
        </span>
        <span className="tn">${n.name}</span>
        ${n.vis === "Restricted" && html`<span style=${{ color: "var(--sub)", display: "inline-flex" }} title="Restricted category"><${Ic} n="lock" s=${12} /></span>`}
        <span className="ct st-cnt">${c.cnt(n)}</span>
      </button>
      ${canManageNode &&
      html`<button
        type="button"
        className="st-more"
        title="Category options"
        aria-label=${`Options for ${n.name}`}
        onClick=${(e) => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          openMenuAt(r.right + 4, r.top);
        }}
      >
        <${Ic} n="more" s=${14} />
      </button>`}
    </div>

    ${has && o && n.kids.map((k) => html`<${Node} key=${k.id} n=${k} d=${d + 1} c=${c} />`)}

    ${ctx &&
    typeof document !== "undefined" &&
    createPortal(
      html`<div
        ref=${menuRef}
        className="asel-menu ctx-menu"
        role="menu"
        aria-label=${`Actions for ${n.name}`}
        style=${{ left: ctx.x + "px", top: ctx.y + "px", width: "228px" }}
      >
        <div className="asel-hdr">${n.name} · Level ${d + 1}/3</div>
        ${canManageNode &&
        html`<div className="ctx-swatches" aria-label="Folder color">
          ${CAT_COLORS.map(
            (sw) => html`<button
              key=${sw}
              type="button"
              className=${"ctx-sw" + (col.toLowerCase() === sw.toLowerCase() ? " on" : "")}
              style=${{ background: sw }}
              title=${`Set color ${sw}`}
              onClick=${() => {
                c.onColorCat && c.onColorCat(n.id, sw);
                setCtx(null);
              }}
            ></button>`
          )}
        </div>`}
        ${canManageNode &&
        d < 2 &&
        html`<button
          type="button"
          className="asel-opt"
          onClick=${() => {
            setCtx(null);
            c.onAddChildCat && c.onAddChildCat(n);
          }}
        >
          <${Ic} n="plus" s=${14} />
          <span>Add Subcategory…</span>
        </button>`}
        ${canManageNode &&
        html`<button
          type="button"
          className="asel-opt"
          onClick=${() => {
            setCtx(null);
            c.onEditCat && c.onEditCat(n);
          }}
        >
          <${Ic} n="pencil" s=${14} />
          <span>Edit Category…</span>
        </button>`}
        ${canManageNode &&
        html`<button
          type="button"
          className="asel-opt"
          onClick=${() => {
            setCtx(null);
            c.onToggleVisCat && c.onToggleVisCat(n);
          }}
        >
          <${Ic} n=${n.vis === "Restricted" ? "globe" : "lock"} s=${14} />
          <span>${n.vis === "Restricted" ? "Make Internal" : "Make Restricted"}</span>
        </button>`}
        ${canManageNode &&
        html`<div className="ctx-div"></div>
        <button
          type="button"
          className="asel-opt ctx-dng"
          onClick=${() => {
            setCtx(null);
            c.onDeleteCat && c.onDeleteCat(n);
          }}
        >
          <${Ic} n="trash" s=${14} />
          <span>Delete Category…</span>
        </button>`}
        ${!canManageNode &&
        html`<button
          type="button"
          className="asel-opt"
          onClick=${() => {
            setCtx(null);
            c.go(n.id);
          }}
        >
          <${Ic} n="folderopen" s=${14} />
          <span>Open Space</span>
        </button>`}
      </div>`,
      document.body
    )}
  <//>`;
}
