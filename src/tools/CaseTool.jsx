import { useState } from 'react';
import { Button, Flex, Input, Space, Tag, Typography } from 'antd';

const { TextArea } = Input;

function toTitleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}
function toCamelCase(str) {
  return str.replace(/[\s_-]+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, (c) => c.toLowerCase());
}
function toPascalCase(str) {
  return str.replace(/(^|[\s_-]+)(.)/g, (_, __, c) => c.toUpperCase());
}
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/[\s-]+/g, '_').replace(/^_/, '').toLowerCase();
}
function toKebabCase(str) {
  return str.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/[\s_]+/g, '-').replace(/^-/, '').toLowerCase();
}
function toConstantCase(str) {
  return toSnakeCase(str).toUpperCase();
}

const CASES = [
  { key: 'upper', label: 'UPPER CASE', fn: (s) => s.toUpperCase() },
  { key: 'lower', label: 'lower case', fn: (s) => s.toLowerCase() },
  { key: 'title', label: 'Title Case', fn: toTitleCase },
  { key: 'camel', label: 'camelCase', fn: toCamelCase },
  { key: 'pascal', label: 'PascalCase', fn: toPascalCase },
  { key: 'snake', label: 'snake_case', fn: toSnakeCase },
  { key: 'kebab', label: 'kebab-case', fn: toKebabCase },
  { key: 'constant', label: 'CONSTANT_CASE', fn: toConstantCase },
];

export default function CaseTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [activeCase, setActiveCase] = useState('');

  const apply = (item) => {
    setActiveCase(item.key);
    setOutput(item.fn(input));
  };

  const clear = () => { setInput(''); setOutput(''); setActiveCase(''); };

  return (
    <Flex vertical gap={12}>
      <TextArea rows={5} value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入文本" allowClear />
      <Flex gap={6} wrap>
        {CASES.map((item) => (
          <Tag
            key={item.key}
            color={activeCase === item.key ? 'blue' : 'default'}
            style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 13 }}
            onClick={() => apply(item)}
          >
            {item.label}
          </Tag>
        ))}
      </Flex>
      <Space>
        <Button danger onClick={clear}>清空</Button>
      </Space>
      <TextArea rows={5} value={output} readOnly placeholder="结果" />
    </Flex>
  );
}
