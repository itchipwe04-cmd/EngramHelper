// Adapter tổng quát cho các dịch vụ "OpenAI-compatible" (DeepSeek, Qwen, Kimi, GLM,
// hay bất kỳ AI nào dùng chung định dạng /chat/completions của OpenAI).
// Chỉ hỗ trợ text -- các nhà này không chuẩn hoá API TTS nên chưa hỗ trợ đọc lên.

async function generateText(prompt, cfg) {
  const baseUrl = (cfg.baseUrl || '').replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`${cfg.label || 'Custom'}: hết thời gian chờ (30s).`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`${cfg.label || 'Custom'} lỗi (${res.status}): ${errText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${cfg.label || 'Custom'} không trả về nội dung hợp lệ.`);
  return text;
}

module.exports = { id: 'custom', label: 'Tuỳ chỉnh (OpenAI-compatible)', supportsTTS: false, generateText };
