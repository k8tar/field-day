/**
 * Test HTTPS connectivity for Field Day Logger
 * Tests both local and network HTTPS access
 */

console.log('🔐 Testing HTTPS connectivity for Field Day Logger...');

async function testHttpsConnectivity() {
  const testUrls = [
    'https://localhost:8080/',
    'https://127.0.0.1:8080/',
    // Add your actual network IP here
    // 'https://192.168.1.14:8080/',
  ];
  
  for (const url of testUrls) {
    try {
      console.log(`\n🌐 Testing: ${url}`);
      
      // Use fetch with options to handle self-signed certificates
      const response = await fetch(url, {
        method: 'GET',
        // Note: In Node.js, you might need to set agent with rejectUnauthorized: false
        // But this test is meant to be run in a browser where users can accept the certificate
      });
      
      if (response.ok) {
        console.log(`✅ ${url} - Connection successful (${response.status} ${response.statusText})`);
      } else {
        console.log(`⚠️ ${url} - Server responded but with status: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ ${url} - Connection failed:`, error.message);
    }
  }
  
  // Test API endpoints
  console.log('\n🔌 Testing API endpoints...');
  
  const apiTests = [
    '/api/station-info',
    '/api/network/host',
  ];
  
  for (const endpoint of apiTests) {
    try {
      const url = `https://localhost:8080${endpoint}`;
      console.log(`🔍 Testing API: ${endpoint}`);
      
      let response;
      if (endpoint === '/api/network/host') {
        // POST request for host registration
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // GET request
        response = await fetch(url);
      }
      
      if (response.ok) {
        const data = await response.text();
        console.log(`✅ ${endpoint} - API working (${data.length} chars response)`);
      } else {
        console.log(`⚠️ ${endpoint} - API responded with: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - API failed:`, error.message);
    }
  }
}

// Instructions for manual testing
console.log('\n📋 Manual Testing Instructions:');
console.log('1. Copy this script to your browser console (F12)');
console.log('2. Run: testHttpsConnectivity()');
console.log('3. Or visit these URLs manually:');
console.log('   - https://localhost:8080/ (local access)');
console.log('   - https://[your-ip]:8080/ (network access from other machines)');
console.log('4. Accept browser security warnings for self-signed certificates');
console.log('5. Verify the Field Day Logger loads properly');

// For Node.js environment, just show instructions
if (typeof window === 'undefined') {
  console.log('\n🔧 For automated testing, run this in a browser console');
  console.log('For network testing from other machines:');
  console.log('- Replace [your-ip] with your actual IP address');
  console.log('- Make sure Windows Firewall allows port 8080');
  console.log('- Other machines will need to accept certificate warnings');
} else {
  // Browser environment - make function available
  window.testHttpsConnectivity = testHttpsConnectivity;
  console.log('\n✅ Function loaded! Run: testHttpsConnectivity()');
}
