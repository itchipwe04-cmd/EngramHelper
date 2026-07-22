// Adapter cho Claude (Anthropic) -- CHỈ hỗ trợ text, Anthropic không có API text-to-speech.

async function generateText(prompt, cfg) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Claude: hết thời gian chờ (30s).');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Claude lỗi (${res.status}): ${errText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Claude không trả về nội dung hợp lệ.');
  return text;
}

module.exports = { id: 'anthropic', label: 'Claude (Anthropic)', supportsTTS: false, generateText };
