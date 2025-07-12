use anyhow::Result;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

use crate::config_manager::ConfigManager;
use crate::mesh::MeshManager;
use crate::types::{QsoEntry, QsoSyncRequest, QsoSyncResponse, QsoOperation, QsoOperationType};

pub struct QsoManager {
    config_manager: Arc<RwLock<ConfigManager>>,
    qsos: HashMap<String, QsoEntry>,
    deleted_qso_ids: Vec<String>,
    recent_operations: Vec<QsoOperation>,
    last_sync: Option<DateTime<Utc>>,
}

impl QsoManager {
    pub async fn new(config_manager: Arc<RwLock<ConfigManager>>) -> Result<Self> {
        let mut manager = Self {
            config_manager,
            qsos: HashMap::new(),
            deleted_qso_ids: Vec::new(),
            recent_operations: Vec::new(),
            last_sync: None,
        };
        
        manager.load_qsos().await?;
        
        Ok(manager)
    }
    
    async fn load_qsos(&mut self) -> Result<()> {
        // TODO: Load QSOs from persistent storage
        // For now, start with empty collection
        info!("QSO manager initialized with {} QSOs", self.qsos.len());
        Ok(())
    }
    
    pub async fn add_qso(&mut self, qso: QsoEntry) -> Result<()> {
        debug!("Adding QSO: {} with {}", qso.id, qso.call_sign);
        self.qsos.insert(qso.id.clone(), qso.clone());
        
        // Track operation for sync
        self.recent_operations.push(QsoOperation {
            operation_type: QsoOperationType::Add,
            qso: Some(qso),
            qso_id: None,
            timestamp: Utc::now(),
        });
        
        self.save_qsos().await?;
        Ok(())
    }
    
