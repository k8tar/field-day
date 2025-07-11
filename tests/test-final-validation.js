#!/usr/bin/env node

/**
 * Final validation test - checks if everything is working correctly
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

// Test configuration
const BASE_URL = 'https://localhost:8080';

// Allow self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(`${BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testEndpoints() {
  console.log('🔍 Testing final validation...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const health = await makeRequest('/api/health');
    console.log(`   Status: ${health.status} ${health.status === 200 ? '✅' : '❌'}`);
    console.log(`   Response: ${JSON.stringify(health.data)}`);

    // Test station info endpoint
    console.log('\n2. Testing station info endpoint...');
    const stationInfo = await makeRequest('/api/station-info');
    console.log(`   Status: ${stationInfo.status} ${stationInfo.status === 200 ? '✅' : '❌'}`);
    console.log(`   QSO Count: ${stationInfo.data.qsoCount || 'undefined'}`);

    // Test QSO endpoints
    console.log('\n3. Testing QSO endpoints...');
    const qsos = await makeRequest('/api/qsos');
    console.log(`   GET /api/qsos Status: ${qsos.status} ${qsos.status === 200 ? '✅' : '❌'}`);
    console.log(`   QSO Count: ${qsos.data.length || 0}`);

    // Test export endpoints
    console.log('\n4. Testing export endpoints...');
    
    const adifExport = await makeRequest('/api/export/adif');
    console.log(`   ADIF Export Status: ${adifExport.status} ${adifExport.status === 200 ? '✅' : '❌'}`);
    
    const cabrilloExport = await makeRequest('/api/export/cabrillo');
    console.log(`   Cabrillo Export Status: ${cabrilloExport.status} ${cabrilloExport.status === 200 ? '✅' : '❌'}`);
    
    const dupeExport = await makeRequest('/api/export/dupe-sheet');
    console.log(`   Dupe Sheet Export Status: ${dupeExport.status} ${dupeExport.status === 200 ? '✅' : '❌'}`);

    // Test documentation endpoint  
    console.log('\n5. Testing documentation endpoint...');
    const docs = await makeRequest('/docs/README.md');
    console.log(`   Documentation Status: ${docs.status} ${docs.status === 200 ? '✅' : '❌'}`);

    console.log('\n🎉 Final validation complete!');
    console.log('\nNext steps:');
    console.log('1. Open https://localhost:8080 in your browser');
    console.log('2. Test the help (?) button in the header');
    console.log('3. Test the export functions in Configuration');
    console.log('4. Verify theme switching works in documentation modal');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Main execution
testEndpoints();
