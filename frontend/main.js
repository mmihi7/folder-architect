const { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

function getBackendCommand() {
  if (!app.isPackaged) {
    const scriptPath = path.join(__dirname, '..', 'backend', 'scan.py');
    return { cmd: 'python3', args: [scriptPath] };
  }
  const exeName = 'folder-architect-backend';
  const backendPath = path.join(process.resourcesPath, 'backend', exeName);
  return { cmd: backendPath, args: [] };
}

function runBackend(args) {
  return new Promise((resolve, reject) => {
    const { cmd, args: baseArgs } = getBackendCommand();
    const child = spawn(cmd, [...baseArgs, ...args], { cwd: os.homedir() });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Scan timed out (60s)'));
    }, 60000);

    child.stdout.on('data', (d) => stdout += d.toString());
    child.stderr.on('data', (d) => stderr += d.toString());

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || `Backend exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error('Invalid JSON from backend: ' + stdout.slice(0, 200)));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: 'Folder Architect',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select folder to analyze'
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('scan-folder', async (event, options) => {
  const args = [options.folder];
  if (options.extensions && options.extensions.length > 0) {
    args.push('--extensions', options.extensions.join(','));
  }
  if (options.excludeDirs === false) args.push('--no-exclude-dirs');
  if (options.excludeLocks === false) args.push('--no-exclude-locks');
  if (options.maxDepth && options.maxDepth > 0) {
    args.push('--max-depth', String(options.maxDepth));
  }
  return runBackend(args);
});

ipcMain.handle('list-extensions', async (event, folder) => {
  return runBackend([folder, '--list-extensions']);
});

ipcMain.handle('save-file', async (event, arrayBuffer, mimeType, defaultName) => {
  const filters = mimeType === 'application/pdf' 
    ? [{ name: 'PDF', extensions: ['pdf'] }] 
    : [{ name: 'Image', extensions: ['png'] }];
    
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File',
    defaultPath: defaultName,
    filters: filters
  });

  if (result.canceled || !result.filePath) return false;

  try {
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(result.filePath, buffer);
    return true;
  } catch (e) {
    console.error('Failed to save file:', e);
    return false;
  }
});

ipcMain.handle('copy-image-to-clipboard', async (event, arrayBuffer) => {
  try {
    const image = nativeImage.createFromBuffer(Buffer.from(arrayBuffer));
    clipboard.writeImage(image);
    return true;
  } catch (e) {
    console.error('Failed to copy image:', e);
    return false;
  }
});
