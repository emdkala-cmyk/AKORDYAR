/**
 * ElectronMenuCommandService
 *
 * اتصال منوی native Electron به توابع واقعی رابط کاربری.
 * این فایل عمداً مستقل از app/core.js است تا منطق منو دوباره وارد فایل
 * بزرگ هسته نشود و مسیر اجرای فرمان‌ها یک نقطهٔ قابل تست داشته باشد.
 */
(function attachElectronMenuCommandService(globalScope) {
  'use strict';

  const FUNCTION_NOT_FOUND = Object.freeze({
    newSong: 'مدیریت ایجاد پروژه بارگذاری نشده است',
    openProject: 'مدیریت باز کردن پروژه بارگذاری نشده است',
    save: 'مدیریت ذخیره پروژه بارگذاری نشده است',
    export: 'مدیریت خروجی کامل پروژه بارگذاری نشده است',
    playback: 'کنترل پخش بارگذاری نشده است',
    stop: 'کنترل توقف پخش بارگذاری نشده است',
    seek: 'کنترل مکان‌نمای پخش بارگذاری نشده است',
    arranger: 'پنجرهٔ ارنجر بارگذاری نشده است',
    archive: 'آرشیو آهنگ‌ها بارگذاری نشده است',
    score: 'کنترلر نت بارگذاری نشده است',
    settings: 'مدیریت تنظیمات بارگذاری نشده است'
  });

  function requireFunction(name, errorMessage) {
    const fn = globalScope[name];
    if (typeof fn !== 'function') throw new Error(errorMessage);
    return fn;
  }

  function actionMap() {
    return {
      'menu-new-song': {
        label: 'ایجاد پروژه جدید',
        run: () => requireFunction('edNewSong', FUNCTION_NOT_FOUND.newSong)()
      },
      'menu-open-project': {
        label: 'باز کردن پروژه',
        run: () => requireFunction('edImportProject', FUNCTION_NOT_FOUND.openProject)()
      },
      'menu-save': {
        label: 'ذخیره پروژه',
        run: () => requireFunction('edSaveSong', FUNCTION_NOT_FOUND.save)()
      },
      'menu-save-as': {
        label: 'ذخیرهٔ پروژه با نام جدید',
        run: () => requireFunction('edExportProjectFull', FUNCTION_NOT_FOUND.export)()
      },
      'menu-export': {
        label: 'خروجی پروژه',
        run: () => requireFunction('edExportProjectFull', FUNCTION_NOT_FOUND.export)()
      },
      'menu-import': {
        label: 'ورود پروژه',
        run: () => requireFunction('edImportProject', FUNCTION_NOT_FOUND.openProject)()
      },
      'menu-play-pause': {
        label: 'پخش/توقف',
        run: () => {
          const getDAW = requireFunction('getEditorDAW', FUNCTION_NOT_FOUND.playback);
          const actionName = getDAW()?.isPlaying ? 'pauseTransport' : 'startTransport';
          return requireFunction(actionName, FUNCTION_NOT_FOUND.playback)();
        }
      },
      'menu-stop': {
        label: 'توقف پخش',
        run: () => requireFunction('stopTransport', FUNCTION_NOT_FOUND.stop)()
      },
      'menu-go-to-start': {
        label: 'رفتن به ابتدای پروژه',
        run: () => requireFunction('transportToStart', FUNCTION_NOT_FOUND.seek)()
      },
      'menu-go-to-end': {
        label: 'رفتن به انتهای پروژه',
        run: () => requireFunction('transportToEnd', FUNCTION_NOT_FOUND.seek)()
      },
      'menu-arranger': {
        label: 'ارنجر',
        run: () => requireFunction('openArrangerModal', FUNCTION_NOT_FOUND.arranger)()
      },
      'menu-archive': {
        label: 'آرشیو آهنگ‌ها',
        run: () => requireFunction('edOpenArchive', FUNCTION_NOT_FOUND.archive)()
      },
      'menu-midi-settings': {
        label: 'نمایش نت MIDI/MusicXML',
        run: () => requireFunction('getMidiScoreController', FUNCTION_NOT_FOUND.score)()?.open?.()
      },
      'menu-preferences': {
        label: 'تنظیمات برنامه',
        run: () => requireFunction('openSettings', FUNCTION_NOT_FOUND.settings)()
      }
    };
  }

  function create({
    electronApi = globalScope.electronAPI,
    notify = globalScope.toast,
    logger = globalScope.console
  } = {}) {
    const actions = actionMap();

    function execute(command) {
      const action = actions[command];
      if (!action) return false;
      Promise.resolve()
        .then(() => action.run())
        .catch(error => {
          logger?.error?.(`[Menu] ${action.label} failed:`, error);
          if (typeof notify === 'function') {
            notify(`خطا در ${action.label}: ${error?.message || error}`);
          }
        });
      return true;
    }

    function bind() {
      if (!electronApi?.onMenuCommand) return false;
      Object.keys(actions).forEach(command => {
        electronApi.onMenuCommand(command, () => execute(command));
      });
      return true;
    }

    return Object.freeze({ bind, execute, commands: () => Object.keys(actions) });
  }

  const api = Object.freeze({ create, actionMap });
  globalScope.ElectronMenuCommandService = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
