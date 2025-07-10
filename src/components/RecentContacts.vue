<!-- filepath: c:\git\k8tar-fieldday\src\components\RecentContacts.vue -->
<template>
  <div class="recent-contacts">
    <h2>Recent Contacts</h2>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Call</th>
            <th>Class</th>
            <th>Section</th>
            <th>Time</th>
            <th>Band</th>
            <th>Mode</th>
            <th>Operator</th>
            <th>Station</th>
            <th>Actions</th>
          </tr>
        </thead>
      </table>
      <div class="table-body-container" ref="scrollContainer" @scroll="handleScroll">
        <div class="spacer-top" :style="{ height: `${offsetTop}px` }"></div>
        <table>
          <tbody>
            <tr v-for="(qso, idx) in visibleQsos" :key="qso.id || (startIndex + idx)" :style="{ height: `${rowHeight}px` }">
              <td>{{ qsos.length - (startIndex + idx) }}</td>
              <td>{{ qso.call }}</td>
              <td>{{ qso.class }}</td>
              <td>{{ qso.section }}</td>
              <td>{{ formatDateTime(qso.datetime) }}</td>
              <td>{{ qso.band }}</td>
              <td>{{ qso.mode }}</td>
              <td>{{ qso.operator }}</td>
              <td>{{ qso.stationDesignator || '-' }}</td>
              <td>
                <div class="action-buttons">
                  <button class="action-button edit" @click="openEditModal(qso)">
                    <span class="material-icons">edit</span>
                  </button>
                  <button class="action-button delete" @click="confirmDelete(qso)">
                    <span class="material-icons">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="spacer-bottom" :style="{ height: `${offsetBottom}px` }"></div>
      </div>
    </div>
    
    <!-- Edit QSO Modal -->
    <div v-if="editModalOpen" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit QSO</h3>
          <button class="close-button" @click="closeEditModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Callsign:</label>
            <input 
              v-model="editingQso.call" 
              @input="editingQso.call = ($event.target as HTMLInputElement).value.toUpperCase()"
            />
          </div>
          <div class="form-group">
            <label>Class:</label>
            <input 
              v-model="editingQso.class" 
              @input="editingQso.class = ($event.target as HTMLInputElement).value.toUpperCase()"
              :class="{'validation-error': editingQso.class && !isEditClassValid}"
              placeholder="1A"
              autocomplete="off"
            />
            <div class="validation-message" v-if="editingQso.class && !isEditClassValid">
              Format: 1-3 digits + A-F (e.g., 1A, 2B)
            </div>
          </div>
          <div class="form-group">
            <label>Section:</label>
            <input 
              v-model="editingQso.section"
              @input="editingQso.section = ($event.target as HTMLInputElement).value.toUpperCase()"
              :class="{'validation-error': editingQso.section && !isEditSectionValid}"
              placeholder="e.g., WPA, OH, DX"
              autocomplete="off"
            />
            <div class="validation-message" v-if="editingQso.section && !isEditSectionValid">
              Invalid ARRL section
            </div>
          </div>
          <div class="form-group">
            <label>Band:</label>
            <select v-model="editingQso.band">
              <option v-for="bandOption in bands" :key="bandOption" :value="bandOption">
                {{ bandOption }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Mode:</label>
            <select v-model="editingQso.mode">
              <option value="PH">PH</option>
              <option value="CW">CW</option>
              <option value="DIG">DIG</option>
            </select>
          </div>
          <div class="form-group">
            <label>Operator:</label>
            <select v-model="editingQso.operator">
              <option v-for="op in operators" :key="op" :value="op">
                {{ op }}
              </option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button 
            class="save-button" 
            @click="saveQsoEdit"
            :disabled="!!(editingQso.section && !isEditSectionValid) || !!(editingQso.class && !isEditClassValid)"
          >
            Save Changes
          </button>
          <button class="cancel-button" @click="closeEditModal">Cancel</button>
        </div>
      </div>
    </div>
    
    <!-- Delete Confirmation Modal -->
    <div v-if="deleteModalOpen" class="modal">
      <div class="modal-content delete-confirm">
        <div class="modal-header">
          <h3>Confirm Delete</h3>
          <button class="close-button" @click="closeDeleteModal">&times;</button>
        </div>
        <div class="modal-body">
          <p class="delete-message">
            Are you sure you want to delete this QSO with <strong>{{ deletingQso?.call }}</strong>?
          </p>
          <p class="delete-details">
            <strong>Time:</strong> {{ deletingQso ? formatDateTime(deletingQso.datetime) : '' }}<br>
            <strong>Band/Mode:</strong> {{ deletingQso?.band }} {{ deletingQso?.mode }}
          </p>
          <p class="warning">This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="delete-button" @click="deleteSelectedQso">Delete</button>
          <button class="cancel-button" @click="closeDeleteModal">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue';
import { qsos, deleteQso, updateQso, QSO } from '@/store/qso';
import { validateArrlSection, normalizeArrlSection, validateArrlClass, normalizeArrlClass } from '@/constants/arrl-sections';

// ARRL sections validation
const isEditSectionValid = computed(() => {
  if (!editingQso.value.section) return true; // Empty is valid
  return validateArrlSection(editingQso.value.section);
});

// ARRL class validation
const isEditClassValid = computed(() => {
  if (!editingQso.value.class) return true; // Empty is valid
  return validateArrlClass(editingQso.value.class);
});

// Create a default empty QSO object
const emptyQso: QSO = {
  call: '',
  class: '',
  section: '',
  datetime: new Date().toISOString(),
  band: '',
  mode: 'PH',
  operator: ''
};

const sortedQsos = computed(() => {
  return [...qsos.value].sort((a, b) => 
    new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
  );
});

// Virtual scrolling variables
const scrollContainer = ref<HTMLElement | null>(null);
const rowHeight = 40; // Height of each row in pixels
const visibleCount = 15; // Number of visible rows
const bufferSize = 5; // Extra rows to render above and below visible area

const scrollTop = ref(0);
const containerHeight = ref(0);

// Computed properties for virtual scrolling
const startIndex = computed(() => {
  const index = Math.floor(scrollTop.value / rowHeight) - bufferSize;
  return Math.max(0, index);
});

const endIndex = computed(() => {
  const index = startIndex.value + visibleCount + (bufferSize * 2);
  return Math.min(sortedQsos.value.length, index);
});

const visibleQsos = computed(() => {
  return sortedQsos.value.slice(startIndex.value, endIndex.value);
});

const offsetTop = computed(() => {
  return startIndex.value * rowHeight;
});

const offsetBottom = computed(() => {
  const totalHeight = sortedQsos.value.length * rowHeight;
  const visibleHeight = endIndex.value * rowHeight;
  return totalHeight - visibleHeight;
});

// Scroll handler
function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  scrollTop.value = target.scrollTop;
}

