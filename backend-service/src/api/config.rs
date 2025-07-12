use warp::{Filter, Reply, reply};
use std::convert::Infallible;

use crate::AppState;
use crate::types::ApiResponse;
use crate::config_manager::{MeshConfig, QsoConfig};

pub fn routes(
    app_state: AppState,
) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let get_config = warp::path("config")
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(get_config);
    
    let update_mesh_config = warp::path("config")
        .and(warp::path("mesh"))
        .and(warp::put())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(update_mesh_config);
    
    let update_qso_config = warp::path("config")
        .and(warp::path("qso"))
        .and(warp::put())
        .and(warp::body::json())
        .and(with_app_state(app_state))
        .and_then(update_qso_config);
    
    get_config.or(update_mesh_config).or(update_qso_config)
}

async fn get_config(app_state: AppState) -> Result<impl Reply, Infallible> {
    let config_manager = app_state.config_manager.read().await;
    let config = config_manager.get().clone();
    
    let response = ApiResponse::success(config);
    Ok(reply::json(&response))
}

async fn update_mesh_config(
    mesh_config: MeshConfig,
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    let mut config_manager = app_state.config_manager.write().await;
    
    match config_manager.update_mesh_config(mesh_config).await {
        Ok(_) => {
            let response = ApiResponse::success("Mesh configuration updated");
            Ok(reply::json(&response))
        }
        Err(e) => {
            let response: ApiResponse<&str> = ApiResponse::error(format!("Failed to update mesh config: {}", e));
            Ok(reply::json(&response))
        }
    }
}

async fn update_qso_config(
    qso_config: QsoConfig,
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    let mut config_manager = app_state.config_manager.write().await;
    
    match config_manager.update_qso_config(qso_config).await {
        Ok(_) => {
            let response = ApiResponse::success("QSO configuration updated");
            Ok(reply::json(&response))
        }
        Err(e) => {
            let response: ApiResponse<&str> = ApiResponse::error(format!("Failed to update QSO config: {}", e));
            Ok(reply::json(&response))
        }
    }
}

fn with_app_state(
    app_state: AppState,
) -> impl Filter<Extract = (AppState,), Error = Infallible> + Clone {
    warp::any().map(move || app_state.clone())
}
