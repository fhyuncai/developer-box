import { useMemo, useRef, useState } from 'react';
import { Button, Flex, Input, Modal, Space, Tag, Tooltip, Tree, Typography } from 'antd';
import { ColumnHeightOutlined, VerticalAlignMiddleOutlined, UpOutlined, DownOutlined, ApartmentOutlined } from '@ant-design/icons';

const { TextArea } = Input;

// Chrome DevTools 风格配色
const TYPE_VALUE_COLOR = {
  string: '#be8b77',
  number: '#977dfb',
  boolean: '#977dfb',
  null: '#808080',
  array: '#888888',
  object: '#888888',
};

const formatPath = (key) => {
  if (!key) return '';
  if (key === '$') return '$';
  return key.startsWith('$.') ? key.slice(2) : key;
};

const isJsonString = (str) => {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

// ---- Nested JSON tree rendered inside modal ----
function NestedJsonTree({ value }) {
  const buildNode = (val, path, label) => {
    const type = val === null ? 'null' : Array.isArray(val) ? 'array' : typeof val;
    const node = { key: path, meta: { label, value: val, type }, title: label, children: [] };
    if (type === 'array') {
      node.children = val.map((item, i) => buildNode(item, `${path}[${i}]`, `[${i}]`));
    } else if (type === 'object') {
      node.children = Object.entries(val).map(([k, v]) => buildNode(v, `${path}.${k}`, k));
    } else {
      node.isLeaf = true;
    }
    return node;
  };

  const brief = (val) => {
    if (val === null) return 'null';
    if (Array.isArray(val)) return `[${val.length}]`;
    if (typeof val === 'object') return `{${Object.keys(val).length}}`;
    if (typeof val === 'string') return `"${val}"`;
    return String(val);
  };

  const treeData = useMemo(() => [buildNode(value, '$', '$')], [value]);

  const allKeys = useMemo(() => {
    const keys = [];
    const walk = (nodes) => nodes.forEach((n) => { keys.push(n.key); if (n.children?.length) walk(n.children); });
    walk(treeData);
    return keys;
  }, [treeData]);

  const [expandedKeys, setExpandedKeys] = useState(() => allKeys);

  const handleSelect = (keys, { node }) => {
    const type = node.meta?.type;
    if (type === 'object' || type === 'array') {
      setExpandedKeys((prev) =>
        prev.includes(node.key) ? prev.filter((k) => k !== node.key) : [...prev, node.key]
      );
    }
  };

  return (
    <Tree
      treeData={treeData}
      expandedKeys={expandedKeys}
      onExpand={setExpandedKeys}
      onSelect={handleSelect}
      showLine
      className="json-tree"
      titleRender={(node) => {
        const type = node.meta?.type || 'unknown';
        const isExpandable = type === 'object' || type === 'array';
        const valBrief = brief(node.meta?.value);
        const jsonParsable = type === 'string' && isJsonString(node.meta?.value);
        return (
          <NestedNodeTitle
            node={node}
            type={type}
            valBrief={valBrief}
            isExpandable={isExpandable}
            jsonParsable={jsonParsable}
          />
        );
      }}
    />
  );
}

function NestedNodeTitle({ node, type, valBrief, jsonParsable }) {
  const [subVisible, setSubVisible] = useState(false);
  const subParsed = useMemo(() => {
    if (!jsonParsable) return null;
    try { return JSON.parse(node.meta.value); } catch { return null; }
  }, [jsonParsable, node.meta?.value]);

  const path = formatPath(node.key);
  const savedScrollRef = useRef(0);

  const handleOpen = (e) => {
    e.stopPropagation();
    savedScrollRef.current = document.querySelector('.page-wrap')?.scrollTop ?? 0;
    setSubVisible(true);
  };

  return (
    <span className="json-tree-node" title={path}>
      <span className="json-tree-key">{node.meta?.label}</span>
      <Tag className="json-tree-type">{type}</Tag>
      {jsonParsable && (
        <Tooltip title={`解析 JSON`}>
          <Button
            size="small"
            type="link"
            icon={<ApartmentOutlined />}
            className="json-tree-parse-btn"
            onClick={handleOpen}
          />
        </Tooltip>
      )}
      <span className="json-tree-value" style={{ color: TYPE_VALUE_COLOR[type] }}>{valBrief}</span>
      {subParsed !== null && (
        <Modal
          title={`"${path}" JSON 解析`}
          open={subVisible}
          onCancel={() => setSubVisible(false)}
          footer={null}
          width="90%"
          styles={{ body: { height: 'calc(90vh - 140px)', overflowY: 'auto', overflowX: 'hidden' } }}
          afterClose={() => {
            const el = document.querySelector('.page-wrap');
            if (el) el.scrollTop = savedScrollRef.current;
          }}
          destroyOnHidden
        >
          <NestedJsonTree value={subParsed} />
        </Modal>
      )}
    </span>
  );
}

export default function JsonTool() {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [showRawInput, setShowRawInput] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [modalState, setModalState] = useState({ visible: false, value: null, title: '' });

  const treeRef = useRef(null);

  const openModal = (value, title) => {
    setModalState({ visible: true, value, title });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, visible: false }));
  };

  const collectKeys = (nodes) => {
    const keys = [];
    const walk = (list) => {
      for (const node of list) {
        keys.push(node.key);
        if (node.children?.length) walk(node.children);
      }
    };
    walk(nodes);
    return keys;
  };

  const getType = (value) => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const stringifyBrief = (value) => {
    const type = getType(value);
    if (type === 'string') return `"${value}"`;
    if (type === 'number' || type === 'boolean' || type === 'null') return String(value);
    if (type === 'array') return `[${value.length}]`;
    if (type === 'object') return `{${Object.keys(value).length}}`;
    return String(value);
  };

  const buildTreeNode = (value, path, label) => {
    const type = getType(value);
    const node = {
      key: path,
      meta: { label, value, type },
      title: label,
      children: [],
    };

    if (type === 'array') {
      node.children = value.map((item, index) => buildTreeNode(item, `${path}[${index}]`, `[${index}]`));
      return node;
    }

    if (type === 'object') {
      node.children = Object.entries(value).map(([k, v]) => buildTreeNode(v, `${path}.${k}`, k));
      return node;
    }

    node.isLeaf = true;
    return node;
  };

  const treeData = useMemo(() => {
    if (parsed === null) return [];
    return [buildTreeNode(parsed, '$', '$')];
  }, [parsed]);

  const allKeys = useMemo(() => {
    const keys = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        keys.push(node.key);
        if (node.children?.length) walk(node.children);
      }
    };
    walk(treeData);
    return keys;
  }, [treeData]);

  const normalizedKeyword = searchText.trim().toLowerCase();

  const nodeMatched = (node, keyword) => {
    if (!keyword) return false;
    const labelText = String(node.meta?.label || '').toLowerCase();
    const typeText = String(node.meta?.type || '').toLowerCase();
    const valueText = stringifyBrief(node.meta?.value).toLowerCase();
    return labelText.includes(keyword) || typeText.includes(keyword) || valueText.includes(keyword);
  };

  const matchKeys = useMemo(() => {
    if (!normalizedKeyword) return [];
    const keys = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        if (nodeMatched(node, normalizedKeyword)) {
          keys.push(node.key);
        }
        if (node.children?.length) walk(node.children);
      }
    };
    walk(treeData);
    return keys;
  }, [treeData, normalizedKeyword]);

  const getAncestorKeys = (key) => {
    const ancestors = [];
    let cursor = key;
    while (cursor.includes('.') || cursor.includes('[')) {
      if (cursor.endsWith(']')) {
        cursor = cursor.replace(/\[[^\]]+\]$/, '');
      } else {
        cursor = cursor.replace(/\.[^.]+$/, '');
      }
      if (cursor) ancestors.push(cursor);
    }
    return ancestors;
  };

  const locateMatchByIndex = (index) => {
    if (index < 0 || index >= matchKeys.length) return;
    const hitKey = matchKeys[index];
    const ancestors = getAncestorKeys(hitKey);
    setExpandedKeys((prev) => Array.from(new Set([...prev, ...ancestors, hitKey])));
    setSelectedKey(hitKey);
    setActiveMatchIndex(index);
    setTimeout(() => {
      if (treeRef.current?.scrollTo) {
        treeRef.current.scrollTo({ key: hitKey, align: 'top' });
      }
    }, 0);
  };

  const highlightText = (rawText, keyword) => {
    const text = String(rawText ?? '');
    if (!keyword) return text;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(keyword);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="json-tree-mark">{text.slice(idx, idx + keyword.length)}</mark>
        {text.slice(idx + keyword.length)}
      </>
    );
  };

  const parseJson = () => {
    setError('');
    try {
      const nextParsed = JSON.parse(input);
      const nextTree = [buildTreeNode(nextParsed, '$', '$')];
      setParsed(nextParsed);
      setExpandedKeys(collectKeys(nextTree));
      setSelectedKey('$');
      setShowRawInput(false);
      setActiveMatchIndex(-1);
    } catch (e) {
      setError(`JSON 解析错误：${e.message}`);
      setParsed(null);
      setExpandedKeys([]);
      setSelectedKey(null);
      setActiveMatchIndex(-1);
    }
  };

  const format = () => {
    setError('');
    try {
      const nextParsed = JSON.parse(input);
      setInput(JSON.stringify(nextParsed, null, 2));
      setParsed(null);
      setExpandedKeys([]);
      setSelectedKey(null);
      setActiveMatchIndex(-1);
      setShowRawInput(true);
    } catch (e) {
      setError(`JSON 解析错误：${e.message}`);
      setParsed(null);
      setExpandedKeys([]);
      setSelectedKey(null);
      setActiveMatchIndex(-1);
    }
  };

  const minify = () => {
    setError('');
    try {
      const nextParsed = JSON.parse(input);
      setInput(JSON.stringify(nextParsed));
      setParsed(null);
      setExpandedKeys([]);
      setSelectedKey(null);
      setActiveMatchIndex(-1);
      setShowRawInput(true);
    } catch (e) {
      setError(`JSON 解析错误：${e.message}`);
      setParsed(null);
      setExpandedKeys([]);
      setSelectedKey(null);
      setActiveMatchIndex(-1);
    }
  };

  const clear = () => {
    setInput('');
    setParsed(null);
    setError('');
    setShowRawInput(true);
    setExpandedKeys([]);
    setSelectedKey(null);
    setSearchText('');
    setActiveMatchIndex(-1);
  };

  const expandAll = () => setExpandedKeys(allKeys);
  const collapseAll = () => setExpandedKeys([]);

  const searchAndLocate = () => {
    if (!normalizedKeyword || matchKeys.length === 0) return;
    locateMatchByIndex(0);
  };

  const gotoPrevMatch = () => {
    if (matchKeys.length === 0) return;
    const current = activeMatchIndex < 0 ? 0 : activeMatchIndex;
    const prevIndex = (current - 1 + matchKeys.length) % matchKeys.length;
    locateMatchByIndex(prevIndex);
  };

  const gotoNextMatch = () => {
    if (matchKeys.length === 0) return;
    const current = activeMatchIndex < 0 ? -1 : activeMatchIndex;
    const nextIndex = (current + 1) % matchKeys.length;
    locateMatchByIndex(nextIndex);
  };

  return (
    <Flex vertical gap={12} className="json-tool">
      <Space wrap>
        {showRawInput && <Button type="primary" onClick={parseJson}>解析</Button>}
        {showRawInput && <Button onClick={format}>格式化</Button>}
        {showRawInput && <Button onClick={minify}>压缩</Button>}
        {parsed !== null && !showRawInput && (
          <Button onClick={() => setShowRawInput(true)}>显示原始数据</Button>
        )}
        <Button danger onClick={clear}>清空</Button>
      </Space>

      {showRawInput && (
        <TextArea
          rows={20}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入 JSON"
          style={{ fontFamily: 'monospace', fontSize: 13 }}
          allowClear
        />
      )}

      {error && <Typography.Text type="danger">{error}</Typography.Text>}

      {parsed !== null && (
        <div className="json-preview-panel">
          <Flex justify="space-between" align="center" wrap="wrap" gap={8} style={{ marginBottom: 10 }}>
            <Space wrap>
              <Tooltip title="全部展开">
                <Button
                  shape="circle"
                  icon={<ColumnHeightOutlined />}
                  onClick={expandAll}
                  aria-label="全部展开"
                />
              </Tooltip>
              <Tooltip title="全部收起">
                <Button
                  shape="circle"
                  icon={<VerticalAlignMiddleOutlined />}
                  onClick={collapseAll}
                  aria-label="全部收起"
                />
              </Tooltip>
            </Space>
            <Space wrap>
              {searchText.length > 0 &&
                <Typography.Text className="json-search-meta">
                  匹配 {matchKeys.length} 条{matchKeys.length > 0 ? `（${activeMatchIndex >= 0 ? activeMatchIndex + 1 : 1}/${matchKeys.length}）` : ''}
                </Typography.Text>
              }
              <Input.Search
                placeholder="搜索 key / 值 / 类型"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setActiveMatchIndex(-1);
                }}
                onSearch={searchAndLocate}
                allowClear
                style={{ width: 280 }}
              />
              <Tooltip title="上一条">
                <Button
                  shape="circle"
                  icon={<UpOutlined />}
                  onClick={gotoPrevMatch}
                  disabled={matchKeys.length === 0}
                  aria-label="上一条"
                />
              </Tooltip>
              <Tooltip title="下一条">
                <Button
                  shape="circle"
                  icon={<DownOutlined />}
                  onClick={gotoNextMatch}
                  disabled={matchKeys.length === 0}
                  aria-label="下一条"
                />
              </Tooltip>
            </Space>
          </Flex>

          <div className="json-preview-body">
            <Tree
              ref={treeRef}
              treeData={treeData}
              expandedKeys={expandedKeys}
              onExpand={setExpandedKeys}
              onSelect={(_, { node }) => {
                const type = node.meta?.type;
                if (type === 'object' || type === 'array') {
                  setExpandedKeys((prev) =>
                    prev.includes(node.key) ? prev.filter((k) => k !== node.key) : [...prev, node.key]
                  );
                }
              }}
              virtual={false}
              showLine
              className="json-tree"
              titleRender={(node) => {
                const valueType = node.meta?.type || 'unknown';
                const valueBrief = stringifyBrief(node.meta?.value);
                const isActiveHit = selectedKey === node.key && matchKeys.includes(node.key);
                const isJsonStr = valueType === 'string' && isJsonString(node.meta?.value);
                const path = formatPath(node.key);
                return (
                  <span
                    className={`json-tree-node ${isActiveHit ? 'json-tree-node--active-hit' : ''}`}
                    title={path}
                  >
                    <span className="json-tree-key">{highlightText(node.meta?.label, normalizedKeyword)}</span>
                    <Tag className="json-tree-type">{valueType}</Tag>
                    {isJsonStr && (
                      <Tooltip title={`解析 JSON`}>
                        <Button
                          size="small"
                          type="link"
                          icon={<ApartmentOutlined />}
                          className="json-tree-parse-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              const subVal = JSON.parse(node.meta.value);
                              openModal(subVal, `"${path}" JSON 解析`);
                            } catch {}
                          }}
                        />
                      </Tooltip>
                    )}
                    <span className="json-tree-value" style={{ color: TYPE_VALUE_COLOR[valueType] }}>
                      {highlightText(valueBrief, normalizedKeyword)}
                    </span>
                  </span>
                );
              }}
            />
          </div>
        </div>
      )}

      <Modal
        title={modalState.title}
        open={modalState.visible}
        onCancel={closeModal}
        footer={null}
        width="90%"
        styles={{ body: { height: 'calc(90vh - 140px)', overflowY: 'auto', overflowX: 'hidden' } }}
        focusTriggerAfterClose={false}
        destroyOnHidden
      >
        {modalState.value !== null && <NestedJsonTree value={modalState.value} />}
      </Modal>
    </Flex>
  );
}
