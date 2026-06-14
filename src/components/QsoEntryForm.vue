<template>
  <div class="qso-entry-container">
    <form @submit.prevent="onLogQso" class="qso-entry-form">
      <div class="form-content">
        <div class="input-row">
          <div class="input-group">
            <label>Call:</label>
            <input 
              v-model="call" 
              @input="emitUpdate" 
              @blur="onCallBlur"
              required 
              class="call-input"
              :class="{'duplicate-warning': isExactDuplicate}"
              placeholder="CALLSIGN"
              autocomplete="off"
              ref="callInput"
            />
            <div class="validation-message" v-if="isExactDuplicate">
              Exact duplicate!
            </div>
          </div>
          <div class="input-group">
            <label>Class:</label>
            <input 
              v-model="qsoClass" 
              @input="handleClassInput"
              required 
              class="class-input"
              :class="{'validation-error': qsoClass && !isClassValid}"
              placeholder="1A"
              autocomplete="off"
            />
            <div class="validation-message" v-if="qsoClass && !isClassValid">
              Invalid ARRL class
            </div>
          </div>
          <div class="input-group">
            <label>Section:</label>
            <input 
              v-model="section" 
              @input="handleSectionInput"
              required 
              class="section-input"
              :class="{'validation-error': section && !isSectionValid}"
              placeholder="e.g., WPA, OH, DX"
              autocomplete="off"
            />
            <div class="validation-message" v-if="section && !isSectionValid">
              Invalid ARRL section
            </div>
          </div>
          <div class="button-group">
            <button 
              type="submit" 
              class="log-button" 
              :disabled="!isFormValid || isExactDuplicate"
            >
              Log
            </button>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { logQso, band, qsos } from '@/store/qso';
import { validateArrlSection, normalizeArrlSection, validateArrlClass, normalizeArrlClass } from '@/constants/arrl-sections';

const props = defineProps({
  mode: {
    type: String,
    default: 'PH'
  }
});

const emit = defineEmits(['update:call', 'update:band', 'update:mode']);

const call = ref<string>('');
const qsoClass = ref<string>('');
const section = ref<string>('');
const callInput = ref<HTMLInputElement | null>(null);

// Section validation
const isSectionValid = computed<boolean>(() => {
  if (!section.value) return true; // Empty is valid (will be caught by required)
  return validateArrlSection(section.value);
});

// Class validation
const isClassValid = computed<boolean>(() => {
  if (!qsoClass.value) return true; // Empty is valid (will be caught by required)
  return validateArrlClass(qsoClass.value);
});

// Check if all required fields are filled and valid
const isFormValid = computed<boolean>(() => {
  return call.value.trim() !== '' && 
         qsoClass.value.trim() !== '' && 
         section.value.trim() !== '' &&
         band.value.trim() !== '' &&  // Ensure band is selected
         isSectionValid.value &&
         isClassValid.value;
});

// Check if this callsign is an exact duplicate with the same band and mode
const isExactDuplicate = computed<boolean>(() => {
  if (!call.value) return false;
  
  // Get the current mode from the parent component
  const mode = props.mode || 'PH';
  
  return qsos.value.some(qso => 
    qso.call.toUpperCase() === call.value.toUpperCase() &&
    qso.band === band.value &&
    qso.mode === mode
  );
});

function emitUpdate(): void {
  emit('update:call', call.value);
}

function handleClassInput(e: Event): void {
  qsoClass.value = (e.target as HTMLInputElement).value.toUpperCase();
}

function handleSectionInput(e: Event): void {
  section.value = (e.target as HTMLInputElement).value.toUpperCase();
}

// Auto-fill class and section if callsign exists in log
function onCallBlur() {
  if (!call.value.trim()) return;
  
  // Find existing QSO with the same callsign
  const existingQso = qsos.value.find(qso => 
    qso.call.toUpperCase() === call.value.toUpperCase()
  );
  
  if (existingQso) {
    // Only auto-fill if the fields are currently empty
    if (!qsoClass.value.trim()) {
      qsoClass.value = existingQso.class;
    }
    if (!section.value.trim()) {
      section.value = existingQso.section;
    }
  }
}

function onLogQso() {
  // Don't submit if form is invalid or is exact duplicate
  if (!isFormValid.value || isExactDuplicate.value) return;
  
  // Normalize the section
  const normalizedSection = normalizeArrlSection(section.value);
  if (!normalizedSection) {
    console.error('Invalid section provided:', section.value);
    return;
  }
  
  // Normalize the class
  const normalizedClass = normalizeArrlClass(qsoClass.value);
  if (!normalizedClass) {
    console.error('Invalid class provided:', qsoClass.value);
    return;
  }
  
  // Add the QSO with current timestamp
  logQso({
    call: call.value.toUpperCase(),
    class: normalizedClass,
    section: normalizedSection,
    datetime: new Date().toISOString() // Generate timestamp at moment of logging
  });
  
  // Reset form fields
  call.value = '';
  qsoClass.value = '';
  section.value = '';
  
  // Emit updates
  emit('update:call', '');
  
  // Focus the call input field after the DOM has updated
  nextTick(() => {
    if (callInput.value) {
      callInput.value.focus();
    }
  });
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';
.qso-entry-container {
  background-color: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.qso-entry-form {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-content {
  width: 100%;
}

.input-row {
  display: flex;
  flex-wrap: nowrap; /* Prevent wrapping */
  gap: 2rem; 
  width: 100%;
  align-items: flex-start;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  position: relative;
  min-height: 4.5rem; 
  margin-bottom: 0.25rem; 
}

.button-group {
  display: flex;
  align-items: flex-start;
  padding-top: 1.1rem; /* Fine-tuned alignment to match input field center better */
  padding-left: 0; 
  margin-left: 0.5rem; 
  min-height: 4.5rem; 
}

.input-group label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.input-group input, .input-group select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-color);
  width: 100%;
}

.call-input {
  width: 80px; 
  text-transform: uppercase;
}

.class-input {
  width: 35px; 
  text-transform: uppercase;
}

.section-input {
  width: 45px; 
  text-transform: uppercase;
}

.button-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

.log-button {
  background-color: var(--button-bg);
  color: var(--button-text);
  border: 1px solid var(--border-color);
  border-radius: 4px; 
  padding: 0.5rem 1rem; /* Increased horizontal padding for better size */
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
  height: auto; 
  min-width: 60px; /* Increased minimum width */
  font-size: 0.9rem; 
}

.log-button:hover:not(:disabled) {
  background-color: var(--button-hover);
}

.log-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.duplicate-warning {
  border-color: #dc3545 !important;
  border-width: 2px !important;
  color: #dc3545 !important;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25) !important;
}

[data-theme="dark"] .duplicate-warning {
  border-color: #ff8a80 !important;
  color: #ff8a80 !important;
  box-shadow: 0 0 0 0.2rem rgba(255, 138, 128, 0.25) !important;
}

.validation-error {
  border-color: #dc3545 !important;
  border-width: 2px !important;
  color: #dc3545 !important;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25) !important;
}

[data-theme="dark"] .validation-error {
  border-color: #ff8a80 !important;
  color: #ff8a80 !important;
  box-shadow: 0 0 0 0.2rem rgba(255, 138, 128, 0.25) !important;
}

.validation-message {
  color: #dc3545;
  font-size: 0.75rem; 
  margin-top: 0.5rem; 
  font-weight: 500;
  position: absolute;
  bottom: -0.25rem; 
  left: 0;
  white-space: nowrap;
  background-color: var(--form-bg); 
  padding: 0.1rem 0; 
}
</style>