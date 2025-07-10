<!-- filepath: c:\git\k8tar-fieldday\src\components\MainLayout.vue -->
<template>
  <div class="main-layout">
    <div class="header-container">
      <Header class="header" @update:mode="modeVal = $event" />
    </div>
    
    <div class="content-row">
      <RecentContacts class="recent-contacts" />
      <ScoreStatistics class="score-statistics" />
    </div>
    
    <div class="bottom-section">
      <div class="left-column">
        <StationInfo class="station-info" />
        <QsoEntryForm
          class="qso-entry-form"
          :mode="modeVal"
          @update:call="call = $event"
          @update:band="bandVal = $event"
          @update:mode="modeVal = $event"
        />
        <PossibleDuplicates
          class="possible-duplicates"
          :call="call"
          :band="bandVal"
          :mode="modeVal"
          :qsos="qsos"
        />
        <Messages class="messages" />
      </div>
      <div class="center-column">
        <!-- Placeholder for future component -->
        <div class="future-component" style="display: none;"></div>
      </div>
      <div class="right-column">
        <!-- Section Progress Component -->
        <SectionProgress @open-section-map="showSectionMap = true" />
      </div>
    </div>
    
    <!-- Section Map Modal -->
    <SectionMapModal :is-open="showSectionMap" @close="showSectionMap = false" />
  </div>
</template>

<script setup lang="ts">
import Header from '@/components/layouts/Header.vue';
import RecentContacts from '@/components/RecentContacts.vue';
import ScoreStatistics from '@/components/ScoreStatistics.vue';
import QsoEntryForm from '@/components/QsoEntryForm.vue';
import PossibleDuplicates from '@/components/PossibleDuplicates.vue';
import Messages from '@/components/Messages.vue';
import StationInfo from '@/components/StationInfo.vue';
import ConfigModal from '@/components/ConfigModal.vue';
import SectionProgress from '@/components/SectionProgress.vue';
import SectionMapModal from '@/components/SectionMapModal.vue';

import { ref, watch } from 'vue';
import { qsos, band as storeBand, mode as storeMode } from '@/store/qso';

const call = ref('');
const bandVal = ref(storeBand.value || '');
const modeVal = ref(storeMode.value || 'PH');
const showSectionMap = ref(false);

// Watch for store changes and update local refs
watch(storeBand, (newBand) => {
  bandVal.value = newBand;
});

watch(storeMode, (newMode) => {
  modeVal.value = newMode;
});

// Update store when local values change
watch(bandVal, (newBand) => {
  storeBand.value = newBand;
});

watch(modeVal, (newMode) => {
  storeMode.value = newMode;
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  padding: 0.5rem;
  gap: 0.5rem;
  box-sizing: border-box;
  overflow: hidden;
}

.header-container {
  flex: 0 0 auto;
}

.content-row {
  display: flex;
  gap: 0.5rem;
  flex: 0 0 auto;
  min-height: 0;
  height: 300px; /* Fixed height to limit visible items */
}

.recent-contacts,
.score-statistics {
  overflow: hidden;
}

.recent-contacts {
  flex: 2; /* 2/3 of the width */
}

.score-statistics {
  flex: 1; /* 1/3 of the width */
}

.bottom-section {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 0 0 40%; /* Fixed width of 40% instead of flexible sizing */
  min-width: 0;
  overflow: hidden;
}

.center-column {
  display: none; /* Hide the center column */
}

.right-column {
  display: flex;
  flex-direction: column;
  flex: 1; /* Take up the remaining 60% of space */
  min-width: 0;
}

.station-info {
  flex: 0 0 auto;
}

.possible-duplicates {
  flex: 0.3; /* Further reduced for more compact display */
  min-height: 0;
  max-height: 120px; /* Set a smaller max height */
  overflow: hidden;
}

.qso-entry-form {
  flex: 0.5; /* Reduce QSO form to about half the remaining space */
  min-height: 0;
}

.messages {
  flex: 0.7; /* Give more space to the messages component */
  min-height: 0;
}

.future-component {
  background-color: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color);
  font-style: italic;
  opacity: 0.7;
}

.future-component::before {
  content: 'Future Component';
}
</style>