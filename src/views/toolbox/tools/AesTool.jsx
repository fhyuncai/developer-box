import { useState } from 'react';
import CryptoJS from 'crypto-js';
import { App as AntdApp, Button, Flex, Input, Radio, Space, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const { TextArea } = Input;

export default function AesTool() {
  const { message } = AntdApp.useApp();
  const [input, setInput] = useState('');
  const [key, setKey] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState('encrypt');
  const [error, setError] = useState('');

  const handle = () => {
    setError('');
    if (!key) { setError('请输入密钥'); return; }
    try {
      if (mode === 'encrypt') {
        const encrypted = CryptoJS.AES.encrypt(input, key);
        setOutput(encrypted.toString());
      } else {
        const bytes = CryptoJS.AES.decrypt(input.trim(), key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (!decrypted) { setError('解密失败：密钥错误或密文无效'); return; }
        setOutput(decrypted);
      }
    } catch {
      setError('操作失败：请检查输入与密钥');
      setOutput('');
    }
  };

  const clear = () => { setInput(''); setOutput(''); setError(''); };

  return (
    <Flex vertical gap={12}>
      <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} optionType="button" buttonStyle="solid">
        <Radio.Button value="encrypt">加密</Radio.Button>
        <Radio.Button value="decrypt">解密</Radio.Button>
      </Radio.Group>
      <Input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="密钥（Key）"
        allowClear
      />
      <TextArea rows={5} value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === 'encrypt' ? '输入明文' : '输入 AES 密文'} allowClear />
      <Space>
        <Button type="primary" onClick={handle}>{mode === 'encrypt' ? '加密' : '解密'}</Button>
        <Button danger onClick={clear}>清空</Button>
      </Space>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      <Flex vertical gap={4}>
        <TextArea rows={5} value={output} readOnly placeholder="结果" />
        {output && (
          <Flex justify="flex-end">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => navigator.clipboard.writeText(output).then(() => message.success('已复制'))}
            >
              复制结果
            </Button>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
