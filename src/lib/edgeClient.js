import { runAiEdgeLogic, runPublicPreflightLogic, runGovernanceScanLogic } from './edgeLogic.js';

const AI_CACHE_MAX = 50;
const aiCache = new Map();

const stripImagesFromBody = (b) => String(b || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');

const projectAiItem = (r) => ({
  id: r.id,
  title: r.title,
  desc: r.desc || '',
  url: r.url || '',
  disc: r.disc || '',
  type: r.type || 'doc',
  body: stripImagesFromBody(r.body),
  tags: r.tags || [],
  author: r.author || '',
  node: r.node || '',
  status: r.status,
  vis: r.vis || 'Internal',
  upd: r.upd || '',
  verified: r.verified || '',
  reviewDays: r.reviewDays,
});

const projectGovItem = (r) => ({
  id: r.id,
  title: r.title,
  desc: r.desc || '',
  url: r.url || '',
  node: r.node || '',
  author: r.author || '',
  status: r.status,
  verified: r.verified || '',
  upd: r.upd || '',
  reviewDays: r.reviewDays,
  links: r.links || [],
});

const projectPreflightPayload = (payload) => {
  if (!payload) return payload;
  const { item, allItems = [], categoryVis, clearedAttachmentIds } = payload;
  return {
    ...payload,
    item: item
      ? {
          id: item.id,
          title: item.title,
          desc: item.desc,
          body: item.body,
          url: item.url,
          upd: item.upd,
          tags: item.tags,
          status: item.status,
          vis: item.vis,
          links: item.links || [],
        }
      : null,
    allItems: allItems.map((x) => ({
      id: x.id,
      title: x.title,
      vis: x.vis || 'Internal',
      status: x.status,
    })),
    categoryVis,
    clearedAttachmentIds,
  };
};

function aiCacheKey(payload) {
  const items = payload.items || [];
  let maxUpd = '';
  for (let i = 0; i < items.length; i++) {
    if (items[i].upd && items[i].upd > maxUpd) maxUpd = items[i].upd;
  }
  const tasks = payload.personalTasks || [];
  const notes = payload.personalNotes || [];
  const pRes = payload.personalResources || [];
  const brainSig = `${tasks.length}:${tasks[0]?.updatedAt || tasks[0]?.status || ''}:${notes.length}:${notes[0]?.updatedAt || ''}:${pRes.length}:${pRes[0]?.updatedAt || ''}`;
  const target = payload.targetItem;
  const hist = Array.isArray(payload.history) ? payload.history : [];
  const lastTurn = hist.length ? `${hist.length}:${(hist[hist.length - 1] && hist[hist.length - 1].text) || ''}`.slice(0, 64) : '';
  return [
    payload.action || 'qa',
    payload.query || '',
    payload.userRole || '',
    payload.userName || '',
    payload.targetDocId || '',
    payload.scope || '',
    payload.clientDate || '',
    lastTurn,
    items.length,
    maxUpd,
    brainSig,
    target ? `${target.id}:${target.upd || ''}` : '',
  ].join('|');
}

async function callEdge(path, payload, fallbackFn) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback to local execution if network or SSR boundary interrupts fetch
  }
  return fallbackFn(payload);
}

export const edgeClient = {
  clearAiCache() {
    aiCache.clear();
  },

  async ai(payload) {
    const key = aiCacheKey(payload || {});
    if (aiCache.has(key)) {
      return aiCache.get(key);
    }
    const slimPayload = payload
      ? {
          ...payload,
          items: Array.isArray(payload.items) ? payload.items.map(projectAiItem) : undefined,
          targetItem: payload.targetItem ? projectAiItem(payload.targetItem) : null,
          personalTasks: Array.isArray(payload.personalTasks)
            ? payload.personalTasks.slice(0, 80).map((t) => ({
                id: t.id,
                title: t.title || '',
                notes: String(t.notes || '').slice(0, 500),
                project: t.project || 'General',
                category: t.category || '',
                dueDate: t.dueDate || '',
                isUrgent: Boolean(t.isUrgent),
                status: t.status || 'todo',
                statusLabel: t.statusLabel || t.status || 'To Do',
                isDone: Boolean(t.isDone ?? t.status === 'done'),
                revNumber: Number(t.revNumber || 0),
                links: Array.isArray(t.links) ? t.links.slice(0, 10) : [],
                linkedItemId: t.linkedItemId ?? null,
                linkedItemTitle: t.linkedItemTitle || '',
                updatedAt: t.updatedAt || '',
              }))
            : undefined,
          personalNotes: Array.isArray(payload.personalNotes)
            ? payload.personalNotes.slice(0, 60).map((n) => ({
                id: n.id,
                title: n.title || '',
                body: stripImagesFromBody(n.body || '').slice(0, 1400),
                project: n.project || 'General',
                tags: Array.isArray(n.tags) ? n.tags : [],
                isPinned: Boolean(n.isPinned),
                linkedItemIds: Array.isArray(n.linkedItemIds) ? n.linkedItemIds : [],
                updatedAt: n.updatedAt || '',
              }))
            : undefined,
          personalResources: Array.isArray(payload.personalResources)
            ? payload.personalResources.slice(0, 80).map((pr) => ({
                id: pr.id,
                title: pr.title || '',
                url: pr.url || '',
                kind: pr.kind || 'link',
                notes: stripImagesFromBody(pr.notes || '').slice(0, 800),
                project: pr.project || 'General',
                tags: Array.isArray(pr.tags) ? pr.tags : [],
                isPinned: Boolean(pr.isPinned),
                updatedAt: pr.updatedAt || '',
              }))
            : undefined,
          history: Array.isArray(payload.history)
            ? payload.history.slice(-6).map((m) => ({
                role: m.role,
                text: String(m.text || '').slice(0, 320),
                src: Array.isArray(m.src) ? m.src.map((s) => ({ id: s.id, title: s.title })) : [],
              }))
            : undefined,
        }
      : payload;

    const out = await callEdge('/api/edge/ai', slimPayload, runAiEdgeLogic);
    if (aiCache.size >= AI_CACHE_MAX) {
      const oldest = aiCache.keys().next().value;
      aiCache.delete(oldest);
    }
    aiCache.set(key, out);
    return out;
  },

  publicPreflight(payload) {
    return callEdge('/api/edge/public-preflight', projectPreflightPayload(payload), runPublicPreflightLogic);
  },

  governance(payload) {
    const slimPayload = payload
      ? {
          ...payload,
          items: Array.isArray(payload.items) ? payload.items.map(projectGovItem) : [],
          categories: Array.isArray(payload.categories)
            ? payload.categories.map((c) => ({ id: c.id, reviewDays: c.reviewDays }))
            : [],
        }
      : payload;
    return callEdge('/api/edge/governance', slimPayload, runGovernanceScanLogic);
  },
};
