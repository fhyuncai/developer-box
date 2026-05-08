import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  const positionals = [];

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options, positionals };
}

function parseReleaseTag(rawTag) {
  if (!rawTag) {
    throw new Error('Missing release tag.');
  }

  const tag = rawTag.startsWith('v') ? rawTag : `v${rawTag}`;
  const match = /^v(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/.exec(tag);
  if (!match) {
    throw new Error(`Unsupported release tag format: ${rawTag}`);
  }

  const [, major, minor, patch] = match;
  const version = `${major}.${minor}.${patch}`;
  const versionCode = Number(major) * 10000 + Number(minor) * 100 + Number(patch);

  return { tag, version, versionCode };
}

async function syncVersionFiles(tag, versionFilePath, packageFilePath) {
  const { tag: normalizedTag, version, versionCode } = parseReleaseTag(tag);

  const versionFile = await fs.readFile(versionFilePath, 'utf8');
  if (!/export const VERSION = '.*?';/.test(versionFile) || !/export const VERSION_CODE = \d+;/.test(versionFile)) {
    throw new Error(`Unable to locate version constants in: ${versionFilePath}`);
  }

  const nextVersionFile = versionFile
    .replace(/export const VERSION = '.*?';/, `export const VERSION = '${normalizedTag}';`)
    .replace(/export const VERSION_CODE = \d+;/, `export const VERSION_CODE = ${versionCode};`);

  const packageJson = JSON.parse(await fs.readFile(packageFilePath, 'utf8'));
  packageJson.version = version;

  await fs.writeFile(versionFilePath, nextVersionFile);
  await fs.writeFile(packageFilePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

async function writeUpdateJson(tag, notes, outputPath) {
  const { tag: normalizedTag, versionCode } = parseReleaseTag(tag);
  const payload = {
    version: normalizedTag,
    versionCode,
    notes: notes ?? '',
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function readReleaseNotes(eventFilePath) {
  if (!eventFilePath) {
    return '';
  }

  const payload = JSON.parse(await fs.readFile(eventFilePath, 'utf8'));
  return payload?.release?.body ?? '';
}

async function collectArtifacts(sourceDir, outputDir) {
  const allowedExtensions = new Set(['.zip', '.exe']);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  await fs.mkdir(outputDir, { recursive: true });

  let copiedCount = 0;

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (!allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(outputDir, entry.name);
    await fs.copyFile(sourcePath, destinationPath);
    copiedCount += 1;
  }

  if (copiedCount === 0) {
    throw new Error(`No release artifacts (.zip/.exe) found in ${sourceDir}`);
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'sync-version': {
      await syncVersionFiles(
        options.tag,
        options['version-file'] ?? 'src/version.ts',
        options['package-file'] ?? 'package.json',
      );
      break;
    }
    case 'write-update-json': {
      const notes = options['event-file']
        ? await readReleaseNotes(options['event-file'])
        : (options.notes ?? '');
      await writeUpdateJson(options.tag, notes, options.output ?? 'update.json');
      break;
    }
    case 'collect-artifacts': {
      await collectArtifacts(options.source ?? 'release', options.output ?? 'release-assets');
      break;
    }
    default:
      throw new Error(`Unsupported command: ${command ?? '<empty>'}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
