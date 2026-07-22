const fs = require('fs');
const path = require('path');

let configPath = null;
let config = null;

// Thứ tự ưu tiên cố định khi tự động chuyển nhà lúc 1 nhà bị lỗi/hết quota.
// Gemini trước (nhà gốc, người dùng đã quen), OpenAI kế (rộng, có TTS),
// Claude sau (không có TTS, chỉ dùng cho text), Custom cuối (nhà tự khai báo).
const TEXT_PROVIDER_ORDER = ['gemini', 'openai', 'anthropic', 'custom'];
const TTS_PROVIDER_ORDER = ['gemini', 'openai']; // chỉ 2 nhà này có TTS chuẩn hoá được

const DEFAULT_CONFIG = {
  targetLanguage: 'Tiếng Việt',
  providers: {
    gemini: {
      apiKey: '',
      model: 'gemini-flash-latest',
      ttsModel: 'gemini-3.1-flash-tts-preview',
      ttsVoice: 'Kore',
    },
    openai: {
      apiKey: '',
      model: 'gpt-4o-mini',
      ttsModel: 'tts-1',
      ttsVoice: 'alloy',
    },
    anthropic: {
      apiKey: '',
      model: 'claude-sonnet-5',
    },
    custom: {
      label: '',      // tên hiển thị, vd "DeepSeek", "Qwen"
      baseUrl: '',     // vd https://api.deepseek.com/v1
      apiKey: '',
      model: '',
    },
  },
};

function deepMergeDefaults(target, defaults) {
  const out = { ...defaults, ...target };
  for (const key of Object.keys(defaults)) {
    if (defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      out[key] = deepMergeDefaults(target?.[key] || {}, defaults[key]);
    }
  }
  return out;
}

function init(userDataPath) {
  configPath = path.join(userDataPath, 'config.json');
  if (fs.existsSync(configPath)) {
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config = deepMergeDefaults(loaded, DEFAULT_CONFIG);

    // Tương thích ngược: cấu hình cũ (bản chỉ có 1 nhà Gemini, field phẳng)
    // -> chuyển vào đúng chỗ trong providers.gemini, không mất key cũ.
    if (loaded.geminiApiKey && !config.providers.gemini.apiKey) {
      config.providers.gemini.apiKey = loaded.geminiApiKey;
      config.providers.gemini.model = loaded.geminiModel || config.providers.gemini.model;
      config.providers.gemini.ttsModel = loaded.geminiTtsModel || config.providers.gemini.ttsModel;
      config.providers.gemini.ttsVoice = loaded.ttsVoice || config.providers.gemini.ttsVoice;
    }
    save();
  } else {
    config = { ...DEFAULT_CONFIG, providers: JSON.parse(JSON.stringify(DEFAULT_CONFIG.providers)) };
    save();
  }
}

function save() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function get() {
  return config;
}

function setTargetLanguage(lang) {
  config.targetLanguage = lang.trim() || DEFAULT_CONFIG.targetLanguage;
  save();
}

function setProviderConfig(id, fields) {
  if (!config.providers[id]) return;
  Object.keys(fields).forEach((k) => {
    if (fields[k] !== undefined && fields[k] !== null) {
      config.providers[id][k] = fields[k];
    }
  });
  save();
}

function isProviderConfigured(id) {
  const p = config.providers[id];
  if (!p) return false;
  if (id === 'custom') return !!(p.apiKey && p.baseUrl && p.model);
  return !!p.apiKey;
}

// Danh sách nhà đã cấu hình đủ key, theo đúng thứ tự ưu tiên cố định -- dùng để
// tự động thử lần lượt khi 1 nhà bị lỗi/hết quota (auto-failover).
function getConfiguredTextProviders() {
  return TEXT_PROVIDER_ORDER.filter(isProviderConfigured);
}

function getConfiguredTtsProviders() {
  return TTS_PROVIDER_ORDER.filter(isProviderConfigured);
}

function hasAnyApiKey() {
  return getConfiguredTextProviders().length > 0;
}

module.exports = {
  init,
  get,
  save,
  setTargetLanguage,
  setProviderConfig,
  isProviderConfigured,
  getConfiguredTextProviders,
  getConfiguredTtsProviders,
  hasAnyApiKey,
  TEXT_PROVIDER_ORDER,
  TTS_PROVIDER_ORDER,
};
