const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs').promises;
const fssync = require('fs');

const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}/Akordyar.html`;

let mainWindow = null;

// ============================================
// Audio File Management Handlers
// ============================================

// IPC Handler: Read Audio File from Hard Drive
ipcMain.handle('audio:read-file', async (event, filePath) => {
  try {
    const dataBuffer = await fssync.readFile(filePath);
    return dataBuffer.buffer; // Return ArrayBuffer
  } catch (error) {
    console.error('[Akordyar] Error reading audio file:', error);
    throw error;
  }
});

// IPC Handler: Copy File to Project Audio Directory
ipcMain.handle('audio:copy-to-project', async (event, sourcePath, projectAudioDir) => {
  try {
    const safeFileName = path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, '_');
    const destPath = path.join(projectAudioDir, safeFileName);
    
    // Ensure audio directory exists
    await fs.mkdir(projectAudioDir, { recursive: true });
    
    // Copy file
    await fssync.copyFile(sourcePath, destPath);
    
    return {
      success: true,
      destinationPath: destPath,
      fileName: safeFileName
    };
  } catch (error) {
    console.error('[Akordyar] Error copying audio file:', error);
    throw error;
  }
});

// IPC Handler: Delete File
ipcMain.handle('audio:delete-file', async (event, filePath) => {
  try {
    if (fssync.existsSync(filePath)) {
      await fs.unlink(filePath);
      return { success: true };
    }
    return { success: false, reason: 'File not found' };
  } catch (error) {
    console.error('[Akordyar] Error deleting audio file:', error);
    throw error;
  }
});

// IPC Handler: Resolve Relative Path to Absolute Path
ipcMain.handle('audio:resolve-path', async (event, projectFilePath, relativePath) => {
  try {
    const projectDir = path.dirname(projectFilePath);
    const absolutePath = path.resolve(projectDir, relativePath);
    return absolutePath;
  } catch (error) {
    console.error('[Akordyar] Error resolving path:', error);
    throw error;
  }
});

// IPC Handler: Show Message Box (for Copy/Link dialog)
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
    console.error('[Akordyar] Error showing message box:', error);
    throw error;
  }
});

// IPC Handler: Save Project and Copy Audio Files
ipcMain.handle('project:save-with-audio', async (event, projectData, projectFilePath) => {
  try {
    const projectDir = path.dirname(projectFilePath);
    const audioDir = path.join(projectDir, 'Audio');
    
    // Create Audio directory if it doesn't exist
    if (!fssync.existsSync(audioDir)) {
      fssync.mkdirSync(audioDir, { recursive: true });
    }

    // Process clips to copy audio files and update paths
    const processedClips = projectData.clips.map(clip => {
      if (clip.fileName && clip._filePath) {
        // Determine source path (could be absolute or relative to current working dir)
        let sourcePath = clip._filePath;
        if (!path.isAbsolute(sourcePath)) {
           sourcePath = path.resolve(process.cwd(), sourcePath);
        }

        // Sanitize filename for target
        const safeFileName = path.basename(clip.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetPath = path.join(audioDir, safeFileName);
        
        // Copy file to Audio folder if source exists
        if (fssync.existsSync(sourcePath)) {
            fssync.copyFileSync(sourcePath, targetPath);
        }
        
        // Update relative path to be relative to project file
        const newRelativePath = path.relative(projectDir, targetPath);
        
        // Return clip with only essential metadata (remove runtime objects)
        return {
          ...clip,
          _filePath: undefined, // Remove absolute path
          bufferKey: undefined, // Remove buffer key
          audioBuffer: undefined, // Remove buffer object
          fileName: safeFileName, // Use sanitized name
          relativePath: newRelativePath // Store relative path
        };
      }
      // For clips without file info, just clean up runtime props
      const { bufferKey, audioBuffer, _filePath, ...cleanClip } = clip;
      return cleanClip;
    });

    // Update project data with processed clips
    const finalProjectData = {
      ...projectData,
      clips: processedClips
    };

    // Write project file
    await fs.writeFile(projectFilePath, JSON.stringify(finalProjectData, null, 2));
    
    return projectFilePath;
  } catch (error) {
    console.error('[Akordyar] Error saving project with audio:', error);
    throw error;
  }
});

// IPC Handler: Load Project File
ipcMain.handle('project:load-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const projectData = JSON.parse(content);
    return projectData;
  } catch (error) {
    console.error('[Akordyar] Error loading project file:', error);
    throw error;
  }
});

// IPC Handler: Check File Exists
ipcMain.handle('fs:check-exists', async (event, filePath) => {
  try {
    return fssync.existsSync(filePath);
  } catch (error) {
    console.error('[Akordyar] Error checking file existence:', error);
    return false;
  }
});

// IPC Handler: Open File Dialog
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

// IPC Handler: Save File Dialog
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
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
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