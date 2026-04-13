export {};

declare global {
  type DeveloperBoxSettings = {
    themeMode: 'system' | 'light' | 'dark';
    pinnedBoards?: string[];
    dashboardOrder?: string[];
    checkins?: Array<Record<string, unknown>>;
  };

  type WorkspaceProvider = {
    id: string;
    name: string;
    kind: 'cli' | 'openai' | 'anthropic' | 'gemini';
    enabled: boolean;
    config: Record<string, any>;
    secret: Record<string, any>;
    quota: Record<string, any>;
    runtime: {
      models?: Array<{ id: string; label?: string; raw?: any }>;
      [key: string]: any;
    };
    stats?: {
      executionCount: number;
      spentUsd: number;
      totalTokens: number;
    };
    createdAt: string;
    updatedAt: string;
  };

  type WorkspaceProxy = {
    id: string;
    name: string;
    enabled: boolean;
    config: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  };

  type WorkspaceTask = {
    id: string;
    title: string;
    goal: string;
    workingDirectory?: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    summary?: string;
    inputText?: string;
    errorText?: string;
    orchestration?: Record<string, any>;
    createdAt: string;
    startedAt?: string;
    finishedAt?: string;
    updatedAt: string;
    agentCount?: number;
    completedAgentCount?: number;
    failedAgentCount?: number;
  };

  type WorkspaceTaskAgent = {
    id: string;
    taskId: string;
    name: string;
    providerId: string;
    role?: string;
    status: string;
    inputText?: string;
    outputText?: string;
    errorText?: string;
    dependsOn: string[];
    settings: Record<string, any>;
    usage?: Record<string, any> | null;
    createdAt: string;
    startedAt?: string;
    finishedAt?: string;
    updatedAt: string;
  };

  type WorkspaceTaskLog = {
    id: number;
    taskId: string;
    agentId?: string | null;
    level: string;
    direction: string;
    message: string;
    createdAt: string;
  };

  type WorkspaceTaskDetail = {
    task: WorkspaceTask;
    agents: WorkspaceTaskAgent[];
    logs: WorkspaceTaskLog[];
  };

  type WorkspaceRuntimeEvent = {
    taskId: string;
    type: string;
    at: string;
    agentId?: string;
    level?: string;
    direction?: string;
    message?: string;
    status?: string;
  };

  interface Window {
    developerBox: {
      getPlatform: () => string;
      getStoragePath: () => Promise<string>;
      getWorkspaceDbPath: () => Promise<string>;
      getSystemTheme: () => Promise<'light' | 'dark'>;
      chooseDirectory: (payload?: { title?: string; defaultPath?: string }) => Promise<string>;
      getSettings: () => Promise<DeveloperBoxSettings>;
      saveSettings: (settings: DeveloperBoxSettings) => Promise<DeveloperBoxSettings>;
      getTodos: () => Promise<any[]>;
      saveTodos: (todos: any[]) => Promise<any[]>;
      getWorkspaceOverview: () => Promise<{
        stats: {
          providerCount: number;
          runningCount: number;
          queuedCount: number;
          completedCount: number;
          failedCount: number;
          totalSpentUsd: number;
        };
        providers: WorkspaceProvider[];
        recentTasks: WorkspaceTask[];
      }>;
      listProviders: () => Promise<WorkspaceProvider[]>;
      getProvider: (providerId: string) => Promise<WorkspaceProvider | null>;
      saveProvider: (provider: Partial<WorkspaceProvider>) => Promise<WorkspaceProvider>;
      deleteProvider: (providerId: string) => Promise<void>;
      refreshProvider: (providerId: string) => Promise<WorkspaceProvider>;
      listProxies: () => Promise<WorkspaceProxy[]>;
      saveProxy: (proxy: Partial<WorkspaceProxy>) => Promise<WorkspaceProxy>;
      deleteProxy: (proxyId: string) => Promise<void>;
      createWorkspaceTask: (task: Record<string, any>) => Promise<WorkspaceTaskDetail>;
      autoOrchestrateWorkspaceTask: (payload: {
        providerId: string;
        model?: string;
        title: string;
        goal: string;
        workingDirectory: string;
      }) => Promise<{
        steps: Array<{
          name: string;
          role: string;
          providerId: string;
          model: string;
          instructions: string;
          descriptionCn?: string;
          dependsOn: number[];
          roleLabel?: string;
        }>;
        summary?: string;
        raw: string;
      }>;
      listWorkspaceTasks: () => Promise<WorkspaceTask[]>;
      getWorkspaceTaskDetail: (taskId: string) => Promise<WorkspaceTaskDetail | null>;
      startWorkspaceTask: (taskId: string) => Promise<{ started: boolean }>;
      cancelWorkspaceTask: (taskId: string) => Promise<boolean>;
      deleteWorkspaceTask: (taskId: string) => Promise<void>;
      getWorkspaceCommandAllowlist: () => Promise<{ ok: boolean; data?: string[]; message?: string }>;
      setWorkspaceCommandAllowlist: (allowlist: string[]) => Promise<{ ok: boolean; data?: string[]; message?: string }>;
      onOpenSettingsFromMenu: (callback: () => void) => () => void;
      onSystemThemeChange: (callback: (value: 'light' | 'dark') => void) => () => void;
      getAlwaysOnTop: () => Promise<boolean>;
      setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
      loadMarkdown: () => Promise<string | null>;
      saveMarkdown: (content: string) => Promise<void>;
      minimizeWindow: () => Promise<void>;
      toggleMaximize: () => Promise<void>;
      closeWindow: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onMaximizeChanged: (callback: (value: boolean) => void) => () => void;
      onOpenCheckinFromNotification: (callback: (payload: any) => void) => () => void;
      onWorkspaceRuntimeEvent: (callback: (payload: WorkspaceRuntimeEvent) => void) => () => void;
      updateCheckins: (checkins: any[]) => Promise<void>;
    };
  }
}
