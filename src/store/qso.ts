import { ref, watch } from 'vue';
import { backendApi, type BackendQso } from '@/services/backendApiService';
import { fileStorage } from '@/services/fileStorage';

export interface QSO {
  id?: number;      // Auto-assigned unique ID
  call: string;
  class: string;
  section: string;
  datetime: string;
  band: string;
  mode: string;
  operator: string;
  stationDesignator?: string;  // Added station designator field
  timestamp?: number; // Added timestamp for network sync
}

const QSO_STORAGE_KEY = 'qsos';
const SETTINGS_KEY = 'qso_settings';

// Periodic QSO refresh interval
let refreshInterval: NodeJS.Timeout | null = null;
let isRefreshing = false; // Prevent concurrent refreshes

// Initialize QSOs from file storage
export const qsos = ref<QSO[]>([]);

// Load QSOs from file storage on initialization
async function initializeQsos() {
  try {
    const savedQsos = await fileStorage.getQsoData();
    qsos.value = savedQsos;
    
    // Ensure all QSOs have timestamps (migration for existing data)
    qsos.value.forEach(qso => {
      if (!qso.timestamp) {
        qso.timestamp = new Date(qso.datetime).getTime();
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to load QSOs from file storage:', error);
    qsos.value = []; // Start with empty array if file storage fails
  }
}

// Initialize immediately
initializeQsos();

export const band = ref('40m');
export const operator = ref('');
export const mode = ref('PH');

// Function to load settings from file storage
async function loadSettings() {
  try {
    const settings = await fileStorage.getSettings();
    band.value = settings.band || '40m';
    operator.value = settings.operator || '';
    mode.value = settings.mode || 'PH';
  } catch (error) {
    console.error('Failed to load settings from file storage:', error);
    // Use defaults if file storage fails
    band.value = '40m';
    operator.value = '';
    mode.value = 'PH';
  }
}

// Function to save settings to file storage
async function saveSettings() {
  try {
    await fileStorage.saveSettings({
      band: band.value,
      operator: operator.value,
      mode: mode.value
    });
  } catch (error) {
    console.error('Failed to save settings to file storage:', error);
  }
}

// Initialize settings
loadSettings();

// Force upload all QSOs (manual trigger) - now uses backend service
export async function forceUploadAllQsos(): Promise<boolean> {
  if (!backendApi.connected.value) {
    console.error('❌ Backend service not available for QSO upload');
    return false;
  }
  
  try {
    // Get all QSOs and upload to backend
    for (const qso of qsos.value) {
      if (qso.id) {
        const stationConfig = await fileStorage.getStationConfig();
        const backendQso: BackendQso = {
          id: qso.id.toString(),
          timestamp: new Date(qso.datetime).toISOString(),
          frequency: qso.band,
          mode: qso.mode,
          call_sign: qso.call,
          name: qso.call,
          section: qso.section,
          class: qso.class,
          station_id: `${stationConfig.callsign || 'UNKNOWN'}-${stationConfig.designator || '1A'}`,
          operator: qso.operator,
        };
        
        await backendApi.addQso(backendQso);
      }
    }
    
    console.log('✅ All QSOs uploaded to backend service');
    return true;
  } catch (error) {
    console.error('❌ Failed to upload QSOs to backend:', error);
    return false;
  }
}

// Auto-sync with backend service when available
setTimeout(async () => {
  if (backendApi.connected.value) {
    console.log('✅ Backend service available - starting automatic QSO sync');
    // Backend service will handle synchronization automatically
    // Just upload existing QSOs if any
    if (qsos.value.length > 0) {
      await forceUploadAllQsos();
    }
  } else {
    console.log('⚠️ Backend service not available - QSO sync disabled');
  }
}, 1000); // 1 second delay

// Auto-start sync functionality - handled by backend service
if (typeof window !== 'undefined') {
  // The backend service handles automatic syncing
  
  // Set up real-time network QSO update listener
  setTimeout(async () => {
    try {
      const { networkService } = await import('@/services/networkService');
      
      // Listen for QSO updates from the network
      networkService.onQsoUpdate((update) => {
        console.log(`📡 Received QSO update from network: ${update.action} - ${update.qso?.call || update.id}`);
        
        switch (update.action) {
          case 'add':
            addNetworkQso(update.qso);
            break;
          case 'update':
            updateNetworkQso(update.qso);
            break;
          case 'delete':
            deleteNetworkQso(update.qso.id);
            break;
        }
      });
      
      console.log('✅ Network QSO listener registered');
    } catch (error) {
      console.error('Failed to set up network QSO listener:', error);
    }
  }, 1500); // Delay slightly to ensure network service is available
}

// Function to refresh QSOs from backend service
async function refreshQsosFromBackend(): Promise<void> {
  if (isRefreshing) {
    return; // Prevent concurrent refreshes
  }
  
  isRefreshing = true;
  try {
    if (!backendApi.connected.value) {
      return;
    }

    const backendQsos = await backendApi.getQsos();
    
    // Convert backend QSOs to local format
    const backendQsoMap = new Map();
    const convertedQsos: QSO[] = [];
    
    backendQsos.forEach((backendQso: BackendQso) => {
      // Extract station designator from station_id (e.g., "K8TAR-PHONE" -> "PHONE")
      let stationDesignator = '';
      if (backendQso.station_id) {
        const parts = backendQso.station_id.split('-');
        stationDesignator = parts.length > 1 ? parts[parts.length - 1] : backendQso.station_id;
      }
      
      const localQso: QSO = {
        id: parseInt(backendQso.id),
        call: backendQso.call_sign,
        class: backendQso.class,
        section: backendQso.section,
        datetime: new Date(backendQso.timestamp).toISOString(),
        band: backendQso.frequency,
        mode: backendQso.mode,
        operator: backendQso.operator,
        stationDesignator: stationDesignator,
        timestamp: new Date(backendQso.timestamp).getTime(),
      };
      
      backendQsoMap.set(backendQso.id, localQso);
      convertedQsos.push(localQso);
    });
    
    // Check for changes (additions and deletions)
    const currentQsos = [...qsos.value];
    let changesDetected = false;
    
    // Check for new QSOs from backend
    let newQsosAdded = 0;
    convertedQsos.forEach(backendQso => {
      const existingQso = currentQsos.find(qso => qso.id?.toString() === backendQso.id?.toString());
      if (!existingQso) {
        currentQsos.push(backendQso);
        newQsosAdded++;
        changesDetected = true;
      }
    });
    
    // Check for deleted QSOs (QSOs that exist locally but not in backend)
    let qsosDeleted = 0;
    const filteredQsos = currentQsos.filter(localQso => {
      if (localQso.id && !backendQsoMap.has(localQso.id.toString())) {
        qsosDeleted++;
        changesDetected = true;
        return false; // Remove this QSO
      }
      return true; // Keep this QSO
    });
    
    if (changesDetected) {
      qsos.value = filteredQsos;
      await saveQsos();
      
      if (newQsosAdded > 0 || qsosDeleted > 0) {
        console.log(`🔄 QSO sync: +${newQsosAdded} added, -${qsosDeleted} deleted from backend`);
      }
    }
  } catch (error) {
    console.error('Failed to refresh QSOs from backend:', error);
  } finally {
    isRefreshing = false;
  }
}

// Handle QSO updates from network - now supports all actions
function handleNetworkQsoUpdate(update: { action: 'add' | 'update' | 'delete', qso: any }): void {
  switch (update.action) {
    case 'add':
      addNetworkQso(update.qso);
      break;
    case 'update':
      updateNetworkQso(update.qso);
      break;
    case 'delete':
      deleteNetworkQso(update.qso.id);
      break;
  }
}

function addNetworkQso(networkQso: any) {
  // Check if QSO already exists (avoid duplicates)
  const existingQso = qsos.value.find(qso => {
    // First check for exact ID match
    if (qso.id === networkQso.id) {
      return qso;
    }
    
    // Then check for logical duplicate (same call, band, mode)
    if (qso.call === networkQso.call && 
        qso.band === networkQso.band && 
        qso.mode === networkQso.mode) {
      
      // Check if they're on the same date (within 24 hours)
      const qsoDate = new Date(qso.datetime);
      const networkQsoDate = new Date(networkQso.datetime);
      const timeDiff = Math.abs(qsoDate.getTime() - networkQsoDate.getTime());
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // Consider it a duplicate if it's the same contact within 24 hours
      if (hoursDiff <= 24) {
        return qso;
      }
    }
    
    return null;
  });
  
  if (existingQso) {
    // For duplicates, keep the older one (drop the latest)
    const existingTime = existingQso.timestamp || new Date(existingQso.datetime).getTime();
    const networkTime = networkQso.timestamp || new Date(networkQso.datetime).getTime();
    
    if (networkTime > existingTime) {
      // Network QSO is newer, drop it (keep existing)
      return;
    } else {
      // Network QSO is older, replace existing
      const index = qsos.value.findIndex(q => q.id === existingQso.id);
      if (index >= 0) {
        qsos.value[index] = { ...networkQso };
        saveQsos(); // Use file storage
      }
      return;
    }
  }
  
  // No duplicate found, add the QSO
  qsos.value.push(networkQso);
  qsos.value.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); // Sort by timestamp
  saveQsos(); // Use file storage
}

function updateNetworkQso(networkQso: any) {
  const index = qsos.value.findIndex(qso => qso.id === networkQso.id);
  if (index >= 0) {
    // Check timestamp for conflict resolution (latest wins)
    const existingQso = qsos.value[index];
    if ((networkQso.timestamp || 0) >= (existingQso.timestamp || 0)) {
      qsos.value[index] = { ...networkQso };
      saveQsos(); // Use file storage
    }
  }
}

function deleteNetworkQso(qsoId: number) {
  const index = qsos.value.findIndex(qso => qso.id === qsoId);
  if (index >= 0) {
    qsos.value.splice(index, 1);
    saveQsos(); // Use file storage
  }
}

async function getLocalStationId(): Promise<string> {
  try {
    const stationConfig = await fileStorage.getStationConfig();
    const callsign = stationConfig.callsign || 'UNKNOWN';
    const designator = stationConfig.designator || '1A';
    return `${callsign}-${designator}`;
  } catch (error) {
    console.error('Failed to get station config from file storage:', error);
    return 'UNKNOWN-1A';
  }
}

export async function logQso(qso: any) {
  // Include the station designator from file storage
  let stationDesignator = '';
  try {
    const stationConfig = await fileStorage.getStationConfig();
    stationDesignator = stationConfig.designator || '';
  } catch (error) {
    console.error('Failed to get station designator from file storage:', error);
  }
  
  // Generate a unique ID for the QSO
  const lastId = qsos.value.length > 0 ? 
    Math.max(...qsos.value.map(q => q.id || 0)) : 0;
  
  const newQso = { 
    ...qso, 
    id: lastId + 1,
    band: band.value, 
    mode: mode.value,
    operator: operator.value,
    stationDesignator: stationDesignator,
    timestamp: Date.now() // Add timestamp for conflict resolution
  };
  
  qsos.value.push(newQso);
  saveQsos(); // Use file storage
  
  // Add QSO to backend service for network sync
  if (backendApi.connected.value) {
    const stationConfig = await fileStorage.getStationConfig();
    const backendQso: BackendQso = {
      id: newQso.id!.toString(),
      timestamp: new Date(newQso.datetime).toISOString(),
      frequency: newQso.band,
      mode: newQso.mode,
      call_sign: newQso.call,
      name: newQso.call, // Use call sign as name for now
      section: newQso.section,
      class: newQso.class,
      station_id: `${stationConfig.callsign || 'UNKNOWN'}-${stationConfig.designator || '1A'}`,
      operator: newQso.operator,
    };
    
    backendApi.addQso(backendQso).catch(error => {
      console.error('Failed to add QSO to backend:', error);
    });
  } else {
    console.warn('⚠️ Backend service not available - QSO will not be synced to network');
  }
  
  // Broadcast new QSO to network for immediate sync
  try {
    const { networkService } = await import('@/services/networkService');
    await networkService.broadcastQsoUpdate(newQso, 'add');
  } catch (error) {
    console.error('Failed to broadcast new QSO to network:', error);
  }
  
  // Trigger achievement check for new QSO
  triggerAchievementCheck();
}

// Centralized save function using file storage
async function saveQsos(): Promise<void> {
  try {
    await fileStorage.saveQsoData(qsos.value);
  } catch (error) {
    console.error('❌ Failed to save QSOs to file storage:', error);
  }
}

// Add these fully implemented functions
export async function deleteQso(id: number) {
  
  // Find the QSO being deleted for network broadcast
  const deletedQso = qsos.value.find(qso => qso.id === id);
  
  // Create a new array without the QSO to delete
  const updatedQsos = qsos.value.filter(qso => qso.id !== id);
  
  // Update the reactive reference
  qsos.value = updatedQsos;
  
  // Update file storage
  saveQsos(); // Use file storage
  
  // Notify backend service for network synchronization
  if (backendApi.connected.value && deletedQso) {
    backendApi.deleteQso(deletedQso.id!.toString()).catch(error => {
      console.error('Failed to delete QSO from backend:', error);
    });
  } else {
    console.warn('⚠️ Backend service not available - QSO deletion will not be synced to network');
  }
  
  // Broadcast deletion to network for immediate sync
  if (deletedQso) {
    try {
      const { networkService } = await import('@/services/networkService');
      await networkService.broadcastQsoUpdate(deletedQso, 'delete');
    } catch (error) {
      console.error('Failed to broadcast QSO deletion to network:', error);
    }
  }
  
}

export async function updateQso(id: number, updatedQso: QSO) {
  
  // Find the index of the QSO to update
  const index = qsos.value.findIndex(qso => qso.id === id);
  
  if (index !== -1) {
    // Create a new array with the updated QSO
    const newQsos = [...qsos.value];
    const updated = { 
      ...newQsos[index],  // Keep existing properties
      ...updatedQso,      // Override with new values
      id: newQsos[index].id, // Ensure the ID remains the same
      timestamp: Date.now() // Update timestamp for conflict resolution
    };
    newQsos[index] = updated;
    
    // Update the reactive reference
    qsos.value = newQsos;
    
    // Save to file storage
    saveQsos(); // Use file storage
    
    // Notify backend service for network synchronization
    if (backendApi.connected.value) {
      const stationConfig = await fileStorage.getStationConfig();
      const backendQso: BackendQso = {
        id: updated.id!.toString(),
        timestamp: new Date(updated.datetime).toISOString(),
        frequency: updated.band,
        mode: updated.mode,
        call_sign: updated.call,
        name: updated.call,
        section: updated.section,
        class: updated.class,
        station_id: `${stationConfig.callsign || 'UNKNOWN'}-${stationConfig.designator || '1A'}`,
        operator: updated.operator,
      };
      
      backendApi.updateQso(backendQso).catch(error => {
        console.error('Failed to update QSO in backend:', error);
      });
    } else {
      console.warn('⚠️ Backend service not available - QSO update will not be synced to network');
    }
    
    // Broadcast update to network for immediate sync
    try {
      const { networkService } = await import('@/services/networkService');
      await networkService.broadcastQsoUpdate(updated, 'update');
    } catch (error) {
      console.error('Failed to broadcast QSO update to network:', error);
    }
    
  } else {
  }
}

// QSO Point Calculations
export function getQsoPoints(qso: QSO): number {
  // CW and Digital modes are worth 2 points, Phone is worth 1 point
  return (qso.mode === 'CW' || qso.mode === 'DIG') ? 2 : 1;
}

export function getTotalQsoPoints(): number {
  return qsos.value.reduce((total, qso) => total + getQsoPoints(qso), 0);
}

export function getQsoPointsByMode() {
  const cwPoints = qsos.value.filter(q => q.mode === 'CW').length * 2;
  const digPoints = qsos.value.filter(q => q.mode === 'DIG').length * 2;
  const phPoints = qsos.value.filter(q => q.mode === 'PH').length * 1;
  
  return {
    cw: cwPoints,
    dig: digPoints,
    ph: phPoints,
    total: cwPoints + digPoints + phPoints
  };
}

// Section completion tracking
export function getCompletedSections(): string[] {
  const sectionSet = new Set(qsos.value.map(qso => qso.section.toUpperCase()));
  const sections = Array.from(sectionSet);
  return sections.filter(section => section.trim() !== '');
}

export function getSectionOrder(section: string): number {
  const normalizedSection = section.toUpperCase();
  if (normalizedSection.startsWith('0')) return 0; // Numbers starting with 0 first
  if (normalizedSection === 'DX') return 999; // DX last
  return 500; // Everything else in the middle
}

watch(band, () => saveSettings());
watch(operator, () => saveSettings());
watch(mode, () => saveSettings());

// Function to refresh QSOs from backend service only
export async function refreshQsosFromServer(): Promise<void> {
  if (!backendApi.connected.value) {
    console.warn('⚠️ Backend service not available - cannot refresh QSOs');
    return;
  }
  
  // Use the backend-specific refresh function
  await refreshQsosFromBackend();
}

export function startPeriodicQsoRefresh(): void {
  // Stop any existing interval to prevent duplicates
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  
  // Don't start if already refreshing or backend is not connected
  if (isRefreshing || !backendApi.connected.value) {
    return;
  }
  
  // Use longer interval and let backend handle heavy sync operations
  refreshInterval = setInterval(() => {
    // Backend service handles QSO synchronization automatically
    // Just refresh our local data occasionally
    if (backendApi.connected.value && !isRefreshing) {
      refreshQsosFromBackend();
    }
  }, 10000); // Every 10 seconds for more responsive sync
}

export function stopPeriodicQsoRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Trigger achievement check (lazy import to avoid circular dependencies)
function triggerAchievementCheck(): void {
  // Use dynamic import to avoid circular dependencies
  import('@/services/achievementService').then(({ achievementService }) => {
    achievementService.checkNow().catch(error => {
      console.error('Error checking achievements:', error);
    });
  });
}