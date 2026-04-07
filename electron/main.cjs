const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');

const DATA_DIR = path.join(os.homedir(), '.developer-box');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getSystemTheme() {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'Developer Box',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    window.loadURL(devServerUrl);
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await ensureDataDir();
  createWindow();

  nativeTheme.on('updated', () => {
    const value = getSystemTheme();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('system-theme-changed', value);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:get-storage-path', async () => DATA_DIR);
ipcMain.handle('app:get-system-theme', async () => getSystemTheme());
ipcMain.handle('settings:get', async () => {
  return readJson(SETTINGS_FILE, { themeMode: 'system' });
});
ipcMain.handle('settings:set', async (_, payload) => {
  await writeJson(SETTINGS_FILE, payload);
  return payload;
});
ipcMain.handle('todos:get', async () => {
  return readJson(TODOS_FILE, []);
});
ipcMain.handle('todos:set', async (_, payload) => {
  await writeJson(TODOS_FILE, payload);
  return payload;
});
