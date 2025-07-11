// Quick Header Height Test
// Test header heights after styling fixes
// Run: node tests/test-header-height-quick.cjs

const puppeteer = require('puppeteer');

async function quickHeaderTest() {
  console.log('🧪 Quick header height test...');

  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--ignore-certificate-errors', '--ignore-ssl-errors']
  });

  try {
    const page = await browser.newPage();
    
    await page.goto('https://localhost:8080', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });

    // Get the heights
    const heights = await page.evaluate(() => {
      const scoreHeader = document.querySelector('.score-statistics .stats-header');
      const contactsHeader = document.querySelector('.recent-contacts .header-section');

      return {
        scoreHeight: scoreHeader ? scoreHeader.offsetHeight : 0,
        contactsHeight: contactsHeader ? contactsHeader.offsetHeight : 0,
        score_h2_height: scoreHeader ? scoreHeader.querySelector('h2').offsetHeight : 0,
        contacts_h2_height: contactsHeader ? contactsHeader.querySelector('h2').offsetHeight : 0
      };
    });

    console.log('📏 Header Heights:');
    console.log(`Score Statistics: ${heights.scoreHeight}px (h2: ${heights.score_h2_height}px)`);
    console.log(`Recent Contacts: ${heights.contactsHeight}px (h2: ${heights.contacts_h2_height}px)`);
    
    const diff = Math.abs(heights.scoreHeight - heights.contactsHeight);
    console.log(`Difference: ${diff}px`);
    
    if (diff <= 2) {
      console.log('✅ Headers match!');
    } else {
      console.log('❌ Headers still different');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

quickHeaderTest().catch(console.error);
