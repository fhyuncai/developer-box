import { useState } from 'react';
import { Button, Flex, Input, Space, Typography } from 'antd';

const { TextArea } = Input;

function encodeBase64(str) {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  } catch {
    return null;
  }
}

function decodeBase64(str) {
  try {
    const binary = atob(str.trim());
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export default function Base64Tool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const handle = (encode) => {
    setError('');
    const result = encode ? encodeBase64(input) : decodeBase64(input);
    if (result === null) {
      setError(encode ? '编码失败' : '解码失败：输入内容不是有效的 Base64');
      setOutput('');
    } else {
      setOutput(result);
    }
  };

  const clear = () => { setInput(''); setOutput(''); setError(''); };

  return (
    <Flex vertical gap={12}>
      <TextArea rows={6} value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入文本" allowClear />
      <Space>
        <Button type="primary" onClick={() => handle(true)}>编码</Button>
        <Button onClick={() => handle(false)}>解码</Button>
        <Button danger onClick={clear}>清空</Button>
      </Space>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      <TextArea rows={6} value={output} readOnly placeholder="结果" />
    </Flex>
  );
}
