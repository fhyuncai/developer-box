import { useState } from 'react';
import { DatePicker, Flex, Input, Modal } from 'antd';

const { RangePicker } = DatePicker;
const LIST_TITLE_MAX_LENGTH = 40;

export default function CreateListModal({ open, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [range, setRange] = useState(null);

  const handleCreate = () => {
    const trimmed = title.trim().slice(0, LIST_TITLE_MAX_LENGTH);
    if (!trimmed) return;
    onCreate(trimmed, range);
    setTitle('');
    setRange(null);
  };

  const handleClose = () => {
    onClose();
    setTitle('');
    setRange(null);
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
      destroyOnClose
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
        <RangePicker
          placeholder={['开始时间（可选）', '截止时间（可选）']}
          value={range}
          onChange={setRange}
          format="YYYY-MM-DD"
        />
      </Flex>
    </Modal>
  );
}
