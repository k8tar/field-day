/**
 * File-based storage service for Field Day Logger
 * Stores data in files specific to each port to avoid conflicts between instances
 */

import { ErrorHandler } from '../utils/logger';
import { backendApi } from './backendApiService';
import type { BackendQso } from '@/models/api/qso';
import type { BackendMessage } from '@/models/api/message';
import type { QSO } from '@/store/qso';
import type { Bonus } from '@/store/bonus';
import type { Message as StoreMessage } from '@/store/message';
import { debugLog } from '@/utils/debug';

interface ElectronFsApi {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
}

function getElectronFS(): ElectronFsApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const candidate = (window as Window & { electronFS?: ElectronFsApi }).electronFS;
  return candidate ?? null;
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
  qsos: import('@/store/qso').QSO[];
  lastUpdated: number;
}

export interface OperatorData {
  operators: string[];
  lastUpdated: number;
}

export interface BonusData {
  bonuses: import('@/store/bonus').Bonus[];
  lastUpdated: number;
}

export interface SettingsData {
  band?: string;
  operator?: string;
  mode?: string;
  theme?: string;
  networkSettings?: Record<string, unknown>;
  qsosUploadedToServer?: boolean;
  lastSyncTimestamp?: number;
  lastLogResetTimestamp?: string;
  lastUpdated: number;
}

function stationDesignatorFromStationId(stationId: string): string {
  if (!stationId) {
    return 'UNKN';
  }

  const segments = stationId.split('-');
  return segments.length > 1 ? segments[segments.length - 1] : stationId;
}

// Convert between backend QSO format and frontend QSO format
function backendQsoToFrontend(backendQso: BackendQso): QSO {
  return {
    id: backendQso.id,
    call: backendQso.call_sign,
    class: backendQso.class,
    section: backendQso.section,
    band: backendQso.frequency, // frequency from backend maps to band in frontend
    mode: backendQso.mode,
    datetime: backendQso.timestamp, // Already ISO string from backend
    operator: backendQso.operator,
    timestamp: new Date(backendQso.timestamp).getTime(),
    stationDesignator: stationDesignatorFromStationId(backendQso.station_id),
  };
}

