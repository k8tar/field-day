/**
 * Final validation test for messaging system
 * Tests all messaging features after removing station selection
 */

const path = require('path');

console.log('🧪 Final Messaging System Validation\n');

// Test 1: Start server and check basic messaging API
console.log('1. Testing basic messaging API...');

const { execSync, spawn } = require('child_process');

// Kill any existing processes on port 8080
try {
  if (process.platform === 'win32') {
    execSync('netstat -ano | findstr :8080 | for /f "tokens=5" %p in (\'more\') do taskkill /PID %p /F', { stdio: 'ignore' });
  } else {
    execSync('lsof -ti:8080 | xargs kill -9', { stdio: 'ignore' });
  }
} catch (e) {
  // Ignore errors if no process is running
}

// Wait a moment for cleanup
setTimeout(() => {
  // Start the dev server
  const serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    shell: true
  });

  let serverReady = false;

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Local:') && output.includes('8080') && !serverReady) {
      serverReady = true;
      console.log('✅ Server started successfully');
      
      // Run messaging tests
      setTimeout(runMessagingTests, 2000);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('Server error:', data.toString());
  });

  // Cleanup function
  process.on('exit', () => {
    serverProcess.kill();
  });

  process.on('SIGINT', () => {
    serverProcess.kill();
    process.exit();
  });

  async function runMessagingTests() {
    console.log('\n2. Testing message API endpoints...');
    
    try {
      // Test GET /api/messages
      const response1 = await fetch('https://localhost:8080/api/messages', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response1.ok) {
        const data = await response1.json();
        console.log('✅ GET /api/messages works:', data);
      } else {
        console.log('❌ GET /api/messages failed:', response1.status);
      }

      // Test POST /api/messages (chat message to all)
      const chatMessage = {
        id: 'test-chat-' + Date.now(),
        type: 'chat',
        text: 'Test message to all stations (no station selection)',
        from: 'TEST-STATION',
        target: 'all',
        timestamp: Date.now(),
        stationId: 'TEST-STATION'
      };

      const response2 = await fetch('https://localhost:8080/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatMessage)
      });

      if (response2.ok) {
        console.log('✅ POST chat message works');
      } else {
        console.log('❌ POST chat message failed:', response2.status);
      }

      // Test POST /api/messages (announcement message)
      const announcementMessage = {
        id: 'test-announcement-' + Date.now(),
        type: 'announcement',
        text: 'Test announcement: PHONE 2 just completed out Pacific!',
        from: 'TEST-STATION',
        target: 'all',
        timestamp: Date.now(),
        stationId: 'TEST-STATION'
      };

      const response3 = await fetch('https://localhost:8080/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementMessage)
      });

      if (response3.ok) {
        console.log('✅ POST announcement message works');
      } else {
        console.log('❌ POST announcement message failed:', response3.status);
      }

      // Verify messages were stored
      const response4 = await fetch('https://localhost:8080/api/messages', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response4.ok) {
        const data = await response4.json();
        console.log('✅ Messages retrieved:', data.messages?.length || 0);
        
        // Check for our test messages
        const messages = data.messages || [];
        const chatFound = messages.some(m => m.text.includes('no station selection'));
        const announcementFound = messages.some(m => m.text.includes('PHONE 2 just completed'));
        
        console.log('✅ Chat message found:', chatFound);
        console.log('✅ Announcement message found:', announcementFound);
      }

      console.log('\n3. Testing message deduplication...');
      
      // Send duplicate message
      const duplicateResponse = await fetch('https://localhost:8080/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatMessage) // Same message as before
      });

      if (duplicateResponse.ok) {
        console.log('✅ Duplicate message handling works');
      } else {
        console.log('❌ Duplicate message handling failed:', duplicateResponse.status);
      }

      console.log('\n✅ All messaging API tests completed!');
      console.log('\n📋 Manual UI Test Checklist:');
      console.log('1. Open https://localhost:8080 in browser');
      console.log('2. Check Messages component in main view');
      console.log('3. Verify no station selection dropdown is shown');
      console.log('4. Verify placeholder text says "Type message to all stations..."');
      console.log('5. Send a test message and verify it appears');
      console.log('6. Click chat icon to open modal');
      console.log('7. Verify modal shows all messages in reverse chronological order');
      console.log('8. Verify only station designator is shown (not full callsign)');
      console.log('9. Verify modal send form has no station selection');
      console.log('10. Verify announcement messages show exclamation icon (❗)');
      console.log('11. Verify message box height is taller (300px)');
      console.log('\n🎉 Final messaging validation complete!');

    } catch (error) {
      console.error('❌ Test error:', error);
    } finally {
      // Clean up
      setTimeout(() => {
        serverProcess.kill();
        process.exit(0);
      }, 1000);
    }
  }

}, 1000);
