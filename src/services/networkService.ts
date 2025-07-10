import { ref, reactive } from 'vue';

export interface NetworkStation {
  id: string;
  callsign: string;
  designator: string;
  ip: string;
  port: number;
  qsoCount: number;
  score: number;
  online: boolean;
  lastSeen: number;
}

export interface QsoUpdate {
  id: string;
  action: 'add' | 'update' | 'delete';
  qso: any;
  timestamp: number;
  stationId: string;
}

export interface SyncStatus {
  lastSync: number;
  syncedQsos: number;
  conflictsResolved: number;
  isConnected: boolean;
  networkId: string;
}

class NetworkService {
  private ws: WebSocket | null = null;
  private isHost = false;
  private hostPort = 8080;
  private connectedStations = reactive<NetworkStation[]>([]);
  private syncCallbacks: Array<(update: QsoUpdate) => void> = [];
  private syncInterval: number | null = null;
  
  public status = reactive<SyncStatus>({
    lastSync: 0,
    syncedQsos: 0,
    conflictsResolved: 0,
    isConnected: false,
    networkId: ''
  });

  // Network settings storage keys
  private readonly NETWORK_SETTINGS_KEY = 'fieldday_network_settings';
  
  // Network settings interface
  private networkSettings: {
    isHost: boolean;
    hostPort: number;
    lastHostAddress?: string;
    autoReconnect: boolean;
    lastConnectedStations: NetworkStation[];
  } = {
    isHost: false,
    hostPort: 8080,
    autoReconnect: false,
    lastConnectedStations: []
  };

  // Reconnection state
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // Start with 5 seconds
  private reconnectTimer: number | null = null;

  constructor() {
    // Load saved network settings and attempt reconnection
    this.loadNetworkSettings();
    
    // Small delay to allow UI to initialize first
    setTimeout(() => {
      this.attemptAutoReconnect();
    }, 1000);
  }

