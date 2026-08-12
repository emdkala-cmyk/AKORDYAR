/**
 * EditorTextSelectionService — text selection Range creation and restore.
 *
 * The editor owns focus and lifecycle; this service only maps stable logical
 * offsets to DOM text nodes and applies a supplied Selection object.
 */
(function attachEditorTextSelectionService(globalScope) {
  function create({
    documentRef = globalScope.document,
    nodeFilter = globalScope.NodeFilter
  } = {}) {
    const SHOW_TEXT = nodeFilter?.SHOW_TEXT ?? 4;

    function textNodesIn(root) {
      if (!root || typeof documentRef?.createTreeWalker !== 'function') {
        return [];
      }
      const nodes = [];
      const walker = documentRef.createTreeWalker(root, SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
      return nodes;
    }

    function resolveLinePoint(editor, point) {
      const lineIndex = Number(point?.lineIndex);
      if (!Number.isInteger(lineIndex) || lineIndex < 0) return null;

      const line = editor?.children?.[lineIndex];
      if (!line) return null;
      const nodes = textNodesIn(line);
      if (!nodes.length) return null;

      let offset = Math.max(0, Number(point?.charIndex) || 0);
      for (const node of nodes) {
        const length = node.textContent?.length || 0;
        if (offset <= length) return { node, offset };
        offset -= length;
      }

      const last = nodes[nodes.length - 1];
      return { node: last, offset: last.textContent?.length || 0 };
    }

    function resolveAbsolutePoint(editor, absoluteOffset) {
      const nodes = textNodesIn(editor);
      if (!nodes.length) return null;

      let offset = Math.max(0, Number(absoluteOffset) || 0);
      for (const node of nodes) {
        const length = node.textContent?.length || 0;
        if (offset <= length) return { node, offset };
        offset -= length;
      }

      const last = nodes[nodes.length - 1];
      return { node: last, offset: last.textContent?.length || 0 };
    }

    function resolvePoint(editor, point) {
      if (point && typeof point === 'object') {
        if (point.node && Number.isFinite(Number(point.offset))) {
          return {
            node: point.node,
            offset: Math.max(0, Number(point.offset))
          };
        }
        return resolveLinePoint(editor, point);
      }
      return resolveAbsolutePoint(editor, point);
    }

    function createRangeFromEditorOffsets(editor, start, end = start) {
      if (!editor || typeof documentRef?.createRange !== 'function') {
        return null;
      }

      const startPoint = resolvePoint(editor, start);
      const endPoint = resolvePoint(editor, end);
      if (!startPoint || !endPoint) return null;

      const range = documentRef.createRange();
      range.setStart(startPoint.node, startPoint.offset);
      range.setEnd(endPoint.node, endPoint.offset);
      return range;
    }

    function restore(editor, state, selection) {
      if (!state || !editor || !selection) return false;
      const range = createRangeFromEditorOffsets(
        editor,
        state.start,
        state.end
      );
      if (!range) return false;

      selection.removeAllRanges();
      selection.addRange(range);
      editor.focus?.();
      return true;
    }

    return Object.freeze({ createRangeFromEditorOffsets, restore });
  }

  globalScope.EditorTextSelectionService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
