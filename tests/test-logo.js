#!/usr/bin/env node

/**
 * Test the new logo implementation
 */

import https from 'https';

// Test configuration
const BASE_URL = 'https://localhost:8080';

// Allow self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function testLogo() {
  console.log('🎨 Testing K8TAR Field Day Logger Logo...\n');

  try {
    // Test if server is running
    const healthResponse = await fetch(`${BASE_URL}/api/health`);
    if (!healthResponse.ok) {
      throw new Error('Server not running');
    }

    console.log('✅ Server is running');
    
    // Test logo files
    console.log('\n📋 Testing Logo Files:');
    
    const logoFiles = [
      { path: '/logo.svg', name: 'Main Logo (200x200)' },
      { path: '/logo-small.svg', name: 'Small Logo (64x64)' },
      { path: '/favicon.svg', name: 'Favicon (32x32)' }
    ];
    
    for (const logo of logoFiles) {
      try {
        const response = await fetch(`${BASE_URL}${logo.path}`);
        if (response.ok) {
          const content = await response.text();
          const size = content.length;
          console.log(`   ✅ ${logo.name}: ${size} bytes`);
        } else {
          console.log(`   ❌ ${logo.name}: Failed to load (${response.status})`);
        }
      } catch (error) {
        console.log(`   ❌ ${logo.name}: Error - ${error.message}`);
      }
    }
    
    console.log('\n🎯 Logo Features:');
    console.log('   📡 Antenna tower with radio elements');
    console.log('   📶 Radio wave propagation visualization');
    console.log('   🏕️ Field Day tent representation');
    console.log('   💚 Animated activity indicators');
    console.log('   🎨 K8TAR callsign prominently displayed');
    console.log('   🌈 Theme-compatible blue color scheme');
    
    console.log('\n📱 Usage:');
    console.log('   • Main logo (/logo.svg): High-resolution, perfect for documents');
    console.log('   • Small logo (/logo-small.svg): Header display, 64x64 pixels');
    console.log('   • Favicon (/favicon.svg): Browser tab icon, 32x32 pixels');
    
    console.log('\n🧪 Testing Instructions:');
    console.log('1. Open https://localhost:8080 in your browser');
    console.log('2. Look for the animated logo in the header (left side)');
    console.log('3. Check the browser tab for the custom favicon');
    console.log('4. Notice the green activity indicator that pulses');
    console.log('5. The logo should be visible in both light and dark themes');
    
    console.log('\n✨ Visual Elements:');
    console.log('   • Blue circular background (#4a90e2)');
    console.log('   • White antenna tower and elements');
    console.log('   • Concentric radio wave arcs');
    console.log('   • Animated green activity dots');
    console.log('   • Field Day tent silhouettes');
    console.log('   • Clean, professional typography');

  } catch (error) {
    console.log('❌ Server not running. Start with: npm run dev');
    console.log('\n📋 Logo Files Created:');
    console.log('   • /public/logo.svg - Main logo (200x200)');
    console.log('   • /public/logo-small.svg - Header logo (64x64)');
    console.log('   • /public/favicon.svg - Browser icon (32x32)');
    console.log('   • Updated index.html with new favicon');
    console.log('   • Updated Header.vue with logo display');
  }
}

// Run the test
testLogo();
