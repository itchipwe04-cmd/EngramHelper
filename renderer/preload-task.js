const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskAPI', {
  generateTopicCards: (topic) => ipcRenderer.invoke('generate-topic-cards', topic),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  getSettingsStatus: () => ipcRenderer.invoke('get-settings-status'),
  saveProviderConfig: (providerId, fields) => ipcRenderer.invoke('save-provider-config', { providerId, fields }),
  saveTargetLanguage: (lang) => ipcRenderer.invoke('save-target-language', lang),
});
