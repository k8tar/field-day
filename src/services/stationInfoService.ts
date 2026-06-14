/**
 * Centralized Station Info Service
 * 
 * This service provides a consistent station info response format
 * that can be used by all API endpoints, fetch interceptors, and middleware.
 */

import { fileStorage } from './fileStorage';

export interface StationInfoResponse {
  callsign: string;
  designator: string;
  networkId: string;
  qsoCount: number;
  score: number;
  software: string;
  version: string;
  timestamp: number;
  online: boolean;
  port?: number;
}

export class StationInfoService {
  private static networkIdCache: string | null = null;
  private static readonly SOFTWARE_NAME = 'K8TAR Field Day Logger';
  private static readonly VERSION = '2.0.0';

  /**
   * Get complete station information
   */
  static async getStationInfo(includePort = false): Promise<StationInfoResponse> {
    try {
      
      // Get station configuration
      const stationConfig = await this.getStationConfig();
      
      // Get network ID (with caching for performance)
      const networkId = await this.getNetworkId();
      
      // Get QSO data
      const qsos = await this.getQsoData();
      
      // Calculate score
      const score = this.calculateScore(qsos);
      
      const stationInfo: StationInfoResponse = {
        callsign: stationConfig.callsign,
        designator: stationConfig.designator,
        networkId,
        qsoCount: qsos.length,
        score,
        software: this.SOFTWARE_NAME,
        version: this.VERSION,
        timestamp: Date.now(),
        online: true
      };

      // Optionally include port for debugging
      if (includePort && typeof window !== 'undefined') {
        stationInfo.port = parseInt(window.location.port) || 8080;
      }

      
      return stationInfo;
    } catch (e: unknown) {
      console.error('❌ StationInfoService: Error getting station info:', e);
      return this.getFallbackStationInfo(includePort);
    }
  }

  /**
   * Get station configuration with fallback
   */
  private static async getStationConfig(): Promise<{ callsign: string; designator: string }> {
    try {
      const config = await fileStorage.getStationConfig();
      return {
        callsign: config.callsign || 'K8TAR',
        designator: config.designator || '1A'
      };
    } catch (e: unknown) {
      console.warn('⚠️ StationInfoService: Failed to get station config, using fallback:', e);
      return {
        callsign: 'K8TAR',
        designator: '1A'
      };
    }
  }

  /**
   * Get or generate network ID with caching
   */
  private static async getNetworkId(): Promise<string> {
    try {
      // Return cached value if available
      if (this.networkIdCache) {
        return this.networkIdCache;
      }

      // Get from file storage
      this.networkIdCache = await fileStorage.getNetworkId();
      return this.networkIdCache;
    } catch (e: unknown) {
      console.warn('⚠️ StationInfoService: Failed to get network ID, generating fallback:', e);
      
      // Generate fallback ID
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 5);
      this.networkIdCache = `MESH-fallback-${timestamp}-${random}`;
      
      return this.networkIdCache;
    }
  }

  /**
   * Get QSO data with error handling
   */
  private static async getQsoData(): Promise<import('@/store/qso').QSO[]> {
    try {
      const qsos = await fileStorage.getQsoData();
      return Array.isArray(qsos) ? qsos as import('@/store/qso').QSO[] : [];
    } catch (e: unknown) {
      console.warn('⚠️ StationInfoService: Failed to get QSO data:', e);
      return [];
    }
  }

  /**
   * Calculate total score from QSOs
   */
  private static calculateScore(qsos: import('@/store/qso').QSO[]): number {
    try {
      if (!Array.isArray(qsos)) {
        return 0;
      }

      return qsos.reduce((total: number, qso: import('@/store/qso').QSO) => {
        if (!qso || typeof qso !== 'object') {
          return total;
        }

        // Calculate points based on mode (CW/Digital = 2 points, Phone = 1 point)
        const mode = qso.mode || '';
        const points = (mode === 'CW' || mode === 'DIG' || mode === 'DIGITAL') ? 2 : 1;
        return total + points;
      }, 0);
    } catch (e: unknown) {
      console.warn('⚠️ StationInfoService: Error calculating score:', e);
      return 0;
    }
  }

  /**
   * Fallback station info for error cases
   */
  private static getFallbackStationInfo(includePort = false): StationInfoResponse {
    const fallbackInfo: StationInfoResponse = {
      callsign: 'UNKNOWN',
      designator: '1A',
      networkId: `MESH-error-${Date.now()}`,
      qsoCount: 0,
      score: 0,
      software: this.SOFTWARE_NAME,
      version: this.VERSION,
      timestamp: Date.now(),
      online: true
    };

    if (includePort && typeof window !== 'undefined') {
      fallbackInfo.port = parseInt(window.location.port) || 8080;
    }

    return fallbackInfo;
  }

  /**
   * Clear network ID cache (useful for testing)
   */
  static clearCache(): void {
    this.networkIdCache = null;
  }

  /**
   * Validate station info response has all required fields
   */
  static validateStationInfo(stationInfo: unknown): boolean {
    const requiredFields = ['callsign', 'designator', 'networkId', 'software', 'qsoCount', 'score', 'timestamp', 'online'];
    if (typeof stationInfo !== 'object' || stationInfo === null) {
      return false;
    }
    const info = stationInfo as Record<string, unknown>;
    
    for (const field of requiredFields) {
      if (info[field] === undefined || info[field] === null) {
        console.error(`❌ StationInfoService: Missing required field: ${field}`);
        return false;
      }
    }
    
    return true;
  }
}

// Export for global debugging
if (typeof window !== 'undefined') {
  const debugWindow = window as Window & { StationInfoService?: typeof StationInfoService };
  debugWindow.StationInfoService = StationInfoService;
}
