import { ref, watch } from 'vue';

// Check if fileStorage is available (only in browser with app loaded)
interface FileStorageApi {
  getSettings(): Promise<{ theme?: string; band?: string; operator?: string; mode?: string }>;
  saveSettings(settings: Record<string, unknown>): Promise<void>;
}

declare global {
  interface Window {
    fileStorage?: FileStorageApi;
  }
}

// Function to safely check theme storage
async function getInitialTheme(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    // Try to get theme from file storage first
    if (window.fileStorage && typeof window.fileStorage.getSettings === 'function') {
      const settings = await window.fileStorage.getSettings();
      if (settings.theme !== undefined) {
        return settings.theme === 'dark';
      }
    }
  } catch (e: unknown) {
    console.warn('Failed to load theme from file storage:', e);
  }
  
  // Fall back to system preference if no stored preference
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  return false;
}

// Function to save theme
async function saveTheme(isDarkMode: boolean): Promise<void> {
  try {
    if (window.fileStorage && typeof window.fileStorage.saveSettings === 'function') {
      const currentSettings = await window.fileStorage.getSettings();
      await window.fileStorage.saveSettings({
        ...currentSettings,
        theme: isDarkMode ? 'dark' : 'light'
      });
    }
  } catch (e: unknown) {
    console.error('Failed to save theme to file storage:', e);
  }
}

// Initialize reactive state
const isDark = ref(false);

// Initialize theme asynchronously
getInitialTheme().then(initialTheme => {
  isDark.value = initialTheme;
  applyTheme(isDark.value);
});

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

// Watch for changes to isDark and apply them
watch(isDark, (newValue) => {
  applyTheme(newValue);
  saveTheme(newValue);
}, { immediate: false });

// Toggle function
function toggleTheme() {
  isDark.value = !isDark.value;
}

export { isDark, toggleTheme };