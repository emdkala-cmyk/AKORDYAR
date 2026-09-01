/**
 * EditorAutoImportUiService
 *
 * Keeps auto-import progress and modal-only DOM mutations out of editor.js.
 * Network, parsing, archive and file-system workflows remain in the editor.
 */
(function attachEditorAutoImportUiService(globalScope) {
  function create({
    getElement = id => globalScope.document?.getElementById(id)
  } = {}) {
    function updateProgress(current, total, detail) {
      const percent =
        total > 0 ? Math.round((current / total) * 100) : 0;
      const fill = getElement('autoProgressFill');
      const label = getElement('autoProgressLabel');
      const percentElement = getElement('autoProgressPct');
      const detailElement = getElement('autoProgressDetail');
      if (fill) fill.style.width = percent + '%';
      if (label) label.textContent = `${current} / ${total}`;
      if (percentElement) percentElement.textContent = percent + '%';
      if (detailElement && detail) detailElement.innerHTML = detail;
    }

    function showProgress() {
      getElement('autoProgressBar')?.classList.add('show');
    }

    function hideProgress() {
      getElement('autoProgressBar')?.classList.remove('show');
    }

    function open() {
      getElement('autoImportModal')?.classList.add('show');
      const status = getElement('autoImportStatus');
      const results = getElement('autoImportResults');
      const done = getElement('autoImportDone');
      const form = getElement('autoImportForm');
      const footer = getElement('autoImportFooter');
      const button = getElement('autoImportBtn');
      const tags = getElement('autoArtistTags');
      if (status) status.style.display = 'none';
      if (results) results.innerHTML = '';
      if (done) done.style.display = 'none';
      if (form) form.style.display = 'block';
      if (footer) footer.style.display = 'flex';
      if (button) button.disabled = false;
      if (tags) tags.innerHTML = '';
      hideProgress();
    }

    function close() {
      getElement('autoImportModal')?.classList.remove('show');
    }

    function resetRequest() {
      const status = getElement('autoImportStatus');
      const results = getElement('autoImportResults');
      const done = getElement('autoImportDone');
      const summary = getElement('autoImportSummary');
      const folder = getElement('autoImportFolderInput');
      const form = getElement('autoImportForm');
      const footer = getElement('autoImportFooter');
      const button = getElement('autoImportBtn');
      if (status) status.style.display = 'none';
      if (results) results.innerHTML = '';
      if (done) done.style.display = 'none';
      if (summary) summary.textContent = '';
      if (folder) folder.style.display = 'none';
      if (form) form.style.display = 'block';
      if (footer) footer.style.display = 'flex';
      if (button) {
        button.disabled = false;
        button.textContent = '🚀 شروع ورودی اتومات';
      }
      hideProgress();
    }

    return Object.freeze({
      updateProgress,
      showProgress,
      hideProgress,
      open,
      close,
      resetRequest
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorAutoImportUiService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
