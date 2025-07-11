// Visual Test for Header Consistency
// Take screenshots to verify visual consistency
// Run: node tests/test-visual-headers.cjs

const puppeteer = require('puppeteer');

async function visualHeaderTest() {
  console.log('📸 Taking visual screenshots of headers...');

  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--ignore-certificate-errors', '--ignore-ssl-errors']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 800 });
    
    await page.goto('https://localhost:8080', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });

    // Add some sample data
    await page.evaluate(() => {
      if (window.Vue && window.Vue.store) {
        const store = window.Vue.store;
        for (let i = 0; i < 3; i++) {
          const sampleQso = {
            id: Date.now() + i,
            call: `W${i+1}AW`,
            class: '2A',
            section: 'CT',
            band: '20m',
            mode: 'SSB',
            operator: 'Test Op',
            stationDesignator: 'PHONE 1',
            datetime: new Date().toISOString()
          };
          store.dispatch('qso/addQso', sampleQso);
        }
      }
    });

    // Wait for UI update
    await page.waitForFunction(() => {
      const qsos = document.querySelectorAll('.recent-contacts tbody tr');
      return qsos.length > 0;
    }, { timeout: 5000 });

    // Take screenshot focusing on the headers
    await page.screenshot({ 
      path: 'header-visual-test.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1400, height: 300 }
    });
    
    console.log('✅ Screenshot saved as header-visual-test.png');

    // Test hover states
    await page.hover('.score-statistics .bonus-button');
    await page.screenshot({ 
      path: 'header-hover-bonus.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1400, height: 300 }
    });

    await page.hover('.recent-contacts .btn-stats');
    await page.screenshot({ 
      path: 'header-hover-stats.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1400, height: 300 }
    });

    console.log('✅ Hover state screenshots saved');
    console.log('✅ Visual header test completed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

visualHeaderTest().catch(console.error);
