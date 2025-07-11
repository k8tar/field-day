# Field Day Network Discovery Debugging

## Overview
The Field Day Logger now includes enhanced debugging tools to help diagnose network discovery issues between multiple browser instances running on different ports.

## Debug Methods Available

### 1. Quick Port Test
```javascript
// In browser console (focuses on ports 8080 and 8081)
networkService.testFieldDayPorts()
```

### 2. Comprehensive Discovery Test
```javascript
// In browser console (full diagnostic)
networkService.testNetworkDiscovery()
```

### 3. Manual Discovery
```javascript
// In browser console (run actual discovery with debug output)
networkService.discoverStations()
```

## Expected Setup
- Instance 1: Running on port 8080
- Instance 2: Running on port 8081
- Both accessible via localhost (IPv4: 127.0.0.1, IPv6: ::1)

## Key Findings
1. **Port Scanning**: Now scans both IPv4 (127.0.0.1) and IPv6 (localhost, [::1]) addresses
2. **Prioritized Ports**: Discovery prioritizes ports 8080 and 8081 first
3. **Fetch Interception**: Each instance uses fetch interception to serve `/api/station-info` endpoint
4. **CORS Headers**: Station info responses include proper CORS headers for cross-origin requests

## Debugging Steps

### Step 1: Verify Both Instances Are Running
```bash
netstat -an | grep :808
```
Should show both 8080 and 8081 in LISTENING state.

### Step 2: Test from Browser Console
Open browser console in each instance and run:
```javascript
networkService.testFieldDayPorts()
```

### Step 3: Check Manual Discovery
```javascript
networkService.testNetworkDiscovery()
```

### Step 4: Verify Station Info
Test local endpoint first:
```javascript
fetch('/api/station-info').then(r => r.json()).then(console.log)
```

## Common Issues and Solutions

### Issue: No stations found despite both running
**Solution**: Check if servers are IPv6-only by testing IPv6 addresses in the console.

### Issue: Timeout errors
**Solution**: Increase timeout in `checkStationAt` method or check firewall settings.

### Issue: CORS errors
**Solution**: Verify CORS headers are being set in the fetch interception.

### Issue: Fetch interception not working
**Solution**: Ensure `setupStationInfoAPI()` is called during app initialization.

## Network Service Configuration
The discovery process:
1. Excludes current port to avoid self-discovery
2. Scans ports: 8080, 8081, 8082, 8083, 3000, 4173, 5173, 8084-8088
3. Tries both IPv4 and IPv6 localhost addresses
4. Uses 1000ms timeout per station check
5. Logs detailed debug information to console

## Troubleshooting Commands
```javascript
// Check current network service state
console.log(networkService.getNetworkState())

// Check connected stations
console.log(networkService.getConnectedStations())

// Force refresh discovery
networkService.discoverStations().then(stations => console.log('Found:', stations))
```

## IPv6 Considerations
Windows development servers often bind to IPv6 `[::1]` by default. The discovery now tests:
- `http://127.0.0.1:PORT/api/station-info` (IPv4)
- `http://localhost:PORT/api/station-info` (may resolve to IPv6)
- `http://[::1]:PORT/api/station-info` (explicit IPv6)
