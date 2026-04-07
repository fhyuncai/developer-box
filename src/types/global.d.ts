export {};

declare global {
  type DeveloperBoxSettings = {
    themeMode: 'system' | 'light' | 'dark';
    pinnedBoards?: string[];
  };

  interface Window {
    developerBox: {
      getStoragePath: () => Promise<string>;
      getSystemTheme: () => Promise<'light' | 'dark'>;
      getSettings: () => Promise<DeveloperBoxSettings>;
      saveSettings: (settings: DeveloperBoxSettings) => Promise<DeveloperBoxSettings>;
      getTodos: () => Promise<Array<{ id: string; text: string; done: boolean; createdAt: number }>>;
      saveTodos: (todos: Array<{ id: string; text: string; done: boolean; createdAt: number }>) => Promise<Array<{ id: string; text: string; done: boolean; createdAt: number }>>;
      onSystemThemeChange: (callback: (value: 'light' | 'dark') => void) => () => void;
    };
  }
}
