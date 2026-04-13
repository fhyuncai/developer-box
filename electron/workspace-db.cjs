const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DB_FILE = 'workspace.sqlite';
const KEY_FILE = 'workspace.key';
const GLOBAL_COMMAND_ALLOWLIST_KEY = 'global_command_allowlist';

const BUILTIN_PROVIDERS = [
  {
    name: 'GitHub Copilot CLI',
    kind: 'cli',
    config: {
      builtinKey: 'github-copilot',
      binary: '',
      binaryCandidates: ['copilot', 'github-copilot', 'gh'],
      argsTemplate: ['{{prompt}}'],
      promptMode: 'stdin',
      env: {},
      notes: '',
      quotaCommand: '',
      proxyId: '',
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
    },
  },
  {
    name: 'Claude Code',
    kind: 'cli',
    config: {
      builtinKey: 'claude-code',
      binary: 'claude',
      binaryCandidates: ['claude'],
      argsTemplate: ['-p', '{{prompt}}'],
      promptMode: 'argv',
      env: {},
      notes: '',
      quotaCommand: '',
      proxyId: '',
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
    },
  },
  {
    name: 'Gemini CLI',
    kind: 'cli',
    config: {
      builtinKey: 'gemini-cli',
      binary: 'gemini',
      binaryCandidates: ['gemini'],
      argsTemplate: ['-p', '{{prompt}}'],
      promptMode: 'argv',
      env: {},
      notes: '',
      quotaCommand: '',
      proxyId: '',
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
    },
  },
];

let db;
let dbFilePath = '';
let encryptionKey;

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getState() {
  if (!db || !encryptionKey) {
    throw new Error('Workspace database has not been initialized.');
  }
  return { db, encryptionKey, dbFilePath };
}

function loadOrCreateKey(dataDir) {
  const keyPath = path.join(dataDir, KEY_FILE);
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath);
  }
  const nextKey = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, nextKey, { mode: 0o600 });
  return nextKey;
}

