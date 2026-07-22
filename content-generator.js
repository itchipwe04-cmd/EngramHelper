const config = require('./config');
const providers = require('./providers');

const MARK = '@@@'; // dấu phân cách dùng chung cho mọi tác vụ, không phải ký tự hay gặp trong văn bản thường

// Gọi qua module điều phối nhiều nhà AI -- tự thử lần lượt theo thứ tự ưu tiên,
// nhà nào lỗi/hết quota thì tự chuyển sang nhà tiếp theo đã cấu hình.
async function callGeminiRaw(prompt) {
  const result = await providers.generateTextWithFailover(prompt);
  return result.text;
}

// Parse danh sách thẻ front/back theo dấu phân cách ${MARK}F<i>${MARK} / ${MARK}B<i>${MARK}.
// Không yêu cầu biết trước số lượng thẻ -- quét hết các cặp F/B có mặt trong text,
// bỏ qua cặp nào thiếu 1 trong 2 vế (an toàn hơn là để cả batch lỗi vì thiếu 1 thẻ).
function parseCardsDelimited(raw) {
  const fronts = {};
  const backs = {};

  const reF = new RegExp(`${MARK}F(\\d+)${MARK}\\s*\\n([\\s\\S]*?)(?=${MARK}[FB]\\d+${MARK}|$)`, 'g');
  const reB = new RegExp(`${MARK}B(\\d+)${MARK}\\s*\\n([\\s\\S]*?)(?=${MARK}[FB]\\d+${MARK}|$)`, 'g');

  let m;
  while ((m = reF.exec(raw)) !== null) fronts[m[1]] = m[2].trim();
  while ((m = reB.exec(raw)) !== null) backs[m[1]] = m[2].trim();

  const indices = Object.keys(fronts)
    .filter((i) => backs[i] !== undefined)
    .map(Number)
    .sort((a, b) => a - b);

  return indices.map((i) => ({ front: fronts[i], back: backs[i] }));
}

const CARD_FORMAT_INSTRUCTIONS = `Với MỖI thẻ, trả lời theo ĐÚNG định dạng sau (không dùng JSON, không markdown fence, không giải thích thêm):
${MARK}F<số thứ tự bắt đầu từ 0>${MARK}
<nội dung mặt trước của thẻ đó -- câu hỏi hoặc thuật ngữ cần ôn>
${MARK}B<cùng số thứ tự>${MARK}
<nội dung mặt sau -- câu trả lời hoặc giải thích ngắn gọn>

Lặp lại cặp F/B này cho từng thẻ, đánh số thứ tự tăng dần liên tục (0, 1, 2, ...), không bỏ số nào.`;

// Sinh bộ thẻ ôn tập CƠ BẢN NHẤT từ 1 chủ đề do người dùng nhập (lúc mới tạo chủ đề)
async function generateCardsFromTopic(topic) {
  const prompt = `Bạn là trợ lý soạn thẻ ôn tập kiểu spaced-repetition (giống Anki), có thể cho bất kỳ môn học nào (không chỉ tiếng Anh).
Chủ đề: "${topic}"

Đây là bước khởi tạo chủ đề -- chỉ cần 10 thẻ CƠ BẢN, NỀN TẢNG, QUAN TRỌNG NHẤT của chủ đề này (người mới bắt đầu học chủ đề này nên biết trước tiên). Người dùng có thể sinh thêm thẻ nâng cao/mở rộng sau.

Trước tiên, dòng đầu tiên trong câu trả lời phải là:
${MARK}TOPIC${MARK}
<tên chủ đề ngắn gọn bằng tiếng Việt>

Sau đó tới đúng 10 thẻ. ${CARD_FORMAT_INSTRUCTIONS}`;

  const raw = await callGeminiRaw(prompt);
  const topicMatch = raw.match(new RegExp(`${MARK}TOPIC${MARK}\\s*\\n([\\s\\S]*?)(?=${MARK}F0${MARK}|$)`));
  const cards = parseCardsDelimited(raw);

  return {
    topicLabel: topicMatch ? topicMatch[1].trim() : topic,
    cards,
  };
}

