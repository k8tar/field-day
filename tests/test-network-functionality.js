/**
 * Test script to verify network functionality and settings persistence
 * Specifically tests Host/Join settings persistence and QSO synchronization
 * 
 * Usage:
 * 1. Open the Field Day Logger in browser
 * 2. Open browser dev tools (F12)
 * 3. Copy and paste this script into the console
 * 4. Run: await testNetworkFunctionality()
 */

async function testNetworkFunctionality() {
  console.log('🌐 Testing network functionality and settings persistence...');
  
  // Check if network service is available
  if (typeof networkService === 'undefined') {
    console.error('❌ Network service not available. Make sure the app is loaded.');
    return null;
  }
  
  // Test 1: Settings persistence
  console.log('\n📋 Test 1: Network Settings Persistence');
  
  // Save host settings
  console.log('💾 Setting host mode with port 8081...');
  networkService.updateNetworkMode('host', { hostPort: 8081 });
  networkService.setAutoReconnect(true);
  
  // Wait a moment for save
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verify settings were saved
  const hostSettings = networkService.getNetworkSettings();
  console.log('📋 Host settings:', hostSettings);
  
  if (hostSettings.isHost && hostSettings.hostPort === 8081 && hostSettings.autoReconnect) {
    console.log('✅ Host settings saved correctly');
  } else {
    console.log('❌ Host settings not saved correctly');
  }
  
  // Save join settings
  console.log('💾 Setting join mode with address localhost:8080...');
  networkService.updateNetworkMode('join', { hostAddress: 'localhost:8080' });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verify join settings were saved
  const joinSettings = networkService.getNetworkSettings();
  console.log('📋 Join settings:', joinSettings);
  
  if (!joinSettings.isHost && joinSettings.lastHostAddress === 'localhost:8080') {
    console.log('✅ Join settings saved correctly');
  } else {
    console.log('❌ Join settings not saved correctly');
  }
  
  // Test 2: Network connection status
  console.log('\n🔗 Test 2: Network Connection Status');
  
  const status = networkService.getStatus();
  console.log('📊 Network status:', status);
  
  if (status.isConnected) {
    console.log('✅ Network is connected');
    console.log(`📡 Network ID: ${status.networkId}`);
    console.log(`👥 Connected stations: ${networkService.getConnectedStations().length}`);
  } else {
    console.log('⚠️ Network is not connected - this is normal if no other instances are running');
  }
  
  // Test 3: QSO broadcast functionality
  console.log('\n📻 Test 3: QSO Broadcast Functionality');
  
  // Create a test QSO
  const testQso = {
    id: Date.now(), // Unique ID
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
  
  console.log('📡 Testing QSO broadcast with test QSO:', testQso);
  
  try {
    await networkService.broadcastQsoUpdate(testQso, 'add');
    console.log('✅ QSO broadcast completed (check console for transmission details)');
  } catch (error) {
    console.log('❌ QSO broadcast failed:', error);
  }
  
  // Test 4: Station discovery
  console.log('\n🔍 Test 4: Station Discovery');
  
  try {
    console.log('🔍 Scanning for other Field Day stations...');
    const discoveredStations = await networkService.discoverStations();
    
    if (discoveredStations.length > 0) {
      console.log(`✅ Found ${discoveredStations.length} stations:`);
      discoveredStations.forEach(station => {
        console.log(`  📡 ${station.callsign}-${station.designator} at ${station.ip}:${station.port}`);
      });
    } else {
      console.log('ℹ️ No other stations discovered (start another instance on a different port to test)');
    }
  } catch (error) {
    console.log('❌ Station discovery failed:', error);
  }
  
  // Test 5: File storage integration
  console.log('\n💾 Test 5: File Storage Integration');
  
  try {
    const settings = await fileStorage.getSettings();
    if (settings.networkSettings) {
      console.log('✅ Network settings found in file storage:', settings.networkSettings);
    } else {
      console.log('⚠️ No network settings found in file storage');
    }
  } catch (error) {
    console.log('❌ Failed to read network settings from file storage:', error);
  }
  
  console.log('\n🎯 Network Functionality Test Complete');
  console.log('');
  console.log('📋 Summary:');
  console.log('  • Network settings should persist across browser refreshes');
  console.log('  • Host/Join settings should be restored when reopening the network modal');
  console.log('  • QSO broadcasts should be sent to connected stations');
  console.log('  • Station discovery should find other instances on different ports');
  console.log('');
  console.log('🧪 To test multi-instance sync:');
  console.log('  1. Start this instance as Host on port 8081');
  console.log('  2. Start another instance: npm run dev -- --port 8082');
  console.log('  3. Set the second instance to Join localhost:8081');
  console.log('  4. Add QSOs on either instance and verify they sync');
  
  return {
    settingsPersistence: {
      host: hostSettings.isHost && hostSettings.hostPort === 8081,
      join: !joinSettings.isHost && joinSettings.lastHostAddress === 'localhost:8080'
    },
    networkStatus: status,
    discoveredStations: discoveredStations || []
  };
}

// Test network persistence after page refresh
async function testNetworkPersistenceAfterRefresh() {
  console.log('🔄 Testing network settings persistence after refresh...');
  
  // Save settings
  networkService.updateNetworkMode('host', { hostPort: 8083 });
  networkService.setAutoReconnect(true);
  
  console.log('💾 Settings saved. Now refresh the page and run:');
  console.log('  await verifyNetworkSettingsAfterRefresh()');
}

async function verifyNetworkSettingsAfterRefresh() {
  console.log('🔍 Verifying network settings after refresh...');
  
  const settings = networkService.getNetworkSettings();
  console.log('📋 Current settings:', settings);
  
  if (settings.isHost && settings.hostPort === 8083 && settings.autoReconnect) {
    console.log('✅ Network settings persisted correctly after refresh!');
  } else {
    console.log('❌ Network settings were not restored after refresh');
  }
  
  return settings;
}

// Available commands
console.log('🌐 Network Functionality Test Suite loaded!');
console.log('');
console.log('📋 Available commands:');
console.log('  • await testNetworkFunctionality() - Full network functionality test');
console.log('  • await testNetworkPersistenceAfterRefresh() - Test settings persistence');
console.log('  • await verifyNetworkSettingsAfterRefresh() - Verify after refresh');
console.log('');
console.log('🚀 Quick start: await testNetworkFunctionality()');

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    testNetworkFunctionality, 
    testNetworkPersistenceAfterRefresh, 
    verifyNetworkSettingsAfterRefresh 
  };
}
