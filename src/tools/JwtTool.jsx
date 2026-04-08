import { useState } from 'react';
import { Button, Flex, Input, Space, Tag, Typography } from 'antd';

const { TextArea } = Input;

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseJwt(token) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('JWT 格式无效，需要 3 个部分（以 . 分隔）');
  const header = JSON.parse(b64urlDecode(parts[0]));
  const payload = JSON.parse(b64urlDecode(parts[1]));
  return { header, payload, signature: parts[2] };
}

export default function JwtTool() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const parse = () => {
    setError('');
    try {
      setResult(parseJwt(input));
    } catch (e) {
      setError(e.message || '解析失败');
      setResult(null);
    }
  };

  const clear = () => { setInput(''); setResult(null); setError(''); };

  const fmt = (obj) => JSON.stringify(obj, null, 2);

  return (
    <Flex vertical gap={12}>
      <TextArea rows={4} value={input} onChange={(e) => setInput(e.target.value)} placeholder="粘贴 JWT Token" allowClear />
      <Space>
        <Button type="primary" onClick={parse}>解析</Button>
        <Button danger onClick={clear}>清空</Button>
      </Space>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      {result && (
        <Flex vertical gap={12}>
          <div>
            <Tag color="blue">Header</Tag>
            <TextArea rows={4} value={fmt(result.header)} readOnly style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12 }} />
          </div>
          <div>
            <Tag color="green">Payload</Tag>
            {result.payload.exp && (
              <Tag color={result.payload.exp * 1000 < Date.now() ? 'red' : 'success'} style={{ marginLeft: 8 }}>
                {result.payload.exp * 1000 < Date.now() ? '已过期' : `有效期至 ${new Date(result.payload.exp * 1000).toLocaleString()}`}
              </Tag>
            )}
            <TextArea rows={8} value={fmt(result.payload)} readOnly style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12 }} />
          </div>
          <div>
            <Tag color="orange">Signature</Tag>
            <Input value={result.signature} readOnly style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12 }} />
          </div>
        </Flex>
      )}
    </Flex>
  );
}
