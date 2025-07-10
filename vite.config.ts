import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
i        }
        
        // Bulk QSO upload endpoint - allows browser to upload its local QSOs to server
        // NOTE: This MUST come before the general /api/qsos middleware to avoid conflicts
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
                  saveQsosToFile(stationQsos);
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
            saveQsosToFile(stationQsos);
            console.log('🗑️  Cleared all QSOs');
            
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
        
        // QSO sync endpoint - MUST come after more specific routes
        server.middlewares.use('/api/qsos', (req, res, next) => {t path from 'path';
import fs from 'fs';

// Shared QSO storage file
const QSO_STORAGE_FILE = path.join(__dirname, 'shared-qsos.json');

// Helper functions for QSO file management
function loadQsosFromFile(): any[] {
  try {
    if (fs.existsSync(QSO_STORAGE_FILE)) {
      const data = fs.readFileSync(QSO_STORAGE_FILE, 'utf8');
      const qsos = JSON.parse(data);
      console.log(`📂 Loaded ${qsos.length} QSOs from shared file`);
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
    console.log(`💾 Saved ${qsos.length} QSOs to shared file`);
  } catch (error) {
    console.error('❌ Error saving QSOs to file:', error);
  }
}

export default defineConfig({
  plugins: [
    vue(),
    // Custom plugin to handle station info and QSO sync API
    {
      name: 'station-info-api',
      configureServer(server) {
        // Load QSOs from shared file on server start
        let stationQsos: any[] = loadQsosFromFile();
        let lastSyncTime = Date.now();
        
        // Watch for file changes (for real-time updates between servers)
        if (fs.existsSync(QSO_STORAGE_FILE)) {
          fs.watchFile(QSO_STORAGE_FILE, () => {
            console.log('📄 QSO file changed, reloading...');
            stationQsos = loadQsosFromFile();
          });
        }
        
        server.middlewares.use('/api/station-info', (req, res, next) => {
          if (req.method === 'GET') {
            // Return station info
            const stationInfo = {
              callsign: process.env.STATION_CALLSIGN || 'K8TAR',
              designator: process.env.STATION_DESIGNATOR || '1A',
              qsoCount: stationQsos.length,
              score: stationQsos.reduce((sum: number, qso: any) => sum + ((qso.mode === 'CW' || qso.mode === 'DIG') ? 2 : 1), 0),
              software: 'K8TAR Field Day Logger',
              version: '1.0.0',
              timestamp: Date.now(),
              port: server.config.server.port || 8080
            };
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end(JSON.stringify(stationInfo));
          } else if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
                    saveQsosToFile(stationQsos); // Save to file
                    console.log(`Server: Added QSO from network: ${update.qso.call} (total: ${stationQsos.length})`);
                  } else {
                    console.log(`Server: QSO already exists: ${update.qso.call}`);
                  }
                } else if (update.action === 'update') {
                  const index = stationQsos.findIndex((qso: any) => qso.id === update.qso.id);
                  if (index >= 0) {
                    stationQsos[index] = { ...update.qso };
                    saveQsosToFile(stationQsos); // Save to file
                    console.log(`Updated QSO from network: ${update.qso.call}`);
                  }
                } else if (update.action === 'delete') {
                  const index = stationQsos.findIndex((qso: any) => qso.id === update.qso.id);
                  if (index >= 0) {
                    stationQsos.splice(index, 1);
                    saveQsosToFile(stationQsos); // Save to file
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
                  saveQsosToFile(stationQsos);
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
            saveQsosToFile(stationQsos);
            console.log('🗑️  Cleared all QSOs');
            
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
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 8080,
    cors: true,
  },
});