// Adapter cho Gemini (Google) -- hỗ trợ cả text và TTS.

async function generateText(prompt, cfg) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Gemini: hết thời gian chờ (30s).');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Gemini lỗi (${res.status}): ${errText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini không trả về nội dung hợp lệ.');
  return text;
}

function parseRateFromMimeType(mimeType) {
  const m = /rate=(\d+)/.exec(mimeType || '');
  return m ? parseInt(m[1], 10) : 24000;
}

function pcmToWav(pcmBuffer, sampleRate, channels, bitsPerSample) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

async function synthesizeSpeech(text, cfg) {
  const trimmed = text.slice(0, 2000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.ttsModel}:generateContent?key=${cfg.apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: trimmed }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.ttsVoice } } },
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Gemini TTS: hết thời gian chờ (30s).');
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Gemini TTS lỗi (${res.status}): ${errText.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) throw new Error('Gemini TTS không trả về audio hợp lệ.');

  const pcmBuffer = Buffer.from(part.data, 'base64');
  const sampleRate = parseRateFromMimeType(part.mimeType);
  return { buffer: pcmToWav(pcmBuffer, sampleRate, 1, 16), mimeType: 'audio/wav' };
}

module.exports = { id: 'gemini', label: 'Gemini (Google)', supportsTTS: true, generateText, synthesizeSpeech };
