import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { debugLog } from '@/utils/debug'
import { backendApi } from './services/backendApiService'
import { startPeriodicQsoRefresh } from './store/qso'
import { CrossOriginStorage } from './services/crossOriginStorage'

// Initialize the backend service and handle connection
async function initializeBackend() {
  debugLog('🔍 Checking for Rust backend service...');
  
  // Wait up to 10 seconds for backend connection
  let backendConnected = false;
  for (let i = 0; i < 20; i++) {
    if (backendApi.connected.value) {
      backendConnected = true;
      break;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 500));
  }
  
  if (backendConnected) {
    debugLog('🚀 Rust backend service connected successfully');
    startPeriodicQsoRefresh();
    
    // Show success message in UI
    window.dispatchEvent(new CustomEvent('backendStatus', { 
      detail: { connected: true, message: 'Backend service connected' }
    }));
  } else {
    console.error('❌ Backend service not available');
    
    // Show error message in UI
    window.dispatchEvent(new CustomEvent('backendStatus', { 
      detail: { 
        connected: false, 
        message: 'Backend service not available. Please start the backend service using start-backend.bat',
        error: backendApi.error.value
      }
    }));
  }
}

// Function to attempt restarting the backend service
async function restartBackendService(): Promise<boolean> {
  debugLog('🔄 Attempting to restart backend service...');
  
  // In an Electron environment, we could potentially start the backend service
  if (typeof window !== 'undefined' && window.Electron) {
    const ipcRenderer = window.Electron.ipcRenderer;
    try {
      const result = await ipcRenderer.invoke('restart-backend-service') as { success: boolean };
      if (result.success) {
        debugLog('✅ Backend service restart initiated');
        // Wait a moment and then re-check connection
        await new Promise<void>(resolve => setTimeout(resolve, 3000));
        return backendApi.connected.value;
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error('❌ Failed to restart backend service:', err.message);
    }
  }
  
  return false;
}

// Start backend initialization after a short delay
setTimeout(initializeBackend, 1000);

// Expose backend service and restart function for debugging
if (typeof window !== 'undefined') {
  window.backendApi = backendApi;
  window.restartBackendService = restartBackendService;
}

// Initialize application
async function initializeApp() {
  // Sync cross-origin storage when app starts
  await CrossOriginStorage.syncStationConfig();
  
  // Create and mount the Vue app
  createApp(App)
      .use(router)
      .mount('#app')
}

// Start the application
initializeApp();
