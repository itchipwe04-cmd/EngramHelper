// Adapter cho OpenAI -- hỗ trợ cả text và TTS.

async function generateText(prompt, cfg) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
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
    if (err.name === 'AbortError') throw new Error('OpenAI: hết thời gian chờ (30s).');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`OpenAI lỗi (${res.status}): ${errText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI không trả về nội dung hợp lệ.');
  return text;
}

async function synthesizeSpeech(text, cfg) {
  const trimmed = text.slice(0, 2000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.ttsModel,
        voice: cfg.ttsVoice,
        input: trimmed,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('OpenAI TTS: hết thời gian chờ (30s).');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`OpenAI TTS lỗi (${res.status}): ${errText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: 'audio/mpeg' };
}

module.exports = { id: 'openai', label: 'OpenAI', supportsTTS: true, generateText, synthesizeSpeech };
