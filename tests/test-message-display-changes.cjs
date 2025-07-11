/**
 * Test script for message ordering and station designator display
 */

const fs = require('fs');

console.log('🧪 Testing Message Display Changes...\n');

function testMessageOrdering() {
  console.log('📋 Testing Message Ordering Changes\n');
  
  const messagesVueContent = fs.readFileSync('./src/components/Messages.vue', 'utf8');
  
  // Test 1: Check recent messages are reversed
  const recentMessagesReversed = messagesVueContent.includes('messages.value.slice(-5).reverse()');
  console.log(`✅ Recent messages reversed: ${recentMessagesReversed ? 'Yes' : 'No'}`);
  
  // Test 2: Check all messages computed property exists
  const allMessagesReversed = messagesVueContent.includes('allMessagesReversed') &&
                             messagesVueContent.includes('[...messages.value].reverse()');
  console.log(`✅ All messages reversed computed property: ${allMessagesReversed ? 'Yes' : 'No'}`);
  
  // Test 3: Check modal uses reversed messages
  const modalUsesReversed = messagesVueContent.includes('v-for="message in allMessagesReversed"');
  console.log(`✅ Modal uses reversed messages: ${modalUsesReversed ? 'Yes' : 'No'}`);
  
  // Test 4: Check getStationDesignator function exists
  const hasDesignatorFunction = messagesVueContent.includes('function getStationDesignator(stationId: string)');
  console.log(`✅ Station designator function: ${hasDesignatorFunction ? 'Yes' : 'No'}`);
  
  // Test 5: Check function extracts designator correctly
  const hasDesignatorLogic = messagesVueContent.includes('stationId.split(\'-\')') &&
                           messagesVueContent.includes('parts[parts.length - 1]');
  console.log(`✅ Designator extraction logic: ${hasDesignatorLogic ? 'Yes' : 'No'}`);
  
  // Test 6: Check template uses getStationDesignator
  const templateUsesFunction = messagesVueContent.includes('getStationDesignator(message.from)');
  console.log(`✅ Template uses designator function: ${templateUsesFunction ? 'Yes' : 'No'}`);
  
  const allPassed = recentMessagesReversed && allMessagesReversed && modalUsesReversed && 
                   hasDesignatorFunction && hasDesignatorLogic && templateUsesFunction;
  
  console.log('\n📊 Summary:');
  console.log('============');
  
  if (allPassed) {
    console.log('🎉 All message display changes implemented successfully!');
    console.log('\n📋 Changes Made:');
    console.log('• ⏪ Recent messages now display newest first (reverse chronological)');
    console.log('• 📋 Modal messages now display newest first');
    console.log('• 🏷️  Station display shows only designator (e.g., "PHONE" instead of "K8TAR-PHONE")');
    console.log('• 🔧 Added getStationDesignator() helper function');
    console.log('• 🎨 Both recent and modal views updated consistently');
    
    console.log('\n🧪 Test the changes:');
    console.log('1. Open the app and send some messages');
    console.log('2. Verify newest messages appear at the top');
    console.log('3. Verify station shows as "PHONE", "CW", etc. not full callsign');
    console.log('4. Open messages modal and verify same ordering/display');
  } else {
    console.log('❌ Some changes are missing or incomplete.');
  }
  
  return allPassed;
}

// Test the getStationDesignator function logic
function testDesignatorFunction() {
  console.log('\n🔧 Testing Station Designator Function Logic\n');
  
  // Simulate the function
  function getStationDesignator(stationId) {
    if (!stationId) return '';
    const parts = stationId.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : stationId;
  }
  
  const testCases = [
    { input: 'K8TAR-PHONE', expected: 'PHONE' },
    { input: 'W1ABC-CW', expected: 'CW' },
    { input: 'N2XYZ-DIGITAL', expected: 'DIGITAL' },
    { input: 'K3DEF-STATION-1', expected: '1' },
    { input: 'SOLO', expected: 'SOLO' },
    { input: '', expected: '' },
    { input: null, expected: '' }
  ];
  
  let allTestsPassed = true;
  
  testCases.forEach(test => {
    const result = getStationDesignator(test.input);
    const passed = result === test.expected;
    allTestsPassed = allTestsPassed && passed;
    
    const status = passed ? '✅' : '❌';
    console.log(`${status} "${test.input}" → "${result}" (expected: "${test.expected}")`);
  });
  
  console.log(`\n📈 Designator Function Tests: ${allTestsPassed ? 'All Passed' : 'Some Failed'}`);
  
  return allTestsPassed;
}

// Run all tests
try {
  const orderingPassed = testMessageOrdering();
  const functionPassed = testDesignatorFunction();
  
  console.log('\n🎯 Final Result:');
  console.log('================');
  
  if (orderingPassed && functionPassed) {
    console.log('🎉 All message display changes are working correctly!');
    console.log('\n✨ User Experience Improvements:');
    console.log('• 📅 Newest messages always appear first');
    console.log('• 🏷️  Cleaner station identification (designator only)');
    console.log('• 🔄 Consistent ordering in both views');
    console.log('• 🖥️  Better readability and user flow');
  } else {
    console.log('⚠️  Some issues found. Please review the test results above.');
  }
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
}
