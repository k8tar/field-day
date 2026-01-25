<!-- Compact Section Progress Component -->
<template>
  <div class="section-progress-container">
    <div class="progress-header">
      <h2>Section Progress ({{ totalLoggedSections }}/{{ totalSections }} - {{ progressPercentage }}%)</h2>
      <button 
        class="expand-button" 
        @click="$emit('open-section-map')"
        title="Open detailed section map"
      >
        <span class="material-icons">map</span>
        Expand
      </button>
    </div>

    <div class="divisions-summary">
      <div 
        v-for="(division, divisionName) in ARRL_DIVISIONS" 
        :key="divisionName" 
        class="division-summary"
      >
        <div class="division-header">
          <span class="division-name">
            {{ divisionName }}
            <span v-if="isDivisionComplete(divisionName, qsos.map(q => q.section))" class="trophy-icon" title="Division Complete!">🏆</span>
          </span>
          <span class="division-progress">{{ getLoggedCount(division.sections, qsos) }}/{{ division.sections.length }}</span>
        </div>
        <div class="division-progress-bar">
          <div 
            class="division-progress-fill" 
            :style="{ width: getDivisionProgress(division.sections) + '%' }"
          ></div>
        </div>
        <div class="sections-list">
          <span 
            v-for="section in getSortedSections(division.sections)"
            :key="section"
            class="section-tag"
            :class="{ 'completed': isLogged(section, qsos) }"
          >
            {{ section }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { qsos } from '@/store/qso';
import { 
  ARRL_DIVISIONS, 
  getTotalSections, 
  getLoggedSectionsCount,
  isDivisionComplete,
  getLoggedCount,
  isLogged
} from '@/constants/arrl-sections';

// Define emits
defineEmits(['open-section-map']);

// Get progress percentage for a division
const getDivisionProgress = (sections: string[]): number => {
  const logged = getLoggedCount(sections, qsos.value);
  return sections.length > 0 ? Math.round((logged / sections.length) * 100) : 0;
};

// Sort sections: numbers starting with 0 first, then alphabetically, DX last
const getSortedSections = (sections: string[]): string[] => {
  return [...sections].sort((a, b) => {
    // DX always goes last
    if (a === 'DX' && b !== 'DX') return 1;
    if (b === 'DX' && a !== 'DX') return -1;
    if (a === 'DX' && b === 'DX') return 0;
    
    // Numbers starting with 0 go first
    const aStartsWithZero = a.match(/^0/);
    const bStartsWithZero = b.match(/^0/);
    
    if (aStartsWithZero && !bStartsWithZero) return -1;
    if (bStartsWithZero && !aStartsWithZero) return 1;
    
    // Otherwise alphabetical
    return a.localeCompare(b);
  });
};

// Computed properties
const totalSections = computed(() => getTotalSections());

const totalLoggedSections = computed(() => {
  // Get unique sections from QSOs
  const uniqueWorkedSections = [...new Set(qsos.value.map(qso => qso.section))];
  return getLoggedSectionsCount(uniqueWorkedSections);
});

const progressPercentage = computed(() => {
  return totalSections.value > 0 ? Math.round((totalLoggedSections.value / totalSections.value) * 100) : 0;
});
</script>

<style scoped>
.section-progress-container {
  background-color: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.9rem;
  min-height: 0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--primary-color);
  color: white;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.progress-header h2 {
  background: none;
  padding: 0;
  margin: 0;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.expand-button {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.expand-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.expand-button .material-icons {
  font-size: 14px;
}

.trophy-icon {
  margin-left: 0.5rem;
  font-size: 1rem;
  display: inline-block;
}

.divisions-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* Reduced from 280px to 200px to fit 4 wide */
  gap: 0.75rem;
  flex: 1;
  overflow-y: auto;
  padding-right: 0.25rem;
  min-height: 0;
}

.division-summary {
  background-color: var(--input-bg);
  border-radius: 6px;
  padding: 0.5rem; /* Reduced from 0.75rem */
  border: 1px solid var(--border-color);
  min-height: 80px; /* Reduced from 120px */
  display: flex;
  flex-direction: column;
}

.division-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem; /* Reduced from 0.5rem */
  padding-bottom: 0.15rem; /* Reduced from 0.25rem */
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.division-name {
  color: var(--text-color);
  font-weight: 600;
  font-size: 0.9rem;
}

.division-progress {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 0.85rem;
}

.division-progress-bar {
  width: 100%;
  height: 4px;
  background-color: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.25rem; /* Reduced from 0.5rem */
  flex-shrink: 0;
}

.division-progress-fill {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s ease;
  border-radius: 2px;
}

.sections-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  flex: 1;
  align-content: flex-start;
}

.section-tag {
  padding: 0.1rem 0.3rem; /* Reduced padding for more compact tags */
  border-radius: 3px;
  font-size: 0.65rem; /* Slightly smaller font */
  font-weight: 500;
  border: 1px solid var(--border-color);
  background-color: var(--form-bg);
  color: var(--text-secondary);
  transition: all 0.2s ease;
  line-height: 1.1; /* Tighter line height */
}

.section-tag.completed {
  background-color: #4caf50;
  color: white;
  border-color: #4caf50;
  font-weight: 600;
}
</style>
