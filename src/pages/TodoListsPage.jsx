import { useMemo, useRef, useState } from 'react';
import {
  Button, Card, Checkbox, DatePicker, Flex, Input,
  List, Modal, Popconfirm, Progress, Statistic, Tag, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CalendarOutlined, CheckCircleTwoTone,
  ClockCircleOutlined, DeleteOutlined, HomeOutlined,
  PlusOutlined, UnorderedListOutlined, FileTextOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import BreadcrumbNav from '../components/BreadcrumbNav';
import dayjs from 'dayjs';

const LIST_TITLE_MAX_LENGTH = 40;

function getDueDateTag(startDate, dueDate, hasPending) {
  if (!dueDate) return null;
  const today = dayjs().startOf('day');
  const due = dayjs(dueDate);
  const start = startDate ? dayjs(startDate).startOf('day') : null;
  if (!hasPending) return { color: 'success', text: '已完成' };
  const diff = due.diff(today, 'day');
  if (diff < 0) return { color: 'error', text: '已逾期' };
  // If list has not started yet, avoid showing "soon due" warning.
  if (start && today.isBefore(start) && diff <= 7) {
    return { color: 'default', text: due.format('MM-DD 截止') };
  }
  if (diff === 0) return { color: 'warning', text: '今天截止' };
  if (diff <= 7) return { color: 'warning', text: `${diff} 天后截止` };
  return { color: 'default', text: due.format('MM-DD 截止') };
}

export default function TodoListsPage({ todoLists, onTodoListsChange, onBack, onBackHome }) {
  const { RangePicker } = DatePicker;
  const [viewingId, setViewingId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newRange, setNewRange] = useState(null);
  const [taskInput, setTaskInput] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchMode, setBatchMode] = useState(false);
  const taskInputRef = useRef(null);

  const viewingList = viewingId ? (todoLists.find((l) => l.id === viewingId) ?? null) : null;

  const stats = useMemo(() => {
    const totalItems = todoLists.reduce((s, l) => s + l.items.length, 0);
    const doneItems = todoLists.reduce((s, l) => s + l.items.filter((i) => i.done).length, 0);
    const today = dayjs().startOf('day');
    const overdue = todoLists.filter(
      (l) => l.dueDate && dayjs(l.dueDate).isBefore(today) && l.items.some((i) => !i.done),
    ).length;
    return { listCount: todoLists.length, totalItems, doneItems, overdue };
  }, [todoLists]);

  const updateList = (id, patch) =>
    onTodoListsChange(todoLists.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const createList = () => {
    const title = newTitle.trim().slice(0, LIST_TITLE_MAX_LENGTH);
    if (!title) return;
    onTodoListsChange([
      ...todoLists,
      {
        id: Date.now().toString(36),
        title,
        items: [],
        startDate: newRange?.[0] ? newRange[0].format('YYYY-MM-DD') : null,
        dueDate: newRange?.[1] ? newRange[1].format('YYYY-MM-DD') : null,
        createdAt: Date.now(),
      },
    ]);
    setCreateOpen(false);
    setNewTitle('');
    setNewRange(null);
  };

  const deleteList = (id) => {
    if (viewingId === id) setViewingId(null);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    onTodoListsChange(todoLists.filter((l) => l.id !== id));
  };

  const toggleSelected = (id, checked) => {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  const deleteSelectedLists = () => {
    if (selectedIds.length === 0) return;
    onTodoListsChange(todoLists.filter((l) => !selectedIds.includes(l.id)));
    setSelectedIds([]);
    setBatchMode(false);
  };

  const toggleBatchMode = () => {
    setBatchMode((prev) => {
      if (prev) {
        setSelectedIds([]);
      }
      return !prev;
    });
  };

  const addTask = () => {
    const text = taskInput.trim();
    if (!text || !viewingId) return;
    const list = todoLists.find((l) => l.id === viewingId);
    if (!list) return;
    updateList(viewingId, {
      items: [...list.items, { id: Date.now().toString(36), text, done: false, createdAt: Date.now() }],
    });
    setTaskInput('');
    setTimeout(() => taskInputRef.current?.focus(), 30);
  };

  const toggleTask = (taskId) => {
    const list = todoLists.find((l) => l.id === viewingId);
    if (!list) return;
    updateList(viewingId, { items: list.items.map((i) => (i.id === taskId ? { ...i, done: !i.done } : i)) });
  };

  const removeTask = (taskId) => {
    const list = todoLists.find((l) => l.id === viewingId);
    if (!list) return;
    updateList(viewingId, { items: list.items.filter((i) => i.id !== taskId) });
  };

  /* ── Detail view ── */
  if (viewingList) {
    const done = viewingList.items.filter((i) => i.done).length;
    const total = viewingList.items.length;
    const pending = total - done;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const dueSt = getDueDateTag(viewingList.startDate, viewingList.dueDate, pending > 0);

    return (
      <section className="content-area todo-list-page">
        <Flex justify="space-between" align="center" className="page-nav-row">
          <BreadcrumbNav
            items={[
              { title: '首页', onClick: onBackHome },
              { title: 'Todo List', onClick: () => { setViewingId(null); setEditingTitle(false); } },
              { title: viewingList.title },
            ]}
          />
          <Flex gap={8}>
            <Popconfirm
              title="确认删除此清单？"
              description="清单内所有任务将被删除"
              okText="删除"
              cancelText="取消"
              onConfirm={() => deleteList(viewingList.id)}
            >
              <Button danger shape="circle" icon={<DeleteOutlined />} aria-label="删除清单" />
            </Popconfirm>
            <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => { setViewingId(null); setEditingTitle(false); }} aria-label="返回清单" />
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
                    onBlur={() => {
                      const nextTitle = titleDraft.trim().slice(0, LIST_TITLE_MAX_LENGTH);
                      if (nextTitle) updateList(viewingId, { title: nextTitle });
                      setEditingTitle(false);
                    }}
                    onPressEnter={() => {
                      const nextTitle = titleDraft.trim().slice(0, LIST_TITLE_MAX_LENGTH);
                      if (nextTitle) updateList(viewingId, { title: nextTitle });
                      setEditingTitle(false);
                    }}
                  />
                ) : (
                  <Typography.Title
                    level={4}
                    style={{ margin: '0 0 10px 0', cursor: 'pointer' }}
                    onClick={() => { setTitleDraft(viewingList.title); setEditingTitle(true); }}
                    title="点击编辑标题"
                  >
                    {viewingList.title}
                  </Typography.Title>
                )}
                <Flex gap={16} wrap="wrap" align="center">
                  <Flex align="center" gap={4}>
                    <CalendarOutlined style={{ opacity: 0.45, fontSize: 12 }} />
                    <RangePicker
                      size="small"
                      placeholder={['开始时间', '截止时间']}
                      value={[
                        viewingList.startDate ? dayjs(viewingList.startDate) : null,
                        viewingList.dueDate ? dayjs(viewingList.dueDate) : null,
                      ]}
                      onChange={(range) => updateList(viewingId, {
                        startDate: range?.[0] ? range[0].format('YYYY-MM-DD') : null,
                        dueDate: range?.[1] ? range[1].format('YYYY-MM-DD') : null,
                      })}
                      format="YYYY-MM-DD"
                      allowClear
                      variant="borderless"
                    />
                  </Flex>
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
            dataSource={viewingList.items}
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

  /* ── Overview / list page ── */
  return (
    <section className="content-area todo-lists-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav items={[{ title: '首页', onClick: onBackHome }, { title: 'Todo List' }]} />
        <Flex gap={8}>
          <Button onClick={toggleBatchMode}>{batchMode ? '取消批量操作' : '批量操作'}</Button>
          {batchMode && (
            <Popconfirm
              title="确认删除已选清单？"
              description="所选清单内所有任务将被删除"
              okText="删除"
              cancelText="取消"
              onConfirm={deleteSelectedLists}
              disabled={selectedIds.length === 0}
            >
              <Button danger shape="circle" disabled={selectedIds.length === 0} icon={<DeleteOutlined />} aria-label="批量删除" />
            </Popconfirm>
          )}
          {!batchMode && (
            <Button type="primary" icon={<PlusOutlined />} className="todo-create-btn" onClick={() => setCreateOpen(true)}>
              新建清单
            </Button>
          )}
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回" />
          <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
        </Flex>
      </Flex>

      {/* Overview stats */}
      <div className="todo-overview-stats">
        <Card size="small" className="tool-entry">
          <Statistic title="清单总数" value={stats.listCount} prefix={<UnorderedListOutlined style={{ marginRight: 6 }} />} />
        </Card>
        <Card size="small" className="tool-entry">
          <Statistic title="总任务数" value={stats.totalItems} prefix={<FileTextOutlined style={{ marginRight: 6 }} />} />
        </Card>
        <Card size="small" className="tool-entry">
          <Statistic
            title="已完成任务"
            value={stats.doneItems}
            prefix={<CheckCircleTwoTone twoToneColor="#52c41a" style={{ marginRight: 6 }} />}
            suffix={stats.totalItems > 0 ? `/ ${stats.totalItems}` : ''}
          />
        </Card>
        <Card size="small" className="tool-entry">
          <Statistic
            title="逾期清单"
            value={stats.overdue}
            prefix={<ExclamationCircleOutlined style={{ marginRight: 6 }} />}
            valueStyle={stats.overdue > 0 ? { color: '#ff4d4f' } : {}}
          />
        </Card>
      </div>

      {todoLists.length === 0 ? (
        <div className="todo-list-empty">
          <Typography.Text type="secondary">暂无清单，点击「新建清单」开始</Typography.Text>
        </div>
      ) : (
        <div className="tool-grid todo-list-card-grid">
          {todoLists.map((list) => {
            const total = list.items.length;
            const done = list.items.filter((i) => i.done).length;
            const pending = total - done;
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;
            const dueSt = getDueDateTag(list.startDate, list.dueDate, pending > 0);
            const checked = selectedIds.includes(list.id);
            const statusTag = pending > 0 ? { color: 'processing', text: '未完成' } : { color: 'success', text: '已完成' };

            return (
              <div key={list.id} className="todo-list-card-wrap">
                <Card hoverable className="tool-entry todo-list-card" onClick={() => !batchMode && setViewingId(list.id)}>
                  <Flex justify="space-between" align="flex-start" style={{ marginBottom: 8 }}>
                    <Typography.Text strong className="todo-list-title" title={list.title}>
                      {list.title}
                    </Typography.Text>
                    <Flex align="center" gap={8} style={{ flexShrink: 0 }}>
                      <Tag color={statusTag.color} style={{ marginRight: 0 }}>
                        {statusTag.text}
                      </Tag>
                      {dueSt && statusTag.text !== '已完成' && (
                        <Tag color={dueSt.color} style={{ marginRight: 0 }}>
                          {dueSt.text}
                        </Tag>
                      )}
                      {batchMode && (
                        <Checkbox
                          checked={checked}
                          onChange={(e) => toggleSelected(list.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`选择清单 ${list.title}`}
                        />
                      )}
                    </Flex>
                  </Flex>
                  <div>
                    <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {total === 0 ? '暂无任务' : `${done} / ${total} 已完成`}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {percent}%
                      </Typography.Text>
                    </Flex>
                    <Progress
                      percent={percent}
                      showInfo={false}
                      size="small"
                      status={percent === 100 ? 'success' : 'normal'}
                      strokeColor={percent === 100 ? '#52c41a' : undefined}
                    />
                  </div>
                  {(list.startDate || list.dueDate) && (
                    <Flex gap={10} wrap="wrap" style={{ marginTop: 8 }}>
                      {(list.startDate || list.dueDate) && (
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          <CalendarOutlined style={{ marginRight: 3 }} />
                          {list.startDate}{(list.startDate && list.dueDate) && ' ~ '}{list.dueDate}
                        </Typography.Text>
                      )}
                    </Flex>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        title="新建清单"
        open={createOpen}
        onOk={createList}
        onCancel={() => { setCreateOpen(false); setNewTitle(''); setNewRange(null); }}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ disabled: !newTitle.trim() }}
        destroyOnClose
      >
        <Flex vertical gap={12} style={{ marginTop: 16 }}>
          <Input
            placeholder="清单名称（必填）"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value.slice(0, LIST_TITLE_MAX_LENGTH))}
            onPressEnter={createList}
            maxLength={LIST_TITLE_MAX_LENGTH}
            showCount
            autoFocus
          />
          <RangePicker
            placeholder={['开始时间（可选）', '截止时间（可选）']}
            value={newRange}
            onChange={setNewRange}
            format="YYYY-MM-DD"
          />
        </Flex>
      </Modal>
    </section>
  );
}