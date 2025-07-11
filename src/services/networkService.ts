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
  
  // Reactive trigger for UI updates
  private stationUpdateTrigger = ref(0);
  
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
    hostPort: 8080, // Hardcoded to 8080 for all instances
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
    this.initializeNetwork();
  }

  private async initializeNetwork(): Promise<void> {
    try {
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
    
    console.log('🔍 Scanning for Field Day stations on port 8080...');
    console.log(`🏠 Current instance: ${localStationId} on port 8080`);
    console.log(`🎯 All Field Day instances use hardcoded port 8080`);
    
    // Since all instances use port 8080, we scan different IP addresses on port 8080 only
    const scanPromises: Promise<NetworkStation | null>[] = [];
    
    // Try IPv4 localhost (since multiple instances on same machine will use different processes)
    // Note: Multiple instances on the same machine is not typical - usually different machines
    console.log('🎯 Checking for other Field Day stations on port 8080...');
    
    // Get the current machine's IP addresses to scan the local network
    try {
      const localIP = await this.getLocalIP();
      if (localIP && localIP !== '127.0.0.1') {
        console.log(`📡 Local IP detected: ${localIP}, scanning local network...`);
        
        // Scan the local network subnet (e.g., 192.168.1.x) for other Field Day stations
        const ipParts = localIP.split('.');
        if (ipParts.length === 4) {
          const baseIP = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
          
          // Scan common IP addresses in the subnet (1-254)
          // For performance, focus on common ranges
          const ipRanges = [
            ...Array.from({length: 10}, (_, i) => i + 1),    // .1 to .10
            ...Array.from({length: 20}, (_, i) => i + 100),  // .100 to .119
            ...Array.from({length: 55}, (_, i) => i + 200),  // .200 to .254
          ];
          
          for (const lastOctet of ipRanges) {
            const testIP = `${baseIP}.${lastOctet}`;
            if (testIP !== localIP) { // Don't scan ourselves
              scanPromises.push(this.checkStationAt(testIP, fieldDayPort));
            }
          }
        }
      }
    } catch (error) {
      console.log('Could not detect local IP for network scanning:', error);
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
    
    console.log(`✅ Found ${discoveredStations.length} Field Day stations on port 8080`);
    discoveredStations.forEach(station => {
      console.log(`  📡 ${station.callsign} (${station.designator}) at ${station.ip}:${station.port} - ${station.qsoCount} QSOs`);
    });
    
    return discoveredStations;
  }

  // Check if a Field Day station is running at the given address
  private async checkStationAt(ip: string, port: number): Promise<NetworkStation | null> {
    try {
      console.log(`🔎 Checking ${ip}:${port}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // Increased timeout
      
      const response = await fetch(`https://${ip}:${port}/api/station-info`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const stationInfo = await response.json();
        console.log(`✅ Found station at ${ip}:${port}:`, stationInfo);
        
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
      } else {
        console.log(`❌ No Field Day station at ${ip}:${port} (HTTP ${response.status})`);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.log(`⚠️ Error checking ${ip}:${port}:`, error.message);
      } else {
        console.log(`⏱️ Timeout checking ${ip}:${port}`);
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
    try {
      console.log(`Starting host on port ${port} (hardcoded)...`);
      
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
      
      console.log(`✅ Started hosting on port ${port}`);
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
          console.log(`📊 [HOST-MONITOR] Local QSO count: ${localQsoCount}`);
          
          const response = await fetch('/api/network/stations');
          if (response.ok) {
            const data = await response.json();
            
            // Update connected stations with fresh data from server
            this.connectedStations.splice(0, this.connectedStations.length, ...data.connectedStations);
            
            // Also update QSO counts by fetching from each connected station
            for (const station of this.connectedStations) {
              try {
                console.log(`🔍 [HOST-MONITOR] Fetching QSO count from ${station.callsign}-${station.designator} at ${station.ip}:${station.port}`);
                const qsoResponse = await fetch(`https://${station.ip}:${station.port}/api/station-info`);
                if (qsoResponse.ok) {
                  const stationInfo = await qsoResponse.json();
                  const remoteQsoCount = stationInfo.qsoCount || 0;
                  console.log(`📊 [HOST-MONITOR] Station ${station.callsign}-${station.designator} reports: ${remoteQsoCount} QSOs, ${stationInfo.score} pts`);
                  
                  // Check if QSO counts differ and trigger sync if needed
                  if (localQsoCount !== remoteQsoCount) {
                    console.log(`🔄 [HOST-MONITOR] QSO count mismatch detected!`);
                    console.log(`🔄 [HOST-MONITOR] Local (host): ${localQsoCount}, Remote (${station.callsign}-${station.designator}): ${remoteQsoCount}`);
                    
                    if (remoteQsoCount > localQsoCount) {
                      console.log(`🔄 [HOST-MONITOR] Remote has more QSOs, pulling from client...`);
                      
                      // Fetch QSOs directly from the remote client
                      try {
                        const clientQsoResponse = await fetch(`https://${station.ip}:${station.port}/api/qsos`);
                        if (clientQsoResponse.ok) {
                          const clientQsoData = await clientQsoResponse.json();
                          const clientQsos = clientQsoData.qsos || [];
                          
                          console.log(`📥 [HOST-MONITOR] Retrieved ${clientQsos.length} QSOs from ${station.callsign}-${station.designator}`);
                          
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
                              console.log(`➕ [HOST-MONITOR] Added client QSO: ${clientQso.call} (ID: ${clientQso.id})`);
                            }
                          });
                          
                          if (newQsosAdded > 0) {
                            console.log(`✅ [HOST-MONITOR] Added ${newQsosAdded} new QSOs from ${station.callsign}-${station.designator}`);
                            qsos.value = currentQsos;
                            
                            // Save to local file storage
                            const { fileStorage } = await import('@/services/fileStorage');
                            await fileStorage.saveQsoData(currentQsos);
                            console.log(`💾 [HOST-MONITOR] Saved ${currentQsos.length} QSOs to local file storage`);
                          }
                        }
                      } catch (clientQsoError) {
                        console.log(`❌ [HOST-MONITOR] Failed to fetch QSOs from ${station.callsign}-${station.designator}:`, clientQsoError);
                      }
                    } else if (localQsoCount > remoteQsoCount) {
                      console.log(`🔄 [HOST-MONITOR] Local has more QSOs, client should sync from host via its heartbeat...`);
                      // The client will pick this up via its own heartbeat cycle
                    }
                  } else {
                    console.log(`✅ [HOST-MONITOR] QSO counts match with ${station.callsign}-${station.designator} (${localQsoCount})`);
                  }
                  
                  station.qsoCount = remoteQsoCount;
                  station.score = stationInfo.score || 0;
                  station.lastSeen = Date.now();
                  station.online = true;
                } else {
                  console.log(`❌ [HOST-MONITOR] Failed to fetch station info from ${station.callsign}-${station.designator}: HTTP ${qsoResponse.status}`);
                }
              } catch (error) {
                station.online = false;
                console.log(`❌ [HOST-MONITOR] Failed to update stats for ${station.callsign}-${station.designator}:`, error);
              }
            }
            
            // Force Vue reactivity update
            await nextTick();
            this.triggerStationUpdate();
            
            console.log(`📡 [HOST-MONITOR] ${this.connectedStations.length} connected stations`);
            this.connectedStations.forEach(station => {
              console.log(`  📊 ${station.callsign}-${station.designator}: ${station.qsoCount} QSOs, ${station.score} pts, last seen: ${new Date(station.lastSeen).toLocaleTimeString()}`);
            });
            
            // Trigger Vue reactivity by notifying that stations have been updated
            console.log(`🔄 [HOST-MONITOR] Station monitoring update complete at ${new Date().toLocaleTimeString()}`);
          }
        } catch (error) {
          console.log('❌ [HOST-MONITOR] Failed to monitor stations:', error);
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
          
          console.log(`💓 [HEARTBEAT] Local QSO count: ${localQsoCount}`);
          
          // Get remote QSO count from host
          let remoteQsoCount = 0;
          let remoteQsos = [];
          try {
            const qsoResponse = await fetch(`https://${ip}:${port}/api/qsos`);
            if (qsoResponse.ok) {
              const qsoData = await qsoResponse.json();
              remoteQsos = qsoData.qsos || [];
              remoteQsoCount = remoteQsos.length;
              console.log(`💓 [HEARTBEAT] Remote QSO count: ${remoteQsoCount}`);
              
              // Check if counts differ and trigger sync if needed
              if (localQsoCount !== remoteQsoCount) {
                console.log(`🔄 [HEARTBEAT] QSO count mismatch detected! Local: ${localQsoCount}, Remote: ${remoteQsoCount}`);
                console.log(`🔄 [HEARTBEAT] Syncing QSOs from remote server...`);
                
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
                    console.log(`➕ [HEARTBEAT] Added remote QSO: ${remoteQso.call} (ID: ${remoteQso.id})`);
                  }
                });
                
                if (newQsosAdded > 0) {
                  console.log(`✅ [HEARTBEAT] Added ${newQsosAdded} new QSOs from remote server`);
                  qsos.value = currentQsos;
                  
                  // Save to local file storage
                  const { fileStorage } = await import('@/services/fileStorage');
                  await fileStorage.saveQsoData(currentQsos);
                  console.log(`💾 [HEARTBEAT] Saved ${currentQsos.length} QSOs to local file storage`);
                } else {
                  console.log(`📋 [HEARTBEAT] No new QSOs from remote server`);
                }
              } else {
                console.log(`✅ [HEARTBEAT] QSO counts match (${localQsoCount})`);
              }
            }
          } catch (qsoError) {
            console.log(`⚠️ [HEARTBEAT] Could not check remote QSO count:`, qsoError);
          }
          
          // Send heartbeat to host
          const heartbeatResponse = await fetch(`https://${ip}:${port}/api/network/heartbeat`, {
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
            console.log(`💓 [HEARTBEAT] Sent to host: ${localQsoCount} QSOs, ${score} pts`);
          }
          
        } catch (error) {
          console.log('❌ [HEARTBEAT] Failed:', error);
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
          const response = await fetch(`https://${ip}:${port}/api/station-info`);
          if (response.ok) {
            const stationInfo = await response.json();
            hostStation.qsoCount = stationInfo.qsoCount || 0;
            hostStation.score = stationInfo.score || 0;
            hostStation.lastSeen = Date.now();
            hostStation.online = true;
            
            console.log(`📊 Updated host stats: ${hostStation.callsign}-${hostStation.designator}: ${hostStation.qsoCount} QSOs, ${hostStation.score} pts`);
          }
        } catch (error) {
          if (this.connectedStations.length > 0) {
            this.connectedStations[0].online = false;
          }
          console.log('Failed to update host stats:', error);
        }
      }
    }, 5000); // Every 5 seconds
  }

  // Connect to a host station
  async connectToHost(address: string): Promise<boolean> {
    try {
      const [ip, portStr] = address.split(':');
      const port = parseInt(portStr) || 8080;
      
      console.log(`Connecting to host at ${address}...`);
      
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
        console.log('Could not determine current port, using default 8080');
      }
      
      console.log(`📡 Client registering with port: ${currentPort} (from URL: ${window.location.href})`);
      
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
      const registerResponse = await fetch(`https://${ip}:${port}/api/network/register`, {
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
      console.log('📡 Registration successful:', registerResult);
      
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
      
      console.log(`✅ Connected to host at ${address}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to host:', error);
      this.emit('network:error', { message: 'Failed to connect to host', error });
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
    
    // Stop periodic QSO refresh
    stopPeriodicQsoRefresh();
    
    this.isHost = false;
    this.status.isConnected = false;
    this.status.networkId = '';
    this.connectedStations.splice(0, this.connectedStations.length);
    
    // Clear auto-reconnect setting (manual disconnect)
    this.networkSettings.autoReconnect = false;
    this.saveNetworkSettings().catch(error => {
      console.error('Failed to save network settings:', error);
    });
    
    if (wasConnected) {
      this.emit('network:disconnected');
    }
    
    console.log('Disconnected from network');
  }

  // Sync QSOs from connected stations (polling)
  private async syncQsosFromStations(): Promise<void> {
    if (!this.status.isConnected) return;
    
    let anyStationReachable = false;
    
    for (const station of this.connectedStations) {
      try {
        const response = await fetch(`https://${station.ip}:${station.port}/api/qsos?since=${this.status.lastSync}`, {
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

    console.log('🔄 Starting periodic sync...');
    
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
          const response = await fetch(`https://${station.ip}:${station.port}/api/qsos?since=${lastSync}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.qsos && data.qsos.length > 0) {
              console.log(`📥 Syncing ${data.qsos.length} QSOs from ${station.callsign}-${station.designator}`);
              
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
          console.log(`⚠️ Failed to sync with ${station.callsign}-${station.designator}:`, error instanceof Error ? error.message : 'Unknown error');
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
    console.log('🚀 Performing initial full sync...');
    
    // Set last sync to 0 to get all QSOs
    const originalLastSync = this.status.lastSync;
    this.status.lastSync = 0;
    
    await this.performSync();
    
    // Restore last sync timestamp
    this.status.lastSync = originalLastSync;
    
    console.log('✅ Initial sync complete');
  }

  // Missing utility methods
  private async loadNetworkSettings(): Promise<void> {
    try {
      const settings = await fileStorage.getSettings();
      if (settings.networkSettings) {
        this.networkSettings = { ...this.networkSettings, ...settings.networkSettings };
        console.log('📋 Loaded network settings from file storage:', this.networkSettings);
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
      console.log('💾 Saved network settings to file storage');
    } catch (error) {
      console.error('❌ Failed to save network settings to file storage:', error);
    }
  }

  private attemptAutoReconnect(): void {
    console.log('🔄 Checking auto-reconnect...', {
      autoReconnect: this.networkSettings.autoReconnect,
      isHost: this.networkSettings.isHost,
      lastHostAddress: this.networkSettings.lastHostAddress,
      hostPort: this.networkSettings.hostPort
    });
    
    if (!this.networkSettings.autoReconnect) {
      console.log('⏸️ Auto-reconnect disabled');
      return;
    }
    
    console.log('🔄 Auto-reconnect enabled, attempting to restore connection...');
    
    if (this.networkSettings.isHost) {
      console.log(`🏠 Auto-starting host on port 8080 (hardcoded)...`);
      this.startHost();
    } else if (this.networkSettings.lastHostAddress) {
      console.log(`🔗 Auto-connecting to host at ${this.networkSettings.lastHostAddress}...`);
      this.connectToHost(this.networkSettings.lastHostAddress);
    } else {
      console.log('ℹ️ No previous connection to restore');
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
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
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
  updateNetworkMode(mode: 'host' | 'join' | 'auto', options: { hostPort?: number; hostAddress?: string } = {}): void {
    if (mode === 'host') {
      this.networkSettings.isHost = true;
      this.networkSettings.hostPort = options.hostPort || 8080;
      this.networkSettings.lastHostAddress = ''; // Clear join address when hosting
    } else if (mode === 'join' && options.hostAddress) {
      this.networkSettings.isHost = false;
      this.networkSettings.lastHostAddress = options.hostAddress;
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
      console.log('📡 Not broadcasting QSO - network not connected');
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

    console.log(`📡 Broadcasting QSO ${action}: ${qso.call} (isHost: ${this.isHost})`);
    
    if (this.isHost) {
      // Host: broadcast to all connected clients
      if (this.connectedStations.length === 0) {
        console.log('📡 Host: No connected clients to broadcast to');
        return;
      }
      
      console.log(`📡 Host: Broadcasting to ${this.connectedStations.length} connected clients`);
      this.connectedStations.forEach(async (station) => {
        try {
          console.log(`📤 Host->Client: Sending QSO ${action} to ${station.callsign}-${station.designator} at ${station.ip}:${station.port}`);
          
          const response = await fetch(`https://${station.ip}:${station.port}/api/qsos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(update)
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`✅ Host->Client: QSO ${action} sent to ${station.callsign}-${station.designator}:`, result);
          } else {
            console.log(`❌ Host->Client: Failed to send QSO ${action} to ${station.callsign}-${station.designator}: ${response.status}`);
          }
        } catch (error) {
          console.log(`⚠️ Host->Client: Network error sending QSO ${action} to ${station.callsign}-${station.designator}:`, error);
        }
      });
    } else {
      // Client: send update to host
      if (!this.networkSettings.lastHostAddress) {
        console.log('📡 Client: No host address available to send QSO update');
        return;
      }
      
      console.log(`📡 Client: Sending QSO ${action} to host at ${this.networkSettings.lastHostAddress}`);
      try {
        const response = await fetch(`https://${this.networkSettings.lastHostAddress}/api/qsos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(update)
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Client->Host: QSO ${action} sent to host:`, result);
        } else {
          console.log(`❌ Client->Host: Failed to send QSO ${action} to host: ${response.status}`);
        }
      } catch (error) {
        console.log(`⚠️ Client->Host: Network error sending QSO ${action} to host:`, error);
      }
    }
  }

  // Debug methods for testing and configuration
  async setTestConfiguration(callsign: string, designator: string): Promise<void> {
    console.log(`🔧 Setting test configuration: ${callsign} - ${designator}`);
    
    try {
      await fileStorage.saveStationConfig({ callsign, designator });
      console.log(`✅ Configuration saved to file storage. Testing station info...`);
    } catch (error) {
      console.error('Failed to save configuration to file storage:', error);
    }
    
    // Test the endpoint immediately
    fetch('/api/station-info')
      .then(r => r.json())
      .then(data => console.log('📡 Updated station info:', data))
      .catch(err => console.log('❌ Error testing station info:', err));
  }

  async checkStorage(): Promise<void> {
    console.log('\n🔍 === CURRENT STORAGE STATUS ===');
    console.log(`🌐 Port: ${window.location.port || 'default'}`);
    
    // Check file storage
    try {
      const stationConfig = await fileStorage.getStationConfig();
      const qsos = await fileStorage.getQsoData();
      const operators = await fileStorage.getOperators();
      const bonuses = await fileStorage.getBonuses();
      const settings = await fileStorage.getSettings();
      
      console.log('📁 FILE STORAGE:');
      console.log(`📡 Callsign: "${stationConfig.callsign}"`);
      console.log(`🏷️ Designator: "${stationConfig.designator}"`);
      console.log(`📋 QSOs: ${qsos.length}`);
      console.log(`👥 Operators: ${operators.length}`);
      console.log(`🎯 Bonuses: ${bonuses.length}`);
      console.log(`⚙️ Settings: Band=${settings.band || 'NOT SET'}, Operator=${settings.operator || 'NOT SET'}, Mode=${settings.mode || 'NOT SET'}`);
    } catch (error) {
      console.log('📁 FILE STORAGE: Failed to read');
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
    console.log('🧪 Manual discovery test starting...');
    console.log(`📍 Current location: ${window.location.href}`);
    console.log(`🔢 All Field Day instances use port 8080 (hardcoded)`);
    
    const fieldDayPort = 8080;
    
    console.log(`🔍 Testing Field Day port: ${fieldDayPort}`);
    console.log(`ℹ️ Note: Multiple instances should run on different machines, not different ports`);
    
    // Test localhost
    console.log(`\n� Testing localhost on port ${fieldDayPort}...`);
    const localStation = await this.checkStationAt('127.0.0.1', fieldDayPort);
    if (localStation) {
      console.log(`✅ SUCCESS: Found ${localStation.callsign}-${localStation.designator} at localhost:${fieldDayPort}`);
    } else {
      console.log(`❌ FAILED: No station at localhost:${fieldDayPort}`);
    }
    
    // Test current network if available
    try {
      const localIP = await this.getLocalIP();
      if (localIP && localIP !== '127.0.0.1') {
        console.log(`\n🔎 Testing local network ${localIP}:${fieldDayPort}...`);
        const networkStation = await this.checkStationAt(localIP, fieldDayPort);
        if (networkStation) {
          console.log(`✅ SUCCESS: Found ${networkStation.callsign}-${networkStation.designator} at ${localIP}:${fieldDayPort}`);
        } else {
          console.log(`❌ FAILED: No station at ${localIP}:${fieldDayPort}`);
        }
      }
    } catch (error) {
      console.log(`❌ ERROR: Could not test local network: ${error}`);
    }
    
    console.log('\n🏁 Manual discovery test complete');
  }

  // Manual test method for debugging - checks Field Day port 8080 only
  async testFieldDayPorts(): Promise<void> {
    console.log('🧪 Testing Field Day port 8080 (hardcoded for all instances)...');
    
    const fieldDayPort = 8080;
    console.log(`📍 All Field Day instances use port ${fieldDayPort}`);
    console.log(`ℹ️ Multiple instances should run on different machines, not ports`);
    
    // Try both IPv4 and IPv6 addresses on localhost
    const addresses = ['127.0.0.1', 'localhost', '[::1]'];
    console.log(`🎯 Testing addresses: ${addresses.join(', ')}`);
    
    for (const address of addresses) {
      console.log(`\n🔍 Testing ${address}:${fieldDayPort}...`);
      
      try {
        const url = `https://${address}:${fieldDayPort}/api/station-info`;
        console.log(`📡 Fetching: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`⏱️ Timeout after 3 seconds for ${address}:${fieldDayPort}`);
          controller.abort();
        }, 3000);
        
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Field-Day-Logger'
          }
        });
        
        clearTimeout(timeoutId);
        
        console.log(`📊 Response status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Station found at ${address}:${fieldDayPort}:`, data);
        } else {
          console.log(`❌ HTTP error ${response.status} for ${address}:${fieldDayPort}`);
        }
        
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.log(`⏱️ Request to ${address}:${fieldDayPort} timed out`);
          } else {
            console.log(`❌ Error connecting to ${address}:${fieldDayPort}:`, error.message);
          }
        }
      }
    }
    
    console.log('\n🔄 Testing complete. All Field Day instances use port 8080.');
  }

  // Comprehensive test for network discovery debugging
  async testNetworkDiscovery(): Promise<void> {
    console.log('\n🔬 === FIELD DAY NETWORK DISCOVERY TEST ===');
    console.log(`🌐 Current URL: ${window.location.href}`);
    console.log(`📍 All Field Day instances use port 8080 (hardcoded)`);
    
    // Test 1: Local station info
    console.log('\n1️⃣ Testing local station info...');
    try {
      const localUrl = `${window.location.origin}/api/station-info`;
      console.log(`📡 Requesting: ${localUrl}`);
      const localResponse = await fetch(localUrl);
      if (localResponse.ok) {
        const localData = await localResponse.json();
        console.log('✅ Local station info:', localData);
      } else {
        console.log(`❌ Local station info failed: ${localResponse.status}`);
      }
    } catch (error) {
      console.log('❌ Local station info error:', error);
    }
    
    // Test 2: Check Field Day port 8080 on different addresses
    console.log('\n2️⃣ Testing Field Day port 8080 on different addresses...');
    const fieldDayPort = 8080;
    
    // Test different URL formats (both IPv4 and IPv6)
    const urls = [
      `https://127.0.0.1:${fieldDayPort}/api/station-info`,
      `https://localhost:${fieldDayPort}/api/station-info`,
      `https://[::1]:${fieldDayPort}/api/station-info`
    ];
    
    for (const url of urls) {
      try {
        console.log(`   📡 Trying: ${url}`);
        
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
          console.log(`   ✅ Success! Station data:`, data);
        } else {
          console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        }
        
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.log(`   ⏱️ Timeout`);
          } else {
            console.log(`   ❌ Error: ${error.message}`);
          }
        }
      }
    }
    
    // Test 3: Run actual discovery
    console.log('\\n3. Running full discovery...');
    const stations = await this.discoverStations();
    console.log('Discovery result: ' + stations.length + ' stations found');
    stations.forEach(station => {
      console.log(`   📡 ${station.callsign}-${station.designator} at ${station.ip}:${station.port}`);
    });
    
    console.log('\\n✅ Network discovery test complete!');
    console.log('💡 If no stations were found, ensure instances are running on different machines.');
  }

  // Configuration methods using file storage
  async setConfiguration(callsign: string, designator: string): Promise<void> {
    console.log(`🔧 Setting configuration: ${callsign} - ${designator}`);
    
    // Use file storage instead of localStorage
    await fileStorage.saveStationConfig({ callsign, designator });
    
    console.log(`✅ Configuration saved to file storage. Testing station info...`);
    
    // Test the endpoint immediately
    try {
      const response = await fetch('/api/station-info');
      const data = await response.json();
      console.log('📡 Updated station info:', data);
    } catch (err) {
      console.log('❌ Error testing station info:', err);
    }
  }

  async checkFileStorage(): Promise<void> {
    console.log('\n🔍 === FILE STORAGE CHECK ===');
    console.log(`🌐 Port: ${window.location.port || 'default'}`);
    
    try {
      const storageInfo = await fileStorage.getStorageInfo();
      const stationConfig = await fileStorage.getStationConfig();
      const qsos = await fileStorage.getQsoData();
      
      console.log(`📊 Storage info:`, storageInfo);
      console.log(`📡 Callsign: "${stationConfig.callsign}"`);
      console.log(`🏷️ Designator: "${stationConfig.designator}"`);
      console.log(`📋 QSOs: ${qsos.length}`);
    } catch (error) {
      console.error('❌ Error checking file storage:', error);
    }
  }

  // Set up test data for specific ports
  async setupTestStation(callsign: string, designator: string, qsoCount: number = 0): Promise<void> {
    console.log(`🧪 Setting up test station: ${callsign}-${designator} with ${qsoCount} QSOs`);
    
    await fileStorage.setupTestConfiguration(callsign, designator, qsoCount);
    
    console.log(`✅ Test station configured. Testing station info...`);
    
    // Test the endpoint
    try {
      const response = await fetch('/api/station-info');
      const data = await response.json();
      console.log('📡 Station info after setup:', data);
    } catch (err) {
      console.log('❌ Error testing station info:', err);
    }
  }

  // Migration method to move from localStorage to file storage
  async migrateToFileStorage(): Promise<void> {
    console.log('🔄 Migrating from localStorage to file storage...');
    await fileStorage.migrateFromLocalStorage();
    console.log('✅ Migration complete');
  }

  // Public method to get current network mode for UI
  getCurrentNetworkMode(): 'host' | 'join' | 'auto' {
    if (this.networkSettings.isHost) {
      return 'host';
    } else if (this.networkSettings.lastHostAddress) {
      return 'join';
    } else {
      return 'auto';
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
}

// Export singleton instance
export const networkService = new NetworkService();

// Auto-start status updates and periodic sync
networkService.startStatusUpdates();
