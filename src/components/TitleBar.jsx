import { useEffect, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { PushpinFilled, PushpinOutlined, SettingOutlined, MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons';

export default function TitleBar({ onOpenSettings }) {
  const [pinned, setPinned] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.developerBox.getAlwaysOnTop().then(setPinned);
    const platform = window.developerBox.getPlatform();
    setIsMac(platform === 'darwin');
    if (platform !== 'darwin') {
      window.developerBox.isMaximized().then(setIsMaximized);
      const unsub = window.developerBox.onMaximizeChanged(setIsMaximized);
      return unsub;
    }
  }, []);

  const togglePin = async () => {
    const next = !pinned;
    await window.developerBox.setAlwaysOnTop(next);
    setPinned(next);
  };

  return (
    <div className="titlebar">
      {isMac && <div className="titlebar-traffic-zone" />}

      <span className="titlebar-title">Developer Box</span>

      <div className="titlebar-actions">
        <Tooltip title="设置" placement="bottom" zIndex={9999}>
          <Button
            className="titlebar-btn"
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={onOpenSettings}
          />
        </Tooltip>
        <Tooltip title={pinned ? '取消置顶' : '窗口置顶'} placement="bottomRight" zIndex={9999}>
          <Button
            className={`titlebar-btn${pinned ? ' titlebar-btn--active' : ''}`}
            type="text"
            size="small"
            icon={pinned ? <PushpinFilled /> : <PushpinOutlined />}
            onClick={togglePin}
          />
        </Tooltip>
        {!isMac && (
          <div className="titlebar-wincontrols">
            <button
              className="titlebar-wc titlebar-wc--min"
              onClick={() => window.developerBox.minimizeWindow()}
              title="最小化"
            >
              <MinusOutlined />
            </button>
            <button
              className="titlebar-wc titlebar-wc--max"
              onClick={() => window.developerBox.toggleMaximize()}
              title={isMaximized ? '向下还原' : '最大化'}
            >
              <BorderOutlined />
            </button>
            <button
              className="titlebar-wc titlebar-wc--close"
              onClick={() => window.developerBox.closeWindow()}
              title="关闭"
            >
              <CloseOutlined />
            </button>
          </div>
        )}
      </div>

      {isMac && <div className="titlebar-right-zone" />}
    </div>
  );
}
