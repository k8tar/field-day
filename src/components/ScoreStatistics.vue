<!-- filepath: c:\git\k8tar-fieldday\src\components\ScoreStatistiimport { computed, ref } from 'vue';
import { qsos, getTotalQsoPoints, getQsoPointsByMode } from '@/store/qso';
import { bonuses, getTotalBonusPoints, getCompletedBonusCount } from '@/store/bonus';
import BonusModal from './BonusModal.vue';
import StatisticsModal from './StatisticsModal.vue';ue -->
<template>
  <div class="score-statistics">
    <div class="stats-header">
      <h2>{{ totalScore.toLocaleString() }} Points</h2>
      <div class="header-buttons">
        <button class="expand-button" @click="openStatsModal" title="View detailed QSO statistics">
          <span class="material-icons">analytics</span>
          Expand
        </button>
        <button class="bonus-button" @click="showBonusModal = true" title="Field Day Bonuses">
          <span class="material-icons">star</span>
          Bonuses
        </button>
      </div>
    </div>
    <div class="stats-content">
      <div class="stats-grid">
        <div class="stat-item">
          <label>PH ({{ phCount }}):</label>
          <span class="stat-value">{{ qsoPointsByMode.ph }} pts</span>
        </div>
        <div class="stat-item">
          <label>CW ({{ cwCount }}) ×2:</label>
          <span class="stat-value">{{ qsoPointsByMode.cw }} pts</span>
        </div>
        <div class="stat-item">
          <label>DIG ({{ digCount }}) ×2:</label>
          <span class="stat-value">{{ qsoPointsByMode.dig }} pts</span>
        </div>
        <div class="stat-item">
          <label>QSOs/Hr (Last 60 min):</label>
          <span class="stat-value">{{ qsosPerHour }}</span>
        </div>
        <div class="stat-item">
          <label>QSOs/Hr (Last 30 min):</label>
          <span class="stat-value">{{ qsosPerHalfHour }}</span>
        </div>
        <div class="stat-item bonus-item clickable-bonus" @click="showBonusModal = true">
          <label class="bonus-label">
            Bonus Points
            <span class="bonus-help-icon material-icons" title="Click to view and manage bonuses">help</span>
          </label>
          <span class="stat-value">{{ totalBonusPoints }}</span>
        </div>
        <div class="stat-item bonus-item">
          <label>Bonuses Completed:</label>
          <span class="stat-value">{{ completedBonusCount }}</span>
        </div>
        <div class="stat-item multiplier-item">
          <label>Sections Worked (Multiplier):</label>
          <span class="stat-value multiplier-value">{{ sectionsWorked }}×</span>
        </div>
        <div class="stat-item calculation-item">
          <label>Score Calculation:</label>
          <span class="stat-value calculation-value">{{ baseScore }} × {{ sectionsWorked }}</span>
        </div>
      </div>
    </div>

    <!-- Bonus Modal -->
    <BonusModal :isOpen="showBonusModal" @close="showBonusModal = false" />
    
    <!-- Statistics Modal -->
    <StatisticsModal 
      :is-open="statsModalOpen" 
      :qsos="qsos" 
      @close="closeStatsModal" 
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { qsos, getTotalQsoPoints, getQsoPointsByMode, getCompletedSections } from '@/store/qso';
import { getTotalBonusPoints, getCompletedBonusCount } from '@/store/bonus';
import BonusModal from './BonusModal.vue';
import StatisticsModal from './StatisticsModal.vue';

// Modal state
const showBonusModal = ref<boolean>(false);
const statsModalOpen = ref<boolean>(false);

// QSO counts by mode
const cwCount = computed<number>(() => qsos.value.filter(q => q.mode === 'CW').length);
const phCount = computed<number>(() => qsos.value.filter(q => q.mode === 'PH').length);
const digCount = computed<number>(() => qsos.value.filter(q => q.mode === 'DIG').length);

// QSO points calculation
const qsoPointsByMode = computed(() => getQsoPointsByMode());
const totalQsoPoints = computed(() => getTotalQsoPoints());

// Bonus information
const totalBonusPoints = computed(() => getTotalBonusPoints());
const completedBonusCount = computed(() => getCompletedBonusCount());

// Multiplier (sections worked)
const sectionsWorked = computed(() => getCompletedSections().length);

// Total score calculation: (QSO Points + Bonus Points) × Sections Worked
const baseScore = computed(() => totalQsoPoints.value + totalBonusPoints.value);
const totalScore = computed(() => baseScore.value * Math.max(1, sectionsWorked.value));

// Calculate QSOs per hour (last 60 minutes)
const qsosPerHour = computed(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return qsos.value.filter(q => new Date(q.datetime) > oneHourAgo).length;
});

// Calculate QSOs per half hour (last 30 minutes)
const qsosPerHalfHour = computed(() => {
  const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
  return qsos.value.filter(q => new Date(q.datetime) > halfHourAgo).length;
});

// Statistics modal functions
function openStatsModal() {
  statsModalOpen.value = true;
}

function closeStatsModal() {
  statsModalOpen.value = false;
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';
.score-statistics {
  background-color: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: background-color 0.3s ease, border-color 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  width: 100%;
}

h2 {
  background-color: var(--primary-color);
  color: white;
  margin: 0;
  padding: 0.5rem 1rem;
  font-size: 1.2rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.stats-header {
  background-color: var(--primary-color);
  color: white;
  padding: 0.5rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);

  h2 {
    background: none;
    padding: 0;
    border: none;
    margin: 0;
    font-size: 1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
}

.header-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.expand-button,
.bonus-button {
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

  &:hover {
    background-color: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .material-icons {
    font-size: 14px;
  }
}

.stats-content {
  padding: 0.5rem;
  flex: 1;
  overflow-y: auto;
}

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--input-bg);
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  border: 1px solid var(--border-color);
}

.stat-item label {
  font-size: 0.75rem;
  color: var(--text-color);
}

.stat-value {
  font-family: 'Consolas', monospace;
  font-size: 0.8rem;
  font-weight: bold;
  background-color: rgba(var(--accent-rgb, 67, 160, 71), 0.15);
  color: var(--accent-color, #4caf50);
  padding: 0.15rem 0.35rem;
  border-radius: 3px;
  min-width: 3ch;
  text-align: center;
}

.total-score {
  border: 2px solid var(--accent-color);
  background-color: rgba(var(--accent-rgb, 67, 160, 71), 0.1);
  
  .total-value {
    font-size: 1rem;
    background-color: var(--accent-color);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
}

.bonus-item {
  border-left: 3px solid var(--accent-color);
  
  .stat-value {
    background-color: rgba(255, 193, 7, 0.15);
    color: #ff9800;
  }
}

.clickable-bonus {
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: rgba(255, 193, 7, 0.1);
  }
}

.bonus-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.bonus-help-icon {
  font-size: 0.9rem !important;
  color: var(--accent-color);
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  
  &:hover {
    opacity: 1;
  }
}

.multiplier-item {
  border-left: 3px solid #2196f3;
  
  .stat-value {
    background-color: rgba(33, 150, 243, 0.15);
    color: #2196f3;
  }
}

.calculation-item {
  border-left: 3px solid #9c27b0;
  
  .stat-value {
    background-color: rgba(156, 39, 176, 0.15);
    color: #9c27b0;
    min-width: auto;
    font-size: 0.75rem;
  }
}
</style>