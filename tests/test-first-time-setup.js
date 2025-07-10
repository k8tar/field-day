// Helper script to clear all localStorage data for testing first-time setup
// Run this in the browser console to test the first-time setup flow

function clearAllAppData() {
  const keys = [
    'stationCallsign',
    'stationDesignator', 
    'stationClass',
    'stationSection',
    'operators',
    'qsos',
    'darkMode',
    'qso_settings_band',
    'qso_settings_operator'
  ];
  
  keys.forEach(key => localStorage.removeItem(key));
  
  console.log('All app data cleared! Refresh the page to see first-time setup.');
}

// Call this function in browser console to test
// clearAllAppData();
