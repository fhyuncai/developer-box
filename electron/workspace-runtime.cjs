const { EventEmitter } = require('events');
const { spawn, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const {
  listProviders,
  getProviderById,
  patchProvider,
  getProxyById,
  listProxies,
  getGlobalCommandAllowlist,
  addGlobalCommandAllowlistEntry,
  listTasks,
  getTaskDetail,
  updateTask,
  updateTaskAgent,
  appendTaskLog,
} = require('./workspace-db.cjs');

const runtimeEvents = new EventEmitter();
const activeTasks = new Map();
const pendingCommandApprovals = new Map();
let ProxyAgentCtor = null;
const ROLE_LABELS = {
  architect: '架构师',
  planner: '规划师',
  executor: '执行者',
  debugger: '调试专家',
  verifier: '验证者',
  reviewer: '评审者',
  researcher: '研究员',
  designer: '设计师',
};

async function getProxyAgentCtor() {
  if (ProxyAgentCtor) return ProxyAgentCtor;
  const mod = await import('proxy-agent');
  ProxyAgentCtor = mod.ProxyAgent || mod.default?.ProxyAgent || mod.default;
  return ProxyAgentCtor;
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function substituteTemplate(input, values) {
  return String(input || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = values[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function expandTemplateArgs(argsTemplate = [], templateValues = {}) {
  const expanded = [];
  for (const item of argsTemplate || []) {
    const placeholders = Array.from(String(item || '').matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1]);
    const hasMissingPlaceholder = placeholders.some((key) => {
      const value = templateValues[key];
      return value === undefined || value === null || String(value).trim() === '';
    });
    if (hasMissingPlaceholder) continue;
    const value = substituteTemplate(item, templateValues).trim();
    if (!value) continue;
    const combinedFlag = value.match(/^(--?[a-zA-Z0-9][\w-]*)\s+(.+)$/);
    if (combinedFlag && !combinedFlag[2].startsWith('-')) {
      expanded.push(combinedFlag[1], combinedFlag[2]);
      continue;
    }
    expanded.push(value);
  }
  return expanded;
}

function runCliCommandAsync({
  binary,
  args,
  command,
  useShell,
  promptMode,
  promptText,
  cwd,
  env,
  timeoutMs = 3000000,
}) {
  return new Promise((resolve) => {
    const child = useShell
      ? spawn(command, { shell: true, encoding: 'utf8', cwd, env })
      : spawn(binary, args, { shell: false, encoding: 'utf8', cwd, env });

    let stdout = '';
    let stderr = '';
    let processError = null;
    let timedOut = false;
    const timeout = timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, timeoutMs)
      : null;

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.once('error', (error) => {
      processError = error;
    });

    if (promptMode === 'stdin' && child.stdin) {
      child.stdin.write(promptText || '');
      child.stdin.end();
    }

    child.once('close', (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({
        status: typeof code === 'number' ? code : 1,
        stdout,
        stderr,
        error: processError,
        timedOut,
      });
    });
  });
}

function detectBinary(commandCandidates = []) {
  const candidates = Array.from(new Set(commandCandidates.filter(Boolean)));
  for (const candidate of candidates) {
    if (candidate.includes(' ')) {
      const shellResult = spawnSync(candidate, { shell: true, stdio: 'ignore' });
      if (shellResult.status === 0) return candidate;
      continue;
    }
    const probe = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(probe, [candidate], { encoding: 'utf8' });
    if (result.status === 0) {
      const firstLine = String(result.stdout || '').split(/\r?\n/).find(Boolean);
      if (firstLine) return firstLine.trim();
      return candidate;
    }
  }
  return '';
}

function estimateCliUsage(outputText, provider) {
  const text = outputText || '';
  const totalChars = text.length;
  const estimatedTokens = Math.ceil(totalChars / 4);
  const pricing = provider.config?.pricing || {};
  const estimatedCostUsd = ((estimatedTokens / 1000000) * Number(pricing.outputPerMillion || 0));
  return {
    promptTokens: 0,
    completionTokens: estimatedTokens,
    totalTokens: estimatedTokens,
    estimatedCostUsd: Number.isFinite(estimatedCostUsd) ? Number(estimatedCostUsd.toFixed(6)) : 0,
    source: 'estimated',
  };
}

function normalizeUsage(usage, provider) {
  const promptTokens = Number(usage?.promptTokens || usage?.input_tokens || usage?.inputTokens || 0);
  const completionTokens = Number(usage?.completionTokens || usage?.output_tokens || usage?.outputTokens || 0);
  const totalTokens = Number(usage?.totalTokens || usage?.total_tokens || promptTokens + completionTokens || 0);
  const pricing = provider.config?.pricing || {};
  const estimatedCostUsd =
    (promptTokens / 1000000) * Number(pricing.inputPerMillion || 0) +
    (completionTokens / 1000000) * Number(pricing.outputPerMillion || 0);
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: Number.isFinite(estimatedCostUsd) ? Number(estimatedCostUsd.toFixed(6)) : 0,
    source: usage?.source || 'provider',
  };
}

async function resolveProxyAgent(proxyId, applyType) {
  const effectiveProxyId = resolveEffectiveProxyId(proxyId);
  if (!effectiveProxyId) return null;
  const proxy = getProxyById(effectiveProxyId);
  if (!proxy || proxy.enabled === false) return null;
  const config = proxy.config || {};
  if (!config.url) return null;
  const ProxyAgent = await getProxyAgentCtor();
  return new ProxyAgent(config.url);
}

function buildProxyEnv(proxyId) {
  const effectiveProxyId = resolveEffectiveProxyId(proxyId);
  if (!effectiveProxyId) return {};
  const proxy = getProxyById(effectiveProxyId);
  if (!proxy || proxy.enabled === false || !proxy.config?.url) return {};
  return {
    HTTP_PROXY: proxy.config.url,
    HTTPS_PROXY: proxy.config.url,
    ALL_PROXY: proxy.config.url,
    NO_PROXY: proxy.config.noProxy || '',
  };
}

function resolveEffectiveProxyId(proxyId) {
  const raw = String(proxyId || '').trim();
  if (raw === '__none__') return '';
  if (raw) return raw;
  const globalProxy = listProxies().find((proxy) => proxy.enabled !== false && proxy.config?.isGlobal === true);
  return globalProxy?.id || '';
}

function normalizeModelList(rawModels = []) {
  if (!Array.isArray(rawModels)) return [];
  return rawModels
    .map((item) => {
      if (typeof item === 'string') {
        return { id: item, label: item };
      }
      const id = item?.id || item?.name || item?.model || item?.display_name;
      if (!id) return null;
      return {
        id,
        label: item?.display_name || item?.name || id,
        raw: item,
      };
    })
    .filter(Boolean);
}

function mergeModelLists(existingModels = [], fetchedModels = []) {
  const merged = [];
  const seen = new Set();
  for (const item of normalizeModelList(existingModels)) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  for (const item of normalizeModelList(fetchedModels)) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function parseQuotaOutput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return {
      remainingUsd: null,
      rawOutput: text,
    };
  }
}

function extractJsonObject(text) {
  const source = String(text || '').trim();
  if (!source) return null;
  try {
    return JSON.parse(source);
  } catch {}
  const jsonBlock = source.match(/```json\s*([\s\S]*?)```/i);
  if (jsonBlock?.[1]) {
    try {
      return JSON.parse(jsonBlock[1].trim());
    } catch {}
  }
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const candidate = source.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

async function runProviderQuotaCommand(provider, runtime, quota) {
  if (!provider.config?.quotaCommand) return { runtime, quota };
  const result = spawnSync(provider.config.quotaCommand, {
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, ...buildProxyEnv(provider.config?.proxyId) },
    timeout: 20000,
  });
  runtime.quotaCommandExitCode = result.status;
  runtime.quotaCommandOutput = String(result.stdout || result.stderr || '').trim().slice(0, 4000);
  const parsed = parseQuotaOutput(result.stdout || result.stderr);
  return {
    runtime,
    quota: {
      ...quota,
      ...(parsed || {}),
      source: 'provider-command',
      lastCheckedAt: nowIso(),
    },
  };
}

async function fetchProviderModelList(provider) {
  if (provider.kind === 'cli') {
    if (!provider.config?.modelListCommand) return [];
    const result = spawnSync(provider.config.modelListCommand, {
      shell: true,
      encoding: 'utf8',
      env: { ...process.env, ...buildProxyEnv(provider.config?.proxyId) },
      timeout: 20000,
    });
    const raw = String(result.stdout || '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return normalizeModelList(Array.isArray(parsed) ? parsed : parsed.models || parsed.data || []);
    } catch {
      return normalizeModelList(raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    }
  }

  const apiKey = provider.secret?.apiKey || '';
  if (!apiKey) return [];
  const proxyAgent = await resolveProxyAgent(provider.config?.proxyId, 'api');
  const requestConfig = {
    timeout: 20000,
    httpAgent: proxyAgent,
    httpsAgent: proxyAgent,
  };

  if (provider.kind === 'openai') {
    const baseUrl = provider.config?.baseUrl || 'https://api.openai.com/v1';
    const response = await axios.get(`${baseUrl.replace(/\/$/, '')}/models`, {
      ...requestConfig,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return normalizeModelList(response.data?.data || []);
  }

  if (provider.kind === 'anthropic') {
    const baseUrl = provider.config?.baseUrl || 'https://api.anthropic.com';
    const response = await axios.get(`${baseUrl.replace(/\/$/, '')}/v1/models`, {
      ...requestConfig,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': provider.config?.anthropicVersion || '2023-06-01',
      },
    });
    return normalizeModelList(response.data?.data || response.data?.models || []);
  }

  if (provider.kind === 'gemini') {
    const baseUrl = provider.config?.baseUrl || 'https://generativelanguage.googleapis.com';
    const response = await axios.get(`${baseUrl.replace(/\/$/, '')}/v1beta/models?key=${encodeURIComponent(apiKey)}`, requestConfig);
    const models = (response.data?.models || []).map((item) => ({
      id: String(item?.name || '').replace(/^models\//, ''),
      label: item?.displayName || String(item?.name || '').replace(/^models\//, ''),
      raw: item,
    }));
    return normalizeModelList(models);
  }

  return [];
}

async function refreshProviderRuntime(providerId) {
  const provider = getProviderById(providerId);
  if (!provider) {
    throw new Error('Provider not found.');
  }

  if (provider.kind === 'cli') {
    const candidates = [provider.config?.binary, ...(provider.config?.binaryCandidates || [])].filter(Boolean);
    const detectedBinary = detectBinary(candidates);
    let quota = provider.quota || {};
    let runtime = {
      ...(provider.runtime || {}),
      detectedBinary,
      available: !!detectedBinary,
      lastCheckedAt: nowIso(),
      hostPlatform: `${os.platform()}-${os.arch()}`,
    };

      ({ runtime, quota } = await runProviderQuotaCommand(provider, runtime, quota));
    try {
      runtime.models = mergeModelLists(provider.runtime?.models, await fetchProviderModelList(provider));
      runtime.modelsError = '';
    } catch (error) {
      runtime.models = normalizeModelList(provider.runtime?.models || []);
      runtime.modelsError = error.message;
    }

    return patchProvider(providerId, { runtime, quota });
  }

  if (provider.kind === 'openai') {
    const baseUrl = provider.config?.baseUrl || 'https://api.openai.com/v1';
    const apiKey = provider.secret?.apiKey || '';
    let runtime = { ...(provider.runtime || {}), lastCheckedAt: nowIso() };
    let quota = provider.quota || {};
    if (apiKey && baseUrl.includes('api.openai.com')) {
      try {
        const root = new URL(baseUrl);
        const response = await axios.get(`${root.origin}/dashboard/billing/credit_grants`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 15000,
          httpAgent: await resolveProxyAgent(provider.config?.proxyId, 'api'),
          httpsAgent: await resolveProxyAgent(provider.config?.proxyId, 'api'),
        });
        const grants = response.data || {};
        const total = Number(grants.total_available || 0);
        quota = {
          ...quota,
          balanceUsd: total,
          remainingUsd: total,
          source: 'provider-api',
          lastCheckedAt: nowIso(),
        };
        runtime.available = true;
      } catch (error) {
        runtime.balanceError = error.message;
      }
    }
    ({ runtime, quota } = await runProviderQuotaCommand(provider, runtime, quota));
    try {
      runtime.models = mergeModelLists(provider.runtime?.models, await fetchProviderModelList(provider));
      runtime.modelsError = '';
    } catch (error) {
      runtime.models = normalizeModelList(provider.runtime?.models || []);
      runtime.modelsError = error.message;
    }
    return patchProvider(providerId, { runtime, quota });
  }

  let runtime = {
    ...(provider.runtime || {}),
    available: true,
    lastCheckedAt: nowIso(),
  };
  let quota = {
    ...(provider.quota || {}),
    lastCheckedAt: nowIso(),
    source: provider.quota?.source || 'local',
  };
  ({ runtime, quota } = await runProviderQuotaCommand(provider, runtime, quota));
  try {
    runtime.models = mergeModelLists(provider.runtime?.models, await fetchProviderModelList(provider));
    runtime.modelsError = '';
  } catch (error) {
    runtime.models = normalizeModelList(provider.runtime?.models || []);
    runtime.modelsError = error.message;
  }
  return patchProvider(providerId, { runtime, quota });
}

async function invokeProviderCompletion(provider, model, promptText, workingDirectory) {
  if (provider.kind === 'cli') {
    let runtimeProvider = getProviderById(provider.id) || provider;
    let binary = runtimeProvider.runtime?.detectedBinary || runtimeProvider.config?.binary;
    if (!binary) {
      runtimeProvider = await refreshProviderRuntime(provider.id);
      binary = runtimeProvider.runtime?.detectedBinary || runtimeProvider.config?.binary;
    }
    if (!binary) {
      const err = new Error(`${provider.name} 未检测到可执行命令`);
      err.raw = `[PROVIDER]\n${provider.name}\n\n[ERROR]\n${err.message}`;
      throw err;
    }

    const templateValues = {
      prompt: promptText,
      model: model || runtimeProvider.config?.model || '',
    };
    const args = expandTemplateArgs(runtimeProvider.config?.argsTemplate || [], templateValues);
    const command = runtimeProvider.config?.shellTemplate
      ? substituteTemplate(runtimeProvider.config.shellTemplate, templateValues)
      : binary;
    const commandLine = runtimeProvider.config?.shellTemplate ? command : [binary, ...args].join(' ');
    const result = await runCliCommandAsync({
      binary,
      args,
      command,
      useShell: Boolean(runtimeProvider.config?.shellTemplate),
      promptMode: runtimeProvider.config?.promptMode,
      promptText,
      cwd: workingDirectory || process.cwd(),
      env: { ...process.env, ...buildProxyEnv(runtimeProvider.config?.proxyId), ...(runtimeProvider.config?.env || {}) },
      timeoutMs: 3000000,
    });
    const stdoutText = String(result.stdout || '').trim();
    let stderrText = String(result.stderr || '').trim();
    if (result.error) {
      const spawnErrMsg = String(result.error.message || result.error.code || '').trim();
      stderrText = spawnErrMsg && stderrText ? `${spawnErrMsg}\n${stderrText}` : (spawnErrMsg || stderrText);
    }
    if (result.error || result.status !== 0 || result.timedOut) {
      const outputRaw = [
        stdoutText ? `[STDOUT]\n${stdoutText}` : '',
        stderrText ? `[STDERR]\n${stderrText}` : '',
      ].filter(Boolean).join('\n\n') || '(CLI 返回了空输出，未收到任何内容)';
      const raw = `[COMMAND]\n${commandLine}\n\n[OUTPUT]\n${outputRaw}`.trim();
      const timeoutHint = result.timedOut ? `${provider.name} 执行超时` : '';
      const error = new Error(String(stderrText || stdoutText || timeoutHint || `${provider.name} 执行失败`).trim());
      error.raw = raw;
      throw error;
    }

    const candidateOutputs = [
      stdoutText,
      stderrText,
      [stdoutText, stderrText].filter(Boolean).join('\n'),
      [stderrText, stdoutText].filter(Boolean).join('\n'),
    ].filter(Boolean);
    const preferredText = candidateOutputs.find((candidate) => extractJsonObject(candidate)) || stdoutText || stderrText;

    // Return object so callers have access to command and full streams for robust parsing/debugging
    return { text: preferredText, cliCommand: commandLine, stdout: stdoutText, stderr: stderrText };
  }

  const tempTask = { id: 'orchestrator', title: 'auto-plan', goal: 'auto-plan', workingDirectory };
  const tempAgent = {
    id: 'orchestrator-agent',
    settings: { model, instructions: '' },
  };
  const runState = { controllers: new Map(), cancelled: false };
  try {
    const result = await executeApiAgent(tempTask, tempAgent, provider, runState, promptText);
    return { text: result.outputText || '' };
  } catch (error) {
    const responseRaw = error?.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : safeJsonStringify(error.response.data))
      : '';
    if (!error.raw && responseRaw) {
      error.raw = responseRaw;
    }
    throw error;
  }
}

async function autoOrchestrateTask({ providerId, model, title, goal, workingDirectory }) {
  const provider = getProviderById(providerId);
  if (!provider || provider.enabled === false) {
    throw new Error('编排 Provider 不可用。');
  }
  const providerModels = provider.runtime?.models || [];
  const modelHint = model || provider.config?.model || providerModels?.[0]?.id || '';
  const availableProviderIds = listProviders().filter((item) => item.enabled !== false).map((item) => item.id);

  const prompt = [
    '你是一个多 Agent 编排器，请根据目标输出执行计划。',
    '只输出 JSON，不要输出解释文字。',
    'JSON 结构必须为：',
    '{"summary":"string","steps":[{"name":"string","role":"architect|planner|executor|debugger|verifier|reviewer|researcher|designer","providerId":"string","instructions":"string","descriptionCn":"string","dependsOn":[0]}]}',
    `任务标题: ${title || '未命名任务'}`,
    `任务目标: ${goal}`,
    `工作目录: ${workingDirectory}`,
    `可用 Provider IDs: ${availableProviderIds.join(', ')}`,
    `建议模型: ${modelHint}`,
    '要求：最少 2 个步骤，最多 8 个步骤，依赖用步骤索引。',
  ].join('\n');

  let raw = '';
  let rawStdout = '';
  let rawStderr = '';
  let invokeCommandRef = '';
  try {
    const invokeResult = await invokeProviderCompletion(provider, modelHint, prompt, workingDirectory);
    raw = invokeResult?.text ?? String(invokeResult || '');
    rawStdout = String(invokeResult?.stdout || '').trim();
    rawStderr = String(invokeResult?.stderr || '').trim();
    invokeCommandRef = invokeResult?.cliCommand || '';
  } catch (error) {
    const rawText = String(error?.raw || '').trim();
    // Ensure we always include command context even when error has no raw data
    const fallbackContext = rawText || `[PROVIDER]\n${provider.name} (${provider.kind})\n[MODEL]\n${modelHint}`;
    const wrapped = new Error(`自动编排调用失败: ${error.message}\n[RAW]\n${fallbackContext}`);
    wrapped.raw = fallbackContext;
    throw wrapped;
  }
  const parsed = extractJsonObject(raw)
    || extractJsonObject([rawStdout, rawStderr].filter(Boolean).join('\n'))
    || extractJsonObject([rawStderr, rawStdout].filter(Boolean).join('\n'));
  if (!parsed || !Array.isArray(parsed.steps)) {
    // Always build a raw context block even when stdout was empty
    const outputSection = raw || [
      rawStdout ? `[STDOUT]\n${rawStdout}` : '',
      rawStderr ? `[STDERR]\n${rawStderr}` : '',
    ].filter(Boolean).join('\n\n') || '(CLI 返回了空输出，未收到任何内容)';
    const commandSection = invokeCommandRef ? `\n\n[COMMAND]\n${invokeCommandRef}` : '';
    const rawContext = `[OUTPUT]\n${outputSection}${commandSection}`;
    const error = new Error(`AI 编排结果解析失败，请重试或换一个模型。\n[RAW]\n${rawContext}`);
    error.raw = rawContext;
    throw error;
  }

  const normalized = parsed.steps
    .slice(0, 8)
    .map((step, index) => ({
      name: String(step?.name || `agent-${index + 1}`).trim(),
      role: String(step?.role || 'executor').trim(),
      providerId: availableProviderIds.includes(step?.providerId) ? step.providerId : providerId,
      model: '',
      instructions: String(step?.instructions || '').trim(),
      descriptionCn: String(step?.descriptionCn || step?.zhDescription || '').trim() || `步骤 ${index + 1}：${ROLE_LABELS[String(step?.role || 'executor').trim()] || '执行者'}负责 ${String(step?.name || `agent-${index + 1}`).trim()}`,
      dependsOn: Array.isArray(step?.dependsOn)
        ? step.dependsOn.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item < parsed.steps.length && item !== index)
        : [],
      roleLabel: ROLE_LABELS[String(step?.role || 'executor').trim()] || String(step?.role || 'executor').trim(),
    }))
    .filter((step) => step.name && step.providerId);

  if (normalized.length === 0) {
    throw new Error('AI 编排未返回有效步骤。');
  }

  const summary = String(parsed?.summary || '').trim() || `已生成 ${normalized.length} 个步骤：${normalized.map((step) => step.name).join(' -> ')}`;

  return {
    steps: normalized,
    summary,
    raw,
  };
}

function emitTaskEvent(taskId, type, payload = {}) {
  runtimeEvents.emit('event', { taskId, type, ...payload, at: nowIso() });
}

function appendAndEmit(taskId, agentId, level, direction, message) {
  appendTaskLog({ taskId, agentId, level, direction, message });
  emitTaskEvent(taskId, 'log', { agentId, level, direction, message });
}

function buildTaskPrompt(task, agent, completedAgents) {
  const dependencyOutputs = (agent.dependsOn || [])
    .map((dependencyId) => completedAgents.get(dependencyId))
    .filter(Boolean)
    .map((dependencyAgent) => `## 依赖 Agent: ${dependencyAgent.name}\n${dependencyAgent.outputText || dependencyAgent.errorText || ''}`)
    .join('\n\n');

  const instructions = agent.settings?.instructions?.trim() ? `## Agent 指令\n${agent.settings.instructions.trim()}` : '';
  const dependencySection = dependencyOutputs ? `## 上游结果\n${dependencyOutputs}` : '';
  const workingDirectory = task.workingDirectory ? `\n工作目录: ${task.workingDirectory}` : '';

  return [
    `# 任务标题\n${task.title}`,
    `# 总任务目标\n${task.goal}${workingDirectory}`,
    agent.role ? `# 当前 Agent 角色\n${agent.role}` : '',
    instructions,
    dependencySection,
    '# 输出要求\n你可以多轮次完成任务。优先使用工具而非臆测。\n如需调用工具，必须只输出 JSON：\n{"done":false,"summary":"当前进展","actions":[{"tool":"list_files|read_file|write_file|append_file|delete_path|mkdir|run_command","...":"参数"}]}\n\n当任务完成时输出：\n{"done":true,"summary":"最终结果说明","actions":[]}\n\n工具说明：\n- list_files: {"path":"相对路径","recursive":false,"limit":200}\n- read_file: {"path":"相对路径","startLine":1,"endLine":200}\n- write_file: {"path":"相对路径","content":"全文"}\n- append_file: {"path":"相对路径","content":"追加内容"}\n- delete_path: {"path":"相对路径","recursive":false}\n- mkdir: {"path":"相对路径"}\n- run_command: {"command":"命令"}，仅允许白名单命令\n\n安全限制：\n- 所有路径必须在工作目录内\n- 危险命令默认拒绝，需人工维护白名单\n\n每次拿到工具结果后请继续下一轮，直到 done=true。',
  ].filter(Boolean).join('\n\n');
}

function ensurePathInWorkspace(workingDirectory, relativePath = '.') {
  const base = path.resolve(workingDirectory || process.cwd());
  const target = path.resolve(base, relativePath || '.');
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('路径越界：仅允许操作工作目录内文件。');
  }
  return { base, target };
}

function listFilesTool(workingDirectory, toolInput = {}) {
  const limit = Math.max(1, Math.min(Number(toolInput.limit || 200), 1000));
  const recursive = Boolean(toolInput.recursive);
  const { base, target } = ensurePathInWorkspace(workingDirectory, toolInput.path || '.');
  const queue = [target];
  const rows = [];
  while (queue.length > 0 && rows.length < limit) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (rows.length >= limit) break;
      const fullPath = path.join(current, entry.name);
      const relative = path.relative(base, fullPath) || '.';
      rows.push({ path: relative, type: entry.isDirectory() ? 'dir' : 'file' });
      if (recursive && entry.isDirectory()) {
        queue.push(fullPath);
      }
    }
  }
  return { items: rows, truncated: rows.length >= limit };
}

