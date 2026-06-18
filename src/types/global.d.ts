export {};

declare global {
  type AiProvider = 'openai' | 'anthropic';

  type DeveloperBoxSettings = {
    themeMode: 'system' | 'light' | 'dark';
    pinnedBoards?: string[];
    dashboardOrder?: string[];
    checkins?: Array<Record<string, unknown>>;
  };

  type InitialThemeState = {
    themeMode: 'system' | 'light' | 'dark';
    systemTheme: 'light' | 'dark';
    effectiveTheme: 'light' | 'dark';
  };

  type AiProviderSummary = {
    baseUrl: string;
    model: string;
    organization?: string;
    hasApiKey: boolean;
    maskedApiKey: string;
  };

  type AiConfigSummary = {
    secureStorageAvailable: boolean;
    defaultProvider: AiProvider;
    openai: AiProviderSummary;
    anthropic: AiProviderSummary;
  };

  type AiConfigPayload = {
    defaultProvider: AiProvider;
    openai: {
      baseUrl: string;
      model: string;
      organization?: string;
      apiKey?: string;
    };
    anthropic: {
      baseUrl: string;
      model: string;
      apiKey?: string;
    };
  };

  type AiModelOption = {
    value: string;
    label: string;
  };

  type BaiduTranslateConfig = {
    appId?: string;
    apiKey?: string;
    hasApiKey?: boolean;
  };

  type AppUpdateState = {
    updateUrl: string;
    currentVersion: string;
    currentVersionCode: number;
    latestVersion: string;
    latestVersionCode: number;
    notes: string;
    hasUpdate: boolean;
    checking: boolean;
    downloading: boolean;
    applying: boolean;
    progress: number;
    lastCheckedAt: number;
    lastError: string;
    downloadUrl: string;
    canAutoApply: boolean;
  };

  type UpdateCheckResult = {
    status: 'update-available' | 'up-to-date' | 'not-supported' | 'error';
    reason: 'startup' | 'interval' | 'manual';
    state: AppUpdateState;
    error?: string;
  };

  type NoteSummary = {
    id: string;
    title: string;
    filename: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
  };

  type NoteDetail = NoteSummary & {
    content: string;
    imageDir: string;
  };

  interface Window {
    developerBox: {
      getPlatform: () => string;
      getStoragePath: () => Promise<string>;
      getNotesDbPath: () => Promise<string>;
      getInitialThemeState: () => InitialThemeState;
      getSystemTheme: () => Promise<'light' | 'dark'>;
      getUpdateState: () => Promise<AppUpdateState>;
      checkForUpdates: () => Promise<UpdateCheckResult>;
      startUpdate: () => Promise<{ status: 'applying' | 'downloading'; state: AppUpdateState }>;
      chooseDirectory: (payload?: { title?: string; defaultPath?: string }) => Promise<string>;
      getSettings: () => Promise<DeveloperBoxSettings>;
      saveSettings: (settings: DeveloperBoxSettings) => Promise<DeveloperBoxSettings>;
      getAiConfigSummary: () => Promise<AiConfigSummary>;
      saveAiConfig: (payload: AiConfigPayload) => Promise<AiConfigSummary>;
      listAiModels: (payload: { provider: AiProvider; baseUrl?: string; apiKey?: string }) => Promise<AiModelOption[]>;
      getBaiduTranslateConfig: () => Promise<BaiduTranslateConfig>;
      saveBaiduTranslateConfig: (payload: BaiduTranslateConfig) => Promise<BaiduTranslateConfig>;
      translateWithBaidu: (payload: { text: string; from?: string; to?: string }) => Promise<{ text: string; provider: 'baidu'; detectedSourceLanguage: string; targetLanguage: string }>;
      translateWithAi: (payload: { provider?: AiProvider; sourceLanguage?: string; targetLanguage?: string; text: string }) => Promise<{ text: string; provider: AiProvider; model: string }>;
      generateVariableName: (payload: { provider?: AiProvider; text: string; style: string }) => Promise<{ text: string; provider: AiProvider; model: string }>;
      getTodos: () => Promise<any[]>;
      saveTodos: (todos: any[]) => Promise<any[]>;
      listNotes: () => Promise<NoteSummary[]>;
      getNote: (noteId: string) => Promise<NoteDetail | null>;
      createNote: (payload?: Partial<NoteDetail>) => Promise<NoteDetail>;
      updateNote: (payload: Partial<NoteDetail> & { id: string }) => Promise<NoteDetail>;
      deleteNote: (noteId: string) => Promise<boolean>;
      duplicateNote: (noteId: string) => Promise<NoteDetail>;
      importNoteImage: (noteId: string) => Promise<{ fileName: string; relativePath: string; absolutePath: string } | null>;
      onOpenSettingsFromMenu: (callback: () => void) => () => void;
      onSystemThemeChange: (callback: (value: 'light' | 'dark') => void) => () => void;
      onUpdateStateChange: (callback: (value: AppUpdateState) => void) => () => void;
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
      updateCheckins: (checkins: any[]) => Promise<void>;
    };
  }
}
