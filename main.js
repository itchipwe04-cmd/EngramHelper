const { app, BrowserWindow, Tray, Menu, ipcMain, screen, powerMonitor, dialog, shell, clipboard, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const contentGenerator = require('./content-generator');
const { extractText } = require('./doc-extract');
const screenTranslate = require('./screen-translate');
const ocr = require('./ocr');

const logPath = path.join(__dirname, 'debug.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logPath, line); } catch (e) {}
}

process.on('uncaughtException', (err) => {
  log('UNCAUGHT EXCEPTION: ' + (err && err.stack ? err.stack : err));
});

// Tắt tăng tốc phần cứng trước khi app ready -- hay gặp lỗi cửa sổ trong suốt
// bị crash im lặng trên 1 số driver GPU (đặc biệt Intel).
app.disableHardwareAcceleration();

log('=== Start ===');

const scheduler = require('./scheduler');

let win = null;
let tray = null;
let visible = true;

const CHECK_INTERVAL_MS = 60 * 1000;
const IDLE_THRESHOLD_SEC = 120;

function createWindow() {
  try {
    log('createWindow: start');
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    log(`screen size: ${width}x${height}`);

    win = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      focusable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    log('BrowserWindow created');

    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    win.webContents.on('did-fail-load', (e, code, desc) => {
      log(`did-fail-load: code=${code} desc=${desc}`);
    });
    win.webContents.on('render-process-gone', (e, details) => {
      log('render-process-gone: ' + JSON.stringify(details));
    });
    win.webContents.on('did-finish-load', () => log('did-finish-load OK'));

    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    win.setIgnoreMouseEvents(true, { forward: true });
    win.on('closed', () => { log('window closed'); win = null; });

    log('createWindow: done');
  } catch (err) {
    log('createWindow ERROR: ' + (err && err.stack ? err.stack : err));
  }
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));
    updateTrayMenu();
    tray.setToolTip('Engram Helper');
    log('tray created');
  } catch (err) {
    log('createTray ERROR: ' + (err && err.stack ? err.stack : err));
  }
}