  // Network discovery - scan localhost on common development ports
  async discoverStations(): Promise<NetworkStation[]> {
    const localCallsign = (localStorage.getItem('stationCallsign') || '').toUpperCase();
    const localDesignator = localStorage.getItem('stationDesignator') || '';
    const localStationId = `${localCallsign}-${localDesignator}`;
    
    const discoveredStations: NetworkStation[] = [];
    const commonPorts = [3000, 4173, 5173, 8080, 8081, 8082]; // Common dev server ports
    
    console.log('Scanning localhost for Field Day stations...');
    
    // Scan localhost with different ports
    const scanPromises = commonPorts.map(port => this.checkStationAt('127.0.0.1', port));
    
    // Also try the current network if we can detect it
    try {
      const localIP = await this.getLocalIP();
      if (localIP && localIP !== '127.0.0.1') {
        // Add the detected IP to scan list
        scanPromises.push(...commonPorts.map(port => this.checkStationAt(localIP, port)));
      }
    } catch (error) {
      console.log('Could not detect local IP, scanning localhost only');
    }
    
    // Wait for all scans to complete with timeout
    const results = await Promise.allSettled(scanPromises.map(p => 
      Promise.race([
        p,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ])
    ));
    
    // Collect successful discoveries
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        const station = result.value;
        const stationId = `${station.callsign}-${station.designator}`;
        
        // Filter out our own station and known test stations
        if (stationId !== localStationId && 
            station.callsign !== localCallsign &&
            station.callsign !== 'W3AO' && // Filter out mock stations
            station.port !== parseInt(window.location.port || '8080')) { // Don't include our own port
          discoveredStations.push(station);
        }
      }
    });
    
    console.log(`Found ${discoveredStations.length} Field Day stations`);
    return discoveredStations;
  }

  // Check if a Field Day station is running at the given address
  private async checkStationAt(ip: string, port: number): Promise<NetworkStation | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 500);
      
      const response = await fetch(`http://${ip}:${port}/api/station-info`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const stationInfo = await response.json();
        return {
          id: `${ip}:${port}`,
          callsign: stationInfo.callsign || 'UNKNOWN',
          designator: stationInfo.designator || '1A',
          ip: ip,
          port: port,
          qsoCount: stationInfo.qsoCount || 0,
          score: stationInfo.score || 0,
          online: true,
          lastSeen: Date.now()
        };
      }
    } catch (error) {
      // Station not found or not responding - this is expected for most IPs
    }
    
    return null;
  }

  // Get local IP address
  private async getLocalIP(): Promise<string> {
    // In a real implementation, this would detect the actual local IP
    // For now, return a default local network IP
    try {
      // Try to detect via WebRTC (works in browsers)
      return new Promise((resolve) => {
        const pc = new RTCPeerConnection({
          iceServers: []
        });
        
        pc.createDataChannel('');
        pc.createOffer().then(pc.setLocalDescription.bind(pc));
        
        pc.onicecandidate = (ice) => {
          if (ice && ice.candidate && ice.candidate.candidate) {
            const match = ice.candidate.candidate.match(/candidate:\d+ \d+ udp \d+ ([\d.]+)/);
            if (match && match[1] && match[1].startsWith('192.168.')) {
              pc.close();
              resolve(match[1]);
              return;
            }
          }
        };
        
        // Fallback after timeout
        setTimeout(() => {
          pc.close();
          resolve('192.168.1.100');
        }, 1000);
      });
    } catch (error) {
      return '192.168.1.100'; // Fallback
    }
  }

  // Event emitters for network events
  private eventCallbacks: { [event: string]: Array<(...args: any[]) => void> } = {};

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = [];
    }
    this.eventCallbacks[event].push(callback);
  }

  off(event: string, callback: (...args: any[]) => void) {
    if (this.eventCallbacks[event]) {
      const index = this.eventCallbacks[event].indexOf(callback);
      if (index >= 0) {
        this.eventCallbacks[event].splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].forEach(callback => callback(...args));
    }
  }

  // Start hosting a network
  async startHost(port: number = 8080): Promise<boolean> {
    try {
      this.hostPort = port;
      this.isHost = true;
      
      // In a real implementation, this would start a WebSocket server
      // For now, simulate hosting
      this.status.isConnected = true;
      this.status.networkId = `FD-HOST-${Date.now()}`;
      this.status.lastSync = Date.now();
      
      // Save network settings
      this.networkSettings.isHost = true;
      this.networkSettings.hostPort = port;
      this.networkSettings.autoReconnect = true;
      this.saveNetworkSettings();
      
      // Cancel any pending reconnects
      this.cancelReconnect();
      
      // Emit network connected event
      this.emit('network:connected', { type: 'host', port });
      
      // Start periodic sync
      this.startPeriodicSync();
      
      console.log(`Started hosting on port ${port}`);
      return true;
    } catch (error) {
      console.error('Failed to start host:', error);
      this.emit('network:error', { message: 'Failed to start host', error });
      return false;
    }
  }

  // Connect to a host station
  async connectToHost(address: string): Promise<boolean> {
    try {
      const [ip, portStr] = address.split(':');
      const port = parseInt(portStr) || 8080;
      
      // First, verify the host is reachable
      const hostStation = await this.checkStationAt(ip, port);
      if (!hostStation) {
        throw new Error(`No Field Day station found at ${address}`);
      }
      
      // In a real implementation, this would establish a WebSocket connection
      // For now, simulate connection
      this.ws = null; // Mock WebSocket
      this.isHost = false;
      
      this.status.isConnected = true;
      this.status.networkId = `FD-CLIENT-${Date.now()}`;
      this.status.lastSync = Date.now();
      
      // Add the verified host station
      this.connectedStations.push(hostStation);
      
      // Save network settings
      this.networkSettings.isHost = false;
      this.networkSettings.lastHostAddress = address;
      this.networkSettings.autoReconnect = true;
      this.networkSettings.lastConnectedStations = [hostStation];
      this.saveNetworkSettings();
      
      // Cancel any pending reconnects
      this.cancelReconnect();
      
      // Emit network connected event
      this.emit('network:connected', { type: 'client', address, station: hostStation });
      
      // Start periodic sync
      this.startPeriodicSync();
      
      // Perform initial full sync
      await this.performInitialSync();
      
      console.log(`Connected to host at ${address}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to host:', error);
      this.emit('network:error', { message: 'Failed to connect to host', error });
      this.scheduleReconnect(); // Schedule reconnect on failure
      return false;
    }
  }

  // Disconnect from network
  disconnect(): void {
    const wasConnected = this.status.isConnected;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Cancel any pending reconnects
    this.cancelReconnect();
    
    // Clear sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.isHost = false;
    this.status.isConnected = false;
    this.status.networkId = '';
    this.connectedStations.splice(0, this.connectedStations.length);
    
    // Clear auto-reconnect setting (manual disconnect)
    this.networkSettings.autoReconnect = false;
    this.saveNetworkSettings();
    
    if (wasConnected) {
      this.emit('network:disconnected');
    }
    
    console.log('Disconnected from network');
  }

  // Send QSO update to all connected stations
  broadcastQsoUpdate(qso: any, action: 'add' | 'update' | 'delete'): void {
    if (!this.status.isConnected) return;
    
    const update: QsoUpdate = {
      id: `${Date.now()}-${Math.random()}`,
      action,
      qso,
      timestamp: Date.now(),
      stationId: this.getLocalStationId()
    };
    
    // Send update to all connected stations via HTTP
    this.connectedStations.forEach(async (station) => {
      try {
        const response = await fetch(`http://${station.ip}:${station.port}/api/qsos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(update)
        });
        
        if (response.ok) {
          console.log(`QSO update sent to ${station.callsign}`);
        }
      } catch (error) {
        console.error(`Failed to send QSO update to ${station.callsign}:`, error);
      }
    });
    
    this.status.lastSync = Date.now();
    this.status.syncedQsos++;
    
    // Emit QSO sync event
    this.emit('qso:synced', { action, qso, stationId: update.stationId });
  }

  // Sync QSOs from connected stations (polling)
  private async syncQsosFromStations(): Promise<void> {
    if (!this.status.isConnected) return;
    
    let anyStationReachable = false;
    
    for (const station of this.connectedStations) {
      try {
        const response = await fetch(`http://${station.ip}:${station.port}/api/qsos?since=${this.status.lastSync}`, {
          timeout: 5000
        } as any);
        
        if (response.ok) {
          const data = await response.json();
          
          // Station is reachable
          anyStationReachable = true;
          station.online = true;
          station.lastSeen = Date.now();
          
          // Process received QSOs
          if (data.qsos && data.qsos.length > 0) {
            data.qsos.forEach((qso: any) => {
              // Emit to QSO store handlers
              this.syncCallbacks.forEach(callback => callback({
                id: `sync-${Date.now()}-${Math.random()}`,
                action: 'add',
                qso, // Use the QSO as-is, preserving original timestamp and details
                timestamp: qso.timestamp || Date.now(), // Use original timestamp if available
                stationId: `${station.callsign}-${station.designator}`
              }));
            });
            
            console.log(`Synced ${data.qsos.length} QSOs from ${station.callsign}`);
            this.status.lastSync = data.timestamp || Date.now();
            this.status.syncedQsos += data.qsos.length;
          }
        } else {
          station.online = false;
        }
      } catch (error) {
        console.error(`Failed to sync QSOs from ${station.callsign}:`, error);
        station.online = false;
        
        // If this is a connection error and we should auto-reconnect
        if (this.networkSettings.autoReconnect) {
          console.log(`Station ${station.callsign} appears unreachable, scheduling reconnect`);
        }
      }
    }
    
    // If no stations are reachable and we should auto-reconnect
    if (!anyStationReachable && this.networkSettings.autoReconnect && this.connectedStations.length > 0) {
      console.log('All stations unreachable, attempting reconnect');
      this.status.isConnected = false;
      this.emit('network:connection-lost');
      this.scheduleReconnect();
    }
  }

  // Start periodic sync
  private startPeriodicSync(): void {
    // Clear any existing sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = window.setInterval(() => {
      if (this.status.isConnected) {
        this.syncQsosFromStations();
      }
    }, 5000); // Sync every 5 seconds
  }

  // Register callback for QSO updates from other stations
  onQsoUpdate(callback: (update: QsoUpdate) => void): void {
    this.syncCallbacks.push(callback);
  }

  // Remove QSO update callback
  offQsoUpdate(callback: (update: QsoUpdate) => void): void {
    const index = this.syncCallbacks.indexOf(callback);
    if (index >= 0) {
      this.syncCallbacks.splice(index, 1);
    }
  }

  // Get connected stations
  getConnectedStations(): NetworkStation[] {
    return [...this.connectedStations];
  }

  // Get current network settings (for UI display)
  getNetworkSettings() {
    return { ...this.networkSettings };
  }

  // Update auto-reconnect setting
  setAutoReconnect(enabled: boolean): void {
    this.networkSettings.autoReconnect = enabled;
    this.saveNetworkSettings();
    console.log(`Auto-reconnect ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Clear all network settings (reset)
  clearNetworkSettings(): void {
    localStorage.removeItem(this.NETWORK_SETTINGS_KEY);
    this.networkSettings = {
      isHost: false,
      hostPort: 8080,
      autoReconnect: false,
      lastConnectedStations: []
    };
    console.log('Network settings cleared');
  }

  // Get detailed connection status
  getConnectionStatus() {
    return {
      isConnected: this.status.isConnected,
      isHost: this.isHost,
      networkId: this.status.networkId,
      connectedStations: this.connectedStations.length,
      lastSync: this.status.lastSync,
      syncedQsos: this.status.syncedQsos,
      autoReconnect: this.networkSettings.autoReconnect,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Get local station ID
  private getLocalStationId(): string {
    const callsign = localStorage.getItem('stationCallsign') || 'UNKNOWN';
    const designator = localStorage.getItem('stationDesignator') || '1A';
    return `${callsign}-${designator}`;
  }

  // Handle incoming QSO update
  private handleQsoUpdate(update: QsoUpdate): void {
    // Resolve conflicts by timestamp (latest wins)
    const existingQso = this.findExistingQso(update.qso);
    if (existingQso && existingQso.timestamp > update.timestamp) {
      console.log('Conflict resolved: keeping local QSO');
      this.status.conflictsResolved++;
      return;
    }
    
    // Apply the update
    this.syncCallbacks.forEach(callback => callback(update));
    this.status.lastSync = Date.now();
    this.status.syncedQsos++;
  }

  // Find existing QSO for conflict resolution
  private findExistingQso(qso: any): any | null {
    // This would check the local QSO store
    // For now, return null (no conflicts)
    return null;
  }

  // Simulate periodic status updates
  startStatusUpdates(): void {
    setInterval(() => {
      if (this.status.isConnected) {
        // Update connected stations status
        this.connectedStations.forEach(station => {
          station.lastSeen = Date.now() - Math.random() * 30000; // Random last seen
          station.online = station.lastSeen > Date.now() - 60000; // Online if seen in last minute
        });
      }
    }, 5000);
  }

  // Load network settings from localStorage
  private loadNetworkSettings(): void {
    try {
      const saved = localStorage.getItem(this.NETWORK_SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        this.networkSettings = { ...this.networkSettings, ...settings };
        console.log('Loaded network settings:', this.networkSettings);
      }
    } catch (error) {
      console.error('Failed to load network settings:', error);
    }
  }

  // Save network settings to localStorage
  private saveNetworkSettings(): void {
    try {
      localStorage.setItem(this.NETWORK_SETTINGS_KEY, JSON.stringify(this.networkSettings));
      console.log('Saved network settings');
    } catch (error) {
      console.error('Failed to save network settings:', error);
    }
  }

  // Attempt to reconnect based on saved settings
  private async attemptAutoReconnect(): Promise<void> {
    if (!this.networkSettings.autoReconnect) {
      console.log('Auto-reconnect disabled');
      return;
    }

    console.log('Attempting auto-reconnect...');
    
    try {
      if (this.networkSettings.isHost) {
        console.log(`Auto-reconnecting as host on port ${this.networkSettings.hostPort}`);
        const success = await this.startHost(this.networkSettings.hostPort);
        if (success) {
          this.emit('network:auto-reconnected', { type: 'host' });
        }
      } else if (this.networkSettings.lastHostAddress) {
        console.log(`Auto-reconnecting to host at ${this.networkSettings.lastHostAddress}`);
        const success = await this.connectToHost(this.networkSettings.lastHostAddress);
        if (success) {
          this.emit('network:auto-reconnected', { type: 'client', address: this.networkSettings.lastHostAddress });
          // Perform initial full sync after reconnecting
          await this.performInitialSync();
        }
      }
    } catch (error) {
      console.error('Auto-reconnect failed:', error);
      this.emit('network:reconnect-failed', { error, attempt: this.reconnectAttempts });
      this.scheduleReconnect();
    }
  }

  // Schedule a reconnect attempt with exponential backoff
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached, giving up');
      this.emit('network:reconnect-exhausted');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.attemptAutoReconnect();
    }, delay);
  }

  // Cancel any pending reconnect attempts
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  // Perform initial full sync when connecting to network
  private async performInitialSync(): Promise<void> {
    if (!this.status.isConnected) return;

    console.log('🔄 Performing initial full sync...');
    
    try {
      let totalSynced = 0;
      
      for (const station of this.connectedStations) {
        console.log(`📡 Fetching QSOs from ${station.callsign} at ${station.ip}:${station.port}`);
        const response = await fetch(`http://${station.ip}:${station.port}/api/qsos`);
        if (response.ok) {
          const data = await response.json();
          console.log(`📥 Received ${data.qsos?.length || 0} QSOs from ${station.callsign}`);
          
          if (data.qsos && data.qsos.length > 0) {
            // Process all QSOs from this station
            data.qsos.forEach((qso: any) => {
              console.log(`⚡ Syncing QSO: ${qso.call} (ID: ${qso.id}) from ${station.callsign}`);
              this.syncCallbacks.forEach(callback => callback({
                id: `initial-sync-${Date.now()}-${Math.random()}`,
                action: 'add',
                qso, // Use the QSO as-is, preserving original timestamp and details
                timestamp: qso.timestamp || Date.now(), // Use original timestamp if available
                stationId: `${station.callsign}-${station.designator}`
              }));
            });
            
            totalSynced += data.qsos.length;
            console.log(`✅ Initial sync: ${data.qsos.length} QSOs from ${station.callsign}`);
          }
        } else {
          console.error(`❌ Failed to fetch QSOs from ${station.callsign}: ${response.status}`);
        }
      }
      
      if (totalSynced > 0) {
        this.status.syncedQsos += totalSynced;
        this.emit('network:initial-sync-complete', { syncedQsos: totalSynced });
        console.log(`🎉 Initial sync complete: ${totalSynced} total QSOs synced`);
      } else {
        console.log('ℹ️  Initial sync complete: no QSOs to sync');
      }
      
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      this.emit('network:initial-sync-failed', { error });
    }
  }
}

// Export singleton instance
export const networkService = new NetworkService();

// Auto-start status updates and periodic sync
networkService.startStatusUpdates();
