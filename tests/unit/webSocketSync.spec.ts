import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageState = new Map<string, string>();

vi.mock('@/services/crossOriginStorage', () => ({
  CrossOriginStorage: {
    getItem: vi.fn((key: string) => storageState.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storageState.set(key, value);
    })
  }
}));

describe('WebSocketSyncService', () => {
  const importService = async () => {
    vi.resetModules();
    return import('@/services/webSocketSync');
  };

  beforeEach(() => {
    storageState.clear();
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
      vi.stubGlobal('WebSocket', {
        OPEN: 1
      });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storageState.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storageState.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storageState.delete(key);
      })
    });
  });

  it('starts host discovery and reports host state', async () => {
    const { webSocketSync } = await importService();

    const started = await webSocketSync.startHost(9010);
    expect(started).to.equal(true);
    expect(storageState.has('ws_host_info')).to.equal(true);
    expect(webSocketSync.getStatus().isHost).to.equal(true);
    expect(webSocketSync.getStatus().hostPort).to.equal(9010);
  });

  it('falls back to storage when sending messages without a socket', async () => {
    const { webSocketSync } = await importService();

    webSocketSync.sendMessage({ type: 'ping', data: { hello: 'world' } });

    const storedMessage = [...storageState.entries()].find(([key]) => key.startsWith('ws_message_'));
    expect(storedMessage).to.not.equal(undefined);
  });

  it('registers and removes event handlers', async () => {
    const { webSocketSync } = await importService();
    const handler = vi.fn();

    webSocketSync.on('custom-event', handler);
    webSocketSync.off('custom-event', handler);
    webSocketSync.sendMessage({ type: 'station-info', data: { test: true } });

    expect(handler).not.toHaveBeenCalled();
  });
});