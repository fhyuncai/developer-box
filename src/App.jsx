import { useEffect, useMemo, useRef, useState } from 'react';
import { App as AntdApp, ConfigProvider, message, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import HomePage from './views/home';
import NotesPage from './views/notes';
import ToolboxPage from './views/toolbox';
import TodoListsPage from './views/todo';
import CheckinPage from './views/checkin';
import TranslationPage from './views/translation';
import ToolPage from './views/toolbox/components/ToolPage';
import TitleBar from './components/TitleBar';
import SettingsModal from './components/SettingsModal';

const { defaultAlgorithm, darkAlgorithm } = theme;

dayjs.locale('zh-cn');

function getEffectiveTheme(themeMode, systemTheme) {
  return themeMode === 'system' ? systemTheme : themeMode;
}

function getInitialThemeState() {
  if (typeof window === 'undefined') {
    return {
      themeMode: 'system',
      systemTheme: 'light',
      effectiveTheme: 'light',
    };
  }

  const fallbackSystemTheme = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  const initialThemeState = window.developerBox?.getInitialThemeState?.();
  const themeMode = initialThemeState?.themeMode === 'light' || initialThemeState?.themeMode === 'dark'
    ? initialThemeState.themeMode
    : 'system';
  const systemTheme = initialThemeState?.systemTheme === 'light' || initialThemeState?.systemTheme === 'dark'
    ? initialThemeState.systemTheme
    : fallbackSystemTheme;

  return {
    themeMode,
    systemTheme,
    effectiveTheme: getEffectiveTheme(themeMode, systemTheme),
  };
}

const INITIAL_THEME_STATE = getInitialThemeState();

const DEFAULT_PINNED = ['doneCount'];
const DEFAULT_DASHBOARD_ORDER = ['doneCount'];
const TOOLS = [
  { key: 'base64', title: 'Base64 编解码', description: 'Base64 编码与解码，支持 Unicode', group: '编码 / 解码' },
  { key: 'url-codec', title: 'URL 编解码', description: 'URL percent 编码与解码', group: '编码 / 解码' },
  { key: 'unicode', title: 'Unicode 编码转换', description: '文本与 \\uXXXX 转义互转', group: '编码 / 解码' },
  { key: 'radix', title: '进制转换', description: '二 / 八 / 十 / 十六进制互转', group: '进制 / 颜色' },
  { key: 'rgb-hex', title: '颜色选择器', description: '颜色选择与颜色代码格式互转', group: '进制 / 颜色' },
  { key: 'hash', title: 'Hash 哈希计算', description: 'MD5、SHA、RIPEMD', group: '加密 / 安全' },
  { key: 'aes', title: 'AES 加解密', description: 'AES 对称加密与解密', group: '加密 / 安全' },
  { key: 'jwt', title: 'JWT 解析', description: '解析 Header、Payload，检查过期', group: '加密 / 安全' },
  { key: 'json', title: 'JSON 工具', description: 'JSON 解析、格式化、压缩', group: '格式化' },
  { key: 'sql', title: 'SQL 格式化', description: '支持多种 SQL 方言格式化', group: '格式化' },
  { key: 'css', title: 'CSS / SCSS 格式化', description: 'CSS 代码美化与压缩', group: '格式化' },
  { key: 'markdown', title: 'Markdown 编辑器', description: '左编辑右预览 Markdown', group: '文本处理' },
  { key: 'diff', title: '文本差异对比', description: '高亮显示两段文本的异同', group: '文本处理' },
  { key: 'regex', title: '正则表达式验证', description: '实时高亮匹配结果', group: '文本处理' },
  { key: 'word-count', title: '字数统计', description: '字符 / 单词 / 行 / 字节数统计', group: '文本处理' },
  { key: 'case-convert', title: '大小写转换', description: 'camelCase / snake_case 等多种格式', group: '文本处理' },
  { key: 'uuid', title: 'UUID 生成', description: '批量生成 UUID v4', group: '生成工具' },
  { key: 'token', title: 'Token 生成器', description: '按字符集和长度自动生成随机字符串', group: '生成工具' },
  { key: 'qrcode', title: '二维码生成', description: '文本或链接生成二维码并可下载', group: '生成工具' },
  { key: 'image-base64', title: '图片 Base64 转换', description: '图片与 Base64 数据互转预览', group: '生成工具' },
  { key: 'timestamp', title: '时间戳转换', description: 'Unix 时间戳与日期时间互转', group: '时间 / 日期' },
  { key: 'cron', title: 'Crontab 表达式', description: '解析描述 + 预览下次执行时间', group: '时间 / 日期' },
  { key: 'subnet', title: '子网计算器', description: '支持 IPv4 / IPv6，自动计算网络范围', group: '网络工具' },
];
const TOOL_TITLE_MAP = new Map(TOOLS.map((tool) => [tool.key, tool.title]));
const PAGE_META = {
  home: { title: '首页', closable: false, parentPageKey: null },
  notes: { title: '笔记本', closable: true, parentPageKey: 'home' },
  toolbox: { title: '工具箱', closable: true, parentPageKey: 'home' },
  'todo-list': { title: 'Todo List', closable: true, parentPageKey: 'home' },
  checkin: { title: '健康打卡', closable: true, parentPageKey: 'home' },
  translation: { title: '翻译', closable: true, parentPageKey: 'home' },
};
const DEFAULT_AI_CONFIG_SUMMARY = {
  secureStorageAvailable: false,
  defaultProvider: 'openai',
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    organization: '',
    hasApiKey: false,
    maskedApiKey: '',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-latest',
    hasApiKey: false,
    maskedApiKey: '',
  },
};
const DASHBOARD_ITEMS = [
  { key: 'doneCount', label: '已完成任务' },
];

