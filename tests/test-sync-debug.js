/**
 * Comprehensive Network Sync Test Script
 * 
 * Run this in the browser console to test network synchronization.
 * This script will help identify exactly where sync is failing.
 */

(function() {
  console.log('🧪 Starting comprehensive network sync test...');
  
  // Check if we can access the QSO store
  const qsoModule = window.qsoStore || window.$qsoStore;
  if (!qsoModule) {
    console.error('❌ Cannot access QSO store. Make sure Vue dev tools are available.');
    return;
  }
  
  // Test functions
  async function testAPIEndpoints() {
    console.log('\n📡 Testing API endpoints...');
    
    try {
      // Test station info
      const stationResponse = await fetch('/api/station-info');
      if (stationResponse.ok) {
        const stationInfo = await stationResponse.json();
        console.log('✅ Station info:', stationInfo);
      } else {
        console.error('❌ Station info failed:', stationResponse.status);
      }
      
      // Test QSO endpoint (all QSOs)
      const qsoResponse = await fetch('/api/qsos');
      if (qsoResponse.ok) {
        const qsoData = await qsoResponse.json();
        console.log('✅ QSO endpoint (all):', qsoData.qsos.length, 'QSOs');
        console.log('QSOs:', qsoData.qsos);
      } else {
        console.error('❌ QSO endpoint failed:', qsoResponse.status);
      }
      
      // Test QSO endpoint (since timestamp)
      const sinceResponse = await fetch('/api/qsos?since=0');
      if (sinceResponse.ok) {
        const sinceData = await sinceResponse.json();
        console.log('✅ QSO endpoint (since 0):', sinceData.qsos.length, 'QSOs');
      } else {
        console.error('❌ QSO endpoint (since) failed:', sinceResponse.status);
      }
      
    } catch (error) {
      console.error('❌ API test error:', error);
    }
  }
  
  function addTestQSO(callsign = 'TEST123') {
    console.log(`\n📝 Adding test QSO: ${callsign}`);
    
    // Try different ways to access the logQso function
    if (window.logQso) {
      window.logQso({
        call: callsign,
        class: '1A',
        section: 'TEST',
        datetime: new Date().toISOString(),
        band: '20M',
        mode: 'PH'
      });
    } else if (qsoModule.logQso) {
      qsoModule.logQso({
        call: callsign,
        class: '1A',
        section: 'TEST',
        datetime: new Date().toISOString(),
        band: '20M',
        mode: 'PH'
      });
    } else {
      console.error('❌ Cannot find logQso function');
    }
  }
  
  function testDiscovery() {
    console.log('\n🔍 Testing station discovery...');
    
    if (window.networkService) {
      window.networkService.discoverStations().then(stations => {
        console.log('✅ Discovered stations:', stations);
      }).catch(error => {
        console.error('❌ Discovery failed:', error);
      });
    } else {
      console.error('❌ Network service not available');
    }
  }
  
  function checkNetworkStatus() {
    console.log('\n📊 Checking network status...');
    
    if (window.networkService) {
      const status = window.networkService.getConnectionStatus();
      console.log('Network status:', status);
      
      const settings = window.networkService.getNetworkSettings();
      console.log('Network settings:', settings);
      
      const stations = window.networkService.getConnectedStations();
      console.log('Connected stations:', stations);
    } else {
      console.error('❌ Network service not available');
    }
  }
  
  // Run the tests
  checkNetworkStatus();
  testAPIEndpoints();
  testDiscovery();
  
  // Expose test functions
  window.syncTest = {
    addTestQSO,
    testAPIEndpoints,
    testDiscovery,
    checkNetworkStatus
  };
  
  console.log('\n🎯 Test functions available:');
  console.log('  • syncTest.addTestQSO("CALL123") - Add a test QSO');
  console.log('  • syncTest.testAPIEndpoints() - Test API endpoints');
  console.log('  • syncTest.testDiscovery() - Test station discovery');
  console.log('  • syncTest.checkNetworkStatus() - Check network status');
  
})();
