/**
 * EditorCustomPromptService
 *
 * Provides the Electron-safe prompt modal with a browser prompt fallback.
 */
(function attachEditorCustomPromptService(globalScope) {
  function create(context = {}) {
    const {
      documentRef = globalScope.document,
      windowRef = globalScope,
      schedule = globalScope.setTimeout
    } = context;

    function prompt(message, defaultValue = '') {
      return new Promise(resolve => {
        const modal = documentRef.getElementById('customPromptModal');
        const title = documentRef.getElementById('customPromptTitle');
        const input = documentRef.getElementById('customPromptInput');
        const ok = documentRef.getElementById('customPromptOk');
        const cancel = documentRef.getElementById('customPromptCancel');

        if (!modal || !input || !ok || !cancel) {
          resolve(windowRef.prompt(message, defaultValue));
          return;
        }

        if (title) title.textContent = message;
        input.value = defaultValue;
        modal.style.display = 'flex';
        schedule(() => {
          input.focus();
          input.select();
        }, 50);

        const cleanup = () => {
          modal.style.display = 'none';
          ok.onclick = null;
          cancel.onclick = null;
          input.onkeydown = null;
        };

        ok.onclick = () => {
          const value = input.value;
          cleanup();
          resolve(value);
        };
        cancel.onclick = () => {
          cleanup();
          resolve(null);
        };
        input.onkeydown = event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            ok.click();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel.click();
          }
        };
      });
    }

    return Object.freeze({ prompt });
  }

  const service = Object.freeze({ create });
  globalScope.EditorCustomPromptService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
