import { Card, Flex, List, Modal, Typography } from 'antd';

export default function CheckinHistoryModal({ open, onClose, dashboard }) {
  return (
    <Modal
      title="历史打卡概览"
      open={open}
      footer={null}
      onCancel={onClose}
    >
      <Flex vertical gap={10} style={{ marginTop: 8 }}>
        <Card size="small">
          <Typography.Text>近 7 天完成：{dashboard.completedInWeek}</Typography.Text>
          <br />
          <Typography.Text>累计漏打（自创建以来）：{dashboard.missedSinceCreated}</Typography.Text>
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
  );
}
