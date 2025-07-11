# Field Day Station Configuration with File Storage

## Overview

The Field Day Logger now uses **file-based storage** instead of localStorage, which means each port maintains its own separate data files. This allows proper network discovery between different browser instances.

## Quick Setup for Two Station Testing

### Step 1: Migrate Existing Data (if needed)
If you have existing data in localStorage, migrate it first in each instance:

**In both browser instances (8080 and 8081):**
```javascript
// Migrate existing localStorage data to file storage
networkService.migrateToFileStorage();
```

### Step 2: Set Up Instance 1 (Port 8080) - PHONE 1 Station
1. Open browser to `http://localhost:8080`
2. Open browser console and run:
```javascript
// Set up PHONE 1 station with test data
await networkService.setupTestStation('K8TAR', 'PHONE 1', 305);

// Verify configuration
await networkService.checkFileStorage();
```

### Step 3: Set Up Instance 2 (Port 8081) - PHONE 2 Station  
1. Open browser to `http://localhost:8081`
2. Open browser console and run:
```javascript
// Set up PHONE 2 station (no QSOs)
await networkService.setupTestStation('K8TAR', 'PHONE 2', 0);

// Verify configuration
await networkService.checkFileStorage();
```

## Manual Configuration (Alternative)

If you prefer to set configuration manually:

```javascript
// Set station info only (without test QSOs)
await networkService.setConfiguration('K8TAR', 'PHONE 1'); // or 'PHONE 2'

// Check what was saved
await networkService.checkFileStorage();
```

## Verify Configuration Works

After setting up both instances, test the station info endpoints:

**Port 8080:**
```javascript
fetch('/api/station-info').then(r => r.json()).then(console.log);
// Expected: K8TAR-PHONE 1, 305 QSOs, ~509 points
```

**Port 8081:**
```javascript
fetch('/api/station-info').then(r => r.json()).then(console.log);
// Expected: K8TAR-PHONE 2, 0 QSOs, 0 points
```

## Test Network Discovery

After both instances are configured, test discovery from either instance:

```javascript
// Test discovery between instances
await networkService.testNetworkDiscovery();

// Or run full discovery
const stations = await networkService.discoverStations();
console.log('Discovered stations:', stations);
```

Expected results:
- From port 8080: Should find K8TAR-PHONE 2 at localhost:8081
- From port 8081: Should find K8TAR-PHONE 1 at localhost:8080

## Storage Architecture

### File Storage Benefits:
- **Port-specific data**: Each port maintains separate configuration and QSO files
- **No browser conflicts**: Data is not shared between browser tabs/windows
- **Persistent**: Data survives browser restarts
- **Network discovery**: Instances can have different callsigns/designators

### Storage Structure:
```
Browser Storage (per port):
├── fieldday_8080_station_config (K8TAR-PHONE 1)
├── fieldday_8080_qso_data (305 QSOs)
├── fieldday_8081_station_config (K8TAR-PHONE 2)  
└── fieldday_8081_qso_data (0 QSOs)
```

## Debug Commands

```javascript
// Check file storage contents
await debugFileStorage();

// Check network service state
await networkService.checkFileStorage();

// Test specific port discovery
const station = await networkService.checkStationAt('localhost', 8081);
console.log('Found station:', station);

// Get storage info
const info = await fileStorage.getStorageInfo();
console.log('Storage info:', info);
```

## Advanced Configuration

### Custom QSO Data
```javascript
// Add custom QSOs to a station
const customQsos = [
  {
    id: 'custom-1',
    call: 'W8ABC',
    mode: 'CW',
    band: '20M',
    rst_sent: '599',
    rst_rcvd: '599',
    section: 'OH',
    stationCallsign: 'K8TAR',
    stationDesignator: 'PHONE 1',
    timestamp: Date.now()
  }
];

await fileStorage.addQsos(customQsos);
```

### Reset Configuration
```javascript
// Clear all data for current port
await fileStorage.saveStationConfig({ callsign: 'K8TAR', designator: '1A' });
await fileStorage.saveQsoData([]);
```

## Troubleshooting

### Issue: No stations found in discovery
1. Verify each instance has different designators:
   ```javascript
   await networkService.checkFileStorage();
   ```
2. Check if station info endpoints respond:
   ```javascript
   fetch('http://localhost:8080/api/station-info').then(r => r.json()).then(console.log);
   fetch('http://localhost:8081/api/station-info').then(r => r.json()).then(console.log);
   ```

### Issue: Both instances show same data
- This indicates localStorage is still being used
- Run migration: `await networkService.migrateToFileStorage()`
- Clear localStorage manually and restart

### Issue: File storage errors
- File storage falls back to port-specific localStorage keys
- Check browser console for detailed error messages
- Verify Electron file permissions (if using Electron build)
