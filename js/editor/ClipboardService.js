/* js/editor/ClipboardService.js */
class ClipboardService {
  constructor(deps) {
    Object.assign(this, deps);
  }

  copySelected() {
    const sels = this.selectedClips();
    if (!sels.length) {
      this.toast(this.t('nothingSelected'));
      return;
    }
    const minStart = Math.min(...sels.map(c => c.start));
    this.DAW.clipboard = sels.map(c => {
      const cp = { ...c };
      delete cp._peaks;
      delete cp.waveUrl;
      cp.relStart = c.start - minStart;
      return cp;
    });
    this.toast(\ \);
  }

  cutSelected() {
    this.copySelected();
    if (this.DAW.clipboard.length) {
      this.deleteSelected();
      this.toast(this.t('cutDone'));
    }
  }

  pasteClipboard() {
    if (!this.DAW.clipboard.length) {
      this.toast(this.t('clipboardEmpty'));
      return;
    }
    const base = this.DAW.playhead;
    const newIds = [];
    for (const src of this.DAW.clipboard) {
      const clip = { ...src, id: this.uid('c'), start: this.roundMs(base + (src.relStart || 0)) };
      if (clip.type === 'audio') {
        if (!this.DAW.bufferCache.has(clip.bufferKey)) continue;
        clip._peaks = this.peaksFromBuffer(this.DAW.bufferCache.get(clip.bufferKey), 2000);
        this.refreshClipWaveImage(clip);
      }
      this.DAW.clips.push(clip);
      newIds.push(clip.id);
      this.ensureTimelineFits(clip.start + clip.duration + 5);
    }
    this.DAW.selectedIds = new Set(newIds);
    this.saveState();
    this.renderAll();
    if (this.DAW.isPlaying) this.scheduleAllFromPlayhead();
    this.toast(this.t('pastedAtPlayhead'));
    this.edSaveSong();
  }

  duplicateSelected() {
    const sels = this.selectedClips();
    if (!sels.length) {
      this.toast(this.t('nothingSelected'));
      return;
    }
    const newIds = [];
    sels.forEach(src => {
      const clip = { ...src, id: this.uid('c'), start: this.roundMs(src.start + src.duration) };
      if (clip.type === 'audio') {
        if (!this.DAW.bufferCache.has(clip.bufferKey)) return;
        clip._peaks = this.peaksFromBuffer(this.DAW.bufferCache.get(clip.bufferKey), 2000);
        this.refreshClipWaveImage(clip);
      }
      this.DAW.clips.push(clip);
      newIds.push(clip.id);
      this.ensureTimelineFits(clip.start + clip.duration + 5);
    });
    this.DAW.selectedIds = new Set(newIds);
    this.saveState();
    this.renderAll();
    if (this.DAW.isPlaying) this.scheduleAllFromPlayhead();
    this.toast(newIds.length + ' \u06a9\u0644\u06cc\u067e \u06a9\u067e\u06cc \u0634\u062f');
    this.edSaveSong();
  }
}
window.ClipboardService = ClipboardService;
