// ===== Quick Search Panel Functions =====
const quickSearchArchiveApi = () => window.AkordyarArchiveApi || {};
const quickSearchArchiveCall = (name, ...args) => {
  const fn = quickSearchArchiveApi()[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
};
const QUICK_SEARCH_GENRE_LABELS = Object.freeze({
  'heavy-6-8': '6/8 سنگین'
});

function getQuickSearchGenreIdentity(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === '6/8 سنگین' ? 'heavy-6-8' : raw;
}

function getQuickSearchGenreText(value) {
  const raw = String(value || '').trim().toLowerCase();
  return `${raw} ${QUICK_SEARCH_GENRE_LABELS[raw] || raw}`.trim();
}

function normalizeQuickSearchSignature(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQuickSearchSignatureValues(value) {
  const normalized = normalizeQuickSearchSignature(value);
  if (!/^\d+\s*\/\s*\d+(?:\s+.+)?$/.test(normalized)) return [];
  const numericParts = normalized.match(/\d+\s*\/\s*\d+/g) || [];
  return [...new Set([
    normalized,
    numericParts.join(' ')
  ].filter(Boolean))];
}

function getQuickSearchSignatureIdentity(valueOrSong) {
  const isSong = valueOrSong && typeof valueOrSong === 'object';
  const raw = normalizeQuickSearchSignature(
    isSong ? valueOrSong.timeSignature : valueOrSong
  );
  const preset = isSong
    ? normalizeQuickSearchSignature(valueOrSong.timeSignaturePreset)
    : '';
  if (
    preset === '2/4-feel-6/8' ||
    preset === normalizeQuickSearchSignature('2/4 (حس 6/8)') ||
    raw === '2/4-feel-6/8' ||
    raw === normalizeQuickSearchSignature('2/4 (حس 6/8)') ||
    raw === '2/4 6/8'
  ) {
    return '2/4-feel-6/8';
  }
  return raw || '4/4';
}

function getQuickSearchSignatureQueryIdentity(value) {
  const normalized = normalizeQuickSearchSignature(value);
  if (!normalized) return null;
  if (
    normalized === '2/4-feel-6/8' ||
    normalized === normalizeQuickSearchSignature('2/4 (حس 6/8)') ||
    normalized === '2/4 6/8'
  ) {
    return '2/4-feel-6/8';
  }
  return /^\d+\s*\/\s*\d+$/.test(normalized) ? normalized : null;
}

function matchesQuickSearchSignature(song, query) {
  const queryIdentity = getQuickSearchSignatureQueryIdentity(query);
  if (!queryIdentity) return null;
  return getQuickSearchSignatureIdentity(song) === queryIdentity;
}

let _quickSearchDragging = false;
let _quickSearchDragOffset = { x: 0, y: 0 };
let _quickSearchPointerId = null;

function openQuickSearchPanel() {
  const panel = document.getElementById('quickSearchPanel');
  if (!panel) return;
  
  // Show panel
  panel.style.display = 'flex';
  // Force reflow
  panel.offsetHeight;
  panel.classList.add('show');
  
  // Focus input
  setTimeout(() => {
    const input = document.getElementById('quickSearchInput');
    if (input) input.focus();
  }, 50);
  
  // Render initial list
  quickSearchFilter();
  
  // Setup drag functionality
  setupQuickSearchDrag();
}

function closeQuickSearchPanel() {
  const panel = document.getElementById('quickSearchPanel');
  if (!panel) return;
  panel.classList.remove('show');
  setTimeout(() => {
    panel.style.display = 'none';
  }, 150);
}

function setupQuickSearchDrag() {
  const header = document.getElementById('quickSearchHeader');
  const panel = document.getElementById('quickSearchPanel');
  if (!header || !panel) return;

  if (header.dataset.dragBound === 'true') return;
  header.dataset.dragBound = 'true';
  header.style.touchAction = 'none';

  const stopQuickSearchDrag = () => {
    _quickSearchDragging = false;
    _quickSearchPointerId = null;
    panel.style.transition = '';
  };

  header.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.qsp-close')) return;
    if (e.button !== 0) return;
    _quickSearchDragging = true;
    _quickSearchPointerId = e.pointerId;
    const rect = panel.getBoundingClientRect();
    _quickSearchDragOffset.x = e.clientX - rect.left;
    _quickSearchDragOffset.y = e.clientY - rect.top;
    panel.style.transition = 'none';
    header.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });

  header.addEventListener('pointermove', (e) => {
    if (!_quickSearchDragging || e.pointerId !== _quickSearchPointerId) return;
    const x = e.clientX - _quickSearchDragOffset.x;
    const y = e.clientY - _quickSearchDragOffset.y;

    // Boundary checks
    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;

    panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    panel.style.right = 'auto';
  });

  header.addEventListener('pointerup', (e) => {
    if (e.pointerId !== _quickSearchPointerId) return;
    header.releasePointerCapture?.(e.pointerId);
    stopQuickSearchDrag();
  });
  header.addEventListener('pointercancel', stopQuickSearchDrag);
}

