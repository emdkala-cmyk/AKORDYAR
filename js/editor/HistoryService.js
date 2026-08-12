/* Akordyar — HistoryService
   استخراج خوشه‌ی History/ProjectStore از app.js به سرویس مستقل
   (serializeState, saveState, applyState, undo, redo) */
(() => {
  'use strict';

  class HistoryService {
    constructor() {
      this.undoStack = [];
      this.undoIndex = -1;
      this.isApplyingHistory = false;
      this._autoSaveTimer = null;
      this.ctx = null;
      this.limit = 100;
      this.autoSaveDelay = 700;
    }

    init(ctx) {
      this.ctx = ctx;
    }

    reset() {
      clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = null;
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
      return typeof ctx.getDAW === 'function' ? ctx.getDAW() : ctx.DAW;
    }

    getPERF() {
      const ctx = this.ctx || {};
      return typeof ctx.getPERF === 'function' ? ctx.getPERF() : ctx.PERF;
    }

    serializeState() {
      const ctx = this.ctx;
      const DAW = this.getDAW();
      const edCur = ctx.getEdCur();
      const edSeqPoints = ctx.getEdSeqPoints();

      const tracks = DAW.tracks.map(t => {
        const copy = { ...t };
        delete copy._pannerNode;
        delete copy._gainNode;
        return copy;
      });

      const clips = DAW.clips.map(c => {
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
      for (const [clipId, clip] of Object.entries(DAW.pool)) {
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
        edCur: edCur ? JSON.parse(JSON.stringify(edCur)) : null,
        edSeqPoints: Array.isArray(edSeqPoints)
          ? JSON.parse(JSON.stringify(edSeqPoints))
          : []
      });
    }

    saveState() {
      const ctx = this.ctx;
      const PERF = this.getPERF();
      if (this.isApplyingHistory) return;

      const state = this.serializeState();

      if (state === PERF.lastSerializedState) {
        clearTimeout(ctx.getAutoSaveTimer());
        ctx.setAutoSaveTimer(setTimeout(() => ctx.edSaveSong(), this.autoSaveDelay));
        return;
      }

      this.undoStack = this.undoStack.slice(0, this.undoIndex + 1);
      this.undoStack.push(state);

      if (this.undoStack.length > this.limit) {
        this.undoStack.shift();
      }

      this.undoIndex = this.undoStack.length - 1;
      PERF.lastSerializedState = state;

      clearTimeout(ctx.getAutoSaveTimer());
      ctx.setAutoSaveTimer(setTimeout(() => ctx.edSaveSong(), this.autoSaveDelay));
    }

    applyState(stateStr) {
      const ctx = this.ctx;
      const DAW = this.getDAW();
      const PERF = this.getPERF();
      if (!stateStr) return;

      this.isApplyingHistory = true;

      clearTimeout(ctx.getAutoSaveTimer());
      ctx.clearEdTimers();

      try {
        const state = JSON.parse(stateStr);

        DAW.tracks = state.tracks || [];
        DAW.clips = state.clips || [];
        DAW.sections = state.sections || [];
        DAW.selectedSectionIds = new Set();
        ctx.updateNextIdFromClips();

        if (state.edCur) {
          const keepId = ctx.getEdCur()?.id;
          const repairedSong = typeof ctx.repairSong === 'function'
            ? ctx.repairSong(state.edCur)
            : state.edCur;
          ctx.setEdCur(repairedSong);
          if (keepId != null) ctx.getEdCur().id = keepId;
        } else {
          ctx.setEdCur(null);
        }

        ctx.setEdSeqPoints(
          Array.isArray(state.edSeqPoints)
            ? state.edSeqPoints
            : (ctx.getEdCur()?.seqPoints || [])
        );

        if (ctx.getEdCur()) {
          ctx.getEdCur().seqPoints = ctx.getEdSeqPoints();
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
      } finally {
        this.isApplyingHistory = false;
      }
    }

    undo() {
      const ctx = this.ctx;
      if (ctx.getEdCur() && ctx.edCommitTimerRef()) {
        ctx.edFlushPendingCommit();
      }

      if (this.undoIndex <= 0) {
        ctx.toast(ctx.t('nothingUndo'));
        return;
      }

      this.undoIndex--;
      this.applyState(this.undoStack[this.undoIndex]);
      ctx.toast('Undo');
    }

    redo() {
      const ctx = this.ctx;
      if (this.undoIndex >= this.undoStack.length - 1) {
        ctx.toast(ctx.t('nothingRedo'));
        return;
      }

      this.undoIndex++;
      this.applyState(this.undoStack[this.undoIndex]);
      ctx.toast('Redo');
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
