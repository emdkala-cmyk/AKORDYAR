/*
 * CorePlayerViewPopupService
 *
 * Coordinates the full Player View popup sync without owning popup state.
 */
(function attachCorePlayerViewPopupService(globalScope) {
  'use strict';

  function create({
    getPopup = () => null,
    isPopupOpen = popup => Boolean(popup && !popup.closed),
    popupDocument = popup => popup?.document || null,
    getSnapshot = () => null,
    translate = key => key,
    getCurrentLang = () => 'fa',
    transposeChord = name => name,
    popupSyncRuntime = null,
    popupBuilderRuntime = null
  } = {}) {
    function sync() {
      const popup = getPopup?.();
      if (!isPopupOpen?.(popup)) return;
      const documentRef = popupDocument?.(popup);
      if (!documentRef) return;

      // If popup already has chord script, update in-place (no full rebuild).
      if (popupSyncRuntime?.syncExistingPopup?.()) return;

      const snapshot = getSnapshot?.();
      if (!snapshot) return;
      const title = snapshot.title || translate('untitled');
      const artist = snapshot.artist || '';
      const keyString =
        (snapshot.key || 'C') + (snapshot.keyMode === 'min' ? 'm' : '');
      const sub = [
        artist,
        keyString
          ? (getCurrentLang?.() === 'fa' ? 'گام: ' : 'Key: ') + keyString
          : null
      ]
        .filter(Boolean)
        .join('  ·  ');
      const lines = (snapshot.lyrics || '').split('\n');
      const chords = (snapshot.chords || []).map(chord => ({
        lineIndex: chord.lineIndex,
        charIndex: chord.charIndex,
        anchorType: chord.anchorType,
        _name: transposeChord(chord.name, snapshot.transpose)
      }));

      popupBuilderRuntime?.render?.({
        documentRef,
        title,
        sub,
        lines,
        styles: snapshot.styles,
        chords
      });
    }

    return Object.freeze({ sync });
  }

  const service = Object.freeze({ create });
  globalScope.CorePlayerViewPopupService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
