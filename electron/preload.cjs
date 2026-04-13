const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('developerBox', {
  getPlatform: () => process.platform,
  getStoragePath: () => ipcRenderer.invoke('app:get-storage-path'),
  getWorkspaceDbPath: () => ipcRenderer.invoke('app:get-workspace-db-path'),
  getSystemTheme: () => ipcRenderer.invoke('app:get-system-theme'),
  chooseDirectory: (payload) => ipcRenderer.invoke('app:choose-directory', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  getTodos: () => ipcRenderer.invoke('todos:get'),
  saveTodos: (todos) => ipcRenderer.invoke('todos:set', todos),
  getWorkspaceOverview: () => ipcRenderer.invoke('workspace:get-overview'),
  listProviders: () => ipcRenderer.invoke('workspace:list-providers'),
  getProvider: (providerId) => ipcRenderer.invoke('workspace:get-provider', providerId),
  saveProvider: (provider) => ipcRenderer.invoke('workspace:save-provider', provider),
  deleteProvider: (providerId) => ipcRenderer.invoke('workspace:delete-provider', providerId),
  refreshProvider: (providerId) => ipcRenderer.invoke('workspace:refresh-provider', providerId),
  listProxies: () => ipcRenderer.invoke('workspace:list-proxies'),
  saveProxy: (proxy) => ipcRenderer.invoke('workspace:save-proxy', proxy),
  deleteProxy: (proxyId) => ipcRenderer.invoke('workspace:delete-proxy', proxyId),
  createWorkspaceTask: (task) => ipcRenderer.invoke('workspace:create-task', task),
  autoOrchestrateWorkspaceTask: (payload) => ipcRenderer.invoke('workspace:auto-orchestrate-task', payload),
  listWorkspaceTasks: () => ipcRenderer.invoke('workspace:list-tasks'),
  getWorkspaceTaskDetail: (taskId) => ipcRenderer.invoke('workspace:get-task-detail', taskId),
  startWorkspaceTask: (taskId) => ipcRenderer.invoke('workspace:start-task', taskId),
  cancelWorkspaceTask: (taskId) => ipcRenderer.invoke('workspace:cancel-task', taskId),
  deleteWorkspaceTask: (taskId) => ipcRenderer.invoke('workspace:delete-task', taskId),
  retryWorkspaceTaskAgent: (taskId, agentId) => ipcRenderer.invoke('workspace:retry-agent', { taskId, agentId }),
  resetWorkspaceTask: (payload) => ipcRenderer.invoke('workspace:reset-task', payload),
  getWorkspaceCommandAllowlist: () => ipcRenderer.invoke('workspace:get-command-allowlist'),
  setWorkspaceCommandAllowlist: (allowlist) => ipcRenderer.invoke('workspace:set-command-allowlist', { allowlist }),
  resolveWorkspaceCommandApproval: (payload) => ipcRenderer.invoke('workspace:resolve-command-approval', payload),
  getWorkspacePendingCommandApprovals: (taskId) => ipcRenderer.invoke('workspace:get-pending-command-approvals', { taskId }),
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
  onWorkspaceRuntimeEvent: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('workspace-runtime-event', listener);
    return () => ipcRenderer.removeListener('workspace-runtime-event', listener);
  },
  updateCheckins: (checkins) => ipcRenderer.invoke('checkins:update', checkins),
});
