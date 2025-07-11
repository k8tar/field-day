/**
 * Test script to debug network settings persistence
 * 
 * This script helps debug why network settings aren't persisting
 * across server reloads and why auto-reconnection isn't working.
 * 
 * Usage:
 * 1. Open browser dev tools (F12)
 * 2. Copy and paste this script
 * 3. Run the test functions
 */

// Test 1: Check current network settings in file storage
async function debugNetworkSettings() {
  console.log('🔍 Debugging Network Settings Persistence');
  console.log('==========================================');
  
  try {
    // Check what's in file storage
    const settings = await fileStorage.getSettings();
    console.log('📁 Raw settings from file storage:', settings);
    console.log('📡 Network settings in file storage:', settings.networkSettings);
    
    // Check what network service has loaded
    const networkSettings = networkService.getNetworkSettings();
    console.log('🌐 Network service current settings:', networkSettings);
    
    // Check current network mode
    const currentMode = networkService.getCurrentNetworkMode();
    console.log('🎯 Current network mode detected:', currentMode);
    
    // Check connection status
    const status = networkService.status;
    console.log('🔗 Connection status:', status);
    
    return {
      fileStorage: settings.networkSettings,
      networkService: networkSettings,
      currentMode,
      status
    };
  } catch (error) {
    console.error('❌ Error debugging network settings:', error);
    return null;
  }
}

// Test 2: Save test settings and verify they persist
async function testNetworkSettingsPersistence() {
  console.log('💾 Testing Network Settings Persistence');
  console.log('=======================================');
  
  // Save host settings
  console.log('1. Setting host mode...');
  networkService.updateNetworkMode('host', { hostPort: 8083 });
  networkService.setAutoReconnect(true);
  
  // Wait for save
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check if settings were saved
  const savedSettings = await fileStorage.getSettings();
  console.log('💾 Settings after save:', savedSettings.networkSettings);
  
  // Change to join mode
  console.log('2. Setting join mode...');
  networkService.updateNetworkMode('join', { hostAddress: 'localhost:8080' });
  
  // Wait for save
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check if settings were updated
  const updatedSettings = await fileStorage.getSettings();
  console.log('💾 Settings after update:', updatedSettings.networkSettings);
  
  // Test auto mode
  console.log('3. Setting auto mode...');
  networkService.updateNetworkMode('auto');
  
  // Wait for save
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check final settings
  const finalSettings = await fileStorage.getSettings();
  console.log('💾 Settings after auto mode:', finalSettings.networkSettings);
  
  console.log('✅ Settings persistence test complete');
  console.log('📝 Now refresh the page and run debugNetworkSettings() to see if they were restored');
}

// Test 3: Simulate the startup process
async function simulateStartupProcess() {
  console.log('🚀 Simulating Startup Process');
  console.log('=============================');
  
  // Step 1: Load settings (like the constructor does)
  console.log('1. Loading network settings...');
  const settings = await fileStorage.getSettings();
  console.log('📁 Loaded settings:', settings.networkSettings);
  
  // Step 2: Check what mode should be restored
  if (settings.networkSettings) {
    const { isHost, lastHostAddress, hostPort, autoReconnect } = settings.networkSettings;
    
    console.log('2. Analyzing settings for auto-reconnect...');
    console.log(`   - Auto-reconnect: ${autoReconnect}`);
    console.log(`   - Is host: ${isHost}`);
    console.log(`   - Host port: ${hostPort}`);
    console.log(`   - Last host address: ${lastHostAddress}`);
    
    if (autoReconnect) {
      if (isHost) {
        console.log(`🏠 Would auto-start host on port ${hostPort}`);
      } else if (lastHostAddress) {
        console.log(`🔗 Would auto-connect to ${lastHostAddress}`);
      } else {
        console.log('ℹ️ Would stay in auto-discover mode');
      }
    } else {
      console.log('⏸️ Auto-reconnect disabled, no automatic connection');
    }
  } else {
    console.log('ℹ️ No network settings found, using defaults');
  }
}

// Test 4: Check what happens during actual auto-reconnect
async function testAutoReconnect() {
  console.log('🔄 Testing Auto-Reconnect Process');
  console.log('=================================');
  
  // First save some settings
  console.log('1. Setting up host mode with auto-reconnect...');
  networkService.updateNetworkMode('host', { hostPort: 8080 });
  networkService.setAutoReconnect(true);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Verify settings
  const settings = networkService.getNetworkSettings();
  console.log('💾 Current settings:', settings);
  
  // Simulate what happens on page load
  console.log('2. Simulating auto-reconnect check...');
  
  if (settings.autoReconnect) {
    console.log('✅ Auto-reconnect is enabled');
    
    if (settings.isHost) {
      console.log(`🏠 Starting host on port ${settings.hostPort}...`);
      const success = await networkService.startHost(settings.hostPort);
      console.log(`📊 Host start result: ${success}`);
    } else if (settings.lastHostAddress) {
      console.log(`🔗 Connecting to ${settings.lastHostAddress}...`);
      const success = await networkService.connectToHost(settings.lastHostAddress);
      console.log(`📊 Connect result: ${success}`);
    }
  } else {
    console.log('⏸️ Auto-reconnect is disabled');
  }
  
  // Check final state
  console.log('3. Final network state:');
  console.log('📡 Status:', networkService.status);
  console.log('🎯 Mode:', networkService.getCurrentNetworkMode());
}

// Quick status check
function quickStatus() {
  console.log('📊 Quick Network Status');
  console.log('======================');
  console.log('🔗 Connected:', networkService.status.isConnected);
  console.log('🎯 Mode:', networkService.getCurrentNetworkMode());
  console.log('🏠 Host port:', networkService.getHostPort());
  console.log('📍 Host address:', networkService.getHostAddress());
  console.log('🔄 Auto-reconnect:', networkService.getNetworkSettings().autoReconnect);
}

console.log('🔧 Network Settings Debug Suite loaded!');
console.log('');
console.log('📋 Available debug commands:');
console.log('  • await debugNetworkSettings() - Check current settings');
console.log('  • await testNetworkSettingsPersistence() - Test save/load');
console.log('  • await simulateStartupProcess() - Simulate startup logic');
console.log('  • await testAutoReconnect() - Test auto-reconnection');
console.log('  • quickStatus() - Quick status check');
console.log('');
console.log('🚀 Start with: await debugNetworkSettings()');

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    debugNetworkSettings,
    testNetworkSettingsPersistence,
    simulateStartupProcess,
    testAutoReconnect,
    quickStatus
  };
}
