const { contextBridge, ipcRenderer } = require('electron');

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
  getStoragePath: () => ipcRenderer.invoke('app:get-storage-path'),
  getNotesDbPath: () => ipcRenderer.invoke('app:get-notes-db-path'),
  getInitialThemeState: () => initialThemeState,
  getSystemTheme: () => ipcRenderer.invoke('app:get-system-theme'),
  getUpdateState: () => ipcRenderer.invoke('updates:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  startUpdate: () => ipcRenderer.invoke('updates:start'),
  chooseDirectory: (payload) => ipcRenderer.invoke('app:choose-directory', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  getAiConfigSummary: () => ipcRenderer.invoke('ai:config-summary:get'),
  saveAiConfig: (payload) => ipcRenderer.invoke('ai:config-summary:set', payload),
  listAiModels: (payload) => ipcRenderer.invoke('ai:models:list', payload),
  getBaiduTranslateConfig: () => ipcRenderer.invoke('translate:baidu-config:get'),
  saveBaiduTranslateConfig: (payload) => ipcRenderer.invoke('translate:baidu-config:set', payload),
  translateWithBaidu: (payload) => ipcRenderer.invoke('translate:baidu', payload),
  translateWithAi: (payload) => ipcRenderer.invoke('translate:ai', payload),
  generateVariableName: (payload) => ipcRenderer.invoke('translate:variable-name', payload),
  getTodos: () => ipcRenderer.invoke('todos:get'),
  saveTodos: (todos) => ipcRenderer.invoke('todos:set', todos),
  listNotes: () => ipcRenderer.invoke('notes:list'),
  getNote: (noteId) => ipcRenderer.invoke('notes:get', noteId),
  createNote: (payload) => ipcRenderer.invoke('notes:create', payload),
  updateNote: (payload) => ipcRenderer.invoke('notes:update', payload),
  deleteNote: (noteId) => ipcRenderer.invoke('notes:delete', noteId),
  duplicateNote: (noteId) => ipcRenderer.invoke('notes:duplicate', noteId),
  importNoteImage: (noteId) => ipcRenderer.invoke('notes:import-image', noteId),
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
  getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:set-always-on-top', flag),
  loadMarkdown: () => ipcRenderer.invoke('markdown:load'),
  saveMarkdown: (content) => ipcRenderer.invoke('markdown:save', content),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
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
  updateCheckins: (checkins) => ipcRenderer.invoke('checkins:update', checkins),
});
