const { app, BrowserWindow, ipcMain, Menu, nativeTheme } = require('electron');
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

function sendOpenSettingsToFocusedWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    focused.webContents.send('menu-open-settings');
  }
}

function setupMenu() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  const customMenu = {
    label: '应用',
    submenu: [
      { label: '设置', accelerator: 'CmdOrCtrl+,', click: sendOpenSettingsToFocusedWindow },
      { type: 'separator' },
      { label: '退出', role: 'quit' }
    ]
  };

  // Dev: custom menu + default workflow menus coexist.
  // Prod: keep only custom menu.
  const template = isDev
    ? [
        ...(process.platform === 'darwin'
          ? [
              {
                label: app.name,
                submenu: [
                  { role: 'about' },
                  { type: 'separator' },
                  { role: 'services' },
                  { type: 'separator' },
                  { role: 'hide' },
                  { role: 'hideOthers' },
                  { role: 'unhide' },
                  { type: 'separator' },
                  { role: 'quit' }
                ]
              }
            ]
          : []),
        customMenu,
        { label: '视图', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
        { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'close' }] }
      ]
    : [customMenu];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 980,
    height: 640,
    minWidth: 980,
    minHeight: 640,
    title: 'Developer Box',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141414' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.once('ready-to-show', () => {
    window.show();
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
  setupMenu();
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
