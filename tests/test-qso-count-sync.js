/**
 * Test script to verify QSO count synchronization between network instances
 * 
 * This script tests that:
 * 1. Connected stations show correct QSO counts and scores
 * 2. QSO counts update in real-time via heartbeat and monitoring
 * 3. Both host and client see each other with accurate stats
 * 
 * Usage:
 * 1. Set up host on 8080: await setupNetworkHost()
 * 2. Set up client on 8081: await setupNetworkClient()
 * 3. Test QSO sync: await testQsoCountSync()
 */

// Setup host on port 8080
async function setupNetworkHost() {
  console.log('🏠 Setting up Network Host (8080)');
  console.log('==================================');
  
  // Start as host
  const success = await networkService.startHost(8080);
  if (success) {
    console.log('✅ Host setup successful');
    
    // Wait a moment and check status
    setTimeout(async () => {
      const status = networkService.status;
      const stations = networkService.getConnectedStations();
      
      console.log('📊 Host Status:');
      console.log(`  - Connected: ${status.isConnected}`);
      console.log(`  - Network ID: ${status.networkId}`);
      console.log(`  - Connected Stations: ${stations.length}`);
      
      // Get local QSO count
      const qsos = await fileStorage.getQsoData();
      const score = qsos.reduce((total, qso) => total + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1), 0);
      console.log(`  - Local QSOs: ${qsos.length}`);
      console.log(`  - Local Score: ${score}`);
      
      console.log('🏠 Host is ready for client connections!');
    }, 2000);
  } else {
    console.log('❌ Host setup failed');
  }
  
  return success;
}

// Setup client on port 8081 
async function setupNetworkClient() {
  console.log('🔗 Setting up Network Client (8081)');
  console.log('===================================');
  
  // Connect to host
  const success = await networkService.connectToHost('localhost:8080');
  if (success) {
    console.log('✅ Client connection successful');
    
    // Wait a moment and check status
    setTimeout(async () => {
      const status = networkService.status;
      const stations = networkService.getConnectedStations();
      
      console.log('📊 Client Status:');
      console.log(`  - Connected: ${status.isConnected}`);
      console.log(`  - Network ID: ${status.networkId}`);
      console.log(`  - Connected to Host: ${stations.length > 0 ? 'Yes' : 'No'}`);
      
      if (stations.length > 0) {
        const host = stations[0];
        console.log(`  - Host: ${host.callsign}-${host.designator}`);
        console.log(`  - Host QSOs: ${host.qsoCount}`);
        console.log(`  - Host Score: ${host.score}`);
        console.log(`  - Host Online: ${host.online}`);
      }
      
      // Get local QSO count
      const qsos = await fileStorage.getQsoData();
      const score = qsos.reduce((total, qso) => total + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1), 0);
      console.log(`  - Local QSOs: ${qsos.length}`);
      console.log(`  - Local Score: ${score}`);
      
      console.log('🔗 Client is connected and ready!');
    }, 3000);
  } else {
    console.log('❌ Client connection failed');
  }
  
  return success;
}

// Test QSO count synchronization
async function testQsoCountSync() {
  console.log('📊 Testing QSO Count Synchronization');
  console.log('====================================');
  
  if (!networkService.status.isConnected) {
    console.log('❌ Not connected to network. Set up host/client first.');
    return;
  }
  
  // Get initial counts
  const initialQsos = await fileStorage.getQsoData();
  const initialCount = initialQsos.length;
  console.log(`📈 Initial QSO count: ${initialCount}`);
  
  // Add a test QSO
  const testQso = {
    id: Date.now(),
    call: 'W1TEST',
    class: '2A',
    section: 'CT',
    band: '20M',
    mode: 'PH',
    operator: 'TESTOP',
    datetime: new Date().toISOString(),
    stationDesignator: 'TEST',
    timestamp: Date.now()
  };
  
  console.log('📻 Adding test QSO:', testQso.call);
  
  // Save QSO to file storage
  const updatedQsos = [...initialQsos, testQso];
  await fileStorage.saveQsoData(updatedQsos);
  
  // Trigger QSO store reload if available
  if (typeof window.qsoStore !== 'undefined' && window.qsoStore.loadQsos) {
    window.qsoStore.loadQsos();
  }
  
  console.log(`📈 New QSO count: ${updatedQsos.length}`);
  
  // Broadcast the QSO update
  try {
    await networkService.broadcastQsoUpdate(testQso, 'add');
    console.log('✅ QSO broadcast sent');
  } catch (error) {
    console.log('❌ QSO broadcast failed:', error);
  }
  
  // Wait for heartbeat/monitoring to update counts
  console.log('⏳ Waiting for count updates (10 seconds)...');
  
  setTimeout(async () => {
    console.log('📊 Checking updated counts:');
    
    const stations = networkService.getConnectedStations();
    if (stations.length > 0) {
      stations.forEach((station, i) => {
        console.log(`  Station ${i+1}: ${station.callsign}-${station.designator}`);
        console.log(`    - QSOs: ${station.qsoCount}`);
        console.log(`    - Score: ${station.score}`);
        console.log(`    - Online: ${station.online}`);
        console.log(`    - Last Seen: ${new Date(station.lastSeen).toLocaleTimeString()}`);
      });
    } else {
      console.log('  No connected stations visible');
    }
    
    // Check local count
    const finalQsos = await fileStorage.getQsoData();
    console.log(`📈 Final local QSO count: ${finalQsos.length}`);
  }, 10000);
}

