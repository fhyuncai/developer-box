import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Flex,
  List,
  Popconfirm,
  Switch,
  Space,
  Tag,
  Typography,
  Tooltip
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  HistoryOutlined,
  EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import CheckinFormModal from './components/CheckinFormModal';
import CheckinHistoryModal from './components/CheckinHistoryModal';

function normalizeTimes(times) {
  return [...new Set(times)].sort((a, b) => a.localeCompare(b));
}

function toOccurrence(dateBase, hhmm) {
  const [h, m] = hhmm.split(':').map((n) => Number(n));
  return dateBase.hour(h).minute(m).second(0).millisecond(0);
}

function collectOccurrences(checkin, now, beforeDays = 7, afterDays = 14) {
  const weekdays = Array.isArray(checkin.weekdays) ? checkin.weekdays : [];
  const times = normalizeTimes(Array.isArray(checkin.times) ? checkin.times : []);
  if (weekdays.length === 0 || times.length === 0) return [];

  const result = [];
  for (let offset = -beforeDays; offset <= afterDays; offset += 1) {
    const day = now.startOf('day').add(offset, 'day');
    if (!weekdays.includes(day.day())) continue;
    for (const t of times) {
      result.push(toOccurrence(day, t));
    }
  }
  return result.sort((a, b) => a.valueOf() - b.valueOf());
}

function getSlotKey(dt) {
  return dt.format('YYYY-MM-DD HH:mm');
}

function getCheckinSlots(checkin, now, beforeDays = 8, afterDays = 21) {
  const occurrences = collectOccurrences(checkin, now, beforeDays, afterDays);
  const checkedSet = new Set(Array.isArray(checkin.records) ? checkin.records : []);
  return occurrences.map((at, index) => {
    const nextAt = occurrences[index + 1] || null;
    const closeByHour = at.add(1, 'hour');
    const closeAt = nextAt && nextAt.isBefore(closeByHour) ? nextAt : closeByHour;
    const key = getSlotKey(at);
    return {
      at,
      closeAt,
      key,
      checked: checkedSet.has(key),
    };
  });
}

function getCheckinRuntimeState(checkin, now) {
  const slots = getCheckinSlots(checkin, now, 8, 21);
  const nextThree = slots.filter((x) => x.at.isAfter(now)).slice(0, 3).map((x) => x.at);

  if (!checkin.enabled) {
    return {
      nextThree,
      slotKey: null,
      canCheck: false,
      buttonText: '已禁用',
      statusText: '该打卡类型已禁用',
    };
  }

  if (slots.length === 0) {
    return {
      nextThree,
      slotKey: null,
      canCheck: false,
      buttonText: '未配置',
      statusText: '请先设置星期和时间',
    };
  }

  const active = [...slots].reverse().find((slot) =>
    (slot.at.isBefore(now) || slot.at.isSame(now)) && now.isBefore(slot.closeAt) && !slot.checked
  );

  if (active) {
    return {
      nextThree,
      slotKey: active.key,
      canCheck: true,
      buttonText: '打卡',
      statusText: `当前可打卡窗口：${active.at.format('HH:mm')} - ${active.closeAt.format('HH:mm')}`,
    };
  }

  const prev = [...slots].reverse().find((slot) => slot.at.isBefore(now) || slot.at.isSame(now));
  const next = slots.find((slot) => slot.at.isAfter(now));

  if (!prev) {
    return {
      nextThree,
      slotKey: null,
      canCheck: false,
      buttonText: '未到时间',
      statusText: next ? `最近一次：${next.at.format('MM-DD HH:mm')}` : '暂无即将到来的打卡时间',
    };
  }

  if (prev.checked) {
    return {
      nextThree,
      slotKey: prev.key,
      canCheck: false,
      buttonText: '已打卡',
      statusText: `本次时段 ${prev.at.format('HH:mm')} 已完成`,
    };
  }

  return {
    nextThree,
    slotKey: prev.key,
    canCheck: false,
    buttonText: '已过期',
    statusText: `本次时段 ${prev.at.format('HH:mm')} 已超可打卡窗口`,
  };
}

