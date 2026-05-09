import { useMemo, useState } from 'react';
import { Alert, App as AntdApp, Button, Flex, Input, Select } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const RADIX_OPTIONS = [
  { value: 2, label: '二进制 (2)' },
  { value: 8, label: '八进制 (8)' },
  { value: 10, label: '十进制 (10)' },
  { value: 16, label: '十六进制 (16)' },
];

function numToBase64(num) {
  if (num === 0) return btoa('\0');
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = hex.match(/.{2}/g).map((b) => String.fromCharCode(parseInt(b, 16))).join('');
  return btoa(bytes);
}

export default function RadixTool() {
  const { message } = AntdApp.useApp();
  const [input, setInput] = useState('');
  const [fromRadix, setFromRadix] = useState(10);

  const copyText = (text) => {
    navigator.clipboard.writeText(text).then(() => message.success('已复制'));
  };

  const result = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const num = parseInt(trimmed, fromRadix);
    if (isNaN(num) || num < 0) return { error: `"${trimmed}" 不是有效的 ${fromRadix} 进制数` };
    return {
      bin: num.toString(2),
      oct: num.toString(8),
      dec: num.toString(10),
      hex: num.toString(16).toUpperCase(),
      b64: numToBase64(num),
    };
  }, [input, fromRadix]);

  const rows = result && !result.error ? [
    { label: '二进制 (2)',    value: result.bin, prefix: '0b' },
    { label: '八进制 (8)',    value: result.oct, prefix: '0o' },
    { label: '十进制 (10)',   value: result.dec, prefix: '' },
    { label: '十六进制 (16)', value: result.hex, prefix: '0x' },
    { label: 'Base64',        value: result.b64, prefix: '' },
  ] : [];

  return (
    <Flex vertical gap={12}>
      <Flex gap={8}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入数字"
          style={{ flex: 1 }}
          allowClear
          status={result?.error ? 'error' : ''}
        />
        <Select value={fromRadix} onChange={setFromRadix} options={RADIX_OPTIONS} style={{ width: 160 }} />
      </Flex>
      {result?.error && <Alert message={result.error} type="error" showIcon />}
      {rows.length > 0 && (
        <Flex vertical gap={8}>
          {rows.map(({ label, value, prefix }) => (
            <Flex key={label} align="center" gap={8}>
              <span style={{ width: 120, flexShrink: 0, color: 'var(--ant-color-text-secondary)' }}>{label}</span>
              <Input value={`${prefix}${value}`} readOnly style={{ fontFamily: 'monospace', flex: 1 }} />
              <Button icon={<CopyOutlined />} size="small" onClick={() => copyText(`${prefix}${value}`)} />
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
