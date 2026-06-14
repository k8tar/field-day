import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const backendApiMock = {
  connected: { value: false },
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
  deleteMessage: vi.fn(),
  getMessages: vi.fn().mockResolvedValue([])
};

const fileStorageMock = {
  getMessages: vi.fn().mockResolvedValue([]),
  saveMessages: vi.fn(),
  getStationConfig: vi.fn().mockResolvedValue({ callsign: 'K8TAR', designator: '1A' })
};

const crossOriginStorageMock = {
  getJSON: vi.fn().mockReturnValue(undefined),
  setJSON: vi.fn()
};

vi.mock('@/services/backendApiService', () => ({ backendApi: backendApiMock }));
vi.mock('@/services/fileStorage', () => ({ fileStorage: fileStorageMock }));
vi.mock('@/services/crossOriginStorage', () => ({ CrossOriginStorage: crossOriginStorageMock }));
vi.mock('@/utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn(), debugError: vi.fn() }));

describe('message store', () => {
  let messageStore: typeof import('@/store/message');

  beforeAll(async () => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    messageStore = await import('@/store/message');
    await vi.waitFor(() => expect(fileStorageMock.getMessages).toHaveBeenCalled());
  });

  beforeEach(() => {
    messageStore.messages.value = [];
    messageStore.dismissedMessageIds.value = new Set();
    messageStore.isRefreshing.value = false;
    backendApiMock.connected.value = false;
    vi.clearAllMocks();
  });

  it('filters dismissed messages from computed collections', () => {
    messageStore.messages.value = [
      { id: 'm1', type: 'info', text: 'one', timestamp: 1 },
      { id: 'm2', type: 'chat', text: 'two', timestamp: 2 },
      { id: 'm3', type: 'bonus', text: 'three', timestamp: 3 },
      { id: 'm4', type: 'announcement', text: 'four', timestamp: 4 },
      { id: 'm5', type: 'network', text: 'five', timestamp: 5 },
      { id: 'm6', type: 'section', text: 'six', timestamp: 6 }
    ];
    messageStore.dismissedMessageIds.value = new Set(['m2', 'm5']);

    expect(messageStore.visibleMessages.value.map(message => message.id)).to.deep.equal(['m1', 'm3', 'm4', 'm6']);
    expect(messageStore.messageCount.value).to.equal(4);
    expect(messageStore.recentMessages.value.map(message => message.id)).to.deep.equal(['m6', 'm4', 'm3', 'm1']);
    expect(messageStore.allMessages.value.map(message => message.id)).to.deep.equal(['m6', 'm4', 'm3', 'm1']);
  });

  it('dismisses and restores messages while persisting the set', async () => {
    await messageStore.dismissMessage('m1');
    expect(messageStore.isMessageDismissed('m1')).to.equal(true);
    expect(crossOriginStorageMock.setJSON).toHaveBeenCalledWith('dismissedMessages', ['m1']);

    await messageStore.undismissMessage('m1');
    expect(messageStore.isMessageDismissed('m1')).to.equal(false);
    expect(crossOriginStorageMock.setJSON).toHaveBeenCalledWith('dismissedMessages', []);
  });

  it('clears dismissed messages and clears all messages', async () => {
    messageStore.messages.value = [
      { id: 'm1', type: 'info', text: 'one', timestamp: 1 },
      { id: 'm2', type: 'chat', text: 'two', timestamp: 2 }
    ];
    messageStore.dismissedMessageIds.value = new Set(['m2']);

    await messageStore.clearAllDismissed();
    expect(messageStore.dismissedMessageIds.value.size).to.equal(0);
    expect(crossOriginStorageMock.setJSON).toHaveBeenLastCalledWith('dismissedMessages', []);

    await messageStore.clearAllMessages();
    expect(messageStore.messages.value).to.deep.equal([]);
    expect(messageStore.dismissedMessageIds.value.size).to.equal(0);
    expect(fileStorageMock.saveMessages).toHaveBeenCalledWith([]);
  });

  it('ignores blank send message input', async () => {
    await messageStore.sendMessage('   ');

    expect(messageStore.messages.value).to.deep.equal([]);
    expect(fileStorageMock.getStationConfig).not.toHaveBeenCalled();
  });

  it('sends chat message and forwards to backend when connected', async () => {
    backendApiMock.connected.value = true;

    await messageStore.sendMessage('hello field day', 'all');

    expect(messageStore.messages.value).to.have.length(1);
    expect(messageStore.messages.value[0].type).to.equal('chat');
    expect(messageStore.messages.value[0].text).to.equal('hello field day');
    expect(backendApiMock.addMessage).toHaveBeenCalledTimes(1);
  });

  it('throws when editing or deleting an invalid message target', async () => {
    await expect(messageStore.editMessage('missing', 'updated')).rejects.toThrow('Message not found');
    await expect(messageStore.deleteMessage('missing')).rejects.toThrow('Message not found');

    messageStore.messages.value = [
      { id: 'm1', type: 'info', text: 'system', timestamp: 1 }
    ];

    await expect(messageStore.editMessage('m1', 'changed')).rejects.toThrow('Only chat messages can be edited');
    await expect(messageStore.deleteMessage('m1')).rejects.toThrow('Only chat messages can be deleted');
  });

  it('adds a local info message when backend edit/delete fails', async () => {
    backendApiMock.connected.value = true;
    backendApiMock.updateMessage.mockRejectedValue(new Error('update failed'));
    backendApiMock.deleteMessage.mockRejectedValue(new Error('delete failed'));

    messageStore.messages.value = [
      { id: 'm1', type: 'chat', text: 'hello', timestamp: 1, from: 'K8TAR-1A', target: 'all' }
    ];

    await messageStore.editMessage('m1', 'hello 2');
    expect(messageStore.messages.value.some(message => message.type === 'info' && message.text.includes('update message'))).to.equal(true);

    const updatedChat = messageStore.messages.value.find(message => message.id === 'm1');
    expect(updatedChat?.text).to.equal('hello 2');

    await messageStore.deleteMessage('m1');
    expect(messageStore.messages.value.some(message => message.type === 'info' && message.text.includes('delete message'))).to.equal(true);
  });

  it('returns early from refresh when disconnected or already refreshing', async () => {
    backendApiMock.connected.value = false;
    await messageStore.refreshMessagesFromBackend();
    expect(backendApiMock.getMessages).not.toHaveBeenCalled();

    backendApiMock.connected.value = true;
    messageStore.isRefreshing.value = true;
    await messageStore.refreshMessagesFromBackend();
    expect(backendApiMock.getMessages).not.toHaveBeenCalled();
  });

  it('merges backend messages and uploads unsynced local chat messages', async () => {
    backendApiMock.connected.value = true;
    backendApiMock.getMessages.mockResolvedValue([
      {
        id: 'b1',
        message_type: 'chat',
        text: 'from backend',
        timestamp: '2024-06-14T12:00:00.000Z',
        from_station_id: 'N1MM-1A',
        target_station_id: 'all'
      }
    ]);

    messageStore.messages.value = [
      { id: 'l1', type: 'chat', text: 'from local', timestamp: Date.parse('2024-06-14T11:00:00.000Z'), from: 'K8TAR-1A', target: 'all' }
    ];

    await messageStore.refreshMessagesFromBackend();

    expect(backendApiMock.addMessage).toHaveBeenCalledTimes(1);
    expect(messageStore.messages.value.map(message => message.id)).to.deep.equal(['l1', 'b1']);
  });
});