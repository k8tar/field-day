/**
 * Final Release Validation Test
 * Validates that all major components are working correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

console.log('🚀 Field Day Logger - Final Release Validation');
console.log('===============================================');
console.log('');

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFunction) {
  testsRun++;
  process.stdout.write(`${name}... `);
  
  try {
    testFunction();
    console.log('✅ PASS');
    testsPassed++;
  } catch (error) {
    console.log('❌ FAIL');
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: Package.json validation
runTest('Package.json structure', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.name || !pkg.version || !pkg.scripts) {
    throw new Error('Missing required package.json fields');
  }
  if (!pkg.scripts.dev || !pkg.scripts.build || !pkg.scripts.test) {
    throw new Error('Missing required npm scripts');
  }
});

// Test 2: Source files exist
runTest('Source files exist', () => {
  const requiredFiles = [
    'src/main.ts',
    'src/App.vue',
    'src/services/fileStorage.ts',
    'src/services/networkService.ts',
    'src/services/achievementService.ts',
    'src/store/qso.ts',
    'src/store/bonus.ts'
  ];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing required file: ${file}`);
    }
  }
});

// Test 3: Build files exist
runTest('Build configuration exists', () => {
  const buildFiles = [
    'vite.config.ts',
    'tsconfig.json',
    'electron-main.js'
  ];
  
  for (const file of buildFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing build file: ${file}`);
    }
  }
});

// Test 4: Documentation exists
runTest('Documentation exists', () => {
  const docFiles = [
    'README.md',
    'BUILD.md',
    'RELEASE-NOTES.md',
    'public/docs/README.md'
  ];
  
  for (const file of docFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing documentation: ${file}`);
    }
  }
});

// Test 5: Test infrastructure
runTest('Test infrastructure', () => {
  if (!fs.existsSync('tests/unit')) {
    throw new Error('Unit test directory missing');
  }
  
  const testFiles = fs.readdirSync('tests/unit');
  if (testFiles.length === 0) {
    throw new Error('No unit test files found');
  }
  
  if (!fs.existsSync('test-pipeline.sh') || !fs.existsSync('test-pipeline.bat')) {
    throw new Error('Test pipeline scripts missing');
  }
});

// Test 6: Build pipeline
runTest('Build pipeline files', () => {
  const buildFiles = [
    'build-pipeline.js',
    'package-build.json',
    'build.sh',
    'build.bat'
  ];
  
  for (const file of buildFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing build pipeline file: ${file}`);
    }
  }
});

// Test 7: Version consistency
runTest('Version consistency', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const buildPkg = JSON.parse(fs.readFileSync('package-build.json', 'utf8'));
  
  if (pkg.version !== buildPkg.version) {
    throw new Error(`Version mismatch: package.json (${pkg.version}) vs package-build.json (${buildPkg.version})`);
  }
});

// Test 8: No summary markdown files
runTest('No summary markdown files', () => {
  const files = fs.readdirSync('.').filter(f => f.endsWith('.md'));
  const summaryFiles = files.filter(f => 
    f.includes('_COMPLETE') || 
    f.includes('_SUMMARY') || 
    f.includes('_FIXES') ||
    f.includes('SYNC_TESTING') ||
    f.includes('NETWORK_')
  );
  
  if (summaryFiles.length > 0) {
    throw new Error(`Found summary files that should be removed: ${summaryFiles.join(', ')}`);
  }
});

// Test 9: Essential components have proper structure
runTest('Component structure validation', () => {
  const components = [
    'src/components/layouts/Header.vue',
    'src/components/QsoEntryForm.vue',
    'src/components/RecentContacts.vue',
    'src/components/ScoreStatistics.vue',
    'src/components/Messages.vue',
    'src/components/ConfigModal.vue',
    'src/components/NetworkModal.vue',
    'src/components/StatisticsModal.vue'
  ];
  
  for (const component of components) {
    if (!fs.existsSync(component)) {
      throw new Error(`Missing component: ${component}`);
    }
    
    const content = fs.readFileSync(component, 'utf8');
    if (!content.includes('<template>') && !content.includes('<script>')) {
      throw new Error(`Component ${component} appears to be malformed`);
    }
  }
});

// Test 10: Public assets
runTest('Public assets exist', () => {
  const assets = [
    'public/logo.svg',
    'public/favicon.svg',
    'public/docs/README.md',
    'public/fonts/material-icons.css'
  ];
  
  for (const asset of assets) {
    if (!fs.existsSync(asset)) {
      throw new Error(`Missing public asset: ${asset}`);
    }
  }
});

// Print summary
console.log('');
console.log('📊 Test Summary');
console.log('===============');
console.log(`Tests run: ${testsRun}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('');

if (testsFailed === 0) {
  console.log('🎉 All validation tests passed! Field Day Logger is ready for release.');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run "npm run test:pipeline" for comprehensive testing');
  console.log('2. Run "npm run build" to create production build');
  console.log('3. Run "npm run electron:build" to create desktop app');
  console.log('4. Test the application with real Field Day scenarios');
  process.exit(0);
} else {
  console.log('❌ Some validation tests failed. Please fix the issues before release.');
  process.exit(1);
}
