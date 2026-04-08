import { Suspense } from 'react';
import { Button, Flex, Spin } from 'antd';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
import BreadcrumbNav from '../components/BreadcrumbNav';
import { TOOL_COMPONENTS } from '../tools';

export default function ToolPage({ toolKey, toolTitle, onBack, onBackToolbox, onBackHome }) {
  const Component = TOOL_COMPONENTS[toolKey];

  return (
    <section className="content-area tool-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav
          items={[
            { title: '首页', onClick: onBackHome },
            { title: '工具箱', onClick: onBackToolbox },
            { title: toolTitle },
          ]}
        />
        <Flex gap={8}>
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回上一页" />
          <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
        </Flex>
      </Flex>
      <Suspense fallback={<Flex justify="center" style={{ padding: 40 }}><Spin /></Flex>}>
        {Component ? <Component /> : <span>工具不存在</span>}
      </Suspense>
    </section>
  );
}
