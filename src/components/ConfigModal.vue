<template>
  <div v-if="isOpen" class="config-modal">
    <div class="config-modal-content">
      <div class="config-modal-header">
        <div>
          <h2>{{ props.isFirstTime ? 'Welcome to K8TAR Field Day Logger' : 'Configuration' }}</h2>
          <p v-if="props.isFirstTime" class="first-time-message">
            Please configure your station settings to get started.
          </p>
        </div>
        <button v-if="!props.isFirstTime" class="close-button" @click="close">×</button>
      </div>
      <div class="config-modal-body">
        <!-- Configuration options will go here -->
        <div class="config-grid">
          <div class="config-section">
            <h3>Station</h3>
            <div class="config-option">
              <label for="designator">Station Designator:</label>
              <input 
                type="text" 
                id="designator" 
                v-model="stationDesignator" 
                @input="stationDesignator = ($event.target as HTMLInputElement).value.toUpperCase()"
                placeholder="PHONE 1, PHONE 2, DIGI 1, GOTA, etc."
              />
            </div>
            <div class="config-option">
              <label for="callsign">Station Callsign:</label>
              <input 
                type="text" 
                id="callsign" 
                v-model="stationCallsign" 
                @input="stationCallsign = ($event.target as HTMLInputElement).value.toUpperCase()"
              />
            </div>
            <div class="config-option">
              <label for="class">Class:</label>
              <input 
                type="text" 
                id="class" 
                v-model="stationClass" 
                @input="stationClass = ($event.target as HTMLInputElement).value.toUpperCase()"
                :class="{'validation-error': stationClass && !isStationClassValid}"
                placeholder="1A"
              />
              <div class="validation-message" v-if="stationClass && !isStationClassValid">
                Format: 1-3 digits + A-F (e.g., 1A, 2B)
              </div>
            </div>
            <div class="config-option">
              <label for="section">Section:</label>
              <input 
                id="section" 
                v-model="stationSection"
                @input="stationSection = ($event.target as HTMLInputElement).value.toUpperCase()"
                :class="{'validation-error': stationSection && !isStationSectionValid}"
                placeholder="e.g., WPA, OH, DX"
                autocomplete="off"
                required
              />
              <div class="validation-message" v-if="stationSection && !isStationSectionValid">
                Invalid ARRL section
              </div>
            </div>
          </div>
          
          <div class="config-section">
            <h3>Operators</h3>
            <div class="operators-list">
              <div v-for="(op, index) in operators" :key="index" class="operator-item">
                <input 
                  type="text" 
                  v-model="operators[index]" 
                  @input="operators[index] = ($event.target as HTMLInputElement).value.toUpperCase()" 
                />
                <button @click="removeOperator(index)">Remove</button>
              </div>
              <div class="add-operator">
                <input 
                  ref="newOperatorInput"
                  type="text" 
                  v-model="newOperator" 
                  placeholder="Add new operator" 
                  @input="newOperator = ($event.target as HTMLInputElement).value.toUpperCase()"
                  @keydown.enter="handleAddOperatorEnter"
                />
                <button @click="addOperator" :disabled="!newOperator">Add</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="config-section">
          <!-- System Data Section -->
          <h3>💾 System Data</h3>
          <div class="import-export-container">
            <p class="section-description">Backup and restore your complete station configuration and QSO data.</p>
            <div class="import-export-buttons">
              <div class="config-option">
                <button class="export-button" @click="exportJson">
                  <span class="material-icons">download</span>
                  Create System Backup
                </button>
                <small>Complete backup including QSOs, settings, and operators</small>
              </div>
              <div class="config-option">
                <div class="file-upload-container">
                  <input 
                    type="file" 
                    id="json-upload" 
                    ref="fileInput"
                    accept=".json" 
                    @change="handleFileUpload"
                    style="display: none;"
                  />
                  <button class="import-button" @click="triggerFileUpload">
                    <span class="material-icons">upload</span>
                    Restore System Backup
                  </button>
                  <small>Restore from a previous backup file</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Reporting Section -->
          <h3>📊 Contest & Logging Reports</h3>
          <div class="import-export-container">
            <p class="section-description">Export your QSO log in various formats for contest submission and logging software.</p>
            <div class="import-export-buttons">
              <div class="config-option">
                <button class="export-button" @click="exportCabrillo" :disabled="qsos.length === 0">
                  <span class="material-icons">download</span>
                  Export Cabrillo Log
                </button>
                <small>Official ARRL Field Day contest submission format</small>
              </div>
              <div class="config-option">
                <button class="export-button" @click="exportDupeSheet" :disabled="qsos.length === 0">
                  <span class="material-icons">download</span>
                  Export Duplicate Sheet
                </button>
                <small>CSV format for operator reference and duplicate checking</small>
              </div>
              <div class="config-option">
                <button class="export-button" @click="exportAdif" :disabled="qsos.length === 0">
                  <span class="material-icons">download</span>
                  Export ADIF Log
                </button>
                <small>Standard format for amateur radio logging software</small>
              </div>
            </div>
          </div>

          <!-- Import Data Section (keep existing) -->
          <h3>🔄 System Reset</h3>
          <div class="import-export-container">
            <p class="section-description">Reset or wipe station data. Use with caution!</p>
            <div class="reset-log-section">
              <div class="config-option">
                <button class="wipe-qsos-button" @click="showWipeQsosConfirmModal" :disabled="qsos.length === 0">
                  <span class="material-icons">clear_all</span>
                  Wipe QSOs
                </button>
                <small>This will permanently delete all QSOs only!</small>
              </div>
              <div class="config-option">
                <button class="reset-log-button" @click="showResetConfirmModal" :disabled="qsos.length === 0">
                  <span class="material-icons">delete_forever</span>
                  Wipe Data
                </button>
                <small>This will permanently delete all data!</small>
              </div>
            </div>
          </div>
          <div v-if="importPreview" class="import-preview">
              <h4>Import Preview:</h4>
              <div class="preview-details">
                <p><strong>Station:</strong> {{ importPreview.stationCallsign || 'Not specified' }} - {{ importPreview.stationDesignator || 'No designator' }}</p>
                <p><strong>Class:</strong> {{ importPreview.stationClass || 'Not specified' }} | <strong>Section:</strong> {{ importPreview.stationSection || 'Not specified' }}</p>
                <p><strong>Operators:</strong> {{ importPreview.operators?.join(', ') || 'None' }}</p>
                <p><strong>Contacts:</strong> {{ importPreview.qsos?.length || 0 }} QSOs</p>
                <div v-if="importPreview.qsos?.length > 0" class="preview-list">
                  <div v-for="(contact, index) in importPreview.qsos.slice(0, 5)" :key="index" class="preview-item">
                    {{ contact.call }} - {{ contact.datetime }} - {{ contact.band }} {{ contact.mode }}
                  </div>
                  <div v-if="importPreview.qsos.length > 5" class="preview-more">
                    ... and {{ importPreview.qsos.length - 5 }} more contacts
                  </div>
                </div>
              </div>
              <div class="preview-options">
                <label class="checkbox-container">
                  <input type="checkbox" v-model="replaceExistingData" />
                  <span class="checkmark"></span>
                  Replace all existing data (otherwise merge)
                </label>
              </div>
              <div class="import-actions">
                <button class="confirm-import-button" @click="confirmJsonImport">
                  <span class="material-icons">check</span>
                  Import Data
                </button>
                <button class="cancel-import-button" @click="cancelImport">
                  <span class="material-icons">close</span>
                  Cancel
                </button>
              </div>
            </div>
        </div>
      </div>
      
      <!-- Reset Log Confirmation Modal -->
      <div v-if="showResetModal" class="modal-overlay" @click="hideResetConfirmModal">
        <div class="modal-content reset-modal-content" @click.stop>
          <div class="modal-header">
            <h3>Confirm Wipe Data</h3>
            <button class="close-button" @click="hideResetConfirmModal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="reset-confirmation">
              <div class="warning-icon-large">
                <span class="material-icons">warning</span>
              </div>
              <h4>Are you sure you want to wipe all data?</h4>
              <p>This action will permanently delete:</p>
              <ul>
                <li>All {{ qsos.length }} QSO{{ qsos.length !== 1 ? 's' : '' }}</li>
                <li>Station configuration</li>
                <li>Operator list</li>
              </ul>
              <p><strong>This action cannot be undone.</strong></p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="confirm-reset-button" @click="confirmResetLog">
              <span class="material-icons">delete_forever</span>
              Yes, Wipe All Data
            </button>
            <button class="cancel-button" @click="hideResetConfirmModal">Cancel</button>
          </div>
        </div>
      </div>
      
      <!-- Wipe QSOs Confirmation Modal -->
      <div v-if="showWipeQsosModal" class="modal-overlay" @click="hideWipeQsosModal">
        <div class="modal-content reset-modal-content" @click.stop>
          <div class="modal-header">
            <h3>Confirm Wipe QSOs</h3>
            <button class="close-button" @click="hideWipeQsosModal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="reset-confirmation">
              <div class="warning-icon-large">
                <span class="material-icons">warning</span>
              </div>
              <h4>Are you sure you want to wipe all QSOs?</h4>
              <p>This action will permanently delete all {{ qsos.length }} QSO{{ qsos.length !== 1 ? 's' : '' }} in your current log!</p>
              <p>Station configuration and operators will be preserved.</p>
              <p><strong>This action cannot be undone.</strong></p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="confirm-wipe-qsos-button" @click="confirmWipeQsos">
              <span class="material-icons">clear_all</span>
              Yes, Wipe QSOs Only
            </button>
            <button class="cancel-button" @click="hideWipeQsosModal">Cancel</button>
          </div>
        </div>
      </div>
      
      <div class="config-modal-footer">
        <button class="save-button" @click="saveConfig">
          {{ props.isFirstTime ? 'Get Started' : 'Save Configuration' }}
        </button>
        <button v-if="!props.isFirstTime" class="cancel-button" @click="close">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { qsos, type QSO } from '@/store/qso';
