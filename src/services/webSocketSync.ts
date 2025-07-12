/**
 * WebSocket-based Real-time Sync System
 * 
 * This module provides real-time QSO synchronization using WebSockets
 * as a complement to the HTTP-based polling system.
 */

interface WebSocketMessage {
  type: 'qso-update' | 'station-info' | 'ping' | 'pong' | 'discovery';
  data: any;
  timestamp: number;
  stationId: string;
}

class WebSocketSyncService {
  private ws: WebSocket | null = null;
  private isHost = false;
  private hostPort = 9001; // Different port from HTTP API
  private connections: Set<WebSocket> = new Set();
  private messageHandlers: Map<string, Function[]> = new Map();
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;

  constructor() {
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.on('qso-update', (data: any) => {
      // Forward to QSO store handlers
      this.emit('network-qso-update', data);
    });

    this.on('station-info', (data: any) => {
      this.emit('station-discovered', data);
    });

    this.on('ping', (data: any) => {
      // Respond to ping with pong
      this.sendMessage({ type: 'pong', data: { timestamp: Date.now() } });
    });
  }

  // Start hosting WebSocket server (simulated in browser)
  async startHost(port = 9001): Promise<boolean> {
    try {
      this.hostPort = port;
      this.isHost = true;
      
      // In a browser environment, we can't create actual WebSocket servers
      // Instead, we'll use a discovery mechanism via localStorage
      this.setupHostDiscovery();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to start WebSocket host:', error);
      return false;
    }
  }

  // Connect to WebSocket host
  async connectToHost(address: string): Promise<boolean> {
    try {
      const wsUrl = `ws://${address}`;
      
      // In browser environment, try to connect to actual WebSocket if available
      // Otherwise fall back to localStorage-based communication
      try {
        this.ws = new WebSocket(wsUrl);
        this.setupWebSocketHandlers();
        return new Promise((resolve) => {
          if (this.ws) {
            this.ws.onopen = () => {
              this.startPingPong();
              resolve(true);
            };
            this.ws.onerror = () => {
              this.setupClientDiscovery(address);
              resolve(true);
            };
          }
        });
      } catch (error) {
        // Fallback to localStorage-based communication
        this.setupClientDiscovery(address);
        return true;
      }
    } catch (error) {
      console.error('❌ Failed to connect to WebSocket host:', error);
      return false;
    }
  }

  // Setup WebSocket event handlers
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
  }

  // Setup discovery mechanism for host (using localStorage)
  private setupHostDiscovery(): void {
    const stationInfo = {
      callsign: localStorage.getItem('stationCallsign') || 'UNKNOWN',
      designator: localStorage.getItem('stationDesignator') || '1A',
      host: true,
      port: this.hostPort,
      timestamp: Date.now(),
      endpoint: `${window.location.hostname}:${this.hostPort}`
    };

    // Broadcast station info
    localStorage.setItem('ws_host_info', JSON.stringify(stationInfo));
    
    // Listen for client discovery attempts
    window.addEventListener('storage', (event) => {
      if (event.key === 'ws_client_discovery') {
        // Client is looking for host
        this.broadcastStationInfo();
      }
    });

    // Periodically refresh host info
    setInterval(() => {
      stationInfo.timestamp = Date.now();
      localStorage.setItem('ws_host_info', JSON.stringify(stationInfo));
    }, 5000);
  }

  // Setup discovery mechanism for client
  private setupClientDiscovery(hostAddress: string): void {
    // Signal that we're looking for a host
    localStorage.setItem('ws_client_discovery', JSON.stringify({
      timestamp: Date.now(),
      looking_for: hostAddress
    }));

    // Check for host responses
    const checkForHost = () => {
      const hostInfo = localStorage.getItem('ws_host_info');
      if (hostInfo) {
        try {
          const info = JSON.parse(hostInfo);
          if (Date.now() - info.timestamp < 10000) { // Host seen in last 10 seconds
            this.emit('station-discovered', info);
          }
        } catch (error) {
          console.error('❌ Failed to parse host info:', error);
        }
      }
    };

    // Check immediately and then periodically
    checkForHost();
    setInterval(checkForHost, 2000);
  }

  // Send message via WebSocket or fallback
  sendMessage(message: Partial<WebSocketMessage>): void {
    const fullMessage: WebSocketMessage = {
      type: message.type || 'ping',
      data: message.data || {},
      timestamp: Date.now(),
      stationId: this.getLocalStationId(),
      ...message
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send via actual WebSocket
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      // Send via localStorage (fallback)
      this.sendViaStorage(fullMessage);
    }
  }

  // Fallback message sending via localStorage
  private sendViaStorage(message: WebSocketMessage): void {
    const key = `ws_message_${Date.now()}_${Math.random()}`;
    localStorage.setItem(key, JSON.stringify(message));
    
    // Clean up old messages
    setTimeout(() => {
      localStorage.removeItem(key);
    }, 30000);
  }

  // Handle incoming messages
  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message.data, message);
      } catch (error) {
        console.error('❌ Message handler error:', error);
      }
    });
  }

  // Event system
  on(eventType: string, handler: Function): void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, []);
    }
    this.messageHandlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: Function): void {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(eventType: string, data: any): void {
    const handlers = this.messageHandlers.get(eventType) || [];
    handlers.forEach(handler => handler(data));
  }

  // Broadcast QSO update
  broadcastQsoUpdate(qso: any, action: string): void {
    this.sendMessage({
      type: 'qso-update',
      data: { qso, action, stationId: this.getLocalStationId() }
    });
  }

  // Broadcast station info
  broadcastStationInfo(): void {
    const stationInfo = {
      callsign: localStorage.getItem('stationCallsign') || 'UNKNOWN',
      designator: localStorage.getItem('stationDesignator') || '1A',
      qsoCount: this.getQsoCount(),
      isHost: this.isHost,
      timestamp: Date.now()
    };

    this.sendMessage({
      type: 'station-info',
      data: stationInfo
    });
  }

  // Start ping-pong to keep connection alive
  private startPingPong(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = window.setInterval(() => {
      this.sendMessage({ type: 'ping', data: { timestamp: Date.now() } });
    }, 30000); // Ping every 30 seconds
  }

  // Schedule reconnection
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = window.setTimeout(() => {
      // Reconnection logic would go here
    }, 5000);
  }

  // Disconnect and cleanup
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isHost = false;
  }

  // Helper methods
  private getLocalStationId(): string {
    const callsign = localStorage.getItem('stationCallsign') || 'UNKNOWN';
    const designator = localStorage.getItem('stationDesignator') || '1A';
    return `${callsign}-${designator}`;
  }

  private getQsoCount(): number {
    try {
      const qsos = JSON.parse(localStorage.getItem('qsos') || '[]');
      return qsos.length;
    } catch {
      return 0;
    }
  }

  // Get connection status
  getStatus(): any {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      isHost: this.isHost,
      hostPort: this.hostPort,
      stationId: this.getLocalStationId()
    };
  }
}

// Export singleton instance
export const webSocketSync = new WebSocketSyncService();
