/**
 * Akordyar application bootstrap.
 *
 * مسیر عادی loader همیشه dynamic و ترتیبی است. document.write فقط با
 * data-loader-mode="document-write" روی همان script فعال می‌شود تا مسیر
 * compatibility قدیمی کاملاً صریح و قابل audit باقی بماند.
 */
const APPLICATION_CHUNKS = Object.freeze([
  'core/FunctionUtils.js',
  'core/DAWRuntimeState.js',
  'app/constants.js',
  'core/CorePublicApi.js',
  'app/AppI18nService.js',
  'app/MidiMonitorService.js',
  'app/CoreGridQuantizeService.js',
  'app/CoreMetronomeService.js',
  'app/CoreTransportService.js',
  'app/CorePerformanceModeService.js',
  'app/CorePanelLayoutService.js',
  'app/CoreTimelineGeometryService.js',
  'app/CoreTimelineRendererService.js',
  'app/CoreTrackSetupService.js',
  'app/CoreClipService.js',
  'app/CoreAudioImportService.js',
  'app/CoreClipEditService.js',
  'app/CoreSelectionService.js',
  'app/CoreClipDragService.js',
  'app/CoreClipInteractionService.js',
  'app/CoreClipDeletionService.js',
  'app/CoreClipboardBridgeService.js',
  'app/CoreMixerBridgeService.js',
  'app/CoreRecordingService.js',
  'app/CoreSettingsService.js',
  'app/CoreHighlightService.js',
  'app/CoreMovableWindowBridgeService.js',
  'app/CoreLoopVisualService.js',
  'app/CoreLoopControlService.js',
  'app/CoreChordLineSyncService.js',
  'app/CorePopupWindowBridgeService.js',
  'app/CoreChordLinePopupService.js',
  'app/CoreFocusModeService.js',
  'app/CoreSyncModeBridgeService.js',
  'core/AudioCompressionService.js',
  'core/TransportClockService.js',
  'core/TransportSchedulingService.js',
  'app/core.js',
  'app/editor.js',
  'app/print.js',
  'app/search.js'
]);

function createApplicationLoader({
  documentRef = typeof document !== 'undefined' ? document : null,
  currentScript = documentRef?.currentScript || null,
  chunks = APPLICATION_CHUNKS,
  logger = console
} = {}) {
  if (!documentRef) {
    return Object.freeze({
      load: () => Promise.resolve([]),
      loadWithDocumentWrite: () => Promise.resolve([])
    });
  }

  const baseUrl = currentScript?.src
    ? new URL('.', currentScript.src).href
    : new URL('js/', documentRef.baseURI || globalThis.location?.href || 'http://localhost/').href;
  const urls = chunks.map(chunk => new URL(chunk, baseUrl).href);
  let loadPromise = null;

  const findExistingScript = url => {
    const scripts = documentRef.scripts
      ? Array.from(documentRef.scripts)
      : Array.from(documentRef.querySelectorAll?.('script') || []);
    return scripts.find(script => script.src === url || script.getAttribute?.('src') === url) || null;
  };

  const loadOne = url => new Promise((resolve, reject) => {
    const existing = findExistingScript(url);
    if (existing?.dataset?.akordyarChunkLoaded === 'true') {
      resolve(existing);
      return;
    }

    const script = existing || documentRef.createElement('script');
    script.src = url;
    script.async = false;
    script.dataset = script.dataset || {};
    script.dataset.akordyarChunk = 'true';

    const finish = (error) => {
      script.onload = null;
      script.onerror = null;
      if (error) {
        logger?.error?.(`[App] Failed to load application chunk: ${url}`, error);
        reject(error);
        return;
      }
      script.dataset.akordyarChunkLoaded = 'true';
      resolve(script);
    };

    script.onload = () => finish();
    script.onerror = event => finish(event instanceof Error ? event : new Error(`Failed to load ${url}`));

    if (!existing) {
      (documentRef.head || documentRef.documentElement).appendChild(script);
    } else if (existing.readyState === 'complete' || existing.complete) {
      finish();
    }
  });

  const load = () => {
    if (!loadPromise) {
      loadPromise = urls.reduce(
        (chain, url) => chain.then(loaded => loadOne(url).then(script => [...loaded, script])),
        Promise.resolve([])
      );
    }
    return loadPromise;
  };

  const loadWithDocumentWrite = () => {
    if (documentRef.readyState !== 'loading' || typeof documentRef.write !== 'function') {
      return load();
    }

    documentRef.write(urls
      .map(url => `<script src="${url}" data-akordyar-chunk="true"><\/script>`)
      .join(''));
    return Promise.resolve(urls);
  };

  return Object.freeze({ load, loadWithDocumentWrite, urls });
}

(function bootstrapApplication() {
  if (typeof document === 'undefined') return;

  const currentScript = document.currentScript;
  const loader = createApplicationLoader({ documentRef: document, currentScript });
  const compatibilityMode = currentScript?.dataset?.loaderMode === 'document-write';

  window.ApplicationLoader = loader;
  const load = compatibilityMode
    ? loader.loadWithDocumentWrite()
    : loader.load();
  load.catch?.(() => {});
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APPLICATION_CHUNKS, createApplicationLoader };
}
