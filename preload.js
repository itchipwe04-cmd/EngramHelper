const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('engramAPI', {
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', ignore),

  onDueCard: (callback) => ipcRenderer.on('due-card', (event, card) => callback(card)),
  getRandomCard: () => ipcRenderer.invoke('get-random-card'),
  getAnswer: (id) => ipcRenderer.invoke('get-answer', id),
  answerCard: (id, rating) => ipcRenderer.invoke('answer-card', { id, rating }),
  releasePending: (id) => ipcRenderer.send('release-pending', id),
  dueCount: () => ipcRenderer.invoke('due-count'),
  translateClipboard: () => ipcRenderer.invoke('translate-clipboard'),
  setFocusable: (focusable) => ipcRenderer.send('set-focusable', focusable),
});
