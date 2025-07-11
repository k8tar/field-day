<!-- filepath: c:\git\k8tar-fieldday\src\components\Messages.vue -->
<template>
  <div class="messages-container">
    <div class="messages-header">
      <h3>Recent Messages</h3>
      <button class="view-all-button" @click="showAllMessages = true" title="View All Messages">
        <span class="material-icons">chat</span>
      </button>
    </div>
    
    <div class="messages-content">
      <div v-if="recentMessages.length > 0" class="recent-messages-list">
        <transition-group name="fade" tag="div">
          <div v-for="message in recentMessages" :key="message.id" 
               class="message" :class="`message-${message.type}`">
            <div class="message-icon">{{ getIconForType(message.type) }}</div>
            <div class="message-content">
              <div class="message-text">{{ message.text }}</div>
              <div class="message-meta">
                <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                <span v-if="message.from" class="message-from">from {{ message.from }}</span>
                <span v-if="message.target && message.target !== 'all'" class="message-target">to {{ message.target }}</span>
              </div>
            </div>
          </div>
        </transition-group>
      </div>
      <div v-else class="no-messages">
        No recent messages
      </div>
    </div>

    <!-- Send Message Form -->
    <div class="send-message-form">
      <div class="message-input-row">
        <select v-model="selectedTarget" class="target-select">
          <option value="all">All Stations</option>
          <option v-for="station in connectedStations" :key="station.id" :value="station.id">
            {{ station.callsign }}-{{ station.designator }}
          </option>
        </select>
        <input 
          v-model="newMessage" 
          @keyup.enter="sendMessage"
          placeholder="Type message..." 
          class="message-input"
          maxlength="200"
        />
        <button @click="sendMessage" :disabled="!newMessage.trim()" class="send-button">
          <span class="material-icons">send</span>
        </button>
      </div>
    </div>

    <!-- All Messages Modal -->
    <div v-if="showAllMessages" class="messages-modal" @click.self="showAllMessages = false">
      <div class="messages-modal-content">
        <div class="modal-header">
          <h3>All Messages</h3>
          <button class="close-button" @click="showAllMessages = false">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="modal-body">
          <div v-if="messages.length === 0" class="no-messages">
            No messages yet
          </div>
          <div v-else class="messages-list">
            <div v-for="message in messages" :key="message.id" 
                 class="message" :class="`message-${message.type}`">
              <div class="message-icon">{{ getIconForType(message.type) }}</div>
              <div class="message-content">
                <div class="message-text">{{ message.text }}</div>
                <div class="message-meta">
                  <span class="message-time">{{ formatFullTime(message.timestamp) }}</span>
                  <span v-if="message.from" class="message-from">from {{ message.from }}</span>
                  <span v-if="message.target && message.target !== 'all'" class="message-target">to {{ message.target }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <!-- Send Message Form in Modal -->
          <div class="modal-message-form">
            <select v-model="modalSelectedTarget" class="modal-target-select">
              <option value="all">All Stations</option>
              <option v-for="station in connectedStations" :key="station.id" :value="station.id">
                {{ station.callsign }}-{{ station.designator }}
              </option>
            </select>
            <input 
              v-model="modalNewMessage" 
              @keyup.enter="sendModalMessage"
              placeholder="Type message..." 
              class="modal-message-input"
              maxlength="200"
            />
            <button @click="sendModalMessage" :disabled="!modalNewMessage.trim()" class="modal-send-button">
              <span class="material-icons">send</span>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { networkService } from '@/services/networkService';
import { fileStorage } from '@/services/fileStorage';

interface Message {
  id: string;
  type: 'bonus' | 'section' | 'multiplier' | 'network' | 'info' | 'chat';
  text: string;
  timestamp: number;
  from?: string;
  target?: string;
}

const store = useStore();
const messages = ref<Message[]>([]);

// UI state
const showAllMessages = ref(false);
const newMessage = ref('');
const selectedTarget = ref('all');

// Modal message sending state
const modalNewMessage = ref('');
const modalSelectedTarget = ref('all');

// Get connected stations from network service
const connectedStations = computed(() => {
  return networkService.getConnectedStations();
});

// Get the latest message
const latestMessage = computed(() => {
  if (messages.value.length === 0) return null;
  return messages.value[messages.value.length - 1];
});

// Get the recent messages (latest 5)
const recentMessages = computed(() => {
  return messages.value.slice(-5);
});

// Compute CSS class for message type
const messageTypeClass = computed(() => {
  if (!latestMessage.value) return '';
  return `message-${latestMessage.value.type}`;
});

// Compute icon for message type
const messageIcon = computed(() => {
  if (!latestMessage.value) return '';
  return getIconForType(latestMessage.value.type);
});

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
    case 'info':
    default:
      return 'ℹ️';
  }
}

