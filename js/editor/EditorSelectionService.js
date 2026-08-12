/**
 * EditorSelectionService — selection state and DOM projection for editor chords.
 *
 * The legacy editor remains the owner of the selected-index array. This
 * service centralizes mutations and keeps the visual chord selection in sync.
 */
(function attachEditorSelectionService(globalScope) {
  function create({
    getSelected = () => [],
    setSelected = () => {},
    queryChordElements = () => [],
    getChordIndex = element => Number.parseInt(element?.dataset?.idx, 10)
  } = {}) {
    function syncDom(selected) {
      const selectedSet = new Set(selected);
      for (const element of queryChordElements() || []) {
        const index = getChordIndex(element);
        element.classList?.toggle('selected', selectedSet.has(index));
      }
    }

    function clear() {
      const next = [];
      setSelected(next);
      syncDom(next);
      return next;
    }

    function select(index, withToggle = false) {
      const current = Array.isArray(getSelected()) ? [...getSelected()] : [];
      let next;

      if (withToggle) {
        const position = current.indexOf(index);
        if (position >= 0) {
          current.splice(position, 1);
        } else {
          current.push(index);
        }
        next = current;
      } else {
        next = [index];
      }

      setSelected(next);
      syncDom(next);
      return next;
    }

    function set(indices) {
      const next = Array.isArray(indices) ? [...indices] : [];
      setSelected(next);
      syncDom(next);
      return next;
    }

    return Object.freeze({ clear, select, set, syncDom });
  }

  globalScope.EditorSelectionService = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
