const axios = require('axios');
const crypto = require('crypto');
const BAIDU_TRANSLATE_URL = 'https://fanyi-api.baidu.com/api/trans/vip/translate';

function signBaiduPayload(appId, text, salt, apiKey) {
  return crypto.createHash('md5').update(`${appId}${text}${salt}${apiKey}`).digest('hex');
}

async function translateWithBaidu({ appId, apiKey, text, from = 'auto', to = 'en' }) {
  const trimmedText = String(text || '').trim();
  if (!trimmedText) {
    throw new Error('请输入要翻译的文本。');
  }
  if (!appId || !apiKey) {
    throw new Error('请先配置百度翻译凭证。');
  }

  const salt = `${Date.now()}`;
  const sign = signBaiduPayload(appId, trimmedText, salt, apiKey);
  const payload = new URLSearchParams({
    q: trimmedText,
    from,
    to,
    appid: appId,
    salt,
    sign,
  });

  try {
    const response = await axios.post(BAIDU_TRANSLATE_URL, payload.toString(), {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response?.data || {};
    if (data.error_code || data.code) {
      throw new Error(data.error_msg || data.message || data.code || data.error_code);
    }

    const resultText = Array.isArray(data.trans_result)
      ? data.trans_result.map((item) => item?.dst || item?.text || '').filter(Boolean).join('\n').trim()
      : String(data.translation || data.result || '').trim();

    if (!resultText) {
      throw new Error('百度翻译未返回结果。');
    }

    return {
      provider: 'baidu',
      detectedSourceLanguage: data.from || data.source || from,
      targetLanguage: data.to || data.target || to,
      text: resultText,
    };
  } catch (error) {
    const remoteMessage = error?.response?.data?.error_msg;
    throw new Error(`调用百度翻译失败：${remoteMessage || error?.message || '未知错误'}`);
  }
}

module.exports = {
  translateWithBaidu,
};
