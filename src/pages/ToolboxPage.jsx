import { Button, Card, Flex, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, RightOutlined } from '@ant-design/icons';
import BreadcrumbNav from '../components/BreadcrumbNav';

export default function ToolboxPage({ tools, onBack, onBackHome, onOpenTool }) {
  return (
    <section className="content-area toolbox-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav items={[{ title: '首页', onClick: onBackHome }, { title: '工具箱' }]} />
        <Flex gap={8}>
          <Tooltip title="返回上一页">
            <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回上一页" />
          </Tooltip>
          <Tooltip title="返回首页">
            <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
          </Tooltip>
        </Flex>
      </Flex>
      <div className="tool-grid">
        {tools.map((tool) => (
          <Card key={tool.key} hoverable className="tool-entry" onClick={() => onOpenTool(tool.key)}>
            <Flex justify="space-between" align="center">
              <Typography.Text strong>{tool.title}</Typography.Text>
              <RightOutlined />
            </Flex>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              {tool.description}
            </Typography.Paragraph>
          </Card>
        ))}
      </div>
    </section>
  );
}
