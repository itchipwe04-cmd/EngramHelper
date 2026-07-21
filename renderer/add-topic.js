const input = document.getElementById('topicInput');
const btn = document.getElementById('genBtn');
const status = document.getElementById('status');

async function submit() {
  const topic = input.value.trim();
  if (!topic) {
    status.innerHTML = '<span class="err">Chưa nhập chủ đề.</span>';
    return;
  }
  btn.disabled = true;
  status.textContent = 'Đang gọi AI soạn thẻ ôn tập...';
  try {
    const result = await window.taskAPI.generateTopicCards(topic);
    status.innerHTML = `<span class="ok">Đã thêm ${result.count} thẻ cho chủ đề "${result.label}".</span> Đóng cửa sổ này, linh thú sẽ nhắc ôn theo lịch mới.`;
    input.value = '';
  } catch (err) {
    status.innerHTML = `<span class="err">Lỗi: ${err.message || err}</span>`;
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener('click', submit);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
