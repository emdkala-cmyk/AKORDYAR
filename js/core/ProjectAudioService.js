/**
 * ProjectAudioService
 *
 * مسئولیت‌ها:
 * - خواندن فایل صوتی از دیسک در Electron
 * - decode کردن AudioBuffer با AudioContext اصلی DAW
 * - import فایل صوتی به‌عنوان Track جدید
 * - بارگذاری state پروژه و restore فایل‌های صوتی
 * - resolve کردن مسیر فایل صوتی برای clipهای جدید و قدیمی
 *
 * این سرویس عمداً مالک state نیست.
 * state اصلی از runtime فعال DAW به سرویس تزریق می‌شود.
 */
class ProjectAudioService {
  constructor({
    state,
    isElectron = false,
    getElectronAPI = null,
    ensureAudioCtx,
    renderTimeline = null,
    getLoadingIndicator = null,
    repairSong = null,
    logger = console
  } = {}) {
    if (!state) {
      throw new TypeError(
        'ProjectAudioService requires a state object'
      );
    }

    if (typeof ensureAudioCtx !== 'function') {
      throw new TypeError(
        'ProjectAudioService requires ensureAudioCtx'
      );
    }

    this.state = state;
    this.isElectron = isElectron;
    this.getElectronAPI =
      typeof getElectronAPI === 'function'
        ? getElectronAPI
        : () => null;

    this.ensureAudioCtx = ensureAudioCtx;
    this.renderTimeline =
      typeof renderTimeline === 'function'
        ? renderTimeline
        : null;

    this.getLoadingIndicator =
      typeof getLoadingIndicator === 'function'
        ? getLoadingIndicator
        : () => null;

    this.repairSong =
      typeof repairSong === 'function'
        ? repairSong
        : (song) => (
            typeof window !== 'undefined'
              ? window.TextEncodingService?.repairSong?.(song) || song
              : song
          );

    this.logger = logger || console;
  }

  /**
   * معادل path.dirname بدون require('path')،
   * چون renderer در Electron با contextIsolation اجرا می‌شود.
   */
  pathDirname(filePath) {
    if (!filePath) {
      return null;
    }

    const normalized = String(filePath).replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');

    if (lastSlash < 0) {
      return null;
    }

    return normalized.substring(0, lastSlash);
  }

  /**
   * معادل سبک path.join بدون وابستگی Node require.
   */
  pathJoin(dir, relativePath) {
    if (!dir) {
      return relativePath;
    }

    if (!relativePath) {
      return dir;
    }

    const normalizedDir = String(dir).replace(/[\\/]+$/, '');
    const normalizedRel = String(relativePath).replace(/^[\\/]+/, '');

    return `${normalizedDir}/${normalizedRel}`;
  }

  /**
   * API Electron فعلی را دریافت می‌کند.
   */
  _electronAPI() {
    try {
      return this.getElectronAPI() || null;
    } catch (error) {
      this.logger.warn(
        '[ProjectAudioService] Failed to resolve electronAPI:',
        error
      );

      return null;
    }
  }

  /**
   * فایل صوتی را از مسیر local disk می‌خواند و decode می‌کند.
   *
   * @param {string} filePath
   * @returns {Promise<AudioBuffer>}
   */
  async loadAudioFromHardDrive(filePath) {
    if (!this.isElectron) {
      throw new Error(
        'این قابلیت فقط در نسخه نصبی دسکتاپ فعال است.'
      );
    }

    const electronAPI = this._electronAPI();

    if (!electronAPI) {
      throw new Error(
        'electronAPI موجود نیست — preload.js رو بررسی کنید'
      );
    }

    if (typeof electronAPI.checkFileExists !== 'function') {
      throw new Error(
        'electronAPI.checkFileExists موجود نیست — preload.js رو بررسی کنید'
      );
    }

    let exists = false;

    try {
      exists = await electronAPI.checkFileExists(filePath);
    } catch (checkError) {
      this.logger.warn(
        '[Audio Load] Error checking file existence:',
        checkError.message
      );

      exists = false;
    }

    if (!exists) {
      throw new Error(`FILE_NOT_FOUND:${filePath}`);
    }

    if (typeof electronAPI.readAudioFile !== 'function') {
      throw new Error(
        'electronAPI.readAudioFile موجود نیست — preload.js رو بررسی کنید'
      );
    }

    let arrayBuffer;

    try {
      arrayBuffer = await electronAPI.readAudioFile(filePath);
    } catch (readError) {
      this.logger.error(
        '[Audio Load] Error reading file:',
        readError.message
      );

      throw new Error(`READ_ERROR:${readError.message}`);
    }

    const audioCtx = this.ensureAudioCtx();

    try {
      return await audioCtx.decodeAudioData(arrayBuffer);
    } catch (decodeError) {
      this.logger.error(
        '[Audio Load] Error decoding audio:',
        decodeError.message
      );

      throw new Error(`DECODE_ERROR:${decodeError.message}`);
    }
  }