function quickSearchFilter() {
  const input = document.getElementById('quickSearchInput');
  const list = document.getElementById('quickSearchList');
  const clearBtn = document.getElementById('quickSearchClear');
  if (!input || !list) return;
  
  const query = input.value.trim().toLowerCase();
  
  // Show/hide clear button
  if (clearBtn) {
    clearBtn.style.display = query ? 'block' : 'none';
  }
  
  // Get filter values
  const sig = document.getElementById('qspFilterSig')?.value || '';
  const genre = document.getElementById('qspFilterGenre')?.value || '';
  const tempoRange = document.getElementById('qspFilterTempo')?.value || '';
  const keyFilter = document.getElementById('qspFilterKey')?.value || '';
  
  const songs = (quickSearchArchiveCall('getAllSongs') || [])
    .filter(s => !s.deletedAt);
  
  if (!query && !sig && !genre && !tempoRange && !keyFilter) {
    // Show recent/opened songs or all
    const recent = [...songs].sort((a, b) => {
      const aTime = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
      const bTime = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
      return bTime - aTime;
    }).slice(0, 20);
    
    renderQuickSearchList(recent, list);
    return;
  }
  
  // Filter songs
  const filtered = songs.filter(s => {
    // Text search
    if (query) {
      const signatureQueryMatch = matchesQuickSearchSignature(s, query);
      if (signatureQueryMatch === false) return false;
      if (signatureQueryMatch !== true) {
        const title = (s.title || '').toLowerCase();
        const artist = (s.artist || '').toLowerCase();
        const rawText = (s.rawText || '').toLowerCase();
        const genre = getQuickSearchGenreText(s.genre);
        const timeSignature = String(s.timeSignature || '').toLowerCase();
        const signatureParts = timeSignature.match(/\d+\s*\/\s*\d+/g) || [];
        const signatureSearch = [
          timeSignature,
          ...signatureParts,
          signatureParts.join(' ')
        ].join(' ');
        if (
          !title.includes(query) &&
          !artist.includes(query) &&
          !rawText.includes(query) &&
          !genre.includes(query) &&
          !signatureSearch.includes(query)
        ) return false;
      }
    }
    // Signature filter
    if (
      sig &&
      getQuickSearchSignatureIdentity(s) !==
        getQuickSearchSignatureQueryIdentity(sig)
    ) return false;
    // Genre filter
    if (
      genre &&
      getQuickSearchGenreIdentity(s.genre) !== getQuickSearchGenreIdentity(genre)
    ) return false;
    // Key filter
    if (keyFilter === '_maj' && s.keyMode !== 'maj') return false;
    else if (keyFilter === '_min' && s.keyMode !== 'min') return false;
    else if (keyFilter && keyFilter !== '_maj' && keyFilter !== '_min' && s.key !== keyFilter) return false;
    // Tempo filter
    if (tempoRange) {
      const bpm = s.tempo || s.bpm || 120;
      if (tempoRange === 'slow' && bpm > 80) return false;
      if (tempoRange === 'mid' && (bpm <= 80 || bpm > 120)) return false;
      if (tempoRange === 'fast' && (bpm <= 120 || bpm > 160)) return false;
      if (tempoRange === 'vfast' && bpm <= 160) return false;
    }
    return true;
  }).slice(0, 50);
  
  renderQuickSearchList(filtered, list);
}

function quickSearchClearFilters() {
  const input = document.getElementById('quickSearchInput');
  ['qspFilterSig','qspFilterGenre','qspFilterTempo','qspFilterKey'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (input) input.value = '';
  quickSearchFilter();
}

function renderQuickSearchList(songs, container) {
  if (!container) return;
  
  if (songs.length === 0) {
    container.innerHTML = '<div class="qsp-empty">ترانه‌ای یافت نشد</div>';
    return;
  }
  
  container.innerHTML = songs.map(s => `
    <button class="qsp-item" data-command="quickSearchLoadSong" data-song-id="${searchEscapeHtml(String(s.id))}">
      <div class="qsp-item-title">${searchEscapeHtml(s.title || 'بدون نام')}</div>
      <div class="qsp-item-artist">${searchEscapeHtml(s.artist || '')}</div>
    </button>
  `).join('');
}

function quickSearchLoadSong(id) {
  // Load through the archive namespace without opening the archive modal.
  const songs = quickSearchArchiveCall('getAllSongs') || [];
  const s = songs.find(x => String(x.id) === String(id));
  if (!s || s.deletedAt) {
    toast('ترانه یافت نشد');
    return;
  }
  
  closeQuickSearchPanel();
  quickSearchArchiveCall('loadSong', id);
}

function searchEscapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
