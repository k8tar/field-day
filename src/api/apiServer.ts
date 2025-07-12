/**
 * API Server Implementation for Field Day Network Sync
 * Updated to use file storage instead of localStorage
 * 
 * This module provides HTTP endpoints for station discovery and QSO synchronization.
 * It runs as a lightweight HTTP server within the application.
 */

import { QSO } from '@/store/qso';
import { fileStorage } from '@/services/fileStorage';

interface ApiResponse {
  status: number;
  data: any;
  headers?: Record<string, string>;
}

class FieldDayApiServer {
  private isRunning = false;
  private port = 8080;
  private httpServer: any = null;
  private qsoStore: QSO[] = [];
  private syncInterval: number | null = null;
  
  constructor() {
    this.setupFetchInterceptor();
    this.loadQsosFromStorage();
    this.startHttpServerIfNeeded();
  }

  private async loadQsosFromStorage(): Promise<void> {
    try {
      this.qsoStore = await fileStorage.getQsoData();
      console.log(`📚 API Server loaded ${this.qsoStore.length} QSOs from file storage`);
    } catch (error) {
      console.error('❌ Failed to load QSOs from file storage:', error);
      this.qsoStore = []; // Start with empty array if file storage fails
    }
  }

  private async saveQsosToStorage(): Promise<void> {
    try {
      await fileStorage.saveQsoData(this.qsoStore);
      console.log(`💾 API Server saved ${this.qsoStore.length} QSOs to file storage`);
    } catch (error) {
      console.error('❌ Failed to save QSOs to file storage:', error);
    }
  }

  private setupFetchInterceptor(): void {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      
      // Handle our API endpoints
      if (this.isApiRequest(url)) {
        return this.handleApiRequest(url, init);
      }
      
      // For all other requests, use original fetch
      return originalFetch(input, init);
    };
    
