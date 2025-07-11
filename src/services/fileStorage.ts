/**
 * File-based storage service for Field Day Logger
 * Stores data in files specific to each port to avoid conflicts between instances
 */

export interface StationConfig {
  callsign: string;
  designator: string;
  port: number;
  lastUpdated: number;
  stationClass?: string;
  stationSection?: string;
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
      console.log(`📁 Using server-side file storage for port ${this.port}`);
    }
  }

  private isElectron(): boolean {
    const windowExists = typeof window !== 'undefined';
    const electronFlag = windowExists && !!(window as any).Electron;
    const electronFS = windowExists && !!(window as any).electronFS;
    const electronTest = windowExists && !!(window as any).ElectronTest;
    
    console.log('🔍 Electron detection debug:', {
      windowExists,
      electronFlag,
      electronFS,
      electronTest,
      userAgent: windowExists ? navigator.userAgent : 'N/A'
    });
    
    // Test the ElectronTest function if available
    if (electronTest) {
      try {
        const result = (window as any).ElectronTest();
        console.log('✅ ElectronTest executed successfully:', result);
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
      // Use server-side file storage for browser
      await this.writeFileServer('station-config.json', JSON.stringify(updatedConfig, null, 2));
    }

    console.log(`💾 Saved station config for port ${this.port}:`, updatedConfig);
  }

  async getStationConfig(): Promise<StationConfig> {
    const defaultConfig: StationConfig = {
      callsign: 'K8TAR',
      designator: 'PHONE 1',
      port: this.port,
      lastUpdated: Date.now(),
      stationClass: '',
      stationSection: ''
    };

    try {
      let configData: string | null = null;

      if (this.isElectron()) {
        configData = await this.readFileElectron('station-config.json');
      } else {
        configData = await this.readFileServer('station-config.json');
      }

      if (configData) {
        const config = JSON.parse(configData);
        console.log(`📋 Loaded station config for port ${this.port}:`, config);
        return { ...defaultConfig, ...config };
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load station config for port ${this.port}:`, error);
    }

    console.log(`📝 Using default station config for port ${this.port}:`, defaultConfig);
    return defaultConfig;
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
      await this.writeFileServer('qso-data.json', JSON.stringify(qsoData, null, 2));
    }

    console.log(`💾 Saved ${qsos.length} QSOs for port ${this.port}`);
  }

  async getQsoData(): Promise<any[]> {
    try {
      let qsoDataStr: string | null = null;

      if (this.isElectron()) {
        qsoDataStr = await this.readFileElectron('qso-data.json');
      } else {
        qsoDataStr = await this.readFileServer('qso-data.json');
      }

      if (qsoDataStr) {
        const qsoData: QsoData = JSON.parse(qsoDataStr);
        console.log(`📚 Loaded ${qsoData.qsos.length} QSOs for port ${this.port}`);
        return qsoData.qsos;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load QSOs for port ${this.port}:`, error);
    }

    console.log(`📝 No QSO data found for port ${this.port}, returning empty array`);
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
      await this.writeFileServer('operators.json', JSON.stringify(operatorData, null, 2));
    }

    console.log(`💾 Saved ${operators.length} operators for port ${this.port}`);
  }

  async getOperators(): Promise<string[]> {
    try {
      let operatorDataStr: string | null = null;

      if (this.isElectron()) {
        operatorDataStr = await this.readFileElectron('operators.json');
      } else {
        operatorDataStr = await this.readFileServer('operators.json');
      }

      if (operatorDataStr) {
        const operatorData: OperatorData = JSON.parse(operatorDataStr);
        console.log(`📚 Loaded ${operatorData.operators.length} operators for port ${this.port}`);
        return operatorData.operators;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load operators for port ${this.port}:`, error);
    }

    console.log(`📝 No operator data found for port ${this.port}, returning empty array`);
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
      await this.writeFileServer('bonuses.json', JSON.stringify(bonusData, null, 2));
    }

    console.log(`💾 Saved ${bonuses.length} bonuses for port ${this.port}`);
  }

  async getBonuses(): Promise<any[]> {
    try {
      let bonusDataStr: string | null = null;

      if (this.isElectron()) {
        bonusDataStr = await this.readFileElectron('bonuses.json');
      } else {
        bonusDataStr = await this.readFileServer('bonuses.json');
      }

      if (bonusDataStr) {
        const bonusData: BonusData = JSON.parse(bonusDataStr);
        console.log(`📚 Loaded ${bonusData.bonuses.length} bonuses for port ${this.port}`);
        return bonusData.bonuses;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load bonuses for port ${this.port}:`, error);
    }

    console.log(`📝 No bonus data found for port ${this.port}, returning empty array`);
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
      await this.writeFileServer('settings.json', JSON.stringify(updatedSettings, null, 2));
    }

    console.log(`💾 Saved settings for port ${this.port}:`, updatedSettings);
  }

  async getSettings(): Promise<SettingsData> {
    const defaultSettings: SettingsData = {
      band: '40m',
      operator: '',
      mode: 'PH',
      lastUpdated: Date.now()
    };

    try {
      let settingsDataStr: string | null = null;

      if (this.isElectron()) {
        settingsDataStr = await this.readFileElectron('settings.json');
      } else {
        settingsDataStr = await this.readFileServer('settings.json');
      }

      if (settingsDataStr) {
        const settingsData: SettingsData = JSON.parse(settingsDataStr);
        console.log(`📚 Loaded settings for port ${this.port}:`, settingsData);
        return { ...defaultSettings, ...settingsData };
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load settings for port ${this.port}:`, error);
    }

    console.log(`📝 Using default settings for port ${this.port}:`, defaultSettings);
    return defaultSettings;
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

      console.log(`📁 Wrote file to server: ${filename}`);
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
        console.log(`📂 Read file from server: ${filename}`);
        return result.content;
      } else {
        console.log(`📂 File not found on server: ${filename}`);
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
    console.log(`🔄 Migrating data from localStorage to file storage for port ${this.port}...`);
    
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
      console.log(`✅ Migrated station config: ${oldCallsign}-${oldDesignator} (${oldClass}/${oldSection})`);
    }

    // Migrate QSO data
    const oldQsos = localStorage.getItem('qsos');
    if (oldQsos) {
      try {
        const qsos = JSON.parse(oldQsos);
        if (Array.isArray(qsos) && qsos.length > 0) {
          await this.saveQsoData(qsos);
          console.log(`✅ Migrated ${qsos.length} QSOs`);
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
          console.log(`✅ Migrated ${operators.length} operators`);
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
          console.log(`✅ Migrated ${bonuses.length} bonuses`);
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
        console.log(`✅ Migrated settings data`);
      } catch (error) {
        console.warn('⚠️ Failed to migrate settings data:', error);
      }
    }

    console.log('✅ Migration complete');
  }

  // Set up specific configurations for testing
  async setupTestConfiguration(callsign: string, designator: string, qsoCount = 0): Promise<void> {
    console.log(`🧪 Setting up test configuration for port ${this.port}: ${callsign}-${designator}`);
    
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
      console.log(`✅ Created ${qsoCount} test QSOs`);
    }
  }
}

// Create a singleton instance for the current port
export const fileStorage = new FileStorageService();

// Export the class for creating port-specific instances
export { FileStorageService };
