# Field Day Logger Backend Service

A high-performance Rust backend service for the Field Day Logger that handles mesh networking, QSO synchronization, and heavy networking operations to prevent browser lockups.

## Features

- **Mesh Network Discovery**: Automatic discovery of Field Day stations on the local network
- **QSO Synchronization**: Real-time synchronization of QSO entries between stations
- **Station Management**: Centralized station information and configuration
- **HTTP API**: RESTful API for frontend communication
- **Performance**: Offloads heavy networking from the browser to prevent lockups
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## Installation

1. Install Rust if not already installed:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Build the backend service:
   ```bash
   cd backend-service
   cargo build --release
   ```

## Usage

### Development Mode
```bash
cd backend-service
cargo run -- --verbose
```

### Production Mode
```bash
cd backend-service
cargo run --release -- --port 3030 --discovery-port 8080
```

### Command Line Options

- `--port, -p`: API server port (default: 3030)
- `--discovery-port, -d`: Mesh discovery port (default: 8080)
- `--config-path, -c`: Path to configuration file
- `--verbose, -v`: Enable verbose logging

## API Endpoints

### Station Management
- `GET /api/station-info` - Get station information
- `PUT /api/station` - Update station information
- `GET /api/station/status` - Get station configuration status

### Mesh Networking
- `POST /api/mesh/discover` - Trigger station discovery
- `GET /api/mesh/stations` - Get discovered stations
- `GET /api/mesh/status` - Get mesh network status

### QSO Management
- `GET /api/qso/list` - Get all QSOs
- `POST /api/qso/add` - Add a new QSO
- `POST /api/qso/sync` - Synchronize QSOs with other stations
- `GET /api/qso/count` - Get QSO count
- `GET /api/qso/export/adif` - Export QSOs as ADIF

### Configuration
- `GET /api/config` - Get current configuration
- `PUT /api/config/mesh` - Update mesh configuration
- `PUT /api/config/qso` - Update QSO configuration

## Configuration

The backend service stores its configuration in:
- Windows: `%APPDATA%\fieldday-backend\config.json`
- macOS: `~/Library/Application Support/fieldday-backend/config.json`
- Linux: `~/.config/fieldday-backend/config.json`

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

## Architecture

The backend service consists of several key components:

1. **Station Manager**: Handles station identification and configuration
2. **Mesh Manager**: Manages network discovery and station communication
3. **QSO Manager**: Handles QSO storage, synchronization, and export
4. **Config Manager**: Manages persistent configuration
5. **API Server**: Provides HTTP endpoints for frontend communication

## Integration with Field Day Logger

The Field Day Logger frontend communicates with this backend service via HTTP API calls. The backend handles all heavy networking operations, preventing browser lockups and improving overall performance.

To integrate:

1. Start the backend service
2. Configure the Field Day Logger to use `http://localhost:3030` as the backend API endpoint
3. The frontend will automatically use the backend for mesh networking and QSO sync operations

## Development

### Running Tests
```bash
cargo test
```

### Code Formatting
```bash
cargo fmt
```

### Linting
```bash
cargo clippy
```

## Troubleshooting

### Port Conflicts
If port 3030 or 8080 are already in use, specify different ports:
```bash
cargo run -- --port 3031 --discovery-port 8081
```

### Firewall Issues
Ensure that the discovery port (default 8080) is open in your firewall for UDP traffic.

### Network Discovery Issues
- Check that all stations are on the same subnet
- Verify firewall settings allow UDP broadcast on port 8080
- Ensure Field Day Logger instances are running on all stations

## License

This project is part of the Field Day Logger application and follows the same license terms.
