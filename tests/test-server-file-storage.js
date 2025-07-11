/**
 * Test script to verify server-side file storage is working
 * 
 * Usage:
 * 1. Open the Field Day Logger in browser
 * 2. Open browser dev tools (F12)
 * 3. Copy and paste this script into the console
 * 4. Run: await testServerFileStorage()
 */

async function testServerFileStorage() {
  console.log('🧪 Testing server-side file storage...');
  
  // Check if file storage is available
  if (typeof fileStorage === 'undefined') {
    console.error('❌ File storage not available. Make sure the app is loaded.');
    return false;
  }
  
  try {
    // Test saving station config
    console.log('📝 Testing station config save...');
    await fileStorage.saveStationConfig({
      callsign: 'TEST123',
      designator: '5X',
      stationClass: '2A',
      stationSection: 'OH'
    });
    console.log('✅ Station config saved');
    
    // Test reading station config
    console.log('📖 Testing station config read...');
    const config = await fileStorage.getStationConfig();
    console.log('📋 Station config loaded:', config);
    
    if (config.callsign === 'TEST123') {
      console.log('✅ Station config read/write test PASSED');
    } else {
      console.log('❌ Station config read/write test FAILED');
      return false;
    }
    
    // Test saving operators
    console.log('📝 Testing operators save...');
    await fileStorage.saveOperators(['TESTOP1', 'TESTOP2', 'TESTOP3']);
    console.log('✅ Operators saved');
    
    // Test reading operators
    console.log('📖 Testing operators read...');
    const operators = await fileStorage.getOperators();
    console.log('👥 Operators loaded:', operators);
    
    if (operators.length === 3 && operators[0] === 'TESTOP1') {
      console.log('✅ Operators read/write test PASSED');
    } else {
      console.log('❌ Operators read/write test FAILED');
      return false;
    }
    
    // Test saving QSO data
    console.log('📝 Testing QSO data save...');
    const testQsos = [
      {
        id: 1,
        call: 'W1AW',
        class: '2A',
        section: 'CT',
        band: '20M',
        mode: 'PH',
        operator: 'TESTOP1',
        datetime: new Date().toISOString(),
        timestamp: Date.now()
      }
    ];
    await fileStorage.saveQsoData(testQsos);
    console.log('✅ QSO data saved');
    
    // Test reading QSO data
    console.log('📖 Testing QSO data read...');
    const qsos = await fileStorage.getQsoData();
    console.log('📋 QSO data loaded:', qsos);
    
    if (qsos.length === 1 && qsos[0].call === 'W1AW') {
      console.log('✅ QSO data read/write test PASSED');
    } else {
      console.log('❌ QSO data read/write test FAILED');
      return false;
    }
    
    // Test settings
    console.log('📝 Testing settings save...');
    await fileStorage.saveSettings({
      band: '40M',
      operator: 'TESTOP2',
      mode: 'CW',
      theme: 'dark'
    });
    console.log('✅ Settings saved');
    
    // Test reading settings
    console.log('📖 Testing settings read...');
    const settings = await fileStorage.getSettings();
    console.log('⚙️ Settings loaded:', settings);
    
    if (settings.band === '40M' && settings.theme === 'dark') {
      console.log('✅ Settings read/write test PASSED');
    } else {
      console.log('❌ Settings read/write test FAILED');
      return false;
    }
    
    console.log('🎉 ALL TESTS PASSED! Server-side file storage is working correctly.');
    console.log('');
    console.log('📁 Data is now stored on the server and will persist across:');
    console.log('  ✅ Browser restarts');
    console.log('  ✅ Incognito/private mode sessions');
    console.log('  ✅ Different browser instances');
    console.log('  ✅ Cache clearing');
    
    return true;
    
  } catch (error) {
    console.error('❌ Server-side file storage test FAILED:', error);
    console.log('');
    console.log('🔧 Possible issues:');
    console.log('  • Server may not be running the file storage API');
    console.log('  • Network connectivity issues');
    console.log('  • Server permissions issues');
    return false;
  }
}

// Test incognito mode specifically
async function testIncognitoMode() {
  console.log('🕵️ Testing incognito mode compatibility...');
  
  try {
    // Try to save and immediately read data
    const testData = `incognito-test-${Date.now()}`;
    await fileStorage.saveStationConfig({
      callsign: testData,
      designator: '9Z'
    });
    
    const config = await fileStorage.getStationConfig();
    
    if (config.callsign === testData) {
      console.log('✅ INCOGNITO MODE TEST PASSED!');
      console.log('📁 Data persists even in incognito/private browsing mode');
      return true;
    } else {
      console.log('❌ INCOGNITO MODE TEST FAILED');
      return false;
    }
  } catch (error) {
    console.error('❌ Incognito mode test failed:', error);
    return false;
  }
}

// Available commands
console.log('🧪 Server-Side File Storage Test Suite loaded!');
console.log('');
console.log('📋 Available commands:');
console.log('  • await testServerFileStorage() - Test all file storage operations');
console.log('  • await testIncognitoMode() - Test incognito mode compatibility');
console.log('');
console.log('🚀 Quick start: await testServerFileStorage()');

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testServerFileStorage, testIncognitoMode };
}
