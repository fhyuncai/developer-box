const { app, BrowserWindow, ipcMain, Menu, nativeTheme, Notification, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { createUpdater } = require('./updater.cjs');
const { isSecureStorageAvailable, readSecureNamespace, writeSecureNamespace, maskSecret } = require('./secure-store.cjs');
const { invokeAiProvider, listAiModels } = require('./ai-client.cjs');
const { translateWithBaidu } = require('./baidu-translate.cjs');
const {
  initializeNotesDatabase,
  getDatabaseFilePath,
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  duplicateNote,
  importNoteImage,
} = require('./notes-db.cjs');

const DATA_DIR = path.join(os.homedir(), '.developer-box');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');
const SECURE_STORE_FILE = path.join(DATA_DIR, 'secure-store.json');
const DEFAULT_AI_SECURE_CONFIG = {
  defaultProvider: 'openai',
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    organization: '',
    apiKey: '',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-latest',
    apiKey: '',
  },
};
const DEFAULT_BAIDU_SECURE_CONFIG = {
  appId: '',
  apiKey: '',
};

async function getAiSecureConfig() {
  return readSecureNamespace(SECURE_STORE_FILE, 'ai', DEFAULT_AI_SECURE_CONFIG);
}

function toAiSummary(config = DEFAULT_AI_SECURE_CONFIG) {
  return {
    secureStorageAvailable: isSecureStorageAvailable(),
    defaultProvider: config.defaultProvider || 'openai',
    openai: {
      baseUrl: config.openai?.baseUrl || DEFAULT_AI_SECURE_CONFIG.openai.baseUrl,
      model: config.openai?.model || DEFAULT_AI_SECURE_CONFIG.openai.model,
      organization: config.openai?.organization || '',
      hasApiKey: !!config.openai?.apiKey,
      maskedApiKey: maskSecret(config.openai?.apiKey),
    },
    anthropic: {
      baseUrl: config.anthropic?.baseUrl || DEFAULT_AI_SECURE_CONFIG.anthropic.baseUrl,
      model: config.anthropic?.model || DEFAULT_AI_SECURE_CONFIG.anthropic.model,
      hasApiKey: !!config.anthropic?.apiKey,
      maskedApiKey: maskSecret(config.anthropic?.apiKey),
    },
  };
}

async function getBaiduSecureConfig() {
  return readSecureNamespace(SECURE_STORE_FILE, 'baidu-translate', DEFAULT_BAIDU_SECURE_CONFIG);
}

function buildAiTranslatePrompts({ sourceLanguage, targetLanguage, text }) {
  const from = sourceLanguage && sourceLanguage !== 'auto' ? sourceLanguage : '自动检测';
  const to = targetLanguage || '英语';
  return {
    systemPrompt: '你是专业翻译助手，只返回翻译结果本身，不要额外解释，不要添加引号。',
    userPrompt: `请将以下内容从${from}翻译为${to}，保持原意、术语准确、格式尽量不变：\n\n${text}`,
  };
}

function buildVariableNamePrompts({ text, style }) {
  return {
    systemPrompt: '你是资深软件工程师，请根据中文语义生成自然、简洁、可读的英文变量名。只返回一个变量名，不要解释。',
    userPrompt: `请把以下中文语义转换为 ${style} 风格的英文变量名，只返回变量名本身：\n\n${text}`,
  };
}

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

function broadcastToAllWindows(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

const updater = createUpdater({
  onStateChange: (payload) => broadcastToAllWindows('update-state-changed', payload),
});
let updatePromptInFlight = false;

// ---- 打卡通知调度器 ----
let checkinData = [];
const notifiedSlots = new Set();
let checkinSchedulerTimer = null;

function openCheckinPageFromNotification(checkinId) {
  const sendToWindow = (win) => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('notification-open-checkin', { checkinId: checkinId || null });
  };

  let win = BrowserWindow.getAllWindows()[0];
  if (!win) {
    createWindow();
    win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    win.webContents.once('did-finish-load', () => sendToWindow(win));
    return;
  }

  sendToWindow(win);
}

function checkAndNotifyCheckins() {
  if (!Notification.isSupported()) return;
  if (!Array.isArray(checkinData) || checkinData.length === 0) return;

  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (const checkin of checkinData) {
    if (!checkin.enabled) continue;
    if (!Array.isArray(checkin.weekdays) || !checkin.weekdays.includes(currentDay)) continue;
    if (!Array.isArray(checkin.times) || !checkin.times.includes(currentTime)) continue;

    const slotKey = `${dateStr}-${checkin.id}-${currentTime}`;
    if (notifiedSlots.has(slotKey)) continue;
    notifiedSlots.add(slotKey);

    const notification = new Notification({
      title: '健康打卡提醒',
      body: `是时候「${checkin.title}」了！`,
    });
    notification.on('click', () => openCheckinPageFromNotification(checkin.id));
    notification.show();
  }

  // 清理非今日的已通知记录
  for (const key of notifiedSlots) {
    if (!key.startsWith(dateStr)) {
      notifiedSlots.delete(key);
    }
  }
}

