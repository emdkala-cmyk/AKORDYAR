/*
 * CoreTrackSetupService
 *
 * Owns track creation and the instrument-icon picker. Timeline rendering
 * consumes getIconSvg/openIconPicker through the injected public callbacks.
 */
(function attachCoreTrackSetupService(globalScope) {
  'use strict';

  const DEFAULT_INSTRUMENT_ICONS = Object.freeze([
    '🎤',
    '🎸',
    '🎹',
    '🎺',
    '🎻',
    '🥁',
    '🎷',
    '🎵',
    '🎶',
    '🎼',
    '🎙️',
    '🎧',
    '📡',
    '🎛️',
    '⏺',
    '♫',
    '🏷'
  ]);

  const DEFAULT_ICON_SVG_MAP = {
    '🎤': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    '🎸': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 2l-2 2c-1.5 1.5-4 1.5-5.5 0L11 6l-2-2c-1.5-1.5-4-1.5-5.5 0L2 4V20l2-2c1.5-1.5 4-1.5 5.5 0l1.5-1.5 2 2c1.5 1.5 4 1.5 5.5 0l2-2V2z"/><line x1="7" y1="11" x2="13" y2="17"/><line x1="11" y1="7" x2="17" y2="13"/></svg>',
    '🎹': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="6" y1="2" x2="6" y2="14"/><line x1="10" y1="2" x2="10" y2="14"/><line x1="14" y1="2" x2="14" y2="14"/><line x1="18" y1="2" x2="18" y2="14"/><rect x="4" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="8" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="12" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="16" y="2" width="2" height="8" rx="1" fill="currentColor" opacity="0.3"/></svg>',
    '🎺': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8m0 0l4 4m-4-4l-4 4"/><circle cx="12" cy="18" r="4"/><path d="M8 22h8"/></svg>',
    '🎻': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6m6-6v6"/><ellipse cx="12" cy="16" rx="6" ry="8"/><line x1="12" y1="8" x2="12" y2="24"/></svg>',
    '🥁': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="6"/><line x1="4" y1="6" x2="4" y2="18"/><line x1="20" y1="6" x2="20" y2="18"/><path d="M8 2l4 4m4-4l-4 4"/></svg>',
    '🎷': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l2 6-4 4"/><path d="M18 2l-2 6 4 4"/><path d="M12 8v14"/><circle cx="12" cy="22" r="2"/></svg>',
    '🎵': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    '🎶': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 9l12-2"/></svg>',
    '🎼': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="9" y1="9" x2="21" y2="7"/></svg>',
    '🎙️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/><circle cx="12" cy="1" r="1" fill="currentColor"/></svg>',
    '🎧': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
    '📡': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/><circle cx="12" cy="12" r="2"/></svg>',
    '🎛️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    '⏺': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>',
    '♫': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    '🏷': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
  };

  function create({
    documentRef = globalScope.document,
    getElement = id => documentRef?.getElementById?.(id),
    getDAW = () => globalScope.getEditorDAW?.() || globalScope.DAW,
    getIconRegistry = () => globalScope.IconRegistry,
    ensureAudioCtx = () => globalScope.ensureAudioCtx?.(),
    uid = prefix => `${prefix}${Date.now()}`,
    saveState = () => globalScope.saveState?.(),
    renderAll = () => globalScope.renderAll?.(),
    toast = () => {},
    translate = key => globalScope.t?.(key) ?? key
  } = {}) {
    const iconSvgMap = { ...DEFAULT_ICON_SVG_MAP };
    const registry = getIconRegistry?.();
    if (registry?.getAll) Object.assign(iconSvgMap, registry.getAll());

    let iconPickerTrack = null;

    function getIconSvg(icon) {
      return iconSvgMap[icon] || icon;
    }

    function closeIconPicker() {
      getElement('iconPickerOverlay')?.classList?.remove?.('show');
      iconPickerTrack = null;
    }

    function openIconPicker(track) {
      iconPickerTrack = track;
      const grid = getElement('iconPickerGrid');
      const overlay = getElement('iconPickerOverlay');
      if (!grid || !overlay) return;

      grid.innerHTML = '';
      DEFAULT_INSTRUMENT_ICONS.forEach(icon => {
        const item = documentRef.createElement('div');
        item.className =
          'icon-picker-item' + (icon === track.icon ? ' active' : '');
        item.innerHTML = getIconSvg(icon);
        item.addEventListener('click', () => {
          track.icon = icon;
          closeIconPicker();
          saveState();
          renderAll();
        });
        grid.appendChild(item);
      });
      overlay.classList.add('show');
    }

    function bindIconPicker() {
      const overlay = getElement('iconPickerOverlay');
      overlay?.addEventListener?.('click', event => {
        if (event.target === overlay) closeIconPicker();
      });
    }

    function addNewTrack(name, icon) {
      const daw = getDAW();
      const trackNumber = daw.tracks.length + 1;
      ensureAudioCtx();
      const newTrack = {
        id: uid('t'),
        name: name || `Line ${trackNumber}`,
        icon: icon || '🎛️',
        type: 'audio',
        muted: false,
        solo: false,
        vol: 0.8,
        pan: 0,
        transpose: 0,
        locked: false
      };
      newTrack._pannerNode = daw.audioCtx.createStereoPanner();
      newTrack._gainNode = daw.audioCtx.createGain();
      newTrack._pannerNode.connect(newTrack._gainNode);
      newTrack._gainNode.connect(daw.masterGain);
      daw.tracks.push(newTrack);
      saveState();
      renderAll();
      toast(translate('newTrackAdded'));
    }

    bindIconPicker();
    return Object.freeze({ getIconSvg, openIconPicker, addNewTrack });
  }

  const service = Object.freeze({ create });
  globalScope.CoreTrackSetupService = service;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = service;
  }
})(typeof window !== 'undefined' ? window : globalThis);
