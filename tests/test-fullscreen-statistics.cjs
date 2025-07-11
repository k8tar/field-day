/**
 * Test full-screen statistics modal with comprehensive data
 */

const path = require('path');

console.log('🧪 Testing Full-Screen Statistics Modal\n');

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
    console.log('\n1. Populating database with comprehensive test data...');
    
    try {
      // Clear existing data first
      await fetch('https://localhost:8080/api/messages', { method: 'DELETE' });
      
      // Generate comprehensive QSO data for meaningful statistics
      const bands = ['160m', '80m', '40m', '20m', '15m', '10m', '6m', '2m'];
      const modes = ['PH', 'CW', 'DIG'];
      const operators = ['W8XYZ', 'K8ABC', 'N8DEF', 'KC8GHI'];
      const sections = [
        'CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA', // New England
        'ENY', 'NNY', 'WNY', // Hudson
        'NLI', 'NNJ', 'SNJ', // Atlantic
        'EPA', 'WPA', // Atlantic
        'OH', 'MI', 'KY', // Great Lakes
        'IL', 'IN', 'WI', // Central
        'IA', 'KS', 'MO', 'NE', // Midwest
        'AL', 'GA', 'NFL', 'SFL', // Southeastern
        'NC', 'SC', 'VA', 'WV', // Roanoke
        'AR', 'LA', 'MS', 'TN', // Delta
        'TX', 'OK', 'NM', // West Gulf
        'CO', 'UT', 'WY', // Rocky Mountain
        'AZ', 'NV', // Southwestern
        'CA', 'HI', 'NV', 'PAC', // Pacific
        'AK', 'ID', 'MT', 'OR', 'WA', // Northwestern
        'MN', 'ND', 'SD', // Dakota
        'AB', 'BC', 'MB', 'ON', 'QC', 'SK', // Canada
        'DX' // International
      ];
      
      const callsigns = [
        'W1AW', 'K1ABC', 'N1DEF', 'KC1GHI', 'WA1JKL', // New England
        'W2XYZ', 'K2MNO', 'N2PQR', 'KC2STU', 'WA2VWX', // Atlantic/Hudson
        'W3ABC', 'K3DEF', 'N3GHI', 'KC3JKL', 'WA3MNO', // Atlantic
        'W4PQR', 'K4STU', 'N4VWX', 'KC4YZA', 'WA4BCD', // Southeastern/Roanoke
        'W5EFG', 'K5HIJ', 'N5KLM', 'KC5NOP', 'WA5QRS', // West Gulf/Delta
        'W6TUV', 'K6WXY', 'N6ZAB', 'KC6CDE', 'WA6FGH', // Pacific
        'W7IJK', 'K7LMN', 'N7OPQ', 'KC7RST', 'WA7UVW', // Northwestern
        'W8XYZ', 'K8ABC', 'N8DEF', 'KC8GHI', 'WA8JKL', // Great Lakes
        'W9MNO', 'K9PQR', 'N9STU', 'KC9VWX', 'WA9YZA', // Central
        'W0BCD', 'K0EFG', 'N0HIJ', 'KC0KLM', 'WA0NOP', // Midwest/Dakota/Rocky
        'VE1ABC', 'VE2DEF', 'VE3GHI', 'VE7JKL', 'VE9MNO', // Canada
        'JA1ABC', 'G0DEF', 'VK1GHI', 'PY2JKL', 'EA1MNO' // DX
      ];
      
      const classes = ['1A', '2A', '3A', '4A', '5A', '6A', '1B', '2B', '3B', '1C', '2C', '1D', '2D', '1E', '2E', '1F'];
      
      // Generate QSOs over a 24-hour period with realistic patterns
      const startTime = new Date();
      startTime.setHours(14, 0, 0, 0); // Start at 2 PM (18:00 UTC)
      
      const qsos = [];
      let qsoId = 1;
      
      // Generate activity patterns throughout the day
      for (let hour = 0; hour < 24; hour++) {
        // Simulate activity patterns (higher activity during peak hours)
        let qsosThisHour;
        if (hour >= 0 && hour < 6) qsosThisHour = Math.floor(Math.random() * 20) + 10; // Early morning
        else if (hour >= 6 && hour < 12) qsosThisHour = Math.floor(Math.random() * 40) + 30; // Morning peak
        else if (hour >= 12 && hour < 18) qsosThisHour = Math.floor(Math.random() * 60) + 40; // Afternoon peak
        else qsosThisHour = Math.floor(Math.random() * 30) + 20; // Evening
        
        for (let q = 0; q < qsosThisHour; q++) {
          const qsoTime = new Date(startTime.getTime() + (hour * 60 + Math.random() * 60) * 60 * 1000);
          
          // Weight band selection by time of day
          let bandWeights;
          if (hour >= 0 && hour < 8) bandWeights = [0.3, 0.4, 0.2, 0.05, 0.03, 0.01, 0.005, 0.005]; // Low bands during night
          else if (hour >= 8 && hour < 16) bandWeights = [0.05, 0.1, 0.25, 0.3, 0.2, 0.08, 0.015, 0.005]; // High bands during day
          else bandWeights = [0.15, 0.25, 0.3, 0.2, 0.08, 0.015, 0.003, 0.002]; // Mixed during evening
          
          const band = weightedRandom(bands, bandWeights);
          const mode = weightedRandom(modes, [0.6, 0.25, 0.15]); // Phone favored in Field Day
          const operator = operators[Math.floor(Math.random() * operators.length)];
          const callsign = callsigns[Math.floor(Math.random() * callsigns.length)];
          const section = sections[Math.floor(Math.random() * sections.length)];
          const qsoClass = classes[Math.floor(Math.random() * classes.length)];
          
          qsos.push({
            id: qsoId++,
            call: callsign,
            class: qsoClass,
            section: section,
            datetime: qsoTime.toISOString(),
            band: band,
            mode: mode,
            operator: operator,
            stationDesignator: 'PHONE 1',
            timestamp: qsoTime.getTime()
          });
        }
      }
      
      console.log(`Generated ${qsos.length} test QSOs`);
      
      // Upload QSOs in batches to avoid overwhelming the server
      const batchSize = 50;
      for (let i = 0; i < qsos.length; i += batchSize) {
        const batch = qsos.slice(i, i + batchSize);
        
        const response = await fetch('https://localhost:8080/api/qsos/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qsos: batch })
        });

        if (response.ok) {
          console.log(`✅ Uploaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(qsos.length/batchSize)}`);
        } else {
          console.log(`❌ Failed to upload batch ${Math.floor(i/batchSize) + 1}`);
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log('\n2. QSO Statistics Summary:');
      console.log(`📊 Total QSOs: ${qsos.length}`);
      console.log(`📡 Unique Sections: ${new Set(qsos.map(q => q.section)).size}`);
      console.log(`👥 Operators: ${operators.join(', ')}`);
      
      const bandCounts = {};
      const modeCounts = {};
      const hourCounts = {};
      
      qsos.forEach(qso => {
        bandCounts[qso.band] = (bandCounts[qso.band] || 0) + 1;
        modeCounts[qso.mode] = (modeCounts[qso.mode] || 0) + 1;
        const hour = new Date(qso.datetime).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      
      console.log(`📻 Band Distribution:`, bandCounts);
      console.log(`📡 Mode Distribution:`, modeCounts);
      console.log(`⏰ Peak Hour: ${Object.entries(hourCounts).sort((a,b) => b[1] - a[1])[0][0]}:00 (${Object.entries(hourCounts).sort((a,b) => b[1] - a[1])[0][1]} QSOs)`);

      console.log('\n📋 Full-Screen Statistics Modal Test Checklist:');
      console.log('1. Open https://localhost:8080 in browser');
      console.log('2. Navigate to Recent Contacts section');
      console.log('3. Click the "Statistics" button (analytics icon)');
      console.log('4. Verify modal opens in full-screen mode');
      console.log('5. Check that charts are properly sized and visible');
      console.log('6. Verify all statistics are calculated correctly:');
      console.log(`   - Total QSOs: ${qsos.length}`);
      console.log(`   - Sections Worked: ${new Set(qsos.map(q => q.section)).size}`);
      console.log('   - QSOs/Hour rate shows realistic value');
      console.log('   - Score calculation is accurate');
      console.log('7. Test chart interactivity and responsiveness');
      console.log('8. Verify modal closes properly with close button or ESC');
      console.log('9. Test on different screen sizes if possible');
      console.log('\n🎉 Full-screen statistics modal test data loaded!');

    } catch (error) {
      console.error('❌ Test error:', error);
    } finally {
      // Keep server running for manual testing
      console.log('\n⏳ Server will remain running for manual testing...');
      console.log('Press Ctrl+C to stop the server when done testing.');
    }
  }

  // Helper function for weighted random selection
  function weightedRandom(items, weights) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    
    return items[items.length - 1];
  }

}, 1000);
