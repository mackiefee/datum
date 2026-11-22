import { createPortal } from 'react-dom';
import { html, Fragment, useState, useEffect, useRef } from '../lib/react.js';
import { ROLES, normRole } from '../config/constants.js';
import { Ic } from './Icon.js';
import { Avatar } from './Badge.js';

const isNodeTarget = (t) => typeof Node !== "undefined" && t instanceof Node;

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
      if (isNodeTarget(e.target) && btnRef.current && btnRef.current.contains(e.target)) return;
      if (isNodeTarget(e.target) && menuRef.current && menuRef.current.contains(e.target)) return;
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
      if (isNodeTarget(e.target) && menuRef.current && menuRef.current.contains(e.target)) return;
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
      if (isNodeTarget(e.target) && btnRef.current && btnRef.current.contains(e.target)) return;
      if (isNodeTarget(e.target) && menuRef.current && menuRef.current.contains(e.target)) return;
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
      if (isNodeTarget(e.target) && menuRef.current && menuRef.current.contains(e.target)) return;
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
  const activeCount = (showScope && catFilter !== "all" ? 1 : 0) + docFilterKeys.length;

  const resetAll = () => {
    setF && setF({});
    setCatFilter && setCatFilter("all");
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
      <span className="asel-lb">Filter</span>
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
          setCatFilter && setCatFilter(k);
        })}
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
      </div>`,
      document.body
    )}
  <//>`;
}

/**
 * Compact segmented switcher for the 4 core workspace modes (Space | Tasks | Newsfeed | Scripts & Links).
 */
export function ViewModeSwitch({
  viewMode = "space",
  stageOpen = true,
  showTasks = false,
  onSelectMode,
  className = "",
  variant = "segmented",
}) {
  const { open, setOpen, pos, btnRef, menuRef, toggle } = usePopover({
    minWidth: 200,
    maxWidth: 260,
    maxHeight: 360,
  });

  const modes = [
    ["space", "globe", "Space", ""],
    ...(showTasks ? [["tasks", "check", "Tasks", ""]] : []),
    ["feed", "feed", "Newsfeed", ""],
    ["scripts", "code", "Scripts & Links", ""],
  ];
  const current = modes.find((m) => m[0] === viewMode) || modes[0];
  const hasActiveStageMode = Boolean(stageOpen && viewMode && modes.some((m) => m[0] === viewMode));
  const hasActiveSection = Boolean(viewMode && modes.some((m) => m[0] === viewMode));
  const btnIcon = hasActiveSection ? current[1] : "globe";
  const shortLabel = !hasActiveSection
    ? "Views"
    : current[0] === "scripts"
    ? "Scripts"
    : current[0] === "feed"
    ? "Feed"
    : current[2];
  const segLabel = (k, lbl) => (k === "feed" ? "Feed" : k === "scripts" ? "Scripts" : lbl);

  const dropdownNode = html`<${Fragment}>
    <button
      ref=${btnRef}
      type="button"
      className=${"asel kspace-mode-btn" + (variant === "segmented" ? " app-view-dd" : "") + (open ? " open" : "") + (className ? " " + className : "")}
      aria-label=${hasActiveStageMode || hasActiveSection ? `View: ${current[2]}. Switch view` : "Switch view"}
      aria-haspopup="menu"
      aria-expanded=${open}
      onClick=${toggle}
    >
      <${Ic} n=${btnIcon} s=${13} />
      <span className="asel-lb">${shortLabel}</span>
      <span className="asel-ar"><${Ic} n="chev" s=${11} /></span>
    </button>
    ${open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      html`<div
        ref=${menuRef}
        className="asel-menu kspace-mode-menu"
        role="menu"
        aria-label="Switch view"
        style=${menuStyleFromPos(pos)}
      >
        ${modes.map(([k, ico, lbl, cnt]) => {
          const isOn = Boolean(viewMode === k);
          return html`<button
            key=${k}
            type="button"
            role="menuitem"
            className=${"asel-opt" + (isOn ? " on" : "")}
            onClick=${() => {
              setOpen(false);
              onSelectMode && onSelectMode(k);
            }}
          >
            <span className="asel-ck"><${Ic} n=${ico} s=${13} /></span>
            <span className="asel-tx"><span>${lbl}</span></span>
            ${cnt && html`<small className="kspace-mode-cnt">${cnt}</small>`}
            ${isOn && html`<span className="kspace-mode-on"><${Ic} n="check" s=${12} /></span>`}
          </button>`;
        })}
      </div>`,
      document.body
    )}
  <//>`;

  if (variant === "dropdown") return dropdownNode;

  return html`<${Fragment}>
    <div className=${"app-view-seg" + (className ? " " + className : "")} role="tablist" aria-label="Primary workspace views">
      ${modes.map(([k, ico, lbl]) => {
        const isOn = Boolean(viewMode === k);
        return html`<button
          key=${k}
          type="button"
          role="tab"
          aria-selected=${isOn}
          className=${isOn ? "on" : ""}
          title=${lbl}
          onClick=${() => onSelectMode && onSelectMode(k)}
        >
          <${Ic} n=${ico} s=${13} />
          <span>${segLabel(k, lbl)}</span>
        </button>`;
      })}
    </div>
    ${dropdownNode}
  <//>`;
}

