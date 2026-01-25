<template>
  <MainLayout />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import MainLayout from './components/layouts/MainLayout.vue';
import { stationStatusTracker } from '@/services/stationStatusTracker';
import { debugLog } from '@/utils/debug';

// Start station status tracking when app loads
onMounted(() => {
  debugLog('🚀 App mounted - starting station status tracker');
  stationStatusTracker.start();
});

// Stop station status tracking when app unmounts
onUnmounted(() => {
  debugLog('🛑 App unmounting - stopping station status tracker');
  stationStatusTracker.stop();
});
</script>

<style lang="scss">
@use '@/assets/styles/global.scss';
</style>
