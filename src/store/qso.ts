import { ref, watch } from 'vue';
import { networkService } from '@/services/networkService';
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
    
    console.log(`📚 Loaded ${qsos.value.length} QSOs from file storage`);
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

// Upload local QSOs to server (for network discovery/sync)
async function uploadLocalQsosToServer(force = false): Promise<boolean> {
  if (qsos.value.length === 0) {
    console.log('📭 No local QSOs to upload');
    return true;
  }
  
  try {
    console.log(`📤 Uploading ${qsos.value.length} local QSOs to server file storage...`);
    
    const response = await fetch('/api/qsos/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        qsos: qsos.value
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Successfully uploaded to file storage: ${result.added} new QSOs added, ${result.total} total on server`);
      
      // Mark as uploaded to avoid repeated uploads
      try {
        const currentSettings = await fileStorage.getSettings();
        await fileStorage.saveSettings({
          ...currentSettings,
          qsosUploadedToServer: true
        });
      } catch (settingsError) {
        console.warn('Failed to save upload flag to file storage:', settingsError);
      }
      return true;
    } else {
      console.error('❌ Failed to upload QSOs to server:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error uploading QSOs to server:', error);
    return false;
  }
}

// Force upload all QSOs (manual trigger)
export async function forceUploadAllQsos(): Promise<boolean> {
  console.log('🔄 Force uploading all QSOs to server file storage...');
  try {
    // Clear upload flag from file storage
    const currentSettings = await fileStorage.getSettings();
    await fileStorage.saveSettings({
      ...currentSettings,
      qsosUploadedToServer: false
    });
  } catch (error) {
    console.warn('Failed to clear upload flag in file storage:', error);
  }
  return await uploadLocalQsosToServer(true);
}

// Auto-upload QSOs when page loads (with delay to ensure server is ready)
setTimeout(async () => {
  try {
    const settings = await fileStorage.getSettings();
    const wasUploaded = settings.qsosUploadedToServer;
    if (!wasUploaded || qsos.value.length > 0) {
      console.log('🚀 Auto-uploading local QSOs to server on page load...');
      await uploadLocalQsosToServer();
    }
  } catch (error) {
    console.warn('Failed to check upload status from file storage:', error);
    // Default to upload if we can't check the status
    console.log('🚀 Auto-uploading local QSOs to server on page load...');
    await uploadLocalQsosToServer();
  }
}, 1000); // 1 second delay

// Register for network QSO updates
networkService.onQsoUpdate((update) => {
  console.log('📡 Received network QSO update:', update);
  handleNetworkQsoUpdate(update);
});

// Auto-start sync functionality
if (typeof window !== 'undefined') {
  console.log('🌐 Starting automatic QSO sync...');
  // The network service and API server will handle automatic syncing
}

// Set up network QSO synchronization
networkService.onQsoUpdate((update) => {
  handleNetworkQsoUpdate(update);
});

// Handle QSO updates from network
function handleNetworkQsoUpdate(update: any) {
  console.log('Received network QSO update:', update);
  
  const { action, qso, stationId } = update;
  const localStationId = getLocalStationId();
  
  // Don't process our own updates
  if (stationId === localStationId) {
    console.log('Skipping own QSO update');
    return;
  }
  
  console.log(`Processing ${action} from ${stationId} for QSO:`, qso);
  
  switch (action) {
    case 'add':
      addNetworkQso(qso);
      break;
    case 'update':
      updateNetworkQso(qso);
      break;
    case 'delete':
      deleteNetworkQso(qso.id);
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
      console.log('Dropped newer duplicate network QSO:', networkQso.call);
      return;
    } else {
      // Network QSO is older, replace existing
      const index = qsos.value.findIndex(q => q.id === existingQso.id);
      if (index >= 0) {
        qsos.value[index] = { ...networkQso };
        saveQsos(); // Use file storage
        console.log('Replaced with older network QSO:', networkQso.call);
      }
      return;
    }
  }
  
  // No duplicate found, add the QSO
  qsos.value.push(networkQso);
  qsos.value.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); // Sort by timestamp
  saveQsos(); // Use file storage
  console.log('Added network QSO:', networkQso.call);
}

function updateNetworkQso(networkQso: any) {
  const index = qsos.value.findIndex(qso => qso.id === networkQso.id);
  if (index >= 0) {
    // Check timestamp for conflict resolution (latest wins)
    const existingQso = qsos.value[index];
    if ((networkQso.timestamp || 0) >= (existingQso.timestamp || 0)) {
      qsos.value[index] = { ...networkQso };
      saveQsos(); // Use file storage
      console.log('Updated network QSO:', networkQso);
    }
  }
}

function deleteNetworkQso(qsoId: number) {
  const index = qsos.value.findIndex(qso => qso.id === qsoId);
  if (index >= 0) {
    qsos.value.splice(index, 1);
    saveQsos(); // Use file storage
    console.log('Deleted network QSO:', qsoId);
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
  
  // Upload new QSO to local server for sharing
  uploadSingleQsoToServer(newQso);
  
  // Broadcast QSO to network if connected
  networkService.broadcastQsoUpdate(newQso, 'add').catch(error => {
    console.error('Failed to broadcast QSO update:', error);
  });
}

// Upload a single QSO to the server
async function uploadSingleQsoToServer(qso: any): Promise<void> {
  try {
    const response = await fetch('/api/qsos/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        qsos: [qso]
      })
    });
    
    if (response.ok) {
      console.log(`📤 Uploaded QSO to server: ${qso.call}`);
    }
  } catch (error) {
    console.error('❌ Failed to upload QSO to server:', error);
  }
}

// Centralized save function using file storage
async function saveQsos(): Promise<void> {
  try {
    await fileStorage.saveQsoData(qsos.value);
    console.log(`💾 Saved ${qsos.value.length} QSOs to file storage`);
  } catch (error) {
    console.error('❌ Failed to save QSOs to file storage:', error);
  }
}

// Add these fully implemented functions
export function deleteQso(id: number) {
  console.log('Deleting QSO with ID:', id);
  
  // Find the QSO being deleted for network broadcast
  const deletedQso = qsos.value.find(qso => qso.id === id);
  
  // Create a new array without the QSO to delete
  const updatedQsos = qsos.value.filter(qso => qso.id !== id);
  
  // Update the reactive reference
  qsos.value = updatedQsos;
  
  // Update file storage
  saveQsos(); // Use file storage
  
  // Broadcast deletion to network if connected and QSO was found
  if (deletedQso) {
    networkService.broadcastQsoUpdate(deletedQso, 'delete').catch(error => {
      console.error('Failed to broadcast QSO deletion:', error);
    });
  }
  
  console.log('QSO deleted, new count:', qsos.value.length);
}

export function updateQso(id: number, updatedQso: QSO) {
  console.log('Updating QSO with ID:', id, updatedQso);
  
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
    
    // Broadcast update to network if connected
    networkService.broadcastQsoUpdate(updated, 'update').catch(error => {
      console.error('Failed to broadcast QSO update:', error);
    });
    
    console.log('QSO updated:', updated);
  } else {
    console.log('QSO not found for update:', id);
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