import { useState } from 'react';
import { diffLines } from 'diff';
import { Button, Flex, Input, Space, Typography } from 'antd';

const { TextArea } = Input;

export default function DiffTool() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [diffs, setDiffs] = useState(null);

  const compare = () => {
    setDiffs(diffLines(left, right));
  };

  const clear = () => { setLeft(''); setRight(''); setDiffs(null); };

  return (
    <Flex vertical gap={12}>
      <div className="diff-inputs">
        <TextArea rows={7} value={left} onChange={(e) => setLeft(e.target.value)} placeholder="原始文本" allowClear />
        <TextArea rows={7} value={right} onChange={(e) => setRight(e.target.value)} placeholder="对比文本" allowClear />
      </div>
      <Space>
        <Button type="primary" onClick={compare}>对比</Button>
        <Button danger onClick={clear}>清空</Button>
      </Space>
      {diffs && (
        <Flex gap={12}>
          <Typography.Text type="success">
            +{diffs.filter((d) => d.added).reduce((s, d) => s + d.count, 0)} 行新增
          </Typography.Text>
          <Typography.Text type="danger">
            -{diffs.filter((d) => d.removed).reduce((s, d) => s + d.count, 0)} 行删除
          </Typography.Text>
        </Flex>
      )}
      {diffs && (
        <div className="diff-result">
          {diffs.map((part, i) => (
            <div
              key={i}
              className={`diff-part${part.added ? ' diff-added' : part.removed ? ' diff-removed' : ' diff-equal'}`}
            >
              <span className="diff-sign">{part.added ? '+' : part.removed ? '-' : ' '}</span>
              <span>{part.value}</span>
            </div>
          ))}
        </div>
      )}
    </Flex>
  );
}
