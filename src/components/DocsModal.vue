<template>
  <div class="docs-modal" v-if="isOpen" @click.self="closeModal">
    <div class="docs-content">
      <div class="docs-header">
        <h2>📚 K8TAR Field Day Logger Documentation</h2>
        <button class="close-button" @click="closeModal">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="docs-body" v-html="renderedMarkdown" @click="handleDocClick"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { marked } from 'marked';
import { isDark } from '@/store/theme';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const markdownContent = ref('');
const isLoading = ref(true);

// Configure marked options for better rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderedMarkdown = computed(() => {
  if (!markdownContent.value) return '<p>Loading documentation...</p>';
  
  // Render markdown to HTML
  let html = marked(markdownContent.value) as string;
  
  // Post-process to add IDs to headings
  html = html.replace(/<h([1-6])([^>]*)>([^<]+)<\/h[1-6]>/g, (match, level, attrs, text) => {
    // Create a slug from the heading text, removing emojis and special chars
    const id = text
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
      .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-'); // Replace spaces with hyphens
    
    return `<h${level}${attrs} id="${id}">${text}</h${level}>`;
  });
  
  return html;
});

const closeModal = () => {
  emit('close');
};

const handleDocClick = (event: Event) => {
  const target = event.target as HTMLElement;
  if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#')) {
    event.preventDefault();
    const anchor = target.getAttribute('href')?.substring(1);
    if (anchor) {
      const element = document.getElementById(anchor);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }
};