const DEFAULT_CHECKINS = [
  { id: 'preset-water', title: '喝水', enabled: false, weekdays: [1, 2, 3, 4, 5], times: ['10:30', '11:30', '13:30', '15:30', '17:00'], records: [], createdAt: Date.now(), preset: true },
  { id: 'preset-stretch', title: '拉伸', enabled: false, weekdays: [1, 2, 3, 4, 5], times: ['11:00', '16:00'], records: [], createdAt: Date.now(), preset: true },
  { id: 'preset-eyes', title: '护眼休息', enabled: false, weekdays: [1, 2, 3, 4, 5], times: ['10:00', '14:00', '16:30'], records: [], createdAt: Date.now(), preset: true },
  { id: 'preset-walk', title: '散步', enabled: false, weekdays: [1, 2, 3, 4, 5], times: ['18:00'], records: [], createdAt: Date.now(), preset: true },
];

const DEFAULT_UPDATE_STATE = {
  updateUrl: '',
  currentVersion: '',
  currentVersionCode: 0,
  latestVersion: '',
  latestVersionCode: 0,
  notes: '',
  hasUpdate: false,
  checking: false,
  downloading: false,
  applying: false,
  progress: 0,
  lastCheckedAt: 0,
  lastError: '',
  downloadUrl: '',
  canAutoApply: false,
};

function normalizeCheckins(list) {
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_CHECKINS;
  return list.map((item) => ({
    id: item.id ?? Date.now().toString(36),
    title: item.title ?? '未命名打卡',
    enabled: item.enabled !== false,
    weekdays: Array.isArray(item.weekdays) ? item.weekdays : [],
    times: Array.isArray(item.times) ? item.times : [],
    records: Array.isArray(item.records) ? item.records : [],
    createdAt: item.createdAt ?? Date.now(),
    preset: !!item.preset,
  }));
}

function migrateOldTodos(loaded) {
  if (!Array.isArray(loaded) || loaded.length === 0) return [];
  if (loaded[0]?.items !== undefined) return loaded;
  return [{ id: 'migrated-default', title: '我的 Todo', items: loaded, startDate: null, dueDate: null, createdAt: Date.now() }];
}

function createPageTab(pageKey) {
  const meta = PAGE_META[pageKey] || PAGE_META.home;
  return {
    id: pageKey,
    kind: 'page',
    pageKey,
    title: meta.title,
    closable: meta.closable,
    parentPageKey: meta.parentPageKey,
  };
}

