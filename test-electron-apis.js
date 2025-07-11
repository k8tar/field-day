// Test script to verify Electron APIs are available
console.log('🧪 Testing Electron API availability...');

console.log('window.Electron:', typeof window.Electron, window.Electron);
console.log('window.electronFS:', typeof window.electronFS, !!window.electronFS);
console.log('window.ElectronTest:', typeof window.ElectronTest, !!window.ElectronTest);

if (window.ElectronTest) {
  try {
    window.ElectronTest();
    console.log('✅ ElectronTest function executed successfully');
  } catch (error) {
    console.error('❌ ElectronTest function failed:', error);
  }
}

if (window.electronFS) {
  console.log('✅ electronFS API is available');
  
  // Test file operations
  window.electronFS.writeFile('test.txt', 'Hello from Electron!')
    .then(() => {
      console.log('✅ Test file write successful');
      return window.electronFS.readFile('test.txt');
    })
    .then((data) => {
      console.log('✅ Test file read successful:', data);
    })
    .catch((error) => {
      console.error('❌ File operation failed:', error);
    });
} else {
  console.log('❌ electronFS API not available');
}
