/*
 * CoreHighlightService
 *
 * Owns the presentation highlight-effect preference and applies the matching
 * CSS classes to the editor and lyric popup.
 */
(function attachCoreHighlightService(globalScope) {
  'use strict';

  const EFFECTS = Object.freeze([
    'neon',
    'frost',
    'shift',
    'depth',
    'pulse'
  ]);
  const NAMES = Object.freeze({
    neon: 'Neon Glow',
    frost: 'Frosted Glass',
    shift: 'Color Shift',
    depth: 'Double Shadow',
    pulse: 'Pulse Glow'
  });

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getSongState = () => globalScope.EditorSongStateService,
    getPopup = () => null,
    isPopupOpen = popup => Boolean(popup && !popup.closed),
    popupDocument = () => null,
    saveSong = () => {}
  } = {}) {
    function getHighlightEffect() {
      return (
        getSongState?.()
          ?.getPresentationSnapshot?.()
          ?.styles?.highlightEffect || 'depth'
      );
    }

    function applyHighlightClassToEditor() {
      const editor = getElement('editor');
      if (!editor) return;
      const nextClass = `hl-${getHighlightEffect()}`;
      EFFECTS.forEach(effect => {
        const effectClass = `hl-${effect}`;
        if (effectClass !== nextClass) {
          editor.classList.remove(effectClass);
        }
      });
      if (!editor.classList.contains?.(nextClass)) {
        editor.classList.add(nextClass);
      }
    }

    function applyHighlightClassToPopup() {
      const popup = getPopup?.();
      if (!isPopupOpen?.(popup)) return;
      const popupDoc = popupDocument?.(popup);
      const body = popupDoc?.body;
      if (!body) return;
      const nextClass = `hl-${getHighlightEffect()}`;
      EFFECTS.forEach(effect => {
        const effectClass = `hl-${effect}`;
        if (effectClass !== nextClass) {
          body.classList.remove(effectClass);
        }
      });
      if (!body.classList.contains?.(nextClass)) {
        body.classList.add(nextClass);
      }
    }

    function setHighlightEffect(effect) {
      if (!EFFECTS.includes(effect)) return;
      if (!getSongState?.()?.setHighlightEffect?.(effect, EFFECTS)) return;

      documentRef?.querySelectorAll?.('.hl-opt').forEach(element => {
        element.classList.toggle(
          'active',
          element.dataset.effect === effect
        );
      });
      const nameElement = getElement('hl-effect-name');
      if (nameElement) nameElement.textContent = NAMES[effect] || effect;
      applyHighlightClassToEditor();
      applyHighlightClassToPopup();
      saveSong?.();
    }

    function initHighlightEffect() {
      const effect = getHighlightEffect();
      documentRef?.querySelectorAll?.('.hl-opt').forEach(element => {
        element.classList.toggle(
          'active',
          element.dataset.effect === effect
        );
      });
      const nameElement = getElement('hl-effect-name');
      if (nameElement) nameElement.textContent = NAMES[effect] || effect;
      applyHighlightClassToEditor();
    }

    return Object.freeze({
      getHighlightEffect,
      setHighlightEffect,
      applyHighlightClassToEditor,
      applyHighlightClassToPopup,
      initHighlightEffect
    });
  }

  const service = Object.freeze({ create });
  globalScope.CoreHighlightService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
