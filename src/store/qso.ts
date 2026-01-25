import { ref, watch } from 'vue';
import { backendApi, type BackendQso } from '@/services/backendApiService';
import { fileStorage } from '@/services/fileStorage';
import { CrossOriginStorage } from '@/services/crossOriginStorage';
import { logger, ErrorHandler } from '@/utils/logger';
import { debugLog } from '@/utils/debug';

export interface QSO {
  id?: string;      // Unique UUID string identifier
  call: string;
  class: string;
  section: string;
  datetime: string;
  band: string;
  mode: string;
  operator: string;
  stationDesignator?: string;  // Added station designator field
  timestamp?: number; // Added timestamp for network sync
  lastModified?: number; // Timestamp of last modification for conflict resolution
}

const QSO_STORAGE_KEY = 'qsos';
const SETTINGS_KEY = 'qso_settings';

// Periodic QSO refresh interval
let refreshInterval: NodeJS.Timeout | null = null;
let isRefreshing = false; // Prevent concurrent refreshes

// Initialize QSOs from file storage on initialization
export const qsos = ref<QSO[]>([]);

// Track QSOs that were deleted while backend was offline
const pendingDeletions = ref<Set<string>>(new Set());

// Migration function to convert old numeric IDs to UUIDs
async function migrateQsoIds() {
  let migrationNeeded = false;
  const stationConfig = await fileStorage.getStationConfig().catch(() => ({ designator: 'MIGR' }));
  
  qsos.value.forEach(qso => {
    // Check if QSO has old numeric ID or no ID
    if (!qso.id || typeof qso.id === 'number') {
      migrationNeeded = true;
      const timestamp = qso.timestamp || new Date(qso.datetime).getTime();
      const oldId = qso.id || 0;
      
      // Generate a migration UUID that's deterministic based on existing data
      const timestampPart = timestamp.toString(36);
      const callPart = qso.call.substr(0, 3).toLowerCase();
      const stationPart = (qso.stationDesignator || stationConfig.designator || 'unkn').substr(0, 3).toLowerCase();
      const oldIdPart = oldId.toString(36).padStart(2, '0');
      
      qso.id = `mig-${timestampPart}-${callPart}-${stationPart}-${oldIdPart}`;
      
      debugLog(`🔄 Migrated QSO ${qso.call} from ID ${oldId} to UUID ${qso.id}`);
    }
  });
  
  if (migrationNeeded) {
    await saveQsos();
    debugLog('✅ QSO ID migration completed');
  }
}

