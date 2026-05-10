import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');

function resolveWindowsCommand(commandName) {
  try {
    const output = execFileSync('where.exe', [commandName], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });

    return output
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean);
  } catch {
    return undefined;
  }
}

function resolveBundledNodeGyp(pnpmShimPath) {
  if (!pnpmShimPath) {
    return undefined;
  }

  const pnpmHome = path.dirname(pnpmShimPath);
  const nodeGypPath = path.join(
    pnpmHome,
    'node_modules',
    'pnpm',
    'dist',
    'node_modules',
    'node-gyp',
    'bin',
    'node-gyp.js'
  );

  return existsSync(nodeGypPath) ? nodeGypPath : undefined;
}

const env = { ...process.env };

if (process.platform === 'win32') {
  const pnpmShimPath = resolveWindowsCommand('pnpm.cmd');
  const bundledNodeGypPath = resolveBundledNodeGyp(pnpmShimPath);

  if (pnpmShimPath) {
    env.npm_execpath = pnpmShimPath;
  }

  if (bundledNodeGypPath) {
    env.npm_config_node_gyp = bundledNodeGypPath;
  }
}

const child = spawn(process.execPath, [electronBuilderCli, ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
  windowsHide: false,
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});