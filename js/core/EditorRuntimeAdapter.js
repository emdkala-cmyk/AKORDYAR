/**
 * EditorRuntimeAdapter — controlled runtime boundary for core/editor modules.
 *
 * The adapter resolves the current runtime objects lazily so it remains valid
 * while app/core.js initializes and later publishes DAW/PERF on the global
 * scope. Consumers should use the getter functions instead of binding the
 * legacy objects directly.
 */
(function attachEditorRuntimeAdapter(globalScope) {
  const adapter = Object.freeze({
    getDAW() {
      return globalScope.RuntimeStateAdapter?.getDAW?.() || globalScope.DAW || null;
    },

    getDAWOrThrow() {
      const daw = this.getDAW();
      if (!daw) throw new Error('EditorRuntimeAdapter: DAW is unavailable');
      return daw;
    },

    getPERF() {
      return globalScope.RuntimeStateAdapter?.getPERF?.() || globalScope.PERF || null;
    },

    getPERFOrThrow() {
      const perf = this.getPERF();
      if (!perf) throw new Error('EditorRuntimeAdapter: PERF is unavailable');
      return perf;
    },

    getSong() {
      return globalScope.EdCurAdapter?.getEdCur?.() || globalScope.edCur || null;
    },

    setSong(song) {
      globalScope.EdCurAdapter?.setEdCur?.(song);
      return song;
    },

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
  globalScope.getEditorDAW = () => adapter.getDAWOrThrow();
  globalScope.getEditorPERF = () => adapter.getPERFOrThrow();
  globalScope.getEditorSong = () => adapter.getSong();
  globalScope.startEditorPointerDrag = (...args) => adapter.startPointerDrag(...args);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = adapter;
  }
})(typeof window !== 'undefined' ? window : globalThis);
