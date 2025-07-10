<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Field Day Scoring Bonuses</h2>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <div class="bonus-summary">
          <div class="summary-item">
            <span class="summary-label">Completed Bonuses:</span>
            <span class="summary-value">{{ completedCount }} / {{ bonuses.length }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total Bonus Points:</span>
            <span class="summary-value">{{ totalPoints }}</span>
          </div>
        </div>

        <div class="bonus-list">
          <div 
            v-for="bonus in bonuses" 
            :key="bonus.id"
            class="bonus-item"
            :class="{ 'completed': bonus.completed }"
          >
            <div class="bonus-checkbox">
              <input 
                type="checkbox" 
                :id="bonus.id"
                :checked="bonus.completed"
                @change="handleBonusToggle(bonus.id)"
              />
              <label 
                :for="bonus.id" 
                class="checkbox-label"
                @click="handleBonusToggle(bonus.id)"
              ></label>
            </div>
            
            <div class="bonus-content">
              <div class="bonus-header">
                <h3 class="bonus-name">{{ bonus.name }}</h3>
                <span class="bonus-points">+{{ bonus.points }} pts</span>
              </div>
              <p class="bonus-description">{{ bonus.description }}</p>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="reset-button" @click="resetBonuses">Reset All</button>
          <button class="close-action-button" @click="$emit('close')">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { bonuses, toggleBonus, resetAllBonuses, getTotalBonusPoints, getCompletedBonusCount } from '@/store/bonus';

// Props
defineProps<{
  isOpen: boolean;
}>();

// Emits
defineEmits(['close']);

// Computed values
const totalPoints = computed(() => getTotalBonusPoints());
const completedCount = computed(() => getCompletedBonusCount());

// Methods
function handleBonusToggle(bonusId: string) {
  toggleBonus(bonusId);
}

function resetBonuses() {
  if (confirm('Are you sure you want to reset all bonuses? This cannot be undone.')) {
    resetAllBonuses();
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background-color: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: modalSlideIn 0.3s ease-out;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  background-color: var(--primary-color);
  color: white;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px 8px 0 0;

  h2 {
    margin: 0;
    font-size: 1.4rem;
  }

  .close-button {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
  }
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.bonus-summary {
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;

  .summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .summary-label {
    font-size: 0.9rem;
    color: var(--text-color);
    margin-bottom: 0.25rem;
  }

  .summary-value {
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--accent-color);
  }
}

.bonus-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.bonus-item {
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  gap: 0.75rem;
  transition: all 0.2s ease;

  &.completed {
    background-color: rgba(var(--accent-rgb, 67, 160, 71), 0.1);
    border-color: var(--accent-color);
  }

  &:hover {
    border-color: var(--accent-color);
  }
}

.bonus-checkbox {
  display: flex;
  align-items: flex-start;
  margin-top: 0.25rem;
  position: relative;

  input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    width: 20px;
    height: 20px;
    margin: 0;
    cursor: pointer;
  }

  .checkbox-label {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--form-bg);
    cursor: pointer;
    position: relative;
    transition: all 0.2s ease;

    &::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 6px;
      width: 6px;
      height: 10px;
      border: 2px solid white;
      border-top: none;
      border-left: none;
      transform: rotate(45deg);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
  }

  input[type="checkbox"]:checked + .checkbox-label {
    background-color: var(--accent-color);
    border-color: var(--accent-color);

    &::after {
      opacity: 1;
    }
  }
}

.bonus-content {
  flex: 1;
}

.bonus-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;

  .bonus-name {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-color);
  }

  .bonus-points {
    font-weight: bold;
    color: var(--accent-color);
    font-size: 0.9rem;
    background-color: rgba(var(--accent-rgb, 67, 160, 71), 0.15);
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
  }
}

.bonus-description {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);

  button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--form-bg);
    color: var(--text-color);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background-color: var(--input-bg);
    }
  }

  .reset-button {
    color: #d32f2f;
    border-color: #d32f2f;

    &:hover {
      background-color: #d32f2f;
      color: white;
    }
  }

  .close-action-button {
    background-color: var(--accent-color);
    color: white;
    border-color: var(--accent-color);

    &:hover {
      background-color: var(--accent-hover);
    }
  }
}
</style>