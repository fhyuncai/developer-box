import { useEffect, useState } from 'react';
import { App as AntdApp } from 'antd';
import { AutoComplete, Button, Divider, Flex, Space, Form, Input, Modal, Radio, Select, Tag, Typography } from 'antd';
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
  aiConfigSummary,
  onSaveAiConfig,
  updateState,
  onCheckForUpdates,
  onStartUpdate,
}) {
  const { message } = AntdApp.useApp();
  const checkedAtText = formatCheckedAt(updateState?.lastCheckedAt);
  const [form] = Form.useForm();
  const [apiFormat, setApiFormat] = useState(aiConfigSummary?.defaultProvider || 'openai');
  const [modelOptions, setModelOptions] = useState([]);
  const [modelLoading, setModelLoading] = useState(false);

  const applyProviderFields = (provider) => {
    const summary = aiConfigSummary?.[provider] || {};
    form.setFieldsValue({
      apiFormat: provider,
      baseUrl: summary.baseUrl || '',
      model: summary.model || '',
      apiKey: '',
    });
    setModelOptions([]);
  };

  useEffect(() => {
    if (!open) return;
    const provider = aiConfigSummary?.defaultProvider || 'openai';
    setApiFormat(provider);
    applyProviderFields(provider);
  }, [aiConfigSummary, form, open]);

  const handleLoadModels = async () => {
    try {
      const values = form.getFieldsValue(['apiFormat', 'baseUrl', 'apiKey']);
      setModelLoading(true);
      const list = await window.developerBox.listAiModels({
        provider: values.apiFormat || apiFormat,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
      });
      setModelOptions(Array.isArray(list) ? list : []);
      if (!list?.length) {
        message.warning('未查询到可用模型');
      } else {
        message.success(`已获取 ${list.length} 个模型`);
      }
    } catch (error) {
      message.error(error?.message || '获取模型列表失败');
    } finally {
      setModelLoading(false);
    }
  };

  const handleSaveAi = async () => {
    try {
      const values = await form.validateFields();
      await onSaveAiConfig?.({
        defaultProvider: values.apiFormat,
        ...(values.apiFormat === 'openai'
          ? {
              openai: {
                baseUrl: values.baseUrl,
                model: values.model,
                apiKey: values.apiKey,
              },
            }
          : {
              anthropic: {
                baseUrl: values.baseUrl,
                model: values.model,
                apiKey: values.apiKey,
              },
            }),
      });
      form.setFieldsValue({
        apiKey: '',
      });
    } catch {
      // 提示由上层处理
    }
  };

  return (
    <Modal
      title="设置"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
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
        <Typography.Text strong>AI 配置</Typography.Text>
        <Form form={form} layout="vertical">
          <Form.Item label="API 类型" name="apiFormat">
            <Select
              value={apiFormat}
              onChange={(value) => {
                setApiFormat(value);
                applyProviderFields(value);
              }}
              options={[
                { value: 'openai', label: 'OpenAI Compatible' },
                { value: 'anthropic', label: 'Anthropic' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Base URL" name="baseUrl">
            <Input allowClear placeholder="https://api.openai.com/v1" />
          </Form.Item>

          <Form.Item
            label="API Key"
            name="apiKey"
          >
            <Input.Password allowClear placeholder={aiConfigSummary?.[apiFormat]?.hasApiKey ? "已配置，留空表示不改动当前 Key" : "sk-xxxxxx "} />
          </Form.Item>

          <Form.Item label="Model ID">
            <Flex gap={8} align="center">
              <Form.Item name="model" rules={[{ required: true, message: '请输入 Model' }]} style={{ marginBottom: 0, flex: 1 }}>
                <AutoComplete
                  options={modelOptions}
                  filterOption={(inputValue, option) => String(option?.label || '').toLowerCase().includes(inputValue.toLowerCase())}
                  placeholder="gpt-5.3"
                  allowClear
                />
              </Form.Item>
              <Button loading={modelLoading} onClick={handleLoadModels}>
                获取模型列表
              </Button>
            </Flex>
          </Form.Item>

          <Space>
            <Button type="primary" onClick={handleSaveAi} disabled={!aiConfigSummary?.secureStorageAvailable}>保存</Button>
            {!aiConfigSummary?.secureStorageAvailable && (
              <Typography.Text type="danger">
                当前系统安全存储不可用，暂时无法保存 AI 凭证
              </Typography.Text>
            )}
          </Space>
        </Form>
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
