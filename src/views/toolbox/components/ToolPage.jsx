import { Suspense } from 'react';
import { Flex, Spin } from 'antd';
import PageHeader from '../../../components/PageHeader';
import { TOOL_COMPONENTS } from '../tools';

export default function ToolPage({ toolKey, toolTitle, onBack, onBackToolbox, onBackHome }) {
  const Component = TOOL_COMPONENTS[toolKey];

  return (
    <section className="content-area tool-page">
      <PageHeader
        items={[
          { title: '首页', onClick: onBackHome },
          { title: '工具箱', onClick: onBackToolbox },
          { title: toolTitle },
        ]}
        onBack={onBack}
        onBackHome={onBackHome}
      />
      <Suspense fallback={<Flex justify="center" style={{ padding: 40 }}><Spin /></Flex>}>
        {Component ? <Component /> : <span>工具不存在</span>}
      </Suspense>
    </section>
  );
}
