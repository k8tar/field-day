<template>
  <div class="header">
    <div class="header-left">
      <div class="logo-section">
        <img src="/logo-small.svg" alt="K8TAR Field Day Logger" class="app-logo" />
      </div>
      <div class="station-info">
        <span class="station-designator">{{ stationDesignator || 'K8TAR' }}</span>
      </div>
    </div>

    <div class="header-center">
      <div class="controls">
        <!-- Mode Selection -->
        <div class="control-group">
          <label>Mode:</label>
          <select v-model="currentMode" @change="updateMode">
            <option value="PH">PH</option>
            <option value="CW">CW</option>
            <option value="DIG">DIG</option>
          </select>
        </div>

        <!-- Band Selection -->
        <div class="control-group">
          <label>Band:</label>
          <select v-model="selectedBand" @change="updateBand">
            <option value="">Select Band</option>
            <option v-for="band in bands" :key="band" :value="band">{{ band }}</option>
          </select>
        </div>

        <!-- Operator Selection -->
        <div class="control-group">
          <label>Operator:</label>
          <select v-model="selectedOperator" @change="updateOperator">
            <option v-for="operator in operators" :key="operator" :value="operator">{{ operator }}</option>
          </select>
        </div>
      </div>
    </div>

    <div class="header-right">
      <div class="actions">
        <button class="docs-button" @click="openDocsModal" title="Documentation">
          <span class="material-icons">help</span>
        </button>
        <button class="network-button" @click="openNetworkModal" :class="{ 'connected': networkConnected }">
          <span class="material-icons">{{ networkConnected ? 'wifi' : 'wifi_off' }}</span>
          <span v-if="connectedStationCount > 0" class="station-count">{{ connectedStationCount }}</span>
        </button>
        <button class="config-button" @click="openConfigModal">
          <span class="material-icons">settings</span>
        </button>
        <div class="theme-toggle">
          <span class="material-icons light">light_mode</span>
          <label class="switch">
            <input 
              type="checkbox" 
              :checked="isDark" 
              @change="handleThemeToggle"
            >
            <span class="slider round"></span>
          </label>
          <span class="material-icons dark">dark_mode</span>
        </div>
      </div>
    </div>
    
    <!-- Use the existing ConfigModal component -->
    <ConfigModal :is-open="configOpen" :is-first-time="isFirstTime" @close="handleConfigClose" />
    
    <!-- Network Modal -->
    <NetworkModal :is-open="networkModalOpen" @close="handleNetworkClose" />
    
    <!-- Documentation Modal -->
    <DocsModal :is-open="docsModalOpen" @close="handleDocsClose" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import { band as storeBand, operator as storeOperator, mode as storeMode } from '@/store/qso';
import { isDark, toggleTheme } from '@/store/theme';
import ConfigModal from '@/components/ConfigModal.vue';
import NetworkModal from '@/components/NetworkModal.vue';
import DocsModal from '@/components/DocsModal.vue';
import { networkService } from '@/services/networkService';
import { fileStorage } from '@/services/fileStorage';

// Station designator
const stationDesignator = ref('');

// Mode selection
const currentMode = ref(storeMode.value || 'PH');
const emit = defineEmits(['update:mode']);

function updateMode() {
  storeMode.value = currentMode.value;
  emit('update:mode', currentMode.value);
}

// Watch for changes to the mode store
watch(storeMode, (val) => {
  currentMode.value = val;
});

// Band selection
const bands = ['160m', '80m', '40m', '20m', '15m', '10m', '6m', '2m'];
const selectedBand = ref(storeBand.value || '40m');

function updateBand() {
  storeBand.value = selectedBand.value;
}

// Watch for changes to the band store
watch(storeBand, (val) => {
  selectedBand.value = val;
});

// Operator selection
const operators = ref<string[]>(['K8TAR']);
const selectedOperator = ref(storeOperator.value || operators.value[0] || '');

function updateOperator() {
  storeOperator.value = selectedOperator.value;
}

// Watch for changes to the operator store
watch(storeOperator, (val) => {
  selectedOperator.value = val;
});

// Load operators from file storage
async function loadOperators() {
  try {
    const savedOperators = await fileStorage.getOperators();
    if (savedOperators && savedOperators.length > 0) {
      operators.value = savedOperators;
      // Update selected operator if it's not in the new list
      if (!operators.value.includes(selectedOperator.value)) {
        selectedOperator.value = operators.value[0];
        updateOperator();
      }
    }
  } catch (error) {
    console.error('Error loading operators:', error);
  }
}

