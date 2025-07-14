/**
 * File-based storage service for Field Day Logger
 * Stores data in files specific to each port to avoid conflicts between instances
 */

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
  console.log('Directory creation handled by main process via IPC');
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

class FileStorageService {
  private readonly DATA_DIR = 'fieldday-data';
  private port: number;
  
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
    return `fieldday_${this.port}_${type}`;
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

    if (this.isElectron()) {
      // Use Electron file system
      await this.writeFileElectron('station-config.json', JSON.stringify(updatedConfig, null, 2));
    } else {
      // Browser environment - use localStorage
      const configKey = `fieldday_station_config_${this.port}`;
      localStorage.setItem(configKey, JSON.stringify(updatedConfig, null, 2));
    }
  }

  async getStationConfig(): Promise<StationConfig> {
    try {
      // Check if we're in an Electron environment
      if (this.isElectron()) {
        try {
          const configData = await this.readFileElectron('station-config.json');
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
        } catch (error) {
          console.warn('Failed to read station config:', error);
        }
        
        // File doesn't exist or read failed, return default config
        return {
          callsign: '',
          designator: '',
          stationClass: '',
          stationSection: '',
          port: this.getCurrentPort(),
          lastUpdated: Date.now()
        };
      } else {
        // Browser environment - use localStorage fallback
        const configKey = `fieldday_station_config_${this.port}`;
        const storedConfig = localStorage.getItem(configKey);
        
        if (!storedConfig) {
          return {
            callsign: '',
            designator: '',
            stationClass: '',
            stationSection: '',
            port: this.getCurrentPort(),
            lastUpdated: Date.now()
          };
        }

        const config = JSON.parse(storedConfig);
        
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
    } catch (error) {
      console.error('❌ Error reading station config:', error);
      throw error;
    }
  }

  // QSO data methods
  async saveQsoData(qsos: any[]): Promise<void> {
    const qsoData: QsoData = {
      qsos,
      lastUpdated: Date.now()
    };

    if (this.isElectron()) {
      await this.writeFileElectron('qso-data.json', JSON.stringify(qsoData, null, 2));
    } else {
      // Browser environment - use localStorage
      const qsoKey = `fieldday_qsos_${this.port}`;
      localStorage.setItem(qsoKey, JSON.stringify(qsoData, null, 2));
    }
  }

  async getQsoData(): Promise<any[]> {
    try {
      if (this.isElectron()) {
        const qsoDataStr = await this.readFileElectron('qso-data.json');
        if (qsoDataStr) {
          const qsoData: QsoData = JSON.parse(qsoDataStr);
          return qsoData.qsos;
        }
      } else {
        // Browser environment - use localStorage
        const qsoKey = `fieldday_qsos_${this.port}`;
        const qsoDataStr = localStorage.getItem(qsoKey);
        if (qsoDataStr) {
          const qsoData: QsoData = JSON.parse(qsoDataStr);
          return qsoData.qsos;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load QSOs for port ${this.port}:`, error);
    }

    return [];
  }

  // Add QSOs (append to existing data)
  async addQsos(newQsos: any[]): Promise<void> {
    const existingQsos = await this.getQsoData();
    const allQsos = [...existingQsos, ...newQsos];
    await this.saveQsoData(allQsos);
  }

  // Operator data methods
  async saveOperators(operators: string[]): Promise<void> {
    const operatorData: OperatorData = {
      operators,
      lastUpdated: Date.now()
    };

    if (this.isElectron()) {
      await this.writeFileElectron('operators.json', JSON.stringify(operatorData, null, 2));
    } else {
      // Browser environment - use localStorage
      const operatorsKey = `fieldday_operators_${this.port}`;
      localStorage.setItem(operatorsKey, JSON.stringify(operatorData, null, 2));
    }
  }

  async getOperators(): Promise<string[]> {
    try {
      if (this.isElectron()) {
        const operatorDataStr = await this.readFileElectron('operators.json');
        if (operatorDataStr) {
          const operatorData: OperatorData = JSON.parse(operatorDataStr);
          return operatorData.operators;
        }
      } else {
        // Browser environment - use localStorage
        const operatorsKey = `fieldday_operators_${this.port}`;
        const operatorDataStr = localStorage.getItem(operatorsKey);
        if (operatorDataStr) {
          const operatorData: OperatorData = JSON.parse(operatorDataStr);
          return operatorData.operators;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load operators for port ${this.port}:`, error);
    }

    return [];
  }

  // Bonus data methods
  async saveBonuses(bonuses: any[]): Promise<void> {
    const bonusData: BonusData = {
      bonuses,
      lastUpdated: Date.now()
    };

    if (this.isElectron()) {
      await this.writeFileElectron('bonuses.json', JSON.stringify(bonusData, null, 2));
    } else {
      // Browser environment - use localStorage
      const bonusKey = `fieldday_bonuses_${this.port}`;
      localStorage.setItem(bonusKey, JSON.stringify(bonusData, null, 2));
    }
  }

  async getBonuses(): Promise<any[]> {
    try {
      if (this.isElectron()) {
        const bonusDataStr = await this.readFileElectron('bonuses.json');
        if (bonusDataStr) {
          const bonusData: BonusData = JSON.parse(bonusDataStr);
          return bonusData.bonuses;
        }
      } else {
        // Browser environment - use localStorage
        const bonusKey = `fieldday_bonuses_${this.port}`;
        const bonusDataStr = localStorage.getItem(bonusKey);
        if (bonusDataStr) {
          const bonusData: BonusData = JSON.parse(bonusDataStr);
          return bonusData.bonuses;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load bonuses for port ${this.port}:`, error);
    }

    return [];
  }

  // Settings data methods
  async saveSettings(settings: Partial<SettingsData>): Promise<void> {
    const currentSettings = await this.getSettings();
    const updatedSettings: SettingsData = {
      ...currentSettings,
      ...settings,
      lastUpdated: Date.now()
    };

    if (this.isElectron()) {
      await this.writeFileElectron('settings.json', JSON.stringify(updatedSettings, null, 2));
    } else {
      // Browser environment - use localStorage
      const settingsKey = `fieldday_settings_${this.port}`;
      localStorage.setItem(settingsKey, JSON.stringify(updatedSettings, null, 2));
    }
  }

  async getSettings(): Promise<SettingsData> {
    const defaultSettings: SettingsData = {
      band: '40m',
      operator: '',
      mode: 'PH',
      lastUpdated: Date.now()
    };

    try {
      if (this.isElectron()) {
        const settingsDataStr = await this.readFileElectron('settings.json');
        if (settingsDataStr) {
          const settingsData: SettingsData = JSON.parse(settingsDataStr);
          return { ...defaultSettings, ...settingsData };
        }
      } else {
        // Browser environment - use localStorage
        const settingsKey = `fieldday_settings_${this.port}`;
        const settingsDataStr = localStorage.getItem(settingsKey);
        if (settingsDataStr) {
          const settingsData: SettingsData = JSON.parse(settingsDataStr);
          return { ...defaultSettings, ...settingsData };
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load settings for port ${this.port}:`, error);
    }

    return defaultSettings;
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

  // Server-side file storage methods for browser environments
  private async writeFileServer(filename: string, content: string): Promise<void> {
    try {
      const response = await fetch('/api/files/write', {
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
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

    } catch (error) {
      console.error(`❌ Failed to write file to server: ${filename}`, error);
      throw error;
    }
  }

  private async readFileServer(filename: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/files/read?filename=${encodeURIComponent(filename)}`);
      
      if (response.status === 404) {
        return null; // File doesn't exist
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.content !== undefined) {
        return result.content;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`❌ Failed to read file from server: ${filename}`, error);
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

  // Message methods
  async saveMessages(messages: any[]): Promise<void> {
    if (this.isElectron()) {
      await this.writeFileElectron('messages.json', JSON.stringify(messages, null, 2));
    } else {
      // Browser environment - use localStorage
      const storageKey = this.getStorageKey('messages');
      localStorage.setItem(storageKey, JSON.stringify(messages, null, 2));
    }
  }

  async getMessages(): Promise<any[]> {
    try {
      if (this.isElectron()) {
        const messagesDataStr = await this.readFileElectron('messages.json');
        if (messagesDataStr) {
          return JSON.parse(messagesDataStr);
        }
      } else {
        // Browser environment - use localStorage
        const storageKey = this.getStorageKey('messages');
        const messagesDataStr = localStorage.getItem(storageKey);
        if (messagesDataStr) {
          return JSON.parse(messagesDataStr);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load messages for port ${this.port}:`, error);
    }

    return [];
  }
}

// Create a singleton instance for the current port
export const fileStorage = new FileStorageService();

// Export the class for creating port-specific instances
export { FileStorageService };
