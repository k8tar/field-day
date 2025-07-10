import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import { setupStationInfoAPI } from './api/stationInfo'

// Setup station info API for network discovery
setupStationInfoAPI();

// If you need to access Electron's ipcRenderer, do so via preload.js and window.electron
const ipcRenderer = window?.Electron?.ipcRenderer;

function logQso(qso: any) {
  ipcRenderer?.send?.('log-qso', qso);
}

async function getQsoLog() {
  return await ipcRenderer?.invoke?.('get-qso-log');
}

// Listen for updates from background sync
ipcRenderer?.on?.('QSO_UPDATE', (event: any, { qsos }: { qsos: any[] }) => {
  // Update your Vue state/store with new qsos
});

createApp(App)
    .use(store)
    .use(router)
    .mount('#app')
