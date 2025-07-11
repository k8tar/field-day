#!/usr/bin/env node

/**
 * Test documentation modal theme switching
 */

import https from 'https';

// Test configuration
const BASE_URL = 'https://localhost:8080';

// Allow self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function testTheme() {
  console.log('🎨 Testing Documentation Modal Theme...\n');

  try {
    // Test if server is running
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.ok) {
      console.log('✅ Server is running');
      console.log('\n📋 Theme Test Instructions:');
      console.log('1. Open https://localhost:8080 in your browser');
      console.log('2. Click the help (?) button in the header OR press F1');
      console.log('3. The documentation modal should open');
      console.log('4. Toggle the theme using the theme button in the header');
      console.log('5. Verify the documentation modal background changes:');
      console.log('   - Light mode: Semi-transparent light overlay');
      console.log('   - Dark mode: Semi-transparent dark overlay');
      console.log('6. Check that all content respects the theme colors');
      
      console.log('\n🔧 Fixed Issues:');
      console.log('- Modal background now uses --modal-bg variable');
      console.log('- Modal content uses --modal-content variable');
      console.log('- Code blocks use --secondary-color variable');
      console.log('- Tables and hover states use proper theme variables');
      console.log('- Removed hardcoded dark theme overrides');
      
      console.log('\n🎯 Expected Behavior:');
      console.log('- Light mode: White modal on semi-transparent light background');
      console.log('- Dark mode: Dark modal on semi-transparent dark background');
      console.log('- All text and elements should be readable in both themes');
      
    } else {
      console.log('❌ Server not running. Start with: npm run dev');
    }
  } catch (error) {
    console.log('❌ Server not running. Start with: npm run dev');
  }
}

// Run the test
testTheme();
