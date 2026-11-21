import { createPortal } from 'react-dom';
import { Fragment, html, useEffect, useRef, useState } from '../lib/react.js';
import { ROLES, normRole } from '../config/constants.js';
import { Ic } from './Icon.js';
import { Select } from './Select.js';

export const ROLE_COL = {
  SuperAdmin: '#8e5cf7',
  Admin: '#0071e3',
  Editor: '#30d158',
  Member: '#8e8e93',
  Guest: '#ff9f0a',
};

export const EllipsisDots = () => html`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <circle cx="5" cy="12" r="2" />
  <circle cx="12" cy="12" r="2" />
  <circle cx="19" cy="12" r="2" />
</svg>`;

export function UserRowActionMenu({
  rowMenu,
  onClose,
  isAdmin,
  isSuperAdmin,
  currentUserId,
  onFilterByOwner,
  onOpenAdminUsers,
  onReactivateUser,
  onOpenConfirm,
}) {
  const menuRef = useRef(null);
  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  useEffect(() => {
    if (!rowMenu) return;
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (e.target && e.target.closest && e.target.closest('.cd-more-btn')) return;
      onClose && onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [rowMenu, onClose]);

  if (!portalRoot || !rowMenu) return null;

  const usr = rowMenu.user;
  const canMutateTarget =
    isAdmin &&
    usr.id !== currentUserId &&
    !(normRole(usr.role) === 'SuperAdmin' && !isSuperAdmin);

  return createPortal(
    html`<div
      ref=${menuRef}
      className="asel-menu"
      style=${{ left: `${rowMenu.left}px`, top: `${rowMenu.top}px`, width: '244px' }}
      role="menu"
    >
      ${onFilterByOwner &&
      html`<button
        type="button"
        className="asel-opt"
        onClick=${() => {
          onClose();
          onFilterByOwner(usr.name);
        }}
      >
        <span className="asel-ck"><${Ic} n="doc" s=${13} /></span>
        <span className="asel-tx"><span>View Authored Items</span></span>
      </button>`}

      ${isAdmin &&
      onOpenAdminUsers &&
      html`<button
        type="button"
        className="asel-opt"
        onClick=${() => {
          onClose();
          onOpenAdminUsers();
        }}
      >
        <span className="asel-ck"><${Ic} n="sliders" s=${13} /></span>
        <span className="asel-tx"><span>Manage Roles & Lifecycle…</span></span>
      </button>`}

      ${canMutateTarget &&
      html`<${Fragment}>
        <div className="pl-menu-div" />
        ${usr.status === 'deactivated' && onReactivateUser
          ? html`<button
              type="button"
              className="asel-opt"
              onClick=${() => {
                onClose();
                onReactivateUser(usr);
              }}
            >
              <span className="asel-ck"><${Ic} n="check" s=${13} /></span>
              <span className="asel-tx"><span>Reactivate Account</span></span>
            </button>`
          : html`<button
              type="button"
              className="asel-opt"
              onClick=${() => onOpenConfirm && onOpenConfirm('deactivate', usr)}
            >
              <span className="asel-ck"><${Ic} n="lock" s=${13} /></span>
              <span className="asel-tx"><span>Deactivate & Handover…</span></span>
            </button>`}
        <button
          type="button"
          className="asel-opt ctx-dng"
          onClick=${() => onOpenConfirm && onOpenConfirm('delete', usr)}
        >
          <span className="asel-ck" style=${{ color: 'inherit' }}><${Ic} n="trash" s=${13} /></span>
          <span className="asel-tx"><span>Delete Permanently…</span></span>
        </button>
      </${Fragment}>`}
    </div>`,
    portalRoot
  );
}

export function InviteUserSheet({ open, teams = [], isSuperAdmin, busy, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', email: '', title: '', dept: '', role: 'Member' });
  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  useEffect(() => {
    if (open) {
      setForm({
        name: '',
        email: '',
        title: '',
        dept: (teams[0] && teams[0].name) || 'VDC',
        role: 'Member',
      });
    }
  }, [open, teams]);

  if (!portalRoot || !open) return null;

  const submit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!form.email.trim() || busy) return;
    await onSubmit({
      ...form,
      dept: form.dept || (teams[0] && teams[0].name) || 'VDC',
    });
  };

  return createPortal(
    html`<div
      className="qc-ov"
      onMouseDown=${(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown=${(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <form className="qc-sheet" role="dialog" aria-modal="true" aria-label="Invite User" onSubmit=${submit}>
        <div className="qc-sh">
          <button type="button" className="qc-sh-cancel" onClick=${onClose}>Cancel</button>
          <b>Invite User</b>
          <button type="submit" className="btn sm p qc-sh-save" disabled=${busy || !form.email.trim()}>
            ${busy ? 'Saving…' : 'Invite'}
          </button>
        </div>
        <div className="qc-cell">
          <input
            type="email"
            placeholder="Google email (e.g. name@planit.studio)"
            value=${form.email}
            onChange=${(e) => setForm({ ...form, email: e.target.value })}
            required
            autoFocus
          />
          <input
            type="text"
            placeholder="Full name"
            value=${form.name}
            onChange=${(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Title / position (optional)"
            value=${form.title}
            onChange=${(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="qc-cell">
          <div className="qc-row">
            <span>Department</span>
            <${Select}
              variant="field"
              ariaLabel="Department"
              value=${form.dept || (teams[0] && teams[0].name) || 'VDC'}
              minMenuWidth=${180}
              options=${(teams.length ? teams : [{ name: 'VDC' }]).map((t) => [t.name, t.name])}
              onChange=${(v) => setForm({ ...form, dept: v })}
            />
          </div>
          <div className="qc-row">
            <span>Role</span>
            <${Select}
              variant="field"
              ariaLabel="Role"
              value=${form.role}
              minMenuWidth=${180}
              options=${Object.entries(ROLES)
                .filter(([k]) => k !== 'SuperAdmin' || isSuperAdmin)
                .map(([k, v]) => [k, v])}
              onChange=${(v) => setForm({ ...form, role: v })}
            />
          </div>
        </div>
        <p className="pl-sheet-foot">Saves directly to Supabase public.users for Google OAuth sign-in.</p>
      </form>
    </div>`,
    portalRoot
  );
}

