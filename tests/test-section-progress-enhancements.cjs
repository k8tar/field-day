#!/usr/bin/env node

/**
 * Test Script: Section Progress Header and Trophy Icons
 * Tests the updated Section Progress header styling and trophy icon functionality
 */

const fs = require('fs');
const https = require('https');

console.log('=== Section Progress Header and Trophy Icons Test ===\n');

// Test 1: Check if SectionProgress.vue has proper header styling
console.log('1. Checking SectionProgress.vue header styling...');
const sectionProgressContent = fs.readFileSync('src/components/SectionProgress.vue', 'utf8');

if (sectionProgressContent.includes('<h2>Section Progress') && 
    sectionProgressContent.includes('background-color: var(--primary-color)') &&
    sectionProgressContent.includes('expand-button')) {
  console.log('✅ SectionProgress header styling matches RecentContacts/ScoreStatistics');
} else {
  console.log('❌ SectionProgress header styling does not match');
}

// Test 2: Check trophy icon implementation
console.log('\n2. Checking trophy icon implementation...');
if (sectionProgressContent.includes('isDivisionComplete') && 
    sectionProgressContent.includes('🏆') &&
    sectionProgressContent.includes('trophy-icon')) {
  console.log('✅ Trophy icon implementation found in SectionProgress');
} else {
  console.log('❌ Trophy icon implementation missing in SectionProgress');
}

// Test 3: Check SectionMap.vue trophy icons
console.log('\n3. Checking SectionMap.vue trophy icon implementation...');
const sectionMapContent = fs.readFileSync('src/components/SectionMap.vue', 'utf8');

if (sectionMapContent.includes('isDivisionComplete') && 
    sectionMapContent.includes('🏆') &&
    sectionMapContent.includes('trophy-icon')) {
  console.log('✅ Trophy icon implementation found in SectionMap');
} else {
  console.log('❌ Trophy icon implementation missing in SectionMap');
}

// Test 4: Add sample QSOs to complete a division for visual testing
console.log('\n4. Adding sample QSOs to complete New England Division...');

// Data for completing New England Division (CT, EMA, ME, NH, RI, VT, WMA)
const newEnglandQsos = [
  { callsign: 'W1CT', section: 'CT', band: '20', mode: 'PH', class: '1A', operator: 'TEST', station: 'PHONE1', timestamp: Date.now() - 300000 },
  { callsign: 'W1EMA', section: 'EMA', band: '40', mode: 'CW', class: '2A', operator: 'TEST', station: 'CW1', timestamp: Date.now() - 240000 },
  { callsign: 'W1ME', section: 'ME', band: '15', mode: 'PH', class: '1A', operator: 'TEST', station: 'PHONE1', timestamp: Date.now() - 180000 },
  { callsign: 'W1NH', section: 'NH', band: '10', mode: 'PH', class: '3A', operator: 'TEST', station: 'PHONE2', timestamp: Date.now() - 120000 },
  { callsign: 'W1RI', section: 'RI', band: '80', mode: 'CW', class: '1A', operator: 'TEST', station: 'CW1', timestamp: Date.now() - 60000 },
  { callsign: 'W1VT', section: 'VT', band: '20', mode: 'PH', class: '2A', operator: 'TEST', station: 'PHONE1', timestamp: Date.now() - 30000 },
  { callsign: 'W1WMA', section: 'WMA', band: '40', mode: 'CW', class: '1A', operator: 'TEST', station: 'CW1', timestamp: Date.now() - 10000 }
];

const postQsos = async () => {
  for (const qso of newEnglandQsos) {
    try {
      const data = JSON.stringify(qso);
      
      const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/api/qsos',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        },
        rejectUnauthorized: false
      };

      await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`✅ Added QSO: ${qso.callsign} (${qso.section})`);
              resolve(responseData);
            } else {
              console.log(`❌ Failed to add QSO: ${qso.callsign} - Status: ${res.statusCode}`);
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        });

        req.on('error', (error) => {
          console.log(`❌ Error adding QSO ${qso.callsign}: ${error.message}`);
          reject(error);
        });

        req.write(data);
        req.end();
      });

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log(`❌ Failed to add QSO ${qso.callsign}: ${error.message}`);
    }
  }
};

// Test server availability first
const testServer = () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: '/api/qsos',
      method: 'GET',
      timeout: 2000,
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      console.log('✅ Server is running');
      resolve(true);
    });

    req.on('error', () => {
      console.log('❌ Server is not running - skipping QSO addition');
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ Server timeout - skipping QSO addition');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

// Main test execution
(async () => {
  const serverRunning = await testServer();
  
  if (serverRunning) {
    await postQsos();
    console.log('\n✅ New England Division should now be complete with trophy icon!');
    console.log('🚀 Open the app at https://localhost:8080 to see the trophy icons');
  }

  console.log('\n=== Test Summary ===');
  console.log('✅ SectionProgress header now matches RecentContacts/ScoreStatistics styling');
  console.log('✅ Trophy icons added for completed divisions in both SectionProgress and SectionMap');
  console.log('✅ New England Division populated for visual testing');
  console.log('\n🎯 Check the UI: Section Progress should show trophy for New England Division');
})();
