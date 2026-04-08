import { useState } from 'react';
import { Button, Col, Flex, Input, Row, Space, Typography } from 'antd';

function hexToRgb(hex) {
  const str = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(str)) return null;
  const n = parseInt(str, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export default function RgbHexTool() {
  const [r, setR] = useState('');
  const [g, setG] = useState('');
  const [b, setB] = useState('');
  const [hex, setHex] = useState('');
  const [error, setError] = useState('');
  const [previewColor, setPreviewColor] = useState('');

  const rgbToHexHandler = () => {
    setError('');
    const rv = parseInt(r), gv = parseInt(g), bv = parseInt(b);
    if ([rv, gv, bv].some((v) => isNaN(v) || v < 0 || v > 255)) {
      setError('R/G/B 值需为 0–255 的整数');
      return;
    }
    const result = rgbToHex(rv, gv, bv);
    setHex(result);
    setPreviewColor(result);
  };

  const hexToRgbHandler = () => {
    setError('');
    const result = hexToRgb(hex);
    if (!result) { setError('无效的 HEX 颜色值（格式如 #FF5733）'); return; }
    setR(String(result.r));
    setG(String(result.g));
    setB(String(result.b));
    setPreviewColor(hex.startsWith('#') ? hex : `#${hex}`);
  };

  const clear = () => { setR(''); setG(''); setB(''); setHex(''); setError(''); setPreviewColor(''); };

  return (
    <Flex vertical gap={14}>
      <Row gutter={8} align="middle">
        <Col flex="auto">
          <Row gutter={8}>
            {[['R', r, setR, '#ff4d4f'], ['G', g, setG, '#52c41a'], ['B', b, setB, '#1677ff']].map(([label, val, setter, color]) => (
              <Col span={8} key={label}>
                <Input
                  prefix={<Typography.Text style={{ color }}>{label}</Typography.Text>}
                  value={val}
                  onChange={(e) => setter(e.target.value)}
                  placeholder="0–255"
                  maxLength={3}
                />
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
      <Row gutter={8} align="middle">
        <Col flex="auto">
          <Input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#RRGGBB" maxLength={7} />
        </Col>
        {previewColor && (
          <Col>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: previewColor, border: '1px solid rgba(0,0,0,0.1)' }} />
          </Col>
        )}
      </Row>
      <Space>
        <Button type="primary" onClick={rgbToHexHandler}>RGB → HEX</Button>
        <Button onClick={hexToRgbHandler}>HEX → RGB</Button>
        <Button danger onClick={clear}>清空</Button>
      </Space>
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
    </Flex>
  );
}
