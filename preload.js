/**
* preload.js
 * Bridge between Electron Main and Renderer Process.
 * 
 * Architecture: contextIsolation + contextBridge (secure pattern)
 * 
 * IPC Channels (Main → Renderer):
 *   menu-new-song, menu-open-project, menu-save, menu-save-as,
 *   menu-export, menu-import, menu-play-pause, menu-stop,
 *   menu-go-to-start, menu-go-to-end, menu-arranger, menu-archive,
 *   menu-midi-settings, menu-preferences
 * 
 * Renderer → Main (via electronAPI):
 *   checkFileExists, readAudioFile, readFileUtf8, writeFile,
 *   resolvePath, getProjectDir, showSaveDialog, showOpenDialog,
 *   readDir, prepareRecordings
*/

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const MENU_CHANNELS = Object.freeze([
    'menu-new-song',
    'menu-open-project',
    'menu-save',
    'menu-save-as',
    'menu-export',
    'menu-import',
    'menu-play-pause',
    'menu-stop',
    'menu-go-to-start',
    'menu-go-to-end',
    'menu-arranger',
    'menu-archive',
    'menu-midi-settings',
    'menu-preferences'
]);

const INVOKE_CHANNELS = Object.freeze([
    'audio:read-file',
    'audio:copy-to-project',
    'audio:delete-file',
    'audio:resolve-path',
    'dialog:show-message-box',
    'dialog:open-file',
    'dialog:save-file',
    'project:save-with-audio',
    'project:write-json',
    'project:load-file',
    'fs:check-exists',
    'print:open-window'
]);

function invoke(channel, ...args) {
    if (!INVOKE_CHANNELS.includes(channel)) {
        throw new Error(`IPC channel is not whitelisted: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
}

// تعریف API ای که در دسترس renderer قرار می‌گیرد
contextBridge.exposeInMainWorld('electronAPI', {
    // تشخیص محیط الکترون
    isElectron: true,

    // ============================================
    // Menu Event Listeners (دریافت پیام‌ها از Main Process)
    // ============================================
    
    /**
     * ثبت listener برای پیام‌های منوی اصلی
     * @param {string} channel - نام کانال پیام
     * @param {Function} callback - تابعی که هنگام دریافت پیام اجرا می‌شود
     */
    onMenuCommand: (channel, callback) => {
        if (MENU_CHANNELS.includes(channel) && typeof callback === 'function') {
            ipcRenderer.on(channel, callback);
        }
    },

    /**
     * حذف listener برای پیام‌های منو
     * @param {string} channel - نام کانال پیام
     * @param {Function} callback - تابعی که باید حذف شود
     */
    offMenuCommand: (channel, callback) => {
        if (MENU_CHANNELS.includes(channel) && typeof callback === 'function') {
            ipcRenderer.removeListener(channel, callback);
        }
    },

    // ============================================
    // Audio File Operations
    // ============================================
    
    /**
     * خواندن فایل صوتی از هارد دیسک
     * @param {string} filePath - مسیر مطلق فایل
     * @returns {Promise<ArrayBuffer>}
     */
    readAudioFile: (filePath) => invoke('audio:read-file', filePath),

    /**
     * دریافت مسیر واقعی فایل انتخاب‌شده در Electron.
     * در نسخه‌های جدید Electron، file.path از renderer حذف شده و
     * باید از webUtils.getPathForFile در preload استفاده شود.
     */
    getPathForFile: (file) => {
        try {
            return webUtils?.getPathForFile?.(file) || null;
        } catch (_) {
            return null;
        }
    },

    /**
     * کپی فایل به پوشه پروژه
     * @param {string} sourcePath - مسیر فایل مبدا
     * @param {string} projectAudioDir - مسیر پوشه audio پروژه
     * @returns {Promise<Object>}
     */
    copyFile: (sourcePath, projectAudioDir) => 
        invoke('audio:copy-to-project', sourcePath, projectAudioDir),

    /**
     * حذف فایل
     * @param {string} filePath - مسیر فایل
     * @returns {Promise<Object>}
     */
    deleteFile: (filePath) => invoke('audio:delete-file', filePath),

    /**
     * تبدیل مسیر نسبی به مطلق
     * @param {string} projectFilePath - مسیر فایل پروژه
     * @param {string} relativePath - مسیر نسبی
     * @returns {Promise<string>}
     */
    resolvePath: (projectFilePath, relativePath) => 
        invoke('audio:resolve-path', projectFilePath, relativePath),

    // ============================================
    // Dialog Operations
    // ============================================

    /**
     * نمایش پیام باکس (برای پرسش کپی/لینک)
     * @param {Object} options - تنظیمات پیام
     * @returns {Promise<number>} ایندکس دکمه انتخاب شده
     */
    showMessageBox: (options) => invoke('dialog:show-message-box', options),

    /**
     * نمایش دیالوگ باز کردن فایل
     * @returns {Promise<string|null>} مسیر فایل انتخاب شده
     */
    openFileDialog: () => invoke('dialog:open-file'),

    /**
     * نمایش دیالوگ ذخیره فایل
     * @returns {Promise<string|null>} مسیر فایل برای ذخیره
     */
    saveFileDialog: (options = {}) => invoke('dialog:save-file', options),

    // ============================================
    // Project Operations
    // ============================================

    /**
     * ذخیره پروژه همراه با فایل‌های صوتی
     * @param {Object} projectData - داده‌های پروژه
     * @param {string} filePath - مسیر فایل پروژه
     * @returns {Promise<string>}
     */
    saveProjectWithAudio: (projectData, filePath) => 
        invoke('project:save-with-audio', projectData, filePath),

    /**
     * ذخیرهٔ JSON پروژه در مسیر انتخاب‌شده در Electron
     * @param {string} filePath - مسیر فایل پروژه
     * @param {string} content - محتوای JSON
     * @returns {Promise<string>}
     */
    writeProjectJson: (filePath, content) =>
        invoke('project:write-json', filePath, content),

    /**
     * بارگذاری فایل پروژه
     * @param {string} filePath - مسیر فایل پروژه
     * @returns {Promise<Object>}
     */
    loadProjectFile: (filePath) => invoke('project:load-file', filePath),

    /**
     * دریافت دایرکتوری پروژه از مسیر فایل
     * @param {string} filePath - مسیر فایل پروژه
     * @returns {Promise<string>}
     */
    getProjectDir: async (filePath) => {
        const path = await import('path');
        return path.dirname(filePath);
    },

    /**
     * بررسی وجود فایل
     * @param {string} filePath - مسیر فایل
     * @returns {Promise<boolean>}
     */
    checkFileExists: (filePath) => invoke('fs:check-exists', filePath),

    // ============================================
    // Platform Info
    // ============================================

    /**
     * دریافت اطلاعات پلتفرم
     * @returns {Object}
     */
    getPlatformInfo: () => ({
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron
    }),

    // ============================================
    // Print Operations
    // ============================================

    /**
     * چاپ محتوای HTML در یک پنجره چاپ جداگانه
     * @param {string} htmlContent - محتوای HTML برای چاپ
     * @returns {Promise<Object>}
     */
    printHtml: (htmlContent) => invoke('print:open-window', htmlContent)
});

console.log('[Preload] electronAPI exposed to renderer');
