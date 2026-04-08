import { useState } from 'react';
import { Button, Flex, Input, Space, Typography } from 'antd';

const { TextArea } = Input;

export default function JsonTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const format = () => {
    setError('');
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setError(`JSON 解析错误：${e.message}`);
      setOutput('');
    }
  };

  const minify = () => {
    setError('');
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
    } catch (e) {
      setError(`JSON 解析错误：${e.message}`);
      setOutput('');
    }
  };

  const swap = () => { setInput(output); setOutput(''); setError(''); };
  const clear = () => { setInput(''); setOutput(''); setError(''); };

  return (
    <Flex vertical gap={12}>
      <TextArea
        rows={8}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="输入 JSON"
        style={{ fontFamily: 'monospace', fontSize: 13 }}
        allowClear
      />
      <Space>
        <Button type="primary" onClick={format}>格式化</Button>
        <Button onClick={minify}>压缩</Button>
        <Button onClick={swap} disabled={!output}>↕ 使用结果</Button>
        <Button danger onClick={clear}>清空</Button>
      </Space>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      <TextArea
        rows={8}
        value={output}
        readOnly
        placeholder="结果"
        style={{ fontFamily: 'monospace', fontSize: 13 }}
      />
    </Flex>
  );
}