function startCheckinScheduler() {
  if (checkinSchedulerTimer) {
    clearTimeout(checkinSchedulerTimer);
    checkinSchedulerTimer = null;
  }
  // 对齐到下一整分钟，之后每 60 秒检查一次
  const msToNextMinute = 60000 - (Date.now() % 60000);
  checkinSchedulerTimer = setTimeout(() => {
    checkAndNotifyCheckins();
    checkinSchedulerTimer = setInterval(checkAndNotifyCheckins, 60000);
  }, msToNextMinute);
}
// ---- 打卡通知调度器结束 ----

function sendOpenSettingsToFocusedWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    focused.webContents.send('menu-open-settings');
  }
}

function setupMenu() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  const isMac = process.platform === 'darwin';

  if (!isMac) {
    Menu.setApplicationMenu(null);
    return;
  }

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
      { role: 'pasteAndMatchStyle', label: '粘贴并匹配格式' },
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
      { type: 'separator' },
      { role: 'front', label: '全部置于顶层' }
    ]
  };

  const template = [
    macAppMenu,
    customMenu,
    editMenu,
    ...(isDev ? [viewMenu, windowMenu] : [])
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  const window = new BrowserWindow({
    width: 980,
    height: 640,
    minWidth: 980,
    minHeight: 640,
    title: 'Developer Box',
    show: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 14, y: 14 } } : {}),
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

  if (!isMac) {
    window.on('maximize', () => window.webContents.send('window-maximize-changed', true));
    window.on('unmaximize', () => window.webContents.send('window-maximize-changed', false));
  }

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    window.loadURL(devServerUrl);
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return window;
}

