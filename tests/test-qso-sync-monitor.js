// Test script: Monitor network QSO count synchronization
// Run this in browser console to monitor real-time sync

async function monitorQsoSync() {
  console.log('🔍 Monitoring QSO count synchronization...\n');
  
  let iteration = 0;
  const maxIterations = 10;
  
  const monitor = setInterval(async () => {
    iteration++;
    console.log(`\n--- Iteration ${iteration} ---`);
    
    try {
      // Check network status
      const networkResponse = await fetch('/api/network/stations');
      if (networkResponse.ok) {
        const networkData = await networkResponse.json();
        
        console.log(`Host: ${networkData.isHost ? 'YES' : 'NO'}`);
        console.log(`Connected stations: ${networkData.connectedStations.length}`);
        
        if (networkData.hostInfo) {
          console.log(`Host Info: ${networkData.hostInfo.callsign}-${networkData.hostInfo.designator} (${networkData.hostInfo.qsoCount} QSOs)`);
        }
        
        networkData.connectedStations.forEach((station, index) => {
          const onlineStatus = station.online ? '🟢' : '🔴';
          console.log(`  Station ${index + 1}: ${onlineStatus} ${station.callsign}-${station.designator} - ${station.qsoCount} QSOs, ${station.score} pts`);
          console.log(`    Last seen: ${new Date(station.lastSeen).toLocaleTimeString()}`);
        });
      }
      
      // Get local QSO count for comparison
      const qsoData = await fileStorage.getQsoData();
      console.log(`Local QSO count: ${qsoData.length}`);
      
    } catch (error) {
      console.error('Monitor error:', error);
    }
    
    if (iteration >= maxIterations) {
      clearInterval(monitor);
      console.log('\n✅ Monitoring complete');
    }
  }, 3000); // Every 3 seconds
  
  console.log('📊 Monitoring started (will run for 30 seconds)...');
  console.log('Add QSOs in the UI to see sync in real-time!');
}

// Test adding a QSO and watching sync
async function testAddQsoAndSync() {
  console.log('🧪 Testing QSO addition and sync...\n');
  
  try {
    // Get current QSO count
    const currentQsos = await fileStorage.getQsoData();
    console.log(`Current QSOs: ${currentQsos.length}`);
    
    // Add a test QSO
    const testQso = {
      id: Date.now(),
      callsign: 'W1TEST',
      class: '1A',
      section: 'CT',
      band: '40M',
      mode: 'PH',
      operator: 'TEST',
      datetime: new Date().toISOString(),
      stationDesignator: 'PHONE 1',
      timestamp: Date.now()
    };
    
    console.log('Adding test QSO:', testQso);
    const newQsos = [...currentQsos, testQso];
    await fileStorage.saveQsoData(newQsos);
    
    console.log('✅ QSO added to local storage');
    
    // Monitor for next 15 seconds to see sync
    let checks = 0;
    const syncMonitor = setInterval(async () => {
      checks++;
      console.log(`\n--- Sync Check ${checks} ---`);
      
      try {
        const networkResponse = await fetch('/api/network/stations');
        if (networkResponse.ok) {
          const networkData = await networkResponse.json();
          
          console.log('Network stations after QSO addition:');
          if (networkData.hostInfo) {
            console.log(`  Host: ${networkData.hostInfo.callsign}-${networkData.hostInfo.designator} (${networkData.hostInfo.qsoCount} QSOs)`);
          }
          
          networkData.connectedStations.forEach(station => {
            console.log(`  Client: ${station.callsign}-${station.designator} - ${station.qsoCount} QSOs, ${station.score} pts`);
          });
        }
      } catch (error) {
        console.error('Sync check error:', error);
      }
      
      if (checks >= 5) {
        clearInterval(syncMonitor);
        console.log('\n✅ Sync monitoring complete');
      }
    }, 3000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Available commands
console.log('🔧 QSO Sync Monitor loaded!');
console.log('');
console.log('Available commands:');
console.log('  • monitorQsoSync() - Monitor QSO counts for 30 seconds');
console.log('  • testAddQsoAndSync() - Add test QSO and monitor sync');
console.log('');
console.log('💡 Tips:');
console.log('  • Run monitorQsoSync() first to see current state');
console.log('  • Add QSOs in the UI while monitoring to see real-time sync');
console.log('  • Check both host and client browser consoles');

// Export functions for console use
window.monitorQsoSync = monitorQsoSync;
window.testAddQsoAndSync = testAddQsoAndSync;
