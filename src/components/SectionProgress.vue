<!-- Compact Section Progress Component -->
<template>
  <div class="section-progress-container">
    <div class="progress-header">
      <h4>Section Progress</h4>
      <div class="header-right">
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
        <button 
          class="btn btn-sm" 
          @click="$emit('open-section-map')"
          title="Open detailed section map"
        >
          <i class="material-icons">map</i>
          Expand
        </button>
      </div>
    </div>

    <div class="divisions-summary">
      <div 
        v-for="(division, divisionName) in arrlDivisions" 
        :key="divisionName" 
        class="division-summary"
      >
        <div class="division-header">
          <span class="division-name">{{ divisionName }}</span>
          <span class="division-progress">{{ getLoggedCount(division.sections) }}/{{ division.sections.length }}</span>
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
            :class="{ 'completed': isLogged(section) }"
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

// Define emits
defineEmits(['open-section-map']);

// ARRL Divisions and their sections (compact version) - ordered by division numbers
const arrlDivisions = {
  'Rocky Mountain (0)': {
    sections: ['CO', 'NM', 'NV', 'UT', 'WY']
  },
  'New England (1)': {
    sections: ['CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA']
  },
  'Hudson (2)': {
    sections: ['ENY', 'NNY', 'NYC', 'WNY']
  },
  'Atlantic (3)': {
    sections: ['EPA', 'MDC', 'NLI', 'NNJ', 'SNJ', 'WPA']
  },
  'Delta (4)': {
    sections: ['AL', 'AR', 'LA', 'MS', 'TN']
  },
  'Southeastern (4)': {
    sections: ['FL', 'GA', 'NC', 'NFL', 'SC', 'SFL', 'VI', 'WCF']
  },
  'Midwest (5)': {
    sections: ['IA', 'KS', 'MO', 'NE']
  },
  'Southwestern (5)': {
    sections: ['AZ', 'TX']
  },
  'West Gulf (5)': {
    sections: ['NTX', 'OK', 'STX']
  },
  'Pacific (6)': {
    sections: ['EB', 'LAX', 'ORG', 'SB', 'SC', 'SCV', 'SDG', 'SF', 'SJV', 'SV']
  },
  'Northwestern (7)': {
    sections: ['AK', 'EWA', 'ID', 'MT', 'OR', 'WWA']
  },
  'Great Lakes (8)': {
    sections: ['KY', 'MI', 'OH', 'WV']
  },
  'Central (9)': {
    sections: ['IL', 'IN', 'WI']
  },
  'Dakota (9)': {
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
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.progress-header h4 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-color);
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-progress {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-end;
}

.header-stats {
  display: flex;
  gap: 1rem;
  align-items: baseline;
}

.header-stat {
  color: var(--text-color);
  font-weight: 600;
  font-size: 0.9rem;
}

.header-percentage {
  color: var(--primary-color);
  font-weight: 700;
  font-size: 1rem;
}

.header-progress-bar {
  width: 150px;
  height: 6px;
  background-color: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
}

.header-progress-fill {
  height: 100%;
  background-color: var(--primary-color);
  transition: width 0.3s ease;
  border-radius: 3px;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-sm .material-icons {
  font-size: 16px;
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
