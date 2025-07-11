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
        <!-- Network Status Section -->
        <div class="network-status">
          <div class="status-header">
            <h3>
              <span class="material-icons" :class="{ 'connected': isConnected, 'disconnected': !isConnected }">
                {{ isConnected ? 'wifi' : 'wifi_off' }}
              </span>
              Network Status: {{ isConnected ? 'Connected' : 'Disconnected' }}
            </h3>
          </div>
          
          <div class="connection-info" v-if="isConnected">
            <p><strong>Network ID:</strong> {{ networkId }}</p>
            <p><strong>Your Station:</strong> {{ localStationInfo.callsign }} ({{ localStationInfo.designator }})</p>
            <p><strong>Connected Stations:</strong> {{ connectedStations.length }}</p>
          </div>
        </div>

        <!-- Connection Settings -->
        <div class="connection-settings">
          <h3>Connection Settings</h3>
          
          <div class="setting-group">
            <label>
              <input 
                type="checkbox" 
                v-model="autoReconnect" 
                @change="onAutoReconnectChange"
              >
              Auto-reconnect on startup and connection loss
            </label>
            <p class="help-text">Automatically reconnect to the last network when the app starts or if connection is lost</p>
          </div>
          
          <div class="setting-group">
            <label for="network-mode">Network Mode:</label>
            <select id="network-mode" v-model="networkMode" @change="onNetworkModeChange">
              <option value="auto">Auto-discover (LAN)</option>
              <option value="mesh">Mesh Network (P2P)</option>
              <option value="host">Host Network</option>
              <option value="join">Join Network</option>
            </select>
          </div>

          <div v-if="networkMode === 'mesh'" class="setting-group">
            <div class="mesh-info">
              <h4>🕸️ Mesh Network Mode</h4>
              <p class="help-text">
                In mesh mode, each station operates independently and discovers other stations automatically.
                No central server is required - all stations communicate directly with each other.
                This provides maximum resilience for Field Day operations.
              </p>
              <ul class="help-list">
                <li>• Each station discovers others automatically</li>
                <li>• Direct peer-to-peer connections</li>
                <li>• No single point of failure</li>
                <li>• Stations continue operating if others go offline</li>
              </ul>
            </div>
          </div>

          <div v-if="networkMode === 'host'" class="setting-group">
            <label for="network-port">Port (Hardcoded):</label>
            <input 
              id="network-port" 
              type="number" 
              v-model.number="hostPort" 
              disabled
              value="8080"
            >
            <p class="help-text">All Field Day instances use port 8080. Other stations can connect to: {{ localIP }}:8080</p>
          </div>

          <div v-if="networkMode === 'join'" class="setting-group">
            <label for="host-address">Host Address:</label>
            <input 
              id="host-address" 
              type="text" 
              v-model="hostAddress" 
              placeholder="192.168.1.100:8080"
            >
            <p class="help-text">Enter the IP address and port of the host station</p>
          </div>

          <div class="setting-group">
            <label for="station-callsign">Your Callsign:</label>
            <input 
              id="station-callsign" 
              type="text" 
              v-model="localStationInfo.callsign" 
              placeholder="K8TAR"
              style="text-transform: uppercase;"
            >
          </div>

          <div class="setting-group">
            <label for="station-designator">Station Designator:</label>
            <input 
              id="station-designator" 
              type="text" 
              v-model="localStationInfo.designator" 
              placeholder="1A"
              style="text-transform: uppercase;"
            >
          </div>
        </div>

        <!-- QSO File Storage -->
        <div class="file-storage-section">
          <h3>QSO File Storage</h3>
          <div class="storage-info">
            <p>Local QSOs: <strong>{{ localQsoCount }}</strong></p>
            <p class="help-text">Upload your local QSOs to the shared file storage for multi-station access</p>
          </div>
          <div class="storage-actions">
            <button 
              @click="uploadLocalQsos" 
              :disabled="isUploading || localQsoCount === 0"
              class="upload-button"
            >
              <span v-if="isUploading">📤 Uploading...</span>
              <span v-else>📁 Upload {{ localQsoCount }} QSOs to File Storage</span>
            </button>
            <div v-if="uploadStatus" class="upload-status" :class="uploadStatus.type">
              {{ uploadStatus.message }}
            </div>
          </div>
        </div>

        <!-- Connected Stations -->
        <div v-if="connectedStations.length > 0" class="connected-stations">
          <h3>Connected Stations ({{ connectedStations.length }})</h3>
          <div class="stations-list">
            <div 
              v-for="station in connectedStations" 
              :key="station.id" 
              class="station-card"
            >
              <div class="station-info">
                <div class="station-header">
                  <span class="station-designator-main">{{ station.designator }}</span>
                  <span class="station-callsign-sub">{{ station.callsign }}</span>
                </div>
                <div class="station-details">
                  <span class="station-ip">{{ station.ip }}:{{ station.port }}</span>
                  <span class="station-qsos">{{ station.qsoCount }} QSOs</span>
                  <span class="station-score">{{ station.score }} pts</span>
                </div>
                <div class="station-status">
                  <span class="status-indicator" :class="{ 'online': station.online }"></span>
                  <span class="last-seen">{{ formatLastSeen(station.lastSeen) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mesh Network Nodes -->
        <div v-if="networkMode === 'mesh'" class="mesh-nodes">
          <h3>
            <span class="material-icons">device_hub</span>
            Mesh Network Nodes ({{ meshNodes.length }})
          </h3>
          
          <div class="mesh-status-summary">
            <div class="mesh-health" :class="meshStatus.meshHealth">
              <span class="health-indicator"></span>
              Network Health: {{ meshStatus.meshHealth.toUpperCase() }}
            </div>
            <div class="mesh-stats">
              <span>Discovered: {{ meshStatus.discoveredNodes }}</span>
              <span>Connected: {{ meshStatus.connectedNodes }}</span>
              <span>Last Sync: {{ formatLastSync(meshStatus.lastSync) }}</span>
            </div>
          </div>
          
          <div v-if="meshNodes.length > 0" class="stations-list">
            <div 
              v-for="node in meshNodes" 
              :key="node.id" 
              class="station-card mesh-node"
            >
              <div class="station-info">
                <div class="station-header">
                  <span class="station-callsign">{{ node.callsign }}</span>
                  <span class="station-designator">{{ node.designator }}</span>
                  <span class="node-status" :class="{ 'online': node.online }">
                    {{ node.online ? '🟢' : '🔴' }}
                  </span>
                </div>
                <div class="station-details">
                  <span class="station-ip">{{ node.ip }}:{{ node.port }}</span>
                  <span class="station-qsos">{{ node.qsoCount }} QSOs</span>
                  <span class="station-score">{{ node.score }} pts</span>
                </div>
                <div class="node-capabilities">
                  <span v-for="capability in node.capabilities" :key="capability" class="capability-tag">
                    {{ capability }}
                  </span>
                </div>
                <div class="station-status">
                  <span class="last-seen">{{ formatLastSeen(node.lastSeen) }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="no-nodes">
            <p>No other mesh nodes found on the network.</p>
            <p class="help-text">
              🕸️ Mesh nodes discover each other automatically.<br>
              Start another Field Day Logger instance on a different machine to see it appear here.
            </p>
          </div>
          
          <div class="mesh-actions">
            <button @click="refreshMeshDiscovery" :disabled="isRefreshing" class="refresh-button">
              <span v-if="isRefreshing">🔄 Refreshing...</span>
              <span v-else>🔍 Refresh Discovery</span>
            </button>
            <button @click="forceMeshSync" :disabled="isSyncing" class="sync-button">
              <span v-if="isSyncing">🔄 Syncing...</span>
              <span v-else>🔄 Force Sync</span>
            </button>
          </div>
        </div>

        <!-- Auto-Discovery Results -->
        <div v-if="networkMode === 'auto'" class="discovered-stations">
          <h3>Discovered Stations</h3>
          <div v-if="discoveredStations.length > 0" class="stations-list">
            <div 
              v-for="station in discoveredStations" 
              :key="station.id" 
              class="station-card"
            >
              <div class="station-info">
                <div class="station-header">
                  <span class="station-callsign">{{ station.callsign }}</span>
                  <span class="station-designator">{{ station.designator }}</span>
                </div>
                <div class="station-details">
                  <span class="station-ip">{{ station.ip }}:{{ station.port }}</span>
                </div>
              </div>
              <button class="connect-button" @click="connectToStation(station)">
                Connect
              </button>
            </div>
          </div>
          <div v-else class="no-stations">
            <p>No other Field Day stations found on the network.</p>
            <p class="help-text">
              To test network features:
              <br>• Start another instance on a different machine (all use port 8080)
              <br>• Or manually connect using "Join Network" mode with address: <code>[other-machine-ip]:8080</code>
              <br>• For testing on same machine, use different directories and start another server
            </p>
          </div>
        </div>

        <!-- Sync Status -->
        <div v-if="isConnected" class="sync-status">
          <h3>Synchronization Status</h3>
          <div class="sync-info">
            <div class="sync-item">
              <span class="sync-label">Last Sync:</span>
              <span class="sync-value">{{ formatLastSync(lastSyncTime) }}</span>
            </div>
            <div class="sync-item">
              <span class="sync-label">QSOs Synced:</span>
              <span class="sync-value">{{ syncedQsoCount }}</span>
            </div>
            <div class="sync-item">
              <span class="sync-label">Conflicts Resolved:</span>
              <span class="sync-value">{{ conflictsResolved }}</span>
            </div>
          </div>
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
            <span class="material-icons">search</span>
            {{ isScanning ? 'Scanning...' : 'Scan Network' }}
          </button>
        </div>
        <div class="footer-right">
          <button 
            v-if="!isConnected" 
            class="connect-button primary" 
            @click.stop="startConnection"
            :disabled="!canConnect || isConnecting"
            type="button"
          >
            <span v-if="isConnecting" class="material-icons spinning">hourglass_empty</span>
            <span v-else class="material-icons">{{ getNetworkModeIcon() }}</span>
            {{ isConnecting ? 'Connecting...' : getNetworkModeButtonText() }}
          </button>
          
          <!-- Connection Status Display -->
          <div v-if="connectionStatus" class="connection-status" :class="{ 
            'status-error': connectionStatus.includes('failed') || connectionStatus.includes('error'),
            'status-success': connectionStatus.includes('success'),
            'status-progress': connectionStatus.includes('Connecting') || connectionStatus.includes('Starting')
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
import { networkService, type NetworkStation } from '@/services/networkService';
import { fileStorage } from '@/services/fileStorage';

interface StationInfo {
  id: string;
  callsign: string;
  designator: string;
  ip: string;
  port?: number;
  qsoCount: number;
  score: number;
  online: boolean;
  lastSeen: number;
}

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Connection state - use network service
const isConnected = computed(() => networkService.status.isConnected);
const networkMode = ref<'auto' | 'mesh' | 'host' | 'join'>('auto');
const networkId = computed(() => networkService.status.networkId);
const hostPort = ref(8080); // Hardcoded - all Field Day instances use port 8080
const hostAddress = ref('');
const localIP = ref('192.168.1.100'); // This would be detected
const autoReconnect = ref(false);

// QSO upload state
const isUploading = ref(false);
const uploadStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null);

// Get local QSO count - reactive property that will be updated
const localQsoCount = ref(0);

// Function to update QSO count from file storage
async function updateLocalQsoCount() {
  try {
    const qsos = await fileStorage.getQsoData();
    localQsoCount.value = qsos.length;
  } catch (error) {
    console.error('Error reading QSOs from file storage:', error);
    // Initialize with zero instead of localStorage fallback
    localQsoCount.value = 0;
  }
}

// Station information - reactive to config changes
const localStationInfo = ref({
  callsign: '',
  designator: '1A'
});

// Function to refresh station info from file storage
async function refreshStationInfo() {
  try {
    const stationConfig = await fileStorage.getStationConfig();
    localStationInfo.value.callsign = stationConfig.callsign || '';
    localStationInfo.value.designator = stationConfig.designator || '1A';
  } catch (error) {
    console.error('Error loading station config from file storage:', error);
    // Initialize with defaults instead of localStorage fallback
    localStationInfo.value.callsign = '';
    localStationInfo.value.designator = '1A';
  }
}

// Watch for changes to station info and save to file storage
watch(() => localStationInfo.value.callsign, async (newCallsign) => {
  try {
    const currentConfig = await fileStorage.getStationConfig();
    if (newCallsign !== currentConfig.callsign) {
      await fileStorage.saveStationConfig({ callsign: newCallsign });
      
      // Trigger update event for other components
      window.dispatchEvent(new CustomEvent('stationInfoUpdate'));
    }
  } catch (error) {
    console.error('Failed to save callsign to file storage:', error);
  }
});

watch(() => localStationInfo.value.designator, async (newDesignator) => {
  try {
    const currentConfig = await fileStorage.getStationConfig();
    if (newDesignator !== currentConfig.designator) {
      await fileStorage.saveStationConfig({ designator: newDesignator });
      
      // Trigger update event for other components
      window.dispatchEvent(new CustomEvent('stationInfoUpdate'));
    }
  } catch (error) {
    console.error('Failed to save designator to file storage:', error);
  }
});

// Connected and discovered stations - use network service
const connectedStations = computed(() => networkService.getConnectedStations());
const discoveredStations = ref<NetworkStation[]>([]);

// Mesh network state
const meshNodes = computed(() => networkService.getMeshNodes());
const meshStatus = computed(() => networkService.getMeshStatus());
const isRefreshing = ref(false);
const isSyncing = ref(false);

// Scanning state
const isScanning = ref(false);

// Sync information - use network service
const lastSyncTime = computed(() => networkService.status.lastSync);
const syncedQsoCount = computed(() => networkService.status.syncedQsos);
const conflictsResolved = computed(() => networkService.status.conflictsResolved);

// Computed properties
const canConnect = computed(() => {
  if (networkMode.value === 'host') {
    return true; // Always true since port 8080 is hardcoded and valid
  } else if (networkMode.value === 'join') {
    return hostAddress.value.trim().length > 0;
  } else if (networkMode.value === 'mesh') {
    return true; // Mesh mode can always be started
  } else {
    return discoveredStations.value.length > 0;
  }
});

// Functions
function close() {
  emit('close');
}

function onAutoReconnectChange() {
  networkService.setAutoReconnect(autoReconnect.value);
}

function onNetworkModeChange() {
  // Clear previous state when mode changes
  discoveredStations.value = [];
  if (networkMode.value === 'auto') {
    scanForStations();
  }
  
  // Save the network mode change
  saveNetworkSettings();
}

async function scanForStations() {
  isScanning.value = true;
  
  try {
    const stations = await networkService.discoverStations();
    discoveredStations.value = stations;
  } catch (error) {
    console.error('Failed to scan for stations:', error);
  } finally {
    isScanning.value = false;
  }
}

function connectToStation(station: NetworkStation) {
  // Connect using network service
  const address = `${station.ip}:${station.port}`;
  networkService.connectToHost(address);
  
  // Remove from discovered
  const index = discoveredStations.value.findIndex(s => s.id === station.id);
  if (index >= 0) {
    discoveredStations.value.splice(index, 1);
  }
}

// Connection status for user feedback
const connectionStatus = ref<string>('');
const isConnecting = ref(false);

async function startConnection() {
  console.log('🔗 startConnection called, mode:', networkMode.value);
  console.log('🔗 canConnect:', canConnect.value);
  console.log('🔗 hostPort:', hostPort.value);
  console.log('🔗 hostAddress:', hostAddress.value);
  
  // Prevent double-clicks
  if (isConnecting.value) {
    console.log('⏳ Connection already in progress, ignoring click');
    return;
  }
  
  isConnecting.value = true;
  connectionStatus.value = 'Connecting...';
  
  try {
    if (networkMode.value === 'host') {
      console.log('🏠 Starting host mode...');
      connectionStatus.value = 'Starting host on port 8080...';
      
      const success = await networkService.startHost(); // Port 8080 is hardcoded
      
      if (success) {
        console.log('✅ Host started successfully');
        connectionStatus.value = 'Host started successfully!';
        
        // Clear status after 3 seconds
        setTimeout(() => {
          connectionStatus.value = '';
        }, 3000);
      } else {
        throw new Error('Failed to start host - port may be in use');
      }
    } else if (networkMode.value === 'join') {
      console.log('🔗 Joining host at:', hostAddress.value);
      connectionStatus.value = `Connecting to ${hostAddress.value}...`;
      
      const success = await networkService.connectToHost(hostAddress.value);
      
      if (success) {
        console.log('✅ Connected to host successfully');
        connectionStatus.value = 'Connected successfully!';
        
        // Clear status after 3 seconds
        setTimeout(() => {
          connectionStatus.value = '';
        }, 3000);
      } else {
        throw new Error(`Failed to connect to ${hostAddress.value}`);
      }
    } else if (networkMode.value === 'mesh') {
      console.log('🕸️ Starting mesh network...');
      connectionStatus.value = 'Starting mesh network...';
      
      const success = await networkService.startMesh();
      
      if (success) {
        console.log('✅ Mesh network started successfully');
        connectionStatus.value = 'Mesh network started successfully!';
        
        // Clear status after 3 seconds
        setTimeout(() => {
          connectionStatus.value = '';
        }, 3000);
      } else {
        throw new Error('Failed to start mesh network');
      }
    }
    
    // Settings are automatically saved by the network service methods above
    console.log('🔗 Connection process completed');
  } catch (error) {
    console.error('❌ Connection failed:', error);
    connectionStatus.value = `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    // Clear error after 10 seconds
    setTimeout(() => {
      connectionStatus.value = '';
    }, 10000);
  } finally {
    isConnecting.value = false;
  }
}

function disconnect() {
  if (networkMode.value === 'mesh') {
    networkService.stopMesh();
  } else {
    networkService.disconnect();
  }
}

// Mesh network methods
async function refreshMeshDiscovery() {
  if (isRefreshing.value) return;
  
  isRefreshing.value = true;
  try {
    await networkService.refreshMeshDiscovery();
    console.log('✅ Mesh discovery refreshed');
  } catch (error) {
    console.error('❌ Failed to refresh mesh discovery:', error);
  } finally {
    isRefreshing.value = false;
  }
}

async function forceMeshSync() {
  if (isSyncing.value) return;
  
  isSyncing.value = true;
  try {
    await networkService.forceMeshSync();
    console.log('✅ Mesh sync completed');
  } catch (error) {
    console.error('❌ Failed to force mesh sync:', error);
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

function formatLastSeen(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatLastSync(timestamp: number): string {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleTimeString();
}

async function uploadLocalQsos() {
  if (localQsoCount.value === 0) {
    uploadStatus.value = { type: 'error', message: 'No local QSOs to upload' };
    return;
  }
  
  isUploading.value = true;
  uploadStatus.value = null;
  
  try {
    console.log(`📤 Manually uploading ${localQsoCount.value} local QSOs to file storage...`);
    
    // Get QSOs from file storage
    const qsos = await fileStorage.getQsoData();
    if (qsos.length === 0) {
      throw new Error('No QSOs found in file storage');
    }
    
    const response = await fetch('/api/qsos/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        qsos: qsos
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      uploadStatus.value = { 
        type: 'success', 
        message: `Successfully uploaded ${result.added} new QSOs (${result.total} total on server)` 
      };
      console.log(`✅ Manual upload successful: ${result.added} new QSOs, ${result.total} total`);
      
      // Clear the status after 5 seconds
      setTimeout(() => {
        uploadStatus.value = null;
      }, 5000);
      
    } else {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Manual upload failed:', error);
    uploadStatus.value = { 
      type: 'error', 
      message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
    
    // Clear the error after 10 seconds
    setTimeout(() => {
      uploadStatus.value = null;
    }, 10000);
  } finally {
    isUploading.value = false;
  }
}

// Auto-scan on mount if in auto mode
onMounted(async () => {
  // Detect local IP (mock)
  localIP.value = '192.168.1.100';
  
  // Initialize auto-reconnect setting from network service
  const settings = networkService.getNetworkSettings();
  autoReconnect.value = settings.autoReconnect;
  
  // Load saved network settings into UI
  const currentMode = networkService.getCurrentNetworkMode();
  networkMode.value = currentMode;
  
  if (currentMode === 'host') {
    hostPort.value = networkService.getHostPort();
  } else if (currentMode === 'join') {
    hostAddress.value = networkService.getHostAddress();
  }
  
  console.log('📡 Loaded network settings into UI:', {
    mode: networkMode.value,
    autoReconnect: autoReconnect.value,
    hostPort: hostPort.value,
    hostAddress: hostAddress.value,
    isConnected: networkService.status.isConnected
  });
  
  // Load initial data from file storage
  await refreshStationInfo();
  await updateLocalQsoCount();
  
  // Listen for station info updates from config modal
  window.addEventListener('stationInfoUpdate', refreshStationInfo);
  
  // Only auto-scan if in auto mode and not already connected
  if (networkMode.value === 'auto' && !networkService.status.isConnected) {
    scanForStations();
  }
});

// Clean up event listeners on unmount
onUnmounted(() => {
  window.removeEventListener('stationInfoUpdate', refreshStationInfo);
});

// Watch for changes to persist settings
watch(hostPort, (newPort) => {
  if (networkMode.value === 'host') {
    saveNetworkSettings();
  }
});

watch(hostAddress, (newAddress) => {
  if (networkMode.value === 'join') {
    saveNetworkSettings();
  }
});

// Save network settings to persistence
async function saveNetworkSettings() {
  try {
    // Update network service with current UI state
    networkService.setAutoReconnect(autoReconnect.value);
    
    // Update network mode and related settings
    if (networkMode.value === 'host') {
      networkService.updateNetworkMode('host', { hostPort: hostPort.value });
    } else if (networkMode.value === 'join' && hostAddress.value) {
      networkService.updateNetworkMode('join', { hostAddress: hostAddress.value });
    } else {
      networkService.updateNetworkMode('auto');
    }
    
    console.log('💾 Network settings saved via UI:', {
      mode: networkMode.value,
      autoReconnect: autoReconnect.value,
      hostPort: hostPort.value,
      hostAddress: hostAddress.value
    });
  } catch (error) {
    console.error('❌ Failed to save network settings:', error);
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

.help-text {
  font-size: 0.8rem;
  color: var(--text-color);
  opacity: 0.7;
  margin: 0.25rem 0 0 0;
}

.connected-stations,
.discovered-stations {
  margin-bottom: 2rem;
}

.connected-stations h3,
.discovered-stations h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
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

/* Mesh Network Styles */
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

.mesh-info {
  padding: 1rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 1rem;

  h4 {
    margin: 0 0 0.5rem 0;
    color: var(--primary-color);
    font-size: 1rem;
  }

  .help-list {
    margin: 0.5rem 0 0 1rem;
    
    li {
      margin: 0.25rem 0;
      font-size: 0.8rem;
      color: var(--text-color);
      opacity: 0.8;
    }
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

  &.healthy .health-indicator {
    background-color: #4CAF50;
  }

  &.degraded .health-indicator {
    background-color: #FF9800;
  }

  &.isolated .health-indicator {
    background-color: #F44336;
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

.mesh-node {
  .station-header {
    gap: 0.75rem;
  }

  .node-status {
    font-size: 0.8rem;
  }
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

  &:hover:not(:disabled) {
    background-color: var(--primary-hover);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.no-nodes {
  text-align: center;
  padding: 2rem;
  color: var(--text-color);
  opacity: 0.7;

  p {
    margin: 0.5rem 0;
  }
}

.station-designator-main {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--primary-color);
}

.station-callsign-sub {
  font-size: 0.85rem;
  color: var(--text-color);
  opacity: 0.8;
  margin-left: 0.5rem;
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

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ef4444;
}

.status-indicator.online {
  background-color: #22c55e;
}

.sync-status {
  margin-bottom: 1rem;
}

.sync-status h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.sync-info {
  background-color: var(--bg-color);
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.sync-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.sync-item:last-child {
  margin-bottom: 0;
}

.sync-label {
  font-weight: 500;
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

.no-stations {
  text-align: center;
  padding: 2rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-color);
}

.no-stations p {
  margin: 0.5rem 0;
}

.no-stations code {
  background-color: var(--border-color);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Consolas', monospace;
  font-size: 0.85rem;
}

/* Connection Status */
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

/* Spinning animation for connecting state */
.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
