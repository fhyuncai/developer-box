const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { app } = require('electron');

const UPDATE_URL = 'http://developer-box-update.sakiko.cn/release/update.json';
const UPDATE_INTERVAL_MS = 12 * 60 * 60 * 1000;
const TEMP_ROOT_NAME = 'developer-box-update';
const VERSION_SOURCE_PATH = path.join(__dirname, '..', 'src', 'version.ts');

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeoutId);
    },
  };
}

function getRequestErrorMessage(error, fallbackMessage) {
  if (error?.name === 'AbortError') {
    return fallbackMessage;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function getHttpErrorMessage(action, response) {
  const suffix = response.statusText ? ` ${response.statusText}` : '';
  return `${action}失败：${response.status}${suffix}`;
}

async function fetchJson(url, { timeout, headers } = {}) {
  const { signal, dispose } = createTimeoutSignal(timeout);

  try {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal,
    });

    if (!response.ok) {
      throw new Error(getHttpErrorMessage('请求更新配置', response));
    }

    return await response.json();
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, '请求更新配置超时'));
  } finally {
    dispose();
  }
}

async function downloadFile(url, targetPath, { timeout, onProgress } = {}) {
  const { signal, dispose } = createTimeoutSignal(timeout);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal,
    });

    if (!response.ok) {
      throw new Error(getHttpErrorMessage('下载更新包', response));
    }

    if (!response.body) {
      throw new Error('下载更新包失败：响应体为空');
    }

    const totalBytes = Number(response.headers.get('content-length') || 0);
    let downloadedBytes = 0;
    const readable = Readable.fromWeb(response.body);

    readable.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (typeof onProgress === 'function') {
        onProgress(downloadedBytes, totalBytes);
      }
    });

    await pipeline(readable, fs.createWriteStream(targetPath));
  } catch (error) {
    await fsp.rm(targetPath, { force: true }).catch(() => {});
    throw new Error(getRequestErrorMessage(error, '下载更新包超时'));
  } finally {
    dispose();
  }
}

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

function getWindowsInstallTargetPath() {
  if (process.platform !== 'win32') {
    return app.getPath('exe');
  }

  const portableExecutablePath = process.env.PORTABLE_EXECUTABLE_FILE;
  if (typeof portableExecutablePath === 'string' && portableExecutablePath.trim()) {
    return portableExecutablePath;
  }

  return app.getPath('exe');
}

function getWindowsPowerShellPath() {
  if (process.platform !== 'win32') {
    return '';
  }

  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const candidates = [
    path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.join(systemRoot, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'powershell.exe';
}

function toPowerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function isFileSystemRoot(targetPath) {
  const normalizedPath = path.resolve(targetPath);
  return normalizedPath === path.parse(normalizedPath).root;
}

async function spawnDetachedProcess(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      ...options,
    });

    let settled = false;

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    child.once('spawn', () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve();
    });
  });
}

function readVersionInfoFromSource() {
  try {
    const source = fs.readFileSync(VERSION_SOURCE_PATH, 'utf8');
    const versionMatch = /export const VERSION\s*=\s*['"]([^'"]+)['"]\s*;/.exec(source);
    const versionCodeMatch = /export const VERSION_CODE\s*=\s*(\d+)\s*;/.exec(source);

    if (!versionMatch || !versionCodeMatch) {
      throw new Error('版本常量不存在');
    }

    const currentVersion = normalizeVersionTag(versionMatch[1]);
    const currentVersionCode = Number(versionCodeMatch[1]);

    if (!currentVersion || currentVersionCode <= 0) {
      throw new Error('版本常量无效');
    }

    return {
      currentVersion,
      currentVersionCode,
    };
  } catch (error) {
    console.warn(`Failed to read version info from ${VERSION_SOURCE_PATH}`, error);
    return null;
  }
}

