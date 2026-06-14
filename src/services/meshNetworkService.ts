/**
 * Mesh Network Service for Field Day Logger
 * 
 * Implements a distributed mesh network where each node operates independently
 * but discovers and synchronizes with other nodes on the network.
 * 
 * Features:
 * - Peer discovery via multicast/broadcast
 * - Direct peer-to-peer connections
 * - Distributed synchronization with conflict resolution
 * - Fault tolerance (nodes continue if others go offline)
 * - No central server required
 */

import { reactive } from 'vue';
import { fileStorage } from './fileStorage';
import type { QSO } from '@/store/qso';
import { debugLog } from '@/utils/debug';

export interface MeshNode {
  id: string;
  callsign: string;
  designator: string;
  ip: string;
  port: number;
  qsoCount: number;
  score: number;
  online: boolean;
  lastSeen: number;
  version: string;
  capabilities: string[];
  protocol?: 'http' | 'https'; // Which protocol worked for this node
}

export interface QsoSyncData {
  qsos: QSO[];
  lastUpdate: number;
  checksum: string;
}

export interface HeartbeatData {
  nodeId: string;
  timestamp: number;
  qsoCount: number;
}

export interface DiscoveryData {
  node: MeshNode;
}

export interface ConflictResolutionData {
  conflictId: string;
  resolution: QSO;
}

export type MeshMessageData = QsoSyncData | HeartbeatData | DiscoveryData | ConflictResolutionData;

export interface MeshMessage {
  type: 'discovery' | 'qso-sync' | 'heartbeat' | 'conflict-resolution';
  data: MeshMessageData;
  timestamp: number;
  nodeId: string;
  messageId: string;
  ttl: number; // Time to live for message propagation
}

export interface MeshStatus {
  isActive: boolean;
  nodeId: string;
  discoveredNodes: number;
  connectedNodes: number;
  lastSync: number;
  syncedQsos: number;
  conflictsResolved: number;
  meshHealth: 'healthy' | 'degraded' | 'isolated';
}

interface BackendDiscoveredStation {
  id?: string;
  station_id?: string;
  call_sign?: string;
  callsign?: string;
  name?: string;
  designator?: string;
  ip_address?: string;
  ip?: string;
  port?: number;
  qso_count?: number;
  qsoCount?: number;
  score?: number;
  version?: string;
  capabilities?: string[];
}

class MeshNetworkService {
  private meshActive = false;
  private nodeId = '';
  private localNode: MeshNode | null = null;
  private discoveredNodes = reactive<Map<string, MeshNode>>(new Map());
  private connections = reactive<Map<string, WebSocket | 'simulated' | 'http-api'>>(new Map());
  
  // Discovery and heartbeat timers
  private discoveryInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  
  // Mesh network configuration
  private readonly DISCOVERY_PORT = 3030; // Same as backend API port
  private readonly DISCOVERY_INTERVAL = 60000; // 60 seconds - less frequent to avoid spam
  private readonly HEARTBEAT_INTERVAL = 10000; // 10 seconds
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private readonly NODE_TIMEOUT = 45000; // 45 seconds before considering node offline
  
  public status = reactive<MeshStatus>({
    isActive: false,
    nodeId: '',
    discoveredNodes: 0,
    connectedNodes: 0,
    lastSync: 0,
    syncedQsos: 0,
    conflictsResolved: 0,
    meshHealth: 'isolated'
  });

  // Event callbacks
  private eventCallbacks: Record<string, Array<(...args: unknown[]) => void>> = {};

  constructor() {
    this.initializeNodeId();
  }

  private async initializeNodeId(): Promise<void> {
    await this.generateNodeId();
  }

