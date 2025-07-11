/**
 * Debug script for Connect button functionality in NetworkModal
 * Tests the network connection flow when clicking Connect button
 */

const { chromium } = require('playwright');

async function testConnectButton() {
  console.log('🔧 Testing Connect button functionality...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging from the page
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'error') {
      console.log(`PAGE ${msg.type().toUpperCase()}: ${msg.text()}`);
    }
  });
  
  try {
    // Navigate to the app
    console.log('📖 Navigating to http://localhost:8080...');
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');
    
    // Wait for Vue to load
    await page.waitForTimeout(2000);
    
    // Open the Network Modal
    console.log('📡 Opening Network Modal...');
    const networkMenuButton = page.locator('[data-testid="network-menu"], .network-button, button:has-text("Network")').first();
    if (await networkMenuButton.count() > 0) {
      await networkMenuButton.click();
    } else {
      // Try alternative selectors
      const alternativeSelectors = [
        'button[title*="network"]',
        'button[title*="Network"]',
        '.header-actions button',
        'header button'
      ];
      
      for (const selector of alternativeSelectors) {
        const button = page.locator(selector);
        if (await button.count() > 0) {
          console.log(`🎯 Found network button with selector: ${selector}`);
          await button.first().click();
          break;
        }
      }
    }
    
    // Wait for modal to open
    await page.waitForSelector('.network-modal', { timeout: 10000 });
    console.log('✅ Network Modal opened');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'network-modal-debug.png' });
    console.log('📸 Screenshot saved as network-modal-debug.png');
    
    // Test Host Mode
    console.log('\n🏠 Testing Host Mode...');
    
    // Select Host mode
    await page.selectOption('#network-mode', 'host');
    await page.waitForTimeout(500);
    
    // Check if Connect button is enabled
    const connectButton = page.locator('.connect-button.primary');
    const isConnectButtonEnabled = await connectButton.isEnabled();
    console.log(`🔘 Connect button enabled: ${isConnectButtonEnabled}`);
    
    if (isConnectButtonEnabled) {
      console.log('🔗 Clicking Connect button...');
      
      // Set up network response monitoring
      page.on('response', response => {
        if (response.url().includes('/api/network')) {
          console.log(`🌐 Network API Response: ${response.status()} ${response.url()}`);
        }
      });
      
      await connectButton.click();
      console.log('✅ Connect button clicked');
      
      // Wait for network response
      await page.waitForTimeout(3000);
      
      // Check if connection status changed
      const statusText = await page.locator('.network-status h3').textContent();
      console.log(`📊 Network Status: ${statusText}`);
      
      // Check for any error messages
      const errorElements = await page.locator('.error, .alert, .notification').all();
      if (errorElements.length > 0) {
        console.log('❌ Found error messages:');
        for (const element of errorElements) {
          const text = await element.textContent();
          console.log(`   - ${text}`);
        }
      }
    } else {
      console.log('❌ Connect button is disabled');
      
      // Debug why button is disabled
      const canConnectValue = await page.evaluate(() => {
        // Try to access Vue component data
        const modal = document.querySelector('.network-modal');
        if (modal && modal.__vueParentComponent) {
          const component = modal.__vueParentComponent;
          return {
            canConnect: component.proxy?.canConnect,
            networkMode: component.proxy?.networkMode,
            hostAddress: component.proxy?.hostAddress,
            discoveredStations: component.proxy?.discoveredStations?.length
          };
        }
        return null;
      });
      
      console.log('🔍 canConnect debug info:', canConnectValue);
    }
    
    // Test Join Mode
    console.log('\n🔗 Testing Join Mode...');
    
    // Select Join mode
    await page.selectOption('#network-mode', 'join');
    await page.waitForTimeout(500);
    
    // Enter a host address
    await page.fill('#host-address', '192.168.1.100:8080');
    await page.waitForTimeout(500);
    
    // Check if Connect button is now enabled
    const isJoinConnectEnabled = await connectButton.isEnabled();
    console.log(`🔘 Connect button enabled in join mode: ${isJoinConnectEnabled}`);
    
    if (isJoinConnectEnabled) {
      console.log('🔗 Clicking Connect button in join mode...');
      await connectButton.click();
      await page.waitForTimeout(3000);
      
      const joinStatusText = await page.locator('.network-status h3').textContent();
      console.log(`📊 Join Mode Network Status: ${joinStatusText}`);
    }
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will stay open for manual inspection...');
    console.log('Press Ctrl+C to close when done.');
    
    // Wait indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Don't close browser automatically for debugging
    // await browser.close();
  }
}

// Run the test
testConnectButton().catch(console.error);
