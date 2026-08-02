/**
 * preload.js
 * پل ارتباطی بین Electron Main و Renderer Process
 * امنیت را با contextIsolation فراهم می‌کند
 */

const { contextBridge, ipcRenderer } = require('electron');

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
        const validChannels = [
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
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, callback);
        }
    },

    /**
     * حذف listener برای پیام‌های منو
     * @param {string} channel - نام کانال پیام
     * @param {Function} callback - تابعی که باید حذف شود
     */
    offMenuCommand: (channel, callback) => {
        const validChannels = [
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
        ];
        if (validChannels.includes(channel)) {
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
    readAudioFile: (filePath) => ipcRenderer.invoke('audio:read-file', filePath),

    /**
     * کپی فایل به پوشه پروژه
     * @param {string} sourcePath - مسیر فایل مبدا
     * @param {string} projectAudioDir - مسیر پوشه audio پروژه
     * @returns {Promise<Object>}
     */
    copyFile: (sourcePath, projectAudioDir) => 
        ipcRenderer.invoke('audio:copy-to-project', sourcePath, projectAudioDir),

    /**
     * حذف فایل
     * @param {string} filePath - مسیر فایل
     * @returns {Promise<Object>}
     */
    deleteFile: (filePath) => ipcRenderer.invoke('audio:delete-file', filePath),

    /**
     * تبدیل مسیر نسبی به مطلق
     * @param {string} projectFilePath - مسیر فایل پروژه
     * @param {string} relativePath - مسیر نسبی
     * @returns {Promise<string>}
     */
    resolvePath: (projectFilePath, relativePath) => 
        ipcRenderer.invoke('audio:resolve-path', projectFilePath, relativePath),

    // ============================================
    // Dialog Operations
    // ============================================

    /**
     * نمایش پیام باکس (برای پرسش کپی/لینک)
     * @param {Object} options - تنظیمات پیام
     * @returns {Promise<number>} ایندکس دکمه انتخاب شده
     */
    showMessageBox: (options) => ipcRenderer.invoke('dialog:show-message-box', options),

    /**
     * نمایش دیالوگ باز کردن فایل
     * @returns {Promise<string|null>} مسیر فایل انتخاب شده
     */
    openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),

    /**
     * نمایش دیالوگ ذخیره فایل
     * @returns {Promise<string|null>} مسیر فایل برای ذخیره
     */
    saveFileDialog: () => ipcRenderer.invoke('dialog:save-file'),

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
        ipcRenderer.invoke('project:save-with-audio', projectData, filePath),

    /**
     * بارگذاری فایل پروژه
     * @param {string} filePath - مسیر فایل پروژه
     * @returns {Promise<Object>}
     */
    loadProjectFile: (filePath) => ipcRenderer.invoke('project:load-file', filePath),

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
    checkFileExists: (filePath) => ipcRenderer.invoke('fs:check-exists', filePath),

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
    })
});

console.log('[Preload] electronAPI exposed to renderer');
