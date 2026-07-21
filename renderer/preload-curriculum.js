const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('curriculumAPI', {
  onStatus: (cb) => ipcRenderer.on('curriculum-status', (e, msg) => cb(msg)),
  onResult: (cb) => ipcRenderer.on('curriculum-result', (e, data) => cb(data)),
});