// Load QSOs from file storage on initialization
async function initializeQsos() {
  try {
    const savedQsos = await fileStorage.getQsoData();
    qsos.value = savedQsos;
    
    // Ensure all QSOs have timestamps and lastModified (migration for existing data)
    qsos.value.forEach(qso => {
      if (!qso.timestamp) {
        qso.timestamp = new Date(qso.datetime).getTime();
      }
      if (!qso.lastModified) {
        // For existing QSOs, use timestamp as initial lastModified
        qso.lastModified = qso.timestamp || new Date(qso.datetime).getTime();
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to load QSOs from file storage:', error);
    qsos.value = []; // Start with empty array if file storage fails
  }
}

// Initialize immediately
initializeQsos().then(() => {
  // Run migration for existing QSOs with old IDs
  migrateQsoIds();
  // Load pending deletions
  loadPendingDeletions();
});

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
          id: qso.id,
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
    
    debugLog('✅ All QSOs uploaded to backend service');
    return true;
  } catch (error) {
    console.error('❌ Failed to upload QSOs to backend:', error);
    return false;
  }
}

// Auto-sync with backend service when available
setTimeout(async () => {
  if (backendApi.connected.value) {
    debugLog('✅ Backend service available - starting automatic QSO sync');
    // Backend service will handle synchronization automatically
    // Just upload existing QSOs if any
    if (qsos.value.length > 0) {
      await forceUploadAllQsos();
    }
  } else {
    debugLog('⚠️ Backend service not available - QSO sync disabled');
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
        debugLog(`📡 Received QSO update from network: ${update.action} - ${update.qso?.call || update.id}`);
        
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
      
      debugLog('✅ Network QSO listener registered');
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
        id: backendQso.id,
        call: backendQso.call_sign,
        class: backendQso.class,
        section: backendQso.section,
        datetime: new Date(backendQso.timestamp).toISOString(),
        band: backendQso.frequency,
        mode: backendQso.mode,
        operator: backendQso.operator,
        stationDesignator: stationDesignator,
        timestamp: new Date(backendQso.timestamp).getTime(),
        lastModified: new Date(backendQso.timestamp).getTime(), // Use backend timestamp as lastModified
      };
      
      backendQsoMap.set(backendQso.id, localQso);
      convertedQsos.push(localQso);
    });
    
    // Check for changes (additions, deletions, and updates)
    const currentQsos = [...qsos.value];
    let changesDetected = false;
    
    // Check for new QSOs from backend
    let newQsosAdded = 0;
    let qsosUpdated = 0;
    convertedQsos.forEach(backendQso => {
      // Skip QSOs that are pending deletion
      if (backendQso.id && pendingDeletions.value.has(backendQso.id)) {
        debugLog(`🗑️ Skipping backend QSO ${backendQso.id} - pending deletion`);
        return;
      }
      
      const existingQso = currentQsos.find(qso => qso.id === backendQso.id);
      if (!existingQso) {
        currentQsos.push(backendQso);
        newQsosAdded++;
        changesDetected = true;
      } else {
        // Check if the QSO has been updated (compare lastModified timestamps)
        const backendLastModified = backendQso.lastModified || 0;
        const localLastModified = existingQso.lastModified || 0;
        
        if (backendLastModified > localLastModified) {
          // Backend QSO is newer, update the local version
          const index = currentQsos.findIndex(qso => qso.id === backendQso.id);
          if (index >= 0) {
            currentQsos[index] = { ...backendQso };
            qsosUpdated++;
            changesDetected = true;
          }
        }
      }
    });
    
    // Check for deleted QSOs (QSOs that exist locally but not in backend)
    // Only delete local QSOs if we have backend QSOs (to avoid deleting everything when backend is empty)
    let qsosDeleted = 0;
    let filteredQsos = currentQsos;
    
    // Only process deletions if backend has QSOs or if we're sure backend is fully initialized
    if (convertedQsos.length > 0) {
      filteredQsos = currentQsos.filter(localQso => {
        if (localQso.id && !backendQsoMap.has(localQso.id)) {
          qsosDeleted++;
          changesDetected = true;
          return false; // Remove this QSO
        }
        return true; // Keep this QSO
      });
    }
    
    if (changesDetected) {
      qsos.value = filteredQsos;
      await saveQsos();
      
      if (newQsosAdded > 0 || qsosDeleted > 0 || qsosUpdated > 0) {
        debugLog(`🔄 QSO sync: +${newQsosAdded} added, ~${qsosUpdated} updated, -${qsosDeleted} deleted from backend`);
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
    // For duplicates, keep the most recently modified one
    const existingLastModified = existingQso.lastModified || new Date(existingQso.datetime).getTime();
    const networkLastModified = networkQso.lastModified || new Date(networkQso.datetime).getTime();
    
    if (networkLastModified > existingLastModified) {
      // Network QSO is newer, replace existing
      const index = qsos.value.findIndex(q => q.id === existingQso.id);
      if (index >= 0) {
        qsos.value[index] = { ...networkQso };
        saveQsos(); // Use file storage
      }
      return;
    } else {
      // Existing QSO is newer or same, keep it (drop network QSO)
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
    // Check lastModified for conflict resolution (latest wins)
    const existingQso = qsos.value[index];
    const networkLastModified = networkQso.lastModified || 0;
    const existingLastModified = existingQso.lastModified || 0;
    
    if (networkLastModified >= existingLastModified) {
      debugLog(`📝 Updating QSO from network: ${networkQso.call} (ID: ${networkQso.id})`);
      qsos.value[index] = { ...networkQso };
      saveQsos(); // Use file storage
    } else {
      debugLog(`⏭️ Skipping network QSO update (older): ${networkQso.call} (network: ${networkLastModified}, local: ${existingLastModified})`);
    }
  } else {
    console.warn(`⚠️ Cannot update QSO ${networkQso.id} - not found locally`);
  }
}

function deleteNetworkQso(qsoId: string) {
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
  
  // Generate a unique UUID for the QSO to prevent collisions across stations
  const generateUUID = () => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    const stationPart = stationDesignator.substr(0, 3).toLowerCase();
    return `${timestamp}-${randomPart}-${stationPart}`;
  };
  
  const newQso = { 
    ...qso, 
    id: generateUUID(),
    band: band.value, 
    mode: mode.value,
    operator: operator.value,
    stationDesignator: stationDesignator,
    timestamp: Date.now(), // Add timestamp for conflict resolution
    lastModified: Date.now() // Track when this QSO was last modified
  };
  
  qsos.value.push(newQso);
  saveQsos(); // Use file storage
  
  // Add QSO to backend service for network sync
  if (backendApi.connected.value) {
    const stationConfig = await fileStorage.getStationConfig();
    const backendQso: BackendQso = {
      id: newQso.id!,
      timestamp: new Date(newQso.lastModified!).toISOString(), // Use lastModified for proper sync
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
      // Force a connection check when QSO sync fails
      backendApi.refreshConnectionStatus();
    });
  } else {
    console.warn('⚠️ Backend service not available - QSO will not be synced to network');
    // Force a connection check when backend is not available
    backendApi.refreshConnectionStatus();
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
export async function deleteQso(id: string) {
  
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
    try {
      await backendApi.deleteQso(deletedQso.id!);
      debugLog(`✅ QSO ${deletedQso.id} deleted from backend`);
    } catch (error) {
      console.error('Failed to delete QSO from backend:', error);
      // Add to pending deletions if backend delete fails
      await addPendingDeletion(deletedQso.id!);
      // Force a connection check when QSO deletion fails
      backendApi.refreshConnectionStatus();
    }
  } else {
    console.warn('⚠️ Backend service not available - adding QSO deletion to pending list');
    if (deletedQso?.id) {
      await addPendingDeletion(deletedQso.id);
    }
    // Force a connection check when backend is not available
    backendApi.refreshConnectionStatus();
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

export async function updateQso(id: string, updatedQso: QSO) {
  
  // Find the index of the QSO to update
  const index = qsos.value.findIndex(qso => qso.id === id);
  
  if (index !== -1) {
    // Create a new array with the updated QSO
    const newQsos = [...qsos.value];
    const updated = { 
      ...newQsos[index],  // Keep existing properties
      ...updatedQso,      // Override with new values
      id: newQsos[index].id, // Ensure the ID remains the same
      timestamp: Date.now(), // Update timestamp for conflict resolution
      lastModified: Date.now() // Track when this QSO was last modified
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
        id: updated.id!,
        timestamp: new Date(updated.lastModified!).toISOString(), // Use lastModified for proper sync
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

// Log Reset Functions
export async function clearAllQsos(): Promise<void> {
  debugLog('🗑️ Clearing all QSOs from local storage');
  qsos.value = [];
  await saveQsos();
  triggerAchievementCheck(); // Update achievements after clearing
}

export async function clearQsosAfterTimestamp(resetTimestamp: string): Promise<void> {
  const resetTime = new Date(resetTimestamp).getTime();
  debugLog(`🗑️ Clearing QSOs after reset timestamp: ${resetTimestamp}`);
  
  // Keep only QSOs that were created before the reset timestamp
  const filteredQsos = qsos.value.filter(qso => {
    const qsoTime = qso.lastModified || qso.timestamp || new Date(qso.datetime).getTime();
    return qsoTime < resetTime;
  });
  
  const removedCount = qsos.value.length - filteredQsos.length;
  qsos.value = filteredQsos;
  await saveQsos();
  
  debugLog(`🗑️ Removed ${removedCount} QSOs after reset timestamp`);
  triggerAchievementCheck(); // Update achievements after clearing
}

export async function processLogReset(resetTimestamp: string): Promise<void> {
  debugLog(`📋 Processing log reset command with timestamp: ${resetTimestamp}`);
  
  // Clear all QSOs locally
  await clearAllQsos();
  
  // Clear all messages locally
  try {
    const { clearAllMessages } = await import('@/store/message');
    await clearAllMessages();
    debugLog('✅ Successfully cleared all messages during log reset');
  } catch (error) {
    console.error('❌ Failed to clear messages during log reset:', error);
  }
  
  // Store the reset timestamp for future reference
  try {
    await fileStorage.saveSettings({
      band: band.value,
      operator: operator.value,
      mode: mode.value,
      lastLogResetTimestamp: resetTimestamp
    });
    debugLog('✅ Log reset timestamp saved to settings');
  } catch (error) {
    console.error('❌ Failed to save log reset timestamp:', error);
  }
  
  // Refresh QSOs from backend, but only keep ones after reset timestamp
  if (backendApi.connected.value) {
    await refreshQsosFromBackend();
    // Filter out any QSOs that were created before the reset
    await clearQsosAfterTimestamp(resetTimestamp);
  }
}

export async function checkForLogReset(): Promise<void> {
  // Only check if we're connected to the backend
  if (!backendApi.connected.value) {
    debugLog('📋 Skipping log reset check - backend not connected');
    return;
  }
  
  try {
    debugLog('📋 Checking for log reset commands...');
    // Check if there's a recent log reset command
    const lastResetTime = await backendApi.getLastLogResetTime();
    if (!lastResetTime) {
      debugLog('📋 No log reset commands found');
      return;
    }
    
    debugLog(`📋 Found log reset command with timestamp: ${lastResetTime}`);
    
    // Get our stored reset timestamp
    const settings = await fileStorage.getSettings().catch(() => ({})) as any;
    const localResetTime = settings.lastLogResetTimestamp;
    
    // If backend has a newer reset time, process it
    if (!localResetTime || new Date(lastResetTime) > new Date(localResetTime)) {
      debugLog(`🔄 Processing newer log reset command: ${lastResetTime} (local: ${localResetTime})`);
      await processLogReset(lastResetTime);
    } else {
      debugLog(`📋 Local reset time is up to date: ${localResetTime}`);
    }
  } catch (error) {
    console.error('❌ Failed to check for log reset:', error);
    // Do not process reset on error - this prevents accidental QSO deletion
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

// Set up backend connection event listeners
window.addEventListener('backendConnected', async () => {
  debugLog('📡 Backend connected - syncing mesh state and uploading local QSOs');
  
  // Sync mesh state first (in case it changed while backend was offline)
  try {
    const { backgroundNetworkService } = await import('@/services/backgroundNetworkService');
    await backgroundNetworkService.reSyncMeshState();
  } catch (error) {
    console.error('Failed to sync mesh state on backend reconnection:', error);
  }
  
  // Apply pending deletions
  await applyPendingDeletions();
  
  // Upload any local QSOs that might not be in the backend
  if (qsos.value.length > 0) {
    debugLog(`📤 Uploading ${qsos.value.length} local QSOs to backend...`);
    await forceUploadAllQsos();
  }
  
  startPeriodicQsoRefresh();
});

window.addEventListener('backendDisconnected', () => {
  debugLog('📡 Backend disconnected - stopping QSO refresh');
  stopPeriodicQsoRefresh();
});

// Start refresh if backend is already connected
if (backendApi.connected.value) {
  startPeriodicQsoRefresh();
}

// Load pending deletions from cross-origin storage
async function loadPendingDeletions() {
  const result = await ErrorHandler.handleAsync(async () => {
    const deletionIds = CrossOriginStorage.getJSON<string[]>('pendingDeletions');
    if (deletionIds) {
      pendingDeletions.value = new Set(deletionIds);
      logger.info(`Loaded ${deletionIds.length} pending deletions from cross-origin storage`);
    }
    return true;
  }, 'load pending deletions');
  
  if (!result) {
    pendingDeletions.value = new Set();
  }
}

// Save pending deletions to cross-origin storage
async function savePendingDeletions() {
  await ErrorHandler.handleAsync(async () => {
    CrossOriginStorage.setJSON('pendingDeletions', Array.from(pendingDeletions.value));
  }, 'save pending deletions');
}

// Add a QSO deletion to pending list
async function addPendingDeletion(qsoId: string) {
  pendingDeletions.value.add(qsoId);
  await savePendingDeletions();
  debugLog(`📝 Added QSO ${qsoId} to pending deletions`);
}

// Remove a QSO deletion from pending list (when successfully synced)
async function removePendingDeletion(qsoId: string) {
  pendingDeletions.value.delete(qsoId);
  await savePendingDeletions();
  debugLog(`✅ Removed QSO ${qsoId} from pending deletions`);
}

// Apply pending deletions to backend
async function applyPendingDeletions() {
  if (pendingDeletions.value.size === 0) {
    return;
  }
  
  debugLog(`🗑️ Applying ${pendingDeletions.value.size} pending deletions to backend...`);
  
  const deletionsToProcess = Array.from(pendingDeletions.value);
  for (const qsoId of deletionsToProcess) {
    try {
      await backendApi.deleteQso(qsoId);
      await removePendingDeletion(qsoId);
      debugLog(`✅ Applied pending deletion for QSO ${qsoId}`);
    } catch (error) {
      console.error(`❌ Failed to apply pending deletion for QSO ${qsoId}:`, error);
      // Keep the deletion in pending list to retry later
    }
  }
}

// Periodic check for pending deletions
setInterval(() => {
  if (backendApi.connected.value) {
    // Apply any pending deletions to the backend
    applyPendingDeletions();
  }
}, 5000); // Check every 5 seconds