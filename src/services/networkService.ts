import { ref, reactive, nextTick } from 'vue';
import { fileStorage } from './fileStorage';
import { startPeriodicQsoRefresh, stopPeriodicQsoRefresh } from '@/store/qso';
import { meshNetworkService, type MeshNode } from './meshNetworkService';

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

  // Start hosting a network
  async startHost(): Promise<boolean> {
    const port = 8080; // All instances use port 8080
    
    // In Electron, skip server-based networking and run in standalone mode
    if (this.isElectron()) {
      this.hostPort = port;
      this.isHost = false; // Don't act as a network host in Electron
      this.status.isConnected = false;
      this.status.networkId = 'ELECTRON-STANDALONE';
      return true;
    }
    
    try {
      
      // Register this instance as a host
      const response = await fetch('/api/network/host', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to register as host: ${response.status}`);
      }
      
      this.hostPort = port;
      this.isHost = true;
      this.connectedStations.splice(0); // Clear any existing connections
      
      // Mark as connected
      this.status.isConnected = true;
      this.status.networkId = `FD-HOST-${Date.now()}`;
      this.status.lastSync = Date.now();
      
      // Save network settings
      this.networkSettings.isHost = true;
      this.networkSettings.hostPort = port;
      this.networkSettings.autoReconnect = true;
      this.saveNetworkSettings().catch(error => {
        console.error('Failed to save network settings:', error);
      });
      
      // Cancel any pending reconnects
      this.cancelReconnect();
      
      // Emit network connected event
      this.emit('network:connected', { type: 'host', port });
      
      // Start periodic sync and station monitoring
      this.startPeriodicSync();
      this.startStationMonitoring();
      
      // Start periodic QSO refresh to sync data from network
      startPeriodicQsoRefresh();
      
      return true;
    } catch (error) {
      console.error('Failed to start host:', error);
      this.emit('network:error', { message: 'Failed to start host', error });
      return false;
    }
  }

  // Start monitoring connected stations (for hosts)
  private startStationMonitoring(): void {
    if (!this.isHost) return;
    
    // Poll for connected stations every 5 seconds
    setInterval(async () => {
      if (this.isHost && this.status.isConnected) {
        try {
          // Get our local QSO count first
          const localQsoData = await fileStorage.getQsoData();
          const localQsoCount = localQsoData.length;
          
          const response = await fetch('/api/network/stations');
          if (response.ok) {
            const data = await response.json();
            
            // Update connected stations with fresh data from server
            this.connectedStations.splice(0, this.connectedStations.length, ...data.connectedStations);
            
            // Also update QSO counts by fetching from each connected station
            for (const station of this.connectedStations) {
              try {
                const qsoResponse = await this.fetchWithProtocolFallback(`https://${station.ip}:${station.port}/api/station-info`);
                if (qsoResponse.ok) {
                  const stationInfo = await qsoResponse.json();
                  const remoteQsoCount = stationInfo.qsoCount || 0;
                  
                  // Check if QSO counts differ and trigger sync if needed
                  if (localQsoCount !== remoteQsoCount) {
                    
                    if (remoteQsoCount > localQsoCount) {
                      
                      // Fetch QSOs directly from the remote client
                      try {
                        const clientQsoResponse = await this.fetchWithProtocolFallback(`https://${station.ip}:${station.port}/api/qsos`);
                        if (clientQsoResponse.ok) {
                          const clientQsoData = await clientQsoResponse.json();
                          const clientQsos = clientQsoData.qsos || [];
                          
                          
                          // Merge client QSOs with local QSOs
                          const { qsos } = await import('@/store/qso');
                          const currentQsos = [...qsos.value];
                          
                          // Create a map of existing QSOs by ID for quick lookup
                          const existingQsoMap = new Map();
                          currentQsos.forEach(qso => {
                            if (qso.id) {
                              existingQsoMap.set(qso.id, qso);
                            }
                          });
                          
                          // Add client QSOs that don't exist locally
                          let newQsosAdded = 0;
                          clientQsos.forEach((clientQso: any) => {
                            if (clientQso.id && !existingQsoMap.has(clientQso.id)) {
                              currentQsos.push(clientQso);
                              newQsosAdded++;
                            }
                          });
                          
                          if (newQsosAdded > 0) {
                            qsos.value = currentQsos;
                            
                            // Save to local file storage
                            const { fileStorage } = await import('@/services/fileStorage');
                            await fileStorage.saveQsoData(currentQsos);
                          }
                        }
                      } catch (clientQsoError) {
                      }
                    } else if (localQsoCount > remoteQsoCount) {
                      // The client will pick this up via its own heartbeat cycle
                    }
                  } else {
                  }
                  
                  station.qsoCount = remoteQsoCount;
                  station.score = stationInfo.score || 0;
                  station.lastSeen = Date.now();
                  station.online = true;
                } else {
                }
              } catch (error) {
                station.online = false;
              }
            }
            
            // Force Vue reactivity update
            await nextTick();
            this.triggerStationUpdate();
            
            this.connectedStations.forEach(station => {
            });
            
            // Trigger Vue reactivity by notifying that stations have been updated
          }
        } catch (error) {
        }
      }
    }, 5000);
  }

  // Start heartbeat (for clients)
  private startHeartbeat(hostAddress: string): void {
    if (this.isHost) return;
    
    setInterval(async () => {
      if (!this.isHost && this.status.isConnected) {
        try {
          const localStationId = await this.getLocalStationId();
          const [ip, port] = hostAddress.split(':');
          
          // Get current local QSO stats for heartbeat
          const qsoData = await fileStorage.getQsoData();
          const localQsoCount = qsoData.length;
          const score = qsoData.reduce((total, qso) => {
            return total + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1);
          }, 0);
          
          
          // Check for new messages from host
          try {
            const messageResponse = await this.fetchWithProtocolFallback(`https://${ip}:${port}/api/messages?limit=20`);
            if (messageResponse.ok) {
              const messageData = await messageResponse.json();
              const remoteMessages = messageData.messages || [];
              
              // Emit new messages to the local message component
              remoteMessages.forEach((message: any) => {
                this.emit('message:received', message);
              });
            }
          } catch (messageError) {
          }
          
          // Get remote QSO count from host
          let remoteQsoCount = 0;
          let remoteQsos = [];
          try {
            const qsoResponse = await this.fetchWithProtocolFallback(`https://${ip}:${port}/api/qsos`);
            if (qsoResponse.ok) {
              const qsoData = await qsoResponse.json();
              remoteQsos = qsoData.qsos || [];
              remoteQsoCount = remoteQsos.length;
              
              // Check if counts differ and trigger sync if needed
              if (localQsoCount !== remoteQsoCount) {
                
                // Instead of using refreshQsosFromServer (which only gets local server data),
                // directly merge the remote QSOs with local ones
                const { qsos } = await import('@/store/qso');
                const currentQsos = [...qsos.value];
                
                // Create a map of existing QSOs by ID for quick lookup
                const existingQsoMap = new Map();
                currentQsos.forEach(qso => {
                  if (qso.id) {
                    existingQsoMap.set(qso.id, qso);
                  }
                });
                
                // Add remote QSOs that don't exist locally
                let newQsosAdded = 0;
                remoteQsos.forEach((remoteQso: any) => {
                  if (remoteQso.id && !existingQsoMap.has(remoteQso.id)) {
                    currentQsos.push(remoteQso);
                    newQsosAdded++;
                  }
                });
                
                if (newQsosAdded > 0) {
                  qsos.value = currentQsos;
                  
                  // Save to local file storage
                  const { fileStorage } = await import('@/services/fileStorage');
                  await fileStorage.saveQsoData(currentQsos);
                } else {
                }
              } else {
              }
            }
          } catch (qsoError) {
          }
          
          // Send heartbeat to host
          const heartbeatResponse = await this.fetchWithProtocolFallback(`https://${ip}:${port}/api/network/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              stationId: localStationId,
              qsoCount: localQsoCount,
              score: score,
              timestamp: Date.now()
            })
          });
          
          if (heartbeatResponse.ok) {
          }
          
        } catch (error) {
        }
      }
    }, 10000); // Every 10 seconds
  }

  // Start monitoring for client (to update host stats)
  private startClientMonitoring(hostAddress: string): void {
    if (this.isHost) return;
    
    setInterval(async () => {
      if (!this.isHost && this.status.isConnected && this.connectedStations.length > 0) {
        try {
          const [ip, port] = hostAddress.split(':');
          const hostStation = this.connectedStations[0]; // Should be the host
          
          // Get updated host stats
          const response = await this.fetchWithProtocolFallback(`https://${ip}:${port}/api/station-info`);
          if (response.ok) {
            const stationInfo = await response.json();
            hostStation.qsoCount = stationInfo.qsoCount || 0;
            hostStation.score = stationInfo.score || 0;
            hostStation.lastSeen = Date.now();
            hostStation.online = true;
            
          }
        } catch (error) {
          if (this.connectedStations.length > 0) {
            this.connectedStations[0].online = false;
          }
        }
      }
    }, 5000); // Every 5 seconds
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
      
      // Get our station info to register with the host
      const localStationId = await this.getLocalStationId();
      const stationConfig = await fileStorage.getStationConfig();
      
      // Get current QSO data for accurate registration
      const qsoData = await fileStorage.getQsoData();
      const qsoCount = qsoData.length;
      const score = qsoData.reduce((total, qso) => {
        return total + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1);
      }, 0);
      
      // Get our current port from the URL or API call
      let currentPort = 8080;
      try {
        // Get the current port by making a request to our own server
        const serverResponse = await fetch('/api/station-info');
        if (serverResponse.ok) {
          const serverInfo = await serverResponse.json();
          if (serverInfo.port) {
            currentPort = serverInfo.port;
          }
        }
        
        // Fallback: extract from current URL
        if (!currentPort || currentPort === 8080) {
          const urlParts = window.location.href.split(':');
          if (urlParts.length >= 3) {
            const portPart = urlParts[2].split('/')[0];
            const extractedPort = parseInt(portPart);
            if (extractedPort && extractedPort > 0) {
              currentPort = extractedPort;
            }
          }
        }
      } catch (error) {
      }
      
      
      const clientInfo = {
        id: localStationId,
        callsign: stationConfig.callsign,
        designator: stationConfig.designator,
        ip: 'localhost', // Client IP from host's perspective
        port: currentPort,
        qsoCount: qsoCount,
        score: score,
        online: true,
        software: 'K8TAR Field Day Logger',
        version: '1.0.0'
      };
      
      // Register with the host
      const registerResponse = await this.fetchWithProtocolFallback(`https://${ip}:${port}/api/network/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(clientInfo)
      });
      
      if (!registerResponse.ok) {
        throw new Error(`Failed to register with host: ${registerResponse.status}`);
      }
      
      const registerResult = await registerResponse.json();
      
      this.isHost = false;
      this.connectedStations.splice(0); // Clear existing connections
      
      // Add the host station to our connected list (not ourselves)
      this.connectedStations.push(hostStation);
      
      this.status.isConnected = true;
      this.status.networkId = `FD-CLIENT-${Date.now()}`;
      this.status.lastSync = Date.now();
      
      // Save network settings
      this.networkSettings.isHost = false;
      this.networkSettings.lastHostAddress = address;
      this.networkSettings.autoReconnect = true;
      this.networkSettings.lastConnectedStations = [hostStation];
      this.saveNetworkSettings().catch(error => {
        console.error('Failed to save network settings:', error);
      });
      
      // Cancel any pending reconnects
      this.cancelReconnect();
      
      // Emit network connected event
      this.emit('network:connected', { type: 'client', address, station: hostStation });
      
      // Start periodic sync and heartbeat
      this.startPeriodicSync();
      this.startHeartbeat(address);
      
      // Start monitoring for host updates (clients need to see host stats too)
      this.startClientMonitoring(address);
      
      // Start periodic QSO refresh to sync data from network
      startPeriodicQsoRefresh();
      
      // Perform initial full sync
      await this.performInitialSync();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to host:', error);
      this.status.isConnected = false;
      return false;
    }
  }

  private disconnect(): void {
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
    
    
    // Check the last network mode first, defaulting to mesh
    const lastMode = this.networkSettings.lastNetworkMode || 'mesh';
    
    if (lastMode === 'mesh') {
      this.startMesh();
    } else if (this.networkSettings.isHost) {
      this.startHost();
    } else if (this.networkSettings.lastHostAddress) {
      this.connectToHost(this.networkSettings.lastHostAddress);
    } else {
      this.startMesh();
    }
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

    
    if (this.isHost) {
      // Host: broadcast to all connected clients
      if (this.connectedStations.length === 0) {
        return;
      }
      
      this.connectedStations.forEach(async (station) => {
        try {
          
          const response = await this.fetchWithProtocolFallback(`https://${station.ip}:${station.port}/api/qsos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(update)
          });

          if (response.ok) {
            const result = await response.json();
          } else {
          }
        } catch (error) {
        }
      });
    } else {
      // Client: send update to host
      if (!this.networkSettings.lastHostAddress) {
        return;
      }
      
      try {
        const response = await this.fetchWithProtocolFallback(`https://${this.networkSettings.lastHostAddress}/api/qsos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(update)
        });

        if (response.ok) {
          const result = await response.json();
        } else {
        }
      } catch (error) {
      }
    }
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

  // Public method to get current network mode for UI
  getCurrentNetworkMode(): 'host' | 'join' | 'auto' | 'mesh' {
    if (meshNetworkService.isMeshActive()) {
      return 'mesh';
    } else if (this.networkSettings.isHost) {
      return 'host';
    } else if (this.networkSettings.lastHostAddress) {
      return 'join';
    } else {
      // Return the last saved mode, defaulting to mesh
      return (this.networkSettings.lastNetworkMode as 'host' | 'join' | 'auto' | 'mesh') || 'mesh';
    }
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
    // In Electron, skip mesh networking
    if (this.isElectron()) {
      return false;
    }

    try {
      
      // Stop any existing connections first
      this.disconnect();
      
      // Clear any duplicate stations that might have accumulated
      this.removeDuplicateStations();
      
      // Start mesh network
      const success = await meshNetworkService.startMesh();
      
      if (success) {
        
        // Clean up any existing duplicates before starting fresh
        this.removeDuplicateStations();
        
        // Update network status to reflect mesh mode (use the persistent network ID directly)
        this.status.isConnected = true;
        this.status.networkId = meshNetworkService.getMeshStatus().nodeId;
        this.status.lastSync = Date.now();
        
        // Set up mesh event handlers
        this.setupMeshEventHandlers();
        
        this.emit('network:connected', { type: 'mesh' });
      } else {
      }
      
      return success;
    } catch (error) {
      console.error('❌ NetworkService: Failed to start mesh network:', error);
      console.error('❌ NetworkService: Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ NetworkService: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      this.emit('network:error', { message: 'Failed to start mesh network', error });
      return false;
    }
  }

  async stopMesh(): Promise<void> {
    try {
      
      await meshNetworkService.stopMesh();
      
      // Clear all connected stations when mesh stops
      this.connectedStations.splice(0);
      
      // Update network status
      this.status.isConnected = false;
      this.status.networkId = '';
      
      this.emit('network:disconnected', { type: 'mesh' });
    } catch (error) {
      console.error('❌ Failed to stop mesh network:', error);
    }
  }

  private setupMeshEventHandlers(): void {
    // Handle mesh node discovery
    meshNetworkService.on('mesh:node-discovered', (node: MeshNode) => {
      
      // Skip our own node by comparing network instance IDs
      if (node.id === this.networkInstanceId) {
        return;
      }
      
      // Convert mesh node to network station format
      const station: NetworkStation = {
        id: node.id,
        callsign: node.callsign,
        designator: node.designator,
        ip: node.ip,
        port: node.port,
        qsoCount: node.qsoCount,
        score: node.score,
        online: node.online,
        lastSeen: node.lastSeen
      };
      
      // More robust duplicate check - check by station identity (callsign+designator), not IP
      // Same station can have multiple IPs (localhost + local network), so dedupe by station identity only
      const stationKey = `${station.callsign}-${station.designator}`;
      const existingStationIndex = this.connectedStations.findIndex(s => 
        `${s.callsign}-${s.designator}` === stationKey
      );
      
      if (existingStationIndex >= 0) {
        // Update existing station with new info, prefer non-localhost IP
        const existing = this.connectedStations[existingStationIndex];
        
        // Prefer non-localhost IP for display
        if (existing.ip === '127.0.0.1' && station.ip !== '127.0.0.1') {
          existing.ip = station.ip;
          existing.id = station.id;
        }
        
        // Update other fields
        existing.qsoCount = station.qsoCount;
        existing.score = station.score;
        existing.online = station.online;
        existing.lastSeen = station.lastSeen;
        
        return; // Skip adding duplicate
      }
      
      // Only add if truly new
      this.connectedStations.push(station);
      
      this.triggerStationUpdate();
    });

    // Handle mesh node removal
    meshNetworkService.on('mesh:node-removed', (node: MeshNode) => {
      
      const index = this.connectedStations.findIndex(s => s.id === node.id);
      if (index >= 0) {
        this.connectedStations.splice(index, 1);
        this.triggerStationUpdate();
      }
    });

    // Handle mesh sync completion
    meshNetworkService.on('mesh:sync-completed', (data: any) => {
      
      const meshStatus = meshNetworkService.getMeshStatus();
      this.status.lastSync = meshStatus.lastSync;
      this.status.syncedQsos = meshStatus.syncedQsos;
      this.status.conflictsResolved = meshStatus.conflictsResolved;
    });

    // Handle mesh health changes
    meshNetworkService.on('mesh:health-changed', (health: string) => {
      
      // Keep the same network ID regardless of health (no more degraded suffix)
      const meshStatus = meshNetworkService.getMeshStatus();
      this.status.networkId = meshStatus.nodeId;
    });
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

  // Get mesh nodes for UI
  getMeshNodes(): MeshNode[] {
    return meshNetworkService.getDiscoveredNodes();
  }

  // Get mesh status for UI
  getMeshStatus() {
    return meshNetworkService.getMeshStatus();
  }

  // Force mesh discovery refresh
  async refreshMeshDiscovery(): Promise<void> {
    await meshNetworkService.refreshDiscovery();
  }

  // Force mesh sync
  async forceMeshSync(): Promise<void> {
    await meshNetworkService.forceMeshSync();
  }
}

// Export singleton instance
export const networkService = new NetworkService();

// Auto-start status updates and periodic sync
networkService.startStatusUpdates();
