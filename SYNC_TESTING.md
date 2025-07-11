# Testing Network Sync Between Instances

This document explains how to test QSO synchronization between multiple instances of the Field Day Logger.

## Setup for Testing

1. **Start Multiple Instances**
   ```bash
   # Terminal 1 - First instance (usually port 8082)
   npm run dev
   
   # Terminal 2 - Second instance (will auto-select next available port)
   npm run dev
   ```

2. **Note the Ports**
   Each instance will display its port in the terminal output:
   ```
   ➜  Local:   http://localhost:8082/
   ➜  Local:   http://localhost:8083/
   ```

## Manual Testing Steps

### 1. Basic Setup
1. Open both instances in separate browser tabs
2. Configure different callsigns and designators for each instance:
   - Instance 1: `K8TAR-1A`
   - Instance 2: `W1AW-2A`

### 2. Test Station Discovery
1. Open browser dev tools (F12) on both instances
2. Load the enhanced sync test script:
   ```javascript
   // Copy and paste the contents of tests/test-enhanced-sync.js
   ```
3. Test discovery on both instances:
   ```javascript
   syncTest.testDiscovery()
   ```

### 3. Test QSO Sync
1. Add QSOs on one instance and verify they appear on the other
2. Use the test script to add sample QSOs:
   ```javascript
   syncTest.addTestQSO("W1AW")
   ```
3. Check if the QSO appears on the other instance

### 4. Network Modal Testing
1. Open the Network Modal (gear icon in header)
2. Try different connection modes:
   - **Auto-discover**: Should find other instances automatically
   - **Host Network**: Start hosting on one instance
   - **Join Network**: Connect to the host from another instance

## Automated Testing

### Using Test Scripts

1. **Generate Sample Data**
   ```javascript
   // In browser console, load and run:
   // Copy contents of tests/test-generate-sample-qsos.js
   generateSampleQsos(50)
   ```

2. **Enhanced Sync Testing**
   ```javascript
   // Load the enhanced sync test script
   syncTest.showStatus()
   syncTest.testCrossInstanceSync(8083) // Test with instance on port 8083
   ```

3. **Manual Sync Trigger**
   ```javascript
   syncTest.manualSync()
   ```

## Expected Behavior

### Working Sync Indicators
- ✅ Station discovery finds other instances
- ✅ QSOs added on one instance appear on others within 10 seconds
- ✅ Network status shows "Connected" in the Network Modal
- ✅ Recent Contacts shows synced QSOs from all stations

### Troubleshooting

#### If Discovery Fails
1. Check that both instances are running
2. Verify different ports are being used
3. Check browser console for errors
4. Try refreshing both instances

#### If QSOs Don't Sync
1. Check network connection status in Network Modal
2. Verify API endpoints are working:
   ```javascript
   syncTest.testAPI()
   ```
3. Check console logs for sync errors
4. Try manual sync:
   ```javascript
   syncTest.manualSync()
   ```

#### Common Issues
- **Same Port**: Make sure instances are on different ports
- **Browser Cache**: Clear browser cache and refresh
- **CORS Issues**: The app uses fetch interception to avoid CORS
- **Timing**: Allow up to 10-15 seconds for auto-sync

## Sync Architecture

The sync system uses multiple layers:

1. **HTTP API Server**: Provides REST endpoints for station info and QSO data
2. **Network Service**: Handles discovery and connection management
3. **Periodic Sync**: Polls for updates every 10 seconds
4. **QSO Store**: Merges and deduplicates QSO data

## Debug Commands

```javascript
// Show current status
syncTest.showStatus()

// Test all endpoints
syncTest.testAPI()

// Force discovery
syncTest.testDiscovery()

// Add test data
syncTest.addTestQSO("TEST123")

// Cross-instance test
syncTest.testCrossInstanceSync(8083)
```

## Performance Notes

- Sync occurs every 10 seconds automatically
- Only QSOs newer than last sync are transferred
- Duplicate detection prevents data duplication
- Large datasets (300+ QSOs) sync in batches
