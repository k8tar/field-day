/**
 * Test script for simplified messaging system (all messages to all stations)
 * Verifies that station selection has been removed and all messages go to everyone
 */

const fs = require('fs');

console.log('🧪 Testing Simplified Messaging System...\n');

function testSimplifiedMessaging() {
  console.log('📋 Testing Message Simplification Changes\n');
  
  const messagesVueContent = fs.readFileSync('./src/components/Messages.vue', 'utf8');
  
  // Test 1: Check that target selection elements are removed from template
  const noTargetSelect = !messagesVueContent.includes('target-select') &&
                         !messagesVueContent.includes('selectedTarget') &&
                         !messagesVueContent.includes('modalSelectedTarget');
  
  console.log(`✅ Target selection elements removed: ${noTargetSelect ? 'Yes' : 'No'}`);
  
  // Test 2: Check that send functions use 'all' target
  const sendsToAll = messagesVueContent.includes("const target = 'all'; // Always send to all stations");
  
  console.log(`✅ Messages always sent to all stations: ${sendsToAll ? 'Yes' : 'No'}`);
  
  // Test 3: Check that "to" information is removed from message display
  const noTargetDisplay = !messagesVueContent.includes('to {{ message.target }}') &&
                          !messagesVueContent.includes('message-target');
  
  console.log(`✅ Target display removed from messages: ${noTargetDisplay ? 'Yes' : 'No'}`);
  
  // Test 4: Check that target selection CSS is removed
  const noTargetCSS = !messagesVueContent.includes('.target-select') &&
                      !messagesVueContent.includes('.modal-target-select');
  
  console.log(`✅ Target selection CSS removed: ${noTargetCSS ? 'Yes' : 'No'}`);
  
  // Test 5: Check that unused computed property is removed
  const noConnectedStations = !messagesVueContent.includes('connectedStations');
  
  console.log(`✅ Unused connectedStations computed removed: ${noConnectedStations ? 'Yes' : 'No'}`);
  
  // Test 6: Check that input takes full width without target select
  const inputFullWidth = messagesVueContent.includes('flex: 1') && 
                         messagesVueContent.includes('.message-input {');
  
  console.log(`✅ Message input uses full width: ${inputFullWidth ? 'Yes' : 'No'}`);
  
  const allPassed = noTargetSelect && sendsToAll && noTargetDisplay && 
                   noTargetCSS && noConnectedStations && inputFullWidth;
  
  console.log('\n📊 Summary:');
  console.log('============');
  
  if (allPassed) {
    console.log('🎉 All messaging simplification changes implemented successfully!');
    console.log('\n📋 Changes Made:');
    console.log('• ❌ Removed station selection dropdowns from both forms');
    console.log('• 🌐 All messages now sent to all stations automatically');
    console.log('• 🧹 Removed "to" display from message metadata');
    console.log('• 💅 Cleaned up CSS for removed target selection elements');
    console.log('• 📏 Message input now uses full available width');
    console.log('• 🔧 Removed unused computed properties and variables');
    
    console.log('\n✨ User Experience Improvements:');
    console.log('• 🚀 Faster message sending (no target selection needed)');
    console.log('• 🌐 Universal communication (all stations see all messages)');
    console.log('• 🎯 Cleaner UI (less clutter, more focus on message content)');
    console.log('• 💬 Simpler workflow (type and send)');
    
    console.log('\n🧪 Test the changes:');
    console.log('1. Open the app and look at Messages component');
    console.log('2. Verify no station selection dropdown is present');
    console.log('3. Send a message - should go to all stations automatically');
    console.log('4. Check message display - no "to" information shown');
    console.log('5. Open messages modal - same simplified form');
  } else {
    console.log('❌ Some simplification changes are missing or incomplete.');
    console.log('Please review the failed tests above.');
  }
  
  return allPassed;
}

// Test sending a message to verify it works
async function testMessageSending() {
  console.log('\n🧪 Testing Message Sending to All Stations\n');
  
  try {
    const testMessage = 'Simplified messaging test - ' + Date.now();
    const messageId = 'simplified-test-' + Date.now();
    
    console.log(`📨 Sending test message: "${testMessage}"`);
    console.log(`🆔 Using message ID: ${messageId}`);
    
    const response = await fetch('https://localhost:8080/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: messageId,
        type: 'chat',
        text: testMessage,
        from: 'SIMPLIFIED-TEST',
        target: 'all',
        timestamp: Date.now(),
        stationId: 'SIMPLIFIED-TEST'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Message sent successfully`);
      console.log(`   Target: ${result.message.target} (should be 'all')`);
      console.log(`   Duplicate: ${result.duplicate || 'false'}`);
      
      // Verify the message appears in the message list
      const getResponse = await fetch('https://localhost:8080/api/messages?limit=5');
      const messages = await getResponse.json();
      const sentMessage = messages.messages.find(m => m.id === messageId);
      
      if (sentMessage) {
        console.log(`✅ Message found in storage with target: ${sentMessage.target}`);
        return true;
      } else {
        console.log(`❌ Message not found in storage`);
        return false;
      }
    } else {
      console.log(`❌ Failed to send message: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error testing message sending: ${error.message}`);
    console.log('⚠️  Make sure the Field Day app is running on https://localhost:8080');
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Simplified Messaging Tests\n');
  
  // Test 1: Code structure changes
  const structureTest = testSimplifiedMessaging();
  
  // Test 2: Actual message sending
  const sendingTest = await testMessageSending();
  
  console.log('\n🎯 Final Result:');
  console.log('================');
  
  if (structureTest && sendingTest) {
    console.log('🎉 All simplified messaging tests passed!');
    console.log('\n💡 The messaging system is now simplified:');
    console.log('• No station selection needed');
    console.log('• All messages automatically go to all stations');
    console.log('• Cleaner, faster user experience');
    console.log('• Full-width message input');
  } else {
    console.log('⚠️  Some tests failed. Please review the results above.');
    if (!structureTest) console.log('   - Code structure issues found');
    if (!sendingTest) console.log('   - Message sending test failed');
  }
}

runTests().catch(console.error);
