// Test script for file-based QSO storage
// Run this in browser console to test the new file storage system

async function testFileStorage() {
  console.log('🧪 Testing file-based QSO storage...');
  
  // First, check current QSO count
  const response1 = await fetch('/api/qsos');
  const data1 = await response1.json();
  console.log(`📊 Current QSOs on server: ${data1.qsos.length}`);
  
  // Test adding a QSO
  const testQso = {
    id: Date.now(),
    call: 'FILETEST',
    class: '1A',
    section: 'OH',
    datetime: new Date().toISOString(),
    band: '40M',
    mode: 'CW',
    operator: 'TEST',
    timestamp: Date.now()
  };
  
  console.log('📤 Adding test QSO via bulk upload...');
  const uploadResponse = await fetch('/api/qsos/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qsos: [testQso] })
  });
  
  if (uploadResponse.ok) {
    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload result:', uploadResult);
  }
  
  // Check if QSO was added
  const response2 = await fetch('/api/qsos');
  const data2 = await response2.json();
  console.log(`📊 QSOs after upload: ${data2.qsos.length}`);
  
  // Find our test QSO
  const foundQso = data2.qsos.find(q => q.call === 'FILETEST');
  if (foundQso) {
    console.log('✅ Test QSO found in server storage:', foundQso);
  } else {
    console.log('❌ Test QSO not found in server storage');
  }
}

async function uploadLocalQsos() {
  console.log('📤 Uploading all local QSOs to file storage...');
  
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
  
  const response = await fetch('/api/qsos/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qsos: qsos })
  });
  
  if (response.ok) {
    const result = await response.json();
    console.log(`✅ Successfully uploaded to file: ${result.added} QSOs added (${result.total} total)`);
  } else {
    console.error('❌ Upload failed:', response.status);
  }
}

async function clearAllQsos() {
  console.log('🗑️  Clearing all QSOs from file storage...');
  
  const response = await fetch('/api/qsos/clear', {
    method: 'DELETE'
  });
  
  if (response.ok) {
    const result = await response.json();
    console.log('✅ All QSOs cleared:', result);
  } else {
    console.error('❌ Clear failed:', response.status);
  }
}

// Run initial test
testFileStorage();

// Expose functions for manual testing
window.fileStorageTest = {
  testFileStorage,
  uploadLocalQsos,
  clearAllQsos
};

console.log('🎯 File storage test functions:');
console.log('  • fileStorageTest.uploadLocalQsos() - Upload all local QSOs to file');
console.log('  • fileStorageTest.clearAllQsos() - Clear all QSOs from file');
console.log('  • fileStorageTest.testFileStorage() - Run full test');
