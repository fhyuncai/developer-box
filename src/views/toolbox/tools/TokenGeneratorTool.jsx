import { useEffect, useMemo, useState } from 'react';
import { Button, Flex, Input, Slider, Space, Switch, Tag, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/|~';

function randomFromCharset(length, charset) {
  if (!charset || charset.length === 0 || length <= 0) return '';
  const bytes = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 4294967296);
  }
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

export default function TokenGeneratorTool() {
  const [length, setLength] = useState(32);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(false);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);

  const charset = useMemo(() => {
    let chars = '';
    if (useUppercase) chars += UPPERCASE;
    if (useLowercase) chars += LOWERCASE;
    if (useDigits) chars += DIGITS;
    if (useSymbols) chars += SYMBOLS;
    return chars;
  }, [useUppercase, useLowercase, useDigits, useSymbols]);

  const regenerate = () => {
    setToken(randomFromCharset(length, charset));
    setCopied(false);
  };

  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, charset]);

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">长度：{length}</Typography.Text>
      <Slider min={2} max={512} value={length} onChange={setLength} />

      <Space wrap>
        <Tag bordered={false}>字符集</Tag>
        <Space>
          <Typography.Text>大写字母</Typography.Text>
          <Switch size="small" checked={useUppercase} onChange={setUseUppercase} />
        </Space>
        <Space>
          <Typography.Text>小写字母</Typography.Text>
          <Switch size="small" checked={useLowercase} onChange={setUseLowercase} />
        </Space>
        <Space>
          <Typography.Text>数字</Typography.Text>
          <Switch size="small" checked={useDigits} onChange={setUseDigits} />
        </Space>
        <Space>
          <Typography.Text>符号</Typography.Text>
          <Switch size="small" checked={useSymbols} onChange={setUseSymbols} />
        </Space>
      </Space>

      {charset.length === 0 ? (
        <Typography.Text type="danger">请至少启用一种字符类型。</Typography.Text>
      ) : (
        <Input.TextArea
          value={token}
          readOnly
          rows={5}
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        />
      )}

      <Space>
        <Button type="primary" icon={<CopyOutlined />} onClick={copy} disabled={!token}>复制</Button>
        {copied && <Typography.Text type="success">已复制</Typography.Text>}
      </Space>
    </Flex>
  );
}
