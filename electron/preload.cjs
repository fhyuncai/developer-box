const { contextBridge, ipcRenderer } = require('electron');

function cleanIpcErrorMessage(error, channel) {
  const rawMessage = error?.message ? String(error.message) : String(error || '未知错误');
  const invokePrefix = `Error invoking remote method '${channel}': `;
  let nextMessage = rawMessage.startsWith(invokePrefix)
    ? rawMessage.slice(invokePrefix.length)
    : rawMessage;

  while (nextMessage.startsWith('Error: ')) {
    nextMessage = nextMessage.slice('Error: '.length);
  }

  return nextMessage.trim() || rawMessage;
}

async function invokeIpc(channel, ...args) {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`[developerBox] IPC invoke failed: ${channel}`, error);
    throw new Error(cleanIpcErrorMessage(error, channel));
  }
}

function getProcessArgValue(prefix) {
  const matchedArg = process.argv.find((item) => item.startsWith(prefix));
  return matchedArg ? matchedArg.slice(prefix.length) : '';
}

function normalizeThemeMode(themeMode) {
  return themeMode === 'light' || themeMode === 'dark' ? themeMode : 'system';
}

function normalizeEffectiveTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light';
}

const initialThemeState = (() => {
  const themeMode = normalizeThemeMode(getProcessArgValue('--developer-box-theme-mode='));
  const systemTheme = normalizeEffectiveTheme(getProcessArgValue('--developer-box-system-theme='));
  const effectiveTheme = normalizeEffectiveTheme(
    getProcessArgValue('--developer-box-effective-theme=') || (themeMode === 'system' ? systemTheme : themeMode)
  );

  return {
    themeMode,
    systemTheme,
    effectiveTheme,
  };
})();

contextBridge.exposeInMainWorld('developerBox', {
  getPlatform: () => process.platform,
  getStoragePath: () => invokeIpc('app:get-storage-path'),
  getNotesDbPath: () => invokeIpc('app:get-notes-db-path'),
  getInitialThemeState: () => initialThemeState,
  getSystemTheme: () => invokeIpc('app:get-system-theme'),
  getUpdateState: () => invokeIpc('updates:get-state'),
  checkForUpdates: () => invokeIpc('updates:check'),
  startUpdate: () => invokeIpc('updates:start'),
  chooseDirectory: (payload) => invokeIpc('app:choose-directory', payload),
  getSettings: () => invokeIpc('settings:get'),
  saveSettings: (settings) => invokeIpc('settings:set', settings),
  getAiConfigSummary: () => invokeIpc('ai:config-summary:get'),
  saveAiConfig: (payload) => invokeIpc('ai:config-summary:set', payload),
  listAiModels: (payload) => invokeIpc('ai:models:list', payload),
  getBaiduTranslateConfig: () => invokeIpc('translate:baidu-config:get'),
  saveBaiduTranslateConfig: (payload) => invokeIpc('translate:baidu-config:set', payload),
  translateWithBaidu: (payload) => invokeIpc('translate:baidu', payload),
  translateWithAi: (payload) => invokeIpc('translate:ai', payload),
  generateVariableName: (payload) => invokeIpc('translate:variable-name', payload),
  getTodos: () => invokeIpc('todos:get'),
  saveTodos: (todos) => invokeIpc('todos:set', todos),
  listNotes: () => invokeIpc('notes:list'),
  getNote: (noteId) => invokeIpc('notes:get', noteId),
  createNote: (payload) => invokeIpc('notes:create', payload),
  updateNote: (payload) => invokeIpc('notes:update', payload),
  deleteNote: (noteId) => invokeIpc('notes:delete', noteId),
  duplicateNote: (noteId) => invokeIpc('notes:duplicate', noteId),
  importNoteImage: (noteId) => invokeIpc('notes:import-image', noteId),
  onOpenSettingsFromMenu: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('menu-open-settings', listener);
    return () => ipcRenderer.removeListener('menu-open-settings', listener);
  },
  onSystemThemeChange: (callback) => {
    const listener = (_, value) => callback(value);
    ipcRenderer.on('system-theme-changed', listener);
    return () => ipcRenderer.removeListener('system-theme-changed', listener);
  },
  onUpdateStateChange: (callback) => {
    const listener = (_, value) => callback(value);
    ipcRenderer.on('update-state-changed', listener);
    return () => ipcRenderer.removeListener('update-state-changed', listener);
  },
  getAlwaysOnTop: () => invokeIpc('window:get-always-on-top'),
  setAlwaysOnTop: (flag) => invokeIpc('window:set-always-on-top', flag),
  loadMarkdown: () => invokeIpc('markdown:load'),
  saveMarkdown: (content) => invokeIpc('markdown:save', content),
  minimizeWindow: () => invokeIpc('window:minimize'),
  toggleMaximize: () => invokeIpc('window:toggle-maximize'),
  closeWindow: () => invokeIpc('window:close'),
  isMaximized: () => invokeIpc('window:is-maximized'),
  onMaximizeChanged: (callback) => {
    const listener = (_, value) => callback(value);
    ipcRenderer.on('window-maximize-changed', listener);
    return () => ipcRenderer.removeListener('window-maximize-changed', listener);
  },
  onOpenCheckinFromNotification: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('notification-open-checkin', listener);
    return () => ipcRenderer.removeListener('notification-open-checkin', listener);
  },
  updateCheckins: (checkins) => invokeIpc('checkins:update', checkins),
});
