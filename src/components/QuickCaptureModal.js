import { html, Fragment, useState, useEffect, useMemo } from '../lib/react.js';
import { Ic } from './Icon.js';
import { Select } from './Select.js';
import {
  DEFAULT_PLANNER_STATUSES,
  DEFAULT_PLANNER_CATEGORIES,
  DEFAULT_PLANNER_PROJECTS,
  getStatusObj,
  isDoneStatus,
  getRevisionStartStatus,
  getFirstActiveStatus,
  parseTaskLinks,
  linkAutoLabel,
} from '../utils/planner.js';

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PRIORITY_LEVELS = [
  { val: 0, label: 'None', dot: '' },
  { val: 1, label: 'Low', dot: 'p1' },
  { val: 2, label: 'Hot', dot: 'p2' },
  { val: 3, label: 'Urgent', dot: 'p3' },
];

function isoOffset(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDueNice(isoStr) {
  if (!isoStr) return '';
  const p = String(isoStr).split('-');
  if (p.length !== 3) return isoStr;
  return `${MONTHS_FULL[Number(p[1]) - 1]?.slice(0, 3) || p[1]} ${Number(p[2])}, ${p[0]}`;
}

export function QuickCaptureModal({
  open,
  initialMode = 'task',
  initialDoc = null,
  initialTask = null,
  initialRevisionParent = null,
  initialNote = null,
  initialProject = '',
  statuses = DEFAULT_PLANNER_STATUSES,
  categories = DEFAULT_PLANNER_CATEGORIES,
  projects = DEFAULT_PLANNER_PROJECTS,
  tasks = [],
  docs = [],
  onClose,
  onSaveTask,
  onDeleteTask,
  onSaveNote,
  onDeleteNote,
  onStartRevision,
}) {
  const isEditingTask = Boolean(initialTask && initialTask.id);
  const isNewRevision = Boolean(!isEditingTask && initialRevisionParent && initialRevisionParent.id);
  const isEditingNote = Boolean(initialNote && initialNote.id);
  const isEditingExisting = isEditingTask || isEditingNote || isNewRevision;

  const [mode, setMode] = useState(initialMode);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [project, setProject] = useState('General');
  const [creatingProj, setCreatingProj] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [category, setCategory] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [links, setLinks] = useState([]);
  const [linkInput, setLinkInput] = useState('');
  const [status, setStatus] = useState(() => getFirstActiveStatus(statuses).id);
  const [priority, setPriority] = useState(0);
  const [dueDate, setDueDate] = useState(isoOffset(0));
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [linkedDocId, setLinkedDocId] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const todayIso = isoOffset(0);

  useEffect(() => {
    if (!open) return;
    setCreatingProj(false);
    setNewProjName('');
    setCreatingCat(false);
    setNewCatName('');
    setLinkInput('');

    if (initialRevisionParent && initialRevisionParent.id) {
      const p = initialRevisionParent;
      setMode('task');
      setTitle(p.title || '');
      setNotes('');
      setProject(p.project || 'General');
      setCategory(p.category || '');
      setLinks(Array.isArray(p.links) ? p.links.map((x) => ({ ...x })) : []);
      setStatus(getRevisionStartStatus(statuses).id);
      const pVal = Number.isFinite(Number(p.priority)) ? Number(p.priority) : (p.isUrgent ? 3 : 0);
      setPriority(pVal);
      setDueDate('');
      const n = new Date();
      setCalMonth({ y: n.getFullYear(), m: n.getMonth() });
      setLinkedDocId(p.linkedItemId ? String(p.linkedItemId) : '');
      return;
    }

    if (initialTask && initialTask.id) {
      setMode('task');
      setTitle(initialTask.title || '');
      setNotes(initialTask.notes || '');
      setProject(initialTask.project || 'General');
      setCategory(initialTask.category || '');
      setLinks(Array.isArray(initialTask.links) ? initialTask.links.map((x) => ({ ...x })) : []);
      setStatus(initialTask.status || getFirstActiveStatus(statuses).id);
      const pVal = Number.isFinite(Number(initialTask.priority))
        ? Number(initialTask.priority)
        : initialTask.isUrgent
        ? 3
        : 0;
      setPriority(pVal);
      const dd = initialTask.dueDate || '';
      setDueDate(dd);
      if (dd && /^\d{4}-\d{2}-\d{2}$/.test(dd)) {
        const parts = dd.split('-');
        setCalMonth({ y: Number(parts[0]), m: Number(parts[1]) - 1 });
      }
      setLinkedDocId(initialTask.linkedItemId ? String(initialTask.linkedItemId) : '');
      return;
    }

    if (initialNote && initialNote.id) {
      setMode('note');
      setTitle(initialNote.title || '');
      setNotes(initialNote.body || '');
      setProject(initialNote.project || 'General');
      setIsPinned(Boolean(initialNote.isPinned));
      setLinkedDocId('');
      setLinks([]);
      return;
    }

    setMode(initialMode || 'task');
    setTitle(initialDoc && initialMode === 'task' ? `Follow up: ${initialDoc.title}` : (initialTask?.title || ''));
    setNotes('');
    setProject(initialProject || (initialDoc && initialDoc.disc) || 'General');
    setCategory((categories && categories[0]) || '');
    setLinks([]);
    setStatus(getFirstActiveStatus(statuses).id);
    setPriority(initialTask?.priority || 0);
    setDueDate(initialMode === 'task' ? isoOffset(0) : '');
    const n = new Date();
    setCalMonth({ y: n.getFullYear(), m: n.getMonth() });
    setLinkedDocId(initialDoc && initialDoc.id ? String(initialDoc.id) : '');
    setIsPinned(false);
  }, [open, initialMode, initialDoc?.id, initialTask?.id, initialRevisionParent?.id, initialNote?.id, initialProject]);

  const sortedDocs = useMemo(
    () => [...(docs || [])].sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    [docs]
  );

  const projectOptions = useMemo(() => {
    const set = new Set([...(projects || [])]);
    if (project) set.add(project);
    if (!set.size) set.add('General');
    return [
      ...[...set].sort().map((p) => ({ value: p, label: p })),
      { value: '__new__', label: '+ New project…' },
    ];
  }, [projects, project]);

  const categoryOptions = useMemo(() => {
    const set = new Set([...(categories || [])]);
    if (category) set.add(category);
    return [
      { value: '', label: 'None' },
      ...[...set].sort().map((c) => ({ value: c, label: c })),
      { value: '__new__', label: '+ New category…' },
    ];
  }, [categories, category]);

  const statusOptions = useMemo(
    () =>
      (statuses && statuses.length ? statuses : DEFAULT_PLANNER_STATUSES).map((s) => ({
        value: s.id,
        label: s.label,
        color: s.color || '#8e8e93',
      })),
    [statuses]
  );

  const docOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...sortedDocs.slice(0, 70).map((d) => ({
        value: String(d.id),
        label: d.title || `Standard #${d.id}`,
        sub: d.disc || 'Standard',
      })),
    ],
    [sortedDocs]
  );

  if (!open) return null;

  const commitPendingLinks = (curLinks = links) => {
    if (!linkInput.trim()) return curLinks;
    const parsed = parseTaskLinks(linkInput, curLinks);
    if (parsed.length) {
      const next = [...curLinks, ...parsed].slice(0, 30);
      setLinks(next);
      setLinkInput('');
      return next;
    }
    return curLinks;
  };

  const addLinkFromInput = () => {
    commitPendingLinks(links);
  };

  const finalProject = creatingProj ? (newProjName.trim() || 'General') : (project || 'General');
  const finalCategory = creatingCat ? newCatName.trim() : category.trim();

  const canSubmit =
    mode === 'note'
      ? Boolean(title.trim() || notes.trim())
      : Boolean(title.trim()) && (!creatingProj || Boolean(newProjName.trim()));

  const existingRevsFor = (parentId) =>
    (tasks || []).filter((x) => x.parentTaskId === parentId);

  const nextRevNumber = isNewRevision
    ? existingRevsFor(initialRevisionParent.id).length + 1
    : initialTask?.revNumber || 0;

  const parentTaskObj =
    isNewRevision
      ? initialRevisionParent
      : isEditingTask && initialTask.parentTaskId
      ? (tasks || []).find((x) => x.id === initialTask.parentTaskId) || null
      : null;

  const submit = (e) => {
    e && e.preventDefault();
    if (!canSubmit) return;

    const docObj = linkedDocId ? sortedDocs.find((d) => String(d.id) === String(linkedDocId)) : null;

    if (mode === 'note') {
      const bodyStr = notes.trim();
      const bodyWithLink =
        docObj && !bodyStr.includes(`|${docObj.id}]]`)
          ? `${bodyStr}${bodyStr ? '\n\n' : ''}[[${docObj.title}|${docObj.id}]]`
          : bodyStr;
      const wikiIds = [...bodyWithLink.matchAll(/\[\[[^|\]]+\|(\d+)\]\]/g)].map((m) => Number(m[1]));
      onSaveNote &&
        onSaveNote({
          ...(initialNote || {}),
          title: title.trim() || 'Private Note',
          body: bodyWithLink,
          project: finalProject,
          isPinned,
          linkedItemIds: [...new Set([...(initialNote?.linkedItemIds || []), ...wikiIds, ...(docObj ? [docObj.id] : [])])],
        });
      onClose && onClose();
      return;
    }

    const finalLinks = commitPendingLinks(links).map((x) => ({
      u: x.u,
      l: String(x.l || '').trim(),
    }));

    const taskPayload = {
      ...(isEditingTask ? initialTask : {}),
      title: title.trim(),
      notes: notes.trim(),
      project: finalProject,
      category: finalCategory,
      priority,
      isUrgent: priority >= 3,
      dueDate: dueDate || '',
      status,
      links: finalLinks,
      parentTaskId: isNewRevision
        ? initialRevisionParent.id
        : isEditingTask
        ? initialTask.parentTaskId || null
        : null,
      revNumber: isNewRevision ? nextRevNumber : isEditingTask ? initialTask.revNumber || 0 : 0,
      requestedAt: isNewRevision
        ? todayIso
        : isEditingTask
        ? initialTask.requestedAt || ''
        : '',
      linkedItemId: docObj ? docObj.id : null,
      linkedItemTitle: docObj ? docObj.title : '',
    };

    onSaveTask && onSaveTask(taskPayload);
    onClose && onClose();
  };

  // Calendar grid
  const calFirstDay = new Date(calMonth.y, calMonth.m, 1).getDay();
  const calDaysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
  const calPad = Array.from({ length: calFirstDay }, (_, i) => i);
  const calDays = Array.from({ length: calDaysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const mm = String(calMonth.m + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    return { dayNum, iso: `${calMonth.y}-${mm}-${dd}` };
  });

  const curStatusObj = getStatusObj(statuses, status);
  const canSpawnRevisionFromEdit =
    isEditingTask && isDoneStatus(statuses, status) && onStartRevision;

  const sheetTitle = isNewRevision
    ? 'New Revision'
    : isEditingTask
    ? 'Edit Task'
    : isEditingNote
    ? 'Edit Note'
    : mode === 'note'
    ? 'New Private Note'
    : 'New Task';

  const contextHint =
    isNewRevision && parentTaskObj
      ? `Revision R${nextRevNumber} of ${parentTaskObj.title} · requested ${formatDueNice(todayIso)}`
      : isEditingTask && parentTaskObj
      ? `Revision R${initialTask.revNumber} of ${parentTaskObj.title}${initialTask.requestedAt ? ` · requested ${formatDueNice(initialTask.requestedAt)}` : ''}`
      : isEditingTask && !initialTask.parentTaskId && existingRevsFor(initialTask.id).length > 0
      ? `${existingRevsFor(initialTask.id).length} client revision(s)`
      : '';

  return html`<div
    className="qc-ov"
    onMouseDown=${(e) => {
      if (e.target === e.currentTarget && onClose) onClose();
    }}
  >
    <form
      className="qc-sheet"
      role="dialog"
      aria-modal="true"
      aria-label=${sheetTitle}
      onSubmit=${submit}
      onKeyDown=${(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose && onClose();
        }
      }}
    >
      <div className="qc-sh">
        <button type="button" className="qc-sh-cancel" onClick=${onClose}>Cancel</button>
        <b>${sheetTitle}</b>
        <button type="submit" className="btn p sm qc-sh-save" disabled=${!canSubmit}>
          ${isEditingTask ? 'Save' : isEditingNote ? 'Save' : 'Add'}
        </button>
      </div>

      ${!isEditingExisting &&
      html`<div className="seg" role="group" aria-label="Capture type" style=${{ marginTop: 0 }}>
        <button type="button" className=${mode === 'task' ? 'on' : ''} onClick=${() => setMode('task')}>
          Task
        </button>
        <button type="button" className=${mode === 'note' ? 'on' : ''} onClick=${() => setMode('note')}>
          Private Note
        </button>
      </div>`}

      ${contextHint && html`<div className="qc-ctx-note">${contextHint}</div>`}

      <div className="qc-cell">
        <input
          autoFocus
          type="text"
          placeholder=${mode === 'task' ? 'Title' : 'Note title'}
          value=${title}
          onChange=${(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder=${isNewRevision || (isEditingTask && initialTask.parentTaskId)
            ? 'What did the client change?'
            : mode === 'task'
            ? 'Description, Revit details, constraints…'
            : 'Write private thoughts, meeting summary, or [[Standard links]]…'}
          value=${notes}
          onChange=${(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="qc-cell">
        <div className="qc-row">
          <span className="qc-row-lbl">Project</span>
          <${Select}
            variant="inline"
            value=${creatingProj ? '__new__' : project}
            options=${projectOptions}
            ariaLabel="Project"
            onChange=${(v) => {
              if (v === '__new__') {
                setCreatingProj(true);
              } else {
                setCreatingProj(false);
                setProject(v);
              }
            }}
          />
        </div>
        ${creatingProj &&
        html`<input
          type="text"
          placeholder="New project name"
          value=${newProjName}
          onChange=${(e) => setNewProjName(e.target.value)}
          autoFocus
        />`}

        ${mode === 'task' &&
        html`<${Fragment}>
          <div className="qc-row">
            <span className="qc-row-lbl">Category</span>
            <${Select}
              variant="inline"
              value=${creatingCat ? '__new__' : category}
              options=${categoryOptions}
              placeholder="None"
              ariaLabel="Category"
              onChange=${(v) => {
                if (v === '__new__') {
                  setCreatingCat(true);
                } else {
                  setCreatingCat(false);
                  setCategory(v);
                }
              }}
            />
          </div>
          ${creatingCat &&
          html`<input
            type="text"
            placeholder="New category name (will be remembered)"
            value=${newCatName}
            onChange=${(e) => setNewCatName(e.target.value)}
            autoFocus
          />`}
        </${Fragment}>`}

        <div className="qc-row">
          <span className="qc-row-lbl">
            ${mode === 'note' ? 'Insert [[Standard]]' : 'Linked Standard'}
          </span>
          <${Select}
            variant="inline"
            value=${linkedDocId}
            options=${docOptions}
            placeholder="None"
            ariaLabel="Linked Standard"
            minMenuWidth=${260}
            onChange=${(val) => {
              if (mode === 'note' && val) {
                const picked = sortedDocs.find((d) => String(d.id) === String(val));
                if (picked && !notes.includes(`|${picked.id}]]`)) {
                  const sep = notes && !/\s$/.test(notes) ? ' ' : '';
                  setNotes((prev) => prev + sep + `[[${picked.title}|${picked.id}]]`);
                }
                setLinkedDocId('');
                return;
              }
              setLinkedDocId(val);
            }}
          />
        </div>
      </div>

      ${mode === 'task'
        ? html`<${Fragment}>
            <div className="qc-cell">
              ${links.map(
                (lk, idx) => html`<div key=${lk.u + '-' + idx} className="pl-lkr">
                  <span className="pl-lkr-ico"><${Ic} n="link" s=${14} /></span>
                  <div className="pl-lkr-x">
                    <input
                      type="text"
                      className="pl-lkni"
                      value=${lk.l || ''}
                      placeholder=${linkAutoLabel(lk.u)}
                      aria-label="Link label"
                      onChange=${(e) => {
                        const val = e.target.value;
                        setLinks((prev) => prev.map((x, k) => (k === idx ? { ...x, l: val } : x)));
                      }}
                    />
                    <div className="pl-lku">${lk.u}</div>
                  </div>
                  <button
                    type="button"
                    className="pl-rmv"
                    aria-label="Remove link"
                    onClick=${() => setLinks((prev) => prev.filter((_, k) => k !== idx))}
                  >
                    −
                  </button>
                </div>`
              )}
              <div className="pl-lkadd">
                <input
                  type="text"
                  inputMode="url"
                  placeholder="Add link — paste URL(s) or Drive / ACC path"
                  value=${linkInput}
                  onChange=${(e) => setLinkInput(e.target.value)}
                  onKeyDown=${(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      addLinkFromInput();
                    }
                  }}
                  onPaste=${(e) => {
                    const tx = (e.clipboardData && e.clipboardData.getData('text')) || '';
                    if (tx && (/\n/.test(tx.trim()) || (!linkInput && /^\s*(?:https?:|mailto:|utk:\/\/|\\\\)\S+\s*$/i.test(tx)))) {
                      e.preventDefault();
                      const combined = linkInput ? `${linkInput}\n${tx}` : tx;
                      const parsed = parseTaskLinks(combined, links);
                      if (parsed.length) setLinks((prev) => [...prev, ...parsed].slice(0, 30));
                      setLinkInput('');
                    }
                  }}
                  onBlur=${addLinkFromInput}
                />
                <button
                  type="button"
                  disabled=${!linkInput.trim()}
                  onMouseDown=${(e) => e.preventDefault()}
                  onClick=${addLinkFromInput}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="qc-cell">
              <div className="qc-row">
                <span className="qc-row-lbl">Status</span>
                <${Select}
                  variant="meta"
                  value=${status}
                  options=${statusOptions}
                  color=${curStatusObj.color || '#8e8e93'}
                  ariaLabel="Task status"
                  onChange=${(v) => setStatus(v)}
                />
              </div>

              <div className="qc-row">
                <span className="qc-row-lbl">Priority</span>
                <div className="seg qc-pri-seg" role="group" aria-label="Task priority" style=${{ marginTop: 0 }}>
                  ${PRIORITY_LEVELS.map(
                    (lv) => html`<button
                      key=${lv.val}
                      type="button"
                      className=${priority === lv.val ? 'on' : ''}
                      onClick=${() => setPriority(lv.val)}
                    >
                      ${lv.dot && html`<i className=${'pl-pri-dot ' + lv.dot} />`}
                      <span>${lv.label}</span>
                    </button>`
                  )}
                </div>
              </div>

              <div className="qc-row">
                <div>
                  <div className="qc-row-lbl">Due Date</div>
                  ${dueDate && html`<div className="qc-row-sub">${formatDueNice(dueDate)}</div>`}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked=${Boolean(dueDate)}
                  aria-label="Toggle due date"
                  className=${'pl-sw' + (dueDate ? ' on' : '')}
                  onClick=${() => {
                    if (dueDate) setDueDate('');
                    else {
                      const td = isoOffset(0);
                      setDueDate(td);
                      const n = new Date();
                      setCalMonth({ y: n.getFullYear(), m: n.getMonth() });
                    }
                  }}
                />
              </div>

              <div className="qc-dq">
                <button
                  type="button"
                  className=${dueDate === isoOffset(0) ? 'on' : ''}
                  onClick=${() => setDueDate(isoOffset(0))}
                >
                  Today
                </button>
                <button
                  type="button"
                  className=${dueDate === isoOffset(1) ? 'on' : ''}
                  onClick=${() => setDueDate(isoOffset(1))}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  className=${dueDate === isoOffset(7) ? 'on' : ''}
                  onClick=${() => setDueDate(isoOffset(7))}
                >
                  +1 week
                </button>
              </div>

              ${dueDate &&
              html`<div className="pl-cal">
                <div className="pl-cal-h">
                  <b>${MONTHS_FULL[calMonth.m]} ${calMonth.y}</b>
                  <span className="pl-cal-nav">
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick=${() =>
                        setCalMonth((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))
                      }
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick=${() =>
                        setCalMonth((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))
                      }
                    >
                      ›
                    </button>
                  </span>
                </div>
                <div className="pl-cal-w">
                  ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => html`<i key=${i}>${d}</i>`)}
                </div>
                <div className="pl-cal-g">
                  ${calPad.map((i) => html`<i key=${'pad-' + i} />`)}
                  ${calDays.map(
                    (day) => html`<button
                      key=${day.iso}
                      type="button"
                      className=${(day.iso === dueDate ? 'sel ' : '') + (day.iso === todayIso ? 'today' : '')}
                      onClick=${() => setDueDate(day.iso)}
                    >
                      <span>${day.dayNum}</span>
                    </button>`
                  )}
                </div>
              </div>`}
            </div>
          </${Fragment}>`
        : html`<div className="qc-cell">
            <div className="qc-row">
              <span className="qc-row-lbl">Pin to top</span>
              <button
                type="button"
                role="switch"
                aria-checked=${isPinned}
                aria-label="Pin note"
                className=${'pl-sw' + (isPinned ? ' on' : '')}
                onClick=${() => setIsPinned((v) => !v)}
              />
            </div>
          </div>`}

      ${canSpawnRevisionFromEdit &&
      html`<div className="qc-cell">
        <button
          type="button"
          className="pl-addc"
          style=${{ textAlign: 'center', fontWeight: 550 }}
          onClick=${() => {
            const rootParent = initialTask.parentTaskId
              ? (tasks || []).find((x) => x.id === initialTask.parentTaskId) || initialTask
              : initialTask;
            onStartRevision(rootParent);
          }}
        >
          ↻ Client update → new revision
        </button>
      </div>`}

      ${(isEditingTask && onDeleteTask) || (isEditingNote && onDeleteNote)
        ? html`<div className="qc-cell">
            <button
              type="button"
              className="qc-danger"
              onClick=${() => {
                if (isEditingTask) onDeleteTask(initialTask.id);
                else if (isEditingNote) onDeleteNote(initialNote.id);
                onClose && onClose();
              }}
            >
              ${isEditingTask ? 'Delete Task' : 'Delete Note'}
            </button>
          </div>`
        : null}
    </form>
  </div>`;
}
