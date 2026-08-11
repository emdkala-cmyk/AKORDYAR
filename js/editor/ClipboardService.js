/**
 * ClipboardService.js
 * منطق کپی، برش، چسباندن و تکثیر کلیپ‌ها.
 * استخراج شده از app.js جهت کاهش خطوط و سازماندهی کد.
 */
class ClipboardService {
    constructor(deps) {
        this.deps = deps;
    }

    get d() { return this.deps; }

    copySelected() {
        const sels = this.d.selectedClips();
        if (!sels.length) {
            this.d.toast(this.d.t('nothingSelected'));
            return;
        }

        const minStart = Math.min(...sels.map(c => c.start));
        this.d.DAW.clipboard = sels.map(c => {
            const cp = { ...c };
            delete cp._peaks;
            delete cp.waveUrl;
            cp.relStart = c.start - minStart;
            return cp;
        });

        this.d.toast(`${this.d.DAW.clipboard.length} ${this.d.t('clipsCopied')}`);
    }

    cutSelected() {
        this.copySelected();
        if (this.d.DAW.clipboard && this.d.DAW.clipboard.length) {
            this.d.deleteSelected();
            this.d.toast(this.d.t('cutDone'));
        }
    }

    pasteClipboard() {
        if (!this.d.DAW.clipboard || !this.d.DAW.clipboard.length) return;

        const newClips = this.d.DAW.clipboard.map(item => {
            const start = this.d.roundMs(this.d.DAW.playhead + item.relStart);
            const newClip = {
                ...item,
                id: this.d.uid(),
                start: start
            };
            delete newClip.relStart;

            if (this.d.DAW.bufferCache[newClip.bufferId]) {
                newClip._peaks = this.d.peaksFromBuffer(this.d.DAW.bufferCache[newClip.bufferId]);
                newClip.waveUrl = this.d.refreshClipWaveImage(newClip);
            }
            return newClip;
        });

        this.d.DAW.clips.push(...newClips);
        this.d.DAW.selectedIds = newClips.map(c => c.id);

        this.d.ensureTimelineFits();
        this.d.saveState();
        this.d.renderAll();
        this.d.scheduleAllFromPlayhead();
        this.d.toast(this.d.t('pasteDone'));
    }

    duplicateSelected() {
        const sels = this.d.selectedClips();
        if (!sels.length) return;

        const maxEnd = Math.max(...sels.map(c => c.start + c.duration));
        const minStart = Math.min(...sels.map(c => c.start));
        const offset = maxEnd - minStart;

        const duplicated = sels.map(c => {
            const newClip = {
                ...c,
                id: this.d.uid(),
                start: this.d.roundMs(c.start + offset)
            };
            if (this.d.DAW.bufferCache[newClip.bufferId]) {
                newClip._peaks = this.d.peaksFromBuffer(this.d.DAW.bufferCache[newClip.bufferId]);
                newClip.waveUrl = this.d.refreshClipWaveImage(newClip);
            }
            return newClip;
        });

        this.d.DAW.clips.push(...duplicated);
        this.d.DAW.selectedIds = duplicated.map(c => c.id);

        this.d.ensureTimelineFits();
        this.d.saveState();
        this.d.renderAll();
        this.d.scheduleAllFromPlayhead();
        this.d.edSaveSong();
    }
}

window.ClipboardService = ClipboardService;
