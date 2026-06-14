import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const backendApiMock = {
  connected: { value: false },
  addMessage: vi.fn()
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
});