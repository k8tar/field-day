/**
 * Test QSO synchronization between storage systems
 * Verifies that QSOs are properly synced between:
 * 1. Shared file storage (shared-qsos.json)
 * 2. Port-specific storage (fieldday-data/port_8080/qso-data.json)
 * 3. Network sync between stations
 */

console.log('🔄 Testing QSO Synchronization...');

async function testQsoSync() {
  const baseUrl = 'https://localhost:8080';
  
  console.log('\n📊 Step 1: Check current QSO counts...');
  
  // Get station info (reads from port-specific files)
  try {
    const stationResponse = await fetch(`${baseUrl}/api/station-info`);
    if (stationResponse.ok) {
      const stationInfo = await stationResponse.json();
      console.log(`📈 Station Info QSO count: ${stationInfo.qsoCount}`);
    } else {
      console.log('❌ Failed to get station info');
    }
  } catch (error) {
    console.log('❌ Station info error:', error.message);
  }
  
  // Get QSOs from sync endpoint (reads from shared file)
  try {
    const qsoResponse = await fetch(`${baseUrl}/api/qsos`);
    if (qsoResponse.ok) {
      const qsoData = await qsoResponse.json();
      console.log(`📈 Sync API QSO count: ${qsoData.qsos.length}`);
      
      if (qsoData.qsos.length > 0) {
        console.log('📋 Sample QSO:', qsoData.qsos[0]);
      }
    } else {
      console.log('❌ Failed to get QSOs from sync API');
    }
  } catch (error) {
    console.log('❌ QSO sync API error:', error.message);
  }
  
  console.log('\n🔄 Step 2: Testing bulk upload (should sync both systems)...');
  
  // Create a test QSO
  const testQso = {
    id: Date.now(),
    call: 'W1TEST',
    class: '1A',
    section: 'OH',
    datetime: new Date().toISOString(),
    band: '20m',
    mode: 'PH',
    operator: 'TEST',
    timestamp: Date.now()
  };
  
  try {
    const uploadResponse = await fetch(`${baseUrl}/api/qsos/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qsos: [testQso] })
    });
    
    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      console.log(`✅ Bulk upload successful: ${result.added} added, ${result.total} total`);
    } else {
      console.log('❌ Bulk upload failed:', uploadResponse.status);
    }
  } catch (error) {
    console.log('❌ Bulk upload error:', error.message);
  }
  
  console.log('\n📊 Step 3: Verify sync worked (both storage systems should match)...');
  
  // Wait a moment for sync
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check station info again
  try {
    const stationResponse2 = await fetch(`${baseUrl}/api/station-info`);
    if (stationResponse2.ok) {
      const stationInfo2 = await stationResponse2.json();
      console.log(`📈 Station Info QSO count (after): ${stationInfo2.qsoCount}`);
    }
  } catch (error) {
    console.log('❌ Station info check error:', error.message);
  }
  
  // Check sync API again
  try {
    const qsoResponse2 = await fetch(`${baseUrl}/api/qsos`);
    if (qsoResponse2.ok) {
      const qsoData2 = await qsoResponse2.json();
      console.log(`📈 Sync API QSO count (after): ${qsoData2.qsos.length}`);
    }
  } catch (error) {
    console.log('❌ QSO sync API check error:', error.message);
  }
  
  console.log('\n🔄 Step 4: Testing network QSO sync...');
  
  // Test adding a QSO via network sync endpoint
  const networkTestQso = {
    id: Date.now() + 1,
    call: 'W2NET',
    class: '2B',
    section: 'MI',
    datetime: new Date().toISOString(),
    band: '40m',
    mode: 'CW',
    operator: 'NET',
    timestamp: Date.now()
  };
  
  try {
    const networkResponse = await fetch(`${baseUrl}/api/qsos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        qso: networkTestQso,
        timestamp: Date.now(),
        stationId: 'test-station'
      })
    });
    
    if (networkResponse.ok) {
      console.log('✅ Network QSO sync successful');
    } else {
      console.log('❌ Network QSO sync failed:', networkResponse.status);
    }
  } catch (error) {
    console.log('❌ Network QSO sync error:', error.message);
  }
  
  console.log('\n📊 Step 5: Final verification...');
  
  // Wait a moment for sync
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Final check of both systems
  try {
    const [stationResponse3, qsoResponse3] = await Promise.all([
      fetch(`${baseUrl}/api/station-info`),
      fetch(`${baseUrl}/api/qsos`)
    ]);
    
    if (stationResponse3.ok && qsoResponse3.ok) {
      const stationInfo3 = await stationResponse3.json();
      const qsoData3 = await qsoResponse3.json();
      
      console.log(`📈 Final Station Info QSO count: ${stationInfo3.qsoCount}`);
      console.log(`📈 Final Sync API QSO count: ${qsoData3.qsos.length}`);
      
      if (stationInfo3.qsoCount === qsoData3.qsos.length) {
        console.log('✅ SUCCESS: Both storage systems are synchronized!');
      } else {
        console.log('❌ FAILURE: Storage systems are NOT synchronized!');
        console.log('   This indicates the QSO sync fix needs more work.');
      }
    }
  } catch (error) {
    console.log('❌ Final verification error:', error.message);
  }
}

// For browser console
if (typeof window !== 'undefined') {
  window.testQsoSync = testQsoSync;
  console.log('\n✅ QSO sync test loaded!');
  console.log('📋 Run: testQsoSync()');
  console.log('📋 This will test if QSO synchronization is working between storage systems.');
} else {
  console.log('\n📋 Copy this script to your browser console at https://localhost:8080');
  console.log('📋 Then run: testQsoSync()');
}