// Monitor QSO counts in real-time
function startQsoCountMonitor() {
  console.log('👁️ Starting Real-time QSO Count Monitor');
  console.log('======================================');
  
  let lastCounts = new Map();
  
  const monitor = setInterval(async () => {
    const stations = networkService.getConnectedStations();
    const localQsos = await fileStorage.getQsoData();
    const localCount = localQsos.length;
    const localScore = localQsos.reduce((total, qso) => total + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1), 0);
    
    // Check if local count changed
    if (lastCounts.get('local') !== localCount) {
      console.log(`📊 LOCAL: ${localCount} QSOs, ${localScore} pts`);
      lastCounts.set('local', localCount);
    }
    
    // Check connected stations
    stations.forEach(station => {
      const key = `${station.callsign}-${station.designator}`;
      const currentCount = station.qsoCount;
      
      if (lastCounts.get(key) !== currentCount) {
        console.log(`📡 ${key}: ${currentCount} QSOs, ${station.score} pts (${station.online ? 'online' : 'offline'})`);
        lastCounts.set(key, currentCount);
      }
    });
  }, 2000);
  
  console.log('👁️ Monitor started (updates every 2 seconds)');
  console.log('   Run stopQsoCountMonitor() to stop');
  
  // Store monitor ID globally so it can be stopped
  window.qsoCountMonitor = monitor;
}

function stopQsoCountMonitor() {
  if (window.qsoCountMonitor) {
    clearInterval(window.qsoCountMonitor);
    console.log('⏹️ QSO count monitor stopped');
    delete window.qsoCountMonitor;
  }
}

// Quick status check
function checkConnectedStations() {
  console.log('📊 Connected Stations Status');
  console.log('============================');
  
  const status = networkService.status;
  console.log(`🔗 Network Connected: ${status.isConnected}`);
  console.log(`🎯 Network Mode: ${networkService.getCurrentNetworkMode()}`);
  
  const stations = networkService.getConnectedStations();
  console.log(`👥 Connected Stations: ${stations.length}`);
  
  stations.forEach((station, i) => {
    console.log(`\n  Station ${i+1}: ${station.callsign}-${station.designator}`);
    console.log(`    📍 Address: ${station.ip}:${station.port}`);
    console.log(`    📊 QSOs: ${station.qsoCount}`);
    console.log(`    🏆 Score: ${station.score}`);
    console.log(`    🟢 Online: ${station.online}`);
    console.log(`    ⏰ Last Seen: ${station.lastSeen ? new Date(station.lastSeen).toLocaleTimeString() : 'Never'}`);
  });
  
  if (stations.length === 0) {
    console.log('  (No stations connected)');
  }
}

console.log('📊 QSO Count Sync Test Suite loaded!');
console.log('');
console.log('📋 Commands for testing QSO count sync:');
console.log('  Host (8080):');
console.log('    • await setupNetworkHost() - Set up as host');
console.log('');
console.log('  Client (8081):');
console.log('    • await setupNetworkClient() - Connect to host');
console.log('');
console.log('  Both instances:');
console.log('    • await testQsoCountSync() - Add QSO and test sync');
console.log('    • checkConnectedStations() - Check current status');
console.log('    • startQsoCountMonitor() - Monitor counts in real-time');
console.log('    • stopQsoCountMonitor() - Stop monitoring');
console.log('');
console.log('🎯 Expected results:');
console.log('  • Host should see client with correct QSO count');
console.log('  • Client should see host with correct QSO count');
console.log('  • Counts should update via heartbeat every 10 seconds');

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    setupNetworkHost,
    setupNetworkClient,
    testQsoCountSync,
    startQsoCountMonitor,
    stopQsoCountMonitor,
    checkConnectedStations
  };
}
