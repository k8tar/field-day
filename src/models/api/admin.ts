export interface TriggerLogResetData {
  reset_timestamp: string;
}

export interface TriggerLogResetResponse {
  success: boolean;
  reset_timestamp?: string;
  error?: string;
}

export interface ResetStatusResponse {
  command_id?: string;
  timestamp?: number;
  issued_by?: string;
  reason?: string;
}
