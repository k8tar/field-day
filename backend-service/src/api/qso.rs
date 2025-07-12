use warp::{Filter, Reply, reply};
use std::convert::Infallible;

use crate::AppState;
use crate::types::{ApiResponse, QsoEntry, QsoSyncRequest, QsoSyncResponse};

pub fn routes(
    app_state: AppState,
) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let get_qsos = warp::path("qso")
        .and(warp::path("list"))
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(get_qsos);
    
    let add_qso = warp::path("qso")
        .and(warp::path("add"))
        .and(warp::post())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(add_qso);
    
    let update_qso = warp::path("qso")
        .and(warp::path("update"))
        .and(warp::put())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(update_qso);
    
    let delete_qso = warp::path("qso")
        .and(warp::path("delete"))
        .and(warp::path::param::<String>())
        .and(warp::delete())
        .and(with_app_state(app_state.clone()))
        .and_then(delete_qso);
    
    let sync_qsos = warp::path("qso")
        .and(warp::path("sync"))
        .and(warp::post())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(sync_qsos);
    
    let export_adif = warp::path("qso")
        .and(warp::path("export"))
        .and(warp::path("adif"))
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(export_adif);
    
    let qso_count = warp::path("qso")
        .and(warp::path("count"))
        .and(warp::get())
        .and(with_app_state(app_state))
        .and_then(get_qso_count);
    
    get_qsos.or(add_qso).or(update_qso).or(delete_qso).or(sync_qsos).or(export_adif).or(qso_count)
}

async fn get_qsos(app_state: AppState) -> Result<impl Reply, Infallible> {
    let qso_manager = app_state.qso_manager.read().await;
    let qsos = qso_manager.get_qsos().await;
    
    let response = ApiResponse::success(qsos);
    Ok(reply::json(&response))
}

async fn add_qso(qso: QsoEntry, app_state: AppState) -> Result<impl Reply, Infallible> {
    let mut qso_manager = app_state.qso_manager.write().await;
    
    match qso_manager.add_qso(qso).await {
        Ok(_) => {
            let response = ApiResponse::success("QSO added successfully");
            Ok(reply::json(&response))
        }
        Err(e) => {
            let response: ApiResponse<&str> = ApiResponse::error(format!("Failed to add QSO: {}", e));
            Ok(reply::json(&response))
        }
    }
}

async fn update_qso(qso: QsoEntry, app_state: AppState) -> Result<impl Reply, Infallible> {
    let mut qso_manager = app_state.qso_manager.write().await;
    
    match qso_manager.update_qso(qso).await {
        Ok(_) => {
            let response = ApiResponse::success("QSO updated successfully");
            Ok(reply::json(&response))
        }
        Err(e) => {
            let response: ApiResponse<&str> = ApiResponse::error(format!("Failed to update QSO: {}", e));
            Ok(reply::json(&response))
        }
    }
}

async fn delete_qso(qso_id: String, app_state: AppState) -> Result<impl Reply, Infallible> {
    let mut qso_manager = app_state.qso_manager.write().await;
    
    match qso_manager.delete_qso(&qso_id).await {
        Ok(_) => {
            let response = ApiResponse::success("QSO deleted successfully");
            Ok(reply::json(&response))
        }
        Err(e) => {
            let response: ApiResponse<&str> = ApiResponse::error(format!("Failed to delete QSO: {}", e));
            Ok(reply::json(&response))
        }
    }
}

async fn sync_qsos(request: QsoSyncRequest, app_state: AppState) -> Result<impl Reply, Infallible> {
    let mut qso_manager = app_state.qso_manager.write().await;
    
    match qso_manager.handle_sync_request(request).await {
        Ok(sync_response) => {
            let response = ApiResponse::success(sync_response);
            Ok(reply::json(&response))
        }
        Err(e) => {
            let response: ApiResponse<QsoSyncResponse> = ApiResponse::error(format!("Sync failed: {}", e));
            Ok(reply::json(&response))
        }
    }
}

async fn export_adif(app_state: AppState) -> Result<impl Reply, Infallible> {
    let qso_manager = app_state.qso_manager.read().await;
    
    match qso_manager.export_adif().await {
        Ok(adif_content) => {
            let response = warp::reply::with_header(
                adif_content,
                "content-type",
                "text/plain; charset=utf-8",
            );
            Ok(response.into_response())
        }
        Err(e) => {
            let response: ApiResponse<&str> = ApiResponse::error(format!("Export failed: {}", e));
            Ok(reply::json(&response).into_response())
        }
    }
}

#[derive(serde::Serialize)]
struct QsoCount {
    count: usize,
}

async fn get_qso_count(app_state: AppState) -> Result<impl Reply, Infallible> {
    let qso_manager = app_state.qso_manager.read().await;
    let count = qso_manager.get_qso_count().await;
    
    let qso_count = QsoCount { count };
    let response = ApiResponse::success(qso_count);
    Ok(reply::json(&response))
}

fn with_app_state(
    app_state: AppState,
) -> impl Filter<Extract = (AppState,), Error = Infallible> + Clone {
    warp::any().map(move || app_state.clone())
}
