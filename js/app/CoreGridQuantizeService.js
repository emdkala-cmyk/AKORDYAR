/**
 * CoreGridQuantizeService
 *
 * Keeps snap/grid/quantize orchestration outside core.js while preserving the
 * legacy global functions consumed by the editor and inline actions.
 */
(function attachCoreGridQuantizeService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getTransportState = () => ({}),
    getSongState = () => globalScope.requireEditorSongStateService?.(),
    getDAW = () => globalScope.RuntimeStateAdapter?.getDAW?.() || null,
    timelineGrid = globalScope.TimelineGrid,
    meter = globalScope.Meter,
    quantizer = globalScope.EditorChordQuantizeService,
    saveState = () => {},
    renderClips = () => {},
    renderRuler = () => {},
    toast = () => {},
    round = value => value
  } = {}) {
    let modalDismissBound = false;

    function getTimeSignatureGridConfig(timeSignature, bpm) {
      return timelineGrid?.getTimeSignatureGridConfig?.(
        timeSignature,
        bpm || 120
      ) || meter?.getMeterConfig?.(timeSignature, bpm || 120) || {};
    }

    function getActiveQuantizeGridStep(config) {
      return quantizer?.gridStepForPreset?.(
        config,
        getTransportState().snapPreset
      ) || Number(config?.beatDuration) || getTransportState().snapValue;
    }

    function toggleSnap() {
      const state = getTransportState();
      state.snapEnabled = !state.snapEnabled;
      getElement('snapBtn')?.classList?.toggle('active', state.snapEnabled);
      toast(state.snapEnabled ? t('snapEnabled') : t('snapDisabled'));
      return state.snapEnabled;
    }

    function isSnapEnabled() {
      return getTransportState().snapEnabled === true;
    }

    function snapTime(time) {
      const state = getTransportState();
      if (!isSnapEnabled()) return time;
      const timing = getSongState()?.getTimingContext?.() || {};
      const config = getTimeSignatureGridConfig(
        timing.timeSignature,
        timing.tempo
      );
      state.snapValue = getActiveQuantizeGridStep(config);
      return meter?.snapTimeToGrid?.(time, state.snapValue) ?? time;
    }

    function showQuantizeModal() {
      const modal = getElement('quantizeModal');
      modal?.classList?.toggle('show');
      return modal?.classList?.contains?.('show') || false;
    }

    function applyQuantize(preset, sourceElement) {
      const timing = getSongState()?.getTimingContext?.() || {};
      const state = getTransportState();
      const config = getTimeSignatureGridConfig(
        timing.timeSignature,
        timing.tempo
      );
      state.snapPreset = preset || '1/4';
      state.snapValue = getActiveQuantizeGridStep(config);

      documentRef?.querySelectorAll?.('.q-preset').forEach(element => {
        element.classList.remove('active');
      });
      (
        sourceElement?.closest?.('.q-preset') ||
        documentRef?.querySelector?.(
          `.q-preset[data-value="${state.snapPreset}"]`
        )
      )?.classList?.add('active');
      state.snapEnabled = true;
      getElement('snapBtn')?.classList?.add('active');
      toast(t('operationComplete'));
      getElement('quantizeModal')?.classList?.remove('show');
      return state.snapValue;
    }

    function quantizeSelectedChords() {
      const daw = getDAW() || {};
      const selectedChordClips = (daw.clips || []).filter(clip =>
        clip.type === 'chord' && daw.selectedIds?.has?.(clip.id)
      );
      if (selectedChordClips.length === 0) {
        toast(t('noChordSelected'));
        return { changed: false, count: 0 };
      }

      const timing = getSongState()?.getTimingContext?.() || {};
      const config = getTimeSignatureGridConfig(
        timing.timeSignature,
        timing.tempo
      );
      const gridStep = getActiveQuantizeGridStep(config);
      const result = quantizer?.quantizeSelectedChords?.(
        daw.clips,
        daw.selectedIds,
        gridStep,
        { round }
      ) || { changed: false, count: 0 };

      if (result.changed) {
        saveState();
        renderClips();
        renderRuler();
        toast(t('operationComplete'));
      } else {
        toast(t('chordsAlreadyOnGrid'));
      }
      return result;
    }

    function bindModalDismiss() {
      if (modalDismissBound || !documentRef?.addEventListener) return false;
      modalDismissBound = true;
      documentRef.addEventListener('click', event => {
        if (
          !event.target?.closest?.('#quantizeModal') &&
          !event.target?.closest?.('[data-action="showQuantize"]')
        ) {
          getElement('quantizeModal')?.classList?.remove('show');
        }
      });
      return true;
    }

    return Object.freeze({
      getTimeSignatureGridConfig,
      getActiveQuantizeGridStep,
      toggleSnap,
      isSnapEnabled,
      snapTime,
      showQuantizeModal,
      applyQuantize,
      quantizeSelectedChords,
      bindModalDismiss
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreGridQuantizeService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