function encryptValue(value) {
  const { encryptionKey: key } = getState();
  if (value === null || value === undefined || value === '') return '';
  const plainText = typeof value === 'string' ? value : JSON.stringify(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptValue(value, fallback = null) {
  const { encryptionKey: key } = getState();
  if (!value) return fallback;
  try {
    const buffer = Buffer.from(value, 'base64');
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return decrypted;
  } catch {
    return fallback;
  }
}

function normalizeProviderRow(row) {
  if (!row) return null;
  const config = safeJsonParse(row.config_json, {});
  const secret = safeJsonParse(decryptValue(row.secret_json, '{}'), {});
  const quota = safeJsonParse(row.quota_json, {});
  const runtime = safeJsonParse(row.runtime_json, {});
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    enabled: !!row.enabled,
    config,
    secret,
    quota,
    runtime,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeProxyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    enabled: !!row.enabled,
    config: safeJsonParse(row.config_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildTaskSummaryRow(row) {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    workingDirectory: row.working_directory,
    status: row.status,
    summary: row.summary,
    inputText: row.input_text,
    errorText: row.error_text,
    orchestration: safeJsonParse(row.orchestration_json, {}),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
    agentCount: row.agent_count || 0,
    completedAgentCount: row.completed_agent_count || 0,
    failedAgentCount: row.failed_agent_count || 0,
  };
}

function ensureSchema() {
  const { db: database } = getState();
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL,
      secret_json TEXT,
      quota_json TEXT,
      runtime_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      working_directory TEXT,
      status TEXT NOT NULL,
      summary TEXT,
      input_text TEXT,
      error_text TEXT,
      orchestration_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_agents (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      role TEXT,
      status TEXT NOT NULL,
      input_text TEXT,
      output_text TEXT,
      error_text TEXT,
      depends_on_json TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      usage_json TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    );

    CREATE TABLE IF NOT EXISTS task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      agent_id TEXT,
      level TEXT NOT NULL,
      direction TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES task_agents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workspace_config (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function ensureBuiltinProviders() {
  const { db: database } = getState();
  const selectByBuiltin = database.prepare('SELECT id, config_json FROM providers');
  const rows = selectByBuiltin.all();
  const builtinMap = new Map();
  for (const row of rows) {
    const config = safeJsonParse(row.config_json, {});
    if (config.builtinKey) {
      builtinMap.set(config.builtinKey, row.id);
    }
  }
  for (const provider of BUILTIN_PROVIDERS) {
    if (!builtinMap.has(provider.config.builtinKey)) {
      saveProvider({
        name: provider.name,
        kind: provider.kind,
        enabled: true,
        config: provider.config,
        secret: {},
        quota: {
          spentUsd: 0,
          balanceUsd: null,
          remainingUsd: null,
          source: 'local',
          lastCheckedAt: null,
        },
        runtime: {},
      });
    }
  }
}

function initializeWorkspaceDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  dbFilePath = path.join(dataDir, DB_FILE);
  encryptionKey = loadOrCreateKey(dataDir);
  db = new Database(dbFilePath);
  ensureSchema();
  return dbFilePath;
}

function listProviders() {
  const { db: database } = getState();
  const usageRows = database.prepare(`
    SELECT provider_id,
           COUNT(*) AS execution_count,
           COALESCE(SUM(json_extract(usage_json, '$.estimatedCostUsd')), 0) AS spent_usd,
           COALESCE(SUM(json_extract(usage_json, '$.totalTokens')), 0) AS total_tokens
      FROM task_agents
     WHERE usage_json IS NOT NULL
     GROUP BY provider_id
  `).all();
  const usageMap = new Map(usageRows.map((row) => [row.provider_id, row]));
  return database.prepare('SELECT * FROM providers ORDER BY created_at ASC').all().map((row) => {
    const normalized = normalizeProviderRow(row);
    const usage = usageMap.get(row.id);
    return {
      ...normalized,
      stats: {
        executionCount: usage?.execution_count ?? 0,
        spentUsd: Number(usage?.spent_usd ?? normalized.quota?.spentUsd ?? 0),
        totalTokens: Number(usage?.total_tokens ?? 0),
      },
    };
  });
}

function getProviderById(providerId) {
  const { db: database } = getState();
  const row = database.prepare('SELECT * FROM providers WHERE id = ?').get(providerId);
  return normalizeProviderRow(row);
}

function saveProvider(payload) {
  const { db: database } = getState();
  const id = payload.id || crypto.randomUUID();
  const now = nowIso();
  const existing = database.prepare('SELECT created_at FROM providers WHERE id = ?').get(id);
  database.prepare(`
    INSERT INTO providers (id, name, kind, enabled, config_json, secret_json, quota_json, runtime_json, created_at, updated_at)
    VALUES (@id, @name, @kind, @enabled, @config_json, @secret_json, @quota_json, @runtime_json, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      kind = excluded.kind,
      enabled = excluded.enabled,
      config_json = excluded.config_json,
      secret_json = excluded.secret_json,
      quota_json = excluded.quota_json,
      runtime_json = excluded.runtime_json,
      updated_at = excluded.updated_at
  `).run({
    id,
    name: payload.name,
    kind: payload.kind,
    enabled: payload.enabled === false ? 0 : 1,
    config_json: JSON.stringify(payload.config || {}),
    secret_json: encryptValue(payload.secret || {}),
    quota_json: JSON.stringify(payload.quota || {}),
    runtime_json: JSON.stringify(payload.runtime || {}),
    created_at: existing?.created_at || now,
    updated_at: now,
  });
  return getProviderById(id);
}

function patchProvider(providerId, patch) {
  const current = getProviderById(providerId);
  if (!current) {
    throw new Error('Provider not found.');
  }
  return saveProvider({
    ...current,
    ...patch,
    config: patch.config ? { ...current.config, ...patch.config } : current.config,
    secret: patch.secret ? { ...current.secret, ...patch.secret } : current.secret,
    quota: patch.quota ? { ...current.quota, ...patch.quota } : current.quota,
    runtime: patch.runtime ? { ...current.runtime, ...patch.runtime } : current.runtime,
  });
}

function deleteProvider(providerId) {
  const { db: database } = getState();
  database.prepare('DELETE FROM providers WHERE id = ?').run(providerId);
}

function listProxies() {
  const { db: database } = getState();
  return database.prepare('SELECT * FROM proxies ORDER BY created_at ASC').all().map(normalizeProxyRow);
}

function getProxyById(proxyId) {
  const { db: database } = getState();
  const row = database.prepare('SELECT * FROM proxies WHERE id = ?').get(proxyId);
  return normalizeProxyRow(row);
}

function saveProxy(payload) {
  const { db: database } = getState();
  const id = payload.id || crypto.randomUUID();
  const now = nowIso();
  const existing = database.prepare('SELECT created_at FROM proxies WHERE id = ?').get(id);
  database.prepare(`
    INSERT INTO proxies (id, name, enabled, config_json, created_at, updated_at)
    VALUES (@id, @name, @enabled, @config_json, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      enabled = excluded.enabled,
      config_json = excluded.config_json,
      updated_at = excluded.updated_at
  `).run({
    id,
    name: payload.name,
    enabled: payload.enabled === false ? 0 : 1,
    config_json: JSON.stringify(payload.config || {}),
    created_at: existing?.created_at || now,
    updated_at: now,
  });

  if (payload?.config?.isGlobal === true) {
    const rows = database.prepare('SELECT id, config_json FROM proxies WHERE id <> ?').all(id);
    const updateConfig = database.prepare('UPDATE proxies SET config_json = ?, updated_at = ? WHERE id = ?');
    for (const row of rows) {
      const currentConfig = safeJsonParse(row.config_json, {});
      if (currentConfig.isGlobal === true) {
        currentConfig.isGlobal = false;
        updateConfig.run(JSON.stringify(currentConfig), nowIso(), row.id);
      }
    }
  }

  return getProxyById(id);
}

function deleteProxy(proxyId) {
  const { db: database } = getState();
  database.prepare('DELETE FROM proxies WHERE id = ?').run(proxyId);
}

function createTask(payload) {
  if (!payload?.workingDirectory || !String(payload.workingDirectory).trim()) {
    throw new Error('workingDirectory is required.');
  }
  const { db: database } = getState();
  const taskId = crypto.randomUUID();
  const now = nowIso();
  // 校验步骤中的 providerId 是否真实存在，避免 FOREIGN KEY 约束失败
  const validProviderIds = new Set(
    database.prepare('SELECT id FROM providers').all().map((r) => r.id)
  );
  const steps = (payload.steps || []).map((step) => ({
    ...step,
    providerId: validProviderIds.has(step.providerId) ? step.providerId : [...validProviderIds][0] || null,
  })).filter((step) => step.providerId != null);
  const stepIdMap = new Map(steps.map((_, index) => [index, crypto.randomUUID()]));
  const insertTask = database.prepare(`
    INSERT INTO tasks (id, title, goal, working_directory, status, summary, input_text, error_text, orchestration_json, created_at, updated_at)
    VALUES (@id, @title, @goal, @working_directory, @status, @summary, @input_text, @error_text, @orchestration_json, @created_at, @updated_at)
  `);
  const insertAgent = database.prepare(`
    INSERT INTO task_agents (id, task_id, name, provider_id, role, status, input_text, output_text, error_text, depends_on_json, settings_json, usage_json, created_at, updated_at)
    VALUES (@id, @task_id, @name, @provider_id, @role, @status, @input_text, @output_text, @error_text, @depends_on_json, @settings_json, @usage_json, @created_at, @updated_at)
  `);
  const tx = database.transaction(() => {
    insertTask.run({
      id: taskId,
      title: payload.title,
      goal: payload.goal,
      working_directory: payload.workingDirectory || '',
      status: 'queued',
      summary: payload.summary || '',
      input_text: payload.inputText || payload.goal,
      error_text: '',
      orchestration_json: JSON.stringify(payload.orchestration || {}),
      created_at: now,
      updated_at: now,
    });
    for (const [index, step] of steps.entries()) {
      insertAgent.run({
        id: stepIdMap.get(index),
        task_id: taskId,
        name: step.name,
        provider_id: step.providerId,
        role: step.role || '',
        status: 'pending',
        input_text: '',
        output_text: '',
        error_text: '',
        depends_on_json: JSON.stringify((step.dependsOn || []).map((dependencyIndex) => stepIdMap.get(dependencyIndex)).filter(Boolean)),
        settings_json: JSON.stringify({
          instructions: step.instructions || '',
          model: step.model || '',
          variables: step.variables || {},
        }),
        usage_json: null,
        created_at: now,
        updated_at: now,
      });
    }
  });
  tx();
  return getTaskDetail(taskId);
}

function listTasks(limit = 40) {
  const { db: database } = getState();
  return database.prepare(`
    SELECT t.*,
           (SELECT COUNT(*) FROM task_agents ta WHERE ta.task_id = t.id) AS agent_count,
           (SELECT COUNT(*) FROM task_agents ta WHERE ta.task_id = t.id AND ta.status = 'completed') AS completed_agent_count,
           (SELECT COUNT(*) FROM task_agents ta WHERE ta.task_id = t.id AND ta.status = 'failed') AS failed_agent_count
      FROM tasks t
     ORDER BY t.created_at DESC
     LIMIT ?
  `).all(limit).map(buildTaskSummaryRow);
}

function getTaskById(taskId) {
  const { db: database } = getState();
  const row = database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  return row ? buildTaskSummaryRow(row) : null;
}

function listTaskAgents(taskId) {
  const { db: database } = getState();
  return database.prepare('SELECT * FROM task_agents WHERE task_id = ? ORDER BY created_at ASC').all(taskId).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    providerId: row.provider_id,
    role: row.role,
    status: row.status,
    inputText: row.input_text,
    outputText: row.output_text,
    errorText: row.error_text,
    dependsOn: safeJsonParse(row.depends_on_json, []),
    settings: safeJsonParse(row.settings_json, {}),
    usage: safeJsonParse(row.usage_json, null),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
  }));
}

function listTaskLogs(taskId) {
  const { db: database } = getState();
  return database.prepare('SELECT * FROM task_logs WHERE task_id = ? ORDER BY id ASC').all(taskId).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    agentId: row.agent_id,
    level: row.level,
    direction: row.direction,
    message: row.message,
    createdAt: row.created_at,
  }));
}

