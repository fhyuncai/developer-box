import { useState } from 'react';
import { DatePicker, Flex, Input, Modal } from 'antd';

const LIST_TITLE_MAX_LENGTH = 40;

export default function CreateListModal({ open, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [dueDate, setDueDate] = useState(null);

  const handleCreate = () => {
    const trimmed = title.trim().slice(0, LIST_TITLE_MAX_LENGTH);
    if (!trimmed) return;
    onCreate(trimmed, { startDate, dueDate });
    setTitle('');
    setStartDate(null);
    setDueDate(null);
  };

  const handleClose = () => {
    onClose();
    setTitle('');
    setStartDate(null);
    setDueDate(null);
  };

  return (
    <Modal
      title="新建清单"
      open={open}
      onOk={handleCreate}
      onCancel={handleClose}
      okText="创建"
      cancelText="取消"
      okButtonProps={{ disabled: !title.trim() }}
      destroyOnHidden
    >
      <Flex vertical gap={12} style={{ marginTop: 16 }}>
        <Input
          placeholder="清单名称"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, LIST_TITLE_MAX_LENGTH))}
          onPressEnter={handleCreate}
          maxLength={LIST_TITLE_MAX_LENGTH}
          showCount
          autoFocus
        />
        <DatePicker
          placeholder="开始时间（可选）"
          value={startDate}
          onChange={setStartDate}
          format="YYYY-MM-DD"
          disabledDate={(current) => !!(dueDate && current && current.isAfter(dueDate, 'day'))}
        />
        <DatePicker
          placeholder="截止时间（可选）"
          value={dueDate}
          onChange={setDueDate}
          format="YYYY-MM-DD"
          disabledDate={(current) => !!(startDate && current && current.isBefore(startDate, 'day'))}
        />
      </Flex>
    </Modal>
  );
}
