# Field Day Logger - Rust Backend Architecture

## Overview

The Field Day Logger now uses a separate Rust backend service to handle all heavy networking operations, preventing browser lockups and improving performance. The backend handles mesh networking, QSO synchronization, and station discovery.

## Architecture

```
┌─────────────────────────┐    HTTP API    ┌─────────────────────────┐
│   Frontend (Browser)    │◄──────────────►│   Rust Backend Service │
│                         │                │                         │
│ - Vue.js Application    │                │ - Mesh Discovery        │
│ - User Interface        │                │ - QSO Synchronization   │
│ - Local File Storage    │                │ - Station Management    │
│ - Lightweight API calls │                │ - Network Operations    │
└─────────────────────────┘                └─────────────────────────┘
                                                        │
                                                        │ UDP/TCP
                                                        ▼
                                           ┌─────────────────────────┐
                                           │   Other Field Day       │
                                           │   Stations (Mesh)       │
                                           └─────────────────────────┘
```

## Components

### Frontend (Browser)
- **Vue.js Application**: User interface and application logic
- **BackendApiService**: Communicates with Rust backend via HTTP
- **File Storage**: Local QSO and configuration storage
- **Lightweight Operations**: Only UI and local data management

### Backend Service (Rust)
- **HTTP API Server**: Provides REST endpoints for frontend
- **Mesh Manager**: Handles station discovery and mesh networking
- **QSO Manager**: Manages QSO synchronization between stations
- **Station Manager**: Handles station configuration and identification
- **Config Manager**: Persistent configuration management

## API Endpoints

### Station Management
- `GET /api/station-info` - Get current station information
- `PUT /api/station` - Update station configuration
- `GET /api/station/status` - Get station status

### Mesh Networking
- `POST /api/mesh/discover` - Trigger station discovery
- `GET /api/mesh/stations` - Get discovered stations
- `GET /api/mesh/status` - Get mesh network status

### QSO Management
- `GET /api/qso/list` - Get all QSOs
- `POST /api/qso/add` - Add new QSO
- `POST /api/qso/sync` - Sync QSOs with other stations
- `GET /api/qso/count` - Get QSO count
- `GET /api/qso/export/adif` - Export QSOs as ADIF

## Benefits

### Performance
- **No Browser Lockups**: Heavy networking moved to separate process
- **Concurrent Operations**: Rust handles multiple network operations simultaneously
- **Efficient Memory Usage**: Rust's zero-cost abstractions and memory safety
- **Fast Network Operations**: Native performance for mesh discovery and sync

### Reliability
- **Robust Error Handling**: Rust's error handling prevents crashes
- **Memory Safety**: No memory leaks or buffer overflows
- **Concurrent Safety**: Safe multi-threading for network operations
- **Automatic Recovery**: Backend can restart independently of frontend

### Scalability
- **Background Processing**: Network operations don't block UI
- **Efficient Discovery**: UDP broadcasting with connection pooling
- **Optimized Sync**: Batch operations and conflict resolution
- **Resource Management**: Automatic cleanup and resource management

## Getting Started

### Prerequisites
1. **Rust**: Install from https://rustup.rs/
2. **Node.js**: For the frontend development server

### Quick Start
1. **Start Everything**: Run `start-complete.bat` (Windows) or `start-complete.sh` (Linux/Mac)
2. **Backend Only**: Run `start-backend.bat` or `start-backend.sh`
3. **Manual Build**: 
   ```bash
   cd backend-service
   cargo build --release
   cargo run -- --port 3030 --discovery-port 8080 --verbose
   ```

### Configuration

The backend automatically creates a configuration file:
- **Windows**: `%APPDATA%\fieldday-backend\config.json`
- **Linux/Mac**: `~/.config/fieldday-backend/config.json`

Example configuration:
```json
{
  "station": {
    "id": "unique-station-id",
    "call_sign": "W1AW",
    "name": "ARRL HQ",
    "section": "CT",
    "class": "1A"
  },
  "mesh": {
    "enabled": true,
    "discovery_interval_secs": 30,
    "max_discovery_attempts": 3,
    "timeout_secs": 5
  },
  "qso": {
    "sync_interval_secs": 30,
    "max_retries": 3,
    "batch_size": 100
  }
}
```

## Migration from Old System

### What Changed
1. **NetworkService**: Replaced with `BackendApiService`
2. **Heavy Operations**: Moved from browser to Rust backend
3. **Mesh Discovery**: Now handled by backend service
4. **QSO Sync**: Automatic background synchronization

### Frontend Changes
- **NetworkModal**: Updated to use backend API
- **QSO Store**: Uses backend for synchronization
- **Background Services**: Removed (handled by backend)

### Benefits for Users
- **Faster UI**: No more browser freezing during network operations
- **Better Discovery**: More reliable station discovery
- **Automatic Sync**: QSOs sync automatically in the background
- **Improved Stability**: Backend can restart without losing frontend state

## Development

### Building
```bash
# Backend
cd backend-service
cargo build --release

# Frontend  
npm run dev
```

### Testing
```bash
# Backend tests
cd backend-service
cargo test

# Frontend tests
npm run test
```

### Debugging
- **Backend Logs**: Use `--verbose` flag for detailed logging
- **Frontend**: Use browser dev tools as usual
- **Network Issues**: Check firewall settings for ports 3030 and 8080

## Deployment

### Production Build
```bash
# Build backend
cd backend-service
cargo build --release

# Build frontend
npm run build
```

### Electron Integration
The backend can be bundled with Electron for desktop distribution:
1. Include `fieldday-backend.exe` in Electron app
2. Start backend process on app startup
3. Frontend communicates via localhost API

## Troubleshooting

### Common Issues

1. **Backend Won't Start**
   - Check if ports 3030/8080 are available
   - Verify Rust installation with `cargo --version`
   - Check firewall settings

2. **Frontend Can't Connect**
   - Ensure backend is running on localhost:3030
   - Check browser console for CORS errors
   - Verify network connectivity

3. **Discovery Not Working**
   - Check firewall allows UDP on port 8080
   - Ensure all stations are on same subnet
   - Verify backend is running on all stations

4. **QSO Sync Issues**
   - Check backend logs for sync errors
   - Verify station configurations
   - Ensure network connectivity between stations

### Logs
- **Backend**: Console output with `--verbose` flag
- **Frontend**: Browser developer console
- **Network**: Use `netstat` to verify port bindings

## Future Enhancements

1. **WebSocket Support**: Real-time updates from backend
2. **Cluster Mode**: Multiple backend instances for redundancy
3. **Cloud Sync**: Optional cloud synchronization
4. **Advanced Discovery**: IPv6 and multicast support
5. **Metrics Dashboard**: Performance and network statistics
