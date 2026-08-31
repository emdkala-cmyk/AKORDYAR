/**
 * EditorMixerService
 *
 * Owns the mixer panel UI and the small audio-track gain/pan mutation used by
 * the editor. Timeline and transport callers keep their legacy wrappers in
 * app/core.js.
 */
(function attachEditorMixerService(globalScope) {
  function create({
    getDAW,
    getElement = id => globalScope.document?.getElementById(id),
    documentRef = globalScope.document,
    windowRef = globalScope,
    saveState = () => {},
    renderTracks = () => {},
    renderClips = () => {},
    scheduleAllFromPlayhead = () => {},
    startPointerDrag = (...args) =>
      globalScope.EditorRuntimeAdapter?.startPointerDrag?.(...args),
    t = key => globalScope.t?.(key) ?? key
  } = {}) {
    if (typeof getDAW !== 'function') {
      throw new TypeError('EditorMixerService requires getDAW');
    }

    let mixerPosition = null;

    function updateTrackMix(trackId) {
      const daw = getDAW();
      const track = daw.tracks.find(item => item.id === trackId);
      if (!track || !track._gainNode) return;
      const anySolo = daw.tracks.some(item => item.solo);
      let gain = 0;
      if (anySolo) {
        gain = track.solo && !track.muted ? track.vol : 0;
      } else {
        gain = track.muted ? 0 : track.vol;
      }
      track._gainNode.gain.value = gain;
      track._pannerNode.pan.value = track.pan;
    }

    function toggle() {
      const panel = getElement('mixerPanel');
      if (!panel) return;
      initDrag();
      const show = !panel.classList.contains('show');
      panel.classList.toggle('show', show);
      if (show) {
        if (mixerPosition) {
          panel.style.transform = 'none';
          panel.style.left = mixerPosition.left + 'px';
          panel.style.top = mixerPosition.top + 'px';
        }
        render();
      }
    }

    function render() {
      const wrap = getElement('mixerChannels');
      if (!wrap) return;
      wrap.innerHTML = '';
      const tracks = getDAW().tracks.filter(item => item.type === 'audio');
      if (!tracks.length) {
        wrap.innerHTML =
          '<div style="color:var(--text-secondary);padding:12px;">ترک صوتی وجود ندارد</div>';
        return;
      }

      tracks.forEach(track => {
        const channel = documentRef.createElement('div');
        channel.className =
          'mixer-channel' +
          (track.id === 'tRec' ? ' rec-channel' : '');
        const volumePercent = Math.round((track.vol || 0) * 100);
        const balance =
          track.pan < 0
            ? 'L ' + Math.round(Math.abs(track.pan) * 100)
            : track.pan > 0
              ? 'R ' + Math.round(track.pan * 100)
              : '(C)';
        channel.innerHTML =
          '<div class="mixer-ch-top"><span class="mixer-ch-name">' +
          (track.icon || '') +
          '</span>' +
          '<input class="mixer-ch-name-input" value="' +
          track.name +
          '" data-mn="' +
          track.id +
          '" title="' + t('renameLine') + '" spellcheck="false"></div>' +
          '<div class="mixer-ch-controls">' +
          '<button class="t-btn ' +
          (track.muted ? 'on' : '') +
          '" data-mm="' +
          track.id +
          '" title="Mute">M</button>' +
          '<button class="t-btn ' +
          (track.solo ? 'on-solo' : '') +
          '" data-ms="' +
          track.id +
          '" title="Solo">S</button>' +
          '</div>' +
          '<div class="mixer-ch-fader"><label>Volume (' +
          volumePercent +
          '%)</label>' +
          '<input type="range" min="0" max="1" step="0.01" value="' +
          (track.vol || 0) +
          '" data-mv="' +
          track.id +
          '"></div>' +
          '<div class="mixer-ch-fader"><label>Balance ' +
          balance +
          '</label>' +
          '<input type="range" min="-1" max="1" step="0.01" value="' +
          (track.pan || 0) +
          '" data-mp="' +
          track.id +
          '"></div>';
        wrap.appendChild(channel);
      });

      wrap.querySelectorAll('[data-mn]').forEach(input =>
        input.addEventListener('change', () => {
          const track = getDAW().tracks.find(
            item => item.id === input.dataset.mn
          );
          if (!track) return;
          track.name = input.value.trim() || track.name;
          saveState();
          renderTracks();
          renderClips();
          if (getDAW().isPlaying) scheduleAllFromPlayhead();
        })
      );

      wrap.querySelectorAll('[data-mm]').forEach(button =>
        button.addEventListener('click', () => {
          const track = getDAW().tracks.find(
            item => item.id === button.dataset.mm
          );
          if (!track) return;
          track.muted = !track.muted;
          updateTrackMix(track.id);
          render();
          renderTracks();
          renderClips();
          if (getDAW().isPlaying) scheduleAllFromPlayhead();
        })
      );

      wrap.querySelectorAll('[data-ms]').forEach(button =>
        button.addEventListener('click', () => {
          const track = getDAW().tracks.find(
            item => item.id === button.dataset.ms
          );
          if (!track) return;
          track.solo = !track.solo;
          getDAW().tracks.forEach(item => updateTrackMix(item.id));
          render();
          renderTracks();
          renderClips();
          if (getDAW().isPlaying) scheduleAllFromPlayhead();
        })
      );

      wrap.querySelectorAll('[data-mv]').forEach(range =>
        range.addEventListener('input', () => {
          const track = getDAW().tracks.find(
            item => item.id === range.dataset.mv
          );
          if (!track) return;
          track.vol = +range.value;
          updateTrackMix(track.id);
          range.parentElement.querySelector('label').textContent =
            'Volume (' + Math.round(track.vol * 100) + '%)';
        })
      );

      wrap.querySelectorAll('[data-mp]').forEach(range => {
        range.addEventListener('input', () => {
          const track = getDAW().tracks.find(
            item => item.id === range.dataset.mp
          );
          if (!track) return;
          track.pan = +range.value;
          updateTrackMix(track.id);
          const label = range.parentElement.querySelector('label');
          label.textContent =
            'Balance ' +
            (track.pan < 0
              ? 'L ' + Math.round(Math.abs(track.pan) * 100)
              : track.pan > 0
                ? 'R ' + Math.round(track.pan * 100)
                : '(C)');
        });
        range.addEventListener('dblclick', event => {
          event.preventDefault();
          const track = getDAW().tracks.find(
            item => item.id === range.dataset.mp
          );
          if (!track) return;
          track.pan = 0;
          range.value = 0;
          updateTrackMix(track.id);
          range.parentElement.querySelector('label').textContent =
            'Balance (C)';
        });
      });
    }

    let dragInitialized = false;
    function initDrag() {
      const panel = getElement('mixerPanel');
      if (!panel || panel._dragReady) return;
      panel._dragReady = true;
      const head = panel.querySelector('.mixer-head');
      if (!head) return;
      dragInitialized = true;
      head.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        if (event.target.closest('button')) return;
        event.preventDefault();
        const rect = panel.getBoundingClientRect();
        panel.style.transform = 'none';
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const move = currentEvent => {
          let x = currentEvent.clientX - offsetX;
          let y = currentEvent.clientY - offsetY;
          x = Math.max(
            -panel.offsetWidth + 80,
            Math.min(x, windowRef.innerWidth - 40)
          );
          y = Math.max(
            0,
            Math.min(y, windowRef.innerHeight - 30)
          );
          panel.style.left = x + 'px';
          panel.style.top = y + 'px';
        };
        startPointerDrag(head, event, move, () => {
          const currentRect = panel.getBoundingClientRect();
          mixerPosition = {
            left: currentRect.left,
            top: currentRect.top
          };
        });
      });
    }

    return Object.freeze({
      updateTrackMix,
      toggle,
      render,
      initDrag,
      isDragInitialized: () => dragInitialized
    });
  }

  const service = Object.freeze({ create });
  globalScope.EditorMixerService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