    pub async fn update_qso(&mut self, qso: QsoEntry) -> Result<()> {
        debug!("Updating QSO: {} with {}", qso.id, qso.call_sign);
        if self.qsos.contains_key(&qso.id) {
            self.qsos.insert(qso.id.clone(), qso.clone());
            
            // Track operation for sync
            self.recent_operations.push(QsoOperation {
                operation_type: QsoOperationType::Update,
                qso: Some(qso),
                qso_id: None,
                timestamp: Utc::now(),
            });
            
            self.save_qsos().await?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("QSO with ID {} not found", qso.id))
        }
    }
    
    pub async fn delete_qso(&mut self, qso_id: &str) -> Result<()> {
        debug!("Deleting QSO: {}", qso_id);
        if self.qsos.remove(qso_id).is_some() {
            // Track deleted QSO ID
            self.deleted_qso_ids.push(qso_id.to_string());
            
            // Track operation for sync
            self.recent_operations.push(QsoOperation {
                operation_type: QsoOperationType::Delete,
                qso: None,
                qso_id: Some(qso_id.to_string()),
                timestamp: Utc::now(),
            });
            
            self.save_qsos().await?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("QSO with ID {} not found", qso_id))
        }
    }
    
    pub async fn get_qsos(&self) -> Vec<QsoEntry> {
        self.qsos.values().cloned().collect()
    }
    
    pub async fn get_qso_count(&self) -> usize {
        self.qsos.len()
    }
    
    pub async fn sync_with_peers(&mut self, mesh_manager: &Arc<RwLock<MeshManager>>) -> Result<()> {
        let stations = mesh_manager.read().await.get_discovered_stations();
        
        if stations.is_empty() {
            debug!("No stations to sync with");
            return Ok(());
        }
        
        info!("Syncing QSOs with {} stations", stations.len());
        
        for station in stations {
            if let Err(e) = self.sync_with_station(&station).await {
                warn!("Failed to sync with station {}: {}", station.call_sign, e);
            }
        }
        
        // Clear recent operations after successful sync
        self.recent_operations.clear();
        self.last_sync = Some(Utc::now());
        
        Ok(())
    }
    
    async fn sync_with_station(&self, station: &crate::types::Station) -> Result<()> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .danger_accept_invalid_certs(true)
            .build()?;
        
        // Collect updated QSOs from recent operations
        let updated_qsos: Vec<QsoEntry> = self.recent_operations
            .iter()
            .filter(|op| matches!(op.operation_type, QsoOperationType::Update))
            .filter_map(|op| op.qso.clone())
            .collect();
        
        let sync_request = QsoSyncRequest {
            station_id: station.id.clone(),
            qsos: self.qsos.values().cloned().collect(),
            deleted_qso_ids: self.deleted_qso_ids.clone(),
            updated_qsos: updated_qsos.clone(),
            last_sync: self.last_sync,
        };
        
        info!("Attempting to sync with station {} at {}:{} - sending {} QSOs, {} deleted, {} updated", 
              station.call_sign, station.ip_address, station.port,
              self.qsos.len(), self.deleted_qso_ids.len(), updated_qsos.len());
        
        let mut last_error = None;
        
        // Try both HTTP and HTTPS
        for protocol in &["http", "https"] {
            let url = format!("{}://{}:{}/api/qso/sync", protocol, station.ip_address, station.port);
            info!("Trying sync URL: {}", url);
            
            match client.post(&url).json(&sync_request).send().await {
                Ok(response) if response.status().is_success() => {
                    info!("Received successful response from {} (status: {})", station.call_sign, response.status());
                    match response.json::<crate::types::ApiResponse<QsoSyncResponse>>().await {
                        Ok(api_response) => {
                            if api_response.success {
                                if let Some(sync_response) = api_response.data {
                                    info!("Successfully synced with {}: received {} QSOs, {} deleted, {} updated", 
                                          station.call_sign, sync_response.qsos.len(), 
                                          sync_response.deleted_qso_ids.len(), sync_response.updated_qsos.len());
                                    // TODO: Process received QSOs and merge them
                                    return Ok(());
                                } else {
                                    warn!("Sync response from {} was successful but contained no data", station.call_sign);
                                    last_error = Some("No data in response".to_string());
                                }
                            } else {
                                let error_msg = api_response.error.unwrap_or_else(|| "Unknown API error".to_string());
                                warn!("Sync response from {} indicated failure: {}", station.call_sign, error_msg);
                                last_error = Some(format!("API error: {}", error_msg));
                            }
                        }
                        Err(e) => {
                            warn!("Sync response from {} could not be parsed as JSON: {}", station.call_sign, e);
                            last_error = Some(format!("JSON parse error: {}", e));
                        }
                    }
                }
                Ok(response) => {
                    let status = response.status();
                    match response.text().await {
                        Ok(body) => {
                            warn!("Sync request to {} at {} failed with status {}: {}", 
                                  station.call_sign, url, status, body);
                            last_error = Some(format!("HTTP {}: {}", status, body));
                        }
                        Err(e) => {
                            warn!("Sync request to {} at {} failed with status {} and couldn't read body: {}", 
                                  station.call_sign, url, status, e);
                            last_error = Some(format!("HTTP {} (body read failed)", status));
                        }
                    }
                }
                Err(e) => {
                    warn!("Sync request to {} at {} failed with connection error: {}", station.call_sign, url, e);
                    last_error = Some(format!("Connection error: {}", e));
                }
            }
        }
        
        let error_msg = last_error.unwrap_or_else(|| "Unknown error".to_string());
        Err(anyhow::anyhow!("Could not sync with station {}: {}", station.call_sign, error_msg))
    }
    
    pub async fn handle_sync_request(&mut self, request: QsoSyncRequest) -> Result<QsoSyncResponse> {
        debug!("Handling sync request from station: {}", request.station_id);
        
        // Process deleted QSOs
        for qso_id in &request.deleted_qso_ids {
            if self.qsos.remove(qso_id).is_some() {
                info!("Deleted QSO from sync: {}", qso_id);
                // Add to our deleted list if not already there
                if !self.deleted_qso_ids.contains(qso_id) {
                    self.deleted_qso_ids.push(qso_id.clone());
                }
            }
        }
        
        // Process updated QSOs
        for qso in &request.updated_qsos {
            if self.qsos.contains_key(&qso.id) {
                info!("Updating QSO from sync: {} with {}", qso.id, qso.call_sign);
                self.qsos.insert(qso.id.clone(), qso.clone());
            }
        }
        
        // Process new QSOs
        for qso in &request.qsos {
            if !self.qsos.contains_key(&qso.id) && !self.deleted_qso_ids.contains(&qso.id) {
                info!("Adding QSO from sync: {} with {}", qso.id, qso.call_sign);
                self.qsos.insert(qso.id.clone(), qso.clone());
            }
        }
        
        // Collect our updated QSOs to send back
        let our_updated_qsos: Vec<QsoEntry> = self.recent_operations
            .iter()
            .filter(|op| matches!(op.operation_type, QsoOperationType::Update))
            .filter_map(|op| op.qso.clone())
            .collect();
        
        let response = QsoSyncResponse {
            qsos: self.qsos.values().cloned().collect(),
            deleted_qso_ids: self.deleted_qso_ids.clone(),
            updated_qsos: our_updated_qsos,
            total_count: self.qsos.len() as u32,
            sync_timestamp: Utc::now(),
        };
        
        self.last_sync = Some(Utc::now());
        self.save_qsos().await?;
        
        Ok(response)
    }
    
    async fn save_qsos(&self) -> Result<()> {
        // TODO: Implement persistent storage for QSOs
        // For now, just log the save operation
        debug!("Saving {} QSOs to storage", self.qsos.len());
        Ok(())
    }
    
    pub async fn export_adif(&self) -> Result<String> {
        let mut adif = String::new();
        adif.push_str("ADIF Export from Field Day Logger Backend\n");
        adif.push_str("<ADIF_VER:5>3.1.0\n");
        adif.push_str("<PROGRAMID:20>FieldDay-Backend\n");
        adif.push_str("<EOH>\n\n");
        
        for qso in self.qsos.values() {
            adif.push_str(&format!("<CALL:{}>{}", qso.call_sign.len(), qso.call_sign));
            adif.push_str(&format!("<QSO_DATE:8>{}", qso.timestamp.format("%Y%m%d")));
            adif.push_str(&format!("<TIME_ON:6>{}", qso.timestamp.format("%H%M%S")));
            adif.push_str(&format!("<FREQ:{}>{}", qso.frequency.len(), qso.frequency));
            adif.push_str(&format!("<MODE:{}>{}", qso.mode.len(), qso.mode));
            adif.push_str(&format!("<NAME:{}>{}", qso.name.len(), qso.name));
            adif.push_str(&format!("<STATE:{}>{}", qso.section.len(), qso.section));
            
            if let Some(power) = qso.power {
                adif.push_str(&format!("<TX_PWR:{}>{}", power.to_string().len(), power));
            }
            
            if let Some(notes) = &qso.notes {
                if !notes.is_empty() {
                    adif.push_str(&format!("<NOTES:{}>{}", notes.len(), notes));
                }
            }
            
            adif.push_str("<EOR>\n");
        }
        
        Ok(adif)
    }
}
