<!-- filepath: c:\git\k8tar-fieldday\src\components\RecentContacts.vue -->
<template>
  <div class="recent-contacts">
    <div class="header-section">
      <h2>Recent Contacts ({{ qsos.length }})</h2>
      <div class="header-buttons">
        <button class="btn btn-detailed" @click="openDetailedModal" title="Open detailed contacts view">
          <span class="material-icons">table_view</span>
          Detailed View
        </button>
      </div>
    </div>
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
    
    <!-- Detailed Contacts Modal -->
    <div v-if="detailedModalOpen" class="modal-overlay" @click="closeDetailedModal">
      <div class="modal-content detailed-modal" @click.stop>
        <div class="modal-header">
          <h3>All Contacts ({{ filteredQsos.length }} of {{ qsos.length }})</h3>
          <button class="close-button" @click="closeDetailedModal">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Search and Filter Controls -->
          <div class="controls-section">
            <div class="search-controls">
              <div class="search-group">
                <label>Search:</label>
                <input 
                  type="text" 
                  v-model="searchQuery" 
                  placeholder="Search callsign, section, operator..."
                  class="search-input"
                >
              </div>
              <div class="filter-group">
                <label>Band:</label>
                <select v-model="filterBand">
                  <option value="">All Bands</option>
                  <option v-for="band in availableBands" :key="band" :value="band">{{ band }}</option>
                </select>
              </div>
              <div class="filter-group">
                <label>Mode:</label>
                <select v-model="filterMode">
                  <option value="">All Modes</option>
                  <option v-for="mode in availableModes" :key="mode" :value="mode">{{ mode }}</option>
                </select>
              </div>
              <div class="filter-group">
                <label>Operator:</label>
                <select v-model="filterOperator">
                  <option value="">All Operators</option>
                  <option v-for="op in availableOperators" :key="op" :value="op">{{ op }}</option>
                </select>
              </div>
            </div>
            <div class="sort-controls">
              <label>Sort by:</label>
              <select v-model="sortField">
                <option value="datetime">Time</option>
                <option value="call">Callsign</option>
                <option value="band">Band</option>
                <option value="mode">Mode</option>
                <option value="section">Section</option>
                <option value="operator">Operator</option>
              </select>
              <button class="sort-direction-btn" @click="toggleSortDirection" :title="sortDirection === 'desc' ? 'Newest first' : 'Oldest first'">
                <span class="material-icons">{{ sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward' }}</span>
              </button>
            </div>
          </div>
          
          <!-- Contacts Table -->
          <div class="detailed-table-container">
            <table class="detailed-table">
              <thead>
                <tr>
                  <th @click="setSortField('datetime')" :class="{ 'sortable': true, 'active': sortField === 'datetime' }">
                    #
                    <span v-if="sortField === 'datetime'" class="material-icons">{{ sortDirection === 'desc' ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
                  </th>
                  <th @click="setSortField('call')" :class="{ 'sortable': true, 'active': sortField === 'call' }">
                    Call
                    <span v-if="sortField === 'call'" class="material-icons">{{ sortDirection === 'desc' ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
                  </th>
                  <th @click="setSortField('class')" :class="{ 'sortable': true, 'active': sortField === 'class' }">
                    Class
                    <span v-if="sortField === 'class'" class="material-icons">{{ sortDirection === 'desc' ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
                  </th>
                  <th @click="setSortField('section')" :class="{ 'sortable': true, 'active': sortField === 'section' }">
                    Section
                    <span v-if="sortField === 'section'" class="material-icons">{{ sortDirection === 'desc' ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
                  </th>
                  <th @click="setSortField('datetime')" :class="{ 'sortable': true, 'active': sortField === 'datetime' }">
                    Date/Time
                    <span v-if="sortField === 'datetime'" class="material-icons">{{ sortDirection === 'desc' ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
                  </th>
                  <th @click="setSortField('band')" :class="{ 'sortable': true, 'active': sortField === 'band' }">
                    Band
                    <span v-if="sortField === 'band'" class="material-icons">{{ sortDirection === 'desc' ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
                  </th>
                  <th @click="setSortField('mode')" :class="{ 'sortable': true, 'active': sortField === 'mode' }">
                    Mode
                    <span v-if="sortField === 'mode'" class="material-icons">{{ sortDirection === 'desc' ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
                  </th>
                  <th @click="setSortField('operator')" :class="{ 'sortable': true, 'active': sortField === 'operator' }">
                    Operator
                    <span v-if="sortField === 'operator'" class="material-icons">{{ sortDirection === 'desc' ? 'arrow_drop_down' : 'arrow_drop_up' }}</span>
                  </th>
                  <th>Station</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(qso, idx) in paginatedQsos" :key="qso.id || idx">
                  <td>{{ getContactNumber(qso) }}</td>
                  <td class="callsign">{{ qso.call }}</td>
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
                <tr v-if="filteredQsos.length === 0">
                  <td colspan="10" class="no-results">No contacts match your search criteria</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pagination">
            <button @click="currentPage = 1" :disabled="currentPage === 1" class="page-btn">First</button>
            <button @click="currentPage--" :disabled="currentPage === 1" class="page-btn">Previous</button>
            <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
            <button @click="currentPage++" :disabled="currentPage === totalPages" class="page-btn">Next</button>
            <button @click="currentPage = totalPages" :disabled="currentPage === totalPages" class="page-btn">Last</button>
          </div>
        </div>
        <div class="modal-footer">
          <div class="footer-stats">
            Showing {{ paginatedQsos.length }} of {{ filteredQsos.length }} contacts
          </div>
          <button class="btn cancel-button" @click="closeDetailedModal">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue';
import { qsos, deleteQso, updateQso, QSO } from '@/store/qso';
import { validateArrlSection, normalizeArrlSection, validateArrlClass, normalizeArrlClass } from '@/constants/arrl-sections';
import { fileStorage } from '@/services/fileStorage';

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
onMounted(async () => {
  nextTick(() => {
    if (scrollContainer.value) {
      containerHeight.value = scrollContainer.value.clientHeight;
    }
  });
  
  // Load operators from file storage
  await loadOperators();
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

// Band options and operators from file storage
const bands = ['160m', '80m', '40m', '20m', '15m', '10m', '6m', '2m'];
const operators = ref<string[]>(['K8TAR']); // Default fallback

// Function to load operators from file storage
async function loadOperators() {
  try {
    const savedOperators = await fileStorage.getOperators();
    operators.value = savedOperators.length > 0 ? savedOperators : ['K8TAR'];
  } catch (error) {
    console.error('Failed to load operators from file storage:', error);
    operators.value = ['K8TAR']; // Use default if file storage fails
  }
}

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

async function saveQsoEdit() {
  if (editingQso.value && editingQso.value.id !== undefined) {
    
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
    await updateQso(updatedQso.id as number, updatedQso);
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
    // Use type assertion to tell TypeScript that id is definitely a number
    deleteQso(deletingQso.value.id as number);
    closeDeleteModal();
  } else {
    console.error('Cannot delete QSO: Missing ID or QSO data', deletingQso.value);
  }
}

// Detailed modal state and functionality
const detailedModalOpen = ref(false);
const searchQuery = ref('');
const filterBand = ref('');
const filterMode = ref('');
const filterOperator = ref('');
const sortField = ref('datetime');
const sortDirection = ref('desc');
const currentPage = ref(1);
const itemsPerPage = 50;

// Available filter options
const availableBands = computed(() => {
  const bandSet = new Set(qsos.value.map(qso => qso.band).filter(Boolean));
  return Array.from(bandSet).sort();
});

const availableModes = computed(() => {
  const modeSet = new Set(qsos.value.map(qso => qso.mode).filter(Boolean));
  return Array.from(modeSet).sort();
});

const availableOperators = computed(() => {
  const operatorSet = new Set(qsos.value.map(qso => qso.operator).filter(Boolean));
  return Array.from(operatorSet).sort();
});

// Filtered and sorted QSOs
const filteredQsos = computed(() => {
  let filtered = [...qsos.value];
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(qso => 
      qso.call.toLowerCase().includes(query) ||
      qso.section.toLowerCase().includes(query) ||
      qso.operator.toLowerCase().includes(query) ||
      qso.class.toLowerCase().includes(query)
    );
  }
  
  // Apply band filter
  if (filterBand.value) {
    filtered = filtered.filter(qso => qso.band === filterBand.value);
  }
  
  // Apply mode filter
  if (filterMode.value) {
    filtered = filtered.filter(qso => qso.mode === filterMode.value);
  }
  
  // Apply operator filter
  if (filterOperator.value) {
    filtered = filtered.filter(qso => qso.operator === filterOperator.value);
  }
  
  // Apply sorting
  filtered.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortField.value) {
      case 'datetime':
        aVal = new Date(a.datetime).getTime();
        bVal = new Date(b.datetime).getTime();
        break;
      case 'call':
        aVal = a.call.toLowerCase();
        bVal = b.call.toLowerCase();
        break;
      case 'band':
        aVal = a.band;
        bVal = b.band;
        break;
      case 'mode':
        aVal = a.mode;
        bVal = b.mode;
        break;
      case 'section':
        aVal = a.section;
        bVal = b.section;
        break;
      case 'operator':
        aVal = a.operator;
        bVal = b.operator;
        break;
      case 'class':
        aVal = a.class;
        bVal = b.class;
        break;
      default:
        aVal = a.datetime;
        bVal = b.datetime;
    }
    
    if (aVal < bVal) return sortDirection.value === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection.value === 'asc' ? 1 : -1;
    return 0;
  });
  
  return filtered;
});

// Pagination
const totalPages = computed(() => Math.ceil(filteredQsos.value.length / itemsPerPage));

const paginatedQsos = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredQsos.value.slice(start, end);
});

// Helper function to get contact number
const getContactNumber = (qso: QSO) => {
  const originalIndex = qsos.value.findIndex(q => q.id === qso.id);
  return qsos.value.length - originalIndex;
};

// Modal functions
function openDetailedModal() {
  detailedModalOpen.value = true;
  // Reset pagination when opening
  currentPage.value = 1;
}

function closeDetailedModal() {
  detailedModalOpen.value = false;
  // Reset filters when closing
  searchQuery.value = '';
  filterBand.value = '';
  filterMode.value = '';
  filterOperator.value = '';
  currentPage.value = 1;
}

function setSortField(field: string) {
  if (sortField.value === field) {
    // Toggle sort direction if same field
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // Set new field and default to descending for datetime, ascending for others
    sortField.value = field;
    sortDirection.value = field === 'datetime' ? 'desc' : 'asc';
  }
  // Reset to first page when sorting changes
  currentPage.value = 1;
}

function toggleSortDirection() {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  currentPage.value = 1;
}

// Watch for filter changes to reset pagination
watch([searchQuery, filterBand, filterMode, filterOperator], () => {
  currentPage.value = 1;
});
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
  z-index: 1100;
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

/* Header section styles */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--primary-color);
  padding: 0.5rem 1rem;
}

.header-section h2 {
  background: none;
  padding: 0;
  margin: 0;
  font-size: 1rem;
  flex: 1;
}

.header-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-detailed {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  transition: background-color 0.2s ease;
}

.btn-detailed:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.btn-detailed .material-icons {
  font-size: 18px;
}

/* Detailed modal styles */
.modal-overlay {
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

.detailed-modal {
  width: 95%;
  max-width: 1200px;
  height: 90%;
  max-height: 90vh;
}

.detailed-modal .modal-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
}

/* Controls section */
.controls-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: var(--table-alt);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.search-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  flex: 1;
}

.search-group, .filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 150px;
}

.search-group label, .filter-group label {
  font-weight: bold;
  color: var(--text-color);
  font-size: 0.9rem;
}

.search-input, .filter-group select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.9rem;
}

.sort-controls {
  display: flex;
  align-items: end;
  gap: 0.5rem;
}

.sort-controls label {
  font-weight: bold;
  color: var(--text-color);
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.sort-controls select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.9rem;
}

.sort-direction-btn {
  background-color: var(--button-bg);
  color: var(--button-text);
  border: none;
  border-radius: 4px;
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  width: 36px;
}

.sort-direction-btn:hover {
  background-color: var(--button-hover);
}

/* Detailed table container */
.detailed-table-container {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--form-bg);
}

.detailed-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}

.detailed-table th {
  background-color: var(--table-header);
  color: var(--table-text);
  text-align: left;
  padding: 0.75rem 0.5rem;
  font-size: 0.9rem;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 2px solid var(--border-color);
}

.detailed-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.detailed-table th.sortable:hover {
  background-color: var(--table-hover);
}

.detailed-table th.active {
  background-color: var(--primary-color);
  color: white;
}

.detailed-table th .material-icons {
  font-size: 16px;
  vertical-align: middle;
  margin-left: 0.25rem;
}

.detailed-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-color);
  font-size: 0.9rem;
}

.detailed-table tbody tr:nth-child(even) {
  background-color: var(--table-alt);
}

.detailed-table tbody tr:hover {
  background-color: var(--table-hover);
}

.detailed-table .callsign {
  font-weight: bold;
  color: var(--primary-color);
}

.detailed-table .no-results {
  text-align: center;
  font-style: italic;
  color: var(--text-color-secondary);
  padding: 2rem;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 1rem 0;
}

.page-btn {
  background-color: var(--button-bg);
  color: var(--button-text);
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
}

.page-btn:hover:not(:disabled) {
  background-color: var(--button-hover);
}

.page-btn:disabled {
  background-color: var(--form-bg);
  color: var(--text-color-secondary);
  cursor: not-allowed;
}

.page-info {
  color: var(--text-color);
  font-weight: bold;
  padding: 0 1rem;
}

/* Footer stats */
.footer-stats {
  color: var(--text-color-secondary);
  font-size: 0.9rem;
  flex: 1;
}
</style>