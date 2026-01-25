/**
 * File-based storage service for Field Day Logger
 * Stores data in files specific to each port to avoid conflicts between instances
 */

import { logger, ErrorHandler } from '../utils/logger';
import { backendApi, type BackendQso, type BackendMessage } from './backendApiService';
import { debugLog } from '@/utils/debug';

// Import path utilities - handle both browser and Electron environments
const isElectron = typeof window !== 'undefined' && (window as any).Electron;

// Get Electron file system API if available
const electronFS = isElectron ? (window as any).electronFS : null;

// Fallback path join for browser environment
function pathJoin(...segments: string[]): string {
  // Simple path join implementation for browser/Electron renderer
  return segments.filter(s => s).join('/').replace(/\/+/g, '/');
}

// Fallback file existence check for browser environment
function fileExists(filePath: string): boolean {
  // In browser, we'll assume files don't exist and rely on localStorage fallback
  // Electron file operations are handled via IPC in the file operations below
  return false;
}

// Async file read using Electron IPC or fallback
async function readFileAsync(filePath: string): Promise<string> {
  if (electronFS && electronFS.readFile) {
    try {
      const data = await electronFS.readFile(filePath);
      return data || '';
    } catch (error) {
      console.warn('Failed to read file via Electron IPC:', error);
      throw new Error('File system not available or file not found');
    }
  }
  throw new Error('File system not available in browser environment');
}

// Async file write using Electron IPC or fallback
async function writeFileAsync(filePath: string, data: string): Promise<void> {
  if (electronFS && electronFS.writeFile) {
    try {
      await electronFS.writeFile(filePath, data);
      return;
    } catch (error) {
      console.warn('Failed to write file via Electron IPC:', error);
      throw new Error('File system write failed');
    }
  }
  throw new Error('File system not available in browser environment');
}

// Legacy sync functions (deprecated in Electron renderer)
function readFileSync(filePath: string): string {
  throw new Error('Synchronous file operations not supported in Electron renderer - use async operations');
}

function writeFileSync(filePath: string, data: string): void {
  throw new Error('Synchronous file operations not supported in Electron renderer - use async operations');
}

function mkdirSync(dirPath: string, options?: any): void {
  // Directory creation is handled by the main process in our IPC handlers
  debugLog('Directory creation handled by main process via IPC');
}

export interface StationConfig {
  callsign: string;
  designator: string;
  port: number;
  lastUpdated: number;
  stationClass?: string;
  stationSection?: string;
  networkId?: string; // Fixed network ID for this station instance
}

export interface QsoData {
  qsos: any[];
  lastUpdated: number;
}

export interface OperatorData {
  operators: string[];
  lastUpdated: number;
}

export interface BonusData {
  bonuses: any[];
  lastUpdated: number;
}

export interface SettingsData {
  band?: string;
  operator?: string;
  mode?: string;
  theme?: string;
  networkSettings?: any;
  qsosUploadedToServer?: boolean;
  lastSyncTimestamp?: number;
  lastLogResetTimestamp?: string;
  lastUpdated: number;
}

// Convert between backend QSO format and frontend QSO format
async function backendQsoToFrontend(backendQso: BackendQso): Promise<any> {
  // Get current station config to include in QSO
  const stationConfig = new FileStorageService().getStationConfig().catch(() => ({ designator: 'UNKN' }));
  const station = await stationConfig;
  
  return {
    id: backendQso.id,
    call: backendQso.call_sign,
    name: backendQso.name,
    class: backendQso.class,
    section: backendQso.section,
    band: backendQso.frequency, // frequency from backend maps to band in frontend
    mode: backendQso.mode,
    datetime: backendQso.timestamp, // Already ISO string from backend
    operator: backendQso.operator,
    power: backendQso.power,
    station_id: backendQso.station_id,
    notes: backendQso.notes,
    timestamp: new Date(backendQso.timestamp).getTime(),
    stationDesignator: station.designator || 'UNKN',
  };
}

