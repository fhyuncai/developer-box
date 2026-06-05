const fs = require('fs/promises');
const path = require('path');
const { safeStorage } = require('electron');

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function isSecureStorageAvailable() {
  return !!safeStorage?.isEncryptionAvailable?.();
}

function assertSecureStorageAvailable() {
  if (!isSecureStorageAvailable()) {
    throw new Error('当前系统安全存储不可用，无法保存敏感配置。');
  }
}

async function readStoreFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStoreFile(filePath, store) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

async function readSecureNamespace(filePath, namespace, fallback = {}) {
  if (!isSecureStorageAvailable()) {
    return cloneValue(fallback);
  }
  const store = await readStoreFile(filePath);
  const encoded = store?.[namespace];

  if (!encoded) {
    return cloneValue(fallback);
  }

  try {
    const decrypted = safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    const parsed = JSON.parse(decrypted);
    return {
      ...cloneValue(fallback),
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    };
  } catch {
    throw new Error('读取安全配置失败，请重新保存相关凭证。');
  }
}

async function writeSecureNamespace(filePath, namespace, value) {
  assertSecureStorageAvailable();
  const store = await readStoreFile(filePath);
  const encrypted = safeStorage.encryptString(JSON.stringify(value || {}));
  store[namespace] = encrypted.toString('base64');
  await writeStoreFile(filePath, store);
  return value;
}

function maskSecret(value, visible = 4) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= visible) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(2, text.length - visible))}${text.slice(-visible)}`;
}

module.exports = {
  isSecureStorageAvailable,
  readSecureNamespace,
  writeSecureNamespace,
  maskSecret,
};
