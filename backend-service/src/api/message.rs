use std::convert::Infallible;
use warp::{Filter, Reply, reply};
use serde_json::json;

use crate::AppState;
use crate::types::{ApiResponse, MessageEntry, MessageSyncRequest, MessageSyncResponse};

pub fn routes(
    app_state: AppState,
) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let message_base = warp::path("message");
    
    let add_message = message_base
        .and(warp::path("add"))
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(add_message_handler);
    
    let list_messages = message_base
        .and(warp::path("list"))
        .and(warp::path::end())
        .and(warp::get())
        .and(with_app_state(app_state.clone()))
        .and_then(list_messages_handler);
    
    let update_message = message_base
        .and(warp::path("update"))
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::put())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(update_message_handler);
    
    let delete_message = message_base
        .and(warp::path("delete"))
        .and(warp::path::param::<String>())
        .and(warp::path::end())
        .and(warp::delete())
        .and(with_app_state(app_state.clone()))
        .and_then(delete_message_handler);
    
    let sync_messages = message_base
        .and(warp::path("sync"))
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json())
        .and(with_app_state(app_state.clone()))
        .and_then(sync_messages_handler);
    
    add_message
        .or(list_messages)
        .or(update_message)
        .or(delete_message)
        .or(sync_messages)
}

fn with_app_state(
    app_state: AppState,
) -> impl Filter<Extract = (AppState,), Error = Infallible> + Clone {
    warp::any().map(move || app_state.clone())
}

async fn add_message_handler(
    message: MessageEntry,
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    match app_state.message_manager.write().await.add_message(message).await {
        Ok(_) => {
            let response = ApiResponse {
                success: true,
                data: Some("Message added successfully"),
                error: None,
            };
            Ok(warp::reply::with_status(
                warp::reply::json(&response),
                warp::http::StatusCode::OK,
            ))
        }
        Err(e) => {
            let response = ApiResponse::<&str> {
                success: false,
                data: None,
                error: Some(e.to_string()),
            };
            Ok(warp::reply::with_status(
                warp::reply::json(&response),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn list_messages_handler(
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    let messages = app_state.message_manager.read().await.get_messages().await;
    let response = ApiResponse {
        success: true,
        data: Some(messages),
        error: None,
    };
    Ok(warp::reply::with_status(
        warp::reply::json(&response),
        warp::http::StatusCode::OK,
    ))
}

async fn sync_messages_handler(
    sync_request: MessageSyncRequest,
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    match app_state.message_manager.write().await.handle_sync_request(sync_request).await {
        Ok(sync_response) => {
            let response = ApiResponse {
                success: true,
                data: Some(sync_response),
                error: None,
            };
            Ok(warp::reply::with_status(
                warp::reply::json(&response),
                warp::http::StatusCode::OK,
            ))
        }
        Err(e) => {
            let response = ApiResponse::<MessageSyncResponse> {
                success: false,
                data: None,
                error: Some(e.to_string()),
            };
            Ok(warp::reply::with_status(
                warp::reply::json(&response),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn update_message_handler(
    message_id: String,
    message: MessageEntry,
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    match app_state.message_manager.write().await.update_message(message_id, message).await {
        Ok(_) => {
            let response = ApiResponse {
                success: true,
                data: Some("Message updated successfully".to_string()),
                error: None,
            };
            Ok(warp::reply::with_status(
                warp::reply::json(&response),
                warp::http::StatusCode::OK,
            ))
        }
        Err(e) => {
            let response = ApiResponse::<String> {
                success: false,
                data: None,
                error: Some(e.to_string()),
            };
            Ok(warp::reply::with_status(
                warp::reply::json(&response),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}

async fn delete_message_handler(
    message_id: String,
    app_state: AppState,
) -> Result<impl Reply, Infallible> {
    match app_state.message_manager.write().await.delete_message(message_id).await {
        Ok(_) => {
            let response = ApiResponse {
                success: true,
                data: Some("Message deleted successfully".to_string()),
                error: None,
            };
            Ok(warp::reply::with_status(
                warp::reply::json(&response),
                warp::http::StatusCode::OK,
            ))
        }
        Err(e) => {
            let response = ApiResponse::<String> {
                success: false,
                data: None,
                error: Some(e.to_string()),
            };
            Ok(warp::reply::with_status(
                warp::reply::json(&response),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ))
        }
    }
}
