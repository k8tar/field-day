import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';

// Shared QSO storage file
const QSO_STORAGE_FILE = path.join(__dirname, 'shared-qsos.json');

// Helper functions for QSO file management
function loadQsosFromFile(): any[] {
  try {
    if (fs.existsSync(QSO_STORAGE_FILE)) {
      const data = fs.readFileSync(QSO_STORAGE_FILE, 'utf8');
      const qsos = JSON.parse(data);
      return qsos;
    }
  } catch (error) {
    console.error('❌ Error loading QSOs from file:', error);
  }
  return [];
}

function saveQsosToFile(qsos: any[]): void {
  try {
    fs.writeFileSync(QSO_STORAGE_FILE, JSON.stringify(qsos, null, 2));
  } catch (error) {
    console.error('❌ Error saving QSOs to file:', error);
  }
}

// Message storage functions
const MESSAGE_STORAGE_FILE = path.join(__dirname, 'fieldday-data', 'messages.json');

interface NetworkMessage {
  id: string;
  type: 'bonus' | 'section' | 'multiplier' | 'network' | 'info' | 'chat';
  text: string;
  timestamp: number;
  from?: string;
  target?: string;
  stationId: string;
}

function loadMessagesFromFile(): NetworkMessage[] {
  try {
    if (!fs.existsSync(MESSAGE_STORAGE_FILE)) {
      return [];
    }
    const data = JSON.parse(fs.readFileSync(MESSAGE_STORAGE_FILE, 'utf8'));
    return data;
  } catch (error) {
    console.error('❌ Error loading messages from file:', error);
  }
  return [];
}

function saveMessagesToFile(messages: NetworkMessage[]): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(MESSAGE_STORAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Keep only the latest 100 messages to prevent file from growing too large
    const recentMessages = messages.slice(-100);
    fs.writeFileSync(MESSAGE_STORAGE_FILE, JSON.stringify(recentMessages, null, 2));
  } catch (error) {
    console.error('❌ Error saving messages to file:', error);
  }
}

