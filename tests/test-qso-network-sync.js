#!/usr/bin/env node

/**
 * Test script to verify QSO network sync between host and client
 * 
 * This test simulates:
 * 1. PHONE 3 (client) logs a QSO
 * 2. QSO gets sent to PHONE 1 (host) 
 * 3. PHONE 1 adds it to its QSO list
 * 4. Both stations should see the QSO in their contact lists
 */

import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Disable SSL verification for self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

console.log('🧪 Testing QSO Network Sync...\n');

// Test configuration
const HOST_URL = 'https://localhost:8080';  // PHONE 1 (host)
const CLIENT_URL = 'https://localhost:8080'; // PHONE 3 (client) - both using same server for this test

// Helper function to make HTTPS requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      ...options,
      rejectUnauthorized: false // Accept self-signed certificates
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = res.statusCode >= 200 && res.statusCode < 300 
            ? JSON.parse(data) 
            : { error: `HTTP ${res.statusCode}`, body: data };
          resolve(result);
        } catch (e) {
          resolve({ error: 'Invalid JSON', body: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testQsoNetworkSync() {
  try {
    console.log('1️⃣ Getting initial QSO count from host...');
    const initialQsos = await makeRequest(`${HOST_URL}/api/qsos`);
    console.log(`   Initial QSO count: ${initialQsos.qsos?.length || 0}`);
    
    console.log('\n2️⃣ Simulating QSO logged by client (PHONE 3)...');
    const testQso = {
      id: Date.now(), // Unique ID
      call: 'W1TEST',
      class: '2A',
      section: 'CT',
      datetime: new Date().toISOString(),
      band: '40m',
      mode: 'PH',
      operator: 'TEST_OP',
      stationDesignator: 'PHONE 3',
      timestamp: Date.now()
    };
    
    // Simulate what the client would send to the host
    const qsoUpdate = {
      action: 'add',
      qso: testQso,
      stationId: 'test-client-station',
      timestamp: Date.now()
    };
    
    console.log(`   Sending QSO: ${testQso.call} to host...`);
    const addResult = await makeRequest(`${HOST_URL}/api/qsos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(qsoUpdate)
    });
    
    console.log(`   Add result:`, addResult);
    
    console.log('\n3️⃣ Checking if QSO was added to host...');
    const updatedQsos = await makeRequest(`${HOST_URL}/api/qsos`);
    console.log(`   Updated QSO count: ${updatedQsos.qsos?.length || 0}`);
    
    // Check if our test QSO is in the list
    const ourQso = updatedQsos.qsos?.find(q => q.call === testQso.call);
    if (ourQso) {
      console.log(`   ✅ Found our test QSO: ${ourQso.call} from ${ourQso.stationDesignator || 'unknown station'}`);
    } else {
      console.log(`   ❌ Test QSO not found in host's QSO list`);
    }
    
    console.log('\n4️⃣ Testing station info endpoint...');
    const stationInfo = await makeRequest(`${HOST_URL}/api/station-info`);
    console.log(`   Station: ${stationInfo.callsign}-${stationInfo.designator}`);
    console.log(`   QSO Count: ${stationInfo.qsoCount}`);
    console.log(`   Score: ${stationInfo.score}`);
    
    console.log('\n🏁 Test Results:');
    console.log(`   Initial QSOs: ${initialQsos.qsos?.length || 0}`);
    console.log(`   Final QSOs: ${updatedQsos.qsos?.length || 0}`);
    console.log(`   QSOs Added: ${(updatedQsos.qsos?.length || 0) - (initialQsos.qsos?.length || 0)}`);
    console.log(`   Test QSO Found: ${ourQso ? '✅ YES' : '❌ NO'}`);
    
    if (ourQso) {
      console.log('\n✅ SUCCESS: QSO network sync is working!');
      console.log('   - Client QSO was successfully added to host');
      console.log('   - Host can see QSOs from connected clients');
    } else {
      console.log('\n❌ FAILURE: QSO network sync is not working');
      console.log('   - Client QSO was not added to host, or');
      console.log('   - Host is not properly storing received QSOs');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testQsoNetworkSync();
