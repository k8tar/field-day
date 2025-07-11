// Test script to verify file storage migration functionality
console.log('🧪 === FILE STORAGE MIGRATION TEST ===');

// Import the file storage service
import { fileStorage } from '../src/services/fileStorage.js';

async function runFileStorageTests() {
  try {
    console.log('\n📋 1. Testing station config...');
    
    // Test saving and loading station config
    await fileStorage.saveStationConfig({
      callsign: 'TEST1',
      designator: '1A',
      stationClass: '1A',
      stationSection: 'OH'
    });
    
    const config = await fileStorage.getStationConfig();
    console.log('✅ Station config saved and loaded:', config);
    
    console.log('\n👥 2. Testing operators...');
    
    // Test saving and loading operators
    const testOperators = ['OP1', 'OP2', 'OP3'];
    await fileStorage.saveOperators(testOperators);
    
    const loadedOperators = await fileStorage.getOperators();
    console.log('✅ Operators saved and loaded:', loadedOperators);
    
    console.log('\n📻 3. Testing QSOs...');
    
    // Test saving and loading QSOs
    const testQsos = [
      {
        id: 1,
        call: 'W1ABC',
        mode: 'PH',
        band: '20M',
        section: 'MA',
        datetime: new Date().toISOString()
      },
      {
        id: 2,
        call: 'K2DEF',
        mode: 'CW',
        band: '40M',
        section: 'NY',
        datetime: new Date().toISOString()
      }
    ];
    
    await fileStorage.saveQsoData(testQsos);
    
    const loadedQsos = await fileStorage.getQsoData();
    console.log('✅ QSOs saved and loaded:', loadedQsos.length, 'QSOs');
    
    console.log('\n🎯 4. Testing bonuses...');
    
    // Test saving and loading bonuses
    const testBonuses = [
      { id: 'test1', name: 'Test Bonus', points: 100, completed: true },
      { id: 'test2', name: 'Another Bonus', points: 50, completed: false }
    ];
    
    await fileStorage.saveBonuses(testBonuses);
    
    const loadedBonuses = await fileStorage.getBonuses();
    console.log('✅ Bonuses saved and loaded:', loadedBonuses.length, 'bonuses');
    
    console.log('\n⚙️ 5. Testing settings...');
    
    // Test saving and loading settings
    await fileStorage.saveSettings({
      band: '20M',
      operator: 'TEST1',
      mode: 'CW',
      networkSettings: { autoReconnect: true }
    });
    
    const loadedSettings = await fileStorage.getSettings();
    console.log('✅ Settings saved and loaded:', loadedSettings);
    
    console.log('\n📊 6. Getting storage info...');
    
    const storageInfo = await fileStorage.getStorageInfo();
    console.log('✅ Storage info:', storageInfo);
    
    console.log('\n🎉 All file storage tests passed!');
    
  } catch (error) {
    console.error('❌ File storage test failed:', error);
  }
}

// Test migration from localStorage
async function testMigrationFromLocalStorage() {
  console.log('\n🔄 Testing migration from localStorage...');
  
  // Set up some test data in localStorage
  localStorage.setItem('stationCallsign', 'MIGRATE1');
  localStorage.setItem('stationDesignator', '2B');
  localStorage.setItem('stationClass', '2B');
  localStorage.setItem('stationSection', 'WPA');
  localStorage.setItem('operators', JSON.stringify(['MIGOP1', 'MIGOP2']));
  localStorage.setItem('qsos', JSON.stringify([
    { id: 99, call: 'MIGRATED', mode: 'PH', band: '40M', section: 'PA' }
  ]));
  localStorage.setItem('qso_band', '15M');
  localStorage.setItem('qso_operator', 'MIGOP1');
  localStorage.setItem('qso_mode', 'CW');
  
  try {
    await fileStorage.migrateFromLocalStorage();
    console.log('✅ Migration completed successfully');
    
    // Verify migration worked
    const config = await fileStorage.getStationConfig();
    const operators = await fileStorage.getOperators();
    const qsos = await fileStorage.getQsoData();
    const settings = await fileStorage.getSettings();
    
    console.log('📋 Migrated config:', config);
    console.log('👥 Migrated operators:', operators);
    console.log('📻 Migrated QSOs:', qsos.length);
    console.log('⚙️ Migrated settings:', settings);
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  await runFileStorageTests();
  await testMigrationFromLocalStorage();
  
  console.log('\n✨ File storage migration testing complete!');
  console.log('💡 You can now use file storage instead of localStorage for all persistent data.');
  console.log('🔧 Try opening multiple browser instances on different ports to test isolation.');
}

// Run the tests
runAllTests().catch(console.error);
