import { createPortal } from 'react-dom';
import { html, Fragment, useState, useMemo, useEffect, useRef } from '../../lib/react.js';
import { Ic } from '../../components/Icon.js';
import { Select } from '../../components/Select.js';
import { md } from '../../utils/markdown.js';
import {
  DEFAULT_PLANNER_STATUSES,
  getStatusObj,
  isDoneStatus,
  getDoneStatus,
  getFirstActiveStatus,
  linkDisplayName,
  linkDisplayHost,
} from '../../utils/planner.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoOffset(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortDate(isoStr) {
  if (!isoStr) return '';
  const p = String(isoStr).split('-');
  if (p.length !== 3) return isoStr;
  return `${Number(p[2])} ${MONTHS_SHORT[Number(p[1]) - 1] || p[1]}`;
}

function dateInfo(dueDate, isDone) {
  if (!dueDate) return null;
  const p = String(dueDate).split('-');
  if (p.length !== 3) return { txt: dueDate, cls: '' };
  const dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  if (Number.isNaN(dt.getTime())) return { txt: dueDate, cls: '' };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((dt - now) / 864e5);
  let cls = '';
  let txt = `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}`;
  if (!isDone) {
    if (diff < 0) cls = 'late';
    else if (diff === 0) {
      cls = 'today';
      txt = 'Today';
    } else if (diff === 1) {
      cls = 'soon';
      txt = 'Tomorrow';
    } else if (diff <= 3) {
      cls = 'soon';
    }
  }
  return { txt, cls };
}

function priorityOf(t) {
  if (Number.isFinite(Number(t.priority)) && Number(t.priority) > 0) return Number(t.priority);
  return t.isUrgent ? 3 : 0;
}

