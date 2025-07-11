// Test script: Verify QSO count synchronization between host and client
// This tests the heartbeat mechanism and real-time QSO count updates

const baseUrl = 'http://localhost:8080';

// Test QSO count synchronization
async function testQsoCountSync() {
  console.log('🧪 Testing QSO count synchronization...\n');

  try {
    // 1. Check current network status
    console.log('📊 Checking current network status...');
    const networkResponse = await fetch(`${baseUrl}/api/network/stations`);
    if (networkResponse.ok) {
      const networkData = await networkResponse.json();
      console.log('Current network stations:', networkData);
      
      if (networkData.connectedStations.length === 0) {
        console.log('❌ No stations connected to network');
        return;
      }
    }

    // 2. Get current QSO count
    console.log('\n📊 Getting current QSO count...');
    const qsoResponse = await fetch(`${baseUrl}/api/qso-data`);
    if (qsoResponse.ok) {
      const qsoData = await qsoResponse.json();
      const currentQsoCount = qsoData.length;
      console.log(`Current QSO count: ${currentQsoCount}`);

      // 3. Add a test QSO
      console.log('\n➕ Adding test QSO...');
      const testQso = {
        id: `test-qso-${Date.now()}`,
        timestamp: new Date().toISOString(),
        callsign: 'W1TEST',
        sentRst: '59',
        receivedRst: '59',
        band: '40m',
        mode: 'PHONE',
        section: 'CT',
        class: '1A',
        operator: 'OP1',
        notes: 'Test QSO for sync verification'
      };

      const addResponse = await fetch(`${baseUrl}/api/qso-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testQso)
      });

      if (addResponse.ok) {
        console.log('✅ Test QSO added successfully');
        
        // 4. Wait a moment for the QSO to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 5. Check updated QSO count
        console.log('\n📊 Checking updated QSO count...');
        const updatedQsoResponse = await fetch(`${baseUrl}/api/qso-data`);
        if (updatedQsoResponse.ok) {
          const updatedQsoData = await updatedQsoResponse.json();
          const newQsoCount = updatedQsoData.length;
          console.log(`New QSO count: ${newQsoCount}`);
          console.log(`Count increase: ${newQsoCount - currentQsoCount}`);
        }

        // 6. Wait for heartbeat cycle (11 seconds to ensure one heartbeat)
        console.log('\n💓 Waiting for heartbeat cycle (11 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 11000));

        // 7. Check network status again to see if QSO count synced
        console.log('\n📊 Checking network status after heartbeat...');
        const updatedNetworkResponse = await fetch(`${baseUrl}/api/network/stations`);
        if (updatedNetworkResponse.ok) {
          const updatedNetworkData = await updatedNetworkResponse.json();
          console.log('Updated network stations:', updatedNetworkData);
          
          // Check if any station shows the updated QSO count
          const stationsWithUpdatedCount = updatedNetworkData.connectedStations.filter(
            station => station.qsoCount >= newQsoCount
          );
          
          if (stationsWithUpdatedCount.length > 0) {
            console.log('✅ QSO count synchronization working!');
            stationsWithUpdatedCount.forEach(station => {
              console.log(`  📡 ${station.callsign}-${station.designator}: ${station.qsoCount} QSOs`);
            });
          } else {
            console.log('❌ QSO count not synchronized properly');
            console.log('Expected at least one station to have QSO count >=', newQsoCount);
          }
        }

      } else {
        console.log('❌ Failed to add test QSO');
      }

    } else {
      console.log('❌ Failed to get QSO data');
    }

    // 8. Test manual heartbeat (if we're running as a client)
    console.log('\n💓 Testing manual heartbeat...');
    try {
      const stationInfoResponse = await fetch(`${baseUrl}/api/station-info`);
      if (stationInfoResponse.ok) {
        const stationInfo = await stationInfoResponse.json();
        const qsoResponse = await fetch(`${baseUrl}/api/qso-data`);
        const qsoData = await qsoResponse.json();
        
        const heartbeatData = {
          stationId: `${stationInfo.callsign}-${stationInfo.designator}`,
          qsoCount: qsoData.length,
          score: qsoData.reduce((total, qso) => {
            return total + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1);
          }, 0),
          timestamp: Date.now()
        };

        console.log('Sending heartbeat:', heartbeatData);

        const heartbeatResponse = await fetch(`${baseUrl}/api/network/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(heartbeatData)
        });

        if (heartbeatResponse.ok) {
          const heartbeatResult = await heartbeatResponse.json();
          console.log('✅ Manual heartbeat successful:', heartbeatResult);
        } else {
          console.log('❌ Manual heartbeat failed');
        }
      }
    } catch (error) {
      console.log('Manual heartbeat error:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testQsoCountSync();