function readFileTool(workingDirectory, toolInput = {}) {
  const { target } = ensurePathInWorkspace(workingDirectory, toolInput.path);
  const startLine = Math.max(1, Number(toolInput.startLine || 1));
  const endLine = Math.max(startLine, Number(toolInput.endLine || startLine + 199));
  const content = fs.readFileSync(target, 'utf8');
  const lines = content.split(/\r?\n/);
  const slice = lines.slice(startLine - 1, endLine);
  return {
    path: toolInput.path,
    startLine,
    endLine,
    content: slice.join('\n'),
    totalLines: lines.length,
  };
}

function writeFileTool(workingDirectory, toolInput = {}) {
  const { target } = ensurePathInWorkspace(workingDirectory, toolInput.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, String(toolInput.content || ''), 'utf8');
  return { path: toolInput.path, bytes: Buffer.byteLength(String(toolInput.content || ''), 'utf8') };
}

function appendFileTool(workingDirectory, toolInput = {}) {
  const { target } = ensurePathInWorkspace(workingDirectory, toolInput.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, String(toolInput.content || ''), 'utf8');
  return { path: toolInput.path, appendedBytes: Buffer.byteLength(String(toolInput.content || ''), 'utf8') };
}

function mkdirTool(workingDirectory, toolInput = {}) {
  const { target } = ensurePathInWorkspace(workingDirectory, toolInput.path);
  fs.mkdirSync(target, { recursive: true });
  return { path: toolInput.path || '.', created: true };
}