// Format timestamp for display
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

// Add a new message
function addMessage(type: Message['type'], text: string, from?: string, target?: string) {
  const message: Message = {
    id: Date.now().toString(),
    type,
    text,
    timestamp: Date.now(),
    from,
    target
  };
  
  messages.value.push(message);
  
  // Keep only the last 10 messages to prevent memory buildup
  if (messages.value.length > 10) {
    messages.value = messages.value.slice(-10);
  }
}

// Send a message
async function sendMessage() {
  if (!newMessage.value.trim()) return;
  
  try {
    const messageText = newMessage.value.trim();
    const target = selectedTarget.value;
    
    // Get current station info
    const stationConfig = await fileStorage.getStationConfig();
    const stationId = `${stationConfig.callsign}-${stationConfig.designator}`;
    
    // Add message locally first with sender information
    addMessage('chat', messageText, stationId, target);
    
    // Send to network if connected
    if (networkService.status.isConnected) {
      try {
        await networkService.sendMessage(messageText, target);
        console.log(`✅ Message sent from ${stationId} to ${target}: ${messageText}`);
      } catch (error) {
        console.error('Failed to send message to network:', error);
        addMessage('info', 'Failed to send message to network');
      }
    } else {
      // Store locally via API for standalone operation
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'chat',
            text: messageText,
            from: stationId,
            target,
            stationId
          })
        });
        
        if (response.ok) {
          console.log('✅ Message stored locally');
        }
      } catch (error) {
        console.error('Failed to store message locally:', error);
      }
    }
    
    // Clear input
    newMessage.value = '';
  } catch (error) {
    console.error('Failed to send message:', error);
    addMessage('info', 'Failed to send message');
  }
}

// Send a message from the modal
async function sendModalMessage() {
  if (!modalNewMessage.value.trim()) return;
  
  try {
    const messageText = modalNewMessage.value.trim();
    const target = modalSelectedTarget.value;
    
    // Get current station info
    const stationConfig = await fileStorage.getStationConfig();
    const stationId = `${stationConfig.callsign}-${stationConfig.designator}`;
    
    // Add message locally first with sender information
    addMessage('chat', messageText, stationId, target);
    
    // Send to network if connected
    if (networkService.status.isConnected) {
      try {
        await networkService.sendMessage(messageText, target);
        console.log(`✅ Message sent from ${stationId} to ${target}: ${messageText}`);
      } catch (error) {
        console.error('Failed to send message to network:', error);
        addMessage('info', 'Failed to send message to network');
      }
    } else {
      // Store locally via API for standalone operation
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'chat',
            text: messageText,
            from: stationId,
            target,
            stationId
          })
        });
        
        if (response.ok) {
          console.log('✅ Message stored locally');
        }
      } catch (error) {
        console.error('Failed to store message locally:', error);
      }
    }
    
    // Clear modal input
    modalNewMessage.value = '';
  } catch (error) {
    console.error('Failed to send message from modal:', error);
    addMessage('info', 'Failed to send message');
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

// Handle incoming network messages
function handleNetworkMessage(event: any) {
  const message = event;
  console.log('📨 Received network message:', message);
  
  // Add the message if it's not already in our list (avoid duplicates)
  const existingMessage = messages.value.find(m => m.id === message.id);
  if (!existingMessage) {
    addMessage(message.type, message.text, message.from, message.target);
  }
}

// Sync messages from the API (for network and standalone mode)
async function syncMessages() {
  try {
    const response = await fetch('/api/messages?limit=20');
    if (response.ok) {
      const data = await response.json();
      const remoteMessages = data.messages || [];
      
      // Add any new messages we don't have locally
      remoteMessages.forEach((remoteMessage: any) => {
        const existingMessage = messages.value.find(m => m.id === remoteMessage.id);
        if (!existingMessage) {
          const message: Message = {
            id: remoteMessage.id,
            type: remoteMessage.type,
            text: remoteMessage.text,
            timestamp: remoteMessage.timestamp,
            from: remoteMessage.from,
            target: remoteMessage.target
          };
          messages.value.push(message);
        }
      });
      
      // Sort messages by timestamp and keep only the latest 20
      messages.value.sort((a, b) => a.timestamp - b.timestamp);
      if (messages.value.length > 20) {
        messages.value = messages.value.slice(-20);
      }
    }
  } catch (error) {
    console.error('Error syncing messages:', error);
  }
}

// Set up network event listeners
let messageSyncInterval: number | null = null;

onMounted(() => {
  networkService.on('network:connected', handleNetworkConnected);
  networkService.on('network:disconnected', handleNetworkDisconnected);
  networkService.on('network:auto-reconnected', handleNetworkAutoReconnected);
  networkService.on('network:connection-lost', handleNetworkConnectionLost);
  networkService.on('network:reconnect-failed', handleNetworkReconnectFailed);
  networkService.on('network:reconnect-exhausted', handleNetworkReconnectExhausted);
  networkService.on('network:initial-sync-complete', handleInitialSyncComplete);
  networkService.on('qso:synced', handleQsoSynced);
  networkService.on('message:received', handleNetworkMessage);
  
  // Start periodic message sync (every 10 seconds)
  messageSyncInterval = window.setInterval(syncMessages, 10000);
  
  // Initial message sync
  syncMessages();
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
  networkService.off('message:received', handleNetworkMessage);
  
  // Clear message sync interval
  if (messageSyncInterval) {
    clearInterval(messageSyncInterval);
  }
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

.messages-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.view-all-button {
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--accent-color);
  }

  .material-icons {
    font-size: 18px;
  }
}

.messages-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.recent-messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
}