  /**
   * یک فایل صوتی انتخاب‌شده را به یک Track جدید تبدیل می‌کند.
   *
   * @param {File} file
   * @param {boolean} [copyToProject=false]
   * @returns {Promise<object>} Track ساخته‌شده
   */
  async handleAudioImport(file, copyToProject = false) {
    if (!file) {
      throw new TypeError(
        'handleAudioImport requires a file'
      );
    }

    const absolutePath =
      this.isElectron && file.path
        ? file.path
        : null;

    const newTrack = {
      id: `track_${Date.now()}`,
      name: file.name,
      isCopied: copyToProject,
      filePath: copyToProject ? null : absolutePath,
      volume: 1.0,
      pan: 0,
      isMuted: false,
      clips: []
    };

    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = this.ensureAudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    newTrack.clips.push({
      id: `clip_${Date.now()}`,
      startTime: 0,
      offset: 0,
      duration: audioBuffer.duration,
      buffer: audioBuffer
    });

    if (audioBuffer.duration > this.state.projectDuration) {
      this.state.projectDuration = audioBuffer.duration;
    }

    this.state.tracks.push(newTrack);

    if (this.renderTimeline) {
      this.renderTimeline();
    }

    return newTrack;
  }

  /**
   * پروژه را به state فعلی بازمی‌گرداند و فایل‌های صوتی را resolve می‌کند.
   *
   * @param {object} projectData
   * @param {string|null} [projectFilePath=null]
   * @returns {Promise<void>}
   */
  async loadProject(projectData, projectFilePath = null) {
    if (!projectData || typeof projectData !== 'object') {
      throw new TypeError('loadProject requires project data');
    }

    const loader = this.getLoadingIndicator();

    if (loader) {
      loader.style.display = 'block';
    }

    try {

    // رفتار قبلی عمداً حفظ شده: در صورت خطای غیرمنتظره، loader همانند قبل
    // توسط caller یا مسیر بعدی مدیریت می‌شود.
    this.state.pool = {};

    if (
      this.state.bufferCache &&
      typeof this.state.bufferCache.clear === 'function'
    ) {
      this.state.bufferCache.clear();
    }

    this.state.tracks = [];
    this.state.clips = [];

    this.state.project = projectData.project || {};
    this.state.projectRoot = projectFilePath
      ? this.pathDirname(projectFilePath)
      : null;

    if (projectData.pool) {
      this.state.pool = projectData.pool;
    }

    this.state.tracks = projectData.tracks || [];
    this.state.clips = projectData.clips || [];
    this.state.sections = projectData.sections || [];
    this.state.song = this.repairSong(projectData.song || null);
    this.state.edSeqPoints = projectData.edSeqPoints || [];

    for (const [clipId, clip] of Object.entries(this.state.pool)) {
      try {
        await this.resolveClipAudio(clip, projectFilePath);
      } catch (error) {
        this.logger.warn(
          `فایل صوتی برای کلیپ ${clipId} پیدا نشد:`,
          error.message
        );

        clip.runtime = {
          loaded: false,
          error: error.message
        };
      }
    }

    for (const clip of this.state.clips) {
      const hasCachedBuffer =
        this.state.bufferCache &&
        this.state.bufferCache.has(clip.id);

      if (
        clip.type !== 'chord' &&
        clip.relativePath &&
        !hasCachedBuffer
      ) {
        try {
          const tempClip = {
            id: clip.id || `clip_${Date.now()}`,
            fileName: clip.fileName || clip.name,
            relativePath: clip.relativePath,
            storage: {
              mode: 'copy',
              projectPath: clip.relativePath
            }
          };

          await this.resolveClipAudio(
            tempClip,
            projectFilePath
          );

          const buffer =
            this.state.bufferCache.get(tempClip.id);

          if (buffer) {
            this.state.bufferCache.set(
              clip.id || tempClip.id,
              buffer
            );
          }
        } catch (error) {
          this.logger.warn(
            'لود کلیپ قدیمی شکست خورد:',
            error.message
          );
        }
      }
    }

    this.state.projectDuration =
      projectData.projectDuration || 0;

    if (this.renderTimeline) {
      this.renderTimeline();
    }

    } finally {
      if (loader) {
        loader.style.display = 'none';
      }
    }
  }

