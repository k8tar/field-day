import { debugLog } from '@/utils/debug';

export interface StationStatus {
  id: string;
  callSign: string;
  ipAddress: string;
  port: number;
  lastSeen: number; // Unix timestamp
  firstSeen: number; // Unix timestamp
  requestCount: number; // Number of discovery requests since last seen
  isOnline: boolean;
  status: 'online' | 'warning' | 'offline'; // green, yellow, red
}

class StationStatusService {
  private readonly STORAGE_KEY = 'fieldday-station-status';
  private readonly DISCOVERED_KEY = 'fieldday-discovered-stations';
  private readonly MAX_WARNING_REQUESTS = 2; // Yellow after 2 missed requests (10 seconds)
  private readonly MAX_OFFLINE_REQUESTS = 4; // Red after 4 missed requests (20 seconds)

  /**
   * Get count of total unique stations discovered this session
   */
  getTotalDiscoveredCount(): number {
    try {
      const stored = localStorage.getItem(this.DISCOVERED_KEY);
      debugLog(`🔍 [StationStatusService] Getting discovered count, stored data:`, stored);
      if (!stored) return 0;
      
      const discoveredIds = JSON.parse(stored) as string[];
      debugLog(`📊 [StationStatusService] Total discovered stations: ${discoveredIds.length}`, discoveredIds);
      return discoveredIds.length;
    } catch (e: unknown) {
      console.error('Failed to load discovered stations count:', e);
      return 0;
    }
  }

  /**
   * Add a station to the discovered list if not already there
   */
  private addToDiscovered(stationId: string): void {
    try {
      const stored = localStorage.getItem(this.DISCOVERED_KEY);
      const discoveredIds: string[] = stored ? JSON.parse(stored) : [];
      
      if (!discoveredIds.includes(stationId)) {
        discoveredIds.push(stationId);
        localStorage.setItem(this.DISCOVERED_KEY, JSON.stringify(discoveredIds));
        debugLog(`✅ [StationStatusService] Added new station to discovered list: ${stationId}`, discoveredIds);
      } else {
        debugLog(`🔄 [StationStatusService] Station already in discovered list: ${stationId}`);
      }
    } catch (e: unknown) {
      console.error('Failed to update discovered stations:', e);
    }
  }

  /**
   * Clear the discovered stations count (for testing/reset)
   */
  clearDiscoveredCount(): void {
    try {
      localStorage.removeItem(this.DISCOVERED_KEY);
    } catch (e: unknown) {
      console.error('Failed to clear discovered stations:', e);
    }
  }

  /**
   * Get all stored station statuses
   */
  getStationStatuses(): Map<string, StationStatus> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return new Map();
      
