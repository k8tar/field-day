// Header Height Consistency Test
// Test that ScoreStatistics and RecentContacts headers have matching heights
// Run: node tests/test-header-consistency.cjs

const puppeteer = require('puppeteer');

async function testHeaderConsistency() {
  console.log('🧪 Testing header height consistency...');

  const browser = await puppeteer.launch({ 
    headless: false,
    slowMo: 100,
    args: ['--ignore-certificate-errors', '--ignore-ssl-errors']
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the application
    await page.goto('https://localhost:8080', { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });

    console.log('✅ Page loaded successfully');

    // Wait for both components to be rendered
    await page.waitForSelector('.score-statistics .stats-header', { timeout: 5000 });
    await page.waitForSelector('.recent-contacts .header-section', { timeout: 5000 });

    console.log('✅ Both header sections found');

    // Get the computed heights and padding of both headers
    const headerMetrics = await page.evaluate(() => {
      const scoreHeader = document.querySelector('.score-statistics .stats-header');
      const contactsHeader = document.querySelector('.recent-contacts .header-section');

      if (!scoreHeader || !contactsHeader) {
        return { error: 'One or both headers not found' };
      }

      const scoreStyles = window.getComputedStyle(scoreHeader);
      const contactsStyles = window.getComputedStyle(contactsHeader);

      const scoreButton = scoreHeader.querySelector('.bonus-button');
      const contactsButton = contactsHeader.querySelector('.btn-stats');

      const scoreButtonStyles = scoreButton ? window.getComputedStyle(scoreButton) : null;
      const contactsButtonStyles = contactsButton ? window.getComputedStyle(contactsButton) : null;

      return {
        scoreHeader: {
          height: scoreHeader.offsetHeight,
          padding: scoreStyles.padding,
          paddingTop: scoreStyles.paddingTop,
          paddingBottom: scoreStyles.paddingBottom
        },
        contactsHeader: {
          height: contactsHeader.offsetHeight,
          padding: contactsStyles.padding,
          paddingTop: contactsStyles.paddingTop,
          paddingBottom: contactsStyles.paddingBottom
        },
        scoreButton: scoreButtonStyles ? {
          height: scoreButton.offsetHeight,
          padding: scoreButtonStyles.padding,
          fontSize: scoreButtonStyles.fontSize
        } : null,
        contactsButton: contactsButtonStyles ? {
          height: contactsButton.offsetHeight,
          padding: contactsButtonStyles.padding,
          fontSize: contactsButtonStyles.fontSize
        } : null
      };
    });

    console.log('📏 Header Metrics:');
    console.log('Score Statistics Header:', headerMetrics.scoreHeader);
    console.log('Recent Contacts Header:', headerMetrics.contactsHeader);
    console.log('Score Button:', headerMetrics.scoreButton);
    console.log('Contacts Button:', headerMetrics.contactsButton);

    // Compare heights and padding
    const heightDiff = Math.abs(headerMetrics.scoreHeader.height - headerMetrics.contactsHeader.height);
    console.log(`\n🔍 Header height difference: ${heightDiff}px`);

    if (heightDiff <= 2) {
      console.log('✅ Header heights match (within 2px tolerance)');
    } else {
      console.log('❌ Header heights do not match');
    }

    // Compare button heights if both exist
    if (headerMetrics.scoreButton && headerMetrics.contactsButton) {
      const buttonHeightDiff = Math.abs(headerMetrics.scoreButton.height - headerMetrics.contactsButton.height);
      console.log(`🔍 Button height difference: ${buttonHeightDiff}px`);
      
      if (buttonHeightDiff <= 2) {
        console.log('✅ Button heights match (within 2px tolerance)');
      } else {
        console.log('❌ Button heights do not match');
      }
    }

    // Take a screenshot for visual verification
    await page.screenshot({ 
      path: 'header-consistency-test.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 400 }
    });
    console.log('📸 Screenshot saved as header-consistency-test.png');

    // Add sample QSOs to make the components more visible
    console.log('\n🔧 Adding sample data for better visual testing...');
    await page.evaluate(() => {
      // Add sample QSO via the store
      if (window.Vue && window.Vue.store) {
        const store = window.Vue.store;
        const sampleQso = {
          id: Date.now(),
          call: 'W1AW',
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
    });

    // Wait a moment for the UI to update
    await page.waitForTimeout(1000);

    // Take another screenshot with data
    await page.screenshot({ 
      path: 'header-consistency-with-data.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 600 }
    });
    console.log('📸 Screenshot with data saved as header-consistency-with-data.png');

    console.log('\n✅ Header consistency test completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
testHeaderConsistency().catch(console.error);
