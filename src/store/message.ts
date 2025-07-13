import { ref, computed, watch } from 'vue';
import { backendApi, type BackendMessage } from '@/services/backendApiService';
import { fileStorage } from '@/services/fileStorage';

export interface Message {
  id: string;
  type: 'bonus' | 'section' | 'multiplier' | 'network' | 'info' | 'chat' | 'announcement';
  text: string;
  timestamp: number;
  from?: string;
  target?: string;
}

const MESSAGE_STORAGE_KEY = 'messages';

// Initialize messages reactive state
export const messages = ref<Message[]>([]);
export const isRefreshing = ref(false);

// Local storage for dismissed message IDs (per station)
const DISMISSED_MESSAGES_KEY = 'dismissedMessages';
export const dismissedMessageIds = ref<Set<string>>(new Set());

// Load dismissed messages from local storage
async function loadDismissedMessages() {
  try {
    const dismissed = localStorage.getItem(DISMISSED_MESSAGES_KEY);
    if (dismissed) {
      dismissedMessageIds.value = new Set(JSON.parse(dismissed));
    }
  } catch (error) {
    console.error('Failed to load dismissed messages:', error);
    dismissedMessageIds.value = new Set();
  }
}

// Save dismissed messages to local storage
async function saveDismissedMessages() {
  try {
    localStorage.setItem(DISMISSED_MESSAGES_KEY, JSON.stringify(Array.from(dismissedMessageIds.value)));
  } catch (error) {
    console.error('Failed to save dismissed messages:', error);
  }
}

// Computed property for visible messages (excluding dismissed ones)
export const visibleMessages = computed(() => {
  return messages.value.filter(message => !dismissedMessageIds.value.has(message.id));
});

// Message count for badge (only visible messages)
export const messageCount = computed(() => visibleMessages.value.length);

// Periodic message refresh interval
let refreshInterval: NodeJS.Timeout | null = null;

