const { contextBridge, ipcRenderer } = require('electron');

console.log('🚀 Preload script is executing...');

// Expose basic Electron API
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (...args) => ipcRenderer.send(...args),
    invoke: (...args) => ipcRenderer.invoke(...args),
    on: (...args) => ipcRenderer.on(...args),
    removeListener: (...args) => ipcRenderer.removeListener(...args)
  }
});

// Expose Electron detection flag
contextBridge.exposeInMainWorld('Electron', true);
console.log('✅ Exposed window.Electron = true');

// Add a simple test function
contextBridge.exposeInMainWorld('ElectronTest', () => {
  console.log('🚀 Electron preload script is working!');
  return true;
});
console.log('✅ Exposed window.ElectronTest function');

// Expose file system operations for Electron using IPC
contextBridge.exposeInMainWorld('electronFS', {
  writeFile: (filePath, data) => {
    console.log('📝 electronFS.writeFile called:', filePath);
    return ipcRenderer.invoke('fs-write', filePath, data);
  },
  
  readFile: (filePath) => {
    console.log('📖 electronFS.readFile called:', filePath);
    return ipcRenderer.invoke('fs-read', filePath);
  }
});
console.log('✅ Exposed window.electronFS API');

// Security: Remove node integration in renderer
delete window.require;
delete window.exports;
delete window.module;

console.log('🔒 Preload script completed successfully');
