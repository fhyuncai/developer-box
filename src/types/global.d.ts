export {};

declare global {
  type DeveloperBoxSettings = {
    themeMode: 'system' | 'light' | 'dark';
    pinnedBoards?: string[];
    dashboardOrder?: string[];
    checkins?: Array<Record<string, unknown>>;
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
      getSystemTheme: () => Promise<'light' | 'dark'>;
      chooseDirectory: (payload?: { title?: string; defaultPath?: string }) => Promise<string>;
      getSettings: () => Promise<DeveloperBoxSettings>;
      saveSettings: (settings: DeveloperBoxSettings) => Promise<DeveloperBoxSettings>;
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
