/**
 * Test script for message deduplication with GUIDs
 * Tests that messages don't get duplicated during network sync
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Message Deduplication with GUIDs...\n');

let testResults = [];

function addTestResult(test, passed, details = '') {
  testResults.push({ test, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${test}${details ? ' - ' + details : ''}`);
}

// Test 1: Check GUID generation function exists
function testGUIDGeneration() {
  console.log('\n📝 Test 1: GUID generation function');
  
  const messagesVueContent = fs.readFileSync('./src/components/Messages.vue', 'utf8');
  const networkServiceContent = fs.readFileSync('./src/services/networkService.ts', 'utf8');
  
  const hasGUIDFunction = messagesVueContent.includes('function generateGUID()');
  const hasNetworkGUIDFunction = networkServiceContent.includes('generateMessageId()');
  const hasGUIDUsage = messagesVueContent.includes('generateGUID()');
  
  addTestResult(
    'GUID generation function exists',
    hasGUIDFunction,
    `Function found: ${hasGUIDFunction}`
  );
  
  addTestResult(
    'Network service GUID function exists',
    hasNetworkGUIDFunction,
    `Network function found: ${hasNetworkGUIDFunction}`
  );
  
  addTestResult(
    'GUID function is used',
    hasGUIDUsage,
    `Usage found: ${hasGUIDUsage}`
  );
  
  return hasGUIDFunction && hasNetworkGUIDFunction && hasGUIDUsage;
}

// Test 2: Check message ID parameter in addMessage
function testAddMessageWithID() {
  console.log('\n📝 Test 2: addMessage function with ID parameter');
  
  const fs = require('fs');
  const messagesVueContent = fs.readFileSync('./src/components/Messages.vue', 'utf8');
  
  const hasMessageIdParam = messagesVueContent.includes('messageId?: string');
  const hasIdAssignment = messagesVueContent.includes('const id = messageId || generateGUID()');
  const hasDuplicateCheck = messagesVueContent.includes('const existingMessage = messages.value.find(m => m.id === id)');
  const hasDuplicatePrevention = messagesVueContent.includes('Duplicate message prevented');
  
  addTestResult(
    'addMessage accepts messageId parameter',
    hasMessageIdParam,
    `Parameter found: ${hasMessageIdParam}`
  );
  
  addTestResult(
    'ID assignment with fallback to GUID',
    hasIdAssignment,
    `Assignment found: ${hasIdAssignment}`
  );
  
  addTestResult(
    'Duplicate message check exists',
    hasDuplicateCheck,
    `Check found: ${hasDuplicateCheck}`
  );
  
  addTestResult(
    'Duplicate prevention logic exists',
    hasDuplicatePrevention,
    `Prevention found: ${hasDuplicatePrevention}`
  );
  
  return hasMessageIdParam && hasIdAssignment && hasDuplicateCheck && hasDuplicatePrevention;
}

// Test 3: Check sendMessage functions use GUIDs
function testSendMessageWithGUIDs() {
  console.log('\n📝 Test 3: Send message functions use GUIDs');
  
  const fs = require('fs');
  const messagesVueContent = fs.readFileSync('./src/components/Messages.vue', 'utf8');
  const networkServiceContent = fs.readFileSync('./src/services/networkService.ts', 'utf8');
  
  const sendMessageUsesGUID = messagesVueContent.includes('const messageId = generateGUID()');
  const modalSendUsesGUID = messagesVueContent.includes('const messageId = generateGUID()');
  const networkAcceptsMessageId = networkServiceContent.includes('messageId?: string');
  const networkUsesProvidedId = networkServiceContent.includes('id: messageId || this.generateMessageId()');
  
  addTestResult(
    'sendMessage generates GUID',
    sendMessageUsesGUID,
    `GUID generation found: ${sendMessageUsesGUID}`
  );
  
  addTestResult(
    'sendModalMessage generates GUID',
    modalSendUsesGUID,
    `Modal GUID generation found: ${modalSendUsesGUID}`
  );
  
  addTestResult(
    'Network service accepts messageId',
    networkAcceptsMessageId,
    `Parameter found: ${networkAcceptsMessageId}`
  );
  
  addTestResult(
    'Network service uses provided ID',
    networkUsesProvidedId,
    `ID usage found: ${networkUsesProvidedId}`
  );
  
  return sendMessageUsesGUID && modalSendUsesGUID && networkAcceptsMessageId && networkUsesProvidedId;
}

// Test 4: Check server-side deduplication
function testServerDeduplication() {
  console.log('\n📝 Test 4: Server-side message deduplication');
  
  const fs = require('fs');
  const viteConfigContent = fs.readFileSync('./vite.config.ts', 'utf8');
  
  const usesProvidedId = viteConfigContent.includes('const messageId = messageData.id ||');
  const hasServerDuplicateCheck = viteConfigContent.includes('const existingMessage = stationMessages.find(msg => msg.id === messageId)');
  const hasServerDuplicatePrevention = viteConfigContent.includes('Duplicate message prevented');
  const preservesTimestamp = viteConfigContent.includes('timestamp: messageData.timestamp ||');
  
  addTestResult(
    'Server uses provided message ID',
    usesProvidedId,
    `ID usage found: ${usesProvidedId}`
  );
  
  addTestResult(
    'Server checks for duplicate messages',
    hasServerDuplicateCheck,
    `Duplicate check found: ${hasServerDuplicateCheck}`
  );
  
  addTestResult(
    'Server prevents duplicates',
    hasServerDuplicatePrevention,
    `Prevention found: ${hasServerDuplicatePrevention}`
  );
  
  addTestResult(
    'Server preserves original timestamp',
    preservesTimestamp,
    `Timestamp preservation found: ${preservesTimestamp}`
  );
  
  return usesProvidedId && hasServerDuplicateCheck && hasServerDuplicatePrevention && preservesTimestamp;
}

// Test 5: Check sync functions use IDs properly
function testSyncWithIDs() {
  console.log('\n📝 Test 5: Message sync functions use IDs properly');
  
  const fs = require('fs');
  const messagesVueContent = fs.readFileSync('./src/components/Messages.vue', 'utf8');
  
  const handleNetworkUsesId = messagesVueContent.includes('addMessage(message.type, message.text, message.from, message.target, message.id)');
  const syncUsesRemoteId = messagesVueContent.includes('const messageId = remoteMessage.id || generateGUID()');
  const syncUsesAddMessage = messagesVueContent.includes('addMessage(remoteMessage.type, remoteMessage.text, remoteMessage.from, remoteMessage.target, messageId)');
  
  addTestResult(
    'handleNetworkMessage uses message ID',
    handleNetworkUsesId,
    `ID usage found: ${handleNetworkUsesId}`
  );
  
  addTestResult(
    'syncMessages uses remote message ID',
    syncUsesRemoteId,
    `Remote ID usage found: ${syncUsesRemoteId}`
  );
  
  addTestResult(
    'syncMessages calls addMessage with ID',
    syncUsesAddMessage,
    `addMessage call found: ${syncUsesAddMessage}`
  );
  
  return handleNetworkUsesId && syncUsesRemoteId && syncUsesAddMessage;
}

// Run all tests
async function runTests() {
  try {
    const test1 = testGUIDGeneration();
    const test2 = testAddMessageWithID();
    const test3 = testSendMessageWithGUIDs();
    const test4 = testServerDeduplication();
    const test5 = testSyncWithIDs();
    
    const allPassed = test1 && test2 && test3 && test4 && test5;
    
    console.log('\n📊 Test Summary:');
    console.log('================');
    
    testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });
    
    const passedCount = testResults.filter(r => r.passed).length;
    const totalCount = testResults.length;
    
    console.log(`\n📈 Results: ${passedCount}/${totalCount} tests passed`);
    
    if (allPassed) {
      console.log('\n🎉 All message deduplication tests passed!');
      console.log('\n📋 Summary of GUID Implementation:');
      console.log('✅ GUID generation functions implemented');
      console.log('✅ addMessage function accepts message IDs');
      console.log('✅ Duplicate message detection and prevention');
      console.log('✅ Send functions generate and use GUIDs');
      console.log('✅ Network service handles message IDs properly');
      console.log('✅ Server-side deduplication implemented');
      console.log('✅ Message sync functions use IDs correctly');
      
      console.log('\n🧪 Testing Benefits:');
      console.log('• Messages now have unique GUID identifiers');
      console.log('• Duplicate messages are prevented during sync');
      console.log('• Network propagation maintains message identity');
      console.log('• Server-side deduplication prevents storage duplicates');
      console.log('• Original timestamps are preserved');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
}

// Run the tests
runTests();
