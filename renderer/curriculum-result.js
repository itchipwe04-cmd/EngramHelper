const statusEl = document.getElementById('status');
const card = document.getElementById('resultCard');
const rTitle = document.getElementById('rTitle');
const rUnits = document.getElementById('rUnits');
const rStrategy = document.getElementById('rStrategy');
const rCount = document.getElementById('rCount');

window.curriculumAPI.onStatus((msg) => {
  statusEl.textContent = msg;
  if (msg.startsWith('Lỗi')) statusEl.classList.add('err');
});

window.curriculumAPI.onResult((data) => {
  statusEl.textContent = 'Xong.';
  rTitle.textContent = data.title;
  rUnits.textContent = 'Chương/đơn vị: ' + (data.units || []).join(' → ');
  rStrategy.textContent = data.strategy;
  rCount.textContent = `Đã thêm ${data.cardCount} thẻ ôn tập vào lịch FSRS.`;
  card.style.display = 'block';
});
