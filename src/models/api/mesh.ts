export interface MeshStatusResponse {
  enabled: boolean;
  station_count: number;
  discovery_active: boolean;
}

export interface MeshConfigUpdateRequest {
  enabled: boolean;
  discovery_interval_secs: number;
  max_discovery_attempts: number;
  timeout_secs: number;
}
