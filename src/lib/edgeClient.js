import { runAiEdgeLogic, runPublicPreflightLogic, runGovernanceScanLogic } from './edgeLogic.js';

const AI_CACHE_MAX = 50;
const aiCache = new Map();

const stripImagesFromBody = (b) => String(b || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');

const projectAiItem = (r) => ({
  id: r.id,
  title: r.title,
  desc: r.desc || '',
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
  const target = payload.targetItem;
  return [
    payload.action || 'qa',
    payload.query || '',
    payload.userRole || '',
    payload.userName || '',
    items.length,
    maxUpd,
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
