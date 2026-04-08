import { useMemo, useState } from 'react';
import { Checkbox, Flex, Input, Space, Tag, Typography } from 'antd';

const { TextArea } = Input;

export default function RegexTool() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState({ g: true, i: false, m: false });
  const [text, setText] = useState('');

  const flagStr = Object.entries(flags).filter(([, v]) => v).map(([k]) => k).join('');

  const { matches, error, highlighted } = useMemo(() => {
    if (!pattern || !text) return { matches: [], error: '', highlighted: text };
    let regex;
    try {
      regex = new RegExp(pattern, flagStr.includes('g') ? flagStr : flagStr + 'g');
    } catch (e) {
      return { matches: [], error: e.message, highlighted: text };
    }
    const found = [];
    let m;
    const re2 = new RegExp(pattern, flagStr.includes('g') ? flagStr : flagStr + 'g');
    while ((m = re2.exec(text)) !== null) {
      found.push({ value: m[0], index: m.index, groups: m.groups });
      if (!re2.global) break;
    }
    const parts = [];
    let last = 0;
    const re3 = new RegExp(pattern, flagStr.includes('g') ? flagStr : flagStr + 'g');
    let m2;
    while ((m2 = re3.exec(text)) !== null) {
      if (m2.index > last) parts.push(text.slice(last, m2.index));
      parts.push(<mark key={m2.index} className="regex-match">{m2[0]}</mark>);
      last = m2.index + m2[0].length;
      if (!re3.global) break;
    }
    if (last < text.length) parts.push(text.slice(last));
    return { matches: found, error: '', highlighted: parts };
  }, [pattern, text, flagStr]);

  return (
    <Flex vertical gap={12}>
      <Flex gap={8} align="center">
        <Input
          prefix="/"
          suffix={`/${flagStr}`}
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="正则表达式"
          style={{ fontFamily: 'monospace', flex: 1 }}
          status={error ? 'error' : undefined}
        />
        <Space>
          {['g', 'i', 'm'].map((f) => (
            <Checkbox key={f} checked={flags[f]} onChange={(e) => setFlags((p) => ({ ...p, [f]: e.target.checked }))}>
              {f}
            </Checkbox>
          ))}
        </Space>
      </Flex>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      <TextArea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="测试文本" allowClear />
      {text && pattern && !error && (
        <>
          <div className="regex-preview">{highlighted}</div>
          <Typography.Text type="secondary">
            共匹配 <strong>{matches.length}</strong> 处
          </Typography.Text>
          {matches.length > 0 && (
            <Flex gap={6} wrap>
              {matches.map((m, i) => (
                <Tag key={i} color="blue">[{m.index}] {m.value}</Tag>
              ))}
            </Flex>
          )}
        </>
      )}
    </Flex>
  );
}
