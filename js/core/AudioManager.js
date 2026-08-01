/**
 * AudioManager.js
 * مدیریت فایل‌های صوتی در پروژه DAW
 * پشتیبانی از حالت وب (IndexedDB) و الکترون (File System)
 */

class AudioManager {
    constructor() {
        this.audioFiles = new Map(); // ذخیره اطلاعات فایل‌های لود شده
        this.fileSystemBridge = window.FileSystemBridge;
        this.projectAudioDir = null; // مسیر پوشه audio پروژه
    }

    /**
     * مقداردهی اولیه و اتصال به سیستم فایل
     */
    async init() {
        await this.fileSystemBridge.init();
        console.log('AudioManager initialized');
    }

    /**
     * تولید ID یکتا برای فایل صوتی
     */
    generateFileId() {
        return 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * پردازش فایل صوتی ورودی (از طریق Drag & Drop یا Input)
     * @param {File} file - فایل انتخاب شده توسط کاربر
     * @param {string} originalPath - مسیر اصلی فایل (در صورت دسترسی)
     * @returns {Promise<Object>} اطلاعات فایل پردازش شده
     */
    async processAudioFile(file, originalPath = null) {
        const fileId = this.generateFileId();
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        // بررسی فرمت فایل
        const supportedFormats = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
        if (!supportedFormats.includes(fileExtension)) {
            throw new Error(`فرمت فایل ${fileExtension} پشتیبانی نمی‌شود. فرمت‌های مجاز: ${supportedFormats.join(', ')}`);
        }

        // نمایش دیالوگ کپی/لینک به کاربر
        const copyToProject = await this.showCopyLinkDialog(fileName);

        let storageInfo;
        
        if (copyToProject) {
            // حالت کپی: فایل به پوشه پروژه منتقل می‌شود
            storageInfo = await this.copyFileToProject(file, fileId, originalPath);
        } else {
            // حالت لینک: فقط مسیر فایل ذخیره می‌شود
            storageInfo = await this.linkFile(file, fileId, originalPath);
        }

        // ذخیره اطلاعات فایل در حافظه موقت
        const audioData = {
            id: fileId,
            name: fileName,
            format: fileExtension,
            size: file.size,
            duration: null, // بعداً محاسبه می‌شود
            waveform: null, // بعداً ساخته می‌شود
            ...storageInfo
        };

        this.audioFiles.set(fileId, audioData);
        
        return audioData;
    }

    /**
     * نمایش دیالوگ پرسش کپی یا لینک کردن فایل
     */
    showCopyLinkDialog(fileName) {
        return new Promise((resolve) => {
            // اگر در محیط الکترون هستیم، از دیالوگ نیتیو استفاده می‌کنیم
            if (this.fileSystemBridge.isElectron && window.electronAPI) {
                window.electronAPI.showMessageBox({
                    type: 'question',
                    buttons: ['کپی در پروژه', 'لینک به فایل اصلی'],
                    defaultId: 0,
                    title: 'مدیریت فایل صوتی',
                    message: `فایل "${fileName}" را چگونه مدیریت کنیم؟`,
                    detail: 'کپی در پروژه: فایل به پوشه پروژه منتقل می‌شود (پایدارتر)\nلینک به فایل اصلی: فقط مسیر فایل ذخیره می‌شود (حجم کمتر)'
                }).then(result => {
                    resolve(result.response === 0); // 0 = کپی، 1 = لینک
                });
            } else {
                // در محیط وب، از confirm ساده استفاده می‌کنیم
                const result = confirm(
                    `فایل "${fileName}" را چگونه مدیریت کنیم؟\n\n` +
                    'OK (کپی): فایل در پروژه ذخیره می‌شود (پیشنهادی)\n' +
                    'Cancel (لینک): فقط به فایل اصلی لینک می‌شود'
                );
                resolve(result);
            }
        });
    }

    /**
     * کپی فایل به پوشه پروژه
     */
    async copyFileToProject(file, fileId, originalPath) {
        if (this.fileSystemBridge.isElectron) {
            // در الکترون، فایل به صورت فیزیکی کپی می‌شود
            const relativePath = `audio/${fileId}_${file.name}`;
            
            try {
                const result = await this.fileSystemBridge.copyFileToProject(
                    originalPath || file.path,
                    this.projectAudioDir || './audio'
                );
                
                return {
                    path: result.destinationPath,
                    type: 'copied',
                    isEmbedded: false
                };
            } catch (error) {
                console.error('Error copying file:', error);
                throw error;
            }
        } else {
            // در وب، فایل در IndexedDB ذخیره می‌شود
            await this.fileSystemBridge.saveAudioFile(fileId, file, originalPath);
            
            return {
                path: null,
                type: 'indexeddb',
                isEmbedded: true
            };
        }
    }

    /**
     * لینک کردن فایل بدون کپی
     */
    async linkFile(file, fileId, originalPath) {
        const absolutePath = originalPath || (file.path ? file.path : null);
        
        if (!absolutePath) {
            // در وب بدون مسیر، چاره‌ای جز ذخیره در IndexedDB نیست
            console.warn('مسیر فایل در دسترس نیست، ذخیره در IndexedDB');
            return await this.copyFileToProject(file, fileId, null);
        }

        if (this.fileSystemBridge.isElectron) {
            // در الکترون، فقط مسیر ذخیره می‌شود
            return {
                path: absolutePath,
                type: 'linked',
                isEmbedded: false
            };
        } else {
            // در وب، همچنان نیاز به ذخیره Blob داریم چون به فایل سیستم دسترسی نداریم
            await this.fileSystemBridge.saveAudioFile(fileId, file, absolutePath);
            
            return {
                path: absolutePath,
                type: 'linked_web',
                isEmbedded: true
            };
        }
    }

    /**
     * لود فایل صوتی از مسیر ذخیره شده
     */
    async loadAudioFromFile(audioData) {
        if (audioData.type === 'indexeddb' || audioData.type === 'linked_web') {
            // لود از IndexedDB
            const record = await this.fileSystemBridge.getAudioFile(audioData.id);
            if (!record) {
                throw new Error('فایل صوتی در پایگاه داده یافت نشد');
            }
            
            const url = URL.createObjectURL(record.blob);
            return {
                url: url,
                blob: record.blob,
                path: record.path
            };
        } else if (audioData.type === 'copied' || audioData.type === 'linked') {
            // لود از فایل سیستم (الکترون)
            if (this.fileSystemBridge.isElectron && window.electronAPI) {
                const arrayBuffer = await window.electronAPI.readAudioFile(audioData.path);
                const blob = new Blob([arrayBuffer], { type: 'audio/' + audioData.format });
                const url = URL.createObjectURL(blob);
                
                return {
                    url: url,
                    blob: blob,
                    path: audioData.path
                };
            } else {
                throw new Error('دسترسی به فایل سیستم نیازمند Electron است');
            }
        }
        
        throw new Error('نوع ذخیره‌سازی نامعتبر');
    }

    /**
     * ساخت Waveform از فایل صوتی
     */
    async generateWaveform(audioData, audioBuffer) {
        const samples = audioBuffer.getChannelData(0); // کانال چپ
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.length / sampleRate;
        
        // کاهش تعداد نمونه‌ها برای نمایش waveform
        const waveformData = this.downsampleForWaveform(samples, 1000); // 1000 نقطه
        
        audioData.waveform = {
            data: waveformData,
            duration: duration,
            sampleRate: sampleRate
        };
        
        return audioData.waveform;
    }

    /**
     * کاهش نمونه‌ها برای نمایش waveform
     */
    downsampleForWaveform(samples, targetLength) {
        const blockSize = Math.floor(samples.length / targetLength);
        const downsampled = new Float32Array(targetLength);
        
        for (let i = 0; i < targetLength; i++) {
            const start = i * blockSize;
            let sum = 0;
            let max = 0;
            
            for (let j = 0; j < blockSize; j++) {
                const sample = Math.abs(samples[start + j]);
                sum += sample;
                if (sample > max) max = sample;
            }
            
            // استفاده از میانگین یا ماکزیمم
            downsampled[i] = max; // ماکزیمم برای نمایش بهتر
        }
        
        return downsampled;
    }

    /**
     * دریافت اطلاعات فایل از ID
     */
    getAudioFile(fileId) {
        return this.audioFiles.get(fileId);
    }

    /**
     * حذف فایل صوتی
     */
    async removeAudioFile(fileId) {
        const audioData = this.audioFiles.get(fileId);
        if (!audioData) return;

        // در وب، از IndexedDB حذف شود
        if (audioData.isEmbedded && !this.fileSystemBridge.isElectron) {
            // نیاز به متد حذف در FileSystemBridge
            console.log('فایل از IndexedDB حذف خواهد شد');
        }

        // در الکترون، اگر فایل کپی شده باشد، از فایل سیستم حذف شود
        if (audioData.type === 'copied' && this.fileSystemBridge.isElectron) {
            if (window.electronAPI) {
                await window.electronAPI.deleteFile(audioData.path);
            }
        }

        this.audioFiles.delete(fileId);
    }

    /**
     * تنظیم مسیر پوشه audio پروژه
     */
    setProjectAudioDir(dirPath) {
        this.projectAudioDir = dirPath;
    }

    /**
     * صادرات اطلاعات فایل‌ها برای ذخیره در پروژه
     */
    exportAudioFilesData() {
        const exported = {};
        this.audioFiles.forEach((data, id) => {
            exported[id] = {
                id: data.id,
                name: data.name,
                format: data.format,
                size: data.size,
                path: data.path,
                type: data.type,
                isEmbedded: data.isEmbedded,
                duration: data.duration,
                waveform: data.waveform ? {
                    data: Array.from(data.waveform.data), // تبدیل به آرایه معمولی برای JSON
                    duration: data.waveform.duration,
                    sampleRate: data.waveform.sampleRate
                } : null
            };
        });
        return exported;
    }

    /**
     * ایمپورت اطلاعات فایل‌ها از پروژه ذخیره شده
     */
    importAudioFilesData(exportedData) {
        this.audioFiles.clear();
        Object.keys(exportedData).forEach(id => {
            const data = exportedData[id];
            this.audioFiles.set(id, data);
        });
    }
}

// ایجاد نمونه سینگلتون
window.AudioManager = new AudioManager();
