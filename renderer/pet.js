const pet = document.getElementById('pet');
const badge = document.getElementById('badge');
const bubble = document.getElementById('bubble');
const popup = document.getElementById('popup');
const popupLabel = document.getElementById('popupLabel');
const popupText = document.getElementById('popupText');
const popupAnswer = document.getElementById('popupAnswer');
const revealBtn = document.getElementById('revealBtn');
const ratingArea = document.getElementById('ratingArea');
const closeBtn = document.getElementById('closeBtn');

let currentDueCard = null; // thẻ đang chờ nhắc (đến hạn theo FSRS)
let activeCard = null;     // thẻ đang mở trong popup
let activeIsDue = false;
let answered = false;

// ---- Click-through: chỉ chặn chuột khi hover vào pet hoặc popup/bubble ----
function blockClicks() { window.engramAPI?.setIgnoreMouseEvents(false); }
function passClicks() { window.engramAPI?.setIgnoreMouseEvents(true); }

[pet, popup, bubble].forEach(el => {
  el.addEventListener('mouseenter', blockClicks);
  el.addEventListener('mouseleave', () => {
    setTimeout(() => {
      if (![pet, popup, bubble].some(e => e.matches(':hover'))) passClicks();
    }, 30);
  });
});
passClicks();

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

  popupLabel.textContent = isDue ? 'Đến hạn ôn tập' : 'Ôn tự do';
  popupText.textContent = card.front;
  popupAnswer.style.display = 'none';
  ratingArea.style.display = 'none';
  revealBtn.style.display = 'inline-block';

  popup.style.left = Math.min(x + 80, screenW - 320) + 'px';
  popup.style.top = Math.max(y - 40, 10) + 'px';
  popup.style.display = 'block';
}

revealBtn.addEventListener('click', () => {
  if (!activeCard) return;
  window.engramAPI?.getAnswer(activeCard.id).then((ans) => {
    popupAnswer.textContent = ans;
    popupAnswer.style.display = 'block';
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
      if (activeIsDue) {
        badge.classList.remove('show');
        currentDueCard = null;
      }
      passClicks();
    });
  });
});

closeBtn.addEventListener('click', () => {
  popup.style.display = 'none';
  // Nếu đóng mà chưa chấm điểm 1 thẻ đến hạn -> nhả pending để main còn nhắc lại sau
  if (activeIsDue && !answered && activeCard) {
    window.engramAPI?.releasePending(activeCard.id);
  }
  passClicks();
});
