use anyhow::Result;
use chrono::Utc;
use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::{TcpStream, UdpSocket};
use tokio::sync::RwLock;
use tokio::time::timeout;
use tracing::{info, warn, debug};

use crate::station::StationManager;
use crate::types::{Station, MeshDiscoveryRequest, MeshDiscoveryResponse};

pub struct MeshManager {
    discovery_port: u16,
    api_port: u16,
    station_manager: Arc<RwLock<StationManager>>,
    discovered_stations: Arc<RwLock<HashMap<String, Station>>>,
}

impl MeshManager {
    pub async fn new(discovery_port: u16, api_port: u16, station_manager: Arc<RwLock<StationManager>>) -> Result<Self> {
        Ok(Self {
            discovery_port,
            api_port,
            station_manager,
            discovered_stations: Arc::new(RwLock::new(HashMap::new())),
        })
    }
    
    pub async fn start_discovery(&self) -> Result<()> {
        info!("Starting mesh discovery on port {}", self.discovery_port);
        
        // Bind UDP socket for discovery
        let socket = Arc::new(UdpSocket::bind(format!("0.0.0.0:{}", self.discovery_port)).await?);
        socket.set_broadcast(true)?;
        
        // Start discovery listener
        let socket_clone = Arc::clone(&socket);
        let station_manager = self.station_manager.clone();
        let discovered_stations = self.discovered_stations.clone();
        
        tokio::spawn(async move {
            let mut buf = [0; 1024];
            
            loop {
                match socket_clone.recv_from(&mut buf).await {
                    Ok((len, addr)) => {
                        let data = &buf[..len];
                        if let Ok(request) = serde_json::from_slice::<MeshDiscoveryRequest>(data) {
                            debug!("Received discovery request from {}: {:?}", addr, request);
                            
                            // Don't respond to our own broadcasts
                            let station_info = station_manager.read().await.get_station_info().cloned();
                            if let Some(station) = station_info {
                                if station.id != request.station_id {
                                    // Create station from discovery request
                                    let discovered_station = Station {
                                        id: request.station_id.clone(),
                                        call_sign: request.call_sign.clone(),
                                        name: request.name.clone(),
                                        section: request.section.clone(),
                                        class: request.class.clone(),
                                        ip_address: addr.ip().to_string(),
                                        port: request.api_port, // Use the API port from the request
                                        last_seen: Utc::now(),
                                        is_self: false,
                                    };
                                    
                                    // Store the discovered station
                                    discovered_stations.write().await.insert(
                                        request.station_id.clone(),
                                        discovered_station.clone()
                                    );
                                    
                                    info!("Discovered station via UDP: {} ({})", request.call_sign, addr.ip());
                                    
                                    Self::send_discovery_response(&socket_clone, addr, &station).await;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Discovery listener error: {}", e);
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }
        });
        
        // Start periodic discovery broadcast
        let socket_clone2 = Arc::clone(&socket);
        let station_manager2 = self.station_manager.clone();
        let discovery_port = self.discovery_port;
        let api_port = self.api_port;
        
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(30)).await;
                
                let station_info = station_manager2.read().await.get_station_info().cloned();
                if let Some(station) = station_info {
                    if station_manager2.read().await.is_configured() {
                        Self::broadcast_discovery(&socket_clone2, &station, discovery_port, api_port).await;
                    }
                }
            }
        });
        
        Ok(())
    }
    
    async fn send_discovery_response(socket: &Arc<UdpSocket>, addr: SocketAddr, station: &Station) {
        let response = MeshDiscoveryResponse {
            station: station.clone(),
            qso_count: 0, // TODO: Get actual QSO count
            status: "active".to_string(),
        };
        
        if let Ok(data) = serde_json::to_vec(&response) {
            if let Err(e) = socket.send_to(&data, addr).await {
                warn!("Failed to send discovery response to {}: {}", addr, e);
            }
        }
    }
    
    async fn broadcast_discovery(socket: &Arc<UdpSocket>, station: &Station, discovery_port: u16, api_port: u16) {
        let request = MeshDiscoveryRequest {
            station_id: station.id.clone(),
            call_sign: station.call_sign.clone(),
            name: station.name.clone(),
            section: station.section.clone(),
            class: station.class.clone(),
            port: station.port,
            api_port,
        };
        
        if let Ok(data) = serde_json::to_vec(&request) {
            // Broadcast to local network on discovery port
            let broadcast_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::BROADCAST), discovery_port);
            
            if let Err(e) = socket.send_to(&data, broadcast_addr).await {
                debug!("Broadcast failed: {}", e);
            }
            
            // Also try common subnet broadcasts on discovery port
            for subnet in &["192.168.1.255", "192.168.0.255", "10.0.0.255"] {
                if let Ok(addr) = format!("{}:{}", subnet, discovery_port).parse::<SocketAddr>() {
                    let _ = socket.send_to(&data, addr).await;
                }
            }
        }
    }
    
    pub async fn discover_stations(&mut self) -> Result<Vec<Station>> {
        info!("Starting manual station discovery");
        
        self.discovered_stations.write().await.clear();
        
        // Perform network scan
        self.scan_network().await?;
        
        // Return discovered stations (excluding self)
        let stations: Vec<Station> = self.discovered_stations
            .read().await
            .values()
            .filter(|station| !station.is_self)
            .cloned()
            .collect();
        
        info!("Discovered {} stations", stations.len());
        Ok(stations)
    }
    
    async fn scan_network(&mut self) -> Result<()> {
        let station_info = self.station_manager.read().await.get_station_info().cloned();
        let our_station_id = station_info.as_ref().map(|s| s.id.clone()).unwrap_or_default();
        
        // Get local network range
        let local_ip = local_ip_address::local_ip()?;
        let base_ip = match local_ip {
            std::net::IpAddr::V4(ipv4) => {
                let octets = ipv4.octets();
                format!("{}.{}.{}", octets[0], octets[1], octets[2])
            }
            _ => return Ok(()),
        };
        
        info!("Scanning network range: {}.1-254", base_ip);
        
        let mut handles = Vec::new();
        
        for i in 1..255 {
            let ip = format!("{}.{}", base_ip, i);
            let station_id = our_station_id.clone();
            let api_port = self.api_port;
            
            let handle = tokio::spawn(async move {
                Self::check_station(&ip, api_port, &station_id).await
            });
            
            handles.push(handle);
        }
        
        // Wait for all scans to complete with timeout
        for handle in handles {
            if let Ok(result) = timeout(Duration::from_secs(2), handle).await {
                if let Ok(Ok(Some(station))) = result {
                    self.discovered_stations.write().await.insert(station.id.clone(), station);
                }
            }
        }
        
        Ok(())
    }
    
    async fn check_station(ip: &str, port: u16, our_station_id: &str) -> Result<Option<Station>> {
        let addr = format!("{}:{}", ip, port);
        
        // Try to connect and get station info
        match timeout(Duration::from_secs(2), TcpStream::connect(&addr)).await {
            Ok(Ok(_stream)) => {
                // Connection successful, try to get station info via HTTP
                match Self::get_station_info_http(ip, port).await {
                    Ok(station) => {
                        if station.id != our_station_id {
                            debug!("Found station: {} at {}", station.call_sign, ip);
                            return Ok(Some(station));
                        }
                    }
                    Err(_) => {
                        // Might be a different service on this port
                    }
                }
            }
            Ok(Err(_)) | Err(_) => {
                // Connection failed or timeout
            }
        }
        
        Ok(None)
    }
    
    async fn get_station_info_http(ip: &str, port: u16) -> Result<Station> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .danger_accept_invalid_certs(true)
            .build()?;
        
        // Try HTTP first, then HTTPS
        for protocol in &["http", "https"] {
            let url = format!("{}://{}:{}/api/station-info", protocol, ip, port);
            
            match client.get(&url).send().await {
                Ok(response) if response.status().is_success() => {
                    if let Ok(mut station) = response.json::<Station>().await {
                        station.ip_address = ip.to_string();
                        station.port = port;
                        station.last_seen = Utc::now();
                        station.is_self = false;
                        return Ok(station);
                    }
                }
                _ => continue,
            }
        }
        
        Err(anyhow::anyhow!("Could not get station info from {}:{}", ip, port))
    }
    
    pub fn get_discovered_stations(&self) -> Vec<Station> {
        // This should be async but we'll make a blocking call for now
        if let Ok(stations) = self.discovered_stations.try_read() {
            stations
                .values()
                .filter(|station| !station.is_self)
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }
    
    pub fn get_station_count(&self) -> usize {
        if let Ok(stations) = self.discovered_stations.try_read() {
            stations
                .values()
                .filter(|station| !station.is_self)
                .count()
        } else {
            0
        }
    }
}
