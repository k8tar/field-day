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
  static async getStationInfo(includePort: boolean = false): Promise<StationInfoResponse> {
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
        networkId: networkId,
        qsoCount: qsos.length,
        score: score,
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
    } catch (error) {
      console.error('❌ StationInfoService: Error getting station info:', error);
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
    } catch (error) {
      console.warn('⚠️ StationInfoService: Failed to get station config, using fallback:', error);
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
    } catch (error) {
      console.warn('⚠️ StationInfoService: Failed to get network ID, generating fallback:', error);
      
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
  private static async getQsoData(): Promise<any[]> {
    try {
      const qsos = await fileStorage.getQsoData();
      return Array.isArray(qsos) ? qsos : [];
    } catch (error) {
      console.warn('⚠️ StationInfoService: Failed to get QSO data:', error);
      return [];
    }
  }

  /**
   * Calculate total score from QSOs
   */
  private static calculateScore(qsos: any[]): number {
    try {
      if (!Array.isArray(qsos)) {
        return 0;
      }

      return qsos.reduce((total: number, qso: any) => {
        if (!qso || typeof qso !== 'object') {
          return total;
        }

        // Calculate points based on mode (CW/Digital = 2 points, Phone = 1 point)
        const mode = qso.mode || qso.MODE || '';
        const points = (mode === 'CW' || mode === 'DIG' || mode === 'DIGITAL') ? 2 : 1;
        return total + points;
      }, 0);
    } catch (error) {
      console.warn('⚠️ StationInfoService: Error calculating score:', error);
      return 0;
    }
  }

  /**
   * Fallback station info for error cases
   */
  private static getFallbackStationInfo(includePort: boolean = false): StationInfoResponse {
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
  static validateStationInfo(stationInfo: any): boolean {
    const requiredFields = ['callsign', 'designator', 'networkId', 'software', 'qsoCount', 'score', 'timestamp', 'online'];
    
    for (const field of requiredFields) {
      if (stationInfo[field] === undefined || stationInfo[field] === null) {
        console.error(`❌ StationInfoService: Missing required field: ${field}`);
        return false;
      }
    }
    
    return true;
  }
}

// Export for global debugging
if (typeof window !== 'undefined') {
  (window as any).StationInfoService = StationInfoService;
}
