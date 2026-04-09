import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { Button, Flex } from 'antd';

marked.setOptions({ breaks: true });

const INITIAL = `# Markdown 编辑器

**粗体** / *斜体* / ~~删除线~~

- 列表项 1
- 列表项 2

\`\`\`js
console.log('Hello World');
\`\`\`

> 引用文本
`;

export default function MarkdownTool() {
  const [text, setText] = useState(INITIAL);
  const [preview, setPreview] = useState(true);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    window.developerBox.loadMarkdown().then((content) => {
      if (content !== null) setText(content);
    });
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleChange = (value) => {
    setText(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.developerBox.saveMarkdown(value);
    }, 800);
  };

  const html = marked.parse(text);

  return (
    <Flex vertical gap={8} style={{ height: '100%' }}>
      <Flex justify="flex-end">
        <Button size="small" onClick={() => setPreview((v) => !v)}>
          {preview ? '仅编辑' : '预览'}
        </Button>
      </Flex>
      <div className="markdown-pane-wrap">
        <textarea
          className="markdown-editor"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
        />
        {preview && (
          <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </Flex>
  );
}
