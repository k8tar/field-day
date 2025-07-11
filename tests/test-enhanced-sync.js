/**
 * Enhanced Network Sync Test Script
 * 
 * This script helps test and debug contact syncing between instances.
 * Run this in the browser console to test network synchronization.
 */

(function() {
  console.log('🧪 Enhanced Network Sync Test Script Loaded');
  console.log('==========================================');
  
  // Global test functions
  window.syncTest = {
    
    // Test station discovery
    async testDiscovery() {
      console.log('\n🔍 Testing station discovery...');
      
      if (!window.networkService) {
        console.error('❌ Network service not available');
        return;
      }
      
      try {
        const stations = await window.networkService.discoverStations();
        console.log(`✅ Found ${stations.length} stations:`);
        stations.forEach(station => {
          console.log(`  📡 ${station.callsign}-${station.designator} at ${station.ip}:${station.port} (${station.qsoCount} QSOs)`);
        });
        return stations;
      } catch (error) {
        console.error('❌ Discovery failed:', error);
        return [];
      }
    },

    // Test API endpoints
    async testAPI() {
      console.log('\n📡 Testing API endpoints...');
      
      try {
        // Test station info
        const stationResponse = await fetch('/api/station-info');
        const stationInfo = await stationResponse.json();
        console.log('✅ Station info:', stationInfo);
        
        // Test QSO endpoint
        const qsoResponse = await fetch('/api/qsos');
        const qsoData = await qsoResponse.json();
        console.log(`✅ QSO endpoint: ${qsoData.qsos.length} QSOs available`);
        
        return { stationInfo, qsoCount: qsoData.qsos.length };
      } catch (error) {
        console.error('❌ API test failed:', error);
        return null;
      }
    },

    // Add a test QSO
    addTestQSO(callsign = `TEST${Date.now()}`) {
      console.log(`\n📝 Adding test QSO: ${callsign}`);
      
      try {
        // Get the QSO store
        const qsoStore = this.getQSOStore();
        if (!qsoStore || !qsoStore.logQso) {
          console.error('❌ QSO store not available');
          return false;
        }
        
        const testQso = {
          call: callsign,
          class: '1A',
          section: 'TEST',
          datetime: new Date().toISOString(),
          band: '20M',
          mode: 'PH'
        };
        
        qsoStore.logQso(testQso);
        console.log('✅ Test QSO added:', testQso);
        return true;
      } catch (error) {
        console.error('❌ Failed to add test QSO:', error);
        return false;
      }
    },

    // Get QSO store reference
    getQSOStore() {
      // Try multiple ways to access the QSO store
      if (window.qsoStore) return window.qsoStore;
      if (window.$qsoStore) return window.$qsoStore;
      
      // Try Vue devtools
      if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
        const apps = window.__VUE_DEVTOOLS_GLOBAL_HOOK__.apps;
        if (apps && apps.length > 0) {
          const app = apps[0];
          if (app && app.config && app.config.globalProperties) {
            return app.config.globalProperties.$qsoStore;
          }
        }
      }
      
      console.log('⚠️ QSO store not found. Available globals:', Object.keys(window).filter(k => k.includes('qso') || k.includes('store')));
      return null;
    },

    // Test sync between two instances
    async testCrossInstanceSync(targetPort = 8081) {
      console.log(`\n🔄 Testing sync with instance on port ${targetPort}...`);
      
      try {
        // Check if target instance is available
        const targetResponse = await fetch(`http://127.0.0.1:${targetPort}/api/station-info`);
        if (!targetResponse.ok) {
          console.error(`❌ Target instance not available on port ${targetPort}`);
          return false;
        }
        
        const targetInfo = await targetResponse.json();
        console.log(`✅ Target instance found: ${targetInfo.callsign}-${targetInfo.designator}`);
        
        // Get QSO counts from both instances
        const localQsos = await fetch('/api/qsos').then(r => r.json());
        const targetQsos = await fetch(`http://127.0.0.1:${targetPort}/api/qsos`).then(r => r.json());
        
        console.log(`📊 Local QSOs: ${localQsos.qsos.length}, Target QSOs: ${targetQsos.qsos.length}`);
        
        // Add a test QSO and see if it syncs
        const testCall = `SYNC${Date.now()}`;
        this.addTestQSO(testCall);
        
        // Wait a bit and check if it appeared on target
        setTimeout(async () => {
          try {
            const updatedTargetQsos = await fetch(`http://127.0.0.1:${targetPort}/api/qsos`).then(r => r.json());
            const foundSync = updatedTargetQsos.qsos.find(qso => qso.call === testCall);
            
            if (foundSync) {
              console.log('✅ QSO sync successful! Found on target instance.');
            } else {
              console.log('❌ QSO sync failed. Not found on target instance.');
            }
          } catch (error) {
            console.error('❌ Failed to check sync result:', error);
          }
        }, 5000);
        
        return true;
      } catch (error) {
        console.error('❌ Cross-instance sync test failed:', error);
        return false;
      }
    },

    // Manual sync trigger
    async manualSync() {
      console.log('\n🔄 Triggering manual sync...');
      
      if (!window.networkService) {
        console.error('❌ Network service not available');
        return;
      }
      
      try {
        // Discover stations and try to sync
        const stations = await this.testDiscovery();
        if (stations.length === 0) {
          console.log('⚠️ No stations found to sync with');
          return;
        }
        
        // Try to get QSOs from each discovered station
        for (const station of stations) {
          try {
            console.log(`🔄 Syncing with ${station.callsign}-${station.designator}...`);
            const response = await fetch(`http://${station.ip}:${station.port}/api/qsos?since=0`);
            const data = await response.json();
            console.log(`📥 Retrieved ${data.qsos.length} QSOs from ${station.callsign}-${station.designator}`);
          } catch (error) {
            console.log(`❌ Failed to sync with ${station.callsign}-${station.designator}:`, error.message);
          }
        }
      } catch (error) {
        console.error('❌ Manual sync failed:', error);
      }
    },

    // Show current network status
    showStatus() {
      console.log('\n📊 Current Network Status');
      console.log('========================');
      
      if (window.networkService) {
        const status = window.networkService.getConnectionStatus();
        console.log('Network Service Status:', status);
        
        const settings = window.networkService.getNetworkSettings();
        console.log('Network Settings:', settings);
      } else {
        console.log('❌ Network service not available');
      }
      
      // Show QSO count
      const qsoStore = this.getQSOStore();
      if (qsoStore && qsoStore.qsos) {
        console.log(`📊 Local QSOs: ${qsoStore.qsos.value ? qsoStore.qsos.value.length : 'Unknown'}`);
      }
      
      // Show current port
      console.log(`🌐 Current port: ${window.location.port || '80'}`);
    }
  };
  
  // Display available commands
  console.log('\n📋 Available Commands:');
  console.log('======================');
  console.log('syncTest.testDiscovery()        - Test station discovery');
  console.log('syncTest.testAPI()              - Test API endpoints');
  console.log('syncTest.addTestQSO("W1AW")     - Add a test QSO');
  console.log('syncTest.testCrossInstanceSync(8081) - Test sync with another instance');
  console.log('syncTest.manualSync()           - Trigger manual sync');
  console.log('syncTest.showStatus()           - Show current status');
  console.log('');
  console.log('🚀 Quick start: syncTest.showStatus()');
  
})();
