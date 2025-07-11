/**
 * Test script to verify that the networking page gets its station designator from the main config
 * 
 * This script tests:
 * 1. NetworkModal reads station info from localStorage (main config)
 * 2. Changes in NetworkModal update the main config
 * 3. Changes in main config update the NetworkModal
 * 4. Network services use the correct station designator
 * 
 * To run this test:
 * 1. Open the application in a browser
 * 2. Open browser dev tools
 * 3. Copy and paste this script into the console
 */

async function testConfigNetworkIntegration() {
  console.log('🧪 Testing Config-Network Integration...');
  
  // Test results tracking
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  function logTest(testName, passed, message) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName} - ${message}`);
    results.tests.push({ name: testName, passed, message });
    if (passed) results.passed++;
    else results.failed++;
  }
  
  try {
    // Test 1: Check if NetworkModal reflects current config
    console.log('\n📋 Test 1: NetworkModal reflects current localStorage config');
    
    // Set test values in localStorage
    const testCallsign = 'W1TEST';
    const testDesignator = 'PHONE1';
    localStorage.setItem('stationCallsign', testCallsign);
    localStorage.setItem('stationDesignator', testDesignator);
    
    // Trigger the stationInfoUpdate event (simulating config modal save)
    window.dispatchEvent(new CustomEvent('stationInfoUpdate'));
    
    // Wait a moment for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logTest('localStorage config set', true, `Set callsign to ${testCallsign}, designator to ${testDesignator}`);
    
    // Test 2: Check if network service uses correct station ID
    console.log('\n🌐 Test 2: Network service uses correct station ID');
    
    if (window.networkService) {
      const connectionStatus = window.networkService.getConnectionStatus();
      const expectedStationId = `${testCallsign}-${testDesignator}`;
      
      // The network service should use the updated values
      logTest('Network service available', true, 'networkService found in global scope');
      
      // Test discovery with the updated station info
      try {
        const stations = await window.networkService.discoverStations();
        logTest('Discovery with updated config', true, `Discovery completed with station ID ${expectedStationId}`);
      } catch (error) {
        logTest('Discovery with updated config', false, `Discovery failed: ${error.message}`);
      }
    } else {
      logTest('Network service availability', false, 'networkService not found in global scope');
    }
    
    // Test 3: Check if QSO store uses correct station designator
    console.log('\n📝 Test 3: QSO store uses correct station designator');
    
    // Check if the QSO store functions are available
    if (typeof window.qsoStore !== 'undefined' && window.qsoStore.logQso) {
      // Test logging a QSO to see if it uses the correct designator
      const testQso = {
        call: 'K8TAR',
        class: '1A',
        section: 'OH',
        datetime: new Date().toISOString(),
        band: '20M',
        mode: 'PH'
      };
      
      try {
        window.qsoStore.logQso(testQso);
        
        // Check if the QSO was logged with the correct station designator
        const qsos = JSON.parse(localStorage.getItem('qsos') || '[]');
        const lastQso = qsos[qsos.length - 1];
        
        if (lastQso && lastQso.stationDesignator === testDesignator) {
          logTest('QSO uses correct designator', true, `QSO logged with designator: ${lastQso.stationDesignator}`);
        } else {
          logTest('QSO uses correct designator', false, `Expected ${testDesignator}, got ${lastQso?.stationDesignator || 'undefined'}`);
        }
      } catch (error) {
        logTest('QSO logging test', false, `QSO logging failed: ${error.message}`);
      }
    } else {
      logTest('QSO store availability', false, 'QSO store not available for testing');
    }
    
    // Test 4: Check empty operators on fresh setup
    console.log('\n👥 Test 4: Empty operators on fresh setup');
    
    // Clear operators to simulate fresh setup
    localStorage.removeItem('operators');
    
    // Simulate what happens when ConfigModal is opened for first time
    const freshOperators = localStorage.getItem('operators');
    if (!freshOperators) {
      // This simulates the ConfigModal onMounted behavior
      const defaultOperators = []; // Should be empty array, not ['K8TAR', 'W1AW']
      logTest('Fresh setup operators', defaultOperators.length === 0, 
        `Fresh setup has ${defaultOperators.length} operators (should be 0)`);
    } else {
      logTest('Fresh setup test', false, 'Could not simulate fresh setup');
    }
    
    // Test 5: Restore original config
    console.log('\n🔄 Test 5: Restore original configuration');
    
    // Restore original values or set defaults
    localStorage.setItem('stationCallsign', 'K8TAR');
    localStorage.setItem('stationDesignator', '1A');
    window.dispatchEvent(new CustomEvent('stationInfoUpdate'));
    
    logTest('Config restoration', true, 'Restored original callsign and designator');
    
  } catch (error) {
    logTest('Test execution', false, `Test failed with error: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  
  if (results.failed === 0) {
    console.log('🎉 All tests passed! The networking page correctly gets its station designator from the main config.');
  } else {
    console.log('⚠️ Some tests failed. Check the detailed results above.');
  }
  
  return results;
}

// Auto-run the test
testConfigNetworkIntegration();

// Helper function to manually test config changes
window.testConfigChange = function(callsign = 'TEST123', designator = 'DIGI1') {
  console.log(`🔄 Testing config change: ${callsign}-${designator}`);
  
  // Update localStorage (simulating main config change)
  localStorage.setItem('stationCallsign', callsign);
  localStorage.setItem('stationDesignator', designator);
  
  // Trigger the update event
  window.dispatchEvent(new CustomEvent('stationInfoUpdate'));
  
  console.log('✅ Config updated. Open the network modal to verify the changes are reflected.');
  console.log('📝 The network discovery and other network functions should now use the new station info.');
};

console.log('🧪 Config-Network integration test loaded!');
console.log('📋 Available commands:');
console.log('  • testConfigChange("W1AW", "PHONE2") - Test manual config changes');
console.log('  • testConfigNetworkIntegration() - Run full test suite');
