/**
 * DomainBridge — پل بین domain logic و app.js
 *
 * تمام عملیات domain (build SongDocument, sync, transpose, key change)
 * از اینجا انجام می‌شوند. app.js فقط DOM و UI را مدیریت می‌کند.
 *
 * این فایل جایگزین rebuildSongDocumentFromEdCur و syncViewStylesFromEdCur
 * در performanceBridge.js نمی‌شود — بلکه آنها را از اینجا فراخوانی می‌کند.
 */

const DomainBridge = (() => {

  function getPerformanceStore() {
    return window.RuntimeStateAdapter?.getPerformanceStore?.() || null;
  }

  /**
   * بعد از هر تغییر در edCur، این تابع را صدا بزنید.
   * - SongDocument جدید می‌سازد
   * - به PerformanceStore push می‌کند
   * - view styles را sync می‌کند
   * - notification پخش می‌کند
   */
  function onSongChanged() {
    if (typeof rebuildSongDocumentFromEdCur === 'function') {
      rebuildSongDocumentFromEdCur();
    }
    if (typeof syncViewStylesFromEdCur === 'function') {
      syncViewStylesFromEdCur();
    }
  }

  /**
   * بعد از تغییر key یا transpose
   */
  function onKeyOrTransposeChanged() {
    if (typeof rebuildSongDocumentFromEdCur === 'function') {
      rebuildSongDocumentFromEdCur();
    }
    var store = getPerformanceStore();
    if (store) {
      if (typeof publishPerformanceState === 'function') {
        publishPerformanceState();
      }
    }
  }

  /**
   * بعد از تغییر lyrics یا chords
   */
  function onContentChanged() {
    onSongChanged();
  }

  /**
   * بعد از load پروژه جدید — ریست کامل
   */
  function onProjectLoaded() {
    var store = getPerformanceStore();
    if (store && typeof store.resetStore === 'function') {
      store.resetStore();
    }
    onSongChanged();
  }

  return {
    onSongChanged,
    onKeyOrTransposeChanged,
    onContentChanged,
    onProjectLoaded
  };

})();

if (typeof window !== 'undefined') {
  window.DomainBridge = DomainBridge;
}