    console.log('🌐 API server fetch interceptor installed');
  }

  private isApiRequest(url: string): boolean {
    // Only intercept requests to the current host (localhost, 127.0.0.1, or current hostname)
    // Don't intercept requests to remote stations
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const currentPort = typeof window !== 'undefined' ? window.location.port : '8080';
    
    // Parse the URL to check if it's for the current host
    let targetHost = '';
    let targetPort = '';
    
    try {
      const parsedUrl = new URL(url);
      targetHost = parsedUrl.hostname;
      targetPort = parsedUrl.port || '8080';
    } catch (e) {
      // If it's a relative URL, it's for the current host
      if (!url.startsWith('http')) {
        targetHost = currentHost;
        targetPort = currentPort;
      }
    }
    
    // Only intercept if it's for the current host and contains API endpoints
    const isCurrentHost = targetHost === currentHost || 
                          targetHost === 'localhost' || 
                          targetHost === '127.0.0.1' ||
                          (targetHost === '' && !url.startsWith('http')); // relative URLs
    
    const hasApiEndpoint = url.includes('/api/station-info') || 
           url.includes('/api/qsos') || 
           url.includes('/station-info') ||
           url.includes('/api/status') ||
           url.includes('/api/mesh/discovery') ||
           url.includes('/api/files/') ||
           url.includes('/debug/config') ||
           url.includes('/debug/network');
    
    const shouldIntercept = isCurrentHost && hasApiEndpoint;
    
    if (hasApiEndpoint && !isCurrentHost) {
      console.log(`🌐 Allowing remote API request to ${targetHost}:${targetPort} - NOT intercepting`);
    }
    
    return shouldIntercept;
  }

  private async handleApiRequest(url: string, init?: RequestInit): Promise<Response> {
    const method = init?.method || 'GET';
    
    // Handle relative URLs by creating a proper base URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      // If it's a relative URL, construct it with a base
      parsedUrl = new URL(url, window.location.origin);
    }
    
    const pathname = parsedUrl.pathname;
    const searchParams = parsedUrl.searchParams;

    console.log(`📡 API Request: ${method} ${pathname}`);

    try {
      let response: ApiResponse;

      if (pathname.includes('/station-info') || pathname.includes('/status')) {
        response = await this.handleStationInfo();
      } else if (pathname.includes('/api/mesh/discovery')) {
        response = await this.handleMeshDiscovery(init);
      } else if (pathname.includes('/debug/config')) {
        response = await this.handleDebugConfig();
      } else if (pathname.includes('/debug/network')) {
        response = await this.handleDebugNetwork();
      } else if (pathname.includes('/api/files/')) {
        response = await this.handleFileOperations(pathname, method, init, searchParams);
      } else if (pathname.includes('/qsos')) {
        if (method === 'GET') {
          response = this.handleGetQsos(searchParams);
        } else if (method === 'POST') {
          const body = init?.body ? JSON.parse(init.body as string) : {};
          response = this.handlePostQsos(body);
        } else {
          response = { status: 405, data: { error: 'Method not allowed' } };
        }
      } else {
        response = { status: 404, data: { error: 'Not found' } };
      }

      return new Response(JSON.stringify(response.data), {
        status: response.status,
        statusText: response.status === 200 ? 'OK' : 'Error',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          ...response.headers
        }
      });

    } catch (error) {
      console.error('❌ API request error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleStationInfo(): Promise<ApiResponse> {
    const stationConfig = await fileStorage.getStationConfig();
    
    const stationInfo = {
      callsign: stationConfig.callsign,
      designator: stationConfig.designator,
      qsoCount: this.qsoStore.length,
      score: this.calculateTotalScore(),
      software: 'K8TAR Field Day Logger',
      version: '1.0.0',
      timestamp: Date.now(),
      online: true
    };

    console.log(`📊 Station info requested: ${stationInfo.callsign}-${stationInfo.designator} (${stationInfo.qsoCount} QSOs)`);
    
    return {
      status: 200,
      data: stationInfo
    };
  }

  private async handleMeshDiscovery(init?: RequestInit): Promise<ApiResponse> {
    try {
      const stationConfig = await fileStorage.getStationConfig();
      console.log(`🔍 Mesh Discovery - Station Config:`, stationConfig);
      
      // Use the persistent network ID from file storage
      const networkId = await fileStorage.getNetworkId();
      
      const meshNodeInfo = {
        nodeId: networkId,
        callsign: stationConfig.callsign,
        designator: stationConfig.designator,
        qsoCount: this.qsoStore.length,
        score: this.calculateTotalScore(),
        software: 'K8TAR Field Day Logger',
        version: '2.0.0',
        capabilities: ['qso-sync', 'heartbeat', 'conflict-resolution'],
        timestamp: Date.now(),
        online: true,
        port: stationConfig.port || 8080
      };

      console.log(`🕸️ Mesh discovery request: ${meshNodeInfo.callsign}-${meshNodeInfo.designator} (Node: ${networkId}) from port ${stationConfig.port}`);
      
      return {
        status: 200,
        data: meshNodeInfo
      };
    } catch (error) {
      console.error('❌ Error handling mesh discovery:', error);
      return {
        status: 500,
        data: { error: 'Failed to process mesh discovery request' }
      };
    }
  }

  private async handleFileOperations(pathname: string, method: string, init?: RequestInit, searchParams?: URLSearchParams): Promise<ApiResponse> {
    try {
      if (pathname.includes('/api/files/write') && method === 'POST') {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        const { filename, content } = body;
        
        if (!filename || content === undefined) {
          return {
            status: 400,
            data: { error: 'Missing filename or content' }
          };
        }

        // In browser mode, we'll just log the file write operation
        // since we can't actually write to the filesystem
        console.log(`📁 File write request: ${filename}`);
        console.log(`📄 Content length: ${content.length} characters`);
        
        // Store in localStorage as a fallback for browser environments
        try {
          localStorage.setItem(`fieldday_file_${filename}`, content);
          console.log(`💾 Stored file in localStorage: ${filename}`);
        } catch (e) {
          console.warn(`⚠️ Could not store in localStorage: ${e instanceof Error ? e.message : String(e)}`);
        }

        return {
          status: 200,
          data: { 
            success: true, 
            message: `File ${filename} written successfully (browser mode)`,
            filename: filename 
          }
        };
      } else if (pathname.includes('/api/files/read') && method === 'GET') {
        const filename = searchParams?.get('filename');
        
        if (!filename) {
          return {
            status: 400,
            data: { error: 'Missing filename parameter' }
          };
        }

        // Try to read from localStorage
        try {
          const content = localStorage.getItem(`fieldday_file_${filename}`);
          if (content !== null) {
            return {
              status: 200,
              data: { 
                content: content,
                filename: filename 
              }
            };
          } else {
            return {
              status: 404,
              data: { error: 'File not found' }
            };
          }
        } catch (e) {
          return {
            status: 500,
            data: { error: 'Error reading file from storage' }
          };
        }
      } else {
        return {
          status: 405,
          data: { error: 'Method not allowed for file operations' }
        };
      }
    } catch (error) {
      console.error('❌ Error handling file operations:', error);
      return {
        status: 500,
        data: { error: 'Failed to process file operation' }
      };
    }
  }

  private handleGetQsos(searchParams: URLSearchParams): ApiResponse {
    const since = searchParams.get('since');
    let qsos = [...this.qsoStore];

    if (since) {
      const sinceTimestamp = parseInt(since);
      qsos = qsos.filter(qso => (qso.timestamp || 0) > sinceTimestamp);
      console.log(`📥 QSOs requested since ${sinceTimestamp}: ${qsos.length} QSOs`);
    } else {
      console.log(`📥 All QSOs requested: ${qsos.length} QSOs`);
    }

    return {
      status: 200,
      data: {
        qsos: qsos,
        count: qsos.length,
        timestamp: Date.now()
      }
    };
  }

  private handlePostQsos(body: any): ApiResponse {
    try {
      if (body.qsos && Array.isArray(body.qsos)) {
        let added = 0;
        let updated = 0;
        
        body.qsos.forEach((newQso: QSO) => {
          const existingIndex = this.qsoStore.findIndex(qso => 
            qso.id === newQso.id || 
            (qso.call === newQso.call && qso.datetime === newQso.datetime)
          );

          if (existingIndex >= 0) {
            // Update existing QSO if newer
            const existing = this.qsoStore[existingIndex];
            if ((newQso.timestamp || 0) > (existing.timestamp || 0)) {
              this.qsoStore[existingIndex] = newQso;
              updated++;
            }
          } else {
            // Add new QSO
            this.qsoStore.push(newQso);
            added++;
          }
        });

        this.saveQsosToStorage();
        console.log(`📝 QSO batch processed: ${added} added, ${updated} updated`);

        return {
          status: 200,
          data: {
            added: added,
            updated: updated,
            total: this.qsoStore.length
          }
        };
      }

      return {
        status: 400,
        data: { error: 'Invalid QSO data' }
      };

    } catch (error) {
      console.error('❌ Error processing QSO batch:', error);
      return {
        status: 500,
        data: { error: 'Failed to process QSOs' }
      };
    }
  }

  private calculateTotalScore(): number {
    return this.qsoStore.reduce((total, qso) => {
      const points = (qso.mode === 'CW' || qso.mode === 'DIG') ? 2 : 1;
      return total + points;
    }, 0);
  }

  // Update QSO store when changes are made locally
  updateQsoStore(qsos: QSO[]): void {
    this.qsoStore = [...qsos];
    this.saveQsosToStorage();
    console.log(`🔄 QSO store updated: ${this.qsoStore.length} QSOs`);
  }

  // Add a single QSO
  addQso(qso: QSO): void {
    this.qsoStore.push(qso);
    this.saveQsosToStorage();
    console.log(`➕ QSO added: ${qso.call}`);
  }

  // Remove a QSO
  removeQso(qsoId: number): void {
    const index = this.qsoStore.findIndex(qso => qso.id === qsoId);
    if (index >= 0) {
      const removed = this.qsoStore.splice(index, 1)[0];
      this.saveQsosToStorage();
      console.log(`➖ QSO removed: ${removed.call}`);
    }
  }

  // Get current QSO count
  getQsoCount(): number {
    return this.qsoStore.length;
  }

  // Start the API server
  start(port = 8080): void {
    this.port = port;
    this.isRunning = true;
    console.log(`🚀 Field Day API server started on port ${port}`);
  }

  // Stop the API server
  stop(): void {
    this.isRunning = false;
    console.log('🛑 Field Day API server stopped');
  }

  // Check if server is running
  isActive(): boolean {
    return this.isRunning;
  }

  // Start automatic sync with discovered stations
  async startAutoSync(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    console.log('🔄 Starting automatic sync...');
    
    // Sync every 10 seconds
    this.syncInterval = setInterval(async () => {
      await this.performSync();
    }, 10000) as unknown as number;

    // Perform initial sync
    await this.performSync();
  }

  private async performSync(): Promise<void> {
    try {
      // Discover other stations
      const stations = await this.discoverStations();
      
      if (stations.length === 0) {
        return; // No stations to sync with
      }

      console.log(`🔄 Syncing with ${stations.length} stations...`);

      // Get the last sync timestamp
      let lastSync = '0';
      try {
        const settings = await fileStorage.getSettings();
        lastSync = settings.lastSyncTimestamp ? settings.lastSyncTimestamp.toString() : '0';
      } catch (error) {
        console.warn('Failed to get last sync timestamp from file storage:', error);
      }
      
      for (const station of stations) {
        try {
          // Get QSOs from this station since last sync (using HTTP for local network)
          const response = await fetch(`http://${station.ip}:${station.port}/api/qsos?since=${lastSync}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.qsos && data.qsos.length > 0) {
              console.log(`📥 Received ${data.qsos.length} QSOs from ${station.callsign}-${station.designator}`);
              
              // Process received QSOs
              let merged = 0;
              data.qsos.forEach((qso: QSO) => {
                if (this.mergeRemoteQso(qso)) {
                  merged++;
                }
              });

              if (merged > 0) {
                console.log(`✅ Merged ${merged} new QSOs from ${station.callsign}-${station.designator}`);
                this.saveQsosToStorage();
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Failed to sync with ${station.callsign}-${station.designator}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }

      // Update last sync timestamp
      try {
        const currentSettings = await fileStorage.getSettings();
        await fileStorage.saveSettings({
          ...currentSettings,
          lastSyncTimestamp: Date.now()
        });
      } catch (error) {
        console.warn('Failed to save sync timestamp to file storage:', error);
      }
      
    } catch (error) {
      console.error('❌ Sync error:', error);
    }
  }

  private mergeRemoteQso(remoteQso: QSO): boolean {
    // Check if QSO already exists
    const existing = this.qsoStore.find(qso => 
      qso.id === remoteQso.id || 
      (qso.call === remoteQso.call && 
       Math.abs(new Date(qso.datetime).getTime() - new Date(remoteQso.datetime).getTime()) < 60000) // Within 1 minute
    );

    if (existing) {
      // Update if remote QSO is newer
      if ((remoteQso.timestamp || 0) > (existing.timestamp || 0)) {
        const index = this.qsoStore.indexOf(existing);
        this.qsoStore[index] = remoteQso;
        return true;
      }
      return false;
    } else {
      // Add new QSO
      this.qsoStore.push(remoteQso);
      return true;
    }
  }

  private discoverStations = async (): Promise<Array<{ip: string, port: number, callsign: string, designator: string, qsoCount: number}>> => {
    const discovered = [];
    const currentPort = parseInt(window.location.port || '8080');
    const portsToScan = [3000, 4173, 5173, 8080, 8081, 8082, 8083, 8084, 8085].filter(p => p !== currentPort);

    for (const port of portsToScan) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/station-info`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const stationInfo = await response.json();
          discovered.push({
            ip: '127.0.0.1',
            port: port,
            callsign: stationInfo.callsign,
            designator: stationInfo.designator,
            qsoCount: stationInfo.qsoCount || 0
          });
        }
      } catch (error) {
        // Station not available on this port
      }
    }

    return discovered;
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🛑 Auto sync stopped');
    }
  }

  private async handleDebugConfig(): Promise<ApiResponse> {
    try {
      const stationConfig = await fileStorage.getStationConfig();
      const operators = await fileStorage.getOperators();
      const qsoData = await fileStorage.getQsoData();
      
      const debugInfo = {
        stationConfig: stationConfig,
        operators: operators,
        qsoCount: qsoData.length,
        currentPort: typeof window !== 'undefined' ? window.location.port : '8080',
        localStorage: typeof window !== 'undefined' ? {
          stationDesignator: localStorage.getItem('stationDesignator'),
          stationCallsign: localStorage.getItem('stationCallsign'),
          stationClass: localStorage.getItem('stationClass'),
          stationSection: localStorage.getItem('stationSection')
        } : null,
        timestamp: Date.now()
      };

      return {
        status: 200,
        data: debugInfo
      };
    } catch (error) {
      console.error('❌ Error handling debug config:', error);
      return {
        status: 500,
        data: { error: 'Failed to get debug config', details: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async handleDebugNetwork(): Promise<ApiResponse> {
    try {
      const networkInfo = {
        currentURL: typeof window !== 'undefined' ? window.location.href : 'N/A',
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
        port: typeof window !== 'undefined' ? window.location.port : 'N/A',
        protocol: typeof window !== 'undefined' ? window.location.protocol : 'N/A',
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'N/A',
        timestamp: Date.now()
      };

      return {
        status: 200,
        data: networkInfo
      };
    } catch (error) {
      console.error('❌ Error handling debug network:', error);
      return {
        status: 500,
        data: { error: 'Failed to get debug network info', details: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async startHttpServerIfNeeded(): Promise<void> {
    // Only start HTTP server in Electron environments (not in browser dev mode)
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        // Use Node.js http module through Electron's main process
        // We'll need to expose this in the preload script
        console.log('🚀 Starting HTTP server for Electron mesh discovery...');
        await this.startElectronHttpServer();
      } catch (error) {
        console.warn('⚠️ Could not start HTTP server in Electron mode:', error);
        console.log('📝 Falling back to fetch interceptor only');
      }
    } else {
      console.log('🌐 Running in browser mode - using fetch interceptor only');
    }
  }

  private async startElectronHttpServer(): Promise<void> {
    // This will be implemented when we have access to Node.js modules in Electron
    // For now, we'll rely on the Vite dev server or external HTTP server
    console.log('🔧 Electron HTTP server setup pending - using fetch interceptor');
  }
}

// Export singleton instance
export const apiServer = new FieldDayApiServer();

// Auto-start the server
apiServer.start();
