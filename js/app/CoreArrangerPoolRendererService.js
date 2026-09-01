/*
 * CoreArrangerPoolRendererService
 *
 * Renders available arranger songs and handles adding a song to the setlist.
 */
(function attachCoreArrangerPoolRendererService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getEditingArr = () => null,
    getAllSongs = () => [],
    getSearchQuery = () => '',
    saveArrangers = () => {},
    renderArrSetlist = () => {},
    translate = key => key
  } = {}) {
    function render() {
      const box = getElement?.('arrPool');
      const editingArr = getEditingArr?.();
      if (!box || !editingArr) return;
      box.innerHTML = '';

      const allSongs = getAllSongs?.() || [];
      const inList = new Set(editingArr.items || []);
      let available = allSongs.filter(song => !inList.has(song.id));
      const query = String(getSearchQuery?.() || '').trim().toLowerCase();

      if (query) {
        available = available.filter(song => {
          const matchText =
            (song.title || '') +
            ' ' +
            (song.artist || '') +
            ' ' +
            (song.key || '') +
            ' ' +
            (song.genre || '');
          return matchText.toLowerCase().includes(query);
        });
      }

      if (!available.length) {
        box.innerHTML =
          `<div style="padding:14px;color:var(--text-secondary);font-size:13px;">${
            query ? 'نتیجه‌ای یافت نشد' : translate('allInSetlist')
          }</div>`;
        return;
      }

      available.forEach(song => {
        const item = documentRef.createElement('div');
        item.className = 'arr-item';
        item.innerHTML =
          `<span class="ai-title">${song.title || translate('untitled')}` +
          `<small>${song.artist || '—'}</small></span><button>＋</button>`;
        item.onclick = () => {
          const currentEditingArr = getEditingArr?.();
          if (!currentEditingArr) return;
          currentEditingArr.items.push(song.id);
          saveArrangers?.();
          render();
          renderArrSetlist?.();
        };
        box.appendChild(item);
      });
    }

    return Object.freeze({ render });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerPoolRendererService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