function getTaskDetail(taskId) {
  const task = getTaskById(taskId);
  if (!task) return null;
  return {
    task,
    agents: listTaskAgents(taskId),
    logs: listTaskLogs(taskId),
  };
}

function updateTask(taskId, patch) {
  const { db: database } = getState();
  const current = database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!current) throw new Error('Task not found.');
  const next = {
    ...current,
    title: patch.title ?? current.title,
    goal: patch.goal ?? current.goal,
    working_directory: patch.workingDirectory ?? current.working_directory,
    status: patch.status ?? current.status,
    summary: patch.summary ?? current.summary,
    input_text: patch.inputText ?? current.input_text,
    error_text: patch.errorText ?? current.error_text,
    orchestration_json: JSON.stringify(patch.orchestration ?? safeJsonParse(current.orchestration_json, {})),
    started_at: patch.startedAt ?? current.started_at,
    finished_at: patch.finishedAt ?? current.finished_at,
    updated_at: nowIso(),
  };
  database.prepare(`
    UPDATE tasks
       SET title = @title,
           goal = @goal,
           working_directory = @working_directory,
           status = @status,
           summary = @summary,
           input_text = @input_text,
           error_text = @error_text,
           orchestration_json = @orchestration_json,
           started_at = @started_at,
           finished_at = @finished_at,
           updated_at = @updated_at
     WHERE id = @id
  `).run({ ...next, id: taskId });
  return getTaskById(taskId);
}

