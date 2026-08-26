/* Akordyar — HistoryService
   استخراج منطق History از app.js به سرویس مستقل
   (serializeState, saveState, applyState, undo, redo) */
(() => {
  'use strict';

  function hasSongGetter(ctx) {
    return typeof ctx?.getEdCur === 'function' ||
      typeof ctx?.getSong === 'function';
  }

  function hasSongSetter(ctx) {
    return typeof ctx?.setEdCur === 'function' ||
      typeof ctx?.setSong === 'function';
  }

  function isHistoryContextReady(ctx) {
    if (!ctx || !hasSongGetter(ctx) || !hasSongSetter(ctx)) return false;

    const hasDAW = typeof ctx.getDAW === 'function' || ctx.DAW;
    const hasPERF = typeof ctx.getPERF === 'function' || ctx.PERF;
    const hasSeqPoints =
      typeof ctx.getEdSeqPoints === 'function' || Array.isArray(ctx.edSeqPoints);

    return Boolean(hasDAW && hasPERF && hasSeqPoints);
  }

  class HistoryService {
    constructor() {
      this.undoStack = [];
      this.undoIndex = -1;
      this.isApplyingHistory = false;
      this._autoSaveTimer = null;
      this.ctx = null;
      this.initialized = false;
      this.historyEnabled = false;
      this.limit = 100;
      this.autoSaveDelay = 700;
    }

    init(ctx) {
      this.deactivate();
      this.ctx = ctx || null;
      this.initialized = Boolean(ctx);
      this.historyEnabled = false;
      return this.isContextReady();
    }

    activate() {
      if (!this.isContextReady() || !this.getSong()) return false;
      this.historyEnabled = true;
      return true;
    }

    deactivate() {
      this.historyEnabled = false;
      this.clearAutoSaveTimer();
      return true;
    }

    isEnabled() {
      return this.historyEnabled;
    }

    isContextReady() {
      return this.initialized && isHistoryContextReady(this.ctx);
    }

    isHistoryContextReady() {
      return this.isContextReady();
    }

    clearAutoSaveTimer() {
      if (this._autoSaveTimer != null) {
        clearTimeout(this._autoSaveTimer);
      }
      this._autoSaveTimer = null;
    }

    scheduleAutoSave() {
      const ctx = this.ctx;
      if (typeof ctx?.edSaveSong !== 'function') {
        return false;
      }

      this.clearAutoSaveTimer();
      try {
        const timer = setTimeout(() => {
          if (this.historyEnabled) ctx.edSaveSong();
        }, this.autoSaveDelay);
        this._autoSaveTimer = timer;
        return true;
      } catch (_) {
        this._autoSaveTimer = null;
        return false;
      }
    }

    reset() {
      this.clearAutoSaveTimer();
      this.undoStack = [];
      this.undoIndex = -1;
      this.isApplyingHistory = false;

      const perf = this.getPERF();
      if (perf) perf.lastSerializedState = '';
    }

    getHistoryLength() {
      return this.undoStack.length;
    }

    isApplying() {
      return this.isApplyingHistory;
    }

    getDAW() {
      const ctx = this.ctx || {};
      try {
        return typeof ctx.getDAW === 'function' ? ctx.getDAW() : ctx.DAW;
      } catch (_) {
        return null;
      }
    }

    getPERF() {
      const ctx = this.ctx || {};
      try {
        return typeof ctx.getPERF === 'function' ? ctx.getPERF() : ctx.PERF;
      } catch (_) {
        return null;
      }
    }

    getSong() {
      const ctx = this.ctx || {};
      try {
        if (typeof ctx.getEdCur === 'function') return ctx.getEdCur();
        if (typeof ctx.getSong === 'function') return ctx.getSong();
      } catch (_) {}
      return null;
    }

    setSong(song) {
      const ctx = this.ctx || {};
      try {
        if (typeof ctx.setEdCur === 'function') {
          ctx.setEdCur(song);
          return true;
        }
        if (typeof ctx.setSong === 'function') {
          ctx.setSong(song);
          return true;
        }
      } catch (_) {}
      return false;
    }

    serializeState() {
      if (!this.isContextReady()) return null;

      const ctx = this.ctx;
      const DAW = this.getDAW();
      const PERF = this.getPERF();
      const edCur = this.getSong();
      if (!DAW || !PERF || !edCur) return null;

      try {
        const edSeqPoints = typeof ctx.getEdSeqPoints === 'function'
          ? ctx.getEdSeqPoints()
          : ctx.edSeqPoints;
        const tracks = (Array.isArray(DAW.tracks) ? DAW.tracks : []).map(t => {
          const copy = { ...t };
          delete copy._pannerNode;
          delete copy._gainNode;
          return copy;
        });

        const clips = (Array.isArray(DAW.clips) ? DAW.clips : []).map(c => {
          const copy = { ...c };
          delete copy._peaks;
          delete copy.waveUrl;
          delete copy.buffer;
          delete copy.audioBuffer;
          delete copy._fileHandle;
          return copy;
        });

        const sections = (DAW.sections || []).map(s => ({ ...s }));

        const cleanPool = {};
        for (const [clipId, clip] of Object.entries(DAW.pool || {})) {
          const cleanClip = { ...clip };
          delete cleanClip.runtime;
          delete cleanClip._peaks;
          delete cleanClip.waveUrl;
          delete cleanClip.audioBuffer;
          delete cleanClip.buffer;
          cleanPool[clipId] = cleanClip;
        }

        return JSON.stringify({
          schema: 'akordyar-project',
          version: 2,
          project: {
            id: DAW.project?.id || '',
            name: DAW.project?.name || '',
            projectRoot: undefined
          },
          pool: cleanPool,
          tracks,
          clips,
          sections,
          edCur: JSON.parse(JSON.stringify(edCur)),
          edSeqPoints: Array.isArray(edSeqPoints)
            ? JSON.parse(JSON.stringify(edSeqPoints))
            : []
        });
      } catch (_) {
        return null;
      }
    }

    saveState() {
      if (!this.historyEnabled || !this.isContextReady() || this.isApplyingHistory) {
        return false;
      }

      const PERF = this.getPERF();
      const state = this.serializeState();
      if (!PERF || !state) return false;

      if (state === PERF.lastSerializedState) {
        this.scheduleAutoSave();
        return true;
      }

      this.undoStack = this.undoStack.slice(0, this.undoIndex + 1);
      this.undoStack.push(state);

      if (this.undoStack.length > this.limit) {
        this.undoStack.shift();
      }

      this.undoIndex = this.undoStack.length - 1;
      PERF.lastSerializedState = state;

      this.scheduleAutoSave();
      return true;
    }

    applyState(stateStr) {
      if (
        !stateStr ||
        !this.historyEnabled ||
        !this.isContextReady()
      ) {
        return false;
      }

      const ctx = this.ctx;
      const DAW = this.getDAW();
      const PERF = this.getPERF();
      if (!DAW || !PERF) return false;

      this.isApplyingHistory = true;

      this.clearAutoSaveTimer();
      ctx.clearEdTimers?.();

      try {
        const state = JSON.parse(stateStr);

        DAW.tracks = state.tracks || [];
        DAW.clips = state.clips || [];
        DAW.sections = state.sections || [];
        DAW.selectedSectionIds = new Set();
        ctx.updateNextIdFromClips();

        if (state.edCur) {
          const keepId = this.getSong()?.id;
          const repairedSong = typeof ctx.repairSong === 'function'
            ? ctx.repairSong(state.edCur)
            : state.edCur;
          this.setSong(repairedSong);
          if (keepId != null && this.getSong()) this.getSong().id = keepId;
        } else {
          this.setSong(null);
        }

        ctx.setEdSeqPoints(
          Array.isArray(state.edSeqPoints)
            ? state.edSeqPoints
            : (this.getSong()?.seqPoints || [])
        );

        if (this.getSong()) {
          this.getSong().seqPoints = ctx.getEdSeqPoints();
          ctx.edSyncToolbar();
          ctx.edRenderEditor(true);
        }

        ctx.ensureAudioCtx();

        DAW.tracks.forEach(t => {
          if (t.type === 'audio') {
            t._pannerNode = DAW.audioCtx.createStereoPanner();
            t._gainNode = DAW.audioCtx.createGain();
            t._pannerNode.connect(t._gainNode);
            t._gainNode.connect(DAW.masterGain);
            ctx.updateTrackMix(t.id);
          }
        });

        DAW.selectedIds.clear();

        DAW.clips.forEach(clip => {
          if (clip.type === 'audio' && clip.bufferKey && DAW.bufferCache.has(clip.bufferKey)) {
            const buffer = DAW.bufferCache.get(clip.bufferKey);
            clip.sourceDuration = buffer.duration;
            clip._peaks = ctx.peaksFromBuffer(buffer, 2000);
            ctx.refreshClipWaveImage(clip);
          }
        });

        PERF.tracksVersion++;
        PERF.clipsVersion++;
        ctx.renderAll();

        if (DAW.isPlaying) {
          ctx.scheduleAllFromPlayhead();
        }

        PERF.lastSerializedState = stateStr;
        return true;
      } catch (error) {
        ctx.logger?.error?.('History state apply error:', error);
        return false;
      } finally {
        this.isApplyingHistory = false;
      }
    }

    undo() {
      const ctx = this.ctx;
      if (!this.historyEnabled || !this.isContextReady()) return false;

      if (this.getSong() && ctx.edCommitTimerRef?.()) {
        ctx.edFlushPendingCommit();
      }

      if (this.undoIndex <= 0) {
        ctx.toast?.(ctx.t?.('nothingUndo') || 'nothingUndo');
        return false;
      }

      this.undoIndex--;
      const applied = this.applyState(this.undoStack[this.undoIndex]);
      ctx.toast?.('Undo');
      return applied;
    }

    redo() {
      const ctx = this.ctx;
      if (!this.historyEnabled || !this.isContextReady()) return false;

      if (this.undoIndex >= this.undoStack.length - 1) {
        ctx.toast?.(ctx.t?.('nothingRedo') || 'nothingRedo');
        return false;
      }

      this.undoIndex++;
      const applied = this.applyState(this.undoStack[this.undoIndex]);
      ctx.toast?.('Redo');
      return applied;
    }
  }

  const service = new HistoryService();
  const runtimeGlobal = typeof window !== 'undefined' ? window : globalThis;
  runtimeGlobal.HistoryService = service;
  runtimeGlobal.requireHistoryService = () => {
    if (!runtimeGlobal.HistoryService) {
      throw new Error('HistoryService not loaded! Load js/editor/HistoryService.js before app.js');
    }
    return runtimeGlobal.HistoryService;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})();
