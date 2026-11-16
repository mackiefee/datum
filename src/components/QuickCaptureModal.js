import { html, Fragment, useState, useEffect, useMemo } from '../lib/react.js';
import { Ic } from './Icon.js';
import { Select } from './Select.js';

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_OPTS = [
  { value: 'todo', label: 'To Do', color: '#8e8e93' },
  { value: 'in_progress', label: 'In Progress', color: '#ff9f0a' },
  { value: 'done', label: 'Done', color: '#30d158' },
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
  initialNote = null,
  initialProject = '',
  projects = [],
  docs = [],
  onClose,
  onSaveTask,
  onDeleteTask,
  onSaveNote,
  onDeleteNote,
}) {
  const isEditingTask = Boolean(initialTask && initialTask.id);
  const isEditingNote = Boolean(initialNote && initialNote.id);
  const isEditingExisting = isEditingTask || isEditingNote;

  const [mode, setMode] = useState(initialMode);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [project, setProject] = useState('General');
  const [creatingProj, setCreatingProj] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('todo');
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

    if (initialTask && initialTask.id) {
      setMode('task');
      setTitle(initialTask.title || '');
      setNotes(initialTask.notes || '');
      setProject(initialTask.project || 'General');
      setCategory(initialTask.category || '');
      setStatus(initialTask.status || 'todo');
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
      return;
    }

    setMode(initialMode || 'task');
    setTitle(initialDoc && initialMode === 'task' ? `Follow up: ${initialDoc.title}` : (initialTask?.title || ''));
    setNotes('');
    setProject(initialProject || (initialDoc && initialDoc.disc) || 'General');
    setCategory('');
    setStatus('todo');
    setPriority(initialTask?.priority || 0);
    const seedDate = initialMode === 'task' ? isoOffset(0) : '';
    setDueDate(seedDate);
    const n = new Date();
    setCalMonth({ y: n.getFullYear(), m: n.getMonth() });
    setLinkedDocId(initialDoc && initialDoc.id ? String(initialDoc.id) : '');
    setIsPinned(false);
  }, [open, initialMode, initialDoc?.id, initialTask?.id, initialNote?.id, initialProject]);

  const sortedDocs = useMemo(
    () => [...(docs || [])].sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    [docs]
  );

  const projectOptions = useMemo(() => {
    const set = new Set(['General', 'P&C', 'Warehouse R21', 'CL-RFI Standards', ...(projects || [])]);
    if (project) set.add(project);
    return [
      ...[...set].sort().map((p) => ({ value: p, label: p })),
      { value: '__new__', label: '+ New project…' },
    ];
  }, [projects, project]);

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

  const finalProject = creatingProj ? (newProjName.trim() || 'General') : (project || 'General');

  const canSubmit =
    mode === 'note'
      ? Boolean(title.trim() || notes.trim())
      : Boolean(title.trim()) && (!creatingProj || Boolean(newProjName.trim()));

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

    onSaveTask &&
      onSaveTask({
        ...(initialTask || {}),
        title: title.trim(),
        notes: notes.trim(),
        project: finalProject,
        category: category.trim(),
        priority,
        isUrgent: priority >= 3,
        dueDate: dueDate || '',
        status,
        linkedItemId: docObj ? docObj.id : null,
        linkedItemTitle: docObj ? docObj.title : '',
      });
    onClose && onClose();
  };

  // Build 7-column calendar cells
  const calFirstDay = new Date(calMonth.y, calMonth.m, 1).getDay();
  const calDaysInMonth = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
  const calPad = Array.from({ length: calFirstDay }, (_, i) => i);
  const calDays = Array.from({ length: calDaysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const mm = String(calMonth.m + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    return { dayNum, iso: `${calMonth.y}-${mm}-${dd}` };
  });

  const sheetTitle = isEditingTask
    ? 'Edit Task'
    : isEditingNote
    ? 'Edit Note'
    : mode === 'note'
    ? 'New Private Note'
    : 'New Task';

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
          ${isEditingExisting ? 'Save' : 'Add'}
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

      <div className="qc-cell">
        <input
          autoFocus
          type="text"
          placeholder=${mode === 'task' ? 'Title' : 'Note title'}
          value=${title}
          onChange=${(e) => setTitle(e.target.value)}
        />
        ${mode === 'task' &&
        html`<input
          type="text"
          placeholder="Category / discipline group (optional, e.g. BIM QA)"
          value=${category}
          onChange=${(e) => setCategory(e.target.value)}
        />`}
        <textarea
          placeholder=${mode === 'task'
            ? 'Notes, Revit details, constraints…'
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
        ? html`<div className="qc-cell">
            <div className="qc-row">
              <span className="qc-row-lbl">Status</span>
              <${Select}
                variant="meta"
                value=${status}
                options=${STATUS_OPTS}
                color=${(STATUS_OPTS.find((s) => s.value === status) || STATUS_OPTS[0]).color}
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
          </div>`
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
