<!-- filepath: c:\git\k8tar-fieldday\src\components\Messages.vue -->
<template>
  <div class="messages-container">
    <h3>Latest Message</h3>
    <div class="messages-content">
      <transition name="fade">
        <div v-if="latestMessage" class="message" :class="messageTypeClass">
          <div class="message-icon">{{ messageIcon }}</div>
          <div class="message-text">{{ latestMessage.text }}</div>
          <div class="message-time">{{ formatTime(latestMessage.timestamp) }}</div>
        </div>
        <div v-else class="no-messages">
          No recent messages
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { networkService } from '@/services/networkService';

interface Message {
  id: string;
  type: 'bonus' | 'section' | 'multiplier' | 'network' | 'info';
  text: string;
  timestamp: number;
}

const store = useStore();
const messages = ref<Message[]>([]);

// Get the latest message
const latestMessage = computed(() => {
  if (messages.value.length === 0) return null;
  return messages.value[messages.value.length - 1];
});

// Compute CSS class for message type
const messageTypeClass = computed(() => {
  if (!latestMessage.value) return '';
  return `message-${latestMessage.value.type}`;
});

// Compute icon for message type
const messageIcon = computed(() => {
  if (!latestMessage.value) return '';
  switch (latestMessage.value.type) {
    case 'bonus':
      return '⭐';
    case 'section':
      return '🎯';
    case 'multiplier':
      return '✨';
    case 'network':
      return '🔄';
    case 'info':
    default:
      return 'ℹ️';
  }
});

// Format timestamp for display
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Add a new message
function addMessage(type: Message['type'], text: string) {
  const message: Message = {
    id: Date.now().toString(),
    type,
    text,
    timestamp: Date.now()
  };
  
  messages.value.push(message);
  
  // Keep only the last 10 messages to prevent memory buildup
  if (messages.value.length > 10) {
    messages.value = messages.value.slice(-10);
  }
}

// Network event handlers
function handleNetworkConnected(event: any) {
  if (event.type === 'host') {
    addMessage('network', `Started hosting network on port ${event.port}`);
  } else {
    addMessage('network', `Connected to ${event.station.callsign} network`);
  }
}

function handleNetworkDisconnected() {
  addMessage('network', 'Disconnected from network');
}

function handleNetworkAutoReconnected(event: any) {
  if (event.type === 'host') {
    addMessage('network', `Auto-reconnected as host`);
  } else {
    addMessage('network', `Auto-reconnected to ${event.address}`);
  }
}

function handleNetworkConnectionLost() {
  addMessage('network', 'Connection lost, attempting to reconnect...');
}

function handleNetworkReconnectFailed(event: any) {
  addMessage('network', `Reconnect attempt ${event.attempt} failed`);
}

function handleNetworkReconnectExhausted() {
  addMessage('network', 'All reconnect attempts failed, network disabled');
}

function handleInitialSyncComplete(event: any) {
  addMessage('network', `Initial sync complete: ${event.syncedQsos} QSOs received`);
}

function handleQsoSynced(event: any) {
  const { action, qso, stationId } = event;
  if (action === 'add') {
    addMessage('network', `QSO synced from ${stationId}: ${qso.call}`);
  }
}

// Set up network event listeners
onMounted(() => {
  networkService.on('network:connected', handleNetworkConnected);
  networkService.on('network:disconnected', handleNetworkDisconnected);
  networkService.on('network:auto-reconnected', handleNetworkAutoReconnected);
  networkService.on('network:connection-lost', handleNetworkConnectionLost);
  networkService.on('network:reconnect-failed', handleNetworkReconnectFailed);
  networkService.on('network:reconnect-exhausted', handleNetworkReconnectExhausted);
  networkService.on('network:initial-sync-complete', handleInitialSyncComplete);
  networkService.on('qso:synced', handleQsoSynced);
});

onUnmounted(() => {
  networkService.off('network:connected', handleNetworkConnected);
  networkService.off('network:disconnected', handleNetworkDisconnected);
  networkService.off('network:auto-reconnected', handleNetworkAutoReconnected);
  networkService.off('network:connection-lost', handleNetworkConnectionLost);
  networkService.off('network:reconnect-failed', handleNetworkReconnectFailed);
  networkService.off('network:reconnect-exhausted', handleNetworkReconnectExhausted);
  networkService.off('network:initial-sync-complete', handleInitialSyncComplete);
  networkService.off('qso:synced', handleQsoSynced);
});

// Expose the addMessage function to parent components
defineExpose({
  addMessage
});
</script>

<style lang="scss" scoped>
@use '@/assets/styles/global.scss';

.messages-container {
  background-color: var(--form-bg);
  color: var(--text-color);
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
  display: flex;
  flex-direction: column;
  height: 100%;
}

h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-color);
  transition: color 0.3s ease;
  font-size: 1rem;
}

.messages-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

.message-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.message-text {
  flex: 1;
  font-size: 0.9rem;
  line-height: 1.3;
  word-wrap: break-word;
}

.message-time {
  font-size: 0.75rem;
  color: var(--text-color);
  opacity: 0.7;
  flex-shrink: 0;
}

.message-bonus {
  background-color: rgba(255, 215, 0, 0.1);
  border-color: #ffd700;
  color: #b8860b;
}

[data-theme="dark"] .message-bonus {
  background-color: rgba(255, 215, 0, 0.15);
  border-color: #ffd700;
  color: #ffd700;
}

.message-section {
  background-color: rgba(34, 139, 34, 0.1);
  border-color: #228b22;
  color: #006400;
}

[data-theme="dark"] .message-section {
  background-color: rgba(34, 139, 34, 0.15);
  border-color: #32cd32;
  color: #32cd32;
}

.message-multiplier {
  background-color: rgba(138, 43, 226, 0.1);
  border-color: #8a2be2;
  color: #4b0082;
}

[data-theme="dark"] .message-multiplier {
  background-color: rgba(138, 43, 226, 0.15);
  border-color: #ba55d3;
  color: #ba55d3;
}

.message-info {
  background-color: rgba(30, 144, 255, 0.1);
  border-color: #1e90ff;
  color: #0066cc;
}

[data-theme="dark"] .message-info {
  background-color: rgba(30, 144, 255, 0.15);
  border-color: #1e90ff;
  color: #87ceeb;
}

.message-network {
  background-color: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #1d4ed8;
}

[data-theme="dark"] .message-network {
  background-color: rgba(59, 130, 246, 0.15);
  border-color: #60a5fa;
  color: #93c5fd;
}

.no-messages {
  font-style: italic;
  color: var(--text-color);
  opacity: 0.7;
  font-size: 0.9rem;
  text-align: center;
  padding: 1rem;
}

/* Fade transition for new messages */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
