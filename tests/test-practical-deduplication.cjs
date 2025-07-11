/**
 * Practical test for message deduplication - generates messages and tests for duplicates
 * Run this while the app is running to see deduplication in action
 */

const fs = require('fs');

console.log('🧪 Practical Message Deduplication Test...\n');

async function testMessageDuplication() {
  const testMessage = 'Test message ' + Date.now();
  const messageId = 'test-msg-' + Date.now();
  
  console.log(`📨 Testing with message: "${testMessage}"`);
  console.log(`🆔 Using message ID: ${messageId}\n`);
  
  try {
    // Send the same message multiple times with the same ID to test deduplication
    console.log('1️⃣ Sending message first time...');
    const response1 = await fetch('https://localhost:8080/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: messageId,
        type: 'chat',
        text: testMessage,
        from: 'TEST-STATION',
        target: 'all',
        timestamp: Date.now(),
        stationId: 'TEST-STATION'
      })
    });
    
    const result1 = await response1.json();
    console.log(`✅ First send result: ${result1.success ? 'Success' : 'Failed'}`);
    console.log(`   Duplicate flag: ${result1.duplicate || 'false'}\n`);
    
    // Send the same message again with the same ID
    console.log('2️⃣ Sending same message ID again...');
    const response2 = await fetch('https://localhost:8080/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: messageId,
        type: 'chat',
        text: testMessage,
        from: 'TEST-STATION',
        target: 'all',
        timestamp: Date.now(),
        stationId: 'TEST-STATION'
      })
    });
    
    const result2 = await response2.json();
    console.log(`✅ Second send result: ${result2.success ? 'Success' : 'Failed'}`);
    console.log(`   Duplicate flag: ${result2.duplicate || 'false'}\n`);
    
    // Check how many messages are in storage
    console.log('3️⃣ Checking message count in storage...');
    const getResponse = await fetch('https://localhost:8080/api/messages?limit=100');
    const messages = await getResponse.json();
    
    const testMessageCount = messages.messages.filter(m => m.id === messageId).length;
    console.log(`📊 Messages with ID ${messageId}: ${testMessageCount}`);
    console.log(`📊 Total messages in storage: ${messages.messages.length}\n`);
    
    // Test summary
    if (result1.success && !result1.duplicate && result2.success && result2.duplicate && testMessageCount === 1) {
      console.log('🎉 DEDUPLICATION TEST PASSED!');
      console.log('✅ First message was stored successfully');
      console.log('✅ Second message was detected as duplicate');
      console.log('✅ Only one copy exists in storage');
      console.log('\n💡 Message deduplication is working correctly!');
    } else {
      console.log('❌ DEDUPLICATION TEST FAILED!');
      console.log(`   First send - Success: ${result1.success}, Duplicate: ${result1.duplicate}`);
      console.log(`   Second send - Success: ${result2.success}, Duplicate: ${result2.duplicate}`);
      console.log(`   Message count: ${testMessageCount} (should be 1)`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n⚠️  Make sure the Field Day app is running on https://localhost:8080');
  }
}

// Test GUID generation function directly
function testGUIDGeneration() {
  console.log('🔢 Testing GUID generation...\n');
  
  // Simulate the GUID generation function
  function generateGUID() {
    return 'msg-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Generate multiple GUIDs and check for uniqueness
  const guids = new Set();
  const numGuids = 1000;
  
  for (let i = 0; i < numGuids; i++) {
    guids.add(generateGUID());
  }
  
  console.log(`🔢 Generated ${numGuids} GUIDs`);
  console.log(`🔢 Unique GUIDs: ${guids.size}`);
  
  if (guids.size === numGuids) {
    console.log('✅ All GUIDs are unique - GUID generation working correctly!');
  } else {
    console.log(`❌ Found ${numGuids - guids.size} duplicate GUIDs!`);
  }
  
  // Show some example GUIDs
  const guidArray = Array.from(guids);
  console.log('\n📋 Sample GUIDs:');
  for (let i = 0; i < Math.min(5, guidArray.length); i++) {
    console.log(`   ${guidArray[i]}`);
  }
  
  console.log('\n');
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Practical Message Deduplication Tests\n');
  
  // Test 1: GUID generation
  testGUIDGeneration();
  
  // Test 2: API deduplication
  await testMessageDuplication();
  
  console.log('\n📋 Test Instructions for Manual Verification:');
  console.log('1. Open the Field Day app in browser');
  console.log('2. Open browser console (F12)');
  console.log('3. Send the same message multiple times quickly');
  console.log('4. Look for "Duplicate message prevented" logs');
  console.log('5. Check Messages component to see only one copy appears');
  console.log('\n🔍 If you see duplicates, check:');
  console.log('• Multiple browser tabs (each maintains separate state)');
  console.log('• Network timing issues (rapid clicking)');
  console.log('• Server restart during testing');
}

runTests().catch(console.error);
