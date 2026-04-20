const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('developerBox', {
  getPlatform: () => process.platform,
  getStoragePath: () => ipcRenderer.invoke('app:get-storage-path'),
  getNotesDbPath: () => ipcRenderer.invoke('app:get-notes-db-path'),
  getSystemTheme: () => ipcRenderer.invoke('app:get-system-theme'),
  chooseDirectory: (payload) => ipcRenderer.invoke('app:choose-directory', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
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
