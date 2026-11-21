import { createPortal } from 'react-dom';
import { Fragment, html, useEffect, useRef, useState } from '../../lib/react.js';
import { ROLES, can, normRole } from '../../config/constants.js';
import { buildFlat } from '../../data/spaces.js';
import { Ic } from '../../components/Icon.js';
import { Avatar } from '../../components/Badge.js';
import { Select } from '../../components/Select.js';

const ROLE_COL = {
  SuperAdmin: '#8e5cf7',
  Admin: '#0071e3',
  Editor: '#30d158',
  Member: '#8e8e93',
  Guest: '#ff9f0a',
};

const EllipsisDots = () => html`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <circle cx="5" cy="12" r="2" />
  <circle cx="12" cy="12" r="2" />
  <circle cx="19" cy="12" r="2" />
</svg>`;

export function TeamView({
  users = [],
  teams = [],
  res = [],
  tree = [],
  role,
  userName,
  currentUserId,
  directorySyncState = 'synced',
  onInviteUser,
  onDeleteUser,
  onDeactivateUser,
  onCreateTeam,
  onToggleTeamMember,
  onFilterByOwner,
  onSelectCat,
  onOpenAdminUsers,
  flash,
}) {
  const [tab, setTab] = useState('people');
  const [search, setSearch] = useState('');
  const [mobSearchOpen, setMobSearchOpen] = useState(false);
  const [teamFilter, setTeamFilter] = useState('');
  const [inviting, setInviting] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [busy, setBusy] = useState(false);

  const [invite, setInvite] = useState({ name: '', email: '', title: '', dept: '', role: 'Member' });
  const [newTeam, setNewTeam] = useState({ name: '', desc: '', color: '#0071e3', lead: userName });

  // Portaled row `⋯` action menu + Delete/Deactivate confirmation sheet
  const [rowMenu, setRowMenu] = useState(null); // { user, left, top }
  const [confirmTarget, setConfirmTarget] = useState(null); // { mode: 'delete' | 'deactivate', user }
  const [fallbackUserId, setFallbackUserId] = useState('');
  const menuRef = useRef(null);
  const searchInpRef = useRef(null);

  const isAdmin = can.admin(role);
  const isSuperAdmin = can.superAdmin(role);
  const flatCats = buildFlat(tree);
  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  useEffect(() => {
    if (!rowMenu) return;
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (e.target && e.target.closest && e.target.closest('.cd-more-btn')) return;
      setRowMenu(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setRowMenu(null);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [rowMenu]);

  const activeUsers = users.filter((u) => u.status !== 'deactivated');
  const filteredUsers = activeUsers.filter((u) => {
    const q = search.trim().toLowerCase();
    if (teamFilter && u.dept !== teamFilter && !(u.teams || []).includes(teamFilter)) return false;
    if (!q) return true;
    return `${u.name} ${u.email} ${u.title || ''} ${u.dept || ''} ${ROLES[normRole(u.role)]}`.toLowerCase().includes(q);
  });

  const handleInviteSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!onInviteUser || busy) return;
    setBusy(true);
    try {
      const ok = await onInviteUser({
        ...invite,
        dept: invite.dept || (teams[0] && teams[0].name) || 'VDC',
      });
      if (ok) {
        setInviting(false);
        setInvite({ name: '', email: '', title: '', dept: '', role: 'Member' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTeamSubmit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!onCreateTeam || busy) return;
    setBusy(true);
    try {
      const leadUser = activeUsers.find((u) => u.name === newTeam.lead);
      const ok = await onCreateTeam({
        ...newTeam,
        leadUserId: leadUser ? leadUser.id : '',
      });
      if (ok) {
        setCreatingTeam(false);
        setNewTeam({ name: '', desc: '', color: '#0071e3', lead: userName });
      }
    } finally {
      setBusy(false);
    }
  };

  const openRowMenu = (e, u) => {
    e.stopPropagation();
    if (rowMenu && rowMenu.user.id === u.id) {
      setRowMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const w = 216;
    const left = Math.min(Math.max(10, r.right - w), window.innerWidth - w - 10);
    const top = Math.min(r.bottom + 6, window.innerHeight - 200);
    setRowMenu({ user: u, left, top });
  };

  const openConfirm = (mode, u) => {
    const candidates = activeUsers.filter(
      (x) => x.id !== u.id && normRole(x.role) !== 'Guest' && normRole(x.role) !== 'Member'
    );
    const fallback = candidates[0] || activeUsers.find((x) => x.id !== u.id);
    setFallbackUserId(fallback ? fallback.id : '');
    setConfirmTarget({ mode, user: u });
    setRowMenu(null);
  };

  const runConfirmAction = async () => {
    if (!confirmTarget || busy) return;
    setBusy(true);
    try {
      const { mode, user } = confirmTarget;
      const fallbackObj = users.find((x) => x.id === fallbackUserId);
      const fallbackName = fallbackObj ? fallbackObj.name : userName;
      if (mode === 'delete' && onDeleteUser) {
        await onDeleteUser(user, fallbackUserId, fallbackName);
      } else if (mode === 'deactivate' && onDeactivateUser) {
        await onDeactivateUser(user.id, user.name, fallbackName, fallbackUserId);
      }
      setConfirmTarget(null);
    } finally {
      setBusy(false);
    }
  };

  return html`<div className="cd-wrap">
    <div className="cd-head">
      <div className="cd-head-l">
        <div className="seg" role="tablist" aria-label="Directory tabs">
          ${[
            ['people', `People (${activeUsers.length})`],
            ['teams', `Teams (${teams.length})`],
            ['roles', 'Roles'],
          ].map(
            ([k, lb]) => html`<button
              key=${k}
              type="button"
              role="tab"
              aria-selected=${tab === k}
              className=${tab === k ? 'on' : ''}
              onClick=${() => setTab(k)}
            >
              ${lb}
            </button>`
          )}
        </div>
      </div>

      <div className="cd-head-r">
        ${tab === 'people' &&
        html`<button
          type="button"
          className=${'pl-ico-btn cd-mob-only' + (mobSearchOpen || search ? ' on' : '')}
          title="Search people"
          aria-label="Toggle search"
          onClick=${() => {
            setMobSearchOpen((v) => !v);
            setTimeout(() => searchInpRef.current && searchInpRef.current.focus(), 40);
          }}
        >
          <${Ic} n="search" s=${15} />
        </button>`}

        ${isAdmin &&
        tab === 'people' &&
        html`<button
          type="button"
          className="btn p"
          onClick=${() => {
            setInvite({ name: '', email: '', title: '', dept: (teams[0] && teams[0].name) || 'VDC', role: 'Member' });
            setInviting(true);
          }}
        >
          <${Ic} n="plus" s=${14} />
          <span>Invite</span>
        </button>`}

        ${isAdmin &&
        tab === 'teams' &&
        html`<button type="button" className="btn p" onClick=${() => setCreatingTeam(true)}>
          <${Ic} n="plus" s=${14} />
          <span>New Team</span>
        </button>`}
      </div>
    </div>

    ${tab === 'people' &&
    html`<${Fragment}>
      <div className="cd-subbar">
        <div className="cd-meta">
          <i
            className=${'cd-sync-dot' +
            (directorySyncState === 'loading' || directorySyncState === 'saving'
              ? ' busy'
              : directorySyncState === 'error'
              ? ' err'
              : '')}
          />
          <span>
            ${filteredUsers.length} of ${activeUsers.length} active · ${directorySyncState === 'loading'
              ? 'Syncing…'
              : directorySyncState === 'error'
              ? 'Offline cache'
              : 'Synced with Supabase'}
          </span>
        </div>
        ${isAdmin &&
        onOpenAdminUsers &&
        html`<button type="button" className="mn" style=${{ fontSize: 12.5, whiteSpace: 'nowrap', flex: 'none' }} onClick=${onOpenAdminUsers}>
          Manage Access ›
        </button>`}
      </div>

      <div className=${'cd-filterbar' + (mobSearchOpen || search ? ' mob-search-on' : '')}>
        <div className="pl-search">
          <${Ic} n="search" s=${14} />
          <input
            ref=${searchInpRef}
            type="search"
            placeholder="Search people…"
            value=${search}
            onChange=${(e) => setSearch(e.target.value)}
          />
          ${search &&
          html`<button type="button" className="pl-search-clr" aria-label="Clear search" onClick=${() => setSearch('')}>
            <${Ic} n="x" s=${11} />
          </button>`}
        </div>

        <div className="pl-chips-row">
          <button
            type="button"
            className=${'pl-chip' + (!teamFilter ? ' on' : '')}
            onClick=${() => setTeamFilter('')}
          >
            All Teams
          </button>
          ${teams.map(
            (t) => html`<button
              key=${t.id}
              type="button"
              className=${'pl-chip' + (teamFilter === t.name ? ' on' : '')}
              onClick=${() => setTeamFilter((prev) => (prev === t.name ? '' : t.name))}
            >
              ${t.name}
            </button>`
          )}
        </div>
      </div>

      ${filteredUsers.length > 0
        ? html`<div className="cd-card">
            ${filteredUsers.map((u) => {
              const rKey = normRole(u.role);
              const ownedCount = res.filter((r) => r.author === u.name && r.status !== 'Archived').length;
              const isSelf = u.id === currentUserId || (u.name && u.name === userName);
              const subParts = [u.email, u.dept, u.title].filter(Boolean);
              return html`<div key=${u.id} className="cd-row">
                <${Avatar} user=${u} size="md" />
                <div className="cd-row-tx">
                  <div className="cd-row-t">
                    <span className="cd-row-name">${u.name}</span>
                    ${isSelf && html`<span className="cd-tag you">You</span>`}
                    ${u.status === 'invited' && html`<span className="cd-tag warn">Invited</span>`}
                  </div>
                  <div className="cd-row-s">${subParts.join(' · ')}</div>
                </div>
                <div className="cd-row-end">
                  ${ownedCount > 0 && html`<span className="cd-count-lbl">${ownedCount} items</span>`}
                  <span className="cd-role-pill" style=${{ '--c': ROLE_COL[rKey] || '#8e8e93' }}>
                    <i />
                    ${ROLES[rKey]}
                  </span>
                  <button
                    type="button"
                    className="cd-more-btn"
                    title="Member actions"
                    aria-label=${`Actions for ${u.name}`}
                    onClick=${(e) => openRowMenu(e, u)}
                  >
                    <${EllipsisDots} />
                  </button>
                </div>
              </div>`;
            })}
          </div>`
        : html`<div className="empty" style=${{ padding: '56px 16px' }}>
            <${Ic} n="users" s=${26} />
            <b>No matching members</b>
            <span>Try clearing your search query or switching team filters.</span>
          </div>`}
    </${Fragment}>`}

    ${tab === 'teams' &&
    html`<div className="cd-teams-grid">
      ${teams.map((tm) => {
        const teamUsers = activeUsers.filter(
          (u) => (tm.members || []).includes(u.name) || u.dept === tm.name || (u.teams || []).includes(tm.name)
        );
        const teamCats = flatCats.filter(
          (c) => c.name === tm.name || (c.teams || []).includes(tm.name) || c.path[0] === tm.name
        );
        const candidates = activeUsers.filter(
          (u) => normRole(u.role) !== 'Guest' && !teamUsers.some((m) => m.id === u.id)
        );
        return html`<section key=${tm.id} className="cd-team-card">
          <div className="cd-team-top">
            <span className="cd-team-ico" style=${{ '--c': tm.color || '#0a84ff' }}>
              <${Ic} n="teams" s=${16} />
            </span>
            <div className="cd-team-top-t">
              <b>${tm.name}</b>
              <small>${tm.lead ? `Lead: ${tm.lead} · ` : ''}${teamUsers.length} members</small>
            </div>
          </div>
          ${tm.desc && html`<p className="cd-team-desc">${tm.desc}</p>`}

          ${teamCats.length > 0 &&
          html`<div className="cd-team-spaces">
            ${teamCats.slice(0, 4).map(
              (c) => html`<button
                key=${c.id}
                type="button"
                className="pl-chip"
                style=${{ height: 24, fontSize: 11.5, padding: '0 9px' }}
                onClick=${() => onSelectCat && onSelectCat(c.id)}
              >
                ${c.name}
              </button>`
            )}
          </div>`}

          <div className="cd-team-mems">
            ${teamUsers.length > 0
              ? teamUsers.map(
                  (u) => html`<div key=${u.id} className="cd-team-mem">
                    <${Avatar} user=${u} size="sm" />
                    <div className="cd-team-mem-tx">
                      <b>${u.name}</b>
                      <small>${u.title || ROLES[normRole(u.role)]}</small>
                    </div>
                    <span className="cd-role-pill" style=${{ '--c': ROLE_COL[normRole(u.role)] || '#8e8e93' }}>
                      ${ROLES[normRole(u.role)]}
                    </span>
                    ${isAdmin &&
                    u.name !== tm.lead &&
                    onToggleTeamMember &&
                    html`<button
                      type="button"
                      className="cd-more-btn"
                      style=${{ width: 26, height: 26 }}
                      title=${`Remove ${u.name} from ${tm.name}`}
                      onClick=${() => onToggleTeamMember(tm, u, false)}
                    >
                      <${Ic} n="x" s=${12} />
                    </button>`}
                  </div>`
                )
              : html`<div style=${{ padding: '12px 16px', fontSize: 12.5, color: 'var(--sub)' }}>No active members yet.</div>`}
          </div>

          ${isAdmin &&
          candidates.length > 0 &&
          onToggleTeamMember &&
          html`<div className="cd-team-foot">
            <${Select}
              variant="field"
              ariaLabel=${`Add member to ${tm.name}`}
              placeholder="+ Add member to team…"
              value=""
              options=${[['', 'Add member…'], ...candidates.map((u) => [u.id, u.name, false, null, ROLES[normRole(u.role)]])]}
              onChange=${(uid) => {
                const usr = candidates.find((c) => c.id === uid);
                if (usr) onToggleTeamMember(tm, usr, true);
              }}
            />
          </div>`}
        </section>`;
      })}
    </div>`}

    ${tab === 'roles' &&
    html`<div className="cd-table-wrap">
      <table className="cd-table">
        <thead>
          <tr>
            <th>Capability</th>
            ${Object.values(ROLES).map((n) => html`<th key=${n}>${n}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${[
            ['Read Public & External Portal', [1, 1, 1, 1, 1]],
            ['Read Internal & Restricted (if Permitted)', [1, 1, 1, 1, 0]],
            ['Comment, Bookmark & Ask Datum AI', [1, 1, 1, 1, 0]],
            ['Create Drafts & Edit Owned Items', [1, 1, 1, 0, 0]],
            ['Edit Category Content & Subcategories', [1, 1, 1, 0, 0]],
            ['Approve / Publish / Archive Content', [1, 1, 0, 0, 0]],
            ['Publish Externally (Public Portal)', [1, 1, 0, 0, 0]],
            ['Manage Users, Roles & Delete Accounts', [1, 1, 0, 0, 0]],
            ['Assign Super Admin & Root Governance', [1, 0, 0, 0, 0]],
          ].map(
            ([label, flags]) => html`<tr key=${label}>
              <td>${label}</td>
              ${flags.map(
                (ok, idx) => html`<td key=${idx}>
                  ${ok ? html`<span className="ok"><${Ic} n="check" s=${15} /></span>` : html`<span className="no">–</span>`}
                </td>`
              )}
            </tr>`
          )}
        </tbody>
      </table>
    </div>`}

    ${portalRoot &&
    rowMenu &&
    createPortal(
      html`<div
        ref=${menuRef}
        className="asel-menu"
        style=${{ left: `${rowMenu.left}px`, top: `${rowMenu.top}px`, width: '244px' }}
        role="menu"
      >
        <button
          type="button"
          className="asel-opt"
          onClick=${() => {
            const name = rowMenu.user.name;
            setRowMenu(null);
            onFilterByOwner && onFilterByOwner(name);
          }}
        >
          <span className="asel-ck"><${Ic} n="doc" s=${13} /></span>
          <span className="asel-tx"><span>View Authored Items</span></span>
        </button>

        ${isAdmin &&
        onOpenAdminUsers &&
        html`<button
          type="button"
          className="asel-opt"
          onClick=${() => {
            setRowMenu(null);
            onOpenAdminUsers();
          }}
        >
          <span className="asel-ck"><${Ic} n="sliders" s=${13} /></span>
          <span className="asel-tx"><span>Manage Roles & Lifecycle…</span></span>
        </button>`}

        ${isAdmin &&
        rowMenu.user.id !== currentUserId &&
        !(normRole(rowMenu.user.role) === 'SuperAdmin' && !isSuperAdmin) &&
        html`<${Fragment}>
          <div className="pl-menu-div" />
          <button
            type="button"
            className="asel-opt"
            onClick=${() => openConfirm('deactivate', rowMenu.user)}
          >
            <span className="asel-ck"><${Ic} n="lock" s=${13} /></span>
            <span className="asel-tx"><span>Deactivate & Handover…</span></span>
          </button>
          <button
            type="button"
            className="asel-opt ctx-dng"
            onClick=${() => openConfirm('delete', rowMenu.user)}
          >
            <span className="asel-ck" style=${{ color: 'inherit' }}><${Ic} n="trash" s=${13} /></span>
            <span className="asel-tx"><span>Delete from Database…</span></span>
          </button>
        </${Fragment}>`}
      </div>`,
      portalRoot
    )}

    ${portalRoot &&
    inviting &&
    createPortal(
      html`<div
        className="qc-ov"
        onMouseDown=${(e) => {
          if (e.target === e.currentTarget) setInviting(false);
        }}
        onKeyDown=${(e) => {
          if (e.key === 'Escape') setInviting(false);
        }}
      >
        <form className="qc-sheet" role="dialog" aria-modal="true" aria-label="Invite Member" onSubmit=${handleInviteSubmit}>
          <div className="qc-sh">
            <button type="button" className="qc-sh-cancel" onClick=${() => setInviting(false)}>Cancel</button>
            <b>Invite Member</b>
            <button type="submit" className="btn sm p qc-sh-save" disabled=${busy || !invite.email.trim()}>
              ${busy ? 'Saving…' : 'Invite'}
            </button>
          </div>
          <div className="qc-cell">
            <input
              type="email"
              placeholder="Google email (e.g. name@planit.studio)"
              value=${invite.email}
              onChange=${(e) => setInvite({ ...invite, email: e.target.value })}
              required
              autoFocus
            />
            <input
              type="text"
              placeholder="Full name"
              value=${invite.name}
              onChange=${(e) => setInvite({ ...invite, name: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Title / position (optional)"
              value=${invite.title}
              onChange=${(e) => setInvite({ ...invite, title: e.target.value })}
            />
          </div>
          <div className="qc-cell">
            <div className="qc-row">
              <span>Department</span>
              <${Select}
                variant="field"
                ariaLabel="Department"
                value=${invite.dept || (teams[0] && teams[0].name) || 'VDC'}
                minMenuWidth=${180}
                options=${(teams.length ? teams : [{ name: 'VDC' }]).map((t) => [t.name, t.name])}
                onChange=${(v) => setInvite({ ...invite, dept: v })}
              />
            </div>
            <div className="qc-row">
              <span>Role</span>
              <${Select}
                variant="field"
                ariaLabel="Role"
                value=${invite.role}
                minMenuWidth=${180}
                options=${Object.entries(ROLES)
                  .filter(([k]) => k !== 'SuperAdmin' || isSuperAdmin)
                  .map(([k, v]) => [k, v])}
                onChange=${(v) => setInvite({ ...invite, role: v })}
              />
            </div>
          </div>
          <p className="pl-sheet-foot">Creates a live workspace user in Supabase ready for Google OAuth sign-in.</p>
        </form>
      </div>`,
      portalRoot
    )}

    ${portalRoot &&
    creatingTeam &&
    createPortal(
      html`<div
        className="qc-ov"
        onMouseDown=${(e) => {
          if (e.target === e.currentTarget) setCreatingTeam(false);
        }}
        onKeyDown=${(e) => {
          if (e.key === 'Escape') setCreatingTeam(false);
        }}
      >
        <form className="qc-sheet" role="dialog" aria-modal="true" aria-label="New Team" onSubmit=${handleCreateTeamSubmit}>
          <div className="qc-sh">
            <button type="button" className="qc-sh-cancel" onClick=${() => setCreatingTeam(false)}>Cancel</button>
            <b>New Team</b>
            <button type="submit" className="btn sm p qc-sh-save" disabled=${busy || !newTeam.name.trim()}>
              ${busy ? 'Saving…' : 'Create'}
            </button>
          </div>
          <div className="qc-cell">
            <input
              type="text"
              placeholder="Team name (e.g. MEP Coordination)"
              value=${newTeam.name}
              onChange=${(e) => setNewTeam({ ...newTeam, name: e.target.value })}
              required
              autoFocus
            />
            <input
              type="text"
              placeholder="Focus area & scope (optional)"
              value=${newTeam.desc}
              onChange=${(e) => setNewTeam({ ...newTeam, desc: e.target.value })}
            />
          </div>
          <div className="qc-cell">
            <div className="qc-row">
              <span>Team Lead</span>
              <${Select}
                variant="field"
                ariaLabel="Team Lead"
                value=${newTeam.lead}
                minMenuWidth=${190}
                options=${activeUsers.filter((u) => normRole(u.role) !== 'Guest').map((u) => [u.name, u.name])}
                onChange=${(v) => setNewTeam({ ...newTeam, lead: v })}
              />
            </div>
            <div className="qc-row">
              <span>Color</span>
              <div className="pdl-comp-sw" style=${{ marginTop: 0 }}>
                ${['#0071e3', '#8e5cf7', '#ff375f', '#34c759', '#ff9f0a', '#30b0c7'].map(
                  (hex) => html`<button
                    key=${hex}
                    type="button"
                    className=${newTeam.color === hex ? 'on' : ''}
                    style=${{ background: hex }}
                    onClick=${() => setNewTeam({ ...newTeam, color: hex })}
                  />`
                )}
              </div>
            </div>
          </div>
        </form>
      </div>`,
      portalRoot
    )}

    ${portalRoot &&
    confirmTarget &&
    createPortal(
      html`<div
        className="qc-ov"
        onMouseDown=${(e) => {
          if (e.target === e.currentTarget) setConfirmTarget(null);
        }}
        onKeyDown=${(e) => {
          if (e.key === 'Escape') setConfirmTarget(null);
        }}
      >
        <div className="qc-sheet" role="dialog" aria-modal="true">
          <div className="qc-sh">
            <button type="button" className="qc-sh-cancel" onClick=${() => setConfirmTarget(null)}>Cancel</button>
            <b>${confirmTarget.mode === 'delete' ? 'Delete User' : 'Deactivate User'}</b>
            <button
              type="button"
              className="btn sm p qc-sh-save"
              style=${{ background: '#ff3b30' }}
              disabled=${busy}
              onClick=${runConfirmAction}
            >
              ${busy ? 'Working…' : confirmTarget.mode === 'delete' ? 'Delete' : 'Deactivate'}
            </button>
          </div>
          <div className="cd-warn-box">
            <b>${confirmTarget.user.name}</b> (${confirmTarget.user.email})
            ${confirmTarget.mode === 'delete'
              ? ' will be permanently removed from Supabase public.users & auth.users. Any owned documents or categories will be safely reassigned first.'
              : ' will lose sign-in access immediately while keeping historical version attribution. Owned items and categories will transfer to the fallback owner.'}
          </div>
          <div className="qc-cell">
            <div className="qc-row">
              <span>Transfer ownership to</span>
              <${Select}
                variant="field"
                ariaLabel="Fallback Owner"
                value=${fallbackUserId}
                minMenuWidth=${200}
                options=${activeUsers
                  .filter((u) => u.id !== confirmTarget.user.id && normRole(u.role) !== 'Guest')
                  .map((u) => [u.id, u.name, false, null, ROLES[normRole(u.role)]])}
                onChange=${setFallbackUserId}
              />
            </div>
          </div>
        </div>
      </div>`,
      portalRoot
    )}
  </div>`;
}
