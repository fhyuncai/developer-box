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
  const isMac = process.platform === 'darwin';

  const macAppMenu = {
    label: app.name,
    submenu: [
      { role: 'about', label: `关于 ${app.name}` },
      { type: 'separator' },
      { role: 'services', label: '服务' },
      { type: 'separator' },
      { role: 'hide', label: `隐藏 ${app.name}` },
      { role: 'hideOthers', label: '隐藏其他' },
      { role: 'unhide', label: '显示全部' },
      { type: 'separator' },
      { role: 'quit', label: `退出 ${app.name}` }
    ]
  };

  const customMenu = {
    label: '应用',
    submenu: [
      { label: '设置', accelerator: 'CmdOrCtrl+,', click: sendOpenSettingsToFocusedWindow },
      { type: 'separator' },
      { role: 'quit', label: '退出' }
    ]
  };

  const editMenu = {
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      ...(isMac ? [{ role: 'pasteAndMatchStyle', label: '粘贴并匹配格式' }] : []),
      { role: 'delete', label: '删除' },
      { role: 'selectAll', label: '全选' }
    ]
  };

  const viewMenu = {
    label: '视图',
    submenu: [
      { role: 'reload', label: '重新加载' },
      { role: 'forceReload', label: '强制重新加载' },
      { role: 'toggleDevTools', label: '开发者工具' },
      { type: 'separator' },
      { role: 'resetZoom', label: '实际大小' },
      { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: '切换全屏' }
    ]
  };

  const windowMenu = {
    label: '窗口',
    submenu: [
      { role: 'minimize', label: '最小化' },
      { role: 'zoom', label: '缩放' },
      ...(isMac
        ? [{ type: 'separator' }, { role: 'front', label: '全部置于顶层' }]
        : [{ role: 'close', label: '关闭' }])
    ]
  };

  const template = [
    ...(isMac ? [macAppMenu] : []),
    customMenu,
    editMenu,
    ...(isDev ? [viewMenu, windowMenu] : [])
  ];

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
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
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

ipcMain.handle('window:get-always-on-top', () => {
  const win = BrowserWindow.getFocusedWindow();
  return win ? win.isAlwaysOnTop() : false;
});

ipcMain.handle('window:set-always-on-top', (_, flag) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.setAlwaysOnTop(flag);
  return flag;
});

const MARKDOWN_FILE = path.join(DATA_DIR, 'markdown.md');

ipcMain.handle('markdown:load', async () => {
  try {
    return await fs.readFile(MARKDOWN_FILE, 'utf-8');
  } catch {
    return null;
  }
});

ipcMain.handle('markdown:save', async (_, content) => {
  await ensureDataDir();
  await fs.writeFile(MARKDOWN_FILE, content, 'utf-8');
});
