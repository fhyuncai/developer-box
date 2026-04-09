import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Flex, Input, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import BreadcrumbNav from '../../components/BreadcrumbNav';

export default function ToolboxPage({ tools, onBack, onBackHome, onOpenTool }) {
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const isMac = window.developerBox.getPlatform() === 'darwin';

  // Cmd/Ctrl+F focuses search box
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const groups = useMemo(() => {
    const map = new Map();
    for (const tool of tools) {
      const g = tool.group || '其他';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(tool);
    }
    return [...map.entries()];
  }, [tools]);

  const trimmed = query.trim().toLowerCase();

  // When searching: flat filtered list; otherwise: grouped list
  const filteredFlat = useMemo(() => {
    if (!trimmed) return null;
    return tools.filter(
      (t) =>
        t.title.toLowerCase().includes(trimmed) ||
        t.description.toLowerCase().includes(trimmed) ||
        (t.group || '').toLowerCase().includes(trimmed)
    );
  }, [tools, trimmed]);

  const renderToolCard = (tool) => (
    <Card key={tool.key} hoverable className="tool-entry" onClick={() => onOpenTool(tool.key)}>
      <Flex justify="space-between" align="center">
        <Typography.Text strong>{tool.title}</Typography.Text>
        <RightOutlined />
      </Flex>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
        {tool.description}
      </Typography.Paragraph>
    </Card>
  );

  return (
    <section className="content-area toolbox-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav items={[{ title: '首页', onClick: onBackHome }, { title: '工具箱' }]} />
        <Flex gap={8} align="center">
          <Input
            ref={searchRef}
            className="toolbox-search"
            prefix={<SearchOutlined style={{ opacity: 0.4 }} />}
            placeholder={`搜索工具… (${isMac ? '⌘F' : 'Ctrl+F'})`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            allowClear
            styles={{ root: { borderRadius: 100 } }}
          />
          <Tooltip title="返回上一页">
            <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回上一页" />
          </Tooltip>
          <Tooltip title="返回首页">
            <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
          </Tooltip>
        </Flex>
      </Flex>

      {filteredFlat ? (
        filteredFlat.length === 0 ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 24, textAlign: 'center' }}>
            没有匹配的工具
          </Typography.Text>
        ) : (
          <div className="tool-grid">
            {filteredFlat.map(renderToolCard)}
          </div>
        )
      ) : (
        groups.map(([groupName, groupTools]) => (
          <div key={groupName} className="tool-group">
            <Typography.Text className="tool-group-label" type="secondary">{groupName}</Typography.Text>
            <div className="tool-grid">
              {groupTools.map(renderToolCard)}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

