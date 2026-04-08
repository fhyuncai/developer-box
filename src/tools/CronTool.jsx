import { useMemo, useState } from 'react';
import cronstrue from 'cronstrue';
import 'cronstrue/locales/zh_CN';
import { CronExpressionParser } from 'cron-parser';
import { Flex, Input, Tag, Timeline, Typography } from 'antd';

const PRESETS = [
  { label: '每分钟', value: '* * * * *' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 0 点', value: '0 0 * * *' },
  { label: '每周一 9 点', value: '0 9 * * 1' },
  { label: '每月 1 日', value: '0 0 1 * *' },
];

export default function CronTool() {
  const [expr, setExpr] = useState('0 9 * * 1-5');

  const result = useMemo(() => {
    const trimmed = expr.trim();
    if (!trimmed) return null;
    try {
      const description = cronstrue.toString(trimmed, { locale: 'zh_CN', use24HourTimeFormat: true });
      const interval = CronExpressionParser.parse(trimmed);
      const nextTimes = [];
      for (let i = 0; i < 8; i++) {
        nextTimes.push(interval.next().toDate().toLocaleString('zh-CN', { hour12: false }));
      }
      return { description, nextTimes };
    } catch (e) {
      return { error: e.message || '表达式无效' };
    }
  }, [expr]);

  return (
    <Flex vertical gap={12}>
      <Input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        placeholder="Cron 表达式（分 时 日 月 周）"
        style={{ fontFamily: 'monospace' }}
        allowClear
      />
      <Flex gap={6} wrap>
        {PRESETS.map((p) => (
          <Tag
            key={p.value}
            style={{ cursor: 'pointer' }}
            onClick={() => setExpr(p.value)}
          >
            {p.label}
          </Tag>
        ))}
      </Flex>
      {result?.error && <Typography.Text type="danger">{result.error}</Typography.Text>}
      {result && !result.error && (
        <Flex vertical gap={12}>
          <div>
            <Typography.Text type="secondary">描述&nbsp;&nbsp;</Typography.Text>
            <Typography.Text strong>{result.description}</Typography.Text>
          </div>
          <Typography.Text type="secondary">最近 {result.nextTimes.length} 次执行时间</Typography.Text>
          <Timeline
            items={result.nextTimes.map((t, i) => ({
              children: <Typography.Text style={{ fontFamily: 'monospace' }}>{t}</Typography.Text>,
              color: i === 0 ? 'blue' : 'gray',
            }))}
          />
        </Flex>
      )}
    </Flex>
  );
}
