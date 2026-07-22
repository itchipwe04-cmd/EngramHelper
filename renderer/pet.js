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

// ---- Đọc lên (Text-to-Speech) -- dùng Gemini TTS, hỗ trợ mọi ngôn ngữ (không chỉ Anh/Việt) ----
let currentAudio = null;

function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();
}

// Dự phòng: giọng đọc offline có sẵn của Windows/Chromium, dùng khi Gemini TTS
// lỗi hoặc hết quota -- không hay bằng nhưng vẫn đọc được, không để tính năng chết hẳn.
// Nhận diện theo bảng chữ cái (rộng hơn chỉ Việt/Anh) để còn biết tìm đúng giọng cần thiếu.
const LANG_PATTERNS = [
  { code: 'vi-VN', name: 'Tiếng Việt', re: /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i },
  { code: 'zh-CN', name: 'Tiếng Trung', re: /[\u4e00-\u9fff]/ },
  { code: 'ja-JP', name: 'Tiếng Nhật', re: /[\u3040-\u30ff]/ },
  { code: 'ko-KR', name: 'Tiếng Hàn', re: /[\uac00-\ud7af]/ },
  { code: 'ru-RU', name: 'Tiếng Nga', re: /[\u0400-\u04FF]/ },
  { code: 'ar-SA', name: 'Tiếng Ả Rập', re: /[\u0600-\u06FF]/ },
  { code: 'th-TH', name: 'Tiếng Thái', re: /[\u0E00-\u0E7F]/ },
];

function detectLang(text) {
  for (const p of LANG_PATTERNS) {
    if (p.re.test(text)) return p;
  }
  return { code: 'en-US', name: 'Tiếng Anh' };
}

let cachedVoices = [];
window.speechSynthesis?.addEventListener('voiceschanged', () => {
  cachedVoices = window.speechSynthesis.getVoices();
});
cachedVoices = window.speechSynthesis?.getVoices() || [];

function hasVoiceFor(langCode) {
  const prefix = langCode.split('-')[0];
  return cachedVoices.some((v) => v.lang && v.lang.toLowerCase().startsWith(prefix));
}

// Đã hỏi cài giọng cho ngôn ngữ nào trong phiên này rồi thì không hỏi lại nữa (đỡ làm phiền)
const askedInstallFor = new Set();

function speakFallback(text) {
  if (!window.speechSynthesis) return false;
  const lang = detectLang(text);

  if (!hasVoiceFor(lang.code) && !askedInstallFor.has(lang.code)) {
    askedInstallFor.add(lang.code);
    const ok = window.confirm(
      `Máy chưa có giọng đọc cho ${lang.name}. Mở Windows Settings để cài thêm giọng đọc không?\n\n` +
      `(Windows sẽ tự tải khi bạn bấm "Add" trong đó -- app không tự cài được vì cần quyền quản trị máy.)`
    );
    if (ok) {
      window.engramAPI?.openExternal('ms-settings:speech');
    }
    // Vẫn đọc thử luôn bằng giọng mặc định hiện có, còn hơn không đọc gì
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang.code;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
  return true;
}

async function speak(text, btn) {
  if (!text) return;
  stopSpeaking(); // ngắt câu đang đọc dở nếu có, tránh đọc chồng

  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const result = await window.engramAPI.speakText(text);
    if (result.error) {
      const usedFallback = speakFallback(text);
      btn.textContent = usedFallback ? '🔉' : '⚠'; // 🔉 = đang dùng giọng dự phòng (Gemini TTS lỗi/hết quota)
      btn.title = usedFallback
        ? `Gemini TTS lỗi, đang dùng giọng dự phòng của Windows. Lý do: ${result.error}`
        : result.error;
      setTimeout(() => { btn.textContent = originalLabel; btn.title = 'Đọc lên'; }, 4000);
      return;
    }
    const audio = new Audio(`data:${result.mimeType || 'audio/wav'};base64,` + result.audioBase64);
    currentAudio = audio;
    audio.addEventListener('ended', () => { if (currentAudio === audio) currentAudio = null; });
    audio.play();
  } catch (err) {
    const usedFallback = speakFallback(text);
    btn.textContent = usedFallback ? '🔉' : '⚠';
    btn.title = usedFallback ? `Gemini TTS lỗi, đang dùng giọng dự phòng. Lý do: ${err.message || err}` : (err.message || String(err));
    setTimeout(() => { btn.textContent = originalLabel; btn.title = 'Đọc lên'; }, 4000);
  } finally {
    btn.disabled = false;
    if (btn.textContent === '...') btn.textContent = originalLabel;
  }
}

speakTextBtn.addEventListener('click', () => speak(popupText.textContent, speakTextBtn));
speakAnswerBtn.addEventListener('click', () => speak(popupAnswer.textContent, speakAnswerBtn));

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
      stopSpeaking();
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
  stopSpeaking(); // đóng popup thì ngắt luôn nếu đang đọc dở
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