// Initialize container height
onMounted(() => {
  nextTick(() => {
    if (scrollContainer.value) {
      containerHeight.value = scrollContainer.value.clientHeight;
    }
  });
});

// Watch for QSO changes to maintain scroll position
watch(() => qsos.value.length, () => {
  // Optionally scroll to top when new QSOs are added
  if (scrollContainer.value && scrollTop.value === 0) {
    scrollContainer.value.scrollTop = 0;
  }
});

// Edit modal state
const editModalOpen = ref(false);
const editingQso = ref<QSO>(emptyQso); // Initialize with default values

// Delete modal state
const deleteModalOpen = ref(false);
const deletingQso = ref<QSO | null>(null);

// Band options and operators from localStorage
const bands = ['160m', '80m', '40m', '20m', '15m', '10m', '6m', '2m'];
const operators = computed(() => {
  const savedOperators = localStorage.getItem('operators');
  return savedOperators ? JSON.parse(savedOperators) : ['K8TAR'];
});

function formatDateTime(datetime: string | number | Date) {
  const date = new Date(datetime);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  const month = months[date.getMonth()];
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  
  return `${month} ${day} ${formattedHours}:${minutes} ${ampm}`;
}

// Edit modal functions
function openEditModal(qso: QSO) {
  // Create a deep copy to avoid reference issues
  editingQso.value = JSON.parse(JSON.stringify(qso));
  editModalOpen.value = true;
}

function closeEditModal() {
  editModalOpen.value = false;
  // Reset to empty QSO instead of null
  editingQso.value = JSON.parse(JSON.stringify(emptyQso));
}