export default defineConfig({
  plugins: [
    vue(),
    // basicSsl(), // Disabled for local mesh network testing - causes SSL certificate errors
    // Custom plugin to handle station info and QSO sync API
    {
      name: 'station-info-api',
      configureServer(server) {
        // Load QSOs from shared file on server start
        let stationQsos: any[] = loadQsosFromFile();
        
        // Load messages from shared file on server start
        let stationMessages: NetworkMessage[] = loadMessagesFromFile();
        
        // Also check port-specific files and merge if they have more recent data
        try {
          const port = server.config.server.port || 8080;
          const dataDir = path.join(__dirname, 'fieldday-data', `port_${port}`);
          const qsoPath = path.join(dataDir, 'qso-data.json');
          
          if (fs.existsSync(qsoPath)) {
            const portQsos = JSON.parse(fs.readFileSync(qsoPath, 'utf8'));
            
            // Use whichever has more QSOs (simple merge strategy)
            if (portQsos.length > stationQsos.length) {
              stationQsos = portQsos;
              // Sync back to shared file
              saveQsosToFile(stationQsos);
            } else if (stationQsos.length > portQsos.length) {
              // Sync shared file data to port-specific file
              if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
              }
              fs.writeFileSync(qsoPath, JSON.stringify(stationQsos, null, 2));
            }
          }
        } catch (error) {
          console.error('❌ Error checking port-specific QSO files:', error);
        }
        
        let lastSyncTime = Date.now();
        
        // Watch for file changes (for real-time updates between servers)
        if (fs.existsSync(QSO_STORAGE_FILE)) {
          fs.watchFile(QSO_STORAGE_FILE, () => {
            stationQsos = loadQsosFromFile();
          });
        }
        
        // Watch for message file changes
        if (fs.existsSync(MESSAGE_STORAGE_FILE)) {
          fs.watchFile(MESSAGE_STORAGE_FILE, () => {
            stationMessages = loadMessagesFromFile();
          });
        }
        
        // Helper function to sync QSOs to both storage systems
        function syncQsosToAllStorageSystems(qsos: any[], action: string = 'sync') {
          // Save to shared file
          saveQsosToFile(qsos);
          
          // Save to port-specific file
          try {
            const port = server.config.server.port || 8080;
            const dataDir = path.join(__dirname, 'fieldday-data', `port_${port}`);
            const qsoPath = path.join(dataDir, 'qso-data.json');
            
            // Ensure directory exists
            if (!fs.existsSync(dataDir)) {
              fs.mkdirSync(dataDir, { recursive: true });
            }
            
            // Write QSOs to port-specific file
            fs.writeFileSync(qsoPath, JSON.stringify(qsos, null, 2));
          } catch (error) {
            console.error(`❌ Server: Failed to sync QSOs to port-specific file during ${action}:`, error);
          }
        }
        
        server.middlewares.use('/api/station-info', async (req, res, next) => {
          if (req.method === 'GET') {
            try {
              // Get port-specific data
              const port = server.config.server.port || 8080;
              const dataDir = path.join(__dirname, 'fieldday-data', `port_${port}`);
              
              // Use the centralized NodeStationInfoService
              const { NodeStationInfoService } = await import('./src/services/nodeStationInfoService');
              const stationInfo = await NodeStationInfoService.getStationInfo(port, dataDir, stationQsos);
              
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.end(JSON.stringify(stationInfo));
            } catch (error) {
              console.error('❌ Error getting station info:', error);
              console.error('❌ Error stack:', error.stack);
              console.error('❌ Error details:', {
                message: error.message,
                name: error.name,
                code: error.code
              });
              res.statusCode = 500;
              res.end(JSON.stringify({ 
                error: 'Failed to get station info',
                details: error.message,
                stack: error.stack
              }));
            }
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
        
        // Network status endpoint
        server.middlewares.use('/api/network/status', async (req, res, next) => {
          if (req.method === 'GET') {
            try {
              const port = server.config.server.port || 8080;
              const dataDir = path.join(__dirname, 'fieldday-data', `port_${port}`);
              
              // Use the centralized NodeStationInfoService to get basic info
              const { NodeStationInfoService } = await import('./src/services/nodeStationInfoService');
              const stationInfo = await NodeStationInfoService.getStationInfo(port, dataDir, stationQsos);
              
              // Create network status response
              const networkStatus = {
                isConnected: true,
                mode: 'mesh',
                networkId: stationInfo.networkId,
                callsign: stationInfo.callsign,
                designator: stationInfo.designator,
                port: port,
                timestamp: Date.now()
              };
              
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.end(JSON.stringify(networkStatus));
            } catch (error) {
              console.error('❌ Error getting network status:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ 
                error: 'Failed to get network status',
                details: error.message
              }));
            }
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
        
        // Network ID endpoint - returns the persistent network ID for this station
        server.middlewares.use('/api/network/id', async (req, res, next) => {
          if (req.method === 'GET') {
            try {
              const port = server.config.server.port || 8080;
              const dataDir = path.join(__dirname, 'fieldday-data', `port_${port}`);
              
              // Use the centralized NodeStationInfoService to get network ID
              const { NodeStationInfoService } = await import('./src/services/nodeStationInfoService');
              const stationInfo = await NodeStationInfoService.getStationInfo(port, dataDir, stationQsos);
              
              // Return just the network ID
              const response = {
                networkId: stationInfo.networkId,
                timestamp: Date.now()
              };
              
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.end(JSON.stringify(response));
            } catch (error) {
              console.error('❌ Error getting network ID:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ 
                error: 'Failed to get network ID',
                details: error.message
              }));
            }
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
        
        // Mesh discovery endpoint - provides mesh node information for network discovery
        server.middlewares.use('/api/mesh/discovery', async (req, res, next) => {
          if (req.method === 'GET') {
            try {
              const port = server.config.server.port || 8080;
              const dataDir = path.join(__dirname, 'fieldday-data', `port_${port}`);
              
              // Use the centralized NodeStationInfoService to get basic info
              const { NodeStationInfoService } = await import('./src/services/nodeStationInfoService');
              const stationInfo = await NodeStationInfoService.getStationInfo(port, dataDir, stationQsos);
              
              // Convert to mesh node format for compatibility
              const meshNodeInfo = {
                id: stationInfo.networkId,
                callsign: stationInfo.callsign,
                designator: stationInfo.designator,
                networkId: stationInfo.networkId,
                mode: 'mesh',
                ip: 'localhost',
                port: port,
                qsoCount: stationInfo.qsoCount,
                score: stationInfo.score,
                timestamp: Date.now(),
                isConnected: true
              };
              
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.end(JSON.stringify(meshNodeInfo));
            } catch (error) {
              console.error('❌ Error handling mesh discovery:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ 
                error: 'Failed to process mesh discovery request',
                details: error.message
              }));
            }
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
        
        // Network registration system for multi-station sync
        let connectedStations: any[] = [];
        let isNetworkHost = false;
        
        // Register as host endpoint
        server.middlewares.use('/api/network/host', (req, res, next) => {
          if (req.method === 'POST') {
            isNetworkHost = true;
            connectedStations = []; // Reset connected stations
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, message: 'Registered as host' }));
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
        
        // Register client with host endpoint
        server.middlewares.use('/api/network/register', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => body += chunk);
            req.on('end', () => {
              try {
                const clientInfo = JSON.parse(body);
                
                // Add client to connected stations if not already present
                const existingIndex = connectedStations.findIndex(s => s.id === clientInfo.id);
                if (existingIndex >= 0) {
                  connectedStations[existingIndex] = { ...clientInfo, lastSeen: Date.now() };
                } else {
                  connectedStations.push({ ...clientInfo, lastSeen: Date.now() });
                }
                
                console.log(`📡 Server: Connected stations after registration (${connectedStations.length} total):`);
                connectedStations.forEach((station, index) => {
                  console.log(`  Station ${index + 1}: ${station.callsign}-${station.designator} at ${station.ip}:${station.port} (${station.qsoCount || 0} QSOs)`);
                });
                
                console.log(`📡 Server: Client ${clientInfo.callsign}-${clientInfo.designator} registered (${connectedStations.length} total)`);
                
                // Get host station info from port-specific files
                const port = server.config.server.port || 8080;
                const dataDir = path.join(__dirname, 'fieldday-data', `port_${port}`);
                
                let hostStationConfig = { callsign: 'K8TAR', designator: 'PHONE 1' };
                let hostQsoCount = 0;
                
                try {
                  const configPath = path.join(dataDir, 'station-config.json');
                  if (fs.existsSync(configPath)) {
                    const configData = fs.readFileSync(configPath, 'utf8');
                    hostStationConfig = JSON.parse(configData);
                  }
                  
                  const qsoPath = path.join(dataDir, 'qso-data.json');
                  if (fs.existsSync(qsoPath)) {
                    const qsoData = fs.readFileSync(qsoPath, 'utf8');
                    const qsos = JSON.parse(qsoData);
                    hostQsoCount = qsos.length;
                  }
                } catch (error) {
                  console.log('Using default host station info');
                }
                
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ 
                  success: true, 
                  connectedStations: connectedStations.length,
                  hostInfo: {
                    callsign: hostStationConfig.callsign,
                    designator: hostStationConfig.designator,
                    ip: 'localhost',
                    port: port,
                    qsoCount: hostQsoCount
                  }
                }));
              } catch (error) {
                console.error('Server: Client registration error:', error);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid registration data' }));
              }
            });
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
        
        // Get connected stations endpoint
        server.middlewares.use('/api/network/stations', (req, res, next) => {
          if (req.method === 'GET') {
            // Get host station info from port-specific files
            let hostInfo: any = null;
            if (isNetworkHost) {
              const port = server.config.server.port || 8080;
              const dataDir = path.join(__dirname, 'fieldday-data', `port_${port}`);
              
              let hostStationConfig = { callsign: 'K8TAR', designator: 'PHONE 1' };
              let hostQsoCount = 0;
              
              try {
                const configPath = path.join(dataDir, 'station-config.json');
                if (fs.existsSync(configPath)) {
                  const configData = fs.readFileSync(configPath, 'utf8');
                  hostStationConfig = JSON.parse(configData);
                }
                
                const qsoPath = path.join(dataDir, 'qso-data.json');
                if (fs.existsSync(qsoPath)) {
                  const qsoData = fs.readFileSync(qsoPath, 'utf8');
                  const qsos = JSON.parse(qsoData);
                  hostQsoCount = qsos.length;
                }
              } catch (error) {
                console.log('Using default host station info for network/stations');
              }
              
              hostInfo = {
                callsign: hostStationConfig.callsign,
                designator: hostStationConfig.designator,
                ip: 'localhost',
                port: port,
                qsoCount: hostQsoCount
              };
            }
            
            // Return list of connected stations
            const response = {
              isHost: isNetworkHost,
              connectedStations: connectedStations,
              hostInfo: hostInfo
            };
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify(response));
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
        
        // Heartbeat endpoint for keeping connections alive
        server.middlewares.use('/api/network/heartbeat', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => body += chunk);
            req.on('end', () => {
              try {
                const heartbeat = JSON.parse(body);
                const stationIndex = connectedStations.findIndex(s => s.id === heartbeat.stationId);
                if (stationIndex >= 0) {
                  connectedStations[stationIndex].lastSeen = Date.now();
                  connectedStations[stationIndex].online = true;
                  
                  // Update QSO count and score if provided in heartbeat
                  if (heartbeat.qsoCount !== undefined) {
                    connectedStations[stationIndex].qsoCount = heartbeat.qsoCount;
                  }
                  if (heartbeat.score !== undefined) {
                    connectedStations[stationIndex].score = heartbeat.score;
                  }
                  
                  console.log(`💓 Heartbeat from ${connectedStations[stationIndex].callsign}-${connectedStations[stationIndex].designator}: ${heartbeat.qsoCount || 0} QSOs, ${heartbeat.score || 0} pts`);
                }
                
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
              } catch (error) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid heartbeat data' }));
              }
            });
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
        
        // QSO sync endpoint
        server.middlewares.use('/api/qsos', (req, res, next) => {
          if (req.method === 'GET') {
            // Return QSOs modified since timestamp
            const url = new URL(req.url || '', 'http://localhost');
            const sinceParam = url.searchParams.get('since');
            const since = sinceParam ? parseInt(sinceParam) : 0;
            
            // For initial sync (no since parameter), return all QSOs
            // For periodic sync (with since parameter), return QSOs newer than since
            const filteredQsos = sinceParam ? 
              stationQsos.filter((qso: any) => (qso.timestamp || 0) > since) :
              stationQsos; // Return all QSOs for initial sync
              
            console.log(`QSO API: Returning ${filteredQsos.length} QSOs (total: ${stationQsos.length}, since: ${sinceParam || 'none'})`);
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({
              qsos: filteredQsos,
              timestamp: Date.now()
            }));
          } else if (req.method === 'POST') {
            // Receive QSO updates
            let body = '';
            req.on('data', (chunk: any) => body += chunk);
            req.on('end', () => {
              try {
                const update = JSON.parse(body);
                
                if (update.action === 'add') {
                  const exists = stationQsos.find((qso: any) => qso.id === update.qso.id);
                  if (!exists) {
                    stationQsos.push(update.qso);
                    syncQsosToAllStorageSystems(stationQsos, 'network-add'); // Use helper function
                    console.log(`Server: Added QSO from network: ${update.qso.call} (total: ${stationQsos.length})`);
                  } else {
                    console.log(`Server: QSO already exists: ${update.qso.call}`);
                  }
                } else if (update.action === 'update') {
                  const index = stationQsos.findIndex((qso: any) => qso.id === update.qso.id);
                  if (index >= 0) {
                    stationQsos[index] = { ...update.qso };
                    syncQsosToAllStorageSystems(stationQsos, 'network-update'); // Use helper function
                    console.log(`Updated QSO from network: ${update.qso.call}`);
                  }
                } else if (update.action === 'delete') {
                  const index = stationQsos.findIndex((qso: any) => qso.id === update.qso.id);
                  if (index >= 0) {
                    stationQsos.splice(index, 1);
                    syncQsosToAllStorageSystems(stationQsos, 'network-delete'); // Use helper function
                    console.log(`Deleted QSO from network: ${update.qso.call}`);
                  }
                }
                
                lastSyncTime = Date.now();
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true, timestamp: lastSyncTime }));
              } catch (error) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
        
        // Bulk QSO upload endpoint - allows browser to upload its local QSOs to server
        server.middlewares.use('/api/qsos/bulk', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => body += chunk);
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const uploadedQsos = data.qsos || [];
                
                console.log(`Server: Bulk upload request - ${uploadedQsos.length} QSOs`);
                
                // Merge uploaded QSOs with existing ones (avoid duplicates)
                let addedCount = 0;
                uploadedQsos.forEach((qso: any) => {
                  const exists = stationQsos.find((existing: any) => existing.id === qso.id);
                  if (!exists) {
                    stationQsos.push(qso);
                    addedCount++;
                  }
                });
                
                // Save to file if any QSOs were added
                if (addedCount > 0) {
                  syncQsosToAllStorageSystems(stationQsos, 'bulk-upload'); // Use helper function
                }
                
                console.log(`Server: Added ${addedCount} new QSOs (total: ${stationQsos.length})`);
                
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ 
                  success: true, 
                  added: addedCount, 
                  total: stationQsos.length 
                }));
              } catch (error) {
                console.error('Server: Bulk upload error:', error);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
              }
            });
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            res.statusCode = 405;
            res.end('Method not allowed');
          }
        });
        
        // Clear all QSOs endpoint (for testing)
        server.middlewares.use('/api/qsos/clear', (req, res, next) => {
          if (req.method === 'DELETE') {
            stationQsos = [];
            syncQsosToAllStorageSystems(stationQsos, 'clear'); // Use helper function to clear both systems
            console.log('🗑️  Cleared all QSOs from both storage systems');
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, message: 'All QSOs cleared' }));
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            res.statusCode = 405;
            res.end('Method not allowed');
          }
        });
        
        // File storage API endpoints
        server.middlewares.use('/api/files/write', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const { filename, content } = JSON.parse(body);
                
                // Ensure the filename is safe and within allowed directory
                if (!filename || typeof filename !== 'string' || filename.includes('..')) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Invalid filename' }));
                  return;
                }
                
                // Ensure content is defined (it can be empty string, but not undefined)
                if (content === undefined) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Content is required' }));
                  return;
                }
                
                // Convert content to string if it's not already
                const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
                
                // Create full file path (don't double up fieldday-data)
                const fullPath = path.join(__dirname, filename);
                
                // Ensure directory exists
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
                }
                
                // Write file
                fs.writeFileSync(fullPath, contentStr, 'utf8');
                console.log(`📁 Server: Wrote file ${filename} (${contentStr.length} chars)`);
                
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true }));
              } catch (error) {
                console.error('❌ Server: File write error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'File write failed' }));
              }
            });
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });

        server.middlewares.use('/api/files/read', (req, res, next) => {
          if (req.method === 'GET') {
            const url = new URL(req.url || '', 'http://localhost');
            const filename = url.searchParams.get('filename');
            
            if (!filename || typeof filename !== 'string' || filename.includes('..')) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid filename' }));
              return;
            }
            
            // Don't double up the fieldday-data path
            const fullPath = path.join(__dirname, filename);
            
            try {
              if (!fs.existsSync(fullPath)) {
                res.statusCode = 404;
                res.end('File not found');
                return;
              }
              
              const content = fs.readFileSync(fullPath, 'utf8');
              console.log(`📂 Server: Read file ${filename}`);
              
              res.setHeader('Content-Type', 'text/plain');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(content);
            } catch (error) {
              console.error('❌ Server: File read error:', error);
              res.statusCode = 500;
              res.end('File read failed');
            }
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });

        // Message API endpoints
        server.middlewares.use('/api/messages', (req, res, next) => {
          if (req.method === 'GET') {
            // Get recent messages (latest 5 by default, or specify with ?limit=N)
            const url = new URL(req.url || '', 'http://localhost');
            const limit = parseInt(url.searchParams.get('limit') || '5');
            const since = parseInt(url.searchParams.get('since') || '0');
            
            // Filter messages newer than 'since' timestamp if provided
            let filteredMessages = stationMessages;
            if (since > 0) {
              filteredMessages = stationMessages.filter(msg => msg.timestamp > since);
            }
            
            // Get the most recent messages up to the limit
            const recentMessages = filteredMessages.slice(-limit);
            
            console.log(`📨 Serving ${recentMessages.length} messages (limit: ${limit}, since: ${since})`);
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({
              messages: recentMessages,
              timestamp: Date.now(),
              total: stationMessages.length
            }));
          } else if (req.method === 'POST') {
            // Add a new message
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const messageData = JSON.parse(body);
                
                // Use provided ID or generate one if missing
                const messageId = messageData.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Check for duplicate messages by ID
                const existingMessage = stationMessages.find(msg => msg.id === messageId);
                if (existingMessage) {
                  console.log(`⚠️ Duplicate message prevented: ${messageId}`);
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ 
                    success: true, 
                    message: existingMessage,
                    duplicate: true,
                    timestamp: Date.now()
                  }));
                  return;
                }
                
                const newMessage: NetworkMessage = {
                  id: messageId,
                  type: messageData.type || 'chat',
                  text: messageData.text,
                  timestamp: messageData.timestamp || Date.now(),
                  from: messageData.from,
                  target: messageData.target || 'all',
                  stationId: messageData.stationId || 'unknown'
                };
                
                stationMessages.push(newMessage);
                saveMessagesToFile(stationMessages);
                
                console.log(`📨 Added message ${newMessage.id} from ${newMessage.from}: ${newMessage.text}`);
                
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ 
                  success: true, 
                  message: newMessage,
                  timestamp: Date.now()
                }));
              } catch (error) {
                console.error('❌ Error adding message:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to add message' }));
              }
            });
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });

        server.middlewares.use('/api/messages/clear', (req, res, next) => {
          if (req.method === 'POST') {
            stationMessages = [];
            saveMessagesToFile(stationMessages);
            
            console.log('🗑️ Cleared all messages');
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
          } else {
            next();
          }
        });
      }
    }
  ],
  base: './', // Use relative paths for assets - needed for Electron
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all interfaces, not just localhost
    port: 8080,
    strictPort: true, // Force port 8080, fail if unavailable
    cors: true,
    // Reverted to HTTP due to SSL protocol issues - network access still works
  },
});