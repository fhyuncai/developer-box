import { useState } from 'react';
import { Button, Flex, Input, Space, Typography } from 'antd';

const { TextArea } = Input;

export default function UrlTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const handle = (encode) => {
    setError('');
    try {
      setOutput(encode ? encodeURIComponent(input) : decodeURIComponent(input));
    } catch {
      setError(encode ? '编码失败' : '解码失败：输入内容不是有效的 URL 编码');
      setOutput('');
    }
  };

  const clear = () => { setInput(''); setOutput(''); setError(''); };

  return (
    <Flex vertical gap={12}>
      <TextArea rows={6} value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入文本或 URL" allowClear />
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
