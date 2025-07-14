use warp::{Filter, Reply, reply};
use std::convert::Infallible;
use serde::{Deserialize, Serialize};
use tracing::{info, error};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResetLogCommand {
    pub command_id: String,
    pub timestamp: u64,
    pub issued_by: String,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdminCommandResponse {
    pub success: bool,
    pub message: String,
    pub timestamp: u64,
}

pub fn routes(
    app_state: AppState,
) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let admin_path = warp::path("admin");
    
    let reset_log = admin_path
        .and(warp::path("reset-log"))
        .and(warp::post())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(handle_reset_log);
    
    let get_reset_status = admin_path
        .and(warp::path("reset-status"))
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(handle_get_reset_status);
    
    reset_log.or(get_reset_status)
}

fn with_app_state(
    app_state: AppState,
) -> impl Filter<Extract = (AppState,), Error = Infallible> + Clone {
    warp::any().map(move || app_state.clone())
}

async fn handle_reset_log(
    command: ResetLogCommand,
    app_state: AppState,
) -> Result<impl Reply, warp::Rejection> {
    info!("Received reset log command from {}: {:?}", command.issued_by, command);
    
    // Store the reset command for propagation to other stations
    {
        let mut mesh_manager = app_state.mesh_manager.write().await;
        mesh_manager.set_log_reset_command(command.clone()).await;
    }
    
    // Clear all QSOs from this station
    {
        let mut qso_manager = app_state.qso_manager.write().await;
        match qso_manager.clear_all_qsos().await {
            Ok(_) => {
                info!("Successfully cleared all QSOs on station {}", command.issued_by);
            }
            Err(e) => {
                error!("Failed to clear QSOs on station {}: {}", command.issued_by, e);
                return Ok(reply::with_status(
                    reply::json(&AdminCommandResponse {
                        success: false,
                        message: format!("Failed to clear QSOs: {}", e),
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                    }),
                    warp::http::StatusCode::INTERNAL_SERVER_ERROR,
                ));
            }
        }
    }
    
    // Clear all messages from this station
    {
        let mut message_manager = app_state.message_manager.write().await;
        match message_manager.clear_all_messages().await {
            Ok(_) => {
                info!("Successfully cleared all messages on station {}", command.issued_by);
            }
            Err(e) => {
                error!("Failed to clear messages on station {}: {}", command.issued_by, e);
                return Ok(reply::with_status(
                    reply::json(&AdminCommandResponse {
                        success: false,
                        message: format!("Failed to clear messages: {}", e),
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                    }),
                    warp::http::StatusCode::INTERNAL_SERVER_ERROR,
                ));
            }
        }
    }
    
    // Broadcast the reset command to all connected stations
    {
        let mesh_manager = app_state.mesh_manager.read().await;
        if let Err(e) = mesh_manager.broadcast_reset_command(&command).await {
            error!("Failed to broadcast reset command: {}", e);
        }
    }
    
    Ok(reply::with_status(
        reply::json(&AdminCommandResponse {
            success: true,
            message: "Log reset command executed successfully - cleared all QSOs and messages".to_string(),
            timestamp: command.timestamp,
        }),
        warp::http::StatusCode::OK,
    ))
}

async fn handle_get_reset_status(
    app_state: AppState,
) -> Result<impl Reply, warp::Rejection> {
    let mesh_manager = app_state.mesh_manager.read().await;
    let reset_info = mesh_manager.get_last_reset_command().await;
    
    Ok(reply::json(&reset_info))
}