const loadDocumentation = async () => {
  try {
    // Try to load documentation from public folder
    const response = await fetch('./docs/README.md');
    if (response.ok) {
      markdownContent.value = await response.text();
      isLoading.value = false;
      return;
    }
  } catch (error) {
    console.warn('Could not load external documentation, using built-in version:', error);
  }
  
  // Fallback to built-in documentation
  markdownContent.value = `
# K8TAR Field Day Logger - User Documentation

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Main Screen Overview](#main-screen-overview)
3. [QSO Entry Form](#qso-entry-form)
4. [Station Configuration](#station-configuration)
5. [Network Operations](#network-operations)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

The K8TAR Field Day Logger is designed for ARRL Field Day operations, allowing multiple stations to log QSOs and sync data in real-time.

### Quick Start
1. **Launch the application** - The logger opens directly to the main logging screen
2. **Configure your station** - Click the settings icon ⚙️ to set your callsign and station designator
3. **Connect to network** - Use the network icon 📶 to connect multiple stations
4. **Start logging** - Enter callsigns in the QSO Entry Form and press Enter to log contacts

### First Time Setup
When you first run the application, a configuration dialog will appear asking for:
- **Station Callsign** - Your amateur radio callsign (e.g., K8TAR)
- **Station Designator** - Your station's role (e.g., PHONE 1, PHONE 2, CW 1, DIGI 1, GOTA)
- **Class** - Your Field Day class (e.g., 1A, 2A, 3A)
- **Section** - Your ARRL section (e.g., WPA, OH, MI)
- **Operators** - List of operators who will use this station

---

## 🖥️ Main Screen Overview

The main screen is divided into several key areas:

### Header Bar
- **Station Info** - Shows your callsign and station designator
- **Mode/Band/Operator Controls** - Quick access to change operating parameters
- **Network Status** - Shows connection status and connected stations
- **Settings** - Access configuration options
- **Theme Toggle** - Switch between light and dark modes

### Content Areas
- **Recent Contacts** (Left) - Shows your latest QSOs with timestamps and details
- **Score Statistics** (Right) - Real-time scoring with QSO counts and multipliers
- **QSO Entry Form** (Bottom Left) - Primary logging interface
- **Station Information** - Current station configuration
- **Possible Duplicates** - Alerts for potential duplicate contacts
- **Messages** - System messages and alerts
- **Section Progress** (Right) - Visual progress of worked sections

---

## 📝 QSO Entry Form

The QSO entry form is your primary tool for logging contacts:

### Fields
- **Callsign** - Enter the contacted station's callsign (automatically converted to uppercase)
- **Class** - The contacted station's Field Day class (e.g., 1A, 2F, 1B)
- **Section** - The contacted station's ARRL section (validated against official list)

### Quick Entry Tips
- **Tab** - Move between fields
- **Enter** - Log the QSO and clear the form
- **Escape** - Clear the current entry
- **Auto-completion** - Section field provides suggestions as you type

### Validation
- Callsigns are automatically formatted and validated
- Classes must follow Field Day format (1-3 digits + A-F)
- Sections are validated against the official ARRL section list
- Duplicate detection runs automatically as you type

---

## ⚙️ Station Configuration

Access station configuration through the settings icon in the header.

### Basic Settings
- **Station Designator** - Identifies your station (PHONE 1, CW 1, etc.)
- **Station Callsign** - Your amateur radio callsign
- **Class** - Your Field Day class
- **Section** - Your ARRL section

### Operator Management
- Add multiple operators who will use the station
- Remove operators no longer needed
- Current operator selection affects logging

### Data Management
- **Export QSOs** - Save your log data as ADIF or JSON
- **Import QSOs** - Load previously saved log data
- **Reset Log** - Clear all QSO data (requires confirmation)
- **Backup All Data** - Export complete station configuration and logs

---

## 🌐 Network Operations

Connect multiple stations for real-time synchronization:

### Network Setup
1. Click the network icon 📶 in the header
2. Choose "Host Network" on one station (usually the main logging station)
3. Other stations click "Join Network" and enter the host's IP address
4. Connected stations appear in the network status

### Network Features
- **Real-time QSO sync** - QSOs appear on all connected stations instantly
- **Duplicate detection** - Works across all connected stations
- **Score aggregation** - Combined scoring from all stations
- **Message broadcast** - Send messages to all connected stations

### Network Troubleshooting
- Ensure all computers are on the same network
- Check firewall settings (port 8080 must be open)
- Use IP addresses if computer names don't work
- Only one station should host the network

---

## ⌨️ Keyboard Shortcuts

### Global Shortcuts
- **F1** - Open this documentation
- **Tab** - Move between form fields
- **Enter** - Log QSO (when in callsign field)
- **Escape** - Clear current QSO entry

### QSO Entry Shortcuts
- Focus automatically returns to callsign field after logging
- Type ahead search in section field
- Auto-capitalization in all fields

### Navigation
- Click on any recent QSO to view details
- Use section map to visualize progress
- Theme toggle available in header

---

## 🔧 Troubleshooting

### Common Issues

**"Getting Started" Button Not Working**
- If you see a "Get Started" button, your station needs initial configuration
- Click the button and fill in all required fields
- Make sure your class and section are valid Field Day values

**Network Connection Problems**
- Verify all computers are on the same local network
- Check that port 8080 is not blocked by firewall
- Try using IP addresses instead of computer names
- Only one station should be the network host

**QSO Won't Log**
- Ensure all fields (callsign, class, section) are filled
- Verify the section is a valid ARRL section
- Check that the class follows Field Day format (e.g., 1A, 2B)
- Look for duplicate warnings

**Missing Data After Restart**
- Data is saved automatically in Electron version
- Check that the application has write permissions
- In browser version, data persists in browser storage

**Documentation Won't Load**
- This built-in documentation should always be available
- External documentation requires internet connection in browser version
- Electron version includes documentation in the app package

### Getting Help
- Check the console (F12) for error messages
- Verify your network setup for multi-station operation
- Contact K8TAR for additional support

### Data Locations
- **Electron Version**: Data stored in application data folder
- **Browser Version**: Data stored in browser local storage
- **Network Mode**: Data synchronized across all connected stations

---

## 📊 Field Day Scoring

The application automatically calculates Field Day scores:

### QSO Points
- **Phone/Digital**: 1 point per QSO
- **CW**: 2 points per QSO
- **Satellite**: 2 points per QSO

### Multipliers
- Each ARRL section worked = 1 multiplier
- Score = (Total QSO Points) × (Number of Sections Worked)

### Real-time Updates
- Score updates automatically as you log QSOs
- Section progress shows visually on the section map
- Recent contacts list shows your latest activity

---

*For additional help or feature requests, contact K8TAR at support@k8tar.com*
  `;
  isLoading.value = false;
};

