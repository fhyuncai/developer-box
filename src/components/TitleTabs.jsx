import { useEffect, useRef, useState } from 'react';
import { CloseOutlined, HomeOutlined } from '@ant-design/icons';

const TAB_EDGE_SAFE_PADDING = 28;

export default function TitleTabs({ tabs = [], activeTabId, onActivateTab, onCloseTab }) {
  const containerRef = useRef(null);
  const itemRefs = useRef(new Map());
  const previousTabsRef = useRef({
    count: tabs.length,
    lastTabId: tabs[tabs.length - 1]?.id ?? null,
  });
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const tabsSignature = tabs.map((tab) => `${tab.id}:${tab.title}:${tab.closable ? 1 : 0}`).join('|');

  const syncFadeState = () => {
    const container = containerRef.current;
    if (!container) return;

    const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0);
    const nextShowLeftFade = container.scrollLeft > 1;
    const nextShowRightFade = maxScrollLeft - container.scrollLeft > 1;

    setShowLeftFade((current) => (current === nextShowLeftFade ? current : nextShowLeftFade));
    setShowRightFade((current) => (current === nextShowRightFade ? current : nextShowRightFade));
  };

  const revealTabWithPadding = (target) => {
    const container = containerRef.current;
    if (!container || !target) return;

    const maxScrollLeft = Math.max(container.scrollWidth - container.clientWidth, 0);
    const currentScrollLeft = container.scrollLeft;
    const targetLeft = target.offsetLeft;
    const targetRight = targetLeft + target.offsetWidth;
    const safeVisibleLeft = currentScrollLeft + TAB_EDGE_SAFE_PADDING;
    const safeVisibleRight = currentScrollLeft + container.clientWidth - TAB_EDGE_SAFE_PADDING;

    if (targetLeft < safeVisibleLeft) {
      container.scrollTo({
        left: Math.max(targetLeft - TAB_EDGE_SAFE_PADDING, 0),
        behavior: 'smooth',
      });
      return;
    }

    if (targetRight > safeVisibleRight) {
      container.scrollTo({
        left: Math.min(targetRight - container.clientWidth + TAB_EDGE_SAFE_PADDING, maxScrollLeft),
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    const target = itemRefs.current.get(activeTabId);
    const previousTabs = previousTabsRef.current;
    const lastTabId = tabs[tabs.length - 1]?.id ?? null;
    const appendedActiveTab = (
      tabs.length > previousTabs.count
      && activeTabId === lastTabId
      && lastTabId !== previousTabs.lastTabId
    );

    const frameId = window.requestAnimationFrame(() => {
      if (appendedActiveTab && container) {
        container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
      } else {
        revealTabWithPadding(target);
      }

      syncFadeState();
      previousTabsRef.current = {
        count: tabs.length,
        lastTabId,
      };
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTabId, tabsSignature]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    syncFadeState();

    const handleResize = () => syncFadeState();
    window.addEventListener('resize', handleResize);

    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', handleResize);
    }

    const resizeObserver = new ResizeObserver(() => syncFadeState());
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [tabsSignature]);

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
      className={`title-tabs-shell${showLeftFade ? ' has-left-fade' : ''}${showRightFade ? ' has-right-fade' : ''}`}
    >
      <div
        ref={containerRef}
        className="title-tabs"
        role="tablist"
        aria-label="页面标签"
        onScroll={syncFadeState}
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
    </div>
  );
}
