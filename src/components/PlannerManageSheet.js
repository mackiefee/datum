import { html, Fragment, useState, useEffect } from '../lib/react.js';
import { Ic } from './Icon.js';
import { PLANNER_PALETTE } from '../utils/planner.js';

export function PlannerManageSheet({
  open,
  mode = 'statuses', // 'statuses' | 'lists'
  statuses = [],
  projects = [],
  categories = [],
  tasks = [],
  onClose,
  onSaveStatuses,
  onSaveLists,
}) {
  const [stDraft, setStDraft] = useState([]);
  const [paletteOpenIdx, setPaletteOpenIdx] = useState(-1);

  const [projDraft, setProjDraft] = useState([]);
  const [catDraft, setCatDraft] = useState([]);

  useEffect(() => {
    if (!open) return;
    setPaletteOpenIdx(-1);
    if (mode === 'statuses') {
      setStDraft(statuses.map((s) => ({ ...s })));
    } else {
      setProjDraft(projects.map((name) => ({ oldName: name, name, confirmDel: false })));
      setCatDraft(categories.map((name) => ({ oldName: name, name })));
    }
  }, [open, mode, statuses, projects, categories]);

  if (!open) return null;

  const swap = (arr, idx, dir) => {
    const next = [...arr];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return next;
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  };

  const countTasksForProject = (oldName) =>
    tasks.filter((t) => (t.project || 'General') === oldName).length;

  const submit = (e) => {
    e && e.preventDefault();
    if (mode === 'statuses') {
      const cleaned = stDraft.map((s) => ({
        ...s,
        label: String(s.label || '').trim() || 'Untitled',
      }));
      onSaveStatuses && onSaveStatuses(cleaned);
    } else {
      const nextProjs = [];
      const projRenameMap = {};
      const seenProj = new Set();
      projDraft.forEach((p) => {
        const clean = String(p.name || '').trim() || 'Untitled';
        if (p.oldName && p.oldName !== clean) projRenameMap[p.oldName] = clean;
        if (!seenProj.has(clean)) {
          seenProj.add(clean);
          nextProjs.push(clean);
        }
      });
      if (!nextProjs.length) nextProjs.push('General');

      const nextCats = [];
      const catRenameMap = {};
      const seenCat = new Set();
      catDraft.forEach((c) => {
        const clean = String(c.name || '').trim();
        if (c.oldName && c.oldName !== clean) catRenameMap[c.oldName] = clean;
        if (clean && !seenCat.has(clean)) {
          seenCat.add(clean);
          nextCats.push(clean);
        }
      });

      onSaveLists &&
        onSaveLists({
          projects: nextProjs,
          categories: nextCats,
          projRenameMap,
          catRenameMap,
          keptOldProjects: projDraft.map((p) => p.oldName).filter(Boolean),
          keptOldCategories: catDraft.map((c) => c.oldName).filter(Boolean),
        });
    }
    onClose && onClose();
  };

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
      aria-label=${mode === 'statuses' ? 'Manage Statuses' : 'Projects & Categories'}
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
        <b>${mode === 'statuses' ? 'Statuses' : 'Projects & Categories'}</b>
        <button type="submit" className="btn p sm qc-sh-save">Save</button>
      </div>

      ${mode === 'statuses'
        ? html`<${Fragment}>
            <div className="qc-cell">
              ${stDraft.map(
                (s, idx) => html`<div key=${s.id || idx} className="pl-srow-wrap">
                  <div className="pl-srow">
                    <button
                      type="button"
                      className="pl-dotb"
                      style=${{ background: s.color || '#8e8e93' }}
                      aria-label=${`Color for ${s.label}`}
                      title="Pick status color"
                      onClick=${() => setPaletteOpenIdx((cur) => (cur === idx ? -1 : idx))}
                    />
                    <input
                      type="text"
                      value=${s.label}
                      maxLength=${28}
                      placeholder="Status name"
                      onChange=${(e) => {
                        const val = e.target.value;
                        setStDraft((prev) => prev.map((x, k) => (k === idx ? { ...x, label: val } : x)));
                      }}
                    />
                    <span className="pl-mv">
                      <button
                        type="button"
                        disabled=${idx === 0}
                        aria-label="Move up"
                        onClick=${() => setStDraft((prev) => swap(prev, idx, -1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled=${idx === stDraft.length - 1}
                        aria-label="Move down"
                        onClick=${() => setStDraft((prev) => swap(prev, idx, 1))}
                      >
                        ↓
                      </button>
                    </span>
                    ${s.isDone
                      ? html`<span className="pl-role-tag ok" title="Completes task">✓ Done</span>`
                      : s.isRevision
                      ? html`<span className="pl-role-tag rev" title="Starting status of new client revisions">↻ Rev</span>`
                      : html`<button
                          type="button"
                          className="pl-rmv"
                          title="Delete status"
                          aria-label=${`Delete ${s.label}`}
                          onClick=${() => setStDraft((prev) => prev.filter((_, k) => k !== idx))}
                        >
                          −
                        </button>`}
                  </div>
                  ${paletteOpenIdx === idx &&
                  html`<div className="pl-pal-row">
                    ${PLANNER_PALETTE.map(
                      (col) => html`<button
                        key=${col}
                        type="button"
                        className=${s.color === col ? 'on' : ''}
                        style=${{ background: col }}
                        aria-label=${`Color ${col}`}
                        onClick=${() => {
                          setStDraft((prev) => prev.map((x, k) => (k === idx ? { ...x, color: col } : x)));
                          setPaletteOpenIdx(-1);
                        }}
                      />`
                    )}
                  </div>`}
                </div>`
              )}
              <button
                type="button"
                className="pl-addc"
                onClick=${() =>
                  setStDraft((prev) => [
                    ...prev,
                    { id: 'st-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), label: 'New Status', color: '#0a84ff', isDone: false, isRevision: false },
                  ])
                }
              >
                + Add Status
              </button>
            </div>
            <p className="pl-sheet-foot">
              ✓ completes tasks; ↻ is the starting status for new client revisions. Both can be renamed and recolored, but not deleted.
            </p>
          </${Fragment}>`
        : html`<${Fragment}>
            <div className="pl-gh-lbl">Projects</div>
            <div className="qc-cell">
              ${projDraft.map((p, idx) => {
                const cnt = p.oldName ? countTasksForProject(p.oldName) : 0;
                return html`<div key=${p.oldName || 'new-p-' + idx} className="pl-srow">
                  <input
                    type="text"
                    value=${p.name}
                    maxLength=${48}
                    placeholder="Project name"
                    onChange=${(e) => {
                      const val = e.target.value;
                      setProjDraft((prev) => prev.map((x, k) => (k === idx ? { ...x, name: val } : x)));
                    }}
                  />
                  <span className="pl-mv">
                    <button type="button" disabled=${idx === 0} onClick=${() => setProjDraft((prev) => swap(prev, idx, -1))}>↑</button>
                    <button type="button" disabled=${idx === projDraft.length - 1} onClick=${() => setProjDraft((prev) => swap(prev, idx, 1))}>↓</button>
                  </span>
                  ${projDraft.length > 1 &&
                  (p.confirmDel && cnt > 0
                    ? html`<button
                        type="button"
                        className="pl-del-cf"
                        onClick=${() => setProjDraft((prev) => prev.filter((_, k) => k !== idx))}
                      >
                        Delete (${cnt})?
                      </button>`
                    : html`<button
                        type="button"
                        className="pl-rmv"
                        title="Remove project"
                        onClick=${() => {
                          if (!cnt) setProjDraft((prev) => prev.filter((_, k) => k !== idx));
                          else setProjDraft((prev) => prev.map((x, k) => (k === idx ? { ...x, confirmDel: true } : x)));
                        }}
                      >
                        −
                      </button>`)}
                </div>`;
              })}
              <button
                type="button"
                className="pl-addc"
                onClick=${() => setProjDraft((prev) => [...prev, { oldName: '', name: '', confirmDel: false }])}
              >
                + Add Project
              </button>
            </div>

            <div className="pl-gh-lbl">Remembered Categories</div>
            <div className="qc-cell">
              ${catDraft.map(
                (c, idx) => html`<div key=${c.oldName || 'new-c-' + idx} className="pl-srow">
                  <input
                    type="text"
                    value=${c.name}
                    maxLength=${40}
                    placeholder="Category name"
                    onChange=${(e) => {
                      const val = e.target.value;
                      setCatDraft((prev) => prev.map((x, k) => (k === idx ? { ...x, name: val } : x)));
                    }}
                  />
                  <span className="pl-mv">
                    <button type="button" disabled=${idx === 0} onClick=${() => setCatDraft((prev) => swap(prev, idx, -1))}>↑</button>
                    <button type="button" disabled=${idx === catDraft.length - 1} onClick=${() => setCatDraft((prev) => swap(prev, idx, 1))}>↓</button>
                  </span>
                  <button
                    type="button"
                    className="pl-rmv"
                    title="Remove category"
                    onClick=${() => setCatDraft((prev) => prev.filter((_, k) => k !== idx))}
                  >
                    −
                  </button>
                </div>`
              )}
              <button
                type="button"
                className="pl-addc"
                onClick=${() => setCatDraft((prev) => [...prev, { oldName: '', name: '' }])}
              >
                + Add Category
              </button>
            </div>
            <p className="pl-sheet-foot">
              Categories are remembered across all projects and synced privately to Supabase.
            </p>
          </${Fragment}>`}
    </form>
  </div>`;
}