function updateTaskAgent(agentId, patch) {
  const { db: database } = getState();
  const current = database.prepare('SELECT * FROM task_agents WHERE id = ?').get(agentId);
  if (!current) throw new Error('Task agent not found.');
  const nextSettings = patch.settings ? { ...safeJsonParse(current.settings_json, {}), ...patch.settings } : safeJsonParse(current.settings_json, {});
  const nextUsage = patch.usage === undefined ? safeJsonParse(current.usage_json, null) : patch.usage;
  const next = {
    ...current,
    name: patch.name ?? current.name,
    provider_id: patch.providerId ?? current.provider_id,
    role: patch.role ?? current.role,
    status: patch.status ?? current.status,
    input_text: patch.inputText ?? current.input_text,
    output_text: patch.outputText ?? current.output_text,
    error_text: patch.errorText ?? current.error_text,
    depends_on_json: JSON.stringify(patch.dependsOn ?? safeJsonParse(current.depends_on_json, [])),
    settings_json: JSON.stringify(nextSettings),
    usage_json: nextUsage ? JSON.stringify(nextUsage) : null,
    started_at: patch.startedAt ?? current.started_at,
    finished_at: patch.finishedAt ?? current.finished_at,
    updated_at: nowIso(),
  };
  database.prepare(`
    UPDATE task_agents
       SET name = @name,
           provider_id = @provider_id,
           role = @role,
           status = @status,
           input_text = @input_text,
           output_text = @output_text,
           error_text = @error_text,
           depends_on_json = @depends_on_json,
           settings_json = @settings_json,
           usage_json = @usage_json,
           started_at = @started_at,
           finished_at = @finished_at,
           updated_at = @updated_at
     WHERE id = @id
  `).run({ ...next, id: agentId });
  return database.prepare('SELECT * FROM task_agents WHERE id = ?').get(agentId);
}

