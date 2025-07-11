/**
 * Quick test script to verify app state after localStorage migration fixes
 * Run this in the browser console to check if configuration and bonus persistence is working
 */

async function quickTestAppState() {
  console.log('🔍 Testing app state after localStorage migration fixes...');
  console.log('=====================================');
  
  // Test 1: Configuration Detection
  console.log('📋 Test 1: Configuration Detection');
  try {
    const config = await fileStorage.getStationConfig();
    const qsos = await fileStorage.getQsoData();
    const operators = await fileStorage.getOperators();
    
    console.log('📊 Current state:');
    console.log('  Config:', config);
    console.log('  QSOs count:', qsos.length);
    console.log('  Operators:', operators);
    
    const hasConfig = config.callsign !== 'K8TAR' || 
                     config.designator !== '1A' || 
                     operators.length > 0;
    const hasQsos = qsos.length > 0;
    
    console.log('✅ Configuration detection:');
    console.log('  Has config:', hasConfig);
    console.log('  Has QSOs:', hasQsos);
    console.log('  Should show setup:', !hasConfig && !hasQsos);
    
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
  }
  
  // Test 2: Bonus Persistence
  console.log('\n🏆 Test 2: Bonus Persistence');
  try {
    // Get current bonuses
    const currentBonuses = await fileStorage.getBonuses();
    console.log('📥 Current bonuses:', currentBonuses);
    
    // Create a test bonus toggle
    const testBonuses = currentBonuses.map((bonus, index) => ({
      ...bonus,
      completed: index === 0 ? !bonus.completed : bonus.completed // Toggle first bonus
    }));
    
    // Save the test bonuses
    await fileStorage.saveBonuses(testBonuses);
    console.log('💾 Saved test bonuses with first bonus toggled');
    
    // Reload to verify persistence
    const reloadedBonuses = await fileStorage.getBonuses();
    const firstBonusMatches = reloadedBonuses[0].completed === testBonuses[0].completed;
    
    console.log('✅ Bonus persistence test:', firstBonusMatches ? 'PASSED' : 'FAILED');
    console.log('  Expected first bonus completed:', testBonuses[0].completed);
    console.log('  Actual first bonus completed:', reloadedBonuses[0].completed);
    
    // Restore original state
    await fileStorage.saveBonuses(currentBonuses);
    console.log('🔄 Restored original bonus state');
    
  } catch (error) {
    console.error('❌ Bonus persistence test failed:', error);
  }
  
  // Test 3: File Storage Endpoints
  console.log('\n📁 Test 3: File Storage Endpoints');
  try {
    // Test write endpoint
    const testData = { test: true, timestamp: Date.now() };
    const writeResponse = await fetch('/api/files/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'fieldday-data/port_8082/test-file.json',
        content: JSON.stringify(testData)
      })
    });
    
    console.log('✅ Write endpoint status:', writeResponse.status, writeResponse.ok ? 'OK' : 'FAILED');
    
    // Test read endpoint
    const readResponse = await fetch('/api/files/read?path=fieldday-data/port_8082/test-file.json');
    const readData = await readResponse.text();
    const parsedData = JSON.parse(readData);
    
    console.log('✅ Read endpoint status:', readResponse.status, readResponse.ok ? 'OK' : 'FAILED');
    console.log('  Data match:', parsedData.test === testData.test ? 'PASSED' : 'FAILED');
    
  } catch (error) {
    console.error('❌ File storage endpoint test failed:', error);
  }
  
  // Test 4: Check for any localStorage usage
  console.log('\n🔍 Test 4: localStorage Usage Check');
  const localStorageKeys = Object.keys(localStorage);
  const fieldDayKeys = localStorageKeys.filter(key => 
    key.includes('fieldday') || 
    key.includes('station') || 
    key.includes('operator') || 
    key.includes('qso') ||
    key.includes('bonus')
  );
  
  if (fieldDayKeys.length === 0) {
    console.log('✅ No Field Day related localStorage keys found - good!');
  } else {
    console.log('⚠️ Found Field Day localStorage keys (should investigate):');
    fieldDayKeys.forEach(key => console.log('  -', key, ':', localStorage.getItem(key)));
  }
  
  // Test 5: Operator Dropdown Population
  console.log('\n👥 Test 5: Operator Dropdown Population');
  try {
    const operators = await fileStorage.getOperators();
    console.log('📥 Operators from file storage:', operators);
    
    // Create test operators if none exist
    if (operators.length === 0) {
      console.log('📝 Creating test operators...');
      const testOperators = ['K8TAR', 'W1TEST', 'N8ABC'];
      await fileStorage.saveOperators(testOperators);
    }
    // If no configuration exists, create one for testing
    const config = await fileStorage.getStationConfig();
    if (config.callsign === 'K8TAR' && config.designator === '1A') {
      console.log('📝 Creating test configuration...');
      await fileStorage.saveStationConfig({
        callsign: 'W1TEST',
        designator: 'PHONE 1',
        stationClass: '2A',
        stationSection: 'OH'
      });
      await fileStorage.saveOperators(['OP1', 'OP2']);
      console.log('✅ Test configuration created');
    }
    
    console.log('📋 Configuration should prevent setup screen on refresh');
    console.log('🔄 Try refreshing the page now to verify...');
  } catch (error) {
    console.error('❌ Operator dropdown test failed:', error);
  }
}

// Available commands
console.log('🧪 App State Testing Tools loaded!');
console.log('');
console.log('📋 Available commands:');
console.log('  • await quickTestAppState() - Comprehensive state test');
console.log('  • await testRefreshBehavior() - Test setup detection after refresh');
console.log('');
console.log('🚀 Quick start: await quickTestAppState()');

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { quickTestAppState, testRefreshBehavior };
}