function updateTrayMenu() {
  const muted = scheduler.isMuted();
  const menu = Menu.buildFromTemplate([
    {
      label: visible ? 'Ẩn linh thú' : 'Hiện linh thú',
      click: () => {
        visible = !visible;
        if (win) { visible ? win.show() : win.hide(); }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: muted ? 'Đang im lặng — Bật lại nhắc nhở' : 'Tạm im lặng 1 giờ',
      click: () => {
        muted ? scheduler.unmute() : scheduler.muteFor(1);
        updateTrayMenu();
      },
    },
    { label: 'Im lặng 4 giờ', enabled: !muted, click: () => { scheduler.muteFor(4); updateTrayMenu(); } },
    { label: 'Im lặng đến mai (8 giờ)', enabled: !muted, click: () => { scheduler.muteFor(8); updateTrayMenu(); } },
    { type: 'separator' },
    { label: 'Thêm chủ đề mới...', click: () => openTopicWindow() },
    { label: 'Nạp giáo trình (PDF/Word)...', click: () => importCurriculum() },
    { label: 'Dịch màn hình (Ctrl+Shift+T)', click: () => openScreenTranslate() },
    { label: 'Quản lý chủ đề...', click: () => openTopicsManagerWindow() },
    { label: 'Cài đặt Gemini API Key...', click: () => openApiKeyWindow() },
    { type: 'separator' },
    { label: 'Thoát', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function openTopicWindow() {
  const w = new BrowserWindow({
    width: 440,
    height: 300,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload-task.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  w.loadFile(path.join(__dirname, 'renderer', 'add-topic.html'));
}

function openApiKeyWindow() {
  const w = new BrowserWindow({
    width: 440,
    height: 360,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload-task.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  w.loadFile(path.join(__dirname, 'renderer', 'api-key.html'));
}

let topicsWindows = [];

function openTopicsManagerWindow() {
  const w = new BrowserWindow({
    width: 520,
    height: 480,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload-topics.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  w.loadFile(path.join(__dirname, 'renderer', 'topics.html'));
  topicsWindows.push(w);
  w.on('closed', () => { topicsWindows = topicsWindows.filter((x) => x !== w); });
}

function broadcastJobUpdate(topicName) {
  topicsWindows.forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send('generation-job-update', { topicName, job: generationJobs[topicName] });
  });
}

// Job sinh thêm thẻ cho 1 chủ đề, chạy ngầm trong main process -- không phụ thuộc
// cửa sổ "Quản lý chủ đề" có đang mở hay không, đóng cửa sổ job vẫn tiếp tục chạy.
const generationJobs = {}; // topicName -> { done, total, status: 'running'|'done'|'error', error }
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1500;

async function generateMoreCardsJob(topicName, totalToAdd) {
  if (generationJobs[topicName]?.status === 'running') return; // đã có job đang chạy cho chủ đề này rồi
  generationJobs[topicName] = { done: 0, total: totalToAdd, status: 'running', error: null };
  broadcastJobUpdate(topicName);

  try {
    let remaining = totalToAdd;
    while (remaining > 0) {
      const batchSize = Math.min(BATCH_SIZE, remaining);
      const existingFronts = scheduler.getCardFrontsForTopic(topicName, 60);
      const result = await contentGenerator.generateMoreCards(topicName, existingFronts, batchSize);
      const added = scheduler.addCards(result.cards, topicName);
      generationJobs[topicName].done += added;
      remaining -= batchSize;
      broadcastJobUpdate(topicName);
      if (remaining > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
    generationJobs[topicName].status = 'done';
  } catch (err) {
    log('generateMoreCardsJob ERROR: ' + (err && err.stack ? err.stack : err));
    generationJobs[topicName].status = 'error';
    generationJobs[topicName].error = err.message || String(err);
  }
  broadcastJobUpdate(topicName);
}


async function importCurriculum() {
  if (!config.hasApiKey()) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Chưa có API Key',
      message: 'Cần cài Gemini API Key trước khi nạp giáo trình. Vào tray menu -> "Cài đặt Gemini API Key..." trước.',
    });
    return;
  }

  const picked = await dialog.showOpenDialog({
    title: 'Chọn file giáo trình',
    properties: ['openFile'],
    filters: [{ name: 'Tài liệu', extensions: ['pdf', 'docx', 'txt'] }],
  });
  if (picked.canceled || !picked.filePaths.length) return;
  const filePath = picked.filePaths[0];

  const w = new BrowserWindow({
    width: 460,
    height: 420,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload-curriculum.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  w.loadFile(path.join(__dirname, 'renderer', 'curriculum-result.html'));

  w.webContents.once('did-finish-load', async () => {
    try {
      w.webContents.send('curriculum-status', 'Đang đọc tài liệu...');
      const text = await extractText(filePath);
      if (!text || text.trim().length < 20) {
        w.webContents.send('curriculum-status', 'Lỗi: không trích xuất được nội dung từ file này (có thể là file scan ảnh, chưa hỗ trợ OCR).');
        return;
      }

      w.webContents.send('curriculum-status', 'Đang phân tích với AI, có thể mất khoảng 10-30 giây...');
      const analysis = await contentGenerator.analyzeCurriculum(text);
      const count = scheduler.addCards(analysis.cards, analysis.curriculumTitle);
      scheduler.addCurriculum({
        title: analysis.curriculumTitle,
        units: analysis.units,
        strategy: analysis.strategy,
        cardCount: count,
      });

      w.webContents.send('curriculum-result', {
        title: analysis.curriculumTitle,
        units: analysis.units,
        strategy: analysis.strategy,
        cardCount: count,
      });
    } catch (err) {
      log('importCurriculum ERROR: ' + (err && err.stack ? err.stack : err));
      w.webContents.send('curriculum-status', 'Lỗi: ' + (err.message || err));
    }
  });
}

let screenTranslateWin = null;

async function openScreenTranslate() {
  if (!config.hasApiKey()) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Chưa có API Key',
      message: 'Cần cài Gemini API Key trước. Vào tray menu -> "Cài đặt Gemini API Key..." trước.',
    });
    return;
  }
  if (screenTranslateWin) {
    screenTranslateWin.focus();
    return;
  }

  // Linh thú luôn nổi trên cùng nên sẽ lọt vào chính ảnh chụp, che mất đúng chỗ nó đứng
  // -> ẩn tạm trước khi chụp, hiện lại ngay sau khi có ảnh (không cần đợi dịch xong).
  const petWasVisible = visible && win;
  if (petWasVisible) {
    win.hide();
    await new Promise((resolve) => setTimeout(resolve, 120)); // đợi hệ điều hành vẽ lại màn hình, tránh chụp trúng lúc đang ẩn dở
  }

  let shot;
  try {
    // QUAN TRỌNG: chụp màn hình TRƯỚC khi tạo bất kỳ cửa sổ nào của tính năng này,
    // nếu không cửa sổ đó sẽ lọt vào chính bức ảnh chụp (chụp trúng lớp phủ của mình).
    shot = await screenTranslate.captureScreenshot();
  } catch (err) {
    log('captureScreenshot ERROR: ' + (err && err.stack ? err.stack : err));
    dialog.showMessageBox({ type: 'error', title: 'Lỗi chụp màn hình', message: err.message || String(err) });
    if (petWasVisible) win.show();
    return;
  }
  if (petWasVisible) win.show();

  screenTranslateWin = new BrowserWindow({
    width: shot.logicalWidth,
    height: shot.logicalHeight,
    x: 0,
    y: 0,
    frame: false,
    fullscreen: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'renderer', 'preload-screen-translate.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  screenTranslateWin.setAlwaysOnTop(true, 'floating');
  screenTranslateWin.on('closed', () => { screenTranslateWin = null; });
  screenTranslateWin.loadFile(path.join(__dirname, 'renderer', 'screen-translate.html'));

  screenTranslateWin.webContents.once('did-finish-load', async () => {
    // Gửi ảnh đã chụp lên ngay để hiện làm nền trong lúc OCR/dịch chạy tiếp
    screenTranslateWin.webContents.send('st-background', shot.dataUrl);
    try {
      const result = await screenTranslate.ocrAndTranslate(
        shot,
        (msg) => { if (screenTranslateWin) screenTranslateWin.webContents.send('st-status', msg); },
        (msg) => log('OCR: ' + msg)
      );
      if (screenTranslateWin) screenTranslateWin.webContents.send('st-result', result);
    } catch (err) {
      log('screenTranslate ERROR: ' + (err && err.stack ? err.stack : err));
      if (screenTranslateWin) screenTranslateWin.webContents.send('st-status', 'Lỗi: ' + (err.message || err));
    }
  });
}

function checkDueCards() {
  if (!win || !visible) return;
  if (scheduler.isMuted()) return;
  const idleSec = powerMonitor.getSystemIdleTime();
  if (idleSec > IDLE_THRESHOLD_SEC) return;
  const card = scheduler.findDueCard();
  if (card) win.webContents.send('due-card', card);
}

ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});
ipcMain.on('set-focusable', (event, focusable) => {
  if (!win) return;
  win.setFocusable(focusable);
  if (focusable) win.focus();
});
ipcMain.handle('get-random-card', () => scheduler.getRandomCard());
ipcMain.handle('get-answer', (event, id) => scheduler.getAnswer(id));
ipcMain.handle('answer-card', (event, { id, rating }) => scheduler.answerCard(id, rating));
ipcMain.on('release-pending', (event, id) => scheduler.releasePending(id));
ipcMain.handle('due-count', () => scheduler.dueCount());
ipcMain.handle('get-topics', () => scheduler.getTopics());
ipcMain.handle('set-topic-enabled', (event, { name, enabled }) => scheduler.setTopicEnabled(name, enabled));
ipcMain.handle('delete-topic', (event, name) => scheduler.deleteTopic(name));
ipcMain.handle('generate-more-cards', (event, { topic, count }) => {
  generateMoreCardsJob(topic, count); // chạy ngầm, không đợi (fire-and-forget) -- theo dõi qua job update
  return true;
});
ipcMain.handle('get-generation-jobs', () => generationJobs);

ipcMain.handle('generate-topic-cards', async (event, topic) => {
  const result = await contentGenerator.generateCardsFromTopic(topic);
  const count = scheduler.addCards(result.cards, result.topicLabel);
  return { label: result.topicLabel, count };
});

ipcMain.handle('save-api-key', (event, { key, model }) => {
  config.setApiKey(key);
  if (model) {
    const cfg = config.get();
    cfg.geminiModel = model;
    config.setApiKey(cfg.geminiApiKey); // trigger save() lại toàn bộ config
  }
  return true;
});

ipcMain.handle('get-api-key-status', () => {
  const cfg = config.get();
  const hasKey = config.hasApiKey();
  return {
    hasKey,
    last4: hasKey ? cfg.geminiApiKey.slice(-4) : '',
    model: cfg.geminiModel,
  };
});

ipcMain.handle('translate-clipboard', async () => {
  const text = clipboard.readText().trim();
  if (!text) {
    return { error: 'Clipboard trống — bôi đen đoạn text rồi Ctrl+C trước đã.' };
  }
  try {
    const result = await contentGenerator.translateText(text);
    return { original: text, sourceLang: result.sourceLang, translated: result.translated };
  } catch (err) {
    return { error: err.message || String(err) };
  }
});

ipcMain.on('close-screen-translate', () => {
  if (screenTranslateWin) screenTranslateWin.close();
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

app.whenReady().then(() => {
  log('app ready');
  try {
    scheduler.init(app.getPath('userData'));
    config.init(app.getPath('userData'));
    ocr.init(app.getPath('userData'));
    log('scheduler + config + ocr init OK');
  } catch (err) {
    log('init ERROR: ' + (err && err.stack ? err.stack : err));
  }
  createWindow();
  createTray();
  setInterval(checkDueCards, CHECK_INTERVAL_MS);
  setTimeout(checkDueCards, 5000);

  const shortcutOk = globalShortcut.register('CommandOrControl+Shift+T', () => openScreenTranslate());
  if (!shortcutOk) log('WARN: không đăng ký được phím tắt Ctrl+Shift+T (có thể trùng app khác)');
}).catch((err) => {
  log('whenReady ERROR: ' + (err && err.stack ? err.stack : err));
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault?.();
});