function appendTaskLog({ taskId, agentId = null, level = 'info', direction = 'system', message }) {
  const { db: database } = getState();
  // 如果 taskId 不在 tasks 表中（例如编排内部使用的临时 ID），跳过日志写入，避免 FOREIGN KEY 失败
  const taskExists = database.prepare('SELECT 1 FROM tasks WHERE id = ?').get(taskId);
  if (!taskExists) return;
  database.prepare(`
    INSERT INTO task_logs (task_id, agent_id, level, direction, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(taskId, agentId, level, direction, message, nowIso());
}

function deleteTask(taskId) {
  const { db: database } = getState();
  database.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
}

function resetTaskDefinition(taskId, payload) {
  const { db: database } = getState();
  const current = database.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!current) throw new Error('Task not found.');
  const now = nowIso();
  const validProviderIds = new Set(
    database.prepare('SELECT id FROM providers').all().map((r) => r.id)
  );
  const steps = (payload.steps || []).map((step) => ({
    ...step,
    providerId: validProviderIds.has(step.providerId) ? step.providerId : [...validProviderIds][0] || null,
  })).filter((step) => step.providerId != null);
  const stepIdMap = new Map(steps.map((_, index) => [index, crypto.randomUUID()]));
  const deleteAgentStmt = database.prepare('DELETE FROM task_agents WHERE task_id = ?');
  const deleteLogsStmt = database.prepare('DELETE FROM task_logs WHERE task_id = ?');
  const updateTaskStmt = database.prepare(`
    UPDATE tasks SET title = @title, goal = @goal, working_directory = @working_directory,
      status = 'queued', summary = '', error_text = '',
      orchestration_json = @orchestration_json,
      started_at = NULL, finished_at = NULL, updated_at = @updated_at WHERE id = @id
  `);
  const insertAgent = database.prepare(`
    INSERT INTO task_agents (id, task_id, name, provider_id, role, status, input_text, output_text, error_text, depends_on_json, settings_json, usage_json, created_at, updated_at)
    VALUES (@id, @task_id, @name, @provider_id, @role, @status, @input_text, @output_text, @error_text, @depends_on_json, @settings_json, @usage_json, @created_at, @updated_at)
  `);
  const tx = database.transaction(() => {
    deleteLogsStmt.run(taskId);
    deleteAgentStmt.run(taskId);
    updateTaskStmt.run({
      id: taskId,
      title: payload.title,
      goal: payload.goal,
      working_directory: payload.workingDirectory || '',
      orchestration_json: JSON.stringify(payload.orchestration || {}),
      updated_at: now,
    });
    for (const [index, step] of steps.entries()) {
      insertAgent.run({
        id: stepIdMap.get(index),
        task_id: taskId,
        name: step.name,
        provider_id: step.providerId,
        role: step.role || '',
        status: 'pending',
        input_text: '',
        output_text: '',
        error_text: '',
        depends_on_json: JSON.stringify((step.dependsOn || []).map((depIdx) => stepIdMap.get(depIdx)).filter(Boolean)),
        settings_json: JSON.stringify({ instructions: step.instructions || '', model: step.model || '', variables: step.variables || {} }),
        usage_json: null,
        created_at: now,
        updated_at: now,
      });
    }
  });
  tx();
  return getTaskDetail(taskId);
}

function getDatabaseFilePath() {
  return getState().dbFilePath;
}

function getWorkspaceConfigValue(key, fallback = null) {
  const { db: database } = getState();
  const row = database.prepare('SELECT value_json FROM workspace_config WHERE key = ?').get(key);
  if (!row) return fallback;
  return safeJsonParse(row.value_json, fallback);
}

function setWorkspaceConfigValue(key, value) {
  const { db: database } = getState();
  const now = nowIso();
  database.prepare(`
    INSERT INTO workspace_config (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value ?? null), now);
  return getWorkspaceConfigValue(key, null);
}

