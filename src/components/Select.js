import { createPortal } from 'react-dom';
import { html, Fragment, useState, useEffect, useRef } from '../lib/react.js';
import { ROLES, normRole } from '../config/constants.js';
import { Ic } from './Icon.js';
import { Avatar } from './Badge.js';

function normalizeOption(opt) {
  if (Array.isArray(opt)) {
    return {
      value: opt[0] === undefined || opt[0] === null ? "" : String(opt[0]),
      label: opt[1] !== undefined ? String(opt[1]) : String(opt[0] || ""),
      disabled: Boolean(opt[2]),
      color: opt[3] || null,
      sub: opt[4] || "",
    };
  }
  return {
    value: opt.value === undefined || opt.value === null ? "" : String(opt.value),
    label: opt.label !== undefined ? String(opt.label) : String(opt.value || ""),
    disabled: Boolean(opt.disabled),
    color: opt.color || null,
    sub: opt.sub || "",
  };
}

function computeMenuPos(rect, minWidth, preferUp = false, maxWidth = 320, maxHeight = 300) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(Math.max(rect.width, minWidth), vw - 16, maxWidth);
  let left = rect.left;
  if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
  if (left < 8) left = 8;

  const spaceBelow = vh - rect.bottom - 10;
  const spaceAbove = rect.top - 10;
  const openUp = preferUp ? spaceAbove > 120 || spaceAbove > spaceBelow : spaceBelow < 200 && spaceAbove > spaceBelow;

  if (openUp) {
    return {
      left,
      minWidth: w,
      maxWidth: vw - 16,
      bottom: vh - rect.top + 6,
      top: "auto",
      maxHeight: Math.min(maxHeight, Math.max(140, spaceAbove - 8)),
      origin: "bottom",
    };
  }
  return {
    left,
    minWidth: w,
    maxWidth: vw - 16,
    top: rect.bottom + 6,
    bottom: "auto",
    maxHeight: Math.min(maxHeight, Math.max(140, spaceBelow - 8)),
    origin: "top",
  };
}

/**
 * Apple HIG Frosted-Glass Popover Select
 * Variants: "pill" (default), "filter", "meta", "field", "inline", "sort"
 */
export function Select(p) {
  const {
    value,
    onChange,
    options = [],
    placeholder = "Select…",
    displayLabel,
    variant = "pill",
    color,
    disabled = false,
    ariaLabel,
    title,
    style,
    className = "",
    minMenuWidth = 190,
  } = p;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const items = (Array.isArray(options) ? options : []).map(normalizeOption);
  const strVal = value === undefined || value === null ? "" : String(value);
  const current = items.find((o) => o.value === strVal);
  const isActiveFilter = variant === "filter" && Boolean(strVal);

  const shownText =
    displayLabel !== undefined
      ? displayLabel
      : current && current.value !== ""
      ? variant === "filter"
        ? `${placeholder}: ${current.label}`
        : current.label
      : current && placeholder === ""
      ? current.label
      : placeholder || (current ? current.label : "Select…");

  const openMenu = () => {
    if (disabled || !btnRef.current) return;
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    setPos(computeMenuPos(r, minMenuWidth));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        btnRef.current && btnRef.current.focus();
      }
    };
    const onScrollOrResize = (e) => {
      if (menuRef.current && e.target && menuRef.current.contains(e.target)) return;
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setPos(computeMenuPos(r, minMenuWidth));
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, minMenuWidth]);

  const cls = [
    "asel",
    `asel-${variant}`,
    isActiveFilter ? "asel-active" : "",
    open ? "open" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const menuEl =
    open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      html`<div
        ref=${menuRef}
        className="asel-menu"
        role="listbox"
        aria-label=${ariaLabel || placeholder}
        style=${{
          left: pos.left + "px",
          top: pos.top === "auto" ? "auto" : pos.top + "px",
          bottom: pos.bottom === "auto" ? "auto" : pos.bottom + "px",
          minWidth: pos.minWidth + "px",
          maxWidth: pos.maxWidth + "px",
          maxHeight: pos.maxHeight + "px",
          transformOrigin: pos.origin === "bottom" ? "bottom left" : "top left",
        }}
      >
        ${items.map((opt) => {
          const isSel = opt.value === strVal;
          return html`<button
            key=${opt.value + opt.label}
            type="button"
            role="option"
            aria-selected=${isSel}
            disabled=${opt.disabled}
            className=${"asel-opt" + (isSel ? " on" : "")}
            onClick=${() => {
              if (opt.disabled) return;
              setOpen(false);
              onChange && onChange(opt.value);
            }}
          >
            <span className="asel-ck">${isSel ? html`<${Ic} n="check" s=${13} />` : null}</span>
            ${opt.color && html`<i className="asel-dot" style=${{ background: opt.color }}></i>`}
            <span className="asel-tx">
              <span>${opt.label}</span>
              ${opt.sub && html`<small>${opt.sub}</small>`}
            </span>
          </button>`;
        })}
      </div>`,
      document.body
    );

  return html`<${Fragment}><button
      ref=${btnRef}
      type="button"
      className=${cls}
      style=${{ ...(color ? { "--c": color } : {}), ...(style || {}) }}
      disabled=${disabled}
      title=${title || ariaLabel || placeholder}
      aria-label=${ariaLabel || placeholder}
      aria-haspopup="listbox"
      aria-expanded=${open}
      onClick=${openMenu}
    >
      ${color && variant !== "inline" && html`<i className="asel-dot" style=${{ background: color }}></i>`}
      <span className="asel-lb">${shownText}</span>
      <span className="asel-ar"><${Ic} n="chev" s=${11} /></span>
    </button>
    ${menuEl}<//>`;
}

