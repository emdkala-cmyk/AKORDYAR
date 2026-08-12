/**
 * EditorAnchorService — DOM geometry helpers for editor anchors.
 *
 * The editor still owns interaction state; this service only translates
 * logical line/character anchors into DOM ranges and screen coordinates.
 */
(function attachEditorAnchorService(globalScope) {
  function create({
    documentRef = globalScope.document,
    nodeFilter = globalScope.NodeFilter,
    getEditor,
    getComputedStyle =
      globalScope.getComputedStyle || (() => ({ direction: 'ltr' }))
  } = {}) {
    const SHOW_TEXT = nodeFilter?.SHOW_TEXT ?? 4;

    function collectTextSegments(lineEl) {
      if (!lineEl || typeof documentRef?.createTreeWalker !== 'function') {
        return { segments: [], total: 0 };
      }

      const segments = [];
      let total = 0;
      let node;
      const walker = documentRef.createTreeWalker(lineEl, SHOW_TEXT);
      while ((node = walker.nextNode())) {
        const length = node.textContent?.length || 0;
        segments.push({ node, start: total, len: length });
        total += length;
      }

      return { segments, total };
    }

    function anchorRectIn(editorEl, chord) {
      const lineEl = editorEl?.children?.[chord?.lineIndex];
      if (!lineEl || typeof documentRef?.createRange !== 'function') {
        return null;
      }

      const collected = collectTextSegments(lineEl);
      if (!collected.segments.length) return null;

      const { segments, total } = collected;
      const range = documentRef.createRange();
      const anchorType = chord?.anchorType;

      if (anchorType === 'LineStart') {
        const segment = segments[0];
        range.setStart(segment.node, 0);
        range.setEnd(segment.node, Math.min(1, segment.len));
      } else if (anchorType === 'LineEnd') {
        const segment = segments[segments.length - 1];
        const offset = Math.max(0, segment.len - 1);
        range.setStart(segment.node, offset);
        range.setEnd(segment.node, Math.min(offset + 1, segment.len));
      } else {
        const maxIndex = Math.max(0, total - 1);
        const rawIndex = Number(chord?.charIndex);
        const index = Number.isFinite(rawIndex)
          ? Math.min(rawIndex, maxIndex)
          : maxIndex;
        const segment =
          segments.find(item =>
            index >= item.start && index < item.start + item.len
          ) || segments[segments.length - 1];
        const local = Math.max(0, index - segment.start);
        range.setStart(segment.node, Math.min(local, segment.len));
        range.setEnd(segment.node, Math.min(local + 1, segment.len));
      }

      return {
        rect: range.getBoundingClientRect(),
        lineRect: lineEl.getBoundingClientRect(),
        type: anchorType
      };
    }

    function caretFromPoint(x, y) {
      if (typeof documentRef?.caretRangeFromPoint === 'function') {
        return documentRef.caretRangeFromPoint(x, y);
      }

      if (typeof documentRef?.caretPositionFromPoint === 'function') {
        const position = documentRef.caretPositionFromPoint(x, y);
        if (position && typeof documentRef.createRange === 'function') {
          const range = documentRef.createRange();
          range.setStart(position.offsetNode, position.offset);
          range.collapse(true);
          return range;
        }
      }

      return null;
    }

    function anchorFromPoint(x, y) {
      let range = caretFromPoint(x, y);
      if (!range) range = caretFromPoint(x, y + 15);
      if (!range) range = caretFromPoint(x, y + 30);

      let lineEl = null;
      if (range) {
        const node = range.startContainer;
        lineEl = (node.nodeType === 3 ? node.parentElement : node)
          ?.closest?.('.eline');
      } else {
        const element = documentRef?.elementFromPoint?.(x, y);
        lineEl = element?.closest?.('.eline');
      }
      if (!lineEl) return null;

      const editor = lineEl.closest?.('#editor');
      const currentEditor =
        typeof getEditor === 'function' ? getEditor() : editor;
      if (!editor || editor !== currentEditor) return null;

      const lineIndex = [...editor.children].indexOf(lineEl);
      const text = (lineEl.textContent || '').replace(/\u200B/g, '');
      const isRTL = getComputedStyle(lineEl).direction === 'rtl';
      const lineRect = lineEl.getBoundingClientRect();
      if (!text.length) {
        return { lineIndex, charIndex: 0, anchorType: 'LineStart' };
      }

      const firstCharRect =
        anchorRectIn(editor, {
          lineIndex,
          charIndex: 0,
          anchorType: 'OnCharacter'
        })?.rect;
      const lastCharRect =
        anchorRectIn(editor, {
          lineIndex,
          charIndex: text.length - 1,
          anchorType: 'OnCharacter'
        })?.rect;
      if (!firstCharRect || !lastCharRect) return null;

      const textLeft = isRTL ? lastCharRect.left : firstCharRect.left;
      const textRight = isRTL ? firstCharRect.right : lastCharRect.right;
      if (x >= textRight && x <= lineRect.right) {
        return isRTL
          ? { lineIndex, charIndex: 0, anchorType: 'LineStart' }
          : { lineIndex, charIndex: text.length, anchorType: 'LineEnd' };
      }
      if (x <= textLeft && x >= lineRect.left) {
        return isRTL
          ? { lineIndex, charIndex: text.length, anchorType: 'LineEnd' }
          : { lineIndex, charIndex: 0, anchorType: 'LineStart' };
      }
      if (x > lineRect.right) {
        return isRTL
          ? { lineIndex, charIndex: 0, anchorType: 'LineStart' }
          : { lineIndex, charIndex: text.length, anchorType: 'LineEnd' };
      }
      if (x < lineRect.left) {
        return isRTL
          ? { lineIndex, charIndex: text.length, anchorType: 'LineEnd' }
          : { lineIndex, charIndex: 0, anchorType: 'LineStart' };
      }
      if (!range) return null;

      const node = range.startContainer;
      let charIndex = 0;
      let found = false;
      const walker = documentRef.createTreeWalker(lineEl, SHOW_TEXT);
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (textNode === node) {
          charIndex += Math.min(range.startOffset, textNode.textContent.length);
          found = true;
          break;
        }
        charIndex += textNode.textContent.length;
      }
      if (!found) charIndex = text.length;

      let anchorType = 'OnCharacter';
      if (charIndex <= 0) {
        anchorType = 'LineStart';
      } else if (charIndex >= text.length) {
        anchorType = 'LineEnd';
        charIndex = text.length;
      }
      return {
        lineIndex,
        charIndex: Math.max(0, Math.min(charIndex, text.length)),
        anchorType
      };
    }

    return Object.freeze({ anchorRectIn, caretFromPoint, anchorFromPoint });
  }

  globalScope.EditorAnchorService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