export function ConfirmUserActionSheet({
  target,
  activeUsers = [],
  fallbackUserId,
  setFallbackUserId,
  busy,
  onClose,
  onConfirm,
}) {
  const portalRoot = typeof document !== 'undefined' ? document.body : null;
  if (!portalRoot || !target) return null;

  const isDelete = target.mode === 'delete';
  const fallbackOptions = activeUsers
    .filter((u) => u.id !== target.user.id && normRole(u.role) !== 'Guest')
    .map((u) => [u.id, u.name, false, null, ROLES[normRole(u.role)]]);

  return createPortal(
    html`<div
      className="qc-ov"
      onMouseDown=${(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown=${(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="qc-sheet" role="dialog" aria-modal="true">
        <div className="qc-sh">
          <button type="button" className="qc-sh-cancel" onClick=${onClose}>Cancel</button>
          <b>${isDelete ? 'Delete User' : 'Deactivate User'}</b>
          <button
            type="button"
            className="btn sm p qc-sh-save"
            style=${{ background: '#ff3b30' }}
            disabled=${busy || fallbackOptions.length === 0}
            onClick=${onConfirm}
          >
            ${busy ? 'Working…' : isDelete ? 'Delete' : 'Deactivate'}
          </button>
        </div>
        <div className="cd-warn-box">
          <b>${target.user.name}</b> (${target.user.email})
          ${isDelete
            ? ' will be permanently removed from Supabase public.users & auth.users. Owned standards and categories are reassigned before deletion.'
            : ' will immediately lose workspace access while preserving historical attribution. Owned items transfer to the fallback owner.'}
        </div>
        <div className="qc-cell">
          <div className="qc-row">
            <span>Transfer ownership to</span>
            <${Select}
              variant="field"
              ariaLabel="Fallback Owner"
              value=${fallbackUserId}
              minMenuWidth=${200}
              options=${fallbackOptions}
              onChange=${setFallbackUserId}
            />
          </div>
        </div>
      </div>
    </div>`,
    portalRoot
  );
}
