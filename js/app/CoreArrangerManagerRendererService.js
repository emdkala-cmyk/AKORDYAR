/*
 * CoreArrangerManagerRendererService
 *
 * Renders arranger playlist cards without owning arranger state.
 */
(function attachCoreArrangerManagerRendererService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getArrangers = () => [],
    getEditingArr = () => null,
    setArrangers = () => {},
    setEditingArr = () => {},
    openArrEditor = () => {},
    saveArrangers = () => {},
    exportArranger = () => {},
    confirmRef = () => false,
    translate = key => key,
    t = key => globalScope.t?.(key) ?? key,
    toast = () => {}
  } = {}) {
    function render() {
      const box = getElement?.('arrManager');
      if (!box) return;
      const arrangers = getArrangers?.() || [];
      box.innerHTML = '';

      const header = documentRef.createElement('div');
      header.className = 'arr-manager-header';
      header.innerHTML = `
        <div style="display:flex;align-items:center;">
          <h4>📋 پلی‌لیست‌های ذخیره‌شده</h4>
          <span class="arr-count-badge">${arrangers.length}</span>
        </div>
      `;
      box.appendChild(header);

      const toolbar = documentRef.createElement('div');
      toolbar.className = 'arr-manager-toolbar';
      toolbar.innerHTML = `
        <button class="arr-btn-new" data-action="createNewArranger" title="${t('createPlaylist')}">
          ＋ پلی‌لیست جدید
        </button>
        <div style="display:flex;gap:6px;">
          <button class="arr-btn-import" data-action="importArrangerFromFile" title="${t('importPlaylistJson')}">
            📥 ورود یک پلی‌لیست
          </button>
          <button class="arr-btn-import" data-action="importAllPlaylistsFromFile" title="${t('importAllPlaylists')}">
            📥 ورود کامل پلی‌لیست‌ها
          </button>
          <button class="arr-btn-import" data-action="exportAllPlaylistsToFile" title="${t('exportAllPlaylists')}" ${arrangers.length === 0 ? 'disabled' : ''}>
            📤 خروجی کامل پلی‌لیست‌ها
          </button>
        </div>
      `;
      box.appendChild(toolbar);

      if (!arrangers.length) {
        const empty = documentRef.createElement('div');
        empty.className = 'arr-empty-state';
        empty.innerHTML = `
          <div class="arr-empty-icon">🎼</div>
          <div class="arr-empty-text">هنوز پلی‌لیستی نساخته‌اید.<br>روی «پلی‌لیست جدید» بزنید تا اولین پلی‌لیست رو بسازید.</div>
        `;
        box.appendChild(empty);
        return;
      }

      arrangers.forEach(arr => {
        const editingArr = getEditingArr?.();
        const isActive = editingArr && editingArr.id === arr.id;
        const card = documentRef.createElement('div');
        card.className = 'arr-card' + (isActive ? ' arr-card-active' : '');

        const badges = [];
        if (arr.crossfade) {
          badges.push(
            `<span class="arr-badge badge-crossfade">🔄 کراس‌فید: ${arr.crossfade}s</span>`
          );
        }
        if (arr.pauseBetween) {
          badges.push(
            '<span class="arr-badge badge-pause">⏸ توقف بین آهنگ‌ها</span>'
          );
        }

        card.innerHTML = `
          <div class="meta">
            <b>${arr.name || translate('untitled')}</b>
            <span>${arr.items.length} ${translate('songN')}</span>
            ${badges.length ? `<div class="arr-card-badges">${badges.join('')}</div>` : ''}
          </div>
          <div class="acts">
            <button data-a="edit" title="${t('edit')}">✏️ ویرایش</button>
            <button data-a="export" class="act-export" title="${t('exportToFile')}">📤</button>
            <button data-a="del" class="act-del" title="${t('delete')}">🗑</button>
          </div>
        `;

        card.onclick = event => {
          const action = event.target.dataset.a;
          if (!action) {
            setEditingArr(arr);
            openArrEditor();
            return;
          }
          if (action === 'del') {
            if (
              !confirmRef(
                `حذف پلی‌لیست «${arr.name || translate('untitled')}»؟`
              )
            ) {
              return;
            }
            setArrangers(arrangers.filter(item => item.id !== arr.id));
            saveArrangers();
            const currentEditingArr = getEditingArr?.();
            if (currentEditingArr && currentEditingArr.id === arr.id) {
              setEditingArr(null);
              const editor = getElement?.('arrEditor');
              if (editor) editor.style.display = 'none';
            }
            render();
            toast('🗑 پلی‌لیست حذف شد');
          } else if (action === 'edit') {
            setEditingArr(arr);
            openArrEditor();
          } else if (action === 'export') {
            exportArranger(arr);
          }
        };
        box.appendChild(card);
      });
    }

    return Object.freeze({ render });
  }

  const service = Object.freeze({ create });
  globalScope.CoreArrangerManagerRendererService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
