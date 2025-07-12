use warp::{Filter, Reply, reply};
use std::convert::Infallible;

use crate::AppState;
use crate::types::{ApiResponse, Station};

pub fn routes(
    app_state: AppState,
) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let station_info = warp::path("station-info")
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(get_station_info);
    
    let update_station = warp::path("station")
        .and(warp::put())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(update_station_info);
    
    let station_status = warp::path("station")
        .and(warp::path("status"))
        .and(warp::get())
        .and(with_app_state(app_state))
        .and_then(get_station_status);
    
    station_info.or(update_station).or(station_status)
}

async fn get_station_info(app_state: AppState) -> Result<impl Reply, Infallible> {
    let station_manager = app_state.station_manager.read().await;
    
    match station_manager.get_station_info() {
        Some(station) => {
            let response = ApiResponse::success(station.clone());
            Ok(reply::json(&response))
        }
        None => {
            let response: ApiResponse<Station> = ApiResponse::error("Station not configured".to_string());
            Ok(reply::json(&response))
        }
    }
}

#[derive(serde::Deserialize)]
struct UpdateStationRequest {
    call_sign: String,
    name: String,
    section: String,
    class: String,
}

async fn update_station_info(
    request: UpdateStationRequest,
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    let mut station_manager = app_state.station_manager.write().await;
    
    match station_manager.update_station_info(
        request.call_sign,
        request.name,
        request.section,
        request.class,
    ).await {
        Ok(_) => {
            let response = ApiResponse::success("Station updated successfully");
            Ok(reply::json(&response))
        }
        Err(e) => {
            let response: ApiResponse<&str> = ApiResponse::error(format!("Failed to update station: {}", e));
            Ok(reply::json(&response))
        }
    }
}

#[derive(serde::Serialize)]
struct StationStatus {
    configured: bool,
    station_id: Option<String>,
    call_sign: Option<String>,
}

async fn get_station_status(app_state: AppState) -> Result<impl Reply, Infallible> {
    let station_manager = app_state.station_manager.read().await;
    
    let status = if let Some(station) = station_manager.get_station_info() {
        StationStatus {
            configured: station_manager.is_configured(),
            station_id: Some(station.id.clone()),
            call_sign: Some(station.call_sign.clone()),
        }
    } else {
        StationStatus {
            configured: false,
            station_id: None,
            call_sign: None,
        }
    };
    
    let response = ApiResponse::success(status);
    Ok(reply::json(&response))
}

fn with_app_state(
    app_state: AppState,
) -> impl Filter<Extract = (AppState,), Error = Infallible> + Clone {
    warp::any().map(move || app_state.clone())
}
