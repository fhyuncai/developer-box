import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Flex,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  TimePicker,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  HomeOutlined,
  PlusOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import BreadcrumbNav from '../components/BreadcrumbNav';

const CHECKIN_TITLE_MAX_LENGTH = 24;
const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 },
];

const PRESET_TYPES = ['喝水', '拉伸', '护眼休息', '散步', '冥想', '服药'];

const PRESET_CONFIGS = {
  喝水: { weekdays: [1, 2, 3, 4, 5], times: ['10:30', '11:30', '13:30', '15:30', '17:00'] },
  拉伸: { weekdays: [1, 2, 3, 4, 5], times: ['11:00', '16:00'] },
  护眼休息: { weekdays: [1, 2, 3, 4, 5], times: ['10:00', '14:00', '16:30'] },
  散步: { weekdays: [1, 2, 3, 4, 5], times: ['18:00'] },
  冥想: { weekdays: [1, 2, 3, 4, 5, 6, 0], times: ['22:00'] },
  服药: { weekdays: [1, 2, 3, 4, 5, 6, 0], times: ['08:00', '20:00'] },
};

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
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [presetName, setPresetName] = useState(null);
  const [title, setTitle] = useState('');
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [times, setTimes] = useState([]);
  const [tempTime, setTempTime] = useState(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dashboard = useMemo(() => {
    const allTodaySlots = [];
    const allPastSlots = [];

    for (const item of checkins) {
      const slots = getCheckinSlots(item, now, 14, 7).map((slot) => ({ ...slot, title: item.title, enabled: item.enabled }));
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
    const missedInWeek = missedAll.filter((slot) => slot.at.isAfter(weekStart) || slot.at.isSame(weekStart)).length;
    const recentMissed = missedAll.sort((a, b) => b.at.valueOf() - a.at.valueOf()).slice(0, 6);

    return {
      remainingToday,
      nextPending,
      completedInWeek,
      missedInWeek,
      recentMissed,
    };
  }, [checkins, now]);

  const resetForm = () => {
    setEditing(null);
    setPresetName(null);
    setTitle('');
    setWeekdays([1, 2, 3, 4, 5]);
    setTimes([]);
    setTempTime(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setPresetName(null);
    setTitle(item.title);
    setWeekdays(Array.isArray(item.weekdays) ? item.weekdays : []);
    setTimes(Array.isArray(item.times) ? item.times : []);
    setTempTime(null);
    setOpen(true);
  };

  const upsertCheckin = () => {
    const nextTitle = title.trim().slice(0, CHECKIN_TITLE_MAX_LENGTH);
    if (!nextTitle) return;

    if (editing) {
      onCheckinsChange(
        checkins.map((item) =>
          item.id === editing.id
            ? { ...item, title: nextTitle, weekdays, times: normalizeTimes(times) }
            : item
        )
      );
    } else {
      onCheckinsChange([
        ...checkins,
        {
          id: Date.now().toString(36),
          title: nextTitle,
          enabled: true,
          weekdays,
          times: normalizeTimes(times),
          records: [],
          createdAt: Date.now(),
          preset: !!presetName,
        },
      ]);
    }

    setOpen(false);
    resetForm();
  };

  const applyPreset = (name) => {
    setPresetName(name);
    const preset = PRESET_CONFIGS[name];
    if (!preset) return;
    setTitle(name);
    setWeekdays(preset.weekdays);
    setTimes(preset.times);
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

  const addTime = () => {
    if (!tempTime) return;
    const value = dayjs(tempTime).format('HH:mm');
    if (!times.includes(value)) {
      setTimes((prev) => normalizeTimes([...prev, value]));
    }
    setTempTime(null);
  };

  return (
    <section className="content-area checkin-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav items={[{ title: '首页', onClick: onBackHome }, { title: '健康打卡' }]} />
        <Flex gap={8}>
          <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
            历史概览
          </Button>
          <Button type="primary" icon={<PlusOutlined />} className="todo-create-btn" onClick={openCreate}>
            新建打卡
          </Button>
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回" />
          <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
        </Flex>
      </Flex>

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
                <Switch
                  size="small"
                  checked={item.enabled}
                  checkedChildren="启用"
                  unCheckedChildren="禁用"
                  onChange={(checked) => toggleEnabled(item.id, checked)}
                />
              }
              actions={[
                <Button key="edit" type="text" size="small" onClick={() => openEdit(item)}>编辑</Button>,
                <Popconfirm
                  key="del"
                  title="确认删除该打卡类型？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => removeCheckin(item.id)}
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>,
              ]}
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
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
                {runtime.statusText}
              </Typography.Text>
              <Flex justify="space-between" align="center" style={{ marginTop: 10 }}>
                <Button type="primary" disabled={!runtime.canCheck} onClick={() => handleCheckin(item, runtime)}>
                  {runtime.buttonText}
                </Button>
                {item.preset ? <Tag color="geekblue">预设</Tag> : <Tag>自定义</Tag>}
              </Flex>
            </Card>
          </List.Item>
          );
        }}
      />

      <Modal
        title={editing ? '编辑打卡类型' : '新建打卡类型'}
        open={open}
        onOk={upsertCheckin}
        onCancel={() => {
          setOpen(false);
          resetForm();
        }}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        okButtonProps={{ disabled: !title.trim() }}
      >
        <Flex vertical gap={12} style={{ marginTop: 16 }}>
          {!editing && (
            <Select
              placeholder="快速填充预设（可选）"
              value={presetName}
              onChange={applyPreset}
              allowClear
              options={PRESET_TYPES.map((x) => ({ label: x, value: x }))}
            />
          )}
          <Input
            placeholder="打卡名称（必填）"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, CHECKIN_TITLE_MAX_LENGTH))}
            maxLength={CHECKIN_TITLE_MAX_LENGTH}
            showCount
          />
          <Select
            mode="multiple"
            placeholder="选择星期（可多选）"
            value={weekdays}
            onChange={setWeekdays}
            options={WEEKDAY_OPTIONS}
          />

          <div>
            <Typography.Text type="secondary">打卡时间（可多选）</Typography.Text>
            <Flex gap={8} style={{ marginTop: 8 }}>
              <TimePicker
                value={tempTime}
                format="HH:mm"
                minuteStep={5}
                onChange={(value) => setTempTime(value || null)}
              />
              <Button onClick={addTime}>添加时间</Button>
            </Flex>
            <Space wrap style={{ marginTop: 8 }}>
              {times.length === 0 ? (
                <Tag>未设置时间点</Tag>
              ) : (
                times.map((t) => (
                  <Tag key={t} closable onClose={() => setTimes((prev) => prev.filter((x) => x !== t))}>
                    {t}
                  </Tag>
                ))
              )}
            </Space>
          </div>
        </Flex>
      </Modal>

      <Modal
        title="历史打卡概览"
        open={historyOpen}
        footer={null}
        onCancel={() => setHistoryOpen(false)}
      >
        <Flex vertical gap={10} style={{ marginTop: 8 }}>
          <Card size="small">
            <Typography.Text>近 7 天完成：{dashboard.completedInWeek}</Typography.Text>
            <br />
            <Typography.Text>近 7 天漏打：{dashboard.missedInWeek}</Typography.Text>
          </Card>
          <Typography.Text strong>最近未打卡时间点</Typography.Text>
          {dashboard.recentMissed.length === 0 ? (
            <Typography.Text type="secondary">暂无未打卡记录</Typography.Text>
          ) : (
            <List
              size="small"
              dataSource={dashboard.recentMissed}
              renderItem={(slot) => (
                <List.Item>
                  <Typography.Text>{slot.at.format('MM-DD HH:mm')} · {slot.title}</Typography.Text>
                </List.Item>
              )}
            />
          )}
        </Flex>
      </Modal>
    </section>
  );
}
