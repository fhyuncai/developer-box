import { useMemo, useState } from 'react';
import { Flex, Input, Statistic, Typography } from 'antd';

const { TextArea } = Input;

function countBytes(str) {
  return new TextEncoder().encode(str).length;
}

export default function WordCountTool() {
  const [text, setText] = useState('');

  const stats = useMemo(() => {
    const chars = text.length;
    const charsNoSpace = text.replace(/\s/g, '').length;
    const lines = text ? text.split('\n').length : 0;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const cnChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const bytes = countBytes(text);
    return { chars, charsNoSpace, words, lines, cnChars, bytes };
  }, [text]);

  return (
    <Flex vertical gap={12}>
      <TextArea
        rows={19}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="输入或粘贴文本"
        allowClear
      />
      <div className="word-count-grid">
        {[
          { title: '字符数', value: stats.chars },
          { title: '字符数（去空格）', value: stats.charsNoSpace },
          { title: '单词数', value: stats.words },
          { title: '行数', value: stats.lines },
          { title: '中文字符', value: stats.cnChars },
          { title: '字节数 (UTF-8)', value: stats.bytes },
        ].map(({ title, value }) => (
          <Statistic key={title} title={title} value={value} />
        ))}
      </div>
    </Flex>
  );
}
