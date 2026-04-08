import { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, ConfigProvider, Flex, Modal, Radio, Typography, Divider, theme } from 'antd';
import HomePage from './pages/HomePage';
import ToolboxPage from './pages/ToolboxPage';
import TodoPage from './pages/TodoPage';
import ToolPage from './pages/ToolPage';
import TitleBar from './components/TitleBar';

const { defaultAlgorithm, darkAlgorithm } = theme;

function getEffectiveTheme(themeMode, systemTheme) {
  return themeMode === 'system' ? systemTheme : themeMode;
}

const DEFAULT_PINNED = ['toolCount', 'doneCount'];
const DEFAULT_DASHBOARD_ORDER = ['toolCount', 'doneCount'];
const TOOLS = [
  { key: 'todo', title: 'Todo List', description: '管理日常任务与进度', group: '任务管理' },
  { key: 'base64', title: 'Base64 编解码', description: 'Base64 编码与解码，支持 Unicode', group: '编码 / 解码' },
  { key: 'url-codec', title: 'URL 编解码', description: 'URL percent 编码与解码', group: '编码 / 解码' },
  { key: 'unicode', title: 'Unicode 编码转换', description: '文本与 \\uXXXX 转义互转', group: '编码 / 解码' },
  { key: 'radix', title: '进制转换', description: '二 / 八 / 十 / 十六进制互转', group: '进制 / 颜色' },
  { key: 'rgb-hex', title: 'RGB ↔ HEX', description: 'RGB 与 HEX 颜色格式互转', group: '进制 / 颜色' },
  { key: 'hash', title: 'Hash 哈希计算', description: 'MD5/SHA1/SHA224/SHA256/SHA384/SHA512/SHA3-256/RIPEMD-160', group: '加密 / 安全' },
  { key: 'aes', title: 'AES 加解密', description: 'AES 对称加密与解密', group: '加密 / 安全' },
  { key: 'jwt', title: 'JWT 解析', description: '解析 Header、Payload，检查过期', group: '加密 / 安全' },
  { key: 'json', title: 'JSON 格式化 / 压缩', description: 'JSON 美化与压缩', group: '格式化' },
  { key: 'sql', title: 'SQL 格式化', description: '支持多种 SQL 方言格式化', group: '格式化' },
  { key: 'css', title: 'CSS / SCSS 格式化', description: 'CSS 代码美化与压缩', group: '格式化' },
  { key: 'markdown', title: 'Markdown 编辑器', description: '左编辑右预览 Markdown', group: '文本处理' },
  { key: 'diff', title: '文本差异对比', description: '高亮显示两段文本的异同', group: '文本处理' },
  { key: 'regex', title: '正则表达式验证', description: '实时高亮匹配结果', group: '文本处理' },
  { key: 'word-count', title: '字数统计', description: '字符 / 单词 / 行 / 字节数统计', group: '文本处理' },
  { key: 'case-convert', title: '大小写转换', description: 'camelCase / snake_case 等多种格式', group: '文本处理' },
  { key: 'uuid', title: 'UUID 生成', description: '批量生成 UUID v4', group: '生成工具' },
  { key: 'qrcode', title: '二维码生成', description: '文本或链接生成二维码并可下载', group: '生成工具' },
  { key: 'image-base64', title: '图片 Base64 转换', description: '图片与 Base64 数据互转预览', group: '生成工具' },
  { key: 'timestamp', title: '时间戳转换', description: 'Unix 时间戳与日期时间互转', group: '时间 / 日期' },
  { key: 'cron', title: 'Crontab 表达式', description: '解析描述 + 预览下次执行时间', group: '时间 / 日期' },
];
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
        <div className="app-shell">
          <TitleBar onOpenSettings={() => setSettingsOpen(true)} />
          <main className="page-wrap">
          {currentPage === 'home' && (
            <HomePage
              pinnedBoards={pinnedBoards}
              dashboardOrder={dashboardOrder}
              dashboardItems={DASHBOARD_ITEMS}
              doneCount={doneCount}
              toolCount={TOOLS.length}
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

          {currentPage === 'todo' && (
            <TodoPage
              todos={todos}
              onTodosChange={handleTodosChange}
              onBack={goBack}
              onBackToolbox={goToolbox}
              onBackHome={goHome}
            />
          )}

          {!['home', 'toolbox', 'todo'].includes(currentPage) && (
            <ToolPage
              toolKey={currentPage}
              toolTitle={TOOLS.find((t) => t.key === currentPage)?.title ?? ''}
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
              <Divider size="small" />
              <Typography.Text strong>关于</Typography.Text>
              <Typography.Title level={5} type="secondary" style={{ margin: 0 }}>
                Developer Box 0.0.1
              </Typography.Title>
              <Typography.Text type="secondary">
                &copy; FHYunCai
              </Typography.Text>
            </Flex>
          </Modal>
          </main>
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}
