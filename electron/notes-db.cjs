const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let db = null;
let databaseFilePath = '';
let notesRootDir = '';
let imagesRootDir = '';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function ensureReady() {
  if (!db) {
    throw new Error('Notes database has not been initialized');
  }
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

  return databaseFilePath;
}

function getDatabaseFilePath() {
  return databaseFilePath;
}

function listNotes() {
  ensureReady();
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

  db.prepare('DELETE FROM notes WHERE id = ?').run(normalizedId);
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