  /**
   * مسیر فایل صوتی Clip را resolve کرده، decode می‌کند و در bufferCache می‌گذارد.
   *
   * @param {object} clip
   * @param {string|null} [projectFilePath=null]
   * @returns {Promise<AudioBuffer>}
   */
  async resolveClipAudio(clip, projectFilePath = null) {
    if (!clip) {
      throw new TypeError(
        'resolveClipAudio requires a clip'
      );
    }

    const electronAPI = this._electronAPI();
    let filePath = null;

    if (clip.storage && clip.storage.mode === 'copy') {
      const projectRoot = projectFilePath
        ? this.pathDirname(projectFilePath)
        : this.state.projectRoot;

      if (!projectRoot || !clip.storage.projectPath) {
        throw new Error(
          `Project root is missing for clip: ${clip.id}`
        );
      }

      filePath =
        electronAPI &&
        typeof electronAPI.resolvePath === 'function'
          ? await electronAPI.resolvePath(
              projectRoot,
              clip.storage.projectPath
            )
          : this.pathJoin(
              projectRoot,
              clip.storage.projectPath
            );
    } else if (
      clip.storage &&
      clip.storage.mode === 'reference'
    ) {
      filePath = clip.storage.externalPath;
    } else if (clip.relativePath) {
      const projectRoot = projectFilePath
        ? this.pathDirname(projectFilePath)
        : this.state.projectRoot;

      if (projectRoot) {
        filePath =
          electronAPI &&
          typeof electronAPI.resolvePath === 'function'
            ? await electronAPI.resolvePath(
                projectRoot,
                clip.relativePath
              )
            : this.pathJoin(
                projectRoot,
                clip.relativePath
              );
      }
    } else if (clip._filePath) {
      filePath = clip._filePath;
    } else if (clip.filePath) {
      filePath = clip.filePath;
    }

    if (!filePath) {
      throw new Error(
        `No audio path for clip: ${clip.id || 'unknown'}`
      );
    }

    if (
      !electronAPI ||
      typeof electronAPI.readAudioFile !== 'function'
    ) {
      throw new Error(
        'Electron API not available for reading audio files'
      );
    }

    const arrayBuffer =
      await electronAPI.readAudioFile(filePath);

    if (!arrayBuffer) {
      throw new Error(
        `Failed to read audio file: ${filePath}`
      );
    }

    const audioCtx = this.ensureAudioCtx();

    const audioBuffer =
      await audioCtx.decodeAudioData(
        arrayBuffer.slice(0)
      );

    this.state.bufferCache.set(
      clip.id,
      audioBuffer
    );

    clip.runtime = {
      loaded: true,
      resolvedPath: filePath,
      loadedAt: Date.now()
    };

    return audioBuffer;
  }
}

if (typeof window !== 'undefined') {
  window.ProjectAudioService = ProjectAudioService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectAudioService;
}
