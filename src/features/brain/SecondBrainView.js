import { html, Fragment, useState, useMemo, useEffect } from '../../lib/react.js';
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

  const [filterTab, setFilterTab] = useState(
    initialTab === 'notes' ? 'notes' : initialTab === 'done' ? 'done' : 'all'
  );
  const [smartBucket, setSmartBucket] = useState(initialTab === 'today' ? 'today' : '');
  const [layout, setLayout] = useState('list'); // 'list' | 'board'
  const [projFilter, setProjFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState(1); // 0 = manual, 1 = priority, 2 = due date
  const [collapsedProjs, setCollapsedProjs] = useState(() => new Set());
  const [expandedLinksIds, setExpandedLinksIds] = useState(() => new Set());

  const [quickTitle, setQuickTitle] = useState('');
  const [quickUrgent, setQuickUrgent] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');

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
    const set = new Set(filterTab === 'notes' ? [] : projects || []);
    const list = filterTab === 'notes' ? notes : tasks;
    list.forEach((x) => {
      const p = (x.project || 'General').trim() || 'General';
      if (tasks.some((t) => (t.project || 'General') === p) || notes.some((n) => (n.project || 'General') === p) || projFilter === p) {
        set.add(p);
      }
    });
    // Only show projects that actually have items in chips bar to stay clean
    return [...set]
      .filter((p) => list.some((x) => ((x.project || 'General').trim() || 'General') === p) || projFilter === p)
      .sort((a, b) => a.localeCompare(b));
  }, [tasks, notes, projects, projFilter, filterTab]);

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
    [tasks, statuses, projFilter, filterTab, smartBucket, query, sortMode, todayStr]
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
    const orderProj = [];
    (projects || []).forEach((p) => orderProj.push(p));
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

            // Nest revisions underneath parent if parent is also in this group
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
        items: visibleTasks.filter((t) => t.status === st.id || (!statuses.some((s) => s.id === t.status) && st === statuses[0])),
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

  const handleQuickAdd = (e) => {
    e.preventDefault();
    let title = quickTitle.trim();
    if (!title) return;
    let project = projFilter !== 'all' ? projFilter : (projects[0] || 'General');
    let urgent = quickUrgent;

    if (/\s!(?:urgent|терміново)\b/i.test(title)) {
      urgent = true;
      title = title.replace(/\s!(?:urgent|терміново)\b/gi, '').trim();
    }
    const pM = title.match(/\s#([A-Za-z0-9_&-]+)$/);
    if (pM) {
      project = pM[1];
      title = title.slice(0, pM.index).trim();
    }
    if (!title) return;

    onSaveTask &&
      onSaveTask({
        title,
        notes: '',
        project,
        category: '',
        priority: urgent ? 3 : 0,
        isUrgent: urgent,
        dueDate: todayStr,
        status: getFirstActiveStatus(statuses).id,
        links: [],
      });
    setQuickTitle('');
    setQuickUrgent(false);
  };

  const handleQuickNoteAdd = (e) => {
    e.preventDefault();
    const raw = quickNoteText.trim();
    if (!raw) return;
    const lines = raw.split('\n');
    const title = lines[0].slice(0, 80) || 'Quick Note';
    const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : raw;
    onSaveNote &&
      onSaveNote({
        title,
        body,
        project: projFilter !== 'all' ? projFilter : (projects[0] || 'General'),
        isPinned: false,
      });
    setQuickNoteText('');
  };

  const toggleLinksExpand = (taskId) => {
    setExpandedLinksIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
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
        <${Ic} n="check" s=${12} />
      </button>

      <div className="pl-mid">
        <div className="pl-title-line">
          ${!tDone && pri > 0 && html`<i className=${'pl-pri-dot p' + pri} title=${pri === 3 ? 'Urgent' : pri === 2 ? 'Hot' : 'Low'} />`}
          <span className="pl-t">${t.title}</span>

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
            <${Ic} n="link" s=${11} />
            <span>${taskLinks.length}</span>
            <${Ic} n="chev" s=${10} />
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
            <${Ic} n="doc" s=${11} />
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
            <span className="pl-lkl-ic"><${Ic} n="link" s=${14} /></span>
            <span className="pl-lkl-tx">
              <span className="pl-lkl-nm">${linkDisplayName(lk)}</span>
              <span className="pl-lkl-hs">${linkDisplayHost(lk.u)}</span>
            </span>
            <span className="pl-lkl-go"><${Ic} n="openx" s=${13} /></span>
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

  const sortLabels = ['Manual order', 'Sorted by priority', 'Sorted by due date'];

  return html`<div className=${'pl-wrap' + (filterTab !== 'notes' && layout === 'board' ? ' is-wide' : '')}>
    <div className="pl-head">
      <div className="pl-head-l">
        <div className="pl-stats">
          <span>
            ${filterTab === 'notes'
              ? `${notes.length} ${notes.length === 1 ? 'private note' : 'private notes'}`
              : `${projStats.doneCount} of ${projStats.total} completed${projStats.overdueCount ? ` · ${projStats.overdueCount} overdue` : ''}`}
          </span>
          <span
            className=${'pl-sync' + (syncState === 'saving' ? ' busy' : syncState === 'error' ? ' err' : '')}
            title=${ownerName ? `Private for ${ownerName} · Synced to Supabase` : 'Synced to Supabase'}
          >
            <i />
            <span>${syncState === 'saving' ? 'Syncing…' : syncState === 'error' ? 'Local cache' : 'Synced'}</span>
          </span>
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
        html`<div className="seg" role="group" aria-label="Task layout" style=${{ marginTop: 0 }}>
          <button type="button" className=${layout === 'list' ? 'on' : ''} onClick=${() => setLayout('list')}>
            List
          </button>
          <button type="button" className=${layout === 'board' ? 'on' : ''} onClick=${() => setLayout('board')}>
            Board
          </button>
        </div>`}

        <button
          type="button"
          className="btn sm p"
          onClick=${() =>
            onOpenSheet &&
            onOpenSheet({
              mode: filterTab === 'notes' ? 'note' : 'task',
              project: projFilter !== 'all' ? projFilter : (projects[0] || 'General'),
            })
          }
        >
          <${Ic} n="plus" s=${14} />
          <span>${filterTab === 'notes' ? 'New Note' : 'New Task'}</span>
        </button>
      </div>
    </div>

    <div className="pl-toolbar">
      <div className="pl-search">
        <${Ic} n="search" s=${15} />
        <input
          type="search"
          placeholder=${filterTab === 'notes' ? 'Search private notes…' : 'Search tasks, categories, links, or standards…'}
          value=${query}
          onChange=${(e) => setQuery(e.target.value)}
        />
        ${query &&
        html`<button type="button" className="pl-search-clr" aria-label="Clear search" onClick=${() => setQuery('')}>
          <${Ic} n="x" s=${12} />
        </button>`}
      </div>

      ${filterTab !== 'notes' &&
      html`<${Fragment}>
        <button
          type="button"
          className=${'pl-ico-btn' + (sortMode > 0 ? ' on' : '')}
          title=${`${sortLabels[sortMode]} (click to change)`}
          aria-label=${sortLabels[sortMode]}
          onClick=${() => setSortMode((s) => (s + 1) % 3)}
        >
          <${Ic} n="swap" s=${15} />
        </button>
        <button
          type="button"
          className="pl-ico-btn"
          title="Manage Projects & Remembered Categories"
          aria-label="Manage Projects and Categories"
          onClick=${() => onOpenManageSheet && onOpenManageSheet('lists')}
        >
          <${Ic} n="folder" s=${15} />
        </button>
        <button
          type="button"
          className="pl-ico-btn"
          title="Manage Custom Statuses"
          aria-label="Manage Statuses"
          onClick=${() => onOpenManageSheet && onOpenManageSheet('statuses')}
        >
          <${Ic} n="layers" s=${15} />
        </button>
      </${Fragment}>`}
    </div>

    ${(activeProjects.length > 0 || (filterTab !== 'notes' && Object.values(projStats.smartCounts).some((n) => n > 0))) &&
    html`<div className="pl-chips-row">
      ${filterTab !== 'notes' &&
      [
        ['over', 'Overdue', projStats.smartCounts.over],
        ['today', 'Today', projStats.smartCounts.today],
        ['week', 'This week', projStats.smartCounts.week],
        ['urgent', 'Urgent', projStats.smartCounts.urgent],
      ]
        .filter(([k, , cnt]) => cnt > 0 || smartBucket === k)
        .map(
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

      ${filterTab !== 'notes' &&
      Object.values(projStats.smartCounts).some((n) => n > 0) &&
      activeProjects.length > 0 &&
      html`<i className="pl-chip-sep" aria-hidden="true" />`}

      ${activeProjects.length > 0 &&
      html`<${Fragment}>
        <button
          type="button"
          className=${'pl-chip' + (projFilter === 'all' ? ' on' : '')}
          onClick=${() => setProjFilter('all')}
        >
          All projects
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

    ${filterTab !== 'notes'
      ? html`<${Fragment}>
          <form className="pl-quick" onSubmit=${handleQuickAdd}>
            <span className="pl-quick-ico"><${Ic} n="plus" s=${16} /></span>
            <input
              type="text"
              placeholder=${projFilter !== 'all'
                ? `Quick add to ${projFilter}… (Enter, or sliders for date, links & category)`
                : 'Quick add task… (Enter, #Project !urgent, or sliders for calendar & links)'}
              value=${quickTitle}
              onChange=${(e) => setQuickTitle(e.target.value)}
            />
            <button
              type="button"
              className=${'pl-quick-btn' + (quickUrgent ? ' on' : '')}
              title="Toggle Urgent"
              aria-label="Toggle Urgent"
              onClick=${() => setQuickUrgent((v) => !v)}
            >
              <span style=${{ fontWeight: 800, fontSize: 13 }}>!</span>
            </button>
            <button
              type="button"
              className="pl-quick-btn"
              title="Open full task sheet"
              aria-label="Task options"
              onClick=${() =>
                onOpenSheet &&
                onOpenSheet({
                  mode: 'task',
                  project: projFilter !== 'all' ? projFilter : (projects[0] || 'General'),
                  task: quickTitle.trim() ? { title: quickTitle.trim(), priority: quickUrgent ? 3 : 0 } : null,
                })
              }
            >
              <${Ic} n="sliders" s=${15} />
            </button>
            ${quickTitle.trim() &&
            html`<button type="submit" className="btn sm p">Add</button>`}
          </form>

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
                                <${Ic} n="doc" s=${11} />
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
                    <span>Put these out first</span>
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
            : html`<div className="empty" style=${{ padding: '56px 20px' }}>
                <${Ic} n="check" s=${28} />
                <b>${tasks.length ? 'No matching tasks' : 'No tasks yet'}</b>
                <span>
                  ${tasks.length
                    ? 'Try clearing search or filter chips above.'
                    : 'Type above to add your first task, press Alt+N anywhere, or use + Task on any standard.'}
                </span>
              </div>`}
        </${Fragment}>`
      : html`<${Fragment}>
          <form className="pl-quick" onSubmit=${handleQuickNoteAdd}>
            <span className="pl-quick-ico"><${Ic} n="note" s=${15} /></span>
            <input
              type="text"
              placeholder="Quick capture a private note… (or click sliders for full Markdown & [[Standard]] links)"
              value=${quickNoteText}
              onChange=${(e) => setQuickNoteText(e.target.value)}
            />
            <button
              type="button"
              className="pl-quick-btn"
              title="Open full Note Sheet with [[Wiki-Links]]"
              aria-label="Open Note Sheet"
              onClick=${() =>
                onOpenSheet &&
                onOpenSheet({
                  mode: 'note',
                  project: projFilter !== 'all' ? projFilter : (projects[0] || 'General'),
                })
              }
            >
              <${Ic} n="sliders" s=${15} />
            </button>
            ${quickNoteText.trim() &&
            html`<button type="submit" className="btn sm p">Save</button>`}
          </form>

          ${visibleNotes.length
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
            : html`<div className="empty" style=${{ padding: '56px 20px' }}>
                <${Ic} n="note" s=${28} />
                <b>No private notes yet</b>
                <span>Capture ideas privately or link [[Standards]] to see them in document Backlinks.</span>
              </div>`}
        </${Fragment}>`}
  </div>`;
}