function deletePathTool(workingDirectory, toolInput = {}) {
  const { target } = ensurePathInWorkspace(workingDirectory, toolInput.path);
  if (!fs.existsSync(target)) {
    return { path: toolInput.path, deleted: false, reason: 'not-found' };
  }
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    if (!toolInput.recursive) {
      fs.rmdirSync(target);
    } else {
      fs.rmSync(target, { recursive: true, force: true });
    }
  } else {
    fs.unlinkSync(target);
  }
  return { path: toolInput.path, deleted: true };
}

function isRunCommandAllowed(command) {
  const allowlist = getGlobalCommandAllowlist();
  if (!Array.isArray(allowlist) || allowlist.length === 0) return false;
  const cmd = String(command || '').trim();
  return allowlist.some((rule) => {
    const r = String(rule || '').trim();
    return r && (cmd === r || cmd.startsWith(`${r} `));
  });
}

async function requestCommandApproval(task, agent, command, runState) {
  const approvalId = `${task.id}:${agent.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  updateTask(task.id, { status: 'paused' });
  emitTaskEvent(task.id, 'task-status', { status: 'paused' });
  emitTaskEvent(task.id, 'command-approval-required', {
    status: 'paused',
    approvalId,
    agentId: agent.id,
    agentName: agent.name,
    command,
  });
  appendAndEmit(task.id, agent.id, 'warn', 'tool', `命令未在白名单中，等待人工确认：${command}`);

  return new Promise((resolve) => {
    pendingCommandApprovals.set(approvalId, {
      taskId: task.id,
      agentId: agent.id,
      command,
      resolve,
      runState,
    });
  });
}

function runCommandAsync(command, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      cwd: options.cwd,
      env: options.env,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let done = false;

    const timer = options.timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          try {
            child.kill('SIGTERM');
          } catch {}
        }, options.timeoutMs)
      : null;

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });

    const finish = (payload) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve(payload);
    };

    child.once('error', (error) => {
      finish({ status: 1, stdout, stderr, timedOut, error: String(error?.message || error) });
    });
    child.once('close', (code) => {
      finish({ status: typeof code === 'number' ? code : 1, stdout, stderr, timedOut });
    });
  });
}

function resolveCommandApproval({ approvalId, allow = false, remember = false } = {}) {
  const pending = pendingCommandApprovals.get(approvalId);
  if (!pending) {
    return { ok: false, message: '审批单不存在或已处理。' };
  }
  pendingCommandApprovals.delete(approvalId);
  if (allow && remember) {
    addGlobalCommandAllowlistEntry(pending.command);
  }
  if (!pending.runState?.cancelled) {
    updateTask(pending.taskId, { status: 'running' });
    emitTaskEvent(pending.taskId, 'task-status', { status: 'running' });
  }
  pending.resolve({ allow: Boolean(allow), remember: Boolean(remember) });
  return { ok: true };
}

async function runCommandTool(task, agent, provider, runState, toolInput = {}) {
  const command = String(toolInput.command || '').trim();
  if (!command) {
    throw new Error('run_command 缺少 command 参数。');
  }
  if (!isRunCommandAllowed(command)) {
    const decision = await requestCommandApproval(task, agent, command, runState);
    if (!decision?.allow) {
      throw new Error(`命令未获批准：${command}`);
    }
    appendAndEmit(task.id, agent.id, 'info', 'tool', `命令已获人工批准：${command}`);
  }
  appendAndEmit(task.id, agent.id, 'info', 'tool', `执行命令：${command}`);

  const result = await runCommandAsync(command, {
    cwd: task.workingDirectory || process.cwd(),
    env: { ...process.env, ...buildProxyEnv(provider.config?.proxyId), ...(provider.config?.env || {}) },
    timeoutMs: 3000000,
  });

  appendAndEmit(task.id, agent.id, result.status === 0 ? 'info' : 'warn', 'tool', `命令执行结束（退出码 ${result.status}${result.timedOut ? ', timeout' : ''}）。`);
  return {
    command,
    status: result.status,
    stdout: String(result.stdout || '').slice(0, 20000),
    stderr: String(result.stderr || '').slice(0, 20000),
    timedOut: Boolean(result.timedOut),
  };
}

function parseAgentActionEnvelope(text) {
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(parsed, 'done')) return null;
  return {
    done: parsed.done === true,
    summary: String(parsed.summary || '').trim(),
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}

function mergeUsageTotals(total, usage) {
  if (!usage) return total;
  return {
    promptTokens: Number(total.promptTokens || 0) + Number(usage.promptTokens || 0),
    completionTokens: Number(total.completionTokens || 0) + Number(usage.completionTokens || 0),
    totalTokens: Number(total.totalTokens || 0) + Number(usage.totalTokens || 0),
    estimatedCostUsd: Number((Number(total.estimatedCostUsd || 0) + Number(usage.estimatedCostUsd || 0)).toFixed(6)),
    source: usage.source || total.source || 'estimated',
  };
}

async function executeAgentToolAction(task, agent, provider, runState, action = {}) {
  const tool = String(action.tool || '').trim();
  switch (tool) {
    case 'list_files':
      return listFilesTool(task.workingDirectory, action);
    case 'read_file':
      return readFileTool(task.workingDirectory, action);
    case 'write_file':
      return writeFileTool(task.workingDirectory, action);
    case 'append_file':
      return appendFileTool(task.workingDirectory, action);
    case 'delete_path':
      return deletePathTool(task.workingDirectory, action);
    case 'mkdir':
      return mkdirTool(task.workingDirectory, action);
    case 'run_command':
      return runCommandTool(task, agent, provider, runState, action);
    default:
      throw new Error(`未知工具: ${tool}`);
  }
}

function buildNextRoundPrompt(basePrompt, roundOutput, actionResults) {
  return [
    basePrompt,
    '---',
    '上轮你的输出：',
    String(roundOutput || '').slice(0, 12000),
    '工具执行结果（JSON）：',
    safeJsonStringify(actionResults),
    '请继续下一轮。若任务未完成请继续输出 JSON 协议；完成时输出 done=true。',
  ].join('\n\n');
}

async function executeInteractiveAgent(task, agent, provider, runState, initialPrompt) {
  const maxRounds = Math.max(50, Math.min(Number(agent.settings?.maxRounds || 300), 1000));
  let prompt = initialPrompt;
  let finalOutput = '';
  let totalUsage = null;

  for (let round = 1; round <= maxRounds; round += 1) {
    appendAndEmit(task.id, agent.id, 'info', 'system', `开始第 ${round} 轮交互。`);
    const result = provider.kind === 'cli'
      ? await executeCliAgent(task, agent, provider, runState, prompt)
      : await executeApiAgent(task, agent, provider, runState, prompt);
    totalUsage = mergeUsageTotals(totalUsage || {}, result.usage || {});
    const outputText = String(result.outputText || '').trim();
    finalOutput = outputText || finalOutput;

    const envelope = parseAgentActionEnvelope(outputText);
    if (!envelope) {
      // Backward compatible: non-JSON output is treated as final result
      break;
    }

    const actionResults = [];
    for (let index = 0; index < envelope.actions.length; index += 1) {
      const action = envelope.actions[index] || {};
      const tool = String(action.tool || '').trim();
      appendAndEmit(task.id, agent.id, 'info', 'tool', `第 ${round} 轮操作 #${index + 1}: ${tool} ${safeJsonStringify(action)}`);
      try {
        const data = await executeAgentToolAction(task, agent, provider, runState, action);
        actionResults.push({ index, tool, ok: true, data });
        appendAndEmit(task.id, agent.id, 'info', 'tool', `工具 ${tool} 执行成功，结果：${safeJsonStringify(data).slice(0, 3000)}`);
      } catch (error) {
        actionResults.push({ index, tool, ok: false, error: String(error?.message || error) });
        appendAndEmit(task.id, agent.id, 'warn', 'tool', `工具 ${tool} 执行失败：${String(error?.message || error)}`);
      }
    }

    if (envelope.done && envelope.actions.length === 0) {
      finalOutput = envelope.summary || outputText;
      break;
    }

    prompt = buildNextRoundPrompt(initialPrompt, outputText, actionResults);
    finalOutput = envelope.summary || finalOutput;
  }

  return {
    outputText: finalOutput || '(agent 未返回有效输出)',
    usage: totalUsage,
  };
}

