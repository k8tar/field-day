<!-- filepath: c:\git\k8tar-fieldday\src\components\Messages.vue -->
<template>
  <div class="messages-container">
    <div class="messages-header">
      <h3>Recent Messages</h3>
      <button class="view-all-button" @click="showAllMessages = true" title="View All Messages">
        <span class="material-icons">chat</span>
        <span v-if="messageCount > 0" class="message-badge">{{ messageCount }}</span>
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
                <span v-if="message.from" class="message-from">from {{ getStationDesignator(message.from) }}</span>
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
        <input 
          v-model="newMessage" 
          @keyup.enter="sendMessage"
          placeholder="Type message to all stations..." 
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
            <div v-for="message in allMessagesReversed" :key="message.id" 
                 class="message" :class="`message-${message.type}`">
              <div class="message-icon">{{ getIconForType(message.type) }}</div>
              <div class="message-content">
                <div v-if="editingMessageId === message.id" class="message-edit">
                  <input 
                    v-model="editingMessageText" 
                    @keyup.enter="saveEdit"
                    @keyup.escape="cancelEdit"
                    class="edit-input"
                    maxlength="200"
                  />
                  <div class="edit-actions">
                    <button @click="saveEdit" class="save-button">
                      <span class="material-icons">save</span>
                    </button>
                    <button @click="cancelEdit" class="cancel-button">
                      <span class="material-icons">close</span>
                    </button>
                  </div>
                </div>
                <div v-else class="message-display">
                  <div class="message-text">{{ message.text }}</div>
                  <div class="message-meta">
                    <span class="message-time">{{ formatFullTime(message.timestamp) }}</span>
                    <span v-if="message.from" class="message-from">from {{ getStationDesignator(message.from) }}</span>
                    <span v-if="message.target && message.target !== 'all'" class="message-target">to {{ message.target }}</span>
                  </div>
                </div>
              </div>
              <div v-if="message.type === 'chat' && message.from" class="message-actions">
                <button 
                  v-if="canEditMessage(message)" 
                  @click="startEdit(message.id, message.text)" 
                  class="action-button edit-button"
                  title="Edit message"
                >
                  <span class="material-icons">edit</span>
                </button>
                <button 
                  v-if="canEditMessage(message)" 
                  @click="startDelete(message.id)" 
                  class="action-button delete-button"
                  title="Delete message"
                >
                  <span class="material-icons">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <!-- Send Message Form in Modal -->
          <div class="modal-message-form">
            <input 
              v-model="modalNewMessage" 
              @keyup.enter="sendModalMessage"
              placeholder="Type message to all stations..." 
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
    
    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirm" class="delete-modal-overlay" @click.self="cancelDelete">
      <div class="delete-modal-content">
        <div class="delete-modal-header">
          <h3>Delete Message</h3>
          <button class="close-button" @click="cancelDelete">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="delete-modal-body">
          <p>Are you sure you want to delete this message?</p>
          <p class="delete-warning">This action cannot be undone and will remove the message from all stations.</p>
        </div>
        <div class="delete-modal-footer">
          <button @click="confirmDelete" class="confirm-delete-button">
            <span class="material-icons">delete</span>
            Delete
          </button>
          <button @click="cancelDelete" class="cancel-delete-button">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { 
  messages as storeMessages,
  recentMessages as storeRecentMessages,
  allMessages as storeAllMessages,
  sendMessage as sendMessageStore,
  addMessage as addMessageStore,
  messageCount as storeMessageCount,
  editMessage,
  deleteMessage
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

// UI state
const showAllMessages = ref(false);
const newMessage = ref('');
const modalNewMessage = ref('');
const editingMessageId = ref<string | null>(null);
const editingMessageText = ref('');
const showDeleteConfirm = ref(false);
const deletingMessageId = ref<string | null>(null);

// Use store messages
const messages = computed(() => storeMessages.value);
const recentMessages = computed(() => storeRecentMessages.value);
const allMessagesReversed = computed(() => storeAllMessages.value);
const messageCount = computed(() => storeMessageCount.value);

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
    case 'announcement':
      return '❗';
    case 'info':
    default:
      return 'ℹ️';
  }
}

