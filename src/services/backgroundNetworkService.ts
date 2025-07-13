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
  private discoveryInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private knownStations = new Map<string, NetworkStation>();
  private localNetworkId: string = '';

  constructor() {
    this.initializeNetworkId();
  }

  private async initializeNetworkId(): Promise<void> {
    try {
      this.localNetworkId = await fileStorage.getNetworkId();
    } catch (error) {
      console.error('Failed to get network ID:', error);
    }
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
    }, 60000);

    // Start QSO sync (every 30 seconds - reduced frequency)
    this.syncInterval = setInterval(() => {
      this.performQsoSync();
    }, 30000);

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
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
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
