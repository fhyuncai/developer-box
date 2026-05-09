const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const axios = require('axios');
const { app } = require('electron');

const UPDATE_URL = 'http://developer-box-update.sakiko.cn/release/update.json';
const UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000;
const TEMP_ROOT_NAME = 'developer-box-update';

function normalizeVersionTag(version) {
  if (!version) return 'v0.0.0';
  return version.startsWith('v') ? version : `v${version}`;
}

function versionToCode(version) {
  const normalized = normalizeVersionTag(version);
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(normalized);
  if (!match) return 0;
  const [, major, minor, patch] = match;
  return Number(major) * 10000 + Number(minor) * 100 + Number(patch);
}

function sanitizeName(value, fallback = 'update') {
  const sanitized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || fallback;
}

function getCurrentVersionInfo() {
  const currentVersion = normalizeVersionTag(app.getVersion());
  return {
    currentVersion,
    currentVersionCode: versionToCode(currentVersion),
  };
}

function isAutoUpdatePlatformSupported() {
  return process.platform === 'win32' || (process.platform === 'darwin' && process.arch === 'arm64');
}

function resolveDownloadUrl(download = {}) {
  if (process.platform === 'win32') {
    return typeof download.windows === 'string' ? download.windows : '';
  }

  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return typeof download.macArm64 === 'string' ? download.macArm64 : '';
  }

  return '';
}

function getStateSnapshot(state) {
  return {
    ...state,
    canAutoApply: app.isPackaged && isAutoUpdatePlatformSupported(),
  };
}

