import { ref, computed } from 'vue';
import { debugLog } from '@/utils/debug';
import type { ApiResponse } from '@/models/api/common';
import type {
  BackendStation,
  StationInfoUpdateRequest,
  StationStatusResponse,
  StationConfigUpdateRequest,
} from '@/models/api/station';
import type { MeshStatusResponse, MeshConfigUpdateRequest } from '@/models/api/mesh';
import type { BackendQso, QsoCountResponse, QsoConfigUpdateRequest } from '@/models/api/qso';
import type { BackendMessage } from '@/models/api/message';
import type { BackendServerConfig } from '@/models/api/config';
import type { TriggerLogResetResponse, TriggerLogResetData, ResetStatusResponse } from '@/models/api/admin';

interface BackendClientConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export class BackendApiService {
  private config: BackendClientConfig = {
    baseUrl: 'http://localhost:3030',
    timeout: 5000, // Reduced timeout for faster detection
    retries: 2, // Reduced retries to fail faster
  };

  private isConnected = ref(false);
  private lastError = ref<string | null>(null);
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.checkConnection();
    this.startConnectionChecking();
  }

  private startConnectionChecking(): void {
    // Clear any existing interval
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    // Use adaptive interval: check more frequently when disconnected
    const checkInterval = () => {
      const interval = this.isConnected.value ? 60000 : 10000; // 1 min when connected, 10 sec when disconnected
      this.connectionCheckInterval = setTimeout(() => {
        this.checkConnection().finally(() => checkInterval());
      }, interval);
    };

    checkInterval();
  }

  public get connected() {
    return computed(() => this.isConnected.value);
  }

  public get error() {
    return computed(() => this.lastError.value);
  }

  private async checkConnection(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Quick timeout for responsiveness
      
      const response = await fetch(`${this.config.baseUrl}/api/station/status`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const wasConnected = this.isConnected.value;
      this.isConnected.value = response.ok;
      this.lastError.value = null;
      
      // Only log connection state changes to reduce noise
      if (!wasConnected && this.isConnected.value) {
        debugLog('✅ Backend service connected');
        window.dispatchEvent(new CustomEvent('backendConnected'));
      } else if (wasConnected && !this.isConnected.value) {
        debugLog('❌ Backend service disconnected');
        window.dispatchEvent(new CustomEvent('backendDisconnected'));
      }
      
    } catch (e: unknown) {
      const wasConnected = this.isConnected.value;
      this.isConnected.value = false;
      
      // Only log the first disconnection to avoid spam
      if (wasConnected) {
        this.lastError.value = e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Connection refused';
        debugLog('❌ Backend service disconnected:', this.lastError.value);
        window.dispatchEvent(new CustomEvent('backendDisconnected'));
      }
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}/api${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    };

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...defaultOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: ApiResponse<T> = await response.json();
        this.lastError.value = null;
        return result;
      } catch (e: unknown) {
        this.lastError.value = e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Unknown error';
        
        // Check connection immediately when request fails on final attempt
        if (attempt === this.config.retries - 1) {
          // Don't log here to avoid spam - let checkConnection handle logging
          this.checkConnection();
          return {
            success: false,
            error: this.lastError.value,
          };
        }
        
        // Shorter backoff for faster failure detection
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }

    return {
      success: false,
      error: 'Maximum retries exceeded',
    };
  }

  // Station API
  async getStationInfo(): Promise<BackendStation | null> {
    const response = await this.makeRequest<BackendStation>('/station-info');
    return response.success ? response.data || null : null;
  }

  async updateStationInfo(stationInfo: StationInfoUpdateRequest): Promise<boolean> {
    const response = await this.makeRequest<string>('/station', {
      method: 'PUT',
      body: JSON.stringify(stationInfo),
    });
    return response.success;
  }

  async getStationStatus(): Promise<StationStatusResponse | null> {
    const response = await this.makeRequest<StationStatusResponse>('/station/status');
    return response.success ? response.data || null : null;
  }

  // Mesh API
  async discoverStations(): Promise<BackendStation[]> {
    const response = await this.makeRequest<BackendStation[]>('/mesh/discover', {
      method: 'POST',
    });
    return response.success ? response.data || [] : [];
  }

  async getDiscoveredStations(): Promise<BackendStation[]> {
    const response = await this.makeRequest<BackendStation[]>('/mesh/stations');
    return response.success ? response.data || [] : [];
  }

  async getMeshStatus(): Promise<MeshStatusResponse | null> {
    const response = await this.makeRequest<MeshStatusResponse>('/mesh/status');
    return response.success ? response.data || null : null;
  }

  // QSO API
  async getQsos(): Promise<BackendQso[]> {
    const response = await this.makeRequest<BackendQso[]>('/qso/list');
    return response.success ? response.data || [] : [];
  }

  async addQso(qso: BackendQso): Promise<boolean> {
    const response = await this.makeRequest<string>('/qso/add', {
      method: 'POST',
      body: JSON.stringify(qso),
    });
    return response.success;
  }

  async updateQso(qso: BackendQso): Promise<boolean> {
    const response = await this.makeRequest<string>('/qso/update', {
      method: 'PUT',
      body: JSON.stringify(qso),
    });
    return response.success;
  }

  async deleteQso(qsoId: string): Promise<boolean> {
    const response = await this.makeRequest<string>(`/qso/delete/${qsoId}`, {
      method: 'DELETE',
    });
    return response.success;
  }

  async getQsoCount(): Promise<number> {
    const response = await this.makeRequest<QsoCountResponse>('/qso/count');
    return response.success ? response.data?.count || 0 : 0;
  }

  async exportAdif(): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      const response = await fetch(`${this.config.baseUrl}/api/qso/export/adif`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (e: unknown) {
      this.lastError.value = e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Export failed';
      return null;
    }
  }

  // Configuration API
  async getConfig(): Promise<BackendServerConfig | null> {
    const response = await this.makeRequest<BackendServerConfig>('/config');
    return response.success ? response.data ?? null : null;
  }

  async updateMeshConfig(config: MeshConfigUpdateRequest): Promise<boolean> {
    const response = await this.makeRequest<string>('/config/mesh', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return response.success;
  }

  async updateQsoConfig(config: QsoConfigUpdateRequest): Promise<boolean> {
    const response = await this.makeRequest<string>('/config/qso', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return response.success;
  }

  // Station configuration API
  async updateStationConfig(callSign: string, name: string, section: string, stationClass: string): Promise<boolean> {
    const stationConfig: StationConfigUpdateRequest = {
      call_sign: callSign,
      name,
      section,
      class: stationClass,
    };

    const response = await this.makeRequest('/station', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stationConfig),
    });
    return response.success;
  }

  // Message API
  async addMessage(message: BackendMessage): Promise<boolean> {
    const response = await this.makeRequest<string>('/message/add', {
      method: 'POST',
      body: JSON.stringify(message),
    });
    return response.success;
  }

  async getMessages(): Promise<BackendMessage[]> {
    const response = await this.makeRequest<BackendMessage[]>('/message/list');
    return response.success ? response.data || [] : [];
  }

  async updateMessage(message: BackendMessage): Promise<boolean> {
    const response = await this.makeRequest<string>(`/message/update/${message.id}`, {
      method: 'PUT',
      body: JSON.stringify(message),
    });
    return response.success;
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const response = await this.makeRequest<string>(`/message/delete/${messageId}`, {
      method: 'DELETE',
    });
    return response.success;
  }

  async sendMessage(content: string, target = 'all', messageId?: string): Promise<boolean> {
    const messageData: BackendMessage = {
      id: messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message_type: 'chat',
      text: content,
      from_station_id: '', // Will be set by backend based on station config
      target_station_id: target !== 'all' ? target : undefined,
      timestamp: new Date().toISOString(),
    };
    
    return this.addMessage(messageData);
  }

  // Admin API
  async triggerLogReset(): Promise<TriggerLogResetResponse> {
    const response = await this.makeRequest<TriggerLogResetData>('/admin/reset-log', {
      method: 'POST',
    });
    
    if (response && response.success && response.data) {
      return {
        success: true,
        reset_timestamp: response.data.reset_timestamp,
      };
    } else {
      return {
        success: false,
        error: response?.error || 'Failed to trigger log reset',
      };
    }
  }

  async getLastLogResetTime(): Promise<string | null> {
    const response = await this.makeRequest<ResetStatusResponse>('/admin/reset-status');
    
    if (response && response.success && response.data?.timestamp) {
      // Convert timestamp (milliseconds since epoch) to ISO string
      return new Date(response.data.timestamp).toISOString();
    }
    
    return null;
  }

  // Utility methods
  setBaseUrl(url: string): void {
    this.config.baseUrl = url;
    this.checkConnection();
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }

  setRetries(retries: number): void {
    this.config.retries = retries;
  }

  // Public method to force a connection check
  async refreshConnectionStatus(): Promise<void> {
    await this.checkConnection();
  }
}

export const backendApi = new BackendApiService();
