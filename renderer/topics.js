const tbody = document.getElementById('tbody');
const emptyEl = document.getElementById('empty');

let currentTopics = [];
let currentJobs = {};

function findRowEls(name) {
  return tbody.querySelector(`tr[data-topic="${CSS.escape(name)}"]`);
}

async function render() {
  const [topics, jobs] = await Promise.all([
    window.topicsAPI.getTopics(),
    window.topicsAPI.getJobs(),
  ]);
  currentTopics = topics;
  currentJobs = jobs;
  tbody.innerHTML = '';

  if (!topics.length) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  topics.forEach((t) => {
    const tr = document.createElement('tr');
    tr.dataset.topic = t.name;

    const tdCheck = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = t.enabled;
    checkbox.addEventListener('change', async () => {
      await window.topicsAPI.setTopicEnabled(t.name, checkbox.checked);
    });
    tdCheck.appendChild(checkbox);

    const tdName = document.createElement('td');
    tdName.textContent = t.name;

    const tdCount = document.createElement('td');
    tdCount.className = 'num';
    tdCount.textContent = `${t.cardCount} thẻ`;

    const tdDue = document.createElement('td');
    tdDue.className = t.dueCount > 0 ? 'num due' : 'num';
    tdDue.textContent = t.dueCount > 0 ? `${t.dueCount} đến hạn` : '—';

    const tdActions = document.createElement('td');
    const actionsRow = document.createElement('div');
    actionsRow.className = 'actions';

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'qtyInput';
    qtyInput.value = '20';
    qtyInput.min = '1';
    qtyInput.max = '500';

    const genBtn = document.createElement('button');
    genBtn.className = 'genBtn';
    genBtn.textContent = 'Sinh thêm';
    genBtn.addEventListener('click', async () => {
      const count = Math.max(1, Math.min(500, parseInt(qtyInput.value, 10) || 20));
      genBtn.disabled = true;
      await window.topicsAPI.generateMore(t.name, count);
      // job update tự đẩy về qua onJobUpdate, render lại UI ở đó
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'delBtn';
    delBtn.textContent = 'Xoá';
    delBtn.addEventListener('click', async () => {
      const ok = window.confirm(`Xoá hẳn chủ đề "${t.name}" cùng toàn bộ ${t.cardCount} thẻ trong đó? Không hoàn tác được.`);
      if (!ok) return;
      await window.topicsAPI.deleteTopic(t.name);
      render();
    });

    actionsRow.append(qtyInput, genBtn, delBtn);
    tdActions.appendChild(actionsRow);

    const job = jobs[t.name];
    if (job && job.status === 'running') {
      genBtn.disabled = true;
      const p = document.createElement('div');
      p.className = 'jobProgress';
      p.textContent = `Đang sinh thêm: ${job.done}/${job.total}...`;
      tdActions.appendChild(p);
    } else if (job && job.status === 'error') {
      const p = document.createElement('div');
      p.className = 'jobError';
      p.textContent = `Lỗi: ${job.error}`;
      tdActions.appendChild(p);
    }

    tr.append(tdCheck, tdName, tdCount, tdDue, tdActions);
    tbody.appendChild(tr);
  });
}

// Main process đẩy cập nhật tiến trình job theo thời gian thực -> render lại toàn bộ
// (đơn giản, danh sách không lớn nên render lại cả bảng không tốn kém).
window.topicsAPI.onJobUpdate(() => render());

render();
