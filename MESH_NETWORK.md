# Mesh Network Implementation for Field Day Logger

## Overview

The Field Day Logger now includes a **Mesh Network** mode that provides decentralized, peer-to-peer networking for Field Day operations. Unlike traditional client-server architectures, the mesh network allows each station to operate independently while automatically discovering and synchronizing with other stations on the network.

## Features

### 🕸️ **Mesh Network Mode**
- **Decentralized Architecture**: No central server required
- **Automatic Peer Discovery**: Stations discover each other automatically
- **Direct P2P Connections**: Each station connects directly to others
- **Fault Tolerance**: Network continues operating if stations go offline
- **Health Monitoring**: Real-time network health status

### 🔍 **Peer Discovery**
- **IP Range Scanning**: Automatically scans local network for other nodes
- **Multicast-Ready**: Designed for future multicast/broadcast discovery
- **Capability Exchange**: Nodes share their capabilities during discovery
- **Dynamic Updates**: Continuously discovers new nodes and removes offline ones

### 🔄 **Data Synchronization**
- **Distributed Sync**: QSO data syncs between all connected nodes
- **Conflict Resolution**: Handles conflicts when multiple stations log same contact
- **Checksum Verification**: Ensures data integrity during sync
- **Timestamp-Based**: Uses timestamps for conflict resolution

### 💓 **Health & Monitoring**
- **Heartbeat System**: Regular health checks between nodes
- **Network Health Status**: Healthy, Degraded, or Isolated
- **Connection Monitoring**: Tracks active connections to other nodes
- **Automatic Cleanup**: Removes offline nodes from the mesh

## Network Modes Comparison

| Feature | Auto-Discover | Host/Client | **Mesh Network** |
|---------|---------------|-------------|------------------|
| Central Server | No | Yes | **No** |
| Fault Tolerance | Low | Low | **High** |
| Setup Complexity | Low | Medium | **Low** |
| Scalability | Limited | Limited | **High** |
| Peer Discovery | Manual | Manual | **Automatic** |
| Data Resilience | Low | Medium | **High** |

## How It Works

### 1. **Node Initialization**
```typescript
// Each station becomes a mesh node
const meshNode = {
  id: "node-xyz-abc",
  callsign: "K8TAR", 
  designator: "1A",
  ip: "192.168.1.100",
  port: 8081,
  capabilities: ["qso-sync", "heartbeat", "conflict-resolution"]
}
```

### 2. **Peer Discovery Process**
```
1. Node starts mesh network
2. Scans local IP ranges (192.168.x.x, 10.x.x.x, etc.)
3. Sends discovery requests to /mesh/discovery endpoint
4. Receives node information from responding stations
5. Establishes direct connections to discovered peers
```

### 3. **Data Synchronization**
```
1. Each node maintains local QSO database
2. Periodic sync cycles exchange QSO data
3. Checksums verify data integrity
4. Conflicts resolved using timestamps
5. All nodes converge to same dataset
```

### 4. **Health Monitoring**
```
- Healthy: ≥70% of discovered nodes connected
- Degraded: <70% of discovered nodes connected  
- Isolated: No other nodes discovered
```

## Usage Instructions

### Starting Mesh Network

1. **Open Network Settings**
   - Click the network icon in the header
   - Or go to Settings → Network

2. **Select Mesh Mode**
   - Choose "Mesh Network (P2P)" from the dropdown
   - Review the mesh network benefits

3. **Start Mesh Network**
   - Click "Start Mesh Network" button
   - Wait for peer discovery to complete

4. **Monitor Status**
   - View discovered nodes in the mesh nodes list
   - Check network health indicator
   - Monitor sync statistics

### Mesh Network UI

The NetworkModal now includes:

- **Mesh Mode Selection**: New option in network mode dropdown
- **Mesh Status Display**: Shows network health and statistics  
- **Node List**: Displays all discovered mesh nodes
- **Capability Tags**: Shows what each node supports
- **Manual Controls**: Refresh discovery and force sync buttons

## Technical Implementation

### Core Components

1. **MeshNetworkService** (`src/services/meshNetworkService.ts`)
   - Handles peer discovery, connections, and synchronization
   - Manages node lifecycle and health monitoring
   - Provides event-driven architecture for UI updates

2. **NetworkService Integration** (`src/services/networkService.ts`)
   - Adds mesh mode to existing network modes
   - Provides unified API for all network operations
   - Handles mode switching and status management

3. **API Endpoints** (`src/api/apiServer.ts`)
   - `/mesh/discovery` - Peer discovery endpoint
   - Returns node information for mesh network

4. **UI Components** (`src/components/NetworkModal.vue`)
   - Mesh mode selection and configuration
   - Real-time node discovery display
   - Network health visualization

### Configuration

```typescript
// Mesh network settings
const DISCOVERY_PORT = 8081;      // Different from main app port
const DISCOVERY_INTERVAL = 15000; // 15 seconds
const HEARTBEAT_INTERVAL = 10000; // 10 seconds  
const SYNC_INTERVAL = 30000;      // 30 seconds
const NODE_TIMEOUT = 45000;       // 45 seconds
```

## Benefits for Field Day

### 🏆 **Operational Advantages**
- **No Single Point of Failure**: Network continues if any station goes down
- **Easy Setup**: No need to designate a "server" station
- **Automatic Discovery**: Stations find each other without manual configuration
- **Scalable**: Works equally well with 2 stations or 20+ stations

### 📊 **Data Advantages** 
- **Real-time Sync**: QSO data appears on all stations immediately
- **Conflict Resolution**: Handles duplicate entries intelligently
- **Data Integrity**: Checksums ensure accurate synchronization
- **Offline Resilience**: Stations can operate independently if isolated

### 🔧 **Technical Advantages**
- **Modern Architecture**: Uses peer-to-peer patterns
- **Future-Proof**: Designed for expansion (WebRTC, etc.)
- **Browser-Based**: Works in modern web browsers
- **Cross-Platform**: Consistent across operating systems

## Future Enhancements

### Planned Features
- **WebRTC Integration**: Direct browser-to-browser connections
- **Encryption**: Secure mesh communications
- **Bandwidth Optimization**: Efficient data transfer protocols
- **Mobile Support**: Mesh networking on tablets/phones

### Advanced Capabilities
- **Multi-Site Mesh**: Connect multiple Field Day locations
- **Internet Relay**: Mesh networks across different networks
- **Load Balancing**: Distribute processing across nodes
- **Advanced Analytics**: Network performance monitoring

## Testing the Implementation

Use the provided test script to verify mesh functionality:

```bash
node test-mesh-network.js
```

This will test:
- Mesh discovery API endpoint
- Mesh network service functionality  
- Network service integration
- UI component compatibility

## Conclusion

The Mesh Network mode represents a significant advancement in Field Day Logger networking capabilities. It provides the reliability and resilience needed for emergency communications while maintaining the ease of use that Field Day operators expect.

By eliminating the need for a central server and providing automatic peer discovery, the mesh network mode makes multi-station Field Day operations more robust and easier to manage.
