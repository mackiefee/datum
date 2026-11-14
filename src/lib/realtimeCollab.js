const SUPABASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  'https://knxyslvecmjhvlgapoyl.supabase.co';
const SUPABASE_ANON =
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  'sb_publishable_XQFm2PK27ZDiEMOz3BQe7A_7KuqHNnt';

const PEER_COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f', '#5ac8fa'];

function hashColor(seed) {
  let h = 0;
  const s = String(seed || 'u');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PEER_COLORS[Math.abs(h) % PEER_COLORS.length];
}

function toRealtimeWsUrl(httpUrl, anonKey) {
  if (!httpUrl || !anonKey) return '';
  const wsBase = httpUrl.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:').replace(/\/+$/, '');
  return `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=1.0.0`;
}

export function createDocCollabSession({
  docId,
  user,
  onRemotePatch,
  onPresenceChange,
  onStatusChange,
  onSimEditAction,
}) {
  const clientId =
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)) +
    '-' +
    Date.now().toString(36).slice(-4);

  const userName = (user && user.name) || 'Collaborator';
  const userRole = (user && user.role) || 'Member';
  const userAvatar = (user && user.avatar) || '';
  const selfColor = hashColor(userName + ':' + clientId);

  const topic = `realtime:datum-doc-${docId}`;
  const peers = new Map();
  let selfCursor = { activeBlock: null, activeField: null, blockPreview: '', isTyping: false };
  let ws = null;
  let joined = false;
  let closed = false;
  let refCounter = 1;
  let heartbeatTimer = null;
  let pingTimer = null;
  let pruneTimer = null;
  let reconnectTimer = null;
  let bc = null;
  let simTimer = null;
  let simStep = 0;
  let simActive = false;
  let status = 'connecting';

  const emitStatus = (next) => {
    status = next;
    onStatusChange && onStatusChange(next);
  };

  const emitPresence = () => {
    const list = [];
    peers.forEach((p) => {
      if (Date.now() - p.lastSeen < 16000) list.push(p);
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    onPresenceChange && onPresenceChange(list);
  };

  const sendRaw = (event, payload) => {
    const envelope = {
      sender: clientId,
      docId,
      event,
      payload,
      ts: Date.now(),
    };
    if (bc) {
      try {
        bc.postMessage(envelope);
      } catch (e) {}
    }
    if (ws && ws.readyState === WebSocket.OPEN && joined) {
      try {
        ws.send(
          JSON.stringify({
            topic,
            event: 'broadcast',
            payload: { type: 'broadcast', event, payload: envelope },
            ref: String(refCounter++),
          })
        );
      } catch (e) {}
    }
  };

  const handleIncoming = (envelope) => {
    if (!envelope || envelope.sender === clientId || String(envelope.docId) !== String(docId)) return;
    const { event, payload, sender } = envelope;
    if (event === 'presence_state' || event === 'cursor_move') {
      const prev = peers.get(sender) || {};
      peers.set(sender, {
        clientId: sender,
        name: payload.name || prev.name || 'Team Member',
        role: payload.role || prev.role || 'Member',
        avatar: payload.avatar !== undefined ? payload.avatar : prev.avatar || '',
        color: payload.color || prev.color || hashColor(payload.name || sender),
        activeBlock: payload.activeBlock !== undefined ? payload.activeBlock : prev.activeBlock ?? null,
        activeField: payload.activeField !== undefined ? payload.activeField : prev.activeField ?? null,
        blockPreview: payload.blockPreview !== undefined ? payload.blockPreview : prev.blockPreview || '',
        isTyping: Boolean(payload.isTyping),
        isSimulated: Boolean(payload.isSimulated || prev.isSimulated),
        lastSeen: Date.now(),
      });
      emitPresence();
    } else if (event === 'presence_leave') {
      if (peers.delete(sender)) emitPresence();
    } else if (event === 'doc_patch') {
      onRemotePatch && onRemotePatch(payload, sender);
    }
  };

  // BroadcastChannel (0ms cross-tab collaboration on the same browser)
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(`datum-collab-${docId}`);
      bc.onmessage = (ev) => handleIncoming(ev.data);
    } catch (e) {}
  }

  // Supabase Realtime WebSocket connection (Phoenix channels v1)
  const connectWs = () => {
    if (closed || typeof WebSocket === 'undefined') {
      emitStatus('local');
      return;
    }
    const url = toRealtimeWsUrl(SUPABASE_URL, SUPABASE_ANON);
    if (!url) {
      emitStatus('local');
      return;
    }
    try {
      ws = new WebSocket(url);
    } catch (e) {
      emitStatus('local');
      return;
    }

    ws.onopen = () => {
      if (closed) {
        try {
          ws.close();
        } catch (e) {}
        return;
      }
      const joinRef = String(refCounter++);
      ws.send(
        JSON.stringify({
          topic,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { self: false, ack: false },
              presence: { key: clientId },
            },
          },
          ref: joinRef,
        })
      );
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(refCounter++) }));
          } catch (e) {}
        }
      }, 24000);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.topic === topic && msg.event === 'phx_reply' && msg.payload && msg.payload.status === 'ok') {
          joined = true;
          emitStatus('live');
          announcePresence();
        } else if (msg.topic === topic && msg.event === 'broadcast' && msg.payload && msg.payload.payload) {
          handleIncoming(msg.payload.payload);
        }
      } catch (e) {}
    };

    ws.onerror = () => {
      if (!joined) emitStatus('local');
    };

    ws.onclose = () => {
      joined = false;
      clearInterval(heartbeatTimer);
      if (!closed) {
        emitStatus('local');
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectWs, 4500);
      }
    };
  };

  const announcePresence = () => {
    sendRaw('presence_state', {
      name: userName,
      role: userRole,
      avatar: userAvatar,
      color: selfColor,
      ...selfCursor,
    });
  };

  connectWs();
  // Send immediate local presence announcement so other tabs see us right away
  setTimeout(announcePresence, 60);

  pingTimer = setInterval(announcePresence, 5000);
  pruneTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    peers.forEach((p, key) => {
      if (!p.isSimulated && now - p.lastSeen > 15000) {
        peers.delete(key);
        changed = true;
      }
    });
    if (changed) emitPresence();
  }, 4000);

  const onBeforeUnload = () => {
    sendRaw('presence_leave', {});
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  const stopSimulatedPeer = () => {
    simActive = false;
    clearInterval(simTimer);
    simTimer = null;
    if (peers.delete('sim-elena')) emitPresence();
  };

  const startSimulatedPeer = () => {
    if (simActive) return;
    simActive = true;
    simStep = 0;
    const simId = 'sim-elena';
    const simUser = {
      clientId: simId,
      name: 'Elena Khlivetskaya',
      role: 'Category Owner',
      avatar: '',
      color: '#bf5af2',
      activeBlock: 0,
      activeField: 'block',
      blockPreview: 'Reviewing section…',
      isTyping: true,
      isSimulated: true,
      lastSeen: Date.now(),
    };
    peers.set(simId, simUser);
    emitPresence();

    const runStep = () => {
      if (!simActive || closed) return;
      simStep += 1;
      if (onSimEditAction) {
        const res = onSimEditAction(simStep);
        if (res) {
          const cur = peers.get(simId) || simUser;
          peers.set(simId, {
            ...cur,
            activeBlock: res.activeBlock !== undefined ? res.activeBlock : cur.activeBlock,
            activeField: res.activeField || 'block',
            blockPreview: res.blockPreview || cur.blockPreview,
            isTyping: Boolean(res.isTyping),
            lastSeen: Date.now(),
          });
          emitPresence();
        }
      }
    };
    setTimeout(runStep, 500);
    simTimer = setInterval(runStep, 2600);
  };

  return {
    clientId,
    selfUser: {
      clientId,
      name: userName,
      role: userRole,
      avatar: userAvatar,
      color: selfColor,
    },
    getStatus: () => status,
    isSimulatedActive: () => simActive,
    startSimulatedPeer,
    stopSimulatedPeer,
    broadcastCursor: (cursor) => {
      selfCursor = {
        activeBlock: cursor.activeBlock !== undefined ? cursor.activeBlock : null,
        activeField: cursor.activeField || null,
        blockPreview: cursor.blockPreview || '',
        isTyping: Boolean(cursor.isTyping),
      };
      sendRaw('cursor_move', {
        name: userName,
        role: userRole,
        avatar: userAvatar,
        color: selfColor,
        ...selfCursor,
      });
    },
    broadcastPatch: (patch) => {
      sendRaw('doc_patch', {
        by: userName,
        color: selfColor,
        ...patch,
      });
    },
    destroy: () => {
      closed = true;
      stopSimulatedPeer();
      clearInterval(pingTimer);
      clearInterval(pruneTimer);
      clearInterval(heartbeatTimer);
      clearTimeout(reconnectTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', onBeforeUnload);
      }
      sendRaw('presence_leave', {});
      if (bc) {
        try {
          bc.close();
        } catch (e) {}
      }
      if (ws) {
        try {
          ws.close();
        } catch (e) {}
      }
    },
  };
}
