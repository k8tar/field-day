/**
 * Node.js Station Info Service
 * 
 * This service is specifically for Node.js environments like Vite config.
 * It uses Node.js modules that are not available in browsers.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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

export class NodeStationInfoService {
  private readonly instanceTag = 'node-station-info-service';

  private constructor() {
    void this.instanceTag;
  }

  /**
   * Get station info for Node.js environments (like Vite config)
   */
  static async getStationInfo(port: number, dataDir: string, qsoData: import('@/store/qso').QSO[] = []): Promise<StationInfoResponse> {
    try {
      // Read station config
      let stationConfig = { callsign: 'K8TAR', designator: '1A' };
      try {
        const configPath = join(dataDir, 'station-config.json');
        if (existsSync(configPath)) {
          const configData = readFileSync(configPath, 'utf8');
          stationConfig = JSON.parse(configData);
        }
      } catch (e: unknown) {
        console.warn(`⚠️ NodeStationInfoService: Failed to read station config for port ${port}:`, e);
      }

      // Get or generate network ID
      let networkId = `MESH-node-${port}-${Date.now().toString(36)}`;
      try {
        const networkIdPath = join(dataDir, 'network-id.txt');
        if (existsSync(networkIdPath)) {
          networkId = readFileSync(networkIdPath, 'utf8').trim();
        } else {
          // Generate and save new network ID
          const timestamp = Date.now().toString(36);
          const random = Math.random().toString(36).substr(2, 5);
          networkId = `MESH-node-${timestamp}-${random}`;
          
          // Ensure directory exists
          if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
          }
          
          writeFileSync(networkIdPath, networkId);
        }
      } catch (e: unknown) {
        console.warn(`⚠️ NodeStationInfoService: Failed to get network ID for port ${port}:`, e);
      }

      // Calculate score
      const score = Array.isArray(qsoData) ? qsoData.reduce((sum: number, qso: import('@/store/qso').QSO) => {
        const mode = qso?.mode || '';
        return sum + ((mode === 'CW' || mode === 'DIG' || mode === 'DIGITAL') ? 2 : 1);
      }, 0) : 0;

      const stationInfo: StationInfoResponse = {
        callsign: stationConfig.callsign,
        designator: stationConfig.designator,
        networkId: networkId,
        qsoCount: qsoData.length,
        score: score,
        software: 'K8TAR Field Day Logger',
        version: '2.0.0',
        timestamp: Date.now(),
        online: true,
        port: port
      };

      return stationInfo;
    } catch (e: unknown) {
      console.error(`❌ NodeStationInfoService: Error getting station info for port ${port}:`, e);
      
      return {
        callsign: 'ERROR',
        designator: '1A',
        networkId: `MESH-error-${port}-${Date.now()}`,
        qsoCount: 0,
        score: 0,
        software: 'K8TAR Field Day Logger',
        version: '2.0.0',
        timestamp: Date.now(),
        online: false,
        port: port
      };
    }
  }
}
