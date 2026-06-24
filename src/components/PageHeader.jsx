import { Children, cloneElement, isValidElement } from 'react';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
import { Button, Flex, Tooltip } from 'antd';
import BreadcrumbNav from './BreadcrumbNav';

function forceTooltipBottom(node) {
  if (!isValidElement(node)) return node;

  const nextChildren = node.props?.children
    ? Children.map(node.props.children, forceTooltipBottom)
    : node.props?.children;

  const isAntdTooltip =
    node.type === Tooltip ||
    node.type?.displayName === 'Tooltip' ||
    node.type?._InternalPanelDoNotUseOrYouWillBeFired;

  if (isAntdTooltip) {
    return cloneElement(node, { ...node.props, placement: 'bottom' }, nextChildren);
  }

  if (nextChildren !== node.props?.children) {
    return cloneElement(node, { ...node.props }, nextChildren);
  }

  return node;
}

export default function PageHeader({
  items,
  onBack,
  onBackHome,
  children,
  className = '',
  showBack = true,
  showHome = true,
}) {
  const classes = ['page-nav-row', className].filter(Boolean).join(' ');
  const normalizedChildren = Children.map(children, forceTooltipBottom);

  return (
    <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12} className={classes}>
      <BreadcrumbNav items={items} />
      <Flex gap={8} align="center" wrap="wrap" className="page-nav-actions">
        {normalizedChildren}
        {showBack && onBack && (
          <Tooltip title="返回上一页" placement="bottom">
            <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回上一页" />
          </Tooltip>
        )}
        {showHome && onBackHome && (
          <Tooltip title="返回首页" placement="bottom">
            <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
          </Tooltip>
        )}
      </Flex>
    </Flex>
  );
}