function extractAndWriteFiles(outputText, workingDirectory) {
  if (!outputText || !workingDirectory) return [];
  const written = [];
  const codeBlockRegex = /```(?:\w+)?\n(?:\/\/|#)\s*filepath:\s*([^\n]+)\n([\s\S]*?)```/gi;
  let match;
  while ((match = codeBlockRegex.exec(outputText)) !== null) {
    const relPath = match[1].trim();
    const content = match[2];
    if (!relPath) continue;
    const targetPath = path.isAbsolute(relPath) ? relPath : path.join(workingDirectory, relPath);
    const realWorking = path.resolve(workingDirectory);
    const realTarget = path.resolve(targetPath);
    if (!realTarget.startsWith(realWorking + path.sep) && realTarget !== realWorking) continue;
    try {
      fs.mkdirSync(path.dirname(realTarget), { recursive: true });
      fs.writeFileSync(realTarget, content);
      written.push(relPath);
    } catch {}
  }
  return written;
}

function createLineEmitter(taskId, agentId, direction, level) {
  let buffer = '';
  return (chunk, flush = false) => {
    buffer += chunk;
    const parts = buffer.split(/\r?\n/);
    if (!flush) {
      buffer = parts.pop() || '';
    } else {
      buffer = '';
    }
    for (const line of parts) {
      const text = line.trimEnd();
      if (text) appendAndEmit(taskId, agentId, level, direction, text);
    }
    if (flush && buffer.trim()) {
      appendAndEmit(taskId, agentId, level, direction, buffer.trim());
    }
  };
}

