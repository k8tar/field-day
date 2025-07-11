#!/usr/bin/env node

/**
 * Diagnostic script to test station-info endpoint and debug the error
 */

import https from 'https';

// Disable SSL verification for self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

console.log('🔍 Testing station-info endpoint...');

// Test both stations
const stations = [
  { name: 'PHONE 1', url: 'https://192.168.1.14:8080/api/station-info' },
  { name: 'PHONE 2', url: 'https://192.168.1.30:8080/api/station-info' }
];

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: res.statusCode >= 200 && res.statusCode < 300 ? JSON.parse(data) : data
          };
          resolve(result);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: e.message
          });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function testStationInfo() {
  for (const station of stations) {
    console.log(`\n📡 Testing ${station.name} at ${station.url}...`);
    
    try {
      const result = await makeRequest(station.url);
      
      console.log(`   Status: ${result.status}`);
      console.log(`   Response:`, JSON.stringify(result.data, null, 2));
      
      if (result.status === 200 && result.data && typeof result.data === 'object') {
        console.log(`   ✅ ${station.name} station-info working`);
        console.log(`      Station: ${result.data.callsign}-${result.data.designator}`);
        console.log(`      QSOs: ${result.data.qsoCount}`);
        console.log(`      Score: ${result.data.score}`);
      } else {
        console.log(`   ❌ ${station.name} station-info failed`);
      }
      
    } catch (error) {
      console.log(`   ❌ ${station.name} connection error:`, error.message);
    }
  }
  
  // Also test QSOs endpoint
  console.log('\n📊 Testing QSOs endpoints...');
  
  for (const station of stations) {
    const qsoUrl = station.url.replace('/api/station-info', '/api/qsos');
    console.log(`\n📡 Testing ${station.name} QSOs at ${qsoUrl}...`);
    
    try {
      const result = await makeRequest(qsoUrl);
      
      console.log(`   Status: ${result.status}`);
      if (result.status === 200 && result.data && result.data.qsos) {
        console.log(`   ✅ ${station.name} QSOs endpoint working`);
        console.log(`      QSO count: ${result.data.qsos.length}`);
        if (result.data.qsos.length > 0) {
          console.log(`      Sample QSO: ${result.data.qsos[0].call} on ${result.data.qsos[0].band} ${result.data.qsos[0].mode}`);
        }
      } else {
        console.log(`   ❌ ${station.name} QSOs failed`);
        console.log(`      Response:`, JSON.stringify(result.data, null, 2));
      }
      
    } catch (error) {
      console.log(`   ❌ ${station.name} QSOs connection error:`, error.message);
    }
  }
}

testStationInfo().catch(console.error);
