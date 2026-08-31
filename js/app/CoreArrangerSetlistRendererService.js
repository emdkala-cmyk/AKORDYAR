/*
 * CoreArrangerSetlistRendererService
 *
 * Renders and mutates arranger setlist items without owning arranger state.
 */
(function attachCoreArrangerSetlistRendererService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getEditingArr = () => null,
    getAllSongs = () => [],
    getSearchQuery = () => '',
    ensureArrItem = () => ({}),
    saveArrangers = () => {},
    openArrSongNote = () => {},
    translate = key => key,
    t = key => globalScope.t?.(key) ?? key
  } = {}) {
    let dragIndex = null;

    function render() {
      const box = getElement?.('arrSetlist');
      const editingArr = getEditingArr?.();
      if (!box || !editingArr) return;
      box.innerHTML = '';
      if (!editingArr.items.length) {
        box.innerHTML =
          `<div style="padding:14px;color:var(--text-secondary);font-size:13px;">${translate('addFromLeft')}</div>`;
        return;
      }

      const allSongs = getAllSongs?.() || [];
      const query = String(getSearchQuery?.() || '').trim().toLowerCase();
      editingArr.items.forEach((id, index) => {
        const song = allSongs.find(item => item.id === id);
        if (!song) return;
        if (query) {
          const matchText = (
            (song.title || '') + ' ' +
            (song.artist || '') + ' ' +
            (song.key || '') + ' ' +
            (song.genre || '')
          ).toLowerCase();
          if (!matchText.includes(query)) return;
        }

        const setting = ensureArrItem(editingArr, index);
        const transpose = setting.transpose || 0;
        const transposeLabel =
          transpose > 0 ? '+' + transpose : String(transpose);
        const hasNotes = !!(setting.notes && setting.notes.trim());
        const element = documentRef.createElement('div');
        element.className = 'arr-item';
        element.draggable = true;
        element.dataset.i = index;
        element.innerHTML = `
          <div class="arr-item-controls">
            <button data-a="up" title="${t('moveUp')}">↑</button>
            <button data-a="down" title="${t('moveDown')}">↓</button>
            <span class="arr-item-number">${index + 1}</span>
          </div>
          <div class="arr-item-info" draggable="true">
            <span class="ai-title">${song.title || translate('untitled')}</span>
            <small>${song.artist || '—'}</small>
          </div>
          <div class="ai-ctrls">
            <button class="ai-trans-btn" data-a="trans-down" title="${t('flat')}">♭</button>
            <span class="ai-trans-val">${transposeLabel}</span>
            <button class="ai-trans-btn" data-a="trans-up" title="${t('sharp')}">♯</button>
            <button class="ai-notes-btn ${hasNotes ? 'has-notes' : ''}" data-a="notes" title="${t('performanceNote')}">📝</button>
            <button data-a="del" title="${t('delete')}">✕</button>
          </div>`;

        element.onclick = event => {
          const button = event.target.closest?.('[data-a]');
          if (!button) return;
          const action = button.dataset.a;
          if (action === 'up' && index > 0) {
            [editingArr.items[index - 1], editingArr.items[index]] = [
              editingArr.items[index],
              editingArr.items[index - 1]
            ];
          } else if (
            action === 'down' &&
            index < editingArr.items.length - 1
          ) {
            [editingArr.items[index + 1], editingArr.items[index]] = [
              editingArr.items[index],
              editingArr.items[index + 1]
            ];
          } else if (action === 'del') {
            editingArr.items.splice(index, 1);
          } else if (action === 'trans-up') {
            setting.transpose = (setting.transpose || 0) + 1;
          } else if (action === 'trans-down') {
            setting.transpose = (setting.transpose || 0) - 1;
          } else if (action === 'notes') {
            openArrSongNote(index);
            return;
          } else {
            return;
          }
          saveArrangers();
          render();
        };

        element.addEventListener('dragstart', () => {
          dragIndex = index;
          element.style.opacity = '.4';
        });
        element.addEventListener('dragover', event => {
          event.preventDefault();
          element.classList.add('dragover');
        });
        element.addEventListener('dragleave', () => {
          element.classList.remove('dragover');
        });
        element.addEventListener('drop', event => {
          event.preventDefault();
          element.classList.remove('dragover');
          if (dragIndex === null || dragIndex === index) return;
          const moved = editingArr.items.splice(dragIndex, 1)[0];
          editingArr.items.splice(index, 0, moved);
          saveArrangers();
          render();
          dragIndex = null;
        });
        element.addEventListener('dragend', () => {
          element.style.opacity = '';
        });
        box.appendChild(element);
      });
    }

    return Object.freeze({ render });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerSetlistRendererService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