async function executeCliAgent(task, agent, provider, runState, promptText) {
  const runtimeProvider = await refreshProviderRuntime(provider.id);
  const binary = runtimeProvider.runtime?.detectedBinary || runtimeProvider.config?.binary;
  if (!binary) {
    throw new Error(`${provider.name} 未检测到可执行命令，请先在 Provider 配置中确认命令路径。`);
  }

  const templateValues = {
    prompt: promptText,
    model: agent.settings?.model || runtimeProvider.config?.model || '',
  };

  const args = expandTemplateArgs(runtimeProvider.config?.argsTemplate || [], templateValues);
  const command = runtimeProvider.config?.shellTemplate
    ? substituteTemplate(runtimeProvider.config.shellTemplate, templateValues)
    : binary;

  const commandDisplay = runtimeProvider.config?.shellTemplate ? command : [binary, ...args].join(' ');
  appendAndEmit(task.id, agent.id, 'info', 'system', `启动 ${provider.name}: ${commandDisplay}`);

  const child = runtimeProvider.config?.shellTemplate
    ? spawn(command, {
        cwd: task.workingDirectory || process.cwd(),
        env: { ...process.env, ...buildProxyEnv(runtimeProvider.config?.proxyId), ...(runtimeProvider.config?.env || {}) },
        shell: true,
      })
    : spawn(binary, args, {
        cwd: task.workingDirectory || process.cwd(),
        env: { ...process.env, ...buildProxyEnv(runtimeProvider.config?.proxyId), ...(runtimeProvider.config?.env || {}) },
        shell: false,
      });

  runState.children.set(agent.id, child);
  const pushStdout = createLineEmitter(task.id, agent.id, 'stdout', 'info');
  const pushStderr = createLineEmitter(task.id, agent.id, 'stderr', 'warn');

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    const text = String(chunk);
    stdout += text;
    pushStdout(text);
  });
  child.stderr.on('data', (chunk) => {
    const text = String(chunk);
    stderr += text;
    pushStderr(text);
  });

  if (runtimeProvider.config?.promptMode === 'stdin' && child.stdin) {
    child.stdin.write(promptText);
    child.stdin.end();
  }

  const result = await new Promise((resolve, reject) => {
    child.once('error', (err) => {
      appendAndEmit(task.id, agent.id, 'error', 'system', `进程启动失败: ${err.message} (命令: ${commandDisplay})`);
      reject(err);
    });
    child.once('close', (code) => {
      pushStdout('', true);
      pushStderr('', true);
      resolve({ code });
    });
  });

  runState.children.delete(agent.id);

  if (runState.cancelled) {
    throw new Error('任务已取消');
  }

  if (result.code !== 0) {
    const errMsg = stderr.trim() || `${provider.name} 退出码 ${result.code}`;
    appendAndEmit(task.id, agent.id, 'error', 'system', `执行失败 (退出码 ${result.code}): ${commandDisplay}`);
    throw new Error(errMsg);
  }

  const stdoutText = stdout.trim();
  const stderrText = stderr.trim();
  const candidateOutputs = [
    stdoutText,
    stderrText,
    [stdoutText, stderrText].filter(Boolean).join('\n'),
    [stderrText, stdoutText].filter(Boolean).join('\n'),
  ].filter(Boolean);
  const outputText = candidateOutputs.find((candidate) => extractJsonObject(candidate)) || stdoutText || stderrText;
  const usage = estimateCliUsage(outputText, runtimeProvider);
  return { outputText, usage };
}