function createUpdater({ onStateChange } = {}) {
  const listeners = typeof onStateChange === 'function' ? [onStateChange] : [];
  const currentVersionInfo = getCurrentVersionInfo();

  let state = {
    updateUrl: UPDATE_URL,
    currentVersion: currentVersionInfo.currentVersion,
    currentVersionCode: currentVersionInfo.currentVersionCode,
    latestVersion: '',
    latestVersionCode: 0,
    notes: '',
    hasUpdate: false,
    checking: false,
    downloading: false,
    applying: false,
    progress: 0,
    lastCheckedAt: 0,
    lastError: '',
    downloadUrl: '',
  };

  let activeCheckPromise = null;
  let intervalId = null;

  const emitState = () => {
    const snapshot = getStateSnapshot(state);
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('Failed to notify update state listener', error);
      }
    }
    return snapshot;
  };

  const setState = (patch) => {
    state = { ...state, ...patch };
    return emitState();
  };

  const getState = () => getStateSnapshot(state);

  async function fetchUpdateManifest() {
    const response = await axios.get(UPDATE_URL, {
      timeout: 20000,
      responseType: 'json',
      headers: {
        Accept: 'application/json',
      },
    });

    const payload = response.data;
    if (!payload || typeof payload !== 'object') {
      throw new Error('更新配置格式无效。');
    }

    const latestVersion = normalizeVersionTag(payload.version);
    const latestVersionCode = Number.isFinite(Number(payload.versionCode))
      ? Number(payload.versionCode)
      : versionToCode(latestVersion);

    if (!latestVersion || latestVersionCode <= 0) {
      throw new Error('更新配置缺少有效的版本信息。');
    }

    return {
      latestVersion,
      latestVersionCode,
      notes: typeof payload.notes === 'string' ? payload.notes.trim() : '',
      downloadUrl: resolveDownloadUrl(payload.download),
    };
  }

  async function checkForUpdates({ reason = 'manual', silent = false } = {}) {
    if (activeCheckPromise) {
      return activeCheckPromise;
    }

    setState({ checking: true, lastError: silent ? state.lastError : '' });

    activeCheckPromise = (async () => {
      try {
        const manifest = await fetchUpdateManifest();
        const hasNewerVersion = manifest.latestVersionCode > state.currentVersionCode;
        const hasMatchingPackage = !!manifest.downloadUrl;
        const hasUpdate = hasNewerVersion && hasMatchingPackage;
        const lastError = hasNewerVersion && !hasMatchingPackage
          ? '当前系统暂无对应的更新包。'
          : '';

        const snapshot = setState({
          checking: false,
          latestVersion: manifest.latestVersion,
          latestVersionCode: manifest.latestVersionCode,
          notes: manifest.notes,
          hasUpdate,
          lastCheckedAt: Date.now(),
          lastError,
          downloadUrl: hasUpdate ? manifest.downloadUrl : '',
          progress: hasUpdate ? state.progress : 0,
        });

        if (hasUpdate) {
          return { status: 'update-available', reason, state: snapshot };
        }

        if (hasNewerVersion) {
          return { status: 'not-supported', reason, state: snapshot, error: lastError };
        }

        return { status: 'up-to-date', reason, state: snapshot };
      } catch (error) {
        const message = error?.message || '检查更新失败。';
        const snapshot = setState({
          checking: false,
          lastCheckedAt: Date.now(),
          lastError: message,
        });

        if (silent) {
          return { status: 'error', reason, state: snapshot, error: message };
        }

        throw error;
      } finally {
        activeCheckPromise = null;
      }
    })();

    return activeCheckPromise;
  }

  function startPeriodicChecks() {
    if (intervalId) return;
    intervalId = setInterval(() => {
      checkForUpdates({ reason: 'interval', silent: true }).catch(() => {});
    }, UPDATE_INTERVAL_MS);
  }

  async function ensureWritable(targetPath) {
    const targetDir = path.dirname(targetPath);
    await fsp.mkdir(targetDir, { recursive: true });
    await fsp.access(targetDir, fs.constants.W_OK);
  }

  function buildTempPaths(version, downloadUrl) {
    const parsedUrl = new URL(downloadUrl);
    const fileName = sanitizeName(
      path.basename(parsedUrl.pathname),
      process.platform === 'win32' ? 'DeveloperBox.exe' : 'DeveloperBox.zip'
    );
    const versionDir = sanitizeName(version, 'latest');
    const tempDir = path.join(os.tmpdir(), TEMP_ROOT_NAME, versionDir);
    return {
      tempDir,
      downloadPath: path.join(tempDir, fileName),
    };
  }

  async function downloadUpdate(downloadUrl, targetPath) {
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    const partialPath = `${targetPath}.download`;
    await fsp.rm(partialPath, { force: true });

    const response = await axios.get(downloadUrl, {
      timeout: 60000,
      responseType: 'stream',
      maxRedirects: 5,
    });

    const totalBytes = Number(response.headers['content-length'] || 0);
    let downloadedBytes = 0;

    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      setState({
        progress: totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0,
      });
    });

    await pipeline(response.data, fs.createWriteStream(partialPath));
    await fsp.rename(partialPath, targetPath);
  }

  async function createWindowsInstallScript(downloadPath) {
    const currentExePath = app.getPath('exe');
    await ensureWritable(currentExePath);

    const scriptPath = path.join(path.dirname(downloadPath), 'apply-update.cmd');
    const scriptLines = [
      '@echo off',
      'setlocal',
      ':waitloop',
      `tasklist /FI "PID eq ${process.pid}" 2>nul | find "${process.pid}" >nul`,
      'if not errorlevel 1 (',
      '  timeout /t 1 /nobreak >nul',
      '  goto waitloop',
      ')',
      ':copyloop',
      `copy /Y "${downloadPath}" "${currentExePath}" >nul`,
      'if errorlevel 1 (',
      '  timeout /t 1 /nobreak >nul',
      '  goto copyloop',
      ')',
      `start "" "${currentExePath}"`,
      `del /Q "${downloadPath}" >nul 2>&1`,
      'del /Q "%~f0" >nul 2>&1',
      'exit /b 0',
      '',
    ];
    await fsp.writeFile(scriptPath, scriptLines.join('\r\n'), 'utf8');

    const child = spawn('cmd.exe', ['/d', '/c', scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  }

  async function createMacInstallScript(downloadPath) {
    const executablePath = app.getPath('exe');
    const targetAppPath = path.resolve(executablePath, '..', '..', '..');
    if (!targetAppPath.endsWith('.app')) {
      throw new Error('无法定位当前应用包，暂不支持自动更新。');
    }

    await ensureWritable(targetAppPath);

    const extractDir = path.join(path.dirname(downloadPath), 'extracted');
    const scriptPath = path.join(path.dirname(downloadPath), 'apply-update.sh');
    const appName = path.basename(targetAppPath);
    const scriptLines = [
      '#!/bin/sh',
      'set -eu',
      '',
      `PARENT_PID="${process.pid}"`,
      `ZIP_FILE="${downloadPath}"`,
      `EXTRACT_DIR="${extractDir}"`,
      `TARGET_APP="${targetAppPath}"`,
      `APP_NAME="${appName}"`,
      '',
      'while kill -0 "$PARENT_PID" 2>/dev/null; do',
      '  sleep 1',
      'done',
      '',
      'rm -rf "$EXTRACT_DIR"',
      'mkdir -p "$EXTRACT_DIR"',
      '/usr/bin/ditto -x -k "$ZIP_FILE" "$EXTRACT_DIR"',
      '',
      'SOURCE_APP="$EXTRACT_DIR/$APP_NAME"',
      'if [ ! -d "$SOURCE_APP" ]; then',
      '  SOURCE_APP="$(/usr/bin/find "$EXTRACT_DIR" -maxdepth 2 -name "*.app" -print -quit)"',
      'fi',
      '',
      'if [ -z "$SOURCE_APP" ] || [ ! -d "$SOURCE_APP" ]; then',
      '  exit 1',
      'fi',
      '',
      'BACKUP_APP="$TARGET_APP.old"',
      'rm -rf "$BACKUP_APP"',
      'if [ -d "$TARGET_APP" ]; then',
      '  mv "$TARGET_APP" "$BACKUP_APP"',
      'fi',
      '',
      '/usr/bin/ditto "$SOURCE_APP" "$TARGET_APP"',
      'rm -rf "$BACKUP_APP"',
      '/usr/bin/xattr -dr com.apple.quarantine "$TARGET_APP" >/dev/null 2>&1 || true',
      'open "$TARGET_APP"',
      'rm -rf "$EXTRACT_DIR"',
      'rm -f "$ZIP_FILE"',
      'rm -f "$0"',
      '',
    ];

    await fsp.writeFile(scriptPath, scriptLines.join('\n'), { encoding: 'utf8', mode: 0o755 });

    const child = spawn('/bin/sh', [scriptPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  }

  async function scheduleInstall(downloadPath) {
    if (process.platform === 'win32') {
      await createWindowsInstallScript(downloadPath);
      return;
    }

    if (process.platform === 'darwin' && process.arch === 'arm64') {
      await createMacInstallScript(downloadPath);
      return;
    }

    throw new Error('当前系统暂不支持自动更新。');
  }

  async function startUpdate() {
    if (!state.hasUpdate || !state.downloadUrl) {
      throw new Error('当前没有可用更新。');
    }

    if (state.downloading || state.applying) {
      return { status: state.applying ? 'applying' : 'downloading', state: getState() };
    }

    if (!app.isPackaged) {
      throw new Error('开发环境不支持自动安装更新，请使用构建后的应用测试。');
    }

    if (!isAutoUpdatePlatformSupported()) {
      throw new Error('当前系统暂不支持自动安装更新。');
    }

    const { tempDir, downloadPath } = buildTempPaths(state.latestVersion || 'latest', state.downloadUrl);

    try {
      await fsp.rm(tempDir, { recursive: true, force: true });
      await fsp.mkdir(tempDir, { recursive: true });

      setState({
        downloading: true,
        applying: false,
        progress: 0,
        lastError: '',
      });

      await downloadUpdate(state.downloadUrl, downloadPath);

      setState({
        downloading: false,
        applying: true,
        progress: 100,
      });

      await scheduleInstall(downloadPath);
      setImmediate(() => app.quit());
      return { status: 'applying', state: getState() };
    } catch (error) {
      setState({
        downloading: false,
        applying: false,
        progress: 0,
        lastError: error?.message || '更新失败。',
      });
      throw error;
    }
  }

  return {
    getState,
    checkForUpdates,
    startPeriodicChecks,
    startUpdate,
  };
}

module.exports = {
  UPDATE_INTERVAL_MS,
  UPDATE_URL,
  createUpdater,
  normalizeVersionTag,
  versionToCode,
};