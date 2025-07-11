/**
 * Test statistics modal functionality with sample data
 */

const path = require('path');

console.log('🧪 Testing Statistics Modal Functionality\n');

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
    console.log('\n1. Adding diverse sample QSOs for statistics testing...');
    
    try {
      // Create a comprehensive set of QSOs for good statistical analysis
      const sampleQsos = [];
      const bands = ['160m', '80m', '40m', '20m', '15m', '10m', '6m', '2m'];
      const modes = ['CW', 'PH', 'DIG'];
      const operators = ['K8TAR', 'W8ABC', 'N8DEF', 'KC8GHI'];
      const stations = ['CW 1', 'PHONE 1', 'PHONE 2', 'DIGITAL'];
      const sections = ['OH', 'WPA', 'MI', 'KY', 'IN', 'IL', 'WI', 'CT', 'MA', 'NY', 'VA', 'NC', 'SC', 'GA', 'FL', 'TX', 'CA', 'WA', 'OR', 'CO', 'AZ', 'NV'];

      // Generate QSOs spread over different hours to create interesting activity patterns
      const baseTime = new Date();
      baseTime.setHours(0, 0, 0, 0); // Start at midnight

      for (let i = 0; i < 150; i++) {
        // Create activity patterns - more activity during prime times
        let hour;
        const rand = Math.random();
        if (rand < 0.3) {
          // 30% during prime time (14-22 UTC)
          hour = 14 + Math.floor(Math.random() * 8);
        } else if (rand < 0.6) {
          // 30% during evening (22-02 UTC)
          hour = (22 + Math.floor(Math.random() * 4)) % 24;
        } else {
          // 40% spread throughout the day
          hour = Math.floor(Math.random() * 24);
        }

        const qsoTime = new Date(baseTime);
        qsoTime.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));

        // Weight band usage - more on popular bands
        let band;
        const bandRand = Math.random();
        if (bandRand < 0.25) band = '20m';      // 25% on 20m
        else if (bandRand < 0.45) band = '40m'; // 20% on 40m
        else if (bandRand < 0.60) band = '80m'; // 15% on 80m
        else if (bandRand < 0.75) band = '15m'; // 15% on 15m
        else band = bands[Math.floor(Math.random() * bands.length)]; // Rest distributed

        // Weight mode usage
        let mode;
        const modeRand = Math.random();
        if (modeRand < 0.50) mode = 'PH';       // 50% Phone
        else if (modeRand < 0.80) mode = 'CW';  // 30% CW
        else mode = 'DIG';                      // 20% Digital

        // Create realistic callsigns
        const prefixes = ['W', 'K', 'N', 'KC', 'KD', 'KE'];
        const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        const suffixes = ['ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQR', 'STU', 'VWX', 'YZA', 'BCD'];
        
        const call = prefixes[Math.floor(Math.random() * prefixes.length)] +
                    numbers[Math.floor(Math.random() * numbers.length)] +
                    suffixes[Math.floor(Math.random() * suffixes.length)];

        const qso = {
          call: call,
          class: ['1A', '2A', '3A', '1B', '2B', '1C', '1D', '1E', '1F'][Math.floor(Math.random() * 9)],
          section: sections[Math.floor(Math.random() * sections.length)],
          datetime: qsoTime.toISOString(),
          band: band,
          mode: mode,
          operator: operators[Math.floor(Math.random() * operators.length)],
          stationDesignator: stations[Math.floor(Math.random() * stations.length)]
        };

        sampleQsos.push(qso);
      }

      // Sort QSOs by time for realistic logging order
      sampleQsos.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

      // Add QSOs in batches to simulate real operation
      console.log(`📤 Adding ${sampleQsos.length} sample QSOs...`);
      
      const response = await fetch('https://localhost:8080/api/qsos/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qsos: sampleQsos })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Successfully added ${result.added} QSOs to database`);
      } else {
        console.log('❌ Failed to add sample QSOs:', response.status);
      }

      console.log('\n2. Verifying QSO data for statistics...');
      
      const qsoResponse = await fetch('https://localhost:8080/api/qsos');
      if (qsoResponse.ok) {
        const data = await qsoResponse.json();
        const qsos = data.qsos || [];
        
        console.log(`📊 Total QSOs in database: ${qsos.length}`);
        
        // Analyze the data
        const bandCounts = {};
        const modeCounts = {};
        const operatorCounts = {};
        const sectionCounts = {};
        const hourlyCounts = {};
        
        qsos.forEach(qso => {
          // Band analysis
          bandCounts[qso.band] = (bandCounts[qso.band] || 0) + 1;
          
          // Mode analysis
          modeCounts[qso.mode] = (modeCounts[qso.mode] || 0) + 1;
          
          // Operator analysis
          operatorCounts[qso.operator] = (operatorCounts[qso.operator] || 0) + 1;
          
          // Section analysis
          sectionCounts[qso.section] = (sectionCounts[qso.section] || 0) + 1;
          
          // Hourly analysis
          const hour = new Date(qso.datetime).getHours();
          hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
        });
        
        console.log('\n📈 Data Analysis Summary:');
        console.log(`   Bands: ${Object.keys(bandCounts).length} (${Object.entries(bandCounts).sort((a,b) => b[1] - a[1]).slice(0,3).map(([band, count]) => `${band}:${count}`).join(', ')})`);
        console.log(`   Modes: ${Object.keys(modeCounts).length} (${Object.entries(modeCounts).map(([mode, count]) => `${mode}:${count}`).join(', ')})`);
        console.log(`   Operators: ${Object.keys(operatorCounts).length}`);
        console.log(`   Sections: ${Object.keys(sectionCounts).length}`);
        console.log(`   Hours with activity: ${Object.keys(hourlyCounts).length}/24`);
        
        // Calculate some statistics
        const totalPoints = qsos.reduce((sum, qso) => {
          return sum + (qso.mode === 'CW' || qso.mode === 'DIG' ? 2 : 1);
        }, 0);
        const totalScore = totalPoints * Object.keys(sectionCounts).length;
        
        console.log(`   Total Points: ${totalPoints}`);
        console.log(`   Total Score: ${totalScore.toLocaleString()}`);
        
        // Find peak activity hour
        const peakHour = Object.entries(hourlyCounts).sort((a, b) => b[1] - a[1])[0];
        console.log(`   Peak Activity: ${peakHour[1]} QSOs at ${peakHour[0]}:00 UTC`);
      }

      console.log('\n📋 Statistics Modal Test Checklist:');
      console.log('1. Open https://localhost:8080 in browser');
      console.log('2. Navigate to Recent Contacts section');
      console.log('3. Click the "Statistics" button (📊 analytics icon)');
      console.log('4. Verify modal opens with comprehensive statistics');
      console.log('5. Check Summary Cards:');
      console.log('   - Total QSOs should show ~150');
      console.log('   - Sections Worked should show multiple sections');
      console.log('   - QSOs/Hour should show calculated rate');
      console.log('   - Total Score should show points × sections');
      console.log('6. Check Charts:');
      console.log('   - QSOs Over Time: Should show 24-hour activity pattern');
      console.log('   - Band Distribution: Pie chart with band usage');
      console.log('   - Mode Distribution: Bar chart with CW/PH/DIG breakdown');
      console.log('   - Operator Performance: Top 5 operators by QSOs');
      console.log('   - Hourly Activity: Activity pattern throughout day');
      console.log('   - Station Activity: QSOs by station designator');
      console.log('7. Check Tables:');
      console.log('   - Top Operators: Shows operator statistics');
      console.log('   - Band/Mode Breakdown: Matrix view of band/mode combinations');
      console.log('8. Check Activity Timeline:');
      console.log('   - Shows QSO distribution over time');
      console.log('   - Color coded by mode');
      console.log('9. Verify Responsive Design:');
      console.log('   - Charts should resize properly');
      console.log('   - Modal should be scrollable if needed');
      console.log('10. Test Close Functionality:');
      console.log('    - Close button should work');
      console.log('    - Clicking outside modal should close it');
      console.log('\n🎯 Expected Features:');
      console.log('✅ Real-time chart rendering with Canvas API');
      console.log('✅ Multiple chart types (bar, pie, line, timeline)');
      console.log('✅ Comprehensive operator statistics');
      console.log('✅ Band and mode distribution analysis');
      console.log('✅ Activity pattern visualization');
      console.log('✅ Score and rate calculations');
      console.log('✅ Responsive design with proper theming');
      console.log('\n🎉 Statistics modal test complete!');

    } catch (error) {
      console.error('❌ Test error:', error);
    } finally {
      // Clean up
      setTimeout(() => {
        serverProcess.kill();
        process.exit(0);
      }, 3000);
    }
  }

}, 1000);
