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

export interface StationInfoUpdateRequest {
  call_sign: string;
  name: string;
  section: string;
  class: string;
}

export interface StationStatusResponse {
  configured: boolean;
  station_id?: string;
  call_sign?: string;
}

export interface StationConfigUpdateRequest {
  call_sign: string;
  name: string;
  section: string;
  class: string;
}
