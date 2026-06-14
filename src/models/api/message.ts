export interface BackendMessage {
  id: string;
  message_type: string;
  text: string;
  from_station_id: string;
  target_station_id?: string;
  timestamp: string;
}
