import { useRef, useState } from 'react';
import {
  Button, Card, Checkbox, DatePicker, Flex, Input,
  List, Popconfirm, Progress, Tag, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CalendarOutlined, DeleteOutlined,
  HomeOutlined, PlusOutlined,
} from '@ant-design/icons';
import BreadcrumbNav from '../../../components/BreadcrumbNav';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const LIST_TITLE_MAX_LENGTH = 40;

function getDueDateTag(startDate, dueDate, hasPending) {
  if (!dueDate) return null;
  const today = dayjs().startOf('day');
  const due = dayjs(dueDate);
  const start = startDate ? dayjs(startDate).startOf('day') : null;
  if (!hasPending) return { color: 'success', text: '已完成' };
  const diff = due.diff(today, 'day');
  if (diff < 0) return { color: 'error', text: '已逾期' };
  if (start && today.isBefore(start) && diff <= 7) {
    return { color: 'default', text: due.format('MM-DD 截止') };
  }
  if (diff === 0) return { color: 'warning', text: '今天截止' };
  if (diff <= 7) return { color: 'warning', text: `${diff} 天后截止` };
  return { color: 'default', text: due.format('MM-DD 截止') };
}

export default function TodoListDetail({ list, onBack, onBackHome, onUpdate, onDelete }) {
  const [taskInput, setTaskInput] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const taskInputRef = useRef(null);

  const done = list.items.filter((i) => i.done).length;
  const total = list.items.length;
  const pending = total - done;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const dueSt = getDueDateTag(list.startDate, list.dueDate, pending > 0);

  const addTask = () => {
    const text = taskInput.trim();
    if (!text) return;
    onUpdate({
      items: [...list.items, { id: Date.now().toString(36), text, done: false, createdAt: Date.now() }],
    });
    setTaskInput('');
    setTimeout(() => taskInputRef.current?.focus(), 30);
  };

  const toggleTask = (taskId) => {
    onUpdate({ items: list.items.map((i) => (i.id === taskId ? { ...i, done: !i.done } : i)) });
  };

  const removeTask = (taskId) => {
    onUpdate({ items: list.items.filter((i) => i.id !== taskId) });
  };

  const commitTitle = () => {
    const nextTitle = titleDraft.trim().slice(0, LIST_TITLE_MAX_LENGTH);
    if (nextTitle) onUpdate({ title: nextTitle });
    setEditingTitle(false);
  };

  return (
    <section className="content-area todo-list-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav
          items={[
            { title: '首页', onClick: onBackHome },
            { title: 'Todo List', onClick: () => { onBack(); setEditingTitle(false); } },
            { title: list.title },
          ]}
        />
        <Flex gap={8}>
          <Popconfirm
            title="确认删除此清单？"
            description="清单内所有任务将被删除"
            okText="删除"
            cancelText="取消"
            onConfirm={onDelete}
          >
            <Button danger shape="circle" icon={<DeleteOutlined />} aria-label="删除清单" />
          </Popconfirm>
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回清单" />
          <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
        </Flex>
      </Flex>

      <Card size="small">
        <div className="todo-detail-header">
          <Flex justify="space-between" align="flex-start">
            <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
              {editingTitle ? (
                <Input
                  value={titleDraft}
                  autoFocus
                  style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}
                  maxLength={LIST_TITLE_MAX_LENGTH}
                  showCount
                  onChange={(e) => setTitleDraft(e.target.value.slice(0, LIST_TITLE_MAX_LENGTH))}
                  onBlur={commitTitle}
                  onPressEnter={commitTitle}
                />
              ) : (
                <Typography.Title
                  level={4}
                  style={{ margin: '0 0 10px 0', cursor: 'pointer' }}
                  onClick={() => { setTitleDraft(list.title); setEditingTitle(true); }}
                  title="点击编辑标题"
                >
                  {list.title}
                </Typography.Title>
              )}
              <Flex gap={16} wrap="wrap" align="center">
                <RangePicker
                  size="small"
                  placeholder={['开始时间', '截止时间']}
                  value={[
                    list.startDate ? dayjs(list.startDate) : null,
                    list.dueDate ? dayjs(list.dueDate) : null,
                  ]}
                  onChange={(range) => onUpdate({
                    startDate: range?.[0] ? range[0].format('YYYY-MM-DD') : null,
                    dueDate: range?.[1] ? range[1].format('YYYY-MM-DD') : null,
                  })}
                  format="YYYY-MM-DD"
                  allowClear
                  variant="borderless"
                />
                {dueSt && <Tag color={dueSt.color}>{dueSt.text}</Tag>}
              </Flex>
            </div>
            <Progress type="circle" percent={percent} size={56} style={{ flexShrink: 0 }} />
          </Flex>

          <Flex align="center" gap={8} style={{ margin: '10px 0 12px' }}>
            <Tag color={pending > 0 ? 'processing' : 'success'}>
              {pending > 0 ? `待办 ${pending}` : '全部完成'}
            </Tag>
            {total > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {done} / {total} 已完成
              </Typography.Text>
            )}
          </Flex>
        </div>

        <Flex gap={8} style={{ marginBottom: 4 }}>
          <Input
            ref={taskInputRef}
            placeholder="新增任务，回车添加"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onPressEnter={addTask}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={addTask}>
            添加
          </Button>
        </Flex>

        <List
          className="todo-task-list"
          dataSource={list.items}
          locale={{ emptyText: '暂无任务，输入上方内容新增' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title="确认删除该任务？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => removeTask(item.id)}
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <Checkbox checked={item.done} onChange={() => toggleTask(item.id)}>
                <span style={item.done ? { textDecoration: 'line-through', opacity: 0.45 } : {}}>
                  {item.text}
                </span>
              </Checkbox>
            </List.Item>
          )}
        />
      </Card>
    </section>
  );
}
