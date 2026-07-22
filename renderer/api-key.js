const keyInput = document.getElementById('keyInput');
const modelInput = document.getElementById('modelInput');
const langSelect = document.getElementById('langSelect');
const langCustomInput = document.getElementById('langCustomInput');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');
const linkKey = document.getElementById('linkKey');

linkKey.addEventListener('click', (e) => {
  e.preventDefault();
  window.taskAPI.openExternal('https://aistudio.google.com/apikey');
});

langSelect.addEventListener('change', () => {
  langCustomInput.style.display = langSelect.value === '__custom__' ? 'block' : 'none';
});

// Hiện trạng thái hiện tại (đã cài key chưa, ngôn ngữ đích hiện tại) khi mở cửa sổ
window.taskAPI.getApiKeyStatus().then((s) => {
  if (s.hasKey) {
    status.innerHTML = `<span class="ok">Đã cài key, kết thúc bằng "...${s.last4}". Để trống ô key nếu không muốn đổi.</span>`;
  }
  if (s.model) modelInput.value = s.model;

  if (s.targetLanguage) {
    const matched = [...langSelect.options].some((o) => o.value === s.targetLanguage);
    if (matched) {
      langSelect.value = s.targetLanguage;
    } else {
      langSelect.value = '__custom__';
      langCustomInput.value = s.targetLanguage;
      langCustomInput.style.display = 'block';
    }
  }
});

saveBtn.addEventListener('click', async () => {
  const key = keyInput.value.trim();
  const model = modelInput.value.trim();
  const targetLanguage = langSelect.value === '__custom__' ? langCustomInput.value.trim() : langSelect.value;

  // Chỉ bắt buộc nhập key nếu CHƯA từng cài key nào -- đã có key rồi thì để trống
  // vẫn lưu được các thay đổi khác (model, ngôn ngữ đích) mà không cần gõ lại key.
  const status_ = await window.taskAPI.getApiKeyStatus();
  if (!key && !status_.hasKey) {
    status.innerHTML = '<span style="color:#A8502B">Chưa nhập key.</span>';
    return;
  }

  await window.taskAPI.saveApiKey(key, model, targetLanguage);
  status.innerHTML = '<span class="ok">Đã lưu. Đóng cửa sổ này là xong.</span>';
  keyInput.value = '';
});
