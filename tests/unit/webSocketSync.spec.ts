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

  it('connects successfully when websocket opens', async () => {
    class FakeSocket {
      static readonly OPEN = 1;
      static latest: FakeSocket | null = null;
      readyState = FakeSocket.OPEN;
      private listeners: Map<string, Array<() => void>> = new Map();

      constructor(_url: string) {
        FakeSocket.latest = this;
      }

      addEventListener(event: string, handler: () => void): void {
        const handlers = this.listeners.get(event) ?? [];
        handlers.push(handler);
        this.listeners.set(event, handlers);
      }

      emit(event: string): void {
        const handlers = this.listeners.get(event) ?? [];
        handlers.forEach((handler) => handler());
      }

      send(): void {}
      close(): void {}
    }

    vi.stubGlobal('WebSocket', FakeSocket);

    const { webSocketSync } = await importService();
    const connectionPromise = webSocketSync.connectToHost('localhost:9001');
    FakeSocket.latest?.emit('open');

    await expect(connectionPromise).resolves.to.equal(true);
    expect(webSocketSync.getStatus().connected).to.equal(true);
  });

  it('falls back to client discovery when websocket construction throws', async () => {
    class ThrowingSocket {
      static readonly OPEN = 1;
      constructor(_url: string) {
        throw new Error('socket unavailable');
      }
    }

    vi.stubGlobal('WebSocket', ThrowingSocket);

    const { webSocketSync } = await importService();
    await expect(webSocketSync.connectToHost('localhost:9001')).resolves.to.equal(true);

    expect(storageState.has('ws_client_discovery')).to.equal(true);
  });

  it('responds to ping messages with pong', async () => {
    const { webSocketSync } = await importService();
    const sendSpy = vi.spyOn(webSocketSync, 'sendMessage');

    const internal = webSocketSync as {
      handleMessage: (message: { type: 'ping'; data: Record<string, number>; timestamp: number; stationId: string }) => void;
    };

    internal.handleMessage({
      type: 'ping',
      data: { timestamp: Date.now() },
      timestamp: Date.now(),
      stationId: 'K8TAR-1A'
    });

    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'pong' }));
  });

  it('broadcasts station info payload through sendMessage', async () => {
    storageState.set('stationCallsign', 'K8TAR');
    storageState.set('stationDesignator', '1A');
    storageState.set('qsos', JSON.stringify([{ id: 'q1' }, { id: 'q2' }]));

    const { webSocketSync } = await importService();
    const sendSpy = vi.spyOn(webSocketSync, 'sendMessage');

    webSocketSync.broadcastStationInfo();

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'station-info',
        data: expect.objectContaining({ callsign: 'K8TAR', designator: '1A', qsoCount: 2 })
      })
    );
  });

  it('disconnects websocket and clears timers', async () => {
    const { webSocketSync } = await importService();
    const close = vi.fn();
    const stop = vi.fn();
    const cancel = vi.fn();

    const internal = webSocketSync as {
      ws: { close: () => void } | null;
      pingInterval: { stop: () => void } | null;
      reconnectTimer: { cancel: () => void } | null;
    };

    internal.ws = { close };
    internal.pingInterval = { stop };
    internal.reconnectTimer = { cancel };

    webSocketSync.disconnect();

    expect(close).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(webSocketSync.getStatus().isHost).to.equal(false);
  });
});