// Sinh thêm thẻ MỚI cho 1 chủ đề đã có sẵn, tránh lặp lại các thẻ đã tồn tại.
// existingFronts: string[] các "front" đã có (mẫu gần nhất, không nhất thiết toàn bộ)
// count: số thẻ muốn sinh thêm trong lần gọi này (nên để nhỏ, ví dụ 20-30, gọi nhiều lần nếu cần nhiều hơn)
async function generateMoreCards(topic, existingFronts, count) {
  const avoidList = existingFronts.length
    ? `Đã có sẵn các thẻ sau, TUYỆT ĐỐI KHÔNG lặp lại nội dung tương tự:\n${existingFronts.map((t) => `- ${t}`).join('\n')}\n`
    : '';

  const prompt = `Bạn là trợ lý soạn thẻ ôn tập kiểu spaced-repetition (giống Anki), có thể cho bất kỳ môn học nào (không chỉ tiếng Anh).
Chủ đề: "${topic}"

${avoidList}
Soạn thêm ${count} thẻ MỚI, khác hẳn danh sách đã có ở trên (mở rộng thêm về từ vựng/kiến thức khác trong cùng chủ đề, độ khó có thể tăng dần).

${CARD_FORMAT_INSTRUCTIONS}
Đúng ${count} thẻ.`;

  const raw = await callGeminiRaw(prompt);
  const cards = parseCardsDelimited(raw);
  return { cards };
}

// Phân tích nội dung giáo trình (đã trích xuất từ PDF/Word) -> chiến lược học + thẻ ôn tập ban đầu
async function analyzeCurriculum(rawText) {
  const trimmed = rawText.slice(0, 15000); // giới hạn để tránh prompt quá dài
  const prompt = `Bạn là trợ lý thiết kế lộ trình học tập. Dưới đây là nội dung trích từ 1 tài liệu/giáo trình do người dùng cung cấp:

"""
${trimmed}
"""

Nhiệm vụ:
1. Tóm tắt cấu trúc giáo trình thành các đơn vị/chương chính.
2. Đề xuất 1 chiến lược học hợp lý (thứ tự học, mức độ ưu tiên, nhịp độ ôn tập gợi ý).
3. Soạn 10-15 thẻ ôn tập (spaced-repetition) cho phần nội dung quan trọng/mở đầu của giáo trình.

Trả lời theo ĐÚNG định dạng sau (không dùng JSON, không markdown fence):
${MARK}TITLE${MARK}
<tên giáo trình/tài liệu, tự đặt dựa theo nội dung>
${MARK}UNITS${MARK}
<đơn vị/chương 1, mỗi đơn vị 1 dòng>
<đơn vị/chương 2>
...
${MARK}STRATEGY${MARK}
<đoạn văn ngắn 3-5 câu mô tả chiến lược học đề xuất, bằng tiếng Việt>
${MARK}CARDS${MARK}
${CARD_FORMAT_INSTRUCTIONS}`;

  const raw = await callGeminiRaw(prompt);

  const titleMatch = raw.match(new RegExp(`${MARK}TITLE${MARK}\\s*\\n([\\s\\S]*?)(?=${MARK}UNITS${MARK}|$)`));
  const unitsMatch = raw.match(new RegExp(`${MARK}UNITS${MARK}\\s*\\n([\\s\\S]*?)(?=${MARK}STRATEGY${MARK}|$)`));
  const strategyMatch = raw.match(new RegExp(`${MARK}STRATEGY${MARK}\\s*\\n([\\s\\S]*?)(?=${MARK}CARDS${MARK}|$)`));
  const cardsSection = raw.match(new RegExp(`${MARK}CARDS${MARK}\\s*\\n([\\s\\S]*)$`));

  const units = unitsMatch
    ? unitsMatch[1].split('\n').map((s) => s.trim()).filter(Boolean)
    : [];
  const cards = cardsSection ? parseCardsDelimited(cardsSection[1]) : [];

  return {
    curriculumTitle: titleMatch ? titleMatch[1].trim() : 'Giáo trình',
    units,
    strategy: strategyMatch ? strategyMatch[1].trim() : '',
    cards,
  };
}

