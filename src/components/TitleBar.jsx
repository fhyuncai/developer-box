import { useEffect, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { PushpinFilled, PushpinOutlined, SettingOutlined } from '@ant-design/icons';

export default function TitleBar({ onOpenSettings }) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    window.developerBox.getAlwaysOnTop().then(setPinned);
  }, []);

  const togglePin = async () => {
    const next = !pinned;
    await window.developerBox.setAlwaysOnTop(next);
    setPinned(next);
  };

  return (
    <div className="titlebar">
      {/* traffic-light safe zone — macOS places buttons at x:14 y:14 */}
      <div className="titlebar-traffic-zone" />

      <span className="titlebar-title">Developer Box</span>

      <div className="titlebar-actions">
        <Tooltip title="设置" placement="bottom">
          <Button
            className="titlebar-btn"
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={onOpenSettings}
          />
        </Tooltip>
        <Tooltip title={pinned ? '取消置顶' : '窗口置顶'} placement="bottom">
          <Button
            className={`titlebar-btn${pinned ? ' titlebar-btn--active' : ''}`}
            type="text"
            size="small"
            icon={pinned ? <PushpinFilled /> : <PushpinOutlined />}
            onClick={togglePin}
          />
        </Tooltip>
      </div>
    </div>
  );
}
