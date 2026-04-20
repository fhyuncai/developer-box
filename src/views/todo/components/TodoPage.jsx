import { Card } from 'antd';
import TodoList from '../../../components/TodoList';
import PageHeader from '../../../components/PageHeader';

export default function TodoPage({ todos, onTodosChange, onBack, onBackToolbox, onBackHome }) {
  return (
    <section className="content-area tool-page">
      <PageHeader
        items={[
          { title: '首页', onClick: onBackHome },
          { title: '工具箱', onClick: onBackToolbox },
          { title: 'Todo List' }
        ]}
        onBack={onBack}
        onBackHome={onBackHome}
      />
      <Card size="small">
        <TodoList todos={todos} onChange={onTodosChange} />
      </Card>
    </section>
  );
}
