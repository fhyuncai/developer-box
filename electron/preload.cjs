const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('developerBox', {
  getStoragePath: () => ipcRenderer.invoke('app:get-storage-path'),
  getSystemTheme: () => ipcRenderer.invoke('app:get-system-theme'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  getTodos: () => ipcRenderer.invoke('todos:get'),
  saveTodos: (todos) => ipcRenderer.invoke('todos:set', todos),
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
  saveMarkdown: (content) => ipcRenderer.invoke('markdown:save', content)
});
