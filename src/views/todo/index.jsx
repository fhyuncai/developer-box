import { useMemo, useState } from 'react';
import {
  Button, Card, Checkbox, Flex,
  List, Popconfirm, Progress, Statistic, Tag, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CalendarOutlined, CheckCircleTwoTone,
  DeleteOutlined, HomeOutlined,
  PlusOutlined, UnorderedListOutlined, FileTextOutlined,
  ExclamationCircleOutlined, CloseOutlined,
} from '@ant-design/icons';
import BreadcrumbNav from '../../components/BreadcrumbNav';
import CreateListModal from './components/CreateListModal';
import TodoListDetail from './components/TodoListDetail';
import dayjs from 'dayjs';

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

export default function TodoListsPage({ todoLists, onTodoListsChange, onBack, onBackHome }) {
  const [viewingId, setViewingId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchMode, setBatchMode] = useState(false);

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

  const createList = (title, range) => {
    onTodoListsChange([
      ...todoLists,
      {
        id: Date.now().toString(36),
        title,
        items: [],
        startDate: range?.[0] ? range[0].format('YYYY-MM-DD') : null,
        dueDate: range?.[1] ? range[1].format('YYYY-MM-DD') : null,
        createdAt: Date.now(),
      },
    ]);
    setCreateOpen(false);
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

  /* ── Detail view ── */
  if (viewingList) {
    return (
      <TodoListDetail
        list={viewingList}
        onBack={() => setViewingId(null)}
        onBackHome={onBackHome}
        onUpdate={(patch) => updateList(viewingId, patch)}
        onDelete={() => { deleteList(viewingList.id); setViewingId(null); }}
      />
    );
  }

  /* ── Overview / list page ── */
  return (
    <section className="content-area todo-lists-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav items={[{ title: '首页', onClick: onBackHome }, { title: 'Todo List' }]} />
        <Flex gap={8}>
          <Button shape="circle" icon={batchMode ? <CloseOutlined /> : <UnorderedListOutlined />} onClick={toggleBatchMode} aria-label={batchMode ? '取消批量操作' : '批量操作'} />
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
            <Button shape="circle" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} aria-label="新建清单" />
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

      <CreateListModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createList}
      />
    </section>
  );
}