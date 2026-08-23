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

const { app, BrowserWindow, shell, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const fsPromises = require('fs').promises;
const fsSync = require('fs');

const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}/Akordyar.html`;

let mainWindow = null;
let serverProcess = null;

const IPC_CHANNELS = Object.freeze([
  'audio:read-file',
  'audio:copy-to-project',
  'audio:delete-file',
  'audio:resolve-path',
  'print:open-window',
  'dialog:show-message-box',
  'project:save-with-audio',
  'project:write-json',
  'project:load-file',
  'fs:check-exists',
  'dialog:open-file',
  'dialog:save-file'
]);

const TRUSTED_RENDERER_ORIGIN = new URL(SERVER_URL).origin;

function requireString(value, name, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function requirePlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function isTrustedIpcSender(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (event?.sender !== mainWindow.webContents) return false;

  try {
    const senderUrl = new URL(
      event.senderFrame?.url || event.sender.getURL()
    );
    return senderUrl.origin === TRUSTED_RENDERER_ORIGIN;
  } catch {
    return false;
  }
}

function registerIpcHandler(channel, handler) {
  if (!IPC_CHANNELS.includes(channel)) {
    throw new Error(`IPC channel is not whitelisted: ${channel}`);
  }

  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedIpcSender(event)) {
      throw new Error(`Unauthorized IPC sender for channel: ${channel}`);
    }
    return handler(event, ...args);
  });
}

// ============================================
// Create Application Menu
// ============================================
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Song',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-new-song')
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu-open-project')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-save-as')
        },
        { type: 'separator' },
        {
          label: 'Export',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow.webContents.send('menu-export')
        },
        {
          label: 'Import',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow.webContents.send('menu-import')
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo'
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          role: 'redo'
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectAll'
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.webContents.reload()
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow.webContents.toggleDevTools()
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          role: 'zoomIn'
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          role: 'zoomOut'
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          role: 'resetZoom'
        },
        { type: 'separator' },
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          role: 'togglefullscreen'
        }
      ]
    },
    {
      label: 'Playback',
      submenu: [
        {
          label: 'Play/Pause',
          accelerator: 'Space',
          click: () => mainWindow.webContents.send('menu-play-pause')
        },
        {
          label: 'Stop',
          accelerator: 'CmdOrCtrl+Backspace',
          click: () => mainWindow.webContents.send('menu-stop')
        },
        { type: 'separator' },
        {
          label: 'Go to Start',
          accelerator: 'Home',
          click: () => mainWindow.webContents.send('menu-go-to-start')
        },
        {
          label: 'Go to End',
          accelerator: 'End',
          click: () => mainWindow.webContents.send('menu-go-to-end')
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Arranger',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.webContents.send('menu-arranger')
        },
        {
          label: 'Archive',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow.webContents.send('menu-archive')
        },
        {
          label: 'MIDI Settings',
          click: () => mainWindow.webContents.send('menu-midi-settings')
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('menu-preferences')
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        },
        { type: 'separator' },
        {
          label: 'Bring All to Front',
          role: 'front'
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Akordyar',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Akordyar',
              message: 'Akordyar - DAW Timeline Pro',
              detail: 'Version 1.0.0\nA professional chord and timeline editor.'
            });
          }
        },
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/your-repo/akordyar/wiki')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

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
// Check if port is already in use
// ============================================
function stopExistingServerOnPort() {
  if (process.platform !== 'win32') return;

  try {
    const netstat = execFileSync(
      'netstat',
      ['-ano', '-p', 'tcp'],
      { encoding: 'utf8', windowsHide: true }
    );
    const pids = new Set();

    for (const line of netstat.split(/\r?\n/)) {
      const match = line.match(
        /^\s*TCP\s+\S+:3000\s+\S+\s+LISTENING\s+(\d+)\s*$/i
      );
      if (match && Number(match[1]) !== process.pid) {
        pids.add(match[1]);
      }
    }

    for (const pid of pids) {
      try {
        execFileSync(
          'taskkill',
          ['/PID', pid, '/T', '/F'],
          { stdio: 'ignore', windowsHide: true }
        );
        log('Server', `Stopped previous process on port ${SERVER_PORT} (PID ${pid})`);
      } catch (error) {
        logError('Server', `Could not stop PID ${pid}: ${error.message}`);
      }
    }
  } catch (error) {
    logError('Server', `Could not inspect port ${SERVER_PORT}: ${error.message}`);
  }
}

// ============================================
// Audio File Management Handlers
// ============================================

registerIpcHandler('audio:read-file', async (event, filePath) => {
  try {
    requireString(filePath, 'filePath');
    // استفاده از fs.promises.readFile برای جلوگیری از خطای callback
    const dataBuffer = await fsPromises.readFile(filePath);
    return dataBuffer.buffer;
  } catch (error) {
    logError('Audio', `Error reading audio file: ${error.message}`);
    throw error;
  }
});

registerIpcHandler('audio:copy-to-project', async (event, sourcePath, projectAudioDir) => {
  try {
    requireString(sourcePath, 'sourcePath');
    requireString(projectAudioDir, 'projectAudioDir');
    const safeFileName = path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, '_');
    const destPath = path.join(projectAudioDir, safeFileName);

    await fsPromises.mkdir(projectAudioDir, { recursive: true });
    fsSync.copyFileSync(sourcePath, destPath);

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

registerIpcHandler('audio:delete-file', async (event, filePath) => {
  try {
    requireString(filePath, 'filePath');
    if (fsSync.existsSync(filePath)) {
      await fsPromises.unlink(filePath);
      return { success: true };
    }
    return { success: false, reason: 'File not found' };
  } catch (error) {
    logError('Audio', `Error deleting audio file: ${error.message}`);
    throw error;
  }
});

registerIpcHandler('audio:resolve-path', async (event, projectFilePath, relativePath) => {
  try {
    requireString(projectFilePath, 'projectFilePath');
    requireString(relativePath, 'relativePath');
    const projectDir = path.dirname(projectFilePath);
    const absolutePath = path.resolve(projectDir, relativePath);
    return absolutePath;
  } catch (error) {
    logError('Path', `Error resolving path: ${error.message}`);
    throw error;
  }
});

registerIpcHandler('print:open-window', async (event, htmlContent) => {
  let printWindow = null;
  let tempFile = null;
  try {
    requireString(htmlContent, 'htmlContent');
    // ─── تزریق فونت‌های سفارشی به HTML چاپ ───
    let enhancedHtml = htmlContent;
    try {
      const fontsDir = app.isPackaged
        ? path.join(process.resourcesPath, 'app', 'fonts')
        : path.join(__dirname, 'fonts');

      const fontFiles = [
        { name: 'Vazirmatn', file: 'Vazirmatn-Regular.woff2', weight: 'normal' },
        { name: 'Vazirmatn Bold', file: 'Vazirmatn-Bold.woff2', weight: 'bold' },
        { name: 'Vazirmatn Thin', file: 'Vazirmatn-Thin.woff2', weight: '100' },
        { name: 'Vazirmatn Black', file: 'Vazirmatn-Black.woff2', weight: '900' },
        { name: 'BArshia', file: 'BArshia.woff2', weight: 'normal' },
        { name: 'BFarnaz', file: 'BFarnaz.woff2', weight: 'normal' },
        { name: 'BJadid', file: 'BJadidBd.woff2', weight: 'bold' },
        { name: 'BZar', file: 'BZar.woff2', weight: 'normal' },
        { name: 'BZar Bold', file: 'BZarBd.woff2', weight: 'bold' },
        { name: 'Lalezar', file: 'Lalezar-Regular.woff2', weight: 'normal' },
        { name: 'Mada', file: 'Mada-Bold.woff2', weight: 'bold' },
        { name: 'Rubik', file: 'Rubik-Bold.woff2', weight: 'bold' },
        { name: 'JetBrains Mono', file: 'JetBrainsMono-Regular.woff2', weight: 'normal' },
        { name: 'JetBrains Mono Bold', file: 'JetBrainsMono-Bold.woff2', weight: 'bold' }
      ];

      let fontCss = '';
      for (const f of fontFiles) {
        const fontPath = path.join(fontsDir, f.file);
        if (fsSync.existsSync(fontPath)) {
          const fontData = fsSync.readFileSync(fontPath).toString('base64');
          fontCss += `@font-face { font-family: '${f.name}'; src: url(data:font/woff2;base64,${fontData}) format('woff2'); font-weight: ${f.weight}; font-style: normal; }\n`;
        }
      }

      if (fontCss) {
        enhancedHtml = htmlContent.replace('</head>', `<style>${fontCss}</style></head>`);
      }
    } catch (fontErr) {
      logError('Print', `Font injection error: ${fontErr.message}`);
    }

    // ─── ذخیره HTML به عنوان فایل موقت ───
    // استفاده از فایل واقعی به جای data: URL برای جلوگیری از "No preview available"
    const os = require('os');
    tempFile = path.join(os.tmpdir(), `akordyar-print-${Date.now()}.html`);
    await fsPromises.writeFile(tempFile, enhancedHtml, 'utf8');

    // ─── ایجاد پنجره چاپ قابل مشاهده ───
    // پنجره باید قابل مشاهده باشد تا پیش‌نمایش چاپ در ویندوز کار کند
    printWindow = new BrowserWindow({
      width: 800,
      height: 1100,
      show: true,
      title: 'Print Preview - Akordyar',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: false
      }
    });

    // لود فایل موقت
    await printWindow.loadFile(tempFile);

    // صبر کن تا محتوا و فونت‌ها کامل لود و رندر شوند
    await new Promise(resolve => setTimeout(resolve, 1500));

    // ─── چاپ ───
    const result = await printWindow.webContents.print({
      silent: false,
      printBackground: true,
      margins: { marginType: 'default' }
    });

    // بعد از چاپ، پنجره را ببند
    setTimeout(() => {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close();
      }
    }, 500);

    return { success: true, result };
  } catch (error) {
    logError('Print', `Error printing: ${error.message}`);
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.destroy();
    }
    return { success: false, error: error.message };
  } finally {
    // پاک‌سازی فایل موقت
    if (tempFile) {
      try {
        fsSync.unlinkSync(tempFile);
      } catch (e) {
        // ignore
      }
    }
  }
});

registerIpcHandler('dialog:show-message-box', async (event, options) => {
  try {
    requirePlainObject(options, 'options');
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

registerIpcHandler('project:save-with-audio', async (event, projectData, projectFilePath) => {
  try {
    requirePlainObject(projectData, 'projectData');
    requireString(projectFilePath, 'projectFilePath');
    if (!Array.isArray(projectData.clips)) {
      throw new TypeError('projectData.clips must be an array');
    }
    const projectDir = path.dirname(projectFilePath);
    const audioDir = path.join(projectDir, 'Audio');

    if (!fsSync.existsSync(audioDir)) {
      fsSync.mkdirSync(audioDir, { recursive: true });
    }

    const processedClips = projectData.clips.map(clip => {
      if (clip.fileName && clip._filePath) {
        let sourcePath = clip._filePath;
        if (!path.isAbsolute(sourcePath)) {
          sourcePath = path.resolve(process.cwd(), sourcePath);
        }

        const safeFileName = path.basename(clip.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetPath = path.join(audioDir, safeFileName);

        if (fsSync.existsSync(sourcePath)) {
          fsSync.copyFileSync(sourcePath, targetPath);
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

    await fsPromises.writeFile(projectFilePath, JSON.stringify(finalProjectData, null, 2));

    return projectFilePath;
  } catch (error) {
    logError('Project', `Error saving project with audio: ${error.message}`);
    throw error;
  }
});

registerIpcHandler('project:write-json', async (event, filePath, content) => {
  try {
    requireString(filePath, 'filePath');
    requireString(content, 'content');

    let projectData;
    try {
      projectData = JSON.parse(content);
    } catch {
      throw new TypeError('content must be valid JSON');
    }
    requirePlainObject(projectData, 'projectData');

    await fsPromises.writeFile(filePath, content, 'utf8');
    return filePath;
  } catch (error) {
    logError('Project', `Error writing project JSON: ${error.message}`);
    throw error;
  }
});

registerIpcHandler('project:load-file', async (event, filePath) => {
  try {
    requireString(filePath, 'filePath');
    const content = await fsPromises.readFile(filePath, 'utf8');
    const projectData = JSON.parse(content);
    return projectData;
  } catch (error) {
    logError('Project', `Error loading project file: ${error.message}`);
    throw error;
  }
});

registerIpcHandler('fs:check-exists', async (event, filePath) => {
  try {
    requireString(filePath, 'filePath');
    return fsSync.existsSync(filePath);
  } catch (error) {
    logError('FS', `Error checking file existence: ${error.message}`);
    return false;
  }
});

registerIpcHandler('dialog:open-file', async () => {
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

registerIpcHandler('dialog:save-file', async (event, options = {}) => {
  requirePlainObject(options, 'options');
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: typeof options.defaultPath === 'string'
      ? options.defaultPath
      : undefined,
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
// Firewall: allow phones to connect to port 3000 (sync)
// ============================================
function addFirewallRuleForElectron() {
  const { execSync } = require('child_process');
  try {
    execSync('netsh advfirewall firewall delete rule name="Akordyar Sync 3000 Electron"', { stdio: 'ignore' });
    execSync('netsh advfirewall firewall add rule name="Akordyar Sync 3000 Electron" dir=in action=allow protocol=TCP localport=3000', { stdio: 'ignore' });
    log('Firewall', 'Port 3000 rule for Electron is ready - phone can connect');
  } catch (e) {
    logError('Firewall', 'Could not add firewall rule (run as admin once): ' + e.message);
  }
}

// ============================================
// Start the LAN server as a separate Node-compatible process.
// This intentionally mirrors Run-Akordyar.bat so the packaged app and
// development launcher expose the same HTTP/WebSocket server behavior.
// ============================================
async function startServerInProcess() {
  try {
    const serverPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'server.js')
      : path.join(__dirname, 'server.js');

    if (!fsSync.existsSync(serverPath)) {
      logError('Server', `server.js not found at: ${serverPath}`);
      return false;
    }

    log('Server', `Starting external LAN server from: ${serverPath}`);

    const childEnv = {
      ...process.env,
      AKORDYAR_DESKTOP: '1',
      ELECTRON_RUN_AS_NODE: '1'
    };

    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: path.dirname(serverPath),
      env: childEnv,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout?.on('data', data => {
      const text = String(data).trim();
      if (text) console.log(`[LAN Server] ${text}`);
    });
    serverProcess.stderr?.on('data', data => {
      const text = String(data).trim();
      if (text) console.error(`[LAN Server] ${text}`);
    });
    serverProcess.once('error', error => {
      logError('Server', `External server process error: ${error.message}`);
    });
    serverProcess.once('exit', (code, signal) => {
      log('Server', `External server exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
      serverProcess = null;
    });

    // ensure phone can connect through firewall
    addFirewallRuleForElectron();

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
      sandbox: false,
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
  mainWindow.webContents.on('did-start-loading', () => {
    log('Window', 'Renderer started loading');
  });
  mainWindow.webContents.on('did-stop-loading', () => {
    log('Window', 'Renderer stopped loading');
  });
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    log('Renderer', `[${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logError('Renderer', `Process gone: ${details.reason || 'unknown'} exitCode=${details.exitCode}`);
  });
  mainWindow.loadURL(SERVER_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // نمایش خطاهای صفحه
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logError('Window', `Failed to load: ${errorDescription} (${errorCode})`);
  });
}

// ============================================
// App lifecycle
// ============================================
app.whenReady().then(async () => {
  log('App', 'Akordyar is starting...');

  // ایجاد منوی اصلی برنامه
  createMenu();

  // مثل Run-Akordyar.bat، همیشه سرور متعلق به همین نسخه را اجرا کن.
  // این کار مانع اتصال تصادفی به server.js قدیمیِ باقی‌مانده روی پورت ۳۰۰۰ می‌شود.
  stopExistingServerOnPort();
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
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill();
      log('Server', 'External LAN server stopped');
    } catch (e) {
      // ignore
    }
    serverProcess = null;
  }
});
