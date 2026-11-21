import { ls } from '../utils/storage.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://knxyslvecmjhvlgapoyl.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_XQFm2PK27ZDiEMOz3BQe7A_7KuqHNnt';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON);

export const CATALOG_LIST_COLUMNS =
  'id,item_class,type,title,summary,target_url,category_id,owner_id,status,visibility,stage,discipline,is_required_reading,review_cycle_days,last_verified_at,updated_at';

const LIST_CACHE_TTL_MS = 60_000;
const SAVE_DEBOUNCE_MS = 200;
const MEDIA_IDB_NAME = 'kb2-media-idb';
const MEDIA_IDB_STORE = 'images';
const IMG_LOCALSTORAGE_INLINE_LIMIT = 2048;

const listCache = new Map();
const bodyCache = new Map();
const pendingSaves = new Map();
const saveTimers = new Map();

function getStoredSupabaseJwt() {
  const s = ls.get('kb2-auth-session');
  const tok = s && typeof s.token === 'string' ? s.token : '';
  return tok && tok !== 'local-dev-session' && tok !== 'local-fallback-token' ? tok : '';
}

function notifyIfAccessDenied(status, data) {
  if ((status === 401 || status === 403) && data && data.accessDenied && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('datum:access-revoked', { detail: data }));
    } catch (e) {}
  }
}

function openMediaIdb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(MEDIA_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(MEDIA_IDB_STORE)) {
          database.createObjectStore(MEDIA_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function idbPutImage(id, value) {
  if (!id || !value) return;
  const database = await openMediaIdb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(MEDIA_IDB_STORE, 'readwrite');
      tx.objectStore(MEDIA_IDB_STORE).put(value, id);
      tx.oncomplete = () => {
        database.close();
        resolve();
      };
      tx.onerror = () => {
        database.close();
        resolve();
      };
    } catch (e) {
      database.close();
      resolve();
    }
  });
}

async function idbGetAllImages() {
  const database = await openMediaIdb();
  if (!database) return {};
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(MEDIA_IDB_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_IDB_STORE);
      const out = {};
      const req = store.openCursor();
      req.onsuccess = (ev) => {
        const cursor = ev.target.result;
        if (cursor) {
          out[String(cursor.key)] = cursor.value;
          cursor.continue();
        } else {
          database.close();
          resolve(out);
        }
      };
      req.onerror = () => {
        database.close();
        resolve(out);
      };
    } catch (e) {
      database.close();
      resolve({});
    }
  });
}

function dataUrlToBlob(dataUrl) {
  const m = typeof dataUrl === 'string' && dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!m) return null;
  const mime = m[1] || 'image/webp';
  const isBase64 = Boolean(m[2]);
  const raw = m[3] || '';
  let bytes;
  if (isBase64) {
    const bin = atob(raw);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    const decoded = decodeURIComponent(raw);
    bytes = new TextEncoder().encode(decoded);
  }
  const extMap = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return {
    blob: new Blob([bytes], { type: mime }),
    mime,
    ext: extMap[mime.toLowerCase()] || 'webp',
  };
}

function buildHeaders(userJwt, extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON,
    ...extra,
  };
  const bearer = userJwt || getStoredSupabaseJwt() || (SUPABASE_ANON.startsWith('eyJ') ? SUPABASE_ANON : '');
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return headers;
}

function flushKey(key) {
  if (saveTimers.has(key)) {
    clearTimeout(saveTimers.get(key));
    saveTimers.delete(key);
  }
  if (pendingSaves.has(key)) {
    const val = pendingSaves.get(key);
    pendingSaves.delete(key);
    if (key === 'kb2-img' && val && typeof val === 'object' && !Array.isArray(val)) {
      const slim = {};
      for (const [id, src] of Object.entries(val)) {
        if (typeof src === 'string' && src.startsWith('data:image/') && src.length > IMG_LOCALSTORAGE_INLINE_LIMIT) {
          void idbPutImage(id, src);
          slim[id] = `idb:${id}`;
        } else {
          slim[id] = src;
        }
      }
      ls.set(key, slim);
    } else {
      ls.set(key, val);
    }
    if (isSupabaseConfigured && typeof window !== 'undefined') {
      window.__lastDbSync = { key, at: Date.now() };
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const key of [...pendingSaves.keys()]) flushKey(key);
  });
}

