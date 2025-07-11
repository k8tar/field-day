// Quick test commands for QSO sync debugging
// Run these in browser console

// Test command to manually refresh network stations
window.refreshNetworkStations = async function() {
  if (typeof networkService === 'undefined') {
    console.error('❌ networkService not available');
    return;
  }
  
  console.log('🔄 Manually refreshing network stations...');
  await networkService.refreshConnectedStations();
};

// Test command to check current network status
window.checkNetworkStatus = async function() {
  try {
    const response = await fetch('/api/network/stations');
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Current network status:', data);
      return data;
    }
  } catch (error) {
    console.error('❌ Failed to check network status:', error);
  }
};

// Test command to trigger a manual heartbeat
window.sendHeartbeat = async function() {
  try {
    // Get station info
    const stationResponse = await fetch('/api/station-info');
    const stationInfo = await stationResponse.json();
    
    // Get QSO data
    const qsoData = await fileStorage.getQsoData();
    const qsoCount = qsoData.length;
    const score = qsoData.reduce((total, qso) => {
      return total + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1);
    }, 0);
    
    const heartbeatData = {
      stationId: `${stationInfo.callsign}-${stationInfo.designator}`,
      qsoCount: qsoCount,
      score: score,
      timestamp: Date.now()
    };
    
    console.log('💓 Sending manual heartbeat:', heartbeatData);
    
    // For clients, send to host (port 8080)
    const response = await fetch('http://localhost:8080/api/network/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(heartbeatData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Heartbeat sent successfully:', result);
    } else {
      console.log('❌ Heartbeat failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Heartbeat error:', error);
  }
};

// Test command to add a QSO and monitor sync
window.addTestQsoAndMonitor = async function() {
  try {
    // Add a test QSO using the QSO store
    if (typeof qsoStore === 'undefined') {
      console.error('❌ qsoStore not available');
      return;
    }
    
    console.log('➕ Adding test QSO...');
    
    const testQso = {
      call: `W${Math.floor(Math.random() * 10)}TEST`,
      class: '1A',
      section: 'CT',
      band: '40M',
      mode: 'PH',
      operator: 'TEST'
    };
    
    await qsoStore.addQso(testQso);
    console.log('✅ Test QSO added:', testQso);
    
    // Monitor for changes
    console.log('🔍 Monitoring network status for changes...');
    let checks = 0;
    const monitor = setInterval(async () => {
      checks++;
      console.log(`--- Check ${checks} ---`);
      
      const status = await checkNetworkStatus();
      
      if (checks >= 5) {
        clearInterval(monitor);
        console.log('✅ Monitoring complete');
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

console.log('🧪 QSO Sync Debug Commands Loaded!');
console.log('');
console.log('Available commands:');
console.log('  • refreshNetworkStations() - Manual refresh of network stations');
console.log('  • checkNetworkStatus() - Check current network status');
console.log('  • sendHeartbeat() - Send manual heartbeat (for clients)');
console.log('  • addTestQsoAndMonitor() - Add test QSO and monitor sync');
console.log('');
console.log('🎯 Quick test sequence:');
console.log('  1. Run on host: checkNetworkStatus()');
console.log('  2. Run on client: addTestQsoAndMonitor()');
console.log('  3. Run on host: refreshNetworkStations()');
