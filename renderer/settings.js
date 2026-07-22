const langSelect = document.getElementById('langSelect');
const langCustomInput = document.getElementById('langCustomInput');

document.querySelectorAll('a[data-link]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    window.taskAPI.openExternal(a.dataset.link);
  });
});

langSelect.addEventListener('change', () => {
  langCustomInput.style.display = langSelect.value === '__custom__' ? 'block' : 'none';
});

document.getElementById('saveLangBtn').addEventListener('click', async () => {
  const lang = langSelect.value === '__custom__' ? langCustomInput.value.trim() : langSelect.value;
  if (!lang) return;
  await window.taskAPI.saveTargetLanguage(lang);
  flashSaved(document.getElementById('langSaved'));
});

function flashSaved(el) {
  el.style.display = 'inline';
  setTimeout(() => { el.style.display = 'none'; }, 2000);
}

async function loadStatus() {
  const status = await window.taskAPI.getSettingsStatus();

  // Ngôn ngữ dịch
  if (status.targetLanguage) {
    const matched = [...langSelect.options].some((o) => o.value === status.targetLanguage);
    if (matched) {
      langSelect.value = status.targetLanguage;
    } else {
      langSelect.value = '__custom__';
      langCustomInput.value = status.targetLanguage;
      langCustomInput.style.display = 'block';
    }
  }

  Object.keys(status.providers).forEach((id) => {
    const p = status.providers[id];
    const statusEl = document.getElementById(`status-${id}`);
    if (statusEl) {
      statusEl.textContent = p.hasKey ? `Đã cài key, kết thúc bằng "...${p.last4}"` : 'Chưa cài key';
    }

    const modelEl = document.getElementById(`model-${id}`);
    if (modelEl && p.model) modelEl.value = p.model;

    const ttsModelEl = document.getElementById(`ttsModel-${id}`);
    if (ttsModelEl && p.ttsModel) ttsModelEl.value = p.ttsModel;

    const ttsVoiceEl = document.getElementById(`ttsVoice-${id}`);
    if (ttsVoiceEl && p.ttsVoice) ttsVoiceEl.value = p.ttsVoice;

    const baseUrlEl = document.getElementById(`baseUrl-${id}`);
    if (baseUrlEl && p.baseUrl) baseUrlEl.value = p.baseUrl;

    const labelEl = document.getElementById(`label-${id}`);
    if (labelEl && p.label) labelEl.value = p.label;
  });
}
loadStatus();

document.querySelectorAll('button[data-provider]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.provider;
    const fields = {};

    const key = document.getElementById(`key-${id}`)?.value.trim();
    if (key) fields.apiKey = key; // chỉ gửi nếu người dùng thực sự gõ key mới, tránh xoá mất key cũ

    const model = document.getElementById(`model-${id}`)?.value.trim();
    if (model) fields.model = model;

    const ttsModel = document.getElementById(`ttsModel-${id}`)?.value.trim();
    if (ttsModel) fields.ttsModel = ttsModel;

    const ttsVoice = document.getElementById(`ttsVoice-${id}`)?.value.trim();
    if (ttsVoice) fields.ttsVoice = ttsVoice;

    const baseUrl = document.getElementById(`baseUrl-${id}`)?.value.trim();
    if (baseUrl) fields.baseUrl = baseUrl;

    const label = document.getElementById(`label-${id}`)?.value.trim();
    if (label) fields.label = label;

    await window.taskAPI.saveProviderConfig(id, fields);

    const keyInput = document.getElementById(`key-${id}`);
    if (keyInput) keyInput.value = '';

    flashSaved(document.querySelector(`[data-saved="${id}"]`));
    loadStatus();
  });
});
