import { ref, reactive, nextTick } from 'vue';
import { fileStorage } from './fileStorage';
import { startPeriodicQsoRefresh, stopPeriodicQsoRefresh } from '@/store/qso';

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
  private hostPort = 8080; // Hardcoded to 8080 for all instances
  private connectedStations = reactive<NetworkStation[]>([]);
  private syncCallbacks: Array<(update: QsoUpdate) => void> = [];
  private syncInterval: number | null = null;
  private reconnectTimer: number | null = null; // Added missing property
  private reconnectAttempts: number = 0; // Optional: used in scheduleReconnect
  private maxReconnectAttempts: number = 5; // Optional: used in scheduleReconnect
  private reconnectDelay: number = 2000; // Optional: used in scheduleReconnect
  
  // Reactive trigger for UI updates
  private stationUpdateTrigger = ref(0);
  
  public status = reactive<SyncStatus>({
    lastSync: 0,
    syncedQsos: 0,
    conflictsResolved: 0,
    isConnected: false,
    networkId: ''
  });

  // Helper function to detect if running in Electron
  private isElectron(): boolean {
    return typeof window !== 'undefined' && !!(window as any).Electron;
  }

  // Network settings storage keys
  private readonly NETWORK_SETTINGS_KEY = 'fieldday_network_settings';
  
  // Persistent network identifier for this instance
  private networkInstanceId: string = '';
  
  // Network settings object
  private networkSettings = {
    autoReconnect: true,
    lastNetworkMode: 'mesh',
    isHost: false,
    hostPort: 8080,
    lastHostAddress: '',
    lastConnectedStations: [] as any[],
    networkInstanceId: ''
  };

  constructor() {
    this.initializeNetworkId();
    // Load saved network settings and attempt reconnection
    this.initializeNetwork();
  }

  // Initialize or load persistent network ID
  private async initializeNetworkId(): Promise<void> {
    try {
      const settings = await this.getNetworkSettings();
      
      if (settings.networkInstanceId) {
        // Use existing network ID
        this.networkInstanceId = settings.networkInstanceId;
      } else {
        // Generate new network ID based on station config (consistent format)
        const stationConfig = await fileStorage.getStationConfig();
        this.networkInstanceId = `FD-${stationConfig.callsign}-${stationConfig.designator}`.toUpperCase();
        
        // Save the new network ID to the networkSettings
        this.networkSettings.networkInstanceId = this.networkInstanceId;
        await this.saveNetworkSettings();
        
      }
      
      // Update the status with the persistent ID
      this.status.networkId = this.networkInstanceId;
      
    } catch (error) {
      console.error('❌ Failed to initialize network ID:', error);
      // Fallback to a simple ID
      this.networkInstanceId = `FD-UNKNOWN-${Date.now()}`;
      this.status.networkId = this.networkInstanceId;
    }
  }

  // Get the persistent network ID
  getNetworkInstanceId(): string {
    return this.networkInstanceId;
  }

  private async initializeNetwork(): Promise<void> {
    try {
      // In Electron, skip network initialization entirely
      if (this.isElectron()) {
        this.status.isConnected = false;
        this.status.networkId = 'ELECTRON-STANDALONE';
        return;
      }
      
      // First load network settings
      await this.loadNetworkSettings();
      
      // Small delay to allow UI to initialize first
      setTimeout(() => {
        this.attemptAutoReconnect();
      }, 2000);
    } catch (error) {
      console.error('Failed to initialize network on startup:', error);
    }
  }

  // Network discovery - scan localhost on common development ports
  async discoverStations(): Promise<NetworkStation[]> {
    // In Electron, skip network discovery and return empty array
    if (this.isElectron()) {
      return [];
    }
    
    let localCallsign = '';
    let localDesignator = '';
    
    try {
      const stationConfig = await fileStorage.getStationConfig();
      localCallsign = stationConfig.callsign.toUpperCase();
      localDesignator = stationConfig.designator;
    } catch (error) {
      console.error('Failed to get station config from file storage:', error);
      localCallsign = 'UNKNOWN';
      localDesignator = '1A';
    }
    
    const localStationId = `${localCallsign}-${localDesignator}`;
    
    const discoveredStations: NetworkStation[] = [];
    const fieldDayPort = 8080; // All Field Day instances use port 8080
    
    
    // Since all instances use port 8080, we scan different IP addresses on port 8080 only
    const scanPromises: Promise<NetworkStation | null>[] = [];
    
    // Try IPv4 localhost (since multiple instances on same machine will use different processes)
    // Note: Multiple instances on the same machine is not typical - usually different machines
    
    // Get the current machine's IP addresses to scan the local network
    try {
      const localIP = await this.getLocalIP();
      if (localIP && localIP !== '127.0.0.1') {
        
        // For mesh network discovery, we only check a few specific addresses
        // to avoid overwhelming the network and finding false positives
        const specificIPs = [
          '192.168.1.14',  // Known Field Day station IP
          '192.168.1.30',  // Known Field Day station IP
          localIP          // Our own IP (for verification)
        ];
        
        for (const testIP of specificIPs) {
          if (testIP !== localIP) { // Don't scan ourselves
            scanPromises.push(this.checkStationAt(testIP, fieldDayPort));
          }
        }
      }
    } catch (error) {
    }
    
    // Always check localhost in case there are multiple instances on same machine
    // (though this is unusual for Field Day operations)
    scanPromises.push(this.checkStationAt('127.0.0.1', fieldDayPort));
    scanPromises.push(this.checkStationAt('localhost', fieldDayPort));
    
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
            station.callsign !== 'W3AO') { // Filter out mock stations
          
          // Avoid duplicates
          const existing = discoveredStations.find(s => s.ip === station.ip && s.port === station.port);
          if (!existing) {
            discoveredStations.push(station);
          }
        }
      }
    });
    
    discoveredStations.forEach(station => {
    });
    
    return discoveredStations;
  }

  // Check if a Field Day station is running at the given address
  private async checkStationAt(ip: string, port: number): Promise<NetworkStation | null> {
    try {
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const response = await this.fetchWithProtocolFallback(`https://${ip}:${port}/api/station-info`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const stationInfo = await response.json();
        
        // Validate this is actually a Field Day station by checking required fields
        if (stationInfo.callsign && 
            stationInfo.designator && 
            stationInfo.software && 
            stationInfo.software.includes('Field Day')) {
          
          
          return {
            id: `${ip}:${port}`,
            callsign: stationInfo.callsign,
            designator: stationInfo.designator,
            ip: ip,
            port: port,
            qsoCount: stationInfo.qsoCount || 0,
            score: stationInfo.score || 0,
            online: true,
            lastSeen: Date.now()
          };
        } else {
        }
      } else {
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
      } else {
      }
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

  // Helper method to make HTTP/HTTPS requests with protocol fallback for remote stations
  private async fetchWithProtocolFallback(url: string, options: RequestInit = {}): Promise<Response> {
    // Parse the URL to determine if it's a remote station
    const urlObj = new URL(url);
    const isLocalhost = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname === '[::1]';
    
    // For localhost, always use the current protocol
    if (isLocalhost) {
      return fetch(url, options);
    }
    
    // For remote stations, try HTTPS first, then HTTP
    const protocols = ['https', 'http'];
    let lastError;
    
    for (const protocol of protocols) {
      try {
        const protocolUrl = url.replace(/^https?:/, `${protocol}:`);
        
        const response = await fetch(protocolUrl, options);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        lastError = error;
        
        if (errorMessage.includes('certificate') || errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
        } else {
        }
        
        // Continue to next protocol
        continue;
      }
    }
    
    // If both protocols failed, throw the last error
    throw lastError;
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

  // Legacy host network method - no longer used (mesh only)
  async startHost(): Promise<boolean> {
    console.log('⚠️ [NetworkService] startHost() is deprecated - use mesh networking instead');
    return false;
  }

  // Legacy station monitoring method - no longer used (mesh only)
  private startStationMonitoring(): void {
    console.log('⚠️ [NetworkService] startStationMonitoring() is deprecated - backend handles station monitoring');
  }

  // Legacy heartbeat method - no longer used (mesh only)
  private startHeartbeat(hostAddress: string): void {
    console.log('⚠️ [NetworkService] startHeartbeat() is deprecated - backend handles heartbeat');
  }

  // Legacy client monitoring method - no longer used (mesh only)
  private startClientMonitoring(hostAddress: string): void {
    console.log('⚠️ [NetworkService] startClientMonitoring() is deprecated - backend handles monitoring');
  }

  // Legacy join network method - no longer used (mesh only)
  async connectToHost(address: string): Promise<boolean> {
    console.log('⚠️ [NetworkService] connectToHost() is deprecated - use mesh networking instead');
    return false;
  }

  private disconnect(): void {
    console.log('🔌 [NetworkService] Disconnecting from network');
    
    // Legacy mesh network stop - now handled by backend
    console.log('⚠️ [NetworkService] Frontend mesh network stop is deprecated');
    
    // Clear connection state
    this.status.isConnected = false;
    this.isHost = false;
    this.connectedStations.splice(0);
    
    // Stop periodic operations
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Cancel any reconnection attempts
    this.cancelReconnect();
    
    // Stop QSO refresh
    stopPeriodicQsoRefresh();
    
    console.log('🔌 [NetworkService] Disconnected from network');
  }

  // Sync QSOs from connected stations (polling)
  private async syncQsosFromStations(): Promise<void> {
    if (!this.status.isConnected) return;
    
    let anyStationReachable = false;
    
    for (const station of this.connectedStations) {
      try {
        const response = await this.fetchWithProtocolFallback(`https://${station.ip}:${station.port}/api/qsos?since=${this.status.lastSync}`, {
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
        }
      }
    }
    
    // If no stations are reachable and we should auto-reconnect
    if (!anyStationReachable && this.networkSettings.autoReconnect && this.connectedStations.length > 0) {
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

    
    // Sync every 10 seconds
    this.syncInterval = setInterval(async () => {
      if (this.status.isConnected) {
        await this.performSync();
      }
    }, 10000) as unknown as number;

    // Perform initial sync
    setTimeout(() => this.performSync(), 2000);
  }

  private async performSync(): Promise<void> {
    try {
      // Get QSOs that have been added/updated since last sync
      const lastSync = this.status.lastSync;
      
      // Sync with connected stations
      for (const station of this.connectedStations) {
        if (!station.online) continue;
        
        try {
          // Get QSOs from this station since last sync
          const response = await this.fetchWithProtocolFallback(`https://${station.ip}:${station.port}/api/qsos?since=${lastSync}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.qsos && data.qsos.length > 0) {
              
              // Emit sync update event for QSO store to handle
              this.syncCallbacks.forEach(callback => {
                data.qsos.forEach((qso: any) => {
                  callback({
                    id: `${station.id}-${qso.id}`,
                    action: 'add',
                    qso: qso,
                    timestamp: qso.timestamp || Date.now(),
                    stationId: `${station.callsign}-${station.designator}`
                  });
                });
              });
              
              this.status.syncedQsos += data.qsos.length;
            }
            
            // Update station info
            station.lastSeen = Date.now();
            station.online = true;
          }
        } catch (error) {
          station.online = false;
        }
      }

      // Update last sync timestamp
      this.status.lastSync = Date.now();
      
    } catch (error) {
      console.error('❌ Sync error:', error);
    }
  }

  private async performInitialSync(): Promise<void> {
    
    // Set last sync to 0 to get all QSOs
    const originalLastSync = this.status.lastSync;
    this.status.lastSync = 0;
    
    await this.performSync();
    
    // Restore last sync timestamp
    this.status.lastSync = originalLastSync;
    
  }

  // Missing utility methods
  private async loadNetworkSettings(): Promise<void> {
    try {
      const settings = await fileStorage.getSettings();
      if (settings.networkSettings) {
        this.networkSettings = { ...this.networkSettings, ...settings.networkSettings };
      }
    } catch (error) {
      console.error('Failed to load network settings from file storage:', error);
      // Use defaults if file storage fails
    }
  }

  private async saveNetworkSettings(): Promise<void> {
    try {
      // Get current settings to preserve other data
      const currentSettings = await fileStorage.getSettings();
      await fileStorage.saveSettings({
        ...currentSettings,
        networkSettings: this.networkSettings
      });
    } catch (error) {
      console.error('❌ Failed to save network settings to file storage:', error);
    }
  }

  private attemptAutoReconnect(): void {
    // In Electron, skip auto-reconnect networking
    if (this.isElectron()) {
      return;
    }
    
    if (!this.networkSettings.autoReconnect) {
      return;
    }
    
    
    // Auto-reconnect disabled - all mesh discovery now handled by backend service
    console.log('ℹ️ [NetworkService] Auto-reconnect disabled - using backend mesh discovery only');
    console.log('ℹ️ [NetworkService] Frontend mesh network service disabled to prevent connection conflicts');
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.reconnectAttempts = 0;
    }
  }

  private scheduleReconnect(): void {
    if (!this.networkSettings.autoReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    
    this.reconnectTimer = setTimeout(() => {
      this.attemptAutoReconnect();
    }, delay) as unknown as number;
  }

  private async getLocalStationId(): Promise<string> {
    try {
      const stationConfig = await fileStorage.getStationConfig();
      return `${stationConfig.callsign}-${stationConfig.designator}`;
    } catch (error) {
      console.error('Failed to get station config from file storage:', error);
      return 'UNKNOWN-1A';
    }
  }

  startStatusUpdates(): void {
    // Update station status periodically
    setInterval(() => {
      this.connectedStations.forEach(station => {
        // Mark stations as offline if not seen recently
        if (Date.now() - station.lastSeen > 30000) { // 30 seconds
          station.online = false;
        }
      });
    }, 10000);
  }

  // Public methods for external use
  getConnectionStatus() {
    return {
      isConnected: this.status.isConnected,
      networkId: this.status.networkId,
      lastSync: this.status.lastSync,
      syncedQsos: this.status.syncedQsos,
      connectedStations: this.connectedStations.length
    };
  }

  getConnectedStations() {
    // Access the trigger to ensure reactivity
    this.stationUpdateTrigger.value;
    return this.connectedStations; // Return reactive array directly
  }

  // Trigger UI updates
  private triggerStationUpdate() {
    this.stationUpdateTrigger.value++;
  }

  getNetworkSettings() {
    return { ...this.networkSettings };
  }

  setAutoReconnect(enabled: boolean): void {
    this.networkSettings.autoReconnect = enabled;
    this.saveNetworkSettings().catch(error => {
      console.error('Failed to save network settings:', error);
    });
  }

  // Public method to update network mode settings
  updateNetworkMode(mode: 'host' | 'join' | 'auto' | 'mesh', options: { hostPort?: number; hostAddress?: string } = {}): void {
    // Save the last network mode
    this.networkSettings.lastNetworkMode = mode;
    
    if (mode === 'host') {
      this.networkSettings.isHost = true;
      this.networkSettings.hostPort = options.hostPort || 8080;
      this.networkSettings.lastHostAddress = ''; // Clear join address when hosting
    } else if (mode === 'join' && options.hostAddress) {
      this.networkSettings.isHost = false;
      this.networkSettings.lastHostAddress = options.hostAddress;
    } else if (mode === 'mesh') {
      // Mesh mode - decentralized network
      this.networkSettings.isHost = false;
      this.networkSettings.lastHostAddress = '';
    } else {
      // Auto mode - clear both
      this.networkSettings.isHost = false;
      this.networkSettings.lastHostAddress = '';
    }
    
    this.saveNetworkSettings().catch(error => {
      console.error('Failed to save network settings:', error);
    });
  }

  // Add QSO sync registration
  onQsoUpdate(callback: (update: QsoUpdate) => void): void {
    this.syncCallbacks.push(callback);
  }

  // Broadcast QSO update to network
  async broadcastQsoUpdate(qso: any, action: 'add' | 'update' | 'delete'): Promise<void> {
    if (!this.status.isConnected) {
      console.log('🔇 [NetworkService] Not connected to network, skipping QSO broadcast');
      return;
    }
    
    const localStationId = await this.getLocalStationId();
    const update: QsoUpdate = {
      id: `${localStationId}-${qso.id}`,
      action,
      qso,
      timestamp: Date.now(),
      stationId: localStationId
    };

    console.log(`📡 [NetworkService] Broadcasting QSO ${action} to mesh network:`, {
      qsoId: qso.id,
      action,
      stationId: localStationId
    });
    
    // Legacy mesh node discovery - now handled by backend
    console.log('⚠️ [NetworkService] QSO broadcast via frontend mesh is deprecated');
    console.log('🔍 [NetworkService] QSO sync is now handled automatically by backend mesh discovery');
    return;
  }

  // Send a chat message across the network
  // Generate a GUID for message IDs
  private generateMessageId(): string {
    return 'msg-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async sendMessage(text: string, target = 'all', messageId?: string): Promise<void> {
    if (!this.status.isConnected) {
      return;
    }
    
    try {
      const stationConfig = await fileStorage.getStationConfig();
      const stationId = `${stationConfig.callsign}-${stationConfig.designator}`;
      
      const message = {
        id: messageId || this.generateMessageId(),
        type: 'chat',
        text,
        from: stationId,
        target,
        timestamp: Date.now(),
        stationId
      };

      
      if (this.isHost) {
        // Host: Add to local storage and broadcast to clients
        const response = await fetch(`https://localhost:8080/api/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });
        
        if (response.ok) {
          
          // Broadcast to connected clients
          if (target === 'all') {
            this.connectedStations.forEach(async (station) => {
              try {
                const clientResponse = await this.fetchWithProtocolFallback(`https://${station.ip}:${station.port}/api/messages`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(message)
                });
                
                if (clientResponse.ok) {
                } else {
                }
              } catch (error) {
              }
            });
          } else {
            // Send to specific station
            const targetStation = this.connectedStations.find(s => `${s.callsign}-${s.designator}` === target);
            if (targetStation) {
              try {
                const clientResponse = await this.fetchWithProtocolFallback(`https://${targetStation.ip}:${targetStation.port}/api/messages`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(message)
                });
                
                if (clientResponse.ok) {
                } else {
                }
              } catch (error) {
              }
            } else {
            }
          }
        }
      } else {
        // Client: Send to host
        if (!this.networkSettings.lastHostAddress) {
          return;
        }
        
        const response = await this.fetchWithProtocolFallback(`https://${this.networkSettings.lastHostAddress}/api/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });
        
        if (response.ok) {
        } else {
        }
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  // Debug methods for testing and configuration
  async setTestConfiguration(callsign: string, designator: string): Promise<void> {
    
    try {
      await fileStorage.saveStationConfig({ callsign, designator });
    } catch (error) {
      console.error('Failed to save configuration to file storage:', error);
    }
    
    // Test the endpoint immediately
    fetch('/api/station-info')
      .then(r => r.json())
  }

  async checkStorage(): Promise<void> {
    
    // Check file storage
    try {
      const stationConfig = await fileStorage.getStationConfig();
      const qsos = await fileStorage.getQsoData();
      const operators = await fileStorage.getOperators();
      const bonuses = await fileStorage.getBonuses();
      const settings = await fileStorage.getSettings();
      
    } catch (error) {
      console.error(error);
    }
  }

  // Legacy method for backward compatibility
  checkLocalStorage(): void {
    this.checkStorage().catch(error => {
      console.error('Failed to check storage:', error);
    });
  }

  // Manual discovery test for debugging
  async testDiscovery(): Promise<void> {
    
    const fieldDayPort = 8080;
    
    
    // Test localhost
    const localStation = await this.checkStationAt('127.0.0.1', fieldDayPort);
    if (localStation) {
    } else {
    }
    
    // Test current network if available
    try {
      const localIP = await this.getLocalIP();
      if (localIP && localIP !== '127.0.0.1') {
        const networkStation = await this.checkStationAt(localIP, fieldDayPort);
        if (networkStation) {
        } else {
        }
      }
    } catch (error) {
    }
    
  }

  // Manual test method for debugging - checks Field Day port 8080 only
  async testFieldDayPorts(): Promise<void> {
    
    const fieldDayPort = 8080;
    
    // Try both IPv4 and IPv6 addresses on localhost
    const addresses = ['127.0.0.1', 'localhost', '[::1]'];
    
    for (const address of addresses) {
      
      try {
        const url = `https://${address}:${fieldDayPort}/api/station-info`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 3000);
        
        const response = await this.fetchWithProtocolFallback(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Field-Day-Logger'
          }
        });
        
        clearTimeout(timeoutId);
        
        
        if (response.ok) {
          const data = await response.json();
        } else {
        }
        
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
          } else {
          }
        }
      }
    }
    
  }

  // Comprehensive test for network discovery debugging
  async testNetworkDiscovery(): Promise<void> {
    
    // Test 1: Local station info
    try {
      const localUrl = `${window.location.origin}/api/station-info`;
      const localResponse = await fetch(localUrl);
      if (localResponse.ok) {
        const localData = await localResponse.json();
      } else {
      }
    } catch (error) {
    }
    
    // Test 2: Check Field Day port 8080 on different addresses
    const fieldDayPort = 8080;
    
    // Test different URL formats (both IPv4 and IPv6)
    const urls = [
      `https://127.0.0.1:${fieldDayPort}/api/station-info`,
      `https://localhost:${fieldDayPort}/api/station-info`,
      `https://[::1]:${fieldDayPort}/api/station-info`
    ];
    
    for (const url of urls) {
      try {
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          },
          mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
        } else {
        }
        
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
          } else {
          }
        }
      }
    }
    
    // Test 3: Run actual discovery
    const stations = await this.discoverStations();
    stations.forEach(station => {
    });
    
  }

  // Configuration methods using file storage
  async setConfiguration(callsign: string, designator: string): Promise<void> {
    
    // Use file storage instead of localStorage
    await fileStorage.saveStationConfig({ callsign, designator });
    
    
    // Test the endpoint immediately
    try {
      const response = await fetch('/api/station-info');
      const data = await response.json();
    } catch (err) {
    }
  }

  async checkFileStorage(): Promise<void> {
    
    try {
      const storageInfo = await fileStorage.getStorageInfo();
      const stationConfig = await fileStorage.getStationConfig();
      const qsos = await fileStorage.getQsoData();
      
    } catch (error) {
      console.error('❌ Error checking file storage:', error);
    }
  }

  // Set up test data for specific ports
  async setupTestStation(callsign: string, designator: string, qsoCount = 0): Promise<void> {
    
    await fileStorage.setupTestConfiguration(callsign, designator, qsoCount);
    
    
    // Test the endpoint
    try {
      const response = await fetch('/api/station-info');
      const data = await response.json();
    } catch (err) {
    }
  }

  // Migration method to move from localStorage to file storage
  async migrateToFileStorage(): Promise<void> {
    await fileStorage.migrateFromLocalStorage();
  }

  // Public method to get current network mode for UI - now always mesh
  getCurrentNetworkMode(): 'mesh' {
    // Only mesh mode is supported
    return 'mesh';
  }

  // Public method to get host address for UI
  getHostAddress(): string {
    return this.networkSettings.lastHostAddress || '';
  }

  // Public method to get host port for UI
  getHostPort(): number {
    return 8080; // Hardcoded port for all Field Day instances
  }

  // Mesh network methods
  async startMesh(): Promise<boolean> {
    // Mesh networking now handled entirely by backend - disable frontend mesh
    console.log('ℹ️ [NetworkService] Mesh networking disabled - using backend mesh discovery only');
    return false;
  }

  async stopMesh(): Promise<void> {
    // Mesh networking disabled - no-op
    console.log('ℹ️ [NetworkService] Mesh stop called - no action needed (backend handles mesh)');
  }

  private setupMeshEventHandlers(): void {
    // Legacy mesh event handlers - no longer used
    console.log('⚠️ [NetworkService] setupMeshEventHandlers() is deprecated - backend handles mesh events');
  }

  // Remove duplicate stations from the connected stations list
  private removeDuplicateStations(): void {
    const uniqueStations = new Map<string, NetworkStation>();
    
    // Use multiple keys to detect duplicates
    for (const station of this.connectedStations) {
      const keys = [
        station.id,
        `${station.ip}:${station.port}`,
        `${station.callsign}-${station.designator}`
      ];
      
      let isDuplicate = false;
      for (const key of keys) {
        if (uniqueStations.has(key)) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        for (const key of keys) {
          uniqueStations.set(key, station);
        }
      }
    }
    
    // Get unique stations
    const stations = Array.from(new Set(uniqueStations.values()));
    const removedCount = this.connectedStations.length - stations.length;
    
    if (removedCount > 0) {
      this.connectedStations.splice(0, this.connectedStations.length, ...stations);
    }
  }

  // Legacy mesh methods - no longer used (backend handles mesh discovery)
  getMeshNodes(): any[] {
    console.log('⚠️ [NetworkService] getMeshNodes() is deprecated - use backend API');
    return [];
  }

  // Legacy mesh status - no longer used (backend handles mesh discovery)
  getMeshStatus() {
    console.log('⚠️ [NetworkService] getMeshStatus() is deprecated - use backend API');
    return { isActive: false, connectedNodes: 0, discoveredNodes: 0, meshHealth: 'unknown' };
  }

  // Legacy mesh discovery refresh - no longer used (backend handles mesh discovery)
  async refreshMeshDiscovery(): Promise<void> {
    console.log('⚠️ [NetworkService] refreshMeshDiscovery() is deprecated - use backend API');
  }

  // Legacy mesh sync - no longer used (backend handles mesh discovery)
  async forceMeshSync(): Promise<void> {
    console.log('⚠️ [NetworkService] forceMeshSync() is deprecated - use backend API');
  }
}

// Export singleton instance
export const networkService = new NetworkService();

// Auto-start status updates and periodic sync
networkService.startStatusUpdates();
