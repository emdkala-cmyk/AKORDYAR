/**
 * ArchiveConfirmService
 *
 * Owns the archive confirmation overlay state while keeping the existing
 * DOM contract and the global `archConfirm`/`archConfirmResolve` bridge intact.
 */
(function attachArchiveConfirmService(globalScope) {
  function create({ getElement, t = globalScope.t || (k => k) } = {}) {
    const resolveElement = getElement || (id => {
      if (typeof globalScope.$ === 'function') return globalScope.$(id);
      return globalScope.document?.getElementById(id);
    });
    let pendingResolver = null;

    function open(title, message, okLabel, dangerMode) {
      return new Promise(resolve => {
        pendingResolver = resolve;
        resolveElement('archConfirmTitle').textContent = title;
        resolveElement('archConfirmMsg').innerHTML = message;
        const okButton = resolveElement('archConfirmOk');
        okButton.textContent = okLabel || t('confirmBtn');
        okButton.className = dangerMode ? 'confirm-danger' : 'confirm-ok';
        resolveElement('archiveConfirmOverlay').classList.add('show');
      });
    }

    function close(value) {
      resolveElement('archiveConfirmOverlay').classList.remove('show');
      if (pendingResolver) {
        const resolver = pendingResolver;
        pendingResolver = null;
        resolver(value);
      }
    }

    return Object.freeze({ open, close });
  }

  const service = Object.freeze({ create });
  globalScope.ArchiveConfirmService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
