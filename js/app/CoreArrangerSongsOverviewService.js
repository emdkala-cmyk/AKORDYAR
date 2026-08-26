/*
 * CoreArrangerSongsOverviewService
 *
 * Renders the arranger songs overview without owning arranger state.
 */
(function attachCoreArrangerSongsOverviewService(globalScope) {
  'use strict';

  function create({
    getElement = id => globalScope.document?.getElementById?.(id),
    getEditingArr = () => null,
    getAllSongs = () => [],
    getItemSetting = () => ({ transpose: 0, notes: '' })
  } = {}) {
    function render() {
      const box = getElement?.('arrSongsList');
      const editingArr = getEditingArr?.();
      if (!box) return;
      if (!editingArr || !editingArr.items.length) {
        box.innerHTML =
          '<div style="text-align:center;padding:30px;color:var(--text-secondary);">ترانه‌ای در این ارنجر وجود ندارد</div>';
        return;
      }

      const allSongs = getAllSongs?.() || [];
      let html = '';
      editingArr.items.forEach((songId, index) => {
        const song = allSongs.find(item => item.id === songId);
        if (!song) return;
        const setting = getItemSetting(editingArr, songId);
        const key = song.key || '';
        const rhythm = song.rhythm || '';
        const transpose = setting.transpose
          ? setting.transpose > 0
            ? '+' + setting.transpose
            : setting.transpose
          : '0';
        html += `<div class="arr-song-card">
          <div class="song-header">
            <div class="song-num">${index + 1}</div>
            <div class="song-title">${song.title || 'بدون عنوان'}</div>
          </div>
          <div class="song-meta">
            ${song.artist ? '<span>🎤 ' + song.artist + '</span>' : ''}
            ${key ? '<span>🎵 گام: ' + key + '</span>' : ''}
            ${rhythm ? '<span>🥁 ریتم: ' + rhythm + '</span>' : ''}
            <span>♯ تغییر گام: ${transpose}</span>
          </div>
          ${
            setting.notes
              ? '<div style="margin-top:6px;font-size:0.8rem;color:var(--accent-cyan-glow);">📝 ' +
                setting.notes +
                '</div>'
              : ''
          }
        </div>`;
      });
      box.innerHTML = html;
    }

    return Object.freeze({ render });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerSongsOverviewService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