function getCurrentVersionInfo() {
  const sourceVersionInfo = readVersionInfoFromSource();
  if (sourceVersionInfo) {
    return sourceVersionInfo;
  }

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
    const payload = await fetchJson(UPDATE_URL, {
      timeout: 20000,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!payload || typeof payload !== 'object') {
      throw new Error('更新配置格式无效');
    }

    const latestVersion = normalizeVersionTag(payload.version);
    const latestVersionCode = Number.isFinite(Number(payload.versionCode))
      ? Number(payload.versionCode)
      : versionToCode(latestVersion);

    if (!latestVersion || latestVersionCode <= 0) {
      throw new Error('更新配置缺少有效的版本信息');
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
          ? '当前系统暂无对应的更新包'
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
        const message = error?.message || '检查更新失败';
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
    if (!isFileSystemRoot(targetDir)) {
      await fsp.mkdir(targetDir, { recursive: true });
    }
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

    await downloadFile(downloadUrl, partialPath, {
      timeout: 60000,
      onProgress: (downloadedBytes, totalBytes) => {
      setState({
        progress: totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0,
      });
      },
    });

    await fsp.rename(partialPath, targetPath);
  }

  async function createWindowsInstallScript(downloadPath) {
    const targetExePath = getWindowsInstallTargetPath();
    const powerShellPath = getWindowsPowerShellPath();
    await ensureWritable(targetExePath);

    const scriptPath = path.join(path.dirname(downloadPath), 'apply-update.ps1');
    const logPath = path.join(path.dirname(downloadPath), 'apply-update.log');
    const scriptLines = [
      "$ErrorActionPreference = 'Stop'",
      `$parentPid = ${process.pid}`,
      `$downloadPath = ${toPowerShellLiteral(downloadPath)}`,
      `$targetPath = ${toPowerShellLiteral(targetExePath)}`,
      `$stagedPath = ${toPowerShellLiteral(`${targetExePath}.new`)}`,
      `$backupPath = ${toPowerShellLiteral(`${targetExePath}.old`)}`,
      `$logPath = ${toPowerShellLiteral(logPath)}`,
      `$launcherPath = ${toPowerShellLiteral(powerShellPath)}`,
      '',
      'function Write-Log($message) {',
      '  $timestamp = Get-Date -Format o',
      '  Add-Content -LiteralPath $logPath -Value "$timestamp $message" -Encoding UTF8',
      '}',
      '',
      'function Test-FileUnlocked($filePath) {',
      '  if (-not (Test-Path -LiteralPath $filePath)) {',
      '    return $true',
      '  }',
      '',
      '  try {',
      "    $stream = [System.IO.File]::Open($filePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)",
      '    $stream.Close()',
      '    return $true',
      '  } catch {',
      '    return $false',
      '  }',
      '}',
      '',
      'function Wait-ForFileUnlock($filePath, $attempts, $delayMs) {',
      '  for ($attempt = 0; $attempt -lt $attempts; $attempt++) {',
      '    if (Test-FileUnlocked $filePath) {',
      '      return $true',
      '    }',
      '',
      '    Start-Sleep -Milliseconds $delayMs',
      '  }',
      '',
      '  return $false',
      '}',
      '',
      'Write-Log "apply update started"',
      'Write-Log "launcher: $launcherPath"',
      'Write-Log "download: $downloadPath"',
      'Write-Log "target: $targetPath"',
      '',
      'try {',
      '  $parentProcess = Get-Process -Id $parentPid -ErrorAction Stop',
      '  $parentProcess.WaitForExit()',
      '} catch [System.ArgumentException] {',
      '} catch {',
      '  Write-Log "wait parent exit failed: $($_.Exception.Message)"',
      '}',
      '',
      'try {',
      'Start-Sleep -Milliseconds 500',
      '$targetDir = Split-Path -Parent $targetPath',
      'if (-not (Test-Path -LiteralPath $targetDir)) {',
      '  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null',
      '}',
      '',
      'if (-not (Test-Path -LiteralPath $downloadPath)) {',
      '  throw "下载的更新包不存在: $downloadPath"',
      '}',
      '',
      'if (-not (Wait-ForFileUnlock $targetPath 90 1000)) {',
      '  throw "目标文件长时间被占用，无法替换: $targetPath"',
      '}',
      '',
      'Remove-Item -LiteralPath $stagedPath -Force -ErrorAction SilentlyContinue',
      'Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue',
      'Copy-Item -LiteralPath $downloadPath -Destination $stagedPath -Force',
      'Write-Log "staged update package"',
      '',
      '$updated = $false',
      'for ($attempt = 0; $attempt -lt 5 -and -not $updated; $attempt++) {',
      '  try {',
      '    if (Test-Path -LiteralPath $targetPath) {',
      '      Move-Item -LiteralPath $targetPath -Destination $backupPath -Force',
      '    }',
      '    Move-Item -LiteralPath $stagedPath -Destination $targetPath -Force',
      '    $updated = $true',
      '    Write-Log "replaced target executable"',
      '  } catch {',
      '    Write-Log "replace attempt failed: $($_.Exception.Message)"',
      '    if ((Test-Path -LiteralPath $backupPath) -and -not (Test-Path -LiteralPath $targetPath)) {',
      '      Move-Item -LiteralPath $backupPath -Destination $targetPath -Force -ErrorAction SilentlyContinue',
      '    }',
      '    Start-Sleep -Seconds 1',
      '  }',
      '}',
      '',
      'if (-not $updated) {',
      '  throw "替换目标文件失败: $targetPath"',
      '}',
      '',
      'Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue',
      'Remove-Item -LiteralPath $downloadPath -Force -ErrorAction SilentlyContinue',
      '$process = Start-Process -FilePath $targetPath -WorkingDirectory $targetDir -PassThru -ErrorAction Stop',
      'Write-Log "restarted application pid=$($process.Id)"',
      'Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue',
      '} catch {',
      '  Write-Log "apply update failed: $($_ | Out-String)"',
      '  exit 1',
      '}',
      '',
    ];
    await fsp.writeFile(scriptPath, scriptLines.join('\r\n'), 'utf8');

    return {
      execPath: powerShellPath,
      args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
    };
  }

  async function createMacInstallScript(downloadPath) {
    const executablePath = app.getPath('exe');
    const targetAppPath = path.resolve(executablePath, '..', '..', '..');
    if (!targetAppPath.endsWith('.app')) {
      throw new Error('无法定位当前应用包，暂不支持自动更新');
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

    await spawnDetachedProcess('/bin/sh', [scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
  }

  async function scheduleInstall(downloadPath) {
    if (process.platform === 'win32') {
      return createWindowsInstallScript(downloadPath);
    }

    if (process.platform === 'darwin' && process.arch === 'arm64') {
      await createMacInstallScript(downloadPath);
      return null;
    }

    throw new Error('当前系统暂不支持自动更新');
  }

  async function startUpdate() {
    if (!state.hasUpdate || !state.downloadUrl) {
      throw new Error('当前没有可用更新');
    }

    if (state.downloading || state.applying) {
      return { status: state.applying ? 'applying' : 'downloading', state: getState() };
    }

    if (!app.isPackaged) {
      throw new Error('开发环境不支持自动安装更新，请使用构建后的应用测试');
    }

    if (!isAutoUpdatePlatformSupported()) {
      throw new Error('当前系统暂不支持自动安装更新');
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

      const relaunchOptions = await scheduleInstall(downloadPath);
      if (relaunchOptions) {
        app.relaunch(relaunchOptions);
      }
      setImmediate(() => app.exit(0));
      return { status: 'applying', state: getState() };
    } catch (error) {
      setState({
        downloading: false,
        applying: false,
        progress: 0,
        lastError: error?.message || '更新失败',
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