import { validateArrlSection, normalizeArrlSection, validateArrlClass, normalizeArrlClass } from '@/constants/arrl-sections';
import { fileStorage } from '@/services/fileStorage';

const props = defineProps<{
  isOpen: boolean;
  isFirstTime?: boolean;
}>();

const emit = defineEmits(['close']);

const stationCallsign = ref('');
const stationDesignator = ref('');
const stationClass = ref('');
const stationSection = ref('');
const operators = ref<string[]>([]);
const newOperator = ref('');
const newOperatorInput = ref<HTMLInputElement | null>(null);
const showResetModal = ref(false);
const showWipeQsosModal = ref(false);

// Station section validation
const isStationSectionValid = computed(() => {
  if (!stationSection.value) return true; // Empty is valid
  return validateArrlSection(stationSection.value);
});

// Station class validation
const isStationClassValid = computed(() => {
  if (!stationClass.value) return true; // Empty is valid
  return validateArrlClass(stationClass.value);
});

// ADIF import/export functionality
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFileName = ref('');
const importPreview = ref<any>(null);
const replaceExistingData = ref(false);

// Load settings on component mount
onMounted(async () => {
  try {
    // Load station config from file storage
    const stationConfig = await fileStorage.getStationConfig();
    console.log('ConfigModal: Loaded station config:', stationConfig);
    
    stationCallsign.value = stationConfig.callsign || '';
    stationDesignator.value = stationConfig.designator || '';
    stationClass.value = stationConfig.stationClass || '';
    stationSection.value = stationConfig.stationSection || '';

    // Load operators from file storage
    const savedOperators = await fileStorage.getOperators();
    console.log('ConfigModal: Loaded operators:', savedOperators);
    operators.value = savedOperators.length > 0 ? savedOperators : [];
    
    console.log('ConfigModal: Set form values:', {
      callsign: stationCallsign.value,
      designator: stationDesignator.value,
      class: stationClass.value,
      section: stationSection.value,
      operators: operators.value
    });
  } catch (error) {
    console.error('Failed to load configuration from file storage:', error);
    // Initialize with defaults instead of localStorage fallback
    stationCallsign.value = '';
    stationDesignator.value = '';
    stationClass.value = '';
    stationSection.value = '';
    operators.value = [];
  }
});

