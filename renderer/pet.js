const pet = document.getElementById('pet');
const badge = document.getElementById('badge');
const bubble = document.getElementById('bubble');
const popup = document.getElementById('popup');
const popupHeader = document.getElementById('popupHeader');
const popupLabel = document.getElementById('popupLabel');
const popupXBtn = document.getElementById('popupXBtn');
const popupText = document.getElementById('popupText');
const popupAnswer = document.getElementById('popupAnswer');
const answerRow = document.getElementById('answerRow');
const speakTextBtn = document.getElementById('speakTextBtn');
const speakAnswerBtn = document.getElementById('speakAnswerBtn');
const revealBtn = document.getElementById('revealBtn');
const yourAnswerInput = document.getElementById('yourAnswerInput');
const ratingArea = document.getElementById('ratingArea');
const closeBtn = document.getElementById('closeBtn');

// ---- Đọc lên (Text-to-Speech) -- dùng Web Speech API sẵn có của Chromium, không cần thư viện ngoài ----
// Đoán ngôn ngữ theo dấu tiếng Việt để chọn giọng đọc phù hợp (đủ dùng cho mục đích này).
function detectLangCode(text) {
  const viChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  return viChars.test(text) ? 'vi-VN' : 'en-US';
}

function speak(text) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel(); // ngắt câu đang đọc dở nếu có, tránh đọc chồng
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = detectLangCode(text);
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

speakTextBtn.addEventListener('click', () => speak(popupText.textContent));
speakAnswerBtn.addEventListener('click', () => speak(popupAnswer.textContent));

let currentDueCard = null; // thẻ đang chờ nhắc (đến hạn theo FSRS)
let activeCard = null;     // thẻ đang mở trong popup
let activeIsDue = false;
let answered = false;

// ---- Click-through: chỉ chặn chuột khi con trỏ đang ở trên pet/popup/bubble ----
// Dùng theo dõi vị trí chuột liên tục (thay vì chỉ mouseenter/mouseleave) vì
// khi cửa sổ khác đang được focus, sự kiện mouseleave có thể bị trễ/bỏ lỡ,
// khiến cửa sổ trong suốt kẹt ở trạng thái "chặn toàn màn hình" (đơ máy).
let mouseBlocking = false;
let lastMoveCheck = Date.now();

function isOverInteractive(target) {
  return !!(target && (target.closest('#pet') || target.closest('#popup') || target.closest('#bubble')));
}

function setBlocking(shouldBlock) {
  if (shouldBlock === mouseBlocking) return;
  mouseBlocking = shouldBlock;
  window.engramAPI?.setIgnoreMouseEvents(!shouldBlock, { forward: true });
}

document.addEventListener('mousemove', (e) => {
  lastMoveCheck = Date.now();
  const el = document.elementFromPoint(e.clientX, e.clientY);
  setBlocking(isOverInteractive(el));
});

// Lưới an toàn: nếu vì lý do gì đó (cửa sổ mất focus, sự kiện bị trễ...) trạng thái
// "chặn" bị kẹt quá lâu mà không có xác nhận chuột vẫn đang ở trên pet/popup,
// tự động thả về xuyên click để không làm treo thao tác toàn màn hình.
setInterval(() => {
  if (mouseBlocking && Date.now() - lastMoveCheck > 1500) {
    setBlocking(false);
  }
}, 1000);

setBlocking(false);

// ---- Random walk ----
let x = 200, y = 200;
let targetX = x, targetY = y;
const screenW = window.innerWidth;
const screenH = window.innerHeight;
const petSize = 72;
const margin = 40;

function pickNewTarget() {
  targetX = margin + Math.random() * (screenW - petSize - margin * 2);
  targetY = margin + Math.random() * (screenH - petSize - margin * 2);
}
pickNewTarget();

function positionFollowers() {
  bubble.style.left = Math.min(x + 78, screenW - 220) + 'px';
  bubble.style.top = Math.max(y - 4, 4) + 'px';
}

