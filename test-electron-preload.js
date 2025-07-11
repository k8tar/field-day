// Test script to check if Electron preload APIs are working
console.log('🧪 Testing Electron preload APIs...');

// Check if we're in Electron
console.log('window.Electron:', typeof window !== 'undefined' ? window.Electron : 'N/A');
console.log('window.electronFS:', typeof window !== 'undefined' ? typeof window.electronFS : 'N/A');
console.log('window.ElectronTest:', typeof window !== 'undefined' ? typeof window.ElectronTest : 'N/A');

// Test the ElectronTest function
if (typeof window !== 'undefined' && window.ElectronTest) {
  try {
    const result = window.ElectronTest();
    console.log('✅ ElectronTest result:', result);
  } catch (error) {
    console.error('❌ ElectronTest error:', error);
  }
}

// Test electronFS
if (typeof window !== 'undefined' && window.electronFS) {
  console.log('📁 Testing electronFS...');
  
  // Test write then read
  window.electronFS.writeFile('test.txt', 'Hello from Electron!')
    .then(() => {
      console.log('✅ Write successful');
      return window.electronFS.readFile('test.txt');
    })
    .then((data) => {
      console.log('✅ Read successful:', data);
    })
    .catch((error) => {
      console.error('❌ electronFS test failed:', error);
    });
} else {
  console.log('❌ electronFS not available');
}