// Generate a GUID for message IDs
function generateGUID(): string {
  return 'msg-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Load messages from backend first, fallback to file storage
async function initializeMessages() {
  // Try to load from backend first if connected
  if (backendApi.connected.value) {
    try {
      await refreshMessagesFromBackend();
      console.log(`📨 Loaded ${messages.value.length} messages from backend`);
      return;
    } catch (error) {
      console.warn('⚠️ Failed to load from backend, trying file storage:', error);
    }
  }
  
  // Fallback to file storage
  try {
    const savedMessages = await fileStorage.getMessages();
    if (savedMessages && savedMessages.length > 0) {
      messages.value = savedMessages;
      console.log(`📨 Loaded ${messages.value.length} messages from file storage`);
      
      // If backend is connected and we have local messages, try to migrate them
      if (backendApi.connected.value) {
        console.log('📨 Migrating local messages to backend...');
        let migratedCount = 0;
        for (const message of savedMessages) {
          if (message.type === 'chat' && message.from) {
            try {
              const backendMessage = await convertToBackendMessage(message);
              await backendApi.addMessage(backendMessage);
              migratedCount++;
            } catch (error) {
              // Ignore errors for duplicate messages
              const errorStr = error instanceof Error ? error.message : String(error);
              if (!errorStr.includes('duplicate')) {
                console.warn('⚠️ Failed to migrate message:', error);
              }
            }
          }
        }
        if (migratedCount > 0) {
          console.log(`📨 Migrated ${migratedCount} messages to backend`);
          // Refresh from backend to get the canonical list
          await refreshMessagesFromBackend();
        }
      }
    } else {
      messages.value = [];
    }
  } catch (error) {
    console.error('❌ Failed to load messages from file storage:', error);
    messages.value = [];
  }
}

// Save messages to file storage
async function saveMessages() {
  try {
    await fileStorage.saveMessages(messages.value);
  } catch (error) {
    console.error('❌ Failed to save messages to file storage:', error);
  }
}

// Initialize immediately but also listen for backend connection
initializeMessages();

// Listen for backend connection to re-initialize from backend
window.addEventListener('backendConnected', async () => {
  console.log('📨 Backend connected - re-initializing messages from backend');
  await initializeMessages();
});

// Watch for changes and save to file storage
watch(messages, saveMessages, { deep: true });

// Convert backend message to local format
function convertBackendMessage(backendMessage: BackendMessage): Message {
  return {
    id: backendMessage.id,
    type: backendMessage.message_type as Message['type'],
    text: backendMessage.text,
    timestamp: new Date(backendMessage.timestamp).getTime(),
    from: backendMessage.from_station_id,
    target: backendMessage.target_station_id || 'all',
  };
}

// Convert local message to backend format
async function convertToBackendMessage(message: Message): Promise<BackendMessage> {
  let fromStationId = '';
  try {
    const stationConfig = await fileStorage.getStationConfig();
    fromStationId = `${stationConfig.callsign}-${stationConfig.designator}`;
  } catch (error) {
    console.error('Failed to get station config:', error);
    fromStationId = 'UNKNOWN-1A';
  }

  return {
    id: message.id,
    message_type: message.type,
    text: message.text,
    from_station_id: fromStationId,
    target_station_id: message.target !== 'all' ? message.target : undefined,
    timestamp: new Date(message.timestamp).toISOString(),
  };
}

// Add a new message
export async function addMessage(
  type: Message['type'], 
  text: string, 
  from?: string, 
  target?: string, 
  messageId?: string
): Promise<void> {
  const id = messageId || generateGUID();
  
  // Check if message already exists to prevent duplicates
  const existingMessage = messages.value.find(m => m.id === id);
  if (existingMessage) {
    return;
  }
  
  const message: Message = {
    id,
    type,
    text,
    timestamp: Date.now(),
    from,
    target: target || 'all'
  };
  
  messages.value.push(message);
  
  // Keep only the last 100 messages to prevent memory buildup
  if (messages.value.length > 100) {
    messages.value = messages.value.slice(-100);
  }
  
  // Send to backend if connected and this is a chat message from us
  if (backendApi.connected.value && type === 'chat' && from) {
    try {
      const backendMessage = await convertToBackendMessage(message);
      await backendApi.addMessage(backendMessage);
      console.log('📨 Message sent to backend:', text);
      
      // Trigger a refresh to get any new messages from other stations
      setTimeout(() => refreshMessagesFromBackend(), 1000);
    } catch (error) {
      console.error('❌ Failed to send message to backend:', error);
      addMessage('info', 'Failed to send message to network');
    }
  }
}

// Send a chat message
export async function sendMessage(text: string, target: string = 'all'): Promise<void> {
  if (!text.trim()) return;
  
  try {
    const messageId = generateGUID();
    
    // Get current station info
    const stationConfig = await fileStorage.getStationConfig();
    const stationId = `${stationConfig.callsign}-${stationConfig.designator}`;
    
    // Add message locally first
    await addMessage('chat', text.trim(), stationId, target, messageId);
    
    console.log('📨 Message sent:', text);
  } catch (error) {
    console.error('❌ Failed to send message:', error);
    addMessage('info', 'Failed to send message');
  }
}

// Edit a message (only chat messages can be edited)
export async function editMessage(messageId: string, newText: string): Promise<void> {
  if (!newText.trim()) return;
  
  const messageIndex = messages.value.findIndex(m => m.id === messageId);
  if (messageIndex === -1) {
    throw new Error('Message not found');
  }
  
  const message = messages.value[messageIndex];
  if (message.type !== 'chat') {
    throw new Error('Only chat messages can be edited');
  }
  
  // Update locally
  messages.value[messageIndex] = {
    ...message,
    text: newText.trim(),
    timestamp: Date.now() // Update timestamp to reflect edit time
  };
  
  // Update in backend if connected
  if (backendApi.connected.value) {
    try {
      const backendMessage = await convertToBackendMessage(messages.value[messageIndex]);
      await backendApi.updateMessage(backendMessage);
      console.log('📨 Message edited:', newText);
    } catch (error) {
      console.error('❌ Failed to update message in backend:', error);
      addMessage('info', 'Failed to update message on network');
    }
  }
}

// Delete a message (only chat messages can be deleted)
export async function deleteMessage(messageId: string): Promise<void> {
  const messageIndex = messages.value.findIndex(m => m.id === messageId);
  if (messageIndex === -1) {
    throw new Error('Message not found');
  }
  
  const message = messages.value[messageIndex];
  if (message.type !== 'chat') {
    throw new Error('Only chat messages can be deleted');
  }
  
  // Remove locally
  messages.value.splice(messageIndex, 1);
  
  // Delete from backend if connected
  if (backendApi.connected.value) {
    try {
      await backendApi.deleteMessage(messageId);
      console.log('📨 Message deleted:', messageId);
    } catch (error) {
      console.error('❌ Failed to delete message from backend:', error);
      addMessage('info', 'Failed to delete message from network');
    }
  }
}

// Refresh messages from backend service
export async function refreshMessagesFromBackend(): Promise<void> {
  if (isRefreshing.value || !backendApi.connected.value) {
    return;
  }
  
  isRefreshing.value = true;
  try {
    const backendMessages = await backendApi.getMessages();
    
    // Get current local messages
    const currentLocalMessages = [...messages.value];
    
    // Convert backend messages to local format
    const convertedBackendMessages = backendMessages.map(convertBackendMessage);
    
    // Create a map of existing backend messages by ID
    const backendMessageMap = new Map();
    convertedBackendMessages.forEach(msg => {
      backendMessageMap.set(msg.id, msg);
    });
    
    // Send any local messages that don't exist in backend to backend
    let newMessagesSentToBackend = 0;
    for (const localMessage of currentLocalMessages) {
      if (!backendMessageMap.has(localMessage.id) && localMessage.type === 'chat') {
        try {
          const backendMessage = await convertToBackendMessage(localMessage);
          await backendApi.addMessage(backendMessage);
          newMessagesSentToBackend++;
        } catch (error) {
          console.warn('⚠️ Failed to send local message to backend:', error);
        }
      }
    }
    
    // Merge all messages and deduplicate
    const allMessages = [...currentLocalMessages];
    let newMessagesAdded = 0;
    
    const existingMessageMap = new Map();
    allMessages.forEach(msg => {
      existingMessageMap.set(msg.id, msg);
    });
    
    convertedBackendMessages.forEach((backendMessage) => {
      if (!existingMessageMap.has(backendMessage.id)) {
        allMessages.push(backendMessage);
        newMessagesAdded++;
      }
    });
    
    if (newMessagesAdded > 0 || newMessagesSentToBackend > 0) {
      // Sort by timestamp
      allMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      // Keep only the last 100 messages
      if (allMessages.length > 100) {
        messages.value = allMessages.slice(-100);
      } else {
        messages.value = allMessages;
      }
      
      console.log(`📨 Message sync: +${newMessagesAdded} from backend, ${newMessagesSentToBackend} sent to backend`);
    }
  } catch (error) {
    console.error('❌ Failed to refresh messages from backend:', error);
  } finally {
    isRefreshing.value = false;
  }
}

// Start periodic refresh when backend is connected
function startMessageRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  refreshInterval = setInterval(() => {
    if (backendApi.connected.value) {
      refreshMessagesFromBackend();
    }
  }, 5000); // Refresh every 5 seconds for messages (more frequent than QSOs)
}

// Stop periodic refresh
function stopMessageRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Listen for backend connection events
window.addEventListener('backendConnected', async () => {
  console.log('📨 Backend connected - starting message sync');
  
  // Immediately refresh messages from backend and sync local messages
  await refreshMessagesFromBackend();
  
  // Start periodic refresh
  startMessageRefresh();
});

window.addEventListener('backendDisconnected', () => {
  console.log('📨 Backend disconnected - stopping message sync');
  stopMessageRefresh();
});

// Start refresh if backend is already connected
if (backendApi.connected.value) {
  startMessageRefresh();
}

// Computed properties
export const recentMessages = computed(() => {
  return messages.value.slice(-5).reverse(); // Latest 5 messages in reverse order
});

export const allMessages = computed(() => {
  return [...messages.value].reverse(); // All messages in reverse chronological order
});

export const messageCount = computed(() => messages.value.length);
