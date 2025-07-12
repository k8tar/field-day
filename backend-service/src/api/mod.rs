use warp::{Filter, Reply};
use std::convert::Infallible;

use crate::AppState;

mod station;
mod mesh;
mod qso;
mod config;
mod message;

pub fn create_routes(
    app_state: AppState,
) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let api = warp::path("api");
    
    let station_routes = station::routes(app_state.clone());
    let mesh_routes = mesh::routes(app_state.clone());
    let qso_routes = qso::routes(app_state.clone());
    let config_routes = config::routes(app_state.clone());
    let message_routes = message::routes(app_state.clone());
    
    api.and(
        station_routes
            .or(mesh_routes)
            .or(qso_routes)
            .or(config_routes)
            .or(message_routes)
    )
}
