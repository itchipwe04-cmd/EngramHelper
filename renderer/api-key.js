const keyInput = document.getElementById('keyInput');
const modelInput = document.getElementById('modelInput');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const linkKey = document.getElementById('linkKey');

linkKey.addEventListener('click', (e) => {
  e.preventDefault();
  window.taskAPI.openExternal('https://aistudio.google.com/apikey');
});

// Hiện trạng thái hiện tại (đã cài key chưa) khi mở cửa sổ
window.taskAPI.getApiKeyStatus().then((s) => {
  if (s.hasKey) {
    status.innerHTML = `<span class="ok">Đã cài key, kết thúc bằng "...${s.last4}". Nhập key mới nếu muốn đổi.</span>`;
  }
  if (s.model) modelInput.value = s.model;
});

saveBtn.addEventListener('click', async () => {
  const key = keyInput.value.trim();
  const model = modelInput.value.trim();
  if (!key) {
    status.innerHTML = '<span style="color:#A8502B">Chưa nhập key.</span>';
    return;
  }
  await window.taskAPI.saveApiKey(key, model);
  status.innerHTML = '<span class="ok">Đã lưu. Đóng cửa sổ này là xong.</span>';
  keyInput.value = '';
});
