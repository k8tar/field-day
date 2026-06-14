/**
 * Cross-origin storage utility for Field Day Logger
 * Provides consistent data access across localhost, 127.0.0.1, and other origins
 */

import { ErrorHandler } from '../utils/logger';

// Cross-origin compatible storage keys
const CROSS_ORIGIN_KEYS = {
  stationCallsign: 'fieldday_shared_station_callsign',
  stationDesignator: 'fieldday_shared_station_designator', 
  stationClass: 'fieldday_shared_station_class',
  stationSection: 'fieldday_shared_station_section',
  pendingDeletions: 'fieldday_shared_pending_deletions',
  dismissedMessages: 'fieldday_shared_dismissed_messages'
} as const;

export class CrossOriginStorage {
  /**
   * Get a value that should be consistent across all origins accessing the same port
   */
  static getItem(key: keyof typeof CROSS_ORIGIN_KEYS): string | null {
    return ErrorHandler.getLocalStorageItem(CROSS_ORIGIN_KEYS[key], `cross-origin ${key}`);
  }

  /**
   * Set a value that should be consistent across all origins accessing the same port
   */
  static setItem(key: keyof typeof CROSS_ORIGIN_KEYS, value: string): void {
    ErrorHandler.setLocalStorageItem(CROSS_ORIGIN_KEYS[key], value, `cross-origin ${key}`);
  }

  /**
   * Remove a value
   */
  static removeItem(key: keyof typeof CROSS_ORIGIN_KEYS): void {
    ErrorHandler.handleSync(
      () => localStorage.removeItem(CROSS_ORIGIN_KEYS[key]),
      `remove cross-origin ${key}`
    );
  }

  /**
   * Helper for JSON data storage/retrieval
   */
  static getJSON<T>(key: keyof typeof CROSS_ORIGIN_KEYS): T | null {
    const value = this.getItem(key);
    return ErrorHandler.parseJSON<T>(value, `cross-origin ${key}`) || null;
  }

  static setJSON(key: keyof typeof CROSS_ORIGIN_KEYS, value: unknown): void {
    ErrorHandler.handleSync(
      () => this.setItem(key, JSON.stringify(value)),
      `set cross-origin JSON ${key}`
    );
  }

  /**
   * Sync station config from file storage to cross-origin localStorage
   */
  static async syncStationConfig(): Promise<void> {
    await ErrorHandler.handleAsync(async () => {
      const { fileStorage } = await import('./fileStorage');
      const config = await fileStorage.getStationConfig();
      
      if (config.callsign) this.setItem('stationCallsign', config.callsign);
      if (config.designator) this.setItem('stationDesignator', config.designator);
      if (config.stationClass) this.setItem('stationClass', config.stationClass);
      if (config.stationSection) this.setItem('stationSection', config.stationSection);
    }, 'sync station config to cross-origin storage');
  }

  /**
   * Migrate legacy localStorage keys to cross-origin format
   */
  static migrateLegacyKeys(): void {
    ErrorHandler.handleSync(() => {
      const migrations = [
        ['stationCallsign', 'stationCallsign'],
        ['stationDesignator', 'stationDesignator'],
        ['stationClass', 'stationClass'],
        ['stationSection', 'stationSection'],
        ['qso_pending_deletions', 'pendingDeletions'],
        ['dismissedMessages', 'dismissedMessages']
      ] as const;

      migrations.forEach(([oldKey, newKey]) => {
        const oldValue = localStorage.getItem(oldKey);
        if (oldValue && !this.getItem(newKey)) {
          this.setItem(newKey, oldValue);
        }
      });
    }, 'migrate legacy localStorage keys');
  }
}

// Auto-migrate on import
CrossOriginStorage.migrateLegacyKeys();
