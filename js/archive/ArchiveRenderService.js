/**
 * ArchiveRenderService
 *
 * Renders the archive empty state, table rows and song cards. Filtering and
 * event delegation stay in ArchiveModule; this service only owns markup.
 */
(function attachArchiveRenderService(globalScope) {
  const GENRE_LABELS = Object.freeze({
    sad: 'غمگین',
    happy: 'شاد',
    heavy: 'سنگین',
    romantic: 'عاشقانه',
    energetic: 'انرژیک',
    calm: 'آرام',
    epic: 'حماسی',
    pop: 'پاپ',
    rock: 'راک',
    jazz: 'جاز',
    classical: 'کلاسیک',
    folk: 'سنتی',
    electronic: 'الکترونیک',
    hiphop: 'هیپ‌هاپ',
    other: 'سایر'
  });

  function create(context = {}) {
    const {
      documentRef = globalScope.document,
      requestFrame = callback =>
        (globalScope.requestAnimationFrame || (cb => globalScope.setTimeout(cb, 0)))(callback),
      escapeHtml = value => String(value ?? ''),
      syncSelectAll = () => {}
    } = context;

    function renderEmpty(list, { query, isTrash, currentTab }) {
      list.innerHTML =
        `<div class="archive-empty"><div class="archive-empty-icon">${isTrash ? '🗑' : '🎵'}</div>${query ? 'نتیجه‌ای یافت نشد' : isTrash ? 'سطل زباله خالی است' : currentTab === 'fav' ? 'ترانه‌ای در علاقه‌مندی نیست' : 'آرشیو خالی است'}</div>`;
    }

    function renderTable(list, songs, options) {
      const {
        selectMode,
        selectedIds,
        activeId
      } = options;
      let headerHtml = '<table class="archive-table archive-table-header"><thead><tr>';
      if (selectMode) {
        headerHtml +=
          '<th style="width:36px;"><input type="checkbox" class="arch-select-all-cb archive-card-check" data-action="archSelectAll" aria-label="انتخاب همه"></th>';
      }
      headerHtml +=
        '<th>عنوان</th><th>خواننده</th><th>گام</th><th>BPM</th><th>میزان</th><th>تاریخ</th><th>عملیات</th></tr></thead></table>';

      let bodyHtml =
        '<div class="archive-table-body"><table class="archive-table archive-table-body-inner"><tbody>';
      for (const song of songs) {
        const keyLabel = song.key
          ? song.key + ((song.keyMode || 'maj') === 'min' ? 'm' : '')
          : '—';
        const dateLabel = song.updatedAt
          ? new Date(song.updatedAt).toLocaleDateString('fa-IR')
          : '—';
        const selected = selectedIds.has(song.id);
        bodyHtml +=
          `<tr class="${song.id === activeId ? 'active-load' : ''} ${selected ? 'selected-row' : ''}" data-song-id="${song.id}" tabindex="0">`;
        if (selectMode) {
          bodyHtml +=
            `<td style="width:36px;"><input type="checkbox" class="archive-card-check" data-action="archToggleSelect" data-song-id="${escapeHtml(song.id)}" ${selected ? 'checked' : ''} aria-label="انتخاب"></td>`;
        }
        bodyHtml +=
          `<td style="font-weight:700;">${escapeHtml(song.title || 'بدون نام')}</td><td>${escapeHtml(song.artist || '—')}</td><td style="color:#FFA500;font-weight:700;font-family:JetBrains Mono,monospace;">${keyLabel}</td><td style="color:#FF6BA8;">${song.tempo || song.bpm || '—'}</td><td>${song.timeSignature || '—'}</td><td style="font-size:0.72rem;color:var(--text-secondary);">${dateLabel}</td>`;
        bodyHtml +=
          `<td><div class="at-actions"><button data-arch-action="open" data-song-id="${song.id}" title="بازکردن" aria-label="بازکردن">▶</button> <button data-arch-action="menu" data-song-id="${song.id}" title="بیشتر" aria-label="بیشتر">⋯</button></div></td></tr>`;
      }
      bodyHtml += '</tbody></table></div>';
      list.innerHTML = headerHtml + bodyHtml;
      requestFrame(syncSelectAll);
    }

    function renderCards(list, songs, options) {
      const {
        selectMode,
        selectedIds,
        activeId
      } = options;
      for (const song of songs) {
        const tags = [];
        if (song.timeSignature) {
          tags.push(`<span class="archive-tag archive-tag-sig">${song.timeSignature}</span>`);
        }
        if (song.tempo || song.bpm) {
          tags.push(
            `<span class="archive-tag archive-tag-tempo">${song.tempo || song.bpm} BPM</span>`
          );
        }
        if (song.key) {
          const keyLabel = song.key + ((song.keyMode || 'maj') === 'min' ? 'm' : '');
          tags.push(`<span class="archive-tag archive-tag-key">${keyLabel}</span>`);
        }
        if (song.genre && GENRE_LABELS[song.genre]) {
          tags.push(
            `<span class="archive-tag archive-tag-genre">${GENRE_LABELS[song.genre]}</span>`
          );
        }
        if (song.categories?.length) {
          song.categories.forEach(category => {
            tags.push(
              `<span class="archive-tag archive-tag-cat">${escapeHtml(category)}</span>`
            );
          });
        }

        const dateLabel = song.updatedAt
          ? new Date(song.updatedAt).toLocaleDateString('fa-IR')
          : '';
        const trashed = !!song.deletedAt;
        const card = documentRef.createElement('div');
        card.className =
          'archive-card' +
          (song.id === activeId ? ' active-load' : '') +
          (song.favorite ? ' fav-card' : '');
        card.dataset.songId = song.id;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute(
          'aria-label',
          (song.title || 'بدون نام') + ' ' + (song.artist || '')
        );

        let inner = '';
        if (selectMode) {
          inner +=
            `<input type="checkbox" class="archive-card-check" data-action="archToggleSelect" data-song-id="${escapeHtml(song.id)}" ${selectedIds.has(song.id) ? 'checked' : ''} aria-label="انتخاب">`;
        }
        inner +=
          `<div class="archive-card-body"><div class="archive-card-top"><div class="archive-card-title">${escapeHtml(song.title || 'بدون نام')}</div></div><div class="archive-card-artist">${escapeHtml(song.artist || '—')}</div>`;
        if (tags.length) inner += `<div class="archive-card-meta">${tags.join('')}</div>`;
        if (dateLabel) {
          inner +=
            `<div class="archive-card-date">${trashed ? 'حذف شده: ' : ''}${dateLabel}</div>`;
        }
        inner += '</div><div class="archive-card-actions">';
        inner +=
          `<button data-arch-action="fav" data-song-id="${song.id}" class="btn-fav ${song.favorite ? 'is-fav' : ''}" title="${song.favorite ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}" aria-label="علاقه‌مندی" type="button">${song.favorite ? '⭐' : '☆'}</button>`;
        if (trashed) {
          inner +=
            `<button data-arch-action="restore" data-song-id="${song.id}" class="btn-load" title="بازیابی" aria-label="بازیابی" type="button">♻️</button>`;
          inner +=
            `<button data-arch-action="permanent-delete" data-song-id="${song.id}" class="btn-del" title="حذف دائمی" aria-label="حذف دائمی" type="button">✕</button>`;
        } else {
          inner +=
            `<button data-arch-action="open" data-song-id="${song.id}" class="btn-load" title="بازکردن" aria-label="بازکردن" type="button">▶</button>`;
          inner +=
            `<button data-arch-action="menu" data-song-id="${song.id}" class="btn-menu" title="بیشتر" aria-label="بیشتر" type="button">⋯</button>`;
        }
        inner += '</div>';
        card.innerHTML = inner;
        list.appendChild(card);
      }
      requestFrame(syncSelectAll);
    }

    function render(list, songs, options = {}) {
      if (options.viewMode === 'table') {
        renderTable(list, songs, options);
      } else {
        renderCards(list, songs, options);
      }
    }

    return Object.freeze({ renderEmpty, renderTable, renderCards, render });
  }

  const service = Object.freeze({ create, genreLabels: GENRE_LABELS });
  globalScope.ArchiveRenderService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
