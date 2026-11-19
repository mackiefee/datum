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
  const clampedRight = rect.left + w > vw - 8;
  let left = clampedRight ? Math.max(8, rect.right - w) : rect.left;
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
      origin: clampedRight ? "bottom right" : "bottom left",
    };
  }
  return {
    left,
    minWidth: w,
    maxWidth: vw - 16,
    top: rect.bottom + 6,
    bottom: "auto",
    maxHeight: Math.min(maxHeight, Math.max(140, spaceBelow - 8)),
    origin: clampedRight ? "top right" : "top left",
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
          transformOrigin: pos.origin,
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
    transformOrigin: pos.origin,
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
  disciplines = [],
  discColors = {},
  canFilterStatus = false,
  statuses = [],
  types = [],
  tags = [],
}) {
  const { open, pos, btnRef, menuRef, toggle } = usePopover({
    minWidth: 310,
    maxWidth: 350,
    maxHeight: 480,
  });

  const isKbLike = view === "kb" || view === "space";
  const showScope = isKbLike || Boolean(curCat);
  const docFilterKeys = ["status", "type", "tag", "disc", "author", "stage"].filter((k) => Boolean(f[k]));
  const activeCount =
    (showScope && catFilter !== "all" && catFilter !== "kits" ? 1 : 0) +
    (catFilter === "kits" ? (kitTier !== "all" ? 1 : 0) : docFilterKeys.length);

  const resetAll = () => {
    setF && setF({});
    if (catFilter !== "kits") setCatFilter && setCatFilter("all");
    setKitTier && setKitTier("all");
  };

  const renderChipGroup = (label, opts, currentVal, onSelect, extraCls = "") =>
    html`<div className="lpop-sec">
      <div className="lpop-sec-lbl">${label}</div>
      <div className=${"lpop-chips" + (extraCls ? " " + extraCls : "")}>
        ${opts.map(
          ([k, txt, dotColor]) => html`<button
            key=${String(k)}
            type="button"
            className=${"lpop-chip" + (currentVal === k ? " on" : "")}
            onClick=${() => onSelect(k)}
          >
            ${dotColor && html`<i className="lpop-dot" style=${{ "--dc": dotColor }} aria-hidden="true" />`}
            <span>${txt}</span>
          </button>`
        )}
      </div>
    </div>`;

  const scopeOpts = [
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
      <${Ic} n="sliders" s=${13} />
      <span className="asel-lb">${catFilter === "kits" ? "Tier" : "Filter"}</span>
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
        catFilter !== "kits" &&
        renderChipGroup("Scope", scopeOpts, catFilter, (k) => {
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
              ${disciplines.length > 0 &&
              renderChipGroup(
                "Discipline",
                [["", "All"], ...disciplines.map((d) => [d, d, discColors[d]])],
                f.disc || "",
                (k) => setF({ ...f, disc: !k || f.disc === k ? undefined : k })
              )}
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
 * Compact 1-click segmented switcher for unified spatial canvas modes (Space | Grid | Graph | Kits).
 */
export function ViewModeSwitch({
  viewMode = "space",
  stageOpen = true,
  visibleColsCount = 0,
  showTasks = false,
  onSelectMode,
  className = "",
}) {
  const modes = [
    ["space", "globe", "Space"],
    ["grid", "layout", "Grid"],
    ["graph", "graph", "Graph"],
    ...(showTasks ? [["tasks", "check", "Tasks"]] : []),
    ["scripts", "code", "Scripts & Links"],
    ["kits", "folder", visibleColsCount ? `Kits (${visibleColsCount})` : "Kits"],
  ];

  return html`<div className=${"kspace-view-seg" + (className ? " " + className : "")} role="group" aria-label="Canvas mode">
    ${modes.map(([k, ico, lbl]) => {
      const isOn = Boolean(stageOpen && viewMode === k);
      return html`<button
        key=${k}
        type="button"
        className=${isOn ? "on" : ""}
        aria-pressed=${isOn}
        title=${`Switch canvas to ${lbl}`}
        onClick=${() => onSelectMode && onSelectMode(k)}
      >
        <${Ic} n=${ico} s=${13} />
        <span>${lbl}</span>
      </button>`;
    })}
  </div>`;
}

/**
 * Linear-style unified Display View & Sort Popover
 */
export function SortPopover({
  view,
  catFilter,
  setCatFilter,
  setActiveKitId,
  activeKitId = null,
  kbDisplay,
  setKbDisplay,
  onSelectViewMode,
  stageOpen = true,
  hideViewDesktop = false,
  sort,
  setSort,
  visibleColsCount = 0,
}) {
  const { open, setOpen, pos, btnRef, menuRef, toggle } = usePopover({
    minWidth: 230,
    maxWidth: 280,
    maxHeight: 360,
  });

  const isKbLike = view === "kb" || view === "space" || view === "lib" || view === "home" || view === "reslib";
  const isKitsOverview = isKbLike && catFilter === "kits" && !activeKitId;
  const effectiveDisplay =
    kbDisplay === "grid" || kbDisplay === "graph" || kbDisplay === "scripts" ? kbDisplay : "space";
  const currentView = isKitsOverview ? "kits" : effectiveDisplay;
  const isActive = (!hideViewDesktop && (isKitsOverview || effectiveDisplay === "graph")) || sort !== "new";
  const icoName = hideViewDesktop
    ? "sliders"
    : currentView === "space"
    ? "globe"
    : currentView === "graph"
    ? "graph"
    : currentView === "scripts"
    ? "code"
    : currentView === "kits"
    ? "folder"
    : "layout";
  const viewNames = { grid: "Grid", space: "Space", graph: "Graph", scripts: "Scripts & Links", kits: "Kits" };
  const sortNames = { new: "Sort", az: "A–Z", links: "Most linked" };
  const sortSuffix = sort === "az" ? " · A–Z" : sort === "links" ? " · Links" : "";
  const label = hideViewDesktop
    ? sortNames[sort] || "Sort"
    : `${viewNames[currentView] || "Space"}${sortSuffix}`;

  const chooseLayout = (mode) => {
    if (onSelectViewMode) {
      onSelectViewMode(mode);
    } else if (mode === "kits") {
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
      aria-label="View layout and sort options"
      aria-haspopup="dialog"
      aria-expanded=${open}
      onClick=${toggle}
    >
      <${Ic} n=${icoName} s=${13} />
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
        <div className=${"lpop-sec" + (hideViewDesktop ? " lpop-view-mob" : "")}>
          <div className="lpop-sec-lbl">View</div>
          <div className="lpop-layout">
            <button
              type="button"
              className=${"lpop-chip" + (stageOpen && currentView === "space" ? " on" : "")}
              onClick=${() => chooseLayout("space")}
            >
              <${Ic} n="globe" s=${14} /><span>Space</span>
            </button>
            <button
              type="button"
              className=${"lpop-chip" + (stageOpen && currentView === "grid" ? " on" : "")}
              onClick=${() => chooseLayout("grid")}
            >
              <${Ic} n="layout" s=${14} /><span>Grid</span>
            </button>
            <button
              type="button"
              className=${"lpop-chip" + (stageOpen && currentView === "graph" ? " on" : "")}
              onClick=${() => chooseLayout("graph")}
            >
              <${Ic} n="graph" s=${14} /><span>Graph</span>
            </button>
            ${isKbLike &&
            html`<button
              type="button"
              className=${"lpop-chip" + (stageOpen && currentView === "kits" ? " on" : "")}
              onClick=${() => chooseLayout("kits")}
            >
              <${Ic} n="folder" s=${14} /><span>Kits (${visibleColsCount})</span>
            </button>`}
          </div>
        </div>
        ${!isKitsOverview &&
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

function readResolvedTheme() {
  if (typeof document === "undefined") return "dark";
  const ds = document.documentElement.dataset.theme;
  if (ds === "dark" || ds === "light") return ds;
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/**
 * Apple-style Account, Appearance & Session Switcher
 * Variants: "topbar" (compact circular avatar in top-right) | "drawer" (full card row in overlay drawer footer)
 */
export function UserSwitcher({
  users = [],
  activeUserId,
  activeUser,
  authClaims,
  onLogout,
  onToggleTheme,
  variant = "topbar",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [themeMode, setThemeMode] = useState(() => readResolvedTheme());
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const activeUsers = users.filter((u) => u.status === "active");
  const cur = activeUser || activeUsers.find((u) => u.id === activeUserId) || activeUsers[0] || users[0];
  const curRole = cur ? normRole(cur.role) : "Member";
  const isDrawer = variant === "drawer";

  const toggle = () => {
    if (!btnRef.current) return;
    if (open) {
      setOpen(false);
      return;
    }
    setThemeMode(readResolvedTheme());
    const r = btnRef.current.getBoundingClientRect();
    setPos(computeMenuPos(r, Math.max(256, r.width), isDrawer, 310, 440));
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

  const menuEl =
    open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      html`<div
        ref=${menuRef}
        className="asel-menu asel-usr-menu"
        role="listbox"
        aria-label="Account menu and appearance"
        style=${{
          left: pos.left + "px",
          top: pos.top === "auto" ? "auto" : pos.top + "px",
          bottom: pos.bottom === "auto" ? "auto" : pos.bottom + "px",
          minWidth: pos.minWidth + "px",
          maxWidth: pos.maxWidth + "px",
          maxHeight: pos.maxHeight + "px",
          transformOrigin: pos.origin,
        }}
      >
        <div className="usr-pop-card">
          <${Avatar} user=${cur} />
          <div className="asel-tx">
            <b>${cur.name}</b>
            <small>${cur.email || (authClaims && authClaims.email) || ROLES[curRole]}</small>
          </div>
          ${cur.emailVerified && html`<span className="tm-gbadge" title="Google OAuth Verified">G</span>`}
        </div>
        <div className="usr-role-row">
          <span className="usr-role-pill">${ROLES[curRole] || curRole}</span>
        </div>
        <div className="ctx-div"></div>
        ${onToggleTheme &&
        html`<button
          type="button"
          className="asel-opt"
          onClick=${() => {
            onToggleTheme();
            setThemeMode(readResolvedTheme());
          }}
        >
          <${Ic} n="spark" s=${14} />
          <span className="asel-tx"><span>Appearance</span></span>
          <span className="usr-theme-tag">${themeMode === "light" ? "Light" : "Dark"}</span>
        </button>`}
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
    );

  if (isDrawer) {
    return html`<div className=${"me-wrap " + className}>
      <button
        ref=${btnRef}
        type="button"
        className=${"me-btn" + (open ? " open" : "")}
        aria-label="Account and session menu"
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
      ${menuEl}
    </div>`;
  }

  return html`<div className=${"usr-tb-wrap " + className}>
    <button
      ref=${btnRef}
      type="button"
      className=${"usr-tb-btn" + (open ? " open" : "")}
      title=${`${cur.name} · ${ROLES[curRole] || curRole}`}
      aria-label=${`Account menu (${cur.name})`}
      aria-haspopup="listbox"
      aria-expanded=${open}
      onClick=${toggle}
    >
      <${Avatar} user=${cur} size="sm" />
    </button>
    ${menuEl}
  </div>`;
}
