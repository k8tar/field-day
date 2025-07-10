# Network Sync Testing Guide

## Testing the Fixes

### Issue 1: Band Validation
**Fixed**: QSO form now requires a band to be selected before logging.

**Test Steps:**
1. Open the QSO Entry Form
2. Try to submit without selecting a band
3. The submit button should be disabled
4. Select a band - submit button should become enabled

### Issue 2: Incomplete QSO Sync
**Fixed**: 
- Improved duplicate detection logic (uses date-based comparison instead of timestamp)
- Fixed API endpoint to return all QSOs for initial sync
- Preserved original timestamps during sync
- Added timestamp migration for existing QSOs

**Test Steps:**
1. **Setup Two Stations:**
   - Open http://localhost:8080 (Station 1)
   - Open http://localhost:4173 (Station 2)

2. **Add QSOs to Both Stations:**
   - Station 1: Add 5-6 QSOs with different callsigns
   - Station 2: Add 3-4 QSOs with different callsigns

3. **Connect the Stations:**
   - On Station 2: Click network icon → Auto-discover → Connect to Station 1
   - Watch the Messages panel for sync events

4. **Verify Full Sync:**
   - Both stations should now have the same total number of QSOs
   - Check that all unique callsigns appear on both stations
   - Verify no duplicates were created

5. **Test Ongoing Sync:**
   - Add a new QSO on Station 1
   - Verify it appears on Station 2 within 5 seconds
   - Add a new QSO on Station 2
   - Verify it appears on Station 1 within 5 seconds

6. **Test Persistence:**
   - Refresh both browser tabs
   - Stations should auto-reconnect if auto-reconnect was enabled
   - QSO counts should remain consistent

## Debugging Sync Issues

### Enhanced Logging
The updated code includes detailed console logging:
- QSO store operations (add/skip/replace)
- Network service initial sync progress
- API endpoint request/response details

### Debug Steps
1. **Open Browser Dev Tools** on both instances
2. **Check Console** for detailed sync logs
3. **Run Debug Script**:
   ```javascript
   // Copy and paste contents of test-sync-debug.js into console
   ```

### Common Issues and Solutions

**QSOs not syncing between stations:**
- Check if both stations have different callsigns/designators
- Verify API endpoints are responding (check logs)
- Look for "Skipping own QSO update" messages (indicates filtering issue)

**Duplicate QSOs appearing:**
- Fixed: Now keeps older QSO and drops newer duplicates
- Check console for "Dropped newer duplicate" messages

**Network discovery not working:**
- Ensure both instances are running on different ports
- Check firewall/network settings
- Verify endpoints return valid JSON

### Manual Sync Test
1. Add QSO on Station 1: `W1AW 1A OH`
2. Check console for broadcast message
3. Check Station 2 console for receive message
4. Verify QSO appears on Station 2

## Expected Results

- **No missing QSOs**: Both stations should have identical QSO lists
- **No duplicates**: Each unique QSO should appear only once
- **Band validation**: Cannot log QSO without selecting band
- **Auto-reconnect**: Network connections persist across browser refreshes
- **Real-time sync**: New QSOs appear on other stations within 5 seconds

## Troubleshooting

If QSOs are still missing:
1. Check browser console for error messages
2. Verify both stations are actually connected (check network status icon)
3. Look at Messages panel for sync completion events
4. Check that QSOs have different callsigns (duplicate detection might be filtering them)

If auto-reconnect isn't working:
1. Ensure "Auto-reconnect" checkbox is checked in Network Modal
2. Check browser console for reconnection attempts
3. Verify localStorage has saved network settings
