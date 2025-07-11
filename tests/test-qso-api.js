#!/usr/bin/env node

/**
 * Simple QSO API test - directly add a QSO and check if it syncs
 */

async function testQsoSync() {
  console.log('🧪 Testing QSO sync via API...');
  
  try {
    // First, get current QSOs
    console.log('📋 Getting current QSOs...');
    const getResponse = await fetch('https://localhost:8080/api/qsos', {
      rejectUnauthorized: false // Accept self-signed certificates
    });
    const currentData = await getResponse.json();
    console.log(`Current QSOs: ${currentData.qsos.length}`);
    
    // Add a test QSO
    console.log('➕ Adding test QSO...');
    const testQso = {
      id: Date.now(),
      call: 'W3TEST',
      class: '2A',
      section: 'OH',
      datetime: new Date().toISOString(),
      band: '40m',
      mode: 'PH',
      operator: 'TEST',
      stationDesignator: 'PHONE 3',
      timestamp: Date.now()
    };
    
    const addResponse = await fetch('https://localhost:8080/api/qsos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'add',
        qso: testQso
      }),
      rejectUnauthorized: false // Accept self-signed certificates
    });
    
    const addResult = await addResponse.json();
    console.log('Add result:', addResult);
    
    // Check QSOs again
    console.log('📋 Getting updated QSOs...');
    const updatedResponse = await fetch('https://localhost:8080/api/qsos', {
      rejectUnauthorized: false // Accept self-signed certificates
    });
    const updatedData = await updatedResponse.json();
    console.log(`Updated QSOs: ${updatedData.qsos.length}`);
    
    // List all QSOs
    console.log('📜 All QSOs:');
    updatedData.qsos.forEach((qso, index) => {
      console.log(`  ${index + 1}: ${qso.call} - ${qso.stationDesignator || 'Unknown'} (ID: ${qso.id})`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testQsoSync();
