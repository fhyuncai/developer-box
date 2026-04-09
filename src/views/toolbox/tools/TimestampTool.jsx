import { useEffect, useState } from 'react';
import { Button, DatePicker, Flex, Input, InputNumber, Select, Typography } from 'antd';

const UNITS = [
  { value: 1, label: '秒（s）' },
  { value: 1000, label: '毫秒（ms）' },
];

export default function TimestampTool() {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [tsInput, setTsInput] = useState('');
  const [tsUnit, setTsUnit] = useState(1);
  const [tsResult, setTsResult] = useState('');
  const [dtResult, setDtResult] = useState('');
  const [dtInput, setDtInput] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const tsToDate = () => {
    const num = Number(tsInput);
    if (isNaN(num)) { setTsResult('无效时间戳'); return; }
    const ms = num * tsUnit;
    const d = new Date(ms);
    setTsResult(d.toLocaleString('zh-CN', { hour12: false }) + `  (UTC: ${d.toUTCString()})`);
  };

  const dateToTs = () => {
    if (!dtInput) return;
    const ms = dtInput.valueOf();
    setDtResult(`秒: ${Math.floor(ms / 1000)}   毫秒: ${ms}`);
  };

  return (
    <Flex vertical gap={16}>
      <Flex align="center" gap={8}>
        <Typography.Text strong>当前时间戳</Typography.Text>
        <Input value={now} readOnly style={{ width: 140, fontFamily: 'monospace' }} />
        <Typography.Text type="secondary">秒 / </Typography.Text>
        <Input value={now * 1000} readOnly style={{ width: 160, fontFamily: 'monospace' }} />
        <Typography.Text type="secondary">毫秒</Typography.Text>
      </Flex>

      <Flex gap={8} align="center">
        <Typography.Text>时间戳 →</Typography.Text>
        <InputNumber
          value={tsInput}
          onChange={(v) => setTsInput(v ?? '')}
          placeholder="输入时间戳"
          style={{ width: 160 }}
        />
        <Select value={tsUnit} onChange={setTsUnit} options={UNITS} style={{ width: 130 }} />
        <Button type="primary" onClick={tsToDate}>转换</Button>
        {tsResult && <Typography.Text style={{ flex: 1, userSelect: 'text' }}>{tsResult}</Typography.Text>}
      </Flex>

      <Flex gap={8} align="center">
        <Typography.Text>日期时间 →</Typography.Text>
        <DatePicker
          showTime
          value={dtInput}
          onChange={setDtInput}
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="选择日期时间"
          style={{ width: 230 }}
        />
        <Button type="primary" onClick={dateToTs}>转换</Button>
        {dtResult && <Typography.Text style={{ fontFamily: 'monospace', userSelect: 'text' }}>{dtResult}</Typography.Text>}
      </Flex>
    </Flex>
  );
}
