/**
 * Network Service Test Script
 * 
 * Run this in the browser console to test if NetworkService is working properly
 */

(function() {
  console.log('🧪 Testing NetworkService...');
  
  // Check if networkService is available
  if (typeof window.networkService !== 'undefined') {
    const networkService = window.networkService;
    console.log('✅ NetworkService found in window');
    
    // Test methods
    try {
      const connectedStations = networkService.getConnectedStations();
      console.log('✅ getConnectedStations() works:', connectedStations);
      
      const connectionStatus = networkService.getConnectionStatus();
      console.log('✅ getConnectionStatus() works:', connectionStatus);
      
      const networkSettings = networkService.getNetworkSettings();
      console.log('✅ getNetworkSettings() works:', networkSettings);
      
      console.log('🎉 All NetworkService methods working!');
    } catch (error) {
      console.error('❌ NetworkService method error:', error);
    }
  } else {
    console.error('❌ NetworkService not found in window');
    
    // Try to access it via Vue app
    if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('🔍 Checking Vue devtools...');
      const apps = window.__VUE_DEVTOOLS_GLOBAL_HOOK__.apps;
      if (apps && apps.length > 0) {
        console.log('📱 Vue apps found:', apps.length);
      }
    }
    
    // Check what's available on window
    const relevantGlobals = Object.keys(window).filter(key => 
      key.includes('network') || key.includes('service') || key.includes('Network')
    );
    console.log('🔍 Relevant globals:', relevantGlobals);
  }
})();

// Expose networkService to window for easier debugging
if (typeof window !== 'undefined') {
  // Try to import and expose the service
  import('@/services/networkService').then(({ networkService }) => {
    window.networkService = networkService;
    console.log('✅ NetworkService exposed to window.networkService');
  }).catch(error => {
    console.error('❌ Failed to import NetworkService:', error);
  });
}