async function executeApiAgent(task, agent, provider, runState, promptText) {
  const apiKey = provider.secret?.apiKey;
  if (!apiKey) {
    throw new Error(`${provider.name} 缺少 API Key。`);
  }

  const controller = new AbortController();
  runState.controllers.set(agent.id, controller);
  const model = agent.settings?.model || provider.config?.model;
  const proxyAgent = await resolveProxyAgent(provider.config?.proxyId, 'api');

  const requestConfig = {
    signal: controller.signal,
    timeout: 3000000,
    httpAgent: proxyAgent,
    httpsAgent: proxyAgent,
  };

  appendAndEmit(task.id, agent.id, 'info', 'request', safeJsonStringify({ provider: provider.name, kind: provider.kind, model }));

  let outputText = '';
  let usage = null;

  if (provider.kind === 'openai') {
    const baseUrl = provider.config?.baseUrl || 'https://api.openai.com/v1';
    const response = await axios.post(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      model,
      messages: [{ role: 'user', content: promptText }],
      temperature: Number(provider.config?.temperature ?? 0.2),
    }, {
      ...requestConfig,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(provider.config?.headers || {}),
      },
    });
    outputText = response.data?.choices?.map((item) => item.message?.content).filter(Boolean).join('\n\n') || '';
    usage = normalizeUsage(response.data?.usage, provider);
  } else if (provider.kind === 'anthropic') {
    const baseUrl = provider.config?.baseUrl || 'https://api.anthropic.com';
    const response = await axios.post(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
      model,
      max_tokens: Number(provider.config?.maxTokens || 2048),
      system: agent.settings?.instructions || provider.config?.systemPrompt || '',
      messages: [{ role: 'user', content: promptText }],
    }, {
      ...requestConfig,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': provider.config?.anthropicVersion || '2023-06-01',
        'Content-Type': 'application/json',
        ...(provider.config?.headers || {}),
      },
    });
    outputText = (response.data?.content || []).map((item) => item.text).filter(Boolean).join('\n\n');
    usage = normalizeUsage(response.data?.usage, provider);
  } else if (provider.kind === 'gemini') {
    const baseUrl = provider.config?.baseUrl || 'https://generativelanguage.googleapis.com';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await axios.post(endpoint, {
      systemInstruction: agent.settings?.instructions ? { parts: [{ text: agent.settings.instructions }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: provider.config?.generationConfig || undefined,
    }, {
      ...requestConfig,
      headers: {
        'Content-Type': 'application/json',
        ...(provider.config?.headers || {}),
      },
    });
    outputText = (response.data?.candidates || [])
      .flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text)
      .filter(Boolean)
      .join('\n\n');
    usage = normalizeUsage(response.data?.usageMetadata, provider);
  } else {
    throw new Error(`不支持的 Provider 类型: ${provider.kind}`);
  }

  runState.controllers.delete(agent.id);
  appendAndEmit(task.id, agent.id, 'info', 'response', outputText.slice(0, 4000) || '(empty)');
  return { outputText: outputText.trim(), usage };
}

