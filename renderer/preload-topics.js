const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('topicsAPI', {
  getTopics: () => ipcRenderer.invoke('get-topics'),
  setTopicEnabled: (name, enabled) => ipcRenderer.invoke('set-topic-enabled', { name, enabled }),
  deleteTopic: (name) => ipcRenderer.invoke('delete-topic', name),
  generateMore: (topic, count) => ipcRenderer.invoke('generate-more-cards', { topic, count }),
  getJobs: () => ipcRenderer.invoke('get-generation-jobs'),
  onJobUpdate: (cb) => ipcRenderer.on('generation-job-update', (e, data) => cb(data)),
});