function tick() {
  const dx = targetX - x;
  const dy = targetY - y;
  const dist = Math.hypot(dx, dy);

  if (dist < 4) {
    pet.classList.remove('walking');
    setTimeout(pickNewTarget, 1500 + Math.random() * 3000);
  } else {
    pet.classList.add('walking');
    const speed = 1.2;
    x += (dx / dist) * speed;
    y += (dy / dist) * speed;
    pet.classList.toggle('flip', dx < 0);
    pet.style.left = x + 'px';
    pet.style.top = y + 'px';
    positionFollowers();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---- Nhận thẻ đến hạn từ main process (theo lịch FSRS) ----
window.engramAPI?.onDueCard((card) => {
  currentDueCard = card;
  badge.classList.add('show');
  bubble.textContent = 'Có 1 từ cần ôn — bấm vào tôi';
  positionFollowers();
  bubble.classList.add('visible');
  // tự mờ đi sau 8s nếu không ai bấm, nhưng badge vẫn còn để nhắc nhẹ
  setTimeout(() => bubble.classList.remove('visible'), 8000);
});

bubble.addEventListener('click', () => {
  bubble.classList.remove('visible');
  if (currentDueCard) openPopup(currentDueCard, true);
});

// ---- Bấm vào linh thú ----
pet.addEventListener('click', () => {
  if (currentDueCard) {
    bubble.classList.remove('visible');
    openPopup(currentDueCard, true);
  } else {
    window.engramAPI?.getRandomCard().then((card) => {
      if (card) openPopup(card, false);
    });
  }
});

function openPopup(card, isDue) {
  activeCard = card;
  activeIsDue = isDue;
  answered = false;

  popup.style.maxWidth = '300px'; // ôn tập: câu ngắn, giữ hẹp như cũ
  popupLabel.textContent = isDue ? 'Đến hạn ôn tập' : 'Ôn tự do';
  popupText.textContent = card.front;
  answerRow.style.display = 'none';
  ratingArea.style.display = 'none';
  revealBtn.style.display = 'inline-block';
  yourAnswerInput.style.display = 'block';
  yourAnswerInput.value = '';

  popup.style.left = Math.min(x + 80, screenW - 320) + 'px';
  popup.style.top = Math.max(y - 40, 10) + 'px';
  popup.style.display = 'block';

  // Cửa sổ linh thú mặc định không nhận focus bàn phím (để khỏi cướp focus app khác
  // lúc đi dạo) -> cần bật tạm lúc này thì mới gõ được vào ô nhập đáp án.
  window.engramAPI?.setFocusable(true);
  setTimeout(() => yourAnswerInput.focus(), 0);
}

// ---- Dịch nhanh: chuột phải vào linh thú -> dịch nội dung clipboard hiện tại ----
const TRANSLATE_WIDTH = 560; // hiển thị ngang, đỡ phải cuộn dọc như khung hẹp mặc định

pet.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  activeCard = null;
  activeIsDue = false;

  popup.style.maxWidth = TRANSLATE_WIDTH + 'px';
  popupLabel.textContent = 'Dịch nhanh';
  popupText.textContent = 'Đang dịch...';
  answerRow.style.display = 'none';
  ratingArea.style.display = 'none';
  revealBtn.style.display = 'none';
  yourAnswerInput.style.display = 'none';

  popup.style.left = Math.min(e.clientX + 20, screenW - TRANSLATE_WIDTH - 20) + 'px';
  popup.style.top = Math.max(e.clientY - 20, 10) + 'px';
  popup.style.display = 'block';
  window.engramAPI?.setFocusable(true); // để phím Esc đóng popup nhận được

  window.engramAPI?.translateClipboard().then((result) => {
    if (result.error) {
      popupText.textContent = result.error;
      return;
    }
    popupLabel.textContent = `Dịch nhanh (${result.sourceLang})`;
    popupText.textContent = result.original;
    popupAnswer.textContent = result.translated;
    answerRow.style.display = 'flex';
  });
});

revealBtn.addEventListener('click', () => {
  if (!activeCard) return;
  window.engramAPI?.getAnswer(activeCard.id).then((ans) => {
    popupAnswer.textContent = ans;
    answerRow.style.display = 'flex';
    ratingArea.style.display = 'block';
    revealBtn.style.display = 'none';
  });
});

document.querySelectorAll('.rate').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!activeCard) return;
    const rating = Number(btn.dataset.rating);
    window.engramAPI?.answerCard(activeCard.id, rating).then(() => {
      answered = true;
      popup.style.display = 'none';
      window.speechSynthesis?.cancel();
      window.engramAPI?.setFocusable(false);
      if (activeIsDue) {
        badge.classList.remove('show');
        currentDueCard = null;
      }
      setBlocking(false);
    });
  });
});

function closePopup() {
  if (popup.style.display === 'none') return;
  popup.style.display = 'none';
  window.speechSynthesis?.cancel(); // đóng popup thì ngắt luôn nếu đang đọc dở
  window.engramAPI?.setFocusable(false); // trả lại trạng thái không cướp focus app khác
  // Nếu đóng mà chưa chấm điểm 1 thẻ đến hạn -> nhả pending để main còn nhắc lại sau
  if (activeIsDue && !answered && activeCard) {
    window.engramAPI?.releasePending(activeCard.id);
  }
  setBlocking(false);
}

closeBtn.addEventListener('click', closePopup);
popupXBtn.addEventListener('click', closePopup);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePopup();
});

// ---- Kéo thả popup bằng thanh tiêu đề ----
let dragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

popupHeader.addEventListener('mousedown', (e) => {
  dragging = true;
  const rect = popup.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const newLeft = Math.min(Math.max(e.clientX - dragOffsetX, 0), screenW - popup.offsetWidth);
  const newTop = Math.min(Math.max(e.clientY - dragOffsetY, 0), screenH - popup.offsetHeight);
  popup.style.left = newLeft + 'px';
  popup.style.top = newTop + 'px';
});

document.addEventListener('mouseup', () => {
  dragging = false;
});
