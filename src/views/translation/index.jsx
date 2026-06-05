import { useState } from 'react';
import {
  App as AntdApp,
  Button,
  Drawer,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Tabs,
  Typography,
} from 'antd';
import { CopyOutlined, SettingOutlined, SwapOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';

const { TextArea } = Input;

const BAIDU_LANG_OPTIONS = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英语' },
  { value: 'jp', label: '日语' },
  { value: 'kor', label: '韩语' },
  { value: 'fra', label: '法语' },
  { value: 'spa', label: '西班牙语' },
  { value: 'de', label: '德语' },
  { value: 'ru', label: '俄语' },
  { value: 'th', label: '泰语' },
  { value: 'yue', label: '粤语' },
  { value: 'wyw', label: '文言文' },
];

const VARIABLE_CASE_OPTIONS = [
  { value: 'camelCase', label: 'camelCase' },
  { value: 'PascalCase', label: 'PascalCase' },
  { value: 'snake_case', label: 'snake_case' },
  { value: 'kebab-case', label: 'kebab-case' },
  { value: 'CONSTANT_CASE', label: 'CONSTANT_CASE' },
];

export default function TranslationPage({ aiConfigSummary, onBack, onBackHome }) {
  const { message } = AntdApp.useApp();
  const [activeMode, setActiveMode] = useState('standard');
  const [configOpen, setConfigOpen] = useState(false);
  const [baiduConfigState, setBaiduConfigState] = useState({ appId: '', hasApiKey: false });
  const [standardLoading, setStandardLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [namingLoading, setNamingLoading] = useState(false);
  const [standardInput, setStandardInput] = useState('');
  const [standardOutput, setStandardOutput] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [aiText, setAiText] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiSourceLang, setAiSourceLang] = useState('auto');
  const [aiTargetLang, setAiTargetLang] = useState('en');
  const [namingText, setNamingText] = useState('');
  const [namingCase, setNamingCase] = useState('camelCase');
  const [namingOutput, setNamingOutput] = useState('');
  const defaultProvider = aiConfigSummary?.defaultProvider || 'openai';
  const defaultProviderReady = !!aiConfigSummary?.[defaultProvider]?.hasApiKey;
  const [form] = Form.useForm();

  const copyText = async (value) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    message.success('已复制');
  };

  const handleSwapLang = () => {
    if (sourceLang === 'auto') {
      setSourceLang(targetLang);
      setTargetLang('zh');
      return;
    }
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const handleSwapAiLang = () => {
    if (aiSourceLang === 'auto') {
      setAiSourceLang(aiTargetLang);
      setAiTargetLang('zh');
      return;
    }
    setAiSourceLang(aiTargetLang);
    setAiTargetLang(aiSourceLang);
  };

  const handleStandardTranslate = async () => {
    if (!standardInput.trim()) {
      message.warning('请输入要翻译的文本');
      return;
    }

    setStandardLoading(true);
    try {
      const result = await window.developerBox.translateWithBaidu({
        text: standardInput,
        from: sourceLang,
        to: targetLang,
      });
      setStandardOutput(result?.text || '');
    } catch (error) {
      message.error(error?.message || '翻译失败');
    } finally {
      setStandardLoading(false);
    }
  };

  const handleAiTranslate = async () => {
    if (!aiText.trim()) {
      message.warning('请输入要翻译的文本');
      return;
    }

    setAiLoading(true);
    try {
      const result = await window.developerBox.translateWithAi({
        provider: defaultProvider,
        sourceLanguage: aiSourceLang,
        targetLanguage: aiTargetLang,
        text: aiText,
      });
      setAiOutput(result?.text || '');
    } catch (error) {
      message.error(error?.message || 'AI 翻译失败');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateVariable = async () => {
    if (!namingText.trim()) {
      message.warning('请输入中文语义');
      return;
    }

    setNamingLoading(true);
    try {
      const result = await window.developerBox.generateVariableName({
        provider: defaultProvider,
        text: namingText,
        style: namingCase,
      });
      setNamingOutput(result?.text || '');
    } catch (error) {
      message.error(error?.message || '变量名生成失败');
    } finally {
      setNamingLoading(false);
    }
  };

  const openConfigDrawer = async () => {
    setConfigOpen(true);
    try {
      const config = await window.developerBox.getBaiduTranslateConfig();
      setBaiduConfigState({
        appId: config?.appId || '',
        hasApiKey: !!config?.hasApiKey,
      });
      form.setFieldsValue({
        appId: config?.appId || '',
        apiKey: '',
      });
    } catch (error) {
      message.error(error?.message || '读取百度翻译配置失败');
    }
  };

  const handleSaveBaiduConfig = async () => {
    const values = await form.validateFields();
    try {
      const nextConfig = await window.developerBox.saveBaiduTranslateConfig(values);
      setBaiduConfigState({
        appId: nextConfig?.appId || values.appId,
        hasApiKey: !!nextConfig?.hasApiKey,
      });
      message.success('百度翻译配置已保存');
      setConfigOpen(false);
      form.resetFields(['apiKey']);
    } catch (error) {
      message.error(error?.message || '保存百度翻译配置失败');
    }
  };

  const renderActionButtons = ({ submitLabel, submitLoading, onSubmit, onClear, copyValue, disabled = false }) => (
    <Space wrap className="translation-toolbar__actions">
      <Button type="primary" loading={submitLoading} onClick={onSubmit} disabled={disabled}>{submitLabel}</Button>
      <Button onClick={onClear}>清空</Button>
      <Button icon={<CopyOutlined />} onClick={() => copyText(copyValue)} disabled={!copyValue}>复制结果</Button>
    </Space>
  );

  return (
    <section className="content-area translation-page">
      <PageHeader items={[{ title: '首页', onClick: onBackHome }, { title: '翻译' }]} onBack={onBack} onBackHome={onBackHome}>
        <Button shape="circle" icon={<SettingOutlined />} onClick={openConfigDrawer} aria-label="百度翻译配置" />
      </PageHeader>

      <Tabs
        className="translation-tabs"
        activeKey={activeMode}
        onChange={setActiveMode}
        items={[
          {
            key: 'standard',
            label: '标准翻译',
            children: (
              <Flex vertical gap={12}>
                <Flex className="translation-toolbar" gap={12} wrap="wrap" align="center">
                  <Flex className="translation-toolbar__fields" gap={12} wrap="wrap" align="center">
                    <Select value={sourceLang} onChange={setSourceLang} options={BAIDU_LANG_OPTIONS} style={{ width: 160 }} />
                    <Button shape="circle" icon={<SwapOutlined />} onClick={handleSwapLang} aria-label="交换语言" />
                    <Select value={targetLang} onChange={setTargetLang} options={BAIDU_LANG_OPTIONS.filter((item) => item.value !== 'auto')} style={{ width: 160 }} />
                  </Flex>
                  {renderActionButtons({
                    submitLabel: '翻译',
                    submitLoading: standardLoading,
                    onSubmit: handleStandardTranslate,
                    onClear: () => {
                      setStandardInput('');
                      setStandardOutput('');
                    },
                    copyValue: standardOutput,
                  })}
                </Flex>
                <div className="translation-grid">
                  <TextArea rows={10} value={standardInput} onChange={(e) => setStandardInput(e.target.value)} placeholder="输入要翻译的文本" allowClear />
                  <div className="translation-output-card">
                    <TextArea rows={10} value={standardOutput} readOnly placeholder="翻译结果" />
                  </div>
                </div>
              </Flex>
            ),
          },
          {
            key: 'ai',
            label: 'AI 翻译',
            children: (
              <Flex vertical gap={12}>
                <Flex className="translation-toolbar" gap={12} wrap="wrap" align="center">
                  <Flex className="translation-toolbar__fields" gap={12} wrap="wrap" align="center">
                    <Select value={aiSourceLang} onChange={setAiSourceLang} options={BAIDU_LANG_OPTIONS} style={{ width: 160 }} />
                    <Button shape="circle" icon={<SwapOutlined />} onClick={handleSwapAiLang} aria-label="交换 AI 语言" />
                    <Select value={aiTargetLang} onChange={setAiTargetLang} options={BAIDU_LANG_OPTIONS.filter((item) => item.value !== 'auto')} style={{ width: 160 }} />
                  </Flex>
                  {renderActionButtons({
                    submitLabel: 'AI 翻译',
                    submitLoading: aiLoading,
                    onSubmit: handleAiTranslate,
                    onClear: () => {
                      setAiText('');
                      setAiOutput('');
                    },
                    copyValue: aiOutput,
                    disabled: !defaultProviderReady,
                  })}
                </Flex>
                <div className="translation-grid">
                  <TextArea rows={10} value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="输入要翻译的文本，AI 将结合上下文润色" allowClear />
                  <div className="translation-output-card">
                    <TextArea rows={10} value={aiOutput} readOnly placeholder="AI 翻译结果" />
                  </div>
                </div>
              </Flex>
            ),
          },
          {
            key: 'naming',
            label: '变量命名',
            children: (
              <Flex vertical gap={12}>
                <Flex className="translation-toolbar" gap={12} wrap="wrap" align="center">
                  <Flex className="translation-toolbar__fields" gap={12} wrap="wrap" align="center">
                    <Select value={namingCase} onChange={setNamingCase} options={VARIABLE_CASE_OPTIONS} style={{ width: 180 }} />
                  </Flex>
                  {renderActionButtons({
                    submitLabel: '生成变量名',
                    submitLoading: namingLoading,
                    onSubmit: handleGenerateVariable,
                    onClear: () => {
                      setNamingText('');
                      setNamingOutput('');
                    },
                    copyValue: namingOutput,
                    disabled: !defaultProviderReady,
                  })}
                </Flex>
                <div className="translation-grid">
                  <TextArea rows={8} value={namingText} onChange={(e) => setNamingText(e.target.value)} placeholder="例如：用户订单支付状态" allowClear />
                  <div className="translation-output-card">
                    <TextArea rows={8} value={namingOutput} readOnly placeholder="变量名结果" />
                  </div>
                </div>
              </Flex>
            ),
          },
        ]}
      />

      <Drawer
        title="翻译配置"
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        width={420}
        styles={{
          wrapper: {
            top: 'var(--titlebar-height)',
            height: 'calc(100% - var(--titlebar-height))',
          },
          body: { paddingTop: 8 },
        }}
        extra={<Button type="primary" onClick={handleSaveBaiduConfig}>保存</Button>}
      >
        <Form form={form} layout="vertical">
          <Typography.Paragraph strong style={{ marginTop: 12, marginBottom: 12 }}>
            百度翻译 API
          </Typography.Paragraph>
          <Form.Item label="App ID" name="appId">
            <Input placeholder="20260000000000000" allowClear />
          </Form.Item>
          <Form.Item
            label="API Key"
            name="apiKey"
            rules={[
              {
                validator: async (_, value) => {
                  if (String(value || '').trim() || baiduConfigState.hasApiKey) {
                    return;
                  }
                  throw new Error('请输入百度翻译 API Key');
                },
              },
            ]}
          >
            <Input.Password placeholder={baiduConfigState.hasApiKey ? "已配置，留空表示不改动当前 Key" : "xxxxxx "} allowClear />
          </Form.Item>
          <Typography.Paragraph strong style={{ marginTop: 24, marginBottom: 12 }}>
            AI 翻译 API
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            请在全局设置中配置
          </Typography.Paragraph>
        </Form>
      </Drawer>
    </section>
  );
}
