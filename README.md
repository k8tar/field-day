# k8tar-fieldday

A Field Day logging application built with Vue.js that works completely offline.

## Offline Capabilities

This application is designed to work without internet access, which is essential for Field Day operations in remote locations:

- **No external dependencies**: All resources (fonts, icons, scripts) are bundled locally
- **Material Icons**: Downloaded and served locally from `/public/fonts/`
- **All data stored locally**: Uses browser localStorage for persistence
- **Works as standalone app**: Can be built and served from any local web server

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run dev
```

### Compiles and minifies for production
```
npm run build
```

### Run your unit tests
```
npm run test:unit
```

### Lints and fixes files
```
npm run lint
```

### Serving the built application offline

After building, you can serve the app locally without internet:

```bash
# Using Python (if available)
cd dist
python -m http.server 8080

# Using Node.js serve package
npx serve dist

# Using any other static file server
```

The built application in the `dist/` folder is completely self-contained and includes all necessary fonts and resources.

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

## Network Synchronization

The application supports multi-station operation with real-time log synchronization:

### Testing Network Features

To test the network synchronization with multiple stations:

1. **Start the first station (default port 8080):**
   ```bash
   npm run dev
   ```

2. **Start a second station on port 4173:**
   ```bash
   npm run dev -- --port 4173
   ```

3. **Or use the provided scripts:**
   ```bash
   # Windows
   start-station.bat "W3AO" "2A" 4173
   
   # Linux/Mac
   ./start-station.sh "W3AO" "2A" 4173
   ```

### Using Network Features

1. **Click the network icon** (wifi symbol) in the header next to the settings icon
2. **Auto-discovery mode**: Automatically scans for other stations on localhost
3. **Host mode**: Start hosting for other stations to connect to
4. **Join mode**: Manually connect to another station's IP and port

### Network Synchronization Features

- **Real-time QSO sync**: All contacts sync across connected stations
- **Initial full sync**: When connecting, all QSOs from existing stations are synchronized
- **Persistent file storage**: QSOs are stored in `shared-qsos.json` for persistence across server restarts
- **Cross-instance sharing**: Multiple server instances share the same QSO file automatically
- **Persistent connections**: Network settings are saved and auto-reconnect on app restart
- **Auto-reconnect**: Automatic reconnection when network connections are lost
- **Contact numbering**: Sequential numbers maintained across all stations  
- **Score calculation**: Combined scoring from all connected stations
- **Conflict resolution**: Automatic handling of simultaneous edits with timestamp-based resolution
- **Station identification**: Each station maintains its identity while sharing logs
- **Connection status**: Visual indicators and status messages for network events

### QSO Storage

The application now uses file-based storage for QSO sharing:
- **Shared file**: `shared-qsos.json` stores all QSOs locally on the server
- **Automatic persistence**: QSOs are saved to file immediately when added/updated
- **Multi-instance sync**: All server instances (different ports) share the same QSO file
- **File watching**: Changes to the QSO file are automatically detected and loaded
- **Development endpoints**: 
  - `GET /api/qsos` - Retrieve QSOs
  - `POST /api/qsos/bulk` - Upload QSOs to file
  - `DELETE /api/qsos/clear` - Clear all QSOs (testing)

### Network Settings

- **Auto-reconnect**: Enable to automatically reconnect to the last network when the app starts or if connection is lost
- **Connection persistence**: Network connection details are saved and restored across app restarts
- **Robust reconnection**: Exponential backoff retry logic for handling temporary network issues
- **Manual disconnect**: Disabling auto-reconnect when manually disconnecting from network
