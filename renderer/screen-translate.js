const screenshotEl = document.getElementById('screenshot');
const statusText = document.getElementById('statusText');
const closeBtn = document.getElementById('closeBtn');
const boxesContainer = document.getElementById('boxes');

window.screenTranslateAPI.onBackground((dataUrl) => {
  screenshotEl.src = dataUrl;
  statusText.textContent = 'Đã chụp xong, đang phân tích...';
});

window.screenTranslateAPI.onStatus((msg) => {
  statusText.textContent = msg;
});

window.screenTranslateAPI.onResult((data) => {
  if (!data.boxes.length) {
    statusText.textContent = data.note || 'Không có gì để dịch.';
    return;
  }

  statusText.textContent = `Đã dịch ${data.boxes.length} đoạn — bấm "Đóng" hoặc Esc để thoát.`;

  // Vẽ theo thứ tự từ trên xuống để box sau (thường thấp hơn) đè lên trên nếu lỡ còn chồng chút,
  // đỡ bị che mất chữ của box phía trên.
  const sorted = [...data.boxes].sort((a, b) => a.y - b.y);

  sorted.forEach((b, i) => {
    const div = document.createElement('div');
    div.className = 'box';
    div.style.left = b.x + 'px';
    div.style.top = b.y + 'px';
    div.style.width = Math.max(b.width, 40) + 'px';
    div.style.zIndex = String(100 + i);
    div.textContent = b.translated;
    div.title = 'Gốc: ' + b.original;

    // Ước lượng cỡ chữ ban đầu theo chiều cao trung bình MỖI DÒNG gốc (đã gộp đoạn nên
    // 1 khối có thể nhiều dòng) -- chính xác hơn nhiều so với lấy nguyên chiều cao khối.
    const perLineHeight = b.height / Math.max(b.lineCount || 1, 1);
    let fontSize = Math.max(11, Math.min(perLineHeight * 0.72, 22));
    div.style.fontSize = fontSize + 'px';
    div.style.minHeight = b.height + 'px';

    boxesContainer.appendChild(div);

    // Sau khi chèn vào DOM, đo thử: nếu bản dịch dài hơn khung gốc quá nhiều
    // (dễ xảy ra vì tiếng Việt/Anh không dài bằng nhau), thu nhỏ dần cỡ chữ cho vừa,
    // thay vì để nó tràn ra đè lên khối bên dưới.
    const maxAllowedHeight = b.height * 1.7; // cho phép nới rộng hơn 1 chút, quá thì mới thu nhỏ chữ
    let guard = 0;
    while (div.scrollHeight > maxAllowedHeight && fontSize > 9 && guard < 12) {
      fontSize -= 1;
      div.style.fontSize = fontSize + 'px';
      guard++;
    }
  });
});

function closeWindow() { window.screenTranslateAPI.close(); }

closeBtn.addEventListener('click', closeWindow);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeWindow(); });