/**
 * Clean Sort Popover for Knowledge Space items
 */
export function SortPopover({
  sort,
  setSort,
}) {
  const { open, setOpen, pos, btnRef, menuRef, toggle } = usePopover({
    minWidth: 210,
    maxWidth: 260,
    maxHeight: 300,
  });

  const sortNames = { new: "Sort", az: "A–Z", links: "Most linked" };
  const isActive = sort !== "new";
  const label = sortNames[sort] || "Sort";

  return html`<${Fragment}>
    <button
      ref=${btnRef}
      type="button"
      className=${"asel asel-pill" + (isActive ? " asel-active" : "") + (open ? " open" : "")}
      aria-label="Sort options"
      aria-haspopup="dialog"
      aria-expanded=${open}
      onClick=${toggle}
    >
      <${Ic} n="sliders" s=${13} />
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
        aria-label="Sort options"
        style=${menuStyleFromPos(pos)}
      >
        <div className="lpop-sec">
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
        </div>
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
      if (isNodeTarget(e.target) && btnRef.current && btnRef.current.contains(e.target)) return;
      if (isNodeTarget(e.target) && menuRef.current && menuRef.current.contains(e.target)) return;
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

/**
 * Shared Circular (•••) Overflow & Filter Action Menu Button
 */
export function ActionMenuButton({
  sections = [],
  active = false,
  ariaLabel = "More actions",
  title = "More actions",
  className = "",
  minWidth = 220,
  disabled = false,
}) {
  const { open, setOpen, pos, btnRef, menuRef, toggle } = usePopover({
    minWidth,
    maxWidth: 270,
    maxHeight: 420,
    disabled,
  });
  const [confirmKey, setConfirmKey] = useState(null);

  useEffect(() => {
    if (!open && confirmKey) setConfirmKey(null);
  }, [open, confirmKey]);

  const cleanSections = (Array.isArray(sections) ? sections : [])
    .map((sec) => ({
      title: sec && sec.title ? String(sec.title) : "",
      items: Array.isArray(sec?.items) ? sec.items.filter(Boolean) : [],
    }))
    .filter((sec) => sec.items.length > 0);

  if (!cleanSections.length) return null;

  return html`<${Fragment}>
    <button
      ref=${btnRef}
      type="button"
      className=${"pl-ico-btn" + (open || active ? " on" : "") + (className ? " " + className : "")}
      title=${title}
      aria-label=${ariaLabel}
      aria-haspopup="menu"
      aria-expanded=${open}
      disabled=${disabled}
      onClick=${toggle}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    </button>
    ${open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      html`<div
        ref=${menuRef}
        className="asel-menu pl-more-menu"
        role="menu"
        aria-label=${ariaLabel}
        style=${menuStyleFromPos(pos)}
      >
        ${cleanSections.map((sec, sIdx) => html`<${Fragment} key=${sec.title || `sec-${sIdx}`}>
          ${sIdx > 0 && html`<div className="pl-menu-div" role="separator" />`}
          ${sec.title && html`<div className="asel-hdr">${sec.title}</div>`}
          ${sec.items.map((item) => {
            const isArmed = Boolean(item.confirmLabel && confirmKey === item.key);
            const cls =
              "asel-opt" +
              (item.checked ? " on" : "") +
              (item.danger || isArmed ? " danger" : "");
            const lbl = isArmed ? item.confirmLabel : item.label;
            const ico = item.checked ? "check" : item.icon || null;
            return html`<button
              key=${item.key}
              type="button"
              role="menuitem"
              disabled=${Boolean(item.disabled)}
              className=${cls}
              onClick=${() => {
                if (item.disabled) return;
                if (item.confirmLabel && !isArmed) {
                  setConfirmKey(item.key);
                  return;
                }
                setOpen(false);
                setConfirmKey(null);
                item.onClick && item.onClick();
              }}
            >
              <span className="asel-ck">${ico ? html`<${Ic} n=${ico} s=${13} />` : null}</span>
              <span className="asel-tx"><span>${lbl}</span></span>
            </button>`;
          })}
        <//>`)}
      </div>`,
      document.body
    )}
  <//>`;
}
