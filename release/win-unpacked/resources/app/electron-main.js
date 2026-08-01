const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}/Akordyar.html`;

let mainWindow = null;

function waitForServer(maxAttempts = 60) {
  return new Promise((resolve) => {
    let attempts = 0;
    const tryConnect = () => {
      attempts++;
      const req = http.get(SERVER_URL, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve(true);
        else if (attempts < maxAttempts) setTimeout(tryConnect, 250);
        else resolve(false);
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

async function startServerInProcess() {
  try {
    const serverPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'server.js')
      : path.join(__dirname, 'server.js');
    if (!fs.existsSync(serverPath)) {
      console.error('[Akordyar] server.js not found at:', serverPath);
      return false;
    }
    process.chdir(path.dirname(serverPath));
    require(serverPath);
    return true;
  } catch (e) {
    console.error('[Akordyar] Server start error:', e);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Akordyar',
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(SERVER_URL);
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  console.log('[Akordyar] Starting server...');
  await startServerInProcess();
  await waitForServer();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});