use warp::{Filter, Reply, reply};
use std::convert::Infallible;

use crate::AppState;
use crate::types::{ApiResponse, Station};

pub fn routes(
    app_state: AppState,
) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let discover = warp::path("mesh")
        .and(warp::path("discover"))
        .and(warp::post())
        .and(with_app_state(app_state.clone()))
        .and_then(discover_stations);
    
    let stations = warp::path("mesh")
        .and(warp::path("stations"))
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(get_stations);
    
    let status = warp::path("mesh")
        .and(warp::path("status"))
        .and(warp::get())
        .and(with_app_state(app_state))
        .and_then(get_mesh_status);
    
    discover.or(stations).or(status)
}

async fn discover_stations(app_state: AppState) -> Result<impl Reply, Infallible> {
    let mut mesh_manager = app_state.mesh_manager.write().await;
    
    match mesh_manager.discover_stations().await {
        Ok(stations) => {
            let response = ApiResponse::success(stations);
            Ok(reply::json(&response))
        }
        Err(e) => {
            let response: ApiResponse<Vec<Station>> = ApiResponse::error(format!("Discovery failed: {}", e));
            Ok(reply::json(&response))
        }
    }
}

async fn get_stations(app_state: AppState) -> Result<impl Reply, Infallible> {
    let mesh_manager = app_state.mesh_manager.read().await;
    let stations = mesh_manager.get_discovered_stations();
    
    let response = ApiResponse::success(stations);
    Ok(reply::json(&response))
}

#[derive(serde::Serialize)]
struct MeshStatus {
    enabled: bool,
    station_count: usize,
    discovery_active: bool,
}

async fn get_mesh_status(app_state: AppState) -> Result<impl Reply, Infallible> {
    let mesh_manager = app_state.mesh_manager.read().await;
    let config_manager = app_state.config_manager.read().await;
    
    let status = MeshStatus {
        enabled: config_manager.get().mesh.enabled,
        station_count: mesh_manager.get_station_count(),
        discovery_active: true, // TODO: Track actual discovery state
    };
    
    let response = ApiResponse::success(status);
    Ok(reply::json(&response))
}

fn with_app_state(
    app_state: AppState,
) -> impl Filter<Extract = (AppState,), Error = Infallible> + Clone {
    warp::any().map(move || app_state.clone())
}
