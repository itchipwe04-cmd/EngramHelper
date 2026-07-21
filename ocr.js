const path = require('path');
const { createWorker } = require('tesseract.js');

let worker = null;
let workerInitError = null;
let cacheDir = null;

const TESSDATA_PATH = path.join(__dirname, 'tessdata'); // file .gz đóng gói sẵn, chỉ đọc

// Gọi 1 lần lúc app khởi động, truyền vào thư mục ghi được (userData) để giải nén cache
function init(userCacheDir) {
  cacheDir = userCacheDir;
}

async function getWorker() {
  if (worker) return worker;
  if (workerInitError) throw workerInitError; // đã fail trước đó, không thử lại vô ích

  try {
    worker = await createWorker(['eng', 'vie'], 1, {
      langPath: TESSDATA_PATH,       // đọc file .gz đóng gói sẵn trong app -- không cần mạng
      cachePath: cacheDir || TESSDATA_PATH, // giải nén ra thư mục ghi được (userData)
      gzip: true,
    });
    return worker;
  } catch (err) {
    workerInitError = new Error('Không khởi tạo được OCR: ' + (err.message || err));
    throw workerInitError;
  }
}

// Nhận diện 1 dòng có phải nội dung nên bỏ qua (không dịch) hay không:
// code, số/giá tiền, chuỗi trông giống mật khẩu/token, đường dẫn/URL kỹ thuật...
function shouldSkip(text) {
  const t = text.trim();
  if (t.length < 2) return true;

  if (/^[\d\s\-\+\(\)\.\,\$₫%\/:]+$/.test(t)) return true;

  if (/[{};=<>]|=>|::|\/\/|#include|function\s*\(|^(const|let|var|def|class|import|return|if\s*\(|for\s*\(|public|private|static|void)\b/i.test(t)) return true;

  if (/^[A-Za-z0-9_\-]{12,}$/.test(t) && /[0-9]/.test(t) && /[a-zA-Z]/.test(t)) return true;

  if (/^(https?:\/\/|[a-zA-Z]:\\|\/[a-zA-Z0-9_\-\/]+)/.test(t)) return true;

  if (!/\s/.test(t) && t.length > 20) return true;

  return false;
}

// Gộp các dòng OCR liền kề (cách nhau ít, thẳng cột) thành 1 khối đoạn văn,
// để dịch nguyên câu/đoạn thay vì từng dòng rời rạc (tránh dịch ngắt ngữ cảnh)
// và để khung hiển thị to hơn, đỡ chồng lấn lên nhau.
function mergeLinesToBlocks(lines) {
  const sorted = [...lines].sort((a, b) => a.y - b.y || a.x - b.x);
  const blocks = [];
  let current = null;

  for (const line of sorted) {
    if (current) {
      const avgLineHeight = current.height / current.lineCount;
      const gap = line.y - (current.y + current.height);
      const horizontalClose = Math.abs(line.x - current.x) < Math.max(current.width, line.width) * 0.6 + 20;

      if (gap <= avgLineHeight * 0.9 && gap > -avgLineHeight && horizontalClose) {
        // Cùng đoạn -> gộp vào khối hiện tại
        current.text += ' ' + line.text;
        current.x = Math.min(current.x, line.x);
        current.y = Math.min(current.y, line.y);
        current.right = Math.max(current.right, line.x + line.width);
        current.bottom = Math.max(current.bottom, line.y + line.height);
        current.width = current.right - current.x;
        current.height = current.bottom - current.y;
        current.lineCount += 1;
        continue;
      }
    }
    // Bắt đầu khối mới
    if (current) blocks.push(current);
    current = {
      text: line.text,
      x: line.x,
      y: line.y,
      right: line.x + line.width,
      bottom: line.y + line.height,
      width: line.width,
      height: line.height,
      lineCount: 1,
    };
  }
  if (current) blocks.push(current);

  return blocks.map((b) => ({ text: b.text, x: b.x, y: b.y, width: b.width, height: b.height, lineCount: b.lineCount }));
}

// Chụp OCR ảnh (buffer PNG) -> trả về danh sách khối đoạn văn kèm toạ độ,
// đã loại bỏ trước các dòng nghi là code/số nhạy cảm, đã gộp dòng liền kề thành đoạn.
// onLog (tuỳ chọn): callback ghi log chẩn đoán, nhận (message: string)
async function ocrScreenshot(pngBuffer, onLog) {
  const log = onLog || (() => {});
  const w = await getWorker();
  const { data } = await w.recognize(pngBuffer);

  const rawLines = data.lines || [];
  log(`OCR thô: ${rawLines.length} dòng nhận diện được`);

  const lines = rawLines
    .map((l) => ({
      text: l.text.trim(),
      x: l.bbox.x0,
      y: l.bbox.y0,
      width: l.bbox.x1 - l.bbox.x0,
      height: l.bbox.y1 - l.bbox.y0,
      confidence: l.confidence,
    }))
    .filter((l) => l.text.length > 0 && l.confidence > 30 && !shouldSkip(l.text));

  log(`Sau khi lọc (rỗng/độ tin cậy thấp/nghi code-số): còn ${lines.length} dòng`);

  const blocks = mergeLinesToBlocks(lines);
  log(`Sau khi gộp đoạn: còn ${blocks.length} khối`);

  return blocks;
}

async function terminate() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

module.exports = { init, ocrScreenshot, terminate, shouldSkip, mergeLinesToBlocks };
