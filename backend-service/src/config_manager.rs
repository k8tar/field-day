use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendConfig {
    pub station: StationConfig,
    pub mesh: MeshConfig,
    pub qso: QsoConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StationConfig {
    pub id: String,
    pub call_sign: String,
    pub name: String,
    pub section: String,
    pub class: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshConfig {
    pub enabled: bool,
    pub discovery_interval_secs: u64,
    pub max_discovery_attempts: u32,
    pub timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QsoConfig {
    pub sync_interval_secs: u64,
    pub max_retries: u32,
    pub batch_size: usize,
}

impl Default for BackendConfig {
    fn default() -> Self {
        Self {
            station: StationConfig {
                id: uuid::Uuid::new_v4().to_string(),
                call_sign: "".to_string(),
                name: "".to_string(),
                section: "".to_string(),
                class: "".to_string(),
            },
            mesh: MeshConfig {
                enabled: true,
                discovery_interval_secs: 30,
                max_discovery_attempts: 3,
                timeout_secs: 5,
            },
            qso: QsoConfig {
                sync_interval_secs: 30,
                max_retries: 3,
                batch_size: 100,
            },
        }
    }
}

pub struct ConfigManager {
    config: BackendConfig,
    config_path: PathBuf,
}

impl ConfigManager {
    pub async fn new(config_path: Option<String>) -> Result<Self> {
        let config_path = match config_path {
            Some(path) => PathBuf::from(path),
            None => {
                let mut path = dirs::config_dir()
                    .unwrap_or_else(|| PathBuf::from("."));
                path.push("fieldday-backend");
                path.push("config.json");
                path
            }
        };
        
        let config = if config_path.exists() {
            let content = fs::read_to_string(&config_path).await?;
            match serde_json::from_str(&content) {
                Ok(config) => {
                    info!("Loaded configuration from {:?}", config_path);
                    config
                }
                Err(e) => {
                    warn!("Failed to parse config file: {}. Using defaults.", e);
                    BackendConfig::default()
                }
            }
        } else {
            info!("Config file not found. Creating default configuration.");
            BackendConfig::default()
        };
        
        let manager = Self {
            config,
            config_path,
        };
        
        manager.save().await?;
        
        Ok(manager)
    }
    
    pub fn get(&self) -> &BackendConfig {
        &self.config
    }
    
    pub async fn update_station(&mut self, call_sign: String, name: String, section: String, class: String) -> Result<()> {
        self.config.station.call_sign = call_sign;
        self.config.station.name = name;
        self.config.station.section = section;
        self.config.station.class = class;
        self.save().await
    }
    
    pub async fn update_mesh_config(&mut self, config: MeshConfig) -> Result<()> {
        self.config.mesh = config;
        self.save().await
    }
    
    pub async fn update_qso_config(&mut self, config: QsoConfig) -> Result<()> {
        self.config.qso = config;
        self.save().await
    }
    
    async fn save(&self) -> Result<()> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        let content = serde_json::to_string_pretty(&self.config)?;
        fs::write(&self.config_path, content).await?;
        
        Ok(())
    }
}
