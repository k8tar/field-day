<!-- filepath: c:\git\k8tar-fieldday\src\components\PossibleDuplicates.vue -->
<template>
  <div class="duplicates-container" :class="{ 'has-duplicates': duplicates.length > 0 }">
    <h3>Possible Duplicates</h3>
    <div class="duplicates-content">
      <div v-if="duplicates.length > 0" class="duplicates-list">
        {{ duplicatesList }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  call: string;
  band: string;
  mode: string;
  qsos: any[];
}>();

const duplicates = computed(() => {
  if (!props.call || props.call.length < 3) {
    return [];
  }
  
  const searchCall = props.call.toUpperCase();
  
  // Look for possible duplicates based on callsign similarity
  const possibleDuplicates = props.qsos.filter(qso => {
    if (!qso.call) return false;
    
    const qsoCall = qso.call.toUpperCase();
    
    // Skip exact matches (handled elsewhere)
    if (qsoCall === searchCall) return false;
    
    // Only show duplicates on the same band and mode
    if (qso.band !== props.band) return false;
    if (qso.mode !== props.mode) return false;
    
    // Check for prefix matches (common for club calls, special event stations)
    // e.g., K8TAR vs K8TAR/1, W3AO vs W3AO/M
    if (qsoCall.startsWith(searchCall) || searchCall.startsWith(qsoCall)) {
      return true;
    }
    
    // Check for similar callsigns (same prefix + number, different suffix)
    // e.g., K8TAR vs K8TBR (typo), W3AO vs W3AO
    const searchPrefix = searchCall.match(/^([A-Z0-9]*\d)/)?.[1];
    const qsoPrefix = qsoCall.match(/^([A-Z0-9]*\d)/)?.[1];
    
    if (searchPrefix && qsoPrefix && searchPrefix === qsoPrefix) {
      // Check if suffixes are similar (allow for typos)
      const searchSuffix = searchCall.substring(searchPrefix.length);
      const qsoSuffix = qsoCall.substring(qsoPrefix.length);
      
      // Consider it a possible duplicate if suffixes are close
      if (searchSuffix.length > 0 && qsoSuffix.length > 0) {
        return levenshteinDistance(searchSuffix, qsoSuffix) <= 1;
      }
    }
    
    return false;
  });
  
  // Sort by relevance (exact prefix matches first, then similar suffixes)
  return possibleDuplicates.sort((a, b) => {
    const aCall = a.call.toUpperCase();
    const bCall = b.call.toUpperCase();
    
    // Prefix matches get priority
    if (aCall.startsWith(searchCall) && !bCall.startsWith(searchCall)) return -1;
    if (bCall.startsWith(searchCall) && !aCall.startsWith(searchCall)) return 1;
    
    return aCall.localeCompare(bCall);
  });
});

// Simple Levenshtein distance calculation for similarity
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

const duplicatesList = computed(() => {
  if (duplicates.value.length === 0) return '';
  
  // Limit to first 5 duplicates to keep display manageable
  const limitedDuplicates = duplicates.value.slice(0, 5);
  const hasMore = duplicates.value.length > 5;
  
  const list = limitedDuplicates
    .map(qso => `${qso.call} (${qso.band} ${qso.mode})`) // Show callsign with band and mode
    .join(', ');
    
  return hasMore ? `${list}, +${duplicates.value.length - 5} more` : list;
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';
.duplicates-container {
  background-color: var(--form-bg);
  color: var(--text-color);
  padding: 0.5rem; /* Reduced padding */
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
  display: flex;
  flex-direction: column;
  height: 100%; 
}

.duplicates-container.has-duplicates {
  color: #ff8c00; 
}

[data-theme="dark"] .duplicates-container.has-duplicates {
  color: #ffa500; 
}

h3 {
  margin: 0 0 0.25rem 0; 
  color: var(--text-color);
  transition: color 0.3s ease;
  font-size: 0.9rem; 
}

.has-duplicates h3 {
  color: #ff8c00; 
  font-weight: 600;
}

[data-theme="dark"] .has-duplicates h3 {
  color: #ffa500; 
}

.duplicates-content {
  flex: 1;
  overflow-y: auto;
}

.duplicates-list {
  font-family: 'Consolas', monospace;
  font-size: 1rem; 
  line-height: 1.3; 
  word-wrap: break-word;
  color: var(--text-color);
}

.has-duplicates .duplicates-list {
  color: #ff8c00;
  font-weight: 500;
}

[data-theme="dark"] .has-duplicates .duplicates-list {
  color: #ffa500;
}

.no-dupes {
  font-style: italic;
  color: var(--text-color);
  opacity: 0.7;
  font-size: 0.9rem;
}
</style>