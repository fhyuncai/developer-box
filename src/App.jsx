import { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, ConfigProvider, Flex, Modal, Radio, Typography, theme } from 'antd';
import HomePage from './pages/HomePage';
import ToolboxPage from './pages/ToolboxPage';
import TodoPage from './pages/TodoPage';

const { defaultAlgorithm, darkAlgorithm } = theme;

function getEffectiveTheme(themeMode, systemTheme) {
  return themeMode === 'system' ? systemTheme : themeMode;
}

const DEFAULT_PINNED = ['toolCount', 'doneCount'];
const DEFAULT_DASHBOARD_ORDER = ['toolCount', 'doneCount'];
const TOOLS = [{ key: 'todo', title: 'Todo List', description: '管理日常任务与进度' }];
const DASHBOARD_ITEMS = [
  { key: 'toolCount', label: '工具模块' },
  { key: 'doneCount', label: '已完成任务' }
];

export default function App() {
  const [themeMode, setThemeMode] = useState('system');
  const [systemTheme, setSystemTheme] = useState('light');
  const [todos, setTodos] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinnedBoards, setPinnedBoards] = useState(DEFAULT_PINNED);
  const [dashboardOrder, setDashboardOrder] = useState(DEFAULT_DASHBOARD_ORDER);
  const [pageStack, setPageStack] = useState(['home']);

  useEffect(() => {
    let mounted = true;
    let unsubscribeTheme = null;
    let unsubscribeMenuSettings = null;

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
      setTodos(Array.isArray(list) ? list : []);
      setSystemTheme(sysTheme);

      unsubscribeTheme = window.developerBox.onSystemThemeChange((value) => {
        setSystemTheme(value);
      });

      unsubscribeMenuSettings = window.developerBox.onOpenSettingsFromMenu(() => {
        setSettingsOpen(true);
      });
    }

    bootstrap();

    return () => {
      mounted = false;
      if (unsubscribeTheme) unsubscribeTheme();
      if (unsubscribeMenuSettings) unsubscribeMenuSettings();
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
        fontFamily: 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif'
      }
    }),
    [effectiveTheme]
  );

  const doneCount = todos.filter((item) => item.done).length;

  const saveMergedSettings = async (nextThemeMode, nextPinnedBoards, nextDashboardOrder) => {
    await window.developerBox.saveSettings({
      themeMode: nextThemeMode,
      pinnedBoards: nextPinnedBoards,
      dashboardOrder: nextDashboardOrder
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

  const handleTodosChange = async (next) => {
    setTodos(next);
    await window.developerBox.saveTodos(next);
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
    <ConfigProvider theme={antdTheme}>
      <AntdApp>
        <main className="page-wrap">
          {currentPage === 'home' && (
            <HomePage
              pinnedBoards={pinnedBoards}
              dashboardOrder={dashboardOrder}
              dashboardItems={DASHBOARD_ITEMS}
              doneCount={doneCount}
              toolCount={TOOLS.length}
              onDashboardConfigChange={handleDashboardConfigChange}
              onOpenToolbox={() => goToPage('toolbox')}
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

          {currentPage === 'todo' && (
            <TodoPage
              todos={todos}
              onTodosChange={handleTodosChange}
              onBack={goBack}
              onBackToolbox={goToolbox}
              onBackHome={goHome}
            />
          )}

          <Modal
            title="设置"
            open={settingsOpen}
            onCancel={() => setSettingsOpen(false)}
            footer={null}
            destroyOnClose
          >
            <Flex vertical gap={12}>
              <Typography.Text strong>主题模式</Typography.Text>
              <Radio.Group value={themeMode} onChange={handleThemeModeChange} optionType="button" buttonStyle="solid">
                <Radio.Button value="system">跟随系统</Radio.Button>
                <Radio.Button value="light">浅色</Radio.Button>
                <Radio.Button value="dark">深色</Radio.Button>
              </Radio.Group>
              <Typography.Text type="secondary">
                当前生效：{effectiveTheme === 'dark' ? '深色' : '浅色'}
              </Typography.Text>
            </Flex>
          </Modal>
        </main>
      </AntdApp>
    </ConfigProvider>
  );
}
