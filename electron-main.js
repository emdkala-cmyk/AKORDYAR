/**
 * electron-main.js — نسخه اصلاح‌شده
 *
 * تغییرات کلیدی:
 * 1. لاگ‌گذاری واضح‌تر برای دیباگ
 * 2. هندل بهتر خطاها در startServerInProcess
 * 3. باز کردن DevTools در حالت --dev
 * 4. مدیریت بهتر خطای پورت اشغال‌شده
 * 5. پاک‌سازی منابع هنگام خروج
 */

const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs').promises;
const fssync = require('fs');

const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}/Akordyar.html`;

let mainWindow = null;
let serverModule = null;

// ============================================
// Utility: colored console log
// ============================================
function log(tag, msg) {
  console.log(`\x1b[36m[Akordyar]\x1b[0m \x1b[90m[${tag}]\x1b[0m ${msg}`);
}

function logError(tag, msg) {
  console.error(`\x1b[36m[Akordyar]\x1b[0m \x1b[31m[${tag}]\x1b[0m ${msg}`);
}

// ============================================
// Check if port is already in use (server might be running externally)
// ============================================
function isServerAlreadyRunning() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// ============================================
// Audio File Management Handlers
// ============================================

ipcMain.handle('audio:read-file', async (event, filePath) => {
  try {
    const dataBuffer = await fssync.readFile(filePath);
    return dataBuffer.buffer;
  } catch (error) {
    logError('Audio', `Error reading audio file: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('audio:copy-to-project', async (event, sourcePath, projectAudioDir) => {
  try {
    const safeFileName = path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, '_');
    const destPath = path.join(projectAudioDir, safeFileName);

    await fs.mkdir(projectAudioDir, { recursive: true });
    await fssync.copyFile(sourcePath, destPath);

    return {
      success: true,
      destinationPath: destPath,
      fileName: safeFileName
    };
  } catch (error) {
    logError('Audio', `Error copying audio file: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('audio:delete-file', async (event, filePath) => {
  try {
    if (fssync.existsSync(filePath)) {
      await fs.unlink(filePath);
      return { success: true };
    }
    return { success: false, reason: 'File not found' };
  } catch (error) {
    logError('Audio', `Error deleting audio file: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('audio:resolve-path', async (event, projectFilePath, relativePath) => {
  try {
    const projectDir = path.dirname(projectFilePath);
    const absolutePath = path.resolve(projectDir, relativePath);
    return absolutePath;
  } catch (error) {
    logError('Path', `Error resolving path: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('dialog:show-message-box', async (event, options) => {
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: options.type || 'info',
      buttons: options.buttons || ['OK'],
      defaultId: options.defaultId || 0,
      title: options.title || 'Akordyar',
      message: options.message || '',
      detail: options.detail || ''
    });
    return result.response;
  } catch (error) {
    logError('Dialog', `Error showing message box: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('project:save-with-audio', async (event, projectData, projectFilePath) => {
  try {
    const projectDir = path.dirname(projectFilePath);
    const audioDir = path.join(projectDir, 'Audio');

    if (!fssync.existsSync(audioDir)) {
      fssync.mkdirSync(audioDir, { recursive: true });
    }

    const processedClips = projectData.clips.map(clip => {
      if (clip.fileName && clip._filePath) {
        let sourcePath = clip._filePath;
        if (!path.isAbsolute(sourcePath)) {
          sourcePath = path.resolve(process.cwd(), sourcePath);
        }

        const safeFileName = path.basename(clip.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetPath = path.join(audioDir, safeFileName);

        if (fssync.existsSync(sourcePath)) {
          fssync.copyFileSync(sourcePath, targetPath);
        }

        const newRelativePath = path.relative(projectDir, targetPath);

        return {
          ...clip,
          _filePath: undefined,
          bufferKey: undefined,
          audioBuffer: undefined,
          fileName: safeFileName,
          relativePath: newRelativePath
        };
      }
      const { bufferKey, audioBuffer, _filePath, ...cleanClip } = clip;
      return cleanClip;
    });

    const finalProjectData = {
      ...projectData,
      clips: processedClips
    };

    await fs.writeFile(projectFilePath, JSON.stringify(finalProjectData, null, 2));

    return projectFilePath;
  } catch (error) {
    logError('Project', `Error saving project with audio: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('project:load-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const projectData = JSON.parse(content);
    return projectData;
  } catch (error) {
    logError('Project', `Error loading project file: ${error.message}`);
    throw error;
  }
});

ipcMain.handle('fs:check-exists', async (event, filePath) => {
  try {
    return fssync.existsSync(filePath);
  } catch (error) {
    logError('FS', `Error checking file existence: ${error.message}`);
    return false;
  }
});

ipcMain.handle('dialog:open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'json'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:save-file', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Project Files', extensions: ['akr', 'json'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    return result.filePath;
  }
  return null;
});

// ============================================
// Wait for Express server to be ready
// ============================================
function waitForServer(maxAttempts = 60) {
  return new Promise((resolve) => {
    let attempts = 0;
    const tryConnect = () => {
      attempts++;
      const req = http.get(SERVER_URL, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          log('Server', `Connected after ${attempts} attempt(s)`);
          resolve(true);
        } else if (attempts < maxAttempts) {
          setTimeout(tryConnect, 250);
        } else {
          logError('Server', `Server returned status ${res.statusCode} after ${maxAttempts} attempts`);
          resolve(false);
        }
      });
      req.on('error', () => {
        if (attempts < maxAttempts) setTimeout(tryConnect, 250);
        else resolve(false);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts < maxAttempts) setTimeout(tryConnect, 250);
        else resolve(false);
      });
    };
    tryConnect();
  });
}

// ============================================
// Start Express server in-process
// ============================================
async function startServerInProcess() {
  try {
    const serverPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'server.js')
      : path.join(__dirname, 'server.js');

    if (!fssync.existsSync(serverPath)) {
      logError('Server', `server.js not found at: ${serverPath}`);
      return false;
    }

    log('Server', `Loading server from: ${serverPath}`);
    process.chdir(path.dirname(serverPath));

    // require کردن سرور — خودش روی PORT گوش می‌ده
    serverModule = require(serverPath);
    log('Server', 'Server module loaded successfully');

    return true;
  } catch (e) {
    logError('Server', `Server start error: ${e.message}`);
    if (e.stack) console.error(e.stack);
    return false;
  }
}

// ============================================
// Create main BrowserWindow
// ============================================
function createWindow() {
  const isDev = process.argv.includes('--dev');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Akordyar',
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // باز کردن لینک‌های خارجی در مرورگر پیش‌فرض
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  log('Window', `Loading URL: ${SERVER_URL}`);
  mainWindow.loadURL(SERVER_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // نمایش خطاهای صفحه
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logError('Window', `Failed to load: ${errorDescription} (${errorCode})`);
    if (errorCode === -3) {
      // ABORTED — معمولاً ناشی از reload
      return;
    }
    // تلاش مجدد بعد از 1 ثانیه
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        log('Window', 'Retrying load...');
        mainWindow.loadURL(SERVER_URL);
      }
    }, 1000);
  });
}

// ============================================
// App lifecycle
// ============================================
app.whenReady().then(async () => {
  log('App', 'Akordyar is starting...');

  // اگر سرور از قبل داره اجرا می‌شه (مثلاً کاربر npm run server زده)،
  // دوباره استارتش نزن
  const alreadyRunning = await isServerAlreadyRunning();
  if (alreadyRunning) {
    log('Server', 'Server already running externally — skipping internal start');
  } else {
    log('Server', 'Starting internal Express server...');
    const started = await startServerInProcess();
    if (!started) {
      logError('Server', 'Failed to start server. Aborting.');
      dialog.showErrorBox(
        'Akordyar — خطای راه‌اندازی',
        'سرور Express راه‌اندازی نشد. لطفاً لاگ‌های کنسول را بررسی کنید.\n\n' +
        'اگر پورت ۳۰۰۰ اشغال است، آن را آزاد کنید.'
      );
      app.quit();
      return;
    }
    log('Server', 'Waiting for server to accept connections...');
    const ok = await waitForServer();
    if (!ok) {
      logError('Server', 'Server did not respond in time');
      dialog.showErrorBox(
        'Akordyar — خطای اتصال',
        'سرور روی پورت ۳۰۰۰ پاسخ نداد.\n' +
        'ممکن است پورت اشغال باشد یا خطای دیگری رخ داده باشد.'
      );
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  log('App', 'Shutting down...');
  if (serverModule && serverModule.__server) {
    try {
      serverModule.__server.close();
      log('Server', 'HTTP server closed');
    } catch (e) {
      // ignore
    }
  }
});
