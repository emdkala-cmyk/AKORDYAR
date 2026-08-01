/**
 * FileSystemBridge.js
 * لایه انتزاعی برای دسترسی به فایل سیستم.
 * در وب از IndexedDB و در الکترون از fs ماژول استفاده می‌کند.
 */

class FileSystemBridge {
    constructor() {
        this.isElectron = !!(window.electronAPI); // فرض بر وجود API الکترون
        this.dbName = 'DAW_Project_DB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        if (!this.isElectron) {
            return this.initIndexedDB();
        }
        return Promise.resolve();
    }

    // --- IndexedDB Logic (Web Fallback) ---
    initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('audioFiles')) {
                    db.createObjectStore('audioFiles', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'id' });
                }
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async saveAudioFile(id, fileBlob, originalPath) {
        if (this.isElectron) {
            // در الکترون، فایل فیزیکی کپی می‌شود، اینجا فقط متادیتا ذخیره می‌شود
            // عملیات کپی توسط ProjectStore انجام می‌شود
            return { path: originalPath, type: 'electron' };
        } else {
            // در وب، فایل را در IndexedDB ذخیره می‌کنیم
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['audioFiles'], 'readwrite');
                const store = transaction.objectStore('audioFiles');
                const record = { id, blob: fileBlob, path: originalPath };
                const request = store.put(record);
                request.onsuccess = () => resolve({ id, type: 'indexeddb' });
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getAudioFile(id) {
        if (this.isElectron) {
            // در الکترون، مسیر از پروژه خوانده شده و مستقیماً لود می‌شود
            throw new Error("Use loadAudioFromPath in Electron mode");
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['audioFiles'], 'readonly');
                const store = transaction.objectStore('audioFiles');
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    // الکترون API Call Mock (در محیط واقعی توسط preload.js پر می‌شود)
    async copyFileToProject(sourcePath, projectAudioDir) {
        if (this.isElectron && window.electronAPI) {
            return await window.electronAPI.copyFile(sourcePath, projectAudioDir);
        }
        throw new Error("File copying is only supported in Electron or via Blob in Web");
    }
}

window.FileSystemBridge = new FileSystemBridge();
