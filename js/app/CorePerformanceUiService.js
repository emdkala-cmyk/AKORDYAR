/*
 * CorePerformanceUiService
 *
 * Renders the live performance dashboard without owning arranger state.
 */
(function attachCorePerformanceUiService(globalScope) {
  'use strict';

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getPerformanceState = () => ({}),
    getAllSongs = () => [],
    getItemSetting = () => ({}),
    getCurrentSong = () => null,
    getDAW = () => ({}),
    getArrangerEnd = () => 0,
    jumpToSong = () => {},
    saveArrangers = () => {},
    seekTransport = () => {},
    ensureAudioCtx = () => {},
    startTransport = () => {}
  } = {}) {
    function clearDragIndicators(setlist) {
      Array.from(setlist?.children || []).forEach(child => {
        child.classList.remove('drag-over-top', 'drag-over-bottom');
        child.style.borderTop = '';
        child.style.borderBottom = '';
      });
    }

    function render() {
      const state = getPerformanceState?.() || {};
      const arr = state.arrPerformData;
      if (!state.perfModeActive || !arr) return;

      const allSongs = getAllSongs?.() || [];
      const currentIndex = Number(state.arrPerformIdx) || 0;
      const songId = arr.items[currentIndex];
      const song = allSongs.find(item => item.id === songId);
      const setting = getItemSetting(arr, songId) || {};
      const currentSong = getCurrentSong?.() || {};
      const setText = (id, value) => {
        const element = getElement(id);
        if (element) element.textContent = value;
        return element;
      };

      setText('perfSongNum', `${currentIndex + 1} / ${arr.items.length}`);
      setText('perfSongTitle', song ? song.title || 'بدون نام' : '—');
      setText('perfSongArtist', song?.artist || '');
      const keyName = song?.key || currentSong.key || 'C';
      const keyMode = song?.keyMode || currentSong.keyMode || 'maj';
      const transpose = setting.transpose || 0;
      const keyElement = getElement('perfSongKey');
      if (keyElement) {
        keyElement.innerHTML =
          `${keyName} ${keyMode === 'maj' ? 'ماژور' : 'مینور'} ` +
          `${transpose ? `<span class="perf-trans">(${transpose > 0 ? '+' : ''}${transpose})</span>` : ''}`;
      }
      setText('perfTransVal', transpose > 0 ? '+' + transpose : String(transpose));
      setText(
        'perfTempoVal',
        song?.tempo || currentSong.tempo || 120
      );

      const setlist = getElement('perfSetlist');
      if (!setlist) return;
      setlist.innerHTML = '';
      let draggedIndex = -1;

      arr.items.forEach((id, index) => {
        const itemSong = allSongs.find(item => item.id === id);
        const itemSetting = getItemSetting(arr, id) || {};
        const element = documentRef.createElement('div');
        element.className =
          'arr-perf-setlist-item' +
          (index === currentIndex ? ' pf-current' : '') +
          (index === currentIndex + 1 ? ' pf-next' : '') +
          (index < currentIndex ? ' pf-done' : '');
        element.draggable = true;
        element.innerHTML =
          `<span class="pf-num">${index + 1}</span>` +
          `<span class="pf-name">${itemSong ? itemSong.title || 'بدون نام' : '—'}</span>` +
          `<span class="pf-key">${itemSong?.key || '—'}${itemSetting.transpose ? (itemSetting.transpose > 0 ? '+' : '') + itemSetting.transpose : ''}</span>`;

        element.onclick = () => jumpToSong(index);
        element.addEventListener('dragstart', event => {
          draggedIndex = index;
          element.classList.add('dragging');
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
          }
        });
        element.addEventListener('dragend', () => {
          draggedIndex = -1;
          element.classList.remove('dragging');
          clearDragIndicators(setlist);
        });
        element.addEventListener('dragover', event => {
          event.preventDefault();
          if (draggedIndex === -1 || draggedIndex === index) return;
          clearDragIndicators(setlist);
          const midpoint =
            element.getBoundingClientRect().top +
            element.getBoundingClientRect().height / 2;
          if (event.clientY < midpoint) {
            element.classList.add('drag-over-top');
            element.style.borderTop = '2px solid var(--accent-teal)';
          } else {
            element.classList.add('drag-over-bottom');
            element.style.borderBottom = '2px solid var(--accent-teal)';
          }
        });
        element.addEventListener('dragleave', () => {
          element.classList.remove('drag-over-top', 'drag-over-bottom');
          element.style.borderTop = '';
          element.style.borderBottom = '';
        });
        element.addEventListener('drop', event => {
          event.preventDefault();
          if (draggedIndex === -1 || draggedIndex === index) return;
          const midpoint =
            element.getBoundingClientRect().top +
            element.getBoundingClientRect().height / 2;
          let dropIndex = event.clientY < midpoint ? index : index + 1;
          if (draggedIndex < dropIndex) dropIndex--;
          if (draggedIndex !== dropIndex) {
            const moved = arr.items.splice(draggedIndex, 1)[0];
            arr.items.splice(dropIndex, 0, moved);
            saveArrangers();
            render();
          }
          draggedIndex = -1;
          element.classList.remove('drag-over-top', 'drag-over-bottom');
          element.style.borderTop = '';
          element.style.borderBottom = '';
        });
        setlist.appendChild(element);
      });

      const sectionNavigation = getElement('perfSectionNav');
      if (sectionNavigation) {
        sectionNavigation.innerHTML = '';
        const sectionNames = ['مقدمه', 'ورس', 'کورس', 'بریج', 'آوترو'];
        const sectionTimes = [0];
        const daw = getDAW?.() || {};
        (daw.sections || []).forEach(section => {
          sectionTimes.push(section.start);
        });
        sectionTimes.push(getArrangerEnd());
        sectionNames.forEach((name, index) => {
          if (index >= sectionTimes.length - 1 && index !== 0) return;
          const button = documentRef.createElement('button');
          button.textContent = name;
          button.onclick = () => {
            if (index >= sectionTimes.length) return;
            seekTransport(sectionTimes[index], false);
            if (!getDAW?.()?.isPlaying) {
              ensureAudioCtx();
              startTransport();
              setText('perfPlayBtn', '⏸');
            }
          };
          sectionNavigation.appendChild(button);
        });
      }

      const noteBadge = getElement('perfNoteBadge');
      if (setting.notes && setting.notes.trim()) {
        setText('perfNoteText', setting.notes);
        noteBadge?.classList.add('show');
      } else {
        noteBadge?.classList.remove('show');
      }
      setlist.querySelector?.('.pf-current')?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'nearest'
      });
    }

    return Object.freeze({ render });
  }

  const service = Object.freeze({ create });
  globalScope.CorePerformanceUiService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
