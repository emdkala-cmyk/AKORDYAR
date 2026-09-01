/**
 * ArchiveRenderService
 *
 * Renders the archive empty state, table rows and song cards. Filtering and
 * event delegation stay in ArchiveModule; this service only owns markup.
 */
(function attachArchiveRenderService(globalScope) {
  const FEEL_6_8_LABEL = '2/4 (حس 6/8)';
  const FEEL_6_8_ID = '2/4-feel-6/8';

  function normalizeSignature(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[()[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getDisplayTimeSignature(song) {
    const raw = normalizeSignature(song?.timeSignature);
    const preset = normalizeSignature(song?.timeSignaturePreset);
    if (
      preset === FEEL_6_8_ID ||
      preset === normalizeSignature(FEEL_6_8_LABEL) ||
      raw === FEEL_6_8_ID ||
      raw === normalizeSignature(FEEL_6_8_LABEL) ||
      raw === '2/4 6/8'
    ) {
      return FEEL_6_8_LABEL;
    }
    return String(song?.timeSignature || '');
  }

  const GENRE_LABELS = Object.freeze({
    sad: globalScope.t?.('sad') ?? 'sad',
    happy: globalScope.t?.('happy') ?? 'happy',
    heavy: globalScope.t?.('heavy') ?? 'heavy',
    'heavy-6-8': globalScope.t?.('heavy68') ?? '6/8 سنگین',
    '6/8 سنگین': globalScope.t?.('heavy68') ?? '6/8 سنگین',
    romantic: globalScope.t?.('love') ?? 'love',
    energetic: globalScope.t?.('energetic') ?? 'energetic',
    calm: globalScope.t?.('calm') ?? 'calm',
    epic: globalScope.t?.('epic') ?? 'epic',
    pop: globalScope.t?.('pop') ?? 'pop',
    rock: globalScope.t?.('rock') ?? 'rock',
    jazz: globalScope.t?.('jazz') ?? 'jazz',
    classical: globalScope.t?.('classical') ?? 'classical',
    folk: globalScope.t?.('traditional') ?? 'traditional',
    electronic: globalScope.t?.('electronic') ?? 'electronic',
    hiphop: globalScope.t?.('hipHop') ?? 'هیپ‌هاپ',
    other: globalScope.t?.('other') ?? 'other'
  });

  function create(context = {}) {
    const {
      documentRef = globalScope.document,
      requestFrame = callback =>
        (globalScope.requestAnimationFrame || (cb => globalScope.setTimeout(cb, 0)))(callback),
      escapeHtml = value => String(value ?? ''),
      syncSelectAll = () => {},
      t = key => globalScope.t?.(key) ?? key
    } = context;

    function renderEmpty(list, { query, isTrash, currentTab }) {
      list.innerHTML =
        `<div class="archive-empty"><div class="archive-empty-icon">${isTrash ? '🗑' : '🎵'}</div>${query ? t('noResults') : isTrash ? t('trashEmpty') : currentTab === 'fav' ? t('noFavorites') : t('archiveEmpty')}</div>`;
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
          `<th style="width:36px;"><input type="checkbox" class="arch-select-all-cb archive-card-check" data-action="archSelectAll" aria-label="${t('selectAll')}"></th>`;
      }
      headerHtml +=
        `<th>${t('title')}</th><th>${t('artist')}</th><th>${t('key')}</th><th>BPM</th><th>${t('meter')}</th><th>${t('date')}</th><th>${t('actions')}</th></tr></thead></table>`;

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
          `<td style="font-weight:700;">${escapeHtml(song.title || t('untitled'))}</td><td>${escapeHtml(song.artist || '—')}</td><td style="color:#FFA500;font-weight:700;font-family:JetBrains Mono,monospace;">${keyLabel}</td><td style="color:#FF6BA8;">${song.tempo || song.bpm || '—'}</td><td>${escapeHtml(getDisplayTimeSignature(song) || '—')}</td><td style="font-size:0.72rem;color:var(--text-secondary);">${dateLabel}</td>`;
        bodyHtml +=
          `<td><div class="at-actions"><button data-arch-action="open" data-song-id="${song.id}" title="${t('open')}" aria-label="${t('open')}">▶</button> <button data-arch-action="menu" data-song-id="${song.id}" title="${t('more')}" aria-label="${t('more')}">⋯</button></div></td></tr>`;
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
          tags.push(`<span class="archive-tag archive-tag-sig">${escapeHtml(getDisplayTimeSignature(song))}</span>`);
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
          (song.title || t('untitled')) + ' ' + (song.artist || '')
        );

        let inner = '';
        if (selectMode) {
          inner +=
            `<input type="checkbox" class="archive-card-check" data-action="archToggleSelect" data-song-id="${escapeHtml(song.id)}" ${selectedIds.has(song.id) ? 'checked' : ''} aria-label="انتخاب">`;
        }
        inner +=
          `<div class="archive-card-body"><div class="archive-card-top"><div class="archive-card-title">${escapeHtml(song.title || t('untitled'))}</div></div><div class="archive-card-artist">${escapeHtml(song.artist || '—')}</div>`;
        if (tags.length) inner += `<div class="archive-card-meta">${tags.join('')}</div>`;
        if (dateLabel) {
          inner +=
            `<div class="archive-card-date">${trashed ? t('deletedLabel') : ''}${dateLabel}</div>`;
        }
        inner += '</div><div class="archive-card-actions">';
        inner +=
          `<button data-arch-action="fav" data-song-id="${song.id}" class="btn-fav ${song.favorite ? 'is-fav' : ''}" title="${song.favorite ? t('removeFavorite') : t('addFavorite')}" aria-label="${t('favorite')}" type="button">${song.favorite ? '⭐' : '☆'}</button>`;
        if (trashed) {
          inner +=
            `<button data-arch-action="restore" data-song-id="${song.id}" class="btn-load" title="${t('restore')}" aria-label="${t('restore')}" type="button">♻️</button>`;
          inner +=
            `<button data-arch-action="permanent-delete" data-song-id="${song.id}" class="btn-del" title="${t('permanentDelete')}" aria-label="${t('permanentDelete')}" type="button">✕</button>`;
        } else {
          inner +=
            `<button data-arch-action="open" data-song-id="${song.id}" class="btn-load"title="${t('open')}" aria-label="${t('open')}" type="button">▶</button>`;
          inner +=
            `<button data-arch-action="menu" data-song-id="${song.id}" class="btn-menu" title="${t('more')}" aria-label="${t('more')}" type="button">⋯</button>`;
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
