import { useEffect, useRef } from 'react';
import { CloseOutlined, HomeOutlined } from '@ant-design/icons';

export default function TitleTabs({ tabs = [], activeTabId, onActivateTab, onCloseTab }) {
  const containerRef = useRef(null);
  const itemRefs = useRef(new Map());

  useEffect(() => {
    const target = itemRefs.current.get(activeTabId);
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeTabId, tabs.length]);

  const handleWheel = (event) => {
    const container = containerRef.current;
    if (!container) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

    if (!delta) return;
    container.scrollLeft += delta;
    event.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      className="title-tabs"
      role="tablist"
      aria-label="页面标签"
      onWheel={handleWheel}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`title-tab${active ? ' is-active' : ''}`}
            onClick={() => onActivateTab?.(tab.id)}
            onMouseDown={(event) => {
              if (event.button === 1 && tab.closable) {
                event.preventDefault();
                event.stopPropagation();
                onCloseTab?.(tab.id);
              }
            }}
            ref={(element) => {
              if (element) {
                itemRefs.current.set(tab.id, element);
              } else {
                itemRefs.current.delete(tab.id);
              }
            }}
          >
            <span className="title-tab__label">
              {tab.pageKey === 'home' && <HomeOutlined className="title-tab__icon" />}
              <span className="title-tab__text">{tab.title}</span>
            </span>
            {tab.closable && (
              <span
                className="title-tab__close"
                role="button"
                tabIndex={0}
                aria-label={`关闭 ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab?.(tab.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onCloseTab?.(tab.id);
                  }
                }}
              >
                <CloseOutlined />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}