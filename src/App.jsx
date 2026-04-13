import { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import HomePage from './views/home';
import ToolboxPage from './views/toolbox';
import TodoListsPage from './views/todo';
import CheckinPage from './views/checkin';
import WorkspacePage from './views/workspace';
import WorkspaceTaskDetailPage from './views/workspace/detail';
import ToolPage from './views/toolbox/components/ToolPage';
import TitleBar from './components/TitleBar';
import SettingsModal from './components/SettingsModal';

const { defaultAlgorithm, darkAlgorithm } = theme;

dayjs.locale('zh-cn');

function getEffectiveTheme(themeMode, systemTheme) {
  return themeMode === 'system' ? systemTheme : themeMode;
}

const DEFAULT_PINNED = ['doneCount'];
const DEFAULT_DASHBOARD_ORDER = ['doneCount'];
const TOOLS = [
  { key: 'base64', title: 'Base64 编解码', description: 'Base64 编码与解码，支持 Unicode', group: '编码 / 解码' },
  { key: 'url-codec', title: 'URL 编解码', description: 'URL percent 编码与解码', group: '编码 / 解码' },
  { key: 'unicode', title: 'Unicode 编码转换', description: '文本与 \\uXXXX 转义互转', group: '编码 / 解码' },
  { key: 'radix', title: '进制转换', description: '二 / 八 / 十 / 十六进制互转', group: '进制 / 颜色' },
  { key: 'rgb-hex', title: '颜色选择器', description: '颜色选择与 HEX/RGB/HSL/HWB/LCH/CMYK 互转', group: '进制 / 颜色' },
  { key: 'hash', title: 'Hash 哈希计算', description: 'MD5/SHA1/SHA224/SHA256/SHA384/SHA512/SHA3-256/RIPEMD-160', group: '加密 / 安全' },
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
const DASHBOARD_ITEMS = [
  { key: 'doneCount', label: '已完成任务' },
];

const DEFAULT_CHECKINS = [
  { id: 'preset-water', title: '喝水', enabled: false, weekdays: [1, 2, 3, 4, 5], times: ['10:30', '11:30', '13:30', '15:30', '17:00'], records: [], createdAt: Date.now(), preset: true },
  { id: 'preset-stretch', title: '拉伸', enabled: false, weekdays: [1, 2, 3, 4, 5], times: ['11:00', '16:00'], records: [], createdAt: Date.now(), preset: true },
  { id: 'preset-eyes', title: '护眼休息', enabled: false, weekdays: [1, 2, 3, 4, 5], times: ['10:00', '14:00', '16:30'], records: [], createdAt: Date.now(), preset: true },
  { id: 'preset-walk', title: '散步', enabled: false, weekdays: [1, 2, 3, 4, 5], times: ['18:00'], records: [], createdAt: Date.now(), preset: true },
];

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

export default function App() {
  const [themeMode, setThemeMode] = useState('system');
  const [systemTheme, setSystemTheme] = useState('light');
  const [todoLists, setTodoLists] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinnedBoards, setPinnedBoards] = useState(DEFAULT_PINNED);
  const [dashboardOrder, setDashboardOrder] = useState(DEFAULT_DASHBOARD_ORDER);
  const [checkins, setCheckins] = useState(DEFAULT_CHECKINS);
  const [pageStack, setPageStack] = useState(['home']);
  const [workspaceDetailTaskId, setWorkspaceDetailTaskId] = useState('');

  useEffect(() => {
    let mounted = true;
    let unsubscribeTheme = null;
    let unsubscribeMenuSettings = null;
    let unsubscribeCheckinNotification = null;

    async function bootstrap() {
      const [settings, list, sysTheme] = await Promise.all([
        window.developerBox.getSettings(),
        window.developerBox.getTodos(),
        window.developerBox.getSystemTheme()
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
      setSystemTheme(sysTheme);

      unsubscribeTheme = window.developerBox.onSystemThemeChange((value) => {
        setSystemTheme(value);
      });

      unsubscribeMenuSettings = window.developerBox.onOpenSettingsFromMenu(() => {
        setSettingsOpen(true);
      });

      unsubscribeCheckinNotification = window.developerBox.onOpenCheckinFromNotification(() => {
        goToPage('checkin');
      });
    }

    bootstrap();

    return () => {
      mounted = false;
      if (unsubscribeTheme) unsubscribeTheme();
      if (unsubscribeMenuSettings) unsubscribeMenuSettings();
      if (unsubscribeCheckinNotification) unsubscribeCheckinNotification();
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

  const doneCount = todoLists.reduce((s, l) => s + l.items.filter((i) => i.done).length, 0);

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

  const currentPage = pageStack[pageStack.length - 1] || 'home';

  const goToPage = (nextPage) => {
    setPageStack((prev) => {
      const current = prev[prev.length - 1];
      if (current === nextPage) {
        return prev;
      }
      return [...prev, nextPage];
    });
  };

  const goBack = () => {
    setPageStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const goHome = () => {
    setPageStack(['home']);
  };

  const goToolbox = () => {
    setPageStack(['home', 'toolbox']);
  };

  return (
    <ConfigProvider theme={antdTheme} locale={zhCN}>
      <AntdApp>
        <div className="app-shell">
          <TitleBar onOpenSettings={() => setSettingsOpen(true)} />
          <main className="page-wrap">
          {currentPage === 'home' && (
            <HomePage
              pinnedBoards={pinnedBoards}
              dashboardOrder={dashboardOrder}
              dashboardItems={DASHBOARD_ITEMS}
              doneCount={doneCount}
              onDashboardConfigChange={handleDashboardConfigChange}
              onOpenPage={(pageKey) => goToPage(pageKey)}
            />
          )}

          {currentPage === 'toolbox' && (
            <ToolboxPage
              tools={TOOLS}
              onBack={goBack}
              onBackHome={goHome}
              onOpenTool={(toolKey) => goToPage(toolKey)}
            />
          )}

          {currentPage === 'todo-list' && (
            <TodoListsPage
              todoLists={todoLists}
              onTodoListsChange={handleTodoListsChange}
              onBack={goBack}
              onBackHome={goHome}
            />
          )}

          {currentPage === 'checkin' && (
            <CheckinPage
              checkins={checkins}
              onCheckinsChange={handleCheckinsChange}
              onBack={goBack}
              onBackHome={goHome}
            />
          )}

          {currentPage === 'workspace' && (
            <WorkspacePage
              onBack={goBack}
              onBackHome={goHome}
              onOpenTaskDetail={(taskId) => {
                setWorkspaceDetailTaskId(taskId);
                goToPage('workspace-task-detail');
              }}
            />
          )}

          {currentPage === 'workspace-task-detail' && (
            <WorkspaceTaskDetailPage
              taskId={workspaceDetailTaskId}
              onBack={goBack}
              onBackHome={goHome}
            />
          )}

          {!['home', 'toolbox', 'todo-list', 'checkin', 'workspace', 'workspace-task-detail'].includes(currentPage) && (
            <ToolPage
              toolKey={currentPage}
              toolTitle={TOOLS.find((t) => t.key === currentPage)?.title ?? ''}
              onBack={goBack}
              onBackToolbox={goToolbox}
              onBackHome={goHome}
            />
          )}

          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            themeMode={themeMode}
            effectiveTheme={effectiveTheme}
            onThemeModeChange={handleThemeModeChange}
          />
          </main>
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}
