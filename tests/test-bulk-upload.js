// Test script to manually test the bulk upload functionality
// Run this in the browser console of the instance with 24 QSOs

async function testBulkUpload() {
  console.log('🧪 Testing bulk QSO upload...');
  
  // Test with sample data first
  const testQsos = [
    {
      id: 999,
      call: 'TEST123',
      class: '1A',
      section: 'TEST',
      datetime: new Date().toISOString(),
      band: '20M',
      mode: 'PH',
      operator: 'TEST',
      timestamp: Date.now()
    }
  ];
  
  try {
    const response = await fetch('/api/qsos/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        qsos: testQsos
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Bulk upload test successful:', result);
    } else {
      console.error('❌ Bulk upload test failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Bulk upload test error:', error);
  }
}

// Test uploading actual QSOs from localStorage
async function uploadActualQsos() {
  console.log('📤 Uploading actual QSOs from localStorage...');
  
  const qsosJson = localStorage.getItem('qsos');
  if (!qsosJson) {
    console.log('❌ No QSOs found in localStorage');
    return;
  }
  
  const qsos = JSON.parse(qsosJson);
  console.log(`Found ${qsos.length} QSOs in localStorage`);
  
  if (qsos.length === 0) {
    console.log('No QSOs to upload');
    return;
  }
  
  try {
    const response = await fetch('/api/qsos/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        qsos: qsos
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Successfully uploaded ${result.added} QSOs (${result.total} total on server)`);
    } else {
      console.error('❌ Failed to upload QSOs:', response.status);
    }
  } catch (error) {
    console.error('❌ Error uploading QSOs:', error);
  }
}

// Run the tests
testBulkUpload();
uploadActualQsos();

// Expose functions for manual testing
window.qsoUploadTest = {
  testBulkUpload,
  uploadActualQsos
};
