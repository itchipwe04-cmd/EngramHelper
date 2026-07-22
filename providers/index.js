const config = require('../config');

const REGISTRY = {
  gemini: require('./gemini'),
  openai: require('./openai'),
  anthropic: require('./anthropic'),
  custom: require('./custom'),
};

function getProvider(id) {
  return REGISTRY[id];
}

// Gọi lần lượt các nhà đã cấu hình (theo đúng thứ tự ưu tiên cố định), nhà nào lỗi
// (hết quota, sai key, mạng...) thì tự chuyển sang nhà tiếp theo, không dừng hẳn.
// onLog (tuỳ chọn): ghi log chẩn đoán từng bước thử.
async function generateTextWithFailover(prompt, onLog) {
  const log = onLog || (() => {});
  const providerIds = config.getConfiguredTextProviders();

  if (!providerIds.length) {
    throw new Error('Chưa cấu hình API key cho bất kỳ nhà AI nào. Vào tray menu -> "Cài đặt AI..." để nhập.');
  }

  const errors = [];
  for (const id of providerIds) {
    const provider = getProvider(id);
    const cfg = config.get().providers[id];
    try {
      log(`Thử nhà "${provider.label}"...`);
      const text = await provider.generateText(prompt, cfg);
      log(`Nhà "${provider.label}" trả lời thành công.`);
      return { text, providerId: id, providerLabel: provider.label };
    } catch (err) {
      log(`Nhà "${provider.label}" lỗi: ${err.message || err}`);
      errors.push(`${provider.label}: ${err.message || err}`);
    }
  }

  throw new Error('Tất cả các nhà AI đã cấu hình đều lỗi:\n' + errors.join('\n'));
}

async function synthesizeSpeechWithFailover(text, onLog) {
  const log = onLog || (() => {});
  const providerIds = config.getConfiguredTtsProviders();

  if (!providerIds.length) {
    throw new Error('Chưa có nhà AI nào hỗ trợ đọc lên được cấu hình (cần Gemini hoặc OpenAI).');
  }

  const errors = [];
  for (const id of providerIds) {
    const provider = getProvider(id);
    const cfg = config.get().providers[id];
    try {
      log(`Thử đọc bằng "${provider.label}"...`);
      const result = await provider.synthesizeSpeech(text, cfg);
      log(`"${provider.label}" tạo giọng đọc thành công.`);
      return { ...result, providerId: id, providerLabel: provider.label };
    } catch (err) {
      log(`"${provider.label}" lỗi: ${err.message || err}`);
      errors.push(`${provider.label}: ${err.message || err}`);
    }
  }

  throw new Error('Tất cả các nhà AI hỗ trợ đọc lên đều lỗi:\n' + errors.join('\n'));
}

module.exports = { REGISTRY, getProvider, generateTextWithFailover, synthesizeSpeechWithFailover };
