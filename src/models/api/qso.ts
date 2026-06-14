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

export interface QsoCountResponse {
  count: number;
}

export interface QsoConfigUpdateRequest {
  sync_interval_secs: number;
  max_retries: number;
  batch_size: number;
}