async function executeAgent(task, agent, completedAgents, runState) {
  const provider = getProviderById(agent.providerId);
  if (!provider || provider.enabled === false) {
    throw new Error(`Provider 不可用: ${agent.providerId}`);
  }

  const promptText = buildTaskPrompt(task, agent, completedAgents);
  updateTaskAgent(agent.id, {
    status: 'running',
    startedAt: nowIso(),
    inputText: promptText,
    errorText: '',
  });
  appendAndEmit(task.id, agent.id, 'info', 'input', promptText);
  emitTaskEvent(task.id, 'agent-status', { agentId: agent.id, status: 'running' });

  try {
    const result = await executeInteractiveAgent(task, agent, provider, runState, promptText);
    updateTaskAgent(agent.id, {
      status: 'completed',
      outputText: result.outputText,
      usage: result.usage,
      finishedAt: nowIso(),
    });
    const writtenFiles = extractAndWriteFiles(result.outputText, task.workingDirectory);
    if (writtenFiles.length > 0) {
      appendAndEmit(task.id, agent.id, 'info', 'system', `已写入工作目录文件：${writtenFiles.join(', ')}`);
    }
    const nextQuota = {
      ...(provider.quota || {}),
      spentUsd: Number(((provider.quota?.spentUsd || 0) + Number(result.usage?.estimatedCostUsd || 0)).toFixed(6)),
      source: provider.quota?.source || result.usage?.source || 'local',
      lastCheckedAt: provider.quota?.lastCheckedAt || nowIso(),
    };
    patchProvider(provider.id, { quota: nextQuota });
    emitTaskEvent(task.id, 'agent-status', { agentId: agent.id, status: 'completed' });
    return getTaskDetail(task.id).agents.find((item) => item.id === agent.id);
  } catch (error) {
    updateTaskAgent(agent.id, {
      status: runState.cancelled ? 'cancelled' : 'failed',
      errorText: error.message,
      finishedAt: nowIso(),
    });
    appendAndEmit(task.id, agent.id, 'error', 'system', error.message);
    emitTaskEvent(task.id, 'agent-status', { agentId: agent.id, status: runState.cancelled ? 'cancelled' : 'failed' });
    return getTaskDetail(task.id).agents.find((item) => item.id === agent.id);
  }
}

