// Quick test: Check station-info endpoints for different ports
// Run this in browser console to test the fix

async function testStationInfoEndpoints() {
  console.log('🧪 Testing station-info endpoints...\n');
  
  const ports = [8080, 8081];
  
  for (const port of ports) {
    try {
      console.log(`📡 Testing port ${port}...`);
      const response = await fetch(`http://localhost:${port}/api/station-info`);
      
      if (response.ok) {
        const stationInfo = await response.json();
        console.log(`✅ Port ${port}:`, stationInfo);
        console.log(`  📊 ${stationInfo.callsign}-${stationInfo.designator}: ${stationInfo.qsoCount} QSOs, ${stationInfo.score} pts\n`);
      } else {
        console.log(`❌ Port ${port}: HTTP ${response.status}\n`);
      }
    } catch (error) {
      console.log(`❌ Port ${port}: ${error.message}\n`);
    }
  }
}

// Test network status
async function testNetworkStatus() {
  console.log('🌐 Testing network status...\n');
  
  try {
    const response = await fetch('/api/network/stations');
    if (response.ok) {
      const networkData = await response.json();
      console.log('Network Data:', networkData);
      
      if (networkData.hostInfo) {
        console.log(`🏠 Host: ${networkData.hostInfo.callsign}-${networkData.hostInfo.designator} (${networkData.hostInfo.qsoCount} QSOs)`);
      }
      
      networkData.connectedStations.forEach((station, index) => {
        console.log(`📡 Station ${index + 1}: ${station.callsign}-${station.designator} - ${station.qsoCount} QSOs, ${station.score} pts`);
      });
    }
  } catch (error) {
    console.error('❌ Network status test failed:', error);
  }
}

console.log('🔧 Station Info Test Commands');
console.log('  • testStationInfoEndpoints() - Test station-info endpoints');
console.log('  • testNetworkStatus() - Test network status');

// Make functions available globally
window.testStationInfoEndpoints = testStationInfoEndpoints;
window.testNetworkStatus = testNetworkStatus;
