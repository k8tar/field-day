use std::convert::Infallible;
use std::fs;
use std::path::PathBuf;
use warp::{Filter, Reply, reply};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::AppState;

#[derive(Deserialize)]
struct WriteRequest {
    filename: String,
    content: String,
}

#[derive(Serialize)]
struct ReadResponse {
    content: String,
}

// Restrict the files that can be read/written to prevent path traversal
fn is_allowed_filename(filename: &str) -> bool {
    matches!(
        filename,
        "station-config.json"
            | "qso-data.json"
            | "operators.json"
            | "bonuses.json"
            | "settings.json"
            | "messages.json"
    )
}

pub fn routes(
    app_state: AppState,
) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let files_base = warp::path("files");

    let write_file = files_base
        .and(warp::path("write"))
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(handle_write);

    let read_file = files_base
        .and(warp::path("read"))
        .and(warp::path::end())
        .and(warp::get())
        .and(warp::query::<std::collections::HashMap<String, String>>())
        .and(with_app_state(app_state.clone()))
        .and_then(handle_read);

    write_file.or(read_file)
}

fn with_app_state(
    app_state: AppState,
) -> impl Filter<Extract = (AppState,), Error = Infallible> + Clone {
    warp::any().map(move || app_state.clone())
}

async fn handle_write(
    req: WriteRequest,
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    if !is_allowed_filename(&req.filename) {
        let msg = format!("Forbidden filename: {}", req.filename);
        return Ok(warp::reply::with_status(
            warp::reply::json(&serde_json::json!({ "error": msg })),
            warp::http::StatusCode::FORBIDDEN,
        ));
    }

    let data_dir = {
        let cfg = app_state.config_manager.read().await;
        cfg.get_data_directory()
    };

    // Ensure directory exists
    if let Err(e) = fs::create_dir_all(&data_dir) {
        warn!("Failed to create data directory {}: {}", data_dir.display(), e);
    }

    let path: PathBuf = data_dir.join(&req.filename);
    match fs::write(&path, req.content) {
        Ok(_) => {
            info!("Wrote file: {}", path.display());
            Ok(warp::reply::with_status(
                warp::reply::json(&serde_json::json!({ "success": true })),
                warp::http::StatusCode::OK,
            ))
        }
        Err(e) => {
            warn!("Failed writing {}: {}", path.display(), e);
            Ok(warp::reply::with_status(
                warp::reply::json(&serde_json::json!({ "error": e.to_string() })),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn handle_read(
    params: std::collections::HashMap<String, String>,
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    let filename = match params.get("filename") {
        Some(f) => f.clone(),
        None => {
            return Ok(warp::reply::with_status(
                warp::reply::json(&serde_json::json!({ "error": "Missing filename" })),
                warp::http::StatusCode::BAD_REQUEST,
            ));
        }
    };

    if !is_allowed_filename(&filename) {
        let msg = format!("Forbidden filename: {}", filename);
        return Ok(warp::reply::with_status(
            warp::reply::json(&serde_json::json!({ "error": msg })),
            warp::http::StatusCode::FORBIDDEN,
        ));
    }

    let data_dir = {
        let cfg = app_state.config_manager.read().await;
        cfg.get_data_directory()
    };

    let path: PathBuf = data_dir.join(&filename);
    match fs::read_to_string(&path) {
        Ok(content) => {
            let resp = ReadResponse { content };
            Ok(reply::json(&resp))
        }
        Err(_) => Ok(warp::reply::with_status(
            warp::reply::json(&serde_json::json!({ "error": "Not found" })),
            warp::http::StatusCode::NOT_FOUND,
        )),
    }
}
