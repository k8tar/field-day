/**
 * Enhanced Network Test Script
 * 
 * This script tests the improved networking system including:
 * - HTTP API endpoints
 * - WebSocket real-time sync
 * - Station discovery
 * - QSO synchronization
 * - Error recovery
 */

(function() {
  console.log('🧪 Starting enhanced network test suite...');
  
  // Test configuration
  const TEST_CONFIG = {
    testStations: [
      { callsign: 'W1TEST', designator: '1A', ip: '127.0.0.1', port: 8080 },
      { callsign: 'W2TEST', designator: '2A', ip: '127.0.0.1', port: 4173 },
      { callsign: 'W3TEST', designator: '3A', ip: '127.0.0.1', port: 5173 }
    ],
    testQsos: [
      { call: 'K8TAR', class: '1A', section: 'OH', band: '20M', mode: 'PH' },
      { call: 'W1AW', class: '2A', section: 'CT', band: '40M', mode: 'CW' },
      { call: 'VE3TEST', class: '1B', section: 'ON', band: '15M', mode: 'DIG' }
    ]
  };

  // Test results tracking
  const testResults = {
    apiEndpoints: { passed: 0, failed: 0, total: 0 },
    discovery: { passed: 0, failed: 0, total: 0 },
    sync: { passed: 0, failed: 0, total: 0 },
    webSocket: { passed: 0, failed: 0, total: 0 },
    errorRecovery: { passed: 0, failed: 0, total: 0 }
  };

  // Helper functions
  function logTest(category, testName, passed, details = '') {
    const result = passed ? '✅' : '❌';
    console.log(`${result} [${category}] ${testName}${details ? ': ' + details : ''}`);
    
    if (testResults[category]) {
      testResults[category].total++;
      if (passed) {
        testResults[category].passed++;
      } else {
        testResults[category].failed++;
      }
    }
  }

  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test 1: API Endpoints
  async function testApiEndpoints() {
    console.log('\n📡 Testing API endpoints...');
    
    // Test station info endpoint
    try {
      const response = await fetch('/api/station-info');
      const data = await response.json();
      
      logTest('apiEndpoints', 'Station info endpoint', 
        response.ok && data.callsign && data.designator,
        `${data.callsign}-${data.designator}`);
    } catch (error) {
      logTest('apiEndpoints', 'Station info endpoint', false, error.message);
    }

    // Test QSO endpoint (all QSOs)
    try {
      const response = await fetch('/api/qsos');
      const data = await response.json();
      
      logTest('apiEndpoints', 'QSO list endpoint', 
        response.ok && Array.isArray(data.qsos),
        `${data.qsos?.length || 0} QSOs`);
    } catch (error) {
      logTest('apiEndpoints', 'QSO list endpoint', false, error.message);
    }

    // Test QSO endpoint with timestamp filter
    try {
      const since = Date.now() - 86400000; // 24 hours ago
      const response = await fetch(`/api/qsos?since=${since}`);
      const data = await response.json();
      
      logTest('apiEndpoints', 'QSO filtered endpoint', 
        response.ok && Array.isArray(data.qsos),
        `${data.qsos?.length || 0} recent QSOs`);
    } catch (error) {
      logTest('apiEndpoints', 'QSO filtered endpoint', false, error.message);
    }

    // Test QSO POST endpoint
    try {
      const testQso = {
        qsos: [{
          id: Date.now(),
          call: 'TEST123',
          class: '1A',
          section: 'TEST',
          datetime: new Date().toISOString(),
          band: '20M',
          mode: 'PH',
          timestamp: Date.now()
        }]
      };

      const response = await fetch('/api/qsos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testQso)
      });
      
      const data = await response.json();
      
      logTest('apiEndpoints', 'QSO POST endpoint', 
        response.ok && data.added !== undefined,
        `${data.added || 0} added`);
    } catch (error) {
      logTest('apiEndpoints', 'QSO POST endpoint', false, error.message);
    }
  }

  // Test 2: Station Discovery
  async function testStationDiscovery() {
    console.log('\n🔍 Testing station discovery...');
    
    if (window.networkService) {
      try {
        const stations = await window.networkService.discoverStations();
        
        logTest('discovery', 'Auto-discovery', 
          Array.isArray(stations),
          `Found ${stations.length} stations`);
          
        stations.forEach((station, index) => {
          logTest('discovery', `Station ${index + 1}`, 
            station.callsign && station.ip && station.port,
            `${station.callsign} at ${station.ip}:${station.port}`);
        });
        
      } catch (error) {
        logTest('discovery', 'Auto-discovery', false, error.message);
      }
    } else {
      logTest('discovery', 'Network service availability', false, 'window.networkService not found');
    }
  }

  // Test 3: WebSocket Integration
  async function testWebSocketIntegration() {
    console.log('\n🌐 Testing WebSocket integration...');
    
    if (window.webSocketSync) {
      try {
        const status = window.webSocketSync.getStatus();
        
        logTest('webSocket', 'WebSocket service', 
          status !== undefined,
          `Status: ${JSON.stringify(status)}`);

        // Test WebSocket message sending
        window.webSocketSync.broadcastStationInfo();
        logTest('webSocket', 'Broadcast station info', true, 'Message sent');

        // Test QSO broadcast
        const testQso = TEST_CONFIG.testQsos[0];
        window.webSocketSync.broadcastQsoUpdate(testQso, 'add');
        logTest('webSocket', 'Broadcast QSO update', true, `${testQso.call}`);
        
      } catch (error) {
        logTest('webSocket', 'WebSocket integration', false, error.message);
      }
    } else {
      logTest('webSocket', 'WebSocket service availability', false, 'window.webSocketSync not found');
    }
  }

  // Test 4: QSO Synchronization
  async function testQsoSync() {
    console.log('\n🔄 Testing QSO synchronization...');
    
    // Test adding QSO through store
    if (window.logQso) {
      try {
        const initialCount = JSON.parse(localStorage.getItem('qsos') || '[]').length;
        
        const testQso = {
          ...TEST_CONFIG.testQsos[0],
          datetime: new Date().toISOString()
        };
        
        window.logQso(testQso);
        
        await delay(100); // Small delay for processing
        
        const newCount = JSON.parse(localStorage.getItem('qsos') || '[]').length;
        
        logTest('sync', 'Add QSO via store', 
          newCount > initialCount,
          `Count: ${initialCount} → ${newCount}`);
          
      } catch (error) {
        logTest('sync', 'Add QSO via store', false, error.message);
      }
    } else {
      logTest('sync', 'QSO store function availability', false, 'window.logQso not found');
    }

    // Test duplicate detection
    try {
      const qsos = JSON.parse(localStorage.getItem('qsos') || '[]');
      const duplicates = qsos.filter((qso, index, arr) => 
        arr.findIndex(q => q.call === qso.call && q.datetime === qso.datetime) !== index
      );
      
      logTest('sync', 'Duplicate detection', 
        duplicates.length === 0,
        `${duplicates.length} duplicates found`);
        
    } catch (error) {
      logTest('sync', 'Duplicate detection', false, error.message);
    }
  }

  // Test 5: Error Recovery
  async function testErrorRecovery() {
    console.log('\n🛠️ Testing error recovery...');
    
    // Test timeout handling
    try {
      const start = Date.now();
      
      // Try to connect to non-existent station
      const result = await Promise.race([
        fetch('http://192.168.99.99:9999/api/station-info'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]);
      
      logTest('errorRecovery', 'Timeout handling', false, 'Should have timed out');
      
    } catch (error) {
      const duration = Date.now() - start;
      logTest('errorRecovery', 'Timeout handling', 
        duration < 3000, // Should timeout within 3 seconds
        `Timed out in ${duration}ms`);
    }

    // Test invalid JSON handling
    try {
      const mockResponse = new Response('invalid json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
      try {
        await mockResponse.json();
        logTest('errorRecovery', 'Invalid JSON handling', false, 'Should have thrown error');
      } catch (jsonError) {
        logTest('errorRecovery', 'Invalid JSON handling', true, 'Properly caught JSON error');
      }
      
    } catch (error) {
      logTest('errorRecovery', 'Invalid JSON handling', false, error.message);
    }

    // Test network service error handling
    if (window.networkService) {
      try {
        const connected = await window.networkService.connectToHost('invalid:address');
        logTest('errorRecovery', 'Invalid connection handling', 
          !connected, 
          connected ? 'Should have failed' : 'Properly rejected');
      } catch (error) {
        logTest('errorRecovery', 'Invalid connection handling', true, 'Exception caught');
      }
    }
  }

  // Test 6: Performance and Memory
  async function testPerformance() {
    console.log('\n⚡ Testing performance...');
    
    try {
      const start = Date.now();
      
      // Test rapid QSO additions
      const testQsos = [];
      for (let i = 0; i < 100; i++) {
        testQsos.push({
          call: `TEST${i.toString().padStart(3, '0')}`,
          class: '1A',
          section: 'TEST',
          datetime: new Date(Date.now() + i * 1000).toISOString(),
          band: '20M',
          mode: 'PH'
        });
      }
      
      // Add QSOs rapidly
      const startAdd = Date.now();
      testQsos.forEach(qso => {
        if (window.logQso) {
          window.logQso(qso);
        }
      });
      const addDuration = Date.now() - startAdd;
      
      logTest('sync', 'Bulk QSO performance', 
        addDuration < 5000, // Should complete within 5 seconds
        `${testQsos.length} QSOs in ${addDuration}ms`);
        
      // Test memory usage (approximate)
      const qsoData = localStorage.getItem('qsos');
      const memoryUsage = qsoData ? qsoData.length : 0;
      
      logTest('sync', 'Memory usage', 
        memoryUsage < 1000000, // Less than 1MB
        `${(memoryUsage / 1024).toFixed(1)}KB`);
        
    } catch (error) {
      logTest('sync', 'Performance test', false, error.message);
    }
  }

  // Run all tests
  async function runAllTests() {
    console.log('🚀 Starting comprehensive network test suite...\n');
    
    await testApiEndpoints();
    await delay(500);
    
    await testStationDiscovery();
    await delay(500);
    
    await testWebSocketIntegration();
    await delay(500);
    
    await testQsoSync();
    await delay(500);
    
    await testErrorRecovery();
    await delay(500);
    
    await testPerformance();
    
    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    let totalPassed = 0;
    let totalTests = 0;
    
    Object.entries(testResults).forEach(([category, results]) => {
      const percentage = results.total > 0 ? (results.passed / results.total * 100).toFixed(1) : '0.0';
      console.log(`${category.padEnd(15)}: ${results.passed}/${results.total} (${percentage}%)`);
      totalPassed += results.passed;
      totalTests += results.total;
    });
    
    console.log('------------------------');
    const overallPercentage = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : '0.0';
    console.log(`${'OVERALL'.padEnd(15)}: ${totalPassed}/${totalTests} (${overallPercentage}%)`);
    
    if (overallPercentage >= 80) {
      console.log('\n🎉 Network system is working well!');
    } else if (overallPercentage >= 60) {
      console.log('\n⚠️ Network system has some issues that should be addressed.');
    } else {
      console.log('\n❌ Network system has significant problems that need fixing.');
    }
  }

  // Expose test functions globally
  window.networkTests = {
    runAll: runAllTests,
    apiEndpoints: testApiEndpoints,
    discovery: testStationDiscovery,
    webSocket: testWebSocketIntegration,
    qsoSync: testQsoSync,
    errorRecovery: testErrorRecovery,
    performance: testPerformance,
    config: TEST_CONFIG,
    results: testResults
  };

  console.log('🎯 Network test functions available:');
  console.log('  • networkTests.runAll() - Run complete test suite');
  console.log('  • networkTests.apiEndpoints() - Test API endpoints');
  console.log('  • networkTests.discovery() - Test station discovery');
  console.log('  • networkTests.webSocket() - Test WebSocket integration');
  console.log('  • networkTests.qsoSync() - Test QSO synchronization');
  console.log('  • networkTests.errorRecovery() - Test error handling');
  console.log('  • networkTests.performance() - Test performance');
  console.log('\n💡 Run networkTests.runAll() to start testing!');

})();
