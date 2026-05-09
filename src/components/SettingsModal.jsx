import { Button, Divider, Flex, Modal, Radio, Tag, Typography } from 'antd';
import { VERSION } from '../version';

function formatCheckedAt(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

export default function SettingsModal({
  open,
  onClose,
  themeMode,
  effectiveTheme,
  onThemeModeChange,
  updateState,
  onCheckForUpdates,
  onStartUpdate,
}) {
  const checkedAtText = formatCheckedAt(updateState?.lastCheckedAt);

  return (
    <Modal
      title="设置"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Flex vertical gap={12}>
        <Typography.Text strong>主题模式</Typography.Text>
        <Radio.Group value={themeMode} onChange={onThemeModeChange} optionType="button" buttonStyle="solid">
          <Radio.Button value="system">跟随系统</Radio.Button>
          <Radio.Button value="light">浅色</Radio.Button>
          <Radio.Button value="dark">深色</Radio.Button>
        </Radio.Group>
        <Typography.Text type="secondary">
          当前生效：{effectiveTheme === 'dark' ? '深色' : '浅色'}
        </Typography.Text>
        <Divider size="small" />
        <Typography.Text strong>关于</Typography.Text>
        <Flex align="center" gap={0} wrap>
          <Typography.Title level={5} type="secondary" style={{ margin: 0 }}>
            Developer Box {VERSION}
          </Typography.Title>
          <Button
            size="small"
            type="link"
            loading={!!updateState?.checking}
            disabled={!!updateState?.downloading || !!updateState?.applying}
            onClick={onCheckForUpdates}
          >
            检查更新
          </Button>
        </Flex>
        {updateState?.hasUpdate && (
          <Flex vertical gap={8}>
            <Flex align="center" gap={8} wrap>
              <Tag color="error">发现新版本 {updateState.latestVersion}</Tag>
              <Button
                size="small"
                type="primary"
                loading={!!updateState?.downloading}
                disabled={!updateState?.canAutoApply || !!updateState?.applying}
                onClick={onStartUpdate}
              >
                下载并重启
              </Button>
            </Flex>
            {!!updateState?.notes && (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {updateState.notes}
              </Typography.Paragraph>
            )}
            {!updateState?.canAutoApply && (
              <Typography.Text type="secondary">
                当前环境不支持自动安装更新，请在构建后的应用中测试。
              </Typography.Text>
            )}
          </Flex>
        )}
        {!!updateState?.applying && (
          <Typography.Text type="secondary">更新包已准备完成，应用正在重启。</Typography.Text>
        )}
        {!!updateState?.lastError && (
          <Typography.Text type="danger">{updateState.lastError}</Typography.Text>
        )}
        <Typography.Text type="secondary">
          &copy; FHYunCai
        </Typography.Text>
      </Flex>
    </Modal>
  );
}
