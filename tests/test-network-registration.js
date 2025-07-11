/**
 * Simple test to demonstrate proper network registration and QSO sync
 * 
 * Step 1: On localhost:8080 - Run: await testHostSetup()
 * Step 2: On localhost:8081 - Run: await testClientConnection()
 * Step 3: On either instance - Run: await testQsoSync()
 */

// Test host setup on port 8080
async function testHostSetup() {
  console.log('🏠 Setting up as HOST on port 8080...');
  
  // Set as host
  const success = await networkService.startHost(8080);
  if (success) {
    console.log('✅ Host setup successful!');
    console.log('📊 Network status:', networkService.getStatus());
    
    // Monitor for connections
    setTimeout(async () => {
      const stations = networkService.getConnectedStations();
      console.log(`👥 Connected stations: ${stations.length}`);
      stations.forEach(station => {
        console.log(`  📡 ${station.callsign}-${station.designator} at ${station.ip}:${station.port}`);
      });
    }, 2000);
  } else {
    console.log('❌ Host setup failed');
  }
  
  return success;
}

// Test client connection on port 8081
async function testClientConnection() {
  console.log('🔗 Connecting as CLIENT to localhost:8080...');
  
  // Connect to host
  const success = await networkService.connectToHost('localhost:8080');
  if (success) {
    console.log('✅ Client connection successful!');
    console.log('📊 Network status:', networkService.getStatus());
    
    // Check connected stations
    setTimeout(() => {
      const stations = networkService.getConnectedStations();
      console.log(`👥 Connected to: ${stations.length} stations`);
      stations.forEach(station => {
        console.log(`  📡 ${station.callsign}-${station.designator} at ${station.ip}:${station.port}`);
      });
    }, 2000);
  } else {
    console.log('❌ Client connection failed');
  }
  
  return success;
}

// Test QSO synchronization
async function testQsoSync() {
  console.log('📻 Testing QSO synchronization...');
  
  if (!networkService.getStatus().isConnected) {
    console.log('❌ Not connected to network. Connect first.');
    return;
  }
  
  // Create a test QSO
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
  
  console.log('📡 Broadcasting test QSO:', testQso.call);
  
  try {
    await networkService.broadcastQsoUpdate(testQso, 'add');
    console.log('✅ QSO broadcast completed');
    console.log('🔍 Check the other instance console for received QSO');
  } catch (error) {
    console.log('❌ QSO broadcast failed:', error);
  }
}

// Check network registration status
async function checkNetworkStatus() {
  console.log('📊 Network Status Check');
  console.log('======================');
  
  const status = networkService.getStatus();
  console.log('🔗 Connected:', status.isConnected);
  console.log('🆔 Network ID:', status.networkId);
  console.log('⏰ Last Sync:', new Date(status.lastSync).toLocaleTimeString());
  
  const stations = networkService.getConnectedStations();
  console.log('👥 Connected Stations:', stations.length);
  stations.forEach((station, i) => {
    console.log(`  ${i+1}. ${station.callsign}-${station.designator} at ${station.ip}:${station.port}`);
  });
  
  // Test server API directly
  try {
    const response = await fetch('/api/network/stations');
    if (response.ok) {
      const data = await response.json();
      console.log('🖥️ Server-side stations:', data.connectedStations.length);
      console.log('🏠 Is host on server:', data.isHost);
    }
  } catch (error) {
    console.log('❌ Failed to check server API:', error);
  }
}

console.log('🌐 Network Registration Test Suite loaded!');
console.log('');
console.log('📋 Test Steps:');
console.log('  1. On localhost:8080 → await testHostSetup()');
console.log('  2. On localhost:8081 → await testClientConnection()');  
console.log('  3. On either instance → await testQsoSync()');
console.log('  4. Check status with → await checkNetworkStatus()');
console.log('');
console.log('💡 Both instances should show each other in Connected Stations!');

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    testHostSetup, 
    testClientConnection, 
    testQsoSync, 
    checkNetworkStatus 
  };
}
