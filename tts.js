const providers = require('./providers');

// Sinh giọng đọc cho 1 đoạn text -- tự thử lần lượt các nhà có hỗ trợ TTS đã cấu hình
// (Gemini, OpenAI), nhà nào lỗi/hết quota thì tự chuyển sang nhà tiếp theo.
// Trả về { buffer, mimeType, providerLabel } để renderer biết định dạng audio mà phát đúng.
async function synthesizeSpeech(text, onLog) {
  return providers.synthesizeSpeechWithFailover(text, onLog);
}

module.exports = { synthesizeSpeech };
