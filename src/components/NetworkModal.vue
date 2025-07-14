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
            <p><strong>Your Station:</strong> {{ localStationInfo.callsign }} ({{ localStationInfo.designator }})</p>
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

        <!-- Mesh Network Nodes -->
        <div v-if="isConnected" class="mesh-nodes">
          <h3>
            <span class="material-icons">device_hub</span>
            {{ isMeshActive ? `Mesh Network Stations (${discoveredStations.length})` : 'Mesh Network (Disabled)' }}
          </h3>
          
          <div class="mesh-status-summary">
            <div class="mesh-health" :class="meshStatus.meshHealth">
              <span class="health-indicator"></span>
              Network Health: {{ meshStatus.meshHealth === 'disabled' ? 'DISABLED' : meshStatus.meshHealth.toUpperCase() }}
            </div>
            <div v-if="isMeshActive" class="mesh-stats">
              <span>Discovered: {{ meshStatus.discoveredNodes }}</span>
              <span>Connected: {{ meshStatus.connectedNodes }}</span>
            </div>
            <div v-else class="mesh-stats">
              <span>Mesh networking disabled - running in standalone mode</span>
            </div>
          </div>
          
          <!-- Only show stations and controls when mesh is active -->
          <div v-if="isMeshActive && stationsWithStatus.length > 0" class="stations-list">
            <div 
              v-for="station in stationsWithStatus" 
              :key="station.id" 
              class="station-card mesh-node"
            >
              <div class="station-info">
                <div class="station-header">
                  <span class="station-callsign">{{ station.call_sign }}</span>
                  <span v-if="station.class" class="station-designator">{{ station.class }}</span>
                  <span v-else class="station-designator unknown">Unknown</span>
                  <span class="node-status" :class="stationStatusService.getStatusClass(station.status.status)">
                    <span class="status-indicator" :style="{ backgroundColor: stationStatusService.getStatusColor(station.status.status) }"></span>
                    {{ station.is_self ? 'Self' : stationStatusService.getStatusDescription(station.status) }}
                  </span>
                </div>
                <div class="station-details">
                  <span class="station-ip">{{ station.ip_address }}:{{ station.port }}</span>
                  <span v-if="station.section" class="station-section">{{ station.section }}</span>
                  <span v-else class="station-section unknown">Unknown Section</span>
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
          
          <div v-else-if="isMeshActive" class="no-nodes">
            <div class="material-icons" style="font-size: 3rem; opacity: 0.3;">device_hub</div>
            <p><strong>No Field Day stations discovered</strong></p>
            <p>Make sure other stations are running Field Day Logger with the backend service.</p>
          </div>
          
          <div v-else class="mesh-disabled">
            <div class="material-icons" style="font-size: 3rem; opacity: 0.3;">wifi_off</div>
            <p><strong>Mesh networking is disabled</strong></p>
            <p>This station is running in standalone mode. Enable mesh networking to discover and synchronize with other Field Day stations.</p>
          </div>

          <div v-if="isMeshActive" class="mesh-actions">
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
            
            <button 
              class="reset-log-button" 
              @click="showResetConfirmation"
              :disabled="isResettingLog"
            >
              <span class="material-icons" :class="{ 'spinning': isResettingLog }">delete_sweep</span>
              {{ isResettingLog ? 'Resetting...' : 'Reset Network Log' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Log Reset Confirmation Dialog -->
      <div v-if="showResetDialog" class="reset-confirmation-overlay" @click.self="cancelReset">
        <div class="reset-confirmation-dialog">
          <div class="reset-dialog-header">
            <h3>
              <span class="material-icons warning-icon">warning</span>
              Reset Network Log
            </h3>
          </div>
          <div class="reset-dialog-body">
            <p><strong>This will permanently delete ALL QSOs and Messages from ALL stations in the network!</strong></p>
            <p>This action:</p>
            <ul>
              <li>Clears all logged contacts from every station</li>
              <li>Clears all messages from every station</li>
              <li>Resets achievement progress for all stations</li>
              <li>Cannot be undone</li>
              <li>Will force late-joining stations to also clear their logs</li>
            </ul>
            <p>Only use this if you need to restart the Field Day logging session.</p>
            
            <div class="reset-confirmation-input">
              <label for="reset-confirmation">Type "RESET" to confirm:</label>
              <input 
                id="reset-confirmation"
                v-model="resetConfirmationText" 
                type="text" 
                placeholder="Type RESET to confirm"
                @keyup.enter="confirmReset"
              />
            </div>
          </div>
          <div class="reset-dialog-footer">
            <button class="cancel-reset-button" @click="cancelReset">
              Cancel
            </button>
            <button 
              class="confirm-reset-button" 
              @click="confirmReset"
              :disabled="resetConfirmationText.toUpperCase() !== 'RESET' || isResettingLog"
            >
              <span class="material-icons" :class="{ 'spinning': isResettingLog }">delete_sweep</span>
              {{ isResettingLog ? 'Resetting...' : 'Reset Network Log' }}
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-left">
        </div>
        
        <div class="footer-right">
          <!-- Connect button - show when backend is connected but mesh is not active -->
          <button 
            v-if="isConnected && !isMeshActive" 
            class="connect-button primary" 
            @click="connectToMesh"
            :disabled="isConnecting"
          >
            <span class="material-icons">wifi</span>
            {{ isConnecting ? 'Connecting...' : 'Connect to Mesh' }}
          </button>
          
          <!-- Disconnect button - show when mesh is active -->
          <button 
            v-if="isConnected && isMeshActive" 
            class="disconnect-button" 
            @click="disconnect"
            :disabled="isDisconnecting"
          >
            <span class="material-icons">wifi_off</span>
            {{ isDisconnecting ? 'Disconnecting...' : 'Disconnect' }}
          </button>
          
          <div v-if="connectionStatus" class="connection-status" :class="{ 
            'status-error': connectionStatus.includes('failed') || connectionStatus.includes('error'),
            'status-success': connectionStatus.includes('success'),
            'status-progress': connectionStatus.includes('Starting') || connectionStatus.includes('Discovering')
          }">
            {{ connectionStatus }}
          </div>
          
          <button class="cancel-button" @click="close">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { backendApi, type BackendStation } from '@/services/backendApiService';
import { fileStorage } from '@/services/fileStorage';
import { stationStatusService as stationService, type StationStatus } from '@/services/stationStatusService';
import { backgroundNetworkService, meshConnectionState } from '@/services/backgroundNetworkService';
import { meshNetworkService } from '@/services/meshNetworkService';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Backend connection state
const isConnected = computed(() => backendApi.connected.value);
const backendError = computed(() => backendApi.error.value);

// Mesh network state - use shared state from background service with forced reactivity
const meshConnectionStateReactive = ref(meshConnectionState.isConnected);
const isMeshActive = computed(() => meshConnectionStateReactive.value);

// Watch for changes to the singleton state and update our reactive ref
const updateMeshState = () => {
  meshConnectionStateReactive.value = meshConnectionState.isConnected;
};

// Set up listener for mesh state changes
meshConnectionState.onConnectionChange(updateMeshState);
const isConnecting = ref(false);
const isDisconnecting = ref(false);

// Station information
const localStationInfo = ref({
  callsign: '',
  designator: '1A'
});

// Discovered stations from backend
const discoveredStations = ref<BackendStation[]>([]);

// Enhanced station status tracking
const stationStatuses = ref<Map<string, StationStatus>>(new Map());

// Expose the service for template use
const stationStatusService = stationService;

// Combined view of stations with status
const stationsWithStatus = computed(() => {
  const stationMap = new Map();
  
  // First, add all currently discovered stations
  discoveredStations.value.forEach(station => {
    const status = stationStatuses.value.get(station.id);
    stationMap.set(station.id, {
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
    });
  });
  
  // Then, add any stations from status service that might not be in current discovery
  // (these would be offline/warning stations)
  stationStatuses.value.forEach((status, stationId) => {
    if (!stationMap.has(stationId)) {
      // Create a minimal station object for offline stations
      stationMap.set(stationId, {
        id: status.id,
        call_sign: status.callSign,
        name: status.callSign,
        section: '', // Unknown for offline stations
        class: '', // Unknown for offline stations  
        ip_address: status.ipAddress,
        port: status.port,
        last_seen: new Date(status.lastSeen).toISOString(),
        is_self: false,
        status: status
      });
    }
  });
  
  return Array.from(stationMap.values());
});

// Status tracking
const isRefreshing = ref(false);
const isSyncing = ref(false);
const connectionStatus = ref<string>('');
const isRestarting = ref(false);
const isRetrying = ref(false);

// Log reset state
const showResetDialog = ref(false);
const resetConfirmationText = ref('');
const isResettingLog = ref(false);

// Environment detection
const isElectron = computed(() => {
  return typeof window !== 'undefined' && (window as any).Electron;
});

// Mesh status
const meshStatus = computed(() => {
  // If mesh is not connected, show disabled state
  if (!meshConnectionState.isConnected) {
    return {
      meshHealth: 'disabled',
      discoveredNodes: 0,
      connectedNodes: 0,
    };
  }
  
  const totalDiscovered = stationService.getTotalDiscoveredCount();
  const connectedCount = stationService.getConnectedCount();
  
  return {
    meshHealth: connectedCount > 0 ? 'good' : totalDiscovered > 0 ? 'warning' : 'searching',
    discoveredNodes: totalDiscovered,
    connectedNodes: connectedCount,
  };
});

// Computed properties
const canConnect = computed(() => {
  return true; // Always can connect since we only support mesh
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
    
    // Try to get station info to test connection (this will internally call checkConnection)
    await backendApi.getStationInfo();
    
    // Wait a moment for the connection to establish
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (backendApi.connected.value) {
      console.log('✅ Backend connection successful');
      connectionStatus.value = 'Backend connection restored!';
      setTimeout(() => {
        connectionStatus.value = '';
      }, 3000);
    } else {
      console.log('❌ Backend still not available');
      connectionStatus.value = 'Backend still not available. Please check if the backend service is running.';
      setTimeout(() => {
        connectionStatus.value = '';
      }, 5000);
    }
  } catch (error) {
    console.error('❌ Error retrying connection:', error);
    connectionStatus.value = `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setTimeout(() => {
      connectionStatus.value = '';
    }, 5000);
  } finally {
    isRetrying.value = false;
  }
}

function onNetworkModeChange() {
  // No longer needed - only mesh mode supported
  discoveredStations.value = [];
}

/**
 * Update station statuses based on discovered stations
 */
function updateStationStatuses(stations: BackendStation[]) {
  // Load current statuses
  stationStatuses.value = stationService.getStationStatuses();
  
  // Get IDs of stations seen in this discovery
  const seenStationIds = stations.map(s => s.id);
  
  // Update statuses for seen stations
  stations.forEach(station => {
    stationService.updateStationSeen(station);
  });
  
  // Update request counts for missed stations
  stationService.updateMissedStations(seenStationIds);
  
  // Reload statuses after updates
  stationStatuses.value = stationService.getStationStatuses();
  
  // Clean up old offline stations
  stationService.cleanupOldStations();
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
    // Start mesh network discovery (only mode supported)
    connectionStatus.value = 'Starting mesh network discovery...';
    
    // Trigger mesh discovery via backend
    await backendApi.discoverStations();
    
    // Get the current list of discovered stations
    const stations = await backendApi.getDiscoveredStations();
    discoveredStations.value = stations;
    
    console.log(`🚀 Mesh network started: ${stations.length} stations discovered`);
    connectionStatus.value = 'Mesh network started successfully!';
    
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

async function disconnect() {
  console.log('🔍 [NetworkModal] Disconnect clicked');
  isDisconnecting.value = true;
  
  try {
    console.log('🔍 [NetworkModal] Setting mesh connection state to false...');
    // Update shared mesh state first - this will automatically stop background operations
    meshConnectionState.setConnected(false);
    meshConnectionStateReactive.value = false; // Force reactive update
    console.log('🔍 [NetworkModal] Mesh connection state set to:', meshConnectionState.isConnected);
    
    // Force Vue to detect the change
    await nextTick();
    console.log('🔍 [NetworkModal] After nextTick - isMeshActive:', isMeshActive.value);
    
    // Stop mesh network service
    await meshNetworkService.stopMesh();
    
    // Disable mesh networking in backend configuration
    try {
      const response = await fetch('http://localhost:3030/api/config/mesh', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: false,
          discovery_interval_secs: 60,
          max_discovery_attempts: 3,
          timeout_secs: 10
        })
      });
      if (response.ok) {
        console.log('🛑 Backend mesh configuration disabled');
      } else {
        console.error('❌ Backend mesh config disable failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Backend mesh config error:', error);
    }
    
    // Clear discovered stations
    discoveredStations.value = [];
    
    // Clear station status when mesh is disabled
    stationStatusService.clearDiscoveredCount();
    
    console.log('🔌 Mesh network disconnected');
    
    // Show disconnected status briefly
    connectionStatus.value = 'Disconnected';
    setTimeout(() => {
      connectionStatus.value = '';
    }, 3000);
    
  } catch (error) {
    console.error('❌ Error disconnecting from mesh network:', error);
  } finally {
    console.log('🔍 [NetworkModal] Setting isDisconnecting to false');
    isDisconnecting.value = false;
  }
}

async function connectToMesh() {
  console.log('🔍 [NetworkModal] Connect to Mesh clicked');
  isConnecting.value = true;
  
  try {
    console.log('🔍 [NetworkModal] Enabling backend mesh configuration...');
    // Enable mesh networking in backend configuration
    try {
      const response = await fetch('http://localhost:3030/api/config/mesh', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          discovery_interval_secs: 60,
          max_discovery_attempts: 3,
          timeout_secs: 10
        })
      });
      if (response.ok) {
        console.log('🚀 Backend mesh configuration enabled');
      } else {
        console.error('❌ Backend mesh config failed:', response.status, response.statusText);
        throw new Error('Failed to enable backend mesh configuration');
      }
    } catch (error) {
      console.error('❌ Backend mesh config error:', error);
      throw error;
    }
    
    console.log('🔍 [NetworkModal] Backend mesh enabled, setting frontend connection state...');
    
    // Update shared mesh state - this will automatically start background operations
    meshConnectionState.setConnected(true);
    meshConnectionStateReactive.value = true; // Force reactive update
    console.log('🔍 [NetworkModal] Mesh connection state set to:', meshConnectionState.isConnected);
    
    // Force Vue to detect the change
    await nextTick();
    console.log('🔍 [NetworkModal] After nextTick - isMeshActive:', isMeshActive.value);
    
    console.log('🌐 Mesh network connected');
    
    // Show connected status briefly
    connectionStatus.value = 'Connected to mesh network';
    setTimeout(() => {
      connectionStatus.value = '';
    }, 3000);
    
    // Start discovering stations immediately
    console.log('🔍 [NetworkModal] Starting mesh discovery...');
    await refreshMeshDiscovery();
    
  } catch (error) {
    console.error('❌ Error connecting to mesh network:', error);
    connectionStatus.value = `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setTimeout(() => {
      connectionStatus.value = '';
    }, 5000);
  } finally {
    console.log('🔍 [NetworkModal] Setting isConnecting to false');
    isConnecting.value = false;
  }
}

async function refreshMeshDiscovery() {
  if (!isConnected.value || !meshConnectionState.isConnected) return;
  
  isRefreshing.value = true;
  try {
    await backendApi.discoverStations();
    const stations = await backendApi.getDiscoveredStations();
    discoveredStations.value = stations;
    updateStationStatuses(stations);
  } catch (error) {
    console.error('Failed to refresh mesh discovery:', error);
  } finally {
    isRefreshing.value = false;
  }
}

async function forceMeshSync() {
  if (!isConnected.value || !meshConnectionState.isConnected) return;
  
  isSyncing.value = true;
  try {
    // Force mesh discovery to refresh data
    await backendApi.discoverStations();
    const stations = await backendApi.getDiscoveredStations();
    discoveredStations.value = stations;
    updateStationStatuses(stations);
  } catch (error) {
    console.error('Failed to force mesh sync:', error);
  } finally {
    isSyncing.value = false;
  }
}

function getNetworkModeIcon(): string {
  return 'device_hub';
}

function getNetworkModeButtonText(): string {
  return 'Start Mesh Network';
}

// Check and sync mesh connection state with backend
async function checkMeshConnectionState() {
  if (!isConnected.value) return;
  
  try {
    // Check if there are discovered stations (indicates active mesh)
    const stations = await backendApi.getDiscoveredStations();
    const hasActiveStations = stations && stations.length > 0;
    
    // Check backend mesh status if available
    let meshEnabled = false;
    try {
      const statusResponse = await fetch('http://localhost:3030/api/mesh/status');
      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        meshEnabled = statusResult.success && statusResult.data?.enabled;
      }
    } catch (error) {
      // Status check failed, fall back to station check
    }
    
    console.log(`🔍 [checkMeshConnectionState] Backend mesh enabled: ${meshEnabled}, Frontend mesh connected: ${meshConnectionState.isConnected}`);
    
    // Only sync state if frontend mesh is connected and backend is disabled
    // DO NOT automatically enable mesh just because backend is enabled
    if (meshConnectionState.isConnected && !meshEnabled) {
      console.log('🔄 Frontend shows connected but backend disabled - disabling frontend');
      meshConnectionState.setConnected(false);
    }
    
    // Update discovered stations in UI if mesh is connected
    if (meshConnectionState.isConnected && hasActiveStations) {
      discoveredStations.value = stations;
      updateStationStatuses(stations);
    }
  } catch (error) {
    console.warn('Failed to check mesh connection state:', error);
  }
}

