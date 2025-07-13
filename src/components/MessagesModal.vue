<!-- Full-screen Messages Modal for Header -->
<template>
  <div v-if="isOpen" class="messages-modal-overlay" @click.self="$emit('close')">
    <div class="messages-modal-content">
      <div class="modal-header">
        <h2>Messages</h2>
        <button class="close-button" @click="$emit('close')">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <div v-if="messages.length === 0" class="no-messages">
          No messages yet
        </div>
        <div v-else class="messages-list">
          <div v-for="message in allMessagesReversed" :key="message.id" 
               class="message" :class="`message-${message.type}`">
            <div class="message-icon">{{ getIconForType(message.type) }}</div>
            <div class="message-content">
              <div class="message-text">{{ message.text }}</div>
              <div class="message-meta">
                <span class="message-time">{{ formatFullTime(message.timestamp) }}</span>
                <span v-if="message.from" class="message-from">from {{ getStationDesignatorFromId(message.from) }}</span>
                <span v-if="message.target && message.target !== 'all'" class="message-target">to {{ message.target }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <!-- Send Message Form -->
        <div class="modal-message-form">
          <input 
            v-model="newMessage" 
            @keyup.enter="sendMessage"
            placeholder="Type message to all stations..." 
            class="modal-message-input"
            maxlength="200"
          />
          <button @click="sendMessage" :disabled="!newMessage.trim()" class="modal-send-button">
            <span class="material-icons">send</span>
            Send
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { 
  messages as storeMessages,
  allMessages as storeAllMessages,
  sendMessage as sendMessageStore,
  addMessage as addMessageStore,
  refreshMessagesFromBackend
} from '@/store/message';
import { fileStorage } from '@/services/fileStorage';

interface Message {
  id: string;
  type: 'bonus' | 'section' | 'multiplier' | 'network' | 'info' | 'chat' | 'announcement';
  text: string;
  timestamp: number;
  from?: string;
  target?: string;
}

const props = defineProps<{
  isOpen: boolean;
}>();

defineEmits<{
  close: [];
}>();

// Use global message store instead of local state
const messages = computed(() => storeMessages.value);
const newMessage = ref('');

// Get all messages in reverse chronological order (newest first)
const allMessagesReversed = computed(() => storeAllMessages.value);

// Get icon for a specific message type
function getIconForType(type: Message['type']): string {
  switch (type) {
    case 'bonus':
      return '⭐';
    case 'section':
      return '🎯';
    case 'multiplier':
      return '✨';
    case 'network':
      return '🔄';
    case 'chat':
      return '💬';
    case 'announcement':
      return '❗';
    case 'info':
    default:
      return 'ℹ️';
  }
}

// Extract station designator from station ID
function getStationDesignatorFromId(stationId: string): string {
  if (!stationId) return '';
  const parts = stationId.split('-');
  return parts.length > 1 ? parts[parts.length - 1] : stationId;
}

// Format timestamp with date for display
function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString([], { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
}

// Send a message using the global store
async function sendMessage() {
  if (!newMessage.value.trim()) return;

  try {
    await sendMessageStore(newMessage.value.trim());
    newMessage.value = '';
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

onMounted(async () => {
  // The global message store handles loading and refreshing automatically
  // No need for local message management
});

onUnmounted(() => {
  // Global store handles cleanup
});

// Refresh messages when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // Trigger refresh from backend
    await refreshMessagesFromBackend();
  }
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';

.messages-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.messages-modal-content {
  background-color: var(--form-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--primary-color);
  color: white;
  border-radius: 8px 8px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-button {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.modal-body {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

.no-messages {
  text-align: center;
  color: var(--text-color);
  font-style: italic;
  margin-top: 2rem;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
}

.message-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
}

.message-text {
  color: var(--text-color);
  margin-bottom: 0.25rem;
  word-wrap: break-word;
}

.message-meta {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.message-from,
.message-target {
  font-weight: 500;
}

.modal-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  background-color: var(--header-color);
}

.modal-message-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.modal-message-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 1rem;
}

.modal-message-input::placeholder {
  color: var(--text-color-secondary);
}

.modal-send-button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.modal-send-button:hover:not(:disabled) {
  background-color: var(--primary-dark);
}

.modal-send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Message type specific styling */
.message-bonus {
  border-left: 4px solid #ffd700;
}

.message-section {
  border-left: 4px solid #4caf50;
}

.message-multiplier {
  border-left: 4px solid #ff9800;
}

.message-network {
  border-left: 4px solid #2196f3;
}

.message-chat {
  border-left: 4px solid #9c27b0;
}

.message-announcement {
  border-left: 4px solid #f44336;
}

.message-info {
  border-left: 4px solid #607d8b;
}
</style>