export default function CheckinPage({ checkins, onCheckinsChange, onBack, onBackHome }) {
  const [now, setNow] = useState(dayjs());
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dashboard = useMemo(() => {
    const allTodaySlots = [];
    const allPastSlots = [];

    for (const item of checkins) {
      const createdDay = dayjs(item.createdAt || now.valueOf()).startOf('day');
      const beforeDays = Math.max(0, now.startOf('day').diff(createdDay, 'day'));
      const slots = getCheckinSlots(item, now, beforeDays, 7).map((slot) => ({ ...slot, title: item.title, enabled: item.enabled }));
      allTodaySlots.push(...slots.filter((slot) => slot.enabled && slot.at.isSame(now, 'day')));
      allPastSlots.push(...slots.filter((slot) => slot.at.isBefore(now)));
    }

    const remainingToday = allTodaySlots.filter((slot) => !slot.checked && now.isBefore(slot.closeAt)).length;
    const nextPending = allTodaySlots
      .filter((slot) => !slot.checked && now.isBefore(slot.closeAt))
      .sort((a, b) => a.at.valueOf() - b.at.valueOf())[0] || null;

    const weekStart = now.startOf('day').subtract(6, 'day');
    const completedInWeek = allPastSlots.filter((slot) => slot.checked && (slot.at.isAfter(weekStart) || slot.at.isSame(weekStart))).length;
    const missedAll = allPastSlots.filter((slot) => !slot.checked && (now.isAfter(slot.closeAt) || now.isSame(slot.closeAt)));
    const missedSinceCreated = missedAll.length;
    const recentMissed = missedAll.sort((a, b) => b.at.valueOf() - a.at.valueOf()).slice(0, 6);

    return {
      remainingToday,
      nextPending,
      completedInWeek,
      missedSinceCreated,
      recentMissed,
    };
  }, [checkins, now]);

  const resetForm = () => {
    setEditing(null);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setFormOpen(true);
  };

  const handleFormSubmit = ({ title, weekdays, times, presetName }) => {
    if (editing) {
      onCheckinsChange(
        checkins.map((item) =>
          item.id === editing.id
            ? { ...item, title, weekdays, times }
            : item
        )
      );
    } else {
      onCheckinsChange([
        ...checkins,
        {
          id: Date.now().toString(36),
          title,
          enabled: false,
          weekdays,
          times,
          records: [],
          createdAt: Date.now(),
          preset: !!presetName,
        },
      ]);
    }
    setFormOpen(false);
    resetForm();
  };

  const handleFormClose = () => {
    setFormOpen(false);
    resetForm();
  };

  const toggleEnabled = (id, enabled) => {
    onCheckinsChange(checkins.map((item) => (item.id === id ? { ...item, enabled } : item)));
  };

  const removeCheckin = (id) => {
    onCheckinsChange(checkins.filter((item) => item.id !== id));
  };

  const handleCheckin = (item, runtime) => {
    if (!runtime.canCheck || !runtime.slotKey) return;
    onCheckinsChange(
      checkins.map((row) => {
        if (row.id !== item.id) return row;
        const records = Array.isArray(row.records) ? row.records : [];
        if (records.includes(runtime.slotKey)) return row;
        return { ...row, records: [...records, runtime.slotKey] };
      })
    );
  };


  return (
    <section className="content-area checkin-page">
      <PageHeader items={[{ title: '首页', onClick: onBackHome }, { title: '健康打卡' }]} onBack={onBack} onBackHome={onBackHome}>
        <Tooltip title="历史概览">
          <Button shape="circle" icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)} aria-label="历史概览" />
        </Tooltip>
          <Tooltip title="新建打卡">
            <Button shape="circle" type="primary" icon={<PlusOutlined />} onClick={openCreate} aria-label="新建打卡" />
          </Tooltip>
      </PageHeader>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <div>
            <Typography.Text type="secondary">今日剩余打卡数量</Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>{dashboard.remainingToday}</Typography.Title>
          </div>
          <div>
            <Typography.Text type="secondary">即将打卡时间和项目</Typography.Text>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {dashboard.nextPending ? `${dashboard.nextPending.at.format('HH:mm')} · ${dashboard.nextPending.title}` : '今日已无待打卡'}
            </Typography.Title>
          </div>
        </Flex>
      </Card>

      <List
        grid={{ gutter: 12, column: 4 }}
        dataSource={checkins}
        locale={{ emptyText: '暂无打卡类型，点击“新建打卡”开始' }}
        renderItem={(item) => {
          const runtime = getCheckinRuntimeState(item, now);
          return (
          <List.Item>
            <Card
              size="small"
              className="tool-entry"
              title={<span className="todo-list-title" title={item.title}>{item.title}</span>}
              extra={
                <Space>
                  <Button key="edit" type="link" color="default" variant="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(item)} aria-label="编辑" />
                  <Popconfirm
                    key="del"
                    title="确认删除该打卡？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => removeCheckin(item.id)}
                  >
                    <Button type="link" danger size="small" icon={<DeleteOutlined />} aria-label="删除" />
                  </Popconfirm>
                  <Switch
                    size="small"
                    checked={item.enabled}
                    onChange={(checked) => toggleEnabled(item.id, checked)}
                  />
                </Space>
              }
            >
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                接下来最近 3 次打卡时间
              </Typography.Text>
              <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 8 }}>
                {runtime.nextThree.length === 0 ? (
                  <Tag>暂无后续打卡时间</Tag>
                ) : (
                  runtime.nextThree.map((dt) => (
                    <Tag key={`${item.id}-${dt.valueOf()}`} color="blue">
                      {dt.format('MM-DD ddd HH:mm')}
                    </Tag>
                  ))
                )}
              </Space>
              {item.enabled &&
                <>
                  <Typography.Text type="secondary" style={{ display: 'block', margin: '10px 0 5px', fontSize: 12 }}>
                    {runtime.statusText}
                  </Typography.Text>
                  <Button type="primary" block disabled={!runtime.canCheck} onClick={() => handleCheckin(item, runtime)}>
                    {runtime.buttonText}
                  </Button>
                </>
              }
            </Card>
          </List.Item>
          );
        }}
      />

      <CheckinFormModal
        open={formOpen}
        editing={editing}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
      />

      <CheckinHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        dashboard={dashboard}
      />
    </section>
  );
}
