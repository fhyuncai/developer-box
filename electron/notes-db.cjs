const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let db = null;
let storageMode = '';
let databaseFilePath = '';
let notesRootDir = '';
let imagesRootDir = '';
let notesIndexFilePath = '';
let notesIndex = [];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function ensureReady() {
  if (!storageMode) {
    throw new Error('Notes database has not been initialized');
  }
}

function toIsoDate(value, fallback = nowIso()) {
  const date = value ? new Date(value) : null;
  return Number.isNaN(date?.getTime?.()) ? fallback : date.toISOString();
}

function sortNotes(list) {
  return [...list].sort((left, right) => {
    const updatedDiff = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    if (updatedDiff !== 0) return updatedDiff;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function normalizeMetadataEntry(entry = {}, fallback = {}) {
  const id = String(entry.id || fallback.id || '').trim();
  const filename = String(entry.filename || fallback.filename || `${id}.md`).trim();
  const title = normalizeTitle(entry.title ?? fallback.title, fallback.content || '');
  const summary = buildSummary(entry.summary ? String(entry.summary) : (fallback.content || ''));
  const createdAt = toIsoDate(entry.createdAt || fallback.createdAt);
  const updatedAt = toIsoDate(entry.updatedAt || fallback.updatedAt || createdAt, createdAt);

  return {
    id,
    title,
    filename,
    summary,
    createdAt,
    updatedAt,
  };
}

function getNoteMetadataFromFiles() {
  ensureDir(notesRootDir);

  return fs.readdirSync(notesRootDir)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => {
      const noteId = path.basename(fileName, '.md');
      const notePath = path.join(notesRootDir, fileName);
      const content = fs.readFileSync(notePath, 'utf8');
      const stats = fs.statSync(notePath);

      return normalizeMetadataEntry({}, {
        id: noteId,
        filename: fileName,
        content,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      });
    });
}

function persistNotesIndex() {
  writeJson(notesIndexFilePath, { notes: sortNotes(notesIndex) });
}

function initializeJsonNotesStore(dataDir) {
  notesIndexFilePath = path.join(dataDir, 'notes.json');
  const stored = readJson(notesIndexFilePath, { notes: [] });
  const storedMap = new Map(
    Array.isArray(stored?.notes)
      ? stored.notes
          .map((entry) => normalizeMetadataEntry(entry))
          .filter((entry) => entry.id)
          .map((entry) => [entry.id, entry])
      : []
  );

  notesIndex = getNoteMetadataFromFiles().map((entry) => {
    const storedEntry = storedMap.get(entry.id);
    if (!storedEntry) return entry;

    return normalizeMetadataEntry(
      {
        ...entry,
        title: storedEntry.title || entry.title,
        createdAt: storedEntry.createdAt || entry.createdAt,
        updatedAt: entry.updatedAt,
      },
      { content: '' }
    );
  });

  storageMode = 'json';
  databaseFilePath = notesIndexFilePath;
  db = null;
  persistNotesIndex();
  return databaseFilePath;
}

function findJsonNote(noteId) {
  return notesIndex.find((entry) => entry.id === String(noteId || '').trim()) || null;
}

function loadBetterSqlite3() {
  return require('better-sqlite3');
}

function getNoteFilePath(noteId) {
  return path.join(notesRootDir, `${noteId}.md`);
}

function normalizeTitle(rawTitle, rawContent = '') {
  const title = String(rawTitle || '').trim();
  if (title) return title.slice(0, 120);
  const lines = String(rawContent || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-#>*\s\[\]0-9.]+/, '').trim())
    .filter(Boolean);
  return (lines[0] || '无标题笔记').slice(0, 120);
}

function buildSummary(rawContent = '') {
  return String(rawContent || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, ' 图片 ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function initializeNotesDatabase(dataDir) {
  ensureDir(dataDir);
  notesRootDir = path.join(dataDir, 'notes');
  imagesRootDir = path.join(dataDir, 'note_images');
  ensureDir(notesRootDir);
  ensureDir(imagesRootDir);

  databaseFilePath = path.join(dataDir, 'notes.sqlite');
  notesIndexFilePath = path.join(dataDir, 'notes.json');

  try {
    const Database = loadBetterSqlite3();
    db = new Database(databaseFilePath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        filename TEXT NOT NULL UNIQUE,
        summary TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    storageMode = 'sqlite';
    return databaseFilePath;
  } catch (error) {
    db = null;
    storageMode = '';
    return initializeJsonNotesStore(dataDir);
  }
}

function getDatabaseFilePath() {
  return databaseFilePath;
}

function listNotes() {
  ensureReady();
  if (storageMode === 'json') {
    return sortNotes(notesIndex).map(({ id, title, filename, summary, createdAt, updatedAt }) => ({
      id,
      title,
      filename,
      summary,
      createdAt,
      updatedAt,
    }));
  }

  return db
    .prepare(`
      SELECT id, title, filename, summary,
             created_at AS createdAt,
             updated_at AS updatedAt
      FROM notes
      ORDER BY datetime(updated_at) DESC, created_at DESC
    `)
    .all();
}

function getNote(noteId) {
  ensureReady();
  if (storageMode === 'json') {
    const row = findJsonNote(noteId);
    if (!row) return null;

    let content = '';
    try {
      content = fs.readFileSync(getNoteFilePath(row.id), 'utf8');
    } catch {
      content = '';
    }

    return {
      ...row,
      content,
      imageDir: `note_images/${row.id}`,
    };
  }

  const row = db
    .prepare(`
      SELECT id, title, filename, summary,
             created_at AS createdAt,
             updated_at AS updatedAt
      FROM notes
      WHERE id = ?
    `)
    .get(String(noteId || ''));

  if (!row) return null;

  let content = '';
  try {
    content = fs.readFileSync(getNoteFilePath(row.id), 'utf8');
  } catch {
    content = '';
  }

  return {
    ...row,
    content,
    imageDir: `note_images/${row.id}`,
  };
}

function createNote(payload = {}) {
  ensureReady();
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const content = typeof payload.content === 'string' ? payload.content : '';
  const title = normalizeTitle(payload.title, content);
  const filename = `${id}.md`;
  const summary = buildSummary(content);

  fs.writeFileSync(getNoteFilePath(id), content, 'utf8');
  if (storageMode === 'json') {
    notesIndex.push({
      id,
      title,
      filename,
      summary,
      createdAt,
      updatedAt: createdAt,
    });
    persistNotesIndex();
    return getNote(id);
  }

  db.prepare(`
    INSERT INTO notes (id, title, filename, summary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, title, filename, summary, createdAt, createdAt);

  return getNote(id);
}

function updateNote(payload = {}) {
  ensureReady();
  const noteId = String(payload.id || '').trim();
  if (!noteId) {
    throw new Error('Missing note id');
  }

  const existing = getNote(noteId);
  if (!existing) {
    throw new Error('Note not found');
  }

  const content = typeof payload.content === 'string' ? payload.content : existing.content;
  const title = normalizeTitle(payload.title ?? existing.title, content);
  const updatedAt = nowIso();
  const summary = buildSummary(content);

  fs.writeFileSync(getNoteFilePath(noteId), content, 'utf8');
  if (storageMode === 'json') {
    notesIndex = notesIndex.map((entry) => (
      entry.id === noteId
        ? {
            ...entry,
            title,
            summary,
            updatedAt,
          }
        : entry
    ));
    persistNotesIndex();
    return getNote(noteId);
  }

  db.prepare(`
    UPDATE notes
    SET title = ?, summary = ?, updated_at = ?
    WHERE id = ?
  `).run(title, summary, updatedAt, noteId);

  return getNote(noteId);
}

function deleteNote(noteId) {
  ensureReady();
  const normalizedId = String(noteId || '').trim();
  if (!normalizedId) return false;

  if (storageMode === 'json') {
    notesIndex = notesIndex.filter((entry) => entry.id !== normalizedId);
    persistNotesIndex();
  } else {
    db.prepare('DELETE FROM notes WHERE id = ?').run(normalizedId);
  }
  try {
    fs.rmSync(getNoteFilePath(normalizedId), { force: true });
  } catch {}
  try {
    fs.rmSync(path.join(imagesRootDir, normalizedId), { recursive: true, force: true });
  } catch {}
  return true;
}

function duplicateNote(noteId) {
  ensureReady();
  const source = getNote(noteId);
  if (!source) {
    throw new Error('Note not found');
  }

  const newId = crypto.randomUUID();
  const createdAt = nowIso();
  const filename = `${newId}.md`;
  const sourceImageDir = path.join(imagesRootDir, source.id);
  const targetImageDir = path.join(imagesRootDir, newId);

  let content = String(source.content || '');
  if (fs.existsSync(sourceImageDir)) {
    ensureDir(targetImageDir);
    if (typeof fs.cpSync === 'function') {
      fs.cpSync(sourceImageDir, targetImageDir, { recursive: true });
    } else {
      for (const fileName of fs.readdirSync(sourceImageDir)) {
        fs.copyFileSync(path.join(sourceImageDir, fileName), path.join(targetImageDir, fileName));
      }
    }
    content = content.split(`note_images/${source.id}/`).join(`note_images/${newId}/`);
  }

  fs.writeFileSync(getNoteFilePath(newId), content, 'utf8');
  if (storageMode === 'json') {
    notesIndex.push({
      id: newId,
      title: source.title,
      filename,
      summary: buildSummary(content),
      createdAt,
      updatedAt: createdAt,
    });
    persistNotesIndex();
    return getNote(newId);
  }

  db.prepare(`
    INSERT INTO notes (id, title, filename, summary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(newId, source.title, filename, buildSummary(content), createdAt, createdAt);

  return getNote(newId);
}

function importNoteImage(noteId, sourcePath) {
  ensureReady();
  const normalizedId = String(noteId || '').trim();
  if (!normalizedId) {
    throw new Error('Missing note id');
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Image file not found');
  }

  const targetDir = path.join(imagesRootDir, normalizedId);
  ensureDir(targetDir);
  const ext = (path.extname(sourcePath) || '.png').toLowerCase();
  const fileName = `${crypto.randomUUID()}${ext}`;
  const targetPath = path.join(targetDir, fileName);
  fs.copyFileSync(sourcePath, targetPath);

  return {
    fileName,
    relativePath: `note_images/${normalizedId}/${fileName}`,
    absolutePath: targetPath,
  };
}

module.exports = {
  initializeNotesDatabase,
  getDatabaseFilePath,
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  duplicateNote,
  importNoteImage,
};
