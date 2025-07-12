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
  private port = 8080; // All Field Day instances use port 8080
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
    } catch (error) {
      console.error('❌ Failed to load QSOs from file storage:', error);
      this.qsoStore = []; // Start with empty array if file storage fails
    }
  }

  private async saveQsosToStorage(): Promise<void> {
    try {
      await fileStorage.saveQsoData(this.qsoStore);
    } catch (error) {
      console.error('❌ Failed to save QSOs to file storage:', error);
    }
  }

  private setupFetchInterceptor(): void {
    if (typeof window === 'undefined') return;

    
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      
      
      // More aggressive API endpoint detection
      const isApiEndpoint = url.includes('/api/') || url.includes('/debug/');
      
      if (isApiEndpoint) {
        
        // Handle our API endpoints
        if (this.isApiRequest(url)) {
          return this.handleApiRequest(url, init);
        }
        
        // For remote API requests, use protocol fallback
        if (this.isRemoteApiRequest(url)) {
          return this.handleRemoteApiRequest(url, init);
        }
      }
      
      // For all other requests, use original fetch
      return originalFetch(input, init);
    };
    
  }

  private isApiRequest(url: string): boolean {
    // Only intercept requests to the current host (localhost, 127.0.0.1, or current hostname)
    // Don't intercept requests to remote stations
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    
    // Parse the URL to check if it's for the current host
    let targetHost = '';
    
    try {
      const parsedUrl = new URL(url);
      targetHost = parsedUrl.hostname;
    } catch (e) {
      // If it's a relative URL, it's for the current host
      if (!url.startsWith('http')) {
        targetHost = currentHost;
      }
    }
    
    // Only intercept if it's for the current host and contains API endpoints
    const isCurrentHost = targetHost === currentHost || 
                          targetHost === 'localhost' || 
                          targetHost === '127.0.0.1' ||
                          targetHost === '';
    
    const hasApiEndpoint = url.includes('/api/test') ||
           url.includes('/api/station-info') || 
           url.includes('/api/qsos') || 
           url.includes('/station-info') ||
           url.includes('/api/status') ||
           url.includes('/api/network/') ||
           url.includes('/api/mesh/discovery') ||
           url.includes('/api/files/') ||
           url.includes('/debug/config') ||
           url.includes('/debug/network');
    
    const shouldIntercept = isCurrentHost && hasApiEndpoint;
    
    // Debug logging
    
    return shouldIntercept;
  }

  private isRemoteApiRequest(url: string): boolean {
    // Check if this is a request to a remote Field Day station API
    try {
      const parsedUrl = new URL(url);
      const targetHost = parsedUrl.hostname;
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      
      // Check if it's a remote host making Field Day API requests
      const isRemoteHost = targetHost !== currentHost && 
                          targetHost !== 'localhost' && 
                          targetHost !== '127.0.0.1' &&
                          targetHost !== '[::1]';
      
      const hasApiEndpoint = url.includes('/api/station-info') || 
             url.includes('/api/qsos') || 
             url.includes('/api/mesh/discovery') ||
             url.includes('/api/messages') ||
             url.includes('/api/network/');
      
      return isRemoteHost && hasApiEndpoint;
    } catch (e) {
      return false;
    }
  }

  private async handleRemoteApiRequest(url: string, init?: RequestInit): Promise<Response> {
    // Protocol fallback for remote Field Day stations
    const urlObj = new URL(url);
    const protocols = ['https', 'http'];
    let lastError;
    
    for (const protocol of protocols) {
      try {
        const protocolUrl = url.replace(/^https?:/, `${protocol}:`);
        
        const response = await fetch(protocolUrl, init);
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


    try {
      let response: ApiResponse;

      // Simple test endpoint
      if (pathname === '/api/test') {
        response = {
          status: 200,
          data: { 
            message: 'API Server is working!',
            timestamp: Date.now(),
            pathname: pathname
          }
        };
      } else if (pathname.includes('/station-info') || pathname.includes('/status')) {
        response = await this.handleStationInfo();
      } else if (pathname.includes('/api/network/id')) {
        response = await this.handleNetworkId();
      } else if (pathname.includes('/api/network/status')) {
        response = await this.handleNetworkStatus();
      } else if (pathname.includes('/api/mesh/discovery')) {
        response = await this.handleMeshDiscovery(init);
      } else if (pathname.includes('/api/mesh/stations')) {
        response = await this.handleBackgroundMeshDiscovery();
      } else if (pathname.includes('/api/background/sync') && method === 'POST') {
        response = await this.handleBackgroundQsoSync();
      } else if (pathname.includes('/debug/config')) {
        response = await this.handleDebugConfig();
      } else if (pathname.includes('/debug/network')) {
        response = await this.handleDebugNetwork();
      } else if (pathname.includes('/api/files/')) {
        response = await this.handleFileOperations(pathname, method, init, searchParams);
      } else if (pathname.includes('/api/qsos/sync')) {
        response = await this.handleQsoSync(method, init);
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
    try {
      
      // Import and use the centralized StationInfoService
      const { StationInfoService } = await import('../services/stationInfoService');
      const stationInfo = await StationInfoService.getStationInfo(true); // Include port for debugging
      
      
      return {
        status: 200,
        data: stationInfo
      };
    } catch (error) {
      console.error('❌ Error in handleStationInfo:', error);
      
      // Return a fallback response using the service fallback method
      try {
        const { StationInfoService } = await import('../services/stationInfoService');
        const fallbackInfo = StationInfoService.validateStationInfo({
          callsign: 'ERROR',
          designator: '1A',
          networkId: `MESH-error-${Date.now()}`,
          qsoCount: 0,
          score: 0,
          software: 'K8TAR Field Day Logger',
          version: '2.0.0',
          timestamp: Date.now(),
          online: false,
          error: 'Station config unavailable'
        });
        
        return {
          status: 200,
          data: fallbackInfo ? {
            callsign: 'ERROR',
            designator: '1A',
            networkId: `MESH-error-${Date.now()}`,
            qsoCount: 0,
            score: 0,
            software: 'K8TAR Field Day Logger',
            version: '2.0.0',
            timestamp: Date.now(),
            online: false,
            error: 'Station config unavailable'
          } : {
            callsign: 'UNKNOWN',
            designator: '1A',
            networkId: `MESH-emergency-${Date.now()}`,
            qsoCount: 0,
            score: 0,
            software: 'K8TAR Field Day Logger',
            version: '2.0.0',
            timestamp: Date.now(),
            online: false
          }
        };
      } catch (serviceError) {
        console.error('❌ Error loading StationInfoService for fallback:', serviceError);
        return {
          status: 500,
          data: {
            error: 'Failed to get station info',
            details: error instanceof Error ? error.message : String(error)
          }
        };
      }
    }
  }

  private async handleMeshDiscovery(init?: RequestInit): Promise<ApiResponse> {
    try {
      
      // If this is a request for our own discovery info (from remote stations)
      if (init && init.method === 'GET') {
        // Use the centralized StationInfoService
        const { StationInfoService } = await import('../services/stationInfoService');
        const stationInfo = await StationInfoService.getStationInfo(true); // Include port
        
        // Convert to mesh node format for compatibility
        const meshNodeInfo = {
          nodeId: stationInfo.networkId,
          callsign: stationInfo.callsign,
          designator: stationInfo.designator,
          qsoCount: stationInfo.qsoCount,
          score: stationInfo.score,
          software: stationInfo.software,
          version: stationInfo.version,
          capabilities: ['qso-sync', 'heartbeat', 'conflict-resolution'],
          timestamp: stationInfo.timestamp,
          online: stationInfo.online,
          port: stationInfo.port || 8080
        };

        
        return {
          status: 200,
          data: meshNodeInfo
        };
      } else {
        // This is a request to discover other stations
        const discoveredStations = await this.discoverStations();
        
        return {
          status: 200,
          data: {
            stations: discoveredStations,
            count: discoveredStations.length,
            timestamp: Date.now()
          }
        };
      }
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
        
        // Store in localStorage as a fallback for browser environments
        try {
          localStorage.setItem(`fieldday_file_${filename}`, content);
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
    } else {
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
  }

  // Add a single QSO
  addQso(qso: QSO): void {
    this.qsoStore.push(qso);
    this.saveQsosToStorage();
  }

  // Remove a QSO
  removeQso(qsoId: number): void {
    const index = this.qsoStore.findIndex(qso => qso.id === qsoId);
    if (index >= 0) {
      const removed = this.qsoStore.splice(index, 1)[0];
      this.saveQsosToStorage();
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
  }

  // Stop the API server
  stop(): void {
    this.isRunning = false;
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
          // Get QSOs from this station since last sync (using protocol fallback)
          const response = await this.handleRemoteApiRequest(`https://${station.ip}:${station.port}/api/qsos?since=${lastSync}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.qsos && data.qsos.length > 0) {
              
              // Process received QSOs
              let merged = 0;
              data.qsos.forEach((qso: QSO) => {
                if (this.mergeRemoteQso(qso)) {
                  merged++;
                }
              });

              if (merged > 0) {
                this.saveQsosToStorage();
              }
            }
          }
        } catch (error) {
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
    const fieldDayPort = 8080; // All Field Day instances use port 8080
    
    // Only scan for actual Field Day stations on port 8080
    // Check specific known IPs that might have Field Day stations
    const knownIPs = [
      '192.168.1.14',  // Known Field Day station
      '192.168.1.30',  // Known Field Day station  
      '192.168.1.15',  // Potential Field Day station
      '192.168.1.25'   // Potential Field Day station
    ];

    for (const ip of knownIPs) {
      try {
        // Use protocol fallback for remote stations
        const response = await this.handleRemoteApiRequest(`https://${ip}:${fieldDayPort}/api/station-info`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
          const stationInfo = await response.json();
          
          // Validate this is actually a Field Day station
          if (stationInfo.callsign && 
              stationInfo.designator && 
              stationInfo.software && 
              stationInfo.software.includes('Field Day')) {
            
            discovered.push({
              ip: ip,
              port: fieldDayPort,
              callsign: stationInfo.callsign,
              designator: stationInfo.designator,
              qsoCount: stationInfo.qsoCount || 0
            });
            
          }
        }
      } catch (error) {
        // Station not available or not a Field Day station
      }
    }

    return discovered;
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
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
        await this.startElectronHttpServer();
      } catch (error) {
        console.warn('⚠️ Could not start HTTP server in Electron mode:', error);
      }
    } else {
    }
  }

  private async startElectronHttpServer(): Promise<void> {
    // This will be implemented when we have access to Node.js modules in Electron
    // For now, we'll rely on the Vite dev server or external HTTP server
  }

  private async handleNetworkId(): Promise<ApiResponse> {
    try {
      const networkId = await fileStorage.getNetworkId();
      
      return {
        status: 200,
        data: { 
          networkId: networkId,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('❌ Error handling network ID request:', error);
      return {
        status: 500,
        data: { error: 'Failed to get network ID' }
      };
    }
  }

  private async handleNetworkStatus(): Promise<ApiResponse> {
    try {
      const stationConfig = await fileStorage.getStationConfig();
      const networkId = await fileStorage.getNetworkId();
      
      // For now, always report connected since we're running
      const networkStatus = {
        isConnected: true,
        mode: 'mesh',
        networkId: networkId,
        callsign: stationConfig.callsign,
        designator: stationConfig.designator,
        port: stationConfig.port || 8080,
        timestamp: Date.now()
      };

      return {
        status: 200,
        data: networkStatus
      };
    } catch (error) {
      console.error('❌ Error handling network status request:', error);
      return {
        status: 500,
        data: { error: 'Failed to get network status' }
      };
    }
  }

  private async handleQsoSync(method: string, init?: RequestInit): Promise<ApiResponse> {
    try {
      if (method === 'POST') {
        // Trigger a QSO sync with remote stations
        
        // Perform the sync
        await this.performSync();
        
        return {
          status: 200,
          data: { 
            success: true,
            message: 'QSO sync completed',
            qsoCount: this.qsoStore.length,
            timestamp: Date.now()
          }
        };
      } else {
        return {
          status: 405,
          data: { error: 'Method not allowed. Use POST to trigger sync.' }
        };
      }
    } catch (error) {
      console.error('❌ Error handling QSO sync request:', error);
      return {
        status: 500,
        data: { error: 'Failed to perform QSO sync' }
      };
    }
  }

  /**
   * Background mesh discovery - scans for stations without blocking UI
   */
  private async handleBackgroundMeshDiscovery(): Promise<ApiResponse> {
    try {
      const stations = await this.performNetworkScan();
      
      return {
        status: 200,
        data: {
          stations: stations,
          timestamp: Date.now(),
          scannedCount: stations.length
        }
      };
    } catch (error) {
      return {
        status: 500,
        data: { error: 'Background mesh discovery failed', details: String(error) }
      };
    }
  }

  /**
   * Perform actual network scanning for Field Day stations
   */
  private async performNetworkScan(): Promise<any[]> {
    const stations: any[] = [];
    const localNetworkId = await fileStorage.getNetworkId();
    
    // Get local IP range for scanning
    const localIPs = this.generateLocalIPRange();
    
    // Scan in batches to avoid overwhelming the network
    const batchSize = 10;
    for (let i = 0; i < localIPs.length; i += batchSize) {
      const batch = localIPs.slice(i, i + batchSize);
      const batchPromises = batch.map(ip => this.checkStationAtIP(ip, localNetworkId));
      
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          stations.push(result.value);
        }
      });
      
      // Small delay between batches to prevent network flooding
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return stations;
  }

  /**
   * Generate local IP range for scanning
   */
  private generateLocalIPRange(): string[] {
    const ips: string[] = [];
    
    // Common local network ranges
    const ranges = [
      '192.168.1.',
      '192.168.0.',
      '10.0.0.',
      '172.16.0.'
    ];
    
    ranges.forEach(range => {
      for (let i = 1; i <= 254; i++) {
        ips.push(range + i);
      }
    });
    
    return ips;
  }

  /**
   * Check if there's a Field Day station at the given IP
   */
  private async checkStationAtIP(ip: string, localNetworkId: string): Promise<any | null> {
    try {
      const timeout = 2000; // 2 second timeout
      
      // Try HTTPS first, then HTTP
      for (const protocol of ['https', 'http']) {
        try {
          const url = `${protocol}://${ip}:8080/api/station-info`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const stationInfo = await response.json();
            
            // Verify it's a Field Day station and not ourselves
            if (stationInfo.software?.includes('Field Day') && 
                stationInfo.networkId !== localNetworkId) {
              
              return {
                ip: ip,
                port: 8080,
                callsign: stationInfo.callsign,
                designator: stationInfo.designator,
                networkId: stationInfo.networkId,
                qsoCount: stationInfo.qsoCount || 0,
                protocol: protocol.toUpperCase(),
                lastSeen: Date.now()
              };
            }
          }
          
          break; // If HTTPS worked, don't try HTTP
        } catch (error) {
          // Continue to next protocol
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Background QSO sync - syncs QSOs from other stations
   */
  private async handleBackgroundQsoSync(): Promise<ApiResponse> {
    try {
      // Get list of known stations
      const stationsResponse = await this.handleBackgroundMeshDiscovery();
      if (stationsResponse.status !== 200) {
        throw new Error('Failed to get station list');
      }
      
      const stations = stationsResponse.data.stations;
      let totalSynced = 0;
      
      // Sync QSOs from each station
      for (const station of stations) {
        try {
          const syncCount = await this.syncQsosFromStation(station);
          totalSynced += syncCount;
        } catch (error) {
          // Continue with next station if one fails
        }
      }
      
      return {
        status: 200,
        data: {
          synced: totalSynced,
          stations: stations.length,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return {
        status: 500,
        data: { error: 'Background QSO sync failed', details: String(error) }
      };
    }
  }

  /**
   * Sync QSOs from a specific station
   */
  private async syncQsosFromStation(station: any): Promise<number> {
    try {
      const url = `${station.protocol.toLowerCase()}://${station.ip}:${station.port}/api/qsos`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        return 0;
      }
      
      const remoteQsos = await response.json();
      if (!Array.isArray(remoteQsos)) {
        return 0;
      }
      
      // Merge remote QSOs with local ones (avoid duplicates)
      let syncedCount = 0;
      const existingIds = new Set(this.qsoStore.map(q => q.id));
      
      remoteQsos.forEach((remoteQso: any) => {
        if (remoteQso.id && !existingIds.has(remoteQso.id)) {
          this.qsoStore.push(remoteQso);
          syncedCount++;
        }
      });
      
      if (syncedCount > 0) {
        await this.saveQsosToStorage();
      }
      
      return syncedCount;
    } catch (error) {
      return 0;
    }
  }

  // Test method for debugging
  testApiServer(): string {
    return `API Server Status: ${this.isRunning ? 'Running' : 'Stopped'}, QSOs: ${this.qsoStore.length}`;
  }

  // Manual test method that bypasses fetch interceptor
  async testEndpointDirect(endpoint: string): Promise<any> {
    
    try {
      const response = await this.handleApiRequest(endpoint, { method: 'GET' });
      return response;
    } catch (error) {
      console.error(`❌ Direct test failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Initialize API server and expose it globally
  static initializeGlobal(): FieldDayApiServer {
    if (typeof window !== 'undefined') {
      
      if (!(window as any).apiServer) {
        (window as any).apiServer = apiServer;
      }
      
      
      return apiServer;
    }
    return apiServer;
  }
}

// Export singleton instance
export const apiServer = new FieldDayApiServer();

// Auto-start the server
apiServer.start();
