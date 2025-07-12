use anyhow::Result;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

use crate::config_manager::ConfigManager;
use crate::mesh::MeshManager;
use crate::types::{QsoEntry, QsoSyncRequest, QsoSyncResponse};

pub struct QsoManager {
    config_manager: Arc<RwLock<ConfigManager>>,
    qsos: HashMap<String, QsoEntry>,
    last_sync: Option<DateTime<Utc>>,
}

impl QsoManager {
    pub async fn new(config_manager: Arc<RwLock<ConfigManager>>) -> Result<Self> {
        let mut manager = Self {
            config_manager,
            qsos: HashMap::new(),
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
        self.qsos.insert(qso.id.clone(), qso);
        self.save_qsos().await?;
        Ok(())
    }
    
    pub async fn get_qsos(&self) -> Vec<QsoEntry> {
        self.qsos.values().cloned().collect()
    }
    
    pub async fn get_qso_count(&self) -> usize {
        self.qsos.len()
    }
    
    pub async fn sync_with_peers(&self, mesh_manager: &Arc<RwLock<MeshManager>>) -> Result<()> {
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
        
        Ok(())
    }
    
    async fn sync_with_station(&self, station: &crate::types::Station) -> Result<()> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .danger_accept_invalid_certs(true)
            .build()?;
        
        let sync_request = QsoSyncRequest {
            station_id: station.id.clone(),
            qsos: self.qsos.values().cloned().collect(),
            last_sync: self.last_sync,
        };
        
        // Try both HTTP and HTTPS
        for protocol in &["http", "https"] {
            let url = format!("{}://{}:{}/api/qso/sync", protocol, station.ip_address, station.port);
            
            match client.post(&url).json(&sync_request).send().await {
                Ok(response) if response.status().is_success() => {
                    if let Ok(sync_response) = response.json::<QsoSyncResponse>().await {
                        debug!("Received {} QSOs from {}", sync_response.qsos.len(), station.call_sign);
                        // TODO: Process received QSOs and merge them
                        return Ok(());
                    }
                }
                Ok(response) => {
                    debug!("Sync request to {} failed with status: {}", station.call_sign, response.status());
                }
                Err(e) => {
                    debug!("Sync request to {} failed: {}", station.call_sign, e);
                }
            }
        }
        
        Err(anyhow::anyhow!("Could not sync with station {}", station.call_sign))
    }
    
    pub async fn handle_sync_request(&mut self, request: QsoSyncRequest) -> Result<QsoSyncResponse> {
        debug!("Handling sync request from station: {}", request.station_id);
        
        // TODO: Implement proper QSO merging logic
        // For now, just return our QSOs
        
        let response = QsoSyncResponse {
            qsos: self.qsos.values().cloned().collect(),
            total_count: self.qsos.len() as u32,
            sync_timestamp: Utc::now(),
        };
        
        // TODO: Process and merge incoming QSOs from the request
        for qso in request.qsos {
            if !self.qsos.contains_key(&qso.id) {
                info!("Adding QSO from sync: {} with {}", qso.id, qso.call_sign);
                self.qsos.insert(qso.id.clone(), qso);
            }
        }
        
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
