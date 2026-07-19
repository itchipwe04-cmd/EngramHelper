const { app, BrowserWindow, Tray, Menu, ipcMain, screen, powerMonitor } = require('electron');
const path = require('path');
const scheduler = require('./scheduler');

let win = null;
let tray = null;
let visible = true;

const CHECK_INTERVAL_MS = 60 * 1000; // kiểm tra thẻ đến hạn mỗi 1 phút
const IDLE_THRESHOLD_SEC = 120; // nếu người dùng rời máy >2 phút, không gửi nhắc nhở

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

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

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.setIgnoreMouseEvents(true, { forward: true });
  win.on('closed', () => { win = null; });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'tray-icon.png'));
  updateTrayMenu();
  tray.setToolTip('Engram Helper');
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
    { label: 'Thoát', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function checkDueCards() {
  if (!win || !visible) return;
  if (scheduler.isMuted()) return;

  const idleSec = powerMonitor.getSystemIdleTime();
  if (idleSec > IDLE_THRESHOLD_SEC) return;

  const card = scheduler.findDueCard();
  if (card) {
    win.webContents.send('due-card', card);
  }
}

ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.handle('get-random-card', () => scheduler.getRandomCard());
ipcMain.handle('get-answer', (event, id) => scheduler.getAnswer(id));
ipcMain.handle('answer-card', (event, { id, rating }) => scheduler.answerCard(id, rating));
ipcMain.on('release-pending', (event, id) => scheduler.releasePending(id));
ipcMain.handle('due-count', () => scheduler.dueCount());

app.whenReady().then(() => {
  scheduler.init(app.getPath('userData'));
  createWindow();
  createTray();
  setInterval(checkDueCards, CHECK_INTERVAL_MS);
  setTimeout(checkDueCards, 5000);
});

app.on('window-all-closed', (e) => {
  e.preventDefault?.();
});
