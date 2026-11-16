import { createPortal } from 'react-dom';
import { Fragment, html, useEffect, useRef, useState } from '../../lib/react.js';
import { ROLES, VIS, TODAY, can, normRole } from '../../config/constants.js';
import { buildFlat } from '../../data/spaces.js';
import { days } from '../../utils/format.js';
import { edgeClient } from '../../lib/edgeClient.js';
import { Ic } from '../../components/Icon.js';
import { Avatar, VisPill } from '../../components/Badge.js';
import { Select } from '../../components/Select.js';
import {
  ROLE_COL,
  EllipsisDots,
  UserRowActionMenu,
  InviteUserSheet,
  ConfirmUserActionSheet,
} from '../../components/UserDirectoryModals.js';

export function AdminView(p) {
  const {
    res = [],
    tree = [],
    setTree,
    users = [],
    teams = [],
    cols = [],
    activities = [],
    searchLogs = [],
    acks = {},
    req = [],
    role,
    userName,
    currentUserId,
    flaggedIds = [],
    initialTab = 'gov',
    directorySyncState = 'synced',
    onRead,
    onApprove,
    onReject,
    onVerify,
    onRevokePublic,
    onOpenPublic,
    onRenameTag,
    onDeleteTag,
    onInviteUser,
    onUpdateUserRole,
    onDeactivateUser,
    onReactivateUser,
    onDeleteUser,
    onFilterByOwner,
    onCreateForTopic,
    flash,
  } = p;

  const [tab, setTab] = useState(initialTab || 'gov');
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const [scan, setScan] = useState(null);
  const [busyScan, setBusyScan] = useState(false);

  const [userQ, setUserQ] = useState('');
  const [mobSearchOpen, setMobSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [inviting, setInviting] = useState(false);

  const [creatingCat, setCreatingCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', parentId: '', owner: userName, vis: 'Internal', reqApproval: true, reviewDays: 90 });

  const [editTag, setEditTag] = useState(null);
  const [tagTarget, setTagTarget] = useState('');

  const [rowMenu, setRowMenu] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [fallbackUserId, setFallbackUserId] = useState('');
  const [busyUserAction, setBusyUserAction] = useState(false);
  const searchInpRef = useRef(null);

  const portalRoot = typeof document !== 'undefined' ? document.body : null;
  const flatCats = buildFlat(tree);
  const isAdmin = can.admin(role);
  const isSuperAdmin = can.superAdmin(role);

  const governedItems = res.filter((r) => {
    if (isAdmin) return true;
    const cat = flatCats.find((c) => c.id === r.node);
    return cat && cat.owner === userName;
  });

  const inReview = governedItems.filter((r) => r.status === 'Review');
  const staleItems = governedItems.filter((r) => {
    const cat = flatCats.find((c) => c.id === r.node);
    const cycle = (cat && cat.reviewDays) || 90;
    return r.status === 'Approved' && days(r.verified || r.upd) > cycle;
  });
  const flaggedItems = governedItems.filter((r) => flaggedIds.includes(r.id));
  const publicItems = res.filter((r) => r.vis === 'Public' && r.status === 'Approved');
  const publicCols = cols.filter((c) => c.vis === 'Public');

  const tagCounts = {};
  res.forEach((r) => (r.tags || []).forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)));
  const allTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  const approvedCount = res.filter((r) => r.status === 'Approved').length;
  const stalePct = approvedCount ? Math.round((staleItems.length / approvedCount) * 100) : 0;
  const reqDone = req.filter((id) => Boolean(acks[id])).length;
  const zeroSearches = searchLogs.filter((l) => l.resultCount === 0);

  const runEdgeGovernance = async () => {
    setBusyScan(true);
    try {
      const out = await edgeClient.governance({
        items: res,
        categories: flatCats,
        today: TODAY,
        requiredIds: req,
        acks,
      });
      setScan(out);
      flash('Governance scan completed');
    } finally {
      setBusyScan(false);
    }
  };

  const addCategory = () => {
    if (!newCat.name.trim()) return;
    const id = newCat.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18) + '-' + Date.now().toString(36).slice(-3);
    const entry = {
      id,
      name: newCat.name.trim(),
      owner: newCat.owner || userName,
      vis: newCat.vis,
      reqApproval: newCat.reqApproval,
      reviewDays: Number(newCat.reviewDays) || 90,
      kids: [],
    };
    if (!newCat.parentId) {
      setTree([...tree, { ...entry, color: '#0a84ff' }]);
    } else {
      const insertChild = (nodes) =>
        nodes.map((n) =>
          n.id === newCat.parentId
            ? { ...n, kids: [...(n.kids || []), entry] }
            : n.kids
            ? { ...n, kids: insertChild(n.kids) }
            : n
        );
      setTree(insertChild(tree));
    }
    setNewCat({ name: '', parentId: '', owner: userName, vis: 'Internal', reqApproval: true, reviewDays: 90 });
    flash('Category created');
  };

  const updateCatProp = (catId, patch) => {
    const walk = (nodes) =>
      nodes.map((n) => (n.id === catId ? { ...n, ...patch } : n.kids ? { ...n, kids: walk(n.kids) } : n));
    setTree(walk(tree));
    flash('Category updated');
  };

  const eligibleParents = flatCats.filter((c) => c.level < 3 && (isAdmin || c.owner === userName));
  const activeUsers = users.filter((u) => u.status !== 'deactivated');
  const deactivatedUsers = users.filter((u) => u.status === 'deactivated');

  const filteredUsers = users.filter((u) => {
    if (statusFilter === 'active' && u.status === 'deactivated') return false;
    if (statusFilter === 'deactivated' && u.status !== 'deactivated') return false;
    const qL = userQ.trim().toLowerCase();
    if (!qL) return true;
    return `${u.name} ${u.email} ${u.dept || ''} ${ROLES[normRole(u.role)]}`.toLowerCase().includes(qL);
  });

  const roleOptions = Object.entries(ROLES).map(([k, lbl]) => [k, lbl, false, ROLE_COL[k]]);

  const openRowMenu = (e, u) => {
    e.stopPropagation();
    if (rowMenu && rowMenu.user.id === u.id) {
      setRowMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const w = 220;
    const left = Math.min(Math.max(10, r.right - w), window.innerWidth - w - 10);
    const top = Math.min(r.bottom + 6, window.innerHeight - 210);
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
    if (!confirmTarget || busyUserAction) return;
    setBusyUserAction(true);
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
      setBusyUserAction(false);
    }
  };

  const handleInviteSubmit = async (form) => {
    if (!onInviteUser || busyUserAction) return;
    setBusyUserAction(true);
    try {
      const ok = await onInviteUser(form);
      if (ok) setInviting(false);
    } finally {
      setBusyUserAction(false);
    }
  };

  return html`<div className="cd-wrap">
    <div className="cd-head">
      <div className="cd-head-l">
        <div className="seg" role="tablist" aria-label="Administration sections">
          ${[
            ['gov', `Governance${inReview.length + staleItems.length > 0 ? ` (${inReview.length + staleItems.length})` : ''}`],
            ['cats', 'Structure'],
            ['users', `Users (${users.length})`],
            ['pub', `Public (${publicItems.length + publicCols.length})`],
            ['anl', 'Audit'],
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
        ${tab === 'users' &&
        html`<button
          type="button"
          className=${'pl-ico-btn cd-mob-only' + (mobSearchOpen || userQ ? ' on' : '')}
          title="Search users"
          aria-label="Toggle search"
          onClick=${() => {
            setMobSearchOpen((v) => !v);
            setTimeout(() => searchInpRef.current && searchInpRef.current.focus(), 40);
          }}
        >
          <${Ic} n="search" s=${15} />
        </button>`}

        ${tab === 'gov' &&
        html`<button type="button" className="btn p" disabled=${busyScan} onClick=${runEdgeGovernance}>
          <${Ic} n="shield" s=${14} />
          <span>${busyScan ? 'Scanning…' : 'Scan'}</span>
        </button>`}

        ${tab === 'cats' &&
        (isAdmin || eligibleParents.length > 0) &&
        html`<button type="button" className="btn p" onClick=${() => setCreatingCat(true)}>
          <${Ic} n="plus" s=${14} />
          <span>Category</span>
        </button>`}

        ${tab === 'users' &&
        isAdmin &&
        html`<button type="button" className="btn p" onClick=${() => setInviting(true)}>
          <${Ic} n="plus" s=${14} />
          <span>Invite</span>
        </button>`}
      </div>
    </div>

    ${tab === 'gov' &&
    html`<${Fragment}>
      ${scan &&
      html`<div className="cd-kpi-row" style=${{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <div className="cd-kpi">
          <b style=${{ color: scan.staleItems.length ? '#ff9f0a' : '#30d158' }}>${scan.staleItems.length}</b>
          <small>Stale Items</small>
        </div>
        <div className="cd-kpi">
          <b>${scan.missingSummaryItems.length}</b>
          <small>No Summary</small>
        </div>
        <div className="cd-kpi">
          <b>${scan.duplicateUrls.length}</b>
          <small>Duplicate URLs</small>
        </div>
        <div className="cd-kpi">
          <b>${scan.brokenDependencies.length}</b>
          <small>Broken Links</small>
        </div>
        <div className="cd-kpi">
          <b>${scan.requiredCompliance.acknowledgedCount}/${scan.requiredCompliance.requiredCount}</b>
          <small>Confirmed</small>
        </div>
      </div>`}

      <div className="cd-grid2">
        <section className="cd-card">
          <div className="cd-card-h">
            <b>Awaiting Approval</b>
            <small>${inReview.length}</small>
          </div>
          ${inReview.length > 0
            ? inReview.map(
                (r) => html`<div key=${r.id} className="cd-row is-inset-0">
                  <div className="cd-row-tx">
                    <button type="button" className="cd-row-link" onClick=${() => onRead && onRead(r.id)}>
                      ${r.title}
                    </button>
                    <div className="cd-row-s">${r.author} · Updated ${r.upd}</div>
                  </div>
                  <div className="cd-row-end">
                    <button type="button" className="btn sm p" onClick=${() => onApprove && onApprove(r.id)}>Publish</button>
                    <button type="button" className="btn sm" onClick=${() => onReject && onReject(r.id)}>Draft</button>
                  </div>
                </div>`
              )
            : html`<div style=${{ padding: '18px 16px', fontSize: 13, color: 'var(--sub)' }}>No items pending review.</div>`}
        </section>

        <section className="cd-card">
          <div className="cd-card-h">
            <b>Stale Verification</b>
            <small>${staleItems.length}</small>
          </div>
          ${staleItems.length > 0
            ? staleItems.map(
                (r) => html`<div key=${r.id} className="cd-row is-inset-0">
                  <div className="cd-row-tx">
                    <button type="button" className="cd-row-link" onClick=${() => onRead && onRead(r.id)}>
                      ${r.title}
                    </button>
                    <div className="cd-row-s">${r.author} · ${days(r.verified || r.upd)}d overdue</div>
                  </div>
                  <div className="cd-row-end">
                    <button type="button" className="btn sm" onClick=${() => onVerify && onVerify(r.id)}>Verify</button>
                  </div>
                </div>`
              )
            : html`<div style=${{ padding: '18px 16px', fontSize: 13, color: 'var(--sub)' }}>All published items are verified.</div>`}
        </section>
      </div>

      ${flaggedItems.length > 0 &&
      html`<section className="cd-card">
        <div className="cd-card-h">
          <b>Flagged Outdated / Broken Link</b>
          <small>${flaggedItems.length}</small>
        </div>
        ${flaggedItems.map(
          (r) => html`<div key=${r.id} className="cd-row is-inset-0">
            <div className="cd-row-tx">
              <button type="button" className="cd-row-link" onClick=${() => onRead && onRead(r.id)}>${r.title}</button>
              <div className="cd-row-s">Owner: ${r.author}</div>
            </div>
            <div className="cd-row-end">
              <button type="button" className="btn sm" onClick=${() => onVerify && onVerify(r.id)}>Resolve</button>
            </div>
          </div>`
        )}
      </section>`}
    </${Fragment}>`}

    ${tab === 'cats' &&
    html`<div className="cd-grid2">
      <section className="cd-card">
        <div className="cd-card-h">
          <b>Categories (Max 3 Levels)</b>
          <small>${flatCats.length}</small>
        </div>
        ${flatCats.map(
          (c) => html`<div
            key=${c.id}
            className="cd-row is-inset-0"
            style=${{ paddingLeft: 16 + (c.level - 1) * 14 }}
          >
            <div className="cd-row-tx">
              <span className="cd-row-name">${c.name}</span>
              <div className="cd-row-s">${c.owner} · ${c.reviewDays}d${c.reqApproval ? ' · Approval' : ''}</div>
            </div>
            <div className="cd-row-end">
              ${isAdmin
                ? html`<${Select}
                    variant="meta"
                    ariaLabel=${'Visibility ' + c.name}
                    color=${(VIS[c.vis] || VIS.Internal)[1]}
                    value=${c.vis}
                    options=${[
                      ['Internal', 'Internal', false, VIS.Internal[1]],
                      ['Restricted', 'Restricted', false, VIS.Restricted[1]],
                    ]}
                    onChange=${(v) => updateCatProp(c.id, { vis: v })}
                    minMenuWidth=${145}
                  />`
                : html`<${VisPill} v=${c.vis} />`}
            </div>
          </div>`
        )}
      </section>

      <section className="cd-card">
        <div className="cd-card-h">
          <b>Tags</b>
          <small>${allTags.length}</small>
        </div>
        ${allTags.length > 0
          ? allTags.map(
              ([t, cnt]) => html`<div key=${t} className="cd-row is-inset-0 pdl-tag-li">
                <div className="cd-row-tx">
                  <span className="cd-row-name">#${t}</span>
                  <div className="cd-row-s">${cnt} items</div>
                </div>
                ${editTag === t
                  ? html`<div className="cd-row-end">
                      <input
                        className="inp"
                        style=${{ width: 110, height: 28, minHeight: 0, padding: '0 10px', fontSize: 12.5 }}
                        value=${tagTarget}
                        onChange=${(e) => setTagTarget(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn sm p"
                        onClick=${() => {
                          onRenameTag && onRenameTag(t, tagTarget.trim());
                          setEditTag(null);
                        }}
                      >
                        Merge
                      </button>
                      <button type="button" className="btn sm" onClick=${() => setEditTag(null)}>Cancel</button>
                    </div>`
                  : html`<div className="cd-row-end pdl-hover-acts">
                      <button
                        type="button"
                        className="btn sm"
                        onClick=${() => {
                          setEditTag(t);
                          setTagTarget(t);
                        }}
                      >
                        Rename
                      </button>
                      ${isAdmin &&
                      html`<button
                        type="button"
                        className="btn sm"
                        style=${{ color: '#ff453a' }}
                        onClick=${() => onDeleteTag && onDeleteTag(t)}
                      >
                        Remove
                      </button>`}
                    </div>`}
              </div>`
            )
          : html`<div style=${{ padding: '18px 16px', fontSize: 13, color: 'var(--sub)' }}>No tags indexed yet.</div>`}
      </section>
    </div>`}

    ${tab === 'users' &&
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
            ${filteredUsers.length} of ${users.length} database accounts · ${directorySyncState === 'loading'
              ? 'Syncing…'
              : directorySyncState === 'saving'
              ? 'Saving changes…'
              : directorySyncState === 'error'
              ? 'Offline cache'
              : 'Synced with Supabase'}
          </span>
        </div>
      </div>

      <div className=${'cd-filterbar' + (mobSearchOpen || userQ ? ' mob-search-on' : '')}>
        <div className="pl-search">
          <${Ic} n="search" s=${14} />
          <input
            ref=${searchInpRef}
            type="search"
            placeholder="Search users…"
            value=${userQ}
            onChange=${(e) => setUserQ(e.target.value)}
          />
          ${userQ &&
          html`<button type="button" className="pl-search-clr" aria-label="Clear search" onClick=${() => setUserQ('')}>
            <${Ic} n="x" s=${11} />
          </button>`}
        </div>

        <div className="pl-chips-row">
          ${[
            ['all', 'All', users.length],
            ['active', 'Active', activeUsers.length],
            ...(deactivatedUsers.length > 0 ? [['deactivated', 'Deactivated', deactivatedUsers.length]] : []),
          ].map(
            ([k, lbl, cnt]) => html`<button
              key=${k}
              type="button"
              className=${'pl-chip' + (statusFilter === k ? ' on' : '')}
              onClick=${() => setStatusFilter(k)}
            >
              <span>${lbl}</span>
              <b>${cnt}</b>
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
              const isOff = u.status === 'deactivated';
              const canEditRole = isAdmin && !isOff && !(rKey === 'SuperAdmin' && !isSuperAdmin);
              const allowedRoleOptions = roleOptions.filter(([k]) => k !== 'SuperAdmin' || isSuperAdmin);

              return html`<div key=${u.id} className=${'cd-row' + (isOff ? ' is-off' : '')}>
                <${Avatar} user=${u} size="md" />
                <div className="cd-row-tx">
                  <div className="cd-row-t">
                    <span className="cd-row-name">${u.name}</span>
                    ${isSelf && html`<span className="cd-tag you">You</span>`}
                    ${isOff && html`<span className="cd-tag off">Deactivated</span>`}
                    ${!isOff && u.status === 'invited' && html`<span className="cd-tag warn">Invited</span>`}
                  </div>
                  <div className="cd-row-s">
                    ${u.email}${u.dept ? ` · ${u.dept}` : ''}${ownedCount > 0 ? ` · ${ownedCount} items` : ''}
                  </div>
                </div>
                <div className="cd-row-end">
                  ${canEditRole
                    ? html`<${Select}
                        variant="meta"
                        ariaLabel=${'Role for ' + u.name}
                        color=${ROLE_COL[rKey] || '#8e8e93'}
                        value=${rKey}
                        options=${allowedRoleOptions}
                        minMenuWidth=${175}
                        onChange=${(nextRole) => {
                          if (nextRole !== rKey && onUpdateUserRole) {
                            onUpdateUserRole(u, nextRole);
                          }
                        }}
                      />`
                    : html`<span className="cd-role-pill" style=${{ '--c': isOff ? '#ff453a' : ROLE_COL[rKey] || '#8e8e93' }}>
                        <i />
                        ${isOff ? 'Off' : ROLES[rKey]}
                      </span>`}

                  ${(isAdmin || onFilterByOwner) &&
                  html`<button
                    type="button"
                    className="cd-more-btn"
                    title="User actions"
                    aria-label=${`Manage ${u.name}`}
                    onClick=${(e) => openRowMenu(e, u)}
                  >
                    <${EllipsisDots} />
                  </button>`}
                </div>
              </div>`;
            })}
          </div>`
        : html`<div className="empty" style=${{ padding: '56px 16px' }}>
            <${Ic} n="users" s=${26} />
            <b>No matching users</b>
            <span>No database users match the selected filters.</span>
          </div>`}
    </${Fragment}>`}

    ${tab === 'pub' &&
    html`<div className="cd-grid2">
      <section className="cd-card">
        <div className="cd-card-h">
          <b>Public Documents</b>
          <small>${publicItems.length}</small>
        </div>
        ${publicItems.length > 0
          ? publicItems.map(
              (r) => html`<div key=${r.id} className="cd-row is-inset-0">
                <div className="cd-row-tx">
                  <button type="button" className="cd-row-link" onClick=${() => onRead && onRead(r.id)}>
                    ${r.title}
                  </button>
                  <div className="cd-row-s">Attachments: ${(r.publicAttachments || []).length} · ${r.author}</div>
                </div>
                <div className="cd-row-end">
                  <button type="button" className="btn sm" onClick=${() => onOpenPublic && onOpenPublic({ kind: 'item', data: r })}>
                    Preview
                  </button>
                  ${isAdmin &&
                  html`<button
                    type="button"
                    className="btn sm"
                    style=${{ color: '#ff453a' }}
                    onClick=${() => onRevokePublic && onRevokePublic('item', r.id)}
                  >
                    Revoke
                  </button>`}
                </div>
              </div>`
            )
          : html`<div style=${{ padding: '18px 16px', fontSize: 13, color: 'var(--sub)' }}>No items published externally.</div>`}
      </section>

      <section className="cd-card">
        <div className="cd-card-h">
          <b>Public Collections</b>
          <small>${publicCols.length}</small>
        </div>
        ${publicCols.length > 0
          ? publicCols.map(
              (c) => html`<div key=${c.id} className="cd-row is-inset-0">
                <div className="cd-row-tx">
                  <span className="cd-row-name">${c.name}</span>
                  <div className="cd-row-s">${(c.items || []).length} items · ${c.owner}</div>
                </div>
                <div className="cd-row-end">
                  <button
                    type="button"
                    className="btn sm"
                    onClick=${() => onOpenPublic && onOpenPublic({ kind: 'collection', data: c })}
                  >
                    Preview
                  </button>
                  ${isAdmin &&
                  html`<button
                    type="button"
                    className="btn sm"
                    style=${{ color: '#ff453a' }}
                    onClick=${() => onRevokePublic && onRevokePublic('collection', c.id)}
                  >
                    Revoke
                  </button>`}
                </div>
              </div>`
            )
          : html`<div style=${{ padding: '18px 16px', fontSize: 13, color: 'var(--sub)' }}>No active public collections.</div>`}
      </section>
    </div>`}

    ${tab === 'anl' &&
    html`<${Fragment}>
      <div className="cd-kpi-row">
        <div className="cd-kpi">
          <b>${approvedCount}</b>
          <small>Published Items</small>
        </div>
        <div className="cd-kpi">
          <b>${stalePct}%</b>
          <small>Stale Ratio</small>
        </div>
        <div className="cd-kpi">
          <b>${reqDone}/${req.length}</b>
          <small>Required Read</small>
        </div>
        <div className="cd-kpi">
          <b>${zeroSearches.length}</b>
          <small>Search Gaps</small>
        </div>
      </div>

      <div className="cd-grid2">
        <section className="cd-card">
          <div className="cd-card-h">
            <b>Zero-Result Searches</b>
            <small>${zeroSearches.length}</small>
          </div>
          ${zeroSearches.length > 0
            ? zeroSearches.map(
                (l, idx) => html`<div key=${idx} className="cd-row is-inset-0">
                  <div className="cd-row-tx">
                    <span className="cd-row-name">“${l.query}”</span>
                    <div className="cd-row-s">${l.at}</div>
                  </div>
                  <div className="cd-row-end">
                    <button type="button" className="btn sm p" onClick=${() => onCreateForTopic && onCreateForTopic(l.query)}>
                      + Create
                    </button>
                  </div>
                </div>`
              )
            : html`<div style=${{ padding: '18px 16px', fontSize: 13, color: 'var(--sub)' }}>No search gaps recorded yet.</div>`}
        </section>

        <section className="cd-card">
          <div className="cd-card-h">
            <b>Activity Audit</b>
            <small>${activities.length}</small>
          </div>
          ${activities.slice(0, 12).map(
            (a) => html`<div key=${a.id} className="cd-row">
              <div className="av sm">${(a.actor || 'S')[0]}</div>
              <div className="cd-row-tx">
                <span className="cd-row-name">${a.actor} · ${a.action}</span>
                <div className="cd-row-s">
                  ${a.targetTitle}${a.note ? ` — ${a.note}` : ''} · ${a.at}
                </div>
              </div>
            </div>`
          )}
        </section>
      </div>
    </${Fragment}>`}

    <${UserRowActionMenu}
      rowMenu=${rowMenu}
      onClose=${() => setRowMenu(null)}
      isAdmin=${isAdmin}
      isSuperAdmin=${isSuperAdmin}
      currentUserId=${currentUserId}
      onFilterByOwner=${onFilterByOwner}
      onReactivateUser=${onReactivateUser}
      onOpenConfirm=${openConfirm}
    />

    ${portalRoot &&
    creatingCat &&
    createPortal(
      html`<div
        className="qc-ov"
        onMouseDown=${(e) => {
          if (e.target === e.currentTarget) setCreatingCat(false);
        }}
        onKeyDown=${(e) => {
          if (e.key === 'Escape') setCreatingCat(false);
        }}
      >
        <form
          className="qc-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="New Category"
          onSubmit=${(e) => {
            e.preventDefault();
            if (!newCat.name.trim()) return;
            addCategory();
            setCreatingCat(false);
          }}
        >
          <div className="qc-sh">
            <button type="button" className="qc-sh-cancel" onClick=${() => setCreatingCat(false)}>Cancel</button>
            <b>New Category</b>
            <button type="submit" className="btn sm p qc-sh-save" disabled=${!newCat.name.trim()}>Create</button>
          </div>
          <div className="qc-cell">
            <input
              type="text"
              placeholder="Category name (e.g. BIM Automation)"
              value=${newCat.name}
              onChange=${(e) => setNewCat({ ...newCat, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="qc-cell">
            <div className="qc-row">
              <span>Parent Space</span>
              <${Select}
                variant="field"
                ariaLabel="Parent Space"
                value=${newCat.parentId}
                minMenuWidth=${210}
                options=${[
                  ...(isAdmin ? [['', 'Root (Level 1)']] : []),
                  ...eligibleParents.map((c) => [c.id, c.path.join(' › ')]),
                ]}
                onChange=${(v) => setNewCat({ ...newCat, parentId: v })}
              />
            </div>
            <div className="qc-row">
              <span>Owner</span>
              <${Select}
                variant="field"
                ariaLabel="Category Owner"
                value=${newCat.owner}
                minMenuWidth=${190}
                options=${activeUsers
                  .filter((u) => normRole(u.role) !== 'Guest' && normRole(u.role) !== 'Member')
                  .map((u) => [u.name, u.name, false, null, ROLES[normRole(u.role)]])}
                onChange=${(v) => setNewCat({ ...newCat, owner: v })}
              />
            </div>
            <div className="qc-row">
              <span>Visibility</span>
              <${Select}
                variant="field"
                ariaLabel="Default Visibility"
                value=${newCat.vis}
                minMenuWidth=${160}
                options=${[
                  ['Internal', 'Internal', false, VIS.Internal[1]],
                  ['Restricted', 'Restricted', false, VIS.Restricted[1]],
                ]}
                onChange=${(v) => setNewCat({ ...newCat, vis: v })}
              />
            </div>
          </div>
        </form>
      </div>`,
      portalRoot
    )}

    <${InviteUserSheet}
      open=${inviting}
      teams=${teams}
      isSuperAdmin=${isSuperAdmin}
      busy=${busyUserAction}
      onClose=${() => setInviting(false)}
      onSubmit=${handleInviteSubmit}
    />

    <${ConfirmUserActionSheet}
      target=${confirmTarget}
      activeUsers=${activeUsers}
      fallbackUserId=${fallbackUserId}
      setFallbackUserId=${setFallbackUserId}
      busy=${busyUserAction}
      onClose=${() => setConfirmTarget(null)}
      onConfirm=${runConfirmAction}
    />
  </div>`;
}
