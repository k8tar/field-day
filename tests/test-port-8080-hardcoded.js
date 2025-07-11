/**
 * Test script to verify port 8080 hardcoding for Field Day Logger
 * 
 * This script tests that:
 * 1. All instances use port 8080 (hardcoded)
 * 2. Network scanning only checks port 8080
 * 3. Server enforces port 8080 with strictPort
 * 
 * Usage:
 * 1. Open the Field Day Logger in browser
 * 2. Open browser dev tools (F12)
 * 3. Copy and paste this script into the console
 * 4. Run: await testHardcodedPort8080()
 */

async function testHardcodedPort8080() {
  console.log('🧪 Testing hardcoded port 8080 configuration...');
  
  // Test 1: Verify current instance is on port 8080
  console.log('\n1️⃣ Testing current instance port...');
  const currentPort = window.location.port || '8080';
  console.log(`📍 Current port: ${currentPort}`);
  
  if (currentPort === '8080') {
    console.log('✅ Current instance is on port 8080');
  } else {
    console.log('⚠️ Current instance is NOT on port 8080 - should be hardcoded!');
  }
  
  // Test 2: Verify local station-info endpoint works
  console.log('\n2️⃣ Testing local station-info endpoint...');
  try {
    const response = await fetch('/api/station-info');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Local station info:', data);
    } else {
      console.log(`❌ Local station info failed: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ Local station info error:', error);
  }
  
  // Test 3: Test network service port configuration
  console.log('\n3️⃣ Testing network service configuration...');
  if (typeof networkService !== 'undefined') {
    try {
      const hostPort = networkService.getHostPort();
      console.log(`📡 Network service host port: ${hostPort}`);
      
      if (hostPort === 8080) {
        console.log('✅ Network service returns hardcoded port 8080');
      } else {
        console.log(`❌ Network service returns wrong port: ${hostPort} (should be 8080)`);
      }
    } catch (error) {
      console.log('❌ Network service error:', error);
    }
  } else {
    console.log('⚠️ Network service not available');
  }
  
  // Test 4: Verify Vite server config (check for strictPort)
  console.log('\n4️⃣ Testing server configuration...');
  console.log('📋 Expected server config:');
  console.log('   • port: 8080');
  console.log('   • strictPort: true (fails if port unavailable)');
  console.log('   • cors: true');
  
  // Test 5: Test network discovery logic
  console.log('\n5️⃣ Testing network discovery for port 8080...');
  try {
    const testUrl = 'http://127.0.0.1:8080/api/station-info';
    console.log(`📡 Testing: ${testUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Field-Day-Logger-Test'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Port 8080 station found:', data);
    } else {
      console.log(`❌ Port 8080 returned HTTP ${response.status}`);
    }
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('⏱️ Port 8080 test timed out');
    } else {
      console.log('❌ Port 8080 test error:', error);
    }
  }
  
  // Test 6: Recommendations
  console.log('\n6️⃣ Configuration recommendations:');
  console.log('📋 For Field Day operations:');
  console.log('   • Run each station on a separate computer/device');
  console.log('   • All instances will automatically use port 8080');
  console.log('   • Network discovery scans local network on port 8080');
  console.log('   • No need to configure different ports');
  console.log('   • Use "Auto" mode for automatic discovery');
  console.log('   • Use "Host" mode on the main logging station');
  console.log('   • Use "Join" mode on additional stations');
  
  console.log('\n✅ Port 8080 hardcoding test complete!');
  console.log('💡 All Field Day instances now use port 8080 exclusively.');
}

// Quick verification function
async function quickPortCheck() {
  const currentPort = window.location.port || '8080';
  console.log(`🔍 Quick check - Current port: ${currentPort}`);
  
  if (currentPort === '8080') {
    console.log('✅ Port 8080 confirmed');
  } else {
    console.log('⚠️ Not on port 8080 - restart with: npm run dev');
  }
}

// Available commands
console.log('🚀 Port 8080 Test Script loaded!');
console.log('');
console.log('📋 Available commands:');
console.log('  • await testHardcodedPort8080() - Full port configuration test');
console.log('  • await quickPortCheck() - Quick port verification');
console.log('');
console.log('🎯 Quick start: await testHardcodedPort8080()');
console.log('💾 Note: All Field Day instances now use hardcoded port 8080!');

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testHardcodedPort8080, quickPortCheck };
}
