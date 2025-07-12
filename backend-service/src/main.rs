use clap::Parser;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};
use warp::Filter;

mod api;
mod mesh;
mod qso;
mod station;
mod types;
mod config_manager;

use crate::mesh::MeshManager;
use crate::qso::QsoManager;
use crate::station::StationManager;
use crate::config_manager::ConfigManager;

#[derive(Parser)]
#[command(name = "fieldday-backend")]
#[command(about = "Field Day Logger Backend Service")]
struct Args {
    #[arg(short, long, default_value = "3030")]
    port: u16,
    
    #[arg(short, long, default_value = "8080")]
    discovery_port: u16,
    
    #[arg(short, long)]
    config_path: Option<String>,
    
    #[arg(short, long)]
    verbose: bool,
}

#[derive(Clone)]
pub struct AppState {
    pub mesh_manager: Arc<RwLock<MeshManager>>,
    pub qso_manager: Arc<RwLock<QsoManager>>,
    pub station_manager: Arc<RwLock<StationManager>>,
    pub config_manager: Arc<RwLock<ConfigManager>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    
    // Initialize tracing
    let level = if args.verbose {
        tracing::Level::DEBUG
    } else {
        tracing::Level::INFO
    };
    
    tracing_subscriber::fmt()
        .with_max_level(level)
        .init();
    
    info!("Starting Field Day Logger Backend Service");
    info!("API Port: {}", args.port);
    info!("Discovery Port: {}", args.discovery_port);
    
    // Initialize configuration
    let config_manager = Arc::new(RwLock::new(
        ConfigManager::new(args.config_path).await?
    ));
    
    // Initialize managers
    let station_manager = Arc::new(RwLock::new(
        StationManager::new(config_manager.clone()).await?
    ));
    
    let mesh_manager = Arc::new(RwLock::new(
        MeshManager::new(args.discovery_port, args.port, station_manager.clone()).await?
    ));
    
    let qso_manager = Arc::new(RwLock::new(
        QsoManager::new(config_manager.clone()).await?
    ));
    
    let app_state = AppState {
        mesh_manager: mesh_manager.clone(),
        qso_manager: qso_manager.clone(),
        station_manager: station_manager.clone(),
        config_manager: config_manager.clone(),
    };
    
    // Start background tasks
    let mesh_discovery_manager = mesh_manager.clone();
    tokio::spawn(async move {
        if let Err(e) = mesh_discovery_manager.read().await.start_discovery().await {
            error!("Mesh discovery failed: {}", e);
        }
    });
    
    let qso_sync_manager = qso_manager.clone();
    let mesh_sync_manager = mesh_manager.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            
            if let Err(e) = qso_sync_manager.write().await.sync_with_peers(&mesh_sync_manager).await {
                warn!("QSO sync failed: {}", e);
            }
        }
    });
    
    // Setup API routes
    let api_routes = api::create_routes(app_state);
    
    let cors = warp::cors()
        .allow_any_origin()
        .allow_headers(vec!["content-type"])
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE"]);
    
    let routes = api_routes
        .with(cors)
        .with(warp::log("fieldday_backend"));
    
    info!("Backend service ready on port {}", args.port);
    
    warp::serve(routes)
        .run(([0, 0, 0, 0], args.port))
        .await;
    
    Ok(())
}
