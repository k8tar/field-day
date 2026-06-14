import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (...args: Parameters<typeof ipcRenderer.send>) => ipcRenderer.send(...args),
    invoke: (...args: Parameters<typeof ipcRenderer.invoke>) => ipcRenderer.invoke(...args),
    on: (...args: Parameters<typeof ipcRenderer.on>) => ipcRenderer.on(...args),
    removeListener: (...args: Parameters<typeof ipcRenderer.removeListener>) => ipcRenderer.removeListener(...args)
  }
});