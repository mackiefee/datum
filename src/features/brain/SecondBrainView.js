import { html, Fragment, useState, useMemo, useEffect } from '../../lib/react.js';
import { Ic } from '../../components/Icon.js';
import { Select } from '../../components/Select.js';
import { md } from '../../utils/markdown.js';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_OPTS = [
  { value: 'todo', label: 'To Do', color: '#8e8e93' },
  { value: 'in_progress', label: 'In Progress', color: '#ff9f0a' },
  { value: 'done', label: 'Done', color: '#30d158' },
];

function isoOffset(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  onOpenDoc,
  onPromoteNoteToDoc,
}) {
  const todayStr = isoOffset(0);
  const weekEndStr = isoOffset(7);

  // Align initialTab cleanly with All | Active | Done | Notes (mapping legacy today/upcoming -> date chip or active)
  const [filterTab, setFilterTab] = useState(initialTab === 'notes' ? 'notes' : initialTab === 'done' ? 'done' : 'all'); // 'all' | 'active' | 'done' | 'notes'
  const [smartBucket, setSmartBucket] = useState(initialTab === 'today' ? 'today' : ''); // '' | 'over' | 'today' | 'week' | 'urgent'
  const [layout, setLayout] = useState('list'); // 'list' | 'board'
  const [projFilter, setProjFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState(1); // 0 = created/manual, 1 = priority, 2 = due date
  const [collapsedProjs, setCollapsedProjs] = useState(() => new Set());

  // Single-line Quick Add input
  const [quickTitle, setQuickTitle] = useState('');
  const [quickUrgent, setQuickUrgent] = useState(false);

  // Notes Quick Add input
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

  const activeProjects = useMemo(() => {
    const map = new Map();
    const list = filterTab === 'notes' ? notes : tasks;
    list.forEach((x) => {
      const p = (x.project || 'General').trim() || 'General';
      map.set(p, (map.get(p) || 0) + 1);
    });
    return [...map.keys()].sort((a, b) => a.localeCompare(b));
  }, [tasks, notes, filterTab]);

  const projStats = useMemo(() => {
    const scoped = projFilter === 'all' ? tasks : tasks.filter((t) => (t.project || 'General') === projFilter);
    const doneCount = scoped.filter((t) => t.status === 'done').length;
    const overdueCount = scoped.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr).length;
    const activeScoped = scoped.filter((t) => t.status !== 'done');
    const smartCounts = {
      over: overdueCount,
      today: activeScoped.filter((t) => t.dueDate === todayStr).length,
      week: activeScoped.filter((t) => t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEndStr).length,
      urgent: activeScoped.filter((t) => priorityOf(t) >= 3).length,
    };
    return {
      total: scoped.length,
      doneCount,
      overdueCount,
      pct: scoped.length ? Math.round((doneCount / scoped.length) * 100) : 0,
      smartCounts,
    };
  }, [tasks, projFilter, todayStr, weekEndStr]);

  const matchesTask = (t) => {
    if (projFilter !== 'all' && (t.project || 'General') !== projFilter) return false;
    if (filterTab === 'done' && t.status !== 'done') return false;
    if (filterTab === 'active' && t.status === 'done') return false;
    if (smartBucket) {
      if (t.status === 'done') return false;
      if (smartBucket === 'over' && !(t.dueDate && t.dueDate < todayStr)) return false;
      if (smartBucket === 'today' && t.dueDate !== todayStr) return false;
      if (smartBucket === 'week' && !(t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEndStr)) return false;
      if (smartBucket === 'urgent' && priorityOf(t) < 3) return false;
    }
    if (query.trim()) {
      const qL = query.trim().toLowerCase();
      const hay = `${t.title || ''} ${t.notes || ''} ${t.project || ''} ${t.category || ''} ${t.linkedItemTitle || ''}`.toLowerCase();
      if (!hay.includes(qL)) return false;
    }
    return true;
  };

  const sortTasks = (arr) => {
    const copy = [...arr];
    if (sortMode === 1) {
      copy.sort((a, b) => {
        if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
        const pa = priorityOf(a);
        const pb = priorityOf(b);
        if (pa !== pb) return pb - pa;
        const da = a.dueDate || '9999-12-31';
        const db = b.dueDate || '9999-12-31';
        if (da !== db) return da.localeCompare(db);
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
    } else if (sortMode === 2) {
      copy.sort((a, b) => {
        if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
        const da = a.dueDate || '9999-12-31';
        const db = b.dueDate || '9999-12-31';
        if (da !== db) return da.localeCompare(db);
        return priorityOf(b) - priorityOf(a);
      });
    }
    return copy;
  };

  const visibleTasks = useMemo(() => sortTasks(tasks.filter(matchesTask)), [tasks, projFilter, filterTab, smartBucket, query, sortMode, todayStr]);

  const urgentFocusTasks = useMemo(
    () => (layout === 'list' && filterTab !== 'done' ? visibleTasks.filter((t) => t.status !== 'done' && priorityOf(t) >= 3) : []),
    [visibleTasks, layout, filterTab]
  );

  const groupedByProject = useMemo(() => {
    const nonUrgent = visibleTasks.filter((t) => !(layout === 'list' && filterTab !== 'done' && t.status !== 'done' && priorityOf(t) >= 3));
    const projOrder = [...new Set(nonUrgent.map((t) => (t.project || 'General').trim() || 'General'))];
    return projOrder.map((pName) => {
      const allInProj = tasks.filter((t) => ((t.project || 'General').trim() || 'General') === pName);
      const shownInProj = nonUrgent.filter((t) => ((t.project || 'General').trim() || 'General') === pName);
      const cats = [...new Set(shownInProj.map((t) => (t.category || '').trim()))];
      const catGroups = cats.map((catName) => ({
        name: catName,
        items: shownInProj.filter((t) => (t.category || '').trim() === catName),
        allCatCount: allInProj.filter((t) => (t.category || '').trim() === catName).length,
        doneCatCount: allInProj.filter((t) => (t.category || '').trim() === catName && t.status === 'done').length,
      }));
      return {
        name: pName,
        totalCount: allInProj.length,
        doneCount: allInProj.filter((t) => t.status === 'done').length,
        catGroups,
      };
    });
  }, [visibleTasks, tasks, layout, filterTab]);

  const boardColumns = useMemo(() => ({
    todo: visibleTasks.filter((t) => t.status === 'todo'),
    in_progress: visibleTasks.filter((t) => t.status === 'in_progress'),
    done: visibleTasks.filter((t) => t.status === 'done'),
  }), [visibleTasks]);

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
    let project = projFilter !== 'all' ? projFilter : 'General';
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
        status: 'todo',
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
        project: projFilter !== 'all' ? projFilter : 'General',
        isPinned: false,
      });
    setQuickNoteText('');
  };

  const renderTaskRow = (t) => {
    const isDone = t.status === 'done';
    const pri = priorityOf(t);
    const di = dateInfo(t.dueDate, isDone);
    const stObj = STATUS_OPTS.find((s) => s.value === t.status) || STATUS_OPTS[0];
    const isHl = highlightId && String(highlightId) === String(t.id);
    const docTitle = t.linkedItemTitle || (t.linkedItemId ? docById.get(Number(t.linkedItemId))?.title : '');

    return html`<div
      key=${t.id}
      className=${'pl-row' + (isDone ? ' is-done' : '') + (isHl ? ' is-hl' : '')}
      onClick=${(e) => {
        if (e.target.closest('button, a, .asel, .asel-menu')) return;
        onOpenSheet && onOpenSheet({ mode: 'task', task: t });
      }}
    >
      <button
        type="button"
        className="pl-chk"
        aria-label=${isDone ? `Reopen ${t.title}` : `Complete ${t.title}`}
        onClick=${(e) => {
          e.stopPropagation();
          onSaveTask && onSaveTask({ ...t, status: isDone ? 'todo' : 'done' });
        }}
      >
        <${Ic} n="check" s=${12} />
      </button>

      <div className="pl-mid">
        <div className="pl-title-line">
          ${!isDone && pri > 0 && html`<i className=${'pl-pri-dot p' + pri} title=${pri === 3 ? 'Urgent' : pri === 2 ? 'Hot' : 'Low'} />`}
          <span className="pl-t">${t.title}</span>
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
        ${t.notes && html`<div className="pl-n">${t.notes}</div>`}
      </div>

      <div className="pl-meta" onClick=${(e) => e.stopPropagation()}>
        ${di && html`<span className=${'pl-due ' + di.cls}>${di.txt}</span>`}

        <${Select}
          variant="meta"
          value=${t.status}
          options=${STATUS_OPTS}
          color=${stObj.color}
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
              project: projFilter !== 'all' ? projFilter : 'General',
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
          placeholder=${filterTab === 'notes' ? 'Search private notes…' : 'Search tasks, projects, or linked standards…'}
          value=${query}
          onChange=${(e) => setQuery(e.target.value)}
        />
        ${query &&
        html`<button type="button" className="pl-search-clr" aria-label="Clear search" onClick=${() => setQuery('')}>
          <${Ic} n="x" s=${12} />
        </button>`}
      </div>
      ${filterTab !== 'notes' &&
      html`<button
        type="button"
        className=${'ib' + (sortMode > 0 ? ' on' : '')}
        style=${{ width: 36, height: 36, color: sortMode > 0 ? '#fff' : 'var(--blue)', background: sortMode > 0 ? 'var(--blue)' : 'var(--fill)' }}
        title=${`${sortLabels[sortMode]} (click to switch)`}
        aria-label=${sortLabels[sortMode]}
        onClick=${() => setSortMode((s) => (s + 1) % 3)}
      >
        <${Ic} n="swap" s=${16} />
      </button>`}
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
                ? `Quick add to ${projFilter}… (Enter, or sliders for date & standard)`
                : 'Quick add task… (Enter, #Project !urgent, or sliders for calendar)'}
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
              title="Open full task sheet with calendar & standard link"
              aria-label="Task options"
              onClick=${() =>
                onOpenSheet &&
                onOpenSheet({
                  mode: 'task',
                  project: projFilter !== 'all' ? projFilter : 'General',
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
            ? html`<div className="pl-board">
                ${[
                  ['todo', 'To Do', '#8e8e93', boardColumns.todo],
                  ['in_progress', 'In Progress', '#ff9f0a', boardColumns.in_progress],
                  ['done', 'Done', '#30d158', boardColumns.done],
                ].map(
                  ([colKey, colLabel, dotCol, colItems]) => html`<div key=${colKey} className="pl-col">
                    <div className="pl-col-h">
                      <i style=${{ background: dotCol }} />
                      <span>${colLabel}</span>
                      <span>${colItems.length}</span>
                    </div>
                    ${colItems.length
                      ? colItems.map((t) => {
                          const pri = priorityOf(t);
                          const di = dateInfo(t.dueDate, t.status === 'done');
                          const docTitle = t.linkedItemTitle || (t.linkedItemId ? docById.get(Number(t.linkedItemId))?.title : '');
                          return html`<div
                            key=${t.id}
                            className=${'pl-bcard' + (t.status === 'done' ? ' is-done' : '')}
                            onClick=${(e) => {
                              if (e.target.closest('button')) return;
                              onOpenSheet && onOpenSheet({ mode: 'task', task: t });
                            }}
                          >
                            <div className="pl-title-line">
                              ${t.status !== 'done' && pri > 0 && html`<i className=${'pl-pri-dot p' + pri} />`}
                              <span className="pl-bcard-t">${t.title}</span>
                            </div>
                            <div className="pl-meta" style=${{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                              <span className="pl-note-proj">${t.project || 'General'}</span>
                              ${di && html`<span className=${'pl-due ' + di.cls}>${di.txt}</span>`}
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
                                ${colKey !== 'todo' &&
                                html`<button
                                  type="button"
                                  className="pl-mv-btn"
                                  onClick=${() => onSaveTask && onSaveTask({ ...t, status: colKey === 'done' ? 'in_progress' : 'todo' })}
                                >
                                  ←
                                </button>`}
                                ${colKey !== 'done' &&
                                html`<button
                                  type="button"
                                  className="pl-mv-btn"
                                  onClick=${() => onSaveTask && onSaveTask({ ...t, status: colKey === 'todo' ? 'in_progress' : 'done' })}
                                >
                                  ${colKey === 'todo' ? 'Start →' : 'Done ✓'}
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
                  </div>`
                )}
              </div>`
            : visibleTasks.length
            ? html`<${Fragment}>
                ${urgentFocusTasks.length > 0 &&
                html`<section className="pl-urgent" aria-label="Urgent focus">
                  <div className="pl-urgent-head">
                    <b>Urgent · ${urgentFocusTasks.length}</b>
                    <span>High-priority items</span>
                  </div>
                  <div className="pl-card">${urgentFocusTasks.map(renderTaskRow)}</div>
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
                          <span>${cg.name || 'General'}</span>
                          <span>${cg.doneCatCount}/${cg.allCatCount}</span>
                        </div>`}
                        <div className="pl-card">${cg.items.map(renderTaskRow)}</div>
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
                  project: projFilter !== 'all' ? projFilter : 'General',
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
                                status: 'todo',
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