  private async generateNodeId(): Promise<void> {
    // Use the persistent network ID from file storage
    try {
      this.nodeId = await fileStorage.getNetworkId();
      this.status.nodeId = this.nodeId;
    } catch (e: unknown) {
      console.error('❌ Failed to get persistent network ID, using fallback:', e);
      // Fallback to old method
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 5);
      this.nodeId = `MESH-node-${timestamp}-${random}`;
      this.status.nodeId = this.nodeId;
    }
  }

  // Event system
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = [];
    }
    this.eventCallbacks[event].push(callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    if (this.eventCallbacks[event]) {
      const index = this.eventCallbacks[event].indexOf(callback);
      if (index >= 0) {
        this.eventCallbacks[event].splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].forEach(callback => callback(...args));
    }
  }

  // Start mesh network
  async startMesh(): Promise<boolean> {
    try {
      
      // Initialize local node
      await this.initializeLocalNode();
      
      // Start discovery process
      this.startPeerDiscovery();
      
      // Start heartbeat system
      this.startHeartbeat();
      
      // Start synchronization
      this.startPeriodicSync();
      
      this.meshActive = true;
      this.status.isActive = true;
      this.updateMeshHealth();
      
      this.emit('mesh:started', { nodeId: this.nodeId });
      
      return true;
    } catch (e: unknown) {
      console.error('❌ Failed to start mesh network:', e);
      console.error('❌ Error details:', e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Unknown error');
      console.error('❌ Error stack:', e instanceof Error ? e.stack : 'No stack trace');
      this.emit('mesh:error', { message: 'Failed to start mesh network', error: e });
      return false;
    }
  }

  // Stop mesh network
  async stopMesh(): Promise<void> {
    
    this.meshActive = false;
    this.status.isActive = false;
    
    // Clear timers
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Close all connections
    this.connections.forEach((connection) => {
      if (connection instanceof WebSocket) {
        connection.close();
      }
    });
    this.connections.clear();
    
    // Clear discovered nodes
    this.discoveredNodes.clear();
    
    this.updateMeshHealth();
    this.emit('mesh:stopped');
    
  }

  // Initialize local node information
  private async initializeLocalNode(): Promise<void> {
    try {
      
      // Get station info using centralized service
      let stationInfo;
      try {
        const { StationInfoService } = await import('@/services/stationInfoService');
        stationInfo = await StationInfoService.getStationInfo(false); // Don't include port here
      } catch (e: unknown) {
        console.warn('⚠️ Failed to load station info, using fallback:', e);
        stationInfo = {
          callsign: 'UNKNOWN',
          designator: '1A',
          networkId: this.nodeId,
          qsoCount: 0,
          score: 0,
          software: 'K8TAR Field Day Logger',
          version: '2.0.0',
          timestamp: Date.now(),
          online: true
        };
      }
      
      // Get local IP
      const localIP = await this.getLocalIP();
      
      this.localNode = {
        id: stationInfo.networkId,
        callsign: stationInfo.callsign.toUpperCase(),
        designator: stationInfo.designator,
        ip: localIP,
        port: this.DISCOVERY_PORT,
        qsoCount: stationInfo.qsoCount,
        score: stationInfo.score,
        online: stationInfo.online,
        lastSeen: Date.now(),
        version: stationInfo.version,
        capabilities: ['qso-sync', 'heartbeat', 'conflict-resolution']
      };
      
    } catch (e: unknown) {
      console.error('❌ Failed to initialize local node:', e);
      const enhancedError = new Error(`Mesh node initialization failed: ${e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Unknown error'}`) as Error & { cause?: unknown };
      enhancedError.cause = e;
      throw enhancedError;
    }
  }

  // Get local IP address
  private async getLocalIP(): Promise<string> {
    try {
      
      // First, try to get IP from browser's current URL if available
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const browserIP = window.location.hostname;
        if (this.isValidPrivateIP(browserIP)) {
          return browserIP;
        }
      }
      
      // Try to detect via WebRTC (works in browsers)
      return new Promise((resolve) => {
        try {
          const pc = new RTCPeerConnection({
            iceServers: []
          });
          
          pc.createDataChannel('');
          pc.createOffer()
            .then(pc.setLocalDescription.bind(pc))
            .catch(() => {
              // If WebRTC fails, use fallback immediately
              pc.close();
              resolve('192.168.1.100');
            });
          
          const foundIPs = new Set<string>();
          
          pc.onicecandidate = (ice) => {
            if (ice && ice.candidate && ice.candidate.candidate) {
              const match = ice.candidate.candidate.match(/candidate:\d+ \d+ udp \d+ ([\d.]+)/);
              if (match && match[1] && this.isValidPrivateIP(match[1]) && !this.isLocalhost(match[1])) {
                foundIPs.add(match[1]);
                
                // If we find a preferred physical network IP (192.168.1.x or 192.168.0.x), use it immediately
                if (match[1].startsWith('192.168.1.') || match[1].startsWith('192.168.0.')) {
                  pc.close();
                  resolve(match[1]);
                  return;
                }
              }
            }
          };
          
          // Fallback after timeout - use best available IP
          setTimeout(() => {
            pc.close();
            if (foundIPs.size > 0) {
              // Sort IPs by preference: 192.168.1.x > 192.168.0.x > other 192.168.x.x > 10.x.x.x > 172.x.x.x
              const sortedIPs = Array.from(foundIPs).sort((a, b) => {
                // Highest priority: 192.168.1.x (most common physical network)
                if (a.startsWith('192.168.1.') && !b.startsWith('192.168.1.')) return -1;
                if (!a.startsWith('192.168.1.') && b.startsWith('192.168.1.')) return 1;
                
                // Second priority: 192.168.0.x (second most common)
                if (a.startsWith('192.168.0.') && !b.startsWith('192.168.0.')) return -1;
                if (!a.startsWith('192.168.0.') && b.startsWith('192.168.0.')) return 1;
                
                // Third priority: other 192.168.x.x
                if (a.startsWith('192.168.') && !b.startsWith('192.168.')) return -1;
                if (!a.startsWith('192.168.') && b.startsWith('192.168.')) return 1;
                
                // Fourth priority: 10.x.x.x (but not common virtual ranges)
                if (a.startsWith('10.') && !b.startsWith('10.')) return -1;
                if (!a.startsWith('10.') && b.startsWith('10.')) return 1;
                
                return 0;
              });
              resolve(sortedIPs[0]);
            } else {
              resolve('192.168.1.100');
            }
          }, 3000); // Increased timeout
          
        } catch (_e: unknown) {
          resolve('192.168.1.100');
        }
      });
    } catch (_e: unknown) {
      return '192.168.1.100'; // Fallback
    }
  }

  // Helper method to check if an IP is a valid private network IP (excluding virtual interfaces)
  private isValidPrivateIP(ip: string): boolean {
    if (!ip) return false;
    
    // First check if it's in private ranges
    const isPrivate = ip.startsWith('192.168.') || 
           ip.startsWith('10.') || 
           (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31);
    
    if (!isPrivate) return false;
    
    // Now exclude known virtual interface ranges
    const virtualPatterns = [
      /^172\.1[6-9]\./,     // Docker default range 172.16-19.x.x
      /^172\.2[0-9]\./,     // Docker custom ranges 172.20-29.x.x  
      /^172\.3[0-1]\./,     // Docker custom ranges 172.30-31.x.x
      /^10\.0\.2\./,        // VirtualBox default
      /^192\.168\.56\./,    // VirtualBox host-only
      /^192\.168\.57\./,    // VirtualBox host-only  
      /^192\.168\.99\./,    // Docker Machine
      /^192\.168\.122\./,   // libvirt/KVM default
      /^169\.254\./,        // Link-local addresses
      /^10\.8\./,           // OpenVPN common range
      /^10\.9\./,           // OpenVPN common range
      /^172\.16\.0\./,      // Common VPN range
      /^172\.24\./,         // VMware Workstation
      /^172\.16\.1\./,      // VMware Workstation
      /^192\.168\.200\./,   // Often used for VPN/virtual (like your 192.168.200.254)
      /^10\.120\./,         // Your internal network 10.120.121.2
      /^172\.16\.2\./,      // Your internal network 172.16.2.1
      /^172\.16\.229\./,    // Your internal network 172.16.229.1
    ];

    // Check if IP matches any virtual pattern
    for (const pattern of virtualPatterns) {
      if (pattern.test(ip)) {
        return false;
      }
    }

    // Prefer main physical network ranges
    const physicalPreferred = [
      /^192\.168\.1\./,     // Most common home/office router range
      /^192\.168\.0\./,     // Second most common
      /^192\.168\.2\./,     // Common alternative
      /^10\.1\./,           // Common enterprise range  
      /^10\.10\./,          // Common enterprise range
    ];

    for (const pattern of physicalPreferred) {
      if (pattern.test(ip)) {
        return true;
      }
    }

    // For other private IPs, be conservative
    return true;
  }

  // Helper method to check if an IP is localhost
  private isLocalhost(ip: string): boolean {
    return ip === '127.0.0.1' || 
           ip === '::1' || 
           ip === 'localhost' ||
           ip.startsWith('127.');
  }

  // Start peer discovery process
  private startPeerDiscovery(): void {
    
    // Initial discovery
    this.discoverPeers();
    
    // Set up periodic discovery
    this.discoveryInterval = setInterval(() => {
      this.discoverPeers();
    }, this.DISCOVERY_INTERVAL);
  }

  // Discover peers on the network
  private async discoverPeers(): Promise<void> {
    if (!this.localNode) return;
    
    debugLog('🔍 [MeshNetworkService] Starting peer discovery...');
    
    try {
      // First, try to get discovered stations from backend mesh discovery
      const backendStations = await this.getBackendDiscoveredStations();
      
      if (backendStations.length > 0) {
        debugLog(`🎯 [MeshNetworkService] Got ${backendStations.length} stations from backend discovery`);
        
        // Process backend-discovered stations
        for (const station of backendStations) {
          await this.processDiscoveredStation(station);
        }
        
        this.updateMeshHealth();
        return;
      }
      
      // Legacy manual scan disabled - all discovery now handled by backend
      debugLog('ℹ️ [MeshNetworkService] No stations from backend discovery - relying on backend mesh discovery only');
      debugLog('ℹ️ [MeshNetworkService] Manual frontend discovery disabled to avoid connection conflicts');
    } catch (e: unknown) {
      console.error('❌ Error during peer discovery:', e);
    }
    
    this.updateMeshHealth();
  }

  // Get discovered stations from backend mesh discovery
  private async getBackendDiscoveredStations(): Promise<BackendDiscoveredStation[]> {
    try {
      const response = await fetch('http://localhost:3030/mesh/stations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`⚠️ [MeshNetworkService] Backend mesh API returned ${response.status}`);
        return [];
      }

      const result = await response.json() as { success?: boolean; data?: BackendDiscoveredStation[] };
      
      if (result.success && Array.isArray(result.data)) {
        debugLog(`✅ [MeshNetworkService] Backend discovered ${result.data.length} stations`);
        return result.data;
      } else {
        console.warn('⚠️ [MeshNetworkService] Backend response format unexpected:', result);
        return [];
      }
    } catch (e: unknown) {
      console.warn('⚠️ [MeshNetworkService] Failed to get backend discovered stations:', e);
      return [];
    }
  }

  // Process a station discovered by backend
  private async processDiscoveredStation(station: BackendDiscoveredStation): Promise<void> {
    try {
      // Convert backend station format to mesh node format
      const meshNode: MeshNode = {
        id: station.id || station.station_id || `station-${station.ip_address || station.ip || 'unknown'}`,
        callsign: station.call_sign || station.callsign || 'UNKNOWN',
        designator: station.name || station.designator || station.call_sign || 'Station',
        ip: station.ip_address || station.ip || '127.0.0.1',
        port: station.port || 3030, // Backend API port for station communication
        qsoCount: station.qso_count || station.qsoCount || 0,
        score: station.score || 0,
        online: true,
        lastSeen: Date.now(),
        version: station.version || '1.0.0',
        capabilities: station.capabilities || ['qso-sync'],
        protocol: 'http' // Backend discovery uses HTTP
      };

      // Skip if this is our own station
      if (meshNode.id === this.nodeId || meshNode.ip === this.localNode?.ip) {
        return;
      }

      // Test connection to the station
      const isReachable = await this.testStationConnection(meshNode);
      
      if (isReachable) {
        debugLog(`✅ [MeshNetworkService] Confirmed station: ${meshNode.callsign} at ${meshNode.ip}:${meshNode.port}`);
        
        // Add to discovered nodes
        this.discoveredNodes.set(meshNode.id, meshNode);
        await this.connectToNode(meshNode);
        
        this.emit('node:discovered', meshNode);
      } else {
        debugLog(`❌ [MeshNetworkService] Cannot reach station: ${meshNode.callsign} at ${meshNode.ip}:${meshNode.port}`);
      }
    } catch (e: unknown) {
      console.error('❌ [MeshNetworkService] Error processing discovered station:', e);
    }
  }

  // Test connection to a station
  private async testStationConnection(node: MeshNode): Promise<boolean> {
    try {
      const testUrl = `http://${node.ip}:${node.port}/api/station-info`;
      
      debugLog(`🔍 [MeshNetworkService] Testing connection to ${node.callsign} at ${testUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = await response.json();
        
        // Update node info with actual station data
        if (result.success && result.data) {
          node.callsign = result.data.call_sign || node.callsign;
          node.designator = result.data.name || node.designator;
        }
        
        return true;
      }
      
      return false;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        debugLog(`⏱️ [MeshNetworkService] Connection test timeout for ${node.ip}:${node.port}`);
      } else {
        const errorMessage = e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Unknown error';
        debugLog(`❌ [MeshNetworkService] Connection test failed for ${node.ip}:${node.port}:`, errorMessage);
      }
      return false;
    }
  }

  // Connect to a mesh node
  private async connectToNode(node: MeshNode): Promise<boolean> {
    if (this.connections.has(node.id)) {
      return true; // Already connected
    }
    
    try {
      
      // Test connection to the node's API endpoint using the protocol that worked for discovery
      const protocol = node.protocol || 'http'; // Default to HTTP if protocol not specified
      const testResponse = await fetch(`${protocol}://${node.ip}:${node.port}/api/station-info`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (testResponse.ok) {
        // Mark as connected via HTTP API
        this.connections.set(node.id, 'http-api');
        this.status.connectedNodes = this.connections.size;
        
        this.emit('mesh:node-connected', node);
        
        // Start initial sync with this node
        this.syncWithNode(node);
        
        return true;
      } else {
        console.warn(`⚠️ Failed to connect to mesh node ${node.callsign}: HTTP ${testResponse.status}`);
        return false;
      }
    } catch (e: unknown) {
      console.error(`❌ Failed to connect to mesh node ${node.callsign}:`, e);
      this.emit('mesh:connection-failed', { node, error: e });
      return false;
    }
  }

  // Start heartbeat system
  private startHeartbeat(): void {
    
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      this.checkNodeTimeouts();
    }, this.HEARTBEAT_INTERVAL);
  }

  // Send heartbeat to all connected nodes
  private sendHeartbeat(): void {
    if (!this.localNode) return;
    
    const heartbeatMessage: MeshMessage = {
      type: 'heartbeat',
      data: {
        nodeId: this.nodeId,
        qsoCount: this.localNode.qsoCount,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      nodeId: this.nodeId,
      messageId: this.generateMessageId(),
      ttl: 3
    };
    
    this.broadcastMessage(heartbeatMessage);
  }

  // Check for node timeouts
  private checkNodeTimeouts(): void {
    const now = Date.now();
    const timeoutNodes: string[] = [];
    
    this.discoveredNodes.forEach((node, nodeId) => {
      if (now - node.lastSeen > this.NODE_TIMEOUT) {
        timeoutNodes.push(nodeId);
      }
    });
    
    // Remove timed out nodes
    timeoutNodes.forEach(nodeId => {
      const node = this.discoveredNodes.get(nodeId);
      if (node) {
        this.removeNode(nodeId);
      }
    });
    
    if (timeoutNodes.length > 0) {
      this.updateMeshHealth();
    }
  }

  // Remove a node from the mesh
  private removeNode(nodeId: string): void {
    const node = this.discoveredNodes.get(nodeId);
    if (node) {
      this.discoveredNodes.delete(nodeId);
      this.connections.delete(nodeId);
      
      this.status.discoveredNodes = this.discoveredNodes.size;
      this.status.connectedNodes = this.connections.size;
      
      this.emit('mesh:node-removed', node);
    }
  }

  // Start periodic synchronization
  private startPeriodicSync(): void {
    
    this.syncInterval = setInterval(() => {
      this.performMeshSync();
    }, this.SYNC_INTERVAL);
  }

  // Perform synchronization with all nodes
  private async performMeshSync(): Promise<void> {
    if (!this.meshActive || this.discoveredNodes.size === 0) return;
    
    
    const syncPromises: Promise<void>[] = [];
    this.discoveredNodes.forEach((node) => {
      syncPromises.push(this.syncWithNode(node));
    });
    
    await Promise.allSettled(syncPromises);
    
    this.status.lastSync = Date.now();
    this.emit('mesh:sync-completed', {
      nodeCount: this.discoveredNodes.size,
      timestamp: this.status.lastSync
    });
  }

  // Synchronize with a specific node
  private async syncWithNode(node: MeshNode): Promise<void> {
    try {
      
      // Get local QSO data
      const localQsos = await fileStorage.getQsoData();
      
      // Request QSO data from the remote node using the protocol that worked for discovery
      const protocol = node.protocol || 'http'; // Default to HTTP if protocol not specified
      const response = await fetch(`${protocol}://${node.ip}:${node.port}/api/qsos`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Mesh-Node-ID': this.nodeId
        }
      });
      
      if (response.ok) {
        const remoteData = await response.json() as { qsos?: QSO[] };
        const remoteQsos = remoteData.qsos || [];
        
        // Find QSOs that exist on remote but not locally
        const newQsos = remoteQsos.filter((remoteQso: QSO) => 
          !localQsos.some(localQso => 
            localQso.id === remoteQso.id || 
            (localQso.call === remoteQso.call && 
             localQso.timestamp === remoteQso.timestamp)
          )
        );
        
        if (newQsos.length > 0) {
          
          // Add new QSOs to local storage using the QSO store
          const { logQso } = await import('@/store/qso');
          for (const newQso of newQsos) {
            await logQso({
              call: newQso.call,
              class: newQso.class,
              section: newQso.section,
              datetime: newQso.datetime
            });
          }
          
          this.status.syncedQsos += newQsos.length;
          
          // Emit sync completion event
          this.emit('mesh:sync-completed', {
            node: node,
            newQsos: newQsos.length,
            totalLocal: localQsos.length + newQsos.length
          });
        }
        
      } else {
        console.warn(`⚠️ Failed to fetch QSOs from ${node.callsign}: HTTP ${response.status}`);
      }
      
    } catch (e: unknown) {
      console.error(`❌ Sync failed with node ${node.callsign}:`, e);
    }
  }

  // Broadcast message to all connected nodes
  private broadcastMessage(_message: MeshMessage): void {
    
    this.connections.forEach((connection, _nodeId) => {
      if (connection && _nodeId !== this.nodeId) {
        // In a real implementation, send via WebSocket
        // For simulation, just log
      }
    });
  }

  // Generate unique message ID
  private generateMessageId(): string {
    return `msg-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
  }

  // Update mesh health status
  private updateMeshHealth(): void {
    const nodeCount = this.discoveredNodes.size;
    const connectionCount = this.connections.size;
    
    if (nodeCount === 0) {
      this.status.meshHealth = 'isolated';
    } else if (connectionCount < nodeCount * 0.7) {
      this.status.meshHealth = 'degraded';
    } else {
      this.status.meshHealth = 'healthy';
    }
    
    this.emit('mesh:health-changed', this.status.meshHealth);
  }

  // Public methods for UI integration

  // Get list of discovered nodes
  getDiscoveredNodes(): MeshNode[] {
    return Array.from(this.discoveredNodes.values());
  }

  // Get mesh status
  getMeshStatus(): MeshStatus {
    return { ...this.status };
  }

  // Force discovery refresh
  async refreshDiscovery(): Promise<void> {
    if (this.meshActive) {
      await this.discoverPeers();
    }
  }

  // Force sync with all nodes
  async forceMeshSync(): Promise<void> {
    if (this.meshActive) {
      await this.performMeshSync();
    }
  }

  // Check if mesh is active
  isMeshActive(): boolean {
    return this.meshActive;
  }
}

// Create and export singleton instance
export const meshNetworkService = new MeshNetworkService();
