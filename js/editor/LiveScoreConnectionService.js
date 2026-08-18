/**
 * LiveScoreConnectionService
 *
 * Keeps the host's per-part connection state separate from QR rendering.
 * State values are intentionally small and serializable:
 * connected, disconnected, re-syncing.
 */
(function attachLiveScoreConnectionService(globalScope) {
  'use strict';

  const VALID = new Set(['connected', 'disconnected', 're-syncing']);

  function create({
    fetchImpl = globalScope.fetch?.bind(globalScope),
    infoUrl = '/api/sync/info',
    onChange = () => {},
    storage = globalScope.localStorage
  } = {}) {
    const states = new Map();
    const cards = new Map();
    let pollTimer = null;

    function normalizeStatus(status) {
      return VALID.has(status) ? status : 'disconnected';
    }

    function setState(partId, patch = {}) {
      const key = String(partId || 'unassigned');
      const next = {
        partId: key,
        status: normalizeStatus(patch.status),
        ip: patch.ip || null,
        peerId: patch.peerId || null,
        name: patch.name || null,
        updatedAt: Date.now()
      };
      states.set(key, next);
      const card = cards.get(key);
      if (card) {
        card.className = `live-score-connection-status ${next.status}`;
        card.textContent = next.status === 'connected'
          ? 'Connected'
          : next.status === 're-syncing' ? 'Re-syncing' : 'Disconnected';
      }
      onChange({ ...next });
      return next;
    }

    function bindCard(partId, element) {
      if (!element) return;
      cards.set(String(partId), element);
      const current = states.get(String(partId));
      if (current) setState(partId, current);
    }

    function updateFromInfo(info = {}) {
      const peers = Array.isArray(info.peers) ? info.peers : [];
      const seen = new Set();
      peers.forEach(peer => {
        const partId = peer.partId || peer.role || peer.id;
        if (!partId) return;
        const status = peer.status === 're-syncing' ? 're-syncing' : 'connected';
        seen.add(String(partId));
        setState(partId, {
          status,
          ip: peer.ip,
          peerId: peer.id,
          name: peer.name
        });
      });
      states.forEach((value, key) => {
        if (!seen.has(key)) setState(key, { ...value, status: 'disconnected' });
      });
      return peers;
    }

    async function refresh() {
      if (typeof fetchImpl !== 'function') return null;
      try {
        const response = await fetchImpl(`${infoUrl}?${Date.now()}`);
        if (!response.ok) throw new Error(`sync info ${response.status}`);
        const info = await response.json();
        updateFromInfo(info);
        try { storage?.setItem?.('akordyar.liveScoreConnections.v1', JSON.stringify([...states])); } catch (_) {}
        return info;
      } catch (_) {
        states.forEach((value, key) => setState(key, { ...value, status: 're-syncing' }));
        return null;
      }
    }

    function start(interval = 2500) {
      stop();
      refresh();
      pollTimer = setInterval(refresh, interval);
      return api;
    }

    function stop() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    function getState(partId) {
      return states.get(String(partId)) || {
        partId: String(partId),
        status: 'disconnected',
        ip: null,
        peerId: null,
        name: null,
        updatedAt: 0
      };
    }

    function markAll(status) {
      states.forEach((value, key) => setState(key, { ...value, status }));
      return api;
    }

    function bindSocket(socket, partId) {
      if (!socket) return () => {};
      const key = String(partId || 'unassigned');
      const onOpen = () => setState(key, { status: 'connected' });
      const onClose = () => {
        setState(key, { status: 're-syncing' });
        setTimeout(() => {
          if (getState(key).status === 're-syncing') setState(key, { status: 'disconnected' });
        }, 3500);
      };
      const onError = () => setState(key, { status: 're-syncing' });
      if (typeof socket.addEventListener === 'function') {
        socket.addEventListener('open', onOpen);
        socket.addEventListener('close', onClose);
        socket.addEventListener('error', onError);
        return () => {
          socket.removeEventListener?.('open', onOpen);
          socket.removeEventListener?.('close', onClose);
          socket.removeEventListener?.('error', onError);
        };
      }
      return () => {};
    }

    const api = Object.freeze({
      setState,
      bindCard,
      updateFromInfo,
      refresh,
      start,
      stop,
      getState,
      markAll,
      bindSocket,
      getStates: () => [...states.values()]
    });
    return api;
  }

  const api = Object.freeze({ create, VALID_STATUSES: [...VALID] });
  globalScope.LiveScoreConnectionService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