function frontendQsoToBackend(frontendQso: QSO): BackendQso {
  return {
    id: frontendQso.id || `qso-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    call_sign: frontendQso.call,
    name: frontendQso.call,
    class: frontendQso.class || '',
    section: frontendQso.section || '',
    frequency: frontendQso.band || '40m', // band in frontend maps to frequency in backend
    mode: frontendQso.mode || 'PH',
    operator: frontendQso.operator || '',
    station_id: frontendQso.stationDesignator ? `UNKNOWN-${frontendQso.stationDesignator}` : '',
    timestamp: frontendQso.datetime || new Date().toISOString(),
  };
}

// Convert between backend message format and frontend message format
type FrontendMessage = StoreMessage;

function backendMessageToFrontend(backendMessage: BackendMessage): FrontendMessage {
  return {
    id: backendMessage.id,
    type: backendMessage.message_type as StoreMessage['type'],
    text: backendMessage.text,
    from: backendMessage.from_station_id,
    target: backendMessage.target_station_id,
    timestamp: new Date(backendMessage.timestamp).getTime(),
  };
}

function frontendMessageToBackend(frontendMessage: FrontendMessage): BackendMessage {
  return {
    id: frontendMessage.id,
    message_type: frontendMessage.type,
    text: frontendMessage.text,
    from_station_id: frontendMessage.from || '',
    target_station_id: frontendMessage.target,
    timestamp: new Date(frontendMessage.timestamp).toISOString(),
  };
}

class FileStorageService {
  private readonly DATA_DIR = 'fieldday-data';
  private port: number;
  private serverStorageAvailable: boolean | null = false; // default to localStorage to avoid server 404s
  
  constructor(port?: number) {
    this.port = port || this.getCurrentPort();
  }

  private getCurrentPort(): number {
    if (typeof window !== 'undefined') {
      return parseInt(window.location.port || '8080');
    }
    return 8080;
  }

  private isElectron(): boolean {
    const windowExists = typeof window !== 'undefined';
    const candidateWindow = window as Window & {
      Electron?: unknown;
      electronFS?: ElectronFsApi;
      ElectronTest?: () => unknown;
    };
    const electronFlag = windowExists && !!candidateWindow.Electron;
    const electronFS = windowExists && !!candidateWindow.electronFS;
    const electronTest = windowExists && !!candidateWindow.ElectronTest;
    
    // Test the ElectronTest function if available
    if (electronTest) {
      try {
        candidateWindow.ElectronTest?.();
      } catch (e: unknown) {
        console.error('❌ ElectronTest failed:', e);
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
    } catch (e: unknown) {
      console.warn('⚠️ Failed to sync to cross-origin storage:', e);
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
    } catch (e: unknown) {
      console.error('❌ Error reading station config:', e);
      throw e;
    }
  }

  // QSO data methods - use backend API if available
  async saveQsoData(qsos: QSO[]): Promise<void> {
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
      } catch (e: unknown) {
        debugLog(`Failed to save QSO via backend, falling back to file storage: ${String(e)}`);
        // Fallback to file storage
        await this.saveDataWithTimestamp(qsos, 'qso-data.json', 'qsos');
        return;
      }
    }
  }

  async getQsoData(): Promise<QSO[]> {
    // Try to get QSOs from backend API first
    try {
      const backendQsos = await backendApi.getQsos();
      // Convert backend QSOs to frontend format
      return backendQsos.map((bq) => backendQsoToFrontend(bq));
    } catch (e: unknown) {
      debugLog(`Failed to fetch QSOs from backend, falling back to file storage: ${String(e)}`);
      // Fallback to file storage
      return await this.getDataWithTimestamp('qso-data.json', 'qsos', 'qsos');
    }
  }

  // Add QSOs (append to existing data)
  async addQsos(newQsos: QSO[]): Promise<void> {
    // Add QSOs individually via backend API
    for (const qso of newQsos) {
      try {
        const backendQso = frontendQsoToBackend(qso);
        await backendApi.addQso(backendQso);
      } catch (e: unknown) {
        debugLog(`Failed to add QSO via backend: ${String(e)}`);
        // Fallback: add to file storage
        const existingQsos = await this.getDataWithTimestamp<QSO>('qso-data.json', 'qsos', 'qsos');
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
  async saveBonuses(bonuses: Bonus[]): Promise<void> {
    await this.saveDataWithTimestamp(bonuses, 'bonuses.json', 'bonuses');
  }

  async getBonuses(): Promise<Bonus[]> {
    return await this.getDataWithTimestamp<Bonus>('bonuses.json', 'bonuses', 'bonuses');
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
  async saveMessages(messages: FrontendMessage[]): Promise<void> {
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
      } catch (e: unknown) {
        debugLog(`Failed to save message via backend, falling back to file storage: ${String(e)}`);
        // Fallback to file storage
        await this.writeData('messages.json', JSON.stringify(messages, null, 2));
        return;
      }
    }
  }

  async getMessages(): Promise<FrontendMessage[]> {
    // Try to get messages from backend API first
    try {
      const backendMessages = await backendApi.getMessages();
      // Convert backend messages to frontend format
      return backendMessages.map(bm => backendMessageToFrontend(bm));
    } catch (e: unknown) {
      debugLog(`Failed to fetch messages from backend, falling back to file storage: ${String(e)}`);
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
    } catch (e: unknown) {
      console.error('❌ Failed to get/generate network ID:', e);
      // Fallback to a simple ID
      return `MESH-node-fallback-${Date.now().toString(36)}`;
    }
  }

  // File operations for Electron
  private async writeFileElectron(filename: string, content: string): Promise<void> {
    const electronFS = getElectronFS();
    if (!this.isElectron() || !electronFS) return;
    
    try {
      const filePath = this.getFilePath(filename);
      await electronFS.writeFile(filePath, content);
    } catch (e: unknown) {
      console.error(`❌ Failed to write file ${filename}:`, e);
      throw e;
    }
  }

  private async readFileElectron(filename: string): Promise<string | null> {
    const electronFS = getElectronFS();
    if (!this.isElectron() || !electronFS) return null;
    
    try {
      const filePath = this.getFilePath(filename);
      return await electronFS.readFile(filePath);
    } catch (e: unknown) {
      console.warn(`⚠️ Failed to read file ${filename}:`, e);
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
      } catch (_e: unknown) {
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
        if (serverData != null) {
          this.serverStorageAvailable = true;
          return serverData;
        }
      } catch (_e: unknown) {
        // Mark server storage as unavailable
        this.serverStorageAvailable = false;
      }
      
      return localStorage.getItem(this.getStorageKey(localStorageType));
    }
  }

  // Server-side file storage methods for browser environments
  private async writeFileServer(filename: string, content: string): Promise<void> {
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

      const result = await response.json() as { content?: string };
      if (result.content != null) {
        return result.content;
      } else {
        return null;
      }
    } catch (_e: unknown) {
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
      } catch (e: unknown) {
        console.warn('⚠️ Failed to migrate QSO data:', e);
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
      } catch (e: unknown) {
        console.warn('⚠️ Failed to migrate operator data:', e);
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
      } catch (e: unknown) {
        console.warn('⚠️ Failed to migrate bonus data:', e);
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
      } catch (e: unknown) {
        console.warn('⚠️ Failed to migrate settings data:', e);
      }
    }

  }

  // Set up specific configurations for testing
  async setupTestConfiguration(callsign: string, designator: string, qsoCount = 0): Promise<void> {
    
    // Save station config
    await this.saveStationConfig({ callsign, designator });
    
    // Create test QSOs if requested
    if (qsoCount > 0) {
      const testQsos: QSO[] = [];
      for (let i = 1; i <= qsoCount; i++) {
        testQsos.push({
          id: `test-qso-${i}`,
          call: `W${i.toString().padStart(3, '0')}ABC`,
          class: '1A',
          datetime: new Date(Date.now() - (qsoCount - i) * 60000).toISOString(),
          mode: i % 3 === 0 ? 'CW' : 'PH', // Mix for realistic scoring
          band: '20m',
          section: 'OH',
          operator: callsign,
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
