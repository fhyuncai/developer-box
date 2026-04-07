import { Flex, Typography } from 'antd';

export default function TopToolbar({ pageTitle }) {
  return (
    <header className="top-toolbar">
      <Flex justify="space-between" align="center" gap={12}>
        <div>
          <Typography.Text className="toolbar-brand">Developer Box</Typography.Text>
          <Typography.Text type="secondary" className="toolbar-page-title">
            {pageTitle}
          </Typography.Text>
        </div>
      </Flex>
    </header>
  );
}
