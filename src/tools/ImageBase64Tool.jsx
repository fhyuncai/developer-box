import { useRef, useState } from 'react';
import { Button, Flex, Image, Input, Space, Typography, Upload } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';

const { TextArea } = Input;

export default function ImageBase64Tool() {
  const [base64, setBase64] = useState('');
  const [previewSrc, setPreviewSrc] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  const handleFile = (file) => {
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      setBase64(result);
      setPreviewSrc(result);
      const sizeKB = (file.size / 1024).toFixed(1);
      setInfo(`${file.name} · ${file.type} · ${sizeKB} KB`);
    };
    reader.onerror = () => setError('文件读取失败');
    reader.readAsDataURL(file);
    return false;
  };

  const handleBase64Input = (val) => {
    setBase64(val);
    setError('');
    const src = val.trim().startsWith('data:') ? val.trim() : `data:image/png;base64,${val.trim()}`;
    setPreviewSrc(src);
    setInfo('');
  };

  const saveImage = () => {
    if (!previewSrc) return;
    const match = previewSrc.match(/^data:(image\/[\w+]+);base64,/);
    const ext = match ? match[1].split('/')[1].split('+')[0] : 'png';
    const a = document.createElement('a');
    a.href = previewSrc;
    a.download = `image.${ext}`;
    a.click();
  };

  const clear = () => { setBase64(''); setPreviewSrc(''); setInfo(''); setError(''); };

  return (
    <Flex vertical gap={12}>
      <Flex gap={8} align="center">
        <Upload accept="image/*" showUploadList={false} beforeUpload={handleFile}>
          <Button icon={<UploadOutlined />}>选择图片</Button>
        </Upload>
        <Button danger onClick={clear}>清空</Button>
        {info && <Typography.Text type="secondary">{info}</Typography.Text>}
      </Flex>
      <TextArea
        rows={6}
        value={base64}
        onChange={(e) => handleBase64Input(e.target.value)}
        placeholder="Base64 字符串（或上传图片后自动生成）"
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      />
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      {previewSrc && (
        <Flex vertical align="center" gap={8}>
          <Image
            src={previewSrc}
            alt="预览"
            style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, objectFit: 'contain' }}
            onError={() => setError('无法预览：Base64 内容无效或不是图片格式')}
            preview={{ mask: '点击预览' }}
          />
          <Button icon={<DownloadOutlined />} onClick={saveImage}>保存图片</Button>
        </Flex>
      )}
    </Flex>
  );
}
