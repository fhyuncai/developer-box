import { useState } from 'react';
import beautify from 'js-beautify';
import { Button, Flex, Input, Space, Typography } from 'antd';

const { TextArea } = Input;

function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function CssTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const format = () => {
    setError('');
    try {
      setOutput(beautify.css(input, { indent_size: 2, newline_between_rules: true }));
    } catch (e) {
      setError(`格式化失败：${e.message}`);
      setOutput('');
    }
  };

  const minify = () => {
    setError('');
    try {
      setOutput(minifyCSS(input));
    } catch (e) {
      setError(`压缩失败：${e.message}`);
      setOutput('');
    }
  };

  const clear = () => { setInput(''); setOutput(''); setError(''); };

  return (
    <Flex vertical gap={12}>
      <TextArea rows={8} value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入 CSS / SCSS 代码" style={{ fontFamily: 'monospace', fontSize: 13 }} allowClear />
      <Space>
        <Button type="primary" onClick={format}>格式化</Button>
        <Button onClick={minify}>压缩</Button>
        <Button danger onClick={clear}>清空</Button>
      </Space>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      <TextArea rows={8} value={output} readOnly placeholder="结果" style={{ fontFamily: 'monospace', fontSize: 13 }} />
    </Flex>
  );
}
