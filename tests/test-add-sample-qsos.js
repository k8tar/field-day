// Test script to add sample QSOs via the server API for testing
console.log('🧪 Adding sample QSOs via server API...');

const sampleQsos = [
  {
    id: Date.now() + 1,
    call: 'W8ABC',
    class: '2A',
    section: 'OH',
    datetime: new Date().toISOString(),
    band: '20m',
    mode: 'PH',
    operator: 'K8TAR',
    stationDesignator: 'PHONE 1',
    timestamp: Date.now() + 1
  },
  {
    id: Date.now() + 2,
    call: 'K9XYZ',
    class: '1B',
    section: 'MI',
    datetime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes later
    band: '40m',
    mode: 'CW',
    operator: 'K8TAR',
    stationDesignator: 'PHONE 1',
    timestamp: Date.now() + 2
  },
  {
    id: Date.now() + 3,
    call: 'N0DEF',
    class: '3A',
    section: 'WI',
    datetime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes later
    band: '15m',
    mode: 'PH',
    operator: 'K8TAR',
    stationDesignator: 'PHONE 1',
    timestamp: Date.now() + 3
  },
  {
    id: Date.now() + 4,
    call: 'VE3GHI',
    class: '2A',
    section: 'DX',
    datetime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes later
    band: '80m',
    mode: 'CW',
    operator: 'K8TAR',
    stationDesignator: 'PHONE 1',
    timestamp: Date.now() + 4
  },
  {
    id: Date.now() + 5,
    call: 'JA1JKL',
    class: '1A',
    section: 'DX',
    datetime: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 minutes later
    band: '10m',
    mode: 'PH',
    operator: 'K8TAR',
    stationDesignator: 'PHONE 1',
    timestamp: Date.now() + 5
  }
];

// Add QSOs one by one via the server API
async function addSampleQsos() {
  console.log(`📤 Adding ${sampleQsos.length} sample QSOs to server...`);
  
  for (let i = 0; i < sampleQsos.length; i++) {
    const qso = sampleQsos[i];
    
    try {
      const response = await fetch('/api/qsos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'add',
          qso: qso,
          stationId: 'test-station',
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Added QSO ${i + 1}/${sampleQsos.length}: ${qso.call}`);
      } else {
        console.error(`❌ Failed to add QSO ${qso.call}: ${response.status}`);
      }
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error adding QSO ${qso.call}:`, error);
    }
  }
  
  console.log('🏁 Finished adding sample QSOs');
  console.log('🔄 QSOs should now appear in the Recent Contacts list');
  console.log('📊 Check the station info to see updated QSO count and score');
}

// Run the function
addSampleQsos();
