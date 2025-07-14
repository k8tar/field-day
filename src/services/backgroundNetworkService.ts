/**
 * Background Network Service
 * 
 * This service runs network operations in the background without blocking the browser UI.
 * It handles mesh discovery, QSO syncing, and station communication through the API server.
 */

import { fileStorage } from './fileStorage';

interface NetworkStation {
  ip: string;
  port: number;
  callsign: string;
  designator: string;
  networkId: string;
  qsoCount: number;
  lastSeen: number;
  protocol: 'HTTP' | 'HTTPS';
}

// Shared mesh connection state
class MeshConnectionState {
  private static instance: MeshConnectionState;
  private _isConnected = false;
  private listeners: Array<(connected: boolean) => void> = [];

  static getInstance(): MeshConnectionState {
    if (!MeshConnectionState.instance) {
      MeshConnectionState.instance = new MeshConnectionState();
    }
    return MeshConnectionState.instance;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  setConnected(connected: boolean): void {
    if (this._isConnected !== connected) {
      console.log(`🔄 [MeshConnectionState] State changing from ${this._isConnected} to ${connected}`);
      this._isConnected = connected;
      this.listeners.forEach(listener => listener(connected));
    }
  }

  onConnectionChange(listener: (connected: boolean) => void): void {
    this.listeners.push(listener);
  }

  removeConnectionListener(listener: (connected: boolean) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }
}

export const meshConnectionState = MeshConnectionState.getInstance();

class BackgroundNetworkService {
  private isRunning = false;
  private discoveryInterval: number | null = null;
  private syncInterval: number | null = null;
  private knownStations = new Map<string, NetworkStation>();
  private localNetworkId: string = '';

  constructor() {
    this.initializeNetworkId();
  }

  private async initializeNetworkId(): Promise<void> {
    try {
      this.localNetworkId = await fileStorage.getNetworkId();
      // Sync mesh state with backend on startup
      await this.syncMeshStateWithBackend();
    } catch (error) {
      console.error('Failed to get network ID:', error);
    }
  }

  /**
   * Synchronize frontend mesh state with backend mesh configuration
   */
  private async syncMeshStateWithBackend(): Promise<void> {
    const maxRetries = 5;
    const retryDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [BackgroundNetworkService] Syncing mesh state with backend (attempt ${attempt}/${maxRetries})...`);
        
        const response = await fetch('http://localhost:3030/api/config');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.mesh) {
            const backendMeshEnabled = result.data.mesh.enabled;
            console.log(`🔍 [BackgroundNetworkService] Backend mesh enabled: ${backendMeshEnabled}`);
            
            // Update frontend mesh state to match backend
            meshConnectionState.setConnected(backendMeshEnabled);
            console.log(`✅ [BackgroundNetworkService] Frontend mesh state synced with backend: ${backendMeshEnabled}`);
            return; // Success - exit retry loop
          }
        }
        
        // If we get here, the response wasn't ok or data was invalid
        throw new Error(`Invalid response: ${response.status}`);
        
      } catch (error) {
        console.warn(`🔄 [BackgroundNetworkService] Mesh sync attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          console.log(`⏳ [BackgroundNetworkService] Retrying mesh sync in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.warn('❌ [BackgroundNetworkService] Failed to sync mesh state after all retries - keeping current state');
        }
      }
    }
  }

  /**
   * Manually trigger mesh state sync (can be called when backend comes online)
   */
  async reSyncMeshState(): Promise<void> {
    console.log('🔄 [BackgroundNetworkService] Manual mesh state re-sync triggered');
    await this.syncMeshStateWithBackend();
  }

  /**
   * Start background networking operations
   */
  async startBackgroundOperations(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Start mesh discovery (every 60 seconds - reduced frequency)
    this.discoveryInterval = setInterval(() => {
      this.performMeshDiscovery();
    }, 60000) as unknown as number;

    // Start QSO sync (every 30 seconds - reduced frequency)
    this.syncInterval = setInterval(() => {
      this.performQsoSync();
    }, 30000) as unknown as number;

    // Do initial discovery and sync
    setTimeout(() => {
      this.performMeshDiscovery();
      this.performQsoSync();
    }, 2000);
  }

  /**
   * Stop background networking operations
   */
  stopBackgroundOperations(): void {
    this.isRunning = false;

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval as unknown as NodeJS.Timeout);
      this.discoveryInterval = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval as unknown as NodeJS.Timeout);
      this.syncInterval = null;
    }
  }

  /**
   * Perform mesh discovery in background
   * This runs server-side API calls without blocking the UI
   */
  private async performMeshDiscovery(): Promise<void> {
    try {
      // Use the backend API endpoint to get discovered stations
      const response = await fetch('http://localhost:3030/api/mesh/stations');
      if (response.ok) {
        const stations = await response.json();
        this.updateKnownStations(stations);
      }
    } catch (error) {
      // Silently handle errors to avoid UI blocking
    }
  }

  /**
   * Perform QSO sync in background
   */
  private async performQsoSync(): Promise<void> {
    try {
      // For now, just poll the backend mesh stations to keep frontend updated
      // The backend should handle station-to-station QSO sync automatically
      await fetch('http://localhost:3030/api/mesh/stations');
    } catch (error) {
      // Silently handle errors to avoid UI blocking
    }
  }

  /**
   * Update known stations list
   */
  private updateKnownStations(stations: NetworkStation[]): void {
    const now = Date.now();
    
    // Update existing stations and add new ones
    stations.forEach(station => {
      const key = `${station.ip}:${station.port}`;
      
      // Don't add ourselves
      if (station.networkId === this.localNetworkId) {
        return;
      }

      this.knownStations.set(key, {
        ...station,
        lastSeen: now
      });
    });

    // Remove stale stations (not seen for 5 minutes)
    const staleThreshold = now - (5 * 60 * 1000);
    for (const [key, station] of this.knownStations.entries()) {
      if (station.lastSeen < staleThreshold) {
        this.knownStations.delete(key);
      }
    }
  }

  /**
   * Get current known stations (for UI display)
   */
  getKnownStations(): NetworkStation[] {
    return Array.from(this.knownStations.values());
  }

  /**
   * Get network status (for UI display)
   */
  getNetworkStatus(): any {
    return {
      isRunning: this.isRunning,
      stationCount: this.knownStations.size,
      networkId: this.localNetworkId
    };
  }
}

// Export singleton instance
export const backgroundNetworkService = new BackgroundNetworkService();
