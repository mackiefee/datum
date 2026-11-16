export const PLANNER_PALETTE = [
  '#8e8e93',
  '#0a84ff',
  '#bf5af2',
  '#ff9f0a',
  '#ffd60a',
  '#30d158',
  '#ff453a',
  '#ff375f',
  '#64d2ff',
];

export const DEFAULT_PLANNER_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#8e8e93' },
  { id: 'in_progress', label: 'In Progress', color: '#ff9f0a' },
  { id: 'sent_qa', label: 'Sent for QA', color: '#0a84ff' },
  { id: 'reprint', label: 'Revision', color: '#bf5af2', isRevision: true },
  { id: 'done', label: 'Done', color: '#30d158', isDone: true },
];

export const DEFAULT_PLANNER_CATEGORIES = ['Shop Drawings', 'BIM QA', 'Cut Tickets', 'Cutouts'];

export const DEFAULT_PLANNER_PROJECTS = ['General', 'P&C', 'Warehouse R21', 'CL-RFI Standards'];

export function cloneDefaultStatuses() {
  return DEFAULT_PLANNER_STATUSES.map((s) => ({ ...s }));
}

export function normalizePlannerPrefs(raw, existingTasks = []) {
  const src = raw && typeof raw === 'object' ? raw : {};

  let statuses = Array.isArray(src.statuses) && src.statuses.length
    ? src.statuses
        .filter((s) => s && s.id && s.label)
        .map((s) => ({
          id: String(s.id).trim().slice(0, 64),
          label: String(s.label).trim().slice(0, 40),
          color: String(s.color || '#8e8e93').slice(0, 24),
          isDone: Boolean(s.isDone),
          isRevision: Boolean(s.isRevision),
        }))
    : cloneDefaultStatuses();

  if (!statuses.some((s) => s.isDone)) {
    const doneCand = statuses.find((s) => s.id === 'done');
    if (doneCand) doneCand.isDone = true;
    else statuses.push({ id: 'done', label: 'Done', color: '#30d158', isDone: true });
  }
  if (!statuses.some((s) => s.isRevision)) {
    const revCand = statuses.find((s) => s.id === 'reprint' || s.id === 'in_progress');
    if (revCand) revCand.isRevision = true;
  }

  const catSet = new Set(
    Array.isArray(src.categories) && src.categories.length
      ? src.categories.map((c) => String(c || '').trim()).filter(Boolean)
      : DEFAULT_PLANNER_CATEGORIES
  );
  (existingTasks || []).forEach((t) => {
    const c = String(t?.category || '').trim();
    if (c) catSet.add(c);
  });

  const projSet = new Set(
    Array.isArray(src.projects) && src.projects.length
      ? src.projects.map((p) => String(p || '').trim()).filter(Boolean)
      : DEFAULT_PLANNER_PROJECTS
  );
  (existingTasks || []).forEach((t) => {
    const p = String(t?.project || '').trim();
    if (p) projSet.add(p);
  });

  return {
    statuses,
    categories: [...catSet],
    projects: [...projSet],
  };
}

export function getStatusObj(statuses = [], statusId = 'todo') {
  const list = Array.isArray(statuses) && statuses.length ? statuses : DEFAULT_PLANNER_STATUSES;
  return list.find((s) => s.id === statusId) || list.find((s) => !s.isDone) || list[0];
}

export function isDoneStatus(statuses = [], statusId = 'todo') {
  return Boolean(getStatusObj(statuses, statusId)?.isDone);
}

export function getDoneStatus(statuses = []) {
  const list = Array.isArray(statuses) && statuses.length ? statuses : DEFAULT_PLANNER_STATUSES;
  return list.find((s) => s.isDone) || list[list.length - 1];
}

export function getRevisionStartStatus(statuses = []) {
  const list = Array.isArray(statuses) && statuses.length ? statuses : DEFAULT_PLANNER_STATUSES;
  return list.find((s) => s.isRevision) || list.find((s) => !s.isDone) || list[0];
}

export function getFirstActiveStatus(statuses = []) {
  const list = Array.isArray(statuses) && statuses.length ? statuses : DEFAULT_PLANNER_STATUSES;
  return list.find((s) => !s.isDone) || list[0];
}

export function fixTaskUrl(rawUrl) {
  const u = String(rawUrl || '').trim();
  if (!u) return '';
  if (/^(?:https?:|mailto:|utk:\/\/)/i.test(u)) return u;
  if (/^\\\\/.test(u)) return u; // allow network UNC path display safely
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';
  return 'https://' + u;
}

export function parseTaskLinks(rawText, existing = []) {
  const seen = new Set((existing || []).map((x) => x.u));
  const out = [];
  const add = (urlRaw, lblRaw) => {
    const cleaned = fixTaskUrl(String(urlRaw || '').replace(/[),.;]+$/, ''));
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    const label = String(lblRaw || '')
      .replace(/^[\s:|\-\u2013\u2014]+|[\s:|\-\u2013\u2014]+$/g, '')
      .slice(0, 100);
    out.push({ u: cleaned, l: label });
  };

  String(rawText || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const ln = line.trim();
      if (!ln) return;
      const ms = ln.match(/(?:https?:\/\/|mailto:|utk:\/\/)[^\s<>"']+/gi);
      if (ms && ms.length > 1) {
        ms.forEach((m) => add(m, ''));
        return;
      }
      const m = ms
        ? ms[0]
        : (ln.match(/\b[\w-]+(?:\.[\w-]+)+(?:[/?#]\S*)?/) || [])[0] || (/^\\\\\S+/.test(ln) ? ln : '');
      if (!m) return;
      add(m, ln.replace(m, ''));
    });

  return out.slice(0, 30);
}

export function linkAutoLabel(urlStr) {
  const u = String(urlStr || '');
  if (/^mailto:/i.test(u)) return u.slice(7);
  if (/^\\\\/.test(u)) {
    const segs = u.split('\\').filter(Boolean);
    return (segs.slice(-2).join('\\') || u).slice(0, 44);
  }
  try {
    const parsed = new URL(u);
    const lastSeg = parsed.pathname.split('/').filter(Boolean).pop();
    return (parsed.hostname.replace(/^www\./, '') + (lastSeg ? ' / ' + decodeURIComponent(lastSeg) : '')).slice(0, 44);
  } catch (e) {
    return u.slice(0, 44);
  }
}

export function linkDisplayName(item) {
  if (!item) return '';
  return (item.l && item.l.trim()) || linkAutoLabel(item.u);
}

export function linkDisplayHost(urlStr) {
  return String(urlStr || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}