/**
 * Shared viewport-clamped popover state hook for frosted-glass menus.
 */
function usePopover({ minWidth = 220, maxWidth = 340, maxHeight = 420, preferUp = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const toggle = () => {
    if (disabled || !btnRef.current) return;
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    setPos(computeMenuPos(r, minWidth, preferUp, maxWidth, maxHeight));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        btnRef.current && btnRef.current.focus();
      }
    };
    const onScrollOrResize = (e) => {
      if (menuRef.current && e.target && menuRef.current.contains(e.target)) return;
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        setPos(computeMenuPos(r, minWidth, preferUp, maxWidth, maxHeight));
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, minWidth, preferUp, maxWidth, maxHeight]);

  return { open, setOpen, pos, btnRef, menuRef, toggle };
}

function menuStyleFromPos(pos) {
  return {
    left: pos.left + "px",
    top: pos.top === "auto" ? "auto" : pos.top + "px",
    bottom: pos.bottom === "auto" ? "auto" : pos.bottom + "px",
    minWidth: pos.minWidth + "px",
    maxWidth: pos.maxWidth + "px",
    maxHeight: pos.maxHeight + "px",
    transformOrigin: pos.origin === "bottom" ? "bottom left" : "top left",
  };
}

/**
 * Linear-style unified Filter Popover
 */
