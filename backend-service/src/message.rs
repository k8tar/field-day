use anyhow::Result;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

use crate::config_manager::ConfigManager;
use crate::mesh::MeshManager;
use crate::types::{MessageEntry, MessageSyncRequest, MessageSyncResponse};

pub struct MessageManager {
    config_manager: Arc<RwLock<ConfigManager>>,
    messages: HashMap<String, MessageEntry>,
    last_sync: Option<DateTime<Utc>>,
}

impl MessageManager {
    pub async fn new(config_manager: Arc<RwLock<ConfigManager>>) -> Result<Self> {
        let mut manager = Self {
            config_manager,
            messages: HashMap::new(),
            last_sync: None,
        };
        
        manager.load_messages().await?;
        
        Ok(manager)
    }
    
    async fn load_messages(&mut self) -> Result<()> {
        let config = self.config_manager.read().await;
        let data_dir = config.get_data_directory();
        let message_file = data_dir.join("messages.json");
        
        if message_file.exists() {
            match std::fs::read_to_string(&message_file) {
                Ok(content) => {
                    match serde_json::from_str::<Vec<MessageEntry>>(&content) {
                        Ok(messages) => {
                            for message in messages {
                                self.messages.insert(message.id.clone(), message);
                            }
                            info!("Loaded {} messages from storage", self.messages.len());
                        }
                        Err(e) => {
                            warn!("Failed to parse messages from {}: {}", message_file.display(), e);
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to read messages from {}: {}", message_file.display(), e);
                }
            }
        } else {
            info!("Message file does not exist, starting with empty collection");
        }
        
        info!("Message manager initialized with {} messages", self.messages.len());
        Ok(())
    }
    
    pub async fn add_message(&mut self, message: MessageEntry) -> Result<()> {
        debug!("Adding message: {} from {}", message.id, message.from_station_id);
        self.messages.insert(message.id.clone(), message);
        self.save_messages().await?;
        Ok(())
    }
    
    pub async fn get_messages(&self) -> Vec<MessageEntry> {
        self.messages.values().cloned().collect()
    }
    
    pub async fn get_message_count(&self) -> usize {
        self.messages.len()
    }
    
    pub async fn sync_with_peers(&mut self, mesh_manager: &Arc<RwLock<MeshManager>>) -> Result<()> {
        let stations = mesh_manager.read().await.get_discovered_stations();
        
        if stations.is_empty() {
            debug!("No stations to sync messages with");
            return Ok(());
        }
        
        info!("Syncing messages with {} stations", stations.len());
        
        for station in stations {
            match self.sync_with_station(&station).await {
                Ok(Some(sync_response)) => {
                    if let Err(e) = self.process_sync_response(sync_response).await {
                        warn!("Failed to process message sync response from {}: {}", station.call_sign, e);
                    } else {
                        info!("Successfully processed message sync response from {}", station.call_sign);
                    }
                }
                Ok(None) => {
                    debug!("No message sync response received from {}", station.call_sign);
                }
                Err(e) => {
                    warn!("Failed to sync messages with station {}: {}", station.call_sign, e);
                }
            }
        }
        
        self.last_sync = Some(Utc::now());
        Ok(())
    }
    
    async fn sync_with_station(&self, station: &crate::types::Station) -> Result<Option<MessageSyncResponse>> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .danger_accept_invalid_certs(true)
            .build()?;
        
        let sync_request = MessageSyncRequest {
            station_id: station.id.clone(),
            messages: self.messages.values().cloned().collect(),
            last_sync: self.last_sync,
        };
        
        info!("Attempting to sync messages with station {} at {}:{} - sending {} messages", 
              station.call_sign, station.ip_address, station.port, self.messages.len());
        
        let mut last_error = None;
        
        // Try both HTTP and HTTPS
        for protocol in &["http", "https"] {
            let url = format!("{}://{}:{}/api/message/sync", protocol, station.ip_address, station.port);
            info!("Trying message sync URL: {}", url);
            
            match client.post(&url).json(&sync_request).send().await {
                Ok(response) if response.status().is_success() => {
                    info!("Received successful message sync response from {} (status: {})", station.call_sign, response.status());
                    match response.json::<crate::types::ApiResponse<MessageSyncResponse>>().await {
                        Ok(api_response) => {
                            if api_response.success {
                                if let Some(sync_response) = api_response.data {
                                    info!("Successfully synced messages with {}: received {} messages", 
                                          station.call_sign, sync_response.messages.len());
                                    return Ok(Some(sync_response));
                                } else {
                                    warn!("Message sync response from {} was successful but contained no data", station.call_sign);
                                    last_error = Some("No data in response".to_string());
                                }
                            } else {
                                let error_msg = api_response.error.unwrap_or_else(|| "Unknown API error".to_string());
                                warn!("Message sync response from {} indicated failure: {}", station.call_sign, error_msg);
                                last_error = Some(format!("API error: {}", error_msg));
                            }
                        }
                        Err(e) => {
                            warn!("Message sync response from {} could not be parsed as JSON: {}", station.call_sign, e);
                            last_error = Some(format!("JSON parse error: {}", e));
                        }
                    }
                }
                Ok(response) => {
                    let status = response.status();
                    match response.text().await {
                        Ok(body) => {
                            warn!("Message sync request to {} at {} failed with status {}: {}", 
                                  station.call_sign, url, status, body);
                            last_error = Some(format!("HTTP {}: {}", status, body));
                        }
                        Err(e) => {
                            warn!("Message sync request to {} at {} failed with status {} and couldn't read body: {}", 
                                  station.call_sign, url, status, e);
                            last_error = Some(format!("HTTP {} (body read failed)", status));
                        }
                    }
                }
                Err(e) => {
                    warn!("Message sync request to {} at {} failed with connection error: {}", station.call_sign, url, e);
                    last_error = Some(format!("Connection error: {}", e));
                }
            }
        }
        
        let error_msg = last_error.unwrap_or_else(|| "Unknown error".to_string());
        Err(anyhow::anyhow!("Could not sync messages with station {}: {}", station.call_sign, error_msg))
    }
    
    pub async fn handle_sync_request(&mut self, request: MessageSyncRequest) -> Result<MessageSyncResponse> {
        debug!("Handling message sync request from station: {}", request.station_id);
        
        // Process new messages
        for message in &request.messages {
            if !self.messages.contains_key(&message.id) {
                info!("Adding message from sync: {} from {}", message.id, message.from_station_id);
                self.messages.insert(message.id.clone(), message.clone());
            }
        }
        
        let response = MessageSyncResponse {
            messages: self.messages.values().cloned().collect(),
            total_count: self.messages.len() as u32,
            sync_timestamp: Utc::now(),
        };
        
        self.last_sync = Some(Utc::now());
        self.save_messages().await?;
        
        Ok(response)
    }
    
    async fn save_messages(&self) -> Result<()> {
        let config = self.config_manager.read().await;
        let data_dir = config.get_data_directory();
        
        // Ensure data directory exists
        if let Err(e) = std::fs::create_dir_all(&data_dir) {
            warn!("Failed to create data directory {}: {}", data_dir.display(), e);
            return Ok(());
        }
        
        let message_file = data_dir.join("messages.json");
        let messages: Vec<MessageEntry> = self.messages.values().cloned().collect();
        
        match serde_json::to_string_pretty(&messages) {
            Ok(json_content) => {
                match std::fs::write(&message_file, json_content) {
                    Ok(_) => {
                        debug!("Saved {} messages to {}", self.messages.len(), message_file.display());
                    }
                    Err(e) => {
                        warn!("Failed to write messages to {}: {}", message_file.display(), e);
                    }
                }
            }
            Err(e) => {
                warn!("Failed to serialize messages: {}", e);
            }
        }
        
        Ok(())
    }
    
    async fn process_sync_response(&mut self, sync_response: MessageSyncResponse) -> Result<()> {
        let mut changes_made = false;
        
        // Process new messages
        for message in &sync_response.messages {
            if !self.messages.contains_key(&message.id) {
                info!("Adding message from remote sync: {} from {}", message.id, message.from_station_id);
                self.messages.insert(message.id.clone(), message.clone());
                changes_made = true;
            }
        }
        
        if changes_made {
            info!("Message sync processing complete - now have {} total messages", self.messages.len());
            self.save_messages().await?;
        } else {
            debug!("No changes made during message sync processing");
        }
        
        Ok(())
    }
}
