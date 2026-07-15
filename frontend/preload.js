const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (options) => ipcRenderer.invoke('scan-folder', options),
  listExtensions: (folder) => ipcRenderer.invoke('list-extensions', folder),
  saveFile: async (blob, mimeType, defaultName) => {
    const arrayBuffer = await blob.arrayBuffer();
    return ipcRenderer.invoke('save-file', arrayBuffer, mimeType, defaultName);
  },
  copyImageToClipboard: async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    return ipcRenderer.invoke('copy-image-to-clipboard', arrayBuffer);
  }
});
