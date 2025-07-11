// Test script to add a QSO as if it came from PHONE 3 (client)
// Run this in the browser console to simulate PHONE 3 logging a QSO

console.log('🧪 Simulating QSO from PHONE 3...');

const testQso = {
  id: Date.now(),
  call: 'WB8ABC',
  class: '1A', 
  section: 'OH',
  datetime: new Date().toISOString(),
  band: '20m',
  mode: 'CW',
  operator: 'PHONE3_OP',
  stationDesignator: 'PHONE 3',
  timestamp: Date.now()
};

const qsoUpdate = {
  action: 'add',
  qso: testQso,
  stationId: 'phone3-client-station',
  timestamp: Date.now()
};

console.log('📤 Sending QSO to server:', testQso.call);

fetch('/api/qsos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(qsoUpdate)
})
.then(response => response.json())
.then(result => {
  console.log('✅ QSO sent result:', result);
  console.log('🔄 Triggering manual refresh to see if QSO appears...');
  
  // Wait a moment then check the QSO store
  setTimeout(() => {
    // Check if QSO refresh function exists and call it
    if (window.refreshQsosFromServer) {
      window.refreshQsosFromServer();
    } else {
      console.log('⚠️ refreshQsosFromServer not available on window');
    }
  }, 1000);
})
.catch(error => {
  console.error('❌ Failed to send QSO:', error);
});
