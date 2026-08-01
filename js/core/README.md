# سیستم مدیریت فایل صوتی DAW - راهنمای استفاده

## معرفی
این سیستم برای مدیریت فایل‌های صوتی در پروژه DAW طراحی شده و از دو حالت **وب** و **الکترون (دسکتاپ)** پشتیبانی می‌کند.

## ساختار فایل‌ها

```
/workspace/js/core/
├── FileSystemBridge.js    # لایه انتزاعی دسترسی به فایل سیستم
├── AudioManager.js        # مدیریت فایل‌های صوتی
├── AudioFileLoader.js     # لود و دیکود فایل‌های صوتی
└── ProjectStore.js        # ذخیره و بارگذاری پروژه‌ها
```

## ویژگی‌های اصلی

### ۱. پرسش کپی یا لینک کردن فایل
هنگام افزودن فایل صوتی، کاربر می‌تواند انتخاب کند:
- **کپی در پروژه**: فایل به پوشه `Audio` پروژه کپی می‌شود (پایدارتر)
- **لینک به فایل اصلی**: فقط مسیر فایل ذخیره می‌شود (حجم کمتر)

### ۲. حفظ فرمت اصلی فایل
فایل‌ها دقیقاً با همان فرمت اصلی (MP3, WAV, etc.) ذخیره می‌شوند و به هیچ وجه به base64 یا فرمت‌های حجیم تبدیل نمی‌شوند.

### ۳. بازسازی Waveform
پس از بارگذاری مجدد پروژه، waveform فایل‌های صوتی به طور کامل بازسازی می‌شود.

## نحوه استفاده

### راه‌اندازی اولیه

```javascript
// در شروع برنامه
await window.FileSystemBridge.init();
await window.AudioManager.init();
```

### افزودن فایل صوتی

```javascript
// هنگام Drag & Drop یا انتخاب فایل
async function handleFileDrop(file, originalPath = null) {
    try {
        const result = await window.AudioFileLoader.loadFromFile(file, originalPath);
        
        // result شامل:
        // - audioData: اطلاعات فایل
        // - audioBuffer: بافر صوتی دیکود شده
        // - waveform: داده‌های waveform
        // - url: URL موقت برای پخش
        
        console.log('File loaded:', result.audioData.name);
        console.log('Duration:', result.audioData.duration);
        console.log('Waveform data points:', result.waveform.data.length);
        
        return result;
    } catch (error) {
        console.error('Error loading file:', error);
    }
}
```

### ذخیره پروژه

```javascript
// ذخیره پروژه
async function saveProject() {
    const projectData = window.ProjectStore.exportProjectData();
    const savedPath = await window.ProjectStore.saveProject(projectData);
    console.log('Project saved to:', savedPath);
}
```

### بارگذاری پروژه

```javascript
// بارگذاری پروژه
async function loadProject(filePath) {
    const projectData = await window.ProjectStore.loadProject(filePath);
    console.log('Project loaded:', projectData.name);
    
    // کلیپ‌های صوتی به طور خودکار بازسازی می‌شوند
    // waveform‌ها دوباره ساخته می‌شوند
}
```

### رندر Waveform روی Canvas

```javascript
// رندر waveform
const canvas = document.getElementById('waveformCanvas');
const waveformData = result.waveform.data;

window.AudioFileLoader.renderWaveform(canvas, waveformData, {
    barWidth: 2,
    gap: 1,
    color: '#4CAF50',
    mirror: true // نمایش متقارن
});
```

## تفاوت‌های محیط وب و الکترون

### محیط وب (مرورگر)
- فایل‌ها در **IndexedDB** ذخیره می‌شوند
- محدودیت حجم ذخیره‌سازی وجود دارد
- بدون دسترسی مستقیم به فایل سیستم

### محیط الکترون (دسکتاپ)
- فایل‌ها در **پوشه پروژه/Audio** ذخیره می‌شوند
- دسترسی کامل به فایل سیستم
- امکان لینک کردن فایل‌های خارجی بدون کپی
- دیالوگ‌های نیتیو برای پرسش کپی/لینک

## IPC Handlers در Electron

```javascript
// خواندن فایل صوتی
ipcRenderer.invoke('audio:read-file', filePath)

// کپی فایل به پروژه
ipcRenderer.invoke('audio:copy-to-project', sourcePath, audioDir)

// حذف فایل
ipcRenderer.invoke('audio:delete-file', filePath)

// نمایش پیام باکس
ipcRenderer.invoke('dialog:show-message-box', options)

// ذخیره پروژه
ipcRenderer.invoke('project:save-with-audio', projectData, filePath)

// بارگذاری پروژه
ipcRenderer.invoke('project:load-file', filePath)

// بررسی وجود فایل
ipcRenderer.invoke('fs:check-exists', filePath)
```

## ساختار داده‌های پروژه

```json
{
  "id": "proj_1234567890_abc",
  "name": "My Project",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "modifiedAt": "2024-01-01T00:00:00.000Z",
  "tracks": [],
  "clips": [
    {
      "id": "clip_1234567890_xyz",
      "trackId": "track_1",
      "audioFileId": "audio_1234567890_def",
      "fileName": "song.mp3",
      "startPosition": 0,
      "duration": 180.5,
      "volume": 1.0,
      "pan": 0.0
    }
  ],
  "audioFiles": {
    "audio_1234567890_def": {
      "id": "audio_1234567890_def",
      "name": "song.mp3",
      "format": "mp3",
      "size": 5242880,
      "path": "./Audio/song.mp3",
      "type": "copied",
      "isEmbedded": false,
      "duration": 180.5,
      "waveform": {
        "data": [...],
        "duration": 180.5,
        "sampleRate": 44100
      }
    }
  },
  "settings": {
    "sampleRate": 44100,
    "bitDepth": 16,
    "tempo": 120
  }
}
```

## نکات مهم

1. **همیشه قبل از استفاده از FileManager، متد init را صدا بزنید**
2. **در محیط الکترون، preload.js باید لود شود**
3. **URL های ایجاد شده با createObjectURL را پس از اتمام کار آزاد کنید**
4. **برای پروژه‌های بزرگ، حالت لینک کردن توصیه می‌شود**
