/* ============================================================


   آکوردیار — Project Hub Overlay Logic
   یکپارچه با توابع واقعی پروژه و سرویس‌های runtime
   شامل: قالب‌های واقعی، صفحه شروع، بهبود طراحی
   ============================================================ */

(function () {
  'use strict';

  /* ---------- State ---------- */
  let selectedProjectId = null;
  let currentView = 'recent';
  let isStartup = true;

  /* ---------- Helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const t = (key) => window.t?.(key) ?? key;

  function getCurrentSong() {
    return window.ArchiveRuntimeAdapter?.getSong?.() || null;
  }

  function getRuntimeDAW() {
    return window.ArchiveRuntimeAdapter?.getDAW?.() || null;
  }

  function getCoreArrangerApi() {
    return window.AkordyarCoreApi || {};
  }

  function getArchiveApi() {
    return window.AkordyarArchiveApi || {};
  }

  function getEditorApi() {
    return window.AkordyarEditorApi || {};
  }

  function callApi(api, name, ...args) {
    const fn = api?.[name];
    return typeof fn === 'function' ? fn(...args) : undefined;
  }

  const coreEnsureAudioCtx = (...args) =>
    getCoreArrangerApi().ensureAudioCtx?.(...args);
  const coreRenderAll = (...args) =>
    getCoreArrangerApi().renderAll?.(...args);
  const coreSaveState = (...args) =>
    getCoreArrangerApi().saveState?.(...args);

  function escH(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  }

  /* ---------- Data: Recent Projects (از آرشیو واقعی) ---------- */
  function getRecentProjects() {
    try {
      const songs = callApi(getArchiveApi(), 'getAllSongs') || [];
      return songs.slice(0, 8).map((s) => ({
        id: s.id,
        name: s.title || s.name || t('untitled'),
        artist: s.artist || t('unknown'),
        key: s.key || '—',
        tempo: s.tempo || '—',
        tracks: (s._dawTracks || []).length || 0,
        lastModified: s.updatedAt || s.date || '—',
        icon: '🎵'
      }));
    } catch (e) {
      console.warn('[ProjectHub] Error loading recent projects:', e);
      return [];
    }
  }

  /* ---------- Data: Templates (قالب‌های واقعی با تنظیمات کامل) ---------- */
  const TEMPLATES = [
    {
      id: 'tpl-001',
      nameKey: 'tplVocalPractice',
      descKey: 'tplVocalDesc',
      icon: '🎤',
      tagKeys: ['vocal', 'metronome'],
      config: {
        tempo: 90,
        key: 'C',
        keyMode: 'maj',
        genre: 'calm',
        timelineDuration: 60,
        tracks: [
          { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
          { id: 't1', name: 'Vocals', icon: '🎤', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 }
        ]
      }
    },
    {
      id: 'tpl-002',
      nameKey: 'tplAcoustic',
      descKey: 'tplAcousticDesc',
      icon: '🎸',
      tagKeys: ['acoustic', 'guitar'],
      tagClass: 'yellow',
      config: {
        tempo: 80,
        key: 'G',
        keyMode: 'maj',
        genre: 'folk',
        timelineDuration: 90,
        tracks: [
          { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
          { id: 't1', name: 'Acoustic Guitar', icon: '🎸', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
          { id: 't2', name: 'Vocals', icon: '🎤', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
          { id: 't3', name: 'Bass', icon: '🎵', type: 'audio', muted: false, solo: false, vol: 0.7, pan: 0, transpose: 0 }
        ]
      }
    },
    {
      id: 'tpl-003',
      nameKey: 'tplFullDaw',
      descKey: 'tplFullDawDesc',
      icon: '🎹',
      tagKeys: ['full', '8tracks'],
      tagClass: 'purple',
      config: {
        tempo: 120,
        key: 'Am',
        keyMode: 'min',
        genre: 'pop',
        timelineDuration: 120,
        tracks: [
          { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
          { id: 't1', name: 'Drums', icon: '🥁', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
          { id: 't2', name: 'Bass', icon: '🎵', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
          { id: 't3', name: 'Keys', icon: '🎹', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
          { id: 't4', name: 'Guitar', icon: '🎸', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
          { id: 't5', name: 'Vocals', icon: '🎤', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
          { id: 't6', name: 'Strings', icon: '🎻', type: 'audio', muted: false, solo: false, vol: 0.6, pan: 0, transpose: 0 },
          { id: 't7', name: 'FX', icon: '✨', type: 'audio', muted: false, solo: false, vol: 0.5, pan: 0, transpose: 0 }
        ]
      }
    },
    {
      id: 'tpl-004',
      nameKey: 'tplQuickRecord',
      descKey: 'tplQuickRecordDesc',
      icon: '🎧',
      tagKeys: ['recording', 'quick'],
      tagClass: 'pink',
      config: {
        tempo: 100,
        key: 'D',
        keyMode: 'maj',
        genre: 'other',
        timelineDuration: 30,
        tracks: [
          { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
          { id: 't1', name: 'Rec Track', icon: '🎧', type: 'audio', muted: false, solo: false, vol: 0.9, pan: 0, transpose: 0 }
        ]
      }
    },
    {
      id: 'tpl-005',
      nameKey: 'tplBacking',
      descKey: 'tplBackingDesc',
      icon: '🎼',
      tagKeys: ['backing', 'instrument'],
      tagClass: 'yellow',
      config: {
        tempo: 110,
        key: 'E',
        keyMode: 'min',
        genre: 'pop',
        timelineDuration: 100,
        tracks: [
          { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
          { id: 't1', name: 'Drums', icon: '🥁', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
          { id: 't2', name: 'Bass', icon: '🎵', type: 'audio', muted: false, solo: false, vol: 0.8, pan: 0, transpose: 0 },
          { id: 't3', name: 'Keys', icon: '🎹', type: 'audio', muted: false, solo: false, vol: 0.7, pan: 0, transpose: 0 }
        ]
      }
    },
    {
      id: 'tpl-006',
      nameKey: 'tplPodcast',
      descKey: 'tplPodcastDesc',
      icon: '🎙️',
      tagKeys: ['podcast', 'vocal'],
      tagClass: 'purple',
      config: {
        tempo: 100,
        key: 'C',
        keyMode: 'maj',
        genre: 'other',
        timelineDuration: 180,
        tracks: [
          { id: 't0', name: 'Chord Line', icon: '♫', type: 'chord' },
          { id: 't1', name: 'Host 1', icon: '🎙️', type: 'audio', muted: false, solo: false, vol: 0.9, pan: -0.3, transpose: 0 },
          { id: 't2', name: 'Host 2', icon: '🎙️', type: 'audio', muted: false, solo: false, vol: 0.9, pan: 0.3, transpose: 0 },
          { id: 't3', name: 'FX', icon: '✨', type: 'audio', muted: false, solo: false, vol: 0.5, pan: 0, transpose: 0 }
        ]
      }
    }
  ];

  /* ---------- Data: Arranger Playlists (ارنجر ترک‌ها از localStorage) ---------- */
  function getArrangerPlaylists() {
    try {
      const arrangers = getCoreArrangerApi().getArrangers?.();
      if (!Array.isArray(arrangers)) return [];
      return arrangers.map((arr) => ({
        id: arr.id,
        name: arr.name || t('untitled'),
        songCount: (arr.items || []).length,
        crossfade: arr.crossfade || 0,
        pauseBetween: !!arr.pauseBetween,
        icon: '🎼'
      }));
    } catch (e) {
      console.warn('[ProjectHub] Error loading arranger playlists:', e);
      return [];
    }
  }

  function renderArrangerPlaylists() {
    const list = $('hubArrangerList');
    if (!list) return;

    const playlists = getArrangerPlaylists();

    if (playlists.length === 0) {
      list.innerHTML = `
        <div class="arranger-empty">
          <div style="font-size:1.5rem;margin-bottom:6px;">🎼</div>
          <span>${t('noArrangerTrack')}</span>
          <span style="font-size:0.65rem;display:block;margin-top:4px;">${t('useArrangerHint')}</span>
        </div>`;
      return;
    }

    list.innerHTML = playlists.map((p) => `
      <div class="arranger-item" data-id="${escH(p.id)}">
        <div class="arranger-ic">${p.icon}</div>
        <div class="arranger-info">
          <div class="arranger-name">${escH(p.name)}</div>
          <div class="arranger-meta">
            <span>🎵 ${p.songCount} ${t('songs')}</span>
            ${p.crossfade > 0 ? `<span>🔄 ${t('crossfade')}: ${p.crossfade}s</span>` : ''}
          </div>
        </div>
        <button class="icon-btn" title="${t('openInArranger')}" data-action="open">📂</button>
      </div>
    `).join('');
  }

  /* ---------- Render ---------- */
  function renderProjects() {
    const list = $('hubProjectList');
    if (!list) return;

    const projects = getRecentProjects();

    if (projects.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-ic">📂</div>
          <span>${t('noProjectsYet')}</span>
          <span style="font-size:0.72rem">${t('startWithNew')}</span>
        </div>`;
      return;
    }

    list.innerHTML = projects.map((p) => `
      <div class="project-item ${selectedProjectId === p.id ? 'selected' : ''}" data-id="${escH(p.id)}">
        <div class="project-thumb">${p.icon}</div>
        <div class="project-info">
          <div class="project-name">${escH(p.name)}</div>
          <div class="project-meta">
            <span>🎵 ${escH(p.artist)}</span>
            <span>🎼 <span class="meta-key">${escH(p.key)}</span></span>
            <span>⏱ <span class="meta-key">${escH(p.tempo)}</span> BPM</span>
            <span>🎚 <span class="meta-key">${p.tracks}</span> ${t('tracks')}</span>
            <span>🕘 ${escH(p.lastModified)}</span>
          </div>
        </div>
        <div class="project-actions">
          <button class="icon-btn" title="${t('open')}" data-action="open">📂</button>
          <button class="icon-btn danger" title="${t('delete')}" data-action="delete">🗑</button>
        </div>
      </div>
    `).join('');
  }

  function renderTemplates() {
    const grid = $('hubTemplatesGrid');
    if (!grid) return;

    grid.innerHTML = TEMPLATES.map((tpl) => {
      const name = t(tpl.nameKey);
      const desc = t(tpl.descKey);
      const tags = (tpl.tagKeys || []).map(k => t(k));
      const tracksLabel = t('tracks');
      return `
      <div class="template-card" data-id="${tpl.id}">
        <div class="template-ic">${tpl.icon}</div>
        <div class="template-name">${escH(name)}</div>
        <div class="template-desc">${escH(desc)}</div>
        <div class="template-tags">
          ${tags.map((tag) => `<span class="tag ${tpl.tagClass || ''}">${escH(tag)}</span>`).join('')}
        </div>
        <div class="template-config">
          <span>⏱ ${tpl.config.tempo} BPM</span>
          <span>🎼 ${escH(tpl.config.key)}</span>
          <span>🎚 ${tpl.config.tracks.length} ${tracksLabel}</span>
        </div>
      </div>
    `;
    }).join('');
  }

  /* ---------- Actions (یکپارچه با توابع واقعی) ---------- */
  async function openProject(id) {
    // ریست undoStack تا پیام ذخیره نمایش داده نشود
    if (typeof undoStack !== 'undefined') {
      undoStack = [];
      undoIndex = -1;
    }
    if (typeof getArchiveApi().loadSong === 'function') {
      await callApi(getArchiveApi(), 'loadSong', id);
    } else {
      console.warn('[ProjectHub] No archive loader available');
    }
    closeHub();
  }

  async function newProject() {
    // ریست undoStack تا پیام ذخیره نمایش داده نشود
    if (typeof undoStack !== 'undefined') {
      undoStack = [];
      undoIndex = -1;
    }
    if (typeof getArchiveApi().newSong === 'function') {
      await callApi(getArchiveApi(), 'newSong');
    } else {
      console.warn('[ProjectHub] Archive new-song action is unavailable');
    }
    closeHub();
  }

  /* ---------- قالب: ساخت پروژه از قالب با تنظیمات واقعی ---------- */
  async function createProjectFromTemplate(template) {
    if (!template || !template.config) {
      console.warn('[ProjectHub] Invalid template');
      return;
    }

    // ۱) ریست undoStack تا پیام ذخیره نمایش داده نشود
    if (typeof undoStack !== 'undefined') {
      undoStack = [];
      undoIndex = -1;
    }

    // ۲) ریست کامل پروژه
    if (typeof getArchiveApi().newSong === 'function') {
      await callApi(getArchiveApi(), 'newSong');
    }

    // ۳) اعمال تنظیمات قالب روی song
    // توجه: عنوان ترانه ست نمیشود — قالب فقط ساختار DAW را تنظیم میکند
    const cfg = template.config;
    try {
      const song = getCurrentSong();
      const daw = getRuntimeDAW();
      if (song) {
        if (cfg.tempo) song.tempo = cfg.tempo;
        if (cfg.key) song.key = cfg.key;
        if (cfg.keyMode) song.keyMode = cfg.keyMode;
        if (cfg.genre) song.genre = cfg.genre;
        // اطمینان از باز بودن ویرایشگر
        song.editorLocked = false;
      }

      // ۴) تنظیم ترک‌های DAW بر اساس قالب
      if (cfg.tracks && Array.isArray(cfg.tracks) && daw) {
        daw.tracks = JSON.parse(JSON.stringify(cfg.tracks));
        coreEnsureAudioCtx();
        daw.tracks.forEach(t => {
          if (t.type === 'audio' && daw.audioCtx) {
            t._pannerNode = daw.audioCtx.createStereoPanner();
            t._gainNode = daw.audioCtx.createGain();
            t._pannerNode.connect(t._gainNode);
            t._gainNode.connect(daw.masterGain);
          }
        });
      }

      // ۵) تنظیم طول تایم‌لاین
      if (cfg.timelineDuration && daw) daw.timelineDuration = cfg.timelineDuration;

      // ۶) به‌روزرسانی UI
      callApi(getEditorApi(), 'syncToolbar');
      callApi(getEditorApi(), 'renderEditor', true);
      coreRenderAll();
      coreSaveState();

      console.log(`[ProjectHub] Template applied: ${template.name}`);
    } catch (e) {
      console.error('[ProjectHub] Error applying template:', e);
    }

    closeHub();

    // ۷) اطمینان از فعال بودن ویرایشگر (بعد از بستن Hub)
    const editor = document.getElementById('editor');
    if (editor) {
      editor.contentEditable = 'true';
      editor.focus();
    }
  }

  function openArchive() {
    callApi(getArchiveApi(), 'open');
    closeHub();
  }

  function importProject() {
    callApi(getArchiveApi(), 'importProject');
    closeHub();
  }

  function openSettings() {
    const openSettingsCommand = window.AkordyarCoreApi?.openSettings;
    if (typeof openSettingsCommand === 'function') {
      openSettingsCommand();
    } else {
      const modal = $('settingsModal');
      if (modal) modal.classList.add('show');
    }
    closeHub();
  }

  async function deleteProject(id) {
    if (typeof getArchiveApi().deleteSong === 'function') {
      await callApi(getArchiveApi(), 'deleteSong', id);
      renderProjects();
    } else {
      console.warn('[ProjectHub] Archive delete action is unavailable');
    }
  }

  /* ---------- Arranger Actions ---------- */
  function openArrangerFromPlaylist(id) {
    const arrangerApi = getCoreArrangerApi();
    const arranger = arrangerApi
      .getArrangers?.()
      ?.find?.(item => String(item.id) === String(id));
    arrangerApi.setEditingArr?.(arranger || null);
    arrangerApi.openArrangerModal?.();
    // بستن هاب تا محیط ارنجر دیده شود
    closeHub();
  }

  function createNewArranger() {
    getCoreArrangerApi().createNewArranger?.();
    // بستن هاب تا محیط ارنجر دیده شود
    closeHub();
  }

  /* ---------- Hub Open/Close ---------- */
  function openHub() {
    const hub = $('projectHub');
    if (!hub) return;
    if (!hub.hasAttribute('tabindex')) hub.tabIndex = -1;
    renderProjects();
    renderTemplates();
    renderArrangerPlaylists();
    hub.classList.add('show');
    hub.focus({ preventScroll: true });
  }

  function closeHub() {
    const hub = $('projectHub');
    if (hub) hub.classList.remove('show');
  }

  function toggleHub() {
    const hub = $('projectHub');
    if (!hub) return;
    if (hub.classList.contains('show')) closeHub();
    else openHub();
  }

  /* ---------- Navigation ---------- */
  function setActiveView(view) {
    currentView = view;
    document.querySelectorAll('#projectHub .nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Show/hide sections based on view
    const recentSection = $('hubRecentSection');
    const templatesSection = $('hubTemplatesSection');
    if (recentSection && templatesSection) {
      if (view === 'templates') {
        recentSection.style.display = 'none';
        templatesSection.style.display = 'flex';
      } else {
        recentSection.style.display = 'flex';
        templatesSection.style.display = 'flex';
      }
    }
  }

  /* ---------- Event Handlers ---------- */
  function handleProjectClick(e) {
    const item = e.target.closest('.project-item');
    if (!item) return;

    const actionBtn = e.target.closest('[data-action]');
    const id = item.dataset.id;

    if (actionBtn) {
      const action = actionBtn.dataset.action;
      e.stopPropagation();
      if (action === 'open') openProject(id);
      else if (action === 'delete') deleteProject(id);
      return;
    }

    // کلیک روی آیتم پروژه = باز کردن مستقیم
    selectedProjectId = id;
    openProject(id);
  }

  function handleTemplateClick(e) {
    const card = e.target.closest('.template-card');
    if (!card) return;
    const template = TEMPLATES.find((t) => t.id === card.dataset.id);
    if (!template) return;
    createProjectFromTemplate(template);
  }

  function handleArrangerClick(e) {
    const item = e.target.closest('.arranger-item');
    if (!item) return;
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn && actionBtn.dataset.action === 'open') {
      openArrangerFromPlaylist(item.dataset.id);
      return;
    }
    // کلیک روی آیتم = باز کردن ارنجر
    openArrangerFromPlaylist(item.dataset.id);
  }

  /* ---------- Init ---------- */
  function init() {
    const hub = $('projectHub');
    if (!hub) return;
    if (!hub.hasAttribute('tabindex')) hub.tabIndex = -1;

    // Nav buttons
    hub.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        setActiveView(view);
        if (view === 'recent') openHub();
        else if (view === 'new') newProject();
        else if (view === 'open') importProject();
        else if (view === 'templates') openHub();
        else if (view === 'archive') openArchive();
        else if (view === 'settings') openSettings();
      });
    });

    // Project list (event delegation)
    const list = $('hubProjectList');
    if (list) list.addEventListener('click', handleProjectClick);

    // Templates grid (event delegation)
    const grid = $('hubTemplatesGrid');
    if (grid) grid.addEventListener('click', handleTemplateClick);

    // Arranger playlists list (event delegation)
    const arrangerList = $('hubArrangerList');
    if (arrangerList) arrangerList.addEventListener('click', handleArrangerClick);

    // New arranger button
    const btnNewArr = $('hubBtnNewArranger');
    if (btnNewArr) btnNewArr.addEventListener('click', createNewArranger);

    // Bottom bar
    const btnNew = $('hubBtnNewProject');
    if (btnNew) btnNew.addEventListener('click', newProject);

    const btnChoose = $('hubBtnChooseFile');
    if (btnChoose) btnChoose.addEventListener('click', importProject);

    const btnOpen = $('hubBtnOpen');
    if (btnOpen) btnOpen.addEventListener('click', () => {
      if (selectedProjectId) openProject(selectedProjectId);
    });

    const btnCancel = $('hubBtnCancel');
    if (btnCancel) btnCancel.addEventListener('click', closeHub);

    // Ghost buttons
    const btnRefresh = $('hubBtnRefresh');
    if (btnRefresh) btnRefresh.addEventListener('click', renderProjects);

    const btnBrowse = $('hubBtnBrowseTemplates');
    if (btnBrowse) btnBrowse.addEventListener('click', () => setActiveView('templates'));

    // Keyboard: Esc closes, Enter opens selected
    hub.addEventListener('keydown', (e) => {
      if (!hub.classList.contains('show')) return;
      if (e.key === 'Escape') closeHub();
      else if (e.key === 'Enter' && selectedProjectId) openProject(selectedProjectId);
    });

    // ===== صفحه شروع: باز شدن خودکار Hub هنگام لود برنامه =====
    // فقط بار اول (نه بعد از بستن و باز کردن)
    const isElectronRuntime = Boolean(
      typeof window !== 'undefined' &&
      window.RuntimeStateAdapter?.getElectronAPI?.()?.isElectron
    );

    if (isStartup && !isElectronRuntime) {
      isStartup = false;
      // کمی تأخیر تا runtime اصلی کاملاً آماده شود
      setTimeout(() => {
        openHub();
        console.log('[ProjectHub] Startup screen shown');
      }, 400);
    } else {
      isStartup = false;
    }

    console.log('[ProjectHub] Initialized ✓');
  }

  /* ---------- Expose API ---------- */
  window.closeHub = closeHub;
  window.ProjectHub = {
    open: openHub,
    close: closeHub,
    toggle: toggleHub,
    init,
    renderProjects,
    renderTemplates,
    renderArrangerPlaylists,
    createFromTemplate: createProjectFromTemplate
  };

  /* ---------- Auto-init ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
