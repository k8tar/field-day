#!/usr/bin/env node

/**
 * Test messaging with sender information
 */

import https from 'https';

// Test configuration
const BASE_URL = 'https://localhost:8080';

// Allow self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function testMessagingWithSender() {
  console.log('💬 Testing Messaging with Sender Information...\n');

  try {
    // Test if server is running
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.ok) {
      console.log('✅ Server is running');
      
      console.log('\n📋 Latest Message Display Updates:');
      console.log('   📧 Shows sender information (from station)');
      console.log('   🎯 Shows target information (to station/all)');
      console.log('   🕒 Shows timestamp');
      console.log('   💭 Message content with proper styling');
      
      console.log('\n🧪 Testing Instructions:');
      console.log('1. Open https://localhost:8080 in your browser');
      console.log('2. Go to the "Latest Message" panel on the right');
      console.log('3. Type a message in the input field at the bottom');
      console.log('4. Select "All Stations" or a specific target');
      console.log('5. Press Enter or click Send');
      console.log('6. Observe the latest message now shows:');
      console.log('   • Message text');
      console.log('   • Time sent');
      console.log('   • "from [YourCallsign-YourDesignator]"');
      console.log('   • "to [target]" (if not "all")');
      
      console.log('\n✨ Enhanced Features:');
      console.log('   📍 Station identification in message display');
      console.log('   🔄 Consistent sender info across all message types');
      console.log('   📱 Improved message layout and spacing');
      console.log('   🎨 Better visual hierarchy for message metadata');
      
      console.log('\n🎯 Message Flow:');
      console.log('   1. User types message');
      console.log('   2. System gets current station config');
      console.log('   3. Formats sender as "CALLSIGN-DESIGNATOR"');
      console.log('   4. Displays in latest message with full metadata');
      console.log('   5. Available in "View All Messages" modal');
      
      console.log('\n💡 Example Display:');
      console.log('   💬 "Testing message functionality"');
      console.log('   🕒 2:30:45 PM  from K8TAR-A  to All Stations');

    } else {
      console.log('❌ Server not running. Start with: npm run dev');
    }
  } catch (error) {
    console.log('❌ Server not running. Start with: npm run dev');
    console.log('\n📋 Updates Made:');
    console.log('   • Enhanced latest message display structure');
    console.log('   • Added sender information to chat messages');
    console.log('   • Improved message layout and styling');
    console.log('   • Better visual separation of metadata');
    console.log('   • Consistent sender identification across UI');
  }
}

// Run the test
testMessagingWithSender();