function addOperator() {
  if (newOperator.value && !operators.value.includes(newOperator.value)) {
    operators.value.push(newOperator.value);
    newOperator.value = '';
    // Refocus the input after adding
    newOperatorInput.value?.focus();
  }
}

function handleAddOperatorEnter() {
  addOperator();
}

function removeOperator(index: number) {
  operators.value.splice(index, 1);
}

async function saveConfig() {
  // Validate section before saving
  if (stationSection.value && !validateArrlSection(stationSection.value)) {
    console.error('Invalid station section provided:', stationSection.value);
    return;
  }
  
  // Validate class before saving
  if (stationClass.value && !validateArrlClass(stationClass.value)) {
    console.error('Invalid station class provided:', stationClass.value);
    return;
  }
  
  // Normalize the section
  const normalizedSection = stationSection.value ? 
    normalizeArrlSection(stationSection.value) : '';
  
  // Normalize the class
  const normalizedClass = stationClass.value ? 
    normalizeArrlClass(stationClass.value) : '';
  
  try {
    // Save station config to file storage
    await fileStorage.saveStationConfig({
      callsign: stationCallsign.value,
      designator: stationDesignator.value,
      stationClass: normalizedClass || '',
      stationSection: normalizedSection || ''
    });

    // Save operators to file storage
    await fileStorage.saveOperators(operators.value);

  } catch (error) {
    console.error('Failed to save configuration to file storage:', error);
    throw error; // Re-throw to handle in UI
  }
  
  // Trigger custom event to update StationInfo and other components
  window.dispatchEvent(new CustomEvent('stationInfoUpdate'));
  
  close();
}

