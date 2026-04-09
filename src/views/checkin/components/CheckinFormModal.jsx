import { useEffect, useState } from 'react';
import { Button, Flex, Input, Modal, Select, Space, Tag, TimePicker } from 'antd';
import { Typography } from 'antd';
import dayjs from 'dayjs';

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

export default function CheckinFormModal({ open, editing, onClose, onSubmit }) {
  const [presetName, setPresetName] = useState(null);
  const [title, setTitle] = useState('');
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [times, setTimes] = useState([]);
  const [tempTime, setTempTime] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPresetName(null);
      setTitle(editing.title);
      setWeekdays(Array.isArray(editing.weekdays) ? editing.weekdays : []);
      setTimes(Array.isArray(editing.times) ? editing.times : []);
      setTempTime(null);
    } else {
      setPresetName(null);
      setTitle('');
      setWeekdays([1, 2, 3, 4, 5]);
      setTimes([]);
      setTempTime(null);
    }
  }, [open, editing]);

  const applyPreset = (name) => {
    setPresetName(name);
    const preset = PRESET_CONFIGS[name];
    if (!preset) return;
    setTitle(name);
    setWeekdays(preset.weekdays);
    setTimes(preset.times);
  };

  const addTime = () => {
    if (!tempTime) return;
    const value = dayjs(tempTime).format('HH:mm');
    if (!times.includes(value)) {
      setTimes((prev) => normalizeTimes([...prev, value]));
    }
    setTempTime(null);
  };

  const handleSubmit = () => {
    const nextTitle = title.trim().slice(0, CHECKIN_TITLE_MAX_LENGTH);
    if (!nextTitle) return;
    onSubmit({ title: nextTitle, weekdays, times: normalizeTimes(times), presetName });
  };

  return (
    <Modal
      title={editing ? '编辑打卡类型' : '新建打卡类型'}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
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
          placeholder="打卡名称"
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
  );
}