function getGlobalCommandAllowlist() {
  const list = getWorkspaceConfigValue(GLOBAL_COMMAND_ALLOWLIST_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.map((item) => String(item || '').trim()).filter(Boolean);
}

function setGlobalCommandAllowlist(list) {
  const normalized = Array.isArray(list)
    ? Array.from(new Set(list.map((item) => String(item || '').trim()).filter(Boolean)))
    : [];
  setWorkspaceConfigValue(GLOBAL_COMMAND_ALLOWLIST_KEY, normalized);
  return normalized;
}

function addGlobalCommandAllowlistEntry(command) {
  const item = String(command || '').trim();
  if (!item) return getGlobalCommandAllowlist();
  const current = getGlobalCommandAllowlist();
  if (!current.includes(item)) {
    current.push(item);
  }
  return setGlobalCommandAllowlist(current);
}

module.exports = {
  BUILTIN_PROVIDERS,
  initializeWorkspaceDatabase,
  getDatabaseFilePath,
  listProviders,
  getProviderById,
  saveProvider,
  patchProvider,
  deleteProvider,
  listProxies,
  getProxyById,
  saveProxy,
  deleteProxy,
  createTask,
  listTasks,
  getTaskById,
  listTaskAgents,
  listTaskLogs,
  getTaskDetail,
  updateTask,
  updateTaskAgent,
  appendTaskLog,
  resetTaskDefinition,
  deleteTask,
  getGlobalCommandAllowlist,
  setGlobalCommandAllowlist,
  addGlobalCommandAllowlistEntry,
};