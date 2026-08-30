/**
 * EditorLyricsChordInteractionService
 *
 * Coordinates lyrics input/paste and the editor-wrap chord insertion guards.
 * Song state, selection, anchor mapping and modal behavior stay injected.
 */
(function attachEditorLyricsChordInteractionService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getSongState = () => null,
    getEditorText = () => '',
    getEditor = () => null,
    getEditorWrap = () => null,
    executeCommand = (...args) => globalScope.document?.execCommand?.(...args),
    remapAnchors = () => {},
    remapSequencePoints = () => {},
    remapSyncTimes = () => {},
    refreshSyncLyrics = () => {},
    scheduleEditorRefresh = () => {},
    scheduleCommit = () => {},
    scheduleSave = () => {},
    clearEditorTextSelection = () => {},
    clearSelection = () => {},
    clearChordSelection = () => {},
    isAltDown = () => false,
    anchorFromPoint = () => null,
    onLocked = () => {},
    setPendingAnchor = () => {},
    setChordIndex = () => {},
    openChordModal = () => {},
    toast = () => {}
  } = {}) {
    let editorElement = null;
    let wrapElement = null;
    let bound = false;

    function normalizeElement(target) {
      if (target?.nodeType === 3) {
        return target.parentElement || target.parentNode;
      }
      return target;
    }

    function isInsideEditor(target) {
      const element = normalizeElement(target);
      if (!element || !editorElement) return false;
      return (
        element === editorElement ||
        editorElement.contains?.(element) === true
      );
    }

    function handleOutsidePointerDown(event) {
      if (isInsideEditor(event.target)) return;

      // A click on a non-focusable surface does not blur contenteditable by
      // itself. Clear the lyric selection explicitly so Space belongs to the
      // global transport again after leaving the lyric editor.
      clearEditorTextSelection();
    }

    function handleInput() {
      const songState = getSongState();
      if (!songState?.currentSong?.()) return;

      const oldText = songState.getLyrics();
      const newText = getEditorText();
      if (oldText === newText) return;

      songState.setLyrics(newText);
      remapAnchors(oldText, newText);
      remapSequencePoints(oldText, newText);
      remapSyncTimes(oldText, newText);
      refreshSyncLyrics();
      scheduleEditorRefresh();
      scheduleCommit();
      scheduleSave();
    }

    function handlePaste(event) {
      event.preventDefault?.();
      const clipboard = event.clipboardData || globalScope.clipboardData;
      let text = clipboard?.getData?.('text/plain') || '';
      text = text
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n');
      executeCommand('insertText', false, text);
    }

    function handleEditorMouseDown(event) {
      if (
        !editorElement ||
        (event.button != null && event.button !== 0) ||
        event.altKey ||
        isAltDown() ||
        event.target?.closest?.('.chord')
      ) {
        return;
      }

      // Make lyric text the active keyboard owner before the browser runs
      // the native mousedown selection/focus behavior.
      editorElement.focus?.({ preventScroll: true });
    }

    function handleSelectionSurface(event) {
      const song = getSongState()?.currentSong?.();
      if (!song) return;

      clearSelection();
      if (
        !event.altKey &&
        !isAltDown() &&
        !event.target?.closest?.('.chord')
      ) {
        clearChordSelection();
      }
    }

    function handleChordSurface(event) {
      const song = getSongState()?.currentSong?.();
      if (!song) return;

      const clickedChord = event.target?.closest?.('.chord');
      if (song.editorLocked && !clickedChord) {
        toast('🔒 ویرایشگر قفل است');
        onLocked();
        return;
      }

      if (!(event.altKey || isAltDown())) return;
      if (song.editorLocked) {
        toast('🔒 ویرایشگر قفل است');
        return;
      }

      event.preventDefault?.();
      event.stopPropagation?.();
      const anchor = anchorFromPoint(event.clientX, event.clientY);
      if (!anchor) return;

      setPendingAnchor(anchor);
      setChordIndex(null);
      openChordModal(null);
    }

    function bind() {
      if (bound) return true;
      editorElement = getEditor();
      wrapElement = getEditorWrap();
      if (!editorElement || !wrapElement) return false;

      editorElement.addEventListener('input', handleInput);
      editorElement.addEventListener('paste', handlePaste);
      editorElement.addEventListener('mousedown', handleEditorMouseDown);
      documentRef?.addEventListener?.(
        'pointerdown',
        handleOutsidePointerDown,
        true
      );
      wrapElement.addEventListener('mousedown', handleSelectionSurface, true);
      wrapElement.addEventListener('mousedown', handleChordSurface);
      bound = true;
      return true;
    }

    function destroy() {
      if (!bound) return false;
      editorElement?.removeEventListener('input', handleInput);
      editorElement?.removeEventListener('paste', handlePaste);
      editorElement?.removeEventListener('mousedown', handleEditorMouseDown);
      documentRef?.removeEventListener?.(
        'pointerdown',
        handleOutsidePointerDown,
        true
      );
      wrapElement?.removeEventListener(
        'mousedown',
        handleSelectionSurface,
        true
      );
      wrapElement?.removeEventListener('mousedown', handleChordSurface);
      editorElement = null;
      wrapElement = null;
      bound = false;
      return true;
    }

    return Object.freeze({
      bind,
      destroy,
      handleInput,
      handlePaste,
      handleEditorMouseDown,
      handleOutsidePointerDown,
      handleSelectionSurface,
      handleChordSurface
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorLyricsChordInteractionService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
