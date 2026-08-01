/**
 * ProjectStore.js
 * مدیریت ذخیره و بارگذاری پروژه‌ها با پشتیبانی از فایل‌های صوتی
 */

class ProjectStore {
    constructor() {
        this.currentProject = null;
        this.projectFilePath = null;
        this.fileSystemBridge = window.FileSystemBridge;
        this.audioManager = window.AudioManager;
    }

    /**
     * ایجاد پروژه جدید
     */
    createNewProject(projectName = 'Untitled Project') {
        this.currentProject = {
            id: this.generateProjectId(),
            name: projectName,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            tracks: [],
            clips: [],
            audioFiles: {},
            settings: {
                sampleRate: 44100,
                bitDepth: 16,
                tempo: 120
            }
        };
        this.projectFilePath = null;
        return this.currentProject;
    }

    /**
     * تولید ID یکتا برای پروژه
     */
    generateProjectId() {
        return 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * ذخیره پروژه
     * @param {Object} projectData - داده‌های پروژه
     * @param {string} filePath - مسیر فایل پروژه (اختیاری)
     */
    async saveProject(projectData, filePath = null) {
        const dataToSave = {
            ...projectData,
            modifiedAt: new Date().toISOString(),
            version: '1.0',
            app: 'Akordyar DAW'
        };

        if (this.fileSystemBridge.isElectron && window.electronAPI) {
            // در الکترون، پروژه به صورت فایل JSON ذخیره می‌شود
            let savePath = filePath || this.projectFilePath;
            
            if (!savePath) {
                // نمایش دیالوگ Save As
                savePath = await window.electronAPI.saveFileDialog();
                if (!savePath) return null;
            }

            // اطمینان از پسوند .akr یا .json
            if (!savePath.endsWith('.akr') && !savePath.endsWith('.json')) {
                savePath += '.akr';
            }

            // تنظیم پوشه audio پروژه
            const projectDir = await window.electronAPI.getProjectDir(savePath);
            const audioDir = projectDir + '/Audio';
            this.audioManager.setProjectAudioDir(audioDir);

            // استفاده از IPC برای ذخیره با کپی فایل‌های صوتی
            try {
                const savedPath = await window.electronAPI.saveProjectWithAudio(dataToSave, savePath);
                this.projectFilePath = savedPath;
                console.log('Project saved to:', savedPath);
                return savedPath;
            } catch (error) {
                console.error('Error saving project:', error);
                throw error;
            }
        } else {
            // در وب، پروژه در LocalStorage یا IndexedDB ذخیره می‌شود
            const projectId = dataToSave.id || this.generateProjectId();
            
            // ذخیره متادیتای پروژه در LocalStorage
            const projectMeta = {
                id: projectId,
                name: dataToSave.name,
                modifiedAt: dataToSave.modifiedAt,
                hasAudioFiles: Object.keys(dataToSave.audioFiles || {}).length > 0
            };
            
            localStorage.setItem('current_project_meta', JSON.stringify(projectMeta));
            localStorage.setItem('project_' + projectId, JSON.stringify(dataToSave));
            
            // فایل‌های صوتی قبلاً در IndexedDB ذخیره شده‌اند
            console.log('Project saved to LocalStorage/IndexedDB');
            return projectId;
        }
    }

    /**
     * بارگذاری پروژه
     * @param {string} filePath - مسیر فایل پروژه (در الکترون) یا ID پروژه (در وب)
     */
    async loadProject(filePathOrId) {
        if (this.fileSystemBridge.isElectron && window.electronAPI) {
            // در الکترون، فایل پروژه خوانده می‌شود
            try {
                const projectData = await window.electronAPI.loadProjectFile(filePathOrId);
                
                if (!projectData) {
                    throw new Error('فایل پروژه یافت نشد یا معتبر نیست');
                }

                this.currentProject = projectData;
                this.projectFilePath = filePathOrId;

                // ایمپورت اطلاعات فایل‌های صوتی
                if (projectData.audioFiles) {
                    this.audioManager.importAudioFilesData(projectData.audioFiles);
                }

                // بازسازی کلیپ‌ها و لود فایل‌های صوتی
                await this.restoreAudioClips(projectData.clips);

                console.log('Project loaded from:', filePathOrId);
                return projectData;
            } catch (error) {
                console.error('Error loading project:', error);
                throw error;
            }
        } else {
            // در وب، از LocalStorage/IndexedDB خوانده می‌شود
            const projectId = filePathOrId;
            const stored = localStorage.getItem('project_' + projectId);
            
            if (!stored) {
                throw new Error('پروژه یافت نشد');
            }

            const projectData = JSON.parse(stored);
            this.currentProject = projectData;

            // ایمپورت اطلاعات فایل‌های صوتی
            if (projectData.audioFiles) {
                this.audioManager.importAudioFilesData(projectData.audioFiles);
            }

            console.log('Project loaded from LocalStorage');
            return projectData;
        }
    }

    /**
     * بازسازی کلیپ‌های صوتی پس از بارگذاری پروژه
     */
    async restoreAudioClips(clips) {
        for (const clip of clips) {
            if (clip.audioFileId) {
                const audioData = this.audioManager.getAudioFile(clip.audioFileId);
                if (audioData) {
                    try {
                        // لود فایل صوتی از مسیر ذخیره شده
                        const audioSource = await this.audioManager.loadAudioFromFile(audioData);
                        
                        // دیکود کردن برای ساخت waveform
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const arrayBuffer = await audioSource.blob.arrayBuffer();
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                        
                        // ساخت waveform
                        await this.audioManager.generateWaveform(audioData, audioBuffer);
                        
                        console.log(`Waveform restored for: ${audioData.name}`);
                    } catch (error) {
                        console.error(`Error restoring audio for clip ${clip.id}:`, error);
                    }
                }
            }
        }
    }

    /**
     * افزودن کلیپ صوتی به پروژه
     */
    async addAudioClip(trackId, position, audioFile) {
        if (!this.currentProject) {
            throw new Error('هیچ پروژه‌ای فعال نیست');
        }

        const clip = {
            id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            trackId: trackId,
            audioFileId: audioFile.id,
            fileName: audioFile.name,
            startPosition: position,
            duration: audioFile.duration || 0,
            volume: 1.0,
            pan: 0.0,
            muted: false,
            soloed: false
        };

        this.currentProject.clips.push(clip);
        this.currentProject.modifiedAt = new Date().toISOString();

        return clip;
    }

    /**
     * حذف کلیپ از پروژه
     */
    removeClip(clipId) {
        if (!this.currentProject) return;
        
        const index = this.currentProject.clips.findIndex(c => c.id === clipId);
        if (index !== -1) {
            this.currentProject.clips.splice(index, 1);
            this.currentProject.modifiedAt = new Date().toISOString();
        }
    }

    /**
     * صادرات پروژه به فرمت قابل انتقال
     */
    exportProjectData() {
        if (!this.currentProject) {
            throw new Error('هیچ پروژه‌ای فعال نیست');
        }

        return {
            ...this.currentProject,
            audioFiles: this.audioManager.exportAudioFilesData()
        };
    }

    /**
     * بررسی وضعیت فایل‌های صوتی لینک شده
     * (آیا فایل‌ها هنوز در مسیر اصلی وجود دارند؟)
     */
    async verifyLinkedFiles() {
        if (!this.fileSystemBridge.isElectron) {
            // در وب، فایل‌ها در IndexedDB هستند، همیشه موجودند
            return { allPresent: true, missing: [] };
        }

        const missing = [];
        const audioFiles = this.audioManager.exportAudioFilesData();

        for (const [id, data] of Object.entries(audioFiles)) {
            if (data.type === 'linked' && data.path) {
                const exists = await window.electronAPI.checkFileExists(data.path);
                if (!exists) {
                    missing.push({ id, name: data.name, path: data.path });
                }
            }
        }

        return {
            allPresent: missing.length === 0,
            missing: missing
        };
    }

    /**
     * پیدا کردن مجدد فایل‌های گم شده (Relink)
     */
    async relinkMissingFile(fileId, newPath) {
        const audioData = this.audioManager.getAudioFile(fileId);
        if (!audioData) {
            throw new Error('فایل صوتی یافت نشد');
        }

        // به‌روزرسانی مسیر فایل
        audioData.path = newPath;
        audioData.type = 'linked'; // یا 'copied' بسته به مورد
        
        console.log(`Relinked file ${audioData.name} to ${newPath}`);
        return audioData;
    }
}

// ایجاد نمونه سینگلتون
window.ProjectStore = new ProjectStore();
