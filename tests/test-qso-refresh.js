#!/usr/bin/env node

/**
 * Test QSO refresh mechanism
 * This test verifies that the QSO store properly refreshes data from the server API
 */

const puppeteer = require('puppeteer');

async function testQsoRefresh() {
  console.log('🧪 Testing QSO refresh mechanism...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--ignore-certificate-errors', '--allow-running-insecure-content']
  });
  
  try {
    // Open two tabs for PHONE 1 and PHONE 3
    const page1 = await browser.newPage();
    const page3 = await browser.newPage();
    
    // Navigate to both stations
    console.log('📱 Opening PHONE 1 and PHONE 3...');
    await page1.goto('http://localhost:8080');
    await page3.goto('http://localhost:8080');
    
    // Wait for pages to load
    await page1.waitForTimeout(2000);
    await page3.waitForTimeout(2000);
    
    console.log('📋 Getting initial QSO counts...');
    
    // Check initial QSO count on both pages
    const initialQsos1 = await page1.evaluate(() => {
      const qsoElement = document.querySelector('.recent-contacts h2');
      return qsoElement ? qsoElement.textContent : 'Not found';
    });
    
    const initialQsos3 = await page3.evaluate(() => {
      const qsoElement = document.querySelector('.recent-contacts h2');
      return qsoElement ? qsoElement.textContent : 'Not found';
    });
    
    console.log(`📊 PHONE 1 initial QSOs: ${initialQsos1}`);
    console.log(`📊 PHONE 3 initial QSOs: ${initialQsos3}`);
    
    // Configure PHONE 3 station
    console.log('⚙️ Configuring PHONE 3...');
    await page3.click('[data-test="config-button"]');
    await page3.waitForTimeout(1000);
    
    // Clear and set station designator
    await page3.evaluate(() => {
      const designatorInput = document.querySelector('input[placeholder="PHONE 1"]');
      if (designatorInput) {
        designatorInput.value = '';
        designatorInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    
    await page3.type('input[placeholder="PHONE 1"]', 'PHONE 3');
    await page3.click('button[type="submit"]');
    await page3.waitForTimeout(1000);
    
    // Add a QSO to PHONE 3
    console.log('📝 Adding test QSO to PHONE 3...');
    
    // Fill out QSO form on PHONE 3
    await page3.type('input[placeholder="W1AW"]', 'W3TEST');
    await page3.type('input[placeholder="1A"]', '2A');
    await page3.type('input[placeholder="WPA"]', 'OH');
    
    // Submit the QSO
    await page3.click('button[type="submit"]');
    await page3.waitForTimeout(2000);
    
    console.log('✅ QSO added to PHONE 3');
    
    // Check if QSO appears in PHONE 3's list
    const updatedQsos3 = await page3.evaluate(() => {
      const qsoElement = document.querySelector('.recent-contacts h2');
      return qsoElement ? qsoElement.textContent : 'Not found';
    });
    
    console.log(`📊 PHONE 3 after adding QSO: ${updatedQsos3}`);
    
    // Wait for refresh cycle and check PHONE 1
    console.log('⏰ Waiting 15 seconds for QSO refresh cycle...');
    await page1.waitForTimeout(15000);
    
    const refreshedQsos1 = await page1.evaluate(() => {
      const qsoElement = document.querySelector('.recent-contacts h2');
      return qsoElement ? qsoElement.textContent : 'Not found';
    });
    
    console.log(`📊 PHONE 1 after refresh: ${refreshedQsos1}`);
    
    // Check if the QSO from PHONE 3 appears in PHONE 1's list
    const hasW3Test = await page1.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.recent-contacts tbody tr'));
      return rows.some(row => row.textContent.includes('W3TEST'));
    });
    
    if (hasW3Test) {
      console.log('✅ SUCCESS: W3TEST QSO from PHONE 3 appears in PHONE 1!');
    } else {
      console.log('❌ FAILED: W3TEST QSO from PHONE 3 NOT found in PHONE 1');
      
      // Debug: List all QSOs in PHONE 1
      const allQsos = await page1.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.recent-contacts tbody tr'));
        return rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          return cells.slice(0, 4).map(cell => cell.textContent.trim()).join(' | ');
        });
      });
      
      console.log('📋 QSOs in PHONE 1:');
      allQsos.forEach((qso, index) => {
        console.log(`  ${index + 1}: ${qso}`);
      });
    }
    
    console.log('🧪 Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testQsoRefresh().catch(console.error);
