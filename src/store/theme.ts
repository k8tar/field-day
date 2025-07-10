import { ref, watch } from 'vue';

// Initialize theme preference
let darkModePreference = false;

// Function to safely check localStorage and system preference
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check new key first
  const newTheme = localStorage.getItem('theme');
  if (newTheme !== null) {
    return newTheme === 'dark';
  }
  
  // Check for legacy keys and migrate
  const legacyDarkMode = localStorage.getItem('darkMode');
  if (legacyDarkMode !== null) {
    const isLegacyDark = legacyDarkMode === 'true';
    // Migrate to new key
    localStorage.setItem('theme', isLegacyDark ? 'dark' : 'light');
    localStorage.removeItem('darkMode'); // Clean up old key
    return isLegacyDark;
  }
  
  // Default to system preference
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  return false;
}

// Initialize reactive state
const isDark = ref(getInitialTheme());

// Function to apply theme to DOM
function applyTheme(isDarkMode: boolean) {
  if (typeof document === 'undefined') return;
  
  if (isDarkMode) {
    document.documentElement.classList.add('dark-mode');
    document.documentElement.classList.remove('light-mode');
  } else {
    document.documentElement.classList.remove('dark-mode');
    document.documentElement.classList.add('light-mode');
  }
}

// Apply initial theme
applyTheme(isDark.value);
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
}

// Watch for changes to isDark and apply them
watch(isDark, (newValue) => {
  applyTheme(newValue);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('theme', newValue ? 'dark' : 'light');
  }
  console.log('Theme changed to:', newValue ? 'dark' : 'light');
}, { immediate: false });

// Toggle function
function toggleTheme() {
  console.log('toggleTheme called, current value:', isDark.value);
  isDark.value = !isDark.value;
  console.log('toggleTheme new value:', isDark.value);
}

export { isDark, toggleTheme };