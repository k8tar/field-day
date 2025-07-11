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

import { ref, reactive } from 'vue';
import { fileStorage } from './fileStorage';
import { QSO } from '@/store/qso';

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
}

export interface MeshMessage {
  type: 'discovery' | 'qso-sync' | 'heartbeat' | 'conflict-resolution';
  data: any;
  timestamp: number;
  nodeId: string;
  messageId: string;
  ttl: number; // Time to live for message propagation
}

export interface QsoSyncData {
  qsos: QSO[];
  lastUpdate: number;
  checksum: string;
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
  private readonly DISCOVERY_PORT = 8080; // Use same port as main app
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
  private eventCallbacks: { [event: string]: Array<(...args: any[]) => void> } = {};

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
      console.log(`🆔 Mesh network using persistent network ID: ${this.nodeId}`);
    } catch (error) {
      console.error('❌ Failed to get persistent network ID, using fallback:', error);
      // Fallback to old method
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 5);
      this.nodeId = `MESH-node-${timestamp}-${random}`;
      this.status.nodeId = this.nodeId;
    }
  }

  // Event system
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

  // Start mesh network
  async startMesh(): Promise<boolean> {
    try {
      console.log('🕸️ Starting mesh network...');
      
      // Initialize local node
      console.log('1️⃣ Initializing local node...');
      await this.initializeLocalNode();
      
      // Start discovery process
      console.log('2️⃣ Starting peer discovery...');
      this.startPeerDiscovery();
      
      // Start heartbeat system
      console.log('3️⃣ Starting heartbeat system...');
      this.startHeartbeat();
      
      // Start synchronization
      console.log('4️⃣ Starting periodic sync...');
      this.startPeriodicSync();
      
      this.meshActive = true;
      this.status.isActive = true;
      this.updateMeshHealth();
      
      console.log(`✅ Mesh network started successfully - Node ID: ${this.nodeId}`);
      this.emit('mesh:started', { nodeId: this.nodeId });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start mesh network:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      this.emit('mesh:error', { message: 'Failed to start mesh network', error });
      return false;
    }
  }

  // Stop mesh network
  async stopMesh(): Promise<void> {
    console.log('🛑 Stopping mesh network...');
    
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
    this.connections.forEach((connection, nodeId) => {
      if (connection instanceof WebSocket) {
        connection.close();
      }
    });
    this.connections.clear();
    
    // Clear discovered nodes
    this.discoveredNodes.clear();
    
    this.updateMeshHealth();
    this.emit('mesh:stopped');
    
    console.log('✅ Mesh network stopped');
  }

  // Initialize local node information
  private async initializeLocalNode(): Promise<void> {
    try {
      console.log('🔧 Initializing local mesh node...');
      
      // Get station config with fallback values
      let stationConfig;
      try {
        stationConfig = await fileStorage.getStationConfig();
        console.log('📋 Station config loaded:', stationConfig);
      } catch (error) {
        console.warn('⚠️ Failed to load station config, using defaults:', error);
        stationConfig = { callsign: 'UNKNOWN', designator: '1A' };
      }
      
      // Get QSO data with fallback
      let qsos;
      try {
        qsos = await fileStorage.getQsoData();
        console.log(`📊 QSO data loaded: ${qsos.length} QSOs`);
      } catch (error) {
        console.warn('⚠️ Failed to load QSO data, using empty array:', error);
        qsos = [];
      }
      
      // Get local IP
      const localIP = await this.getLocalIP();
      console.log(`🌐 Local IP: ${localIP}`);
      
      this.localNode = {
        id: this.nodeId,
        callsign: stationConfig.callsign?.toUpperCase() || 'UNKNOWN',
        designator: stationConfig.designator || '1A',
        ip: localIP,
        port: this.DISCOVERY_PORT,
        qsoCount: qsos.length,
        score: this.calculateScore(qsos),
        online: true,
        lastSeen: Date.now(),
        version: '2.0.0', // From package.json
        capabilities: ['qso-sync', 'heartbeat', 'conflict-resolution']
      };
      
      console.log('✅ Local mesh node initialized:', this.localNode);
    } catch (error) {
      console.error('❌ Failed to initialize local node:', error);
      throw new Error(`Mesh node initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Calculate score from QSOs
  private calculateScore(qsos: QSO[]): number {
    return qsos.reduce((total, qso) => {
      // Basic scoring: 1 point per QSO, bonus for new sections
      return total + 1;
    }, 0);
  }

  // Get local IP address
  private async getLocalIP(): Promise<string> {
    try {
      console.log('🔍 Detecting local IP address...');
      
      // First, try to get IP from browser's current URL if available
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const browserIP = window.location.hostname;
        if (this.isValidPrivateIP(browserIP)) {
          console.log(`✅ Using browser IP: ${browserIP}`);
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
              console.log('⚠️ WebRTC IP detection failed, using fallback');
              resolve('192.168.1.100');
            });
          
          const foundIPs = new Set<string>();
          
          pc.onicecandidate = (ice) => {
            if (ice && ice.candidate && ice.candidate.candidate) {
              const match = ice.candidate.candidate.match(/candidate:\d+ \d+ udp \d+ ([\d.]+)/);
              if (match && match[1] && this.isValidPrivateIP(match[1]) && !this.isLocalhost(match[1])) {
                foundIPs.add(match[1]);
                console.log(`🔍 Found candidate IP: ${match[1]}`);
                
                // If we find a preferred physical network IP (192.168.1.x or 192.168.0.x), use it immediately
                if (match[1].startsWith('192.168.1.') || match[1].startsWith('192.168.0.')) {
                  pc.close();
                  console.log(`✅ Found preferred physical network IP: ${match[1]}`);
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
              console.log(`✅ Selected best physical IP from candidates: ${sortedIPs[0]} (from ${Array.from(foundIPs).join(', ')})`);
              resolve(sortedIPs[0]);
            } else {
              console.log('⏱️ No valid IPs found, using fallback');
              resolve('192.168.1.100');
            }
          }, 3000); // Increased timeout
          
        } catch (error) {
          console.log('❌ WebRTC not available, using fallback IP');
          resolve('192.168.1.100');
        }
      });
    } catch (error) {
      console.log('❌ IP detection failed, using fallback:', error instanceof Error ? error.message : 'Unknown error');
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
        console.log(`⚠️ IP ${ip} appears to be virtual interface - excluding`);
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
        console.log(`✅ IP ${ip} appears to be preferred physical interface`);
        return true;
      }
    }

    // For other private IPs, be conservative
    console.log(`⚠️ IP ${ip} is private but not in preferred ranges - treating as secondary`);
    return true;
  }

  // Helper method to check if an IP is localhost
  private isLocalhost(ip: string): boolean {
    return ip === '127.0.0.1' || 
           ip === '::1' || 
           ip === 'localhost' ||
           ip.startsWith('127.');
  }

  // Helper method to get valid network IPs to scan
  private async getValidNetworkIPs(): Promise<string[]> {
    const validIPs: string[] = [];
    
    // Get the current local IP to determine the network range
    const localIP = this.localNode?.ip || '192.168.1.100';
    
    // If we have a valid private IP, scan that network range
    if (this.isPrivateIP(localIP)) {
      const networkBase = this.getNetworkBase(localIP);
      
      // Scan common Field Day station IPs in the same network
      const commonStationNumbers = [10, 11, 12, 13, 14, 15, 20, 25, 30, 50, 100];
      
      for (const num of commonStationNumbers) {
        const testIP = `${networkBase}.${num}`;
        if (testIP !== localIP) {
          validIPs.push(testIP);
        }
      }
    }
    
    // Also add some specific known Field Day station IPs if they're in different networks
    const knownStationIPs = [
      '192.168.1.14',
      '192.168.1.30',
      '10.0.0.14',
      '10.0.0.30'
    ];
    
    for (const knownIP of knownStationIPs) {
      if (!validIPs.includes(knownIP) && knownIP !== localIP && !this.isLocalhost(knownIP)) {
        validIPs.push(knownIP);
      }
    }
    
    return validIPs;
  }

  // Helper method to check if an IP is in a private network range
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    
    return false;
  }

  // Helper method to get network base (first 3 octets)
  private getNetworkBase(ip: string): string {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }

  // Start peer discovery process
  private startPeerDiscovery(): void {
    console.log('🔍 Starting peer discovery...');
    
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
    
    console.log('🔎 Discovering mesh peers...');
    
    try {
      // Get valid network IPs to scan (exclude localhost)
      const networkIPs = await this.getValidNetworkIPs();
      
      console.log(`🌐 Scanning ${networkIPs.length} network IPs:`, networkIPs);
      
      const scanPromises: Promise<MeshNode | null>[] = [];
      const localIP = this.localNode.ip;
      
      for (const testIP of networkIPs) {
        if (testIP !== localIP && !this.isLocalhost(testIP)) {
          scanPromises.push(this.checkForMeshNode(testIP));
        }
      }
      
      // Wait for all scans
      const results = await Promise.allSettled(scanPromises.map(p => 
        Promise.race([
          p,
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ])
      ));
      
      // Process results
      let newNodes = 0;
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          const node = result.value;
          
          // Filter out our own node (don't discover ourselves)
          if (node.id === this.nodeId) {
            console.log(`🔍 Filtered out self-discovery: ${node.id} (this is our own node)`);
            return;
          }
          
          if (!this.discoveredNodes.has(node.id)) {
            newNodes++;
            this.addDiscoveredNode(node);
          } else {
            // Update existing node
            this.updateDiscoveredNode(node);
          }
        }
      });
      
      if (newNodes > 0) {
        console.log(`✅ Discovered ${newNodes} new mesh nodes`);
      }
    } catch (error) {
      console.error('❌ Error during peer discovery:', error);
    }
    
    this.updateMeshHealth();
  }

  // Check if a mesh node exists at the given IP
  private async checkForMeshNode(ip: string): Promise<MeshNode | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      // Try to connect to potential mesh node via the main app's API
      const response = await fetch(`https://${ip}:${this.DISCOVERY_PORT}/api/mesh/discovery`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'X-Mesh-Node-ID': this.nodeId
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const nodeInfo = await response.json();
        
        // Validate this is actually a Field Day mesh node
        if (nodeInfo.nodeId && 
            nodeInfo.callsign && 
            nodeInfo.designator && 
            nodeInfo.software && 
            nodeInfo.software.includes('Field Day')) {
          
          console.log(`✅ Found Field Day mesh node at ${ip}:${this.DISCOVERY_PORT}:`, nodeInfo);
          
          return {
            id: nodeInfo.nodeId,
            callsign: nodeInfo.callsign,
            designator: nodeInfo.designator,
            ip: ip,
            port: this.DISCOVERY_PORT,
            qsoCount: nodeInfo.qsoCount || 0,
            score: nodeInfo.score || 0,
            online: true,
            lastSeen: Date.now(),
            version: nodeInfo.version || '2.0.0',
            capabilities: nodeInfo.capabilities || []
          };
        } else {
          console.log(`❌ Response from ${ip}:${this.DISCOVERY_PORT} is not a Field Day mesh node:`, nodeInfo);
        }
      }
    } catch (error) {
      // Silently fail - this is expected for most IPs
    }
    
    return null;
  }

  // Add a newly discovered node
  private addDiscoveredNode(node: MeshNode): void {
    this.discoveredNodes.set(node.id, node);
    this.status.discoveredNodes = this.discoveredNodes.size;
    
    // Attempt to establish connection
    this.connectToNode(node);
    
    this.emit('mesh:node-discovered', node);
    console.log(`📡 Added mesh node: ${node.callsign} (${node.designator}) at ${node.ip}`);
  }

  // Update an existing discovered node
  private updateDiscoveredNode(node: MeshNode): void {
    const existing = this.discoveredNodes.get(node.id);
    if (existing) {
      // Update with new information
      Object.assign(existing, {
        ...node,
        lastSeen: Date.now()
      });
      
      this.emit('mesh:node-updated', existing);
    }
  }

  // Connect to a mesh node
  private async connectToNode(node: MeshNode): Promise<boolean> {
    if (this.connections.has(node.id)) {
      return true; // Already connected
    }
    
    try {
      console.log(`🤝 Connecting to mesh node: ${node.callsign} at ${node.ip}:${node.port}`);
      
      // Test connection to the node's API endpoint
      const testResponse = await fetch(`https://${node.ip}:${node.port}/api/station-info`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (testResponse.ok) {
        // Mark as connected via HTTP API
        this.connections.set(node.id, 'http-api');
        this.status.connectedNodes = this.connections.size;
        
        this.emit('mesh:node-connected', node);
        console.log(`✅ Connected to mesh node: ${node.callsign} via HTTP API`);
        
        // Start initial sync with this node
        this.syncWithNode(node);
        
        return true;
      } else {
        console.warn(`⚠️ Failed to connect to mesh node ${node.callsign}: HTTP ${testResponse.status}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to connect to mesh node ${node.callsign}:`, error);
      this.emit('mesh:connection-failed', { node, error });
      return false;
    }
  }

  // Start heartbeat system
  private startHeartbeat(): void {
    console.log('💓 Starting heartbeat system...');
    
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
        score: this.localNode.score,
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
        console.log(`⏰ Node timeout: ${node.callsign} (${node.designator})`);
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
      console.log(`🗑️ Removed mesh node: ${node.callsign} (${node.designator})`);
    }
  }

  // Start periodic synchronization
  private startPeriodicSync(): void {
    console.log('🔄 Starting periodic synchronization...');
    
    this.syncInterval = setInterval(() => {
      this.performMeshSync();
    }, this.SYNC_INTERVAL);
  }

  // Perform synchronization with all nodes
  private async performMeshSync(): Promise<void> {
    if (!this.meshActive || this.discoveredNodes.size === 0) return;
    
    console.log('🔄 Performing mesh synchronization...');
    
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
      console.log(`🔄 Starting QSO sync with ${node.callsign} at ${node.ip}:${node.port}`);
      
      // Get local QSO data
      const localQsos = await fileStorage.getQsoData();
      console.log(`📊 Local QSOs: ${localQsos.length}`);
      
      // Request QSO data from the remote node
      const response = await fetch(`https://${node.ip}:${node.port}/api/qsos`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Mesh-Node-ID': this.nodeId
        }
      });
      
      if (response.ok) {
        const remoteData = await response.json();
        const remoteQsos = remoteData.qsos || [];
        console.log(`📡 Remote QSOs from ${node.callsign}: ${remoteQsos.length}`);
        
        // Find QSOs that exist on remote but not locally
        const newQsos = remoteQsos.filter((remoteQso: any) => 
          !localQsos.some(localQso => 
            localQso.id === remoteQso.id || 
            (localQso.callsign === remoteQso.callsign && 
             localQso.timestamp === remoteQso.timestamp)
          )
        );
        
        if (newQsos.length > 0) {
          console.log(`📥 Found ${newQsos.length} new QSOs from ${node.callsign}`);
          
          // Add new QSOs to local storage using the QSO store
          const { logQso } = await import('@/store/qso');
          for (const newQso of newQsos) {
            await logQso({
              ...newQso,
              syncedFrom: node.callsign // Mark where this QSO came from
            });
          }
          
          this.status.syncedQsos += newQsos.length;
          console.log(`✅ Synced ${newQsos.length} new QSOs from ${node.callsign}`);
          
          // Emit sync completion event
          this.emit('mesh:sync-completed', {
            node: node,
            newQsos: newQsos.length,
            totalLocal: localQsos.length + newQsos.length
          });
        } else {
          console.log(`✅ No new QSOs from ${node.callsign} - already in sync`);
        }
        
      } else {
        console.warn(`⚠️ Failed to fetch QSOs from ${node.callsign}: HTTP ${response.status}`);
      }
      
    } catch (error) {
      console.error(`❌ Sync failed with node ${node.callsign}:`, error);
    }
  }

  // Handle sync response from a node
  private async handleSyncResponse(node: MeshNode, localQsos: QSO[]): Promise<void> {
    try {
      // In a real implementation, we would receive QSOs from the other node
      // For simulation, we'll just update our sync statistics
      this.status.syncedQsos += localQsos.length;
      
      console.log(`✅ Synced with ${node.callsign}: ${localQsos.length} QSOs`);
    } catch (error) {
      console.error(`❌ Failed to handle sync response from ${node.callsign}:`, error);
    }
  }

  // Calculate checksum for QSO data
  private calculateChecksum(qsos: QSO[]): string {
    const data = JSON.stringify(qsos.map(q => ({ id: q.id, timestamp: q.timestamp })));
    // Simple hash function (in production, use a proper crypto hash)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Broadcast message to all connected nodes
  private broadcastMessage(message: MeshMessage): void {
    console.log(`📡 Broadcasting message: ${message.type}`);
    
    this.connections.forEach((connection, nodeId) => {
      if (connection && nodeId !== this.nodeId) {
        // In a real implementation, send via WebSocket
        // For simulation, just log
        console.log(`  → Sent to ${nodeId}`);
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