      const data = JSON.parse(stored);
      return new Map(Object.entries(data));
    } catch (e: unknown) {
      console.error('Failed to load station statuses:', e);
      return new Map();
    }
  }

  /**
   * Save station statuses to localStorage
   */
  private saveStationStatuses(statuses: Map<string, StationStatus>): void {
    try {
      const data = Object.fromEntries(statuses);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e: unknown) {
      console.error('Failed to save station statuses:', e);
    }
  }

  /**
   * Update station status when seen in discovery
   */
  updateStationSeen(station: {
    id: string;
    call_sign: string;
    ip_address: string;
    port: number;
  }): void {
    debugLog(`🔍 [StationStatusService] Updating station seen:`, station);
    const statuses = this.getStationStatuses();
    const now = Date.now();
    
    // Add to discovered list
    this.addToDiscovered(station.id);
    
    let stationStatus = statuses.get(station.id);
    let statusChanged = false;
    
    if (stationStatus) {
      // Check if status changed from offline/warning to online
      const wasOffline = stationStatus.status !== 'online';
      
      // Update existing station
      stationStatus.lastSeen = now;
      stationStatus.requestCount = 0; // Reset request count since we've seen it
      stationStatus.isOnline = true;
      stationStatus.status = 'online';
      
      // Update call sign and address if changed
      stationStatus.callSign = station.call_sign;
      stationStatus.ipAddress = station.ip_address;
      stationStatus.port = station.port;
      
      statusChanged = wasOffline;
    } else {
      // New station
      stationStatus = {
        id: station.id,
        callSign: station.call_sign,
        ipAddress: station.ip_address,
        port: station.port,
        lastSeen: now,
        firstSeen: now,
        requestCount: 0,
        isOnline: true,
        status: 'online'
      };
      statusChanged = true;
    }
    
    statuses.set(station.id, stationStatus);
    this.saveStationStatuses(statuses);
    
    if (statusChanged) {
      this.emitStatusUpdateEvent();
    }
  }

  /**
   * Update request count for stations not seen in current discovery
   */
  updateMissedStations(seenStationIds: string[]): void {
    const statuses = this.getStationStatuses();
    let hasChanges = false;
    
    for (const [stationId, station] of statuses) {
      if (!seenStationIds.includes(stationId)) {
        station.requestCount++;
        hasChanges = true;
        
        // Update status based on request count
        if (station.requestCount >= this.MAX_OFFLINE_REQUESTS) {
          station.status = 'offline';
          station.isOnline = false;
        } else if (station.requestCount >= this.MAX_WARNING_REQUESTS) {
          station.status = 'warning';
        }
      }
    }
    
    if (hasChanges) {
      this.saveStationStatuses(statuses);
      this.emitStatusUpdateEvent();
    }
  }

  /**
   * Get status for a specific station
   */
  getStationStatus(stationId: string): StationStatus | null {
    const statuses = this.getStationStatuses();
    return statuses.get(stationId) || null;
  }

  /**
   * Get all stations with enhanced status information
   */
  getAllStationsWithStatus(): StationStatus[] {
    const statuses = this.getStationStatuses();
    return Array.from(statuses.values());
  }

  /**
   * Get count of currently connected (online) stations
   */
  getConnectedCount(): number {
    const statuses = this.getStationStatuses();
    let connectedCount = 0;
    
    for (const station of statuses.values()) {
      if (station.status === 'online') {
        connectedCount++;
      }
    }
    
    return connectedCount;
  }

  /**
   * Remove old offline stations (older than 24 hours and offline)
   */
  cleanupOldStations(): void {
    const statuses = this.getStationStatuses();
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    let hasChanges = false;
    
    for (const [stationId, station] of statuses) {
      if (station.status === 'offline' && (now - station.lastSeen) > TWENTY_FOUR_HOURS) {
        statuses.delete(stationId);
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      this.saveStationStatuses(statuses);
      this.emitStatusUpdateEvent();
    }
  }

  /**
   * Get status indicator CSS class
   */
  getStatusClass(status: 'online' | 'warning' | 'offline'): string {
    switch (status) {
      case 'online': return 'status-online';
      case 'warning': return 'status-warning';
      case 'offline': return 'status-offline';
      default: return 'status-unknown';
    }
  }

  /**
   * Get status color
   */
  getStatusColor(status: 'online' | 'warning' | 'offline'): string {
    switch (status) {
      case 'online': return '#22c55e'; // Green
      case 'warning': return '#f59e0b'; // Yellow/Orange
      case 'offline': return '#ef4444'; // Red
      default: return '#9ca3af'; // Gray
    }
  }

  /**
   * Get human-readable status description
   */
  getStatusDescription(station: StationStatus): string {
    const timeSinceLastSeen = Date.now() - station.lastSeen;
    const minutes = Math.floor(timeSinceLastSeen / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    switch (station.status) {
      case 'online':
        return 'Online';
      case 'warning':
        return `Warning (${station.requestCount} missed)`;
      case 'offline':
        if (hours > 0) {
          return `Offline (${hours}h ago)`;
        } else if (minutes > 0) {
          return `Offline (${minutes}m ago)`;
        } else {
          return 'Offline';
        }
      default:
        return 'Unknown';
    }
  }

  /**
   * Format last seen time
   */
  formatLastSeen(timestamp: number): string {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  /**
   * Emit station status update event for UI components
   */
  private emitStatusUpdateEvent(): void {
    const statuses = this.getAllStationsWithStatus();
    const total = statuses.length;
    const online = statuses.filter(s => s.status === 'online').length;
    const warning = statuses.filter(s => s.status === 'warning').length;
    const offline = statuses.filter(s => s.status === 'offline').length;
    
    const event = new CustomEvent('stationStatusUpdate', {
      detail: {
        total,
        online,
        warning,
        offline,
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
  }
}

export const stationStatusService = new StationStatusService();