// Reset log modal functions
function showResetConfirmModal() {
  showResetModal.value = true;
}

function hideResetConfirmModal() {
  showResetModal.value = false;
}

async function confirmResetLog() {
  // Clear all data - QSOs, station config, and operators
  qsos.value = [];
  stationCallsign.value = '';
  stationDesignator.value = '';
  stationClass.value = '';
  stationSection.value = '';
  operators.value = [];
  
  try {
    // Clear file storage
    await fileStorage.saveQsoData([]);
    await fileStorage.saveStationConfig({
      callsign: '',
      designator: '',
      stationClass: '',
      stationSection: ''
    });
    await fileStorage.saveOperators([]);
    
  } catch (error) {
    console.error('Failed to clear file storage:', error);
    throw error; // Re-throw to handle in UI
  }
  
  // Hide the modal
  hideResetConfirmModal();
  
}

// Wipe QSOs modal functions
function showWipeQsosConfirmModal() {
  showWipeQsosModal.value = true;
}

function hideWipeQsosModal() {
  showWipeQsosModal.value = false;
}

async function confirmWipeQsos() {
  // Clear only the QSOs, preserve station config and operators
  qsos.value = [];
  
  try {
    // Clear QSOs in file storage
    await fileStorage.saveQsoData([]);
  } catch (error) {
    console.error('Failed to clear QSOs in file storage:', error);
    throw error; // Re-throw to handle in UI
  }
  
  // Hide the modal
  hideWipeQsosModal();
  
}

function close() {
  showResetModal.value = false; // Reset modal state when closing
  showWipeQsosModal.value = false; // Reset wipe QSOs modal state when closing
  emit('close');
}

// Watch for changes to isOpen prop to reset form data when opened
watch(() => props.isOpen, async (newValue) => {
  if (newValue) {
    try {
      // Reload settings from file storage when modal is opened
      const stationConfig = await fileStorage.getStationConfig();
      stationCallsign.value = stationConfig.callsign || '';
      stationDesignator.value = stationConfig.designator || '';
      stationClass.value = stationConfig.stationClass || '';
      stationSection.value = stationConfig.stationSection || '';

      // Load operators from file storage
      const savedOperators = await fileStorage.getOperators();
      operators.value = savedOperators;
    } catch (error) {
      console.error('Failed to reload configuration from file storage:', error);
      // Initialize with defaults instead of localStorage fallback
      stationCallsign.value = '';
      stationDesignator.value = '';
      stationClass.value = '';
      stationSection.value = '';
      operators.value = [];
    }
  }
});

