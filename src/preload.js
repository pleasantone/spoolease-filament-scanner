const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, message) => callback(message));
  },
  onScanComplete: (callback) => {
    ipcRenderer.on('scan-complete', (event, data) => callback(data));
  },
  getFilamentData: () => ipcRenderer.invoke('get-filament-data'),
  getFilamentCount: () => ipcRenderer.invoke('get-filament-count'),
  getFilamentSummary: () => ipcRenderer.invoke('get-filament-summary')
});