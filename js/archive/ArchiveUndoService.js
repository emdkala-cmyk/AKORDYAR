/**
 * ArchiveUndoService
 *
 * Keeps archive snapshots behind a small injectable boundary. The service
 * intentionally preserves the existing archive behavior: snapshots are deep
 * cloned, newest entries are appended, and the stack is capped at 30 items.
 */
(function attachArchiveUndoService(globalScope) {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function create({
    getSongs,
    maxEntries = 30,
    cloneSnapshot = clone,
    getNow = () => Date.now()
  } = {}) {
    if (typeof getSongs !== 'function') {
      throw new TypeError('ArchiveUndoService requires getSongs');
    }

    const stack = [];

    function push(description) {
      stack.push({
        snapshot: cloneSnapshot(getSongs()),
        desc: description,
        time: getNow()
      });
      if (stack.length > maxEntries) stack.shift();
    }

    return Object.freeze({
      push,
      getStack: () => stack.slice()
    });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveUndoService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
