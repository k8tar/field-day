/**
 * Test script to verify bonus persistence with file storage
 * Run this in the browser console to test bonus functionality
 * 
 * Usage:
 * 1. Open the Field Day Logger in browser
 * 2. Open browser dev tools (F12)
 * 3. Copy and paste this script into the console
 * 4. Run: await testBonusPersistence()
 */

async function testBonusPersistence() {
  console.log('🎯 Testing bonus persistence with file storage...');
  
  // Check if file storage is available
  if (typeof fileStorage === 'undefined') {
    console.error('❌ File storage not available. Make sure the app is loaded.');
    return null;
  }
  
  try {
    // Step 1: Get current bonuses
    console.log('📥 Loading current bonuses...');
    const currentBonuses = await fileStorage.getBonuses();
    console.log(`Current bonuses:`, currentBonuses);
    
    // Step 2: Create test bonus data
    const testBonuses = [
      {
        id: 'emergency_power',
        name: 'Emergency Power',
        description: 'All contacts made using emergency power (no commercial power)',
        points: 100,
        completed: true // Toggle this to true
      },
      {
        id: 'media_publicity',
        name: 'Media Publicity',
        description: 'Getting publicity from local media (newspaper, TV, radio)',
        points: 100,
        completed: true // Toggle this to true
      },
      {
        id: 'public_location',
        name: 'Public Location',
        description: 'Operating from a public location (park, beach, etc.)',
        points: 100,
        completed: false
      }
    ];
    
    // Step 3: Save test bonuses
    console.log('💾 Saving test bonuses...');
    await fileStorage.saveBonuses(testBonuses);
    console.log('✅ Test bonuses saved successfully');
    
    // Step 4: Reload bonuses to verify
    console.log('🔄 Reloading bonuses to verify...');
    const reloadedBonuses = await fileStorage.getBonuses();
    console.log(`Reloaded bonuses:`, reloadedBonuses);
    
    // Step 5: Verify the data matches
    const completedCount = reloadedBonuses.filter(b => b.completed).length;
    console.log(`✅ Completed bonuses: ${completedCount}/${reloadedBonuses.length}`);
    
    if (completedCount === 2) {
      console.log('🎉 Bonus persistence test PASSED!');
    } else {
      console.log('❌ Bonus persistence test FAILED - completion status not preserved');
    }
    
    // Step 6: Test individual bonus toggle
    console.log('🔧 Testing individual bonus toggle...');
    const toggledBonuses = reloadedBonuses.map(bonus => {
      if (bonus.id === 'public_location') {
        return { ...bonus, completed: true };
      }
      return bonus;
    });
    
    await fileStorage.saveBonuses(toggledBonuses);
    const finalBonuses = await fileStorage.getBonuses();
    const finalCompletedCount = finalBonuses.filter(b => b.completed).length;
    
    console.log(`✅ Final completed bonuses: ${finalCompletedCount}/${finalBonuses.length}`);
    
    if (finalCompletedCount === 3) {
      console.log('🎉 Bonus toggle test PASSED!');
    } else {
      console.log('❌ Bonus toggle test FAILED');
    }
    
    return finalBonuses;
    
  } catch (error) {
    console.error('❌ Bonus persistence test failed:', error);
    return null;
  }
}

// Test configuration detection
async function testConfigDetection() {
  console.log('🔍 Testing configuration detection...');
  
  try {
    const config = await fileStorage.getStationConfig();
    const qsos = await fileStorage.getQsoData();
    const operators = await fileStorage.getOperators();
    
    console.log('📋 Current configuration:');
    console.log('  Station config:', config);
    console.log('  QSOs count:', qsos.length);
    console.log('  Operators:', operators);
    
    // Check if we have any configuration or data
    const hasConfig = config.callsign !== 'K8TAR' || 
                     config.designator !== '1A' || 
                     operators.length > 0;
    const hasQsos = qsos.length > 0;
    
    console.log('📊 Configuration status:');
    console.log('  Has config:', hasConfig);
    console.log('  Has QSOs:', hasQsos);
    console.log('  Should show setup:', !hasConfig && !hasQsos);
    
    return { hasConfig, hasQsos, shouldShowSetup: !hasConfig && !hasQsos };
    
  } catch (error) {
    console.error('❌ Configuration detection test failed:', error);
    return null;
  }
}

// Clear configuration for testing
async function clearConfiguration() {
  const confirmed = confirm('⚠️ This will clear all configuration for testing. Are you sure?');
  if (confirmed) {
    try {
      // Reset to default config
      await fileStorage.saveStationConfig({
        callsign: 'K8TAR',
        designator: '1A'
      });
      await fileStorage.saveOperators([]);
      console.log('🗑️ Configuration cleared for testing');
    } catch (error) {
      console.error('❌ Failed to clear configuration:', error);
    }
  }
}

// Available commands
console.log('🔧 Bonus Persistence Test (File Storage) loaded!');
console.log('');
console.log('📋 Available commands:');
console.log('  • await testBonusPersistence() - Test bonus saving/loading');
console.log('  • await testConfigDetection() - Test configuration detection');
console.log('  • await clearConfiguration() - Clear config for testing');
console.log('');
console.log('🚀 Quick start: await testBonusPersistence()');

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testBonusPersistence, testConfigDetection, clearConfiguration };
}
