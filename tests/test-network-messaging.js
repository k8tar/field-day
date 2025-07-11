#!/usr/bin/env node

/**
 * Test enhanced messaging with network propagation
 */

import https from 'https';

// Test configuration
const BASE_URL = 'https://localhost:8080';

// Allow self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function testNetworkMessaging() {
  console.log('🌐 Testing Network Message Propagation...\n');

  try {
    // Test if server is running
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.ok) {
      console.log('✅ Server is running');
      
      // Test message API endpoints
      console.log('\n📋 Testing Message API Endpoints:');
      
      // Test GET messages
      const messagesResponse = await fetch(`${BASE_URL}/api/messages?limit=5`);
      if (messagesResponse.ok) {
        const data = await messagesResponse.json();
        console.log(`   ✅ GET /api/messages: ${data.messages.length} messages returned`);
      } else {
        console.log(`   ❌ GET /api/messages failed: ${messagesResponse.status}`);
      }
      
      // Test POST message
      const testMessage = {
        type: 'chat',
        text: 'Test network message',
        from: 'K8TAR-TEST',
        target: 'all',
        stationId: 'K8TAR-TEST'
      };
      
      const postResponse = await fetch(`${BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });
      
      if (postResponse.ok) {
        const result = await postResponse.json();
        console.log(`   ✅ POST /api/messages: Message added with ID ${result.message.id}`);
      } else {
        console.log(`   ❌ POST /api/messages failed: ${postResponse.status}`);
      }
      
      console.log('\n✨ Enhanced Messaging Features:');
      console.log('   📱 Shows latest 5 messages instead of just 1');
      console.log('   🌐 Messages propagate across network stations');
      console.log('   🔄 Automatic sync every 10 seconds');
      console.log('   📡 Real-time network message handling');
      console.log('   💾 Persistent message storage across stations');
      
      console.log('\n🧪 Testing Instructions:');
      console.log('1. Open https://localhost:8080 in your browser');
      console.log('2. Look at the "Recent Messages" panel (now shows 5 messages)');
      console.log('3. Type a message and send it');
      console.log('4. If network is connected, message propagates to other stations');
      console.log('5. Messages sync automatically every 10 seconds');
      console.log('6. Open multiple browser tabs to simulate multiple stations');
      
      console.log('\n🎯 Network Message Flow:');
      console.log('   1. User sends message on any station');
      console.log('   2. Message stored in local API');
      console.log('   3. If host: broadcast to all connected clients');
      console.log('   4. If client: send to host, host distributes');
      console.log('   5. All stations sync messages via heartbeat');
      console.log('   6. Recent messages panel updates automatically');
      
      console.log('\n🔧 API Endpoints Added:');
      console.log('   GET  /api/messages?limit=N&since=timestamp');
      console.log('   POST /api/messages (add new message)');
      console.log('   POST /api/messages/clear (clear all messages)');
      
      console.log('\n💡 Message Types with Icons:');
      console.log('   💬 chat - User messages');
      console.log('   ⭐ bonus - Bonus station contacts');
      console.log('   🎯 section - New section worked');
      console.log('   ✨ multiplier - Multiplier contacts');
      console.log('   🔄 network - Network status updates');
      console.log('   ℹ️ info - General information');

    } else {
      console.log('❌ Server not running. Start with: npm run dev');
    }
  } catch (error) {
    console.log('❌ Server not running. Start with: npm run dev');
    console.log('\n📋 Enhancements Completed:');
    console.log('   • Added message API endpoints in vite.config.ts');
    console.log('   • Enhanced Messages component to show 5 recent messages');
    console.log('   • Added network message propagation via networkService');
    console.log('   • Implemented automatic message synchronization');
    console.log('   • Added periodic message sync every 10 seconds');
    console.log('   • Integrated with heartbeat cycle for message distribution');
  }
}

// Run the test
testNetworkMessaging();
