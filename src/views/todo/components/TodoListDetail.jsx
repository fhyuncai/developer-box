import { useRef, useState } from 'react';
import {
  Button, Card, Checkbox, DatePicker, Empty, Flex, Input,
  Popconfirm, Progress, Tag, Typography,
} from 'antd';
import {
  CalendarOutlined, DeleteOutlined, EditOutlined, FileTextOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import dayjs from 'dayjs';

const { TextArea } = Input;
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
  const [editingDescId, setEditingDescId] = useState(null);
  const [descDraft, setDescDraft] = useState('');
  const taskInputRef = useRef(null);
  const descInputRef = useRef(null);

  const done = list.items.filter((i) => i.done).length;
  const total = list.items.length;
  const pending = total - done;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const dueSt = getDueDateTag(list.startDate, list.dueDate, pending > 0);

  const appendTasks = (rawText) => {
    const taskTexts = rawText
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (taskTexts.length === 0) return false;

    const createdAt = Date.now();
    onUpdate({
      items: [
        ...list.items,
        ...taskTexts.map((text, index) => ({
          id: `${createdAt.toString(36)}-${index.toString(36)}`,
          text,
          done: false,
          desc: '',
          createdAt: createdAt + index,
        })),
      ],
    });
    return true;
  };

  const addTask = () => {
    const appended = appendTasks(taskInput);
    if (!appended) return;
    setTaskInput('');
    setTimeout(() => taskInputRef.current?.focus(), 30);
  };

  const handleTaskPaste = (e) => {
    const pastedText = e.clipboardData.getData('text');
    if (!/[\r\n]/.test(pastedText)) return;
    e.preventDefault();
    const appended = appendTasks(pastedText);
    if (appended) {
      setTaskInput('');
      setTimeout(() => taskInputRef.current?.focus(), 30);
    }
  };

  const toggleTask = (taskId) => {
    onUpdate({ items: list.items.map((i) => (i.id === taskId ? { ...i, done: !i.done } : i)) });
  };

  const removeTask = (taskId) => {
    if (editingDescId === taskId) {
      setEditingDescId(null);
      setDescDraft('');
    }
    onUpdate({ items: list.items.filter((i) => i.id !== taskId) });
  };

  const updateTaskDesc = (taskId, desc) => {
    onUpdate({
      items: list.items.map((item) => (item.id === taskId ? { ...item, desc } : item)),
    });
  };

  const openDescEditor = (item) => {
    setEditingDescId(item.id);
    setDescDraft(item.desc ?? '');
    setTimeout(() => descInputRef.current?.focus({ cursor: 'end' }), 30);
  };

  const commitDesc = (taskId) => {
    if (editingDescId !== taskId) return;
    updateTaskDesc(taskId, descDraft.trim());
    setEditingDescId(null);
    setDescDraft('');
  };

  const updateStartDate = (value) => {
    const nextStartDate = value ? value.format('YYYY-MM-DD') : null;
    const shouldClearDueDate = nextStartDate && list.dueDate && dayjs(nextStartDate).isAfter(dayjs(list.dueDate), 'day');
    onUpdate({
      startDate: nextStartDate,
      dueDate: shouldClearDueDate ? null : list.dueDate,
    });
  };

  const updateDueDate = (value) => {
    onUpdate({
      dueDate: value ? value.format('YYYY-MM-DD') : null,
    });
  };

  const commitTitle = () => {
    const nextTitle = titleDraft.trim().slice(0, LIST_TITLE_MAX_LENGTH);
    if (nextTitle) onUpdate({ title: nextTitle });
    setEditingTitle(false);
  };

  const handleBack = () => {
    setEditingTitle(false);
    onBack();
  };

  return (
    <section className="content-area todo-list-page">
      <PageHeader
        items={[
          { title: '首页', onClick: onBackHome },
          { title: 'Todo List', onClick: handleBack },
          { title: list.title },
        ]}
        onBack={handleBack}
        onBackHome={onBackHome}
      >
        <Popconfirm
          title="确认删除此清单？"
          description="清单内所有任务将被删除"
          okText="删除"
          cancelText="取消"
          onConfirm={onDelete}
        >
          <Button danger shape="circle" icon={<DeleteOutlined />} aria-label="删除清单" />
        </Popconfirm>
      </PageHeader>

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
                <DatePicker
                  size="small"
                  placeholder="开始时间"
                  value={list.startDate ? dayjs(list.startDate) : null}
                  onChange={updateStartDate}
                  format="YYYY-MM-DD"
                  allowClear
                  variant="borderless"
                  disabledDate={(current) => !!(list.dueDate && current && current.isAfter(dayjs(list.dueDate), 'day'))}
                />
                <DatePicker
                  size="small"
                  placeholder="截止时间"
                  value={list.dueDate ? dayjs(list.dueDate) : null}
                  onChange={updateDueDate}
                  format="YYYY-MM-DD"
                  allowClear
                  variant="borderless"
                  disabledDate={(current) => !!(list.startDate && current && current.isBefore(dayjs(list.startDate), 'day'))}
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

        <div className="todo-task-list" role="list">
          {list.items.map((item) => (
            <div key={item.id} className="todo-task-item" role="listitem">
              <div className="todo-task-main">
                <Checkbox checked={item.done} onChange={() => toggleTask(item.id)} aria-label={`切换任务 ${item.text} 状态`} />
                <div className="todo-task-content">
                  <Typography.Text className={item.done ? 'todo-task-text todo-task-text--done' : 'todo-task-text'}>
                    {item.text}
                  </Typography.Text>
                  {(editingDescId === item.id || item.desc) && (
                    editingDescId === item.id ? (
                      <TextArea
                        ref={descInputRef}
                        value={descDraft}
                        className="todo-task-desc-input"
                        placeholder="补充任务描述"
                        autoSize={{ minRows: 2, maxRows: 5 }}
                        onChange={(e) => setDescDraft(e.target.value)}
                        onBlur={() => commitDesc(item.id)}
                        onPressEnter={(e) => {
                          if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
                            e.preventDefault();
                            commitDesc(item.id);
                          }
                        }}
                      />
                    ) : (
                      <Typography.Paragraph className="todo-task-desc">
                        {item.desc}
                      </Typography.Paragraph>
                    )
                  )}
                </div>
              </div>
              <div className="todo-task-actions">
                <Button
                  type="text"
                  size="small"
                  icon={item.desc ? <EditOutlined /> : <FileTextOutlined />}
                  onClick={() => openDescEditor(item)}
                  aria-label={item.desc ? '编辑描述' : '添加描述'}
                  title={item.desc ? '编辑描述' : '添加描述'}
                />
                <Popconfirm
                  title="确认删除该任务？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => removeTask(item.id)}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    aria-label="删除任务"
                    title="删除任务"
                  />
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>

        <div className="todo-task-create-row">
          <div className="todo-task-checkbox-slot" aria-hidden="true" />
          <Input
            ref={taskInputRef}
            className="todo-task-create-input"
            placeholder="新增任务，回车添加"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onPaste={handleTaskPaste}
            onPressEnter={addTask}
            variant="borderless"
          />
        </div>
      </Card>
    </section>
  );
}
