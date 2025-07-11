/**
 * Test achievement notifications and connected station count display
 */

const path = require('path');

console.log('🧪 Testing Achievement Notifications and Connected Station Count\n');

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
      
      // Run tests
      setTimeout(runTests, 2000);
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

  async function runTests() {
    console.log('\n1. Testing achievement system by adding sample QSOs...');
    
    try {
      // Add some sample QSOs to trigger achievement notifications
      const sampleQsos = [
        { call: 'W1AW', class: '1A', section: 'CT', band: '20m', mode: 'PH', operator: 'TEST' },
        { call: 'K1ABC', class: '2A', section: 'MA', band: '40m', mode: 'CW', operator: 'TEST' },
        { call: 'N2DEF', class: '1B', section: 'NJ', band: '80m', mode: 'DIG', operator: 'TEST' },
        { call: 'W3GHI', class: '3A', section: 'PA', band: '15m', mode: 'PH', operator: 'TEST' },
        { call: 'K4JKL', class: '1A', section: 'SC', band: '10m', mode: 'CW', operator: 'TEST' },
        { call: 'W5MNO', class: '2B', section: 'TX', band: '6m', mode: 'DIG', operator: 'TEST' },
        { call: 'K6PQR', class: '1A', section: 'CA', band: '2m', mode: 'PH', operator: 'TEST' },
        { call: 'W7STU', class: '1A', section: 'WA', band: '20m', mode: 'CW', operator: 'TEST' },
        { call: 'K8VWX', class: '2A', section: 'OH', band: '40m', mode: 'PH', operator: 'TEST' },
        { call: 'W9YZA', class: '1A', section: 'IL', band: '80m', mode: 'DIG', operator: 'TEST' }
      ];

      // Add QSOs one by one to trigger achievement checks
      for (let i = 0; i < sampleQsos.length; i++) {
        const qso = sampleQsos[i];
        
        const response = await fetch('https://localhost:8080/api/qsos/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qsos: [qso] })
        });

        if (response.ok) {
          console.log(`✅ Added QSO ${i + 1}: ${qso.call} (${qso.section})`);
          
          // Wait a bit between QSOs to allow achievement processing
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log(`❌ Failed to add QSO ${i + 1}: ${qso.call}`);
        }
      }

      console.log('\n2. Checking messages for achievement notifications...');
      
      // Wait a bit for achievement processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const messagesResponse = await fetch('https://localhost:8080/api/messages');
      if (messagesResponse.ok) {
        const data = await messagesResponse.json();
        const messages = data.messages || [];
        
        console.log(`📨 Found ${messages.length} messages`);
        
        const achievementMessages = messages.filter(m => 
          ['bonus', 'section', 'multiplier', 'announcement'].includes(m.type)
        );
        
        console.log(`🏆 Achievement messages: ${achievementMessages.length}`);
        
        achievementMessages.forEach((msg, index) => {
          console.log(`  ${index + 1}. [${msg.type}] ${msg.text}`);
        });
      }

      console.log('\n3. Testing bonus completion notifications...');
      
      // Simulate completing a bonus via API
      const bonusMessage = {
        id: 'test-bonus-' + Date.now(),
        type: 'bonus',
        text: '⭐ Bonus completed: Emergency Power (+100 points)',
        from: 'TEST-STATION',
        target: 'all',
        timestamp: Date.now(),
        stationId: 'TEST-STATION'
      };

      const bonusResponse = await fetch('https://localhost:8080/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bonusMessage)
      });

      if (bonusResponse.ok) {
        console.log('✅ Bonus completion notification sent');
      }

      console.log('\n4. Testing section completion announcement...');
      
      // Simulate section completion announcement
      const sectionMessage = {
        id: 'test-section-' + Date.now(),
        type: 'announcement',
        text: '❗ PHONE 1 just completed out New England Division!',
        from: 'TEST-STATION',
        target: 'all',
        timestamp: Date.now(),
        stationId: 'TEST-STATION'
      };

      const sectionResponse = await fetch('https://localhost:8080/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionMessage)
      });

      if (sectionResponse.ok) {
        console.log('✅ Section completion announcement sent');
      }

      console.log('\n📋 Manual UI Test Checklist:');
      console.log('1. Open https://localhost:8080 in browser');
      console.log('2. Check header - network icon should show station count if connected');
      console.log('3. Check Messages component for achievement notifications');
      console.log('4. Look for different message types:');
      console.log('   - 🎯 Section worked notifications');
      console.log('   - ✨ Multiplier milestone achievements');
      console.log('   - ⭐ Bonus completion notifications');
      console.log('   - ❗ Division completion announcements');
      console.log('5. Add more QSOs to trigger achievement notifications');
      console.log('6. Complete bonuses to see bonus notifications');
      console.log('7. Watch for milestone achievements (50, 100+ QSOs)');
      console.log('8. Check that station count badge appears on network icon when stations connect');
      console.log('\n✅ Achievement notification system test complete!');

    } catch (error) {
      console.error('❌ Test error:', error);
    } finally {
      // Clean up
      setTimeout(() => {
        serverProcess.kill();
        process.exit(0);
      }, 2000);
    }
  }

}, 1000);
