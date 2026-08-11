// ===== Quick Search Panel Functions =====
let _quickSearchDragging = false;
let _quickSearchDragOffset = { x: 0, y: 0 };

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
  
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.qsp-close')) return;
    _quickSearchDragging = true;
    const rect = panel.getBoundingClientRect();
    _quickSearchDragOffset.x = e.clientX - rect.left;
    _quickSearchDragOffset.y = e.clientY - rect.top;
    panel.style.transition = 'none';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!_quickSearchDragging) return;
    const x = e.clientX - _quickSearchDragOffset.x;
    const y = e.clientY - _quickSearchDragOffset.y;
    
    // Boundary checks
    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;
    
    panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    panel.style.right = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    if (_quickSearchDragging) {
      _quickSearchDragging = false;
      panel.style.transition = '';
    }
  });
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
  
  const songs = edGetAllSongs().filter(s => !s.deletedAt);
  
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
      const title = (s.title || '').toLowerCase();
      const artist = (s.artist || '').toLowerCase();
      const rawText = (s.rawText || '').toLowerCase();
      if (!title.includes(query) && !artist.includes(query) && !rawText.includes(query)) return false;
    }
    // Signature filter
    if (sig && s.timeSignature !== sig) return false;
    // Genre filter
    if (genre && s.genre !== genre) return false;
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
    container.innerHTML = '<div class="qsp-empty">ØªØ±Ø§Ù†Ù‡â€ŒØ§ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯</div>';
    return;
  }
  
  container.innerHTML = songs.map(s => `
    <button class="qsp-item" data-song-id="${s.id}" onclick="quickSearchLoadSong('${s.id}')">
      <div class="qsp-item-title">${escapeHtml(s.title || 'Ø¨Ø¯ÙˆÙ† Ù†Ø§Ù…')}</div>
      <div class="qsp-item-artist">${escapeHtml(s.artist || '')}</div>
    </button>
  `).join('');
}

function quickSearchLoadSong(id) {
  // Use the existing archLoadSong function but close panel instead of archive modal
  const songs = edGetAllSongs();
  const s = songs.find(x => String(x.id) === String(id));
  if (!s || s.deletedAt) {
    toast('ØªØ±Ø§Ù†Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯');
    return;
  }
  
  closeQuickSearchPanel();
  archLoadSong(id);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