// Log Reset Functions
function showResetConfirmation() {
  showResetDialog.value = true;
  resetConfirmationText.value = '';
}

function cancelReset() {
  showResetDialog.value = false;
  resetConfirmationText.value = '';
}

async function confirmReset() {
  if (resetConfirmationText.value.toUpperCase() !== 'RESET' || isResettingLog.value) {
    return;
  }
  
  isResettingLog.value = true;
  
  try {
    console.log('🔄 Triggering network-wide log reset...');
    
    // Call the backend API to trigger the log reset
    const result = await backendApi.triggerLogReset();
    
    if (result.success) {
      console.log('✅ Network log reset successful:', result.reset_timestamp);
      
      // Process the reset locally
      const { processLogReset } = await import('@/store/qso');
      await processLogReset(result.reset_timestamp!);
      
      // Close the dialog
      showResetDialog.value = false;
      resetConfirmationText.value = '';
      
      // Show success status
      connectionStatus.value = 'Network log reset successful!';
      setTimeout(() => {
        connectionStatus.value = '';
      }, 5000);
      
    } else {
      console.error('❌ Failed to reset network log:', result.error);
      connectionStatus.value = `Failed to reset log: ${result.error}`;
      setTimeout(() => {
        connectionStatus.value = '';
      }, 10000);
    }
    
  } catch (error) {
    console.error('❌ Error during log reset:', error);
    connectionStatus.value = `Error during reset: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setTimeout(() => {
      connectionStatus.value = '';
    }, 10000);
  } finally {
    isResettingLog.value = false;
  }
}

// Load initial data on mount
onMounted(async () => {
  await refreshStationInfo();
  
  // Check and sync mesh connection state with backend
  await checkMeshConnectionState();
  
  // Load station statuses from localStorage
  stationStatuses.value = stationService.getStationStatuses();
  
  // Listen for station info updates from config modal
  window.addEventListener('stationInfoUpdate', refreshStationInfo);
  
  // Listen for global station status updates
  window.addEventListener('stationStatusUpdate', handleStationStatusUpdate);
  
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
    
    // Auto-start mesh discovery (only mode supported)
    await refreshMeshDiscovery();
  }
  
  // Set up real-time refresh for station status updates when modal is open
  const modalRefreshInterval = setInterval(async () => {
    if (props.isOpen && isConnected.value && meshConnectionState.isConnected && !isRefreshing.value) {
      try {
        const stations = await backendApi.getDiscoveredStations();
        discoveredStations.value = stations;
        updateStationStatuses(stations);
      } catch (error) {
        // Silently handle errors to avoid console spam
      }
    }
  }, 3000); // Refresh every 3 seconds when modal is open and mesh is connected
  
  // Store interval for cleanup
  (window as any).networkModalRefreshInterval = modalRefreshInterval;
  
  // Check mesh connection state on mount
  await checkMeshConnectionState();
  
  // Check for any pending log reset commands
  if (isConnected.value) {
    try {
      const { checkForLogReset } = await import('@/store/qso');
      await checkForLogReset();
    } catch (error) {
      console.error('Failed to check for log reset on mount:', error);
    }
  }
  
  // --- Periodically check backend connection status ---
  let backendConnectionInterval: any = null;
  onMounted(() => {
    console.log('🔄 Starting backend connection polling...');
    backendConnectionInterval = setInterval(async () => {
      try {
        console.log('🔄 Checking backend connection...');
        await backendApi.refreshConnectionStatus(); // This will update backendApi.connected.value
        console.log('✅ Backend connection check completed. Connected:', backendApi.connected.value);
      } catch (e) {
        console.log('❌ Backend connection check failed:', e);
        // Ignore errors, connection state is updated internally
      }
    }, 2000); // Check every 2 seconds
  });
  
  onUnmounted(() => {
    if (backendConnectionInterval) clearInterval(backendConnectionInterval);
  });
});

// Clean up event listeners on unmount
onUnmounted(() => {
  window.removeEventListener('stationInfoUpdate', refreshStationInfo);
  window.removeEventListener('stationStatusUpdate', handleStationStatusUpdate);
  
  // Clean up mesh state listener
  meshConnectionState.removeConnectionListener(updateMeshState);
  
  // Clean up the refresh interval
  const modalRefreshInterval = (window as any).networkModalRefreshInterval;
  if (modalRefreshInterval) {
    clearInterval(modalRefreshInterval);
  }
});

// Watch for backend connection changes
watch(isConnected, async (connected) => {
  if (connected) {
    // Check mesh connection state when backend comes online
    await checkMeshConnectionState();
    await refreshMeshDiscovery();
  } else {
    // Clear discovered stations and set mesh as disconnected when backend goes offline
    discoveredStations.value = [];
    meshConnectionState.setConnected(false);
  }
});

// Watch for modal opening/closing
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // Force an immediate backend connection check when modal opens
    await backendApi.refreshConnectionStatus();
    
    if (isConnected.value) {
      // Check and sync mesh connection state first
      await checkMeshConnectionState();
      
      // Refresh discovered stations when modal opens, regardless of mode
      try {
        console.log('📱 Network modal opened - fetching discovered stations...');
        const stations = await backendApi.getDiscoveredStations();
        discoveredStations.value = stations;
        
        // Update station statuses
        updateStationStatuses(stations);
        
        console.log(`📡 Modal opened: ${stations.length} stations loaded from backend`);
        
        // Also trigger discovery to ensure fresh data
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
      } catch (error) {
        console.error('Failed to load discovered stations on modal open:', error);
      }
    }
  }
});

/**
 * Handle global station status updates
 */
function handleStationStatusUpdate(event: Event) {
  try {
    const customEvent = event as CustomEvent;
    
    // Reload station statuses from localStorage
    stationStatuses.value = stationStatusService.getStationStatuses();
    
    // Also refresh discovered stations to ensure we have the latest list
    if (isConnected.value && !isRefreshing.value) {
      backendApi.getDiscoveredStations().then(stations => {
        discoveredStations.value = stations;
      }).catch(error => {
        console.error('Failed to refresh discovered stations from status update:', error);
      });
    }
    
    // Log status update details if we have them
    if (customEvent.detail) {
      const { total, online, warning, offline } = customEvent.detail;
      console.log(`📊 Station status updated: ${total} total (${online} online, ${warning} warning, ${offline} offline)`);
    }
  } catch (error) {
    console.error('Error handling station status update:', error);
  }
}
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
  background-color: var(--error-bg);
  border: 1px solid var(--error-border);
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
    color: var(--error-color);
    font-size: 1.25rem;
  }
  
  h4 {
    margin: 0;
    color: var(--error-color);
  }
}

.error-details {
  p {
    margin: 0.5rem 0;
    color: var(--error-text);
  }
  
  code {
    background-color: var(--code-bg);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    color: var(--text-color);
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
  
  &.searching .health-indicator {
    background-color: #06b6d4;
  }
  
  &.isolated .health-indicator {
    background-color: #ef4444;
  }
  
  &.disabled .health-indicator {
    background-color: #6b7280;
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
  
  &.unknown {
    background-color: #9ca3af;
    color: white;
    font-style: italic;
  }
}

.station-section {
  &.unknown {
    color: #9ca3af;
    font-style: italic;
  }
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
    color: white;
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
  background-color: var(--error-color);
  color: white;
  border-color: var(--error-color);
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

// Log Reset Styles
.reset-log-button {
  background-color: var(--error-color);
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
    background-color: var(--error-border);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.reset-confirmation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}

.reset-confirmation-dialog {
  width: 90%;
  max-width: 500px;
  background-color: var(--form-bg);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 2px solid var(--error-color);
}

.reset-dialog-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--error-bg);
  border-radius: 6px 6px 0 0;

  h3 {
    margin: 0;
    color: var(--error-color);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .warning-icon {
    color: var(--error-color);
    font-size: 1.25rem;
  }
}

.reset-dialog-body {
  padding: 1.5rem;
  color: var(--text-color);

  p {
    margin: 0.75rem 0;
  }

  ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  li {
    margin: 0.5rem 0;
  }
}

.reset-confirmation-input {
  margin-top: 1.5rem;
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--error-color);
  }
  
  input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--error-border);
    border-radius: 4px;
    background-color: var(--form-bg);
    color: var(--text-color);
    font-size: 1rem;
    font-family: monospace;
    text-transform: uppercase;
    
    &:focus {
      outline: none;
      border-color: var(--error-color);
    }
  }
}

.reset-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-color);
  border-radius: 0 0 6px 6px;
}

.cancel-reset-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--form-bg);
  color: var(--text-color);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--border-color);
  }
}

.confirm-reset-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: var(--error-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s ease;

  &:hover:not(:disabled) {
    background-color: var(--error-border);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .material-icons {
    font-size: 1rem;
  }
}
</style>
