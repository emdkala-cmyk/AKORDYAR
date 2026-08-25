/**
 * EditorWaveformBridgeService
 *
 * Owns the editor-facing construction and forwarding boundary for
 * WaveformService. The waveform algorithms remain in WaveformService;
 * app/core.js only keeps the compatibility functions used by older callers.
 */
(function attachEditorWaveformBridgeService(globalScope) {
  function create({
    waveformServiceCtor = globalScope.WaveformService,
    ensureAudioCtx,
    setAudioContext,
    getWaveCache,
    documentRef = globalScope.document,
    clamp,
    timeToX
  } = {}) {
    if (typeof waveformServiceCtor !== 'function') {
      throw new Error(
        'WaveformService باید قبل از EditorWaveformBridgeService بارگذاری شود.'
      );
    }

    const service = new waveformServiceCtor({
      ensureAudioCtx,
      setAudioContext,
      getWaveCache,
      documentRef,
      clamp,
      timeToX
    });

    return Object.freeze({
      service,
      decodeFileToBuffer: file => service.decodeFileToBuffer(file),
      peaksFromBuffer: (buffer, buckets) =>
        service.peaksFromBuffer(buffer, buckets),
      drawWaveToCanvas: (peaks, width, height) =>
        service.drawWaveToCanvas(peaks, width, height),
      refreshClipWaveImage: clip => service.refreshClipWaveImage(clip)
    });
  }

  const bridge = Object.freeze({ create });
  globalScope.EditorWaveformBridgeService = bridge;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = bridge;
  }
})(typeof window !== 'undefined' ? window : globalThis);
