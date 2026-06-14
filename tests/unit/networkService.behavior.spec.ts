import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileStorageMock = {
  getSettings: vi.fn().mockResolvedValue({ networkSettings: {} }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getStationConfig: vi.fn().mockResolvedValue({ callsign: 'K8TAR', designator: '1A' }),
  getQsoData: vi.fn().mockResolvedValue([]),
  getOperators: vi.fn().mockResolvedValue([]),
  getBonuses: vi.fn().mockResolvedValue([]),
  getStorageInfo: vi.fn().mockResolvedValue({ port: 8080, configExists: true, qsoCount: 0 }),
  saveStationConfig: vi.fn().mockResolvedValue(undefined),
  setupTestConfiguration: vi.fn().mockResolvedValue(undefined),
  migrateFromLocalStorage: vi.fn().mockResolvedValue(undefined)
};

const backendApiMock = {
  connected: { value: false },
  sendMessage: vi.fn().mockResolvedValue(true)
};

vi.mock('@/services/fileStorage', () => ({ fileStorage: fileStorageMock }));
vi.mock('@/services/backendApiService', () => ({ backendApi: backendApiMock }));
vi.mock('@/utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn(), debugError: vi.fn() }));

describe('NetworkService behavior', () => {
  const importService = async () => {
    vi.resetModules();
    return import('@/services/networkService');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      Electron: undefined,
      location: { hostname: 'localhost', origin: 'https://localhost:8080' }
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        callsign: 'W1AW',
        designator: '1A',
        software: 'K8TAR Field Day Logger',
        qsoCount: 5,
        score: 10
      })
    })));
    vi.stubGlobal('RTCPeerConnection', class {
      onicecandidate: ((ice: { candidate?: { candidate?: string } }) => void) | null = null;
      createDataChannel(): void {}
      createOffer(): Promise<Record<string, string>> {
        return Promise.resolve({ sdp: 'test' });
      }
      setLocalDescription(): Promise<void> {
        return Promise.resolve();
      }
      close(): void {}
    });
  });

  it('returns and updates network settings locally', async () => {
    const { networkService } = await importService();

    expect(networkService.getNetworkInstanceId()).to.be.a('string');
    expect(networkService.getCurrentNetworkMode()).to.equal('mesh');
    expect(networkService.getHostPort()).to.equal(8080);

    const initialSettings = networkService.getNetworkSettings();
    networkService.updateNetworkMode('host', { hostPort: 9000 });

    expect(initialSettings.hostPort).to.equal(8080);
    expect(networkService.getNetworkSettings().hostPort).to.equal(9000);
    expect(networkService.getNetworkSettings().isHost).to.equal(true);
    expect(networkService.getHostAddress()).to.equal('');
    expect(fileStorageMock.saveSettings).toHaveBeenCalled();
  });

  it('reflects connection status and broadcast behavior', async () => {
    const { networkService } = await importService();
    fileStorageMock.getStationConfig.mockClear();

    const status = networkService.getConnectionStatus();
    expect(status.isConnected).to.equal(false);
    expect(status.networkId).to.be.a('string');
    expect(status.lastSync).to.equal(0);
    expect(status.syncedQsos).to.equal(0);
    expect(status.connectedStations).to.equal(0);

    await networkService.broadcastQsoUpdate(
      {
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T12:00:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR',
        id: 'q1'
      },
      'add'
    );

    expect(fileStorageMock.getStationConfig).not.toHaveBeenCalled();

    networkService.status.isConnected = true;
    await networkService.broadcastQsoUpdate(
      {
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T12:00:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR',
        id: 'q1'
      },
      'update'
    );

    expect(fileStorageMock.getStationConfig).toHaveBeenCalled();
  });

  it('toggles automatic reconnect state', async () => {
    const { networkService } = await importService();

    networkService.setAutoReconnect(false);
    expect(networkService.getNetworkSettings().autoReconnect).to.equal(false);

    networkService.setAutoReconnect(true);
    expect(networkService.getNetworkSettings().autoReconnect).to.equal(true);
  });

  it('returns false for deprecated host/join mesh entry points', async () => {
    const { networkService } = await importService();

    await expect(networkService.startHost()).resolves.to.equal(false);
    await expect(networkService.connectToHost('localhost:8080')).resolves.to.equal(false);
  });

  it('sends message through backend API and throws on backend failure', async () => {
    const { networkService } = await importService();

    backendApiMock.sendMessage.mockResolvedValueOnce(true);
    await expect(networkService.sendMessage('hello', 'all', 'm1')).resolves.toBeUndefined();

    backendApiMock.sendMessage.mockResolvedValueOnce(false);
    await expect(networkService.sendMessage('fail', 'all', 'm2')).rejects.toThrow('Failed to send message');
  });

  it('discovers no stations in Electron mode', async () => {
    vi.stubGlobal('window', {
      Electron: {},
      location: { hostname: 'localhost', origin: 'https://localhost:8080' }
    });

    const { networkService } = await importService();
    const stations = await networkService.discoverStations();

    expect(stations).to.deep.equal([]);
  });

  it('falls back protocol from https to http for remote hosts', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('TLS certificate error'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const { networkService } = await importService();
    const internal = networkService as {
      fetchWithProtocolFallback: (url: string, options?: RequestInit) => Promise<Response>;
    };

    const response = await internal.fetchWithProtocolFallback('https://192.168.1.20:8080/api/station-info');

    expect(response.ok).to.equal(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).to.contain('http://192.168.1.20:8080/api/station-info');
  });

  it('returns null from station check when response is not a valid field-day payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ callsign: 'X1', designator: '1A', software: 'Other App' })
    })));

    const { networkService } = await importService();
    const internal = networkService as {
      checkStationAt: (ip: string, port: number) => Promise<Record<string, unknown> | null>;
    };

    const station = await internal.checkStationAt('127.0.0.1', 8080);
    expect(station).to.equal(null);
  });

  it('executes legacy compatibility and diagnostics methods without throwing', async () => {
    const { networkService } = await importService();

    await expect(networkService.checkStorage()).resolves.toBeUndefined();
    expect(() => networkService.checkLocalStorage()).not.toThrow();
    await expect(networkService.testDiscovery()).resolves.toBeUndefined();
    await expect(networkService.testFieldDayPorts()).resolves.toBeUndefined();
    await expect(networkService.testNetworkDiscovery()).resolves.toBeUndefined();
    await expect(networkService.checkFileStorage()).resolves.toBeUndefined();
    await expect(networkService.setConfiguration('K8TAR', '1A')).resolves.toBeUndefined();
    await expect(networkService.setTestConfiguration('K8TAR', '1A')).resolves.toBeUndefined();
    await expect(networkService.setupTestStation('K8TAR', '1A', 2)).resolves.toBeUndefined();
    await expect(networkService.migrateToFileStorage()).resolves.toBeUndefined();
    await expect(networkService.stopMesh()).resolves.toBeUndefined();
    await expect(networkService.startMesh()).resolves.to.equal(false);

    expect(networkService.getMeshNodes()).to.deep.equal([]);
    expect(networkService.getMeshStatus()).to.deep.equal({
      isActive: false,
      connectedNodes: 0,
      discoveredNodes: 0,
      meshHealth: 'unknown'
    });

    await expect(networkService.refreshMeshDiscovery()).resolves.toBeUndefined();
    await expect(networkService.forceMeshSync()).resolves.toBeUndefined();
  });
});