// ADIF Export function
function exportAdif() {
  const adifHeader = `<ADIF_VER:5>3.1.4
<PROGRAMID:13>K8TAR-FieldDay
<CREATED_TIMESTAMP:15>${new Date().toISOString().replace(/[-:]/g, '').replace('T', ' ').substring(0, 15)}
<EOH>

`;

  let adifContent = adifHeader;
  
  qsos.value.forEach(qso => {
    const dateTime = new Date(qso.datetime);
    const qsoDate = dateTime.toISOString().substring(0, 10).replace(/-/g, '');
    const qsoTime = dateTime.toISOString().substring(11, 19).replace(/:/g, '');
    
    // Map mode from our internal format to ADIF standard
    let adifMode = qso.mode;
    if (qso.mode === 'PH') adifMode = 'SSB';
    if (qso.mode === 'DIG') adifMode = 'FT8'; // Default digital mode
    
    adifContent += `<CALL:${qso.call.length}>${qso.call}`;
    adifContent += `<QSO_DATE:8>${qsoDate}`;
    adifContent += `<TIME_ON:6>${qsoTime}`;
    adifContent += `<BAND:${qso.band.length}>${qso.band}`;
    adifContent += `<MODE:${adifMode.length}>${adifMode}`;
    adifContent += `<RST_SENT:2>59`;
    adifContent += `<RST_RCVD:2>59`;
    if (qso.class) adifContent += `<CLASS:${qso.class.length}>${qso.class}`;
    if (qso.section) adifContent += `<ARRL_SECT:${qso.section.length}>${qso.section}`;
    if (qso.operator) adifContent += `<OPERATOR:${qso.operator.length}>${qso.operator}`;
    // Use the configured station callsign instead of hardcoded K8TAR
    const configuredCallsign = stationCallsign.value || 'K8TAR';
    adifContent += `<STATION_CALLSIGN:${configuredCallsign.length}>${configuredCallsign}`;
    adifContent += `<EOR>\n`;
  });

  // Create and download the file
  const blob = new Blob([adifContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${stationCallsign.value.toString()}-fieldday-${new Date().toISOString().substring(0, 10)}.adi`;
  link.click();
  URL.revokeObjectURL(url);
}

// JSON Export function
function exportJson() {
  const exportData = {
    exportDate: new Date().toISOString(),
    stationCallsign: stationCallsign.value,
    stationDesignator: stationDesignator.value,
    stationClass: stationClass.value,
    stationSection: stationSection.value,
    operators: operators.value,
    qsos: qsos.value
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const filename = stationCallsign.value 
    ? `${stationCallsign.value}-fieldday-backup-${new Date().toISOString().substring(0, 10)}.json`
    : `k8tar-fieldday-backup-${new Date().toISOString().substring(0, 10)}.json`;
  
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Cabrillo Export function
function exportCabrillo() {
  const stationCall = stationCallsign.value || 'K8TAR';
  const stationCls = stationClass.value || '2A';
  const stationSect = stationSection.value || 'OH';
  
  let cabrilloContent = `START-OF-LOG: 3.0
CREATED-BY: K8TAR Field Day Logger
CONTEST: ARRL-FIELD-DAY
CALLSIGN: ${stationCall}
CATEGORY-OPERATOR: MULTI-OP
CATEGORY-ASSISTED: NON-ASSISTED
CATEGORY-BAND: ALL
CATEGORY-MODE: MIXED
CATEGORY-POWER: HIGH
CATEGORY-STATION: FIXED
CATEGORY-TRANSMITTER: ONE
CLAIMED-SCORE: ${calculateScore()}
CLUB: 
NAME: 
ADDRESS: 
ADDRESS-CITY: 
ADDRESS-STATE-PROVINCE: 
ADDRESS-POSTALCODE: 
ADDRESS-COUNTRY: 
EMAIL: 
LOCATION: 
ARRL-SECTION: ${stationSect}
CLASS: ${stationCls}
`;

  // Add QSO lines
  qsos.value.forEach(qso => {
    const dateTime = new Date(qso.datetime);
    const freq = getBandFrequency(qso.band);
    const mode = qso.mode === 'PH' ? 'PH' : qso.mode === 'CW' ? 'CW' : 'DG';
    const date = dateTime.toISOString().substring(0, 10);
    const time = dateTime.toISOString().substring(11, 16).replace(':', '');
    
    cabrilloContent += `QSO: ${freq} ${mode} ${date} ${time} ${stationCall} ${stationCls} ${stationSect} ${qso.call} ${qso.class} ${qso.section}\n`;
  });
  
  cabrilloContent += 'END-OF-LOG:\n';

  // Create and download the file
  const blob = new Blob([cabrilloContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${stationCall}-fieldday-${new Date().toISOString().substring(0, 10)}.log`;
  link.click();
  URL.revokeObjectURL(url);
}

// Duplicate format export function
function exportDupeSheet() {
  let dupeContent = `# K8TAR Field Day Logger - Duplicate Sheet
# Generated: ${new Date().toISOString()}
# Station: ${stationCallsign.value || 'K8TAR'}
# QSOs: ${qsos.value.length}
#
# Format: CALL,BAND,MODE,DATE,TIME,CLASS,SECTION
#
`;

  qsos.value.forEach(qso => {
    const dateTime = new Date(qso.datetime);
    const date = dateTime.toISOString().substring(0, 10);
    const time = dateTime.toISOString().substring(11, 19);
    
    dupeContent += `${qso.call},${qso.band},${qso.mode},${date},${time},${qso.class},${qso.section}\n`;
  });

  // Create and download the file
  const blob = new Blob([dupeContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${stationCallsign.value || 'K8TAR'}-fieldday-dupes-${new Date().toISOString().substring(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Helper function to get frequency for band (for Cabrillo)
function getBandFrequency(band: string): string {
  const frequencies: { [key: string]: string } = {
    '160m': '1800',
    '80m': '3500',
    '40m': '7000',
    '20m': '14000',
    '15m': '21000',
    '10m': '28000',
    '6m': '50000',
    '2m': '144000'
  };
  return frequencies[band] || '14000';
}

// Helper function to calculate score
function calculateScore(): number {
  return qsos.value.reduce((sum: number, qso: any) => {
    return sum + ((qso.mode === 'CW' || qso.mode === 'DIG') ? 2 : 1);
  }, 0);
}

// JSON Import functions
function triggerFileUpload() {
  fileInput.value?.click();
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (file) {
    selectedFileName.value = file.name;
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseJsonFile(content);
    };
    
    reader.readAsText(file);
  }
}

function parseJsonFile(content: string) {
  try {
    const data = JSON.parse(content);
    
    // Validate the structure
    if (typeof data === 'object' && data !== null) {
      importPreview.value = {
        stationCallsign: data.stationCallsign || '',
        stationDesignator: data.stationDesignator || '',
        stationClass: data.stationClass || '',
        stationSection: data.stationSection || '',
        operators: Array.isArray(data.operators) ? data.operators : [],
        qsos: Array.isArray(data.qsos) ? data.qsos : [],
        exportDate: data.exportDate || 'Unknown'
      };
    } else {
      alert('Invalid JSON file format');
      cancelImport();
    }
  } catch (error) {
    alert('Error parsing JSON file: ' + error);
    cancelImport();
  }
}

async function confirmJsonImport() {
  if (!importPreview.value) return;
  
  if (replaceExistingData.value) {
    // Replace all data
    stationCallsign.value = importPreview.value.stationCallsign || '';
    stationDesignator.value = importPreview.value.stationDesignator || '';
    stationClass.value = importPreview.value.stationClass || '';
    stationSection.value = importPreview.value.stationSection || '';
    operators.value = importPreview.value.operators || [];
    qsos.value = importPreview.value.qsos || [];
  } else {
    // Merge data
    if (importPreview.value.stationCallsign && !stationCallsign.value) {
      stationCallsign.value = importPreview.value.stationCallsign;
    }
    if (importPreview.value.stationDesignator && !stationDesignator.value) {
      stationDesignator.value = importPreview.value.stationDesignator;
    }
    if (importPreview.value.stationClass && !stationClass.value) {
      stationClass.value = importPreview.value.stationClass;
    }
    if (importPreview.value.stationSection && !stationSection.value) {
      stationSection.value = importPreview.value.stationSection;
    }
    
    // Merge operators (avoid duplicates)
    if (Array.isArray(importPreview.value.operators)) {
      importPreview.value.operators.forEach((op: string) => {
        if (!operators.value.includes(op)) {
          operators.value.push(op);
        }
      });
    }
    
    // Merge QSOs with new IDs
    if (Array.isArray(importPreview.value.qsos)) {
      const lastId = qsos.value.length > 0 ? 
        Math.max(...qsos.value.map(q => q.id || 0)) : 0;
      
      importPreview.value.qsos.forEach((contact: any, index: number) => {
        qsos.value.push({
          ...contact,
          id: lastId + index + 1
        });
      });
    }
  }
  
  // Normalize data before saving
  const normalizedSection = stationSection.value ? 
    normalizeArrlSection(stationSection.value) : '';
  const normalizedClass = stationClass.value ? 
    normalizeArrlClass(stationClass.value) : '';
  
  try {
    // Save all data to file storage
    await fileStorage.saveStationConfig({
      callsign: stationCallsign.value,
      designator: stationDesignator.value,
      stationClass: normalizedClass || '',
      stationSection: normalizedSection || ''
    });
    await fileStorage.saveOperators(operators.value);
    await fileStorage.saveQsoData(qsos.value);

  } catch (error) {
    console.error('Failed to save imported data to file storage:', error);
    throw error; // Re-throw to handle in UI
  }
  
  // Reset import state
  cancelImport();
}

function cancelImport() {
  importPreview.value = null;
  selectedFileName.value = '';
  replaceExistingData.value = false;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';

.config-modal {
  // Uses global modal-fullscreen styles
  @extend .modal;
  @extend .modal-fullscreen;
}

.config-modal-content {
  background-color: var(--modal-content);
  color: var(--text-color);
  width: 100%;
  height: 100%;
  min-height: 100vh;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  animation: modal-appear 0.3s ease-out;
}

.config-modal-header {
  @extend .modal-header;
  
  h2 {
    font-size: 1.5rem;
  }
}

.first-time-message {
  margin: 0.5rem 0 0 0;
  color: var(--text-secondary, #666);
  font-size: 0.9rem;
  font-style: italic;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.8rem;
  cursor: pointer;
  color: var(--text-color);
}

.config-modal-body {
  @extend .modal-body;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.config-section {
  // Uses global config-section styles
  @extend .config-section;
}

.config-option {
  // Uses global config-option styles  
  @extend .config-option;
}

.operators-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.operator-item {
  display: flex;
  gap: 0.5rem;
}

.add-operator {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* Danger Zone styling */
.danger-zone {
  border: 1px solid #e74c3c;
  border-radius: 8px;
  padding: 1rem;
  background-color: rgba(231, 76, 60, 0.1);

  h3 {
    color: #e74c3c;
    border-bottom-color: #e74c3c;
  }
}

/* Custom checkbox styling */
.checkbox-container {
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 35px;
  cursor: pointer;
  font-size: 1rem;
  user-select: none;
  min-width: auto !important;

  input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  &:hover input ~ .checkmark {
    background-color: var(--table-hover);
  }

  input:checked ~ .checkmark {
    background-color: #e74c3c;
    border-color: #e74c3c;
  }

  input:checked ~ .checkmark:after {
    display: block;
  }

  .checkmark:after {
    left: 7px;
    top: 3px;
    width: 5px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
}

.checkmark {
  position: absolute;
  top: 0;
  left: 0;
  height: 20px;
  width: 20px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 3px;

  &:after {
    content: "";
    position: absolute;
    display: none;
  }
}

.warning-text {
  margin: 0.5rem 0 0 0;
  color: #e74c3c;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: bold;
  animation: pulse 2s infinite;
}

.warning-icon {
  color: #e74c3c;
  font-size: 1.2rem;
}

.config-modal-footer {
  @extend .modal-footer;
}

.save-button, .cancel-button {
  @extend .btn;
}

.save-button {
  @extend .btn-accent;
}

.cancel-button {
  @extend .btn-secondary;
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

/* Section Description Styles */
.section-description {
  margin: 0.5rem 0 1rem 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.4;
}

.config-option small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.8rem;
  line-height: 1.3;
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

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* Import/Export Styles */
.import-export-container {
  margin-bottom: 2rem;
}

.import-export-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.export-button,
.import-button,
.confirm-import-button,
.cancel-import-button {
  @extend .btn;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
}

.export-button {
  @extend .btn-accent;

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
}

.import-button {
  background-color: var(--primary-color, #2196f3);
  color: white;
}

.file-upload-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.selected-file {
  color: var(--accent-color, #4caf50);
  font-style: italic;
  font-size: 0.9rem;
}

.import-preview {
  @extend .info-box;
  margin-top: 1rem;
}

.import-preview h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
}

.preview-options {
  margin-bottom: 1rem;
}

.preview-list {
  max-height: 150px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.preview-item {
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border-color);
  @extend .monospace;
  font-size: 0.9rem;
}

.preview-more {
  @extend .text-muted;
  font-style: italic;
  padding: 0.5rem 0;
}

.import-actions {
  @extend .flex;
  @extend .gap-small;
  @extend .flex-end;
}

.confirm-import-button {
  @extend .btn-accent;
}

.cancel-import-button {
  background-color: var(--error-color, #f44336);
  color: white;
}

.preview-details {
  @extend .card;
  margin-bottom: 1rem;

  p {
    margin: 0.5rem 0;
    color: var(--text-color);
  }

  strong {
    color: var(--text-color);
    font-weight: 600;
  }
}

/* Reset Log Section */
.reset-log-section {
  flex: 0 0 280px; /* Increased width for two buttons */
  margin-left: auto; /* Push to the right */
  padding: 1rem;
  border: 2px solid #e74c3c;
  border-radius: 8px;
  background-color: rgba(231, 76, 60, 0.1);
  
  h4 {
    margin: 0 0 1rem 0;
    color: #e74c3c;
    font-size: 1rem;
    text-align: center;
  }
}

.reset-log-button {
  @extend .btn;
  background-color: #e74c3c;
  color: white;
  border-color: #e74c3c;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  &:hover:not(:disabled) {
    background-color: #c0392b;
    border-color: #c0392b;
  }
  
  &:disabled {
    background-color: #cccccc;
    border-color: #cccccc;
    cursor: not-allowed;
  }
}

.wipe-qsos-button {
  @extend .btn;
  background-color: #ff9800;
  color: white;
  border-color: #ff9800;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  
  &:hover:not(:disabled) {
    background-color: #f57c00;
    border-color: #f57c00;
  }
  
  &:disabled {
    background-color: #cccccc;
    border-color: #cccccc;
    cursor: not-allowed;
  }
}

.confirm-wipe-qsos-button {
  background-color: #ff9800 !important;
  color: white !important;
  border: 2px solid #ff9800 !important;
  padding: 0.5rem 1rem !important;
  border-radius: 8px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
  transition: all 0.2s ease !important;
  
  &:hover {
    background-color: #f57c00 !important;
    border-color: #f57c00 !important;
    transform: translateY(-1px) !important;
  }
  
  .material-icons {
    font-size: 1rem !important;
  }
}

.reset-warning {
  margin: 0.5rem 0 0 0;
  font-size: 0.8rem;
  color: #e74c3c;
  text-align: center;
  font-style: italic;
}

/* Reset Confirmation Modal */
.reset-modal-content {
  background-color: var(--modal-content);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  width: 500px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
  animation: modal-appear 0.3s ease-out;
  position: relative;
  z-index: 2001;
}

.modal-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    margin: 0;
    color: var(--text-color);
  }
}

.modal-body {
  padding: 1rem;
  color: var(--text-color);
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  background-color: var(--modal-content);
}

/* Modal Overlay - needs higher z-index than config modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; /* Higher than config modal */
  backdrop-filter: blur(3px);
}

.warning-icon-large {
  .material-icons {
    font-size: 4rem;
    color: #e74c3c;
  }
}

.confirm-reset-button {
  background-color: #e74c3c !important;
  color: white !important;
  border: 2px solid #e74c3c !important;
  padding: 0.5rem 1rem !important;
  border-radius: 8px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
  transition: all 0.2s ease !important;
  
  &:hover {
    background-color: #c0392b !important;
    border-color: #c0392b !important;
    transform: translateY(-1px) !important;
  }
  
  .material-icons {
    font-size: 1rem !important;
  }
}

/* Cancel button in reset modal */
.reset-modal-content .cancel-button {
  background-color: var(--form-bg) !important;
  color: var(--text-color) !important;
  border: 2px solid var(--border-color) !important;
  padding: 0.5rem 1rem !important;
  border-radius: 8px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  
  &:hover {
    background-color: var(--hover-color) !important;
    transform: translateY(-1px) !important;
  }
}

/* Responsive layout for smaller screens */
@media (max-width: 768px) {
  .import-export-container {
    flex-direction: column;
  }
  
  .reset-log-section {
    flex: none;
    width: 100%;
  }
}
</style>