/**
 * ClipboardService.js
 * منطق کپی، برش، چسباندن، تکثیر و حذف کلیپ‌ها و سکشن‌ها.
 * استخراج شده از app.js جهت کاهش خطوط و سازماندهی کد.
 */
class ClipboardService {
    constructor(deps) {
        this.deps = deps;
    }

    get d() { return this.deps; }

    deleteSelected() {
        const {
            toast,
            t,
            stopAllVoices,
            saveState,
            renderAll,
            scheduleAllFromPlayhead
        } = this.d;
        const DAW = typeof this.d.getDAW === 'function' ? this.d.getDAW() : this.d.DAW;
        if (!DAW) return;
        const clipIds = [...DAW.selectedIds];
        const sectionIds = [...DAW.selectedSectionIds];

        if (!clipIds.length && !sectionIds.length) {
            toast(t('nothingSelected'));
            return;
        }

        if (typeof stopAllVoices === 'function') stopAllVoices();

        if (clipIds.length) {
            DAW.clips = DAW.clips.filter(c => !DAW.selectedIds.has(c.id));
            DAW.selectedIds.clear();
        }

        if (sectionIds.length) {
            DAW.sections = DAW.sections.filter(s => !DAW.selectedSectionIds.has(s.id));
            DAW.selectedSectionIds.clear();
        }

        saveState();
        renderAll();
        if (DAW.isPlaying) scheduleAllFromPlayhead();
        toast(t('deleted'));
    }

    copySelected() {
        const sels = this.d.selectedClips();
        if (!sels.length) {
            this.d.toast(this.d.t('nothingSelected'));
            return;
        }

        const minStart = Math.min(...sels.map(c => c.start));
        const DAW = this.getDAW();
        if (!DAW) return;
        DAW.clipboard = sels.map(c => {
            const cp = { ...c };
            delete cp._peaks;
            delete cp.waveUrl;
            cp.relStart = c.start - minStart;
            return cp;
        });

        this.d.toast(`${DAW.clipboard.length} ${this.d.t('clipsCopied')}`);
    }

    cutSelected() {
        this.copySelected();
        const DAW = this.getDAW();
        if (DAW?.clipboard?.length) {
            this.deleteSelected();
            this.d.toast(this.d.t('cutDone'));
        }
    }

    pasteClipboard() {
        const DAW = this.getDAW();
        if (!DAW?.clipboard?.length) return;

        const newClips = DAW.clipboard.map(item => {
            const start = this.d.roundMs(DAW.playhead + item.relStart);
            const newClip = {
                ...item,
                id: this.d.uid(),
                start: start
            };
            delete newClip.relStart;

            const buffer = this.getBuffer(newClip.bufferId || newClip.bufferKey);
            if (buffer) {
                newClip._peaks = this.d.peaksFromBuffer(buffer);
                newClip.waveUrl = this.d.refreshClipWaveImage(newClip);
            }
            return newClip;
        });

        DAW.clips.push(...newClips);
        DAW.selectedIds = new Set(newClips.map(c => c.id));

        this.d.ensureTimelineFits();
        this.d.saveState();
        this.d.renderAll();
        this.d.scheduleAllFromPlayhead();
        this.d.toast(this.d.t('pasteDone'));
    }

    duplicateSelected() {
        const sels = this.d.selectedClips();
        if (!sels.length) return;
        const DAW = this.getDAW();
        if (!DAW) return;

        const maxEnd = Math.max(...sels.map(c => c.start + c.duration));
        const minStart = Math.min(...sels.map(c => c.start));
        const offset = maxEnd - minStart;

        const duplicated = sels.map(c => {
            const newClip = {
                ...c,
                id: this.d.uid(),
                start: this.d.roundMs(c.start + offset)
            };
            const buffer = this.getBuffer(newClip.bufferId || newClip.bufferKey);
            if (buffer) {
                newClip._peaks = this.d.peaksFromBuffer(buffer);
                newClip.waveUrl = this.d.refreshClipWaveImage(newClip);
            }
            return newClip;
        });

        DAW.clips.push(...duplicated);
        DAW.selectedIds = new Set(duplicated.map(c => c.id));

        this.d.ensureTimelineFits();
        this.d.saveState();
        this.d.renderAll();
        this.d.scheduleAllFromPlayhead();
        this.d.edSaveSong();
    }

    getDAW() {
        return typeof this.d.getDAW === 'function' ? this.d.getDAW() : this.d.DAW;
    }

    getBuffer(bufferKey) {
        const DAW = this.getDAW();
        const cache = DAW?.bufferCache;
        if (!cache) return null;
        return typeof cache.get === 'function' ? cache.get(bufferKey) : cache[bufferKey];
    }
}

if (typeof window !== 'undefined') {
    window.ClipboardService = ClipboardService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClipboardService;
}
