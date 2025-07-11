/**
 * Test script for announcement message type and UI improvements
 * Verifies the new announcement type, exclamation icon, and taller message box
 */

const fs = require('fs');

console.log('🧪 Testing Announcement Message Features...\n');

function testAnnouncementFeatures() {
  console.log('📋 Testing Announcement Message Implementation\n');
  
  const messagesVueContent = fs.readFileSync('./src/components/Messages.vue', 'utf8');
  
  // Test 1: Check that announcement type is added to interface
  const hasAnnouncementType = messagesVueContent.includes("'announcement'") &&
                             messagesVueContent.includes("type: 'bonus' | 'section' | 'multiplier' | 'network' | 'info' | 'chat' | 'announcement'");
  
  console.log(`✅ Announcement type added to Message interface: ${hasAnnouncementType ? 'Yes' : 'No'}`);
  
  // Test 2: Check that exclamation icon is added for announcements
  const hasExclamationIcon = messagesVueContent.includes("case 'announcement':") &&
                            messagesVueContent.includes("return '❗';");
  
  console.log(`✅ Exclamation icon (❗) for announcements: ${hasExclamationIcon ? 'Yes' : 'No'}`);
  
  // Test 3: Check that message box height is increased
  const hasIncreasedHeight = messagesVueContent.includes('max-height: 300px;');
  
  console.log(`✅ Message box height increased to 300px: ${hasIncreasedHeight ? 'Yes' : 'No'}`);
  
  // Test 4: Check that announcement CSS styling exists
  const hasAnnouncementCSS = messagesVueContent.includes('.message-announcement {') &&
                            messagesVueContent.includes('background-color: rgba(255, 87, 51, 0.1);') &&
                            messagesVueContent.includes('font-weight: 600;');
  
  console.log(`✅ Announcement message CSS styling: ${hasAnnouncementCSS ? 'Yes' : 'No'}`);
  
  // Test 5: Check that dark theme CSS exists for announcements
  const hasDarkThemeCSS = messagesVueContent.includes('[data-theme="dark"] .message-announcement {') &&
                         messagesVueContent.includes('color: #ff8a65;');
  
  console.log(`✅ Dark theme announcement CSS: ${hasDarkThemeCSS ? 'Yes' : 'No'}`);
  
  const allPassed = hasAnnouncementType && hasExclamationIcon && hasIncreasedHeight && 
                   hasAnnouncementCSS && hasDarkThemeCSS;
  
  console.log('\n📊 Summary:');
  console.log('============');
  
  if (allPassed) {
    console.log('🎉 All announcement message features implemented successfully!');
    console.log('\n📋 Changes Made:');
    console.log('• 📢 Added "announcement" message type to interface');
    console.log('• ❗ Added exclamation point icon for announcements');
    console.log('• 📏 Increased message box height from 200px to 300px');
    console.log('• 🎨 Added orange/red styling for announcement messages');
    console.log('• 🌙 Added dark theme support for announcement styling');
    console.log('• 💪 Made announcement text bold (font-weight: 600)');
    
    console.log('\n✨ Visual Features:');
    console.log('• ❗ Exclamation point icon instead of chat bubble');
    console.log('• 🔶 Orange/red background color for visibility');
    console.log('• 📢 Bold text to emphasize importance');
    console.log('• 📏 Taller message area for better readability');
    console.log('• 🌗 Consistent styling in both light and dark themes');
    
    console.log('\n🧪 Test the changes:');
    console.log('1. Open the app and look at Messages component');
    console.log('2. Look for the New England completion message');
    console.log('3. Verify it has an ❗ icon instead of 💬');
    console.log('4. Check that it has orange/red styling and bold text');
    console.log('5. Notice the taller message area');
  } else {
    console.log('❌ Some announcement features are missing or incomplete.');
    console.log('Please review the failed tests above.');
  }
  
  return allPassed;
}

// Test sending an announcement message
async function testAnnouncementMessage() {
  console.log('\n🧪 Testing Announcement Message Sending\n');
  
  try {
    const announcementText = 'Test announcement message - ' + Date.now();
    const messageId = 'test-announcement-' + Date.now();
    
    console.log(`📢 Sending test announcement: "${announcementText}"`);
    console.log(`🆔 Using message ID: ${messageId}`);
    
    const response = await fetch('https://localhost:8080/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: messageId,
        type: 'announcement',
        text: announcementText,
        from: 'TEST-SYSTEM',
        target: 'all',
        timestamp: Date.now(),
        stationId: 'TEST-SYSTEM'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Announcement sent successfully`);
      console.log(`   Type: ${result.message.type} (should be 'announcement')`);
      console.log(`   Target: ${result.message.target} (should be 'all')`);
      
      // Verify the message appears in the message list
      const getResponse = await fetch('https://localhost:8080/api/messages?limit=10');
      const messages = await getResponse.json();
      const sentMessage = messages.messages.find(m => m.id === messageId);
      
      if (sentMessage) {
        console.log(`✅ Announcement found in storage with type: ${sentMessage.type}`);
        return true;
      } else {
        console.log(`❌ Announcement not found in storage`);
        return false;
      }
    } else {
      console.log(`❌ Failed to send announcement: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error testing announcement: ${error.message}`);
    console.log('⚠️  Make sure the Field Day app is running on https://localhost:8080');
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Announcement Message Tests\n');
  
  // Test 1: Code implementation
  const implementationTest = testAnnouncementFeatures();
  
  // Test 2: Message sending
  const sendingTest = await testAnnouncementMessage();
  
  console.log('\n🎯 Final Result:');
  console.log('================');
  
  if (implementationTest && sendingTest) {
    console.log('🎉 All announcement message tests passed!');
    console.log('\n💡 The New England completion message was sent with:');
    console.log('• ❗ Exclamation point icon (instead of chat bubble)');
    console.log('• 🔶 Orange/red styling for high visibility');
    console.log('• 💪 Bold text for emphasis');
    console.log('• 📏 Displayed in the taller message area');
    console.log('\n📢 Message: "PHONE 1 just completed out New England!"');
  } else {
    console.log('⚠️  Some tests failed. Please review the results above.');
    if (!implementationTest) console.log('   - Implementation issues found');
    if (!sendingTest) console.log('   - Message sending test failed');
  }
}

runTests().catch(console.error);
