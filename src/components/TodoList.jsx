import { useMemo, useState } from 'react';
import { Button, Checkbox, Flex, Input, List, Popconfirm, Tag, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';

export default function TodoList({ todos, onChange }) {
  const [text, setText] = useState('');

  const pendingCount = useMemo(() => todos.filter((item) => !item.done).length, [todos]);

  const addItem = () => {
    const value = text.trim();
    if (!value) {
      return;
    }

    onChange([
      ...todos,
      {
        id: Date.now().toString(36),
        text: value,
        done: false,
        createdAt: Date.now()
      }
    ]);
    setText('');
  };

  const toggleItem = (id) => {
    onChange(todos.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const removeItem = (id) => {
    onChange(todos.filter((item) => item.id !== id));
  };

  return (
    <div className="tool-card">
      <Flex justify="space-between" align="center" className="tool-title-row">
        <Typography.Title level={4} className="tool-title">
          Todo List
        </Typography.Title>
        <Tag color={pendingCount > 0 ? 'processing' : 'success'}>
          {pendingCount > 0 ? `待办 ${pendingCount}` : '全部完成'}
        </Tag>
      </Flex>

      <Flex gap={8}>
        <Input
          placeholder="新增任务，例如：发布 v1.0"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onPressEnter={addItem}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={addItem}>
          添加
        </Button>
      </Flex>

      <List
        className="todo-list"
        dataSource={todos}
        locale={{ emptyText: '暂无任务' }}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Popconfirm
                key="delete"
                title="确认删除该任务？"
                okText="删除"
                cancelText="取消"
                onConfirm={() => removeItem(item.id)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ]}
          >
            <Checkbox checked={item.done} onChange={() => toggleItem(item.id)}>
              <span className={item.done ? 'todo-done' : ''}>{item.text}</span>
            </Checkbox>
          </List.Item>
        )}
      />
    </div>
  );
}