async function runTask(taskId) {
  if (activeTasks.has(taskId)) {
    return getTaskDetail(taskId);
  }
  const runState = { cancelled: false, children: new Map(), controllers: new Map() };
  activeTasks.set(taskId, runState);

  let detail = getTaskDetail(taskId);
  if (!detail) {
    activeTasks.delete(taskId);
    throw new Error('Task not found.');
  }

  updateTask(taskId, { status: 'running', startedAt: nowIso(), errorText: '' });
  appendAndEmit(taskId, null, 'info', 'system', `任务开始执行，共 ${detail.agents.length} 个 agent。`);
  emitTaskEvent(taskId, 'task-status', { status: 'running' });

  const completedAgents = new Map();
  const running = new Map();

  while (true) {
    detail = getTaskDetail(taskId);
    const agents = detail.agents;
    const pending = agents.filter((agent) => agent.status === 'pending');
    const runningAgents = agents.filter((agent) => agent.status === 'running');

    for (const agent of agents.filter((item) => item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled')) {
      completedAgents.set(agent.id, agent);
    }

    for (const agent of pending) {
      const dependencies = (agent.dependsOn || []).map((dependencyId) => completedAgents.get(dependencyId)).filter(Boolean);
      const failedDependency = dependencies.find((dependency) => dependency.status !== 'completed');
      const allResolved = agent.dependsOn.every((dependencyId) => completedAgents.has(dependencyId));
      if (failedDependency && allResolved) {
        updateTaskAgent(agent.id, {
          status: 'skipped',
          errorText: `上游 agent ${failedDependency.name} 未成功完成，当前步骤跳过。`,
          finishedAt: nowIso(),
        });
        appendAndEmit(taskId, agent.id, 'warn', 'system', `跳过 ${agent.name}，原因：${failedDependency.name} 失败。`);
        completedAgents.set(agent.id, getTaskDetail(taskId).agents.find((item) => item.id === agent.id));
        continue;
      }
      if (!allResolved || running.has(agent.id)) continue;
      const promise = executeAgent(detail.task, agent, completedAgents, runState).finally(() => {
        running.delete(agent.id);
      });
      running.set(agent.id, promise);
    }

    if (running.size === 0 && pending.length === 0 && runningAgents.length === 0) {
      break;
    }

    // Recover orphaned "running" agents (e.g. app restarted and child process lost)
    if (running.size === 0 && pending.length === 0 && runningAgents.length > 0) {
      for (const agent of runningAgents) {
        updateTaskAgent(agent.id, {
          status: 'pending',
          errorText: '检测到进程中断，步骤已重置并继续。',
          startedAt: null,
          finishedAt: null,
        });
      }
      appendAndEmit(taskId, null, 'warn', 'system', '检测到中断后的运行中步骤，已自动重置并继续。');
      continue;
    }

    if (running.size === 0 && pending.length > 0) {
      appendAndEmit(taskId, null, 'warn', 'system', '检测到不可继续推进的依赖关系，剩余步骤将标记为跳过。');
      for (const agent of pending) {
        updateTaskAgent(agent.id, {
          status: 'skipped',
          errorText: '依赖未满足，任务无法继续。',
          finishedAt: nowIso(),
        });
      }
      break;
    }

    if (running.size > 0) {
      await Promise.race(running.values());
    }

    if (runState.cancelled) {
      break;
    }
  }

  detail = getTaskDetail(taskId);
  const failedCount = detail.agents.filter((agent) => agent.status === 'failed').length;
  const cancelled = runState.cancelled;
  const finalStatus = cancelled ? 'cancelled' : failedCount > 0 ? 'failed' : 'completed';
  const summary = cancelled
    ? '任务已取消'
    : failedCount > 0
      ? `任务完成，但有 ${failedCount} 个 agent 失败`
      : '所有 agent 已成功完成';

  updateTask(taskId, {
    status: finalStatus,
    summary,
    finishedAt: nowIso(),
    errorText: failedCount > 0 && !cancelled ? `${failedCount} 个 agent 执行失败` : '',
  });
  appendAndEmit(taskId, null, finalStatus === 'completed' ? 'info' : 'warn', 'system', summary);
  emitTaskEvent(taskId, 'task-status', { status: finalStatus });
  activeTasks.delete(taskId);
  return getTaskDetail(taskId);
}

function cancelTask(taskId) {
  const runState = activeTasks.get(taskId);
  if (!runState) {
    const detail = getTaskDetail(taskId);
    if (!detail) return false;
    if (!['running', 'paused', 'queued'].includes(detail.task.status)) return false;
    for (const agent of detail.agents) {
      if (agent.status === 'pending' || agent.status === 'running') {
        updateTaskAgent(agent.id, {
          status: 'cancelled',
          errorText: '任务已手动取消。',
          finishedAt: nowIso(),
        });
      }
    }
    updateTask(taskId, {
      status: 'cancelled',
      summary: '任务已取消',
      finishedAt: nowIso(),
      errorText: '',
    });
    appendAndEmit(taskId, null, 'warn', 'system', '任务已取消。');
    emitTaskEvent(taskId, 'task-status', { status: 'cancelled' });
    return true;
  }
  runState.cancelled = true;

  for (const [approvalId, pending] of pendingCommandApprovals.entries()) {
    if (pending.taskId === taskId) {
      pendingCommandApprovals.delete(approvalId);
      pending.resolve({ allow: false, remember: false, cancelled: true });
    }
  }

  for (const child of runState.children.values()) {
    try {
      child.kill('SIGTERM');
    } catch {}
  }
  for (const controller of runState.controllers.values()) {
    controller.abort();
  }
  appendAndEmit(taskId, null, 'warn', 'system', '收到取消请求，正在停止所有运行中的 agent。');
  return true;
}

function subscribe(listener) {
  runtimeEvents.on('event', listener);
  return () => runtimeEvents.off('event', listener);
}

function getPendingCommandApprovals(taskId) {
  const rows = [];
  for (const [approvalId, pending] of pendingCommandApprovals.entries()) {
    if (taskId && pending.taskId !== taskId) continue;
    const detail = getTaskDetail(pending.taskId);
    const agent = detail?.agents?.find((item) => item.id === pending.agentId);
    rows.push({
      approvalId,
      taskId: pending.taskId,
      agentId: pending.agentId,
      agentName: agent?.name || '',
      command: pending.command,
    });
  }
  return rows;
}

function recoverInterruptedTasks() {
  const tasks = listTasks(200).filter((task) => task.status === 'running' || task.status === 'paused');
  for (const task of tasks) {
    const detail = getTaskDetail(task.id);
    if (!detail) continue;
    for (const agent of detail.agents) {
      if (agent.status === 'running') {
        updateTaskAgent(agent.id, {
          status: 'pending',
          startedAt: null,
          finishedAt: null,
          errorText: '应用重启后恢复执行。',
        });
      }
    }
    updateTask(task.id, {
      status: 'queued',
      startedAt: null,
      finishedAt: null,
      errorText: '',
      summary: '应用重启后自动恢复执行。',
    });
    appendAndEmit(task.id, null, 'warn', 'system', '检测到上次异常退出，任务已自动恢复执行。');
    runTask(task.id).catch((error) => {
      emitTaskEvent(task.id, 'task-error', { status: 'failed', message: error.message });
    });
  }
  return { recoveredCount: tasks.length };
}

function getWorkspaceOverview() {
  const providers = listProviders();
  const tasks = listTasks(20);
  const runningCount = tasks.filter((task) => task.status === 'running').length;
  const queuedCount = tasks.filter((task) => task.status === 'queued').length;
  const completedCount = tasks.filter((task) => task.status === 'completed').length;
  const failedCount = tasks.filter((task) => task.status === 'failed').length;
  const totalSpentUsd = providers.reduce((sum, provider) => sum + Number(provider.stats?.spentUsd || provider.quota?.spentUsd || 0), 0);
  return {
    stats: {
      providerCount: providers.length,
      runningCount,
      queuedCount,
      completedCount,
      failedCount,
      totalSpentUsd: Number(totalSpentUsd.toFixed(6)),
    },
    providers,
    recentTasks: tasks,
  };
}

async function retryTaskAgent(taskId, agentId) {
  if (activeTasks.has(taskId)) {
    throw new Error('任务正在运行中，请先取消后再重试。');
  }
  const detail = getTaskDetail(taskId);
  if (!detail) throw new Error('Task not found.');
  const target = detail.agents.find((agent) => agent.id === agentId);
  if (!target) throw new Error('Agent not found.');
  if (target.status !== 'failed') {
    throw new Error('仅允许重试失败步骤。');
  }

  // Transitively collect the target agent + all agents that depend on it
  const toReset = new Set([agentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const agent of detail.agents) {
      if (!toReset.has(agent.id) && (agent.dependsOn || []).some((id) => toReset.has(id))) {
        toReset.add(agent.id);
        changed = true;
      }
    }
  }

  for (const id of toReset) {
    updateTaskAgent(id, {
      status: 'pending',
      outputText: '',
      errorText: '',
      startedAt: null,
      finishedAt: null,
    });
    appendAndEmit(taskId, id, 'info', 'system', 'Agent 已重置，等待重试。');
  }

  updateTask(taskId, { status: 'queued', errorText: '' });
  appendAndEmit(taskId, null, 'info', 'system', `正在重试 ${toReset.size} 个 agent（含下游依赖）。`);
  emitTaskEvent(taskId, 'task-status', { status: 'queued' });

  runTask(taskId).catch((error) => {
    emitTaskEvent(taskId, 'task-error', { status: 'failed', message: error.message });
  });
  return { ok: true };
}

module.exports = {
  subscribe,
  refreshProviderRuntime,
  autoOrchestrateTask,
  runTask,
  cancelTask,
  retryTaskAgent,
  resolveCommandApproval,
  getPendingCommandApprovals,
  recoverInterruptedTasks,
  getWorkspaceOverview,
};