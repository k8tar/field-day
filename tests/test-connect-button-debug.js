/**
 * Test script to debug Network Modal Connect button issues
 * 
 * This script tests:
 * 1. Network modal state
 * 2. Connect button functionality
 * 3. Network service methods
 * 4. UI state after connection attempts
 * 
 * Usage:
 * 1. Open Field Day Logger in browser
 * 2. Open Network Modal
 * 3. Open browser dev tools (F12)
 * 4. Copy and paste this script into the console
 * 5. Run: await testConnectButton()
 */

async function testConnectButton() {
  console.log('🧪 Testing Network Modal Connect Button...');
  
  // Test 1: Check if networkService is available
  console.log('\n1️⃣ Testing networkService availability...');
  if (typeof networkService === 'undefined') {
    console.error('❌ networkService not available');
    return;
  }
  console.log('✅ networkService is available');
  
  // Test 2: Check current network status
  console.log('\n2️⃣ Current network status...');
  console.log('📡 isConnected:', networkService.status.isConnected);
  console.log('🌐 networkId:', networkService.status.networkId);
  console.log('⏰ lastSync:', networkService.status.lastSync);
  console.log('📡 connectedStations:', networkService.connectedStations?.length || 0);
  
  // Test 3: Test startHost method directly
  console.log('\n3️⃣ Testing startHost method...');
  try {
    console.log('🏠 Calling networkService.startHost()...');
    const hostResult = await networkService.startHost();
    console.log('✅ startHost result:', hostResult);
    console.log('📡 Status after host start:', networkService.status);
  } catch (error) {
    console.error('❌ startHost failed:', error);
  }
  
  // Test 4: Test connectToHost method (with localhost)
  console.log('\n4️⃣ Testing connectToHost method...');
  try {
    console.log('🔗 Calling networkService.connectToHost("127.0.0.1:8080")...');
    const connectResult = await networkService.connectToHost('127.0.0.1:8080');
    console.log('✅ connectToHost result:', connectResult);
    console.log('📡 Status after connect:', networkService.status);
  } catch (error) {
    console.error('❌ connectToHost failed:', error);
  }
  
  // Test 5: Check server endpoints
  console.log('\n5️⃣ Testing server endpoints...');
  try {
    console.log('📡 Testing /api/station-info...');
    const stationResponse = await fetch('/api/station-info');
    if (stationResponse.ok) {
      const stationData = await stationResponse.json();
      console.log('✅ Station info:', stationData);
    } else {
      console.log('❌ Station info failed:', stationResponse.status);
    }
    
    console.log('📡 Testing /api/network/host...');
    const hostResponse = await fetch('/api/network/host', { method: 'POST' });
    if (hostResponse.ok) {
      const hostData = await hostResponse.json();
      console.log('✅ Host registration:', hostData);
    } else {
      console.log('❌ Host registration failed:', hostResponse.status);
    }
  } catch (error) {
    console.error('❌ Server endpoint test failed:', error);
  }
  
  // Test 6: DOM button state
  console.log('\n6️⃣ Testing UI button state...');
  const connectButton = document.querySelector('.connect-button');
  if (connectButton) {
    console.log('✅ Connect button found');
    console.log('🔘 Button disabled:', connectButton.disabled);
    console.log('📝 Button text:', connectButton.textContent?.trim());
    console.log('🎯 Button classes:', connectButton.className);
    
    // Try clicking the button programmatically
    console.log('🖱️ Simulating button click...');
    connectButton.click();
  } else {
    console.log('❌ Connect button not found in DOM');
  }
  
  console.log('\n✅ Connect button test complete!');
  console.log('💡 Check network modal state and browser console for connection results');
}

// Quick button check
function quickButtonCheck() {
  const connectButton = document.querySelector('.connect-button');
  if (connectButton) {
    console.log('🔘 Connect button status:');
    console.log('  • Found: ✅');
    console.log('  • Disabled:', connectButton.disabled);
    console.log('  • Text:', connectButton.textContent?.trim());
    console.log('  • Visible:', getComputedStyle(connectButton).display !== 'none');
  } else {
    console.log('❌ Connect button not found');
    console.log('💡 Make sure Network Modal is open');
  }
}

// Available commands
console.log('🔗 Network Connect Button Debugger loaded!');
console.log('');
console.log('📋 Available commands:');
console.log('  • await testConnectButton() - Full connect button test');
console.log('  • quickButtonCheck() - Quick button state check');
console.log('');
console.log('🎯 Quick start: Open Network Modal, then run await testConnectButton()');

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testConnectButton, quickButtonCheck };
}
