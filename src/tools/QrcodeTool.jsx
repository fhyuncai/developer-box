import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button, Flex, Input, Select, Slider, Space, Typography, Upload } from 'antd';
import { DownloadOutlined, UploadOutlined, SaveOutlined } from '@ant-design/icons';

const EC_OPTIONS = [
  { value: 'L', label: 'L，7% 容错' },
  { value: 'M', label: 'M，15% 容错' },
  { value: 'Q', label: 'Q，25% 容错' },
  { value: 'H', label: 'H，30% 容错' },
];

export default function QrcodeTool() {
  const [text, setText] = useState('https://example.com');
  const [ec, setEc] = useState('M');
  const [size, setSize] = useState(256);
  const [centerIcon, setCenterIcon] = useState('');
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!text.trim() || !canvasRef.current) return;
    setError('');
    QRCode.toCanvas(canvasRef.current, text, { errorCorrectionLevel: ec, width: size, margin: 2 }, (err) => {
      if (err) { setError(err.message); return; }
      if (centerIcon) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          const iconSize = Math.round(size * 0.22);
          const x = Math.round((size - iconSize) / 2);
          const y = Math.round((size - iconSize) / 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 4, y - 4, iconSize + 8, iconSize + 8);
          ctx.drawImage(img, x, y, iconSize, iconSize);
        };
        img.src = centerIcon;
      }
    });
  }, [text, ec, size, centerIcon]);

  const downloadPng = () => {
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = 'qrcode.png';
    a.click();
  };

  const downloadSvg = async () => {
    try {
      const svgStr = await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: ec, width: size, margin: 2 });
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qrcode.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleIconUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setCenterIcon(e.target.result);
    reader.readAsDataURL(file);
    return false;
  };

  const hasContent = text.trim().length > 0;

  return (
    <Flex vertical gap={12}>
      <Input.TextArea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="输入文本或 URL"
        allowClear
      />
      <Flex gap={16} align="center" wrap>
        <Flex gap={8} align="center">
          <Typography.Text>纠错级别</Typography.Text>
          <Select value={ec} onChange={setEc} options={EC_OPTIONS} style={{ width: 130 }} />
        </Flex>
        <Flex gap={8} align="center" style={{ flex: 1, minWidth: 200 }}>
          <Typography.Text>尺寸 {size}px</Typography.Text>
          <Slider min={128} max={512} step={32} value={size} onChange={setSize} style={{ flex: 1 }} />
        </Flex>
        <Upload accept="image/*" showUploadList={false} beforeUpload={handleIconUpload}>
          <Button>选择中心图标</Button>
        </Upload>
        {centerIcon && (
          <Button danger onClick={() => setCenterIcon('')}>清除图标</Button>
        )}
      </Flex>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      <Flex vertical align="center" gap={12}>
        <canvas
          ref={canvasRef}
          style={{ borderRadius: 8, display: hasContent ? 'block' : 'none' }}
        />
        {hasContent && (
          <Space>
            <Button icon={<SaveOutlined />} onClick={downloadPng}>保存 PNG</Button>
            <Button icon={<SaveOutlined />} onClick={downloadSvg}>保存 SVG</Button>
          </Space>
        )}
      </Flex>
    </Flex>
  );
}
