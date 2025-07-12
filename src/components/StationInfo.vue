<template>
  <div class="station-info">
    <div class="station-details">
      <div class="info-item">
        <div class="info-label">Call</div>
        <div class="info-value">{{ stationCallsign || "Not Set" }}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Class</div>
        <div class="info-value">{{ stationClass || "Not Set" }}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Section</div>
        <div class="info-value">{{ stationSection || "Not Set" }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { fileStorage } from '@/services/fileStorage';

const stationCallsign = ref('');
const stationClass = ref('');
const stationSection = ref('');

// Function to refresh data from file storage
const refreshData = async () => {
  console.log('StationInfo: refreshData() called');
  try {
    const config = await fileStorage.getStationConfig();
    console.log('StationInfo: Loaded config:', config);
    
    // Update all fields from config, with proper fallbacks
    stationCallsign.value = config.callsign || '';
    stationClass.value = config.stationClass || '';  // Keep this simple, one source of truth
    stationSection.value = config.stationSection || '';

    console.log('StationInfo: Set values:', {
      callsign: stationCallsign.value,
      class: stationClass.value,
      section: stationSection.value
    });
  } catch (error) {
    console.error('❌ Error loading station info:', error);
    // Set default values on error
    stationCallsign.value = '';
    stationClass.value = '';
    stationSection.value = '';
  }
};

// Function to handle storage changes (for cross-tab updates)
const handleStorageChange = (e: StorageEvent) => {
  // Refresh from file storage when localStorage changes are detected
  refreshData();
};

// Custom event handler for same-window updates
const handleCustomUpdate = (e: CustomEvent) => {
  refreshData();
};

// Add event listeners
onMounted(() => {
  window.addEventListener('storage', handleStorageChange);
  window.addEventListener('stationInfoUpdate', handleCustomUpdate as EventListener);
  
  // Initial load
  refreshData();
});

// Clean up the event listeners
onBeforeUnmount(() => {
  window.removeEventListener('storage', handleStorageChange);
  window.removeEventListener('stationInfoUpdate', handleCustomUpdate as EventListener);
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';
.station-info {
  background-color: var(--form-bg);
  border: 1px solid var(--border-color); /* Back to original border */
  border-radius: 4px; /* Back to original radius */
  padding: 0.5rem; /* Back to original padding */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Back to original shadow */
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.station-details {
  display: flex;
  flex-wrap: nowrap; /* Prevent wrapping */
  gap: 0.75rem; /* Back to original gap */
  justify-content: space-between; /* Back to original justification */
  width: 100%;
  overflow-x: auto; /* Add horizontal scrolling if needed */
}

.info-item {
  display: flex;
  flex-direction: column;
  min-width: 0; /* Allow items to shrink below content size */
  flex-shrink: 1; /* Allow items to shrink */
}

.info-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.2rem;
  white-space: nowrap;
}

.info-value {
  font-weight: 700; /* Bolder font weight */
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 1.1rem; /* Increased font size for more prominence */
}
</style>