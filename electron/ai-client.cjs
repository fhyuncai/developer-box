const axios = require('axios');

let proxyAgentPromise = null;

async function getProxyAgent() {
  if (!proxyAgentPromise) {
    proxyAgentPromise = (async () => {
      try {
        const proxyAgentModule = await import('proxy-agent');
        const ProxyAgent =
          proxyAgentModule?.ProxyAgent
          || proxyAgentModule?.default?.ProxyAgent
          || proxyAgentModule?.default;

        if (!ProxyAgent) {
          return null;
        }

        return new ProxyAgent();
      } catch {
        return null;
      }
    })();
  }

  return proxyAgentPromise;
}

function withTrailingSlash(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  return text.endsWith('/') ? text : `${text}/`;
}

function joinApiUrl(baseUrl, pathName) {
  return new URL(pathName.replace(/^\/+/, ''), withTrailingSlash(baseUrl)).toString();
}

function normalizeOpenAiContent(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text || '';
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('\n')
      .trim();
  }
  return '';
}

function normalizeAnthropicContent(content) {
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (part?.type === 'text' ? part.text || '' : ''))
    .join('\n')
    .trim();
}

function formatAxiosError(error, fallback) {
  const remoteMessage = error?.response?.data?.error?.message
    || error?.response?.data?.message
    || error?.response?.data?.error_msg;

  if (remoteMessage) {
    return `${fallback}：${remoteMessage}`;
  }

  if (error?.message) {
    return `${fallback}：${error.message}`;
  }

  return fallback;
}

async function createRequestOptions({ headers = {}, timeout = 30000 } = {}) {
  const options = {
    timeout,
    headers,
  };

  const proxyAgent = await getProxyAgent();
  if (proxyAgent) {
    options.proxy = false;
    options.httpAgent = proxyAgent;
    options.httpsAgent = proxyAgent;
  }

  return options;
}

async function runWithRetry(task) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN'].includes(error?.code)) {
        throw error;
      }
    }
  }
  throw lastError;
}

async function callOpenAi({ config, apiKey, systemPrompt, userPrompt, temperature = 0.2 }) {
  if (!apiKey) {
    throw new Error('当前 OpenAI 兼容提供商未配置 API Key');
  }

  const url = joinApiUrl(config.baseUrl, 'chat/completions');
  const payload = {
    model: config.model,
    temperature,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: userPrompt },
    ],
  };

  try {
    const response = await runWithRetry(async () => axios.post(url, payload, await createRequestOptions({
      timeout: 60000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })));

    const content = normalizeOpenAiContent(response?.data?.choices?.[0]?.message?.content);
    if (!content) {
      throw new Error('模型未返回可用内容');
    }

    return {
      provider: 'openai',
      model: config.model,
      text: content,
    };
  } catch (error) {
    throw new Error(formatAxiosError(error, '调用 OpenAI Completion 接口失败'));
  }
}

async function callAnthropic({ config, apiKey, systemPrompt, userPrompt, temperature = 0.2 }) {
  if (!apiKey) {
    throw new Error('当前 Anthropic 提供商未配置 API Key');
  }

  const url = joinApiUrl(config.baseUrl, 'v1/messages');
  const payload = {
    model: config.model,
    temperature,
    max_tokens: 1024,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [
      { role: 'user', content: userPrompt },
    ],
  };

  try {
    const response = await runWithRetry(async () => axios.post(url, payload, await createRequestOptions({
      timeout: 60000,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    })));

    const content = normalizeAnthropicContent(response?.data?.content);
    if (!content) {
      throw new Error('模型未返回可用内容');
    }

    return {
      provider: 'anthropic',
      model: config.model,
      text: content,
    };
  } catch (error) {
    throw new Error(formatAxiosError(error, '调用 Anthropic 接口失败'));
  }
}

async function invokeAiProvider({ provider, config, apiKey, systemPrompt, userPrompt, temperature = 0.2 }) {
  if (provider === 'anthropic') {
    return callAnthropic({ config, apiKey, systemPrompt, userPrompt, temperature });
  }
  return callOpenAi({ config, apiKey, systemPrompt, userPrompt, temperature });
}

async function listOpenAiModels({ config, apiKey }) {
  if (!apiKey) {
    throw new Error('请先输入 API Key 后再获取模型列表');
  }

  try {
    const response = await runWithRetry(async () => axios.get(joinApiUrl(config.baseUrl, 'models'), await createRequestOptions({
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })));

    return Array.isArray(response?.data?.data)
      ? response.data.data
          .map((item) => ({ value: item.id, label: item.id }))
          .filter((item) => !!item.value)
      : [];
  } catch (error) {
    throw new Error(formatAxiosError(error, '获取 OpenAI 模型列表失败，请检查 Base URL、API Key 或网络代理设置'));
  }
}

async function listAnthropicModels({ config, apiKey }) {
  if (!apiKey) {
    throw new Error('请先输入 API Key 后再获取模型列表');
  }

  try {
    const response = await runWithRetry(async () => axios.get(joinApiUrl(config.baseUrl, 'v1/models'), await createRequestOptions({
      timeout: 30000,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })));

    return Array.isArray(response?.data?.data)
      ? response.data.data
          .map((item) => ({ value: item.id, label: item.display_name ? `${item.display_name} (${item.id})` : item.id }))
          .filter((item) => !!item.value)
      : [];
  } catch (error) {
    throw new Error(formatAxiosError(error, '获取 Anthropic 模型列表失败，请检查 Base URL、API Key 或网络代理设置'));
  }
}

async function listAiModels({ provider, config, apiKey }) {
  if (provider === 'anthropic') {
    return listAnthropicModels({ config, apiKey });
  }
  return listOpenAiModels({ config, apiKey });
}

module.exports = {
  invokeAiProvider,
  listAiModels,
};
