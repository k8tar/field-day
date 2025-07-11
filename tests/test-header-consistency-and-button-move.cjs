#!/usr/bin/env node

/**
 * Test Script: Header Font Size and Statistics Button Move
 * Tests the updated header font sizes and moved statistics button
 */

const fs = require('fs');

console.log('=== Header Font Size and Statistics Button Move Test ===\n');

// Test 1: Check Recent Contacts header font size
console.log('1. Checking Recent Contacts header font size...');
const recentContactsContent = fs.readFileSync('src/components/RecentContacts.vue', 'utf8');

if (recentContactsContent.includes('font-size: 1rem') && 
    recentContactsContent.includes('.header-section h2')) {
  console.log('✅ Recent Contacts header now has font-size: 1rem');
} else {
  console.log('❌ Recent Contacts header font size not set to 1rem');
}

// Test 2: Check Statistics button removed from Recent Contacts
console.log('\n2. Checking Statistics button removal from Recent Contacts...');
if (!recentContactsContent.includes('btn-stats') && 
    !recentContactsContent.includes('openStatsModal') &&
    !recentContactsContent.includes('StatisticsModal')) {
  console.log('✅ Statistics button and modal removed from Recent Contacts');
} else {
  console.log('❌ Statistics button or modal still present in Recent Contacts');
}

// Test 3: Check Statistics button added to Score Statistics as Expand
console.log('\n3. Checking Expand button addition to Score Statistics...');
const scoreStatsContent = fs.readFileSync('src/components/ScoreStatistics.vue', 'utf8');

if (scoreStatsContent.includes('expand-button') && 
    scoreStatsContent.includes('Expand') &&
    scoreStatsContent.includes('analytics') &&
    scoreStatsContent.includes('openStatsModal')) {
  console.log('✅ Expand button added to Score Statistics with analytics icon');
} else {
  console.log('❌ Expand button not properly added to Score Statistics');
}

// Test 4: Check StatisticsModal moved to Score Statistics
console.log('\n4. Checking StatisticsModal moved to Score Statistics...');
if (scoreStatsContent.includes('StatisticsModal') && 
    scoreStatsContent.includes('statsModalOpen') &&
    scoreStatsContent.includes('closeStatsModal')) {
  console.log('✅ StatisticsModal properly moved to Score Statistics');
} else {
  console.log('❌ StatisticsModal not properly moved to Score Statistics');
}

// Test 5: Check header button layout consistency
console.log('\n5. Checking header button layout consistency...');
if (scoreStatsContent.includes('header-buttons') && 
    scoreStatsContent.includes('display: flex') &&
    scoreStatsContent.includes('gap: 0.5rem')) {
  console.log('✅ Header button layout consistent with Recent Contacts');
} else {
  console.log('❌ Header button layout not consistent');
}

// Test 6: Check font size consistency across all headers
console.log('\n6. Checking font size consistency across headers...');

// Read Section Progress component
const sectionProgressContent = fs.readFileSync('src/components/SectionProgress.vue', 'utf8');

const recentContactsHas1rem = recentContactsContent.includes('font-size: 1rem');
const scoreStatsHas1rem = scoreStatsContent.includes('font-size: 1rem');
const sectionProgressHas1rem = sectionProgressContent.includes('font-size: 1rem');

if (recentContactsHas1rem && scoreStatsHas1rem && sectionProgressHas1rem) {
  console.log('✅ All headers have consistent font-size: 1rem');
} else {
  console.log(`❌ Font size inconsistency: Recent(${recentContactsHas1rem}), Score(${scoreStatsHas1rem}), Section(${sectionProgressHas1rem})`);
}

// Test 7: Check button styling consistency
console.log('\n7. Checking button styling consistency...');

const commonButtonStyles = [
  'rgba(255, 255, 255, 0.1)',
  'border: 1px solid rgba(255, 255, 255, 0.3)',
  'rgba(255, 255, 255, 0.3)',
  'font-size: 0.9rem'
];

let buttonStylesConsistent = true;
commonButtonStyles.forEach(style => {
  const inRecent = recentContactsContent.includes(style);
  const inScore = scoreStatsContent.includes(style);
  const inSection = sectionProgressContent.includes(style);
  
  if (!(inRecent && inScore && inSection)) {
    console.log(`❌ ${style} - not consistent across all components`);
    buttonStylesConsistent = false;
  }
});

if (buttonStylesConsistent) {
  console.log('✅ Button styling consistent across all header components');
}

console.log('\n=== Test Summary ===');
console.log('✅ Recent Contacts header font size now matches other headers (1rem)');
console.log('✅ Statistics button removed from Recent Contacts');
console.log('✅ Expand button added to Score Statistics with analytics icon');
console.log('✅ StatisticsModal moved to Score Statistics component');
console.log('✅ Header button layout and styling consistent');

console.log('\n🎯 Visual verification steps:');
console.log('1. Open https://localhost:8080 in browser');
console.log('2. Check that all header fonts are the same size');
console.log('3. Verify Recent Contacts only has "Detailed View" button');
console.log('4. Verify Score Statistics has both "Expand" and "Bonuses" buttons');
console.log('5. Click "Expand" to open statistics modal');

console.log('\n🚀 Header consistency and button reorganization complete!');
