import { Button, Card, Flex } from 'antd';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
import TodoList from '../components/TodoList';
import BreadcrumbNav from '../components/BreadcrumbNav';

export default function TodoPage({ todos, onTodosChange, onBack, onBackToolbox, onBackHome }) {
  return (
    <section className="content-area tool-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav
          items={[
            { title: '首页', onClick: onBackHome },
            { title: '工具箱', onClick: onBackToolbox },
            { title: 'Todo List' }
          ]}
        />
        <Flex gap={8}>
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回上一页" />
          <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
        </Flex>
      </Flex>
      <Card size="small">
        <TodoList todos={todos} onChange={onTodosChange} />
      </Card>
    </section>
  );
}
