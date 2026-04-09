import { useState } from 'react';
import { Button, Flex, Input, InputNumber, Space, Typography } from 'antd';

const { TextArea } = Input;

export default function UuidTool() {
  const [count, setCount] = useState(5);
  const [uuids, setUuids] = useState('');

  const generate = () => {
    const list = Array.from({ length: Math.min(count, 100) }, () => crypto.randomUUID());
    setUuids(list.join('\n'));
  };

  const clear = () => setUuids('');

  return (
    <Flex vertical gap={12}>
      <Flex gap={8} align="center">
        <Typography.Text>生成数量</Typography.Text>
        <InputNumber
          min={1}
          max={100}
          value={count}
          onChange={(v) => setCount(v ?? 1)}
          style={{ width: 100 }}
        />
        <Button type="primary" onClick={generate}>生成</Button>
        <Button danger onClick={clear}>清空</Button>
      </Flex>
      <TextArea
        rows={12}
        value={uuids}
        readOnly
        placeholder="UUID 列表将显示在这里"
        style={{ fontFamily: 'monospace', fontSize: 13 }}
      />
      {uuids && (
        <Typography.Text type="secondary">
          共 {uuids.split('\n').filter(Boolean).length} 个 UUID v4
        </Typography.Text>
      )}
    </Flex>
  );
}
