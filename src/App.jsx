import { useEffect, useMemo, useState } from 'react';
import { App as AntdApp, Button, Card, Checkbox, ConfigProvider, Flex, Modal, Radio, Space, Statistic, Typography, theme } from 'antd';
import { CheckCircleTwoTone, RightOutlined, SettingOutlined, ToolTwoTone } from '@ant-design/icons';
import TodoList from './components/TodoList';

const { defaultAlgorithm, darkAlgorithm } = theme;

function getEffectiveTheme(themeMode, systemTheme) {
  return themeMode === 'system' ? systemTheme : themeMode;
}

const DASHBOARD_ITEMS = [
  { label: '工具模块', value: 'toolCount' },
  { label: '已完成任务', value: 'doneCount' }
];

const DEFAULT_PINNED = DASHBOARD_ITEMS.map((item) => item.value);

export default function App() {
  const [themeMode, setThemeMode] = useState('system');
  const [systemTheme, setSystemTheme] = useState('light');
  const [todos, setTodos] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinnedBoards, setPinnedBoards] = useState(DEFAULT_PINNED);
  const [activeTool, setActiveTool] = useState('toolbox');

  useEffect(() => {
    let mounted = true;
    let unsubscribe = null;

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
      setTodos(Array.isArray(list) ? list : []);
      setSystemTheme(sysTheme);

      unsubscribe = window.developerBox.onSystemThemeChange((value) => {
        setSystemTheme(value);
      });
    }

    bootstrap();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const effectiveTheme = useMemo(() => getEffectiveTheme(themeMode, systemTheme), [themeMode, systemTheme]);

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

  const saveMergedSettings = async (nextThemeMode, nextPinnedBoards) => {
    await window.developerBox.saveSettings({
      themeMode: nextThemeMode,
      pinnedBoards: nextPinnedBoards
    });
  };

  const handleThemeModeChange = async (event) => {
    const next = event.target.value;
    setThemeMode(next);
    await saveMergedSettings(next, pinnedBoards);
  };

  const handlePinnedBoardsChange = async (checkedValues) => {
    const next = checkedValues;
    setPinnedBoards(next);
    await saveMergedSettings(themeMode, next);
  };

  const handleTodosChange = async (next) => {
    setTodos(next);
    await window.developerBox.saveTodos(next);
  };

  return (
    <ConfigProvider theme={antdTheme}>
      <AntdApp>
        <main className="page-wrap">
          <section className="hero">
            <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
              <Typography.Title level={2} className="hero-title">
                Developer Box
              </Typography.Title>
              <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
                设置
              </Button>
            </Flex>
            <Card className="dashboard-config" size="small">
              <Flex vertical gap={8}>
                <Typography.Text strong>固定看板内容</Typography.Text>
                <Checkbox.Group options={DASHBOARD_ITEMS} value={pinnedBoards} onChange={handlePinnedBoardsChange} />
              </Flex>
            </Card>

            <div className="content-area">
              <Space size={12} wrap>
                {pinnedBoards.includes('toolCount') && (
                  <Card size="small">
                    <Statistic title="工具模块" value={1} prefix={<ToolTwoTone />} />
                  </Card>
                )}
                {pinnedBoards.includes('doneCount') && (
                  <Card size="small">
                    <Statistic
                      title="已完成任务"
                      value={doneCount}
                      prefix={<CheckCircleTwoTone twoToneColor="#52c41a" />}
                    />
                  </Card>
                )}
                {pinnedBoards.length === 0 && (
                  <Card size="small">
                    <Typography.Text type="secondary">已隐藏全部看板内容，可在上方重新勾选。</Typography.Text>
                  </Card>
                )}
              </Space>
            </div>
          </section>

          <section className="content-area">
            {activeTool === 'toolbox' && (
              <section className="toolbox-section">
                <Typography.Title level={4} className="toolbox-title">
                  工具箱
                </Typography.Title>
                <div className="tool-grid">
                  <Card
                    hoverable
                    className="tool-entry"
                    onClick={() => setActiveTool('todo')}
                    actions={[
                      <Button type="link" onClick={() => setActiveTool('todo')}>
                        打开
                      </Button>
                    ]}
                  >
                    <Flex justify="space-between" align="center">
                      <Typography.Text strong>Todo List</Typography.Text>
                      <RightOutlined />
                    </Flex>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                      管理日常任务与进度
                    </Typography.Paragraph>
                  </Card>
                </div>
              </section>
            )}

            {activeTool === 'todo' && (
              <section>
                <Flex justify="space-between" align="center" className="todo-page-head">
                  <Typography.Title level={4} className="toolbox-title">
                    Todo List
                  </Typography.Title>
                  <Button onClick={() => setActiveTool('toolbox')}>返回工具箱</Button>
                </Flex>
                <Card size="small">
                  <TodoList todos={todos} onChange={handleTodosChange} />
                </Card>
              </section>
            )}
          </section>

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
