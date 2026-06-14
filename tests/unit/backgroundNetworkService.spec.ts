import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileStorageMock = {
  getNetworkId: vi.fn().mockResolvedValue('NET-123')
};

vi.mock('@/services/fileStorage', () => ({ fileStorage: fileStorageMock }));
vi.mock('@/utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn(), debugError: vi.fn() }));

describe('BackgroundNetworkService', () => {
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
});