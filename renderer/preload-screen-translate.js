const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('screenTranslateAPI', {
  onBackground: (cb) => ipcRenderer.on('st-background', (e, dataUrl) => cb(dataUrl)),
  onStatus: (cb) => ipcRenderer.on('st-status', (e, msg) => cb(msg)),
  onResult: (cb) => ipcRenderer.on('st-result', (e, data) => cb(data)),
  close: () => ipcRenderer.send('close-screen-translate'),
});
