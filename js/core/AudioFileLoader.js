/**
 * AudioFileLoader.js
 * لود و مدیریت فایل‌های صوتی با پشتیبانی از Waveform
 */

class AudioFileLoader {
    constructor() {
        this.audioContext = null;
        this.fileSystemBridge = window.FileSystemBridge;
        this.audioManager = window.AudioManager;
    }

    /**
     * دریافت یا ساخت AudioContext
     */
    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }

    /**
     * لود فایل صوتی از File Object (برای Drag & Drop یا Input)
     * @param {File} file - فایل ورودی
     * @param {string} originalPath - مسیر اصلی فایل (در صورت دسترسی)
     * @returns {Promise<Object>}
     */
    async loadFromFile(file, originalPath = null) {
        try {
            // پردازش فایل توسط AudioManager
            const audioData = await this.audioManager.processAudioFile(file, originalPath);
            
            // لود فایل برای دیکود
            const audioSource = await this.audioManager.loadAudioFromFile(audioData);
            
            // دیکود کردن فایل صوتی
            const audioBuffer = await this.decodeAudioData(audioSource.blob);
            
            // ذخیره مدت زمان
            audioData.duration = audioBuffer.duration;
            
            // ساخت waveform
            const waveform = await this.audioManager.generateWaveform(audioData, audioBuffer);
            
            return {
                audioData: audioData,
                audioBuffer: audioBuffer,
                waveform: waveform,
                url: audioSource.url
            };
        } catch (error) {
            console.error('Error loading audio file:', error);
            throw error;
        }
    }

    /**
     * دیکود کردن Blob به AudioBuffer
     */
    async decodeAudioData(blob) {
        const audioContext = this.getAudioContext();
        const arrayBuffer = await blob.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    }

    /**
     * لود فایل صوتی از مسیر (برای پروژه‌های ذخیره شده در الکترون)
     * @param {string} filePath - مسیر فایل
     * @returns {Promise<Object>}
     */
    async loadFromPath(filePath) {
        try {
            if (this.fileSystemBridge.isElectron && window.electronAPI) {
                const arrayBuffer = await window.electronAPI.readAudioFile(filePath);
                const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
                
                const audioBuffer = await this.decodeAudioData(blob);
                const url = URL.createObjectURL(blob);
                
                return {
                    audioBuffer: audioBuffer,
                    url: url,
                    path: filePath,
                    duration: audioBuffer.duration
                };
            } else {
                throw new Error('لود از مسیر فقط در Electron پشتیبانی می‌شود');
            }
        } catch (error) {
            console.error('Error loading audio from path:', error);
            throw error;
        }
    }

    /**
     * ساخت عنصر Audio برای پخش
     */
    createAudioElement(url) {
        const audio = document.createElement('audio');
        audio.src = url;
        audio.preload = 'auto';
        return audio;
    }

    /**
     * رندر waveform روی Canvas
     * @param {HTMLCanvasElement} canvas - المنت کانواس
     * @param {Float32Array} waveformData - داده‌های waveform
     * @param {Object} options - تنظیمات نمایش
     */
    renderWaveform(canvas, waveformData, options = {}) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        const barWidth = options.barWidth || 2;
        const gap = options.gap || 1;
        const color = options.color || '#4CAF50';
        const mirror = options.mirror !== false; // پیش‌فرض متقارن
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;
        
        const totalBars = Math.floor(width / (barWidth + gap));
        const step = Math.ceil(waveformData.length / totalBars);
        
        for (let i = 0; i < totalBars; i++) {
            const dataIndex = i * step;
            const amplitude = waveformData[dataIndex] || 0;
            
            const barHeight = Math.min(amplitude * height, height / 2);
            const x = i * (barWidth + gap);
            
            if (mirror) {
                // رسم متقارن (بالا و پایین)
                ctx.fillRect(x, (height / 2) - barHeight, barWidth, barHeight * 2);
            } else {
                // رسم فقط به پایین
                ctx.fillRect(x, height / 2, barWidth, barHeight);
            }
        }
    }

    /**
     * پاک کردن منابع
     */
    dispose() {
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        this.audioContext = null;
    }
}

// ایجاد نمونه سینگلتون
window.AudioFileLoader = new AudioFileLoader();
