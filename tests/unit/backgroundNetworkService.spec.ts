import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileStorageMock = {
  getNetworkId: vi.fn().mockResolvedValue('NET-123')
};

vi.mock('@/services/fileStorage', () => ({ fileStorage: fileStorageMock }));
vi.mock('@/utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn(), debugError: vi.fn() }));

describe('BackgroundNetworkService', () => {
  interface BackgroundInternalAccess {
    localNetworkId: string;
    knownStations: Map<string, {
      ip: string;
      port: number;
      callsign: string;
      designator: string;
      networkId: string;
      qsoCount: number;
      lastSeen: number;
      protocol: 'HTTP' | 'HTTPS';
    }>;
    updateKnownStations: (stations: Array<{
      ip: string;
      port: number;
      callsign: string;
      designator: string;
      networkId: string;
      qsoCount: number;
      lastSeen: number;
      protocol: 'HTTP' | 'HTTPS';
    }>) => void;
    performMeshDiscovery: () => Promise<void>;
    performQsoSync: () => Promise<void>;
  }

  const importService = async () => {
    vi.resetModules();
    return import('@/services/backgroundNetworkService');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: { mesh: { enabled: true } } })
    })));
  });

  it('exposes connection state listeners', async () => {
    const { meshConnectionState } = await importService();
    const listener = vi.fn();

    meshConnectionState.onConnectionChange(listener);
    meshConnectionState.setConnected(false);
    meshConnectionState.setConnected(true);

    expect(meshConnectionState.isConnected).to.equal(true);
    expect(listener).toHaveBeenNthCalledWith(1, false);
    expect(listener).toHaveBeenNthCalledWith(2, true);

    meshConnectionState.removeConnectionListener(listener);
    meshConnectionState.setConnected(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('resyncs mesh state from backend data', async () => {
    const { backgroundNetworkService, meshConnectionState } = await importService();

    await backgroundNetworkService.reSyncMeshState();

    expect(fileStorageMock.getNetworkId).toHaveBeenCalled();
    expect(meshConnectionState.isConnected).to.equal(true);
    expect(backgroundNetworkService.getNetworkStatus().networkId).to.equal('NET-123');
  });

  it('starts and stops background operations', async () => {
    vi.useFakeTimers();
    const { backgroundNetworkService } = await importService();

    await backgroundNetworkService.startBackgroundOperations();
    expect(backgroundNetworkService.getNetworkStatus().isRunning).to.equal(true);

    await vi.advanceTimersByTimeAsync(2000);
    backgroundNetworkService.stopBackgroundOperations();

    expect(backgroundNetworkService.getNetworkStatus().isRunning).to.equal(false);
  });

  it('does not emit listener callbacks when connection state is unchanged', async () => {
    const { meshConnectionState } = await importService();
    const listener = vi.fn();

    meshConnectionState.onConnectionChange(listener);
    meshConnectionState.setConnected(false);
    meshConnectionState.setConnected(false);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('retries backend sync and keeps previous mesh state on repeated failures', async () => {
    vi.useFakeTimers();
    const { backgroundNetworkService, meshConnectionState } = await importService();

    meshConnectionState.setConnected(true);
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('backend offline');
    }));

    const syncPromise = backgroundNetworkService.reSyncMeshState();
    await vi.runAllTimersAsync();
    await syncPromise;

    expect(meshConnectionState.isConnected).to.equal(true);
  });

  it('updates known stations while excluding self and pruning stale entries', async () => {
    const { backgroundNetworkService } = await importService();
    const internal = backgroundNetworkService as BackgroundInternalAccess;

    internal.localNetworkId = 'NET-123';

    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    internal.updateKnownStations([
      {
        ip: '192.168.1.10',
        port: 3030,
        callsign: 'W1AW',
        designator: '1A',
        networkId: 'NODE-1',
        qsoCount: 10,
        lastSeen: 0,
        protocol: 'HTTP'
      },
      {
        ip: '192.168.1.11',
        port: 3030,
        callsign: 'SELF',
        designator: '1A',
        networkId: 'NET-123',
        qsoCount: 99,
        lastSeen: 0,
        protocol: 'HTTP'
      }
    ]);

    expect(backgroundNetworkService.getKnownStations()).to.have.length(1);
    expect(backgroundNetworkService.getKnownStations()[0].networkId).to.equal('NODE-1');

    vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
    internal.updateKnownStations([]);

    expect(backgroundNetworkService.getKnownStations()).to.have.length(0);
  });

  it('handles discovery and sync fetch errors silently', async () => {
    const { backgroundNetworkService } = await importService();
    const internal = backgroundNetworkService as BackgroundInternalAccess;

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network failed');
    }));

    await expect(internal.performMeshDiscovery()).resolves.toBeUndefined();
    await expect(internal.performQsoSync()).resolves.toBeUndefined();
  });

  it('does not start duplicate background intervals when already running', async () => {
    vi.useFakeTimers();
    const { backgroundNetworkService } = await importService();

    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    await backgroundNetworkService.startBackgroundOperations();
    await backgroundNetworkService.startBackgroundOperations();

    expect(intervalSpy).toHaveBeenCalledTimes(2);

    backgroundNetworkService.stopBackgroundOperations();
  });
});