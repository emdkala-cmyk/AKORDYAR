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
        title: 'تمرین خوانندگی',
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
        title: 'تنظیم آکوستیک',
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
        title: 'پروژه کامل DAW',
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
        title: 'ضبط سریع',
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
        title: 'بکینگ ترک',
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
        title: 'پادکست',
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
  function openProject(id) {
    if (typeof archLoadSong === 'function') {
      archLoadSong(id);
    } else if (typeof edLoadFromArchive === 'function') {
      edLoadFromArchive(id);
    } else {
      console.warn('[ProjectHub] No archive loader available');
    }
    closeHub();
  }

  function newProject() {
    if (typeof edNewSong === 'function') {
      edNewSong();
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

    // ۱) ریست کامل پروژه
    if (typeof edNewSong === 'function') {
      await edNewSong();
    }

    // ۲) اعمال تنظیمات قالب روی edCur
    const cfg = template.config;
    try {
      if (edCur) {
        if (cfg.title) edCur.title = cfg.title;
        if (cfg.tempo) edCur.tempo = cfg.tempo;
        if (cfg.key) edCur.key = cfg.key;
        if (cfg.keyMode) edCur.keyMode = cfg.keyMode;
        if (cfg.genre) edCur.genre = cfg.genre;
      }

      // ۳) تنظیم ترک‌های DAW بر اساس قالب
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

      // ۴) تنظیم طول تایم‌لاین
      if (cfg.timelineDuration) DAW.timelineDuration = cfg.timelineDuration;

      // ۵) به‌روزرسانی UI
      if (typeof edSyncToolbar === 'function') edSyncToolbar();
      if (typeof edRenderEditor === 'function') edRenderEditor(true);
      if (typeof renderAll === 'function') renderAll();
      if (typeof saveState === 'function') saveState();

      console.log(`[ProjectHub] Template applied: ${template.name}`);
    } catch (e) {
      console.error('[ProjectHub] Error applying template:', e);
    }

    closeHub();
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

  /* ---------- Hub Open/Close ---------- */
  function openHub() {
    const hub = $('projectHub');
    if (!hub) return;
    renderProjects();
    renderTemplates();
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

    selectedProjectId = id;
    renderProjects();
  }

  function handleTemplateClick(e) {
    const card = e.target.closest('.template-card');
    if (!card) return;
    const template = TEMPLATES.find((t) => t.id === card.dataset.id);
    if (!template) return;
    createProjectFromTemplate(template);
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
    createFromTemplate: createProjectFromTemplate
  };

  /* ---------- Auto-init ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();