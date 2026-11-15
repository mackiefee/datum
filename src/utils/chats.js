const CHAT_STORAGE_KEY = 'datum_chats_v1';
const ACTIVE_CHAT_KEY = 'datum_active_chat_v1';
const LEGACY_MOB_CHATS_KEY = 'datum_mob_chats_v1';
const LEGACY_MOB_ACTIVE_KEY = 'datum_mob_active_chat_v1';

function scopedKey(base, userKey) {
  const clean = String(userKey || '').trim().toLowerCase();
  return clean ? `${base}:${clean}` : base;
}

function sanitizeChats(parsed) {
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, 24).map((c) => ({
    ...c,
    messages: Array.isArray(c.messages)
      ? c.messages.slice(-40).map((m) => (m && m.busy ? { ...m, busy: false } : m))
      : [],
  }));
}

/**
 * Loads unified chat threads across Desktop Space, Mobile Chat, and Reader.
 * Seamlessly migrates earlier mobile-only threads if present.
 */
export function loadChats(userKey = '') {
  if (typeof window === 'undefined') return [];
  try {
    const keys = [scopedKey(CHAT_STORAGE_KEY, userKey), CHAT_STORAGE_KEY, LEGACY_MOB_CHATS_KEY];
    for (let i = 0; i < keys.length; i++) {
      const raw = window.localStorage.getItem(keys[i]);
      if (raw) {
        const chats = sanitizeChats(JSON.parse(raw));
        if (chats.length) return chats;
      }
    }
  } catch {}
  return [];
}

export function saveChats(chats, userKey = '') {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify((chats || []).slice(0, 24));
    window.localStorage.setItem(scopedKey(CHAT_STORAGE_KEY, userKey), payload);
  } catch {}
}

export function loadActiveChatId(userKey = '') {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.localStorage.getItem(scopedKey(ACTIVE_CHAT_KEY, userKey)) ||
      window.localStorage.getItem(ACTIVE_CHAT_KEY) ||
      window.localStorage.getItem(LEGACY_MOB_ACTIVE_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

export function saveActiveChatId(id, userKey = '') {
  if (typeof window === 'undefined') return;
  try {
    const k = scopedKey(ACTIVE_CHAT_KEY, userKey);
    if (id) window.localStorage.setItem(k, id);
    else window.localStorage.removeItem(k);
  } catch {}
}

/**
 * Creates a user message + busy assistant stub in a new or existing chat thread.
 */
export function createPendingChatTurn({
  chats = [],
  activeChatId = null,
  query = '',
  matchIds = [],
  scopeDocId = null,
  scopeDocTitle = '',
}) {
  const now = Date.now();
  const cleanQ = String(query || '').trim();
  const userMsgId = 'u-' + now + '-' + Math.random().toString(36).slice(2, 5);
  const botMsgId = 'a-' + (now + 1) + '-' + Math.random().toString(36).slice(2, 5);

  const existing = activeChatId ? chats.find((c) => c.id === activeChatId) : null;
  const targetChatId = existing ? existing.id : 'chat-' + now + '-' + Math.random().toString(36).slice(2, 5);
  const shortTitle = cleanQ.length > 46 ? cleanQ.slice(0, 45) + '…' : cleanQ;

  const userMsg = { id: userMsgId, role: 'user', text: cleanQ, at: now, scopeDocId, scopeDocTitle };
  const botStub = {
    id: botMsgId,
    role: 'assistant',
    query: cleanQ,
    text: '',
    src: [],
    matchIds,
    actions: null,
    scopeDocId,
    scopeDocTitle,
    busy: true,
    at: now + 1,
  };

  let nextChats;
  if (!existing) {
    nextChats = [
      { id: targetChatId, title: shortTitle, updatedAt: now, messages: [userMsg, botStub] },
      ...chats,
    ].slice(0, 24);
  } else {
    const updated = {
      ...existing,
      updatedAt: now,
      messages: [...(existing.messages || []), userMsg, botStub].slice(-40),
    };
    nextChats = [updated, ...chats.filter((c) => c.id !== targetChatId)].slice(0, 24);
  }

  return {
    targetChatId,
    botMsgId,
    historyBeforeTurn: existing ? existing.messages || [] : [],
    nextChats,
  };
}

export function resolvePendingChatTurn(chats = [], targetChatId, botMsgId, result = {}) {
  return chats.map((c) =>
    c.id !== targetChatId
      ? c
      : {
          ...c,
          updatedAt: Date.now(),
          messages: (c.messages || []).map((m) =>
            m.id !== botMsgId
              ? m
              : {
                  ...m,
                  src: result.sources || [],
                  text: result.answer || '',
                  actions: result.actions || null,
                  busy: false,
                }
          ),
        }
  );
}