export function FilterPopover({
  view,
  curCat,
  catFilter,
  setCatFilter,
  setActiveKitId,
  visibleColsCount = 0,
  kitTier = "all",
  setKitTier,
  f = {},
  setF,
  canFilterStatus = false,
  statuses = [],
  types = [],
  tags = [],
}) {
  const { open, pos, btnRef, menuRef, toggle } = usePopover({
    minWidth: 310,
    maxWidth: 350,
    maxHeight: 440,
  });

  const showScope = view === "kb" || Boolean(curCat);
  const docFilterKeys = ["status", "type", "tag", "disc", "author", "stage"].filter((k) => Boolean(f[k]));
  const activeCount =
    (showScope && catFilter !== "all" ? 1 : 0) +
    (catFilter === "kits" ? (kitTier !== "all" ? 1 : 0) : docFilterKeys.length);

  const resetAll = () => {
    setF && setF({});
    setCatFilter && setCatFilter("all");
    setActiveKitId && setActiveKitId(null);
    setKitTier && setKitTier("all");
  };

  const renderChipGroup = (label, opts, currentVal, onSelect, extraCls = "") =>
    html`<div className="lpop-sec">
      <div className="lpop-sec-lbl">${label}</div>
      <div className=${"lpop-chips" + (extraCls ? " " + extraCls : "")}>
        ${opts.map(
          ([k, txt]) => html`<button
            key=${String(k)}
            type="button"
            className=${"lpop-chip" + (currentVal === k ? " on" : "")}
            onClick=${() => onSelect(k)}
          >
            ${txt}
          </button>`
        )}
      </div>
    </div>`;

  const scopeOpts =
    view === "kb"
      ? [
          ["all", "All"],
          ["docs", "Docs"],
          ["res", "Resources"],
          ["kits", `Kits (${visibleColsCount})`],
        ]
      : [
          ["all", "All"],
          ["docs", "Docs"],
          ["res", "Resources"],
        ];

  return html`<${Fragment}>
    <button
      ref=${btnRef}
      type="button"
      className=${"asel asel-filter" + (activeCount > 0 ? " asel-active" : "") + (open ? " open" : "")}
      aria-label="Filters"
      aria-haspopup="dialog"
      aria-expanded=${open}
      onClick=${toggle}
    >
      <${Ic} n="sliders" s=${14} />
      <span className="asel-lb">${catFilter === "kits" ? "Filter · Kits" : "Filter"}</span>
      ${activeCount > 0 && html`<span className="lpop-cnt">${activeCount}</span>`}
      ${activeCount > 0 &&
      html`<span
        className="lpop-clr"
        role="button"
        tabIndex="0"
        title="Reset filters"
        aria-label="Reset filters"
        onClick=${(e) => {
          e.stopPropagation();
          resetAll();
        }}
        onKeyDown=${(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            resetAll();
          }
        }}
      >
        <${Ic} n="x" s=${10} />
      </span>`}
      <span className="asel-ar"><${Ic} n="chev" s=${11} /></span>
    </button>
    ${open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      html`<div
        ref=${menuRef}
        className="asel-menu lpop-menu"
        role="dialog"
        aria-label="Filter options"
        style=${menuStyleFromPos(pos)}
      >
        <div className="lpop-head">
          <span>Filters</span>
          ${activeCount > 0 &&
          html`<button type="button" className="lpop-rst" onClick=${resetAll}>Reset all</button>`}
        </div>
        ${showScope &&
        renderChipGroup("Scope", scopeOpts, catFilter, (k) => {
          if (k === "kits") setActiveKitId && setActiveKitId(null);
          setCatFilter && setCatFilter(k);
        })}
        ${catFilter === "kits"
          ? renderChipGroup(
              "Kit Tier",
              [
                ["all", "All"],
                ["official", "Official"],
                ["shared", "Shared"],
                ["personal", "Personal"],
              ],
              kitTier,
              (k) => setKitTier && setKitTier(k)
            )
          : html`<${Fragment}>
              ${types.length > 0 &&
              renderChipGroup(
                "Type",
                [["", "All"], ...types],
                f.type || "",
                (k) => setF({ ...f, type: !k || f.type === k ? undefined : k })
              )}
              ${canFilterStatus &&
              statuses.length > 0 &&
              renderChipGroup(
                "Status",
                [["", "All"], ...statuses],
                f.status || "",
                (k) => setF({ ...f, status: !k || f.status === k ? undefined : k })
              )}
              ${tags.length > 0 &&
              renderChipGroup(
                "Tag",
                [["", "All"], ...tags.map((t) => [t, "#" + t])],
                f.tag || "",
                (k) => setF({ ...f, tag: !k || f.tag === k ? undefined : k }),
                "lpop-tags"
              )}
            <//>`}
      </div>`,
      document.body
    )}
  <//>`;
}

/**
 * Linear-style unified Sort & View Display Popover
 */