// Extract station designator from station ID (e.g., "K8TAR-PHONE" -> "PHONE")
function getStationDesignator(stationId: string): string {
  if (!stationId) return '';
  const parts = stationId.split('-');
  return parts.length > 1 ? parts[parts.length - 1] : stationId;
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

// Send a message
async function sendMessage() {
  if (!newMessage.value.trim()) return;
  
  try {
    await sendMessageStore(newMessage.value.trim());
    newMessage.value = '';
  } catch (error) {
    console.error('Failed to send message:', error);
    addMessageStore('info', 'Failed to send message');
  }
}

// Send a message from the modal
async function sendModalMessage() {
  if (!modalNewMessage.value.trim()) return;
  
  try {
    await sendMessageStore(modalNewMessage.value.trim());
    modalNewMessage.value = '';
  } catch (error) {
    console.error('Failed to send message:', error);
    addMessageStore('info', 'Failed to send message');
  }
}

// Start editing a message
function startEdit(messageId: string, currentText: string) {
  editingMessageId.value = messageId;
  editingMessageText.value = currentText;
}

// Cancel editing
function cancelEdit() {
  editingMessageId.value = null;
  editingMessageText.value = '';
}

// Save edited message
async function saveEdit() {
  if (!editingMessageId.value || !editingMessageText.value.trim()) return;
  
  try {
    await editMessage(editingMessageId.value, editingMessageText.value.trim());
    cancelEdit();
  } catch (error) {
    console.error('Failed to edit message:', error);
    addMessageStore('info', 'Failed to edit message');
  }
}

// Start delete confirmation
function startDelete(messageId: string) {
  deletingMessageId.value = messageId;
  showDeleteConfirm.value = true;
}

// Cancel delete
function cancelDelete() {
  deletingMessageId.value = null;
  showDeleteConfirm.value = false;
}

// Confirm delete
async function confirmDelete() {
  if (!deletingMessageId.value) return;
  
  try {
    await deleteMessage(deletingMessageId.value);
    cancelDelete();
  } catch (error) {
    console.error('Failed to delete message:', error);
    addMessageStore('info', 'Failed to delete message');
  }
}

// Current station info for checking edit permissions
const currentStationId = ref('');

// Check if a message can be edited/deleted (only chat messages from current station)
function canEditMessage(message: Message): boolean {
  if (message.type !== 'chat' || !message.from || !currentStationId.value) return false;
  return message.from === currentStationId.value;
}

// Handle network events
function handleStationJoin(stationInfo: any) {
  addMessageStore('network', `Station ${getStationDesignator(stationInfo.call_sign)} joined the network`);
}

function handleStationLeave(stationInfo: any) {
  addMessageStore('network', `Station ${getStationDesignator(stationInfo.call_sign)} left the network`);
}

function handleQsoReceived(qso: any) {
  addMessageStore('network', `New QSO from ${getStationDesignator(qso.stationCallsign)}: ${qso.call} on ${qso.band}`);
}

function handleBonusEarned(bonus: any) {
  addMessageStore('bonus', `Bonus earned: ${bonus.name} (+${bonus.points} points)`);
}

function handleNewSection(event: any) {
  const section = typeof event === 'string' ? event : (event.detail || 'Unknown');
  addMessageStore('section', `New section worked: ${section}`);
}

function handleNewMultiplier() {
  addMessageStore('multiplier', 'New band/mode multiplier!');
}

// Achievement system callback
function handleAchievementMessage(type: string, message: string) {
  const messageType = type as Message['type'] || 'info';
  addMessageStore(messageType, message);
}

onMounted(async () => {
  // Load current station ID for edit permissions
  try {
    const stationConfig = await fileStorage.getStationConfig();
    currentStationId.value = `${stationConfig.callsign}-${stationConfig.designator}`;
  } catch (error) {
    console.error('Failed to load station config:', error);
  }
  
  // Listen for network events
  window.addEventListener('stationJoin', handleStationJoin);
  window.addEventListener('stationLeave', handleStationLeave);
  window.addEventListener('qsoReceived', handleQsoReceived);
  window.addEventListener('bonusEarned', handleBonusEarned);
  window.addEventListener('newSection', handleNewSection);
  window.addEventListener('newMultiplier', handleNewMultiplier);
  
  // Set up achievement system callback (if available)
  if (typeof window !== 'undefined' && (window as any).achievementService) {
    (window as any).achievementService.setMessageCallback(handleAchievementMessage);
  }
});

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('stationJoin', handleStationJoin);
  window.removeEventListener('stationLeave', handleStationLeave);
  window.removeEventListener('qsoReceived', handleQsoReceived);
  window.removeEventListener('bonusEarned', handleBonusEarned);
  window.removeEventListener('newSection', handleNewSection);
  window.removeEventListener('newMultiplier', handleNewMultiplier);
  
  // Clean up achievement system callback
  if (typeof window !== 'undefined' && (window as any).achievementService) {
    (window as any).achievementService.setMessageCallback(null);
  }
});

// Expose the addMessage function to parent components
defineExpose({
  addMessage: addMessageStore
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
  position: relative;

  &:hover {
    background: var(--accent-color);
  }

  .material-icons {
    font-size: 18px;
  }
}

.message-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--accent-color);
  color: white;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: bold;
  min-width: 16px;
  text-align: center;
  border: 1px solid var(--form-bg);
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
  max-height: 300px;
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

.message-announcement {
  background-color: rgba(255, 87, 51, 0.1);
  border-color: #ff5733;
  color: #d84315;
  font-weight: 600;
}

[data-theme="dark"] .message-announcement {
  background-color: rgba(255, 87, 51, 0.15);
  border-color: #ff5733;
  color: #ff8a65;
  font-weight: 600;
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
  z-index: 1500;
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

.message {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  position: relative;
}

.message-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
}

.message-display {
  width: 100%;
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

.message-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message:hover .message-actions {
  opacity: 1;
}

.action-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.action-button .material-icons {
  font-size: 16px;
}

.edit-button {
  color: var(--primary-color);
}

.edit-button:hover {
  background-color: var(--primary-color);
  color: white;
}

.delete-button {
  color: var(--error-color);
}

.delete-button:hover {
  background-color: var(--error-color);
  color: white;
}

.message-edit {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
}

.edit-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--input-bg);
  color: var(--text-color);
  font-size: 0.9rem;
}

.edit-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.edit-actions {
  display: flex;
  gap: 0.25rem;
}

.save-button {
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.save-button .material-icons {
  font-size: 16px;
}

.cancel-button {
  background: var(--error-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancel-button .material-icons {
  font-size: 16px;
}

/* Delete Confirmation Modal */
.delete-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1600;
}

.delete-modal-content {
  background: var(--modal-content);
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.delete-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--error-color);
  color: white;
  border-radius: 8px 8px 0 0;
}

.delete-modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.delete-modal-body {
  padding: 1.5rem;
  color: var(--text-color);
}

.delete-warning {
  color: var(--error-color);
  font-weight: 500;
  margin-top: 0.5rem;
}

.delete-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--border-color);
}

.confirm-delete-button {
  background: var(--error-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.confirm-delete-button:hover {
  background: var(--error-dark, #d32f2f);
}

.cancel-delete-button {
  background: transparent;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.cancel-delete-button:hover {
  background: var(--border-color);
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
