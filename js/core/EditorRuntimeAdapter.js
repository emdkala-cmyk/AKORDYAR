/**
 * EditorRuntimeAdapter — controlled runtime boundary for core/editor modules.
 *
 * The adapter owns the current editor song and exposes the runtime state
 * through explicit getters. Consumers must use this namespace instead of
 * binding to mutable globals or compatibility aliases.
 */
(function attachEditorRuntimeAdapter(globalScope) {
  let currentSong = null;
  const songListeners = new Set();

  function notifySongChange(song) {
    songListeners.forEach(listener => {
      try {
        listener(song);
      } catch (error) {
        console.error(error);
      }
    });
  }

  function onSongChange(listener) {
    if (typeof listener !== 'function') return () => {};
    songListeners.add(listener);
    return () => songListeners.delete(listener);
  }

  const adapter = Object.freeze({
    getDAW() {
      return globalScope.RuntimeStateAdapter?.getDAW?.() || null;
    },

    getDAWOrThrow() {
      const daw = this.getDAW();
      if (!daw) throw new Error('EditorRuntimeAdapter: DAW is unavailable');
      return daw;
    },

    getPERF() {
      return globalScope.RuntimeStateAdapter?.getPERF?.() || null;
    },

    getPERFOrThrow() {
      const perf = this.getPERF();
      if (!perf) throw new Error('EditorRuntimeAdapter: PERF is unavailable');
      return perf;
    },

    getSong() {
      return currentSong;
    },

    setSong(song) {
      currentSong = song;
      notifySongChange(song);
      return song;
    },

    onSongChange,

    getPerformanceStore() {
      return globalScope.RuntimeStateAdapter?.getPerformanceStore?.() || null;
    },

    startPointerDrag(target, startEvent, onMove, onEnd = () => {}) {
      if (!target || !startEvent || typeof onMove !== 'function') return () => {};

      const pointerId = startEvent.pointerId;
      const matchesPointer = event => pointerId == null || event.pointerId === pointerId;
      let active = true;
      const previousTouchAction = target.style?.touchAction;
      if (target.style) target.style.touchAction = 'none';

      const finish = event => {
        if (!active || !matchesPointer(event)) return;
        active = false;
        try { target.releasePointerCapture?.(pointerId); } catch (_) {}
        if (target.style) target.style.touchAction = previousTouchAction || '';
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', finish);
        target.removeEventListener('pointercancel', finish);
        onEnd(event);
      };

      const move = event => {
        if (active && matchesPointer(event)) onMove(event);
      };

      try { target.setPointerCapture?.(pointerId); } catch (_) {}
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', finish);
      target.addEventListener('pointercancel', finish);

      return () => finish({ pointerId });
    }
  });

  globalScope.EditorRuntimeAdapter = adapter;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = adapter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