export function SecondBrainView({
  tasks = [],
  notes = [],
  docs = [],
  statuses = DEFAULT_PLANNER_STATUSES,
  categories = [],
  projects = [],
  ownerName = '',
  syncState = 'synced',
  canPromote = false,
  initialTab = 'all',
  highlightId = null,
  onSaveTask,
  onDeleteTask,
  onSaveNote,
  onDeleteNote,
  onOpenSheet,
  onOpenManageSheet,
  onStartRevision,
  onOpenDoc,
  onPromoteNoteToDoc,
}) {
  const todayStr = isoOffset(0);
  const weekEndStr = isoOffset(7);
  const archiveCutoffStr = isoOffset(-14);

  const [filterTab, setFilterTab] = useState(
    initialTab === 'notes' ? 'notes' : initialTab === 'done' ? 'done' : 'all'
  );
  const [smartBucket, setSmartBucket] = useState(initialTab === 'today' ? 'today' : '');
  const [layout, setLayout] = useState('list'); // 'list' | 'board'
  const [projFilter, setProjFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [mobSearchOpen, setMobSearchOpen] = useState(false);
  const [sortMode, setSortMode] = useState(1); // 0 = manual, 1 = priority, 2 = due date
  const [hideOldDone, setHideOldDone] = useState(false);
  const [collapsedProjs, setCollapsedProjs] = useState(() => new Set());
  const [expandedLinksIds, setExpandedLinksIds] = useState(() => new Set());
  const [morePos, setMorePos] = useState(null);

  const moreBtnRef = useRef(null);
  const moreMenuRef = useRef(null);
  const searchInpRef = useRef(null);

  useEffect(() => {
    if (initialTab === 'notes') setFilterTab('notes');
    else if (initialTab === 'done') setFilterTab('done');
    else if (initialTab === 'today') {
      setFilterTab('active');
      setSmartBucket('today');
    } else if (initialTab === 'all') {
      setFilterTab('all');
      setSmartBucket('');
    }
  }, [initialTab]);

  // Keyboard shortcuts: 'n' to quick create, '/' to search
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('.qc-ov')) return;
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onOpenSheet &&
          onOpenSheet({
            mode: filterTab === 'notes' ? 'note' : 'task',
            project: projFilter !== 'all' ? projFilter : (projects[0] || 'General'),
          });
      } else if (e.key === '/') {
        e.preventDefault();
        setMobSearchOpen(true);
        setTimeout(() => searchInpRef.current && searchInpRef.current.focus(), 20);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filterTab, projFilter, projects, onOpenSheet]);

  // Close '...' menu on outside click or Escape
  useEffect(() => {
    if (!morePos) return undefined;
    const onDown = (e) => {
      if (moreBtnRef.current && moreBtnRef.current.contains(e.target)) return;
      if (moreMenuRef.current && moreMenuRef.current.contains(e.target)) return;
      setMorePos(null);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setMorePos(null);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onEsc, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onEsc, true);
    };
  }, [morePos]);

  const docById = useMemo(() => new Map((docs || []).map((d) => [Number(d.id), d])), [docs]);

  const statusOptions = useMemo(
    () =>
      (statuses && statuses.length ? statuses : DEFAULT_PLANNER_STATUSES).map((s) => ({
        value: s.id,
        label: s.label,
        color: s.color || '#8e8e93',
      })),
    [statuses]
  );

  const revsByParent = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t.parentTaskId) {
        const arr = map.get(t.parentTaskId) || [];
        arr.push(t);
        map.set(t.parentTaskId, arr);
      }
    });
    map.forEach((arr) => arr.sort((a, b) => (a.revNumber || 0) - (b.revNumber || 0)));
    return map;
  }, [tasks]);

  const activeProjects = useMemo(() => {
    const set = new Set();
    const list = filterTab === 'notes' ? notes : tasks;
    list.forEach((x) => {
      const p = (x.project || 'General').trim() || 'General';
      set.add(p);
    });
    if (projFilter !== 'all') set.add(projFilter);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [tasks, notes, projFilter, filterTab]);

  const projStats = useMemo(() => {
    const scoped = projFilter === 'all' ? tasks : tasks.filter((t) => (t.project || 'General') === projFilter);
    const doneCount = scoped.filter((t) => isDoneStatus(statuses, t.status)).length;
    const overdueCount = scoped.filter((t) => !isDoneStatus(statuses, t.status) && t.dueDate && t.dueDate < todayStr).length;
    const activeScoped = scoped.filter((t) => !isDoneStatus(statuses, t.status));
    return {
      total: scoped.length,
      doneCount,
      overdueCount,
      pct: scoped.length ? Math.round((doneCount / scoped.length) * 100) : 0,
      smartCounts: {
        over: overdueCount,
        today: activeScoped.filter((t) => t.dueDate === todayStr).length,
        week: activeScoped.filter((t) => t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEndStr).length,
        urgent: activeScoped.filter((t) => priorityOf(t) >= 3).length,
      },
    };
  }, [tasks, statuses, projFilter, todayStr, weekEndStr]);

  const effectiveKey = (t) => {
    const own = priorityOf(t);
    const children = revsByParent.get(t.id) || [];
    return children.reduce((mx, c) => {
      const cp = isDoneStatus(statuses, c.status) ? -1 : priorityOf(c);
      return Math.max(mx, cp);
    }, isDoneStatus(statuses, t.status) ? -1 : own);
  };

  const effectiveDue = (t) => {
    let best = '9999-12-31';
    [t, ...(revsByParent.get(t.id) || [])].forEach((x) => {
      if (!isDoneStatus(statuses, x.status) && x.dueDate && x.dueDate < best) best = x.dueDate;
    });
    return isDoneStatus(statuses, t.status) && best === '9999-12-31' ? '99999' : best;
  };

  const matchesTask = (t) => {
    const tDone = isDoneStatus(statuses, t.status);
    if (hideOldDone && filterTab !== 'done' && tDone && t.completedAt && String(t.completedAt).slice(0, 10) < archiveCutoffStr) {
      return false;
    }
    if (projFilter !== 'all' && (t.project || 'General') !== projFilter) return false;
    if (filterTab === 'done' && !tDone) return false;
    if (filterTab === 'active' && tDone) return false;
    if (smartBucket) {
      if (tDone) return false;
      if (smartBucket === 'over' && !(t.dueDate && t.dueDate < todayStr)) return false;
      if (smartBucket === 'today' && t.dueDate !== todayStr) return false;
      if (smartBucket === 'week' && !(t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEndStr)) return false;
      if (smartBucket === 'urgent' && priorityOf(t) < 3) return false;
    }
    if (query.trim()) {
      const qL = query.trim().toLowerCase();
      const linkTxt = (t.links || []).map((x) => `${x.l || ''} ${x.u || ''}`).join(' ');
      const hay = `${t.title || ''} ${t.notes || ''} ${t.project || ''} ${t.category || ''} ${t.linkedItemTitle || ''} ${linkTxt}`.toLowerCase();
      if (!hay.includes(qL)) return false;
    }
    return true;
  };

  const sortRootList = (arr) => {
    const copy = [...arr];
    if (sortMode === 1) {
      copy.sort((a, b) => {
        const da = isDoneStatus(statuses, a.status);
        const db = isDoneStatus(statuses, b.status);
        if (da !== db) return da ? 1 : -1;
        const ka = effectiveKey(a);
        const kb = effectiveKey(b);
        if (ka !== kb) return kb - ka;
        const ddA = a.dueDate || '9999-12-31';
        const ddB = b.dueDate || '9999-12-31';
        if (ddA !== ddB) return ddA.localeCompare(ddB);
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
    } else if (sortMode === 2) {
      copy.sort((a, b) => {
        const da = effectiveDue(a);
        const db = effectiveDue(b);
        if (da !== db) return da.localeCompare(db);
        return effectiveKey(b) - effectiveKey(a);
      });
    }
    return copy;
  };

  const visibleTasks = useMemo(
    () => sortRootList(tasks.filter(matchesTask)),
    [tasks, statuses, hideOldDone, projFilter, filterTab, smartBucket, query, sortMode, todayStr]
  );

  const isBurningUrgent = (t) => !isDoneStatus(statuses, t.status) && priorityOf(t) >= 3;

  const urgentFocusTasks = useMemo(
    () =>
      layout === 'list' && filterTab !== 'done'
        ? visibleTasks
            .filter(isBurningUrgent)
            .sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'))
        : [],
    [visibleTasks, layout, filterTab, statuses]
  );

  const groupedByProject = useMemo(() => {
    const nonUrgent = visibleTasks.filter(
      (t) => !(layout === 'list' && filterTab !== 'done' && isBurningUrgent(t))
    );
    const orderProj = [...(projects || [])];
    nonUrgent.forEach((t) => {
      const pn = (t.project || 'General').trim() || 'General';
      if (!orderProj.includes(pn)) orderProj.push(pn);
    });

    return orderProj
      .map((pName) => {
        const allInProj = tasks.filter((t) => ((t.project || 'General').trim() || 'General') === pName);
        const shownInProj = nonUrgent.filter((t) => ((t.project || 'General').trim() || 'General') === pName);
        if (!shownInProj.length) return null;

        const catOrder = [...(categories || [])];
        shownInProj.forEach((t) => {
          const cn = (t.category || '').trim();
          if (!catOrder.includes(cn)) catOrder.push(cn);
        });
        if (!catOrder.includes('')) catOrder.push('');

        const catGroups = catOrder
          .map((catName) => {
            const shownInCat = shownInProj.filter((t) => (t.category || '').trim() === catName);
            if (!shownInCat.length) return null;

            const shownIds = new Set(shownInCat.map((x) => x.id));
            const byParent = new Map();
            const roots = [];
            shownInCat.forEach((t) => {
              if (t.parentTaskId && shownIds.has(t.parentTaskId)) {
                const arr = byParent.get(t.parentTaskId) || [];
                arr.push(t);
                byParent.set(t.parentTaskId, arr);
              } else {
                roots.push(t);
              }
            });
            byParent.forEach((arr) => arr.sort((a, b) => (a.revNumber || 0) - (b.revNumber || 0)));

            const orderedRows = [];
            sortRootList(roots).forEach((rootTask) => {
              orderedRows.push({ task: rootTask, isNested: false });
              (byParent.get(rootTask.id) || []).forEach((childTask) => {
                orderedRows.push({ task: childTask, isNested: true });
              });
            });

            const allInCat = allInProj.filter((t) => (t.category || '').trim() === catName);
            return {
              name: catName,
              rows: orderedRows,
              allCatCount: allInCat.length,
              doneCatCount: allInCat.filter((t) => isDoneStatus(statuses, t.status)).length,
            };
          })
          .filter(Boolean);

        return {
          name: pName,
          totalCount: allInProj.length,
          doneCount: allInProj.filter((t) => isDoneStatus(statuses, t.status)).length,
          catGroups,
        };
      })
      .filter(Boolean);
  }, [visibleTasks, tasks, projects, categories, statuses, layout, filterTab, sortMode]);

  const boardColumns = useMemo(
    () =>
      (statuses && statuses.length ? statuses : DEFAULT_PLANNER_STATUSES).map((st) => ({
        ...st,
        items: visibleTasks.filter(
          (t) => t.status === st.id || (!statuses.some((s) => s.id === t.status) && st === statuses[0])
        ),
      })),
    [visibleTasks, statuses]
  );

  const visibleNotes = useMemo(() => {
    const qL = query.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (projFilter !== 'all' && (n.project || 'General') !== projFilter) return false;
        if (qL && !`${n.title || ''} ${n.body || ''} ${n.project || ''}`.toLowerCase().includes(qL)) return false;
        return true;
      })
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
  }, [notes, projFilter, query]);

  const toggleLinksExpand = (taskId) => {
    setExpandedLinksIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const openMoreMenu = () => {
    if (morePos) {
      setMorePos(null);
      return;
    }
    const el = moreBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = 228;
    const left = Math.min(Math.max(10, r.right - w), window.innerWidth - w - 10);
    const top = r.bottom + 6;
    setMorePos({ left, top });
  };

  const renderTaskRow = (t, isNested = false, showProjCtx = false) => {
    const tDone = isDoneStatus(statuses, t.status);
    const pri = priorityOf(t);
    const di = dateInfo(t.dueDate, tDone);
    const stObj = getStatusObj(statuses, t.status);
    const isHl = highlightId && String(highlightId) === String(t.id);
    const docTitle = t.linkedItemTitle || (t.linkedItemId ? docById.get(Number(t.linkedItemId))?.title : '');
    const childRevs = revsByParent.get(t.id) || [];
    const openRevsCount = childRevs.filter((x) => !isDoneStatus(statuses, x.status)).length;
    const taskLinks = Array.isArray(t.links) ? t.links : [];
    const linksOpen = expandedLinksIds.has(t.id);
    const doneSt = getDoneStatus(statuses);
    const activeSt = getFirstActiveStatus(statuses);

    return html`<div
      key=${t.id}
      className=${'pl-row' + (tDone ? ' is-done' : '') + (isNested ? ' is-rev' : '') + (isHl ? ' is-hl' : '')}
      onClick=${(e) => {
        if (e.target.closest('button, a, .asel, .asel-menu, .pl-lkl')) return;
        onOpenSheet && onOpenSheet({ mode: 'task', task: t });
      }}
    >
      <button
        type="button"
        className="pl-chk"
        aria-label=${tDone ? `Reopen ${t.title}` : `Complete ${t.title}`}
        onClick=${(e) => {
          e.stopPropagation();
          onSaveTask && onSaveTask({ ...t, status: tDone ? activeSt.id : doneSt.id });
        }}
      >
        <${Ic} n="check" s=${11} />
      </button>

      <div className="pl-mid">
        <div className="pl-title-line">
          <span className="pl-t">
            ${!tDone && pri > 0 && html`<i className=${'pl-pri-dot p' + pri} title=${pri === 3 ? 'Urgent' : pri === 2 ? 'Hot' : 'Low'} />`}
            ${t.title}
          </span>

          ${t.revNumber > 0 && html`<span className="pl-rvb">R${t.revNumber}</span>`}

          ${!t.parentTaskId &&
          childRevs.length > 0 &&
          html`<span
            className=${'pl-rev' + (openRevsCount === 0 ? ' ok' : '')}
            title=${`${childRevs.length} client revision(s)${openRevsCount ? `, ${openRevsCount} open` : ''}`}
          >
            ↻${childRevs.length}
          </span>`}

          ${taskLinks.length > 0 &&
          html`<button
            type="button"
            className=${'pl-lkt' + (linksOpen ? ' open' : '')}
            aria-expanded=${linksOpen}
            title="Show links"
            onClick=${(e) => {
              e.stopPropagation();
              toggleLinksExpand(t.id);
            }}
          >
            <${Ic} n="link" s=${10} />
            <span>${taskLinks.length}</span>
            <${Ic} n="chev" s=${9} />
          </button>`}

          ${t.linkedItemId &&
          html`<button
            type="button"
            className="pl-doc-lk"
            title="Open linked standard"
            onClick=${(e) => {
              e.stopPropagation();
              onOpenDoc && onOpenDoc(t.linkedItemId);
            }}
          >
            <${Ic} n="doc" s=${10} />
            <span>${docTitle || `Standard #${t.linkedItemId}`}</span>
          </button>`}
        </div>

        ${t.parentTaskId &&
        t.requestedAt &&
        !showProjCtx &&
        html`<div className="pl-ctx">Client update · ${formatShortDate(t.requestedAt)}</div>`}

        ${showProjCtx &&
        t.project &&
        html`<div className="pl-ctx">${t.project}${t.category ? ` · ${t.category}` : ''}</div>`}

        ${t.notes && html`<div className="pl-n">${t.notes}</div>`}
      </div>

      <div className="pl-meta" onClick=${(e) => e.stopPropagation()}>
        ${di && html`<span className=${'pl-due ' + di.cls}>${di.txt}</span>`}

        ${tDone &&
        onStartRevision &&
        html`<button
          type="button"
          className="pl-rq"
          title="Client update → new revision"
          aria-label="New revision"
          onClick=${() => {
            const rootParent = t.parentTaskId ? tasks.find((x) => x.id === t.parentTaskId) || t : t;
            onStartRevision(rootParent);
          }}
        >
          ↻
        </button>`}

        <${Select}
          variant="meta"
          value=${t.status}
          options=${statusOptions}
          color=${stObj.color || '#8e8e93'}
          ariaLabel="Task status"
          onChange=${(nextStatus) => onSaveTask && onSaveTask({ ...t, status: nextStatus })}
        />

        <button
          type="button"
          className="pl-row-del"
          title="Delete task"
          aria-label="Delete task"
          onClick=${() => onDeleteTask && onDeleteTask(t.id)}
        >
          <${Ic} n="trash" s=${13} />
        </button>
      </div>

      ${linksOpen &&
      taskLinks.length > 0 &&
      html`<div className="pl-lkl" onClick=${(e) => e.stopPropagation()}>
        ${taskLinks.map(
          (lk, idx) => html`<a
            key=${lk.u + '-' + idx}
            href=${lk.u}
            target="_blank"
            rel="noopener noreferrer"
            title=${lk.u}
          >
            <span className="pl-lkl-ic"><${Ic} n="link" s=${13} /></span>
            <span className="pl-lkl-tx">
              <span className="pl-lkl-nm">${linkDisplayName(lk)}</span>
              <span className="pl-lkl-hs">${linkDisplayHost(lk.u)}</span>
            </span>
            <span className="pl-lkl-go"><${Ic} n="openx" s=${12} /></span>
          </a>`
        )}
        ${taskLinks.length > 1 &&
        html`<button
          type="button"
          className="pl-lkl-oa"
          onClick=${() => taskLinks.forEach((lk) => window.open(lk.u, '_blank', 'noopener,noreferrer'))}
        >
          Open all (${taskLinks.length})
        </button>`}
      </div>`}
    </div>`;
  };

  const smartChips =
    filterTab !== 'notes'
      ? [
          ['over', 'Overdue', projStats.smartCounts.over],
          ['today', 'Today', projStats.smartCounts.today],
          ['week', 'This week', projStats.smartCounts.week],
          ['urgent', 'Urgent', projStats.smartCounts.urgent],
        ].filter(([k, , cnt]) => cnt > 0 || smartBucket === k)
      : [];

  const hasSecondaryChips = smartChips.length > 0 || activeProjects.length > 1;
  const openCreateModal = () =>
    onOpenSheet &&
    onOpenSheet({
      mode: filterTab === 'notes' ? 'note' : 'task',
      project: projFilter !== 'all' ? projFilter : (projects[0] || 'General'),
    });

  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  return html`<div className=${'pl-wrap' + (filterTab !== 'notes' && layout === 'board' ? ' is-wide' : '')}>
    <div className="pl-head">
      <div className="pl-head-l">
        <div className="pl-stats">
          <span>
            ${filterTab === 'notes'
              ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`
              : `${projStats.doneCount}/${projStats.total} done${projStats.overdueCount ? ` · ${projStats.overdueCount} late` : ''}`}
          </span>
          <i
            className=${'pl-sync-dot' + (syncState === 'saving' ? ' busy' : syncState === 'error' ? ' err' : '')}
            title=${ownerName
              ? `${ownerName} · ${syncState === 'saving' ? 'Syncing…' : syncState === 'error' ? 'Local cache' : 'Synced to Supabase'}`
              : 'Synced to Supabase'}
          />
        </div>
        ${filterTab !== 'notes' &&
        html`<div className="pl-pbar" aria-hidden="true">
          <i style=${{ width: `${projStats.pct}%` }} />
        </div>`}
      </div>

      <div className="pl-head-r">
        <div className="seg" role="tablist" aria-label="Workspace filter" style=${{ marginTop: 0 }}>
          ${[
            ['all', 'All'],
            ['active', 'Active'],
            ['done', 'Done'],
            ['notes', 'Notes'],
          ].map(
            ([k, lbl]) => html`<button
              key=${k}
              type="button"
              role="tab"
              aria-selected=${filterTab === k}
              className=${filterTab === k ? 'on' : ''}
              onClick=${() => setFilterTab(k)}
            >
              ${lbl}
            </button>`
          )}
        </div>

        ${filterTab !== 'notes' &&
        html`<div className="seg pl-desk-only" role="group" aria-label="Task layout" style=${{ marginTop: 0 }}>
          <button type="button" className=${layout === 'list' ? 'on' : ''} onClick=${() => setLayout('list')}>
            List
          </button>
          <button type="button" className=${layout === 'board' ? 'on' : ''} onClick=${() => setLayout('board')}>
            Board
          </button>
        </div>`}

        <button
          type="button"
          className=${'pl-ico-btn pl-mob-only' + (mobSearchOpen || query ? ' on' : '')}
          title="Search"
          aria-label="Toggle search"
          onClick=${() => {
            setMobSearchOpen((v) => !v);
            setTimeout(() => searchInpRef.current && searchInpRef.current.focus(), 40);
          }}
        >
          <${Ic} n="search" s=${15} />
        </button>

        <button
          ref=${moreBtnRef}
          type="button"
          className=${'pl-ico-btn' + (morePos || sortMode !== 1 || hideOldDone ? ' on' : '')}
          title="Sort, Statuses, Projects & Options"
          aria-label="Planner options"
          aria-expanded=${Boolean(morePos)}
          onClick=${openMoreMenu}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>

        <button
          type="button"
          className="btn sm p pl-desk-only"
          onClick=${openCreateModal}
          title=${filterTab === 'notes' ? 'New Private Note' : 'New Task (N)'}
        >
          <${Ic} n="plus" s=${14} />
          <span>${filterTab === 'notes' ? 'New Note' : 'New Task'}</span>
        </button>
      </div>
    </div>

    ${(tasks.length > 0 || notes.length > 0 || mobSearchOpen || query || hasSecondaryChips) &&
    html`<div className=${'pl-filterbar' + (mobSearchOpen || query ? ' mob-search-on' : '')}>
      <div className="pl-search">
        <${Ic} n="search" s=${14} />
        <input
          ref=${searchInpRef}
          type="search"
          placeholder=${filterTab === 'notes' ? 'Search notes…' : 'Search tasks… (/)'}
          value=${query}
          onChange=${(e) => setQuery(e.target.value)}
        />
        ${query &&
        html`<button type="button" className="pl-search-clr" aria-label="Clear search" onClick=${() => setQuery('')}>
          <${Ic} n="x" s=${11} />
        </button>`}
      </div>

      ${hasSecondaryChips &&
      html`<div className="pl-chips-row">
        ${smartChips.map(
          ([k, lbl, cnt]) => html`<button
            key=${'sm-' + k}
            type="button"
            className=${'pl-chip' + (k === 'over' ? ' od' : '') + (smartBucket === k ? ' on' : '')}
            onClick=${() => setSmartBucket((prev) => (prev === k ? '' : k))}
          >
            <span>${lbl}</span>
            <b>${cnt}</b>
          </button>`
        )}

        ${smartChips.length > 0 && activeProjects.length > 1 && html`<i className="pl-chip-sep" aria-hidden="true" />`}

        ${activeProjects.length > 1 &&
        html`<${Fragment}>
          <button
            type="button"
            className=${'pl-chip' + (projFilter === 'all' ? ' on' : '')}
            onClick=${() => setProjFilter('all')}
          >
            All
          </button>
          ${activeProjects.map(
            (pr) => html`<button
              key=${'pr-' + pr}
              type="button"
              className=${'pl-chip' + (projFilter === pr ? ' on' : '')}
              onClick=${() => setProjFilter((prev) => (prev === pr ? 'all' : pr))}
            >
              ${pr}
            </button>`
          )}
        </${Fragment}>`}
      </div>`}
    </div>`}

    ${filterTab !== 'notes'
      ? html`<${Fragment}>
          ${layout === 'board'
            ? html`<div className=${'pl-board' + (boardColumns.length > 3 ? ' is-scroll' : '')}>
                ${boardColumns.map((col, colIdx) => {
                  const nextCol = boardColumns[Math.min(boardColumns.length - 1, colIdx + 1)];
                  const prevCol = boardColumns[Math.max(0, colIdx - 1)];
                  return html`<div key=${col.id} className="pl-col">
                    <div className="pl-col-h">
                      <i style=${{ background: col.color || '#8e8e93' }} />
                      <span>${col.label}</span>
                      <span>${col.items.length}</span>
                    </div>
                    ${col.items.length
                      ? col.items.map((t) => {
                          const pri = priorityOf(t);
                          const tDone = isDoneStatus(statuses, t.status);
                          const di = dateInfo(t.dueDate, tDone);
                          const docTitle = t.linkedItemTitle || (t.linkedItemId ? docById.get(Number(t.linkedItemId))?.title : '');
                          const taskLinks = Array.isArray(t.links) ? t.links : [];
                          return html`<div
                            key=${t.id}
                            className=${'pl-bcard' + (tDone ? ' is-done' : '')}
                            onClick=${(e) => {
                              if (e.target.closest('button')) return;
                              onOpenSheet && onOpenSheet({ mode: 'task', task: t });
                            }}
                          >
                            <div className="pl-title-line">
                              ${!tDone && pri > 0 && html`<i className=${'pl-pri-dot p' + pri} />`}
                              <span className="pl-bcard-t">${t.title}</span>
                              ${t.revNumber > 0 && html`<span className="pl-rvb">R${t.revNumber}</span>`}
                            </div>
                            <div className="pl-meta" style=${{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                              <span className="pl-note-proj">${t.project || 'General'}</span>
                              ${di && html`<span className=${'pl-due ' + di.cls}>${di.txt}</span>`}
                              ${taskLinks.length > 0 && html`<span className="pl-lkt">🔗 ${taskLinks.length}</span>`}
                              ${t.linkedItemId &&
                              html`<button
                                type="button"
                                className="pl-doc-lk"
                                onClick=${() => onOpenDoc && onOpenDoc(t.linkedItemId)}
                              >
                                <${Ic} n="doc" s=${10} />
                                <span>${docTitle || `Standard #${t.linkedItemId}`}</span>
                              </button>`}
                            </div>
                            <div className="pl-bcard-foot">
                              <div className="row" style=${{ gap: 5 }}>
                                ${colIdx > 0 &&
                                html`<button
                                  type="button"
                                  className="pl-mv-btn"
                                  onClick=${() => onSaveTask && onSaveTask({ ...t, status: prevCol.id })}
                                >
                                  ←
                                </button>`}
                                ${colIdx < boardColumns.length - 1 &&
                                html`<button
                                  type="button"
                                  className="pl-mv-btn"
                                  onClick=${() => onSaveTask && onSaveTask({ ...t, status: nextCol.id })}
                                >
                                  ${nextCol.label} →
                                </button>`}
                              </div>
                              <button
                                type="button"
                                className="pl-row-del"
                                style=${{ opacity: 1 }}
                                title="Delete"
                                onClick=${() => onDeleteTask && onDeleteTask(t.id)}
                              >
                                <${Ic} n="trash" s=${13} />
                              </button>
                            </div>
                          </div>`;
                        })
                      : html`<div style=${{ padding: '22px 8px', textAlign: 'center', fontSize: 12.5, color: 'var(--sub)' }}>
                          Empty
                        </div>`}
                  </div>`;
                })}
              </div>`
            : visibleTasks.length
            ? html`<${Fragment}>
                ${urgentFocusTasks.length > 0 &&
                html`<section className="pl-urgent" aria-label="Urgent focus">
                  <div className="pl-urgent-head">
                    <b>Urgent · ${urgentFocusTasks.length}</b>
                    <span>High priority</span>
                  </div>
                  <div className="pl-card">
                    ${urgentFocusTasks.map((t) => renderTaskRow(t, false, true))}
                  </div>
                </section>`}

                ${groupedByProject.map((grp) => {
                  const isShut = collapsedProjs.has(grp.name);
                  return html`<section key=${grp.name} className="pl-proj-sec">
                    <button
                      type="button"
                      className="pl-ph"
                      aria-expanded=${!isShut}
                      onClick=${() =>
                        setCollapsedProjs((prev) => {
                          const next = new Set(prev);
                          if (next.has(grp.name)) next.delete(grp.name);
                          else next.add(grp.name);
                          return next;
                        })
                      }
                    >
                      <b>${grp.name}</b>
                      <span className="pl-ph-cnt">${grp.doneCount}/${grp.totalCount}</span>
                      <span className=${'pl-ph-chev' + (isShut ? ' shut' : '')}>
                        <${Ic} n="chev" s=${13} />
                      </span>
                    </button>

                    ${!isShut &&
                    grp.catGroups.map(
                      (cg) => html`<${Fragment} key=${cg.name || '__none'}>
                        ${(grp.catGroups.length > 1 || cg.name) &&
                        html`<div className="pl-gh">
                          <span>${cg.name || 'Other'}</span>
                          <span>${cg.doneCatCount}/${cg.allCatCount}</span>
                        </div>`}
                        <div className="pl-card">
                          ${cg.rows.map((entry) => renderTaskRow(entry.task, entry.isNested, false))}
                        </div>
                      </${Fragment}>`
                    )}
                  </section>`;
                })}
              </${Fragment}>`
            : html`<div className="empty" style=${{ padding: '72px 20px' }}>
                <${Ic} n="check" s=${28} />
                <b>${tasks.length ? 'No matching tasks' : 'No tasks yet'}</b>
                <span>
                  ${tasks.length
                    ? 'Try clearing search or filter chips.'
                    : 'Tap + to create your first task, or press N anytime.'}
                </span>
                ${!tasks.length &&
                html`<button type="button" className="btn p" style=${{ marginTop: 10 }} onClick=${openCreateModal}>
                  <${Ic} n="plus" s=${14} /> Add first task
                </button>`}
              </div>`}
        </${Fragment}>`
      : visibleNotes.length
      ? html`<div className="pl-notes-grid">
          ${visibleNotes.map((n) => {
            const isHl = highlightId && String(highlightId) === String(n.id);
            const rendered = md(n.body || '', {}, []).h;
            return html`<div
              key=${n.id}
              className=${'pl-note-card' + (n.isPinned ? ' pin' : '')}
              style=${isHl ? { boxShadow: '0 0 0 2px var(--blue)' } : undefined}
            >
              <div className="pl-note-head">
                <div className="pl-note-title">${n.title || 'Private Note'}</div>
                <span className="pl-note-proj">${n.project || 'General'}</span>
              </div>
              <div
                className="pl-note-body"
                onClick=${(e) => {
                  const lk = e.target.closest && e.target.closest('a.datum-wiki-lk');
                  if (lk && lk.dataset.wikiId) {
                    e.preventDefault();
                    onOpenDoc && onOpenDoc(Number(lk.dataset.wikiId));
                  }
                }}
                dangerouslySetInnerHTML=${{ __html: rendered || '<p><i>Empty note</i></p>' }}
              />
              <div className="pl-note-foot">
                <div className="pl-note-acts">
                  <button
                    type="button"
                    className="pl-mv-btn"
                    onClick=${() => onSaveNote && onSaveNote({ ...n, isPinned: !n.isPinned })}
                  >
                    ${n.isPinned ? 'Pinned' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    className="pl-mv-btn"
                    onClick=${() => onOpenSheet && onOpenSheet({ mode: 'note', note: n })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="pl-mv-btn"
                    onClick=${() => {
                      const firstDocId = Array.isArray(n.linkedItemIds) && n.linkedItemIds[0] ? n.linkedItemIds[0] : null;
                      const d = firstDocId ? docById.get(Number(firstDocId)) : null;
                      onSaveTask &&
                        onSaveTask({
                          title: n.title || 'Follow up note',
                          notes: n.body || '',
                          project: n.project || 'General',
                          category: '',
                          priority: 0,
                          dueDate: todayStr,
                          isUrgent: false,
                          status: getFirstActiveStatus(statuses).id,
                          links: [],
                          linkedItemId: d ? d.id : null,
                          linkedItemTitle: d ? d.title : '',
                        });
                      setFilterTab('active');
                    }}
                  >
                    → Task
                  </button>
                  ${canPromote &&
                  onPromoteNoteToDoc &&
                  html`<button
                    type="button"
                    className="pl-mv-btn"
                    title="Promote to shared Draft standard"
                    onClick=${() => onPromoteNoteToDoc(n)}
                  >
                    → Standard
                  </button>`}
                </div>
                <button
                  type="button"
                  className="pl-row-del"
                  style=${{ opacity: 1 }}
                  title="Delete note"
                  onClick=${() => onDeleteNote && onDeleteNote(n.id)}
                >
                  <${Ic} n="trash" s=${13} />
                </button>
              </div>
            </div>`;
          })}
        </div>`
      : html`<div className="empty" style=${{ padding: '72px 20px' }}>
          <${Ic} n="note" s=${28} />
          <b>No private notes yet</b>
          <span>Capture ideas privately or link [[Standards]] to populate document Backlinks.</span>
          <button type="button" className="btn p" style=${{ marginTop: 10 }} onClick=${openCreateModal}>
            <${Ic} n="plus" s=${14} /> New note
          </button>
        </div>`}

    <button
      type="button"
      className="pl-fab pl-mob-only"
      aria-label=${filterTab === 'notes' ? 'New note' : 'New task'}
      onClick=${openCreateModal}
    >
      <${Ic} n="plus" s=${24} />
    </button>

    ${portalRoot &&
    morePos &&
    createPortal(
      html`<div
        ref=${moreMenuRef}
        className="asel-menu pl-more-menu"
        style=${{ left: `${morePos.left}px`, top: `${morePos.top}px`, width: '228px' }}
        role="menu"
      >
        ${filterTab !== 'notes' &&
        html`<${Fragment}>
          <div className="asel-hdr">Sort</div>
          ${[
            [1, 'By Priority'],
            [2, 'By Due Date'],
            [0, 'Manual Order'],
          ].map(
            ([m, lbl]) => html`<button
              key=${'sort-' + m}
              type="button"
              className=${'asel-opt' + (sortMode === m ? ' on' : '')}
              onClick=${() => {
                setSortMode(m);
                setMorePos(null);
              }}
            >
              <span className="asel-ck">${sortMode === m ? html`<${Ic} n="check" s=${13} />` : null}</span>
              <span className="asel-tx"><span>${lbl}</span></span>
            </button>`
          )}

          <div className="pl-menu-div" />
          <div className="asel-hdr">Customize</div>
          <button
            type="button"
            className="asel-opt"
            onClick=${() => {
              setMorePos(null);
              onOpenManageSheet && onOpenManageSheet('lists');
            }}
          >
            <span className="asel-ck"><${Ic} n="folder" s=${13} /></span>
            <span className="asel-tx"><span>Projects & Categories…</span></span>
          </button>
          <button
            type="button"
            className="asel-opt"
            onClick=${() => {
              setMorePos(null);
              onOpenManageSheet && onOpenManageSheet('statuses');
            }}
          >
            <span className="asel-ck"><${Ic} n="layers" s=${13} /></span>
            <span className="asel-tx"><span>Custom Statuses…</span></span>
          </button>

          <button
            type="button"
            className="asel-opt pl-mob-only"
            onClick=${() => {
              setLayout((l) => (l === 'board' ? 'list' : 'board'));
              setMorePos(null);
            }}
          >
            <span className="asel-ck"><${Ic} n="layout" s=${13} /></span>
            <span className="asel-tx"><span>${layout === 'board' ? 'Switch to List View' : 'Switch to Board View'}</span></span>
          </button>

          <div className="pl-menu-div" />
          <button
            type="button"
            className=${'asel-opt' + (hideOldDone ? ' on' : '')}
            onClick=${() => {
              setHideOldDone((v) => !v);
              setMorePos(null);
            }}
          >
            <span className="asel-ck">${hideOldDone ? html`<${Ic} n="check" s=${13} />` : null}</span>
            <span className="asel-tx"><span>Hide old completed (14d+)</span></span>
          </button>
        </${Fragment}>`}
        ${filterTab === 'notes' &&
        html`<button
          type="button"
          className="asel-opt"
          onClick=${() => {
            setMorePos(null);
            onOpenManageSheet && onOpenManageSheet('lists');
          }}
        >
          <span className="asel-ck"><${Ic} n="folder" s=${13} /></span>
          <span className="asel-tx"><span>Manage Projects…</span></span>
        </button>`}
      </div>`,
      portalRoot
    )}
  </div>`;
}