function frontendQsoToBackend(frontendQso: any): BackendQso {
  return {
    id: frontendQso.id || `qso-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    call_sign: frontendQso.call,
    name: frontendQso.name || '',
    class: frontendQso.class || '',
    section: frontendQso.section || '',
    frequency: frontendQso.band || '40m', // band in frontend maps to frequency in backend
    mode: frontendQso.mode || 'PH',
    operator: frontendQso.operator || '',
    station_id: frontendQso.station_id || '',
    power: frontendQso.power,
    notes: frontendQso.notes,
    timestamp: frontendQso.datetime || new Date().toISOString(),
  };
}

// Convert between backend message format and frontend message format
function backendMessageToFrontend(backendMessage: BackendMessage): any {
  return {
    id: backendMessage.id,
    message_type: backendMessage.message_type,
    text: backendMessage.text,
    from_station_id: backendMessage.from_station_id,
    target_station_id: backendMessage.target_station_id,
    timestamp: new Date(backendMessage.timestamp).getTime(),
  };
}

function frontendMessageToBackend(frontendMessage: any): BackendMessage {
  return {
    id: frontendMessage.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    message_type: frontendMessage.message_type || 'chat',
    text: frontendMessage.text || '',
    from_station_id: frontendMessage.from_station_id || '',
    target_station_id: frontendMessage.target_station_id,
    timestamp: new Date(frontendMessage.timestamp || Date.now()).toISOString(),
  };
}

class FileStorageService {
  private readonly DATA_DIR = 'fieldday-data';
  private port: number;
  private serverStorageAvailable: boolean | null = false; // default to localStorage to avoid server 404s
  
  constructor(port?: number) {
    this.port = port || this.getCurrentPort();
    this.ensureDataDirectory();
  }

  private getCurrentPort(): number {
    if (typeof window !== 'undefined') {
      return parseInt(window.location.port || '8080');
    }
    return 8080;
  }

  private ensureDataDirectory(): void {
    // Server-side directory creation is handled by the API endpoints
    if (!this.isElectron()) {
    }
  }

  private isElectron(): boolean {
    const windowExists = typeof window !== 'undefined';
    const electronFlag = windowExists && !!(window as any).Electron;
    const electronFS = windowExists && !!(window as any).electronFS;
    const electronTest = windowExists && !!(window as any).ElectronTest;
    
    // Test the ElectronTest function if available
    if (electronTest) {
      try {
        const result = (window as any).ElectronTest();
      } catch (error) {
        console.error('❌ ElectronTest failed:', error);
      }
    }
    
    // Return true if we have both the flag and the FS API
    return electronFlag && electronFS;
  }

  private getStorageKey(type: string): string {
    // For cross-origin compatibility, use a port-agnostic key for shared data
    // This ensures localhost:8080 and 127.0.0.1:8080 share the same data
    return `fieldday_shared_${this.port}_${type}`;
  }

  // Helper method to get a machine-specific storage key for truly local data
  private getMachineStorageKey(type: string): string {
    return `fieldday_machine_${this.port}_${type}`;
  }

  private getFilePath(filename: string): string {
    return `${this.DATA_DIR}/port_${this.port}/${filename}`;
  }

  // Station configuration methods
  async saveStationConfig(config: Partial<StationConfig>): Promise<void> {
    const currentConfig = await this.getStationConfig();
    const updatedConfig: StationConfig = {
      ...currentConfig,
      ...config,
      port: this.port,
      lastUpdated: Date.now()
    };

    await this.writeData('station-config.json', JSON.stringify(updatedConfig, null, 2));
    
    // Sync to cross-origin storage for immediate availability
    this.syncToCrossOriginStorage(updatedConfig);
  }

  // Helper method to sync station config to cross-origin storage
  private syncToCrossOriginStorage(config: StationConfig): void {
    try {
      import('./crossOriginStorage').then(({ CrossOriginStorage }) => {
        if (config.callsign) CrossOriginStorage.setItem('stationCallsign', config.callsign);
        if (config.designator) CrossOriginStorage.setItem('stationDesignator', config.designator);
        if (config.stationClass) CrossOriginStorage.setItem('stationClass', config.stationClass);
        if (config.stationSection) CrossOriginStorage.setItem('stationSection', config.stationSection);
      });
    } catch (error) {
      console.warn('⚠️ Failed to sync to cross-origin storage:', error);
    }
  }

  // Generic data handler for arrays with timestamp
  private async saveDataWithTimestamp<T>(
    data: T[],
    filename: string,
    dataKey: string
  ): Promise<void> {
    const wrappedData = {
      [dataKey]: data,
      lastUpdated: Date.now()
    };
    await this.writeData(filename, JSON.stringify(wrappedData, null, 2));
  }

  private async getDataWithTimestamp<T>(
    filename: string,
    localStorageType: string,
    dataKey: string,
    defaultValue: T[] = []
  ): Promise<T[]> {
    return await ErrorHandler.handleAsync(async () => {
      const dataStr = await this.readData(filename, localStorageType);
      if (dataStr) {
        const wrappedData = JSON.parse(dataStr);
        return wrappedData[dataKey] || defaultValue;
      }
      return defaultValue;
    }, `load ${dataKey} for port ${this.port}`, defaultValue) || defaultValue;
  }

  async getStationConfig(): Promise<StationConfig> {
    try {
      const configData = await this.readData('station-config.json', 'station-config');
      
      if (configData) {
        const config = JSON.parse(configData);
        
        // Ensure all required fields exist
        return {
          callsign: config.callsign || '',
          designator: config.designator || '',
          stationClass: config.stationClass || '',
          stationSection: config.stationSection || '',
          port: config.port || this.getCurrentPort(),
          lastUpdated: config.lastUpdated || Date.now()
        };
      }
      
      // No data found, return default config
      return {
        callsign: '',
        designator: '',
        stationClass: '',
        stationSection: '',
        port: this.getCurrentPort(),
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('❌ Error reading station config:', error);
      throw error;
    }
  }

  // QSO data methods - use backend API if available
  async saveQsoData(qsos: any[]): Promise<void> {
    // QSOs are managed by the backend; save individually via API
    for (const qso of qsos) {
      try {
        // Convert frontend QSO to backend format before saving
        const backendQso = frontendQsoToBackend(qso);
        // Use backendApi to add/update QSOs
        const hasId = qso.id && qso.id.length > 0;
        if (hasId) {
          await backendApi.updateQso(backendQso);
        } else {
          await backendApi.addQso(backendQso);
        }
      } catch (error) {
        debugLog(`Failed to save QSO via backend, falling back to file storage: ${error}`);
        // Fallback to file storage
        await this.saveDataWithTimestamp(qsos, 'qso-data.json', 'qsos');
        return;
      }
    }
  }

  async getQsoData(): Promise<any[]> {
    // Try to get QSOs from backend API first
    try {
      const backendQsos = await backendApi.getQsos();
      // Convert backend QSOs to frontend format
      return await Promise.all(backendQsos.map(bq => backendQsoToFrontend(bq)));
    } catch (error) {
      debugLog(`Failed to fetch QSOs from backend, falling back to file storage: ${error}`);
      // Fallback to file storage
      return await this.getDataWithTimestamp('qso-data.json', 'qsos', 'qsos');
    }
  }

  // Add QSOs (append to existing data)
  async addQsos(newQsos: any[]): Promise<void> {
    // Add QSOs individually via backend API
    for (const qso of newQsos) {
      try {
        const backendQso = frontendQsoToBackend(qso);
        await backendApi.addQso(backendQso);
      } catch (error) {
        debugLog(`Failed to add QSO via backend: ${error}`);
        // Fallback: add to file storage
        const existingQsos = await this.getDataWithTimestamp('qso-data.json', 'qsos', 'qsos');
        const allQsos = [...existingQsos, qso];
        await this.saveDataWithTimestamp(allQsos, 'qso-data.json', 'qsos');
      }
    }
  }

  // Operator data methods
  async saveOperators(operators: string[]): Promise<void> {
    await this.saveDataWithTimestamp(operators, 'operators.json', 'operators');
  }

  async getOperators(): Promise<string[]> {
    return await this.getDataWithTimestamp<string>('operators.json', 'operators', 'operators');
  }

  // Bonus data methods
  async saveBonuses(bonuses: any[]): Promise<void> {
    await this.saveDataWithTimestamp(bonuses, 'bonuses.json', 'bonuses');
  }

  async getBonuses(): Promise<any[]> {
    return await this.getDataWithTimestamp('bonuses.json', 'bonuses', 'bonuses');
  }

  // Settings data methods
  async saveSettings(settings: Partial<SettingsData>): Promise<void> {
    const currentSettings = await this.getSettings();
    const updatedSettings: SettingsData = {
      ...currentSettings,
      ...settings,
      lastUpdated: Date.now()
    };

    await this.writeData('settings.json', JSON.stringify(updatedSettings, null, 2));
  }

  async getSettings(): Promise<SettingsData> {
    const defaultSettings: SettingsData = {
      band: '40m',
      operator: '',
      mode: 'PH',
      lastUpdated: Date.now()
    };

    return await ErrorHandler.handleAsync(async () => {
      const settingsDataStr = await this.readData('settings.json', 'settings');
      if (settingsDataStr) {
        const settingsData: SettingsData = JSON.parse(settingsDataStr);
        return { ...defaultSettings, ...settingsData };
      }
      return defaultSettings;
    }, `load settings for port ${this.port}`, defaultSettings) || defaultSettings;
  }

  // Message methods - use backend API if available
  async saveMessages(messages: any[]): Promise<void> {
    // Messages are managed by the backend; save individually via API
    for (const message of messages) {
      try {
        // Convert frontend message to backend format before saving
        const backendMessage = frontendMessageToBackend(message);
        // Check if message exists and needs update
        if (message.id) {
          await backendApi.updateMessage(backendMessage);
        } else {
          await backendApi.addMessage(backendMessage);
        }
      } catch (error) {
        debugLog(`Failed to save message via backend, falling back to file storage: ${error}`);
        // Fallback to file storage
        await this.writeData('messages.json', JSON.stringify(messages, null, 2));
        return;
      }
    }
  }

  async getMessages(): Promise<any[]> {
    // Try to get messages from backend API first
    try {
      const backendMessages = await backendApi.getMessages();
      // Convert backend messages to frontend format
      return backendMessages.map(bm => backendMessageToFrontend(bm));
    } catch (error) {
      debugLog(`Failed to fetch messages from backend, falling back to file storage: ${error}`);
      // Fallback to file storage
      return await this.getDataWithTimestamp('messages.json', 'messages', 'messages', []);
    }
  }

  // Get or generate a persistent network ID for this station
  async getNetworkId(): Promise<string> {
    try {
      const config = await this.getStationConfig();
      
      // If we already have a network ID, return it
      if (config.networkId) {
        return config.networkId;
      }
      
      // Generate a new unique network ID in the format MESH-node-xxxxx-xxxxx
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 5);
      const networkId = `MESH-node-${timestamp}-${random}`;
      
      // Save it to the station config
      await this.saveStationConfig({ networkId });
      
      return networkId;
    } catch (error) {
      console.error('❌ Failed to get/generate network ID:', error);
      // Fallback to a simple ID
      return `MESH-node-fallback-${Date.now().toString(36)}`;
    }
  }

  // File operations for Electron
  private async writeFileElectron(filename: string, content: string): Promise<void> {
    if (!this.isElectron()) return;
    
    try {
      const filePath = this.getFilePath(filename);
      await (window as any).electronFS.writeFile(filePath, content);
    } catch (error) {
      console.error(`❌ Failed to write file ${filename}:`, error);
      throw error;
    }
  }

  private async readFileElectron(filename: string): Promise<string | null> {
    if (!this.isElectron()) return null;
    
    try {
      const filePath = this.getFilePath(filename);
      return await (window as any).electronFS.readFile(filePath);
    } catch (error) {
      console.warn(`⚠️ Failed to read file ${filename}:`, error);
      return null;
    }
  }

  // Universal storage methods that handle cross-origin data sharing
  private async writeData(filename: string, content: string): Promise<void> {
    if (this.isElectron()) {
      await this.writeFileElectron(filename, content);
    } else {
      // Skip server attempt if we already know it's not available
      if (this.serverStorageAvailable === false) {
        const storageKey = this.getStorageKey(filename.replace('.json', ''));
        localStorage.setItem(storageKey, content);
        return;
      }
      
      try {
        await this.writeFileServer(filename, content);
        this.serverStorageAvailable = true;
      } catch (error) {
        // Mark server storage as unavailable and use localStorage
        this.serverStorageAvailable = false;
        const storageKey = this.getStorageKey(filename.replace('.json', ''));
        localStorage.setItem(storageKey, content);
      }
    }
  }

  private async readData(filename: string, localStorageType: string): Promise<string | null> {
    if (this.isElectron()) {
      return await this.readFileElectron(filename);
    } else {
      // Skip server attempt if we already know it's not available
      if (this.serverStorageAvailable === false) {
        return localStorage.getItem(this.getStorageKey(localStorageType));
      }
      
      try {
        const serverData = await this.readFileServer(filename);
        if (serverData !== null) {
          this.serverStorageAvailable = true;
          return serverData;
        }
      } catch (error) {
        // Mark server storage as unavailable
        this.serverStorageAvailable = false;
      }
      
      return localStorage.getItem(this.getStorageKey(localStorageType));
    }
  }

  // Server-side file storage methods for browser environments
  private async writeFileServer(filename: string, content: string): Promise<void> {
    try {
      const baseUrl = backendApi.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/files/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: filename, // Use just the filename, not the full path
          content: content
        })
      });

      if (!response.ok) {
        // Server endpoint not implemented, will fall back to localStorage
        throw new Error(`Server storage not available (HTTP ${response.status})`);
      }

    } catch (error) {
      // This is expected when the backend doesn't have file endpoints
      throw error;
    }
  }

  private async readFileServer(filename: string): Promise<string | null> {
    try {
      const baseUrl = backendApi.getBaseUrl();
      const response = await fetch(`${baseUrl}/api/files/read?filename=${encodeURIComponent(filename)}`);
      
      if (response.status === 404) {
        return null; // File doesn't exist
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Server returned HTML or other non-JSON (endpoint doesn't exist)
        return null;
      }

      const result = await response.json();
      if (result.content !== undefined) {
        return result.content;
      } else {
        return null;
      }
    } catch (error) {
      // Silently fall back to localStorage when server storage isn't available
      return null;
    }
  }

  // Utility methods
  async getStorageInfo(): Promise<{ port: number; configExists: boolean; qsoCount: number }> {
    const config = await this.getStationConfig();
    const qsos = await this.getQsoData();
    
    return {
      port: this.port,
      configExists: config.callsign !== 'K8TAR' || config.designator !== '1A',
      qsoCount: qsos.length
    };
  }

  // Migration method to move from localStorage to file storage
  async migrateFromLocalStorage(): Promise<void> {
    
    // Migrate station config
    const oldCallsign = localStorage.getItem('stationCallsign');
    const oldDesignator = localStorage.getItem('stationDesignator');
    const oldClass = localStorage.getItem('stationClass');
    const oldSection = localStorage.getItem('stationSection');
    
    if (oldCallsign || oldDesignator || oldClass || oldSection) {
      await this.saveStationConfig({
        callsign: oldCallsign || 'K8TAR',
        designator: oldDesignator || '1A',
        stationClass: oldClass || '',
        stationSection: oldSection || ''
      });
    }

    // Migrate QSO data
    const oldQsos = localStorage.getItem('qsos');
    if (oldQsos) {
      try {
        const qsos = JSON.parse(oldQsos);
        if (Array.isArray(qsos) && qsos.length > 0) {
          await this.saveQsoData(qsos);
        }
      } catch (error) {
        console.warn('⚠️ Failed to migrate QSO data:', error);
      }
    }

    // Migrate operator data
    const oldOperators = localStorage.getItem('operators');
    if (oldOperators) {
      try {
        const operators = JSON.parse(oldOperators);
        if (Array.isArray(operators) && operators.length > 0) {
          await this.saveOperators(operators);
        }
      } catch (error) {
        console.warn('⚠️ Failed to migrate operator data:', error);
      }
    }

    // Migrate bonus data
    const oldBonuses = localStorage.getItem('bonuses');
    if (oldBonuses) {
      try {
        const bonuses = JSON.parse(oldBonuses);
        if (Array.isArray(bonuses) && bonuses.length > 0) {
          await this.saveBonuses(bonuses);
        }
      } catch (error) {
        console.warn('⚠️ Failed to migrate bonus data:', error);
      }
    }

    // Migrate settings data (band, operator, mode)
    const oldBand = localStorage.getItem('qso_band');
    const oldOperator = localStorage.getItem('qso_operator');
    const oldMode = localStorage.getItem('qso_mode');
    const oldNetworkSettings = localStorage.getItem('networkSettings');
    
    if (oldBand || oldOperator || oldMode || oldNetworkSettings) {
      try {
        const settings: Partial<SettingsData> = {};
        if (oldBand) settings.band = oldBand;
        if (oldOperator) settings.operator = oldOperator;
        if (oldMode) settings.mode = oldMode;
        if (oldNetworkSettings) settings.networkSettings = JSON.parse(oldNetworkSettings);
        
        await this.saveSettings(settings);
      } catch (error) {
        console.warn('⚠️ Failed to migrate settings data:', error);
      }
    }

  }

  // Set up specific configurations for testing
  async setupTestConfiguration(callsign: string, designator: string, qsoCount = 0): Promise<void> {
    
    // Save station config
    await this.saveStationConfig({ callsign, designator });
    
    // Create test QSOs if requested
    if (qsoCount > 0) {
      const testQsos = [];
      for (let i = 1; i <= qsoCount; i++) {
        testQsos.push({
          id: `test-qso-${i}`,
          call: `W${i.toString().padStart(3, '0')}ABC`,
          mode: i % 3 === 0 ? 'CW' : 'PH', // Mix for realistic scoring
          band: '20M',
          rst_sent: '59',
          rst_rcvd: '59',
          section: 'OH',
          stationCallsign: callsign,
          stationDesignator: designator,
          timestamp: Date.now() - (qsoCount - i) * 60000 // Spread over time
        });
      }
      
      await this.saveQsoData(testQsos);
    }
  }


}

// Create a singleton instance for the current port
export const fileStorage = new FileStorageService();

// Export the class for creating port-specific instances
export { FileStorageService };
