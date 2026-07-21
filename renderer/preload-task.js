const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskAPI', {
  generateTopicCards: (topic) => ipcRenderer.invoke('generate-topic-cards', topic),
  saveApiKey: (key, model) => ipcRenderer.invoke('save-api-key', { key, model }),
  getApiKeyStatus: () => ipcRenderer.invoke('get-api-key-status'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
