// Direct test of the bulk upload API endpoint with sample data
async function testBulkUpload() {
  console.log('Testing bulk upload API...');
  
  const sampleQsos = [
    {
      id: 1,
      call: 'W8ABC',
      class: '2A',
      section: 'OH',
      datetime: '2024-07-10 14:30:00',
      band: '20m',
      mode: 'PH',
      operator: 'K8TAR',
      stationDesignator: '1A',
      timestamp: new Date('2024-07-10 14:30:00').getTime()
    },
    {
      id: 2,
      call: 'K9XYZ',
      class: '1B',
      section: 'MI',
      datetime: '2024-07-10 14:35:00',
      band: '40m',
      mode: 'CW',
      operator: 'K8TAR',
      stationDesignator: '1A',
      timestamp: new Date('2024-07-10 14:35:00').getTime()
    },
    {
      id: 3,
      call: 'N0DEF',
      class: '3A',
      section: 'WI',
      datetime: '2024-07-10 14:40:00',
      band: '15m',
      mode: 'PH',
      operator: 'K8TAR',
      stationDesignator: '1A',
      timestamp: new Date('2024-07-10 14:40:00').getTime()
    }
  ];

  try {
    const response = await fetch('http://localhost:8080/api/qsos/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        qsos: sampleQsos
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Bulk upload successful:', result);
      return result;
    } else {
      console.error('❌ Bulk upload failed:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('❌ Bulk upload error:', error);
    return null;
  }
}

testBulkUpload();
