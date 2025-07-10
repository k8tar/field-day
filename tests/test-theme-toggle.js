// Test script to verify dark mode toggle functionality
// Run this in the browser console to test the theme system

console.log('=== Dark Mode Theme Test ===');

// Check current theme state
const isDarkModeActive = document.documentElement.classList.contains('dark-mode');
console.log('Current dark mode state:', isDarkModeActive);

// Check localStorage
const themeInStorage = localStorage.getItem('theme');
console.log('Theme in localStorage:', themeInStorage);

// Check if CSS variables are applied
const rootStyles = getComputedStyle(document.documentElement);
const bgColor = rootStyles.getPropertyValue('--bg-color').trim();
const textColor = rootStyles.getPropertyValue('--text-color').trim();

console.log('CSS Variables:');
console.log('  --bg-color:', bgColor);
console.log('  --text-color:', textColor);

// Test toggle functionality
console.log('\n=== Testing Toggle ===');
console.log('If you can see this, open the dev tools and manually test the toggle button in the header.');
console.log('The theme should switch between light and dark modes, and the choice should persist on page reload.');

// Check for any legacy keys
const legacyDarkMode = localStorage.getItem('darkMode');
if (legacyDarkMode) {
  console.warn('⚠️  Legacy darkMode key found in localStorage:', legacyDarkMode);
  console.log('This should be automatically migrated to the new "theme" key.');
} else {
  console.log('✅ No legacy keys found - clean migration.');
}
