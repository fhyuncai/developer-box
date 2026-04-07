import { Breadcrumb } from 'antd';

export default function BreadcrumbNav({ items }) {
  const normalizedItems = items.map((item) => ({
    title: item.onClick ? (
      <button className="breadcrumb-link" type="button" onClick={item.onClick}>
        {item.title}
      </button>
    ) : (
      item.title
    )
  }));

  return <Breadcrumb className="page-breadcrumb" items={normalizedItems} />;
}
