import { useMemo, useRef, useState } from 'react';
import { Button, ColorPicker, Form, Input } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function round(v, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(v * factor) / factor;
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function hexToRgb(hex) {
  const raw = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(raw)) return null;
  const full = raw.length === 3 ? raw.split('').map((c) => `${c}${c}`).join('') : raw;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: round(h, 2), s: round(s * 100, 2), l: round(l * 100, 2) };
}

function hslToRgb({ h, s, l }) {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp(s / 100, 0, 1);
  const ln = clamp(l / 100, 0, 1);

  if (sn === 0) {
    const gray = Math.round(ln * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hk = hn / 360;
  const toChannel = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  return {
    r: Math.round(toChannel(hk + 1 / 3) * 255),
    g: Math.round(toChannel(hk) * 255),
    b: Math.round(toChannel(hk - 1 / 3) * 255),
  };
}

function rgbToHwb(rgb) {
  const hsl = rgbToHsl(rgb);
  const rn = rgb.r / 255;
  const gn = rgb.g / 255;
  const bn = rgb.b / 255;
  const w = Math.min(rn, gn, bn) * 100;
  const bk = (1 - Math.max(rn, gn, bn)) * 100;
  return { h: round(hsl.h, 2), w: round(w, 2), b: round(bk, 2) };
}

function hwbToRgb({ h, w, b }) {
  let wn = clamp(w / 100, 0, 1);
  let bn = clamp(b / 100, 0, 1);
  const sum = wn + bn;
  if (sum > 1) {
    wn /= sum;
    bn /= sum;
  }
  const base = hslToRgb({ h, s: 100, l: 50 });
  const mix = 1 - wn - bn;
  return {
    r: Math.round((base.r / 255) * mix * 255 + wn * 255),
    g: Math.round((base.g / 255) * mix * 255 + wn * 255),
    b: Math.round((base.b / 255) * mix * 255 + wn * 255),
  };
}

function rgbToXyz({ r, g, b }) {
  const srgb = [r, g, b].map((v) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  const [rn, gn, bn] = srgb;
  return {
    x: rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375,
    y: rn * 0.2126729 + gn * 0.7151522 + bn * 0.072175,
    z: rn * 0.0193339 + gn * 0.119192 + bn * 0.9503041,
  };
}

function xyzToRgb({ x, y, z }) {
  let rn = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let gn = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  let bn = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  const toSrgb = (v) => {
    const clipped = clamp(v, 0, 1);
    const out = clipped <= 0.0031308 ? clipped * 12.92 : 1.055 * clipped ** (1 / 2.4) - 0.055;
    return Math.round(clamp(out, 0, 1) * 255);
  };
  return { r: toSrgb(rn), g: toSrgb(gn), b: toSrgb(bn) };
}

function xyzToLab({ x, y, z }) {
  const refX = 0.95047;
  const refY = 1.0;
  const refZ = 1.08883;
  const f = (t) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  const fx = f(x / refX);
  const fy = f(y / refY);
  const fz = f(z / refZ);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labToXyz({ l, a, b }) {
  const refX = 0.95047;
  const refY = 1.0;
  const refZ = 1.08883;
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const fInv = (t) => {
    const t3 = t ** 3;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  return {
    x: refX * fInv(fx),
    y: refY * fInv(fy),
    z: refZ * fInv(fz),
  };
}

function labToLch({ l, a, b }) {
  const c = Math.sqrt(a ** 2 + b ** 2);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: round(l, 2), c: round(c, 2), h: round(h, 2) };
}

function lchToLab({ l, c, h }) {
  const hr = (((h % 360) + 360) % 360 * Math.PI) / 180;
  return {
    l,
    a: c * Math.cos(hr),
    b: c * Math.sin(hr),
  };
}

function rgbToLch(rgb) {
  return labToLch(xyzToLab(rgbToXyz(rgb)));
}

function lchToRgb(lch) {
  return xyzToRgb(labToXyz(lchToLab(lch)));
}

function rgbToCmyk({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);
  return {
    c: round(c * 100, 2),
    m: round(m * 100, 2),
    y: round(y * 100, 2),
    k: round(k * 100, 2),
  };
}

function cmykToRgb({ c, m, y, k }) {
  const cn = clamp(c / 100, 0, 1);
  const mn = clamp(m / 100, 0, 1);
  const yn = clamp(y / 100, 0, 1);
  const kn = clamp(k / 100, 0, 1);
  return {
    r: Math.round(255 * (1 - cn) * (1 - kn)),
    g: Math.round(255 * (1 - mn) * (1 - kn)),
    b: Math.round(255 * (1 - yn) * (1 - kn)),
  };
}

function parseNumbers(text) {
  const inside = text.includes('(') ? text.slice(text.indexOf('(') + 1).replace(')', '') : text;
  return inside
    .replace(/[a-zA-Z%]/g, ' ')
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map((x) => Number(x));
}

function toFieldValues(rgb) {
  const hsl = rgbToHsl(rgb);
  const hwb = rgbToHwb(rgb);
  const lch = rgbToLch(rgb);
  const cmyk = rgbToCmyk(rgb);
  return {
    hex: rgbToHex(rgb),
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hsl: `hsl(${round(hsl.h, 2)}, ${round(hsl.s, 2)}%, ${round(hsl.l, 2)}%)`,
    hwb: `hwb(${round(hwb.h, 2)} ${round(hwb.w, 2)}% ${round(hwb.b, 2)}%)`,
    lch: `lch(${round(lch.l, 2)}% ${round(lch.c, 2)} ${round(lch.h, 2)})`,
    cmyk: `device-cmyk(${round(cmyk.c, 2)}% ${round(cmyk.m, 2)}% ${round(cmyk.y, 2)}% ${round(cmyk.k, 2)}%)`,
  };
}

function getContrastColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000';
  const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return lum < 128 ? '#fff' : '#000';
}

const DEFAULT_RGB = { r: 22, g: 119, b: 255 };

export default function RgbHexTool() {
  const [rgb, setRgb] = useState(DEFAULT_RGB);
  const [fields, setFields] = useState(() => toFieldValues(DEFAULT_RGB));
  const [copiedKey, setCopiedKey] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState('');
  const copyTimerRef = useRef(null);

  const previewHex = useMemo(() => rgbToHex(rgb), [rgb]);
  const textColor = useMemo(() => getContrastColor(previewHex), [previewHex]);

  const syncFromRgb = (nextRgb) => {
    const safe = {
      r: clamp(Math.round(nextRgb.r), 0, 255),
      g: clamp(Math.round(nextRgb.g), 0, 255),
      b: clamp(Math.round(nextRgb.b), 0, 255),
    };
    setRgb(safe);
    setFields(toFieldValues(safe));
  };

  // Called only on blur/Enter — parse then sync. Invalid input silently reverts to last valid value.
  const handleByHex = (value) => {
    const parsed = hexToRgb(value);
    if (parsed) syncFromRgb(parsed);
  };

  const handleByRgb = (value) => {
    const nums = parseNumbers(value);
    if (nums.length !== 3) return;
    const [r, g, b] = nums;
    if ([r, g, b].some((x) => Number.isNaN(x) || x < 0 || x > 255)) return;
    syncFromRgb({ r, g, b });
  };

  const handleByHsl = (value) => {
    const nums = parseNumbers(value);
    if (nums.length !== 3) return;
    const [h, s, l] = nums;
    if ([h, s, l].some((x) => Number.isNaN(x)) || s < 0 || s > 100 || l < 0 || l > 100) return;
    syncFromRgb(hslToRgb({ h, s, l }));
  };

  const handleByHwb = (value) => {
    const nums = parseNumbers(value);
    if (nums.length !== 3) return;
    const [h, w, b] = nums;
    if ([h, w, b].some((x) => Number.isNaN(x)) || w < 0 || w > 100 || b < 0 || b > 100) return;
    syncFromRgb(hwbToRgb({ h, w, b }));
  };

  const handleByLch = (value) => {
    const nums = parseNumbers(value);
    if (nums.length !== 3) return;
    const [l, c, h] = nums;
    if ([l, c, h].some((x) => Number.isNaN(x)) || l < 0 || l > 100 || c < 0) return;
    syncFromRgb(lchToRgb({ l, c, h }));
  };

  const handleByCmyk = (value) => {
    const nums = parseNumbers(value);
    if (nums.length !== 4) return;
    const [c, m, y, k] = nums;
    if ([c, m, y, k].some((x) => Number.isNaN(x) || x < 0 || x > 100)) return;
    syncFromRgb(cmykToRgb({ c, m, y, k }));
  };

  const copyValue = (key, value) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const commitDraft = (onChange) => {
    onChange(draft);
    setEditingKey(null);
  };

  const rows = [
    { key: 'hex', label: 'HEX', value: fields.hex, onChange: handleByHex },
    { key: 'rgb', label: 'RGB', value: fields.rgb, onChange: handleByRgb },
    { key: 'hsl', label: 'HSL', value: fields.hsl, onChange: handleByHsl },
    { key: 'hwb', label: 'HWB', value: fields.hwb, onChange: handleByHwb },
    { key: 'lch', label: 'LCH', value: fields.lch, onChange: handleByLch },
    { key: 'cmyk', label: 'CMYK', value: fields.cmyk, onChange: handleByCmyk },
  ];

  return (
    <Form
      layout="horizontal"
      colon={false}
      labelCol={{ style: { width: 96, textAlign: 'right', paddingRight: 0 } }}
      wrapperCol={{ style: { flex: 1 } }}
      style={{ maxWidth: '100%' }}
    >
      <Form.Item label="颜色选择" style={{ marginBottom: 8 }}>
        <ColorPicker
          value={previewHex}
          onChange={(color) => syncFromRgb(hexToRgb(color.toHexString()) || DEFAULT_RGB)}
          disabledAlpha
          style={{ width: '100%', display: 'block' }}
        >
          <div className="color-tool-picker" style={{ background: previewHex, color: textColor }}>
            {previewHex}
          </div>
        </ColorPicker>
      </Form.Item>

      {rows.map(({ key, label, value, onChange }) => (
        <Form.Item key={key} label={label} style={{ marginBottom: 8 }}>
          <Input
            value={editingKey === key ? draft : value}
            onFocus={() => { setEditingKey(key); setDraft(value); }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitDraft(onChange)}
            onPressEnter={() => commitDraft(onChange)}
            suffix={
              <Button
                type="text"
                size="small"
                icon={
                  copiedKey === key
                    ? <CheckOutlined style={{ color: '#52c41a' }} />
                    : <CopyOutlined />
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => copyValue(key, editingKey === key ? draft : value)}
              />
            }
          />
        </Form.Item>
      ))}
    </Form>
  );
}
