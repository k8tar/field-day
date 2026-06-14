export interface BackendServerConfig {
  enabled?: boolean;
  discovery_interval_secs?: number;
  max_discovery_attempts?: number;
  timeout_secs?: number;
  sync_interval_secs?: number;
  max_retries?: number;
  batch_size?: number;
  [key: string]: unknown;
}
