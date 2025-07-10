/**
 * Test script for network synchronization features
 * 
 * This script tests:
 * 1. Initial full sync when stations connect
 * 2. Persistent network settings
 * 3. Auto-reconnect functionality
 * 4. QSO synchronization across stations
 * 
 * To run this test:
 * 1. Start two instances of the app on different ports
 * 2. Open browser dev tools on both instances
 * 3. Copy and paste this script into the console
 * 4. Follow the test prompts
 */

async function testNetworkSync() {
  console.log('🧪 Starting Network Sync Test...');
  
  // Test 1: Check if network service is available
  if (typeof window.networkService === 'undefined') {
    console.log('⚠️  Network service not available in global scope');
    console.log('Try accessing it via: window.app.$networkService or similar');
    return;
  }
  
  const networkService = window.networkService;
  
  // Test 2: Check network settings persistence
  console.log('📋 Testing network settings persistence...');
  const settings = networkService.getNetworkSettings();
  console.log('Current settings:', settings);
  
  // Test 3: Test auto-reconnect setting
  console.log('🔄 Testing auto-reconnect setting...');
  networkService.setAutoReconnect(true);
  const updatedSettings = networkService.getNetworkSettings();
  console.log('Auto-reconnect enabled:', updatedSettings.autoReconnect);
  
  // Test 4: Check connection status
  console.log('📡 Checking connection status...');
  const status = networkService.getConnectionStatus();
  console.log('Connection status:', status);
  
  // Test 5: Discovery test
  console.log('🔍 Testing station discovery...');
  try {
    const discovered = await networkService.discoverStations();
    console.log('Discovered stations:', discovered);
    
    if (discovered.length > 0) {
      console.log('✅ Discovery working! Found stations:');
      discovered.forEach(station => {
        console.log(`  - ${station.callsign} (${station.designator}) at ${station.ip}:${station.port}`);
      });
    } else {
      console.log('ℹ️  No stations discovered. Make sure another instance is running on a different port.');
    }
  } catch (error) {
    console.error('❌ Discovery failed:', error);
  }
  
  console.log('🧪 Network Sync Test Complete!');
  console.log('');
  console.log('Manual testing steps:');
  console.log('1. Connect two stations using the network modal');
  console.log('2. Add a QSO on one station');
  console.log('3. Verify it appears on the other station');
  console.log('4. Refresh both browsers');
  console.log('5. Verify auto-reconnect works');
}

// Auto-run the test
testNetworkSync();

// Helper function to manually test QSO sync
window.testQsoSync = function(callsign = 'TEST123') {
  console.log(`🔄 Adding test QSO: ${callsign}`);
  
  // This would need to be adapted to your actual QSO store interface
  if (typeof window.qsoStore !== 'undefined') {
    window.qsoStore.logQso({
      call: callsign,
      class: '1A',
      section: 'TEST',
      datetime: new Date().toISOString(),
      band: '20M',
      mode: 'PH'
    });
    console.log('✅ Test QSO added');
  } else {
    console.log('⚠️  QSO store not available in global scope');
  }
};

console.log('🧪 Network sync test loaded!');
console.log('📋 Available commands:');
console.log('  • testQsoSync("W1AW") - Add a test QSO');
console.log('  • networkService.getConnectionStatus() - Check connection');
console.log('  • networkService.discoverStations() - Discover stations');
