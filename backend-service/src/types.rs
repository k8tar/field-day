use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Station {
    pub id: String,
    pub call_sign: String,
    pub name: String,
    pub section: String,
    pub class: String,
    pub ip_address: String,
    pub port: u16,
    pub last_seen: DateTime<Utc>,
    pub is_self: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QsoEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub frequency: String,
    pub mode: String,
    pub call_sign: String,
    pub name: String,
    pub section: String,
    pub class: String,
    pub power: Option<u32>,
    pub station_id: String,
    pub operator: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshDiscoveryRequest {
    pub station_id: String,
    pub call_sign: String,
    pub name: String,
    pub section: String,
    pub class: String,
    pub port: u16,
    pub api_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshDiscoveryResponse {
    pub station: Station,
    pub qso_count: u32,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QsoSyncRequest {
    pub station_id: String,
    pub qsos: Vec<QsoEntry>,
    pub deleted_qso_ids: Vec<String>,
    pub updated_qsos: Vec<QsoEntry>,
    pub last_sync: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QsoSyncResponse {
    pub qsos: Vec<QsoEntry>,
    pub deleted_qso_ids: Vec<String>,
    pub updated_qsos: Vec<QsoEntry>,
    pub total_count: u32,
    pub sync_timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QsoOperation {
    pub operation_type: QsoOperationType,
    pub qso: Option<QsoEntry>,
    pub qso_id: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QsoOperationType {
    Add,
    Update,
    Delete,
    Clear,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageEntry {
    pub id: String,
    pub message_type: String,
    pub text: String,
    pub timestamp: DateTime<Utc>,
    pub from_station_id: String,
    pub target_station_id: Option<String>, // None means broadcast to all
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSyncRequest {
    pub station_id: String,
    pub messages: Vec<MessageEntry>,
    pub last_sync: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSyncResponse {
    pub messages: Vec<MessageEntry>,
    pub total_count: u32,
    pub sync_timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}