async function promptForAvailableUpdate(nextState) {
  if (!nextState?.hasUpdate || updatePromptInFlight) {
    return;
  }

  updatePromptInFlight = true;
  const focusedWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || undefined;

  try {
    const result = await dialog.showMessageBox(focusedWindow, {
      type: 'info',
      title: '发现新版本',
      message: `检测到新版本 ${nextState.latestVersion}`,
      detail: nextState.notes || '',
      buttons: ['立即更新', '稍后'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (result.response === 0) {
      await updater.startUpdate();
    }
  } catch (error) {
    console.error('Failed to prompt for update', error);
  } finally {
    updatePromptInFlight = false;
  }
}

app.whenReady().then(async () => {
  try {
    await ensureDataDir();
    initializeNotesDatabase(DATA_DIR);
    setupMenu();
    createWindow();

    // 加载打卡配置并启动通知调度
    const settings = await readJson(SETTINGS_FILE, {});
    if (Array.isArray(settings?.checkins)) {
      checkinData = settings.checkins;
    }
    startCheckinScheduler();

    nativeTheme.on('updated', () => {
      const value = getSystemTheme();
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('system-theme-changed', value);
      }
    });

    if (app.isPackaged) {
      updater.startPeriodicChecks();
      const result = await updater.checkForUpdates({ reason: 'startup', silent: true });
      if (result?.status === 'update-available') {
        await promptForAvailableUpdate(result.state);
      }
    }
  } catch (error) {
    console.error('Failed to start application', error);
    dialog.showErrorBox(
      '应用启动失败',
      error && error.stack ? error.stack : String(error)
    );
    app.quit();
  }

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
ipcMain.handle('app:get-notes-db-path', async () => getDatabaseFilePath());
ipcMain.handle('app:get-system-theme', async () => getSystemTheme());
ipcMain.handle('updates:get-state', async () => updater.getState());
ipcMain.handle('updates:check', async () => updater.checkForUpdates({ reason: 'manual' }));
ipcMain.handle('updates:start', async () => updater.startUpdate());
ipcMain.handle('app:choose-directory', async (_, payload = {}) => {
  const focused = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(focused || undefined, {
    title: payload.title || '选择工作目录',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: payload.defaultPath || process.cwd(),
    buttonLabel: '选择目录',
  });
  if (result.canceled || !result.filePaths?.length) return '';
  return result.filePaths[0];
});
ipcMain.handle('settings:get', async () => {
  return readJson(SETTINGS_FILE, { themeMode: 'system' });
});
ipcMain.handle('settings:set', async (_, payload) => {
  await writeJson(SETTINGS_FILE, payload);
  return payload;
});
ipcMain.handle('ai:config-summary:get', async () => {
  try {
    const config = await getAiSecureConfig();
    return toAiSummary(config);
  } catch {
    return toAiSummary(DEFAULT_AI_SECURE_CONFIG);
  }
});
ipcMain.handle('ai:config-summary:set', async (_, payload = {}) => {
  const current = await getAiSecureConfig();
  const nextConfig = {
    defaultProvider: payload.defaultProvider || current.defaultProvider || 'openai',
    openai: {
      ...DEFAULT_AI_SECURE_CONFIG.openai,
      ...(current.openai || {}),
      ...(payload.openai || {}),
      apiKey: payload.openai?.apiKey ? String(payload.openai.apiKey).trim() : (current.openai?.apiKey || ''),
    },
    anthropic: {
      ...DEFAULT_AI_SECURE_CONFIG.anthropic,
      ...(current.anthropic || {}),
      ...(payload.anthropic || {}),
      apiKey: payload.anthropic?.apiKey ? String(payload.anthropic.apiKey).trim() : (current.anthropic?.apiKey || ''),
    },
  };
  await writeSecureNamespace(SECURE_STORE_FILE, 'ai', nextConfig);
  return toAiSummary(nextConfig);
});
ipcMain.handle('ai:models:list', async (_, payload = {}) => {
  const config = await getAiSecureConfig();
  const provider = payload.provider || config.defaultProvider || 'openai';
  const currentProviderConfig = config[provider] || {};
  return listAiModels({
    provider,
    config: {
      ...currentProviderConfig,
      ...(payload.baseUrl ? { baseUrl: String(payload.baseUrl).trim() } : {}),
    },
    apiKey: payload.apiKey ? String(payload.apiKey).trim() : (currentProviderConfig.apiKey || ''),
  });
});
ipcMain.handle('translate:baidu-config:get', async () => {
  try {
    const config = await getBaiduSecureConfig();
    return {
      appId: config.appId || '',
      hasApiKey: !!config.apiKey,
    };
  } catch {
    return {
      appId: '',
      hasApiKey: false,
    };
  }
});
ipcMain.handle('translate:baidu-config:set', async (_, payload = {}) => {
  const current = await getBaiduSecureConfig();
  const nextConfig = {
    appId: String(payload.appId || current.appId || '').trim(),
    apiKey: payload.apiKey ? String(payload.apiKey).trim() : (current.apiKey || ''),
  };
  await writeSecureNamespace(SECURE_STORE_FILE, 'baidu-translate', nextConfig);
  return {
    appId: nextConfig.appId,
    hasApiKey: !!nextConfig.apiKey,
  };
});
ipcMain.handle('translate:baidu', async (_, payload = {}) => {
  const config = await getBaiduSecureConfig();
  return translateWithBaidu({
    appId: config.appId,
    apiKey: config.apiKey,
    text: payload.text,
    from: payload.from,
    to: payload.to,
  });
});
ipcMain.handle('translate:ai', async (_, payload = {}) => {
  const config = await getAiSecureConfig();
  const provider = payload.provider || config.defaultProvider || 'openai';
  const providerConfig = config[provider];
  const prompts = buildAiTranslatePrompts(payload);
  return invokeAiProvider({
    provider,
    config: providerConfig,
    apiKey: providerConfig?.apiKey,
    ...prompts,
  });
});
ipcMain.handle('translate:variable-name', async (_, payload = {}) => {
  const config = await getAiSecureConfig();
  const provider = payload.provider || config.defaultProvider || 'openai';
  const providerConfig = config[provider];
  const prompts = buildVariableNamePrompts(payload);
  return invokeAiProvider({
    provider,
    config: providerConfig,
    apiKey: providerConfig?.apiKey,
    temperature: 0.1,
    ...prompts,
  });
});
ipcMain.handle('todos:get', async () => {
  return readJson(TODOS_FILE, []);
});
ipcMain.handle('todos:set', async (_, payload) => {
  await writeJson(TODOS_FILE, payload);
  return payload;
});

ipcMain.handle('notes:list', async () => listNotes());
ipcMain.handle('notes:get', async (_, noteId) => getNote(noteId));
ipcMain.handle('notes:create', async (_, payload) => createNote(payload || {}));
ipcMain.handle('notes:update', async (_, payload) => updateNote(payload || {}));
ipcMain.handle('notes:delete', async (_, noteId) => deleteNote(noteId));
ipcMain.handle('notes:duplicate', async (_, noteId) => duplicateNote(noteId));
ipcMain.handle('notes:import-image', async (_, noteId) => {
  const focused = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(focused || undefined, {
    title: '选择图片',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
    ],
  });
  if (result.canceled || !result.filePaths?.length) return null;
  return importNoteImage(noteId, result.filePaths[0]);
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

ipcMain.handle('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.handle('window:toggle-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.handle('window:is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isMaximized() : false;
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

ipcMain.handle('checkins:update', (_, payload) => {
  if (Array.isArray(payload)) {
    checkinData = payload;
  }
});