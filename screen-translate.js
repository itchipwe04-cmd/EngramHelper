const { desktopCapturer, screen } = require('electron');
const ocr = require('./ocr');
const contentGenerator = require('./content-generator');
const config = require('./config');

// Bước 1: chỉ chụp màn hình. Phải gọi TRƯỚC khi tạo/hiện bất kỳ cửa sổ dịch nào,
// nếu không cửa sổ đó sẽ tự lọt vào chính bức ảnh chụp.
async function captureScreenshot() {
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.size;
  const scaleFactor = primary.scaleFactor || 1;
  const captureWidth = Math.round(width * scaleFactor);
  const captureHeight = Math.round(height * scaleFactor);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: captureWidth, height: captureHeight },
  });
  const source = sources[0]; // đơn giản hoá: chỉ xử lý màn hình chính
  if (!source) throw new Error('Không chụp được màn hình.');

  return {
    pngBuffer: source.thumbnail.toPNG(),
    dataUrl: source.thumbnail.toDataURL(),
    scaleFactor,
    logicalWidth: width,
    logicalHeight: height,
  };
}

// Bước 2: OCR (local) + lọc + dịch hàng loạt. Chạy sau khi cửa sổ đã hiện lên
// (ảnh chụp đã có sẵn từ bước 1 rồi, không bị ảnh hưởng gì nữa).
// onLog (tuỳ chọn): ghi chi tiết chẩn đoán ra debug.log, khác với onStatus (hiện cho người dùng thấy)
async function ocrAndTranslate(shot, onStatus, onLog) {
  const log = onLog || (() => {});
  onStatus && onStatus('Đang nhận diện chữ (OCR chạy trên máy, không gửi ảnh đi đâu)...');
  log(`Bắt đầu OCR, kích thước ảnh gốc: ${shot.logicalWidth}x${shot.logicalHeight}, scaleFactor: ${shot.scaleFactor}`);
  const lines = await ocr.ocrScreenshot(shot.pngBuffer, log);

  if (!lines.length) {
    return { boxes: [], note: 'Không tìm thấy đoạn chữ nào để dịch trên màn hình hiện tại.' };
  }

  onStatus && onStatus(`Đang dịch ${lines.length} đoạn chữ...`);
  const translations = await contentGenerator.translateBatch(lines.map((l) => l.text), config.get().targetLanguage);

  const boxes = lines.map((l, i) => ({
    x: l.x / shot.scaleFactor,
    y: l.y / shot.scaleFactor,
    width: l.width / shot.scaleFactor,
    height: l.height / shot.scaleFactor,
    lineCount: l.lineCount || 1,
    original: l.text,
    translated: translations[i],
  }));

  return { boxes };
}

module.exports = { captureScreenshot, ocrAndTranslate };
