import { useMemo, useState } from 'react';
import { Button, Card, Statistic, Tooltip, Typography, Space } from 'antd';
import { CheckCircleTwoTone, CheckOutlined, EditOutlined, MinusCircleFilled, PlusCircleFilled, RightOutlined, ToolTwoTone } from '@ant-design/icons';
import './HomePage.scss';

const HOME_MENU_ITEMS = [
  {
    key: 'toolbox',
    title: '工具箱',
    description: '开发者常用工具'
  },
  {
    key: 'workspace',
    title: '工作区',
    description: '统一入口，集中管理你的开发流程'
  }
];

const DASHBOARD_CARD_MAP = {
  toolCount: { title: '工具模块', renderValue: ({ toolCount }) => toolCount, prefix: <ToolTwoTone /> },
  doneCount: { title: '已完成任务', renderValue: ({ doneCount }) => doneCount, prefix: <CheckCircleTwoTone twoToneColor="#52c41a" /> }
};

export default function HomePage({
  pinnedBoards,
  dashboardOrder,
  dashboardItems,
  doneCount,
  toolCount,
  onDashboardConfigChange,
  onOpenPage
}) {
  const [editMode, setEditMode] = useState(false);
  const [draggingKey, setDraggingKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  const orderedDashboardItems = useMemo(() => {
    const itemMap = new Map(dashboardItems.map((item) => [item.key, item]));
    const listed = dashboardOrder.map((key) => itemMap.get(key)).filter(Boolean);
    const rest = dashboardItems.filter((item) => !dashboardOrder.includes(item.key));
    return [...listed, ...rest];
  }, [dashboardItems, dashboardOrder]);

  const visibleItems = useMemo(
    () => orderedDashboardItems.filter((item) => pinnedBoards.includes(item.key)),
    [orderedDashboardItems, pinnedBoards]
  );

  const hiddenItems = useMemo(
    () => orderedDashboardItems.filter((item) => !pinnedBoards.includes(item.key)),
    [orderedDashboardItems, pinnedBoards]
  );

  const handleRemove = (key) => {
    onDashboardConfigChange(
      pinnedBoards.filter((k) => k !== key),
      orderedDashboardItems.map((i) => i.key)
    );
  };

  const handleAdd = (key) => {
    onDashboardConfigChange(
      [...pinnedBoards, key],
      orderedDashboardItems.map((i) => i.key)
    );
  };

  const handleDrop = (targetKey) => {
    if (!draggingKey || draggingKey === targetKey) {
      return;
    }
    const keys = orderedDashboardItems.map((i) => i.key);
    const fromIndex = keys.indexOf(draggingKey);
    const toIndex = keys.indexOf(targetKey);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }
    const next = [...keys];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onDashboardConfigChange([...pinnedBoards], next);
  };

  return (
    <div className="home-page">
      <section className="hero">
        <Typography.Title level={2} className="hero-title">Developer Box</Typography.Title>

        <div className="content-area">
          <Space align="baseline" className="dashboard-header">
            <Typography.Title level={5} className="section-title">
              看板
            </Typography.Title>
            <Button
              className="board-edit-trigger"
              size="small"
              shape="circle"
              type={editMode ? 'primary' : 'text'}
              icon={editMode ? <CheckOutlined /> : <EditOutlined />}
              onClick={() => setEditMode((v) => !v)}
              aria-label={editMode ? '完成编辑' : '编辑看板'}
            />
          </Space>

          {/* 展示中区域 */}
          <div className="dashboard-zone">
            {visibleItems.length === 0 ? (
              <div className="dashboard-zone-empty">
                <Typography.Text type="secondary">暂无内容</Typography.Text>
              </div>
            ) : (
              <div className="tool-grid">
                {visibleItems.map(({ key }) => {
                  const card = DASHBOARD_CARD_MAP[key];
                  if (!card) return null;
                  return (
                    <div
                      key={key}
                      className={`dashboard-card-wrap${editMode ? ' edit-mode' : ''}${draggingKey === key ? ' dragging' : ''}${dragOverKey === key ? ' drag-over' : ''}`}
                      draggable={editMode}
                      onDragStart={editMode ? () => setDraggingKey(key) : undefined}
                      onDragOver={editMode ? (e) => { e.preventDefault(); setDragOverKey(key); } : undefined}
                      onDrop={editMode ? () => { handleDrop(key); setDragOverKey(null); } : undefined}
                      onDragEnd={editMode ? () => { setDraggingKey(null); setDragOverKey(null); } : undefined}
                    >
                      <Card size="small" className="tool-entry dashboard-tile">
                        <Statistic title={card.title} value={card.renderValue({ toolCount, doneCount })} prefix={card.prefix} styles={{ prefix: { paddingRight: 10 } }} />
                      </Card>
                      {editMode && (
                        <button className="dashboard-badge remove" type="button" onClick={() => handleRemove(key)} aria-label={`隐藏 ${card.title}`}>
                          <MinusCircleFilled />
                        </button>
                      )}
                    </div>
                  );
                })}
                {editMode &&
                  hiddenItems.map(({ key }) => (
                    <div key={`ph-vis-${key}`} className="dashboard-card-placeholder" />
                  ))}
              </div>
            )}
          </div>

          {editMode && (
            <div className="dashboard-hidden-section">
              <Typography.Text type="secondary" className="dashboard-hidden-label">已隐藏</Typography.Text>
              {hiddenItems.length === 0 ? (
                <div className="dashboard-zone-empty">
                  <Typography.Text type="secondary">暂无内容</Typography.Text>
                </div>
              ) : (
                <div className="tool-grid">
                  {hiddenItems.map(({ key }) => {
                    const card = DASHBOARD_CARD_MAP[key];
                    if (!card) return null;
                    return (
                      <div key={key} className="dashboard-card-wrap">
                        <Card size="small" className="tool-entry dashboard-tile hidden-tile">
                          <Statistic title={card.title} value={card.renderValue({ toolCount, doneCount })} prefix={card.prefix} />
                        </Card>
                        <button className="dashboard-badge add" type="button" onClick={() => handleAdd(key)} aria-label={`显示 ${card.title}`}>
                          <PlusCircleFilled />
                        </button>
                      </div>
                    );
                  })}
                  {visibleItems.map(({ key }) => (
                    <div key={`ph-hid-${key}`} className="dashboard-card-placeholder" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="content-area">
        <Typography.Title level={5} className="section-title">
          功能
        </Typography.Title>
        <div className="tool-grid">
          {HOME_MENU_ITEMS.map((item) => (
            <Card key={item.key} hoverable className="tool-entry" onClick={() => onOpenPage(item.key)}>
              <div className="tool-entry-head">
                <Typography.Text strong>{item.title}</Typography.Text>
                <RightOutlined />
              </div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                {item.description}
              </Typography.Paragraph>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