onMounted(async () => {
  if (props.isOpen) {
    await loadDocumentation().catch(() => {
      // Error already handled in loadDocumentation function
    });
  }
});

// Load docs when modal opens
const { isOpen } = toRefs(props);
watch(isOpen, async (newValue) => {
  if (newValue && !markdownContent.value) {
    await loadDocumentation().catch(() => {
      // Error already handled in loadDocumentation function
    });
  }
});
</script>

<script lang="ts">
import { toRefs, watch } from 'vue';
</script>

<style lang="scss" scoped>
.docs-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--modal-bg);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 2rem;
  box-sizing: border-box;
}

.docs-content {
  background: var(--modal-content);
  border-radius: 12px;
  width: 100%;
  max-width: 1200px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
}

.docs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--primary-color);
  color: white;
  border-radius: 12px 12px 0 0;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
  color: white;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .material-icons {
    font-size: 24px;
  }
}

.docs-body {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  line-height: 1.6;

  :deep(h1) {
    color: var(--primary-color);
    border-bottom: 2px solid var(--primary-color);
    padding-bottom: 0.5rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  :deep(h2) {
    color: var(--primary-color);
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-size: 1.4rem;
  }

  :deep(h3) {
    color: var(--text-color);
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-size: 1.2rem;
  }

  :deep(h4) {
    color: var(--text-color);
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-size: 1.1rem;
  }

  :deep(p) {
    margin-bottom: 1rem;
    color: var(--text-color);
  }

  :deep(ul), :deep(ol) {
    margin-bottom: 1rem;
    padding-left: 2rem;
    color: var(--text-color);
  }

  :deep(li) {
    margin-bottom: 0.5rem;
  }

  :deep(code) {
    background: var(--secondary-color);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.9rem;
    color: var(--primary-color);
  }

  :deep(pre) {
    background: var(--secondary-color);
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 1rem;
    border-left: 4px solid var(--primary-color);
    border: 1px solid var(--border-color);

    code {
      background: none;
      padding: 0;
      color: var(--text-color);
    }
  }

  :deep(blockquote) {
    border-left: 4px solid var(--primary-color);
    background: var(--secondary-color);
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 0 8px 8px 0;
    border: 1px solid var(--border-color);
    border-left: 4px solid var(--primary-color);
    
    p {
      margin-bottom: 0;
    }
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
    background: var(--modal-content);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  :deep(th), :deep(td) {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  :deep(th) {
    background: var(--primary-color);
    color: white;
    font-weight: 600;
  }

  :deep(tr:hover) {
    background: var(--hover-color);
  }

  :deep(a) {
    color: var(--primary-color);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;

    &:hover {
      border-bottom-color: var(--primary-color);
    }
  }

  :deep(hr) {
    border: none;
    height: 2px;
    background: linear-gradient(90deg, var(--primary-color), transparent);
    margin: 2rem 0;
  }

  // Special styling for the visual grid representation
  :deep(pre:has(code:contains("┌"))) {
    font-family: monospace;
    background: var(--secondary-color);
    padding: 1rem;
    border-radius: 8px;
    border: 2px solid var(--primary-color);
  }
}

// Mobile responsiveness
@media (max-width: 768px) {
  .docs-modal {
    padding: 1rem;
  }

  .docs-content {
    height: 95vh;
  }

  .docs-header {
    padding: 1rem;

    h2 {
      font-size: 1.2rem;
    }
  }

  .docs-body {
    padding: 1rem;
  }
}
</style>
