import { useMemo, useState } from 'react';
import CryptoJS from 'crypto-js';
import { Button, Flex, Input, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const ALGOS = [
  { key: 'MD5',       label: 'MD5',        fn: (t) => CryptoJS.MD5(t).toString() },
  { key: 'SHA1',      label: 'SHA-1',      fn: (t) => CryptoJS.SHA1(t).toString() },
  { key: 'SHA224',    label: 'SHA-224',    fn: (t) => CryptoJS.SHA224(t).toString() },
  { key: 'SHA256',    label: 'SHA-256',    fn: (t) => CryptoJS.SHA256(t).toString() },
  { key: 'SHA384',    label: 'SHA-384',    fn: (t) => CryptoJS.SHA384(t).toString() },
  { key: 'SHA512',    label: 'SHA-512',    fn: (t) => CryptoJS.SHA512(t).toString() },
  { key: 'SHA3',      label: 'SHA3-256',   fn: (t) => CryptoJS.SHA3(t, { outputLength: 256 }).toString() },
  { key: 'RIPEMD160', label: 'RIPEMD-160', fn: (t) => CryptoJS.RIPEMD160(t).toString() },
];

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => message.success('已复制'));
}

export default function HashTool() {
  const [input, setInput] = useState('');

  const hashes = useMemo(() => {
    if (!input) return [];
    return ALGOS.map(({ key, label, fn }) => ({ key, label, value: fn(input) }));
  }, [input]);

  return (
    <Flex vertical gap={12}>
      <TextArea
        rows={4}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入要计算哈希的文本"
        allowClear
      />
      {hashes.length > 0 && (
        <Flex vertical gap={8}>
          {hashes.map(({ key, label, value }) => (
            <Flex key={key} align="center" gap={8}>
              <span style={{ width: 90, flexShrink: 0, color: 'var(--ant-color-text-secondary)' }}>{label}</span>
              <Input value={value} readOnly style={{ fontFamily: 'monospace', flex: 1 }} />
              <Button icon={<CopyOutlined />} size="small" onClick={() => copyText(value)} />
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
