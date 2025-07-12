use anyhow::Result;
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::config_manager::ConfigManager;
use crate::types::Station;

pub struct StationManager {
    config_manager: Arc<RwLock<ConfigManager>>,
    station_info: Option<Station>,
}

impl StationManager {
    pub async fn new(config_manager: Arc<RwLock<ConfigManager>>) -> Result<Self> {
        let mut manager = Self {
            config_manager,
            station_info: None,
        };
        
        manager.initialize().await?;
        
        Ok(manager)
    }
    
    async fn initialize(&mut self) -> Result<()> {
        let config = self.config_manager.read().await;
        let station_config = &config.get().station;
        
        self.station_info = Some(Station {
            id: station_config.id.clone(),
            call_sign: station_config.call_sign.clone(),
            name: station_config.name.clone(),
            section: station_config.section.clone(),
            class: station_config.class.clone(),
            ip_address: self.get_local_ip().await,
            port: 3030, // Backend API port
            last_seen: Utc::now(),
            is_self: true,
        });
        
        info!("Station initialized: {}", station_config.id);
        Ok(())
    }
    
    pub fn get_station_info(&self) -> Option<&Station> {
        self.station_info.as_ref()
    }
    
    pub async fn update_station_info(&mut self, call_sign: String, name: String, section: String, class: String) -> Result<()> {
        {
            let mut config = self.config_manager.write().await;
            config.update_station(call_sign.clone(), name.clone(), section.clone(), class.clone()).await?;
        }
        
        if let Some(station) = &mut self.station_info {
            station.call_sign = call_sign;
            station.name = name;
            station.section = section;
            station.class = class;
        }
        
        info!("Station info updated");
        Ok(())
    }
    
    pub fn is_configured(&self) -> bool {
        if let Some(station) = &self.station_info {
            !station.call_sign.is_empty() && !station.name.is_empty()
        } else {
            false
        }
    }
    
    async fn get_local_ip(&self) -> String {
        // Try to get the local IP address
        match local_ip_address::local_ip() {
            Ok(ip) => ip.to_string(),
            Err(_) => {
                warn!("Could not determine local IP address, using localhost");
                "127.0.0.1".to_string()
            }
        }
    }
}
