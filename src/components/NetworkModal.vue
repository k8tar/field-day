<!-- filepath: c:\git\k8tar-fieldday\src\components\NetworkModal.vue -->
<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content network-modal">
      <div class="modal-header">
        <h2>Network Synchronization</h2>
        <button class="close-button" @click="close">
          <span class="material-icons">close</span>
        </button>
      </div>
      
      <div class="modal-body">
        <!-- Backend Connection Status -->
        <div class="network-status">
          <div class="status-header">
            <h3>
              <span class="material-icons" :class="{ 'connected': isConnected, 'disconnected': !isConnected }">
                {{ isConnected ? 'wifi' : 'wifi_off' }}
              </span>
              Backend Status: {{ isConnected ? 'Connected' : 'Disconnected' }}
            </h3>
          </div>
          
          <div class="connection-info" v-if="isConnected">
            <p><strong>Backend Service:</strong> http://localhost:3030</p>
            <p><strong>Your Station:</strong> {{ localStationInfo.callsign }} ({{ localStationInfo.designator }})</p>
            <p><strong>Discovered Stations:</strong> {{ discoveredStations.length }}</p>
          </div>
          
          <div v-if="!isConnected" class="connection-error">
            <div class="error-header">
              <span class="material-icons error-icon">error</span>
              <h4>Backend Service Required</h4>
            </div>
            
            <div class="error-details">
              <p v-if="backendError"><strong>Error:</strong> {{ backendError }}</p>
              <p>The Field Day Logger requires the Rust backend service to be running for mesh networking and QSO synchronization.</p>
              
              <div class="error-actions">
                <div class="action-item">
                  <span class="material-icons">play_arrow</span>
                  <span>Start the backend service using <code>start-backend.bat</code> or <code>start-backend.sh</code></span>
                </div>
                
                <div class="action-item" v-if="isElectron">
                  <button class="restart-button" @click="attemptRestart" :disabled="isRestarting">
                    <span class="material-icons">refresh</span>
                    {{ isRestarting ? 'Restarting...' : 'Attempt Restart' }}
                  </button>
                </div>
                
                <div class="action-item">
                  <button class="retry-button" @click="retryConnection" :disabled="isRetrying">
                    <span class="material-icons">sync</span>
                    {{ isRetrying ? 'Checking...' : 'Retry Connection' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Connection Settings -->
        <div class="connection-settings" v-if="isConnected">
          <h3>Network Mode</h3>
          
          <div class="setting-group">
            <label for="network-mode">Mode:</label>
            <select id="network-mode" v-model="networkMode" @change="onNetworkModeChange">
              <option value="mesh">Mesh Network (Recommended)</option>
              <option value="auto">Auto-discover</option>
              <option value="host">Host Network</option>
              <option value="join">Join Network</option>
            </select>
          </div>
          
          <div v-if="networkMode === 'join'" class="setting-group">
            <label for="host-address">Host Address:</label>
            <input 
              id="host-address" 
              type="text" 
              v-model="hostAddress"
              placeholder="192.168.1.100:8080"
            >
          </div>
        </div>

        <!-- Mesh Network Nodes -->
        <div v-if="isConnected && networkMode === 'mesh'" class="mesh-nodes">
          <h3>
            <span class="material-icons">device_hub</span>
            Mesh Network Stations ({{ discoveredStations.length }})
          </h3>
          
          <div class="mesh-status-summary">
            <div class="mesh-health" :class="meshStatus.meshHealth">
              <span class="health-indicator"></span>
              Network Health: {{ meshStatus.meshHealth.toUpperCase() }}
            </div>
            <div class="mesh-stats">
              <span>Discovered: {{ meshStatus.discoveredNodes }}</span>
              <span>Connected: {{ meshStatus.connectedNodes }}</span>
            </div>
          </div>
          
          <div v-if="stationsWithStatus.length > 0" class="stations-list">
            <div 
              v-for="station in stationsWithStatus" 
              :key="station.id" 
              class="station-card mesh-node"
            >
              <div class="station-info">
                <div class="station-header">
                  <span class="station-callsign">{{ station.call_sign }}</span>
                  <span class="station-designator">{{ station.class }}</span>
                  <span class="node-status" :class="stationStatusService.getStatusClass(station.status.status)">
                    <span class="status-indicator" :style="{ backgroundColor: stationStatusService.getStatusColor(station.status.status) }"></span>
                    {{ station.is_self ? 'Self' : stationStatusService.getStatusDescription(station.status) }}
                  </span>
                </div>
                <div class="station-details">
                  <span class="station-ip">{{ station.ip_address }}:{{ station.port }}</span>
                  <span class="station-section">{{ station.section }}</span>
                </div>
                <div class="node-capabilities">
                  <span class="capability-tag">Field Day</span>
                  <span v-if="station.status.requestCount > 0" class="capability-tag warning">
                    {{ station.status.requestCount }} missed
                  </span>
                </div>
                <div class="station-status">
                  <span class="last-seen">{{ stationStatusService.formatLastSeen(station.status.lastSeen) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="no-nodes">
            <div class="material-icons" style="font-size: 3rem; opacity: 0.3;">device_hub</div>
            <p><strong>No Field Day stations discovered</strong></p>
            <p>Make sure other stations are running Field Day Logger with the backend service.</p>
          </div>

          <div class="mesh-actions">
            <button 
              class="refresh-button" 
              @click="refreshMeshDiscovery"
              :disabled="isRefreshing"
            >
              <span class="material-icons" :class="{ 'spinning': isRefreshing }">refresh</span>
              {{ isRefreshing ? 'Discovering...' : 'Refresh Discovery' }}
            </button>
            
            <button 
              class="sync-button" 
              @click="forceMeshSync"
              :disabled="isSyncing"
            >
              <span class="material-icons" :class="{ 'spinning': isSyncing }">sync</span>
              {{ isSyncing ? 'Syncing...' : 'Force Sync' }}
            </button>
          </div>
        </div>

        <!-- Discovered Stations (Auto mode) -->
        <div v-if="networkMode === 'auto' && stationsWithStatus.length > 0" class="discovered-stations">
          <h3>
            <span class="material-icons">search</span>
            Discovered Stations ({{ stationsWithStatus.length }})
          </h3>
          
          <div class="stations-list">
            <div 
              v-for="station in stationsWithStatus" 
              :key="station.id" 
              class="station-card"
            >
              <div class="station-info">
                <div class="station-header">
                  <span class="station-callsign">{{ station.call_sign }}</span>
                  <span class="station-designator">{{ station.class }}</span>
                  <span class="node-status" :class="stationStatusService.getStatusClass(station.status.status)">
                    <span class="status-indicator" :style="{ backgroundColor: stationStatusService.getStatusColor(station.status.status) }"></span>
                    {{ stationStatusService.getStatusDescription(station.status) }}
                  </span>
                </div>
                <div class="station-details">
                  <span class="station-ip">{{ station.ip_address }}:{{ station.port }}</span>
                </div>
                <div class="station-status">
                  <span class="last-seen">{{ stationStatusService.formatLastSeen(station.status.lastSeen) }}</span>
                </div>
              </div>
              <button 
                class="connect-button" 
                @click="connectToStation(station)"
                :disabled="station.status.status === 'offline'"
              >
                Connect
              </button>
            </div>
          </div>
        </div>

        <!-- No Stations Found -->
        <div v-if="(networkMode === 'auto') && stationsWithStatus.length === 0 && !isScanning" class="no-stations">
          <p><strong>No stations found</strong></p>
          <p>Make sure other Field Day Logger instances are running on the network.</p>
          <p>Try using <strong>Mesh Network</strong> mode for better discovery.</p>
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-left">
          <button 
            v-if="networkMode === 'auto'" 
            class="scan-button" 
            @click="scanForStations"
            :disabled="isScanning"
          >
            <span class="material-icons" :class="{ 'spinning': isScanning }">search</span>
            {{ isScanning ? 'Scanning...' : 'Scan Network' }}
          </button>
        </div>
        
        <div class="footer-right">
          <button 
            v-if="canConnect && !isConnected" 
            class="connect-button primary" 
            @click="startConnection"
            :disabled="isConnecting"
          >
            <span class="material-icons" :class="getNetworkModeIcon()">{{ getNetworkModeIcon() }}</span>
            {{ isConnecting ? 'Starting...' : getNetworkModeButtonText() }}
          </button>
          
          <div v-if="connectionStatus" class="connection-status" :class="{ 
            'status-error': connectionStatus.includes('failed') || connectionStatus.includes('error'),
            'status-success': connectionStatus.includes('success'),
            'status-progress': connectionStatus.includes('Starting') || connectionStatus.includes('Discovering')
          }">
            {{ connectionStatus }}
          </div>
          
          <button 
            v-if="isConnected" 
            class="disconnect-button" 
            @click="disconnect"
          >
            <span class="material-icons">wifi_off</span>
            Disconnect
          </button>
          <button class="cancel-button" @click="close">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { backendApi, type BackendStation } from '@/services/backendApiService';
import { fileStorage } from '@/services/fileStorage';
import { stationStatusService, type StationStatus } from '@/services/stationStatusService';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Backend connection state
const isConnected = computed(() => backendApi.connected.value);
const backendError = computed(() => backendApi.error.value);
const networkMode = ref<'auto' | 'mesh' | 'host' | 'join'>('mesh');
const hostAddress = ref('');

// Station information
const localStationInfo = ref({
  callsign: '',
  designator: '1A'
});

// Discovered stations from backend
const discoveredStations = ref<BackendStation[]>([]);

// Enhanced station status tracking
const stationStatuses = ref<Map<string, StationStatus>>(new Map());

// Combined view of stations with status
const stationsWithStatus = computed(() => {
  return discoveredStations.value.map(station => {
    const status = stationStatuses.value.get(station.id);
    return {
      ...station,
      status: status || {
        id: station.id,
        callSign: station.call_sign,
        ipAddress: station.ip_address,
        port: station.port,
        lastSeen: Date.now(),
        firstSeen: Date.now(),
        requestCount: 0,
        isOnline: true,
        status: 'online' as const
      }
    };
  });
});

// Status tracking
const isRefreshing = ref(false);
const isSyncing = ref(false);
const isScanning = ref(false);
const connectionStatus = ref<string>('');
const isConnecting = ref(false);
const isRestarting = ref(false);
const isRetrying = ref(false);

// Environment detection
const isElectron = computed(() => {
  return typeof window !== 'undefined' && (window as any).Electron;
});

// Mesh status
const meshStatus = computed(() => ({
  meshHealth: stationsWithStatus.value.length > 0 ? 'good' : 'warning',
  discoveredNodes: stationsWithStatus.value.length,
  connectedNodes: stationsWithStatus.value.filter(s => !s.is_self && s.status.status === 'online').length,
}));

// Computed properties
const canConnect = computed(() => {
  if (networkMode.value === 'host' || networkMode.value === 'mesh') {
    return true;
  } else if (networkMode.value === 'join') {
    return hostAddress.value.trim().length > 0;
  } else {
    return discoveredStations.value.length > 0;
  }
});

// Load station info on mount
async function refreshStationInfo() {
  try {
    const stationConfig = await fileStorage.getStationConfig();
    localStationInfo.value.callsign = stationConfig.callsign || '';
    localStationInfo.value.designator = stationConfig.designator || '1A';
    
    // Sync with backend if connected
    await syncStationConfigWithBackend();
  } catch (error) {
    console.error('Error loading station config:', error);
    localStationInfo.value.callsign = '';
    localStationInfo.value.designator = '1A';
  }
}

// Sync station configuration between file storage and backend
async function syncStationConfigWithBackend() {
  if (!backendApi.connected.value) {
    console.log('Backend not connected - skipping sync');
    return;
  }
  
  try {
    // Get current backend station info
    const backendStationInfo = await backendApi.getStationInfo();
    
    // Get current file storage config
    const fileConfig = await fileStorage.getStationConfig();
    
    if (!backendStationInfo) {
      // Backend has no station info - update it with file storage data
      console.log('📝 Backend has no station info - updating from file storage');
      await backendApi.updateStationInfo({
        call_sign: fileConfig.callsign || '',
        name: fileConfig.callsign || '',
        section: fileConfig.stationSection || 'CT',
        class: fileConfig.designator || '1A',
      });
    } else {
      // Backend has station info - check if file storage differs
      if (fileConfig.callsign !== backendStationInfo.call_sign || 
          fileConfig.designator !== backendStationInfo.class) {
        
        // Determine which is more recent based on file storage timestamp
        const fileConfigTime = fileConfig.lastUpdated || 0;
        const currentTime = Date.now();
        
        // If file config was updated recently (within last hour), prefer it
        if (currentTime - fileConfigTime < 3600000) { // 1 hour
          console.log('📝 File storage updated recently - updating backend configuration');
          await backendApi.updateStationInfo({
            call_sign: fileConfig.callsign || '',
            name: fileConfig.callsign || '',
            section: fileConfig.stationSection || 'CT',
            class: fileConfig.designator || '1A',
          });
        } else {
          // Use backend data as source of truth
          console.log('📝 Using backend as source of truth - updating file storage');
          await fileStorage.saveStationConfig({
            callsign: backendStationInfo.call_sign || '',
            designator: backendStationInfo.class || '1A',
            stationSection: backendStationInfo.section || 'CT',
            lastUpdated: currentTime
          });
          
          // Update local state
          localStationInfo.value.callsign = backendStationInfo.call_sign || '';
          localStationInfo.value.designator = backendStationInfo.class || '1A';
        }
      }
    }
    
    console.log('✅ Station configuration synchronized successfully');
  } catch (error) {
    console.error('❌ Failed to sync station configuration:', error);
  }
}

// Watch for station info changes
watch(() => localStationInfo.value.callsign, async (newCallsign) => {
  try {
    const currentConfig = await fileStorage.getStationConfig();
    if (newCallsign !== currentConfig.callsign) {
      await fileStorage.saveStationConfig({ 
        callsign: newCallsign,
        lastUpdated: Date.now()
      });
      
      // Update backend
      if (newCallsign && isConnected.value) {
        const success = await backendApi.updateStationInfo({
          call_sign: newCallsign,
          name: newCallsign, // Use callsign as name
          section: currentConfig.stationSection || 'CT', // Use saved section or default
          class: localStationInfo.value.designator
        });
        
        if (success) {
          console.log('✅ Station callsign updated in backend');
        } else {
          console.error('❌ Failed to update station callsign in backend');
        }
      }
      
      window.dispatchEvent(new CustomEvent('stationInfoUpdate'));
    }
  } catch (error) {
    console.error('Failed to save callsign:', error);
  }
});

watch(() => localStationInfo.value.designator, async (newDesignator) => {
  try {
    const currentConfig = await fileStorage.getStationConfig();
    if (newDesignator !== currentConfig.designator) {
      await fileStorage.saveStationConfig({ 
        designator: newDesignator,
        lastUpdated: Date.now()
      });
      
      // Update backend
      if (localStationInfo.value.callsign && isConnected.value) {
        const success = await backendApi.updateStationInfo({
          call_sign: localStationInfo.value.callsign,
          name: localStationInfo.value.callsign,
          section: currentConfig.stationSection || 'CT',
          class: newDesignator
        });
        
        if (success) {
          console.log('✅ Station designator updated in backend');
        } else {
          console.error('❌ Failed to update station designator in backend');
        }
      }
      
      window.dispatchEvent(new CustomEvent('stationInfoUpdate'));
    }
  } catch (error) {
    console.error('Failed to save designator:', error);
  }
});

// Functions
function close() {
  emit('close');
}

// Attempt to restart the backend service
async function attemptRestart() {
  if (isRestarting.value) return;
  
  isRestarting.value = true;
  try {
    console.log('🔄 Attempting to restart backend service...');
    
    if (isElectron.value) {
      const restartFunction = (window as any).restartBackendService;
      if (restartFunction) {
        const success = await restartFunction();
        if (success) {
          console.log('✅ Backend service restarted successfully');
        } else {
          console.error('❌ Failed to restart backend service');
        }
      } else {
        console.error('❌ Restart function not available');
      }
    }
  } catch (error) {
    console.error('❌ Error restarting backend service:', error);
  } finally {
    isRestarting.value = false;
  }
}

// Retry connection to backend service
async function retryConnection() {
  if (isRetrying.value) return;
  
  isRetrying.value = true;
  try {
    console.log('🔄 Retrying backend connection...');
    
    // Try to get station info to test connection
    await backendApi.getStationInfo();
    
    // Wait a moment for the connection to establish
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (backendApi.connected.value) {
      console.log('✅ Backend connection successful');
    } else {
      console.log('❌ Backend still not available');
    }
  } catch (error) {
    console.error('❌ Error retrying connection:', error);
  } finally {
    isRetrying.value = false;
  }
}

function onNetworkModeChange() {
  discoveredStations.value = [];
  if (networkMode.value === 'auto') {
    scanForStations();
  }
}

async function scanForStations() {
  if (!isConnected.value) return;
  
  isScanning.value = true;
  try {
    // First trigger discovery
    await backendApi.discoverStations();
    
    // Then get the current list of discovered stations
    const stations = await backendApi.getDiscoveredStations();
    discoveredStations.value = stations;
    
    // Update station statuses
    updateStationStatuses(stations);
    
    console.log(`🔍 Scanned for stations: ${stations.length} found`);
  } catch (error) {
    console.error('Failed to scan for stations:', error);
  } finally {
    isScanning.value = false;
  }
}

/**
 * Update station statuses based on discovered stations
 */
function updateStationStatuses(stations: BackendStation[]) {
  // Load current statuses
  stationStatuses.value = stationStatusService.getStationStatuses();
  
  // Get IDs of stations seen in this discovery
  const seenStationIds = stations.map(s => s.id);
  
  // Update statuses for seen stations
  stations.forEach(station => {
    stationStatusService.updateStationSeen(station);
  });
  
  // Update request counts for missed stations
  stationStatusService.updateMissedStations(seenStationIds);
  
  // Reload statuses after updates
  stationStatuses.value = stationStatusService.getStationStatuses();
  
  // Clean up old offline stations
  stationStatusService.cleanupOldStations();
}

function connectToStation(station: BackendStation) {
  console.log('Connecting to station:', station.call_sign);
  // Backend handles the connection logic
}

async function startConnection() {
  if (isConnecting.value || !isConnected.value) return;
  
  isConnecting.value = true;
  connectionStatus.value = 'Starting connection...';
  
  try {
    if (networkMode.value === 'mesh') {
      connectionStatus.value = 'Starting mesh network discovery...';
      
      // Trigger mesh discovery via backend
      await backendApi.discoverStations();
      
      // Get the current list of discovered stations
      const stations = await backendApi.getDiscoveredStations();
      discoveredStations.value = stations;
      
      console.log(`🚀 Mesh network started: ${stations.length} stations discovered`);
      connectionStatus.value = 'Mesh network started successfully!';
    } else if (networkMode.value === 'host') {
      connectionStatus.value = 'Starting as host...';
      connectionStatus.value = 'Host started successfully!';
    } else if (networkMode.value === 'join') {
      connectionStatus.value = `Connecting to ${hostAddress.value}...`;
      connectionStatus.value = 'Connected successfully!';
    }
    
    // Clear status after 3 seconds
    setTimeout(() => {
      connectionStatus.value = '';
    }, 3000);
    
  } catch (error) {
    console.error('Connection failed:', error);
    connectionStatus.value = `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    setTimeout(() => {
      connectionStatus.value = '';
    }, 10000);
  } finally {
    isConnecting.value = false;
  }
}

function disconnect() {
  discoveredStations.value = [];
  connectionStatus.value = 'Disconnected';
  setTimeout(() => {
    connectionStatus.value = '';
  }, 3000);
}

async function refreshMeshDiscovery() {
  if (isRefreshing.value || !isConnected.value) return;
  
  isRefreshing.value = true;
  try {
    console.log('🔍 Starting mesh discovery...');
    
    // First trigger discovery
    await backendApi.discoverStations();
    console.log('✅ Discovery triggered successfully');
    
    // Wait a moment for discovery to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then get the current list of discovered stations
    const stations = await backendApi.getDiscoveredStations();
    discoveredStations.value = stations;
    
    // Update station statuses
    updateStationStatuses(stations);
    
    console.log(`📡 Refreshed mesh discovery: ${stations.length} stations found`);
    stations.forEach((station, index) => {
      const statusInfo = stationStatuses.value.get(station.id);
      console.log(`  Station ${index + 1}: ${station.call_sign} (${station.class}) at ${station.ip_address}:${station.port} - Self: ${station.is_self}, Status: ${statusInfo?.status || 'unknown'}`);
    });
  } catch (error) {
    console.error('Failed to refresh mesh discovery:', error);
  } finally {
    isRefreshing.value = false;
  }
}

async function forceMeshSync() {
  if (isSyncing.value || !isConnected.value) return;
  
  isSyncing.value = true;
  try {
    // Backend handles QSO synchronization
    await backendApi.getQsoCount();
  } catch (error) {
    console.error('Failed to force mesh sync:', error);
  } finally {
    isSyncing.value = false;
  }
}

function getNetworkModeIcon(): string {
  switch (networkMode.value) {
    case 'host': return 'router';
    case 'mesh': return 'device_hub';
    case 'join': return 'wifi';
    case 'auto': return 'wifi_find';
    default: return 'wifi';
  }
}

function getNetworkModeButtonText(): string {
  switch (networkMode.value) {
    case 'host': return 'Start Hosting';
    case 'mesh': return 'Start Mesh Network';
    case 'join': return 'Connect';
    case 'auto': return 'Connect';
    default: return 'Connect';
  }
}

// Load initial data on mount
onMounted(async () => {
  await refreshStationInfo();
  
  // Load station statuses from localStorage
  stationStatuses.value = stationStatusService.getStationStatuses();
  
  // Listen for station info updates from config modal
  window.addEventListener('stationInfoUpdate', refreshStationInfo);
  
  // Always fetch discovered stations on mount if connected
  if (isConnected.value) {
    try {
      console.log('🔍 Fetching discovered stations on mount...');
      const stations = await backendApi.getDiscoveredStations();
      discoveredStations.value = stations;
      
      // Update station statuses
      updateStationStatuses(stations);
      
      console.log(`📡 Found ${stations.length} discovered stations on mount`);
    } catch (error) {
      console.error('Failed to fetch discovered stations on mount:', error);
    }
    
    // Auto-start mesh discovery if in mesh mode
    if (networkMode.value === 'mesh') {
      await refreshMeshDiscovery();
    }
  }
  
  // Set up periodic refresh of discovered stations every 10 seconds for better responsiveness
  const refreshInterval = setInterval(async () => {
    if (isConnected.value && (networkMode.value === 'mesh' || networkMode.value === 'auto') && !isRefreshing.value) {
      try {
        const stations = await backendApi.getDiscoveredStations();
        if (stations.length !== discoveredStations.value.length) {
          console.log(`📡 Station count changed: ${discoveredStations.value.length} -> ${stations.length}`);
        }
        discoveredStations.value = stations;
        
        // Update station statuses
        updateStationStatuses(stations);
      } catch (error) {
        console.error('Failed to refresh discovered stations:', error);
      }
    }
  }, 10000); // 10 seconds for more responsive updates
  
  // Store interval ID for cleanup
  (window as any).networkModalRefreshInterval = refreshInterval;
});

// Clean up event listeners on unmount
onUnmounted(() => {
  window.removeEventListener('stationInfoUpdate', refreshStationInfo);
  
  // Clean up periodic refresh interval
  if ((window as any).networkModalRefreshInterval) {
    clearInterval((window as any).networkModalRefreshInterval);
    delete (window as any).networkModalRefreshInterval;
  }
});

// Watch for backend connection changes
watch(isConnected, async (connected) => {
  if (connected && networkMode.value === 'mesh') {
    await refreshMeshDiscovery();
  } else if (!connected) {
    // Clear discovered stations when disconnected
    discoveredStations.value = [];
  }
});

// Watch for network mode changes
watch(networkMode, async (newMode) => {
  if (newMode === 'mesh' && isConnected.value) {
    await refreshMeshDiscovery();
  } else {
    discoveredStations.value = [];
  }
});

// Watch for modal opening/closing
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && isConnected.value) {
    // Refresh discovered stations when modal opens, regardless of mode
    try {
      console.log('📱 Network modal opened - fetching discovered stations...');
      const stations = await backendApi.getDiscoveredStations();
      discoveredStations.value = stations;
      
      // Update station statuses
      updateStationStatuses(stations);
      
      console.log(`📡 Modal opened: ${stations.length} stations loaded from backend`);
      
      // Also trigger discovery if in mesh mode to ensure fresh data
      if (networkMode.value === 'mesh') {
        console.log('🔍 Triggering mesh discovery for fresh data...');
        await backendApi.discoverStations();
        
        // Wait a moment then fetch updated list
        setTimeout(async () => {
          try {
            const updatedStations = await backendApi.getDiscoveredStations();
            discoveredStations.value = updatedStations;
            
            // Update station statuses again
            updateStationStatuses(updatedStations);
            
            console.log(`After discovery: ${updatedStations.length} stations found`);
          } catch (error) {
            console.error('Failed to get updated stations after discovery:', error);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to load discovered stations on modal open:', error);
    }
  }
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.network-modal {
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  background-color: var(--form-bg);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-color);
  border-radius: 8px 8px 0 0;
}

.modal-header h2 {
  margin: 0;
  color: var(--text-color);
  font-size: 1.25rem;
}

.close-button {
  background: none;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.close-button:hover {
  background-color: var(--border-color);
}

.modal-body {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  color: var(--text-color);
}

.network-status {
  margin-bottom: 2rem;
}

.status-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.material-icons.connected {
  color: #22c55e;
}

.material-icons.disconnected {
  color: #ef4444;
}

.connection-info {
  background-color: var(--bg-color);
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.connection-info p {
  margin: 0.5rem 0;
}

.connection-error {
  background-color: var(--error-bg, #fee);
  border: 1px solid var(--error-border, #fcc);
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1rem 0;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  
  .error-icon {
    color: var(--error-color, #d63384);
    font-size: 1.25rem;
  }
  
  h4 {
    margin: 0;
    color: var(--error-color, #d63384);
  }
}

.error-details {
  p {
    margin: 0.5rem 0;
    color: var(--text-color);
  }
  
  code {
    background-color: var(--code-bg, #f8f9fa);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
  }
}

.error-actions {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  
  .material-icons {
    color: var(--primary-color);
    font-size: 1.1rem;
  }
}

.restart-button,
.retry-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: var(--primary-hover);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .material-icons {
    font-size: 1rem;
    color: inherit;
  }
}

.retry-button {
  background-color: var(--secondary-color, #6c757d);
  
  &:hover:not(:disabled) {
    background-color: var(--secondary-hover, #545b62);
  }
}

.connection-settings {
  margin-bottom: 2rem;
}

.connection-settings h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.setting-group {
  margin-bottom: 1rem;
}

.setting-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.setting-group input,
.setting-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--form-bg);
  color: var(--text-color);
  font-size: 0.9rem;
}

.mesh-nodes {
  margin-bottom: 2rem;

  h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
  }
}

.mesh-status-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.mesh-health {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;

  .health-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #ccc;
  }

  &.good .health-indicator {
    background-color: #4CAF50;
  }

  &.warning .health-indicator {
    background-color: #FF9800;
  }
}

.mesh-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  opacity: 0.8;
  flex-wrap: wrap;

  span {
    white-space: nowrap;
  }
}

.stations-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.station-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  transition: border-color 0.2s ease;
}

.station-card:hover {
  border-color: var(--primary-color);
}

.station-info {
  flex: 1;
}

.station-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.station-callsign {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--primary-color);
}

.station-designator {
  background-color: var(--primary-color);
  color: white;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 500;
}

.station-details {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--text-color);
  opacity: 0.8;
  margin-bottom: 0.25rem;
}

.station-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.node-capabilities {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.capability-tag {
  background-color: var(--primary-color);
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;

  &.warning {
    background-color: #f59e0b;
  }
}

.node-status {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  &.status-online {
    background-color: rgba(34, 197, 94, 0.1);
    color: #15803d;
  }

  &.status-warning {
    background-color: rgba(245, 158, 11, 0.1);
    color: #92400e;
  }

  &.status-offline {
    background-color: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }

  &.status-unknown {
    background-color: rgba(156, 163, 175, 0.1);
    color: #6b7280;
  }
}

.mesh-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.refresh-button,
.sync-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover:not(:disabled) {
    background-color: var(--primary-hover);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.no-nodes,
.no-stations {
  text-align: center;
  padding: 2rem;
  color: var(--text-color);
  opacity: 0.7;

  p {
    margin: 0.5rem 0;
  }
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-color);
  border-radius: 0 0 8px 8px;
}

.footer-left {
  display: flex;
  gap: 0.5rem;
}

.footer-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.scan-button,
.connect-button,
.disconnect-button,
.cancel-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--form-bg);
  color: var(--text-color);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.connect-button.primary {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.disconnect-button {
  background-color: #ef4444;
  color: white;
  border-color: #ef4444;
}

.scan-button:hover,
.connect-button:hover,
.disconnect-button:hover,
.cancel-button:hover {
  opacity: 0.8;
}

.scan-button:disabled,
.connect-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.connection-status {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  text-align: center;
  border: 1px solid;
  transition: all 0.3s ease;
}

.connection-status.status-progress {
  background-color: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.connection-status.status-success {
  background-color: #d1fae5;
  border-color: #22c55e;
  color: #15803d;
}

.connection-status.status-error {
  background-color: #fee2e2;
  border-color: #ef4444;
  color: #dc2626;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
