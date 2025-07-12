import { ref, computed } from 'vue';

export interface BackendConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface BackendStation {
  id: string;
  call_sign: string;
  name: string;
  section: string;
  class: string;
  ip_address: string;
  port: number;
  last_seen: string;
  is_self: boolean;
}

export interface BackendQso {
  id: string;
  timestamp: string;
  frequency: string;
  mode: string;
  call_sign: string;
  name: string;
  section: string;
  class: string;
  power?: number;
  station_id: string;
  operator: string;
  notes?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class BackendApiService {
  private config: BackendConfig = {
    baseUrl: 'http://localhost:3030',
    timeout: 10000,
    retries: 3,
  };

  private isConnected = ref(false);
  private lastError = ref<string | null>(null);

  constructor() {
    this.checkConnection();
    
    // Check connection every 10 minutes to minimize connection refused spam
    setInterval(() => {
      this.checkConnection();
    }, 600000); // 10 minutes
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
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout
      
      const response = await fetch(`${this.config.baseUrl}/api/station/status`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const wasConnected = this.isConnected.value;
      this.isConnected.value = response.ok;
      this.lastError.value = null;
      
      // Only log successful connections to reduce console noise
      if (!wasConnected && this.isConnected.value) {
        console.log('✅ Backend service connected');
        window.dispatchEvent(new CustomEvent('backendConnected'));
      } else if (wasConnected && !this.isConnected.value) {
        console.log('❌ Backend service disconnected');
        window.dispatchEvent(new CustomEvent('backendDisconnected'));
      }
      
    } catch (error) {
      const wasConnected = this.isConnected.value;
      this.isConnected.value = false;
      
      // Only log the first disconnection to avoid spam
      if (wasConnected) {
        this.lastError.value = error instanceof Error ? error.message : 'Unknown error';
        console.log('❌ Backend service disconnected:', this.lastError.value);
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
      } catch (error) {
        this.lastError.value = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt === this.config.retries - 1) {
          return {
            success: false,
            error: this.lastError.value,
          };
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
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

  async updateStationInfo(stationInfo: {
    call_sign: string;
    name: string;
    section: string;
    class: string;
  }): Promise<boolean> {
    const response = await this.makeRequest<string>('/station', {
      method: 'PUT',
      body: JSON.stringify(stationInfo),
    });
    return response.success;
  }

  async getStationStatus(): Promise<{
    configured: boolean;
    station_id?: string;
    call_sign?: string;
  } | null> {
    const response = await this.makeRequest<{
      configured: boolean;
      station_id?: string;
      call_sign?: string;
    }>('/station/status');
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

  async getMeshStatus(): Promise<{
    enabled: boolean;
    station_count: number;
    discovery_active: boolean;
  } | null> {
    const response = await this.makeRequest<{
      enabled: boolean;
      station_count: number;
      discovery_active: boolean;
    }>('/mesh/status');
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
    const response = await this.makeRequest<{ count: number }>('/qso/count');
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
    } catch (error) {
      this.lastError.value = error instanceof Error ? error.message : 'Export failed';
      return null;
    }
  }

  // Configuration API
  async getConfig(): Promise<any> {
    const response = await this.makeRequest<any>('/config');
    return response.success ? response.data : null;
  }

  async updateMeshConfig(config: {
    enabled: boolean;
    discovery_interval_secs: number;
    max_discovery_attempts: number;
    timeout_secs: number;
  }): Promise<boolean> {
    const response = await this.makeRequest<string>('/config/mesh', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return response.success;
  }

  async updateQsoConfig(config: {
    sync_interval_secs: number;
    max_retries: number;
    batch_size: number;
  }): Promise<boolean> {
    const response = await this.makeRequest<string>('/config/qso', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return response.success;
  }

  // Station configuration API
  async updateStationConfig(callSign: string, name: string, section: string, stationClass: string): Promise<boolean> {
    const response = await this.makeRequest('/station', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        call_sign: callSign,
        name: name,
        section: section,
        class: stationClass,
      }),
    });
    return response.success;
  }

  // Utility methods
  setBaseUrl(url: string): void {
    this.config.baseUrl = url;
    this.checkConnection();
  }

  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }

  setRetries(retries: number): void {
    this.config.retries = retries;
  }
}

export const backendApi = new BackendApiService();