// Load station information from file storage
async function loadStationInfo() {
  try {
    const config = await fileStorage.getStationConfig();
    stationDesignator.value = config.designator || '';
  } catch (error) {
    console.error('Error loading station info:', error);
  }
}

// Theme toggle handler
function handleThemeToggle() {
  toggleTheme();
}

// Configuration modal
const configOpen = ref(false);
const isFirstTime = ref(false);

function openConfigModal() {
  configOpen.value = true;
}

function handleConfigClose() {
  configOpen.value = false;
  isFirstTime.value = false;
  // Reload operators and station info after config changes
  loadOperators();
  loadStationInfo();
}

// Network modal and status
const networkModalOpen = ref(false);
const networkConnected = computed(() => networkService.status.isConnected);
const connectedStationCount = computed(() => {
  const stations = networkService.getConnectedStations();
  return stations.filter(station => station.online).length;
});

function openNetworkModal() {
  networkModalOpen.value = true;
}

function handleNetworkClose() {
  networkModalOpen.value = false;
}

// Documentation modal
const docsModalOpen = ref(false);

function openDocsModal() {
  docsModalOpen.value = true;
}

function handleDocsClose() {
  docsModalOpen.value = false;
}

// Check for first-time setup using file storage
async function checkFirstTimeSetup() {
  try {
    const config = await fileStorage.getStationConfig();
    const qsos = await fileStorage.getQsoData();
    const operators = await fileStorage.getOperators();
    
    // Check if we have any configuration or data
    const hasConfig = config.callsign !== 'K8TAR' || 
                     config.designator !== 'PHONE 1' || 
                     operators.length > 0;
    const hasQsos = qsos.length > 0;
    
    if (!hasConfig && !hasQsos) {
      isFirstTime.value = true;
      configOpen.value = true;
    }
  } catch (error) {
    console.error('Failed to check first-time setup:', error);
    // If we can't check, assume first-time setup
    isFirstTime.value = true;
    configOpen.value = true;
  }
}

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'F1') {
    event.preventDefault();
    openDocsModal();
  }
}

onMounted(async () => {
  // Load operators and station info
  await loadOperators();
  await loadStationInfo();
  
  // Check for first-time setup
  await checkFirstTimeSetup();
  
  // Add keyboard event listener
  document.addEventListener('keydown', handleKeydown);
  
  // Listen for station info updates
  window.addEventListener('stationInfoUpdate', loadStationInfo);
});

onBeforeUnmount(() => {
  // Remove keyboard event listener
  document.removeEventListener('keydown', handleKeydown);
  // Remove station info update listener
  window.removeEventListener('stationInfoUpdate', loadStationInfo);
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: var(--header-color);
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.3s ease;
  min-height: 60px;
}

.header-left {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-section {
  display: flex;
  align-items: center;
}

.app-logo {
  height: 40px;
  width: auto;
  transition: opacity 0.2s ease;
  max-width: 180px; /* Prevent logo from getting too large on wide screens */
  
  &:hover {
    opacity: 0.8;
  }
}

/* Responsive logo - use compact version on smaller screens */
@media (max-width: 768px) {
  .app-logo {
    height: 32px;
    max-width: 120px;
  }
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.header-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

.station-info {
  display: flex;
  align-items: center;
}

.station-designator {
  font-weight: bold;
  font-size: 1.2rem;
  color: var(--text-color);
  padding: 0.5rem 1rem;
  background-color: var(--accent-color, #4caf50);
  color: white;
  border-radius: 4px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-group label {
  font-weight: 600;
  color: var(--text-color);
  min-width: fit-content;
}

.mode-buttons {
  // Uses global button-group styles
  @extend .button-group;
  gap: 0.25rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.network-button,
.config-button,
.docs-button {
  // Uses global btn-icon styles
  @extend .btn-icon;
  position: relative;
}

.network-button .station-count {
  position: absolute;
  top: -8px;
  right: -8px;
  background: var(--accent-color);
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 0.7rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.network-button.connected {
  color: #22c55e;
}

.network-button:not(.connected) {
  color: #ef4444;
}

.config-button {
  // Uses global btn-icon styles
  @extend .btn-icon;
}

.docs-button {
  color: var(--primary-color);
  
  &:hover {
    color: var(--primary-dark);
    background-color: rgba(var(--primary-color-rgb), 0.1);
  }
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

// Material icons styling is in global.scss
// Switch styling is in global.scss  
// Input/select styling is in global.scss

/* Responsive design */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .controls {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>