function saveQsoEdit() {
  if (editingQso.value && editingQso.value.id !== undefined) {
    console.log('Saving edited QSO:', editingQso.value);
    
    // Validate section if provided
    if (editingQso.value.section && !validateArrlSection(editingQso.value.section)) {
      console.error('Invalid section provided:', editingQso.value.section);
      return;
    }
    
    // Validate class if provided
    if (editingQso.value.class && !validateArrlClass(editingQso.value.class)) {
      console.error('Invalid class provided:', editingQso.value.class);
      return;
    }
    
    // Normalize the section
    const normalizedSection = editingQso.value.section ? 
      normalizeArrlSection(editingQso.value.section) : '';
    
    // Normalize the class
    const normalizedClass = editingQso.value.class ? 
      normalizeArrlClass(editingQso.value.class) : '';
    
    // Make sure all fields are properly set
    const updatedQso = {
      ...editingQso.value,
      call: editingQso.value.call.toUpperCase(),
      class: normalizedClass || '',
      section: normalizedSection || ''
    };
    
    // Call the update function with proper parameters - ensure id is a number
    updateQso(updatedQso.id as number, updatedQso);
    closeEditModal();
  } else {
    console.error('Cannot save QSO: Missing ID or QSO data', editingQso.value);
  }
}

// Delete modal functions
function confirmDelete(qso: QSO) {
  deletingQso.value = qso;
  deleteModalOpen.value = true;
}

function closeDeleteModal() {
  deleteModalOpen.value = false;
  deletingQso.value = null;
}

function deleteSelectedQso() {
  if (deletingQso.value && deletingQso.value.id !== undefined) {
    console.log('Deleting QSO:', deletingQso.value);
    // Use type assertion to tell TypeScript that id is definitely a number
    deleteQso(deletingQso.value.id as number);
    closeDeleteModal();
  } else {
    console.error('Cannot delete QSO: Missing ID or QSO data', deletingQso.value);
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';
.recent-contacts {
  background-color: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: background-color 0.3s ease, border-color 0.3s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
}

h2 {
  background-color: var(--primary-color);
  color: white;
  margin: 0;
  padding: 0.5rem 1rem;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.table-body-container {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.spacer-top,
.spacer-bottom {
  width: 100%;
  pointer-events: none;
}

th {
  background-color: var(--table-header);
  color: var(--table-text);
  text-align: left;
  padding: 0.5rem;
  font-size: 0.9rem;
}

td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-color);
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

tbody tr:nth-child(even) {
  background-color: var(--table-alt);
}

tbody tr:hover {
  background-color: var(--table-hover);
}

/* Column widths */
th:nth-child(1), td:nth-child(1) { width: 40px; } /* # */
th:nth-child(2), td:nth-child(2) { width: 80px; } /* Call */
th:nth-child(3), td:nth-child(3) { width: 50px; } /* Class */
th:nth-child(4), td:nth-child(4) { width: 50px; } /* Section */
th:nth-child(5), td:nth-child(5) { width: 160px; } /* Time */
th:nth-child(6), td:nth-child(6) { width: 50px; } /* Band */
th:nth-child(7), td:nth-child(7) { width: 50px; } /* Mode */
th:nth-child(8), td:nth-child(8) { width: 80px; } /* Operator */
th:nth-child(9), td:nth-child(9) { width: 80px; } /* Station */
th:nth-child(10), td:nth-child(10) { width: 80px; } /* Actions */

/* Action buttons */
.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.action-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-button.edit {
  color: #2196F3;
}

.action-button.delete {
  color: #e74c3c;
}

.action-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.material-icons {
  font-size: 18px;
}

/* Modal styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: var(--modal-bg);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
}

.modal-content {
  background-color: var(--modal-content);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  width: 400px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
  animation: modal-appear 0.3s ease-out;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-color);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-color);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: 70vh;
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Form styles */
.form-group {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-weight: bold;
  color: var(--text-color);
}

.form-group input, .form-group select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px; /* Updated to match global button style */
  background-color: var(--input-bg);
  color: var(--text-color);
}

/* Button styles */
button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px; /* Updated to match global button style */
  cursor: pointer;
  font-weight: bold;
}

.save-button {
  background-color: var(--button-bg);
  color: var(--button-text);
}

.delete-button {
  background-color: #e74c3c;
  color: white;
}

.cancel-button {
  background-color: var(--form-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

/* Validation styles */
.validation-error {
  border-color: #dc3545 !important;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
}

.validation-message {
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  font-weight: 500;
}

/* Delete confirmation specific styles */
.delete-confirm {
  max-width: 450px;
}

.delete-message {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

.delete-details {
  background-color: var(--table-alt);
  padding: 0.75rem;
  border-radius: 8px; /* Updated to match global button style */
  margin: 1rem 0;
}

.warning {
  color: #e74c3c;
  font-weight: bold;
  margin-top: 1rem;
}

@keyframes modal-appear {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>