export function SortPopover({
  view,
  catFilter,
  setCatFilter,
  setActiveKitId,
  kbDisplay,
  setKbDisplay,
  sort,
  setSort,
  visibleColsCount = 0,
}) {
  const { open, setOpen, pos, btnRef, menuRef, toggle } = usePopover({
    minWidth: 240,
    maxWidth: 280,
    maxHeight: 360,
  });

  const isKits = view === "kb" && catFilter === "kits";
  const isActive = isKits || kbDisplay === "graph" || sort !== "new";
  const icoName = isKits ? "folder" : kbDisplay === "graph" ? "graph" : "swap";
  const label = isKits
    ? "View: Kits"
    : kbDisplay === "graph"
    ? "View: Graph"
    : sort === "az"
    ? "Sort: A–Z"
    : sort === "links"
    ? "Sort: Links"
    : "Sort";

  const chooseLayout = (mode) => {
    if (mode === "kits") {
      setActiveKitId && setActiveKitId(null);
      setCatFilter && setCatFilter("kits");
    } else {
      if (catFilter === "kits") setCatFilter && setCatFilter("all");
      setKbDisplay && setKbDisplay(mode);
    }
    setOpen(false);
  };

  return html`<${Fragment}>
    <button
      ref=${btnRef}
      type="button"
      className=${"asel asel-pill" + (isActive ? " asel-active" : "") + (open ? " open" : "")}
      aria-label="Sort and view options"
      aria-haspopup="dialog"
      aria-expanded=${open}
      onClick=${toggle}
    >
      <${Ic} n=${icoName} s=${14} />
      <span className="asel-lb">${label}</span>
      <span className="asel-ar"><${Ic} n="chev" s=${11} /></span>
    </button>
    ${open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      html`<div
        ref=${menuRef}
        className="asel-menu lpop-menu"
        role="dialog"
        aria-label="Sort and view options"
        style=${menuStyleFromPos(pos)}
      >
        <div className="lpop-sec">
          <div className="lpop-sec-lbl">View</div>
          <div className="lpop-layout">
            <button
              type="button"
              className=${"lpop-chip" + (!isKits && kbDisplay === "grid" ? " on" : "")}
              onClick=${() => chooseLayout("grid")}
            >
              <${Ic} n="layout" s=${14} /><span>Grid</span>
            </button>
            <button
              type="button"
              className=${"lpop-chip" + (!isKits && kbDisplay === "graph" ? " on" : "")}
              onClick=${() => chooseLayout("graph")}
            >
              <${Ic} n="graph" s=${14} /><span>Graph</span>
            </button>
            ${view === "kb" &&
            html`<button
              type="button"
              className=${"lpop-chip" + (isKits ? " on" : "")}
              onClick=${() => chooseLayout("kits")}
            >
              <${Ic} n="folder" s=${14} /><span>Kits (${visibleColsCount})</span>
            </button>`}
          </div>
        </div>
        ${!isKits &&
        html`<div className="lpop-sec">
          <div className="lpop-sec-lbl">Sort by</div>
          ${[
            ["new", "Newest first"],
            ["az", "By title (A–Z)"],
            ["links", "Most linked"],
          ].map(([k, lb]) => {
            const isSel = sort === k;
            return html`<button
              key=${k}
              type="button"
              className=${"asel-opt" + (isSel ? " on" : "")}
              onClick=${() => {
                setSort && setSort(k);
                setOpen(false);
              }}
            >
              <span className="asel-ck">${isSel ? html`<${Ic} n="check" s=${13} />` : null}</span>
              <span className="asel-tx"><span>${lb}</span></span>
            </button>`;
          })}
        </div>`}
      </div>`,
      document.body
    )}
  <//>`;
}

/**
 * Apple-style Sidebar Account & Role Switcher
 */
export function UserSwitcher({ users = [], activeUserId, activeUser, authClaims, onLogout }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const activeUsers = users.filter((u) => u.status === "active");
  const cur = activeUser || activeUsers.find((u) => u.id === activeUserId) || activeUsers[0] || users[0];
  const curRole = cur ? normRole(cur.role) : "Member";

  const toggle = () => {
    if (!btnRef.current) return;
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    setPos(computeMenuPos(r, Math.max(264, r.width), true, 130, 440));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  if (!cur) return null;

  return html`<div className="me-wrap">
      <button
        ref=${btnRef}
        type="button"
        className=${"me-btn" + (open ? " open" : "")}
        aria-label="Account and session switcher"
        aria-haspopup="listbox"
        aria-expanded=${open}
        onClick=${toggle}
      >
        <${Avatar} user=${cur} />
        <div className="t">
          <b>${cur.name}</b>
          <small>${ROLES[curRole]}${cur.provider === "google" ? " · Google" : ""}</small>
        </div>
        <span className="me-chv"><${Ic} n="chev" s=${13} /></span>
      </button>
      ${open &&
      pos &&
      typeof document !== "undefined" &&
      createPortal(
        html`<div
          ref=${menuRef}
          className="asel-menu asel-usr-menu"
          role="listbox"
          aria-label="Account menu and persona switcher"
          style=${{
            left: pos.left + "px",
            top: pos.top === "auto" ? "auto" : pos.top + "px",
            bottom: pos.bottom === "auto" ? "auto" : pos.bottom + "px",
            minWidth: pos.minWidth + "px",
            maxWidth: pos.maxWidth + "px",
            maxHeight: pos.maxHeight + "px",
            transformOrigin: "bottom left",
          }}
        >
          <div className="usr-pop-card">
            <${Avatar} user=${cur} />
            <div className="asel-tx">
              <b>${cur.name}</b>
              <small>${cur.email || (authClaims && authClaims.email) || ""}</small>
            </div>
            ${cur.emailVerified && html`<span className="tm-gbadge" title="Google OAuth Verified">G</span>`}
          </div>
          <div className="ctx-div"></div>
          <button
            type="button"
            className="asel-opt ctx-dng"
            onClick=${() => {
              setOpen(false);
              onLogout && onLogout();
            }}
          >
            <${Ic} n="lock" s=${14} />
            <span>Sign out</span>
          </button>
        </div>`,
        document.body
      )}
    </div>`;
}