/**
 * Dual-mode data repository:
 * - Debounces browser storage writes to avoid blocking renders during rapid scroll/search.
 * - Uses projected column lists, pagination ranges, on-demand article body loading,
 *   and updated_at-keyed caches when querying Supabase PostgREST/RPC/Storage.
 */
export const db = {
  mode: isSupabaseConfigured ? 'supabase' : 'local',
  CATALOG_LIST_COLUMNS,

  load(key, fallback) {
    if (pendingSaves.has(key)) return pendingSaves.get(key);
    const val = ls.get(key);
    return val !== null && val !== undefined ? val : fallback;
  },

  save(key, value) {
    pendingSaves.set(key, value);
    if (typeof window === 'undefined') {
      flushKey(key);
      return;
    }
    if (saveTimers.has(key)) clearTimeout(saveTimers.get(key));
    saveTimers.set(
      key,
      setTimeout(() => {
        flushKey(key);
      }, SAVE_DEBOUNCE_MS)
    );
  },

  flush(key) {
    if (key) flushKey(key);
    else for (const k of [...pendingSaves.keys()]) flushKey(k);
  },

  invalidateArticle(itemId) {
    if (itemId !== undefined && itemId !== null) {
      bodyCache.delete(String(itemId));
    }
    listCache.clear();
  },

  async fetchCatalogList({ offset = 0, limit = 24, force = false, userJwt } = {}) {
    if (!isSupabaseConfigured) return null;
    const cacheKey = `${offset}:${limit}`;
    const hit = listCache.get(cacheKey);
    if (!force && hit && Date.now() - hit.at < LIST_CACHE_TTL_MS) {
      return hit.rows;
    }
    const end = Math.max(offset, offset + limit - 1);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/catalog_items?select=${encodeURIComponent(CATALOG_LIST_COLUMNS)}&status=neq.Deleted&order=updated_at.desc,id.desc`,
      {
        headers: buildHeaders(userJwt, { Range: `${offset}-${end}`, 'Range-Unit': 'items' }),
      }
    );
    if (!res.ok) throw new Error(`Supabase list error: ${res.status}`);
    const rows = await res.json();
    listCache.set(cacheKey, { at: Date.now(), rows });
    return rows;
  },

  async fetchArticleBody(itemId, { updatedAt = '', force = false, userJwt } = {}) {
    if (!isSupabaseConfigured || itemId == null) return null;
    const key = String(itemId);
    const hit = bodyCache.get(key);
    if (!force && hit && (!updatedAt || hit.updatedAt === updatedAt)) {
      return hit.row;
    }
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/catalog_items?id=eq.${encodeURIComponent(key)}&select=id,body,working_draft_body,updated_at&limit=1`,
      { headers: buildHeaders(userJwt) }
    );
    if (!res.ok) throw new Error(`Supabase body error: ${res.status}`);
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] || null : null;
    if (row) {
      bodyCache.set(key, { updatedAt: row.updated_at || updatedAt, row });
    }
    return row;
  },

  getImageUrl(imgId, imgsMap = {}, { variant = 'display' } = {}) {
    const raw = imgsMap && imgsMap[imgId];
    if (!raw || raw.startsWith('idb:')) return '';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
    if (isSupabaseConfigured) {
      const width = variant === 'thumb' ? 400 : 1200;
      return `${SUPABASE_URL}/storage/v1/render/image/public/attachments/${encodeURIComponent(raw)}?width=${width}&quality=78&format=webp`;
    }
    return raw;
  },

  async uploadImage(id, dataUrl, { userJwt } = {}) {
    if (!id || !dataUrl) return dataUrl || '';
    if (/^https?:\/\//i.test(dataUrl)) return dataUrl;

    await idbPutImage(id, dataUrl);

    if (isSupabaseConfigured && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
      const parsed = dataUrlToBlob(dataUrl);
      const bearer = userJwt || getStoredSupabaseJwt() || (SUPABASE_ANON.startsWith('eyJ') ? SUPABASE_ANON : '');
      if (parsed && bearer) {
        const objectPath = `articles/${encodeURIComponent(id)}.${parsed.ext}`;
        try {
          const res = await fetch(`${SUPABASE_URL}/storage/v1/object/attachments/${objectPath}`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON,
              Authorization: `Bearer ${bearer}`,
              'Content-Type': parsed.mime,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'x-upsert': 'true',
            },
            body: parsed.blob,
          });
          if (res.ok) {
            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/attachments/${objectPath}`;
            await idbPutImage(id, publicUrl);
            return publicUrl;
          }
        } catch (e) {
          // Network or CORS fallback: IndexedDB copy remains available
        }
      }
    }
    return dataUrl;
  },

  async uploadImagesMap(imgsMap = {}, opts = {}) {
    const entries = Object.entries(imgsMap || {});
    if (!entries.length) return {};
    const pairs = await Promise.all(
      entries.map(async ([id, src]) => [id, await db.uploadImage(id, src, opts)])
    );
    return Object.fromEntries(pairs);
  },

  async hydrateImages(currentImgs = {}) {
    const stored = await idbGetAllImages();
    const keys = Object.keys(stored);
    if (!keys.length) return null;
    let changed = false;
    const merged = { ...(currentImgs || {}) };
    for (const id of keys) {
      const val = stored[id];
      if (!val) continue;
      if (!merged[id] || (typeof merged[id] === 'string' && merged[id].startsWith('idb:'))) {
        merged[id] = val;
        changed = true;
      }
    }
    return changed ? merged : null;
  },

  async rpc(fnName, params, userJwt) {
    if (!isSupabaseConfigured) return null;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: buildHeaders(userJwt),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Supabase RPC error: ${res.status}`);
    return res.json();
  },

  brain: {
    normalizeEmail(email) {
      return String(email || '').trim().toLowerCase();
    },

    headersFor(email) {
      return db.directory.headersFor(email);
    },

    loadLocal(email) {
      const cleanEmail = db.brain.normalizeEmail(email);
      if (!cleanEmail) return { tasks: [], notes: [], resources: [], state: null };
      return {
        tasks: ls.get(`kb2-tasks:${cleanEmail}`) || [],
        notes: ls.get(`kb2-privnotes:${cleanEmail}`) || [],
        resources: ls.get(`kb2-privres:${cleanEmail}`) || [],
        state: ls.get(`kb2-brain-state:${cleanEmail}`) || null,
      };
    },

    saveLocalTasks(email, tasks) {
      const cleanEmail = db.brain.normalizeEmail(email);
      if (cleanEmail) ls.set(`kb2-tasks:${cleanEmail}`, Array.isArray(tasks) ? tasks : []);
    },

    saveLocalNotes(email, notes) {
      const cleanEmail = db.brain.normalizeEmail(email);
      if (cleanEmail) ls.set(`kb2-privnotes:${cleanEmail}`, Array.isArray(notes) ? notes : []);
    },

    saveLocalResources(email, resources) {
      const cleanEmail = db.brain.normalizeEmail(email);
      if (cleanEmail) ls.set(`kb2-privres:${cleanEmail}`, Array.isArray(resources) ? resources : []);
    },

    saveLocalState(email, state) {
      const cleanEmail = db.brain.normalizeEmail(email);
      if (cleanEmail && state) ls.set(`kb2-brain-state:${cleanEmail}`, state);
    },

    async fetchSnapshot(email) {
      const cleanEmail = db.brain.normalizeEmail(email);
      if (!cleanEmail) return { configured: false, tasks: [], notes: [], resources: [], state: null };
      const res = await fetch(`/api/brain?email=${encodeURIComponent(cleanEmail)}`, {
        method: 'GET',
        headers: db.brain.headersFor(cleanEmail),
        cache: 'no-store',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        notifyIfAccessDenied(res.status, j);
        throw new Error(j?.error || `Brain snapshot failed (${res.status})`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.tasks)) db.brain.saveLocalTasks(cleanEmail, data.tasks);
      if (data && Array.isArray(data.notes)) db.brain.saveLocalNotes(cleanEmail, data.notes);
      if (data && Array.isArray(data.resources)) db.brain.saveLocalResources(cleanEmail, data.resources);
      if (data && data.state && data.state.exists) db.brain.saveLocalState(cleanEmail, data.state);
      return data;
    },

    async postAction(email, body) {
      const cleanEmail = db.brain.normalizeEmail(email);
      const res = await fetch('/api/brain', {
        method: 'POST',
        headers: db.brain.headersFor(cleanEmail),
        body: JSON.stringify({ ...body, ownerEmail: cleanEmail }),
      });
      if (!res.ok) {
        let msg = `Brain sync failed (${res.status})`;
        try {
          const j = await res.json();
          notifyIfAccessDenied(res.status, j);
          if (j && j.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      return res.json();
    },

    upsertTask(email, task) {
      return db.brain.postAction(email, { action: 'task_upsert', task });
    },

    deleteTask(email, id) {
      return db.brain.postAction(email, { action: 'task_delete', id });
    },

    upsertNote(email, note) {
      return db.brain.postAction(email, { action: 'note_upsert', note });
    },

    deleteNote(email, id) {
      return db.brain.postAction(email, { action: 'note_delete', id });
    },

    upsertResource(email, resource) {
      return db.brain.postAction(email, { action: 'resource_upsert', resource });
    },

    deleteResource(email, id) {
      return db.brain.postAction(email, { action: 'resource_delete', id });
    },

    syncState(email, state) {
      return db.brain.postAction(email, { action: 'state_sync', state });
    },
  },

  workspace: {
    async request(method, body = null, email = '') {
      const res = await fetch('/api/workspace', {
        method,
        headers: db.directory.headersFor(email),
        cache: 'no-store',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyIfAccessDenied(res.status, data);
        throw new Error((data && data.error) || `Workspace sync failed (${res.status})`);
      }
      return data;
    },

    saveAccessPolicy(policy, email = '') {
      return db.workspace.request('POST', { action: 'access_policy_save', policy }, email);
    },

    fetchSnapshot(email = '') {
      return db.workspace.request('GET', null, email);
    },

    seedIfEmpty(payload, email = '') {
      return db.workspace.request('POST', { action: 'seed_if_empty', ...payload }, email);
    },

    upsertItem(item, mode = 'save', email = '') {
      return db.workspace.request('POST', { action: 'item_upsert', item, mode }, email);
    },

    addComment(itemId, comment, email = '') {
      return db.workspace.request('POST', { action: 'item_comment', itemId, comment }, email);
    },

    deleteItem(id, email = '') {
      return db.workspace.request('POST', { action: 'item_delete', id }, email);
    },

    upsertCollection(collection, email = '') {
      return db.workspace.request('POST', { action: 'collection_upsert', collection }, email);
    },

    deleteCollection(id, email = '') {
      return db.workspace.request('POST', { action: 'collection_delete', id }, email);
    },

    syncMeta(key, data, email = '') {
      return db.workspace.request('POST', { action: 'meta_sync', key, data }, email);
    },
  },

  directory: {
    headersFor(email) {
      const s = ls.get('kb2-auth-session');
      const cleanEmail = String(email || (s && s.claims && s.claims.email) || '').trim().toLowerCase();
      const tok = getStoredSupabaseJwt();
      const supaTok = s && typeof s.supaToken === 'string' ? s.supaToken : '';
      const headers = { 'Content-Type': 'application/json' };
      if (cleanEmail) headers['x-datum-user-email'] = cleanEmail;
      if (tok) headers.Authorization = `Bearer ${tok}`;
      if (supaTok) headers['x-datum-supa-token'] = supaTok;
      return headers;
    },

    async request(method, body = null, email = '') {
      const res = await fetch('/api/users', {
        method,
        headers: db.directory.headersFor(email),
        cache: 'no-store',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyIfAccessDenied(res.status, data);
        throw new Error((data && data.error) || `Directory request failed (${res.status})`);
      }
      return data;
    },

    fetchAll(email = '') {
      return db.directory.request('GET', null, email);
    },

    invite(payload, email = '') {
      return db.directory.request('POST', { action: 'invite', ...payload }, email);
    },

    updateUser(payload, email = '') {
      return db.directory.request('PATCH', { action: 'update', ...payload }, email);
    },

    deactivateUser(id, fallbackUserId = '', email = '') {
      return db.directory.request('PATCH', { action: 'deactivate', id, fallbackUserId }, email);
    },

    reactivateUser(id, email = '') {
      return db.directory.request('PATCH', { action: 'reactivate', id }, email);
    },

    deleteUser(id, fallbackUserId = '', email = '', targetEmail = '') {
      return db.directory.request('DELETE', { id, fallbackUserId, ...(targetEmail ? { email: targetEmail } : {}) }, email);
    },

    createTeam(payload, email = '') {
      return db.directory.request('POST', { action: 'team_create', ...payload }, email);
    },

    toggleTeamMember(teamId, userId, member, email = '') {
      return db.directory.request('PATCH', { action: 'team_toggle_member', teamId, userId, member }, email);
    },
  },
};
