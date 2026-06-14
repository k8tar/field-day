import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileStorageMock = {
  getSettings: vi.fn().mockResolvedValue({ networkSettings: {} }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getStationConfig: vi.fn().mockResolvedValue({ callsign: 'K8TAR', designator: '1A' })
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
      location: { hostname: 'localhost' }
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
});