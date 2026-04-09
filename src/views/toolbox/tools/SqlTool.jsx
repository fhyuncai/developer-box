import { useState } from 'react';
import { format } from 'sql-formatter';
import { Button, Flex, Input, Select, Space, Typography } from 'antd';

const { TextArea: TA } = Input;

const DIALECTS = [
  { value: 'sql', label: 'Standard SQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'tsql', label: 'T-SQL (SQL Server)' },
];

export default function SqlTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [dialect, setDialect] = useState('sql');
  const [error, setError] = useState('');

  const handle = () => {
    setError('');
    try {
      setOutput(format(input, { language: dialect, tabWidth: 2, keywordCase: 'upper' }));
    } catch (e) {
      setError(`格式化失败：${e.message}`);
      setOutput('');
    }
  };

  const clear = () => { setInput(''); setOutput(''); setError(''); };

  return (
    <Flex vertical gap={12}>
      <Flex gap={8}>
        <Select value={dialect} onChange={setDialect} options={DIALECTS} style={{ width: 200 }} />
        <Button danger onClick={clear}>清空</Button>
      </Flex>
      <TA rows={8} value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入 SQL 语句" style={{ fontFamily: 'monospace', fontSize: 13 }} allowClear />
      <Space>
        <Button type="primary" onClick={handle}>格式化</Button>
      </Space>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      <TA rows={8} value={output} readOnly placeholder="结果" style={{ fontFamily: 'monospace', fontSize: 13 }} />
    </Flex>
  );
}
