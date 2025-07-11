const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (...args: any[]) => ipcRenderer.send(...args),
    invoke: (...args: any[]) => ipcRenderer.invoke(...args),
    on: (...args: any[]) => ipcRenderer.on(...args),
    removeListener: (...args: any[]) => ipcRenderer.removeListener(...args)
  }
});