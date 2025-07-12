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

// Load messages from file storage on initialization
async function initializeMessages() {
  try {
    const savedMessages = await fileStorage.getMessages();
    messages.value = savedMessages || [];
    console.log(`📨 Loaded ${messages.value.length} messages from file storage`);
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

// Initialize immediately
initializeMessages();

// Watch for changes and save to file storage
watch(messages, saveMessages, { deep: true });

// Convert backend message to local format
function convertBackendMessage(backendMessage: BackendMessage): Message {
  return {
    id: backendMessage.id,
    type: backendMessage.message_type as Message['type'],
    text: backendMessage.content,
    timestamp: new Date(backendMessage.timestamp).getTime(),
    from: backendMessage.from_station_id,
    target: backendMessage.to_station_id || 'all',
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
    content: message.text,
    from_station_id: fromStationId,
    to_station_id: message.target !== 'all' ? message.target : undefined,
    timestamp: new Date(message.timestamp).toISOString(),
    priority: 1,
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

// Refresh messages from backend service
export async function refreshMessagesFromBackend(): Promise<void> {
  if (isRefreshing.value || !backendApi.connected.value) {
    return;
  }
  
  isRefreshing.value = true;
  try {
    const backendMessages = await backendApi.getMessages();
    
    // Convert backend messages to local format and merge
    const currentMessages = [...messages.value];
    let newMessagesAdded = 0;
    
    const existingMessageMap = new Map();
    currentMessages.forEach(msg => {
      existingMessageMap.set(msg.id, msg);
    });
    
    backendMessages.forEach((backendMessage: BackendMessage) => {
      if (!existingMessageMap.has(backendMessage.id)) {
        const localMessage = convertBackendMessage(backendMessage);
        currentMessages.push(localMessage);
        newMessagesAdded++;
      }
    });
    
    if (newMessagesAdded > 0) {
      // Sort by timestamp
      currentMessages.sort((a, b) => a.timestamp - b.timestamp);
      
      // Keep only the last 100 messages
      if (currentMessages.length > 100) {
        messages.value = currentMessages.slice(-100);
      } else {
        messages.value = currentMessages;
      }
      
      console.log(`📨 Added ${newMessagesAdded} new messages from backend`);
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
window.addEventListener('backendConnected', () => {
  console.log('📨 Backend connected - starting message sync');
  startMessageRefresh();
  refreshMessagesFromBackend(); // Immediate refresh
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
