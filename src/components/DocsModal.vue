<template>
  <div class="docs-modal" v-if="isOpen" @click.self="closeModal">
    <div class="docs-content">
      <div class="docs-header">
        <h2>📚 K8TAR Field Day Logger Documentation</h2>
        <button class="close-button" @click="closeModal">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="docs-body" v-html="renderedMarkdown"></div>
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
  return marked(markdownContent.value);
});

const closeModal = () => {
  emit('close');
};

const loadDocumentation = async () => {
  try {
    const response = await fetch('/docs/README.md');
    if (response.ok) {
      markdownContent.value = await response.text();
    } else {
      markdownContent.value = `
# Documentation Not Available

The documentation file could not be loaded. Please check that the docs/README.md file exists.

## Quick Help

### Main Screen
- **QSO Entry**: Enter callsign, class, and section, then press Enter
- **Recent Contacts**: Shows your latest QSOs
- **Score Statistics**: Real-time scoring information
- **Network**: Connect multiple stations using the WiFi icon

### Keyboard Shortcuts
- **Tab**: Move between fields
- **Enter**: Log the current QSO
- **Escape**: Clear the form

### Getting Started
1. Click the settings gear to configure your station
2. Use the network icon to connect multiple stations
3. Start logging contacts in the QSO Entry form

For more help, check the console logs (F12) or contact K8TAR.
      `;
    }
  } catch (error) {
    console.error('Error loading documentation:', error);
    markdownContent.value = `
# Documentation Error

There was an error loading the documentation: ${error}

## Quick Reference
- Enter callsigns in the QSO Entry Form
- Use Tab to move between fields
- Press Enter to log QSOs
- Click the WiFi icon to connect stations
- Use the gear icon for settings
    `;
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  if (props.isOpen) {
    loadDocumentation();
  }
});

// Load docs when modal opens
const { isOpen } = toRefs(props);
watch(isOpen, (newValue) => {
  if (newValue && !markdownContent.value) {
    loadDocumentation();
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
