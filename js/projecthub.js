/* ============================================================


   آکوردیار — Project Hub Overlay Logic
   یکپارچه با توابع واقعی پروژه (app.js)
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

  function escH(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  }

  /* ---------- Data: Recent Projects (از آرشیو واقعی) ---------- */
  function getRecentProjects() {
    try {
      const songs = (typeof edGetAllSongs === 'function') ? edGetAllSongs() : [];
      return songs.slice(0, 8).map((s) => ({
        id: s.id,
        name: s.title || s.name || 'بدون نام',
        artist: s.artist || 'نامشخص',
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
      name: 'تمرین خوانندگی',
      desc: 'لاین آکورد + متن شعر + مترونوم ۹۰ BPM',
      icon: '🎤',
      tags: ['وکال', 'مترونوم'],
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
      name: 'تنظیم آکوستیک',
      desc: 'گیتار آکوستیک + وکال + باس، تمپوی آرام',
      icon: '🎸',
      tags: ['آکوستیک', 'گیتار'],
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
      name: 'پروژه کامل DAW',
      desc: '۸ ترک: درام، باس، کیبورد، گیتار، وکال',
      icon: '🎹',
      tags: ['کامل', '۸ ترک'],
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
      name: 'ضبط سریع',
      desc: 'فقط لاین Rec + میکسر ساده برای ضبط فوری',
      icon: '🎧',
      tags: ['ضبط', 'سریع'],
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
      name: 'بکینگ ترک',
      desc: 'درام + باس + کیبورد برای همراهی خواننده',
      icon: '🎼',
      tags: ['بکینگ', 'ساز'],
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
      name: 'پادکست',
      desc: 'دو ترک وکال + افکت‌های صوتی',
      icon: '🎙️',
      tags: ['پادکست', 'وکال'],
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
      // Attempt to access the global arranger data from app.js
      if (typeof window.arrangers !== 'undefined' && Array.isArray(window.arrangers)) {
        return window.arrangers.map((arr) => ({
          id: arr.id,
          name: arr.name || 'بدون نام',
          songCount: (arr.items || []).length,
          crossfade: arr.crossfade || 0,
          pauseBetween: !!arr.pauseBetween,
          icon: '🎼'
        }));
      }
      // Fallback: try to read from localStorage directly
      try {
        const stored = JSON.parse(localStorage.getItem('arrangers_v1') || '[]');
        return stored.map((arr) => ({
          id: arr.id,
          name: arr.name || 'بدون نام',
          songCount: (arr.items || []).length,
          crossfade: arr.crossfade || 0,
          pauseBetween: !!arr.pauseBetween,
          icon: '🎼'
        }));
      } catch (e) {
        return [];
      }
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
          <span>ارنجر ترکی وجود ندارد</span>
          <span style="font-size:0.65rem;display:block;margin-top:4px;">از «ارسال به ارنجر» یا «➕ جدید» استفاده کنید</span>
        </div>`;
      return;
    }

    list.innerHTML = playlists.map((p) => `
      <div class="arranger-item" data-id="${escH(p.id)}">
        <div class="arranger-ic">${p.icon}</div>
        <div class="arranger-info">
          <div class="arranger-name">${escH(p.name)}</div>
          <div class="arranger-meta">
            <span>🎵 ${p.songCount} آهنگ</span>
            ${p.crossfade > 0 ? `<span>🔄 کراس‌فید: ${p.crossfade}s</span>` : ''}
          </div>
        </div>
        <button class="icon-btn" title="باز کردن در ارنجر" data-action="open">📂</button>
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
          <span>هنوز پروژه‌ای در آرشیو نیست</span>
          <span style="font-size:0.72rem">با «پروژه جدید» شروع کنید</span>
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
            <span>🎚 <span class="meta-key">${p.tracks}</span> ترک</span>
            <span>🕘 ${escH(p.lastModified)}</span>
          </div>
        </div>
        <div class="project-actions">
          <button class="icon-btn" title="باز کردن" data-action="open">📂</button>
          <button class="icon-btn danger" title="حذف" data-action="delete">🗑</button>
        </div>
      </div>
    `).join('');
  }

  function renderTemplates() {
    const grid = $('hubTemplatesGrid');
    if (!grid) return;

    grid.innerHTML = TEMPLATES.map((t) => `
      <div class="template-card" data-id="${t.id}">
        <div class="template-ic">${t.icon}</div>
        <div class="template-name">${escH(t.name)}</div>
        <div class="template-desc">${escH(t.desc)}</div>
        <div class="template-tags">
          ${t.tags.map((tag) => `<span class="tag ${t.tagClass || ''}">${escH(tag)}</span>`).join('')}
        </div>
        <div class="template-config">
          <span>⏱ ${t.config.tempo} BPM</span>
          <span>🎼 ${escH(t.config.key)}</span>
          <span>🎚 ${t.config.tracks.length} ترک</span>
        </div>
      </div>
    `).join('');
  }

  /* ---------- Actions (یکپارچه با توابع واقعی) ---------- */
  async function openProject(id) {
    // ریست undoStack تا پیام ذخیره نمایش داده نشود
    if (typeof undoStack !== 'undefined') {
      undoStack = [];
      undoIndex = -1;
    }
    if (typeof archLoadSong === 'function') {
      await archLoadSong(id);
    } else if (typeof edLoadFromArchive === 'function') {
      await edLoadFromArchive(id);
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
    if (typeof edNewSong === 'function') {
      await edNewSong();
    } else {
      console.warn('[ProjectHub] edNewSong not available');
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
    if (typeof edNewSong === 'function') {
      await edNewSong();
    }

    // ۳) اعمال تنظیمات قالب روی edCur
    // توجه: عنوان ترانه ست نمیشود — قالب فقط ساختار DAW را تنظیم میکند
    const cfg = template.config;
    try {
      if (edCur) {
        if (cfg.tempo) edCur.tempo = cfg.tempo;
        if (cfg.key) edCur.key = cfg.key;
        if (cfg.keyMode) edCur.keyMode = cfg.keyMode;
        if (cfg.genre) edCur.genre = cfg.genre;
        // اطمینان از باز بودن ویرایشگر
        edCur.editorLocked = false;
      }

      // ۴) تنظیم ترک‌های DAW بر اساس قالب
      if (cfg.tracks && Array.isArray(cfg.tracks) && typeof DAW !== 'undefined') {
        DAW.tracks = JSON.parse(JSON.stringify(cfg.tracks));
        if (typeof ensureAudioCtx === 'function') ensureAudioCtx();
        DAW.tracks.forEach(t => {
          if (t.type === 'audio' && DAW.audioCtx) {
            t._pannerNode = DAW.audioCtx.createStereoPanner();
            t._gainNode = DAW.audioCtx.createGain();
            t._pannerNode.connect(t._gainNode);
            t._gainNode.connect(DAW.masterGain);
          }
        });
      }

      // ۵) تنظیم طول تایم‌لاین
      if (cfg.timelineDuration) DAW.timelineDuration = cfg.timelineDuration;

      // ۶) به‌روزرسانی UI
      if (typeof edSyncToolbar === 'function') edSyncToolbar();
      if (typeof edRenderEditor === 'function') edRenderEditor(true);
      if (typeof renderAll === 'function') renderAll();
      if (typeof saveState === 'function') saveState();

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
    if (typeof archOpen === 'function') {
      archOpen();
    } else if (typeof edOpenArchive === 'function') {
      edOpenArchive();
    }
    closeHub();
  }

  function importProject() {
    if (typeof edImportProject === 'function') {
      edImportProject();
    }
    closeHub();
  }

  function openSettings() {
    if (typeof window.openSettings === 'function') {
      window.openSettings();
    } else {
      const modal = $('settingsModal');
      if (modal) modal.classList.add('show');
    }
    closeHub();
  }

  async function deleteProject(id) {
    if (typeof archTrashSong === 'function') {
      await archTrashSong(id);
      renderProjects();
    } else {
      console.warn('[ProjectHub] archTrashSong not available');
    }
  }

  /* ---------- Arranger Actions ---------- */
  function openArrangerFromPlaylist(id) {
    // Try to open the arranger modal and select the specific playlist
    if (typeof window.openArrangerModal === 'function') {
      window.openArrangerModal();
    } else {
      // Fallback: try to open via the global onclick handler
      const modal = document.getElementById('arrangerModal');
      if (modal) modal.classList.add('show');
    }
    // بستن هاب تا محیط ارنجر دیده شود
    closeHub();
  }

  function createNewArranger() {
    if (typeof window.createNewArranger === 'function') {
      window.createNewArranger();
    } else {
      // Fallback: try the global function
      const modal = document.getElementById('arrangerModal');
      if (modal) modal.classList.add('show');
    }
    // بستن هاب تا محیط ارنجر دیده شود
    closeHub();
  }

  /* ---------- Hub Open/Close ---------- */
  function openHub() {
    const hub = $('projectHub');
    if (!hub) return;
    renderProjects();
    renderTemplates();
    renderArrangerPlaylists();
    hub.classList.add('show');
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

    // Nav buttons
    hub.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        setActiveView(view);
        if (view === 'recent') openHub();
        else if (view === 'new') newProject();
        else if (view === 'open') importProject();
        else if (view === 'templates') openHub();
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
    document.addEventListener('keydown', (e) => {
      if (!hub.classList.contains('show')) return;
      if (e.key === 'Escape') closeHub();
      else if (e.key === 'Enter' && selectedProjectId) openProject(selectedProjectId);
    });

    // ===== صفحه شروع: باز شدن خودکار Hub هنگام لود برنامه =====
    // فقط بار اول (نه بعد از بستن و باز کردن)
    if (isStartup) {
      isStartup = false;
      // کمی تأخیر تا app.js کاملاً لود شود
      setTimeout(() => {
        openHub();
        console.log('[ProjectHub] Startup screen shown');
      }, 400);
    }

    console.log('[ProjectHub] Initialized ✓');
  }

  /* ---------- Expose API ---------- */
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