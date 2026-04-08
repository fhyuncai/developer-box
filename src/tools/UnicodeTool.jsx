import { useState } from 'react';
import { Button, Flex, Input, Space, Typography } from 'antd';

const { TextArea } = Input;

function toUnicode(str) {
  return [...str].map((c) => {
    const code = c.codePointAt(0);
    return code > 0xffff
      ? `\\u{${code.toString(16).toUpperCase()}}`
      : `\\u${code.toString(16).toUpperCase().padStart(4, '0')}`;
  }).join('');
}

function fromUnicode(str) {
  return str
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export default function UnicodeTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const handle = (encode) => {
    setError('');
    try {
      setOutput(encode ? toUnicode(input) : fromUnicode(input));
    } catch {
      setError('转换失败');
      setOutput('');
    }
  };

  const clear = () => { setInput(''); setOutput(''); setError(''); };

  return (
    <Flex vertical gap={12}>
      <TextArea rows={5} value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入文本或 Unicode 转义序列（如 \u4E2D\u6587）" allowClear />
      <Space>
        <Button type="primary" onClick={() => handle(true)}>文本 → Unicode</Button>
        <Button onClick={() => handle(false)}>Unicode → 文本</Button>
        <Button danger onClick={clear}>清空</Button>
      </Space>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      <TextArea rows={5} value={output} readOnly placeholder="结果" />
    </Flex>
  );
}