// Dịch 1 đoạn text (tự nhận diện Anh<->Việt, hoặc ngôn ngữ khác)
// Dịch 1 đoạn text sang targetLang (ngôn ngữ đích do người dùng chọn, vd "Tiếng Việt",
// "Tiếng Trung", "Tiếng Nga"...). Nếu văn bản gốc đã đúng bằng targetLang rồi thì
// dịch sang tiếng Anh làm phương án dự phòng (đỡ dịch 1 đoạn ra chính nó).
async function translateText(text, targetLang) {
  const trimmed = text.slice(0, 3000);
  const lang = targetLang || 'Tiếng Việt';
  const prompt = `Dịch đoạn text sau sang ${lang}. Nếu văn bản gốc đã đúng là ${lang} rồi thì dịch sang tiếng Anh thay vào đó.

Đoạn cần dịch:
${trimmed}

Trả lời theo ĐÚNG định dạng sau, không thêm giải thích hay markdown nào khác:
${MARK}LANG${MARK}
<tên ngôn ngữ gốc của đoạn text, ngắn gọn, vd: Tiếng Anh>
${MARK}TRANSLATED${MARK}
<bản dịch, chỉ text thuần>`;

  const raw = await callGeminiRaw(prompt);
  const langMatch = raw.match(new RegExp(`${MARK}LANG${MARK}\\s*\\n([\\s\\S]*?)(?=${MARK}TRANSLATED${MARK}|$)`));
  const transMatch = raw.match(new RegExp(`${MARK}TRANSLATED${MARK}\\s*\\n([\\s\\S]*)$`));

  return {
    sourceLang: langMatch ? langMatch[1].trim() : '',
    translated: transMatch ? transMatch[1].trim() : raw.trim(),
  };
}

// Dịch hàng loạt nhiều dòng cùng lúc, giữ đúng thứ tự (dùng cho dịch màn hình).
// texts: string[] -> trả về string[] cùng độ dài, cùng thứ tự
// Dịch hàng loạt nhiều dòng cùng lúc, giữ đúng thứ tự (dùng cho dịch màn hình), sang targetLang.
// texts: string[] -> trả về string[] cùng độ dài, cùng thứ tự
async function translateBatch(texts, targetLang) {
  if (!texts.length) return [];
  const lang = targetLang || 'Tiếng Việt';
  const numbered = texts.map((t, i) => `${MARK}${i}${MARK}\n${t}`).join('\n');
  const prompt = `Dịch từng đoạn dưới đây sang ${lang}. Nếu 1 đoạn đã đúng là ${lang} rồi thì dịch đoạn đó sang tiếng Anh thay vào đó.

Mỗi đoạn bắt đầu bằng dòng đánh dấu dạng ${MARK}<số>${MARK} rồi tới nội dung cần dịch của đoạn đó.
Trả lời theo ĐÚNG định dạng sau cho từng đoạn, giữ nguyên số thứ tự, không bỏ sót, không gộp đoạn, không thêm giải thích hay markdown nào khác:

${MARK}<số>${MARK}
<bản dịch của đoạn đó, chỉ 1 đoạn text thuần, không cần giữ dấu ngoặc kép bao ngoài>

Danh sách cần dịch:
${numbered}`;

  const raw = await callGeminiRaw(prompt);

  const result = new Array(texts.length).fill(null);
  const re = new RegExp(`${MARK}(\\d+)${MARK}\\s*\\n([\\s\\S]*?)(?=${MARK}\\d+${MARK}|$)`, 'g');
  let m;
  while ((m = re.exec(raw)) !== null) {
    const idx = parseInt(m[1], 10);
    if (idx >= 0 && idx < result.length) {
      result[idx] = m[2].trim();
    }
  }

  return texts.map((orig, i) => (result[i] ? result[i] : orig));
}

module.exports = { generateCardsFromTopic, generateMoreCards, analyzeCurriculum, translateText, translateBatch };
