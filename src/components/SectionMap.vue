<!-- ARRL Section Map Modal Component -->
<template>
  <div class="section-map-container">
    <div class="section-map-header">
      <div class="header-left">
        <h2>ARRL Section Progress Map</h2>
        <div class="header-progress">
          <div class="header-stats">
            <span class="header-stat">{{ totalLoggedSections }}/{{ totalSections }} sections</span>
            <span class="header-percentage">{{ progressPercentage }}%</span>
          </div>
          <div class="header-progress-bar">
            <div 
              class="header-progress-fill" 
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
        </div>
      </div>
      <button class="btn btn-close" @click="$emit('close')" aria-label="Close">
        <i class="material-icons">close</i>
      </button>
    </div>
    
    <div class="section-map-content">
      <div class="divisions-grid">
        <div 
          v-for="(division, divisionName) in arrlDivisions" 
          :key="divisionName" 
          class="division-card"
        >
          <h3 class="division-title">
            {{ divisionName }}
            <span v-if="isDivisionComplete(division.sections)" class="trophy-icon" title="Division Complete!">🏆</span>
          </h3>
          <div class="sections-grid">
            <span 
              v-for="section in division.sections" 
              :key="section"
              :class="['section-tag', { 'logged': isLogged(section) }]"
              :title="`${section} - ${isLogged(section) ? 'Logged' : 'Not logged'}`"
            >
              {{ section }}
            </span>
          </div>
          <div class="division-stats">
            <span class="stats-text">
              {{ getLoggedCount(division.sections) }} / {{ division.sections.length }} sections
            </span>
            <div class="division-progress-bar">
              <div 
                class="division-progress-fill" 
                :style="{ width: getDivisionProgress(division.sections) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { qsos } from '@/store/qso';

// Define emits
defineEmits(['close']);

// Complete ARRL Divisions and their sections
const arrlDivisions = {
  'Rocky Mountain Division (0)': {
    sections: ['CO', 'NM', 'UT', 'WY']
  },
  'New England Division (1)': {
    sections: ['CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA']
  },
  'Hudson Division (2)': {
    sections: ['ENY', 'NNY', 'WNY']
  },
  'Atlantic Division (3)': {
    sections: ['EPA', 'MDC', 'NLI', 'NNJ', 'SNJ', 'WPA']
  },
  'Delta Division (4)': {
    sections: ['AL', 'AR', 'LA', 'MS', 'TN']
  },
  'Southeastern Division (4)': {
    sections: ['AL', 'GA', 'NFL', 'SFL']
  },
  'Roanoke Division (4)': {
    sections: ['NC', 'SC', 'VA', 'WV']
  },
  'Midwest Division (5)': {
    sections: ['IA', 'KS', 'MO', 'NE']
  },
  'Southwestern Division (5)': {
    sections: ['AZ', 'NV']
  },
  'West Gulf Division (5)': {
    sections: ['NTX', 'OK', 'STX', 'WTX']
  },
  'Pacific Division (6)': {
    sections: ['EB', 'LAX', 'ORG', 'SB', 'SCV', 'SDG', 'SF', 'SJV', 'SV']
  },
  'Northwestern Division (7)': {
    sections: ['AK', 'EWA', 'ID', 'MT', 'OR', 'WWA']
  },
  'Great Lakes Division (8)': {
    sections: ['KY', 'MI', 'OH', 'WV']
  },
  'Central Division (9)': {
    sections: ['IL', 'IN', 'WI']
  },
  'Dakota Division (9)': {
    sections: ['MN', 'ND', 'SD']
  },
  'International (DX)': {
    sections: ['DX']
  }
};

// Check if a section has been logged
const isLogged = (section: string): boolean => {
  return qsos.value.some(qso => qso.section === section);
};

// Get count of logged sections for a division
const getLoggedCount = (sections: string[]): number => {
  return sections.filter(section => isLogged(section)).length;
};

// Get progress percentage for a division
const getDivisionProgress = (sections: string[]): number => {
  const logged = getLoggedCount(sections);
  return sections.length > 0 ? Math.round((logged / sections.length) * 100) : 0;
};

// Check if a division is complete (all sections logged)
const isDivisionComplete = (sections: string[]): boolean => {
  return sections.length > 0 && sections.every(section => isLogged(section));
};

// Computed properties
const totalSections = computed(() => {
  return Object.values(arrlDivisions).reduce((total, division) => total + division.sections.length, 0);
});

const totalLoggedSections = computed(() => {
  return Object.values(arrlDivisions).reduce((total, division) => total + getLoggedCount(division.sections), 0);
});

const progressPercentage = computed(() => {
  return totalSections.value > 0 ? Math.round((totalLoggedSections.value / totalSections.value) * 100) : 0;
});
</script>

<style scoped>
.section-map-container {
  max-width: 1200px;
  max-height: 90vh;
  background-color: var(--form-bg);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.section-map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: var(--primary-color);
  color: white;
  border-bottom: 1px solid var(--border-color);
  gap: 1rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.section-map-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-progress {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.header-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.header-stat {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.header-percentage {
  color: white;
  font-weight: 600;
}

.header-progress-bar {
  width: 100%;
  height: 6px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.header-progress-fill {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s ease;
  border-radius: 3px;
}

.btn-close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.section-map-content {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.divisions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.division-card {
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  transition: box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
}

.division-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.division-title {
  margin: 0 0 0.75rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
  border-bottom: 2px solid var(--primary-color);
  padding-bottom: 0.5rem;
}

.trophy-icon {
  margin-left: 0.5rem;
  font-size: 1.125rem;
  display: inline-block;
}

.sections-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  align-items: flex-start;
  flex: 1;
  align-content: flex-start;
}

.section-tag {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  background-color: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  cursor: default;
  height: auto;
  flex-shrink: 0;
}

.section-tag.logged {
  background-color: #4caf50;
  color: white;
  border-color: #4caf50;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
}

.division-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: auto;
}

.stats-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
  text-align: center;
}

.division-progress-bar {
  width: 100%;
  height: 6px;
  background-color: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
}

.division-progress-fill {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s ease;
  border-radius: 3px;
}

/* Dark mode adjustments */
[data-theme="dark"] .section-tag {
  background-color: var(--input-bg);
  border-color: var(--border-color);
}

[data-theme="dark"] .section-tag.logged {
  background-color: #4caf50;
  border-color: #4caf50;
}
</style>
