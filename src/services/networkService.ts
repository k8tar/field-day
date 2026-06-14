import { ref, reactive } from 'vue';
import { fileStorage } from './fileStorage';
import { backendApi } from './backendApiService';
import { debugLog } from '@/utils/debug';

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
  qso: import('@/store/qso').QSO;
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
  private connectedStations = reactive<NetworkStation[]>([]);
  private syncCallbacks: Array<(update: QsoUpdate) => void> = [];
  
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
    const candidateWindow = window as Window & { Electron?: unknown };
    return typeof window !== 'undefined' && !!candidateWindow.Electron;
  }

  // Persistent network identifier for this instance
  private networkInstanceId = '';
  
  // Network settings object
  private networkSettings: {
    autoReconnect: boolean;
    lastNetworkMode: 'host' | 'join' | 'auto' | 'mesh';
    isHost: boolean;
    hostPort: number;
    lastHostAddress: string;
    lastConnectedStations: unknown[];
    networkInstanceId: string;
  } = {
    autoReconnect: true,
    lastNetworkMode: 'mesh',
    isHost: false,
    hostPort: 8080,
    lastHostAddress: '',
    lastConnectedStations: [],
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
      
    } catch (e: unknown) {
      console.error('❌ Failed to initialize network ID:', e);
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
    } catch (e: unknown) {
      console.error('Failed to initialize network on startup:', e);
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
    } catch (e: unknown) {
      console.error('Failed to get station config from file storage:', e);
      localCallsign = 'UNKNOWN';
      localDesignator = '1A';
    }
    
    const localStationId = `${localCallsign}-${localDesignator}`;
    
    const discoveredStations: NetworkStation[] = [];
    const fieldDayPort = 8080; // All Field Day instances use port 8080
    
    // Since all instances use port 8080, we scan different IP addresses on port 8080 only
    const scanPromises: Promise<NetworkStation | null>[] = [];
    
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
    } catch (e: unknown) {
      debugLog('Failed to scan local IP ranges:', e);
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
          const existing = discoveredStations.find(s => s.ip === station.ip && s.port === station.port);
          if (!existing) {
            discoveredStations.push(station);
          }
        }
      }
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
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        debugLog(`Station check failed for ${ip}:${port}: ${e.message}`);
      } else {
        debugLog(`Station check timed out for ${ip}:${port}`);
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
    } catch (e: unknown) {
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
      const protocolUrl = url.replace(/^https?:/, `${protocol}:`);
      try {
        const response = await fetch(protocolUrl, options);
        return response;
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        lastError = e;
        
        if (errorMessage.includes('certificate') || errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
          debugLog(`Protocol ${protocol} certificate issue for ${protocolUrl}`);
        } else {
          debugLog(`Protocol ${protocol} request failed for ${protocolUrl}: ${errorMessage}`);
        }
        
        // Continue to next protocol
        continue;
      }
    }
    
    // If both protocols failed, throw the last error
    throw lastError;
  }

  // Event emitters for network events
  private eventCallbacks: Record<string, Array<(...args: unknown[]) => void>> = {};

  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = [];
    }
    this.eventCallbacks[event].push(callback);
  }

  off(event: string, callback: (...args: unknown[]) => void) {
    if (this.eventCallbacks[event]) {
      const index = this.eventCallbacks[event].indexOf(callback);
      if (index >= 0) {
        this.eventCallbacks[event].splice(index, 1);
      }
    }
  }

  // Legacy host network method - no longer used (mesh only)
  async startHost(): Promise<boolean> {
    debugLog('⚠️ [NetworkService] startHost() is deprecated - use mesh networking instead');
    return false;
  }

  // Legacy join network method - no longer used (mesh only)
  async connectToHost(_address: string): Promise<boolean> {
    debugLog('⚠️ [NetworkService] connectToHost() is deprecated - use mesh networking instead');
    return false;
  }

  // Missing utility methods
  private async loadNetworkSettings(): Promise<void> {
    try {
      const settings = await fileStorage.getSettings();
      if (settings.networkSettings) {
        this.networkSettings = { ...this.networkSettings, ...settings.networkSettings };
      }
    } catch (e: unknown) {
      console.error('Failed to load network settings from file storage:', e);
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
    } catch (e: unknown) {
      console.error('❌ Failed to save network settings to file storage:', e);
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
    debugLog('ℹ️ [NetworkService] Auto-reconnect disabled - using backend mesh discovery only');
    debugLog('ℹ️ [NetworkService] Frontend mesh network service disabled to prevent connection conflicts');
  }

  private async getLocalStationId(): Promise<string> {
    try {
      const stationConfig = await fileStorage.getStationConfig();
      return `${stationConfig.callsign}-${stationConfig.designator}`;
    } catch (e: unknown) {
      console.error('Failed to get station config from file storage:', e);
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
  getNetworkSettings() {
    return { ...this.networkSettings };
  }

  setAutoReconnect(enabled: boolean): void {
    this.networkSettings.autoReconnect = enabled;
    this.saveNetworkSettings().catch((error) => {
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
  async broadcastQsoUpdate(qso: import('@/store/qso').QSO, action: 'add' | 'update' | 'delete'): Promise<void> {
    if (!this.status.isConnected) {
      debugLog('🔇 [NetworkService] Not connected to network, skipping QSO broadcast');
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
    void update;

    debugLog(`📡 [NetworkService] Broadcasting QSO ${action} to mesh network:`, {
      qsoId: qso.id,
      action,
      stationId: localStationId
    });
    
    // Legacy mesh node discovery - now handled by backend
    debugLog('⚠️ [NetworkService] QSO broadcast via frontend mesh is deprecated');
    debugLog('🔍 [NetworkService] QSO sync is now handled automatically by backend mesh discovery');
    return;
  }

  async sendMessage(text: string, target = 'all', messageId?: string): Promise<void> {
    try {
      // Use backend API to send message - backend handles mesh distribution
      const success = await backendApi.sendMessage(text, target, messageId);
      
      if (!success) {
        console.error('❌ Failed to send message via backend API');
        throw new Error('Failed to send message');
      }
      
      debugLog(`📨 Message sent via backend API: "${text}" to ${target}`);
    } catch (e: unknown) {
      console.error('❌ Error sending message:', e);
      throw e;
    }
  }

  // Debug methods for testing and configuration
  async setTestConfiguration(callsign: string, designator: string): Promise<void> {
    
    try {
      await fileStorage.saveStationConfig({ callsign, designator });
    } catch (e: unknown) {
      console.error('Failed to save configuration to file storage:', e);
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
      void stationConfig;
      void qsos;
      void operators;
      void bonuses;
      void settings;
      
    } catch (e: unknown) {
      console.error(e);
    }
  }

  // Legacy method for backward compatibility
  checkLocalStorage(): void {
    this.checkStorage().catch((error) => {
      console.error('Failed to check storage:', error);
    });
  }

  // Manual discovery test for debugging
  async testDiscovery(): Promise<void> {
    
    const fieldDayPort = 8080;
    
    
    // Test localhost
    const localStation = await this.checkStationAt('127.0.0.1', fieldDayPort);
    debugLog('Local station discovery result:', localStation);
    
    // Test current network if available
    try {
      const localIP = await this.getLocalIP();
      if (localIP && localIP !== '127.0.0.1') {
        const networkStation = await this.checkStationAt(localIP, fieldDayPort);
        debugLog('Network station discovery result:', networkStation);
      }
    } catch (e: unknown) {
      debugLog('testDiscovery local network probe failed:', e);
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
          void data;
        }
        
      } catch (e: unknown) {
        if (e instanceof Error) {
          if (e.name === 'AbortError') {
            debugLog(`testFieldDayPorts timeout for ${address}`);
          } else {
            debugLog(`testFieldDayPorts error for ${address}:`, e);
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
        void localData;
      }
    } catch (e: unknown) {
      debugLog('testNetworkDiscovery local station check failed:', e);
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
          void data;
        }
        
      } catch (e: unknown) {
        if (e instanceof Error) {
          if (e.name === 'AbortError') {
            debugLog(`testNetworkDiscovery timeout for ${url}`);
          } else {
            debugLog(`testNetworkDiscovery error for ${url}:`, e);
          }
        }
      }
    }
    
    // Test 3: Run actual discovery
    const stations = await this.discoverStations();
    void stations;
    
  }

  // Configuration methods using file storage
  async setConfiguration(callsign: string, designator: string): Promise<void> {
    
    // Use file storage instead of localStorage
    await fileStorage.saveStationConfig({ callsign, designator });
    
    
    // Test the endpoint immediately
    try {
      const response = await fetch('/api/station-info');
      const data = await response.json();
      void data;
    } catch (err) {
      debugLog('setConfiguration endpoint check failed:', err);
    }
  }

  async checkFileStorage(): Promise<void> {
    
    try {
      const storageInfo = await fileStorage.getStorageInfo();
      const stationConfig = await fileStorage.getStationConfig();
      const qsos = await fileStorage.getQsoData();
      void storageInfo;
      void stationConfig;
      void qsos;
      
    } catch (e: unknown) {
      console.error('❌ Error checking file storage:', e);
    }
  }

  // Set up test data for specific ports
  async setupTestStation(callsign: string, designator: string, qsoCount = 0): Promise<void> {
    
    await fileStorage.setupTestConfiguration(callsign, designator, qsoCount);
    
    
    // Test the endpoint
    try {
      const response = await fetch('/api/station-info');
      const data = await response.json();
      void data;
    } catch (err) {
      debugLog('setupTestStation endpoint check failed:', err);
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
    debugLog('ℹ️ [NetworkService] Mesh networking disabled - using backend mesh discovery only');
    return false;
  }

  async stopMesh(): Promise<void> {
    // Mesh networking disabled - no-op
    debugLog('ℹ️ [NetworkService] Mesh stop called - no action needed (backend handles mesh)');
  }

  // Legacy mesh methods - no longer used (backend handles mesh discovery)
  getMeshNodes(): unknown[] {
    debugLog('⚠️ [NetworkService] getMeshNodes() is deprecated - use backend API');
    return [];
  }

  // Legacy mesh status - no longer used (backend handles mesh discovery)
  getMeshStatus() {
    debugLog('⚠️ [NetworkService] getMeshStatus() is deprecated - use backend API');
    return { isActive: false, connectedNodes: 0, discoveredNodes: 0, meshHealth: 'unknown' };
  }

  // Legacy mesh discovery refresh - no longer used (backend handles mesh discovery)
  async refreshMeshDiscovery(): Promise<void> {
    debugLog('⚠️ [NetworkService] refreshMeshDiscovery() is deprecated - use backend API');
  }

  // Legacy mesh sync - no longer used (backend handles mesh discovery)
  async forceMeshSync(): Promise<void> {
    debugLog('⚠️ [NetworkService] forceMeshSync() is deprecated - use backend API');
  }
}

// Export singleton instance
export const networkService = new NetworkService();

// Auto-start status updates and periodic sync
networkService.startStatusUpdates();
