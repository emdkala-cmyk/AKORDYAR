/**
 * DomainBridge — مرز کنترل‌شده بین منطق domain و لایهٔ UI.
 *
 * این bridge فقط callbackهای runtime را پیدا و اجرا می‌کند؛
 * خودش مالک state، DOM یا PerformanceStore نیست.
 */
(function attachDomainBridge(globalScope) {
  function getSong() {
    return globalScope.EditorRuntimeAdapter?.getSong?.()
      || globalScope.EdCurAdapter?.getEdCur?.()
      || null;
  }

  function getPerformanceStore() {
    return globalScope.RuntimeStateAdapter?.getPerformanceStore?.() || null;
  }

  function callRuntime(name, ...args) {
    const callback = globalScope[name];
    return typeof callback === 'function' ? callback(...args) : undefined;
  }

  function onSongChanged() {
    callRuntime('rebuildSongDocumentFromEdCur');
    callRuntime('syncViewStylesFromEdCur');
  }

  function onKeyOrTransposeChanged() {
    callRuntime('rebuildSongDocumentFromEdCur');
    if (getPerformanceStore()) callRuntime('publishPerformanceState');
  }

  function onContentChanged() {
    onSongChanged();
  }

  function onProjectLoaded() {
    const store = getPerformanceStore();
    if (store && typeof store.resetStore === 'function') store.resetStore();
    onSongChanged();
  }

  const DomainBridge = Object.freeze({
    getSong,
    getPerformanceStore,
    onSongChanged,
    onKeyOrTransposeChanged,
    onContentChanged,
    onProjectLoaded
  });

  globalScope.DomainBridge = DomainBridge;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DomainBridge;
  }
})(typeof window !== 'undefined' ? window : globalThis);