function normalizeAiConfigSummary(summary) {
  return {
    ...DEFAULT_AI_CONFIG_SUMMARY,
    ...(summary || {}),
    openai: {
      ...DEFAULT_AI_CONFIG_SUMMARY.openai,
      ...(summary?.openai || {}),
    },
    anthropic: {
      ...DEFAULT_AI_CONFIG_SUMMARY.anthropic,
      ...(summary?.anthropic || {}),
    },
  };
}

export default function App() {
  const [themeMode, setThemeMode] = useState(INITIAL_THEME_STATE.themeMode);
  const [systemTheme, setSystemTheme] = useState(INITIAL_THEME_STATE.systemTheme);
  const [todoLists, setTodoLists] = useState([]);
  const [notes, setNotes] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinnedBoards, setPinnedBoards] = useState(DEFAULT_PINNED);
  const [dashboardOrder, setDashboardOrder] = useState(DEFAULT_DASHBOARD_ORDER);
  const [checkins, setCheckins] = useState(DEFAULT_CHECKINS);
  const [tabs, setTabs] = useState([createPageTab('home')]);
  const [activeTabId, setActiveTabId] = useState('home');
  const [updateState, setUpdateState] = useState(DEFAULT_UPDATE_STATE);
  const [aiConfigSummary, setAiConfigSummary] = useState(DEFAULT_AI_CONFIG_SUMMARY);
  const [messageApi, messageContextHolder] = message.useMessage();
  const toolTabCounterRef = useRef(0);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || tabs[0] || createPageTab('home'),
    [tabs, activeTabId]
  );

  const activateHomeTab = () => {
    setActiveTabId('home');
  };

  const activateTab = (tabId) => {
    setActiveTabId(tabId);
  };

  const findExistingPageTab = (pageKey) => tabs.find((tab) => tab.kind === 'page' && tab.pageKey === pageKey);

  const activatePageTabIfExists = (pageKey) => {
    const target = findExistingPageTab(pageKey);
    if (!target) {
      return false;
    }
    setActiveTabId(target.id);
    return true;
  };

  const ensurePageTab = (pageKey) => {
    if (!PAGE_META[pageKey]) {
      return;
    }

    const existing = findExistingPageTab(pageKey);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const nextTab = createPageTab(pageKey);
    setTabs((prev) => [...prev, nextTab]);
    setActiveTabId(nextTab.id);
  };

  const activateParentPageOrHome = (pageKey) => {
    if (!pageKey || !activatePageTabIfExists(pageKey)) {
      activateHomeTab();
    }
  };

  const createToolTab = (toolKey) => {
    const toolTitle = TOOL_TITLE_MAP.get(toolKey);
    if (!toolTitle) {
      return;
    }

    toolTabCounterRef.current += 1;
    const nextTab = {
      id: `tool-${toolKey}-${Date.now()}-${toolTabCounterRef.current}`,
      kind: 'tool',
      pageKey: toolKey,
      title: toolTitle,
      closable: true,
      parentPageKey: 'toolbox',
    };

    setTabs((prev) => [...prev, nextTab]);
    setActiveTabId(nextTab.id);
  };

  const closeTab = (tabId) => {
    if (tabId === 'home') {
      return;
    }

    setTabs((prev) => {
      const targetIndex = prev.findIndex((tab) => tab.id === tabId);
      if (targetIndex < 0) {
        return prev;
      }

      const nextTabs = prev.filter((tab) => tab.id !== tabId);

      setActiveTabId((currentActiveId) => {
        if (currentActiveId !== tabId) {
          return currentActiveId;
        }
        const fallbackTab = nextTabs[targetIndex] || nextTabs[targetIndex - 1] || nextTabs[0] || createPageTab('home');
        return fallbackTab.id;
      });

      return nextTabs;
    });
  };

  const goToParentTab = (tab) => {
    activateParentPageOrHome(tab?.parentPageKey);
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribeTheme = null;
    let unsubscribeMenuSettings = null;
    let unsubscribeCheckinNotification = null;
    let unsubscribeUpdateState = null;

    async function bootstrap() {
      const [settings, list, sysTheme, noteList, nextUpdateState, nextAiSummary] = await Promise.all([
        window.developerBox.getSettings(),
        window.developerBox.getTodos(),
        window.developerBox.getSystemTheme(),
        window.developerBox.listNotes(),
        window.developerBox.getUpdateState(),
        window.developerBox.getAiConfigSummary(),
      ]);

      if (!mounted) {
        return;
      }

      setThemeMode(settings?.themeMode ?? 'system');
      setPinnedBoards(Array.isArray(settings?.pinnedBoards) ? settings.pinnedBoards : DEFAULT_PINNED);
      setDashboardOrder(Array.isArray(settings?.dashboardOrder) ? settings.dashboardOrder : DEFAULT_DASHBOARD_ORDER);
      const loadedCheckins = normalizeCheckins(settings?.checkins);
      setCheckins(loadedCheckins);
      window.developerBox.updateCheckins(loadedCheckins);
      setTodoLists(migrateOldTodos(Array.isArray(list) ? list : []));
      setNotes(Array.isArray(noteList) ? noteList : []);
      setSystemTheme(sysTheme);
      setUpdateState(nextUpdateState || DEFAULT_UPDATE_STATE);
      setAiConfigSummary(normalizeAiConfigSummary(nextAiSummary));

      unsubscribeTheme = window.developerBox.onSystemThemeChange((value) => {
        setSystemTheme(value);
      });

      unsubscribeUpdateState = window.developerBox.onUpdateStateChange((value) => {
        setUpdateState(value || DEFAULT_UPDATE_STATE);
      });

      unsubscribeMenuSettings = window.developerBox.onOpenSettingsFromMenu(() => {
        setSettingsOpen(true);
      });

      unsubscribeCheckinNotification = window.developerBox.onOpenCheckinFromNotification(() => {
        ensurePageTab('checkin');
      });
    }

    bootstrap();

    return () => {
      mounted = false;
      if (unsubscribeTheme) unsubscribeTheme();
      if (unsubscribeMenuSettings) unsubscribeMenuSettings();
      if (unsubscribeCheckinNotification) unsubscribeCheckinNotification();
      if (unsubscribeUpdateState) unsubscribeUpdateState();
    };
  }, []);

  const effectiveTheme = useMemo(() => getEffectiveTheme(themeMode, systemTheme), [themeMode, systemTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  const antdTheme = useMemo(
    () => ({
      algorithm: effectiveTheme === 'dark' ? darkAlgorithm : defaultAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 10,
        fontFamily: 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif',
        ...(effectiveTheme !== 'dark' && { colorTextDescription: 'rgba(0,0,0,0.60)' }),
      }
    }),
    [effectiveTheme]
  );

  const doneCount = todoLists.reduce((sum, list) => sum + list.items.filter((item) => item.done).length, 0);

  const saveMergedSettings = async (nextThemeMode, nextPinnedBoards, nextDashboardOrder, nextCheckins = checkins) => {
    await window.developerBox.saveSettings({
      themeMode: nextThemeMode,
      pinnedBoards: nextPinnedBoards,
      dashboardOrder: nextDashboardOrder,
      checkins: nextCheckins,
    });
  };

  const handleThemeModeChange = async (event) => {
    const next = event.target.value;
    setThemeMode(next);
    await saveMergedSettings(next, pinnedBoards, dashboardOrder);
  };

  const handleDashboardConfigChange = async (nextPinnedBoards, nextDashboardOrder) => {
    setPinnedBoards(nextPinnedBoards);
    setDashboardOrder(nextDashboardOrder);
    await saveMergedSettings(themeMode, nextPinnedBoards, nextDashboardOrder);
  };

  const handleTodoListsChange = async (next) => {
    setTodoLists(next);
    await window.developerBox.saveTodos(next);
  };

  const handleCheckinsChange = async (next) => {
    setCheckins(next);
    window.developerBox.updateCheckins(next);
    await saveMergedSettings(themeMode, pinnedBoards, dashboardOrder, next);
  };

  const handleCheckForUpdates = async () => {
    try {
      const result = await window.developerBox.checkForUpdates();
      if (result?.state) {
        setUpdateState(result.state);
      }

      if (result?.status === 'up-to-date') {
        messageApi.success('当前已是最新版本');
        return;
      }

      if (result?.status === 'not-supported') {
        messageApi.warning(result.error || '当前系统暂无对应的更新包');
        return;
      }

      if (result?.status === 'update-available') {
        messageApi.warning(`发现新版本 ${result.state.latestVersion}`);
      }
    } catch (error) {
      messageApi.error(error?.message || '检查更新失败');
    }
  };

  const handleStartUpdate = async () => {
    try {
      await window.developerBox.startUpdate();
      messageApi.info('更新包准备完成，应用即将重启');
    } catch (error) {
      messageApi.error(error?.message || '开始更新失败');
    }
  };

  const handleSaveAiConfig = async (payload) => {
    try {
      const nextSummary = await window.developerBox.saveAiConfig(payload);
      const normalized = normalizeAiConfigSummary(nextSummary);
      setAiConfigSummary(normalized);
      messageApi.success('AI 配置已保存');
      return normalized;
    } catch (error) {
      messageApi.error(error?.message || '保存 AI 配置失败');
      throw error;
    }
  };

  useEffect(() => {
    const scrollTarget = document.querySelector('.page-wrap');
    if (scrollTarget) {
      scrollTarget.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [activeTabId, activeTab.pageKey]);

  const renderTabPane = (tab) => {
    if (tab.pageKey === 'home') {
      return (
        <HomePage
          pinnedBoards={pinnedBoards}
          dashboardOrder={dashboardOrder}
          dashboardItems={DASHBOARD_ITEMS}
          doneCount={doneCount}
          notes={notes}
          onDashboardConfigChange={handleDashboardConfigChange}
          onOpenPage={ensurePageTab}
        />
      );
    }

    if (tab.pageKey === 'notes') {
      return (
        <NotesPage
          initialNotes={notes}
          onNotesChange={setNotes}
          onBack={() => goToParentTab(tab)}
          onBackHome={activateHomeTab}
        />
      );
    }

    if (tab.pageKey === 'toolbox') {
      return (
        <ToolboxPage
          tools={TOOLS}
          onBack={() => goToParentTab(tab)}
          onBackHome={activateHomeTab}
          onOpenTool={createToolTab}
        />
      );
    }

    if (tab.pageKey === 'todo-list') {
      return (
        <TodoListsPage
          todoLists={todoLists}
          onTodoListsChange={handleTodoListsChange}
          onBack={() => goToParentTab(tab)}
          onBackHome={activateHomeTab}
        />
      );
    }

    if (tab.pageKey === 'checkin') {
      return (
        <CheckinPage
          checkins={checkins}
          onCheckinsChange={handleCheckinsChange}
          onBack={() => goToParentTab(tab)}
          onBackHome={activateHomeTab}
        />
      );
    }

    if (tab.pageKey === 'translation') {
      return (
        <TranslationPage
          aiConfigSummary={aiConfigSummary}
          onBack={() => goToParentTab(tab)}
          onBackHome={activateHomeTab}
        />
      );
    }

    return (
      <ToolPage
        toolKey={tab.pageKey}
        toolTitle={TOOL_TITLE_MAP.get(tab.pageKey) ?? tab.title}
        onBack={() => goToParentTab(tab)}
        onBackToolbox={() => activateParentPageOrHome('toolbox')}
        onBackHome={activateHomeTab}
      />
    );
  };

  return (
    <ConfigProvider theme={antdTheme} locale={zhCN}>
      <AntdApp>
        {messageContextHolder}
        <div className="app-shell">
          <TitleBar
            tabs={tabs}
            activeTabId={activeTabId}
            onActivateTab={activateTab}
            onCloseTab={closeTab}
            onOpenSettings={() => setSettingsOpen(true)}
            hasUpdateDot={updateState.hasUpdate}
          />
          <main className="page-wrap">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`page-pane${tab.id === activeTabId ? ' is-active' : ''}`}
                style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
              >
                {renderTabPane(tab)}
              </div>
            ))}

            <SettingsModal
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              themeMode={themeMode}
              effectiveTheme={effectiveTheme}
              onThemeModeChange={handleThemeModeChange}
              aiConfigSummary={aiConfigSummary}
              onSaveAiConfig={handleSaveAiConfig}
              updateState={updateState}
              onCheckForUpdates={handleCheckForUpdates}
              onStartUpdate={handleStartUpdate}
            />
          </main>
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}
