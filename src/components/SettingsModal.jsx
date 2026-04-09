import { Divider, Flex, Modal, Radio, Typography } from 'antd';

export default function SettingsModal({ open, onClose, themeMode, effectiveTheme, onThemeModeChange }) {
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
        <Typography.Title level={5} type="secondary" style={{ margin: 0 }}>
          Developer Box 0.0.1 Alpha
        </Typography.Title>
        <Typography.Text type="secondary">
          &copy; FHYunCai
        </Typography.Text>
      </Flex>
    </Modal>
  );
}