.message {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.4rem;
  border-radius: 4px;
  margin-bottom: 0.25rem;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
  font-size: 0.85rem;
}

.message-icon {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.message-text {
  font-size: 0.85rem;
  line-height: 1.2;
  word-wrap: break-word;
  margin-bottom: 0.15rem;
}

.message-time {
  font-size: 0.75rem;
  color: var(--text-color);
  opacity: 0.7;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.message-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.7rem;
  color: var(--text-color);
  opacity: 0.8;
}

.message-from, .message-target {
  font-style: italic;
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

.message-chat {
  background-color: rgba(64, 196, 255, 0.1);
  border-color: #40c4ff;
  color: #0277bd;
}

[data-theme="dark"] .message-chat {
  background-color: rgba(64, 196, 255, 0.15);
  border-color: #40c4ff;
  color: #81d4fa;
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

/* Send Message Form */
.send-message-form {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.message-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.target-select {
  flex: 0 0 auto;
  min-width: 120px;
  padding: 0.3rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.8rem;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.message-input {
  flex: 1;
  padding: 0.3rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.8rem;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  &::placeholder {
    color: var(--text-color);
    opacity: 0.6;
  }
}

.send-button {
  flex: 0 0 auto;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background: var(--accent-color);
  }

  &:disabled {
    background: var(--border-color);
    cursor: not-allowed;
  }

  .material-icons {
    font-size: 16px;
  }
}

/* Messages Modal */
.messages-modal {
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
  padding: 0;
  box-sizing: border-box;
}

.messages-modal-content {
  background: var(--modal-content);
  border-radius: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  border: none;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--primary-color);
  color: white;
  border-radius: 0;

  h3 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
    color: white;
  }
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
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
    font-size: 20px;
  }
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  color: var(--text-color);
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.modal-footer {
  padding: 1rem 2rem;
  border-top: 1px solid var(--border-color);
  background: var(--form-bg);
}

.modal-message-form {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
}

.modal-target-select {
  flex: 0 0 auto;
  min-width: 140px;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.9rem;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.modal-message-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.9rem;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  &::placeholder {
    color: var(--text-color);
    opacity: 0.6;
  }
}

.modal-send-button {
  flex: 0 0 auto;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.9rem;

  &:hover:not(:disabled) {
    background: var(--accent-color);
  }

  &:disabled {
    background: var(--border-color);
    cursor: not-allowed;
  }

  .material-icons {
    font-size: 16px;
  }
}
</style>
