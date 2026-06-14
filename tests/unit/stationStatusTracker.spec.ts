import { beforeEach, describe, expect, it, vi } from 'vitest';

const backendApiMock = {
  connected: { value: true },
  getDiscoveredStations: vi.fn()
};

const stationStatusServiceMock = {
  updateStationSeen: vi.fn(),
  updateMissedStations: vi.fn(),
  cleanupOldStations: vi.fn(),
  getAllStationsWithStatus: vi.fn().mockReturnValue([])
};

vi.mock('@/services/backendApiService', () => ({ backendApi: backendApiMock }));
vi.mock('@/services/stationStatusService', () => ({ stationStatusService: stationStatusServiceMock }));
vi.mock('@/utils/debug', () => ({ debugLog: vi.fn() }));

describe('StationStatusTracker', () => {
  const importService = async () => {
    vi.resetModules();
    return import('@/services/stationStatusTracker');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      setInterval: vi.fn(() => 1),
      dispatchEvent: vi.fn()
    });
    vi.stubGlobal('setInterval', vi.fn(() => 1));
    vi.stubGlobal('clearInterval', vi.fn());
  });

  it('starts, performs updates, and stops cleanly', async () => {
    backendApiMock.getDiscoveredStations.mockResolvedValue([
      { id: 'station-1' },
      { id: 'station-2' }
    ]);

    const { stationStatusTracker } = await importService();

    stationStatusTracker.start();
    expect(stationStatusTracker.running).to.equal(true);
    await vi.waitFor(() => expect(backendApiMock.getDiscoveredStations).toHaveBeenCalled());
    await vi.waitFor(() => expect(stationStatusServiceMock.updateStationSeen).toHaveBeenCalledWith({ id: 'station-1' }));
    expect(stationStatusServiceMock.updateStationSeen).toHaveBeenCalledWith({ id: 'station-2' });
    expect(stationStatusServiceMock.updateMissedStations).toHaveBeenCalledWith(['station-1', 'station-2']);

    stationStatusTracker.stop();
    expect(stationStatusTracker.running).to.equal(false);
    expect(clearInterval).toHaveBeenCalledWith(1);
  });

  it('does nothing when backend is disconnected', async () => {
    backendApiMock.connected.value = false;
    backendApiMock.getDiscoveredStations.mockResolvedValue([{ id: 'station-1' }]);

    const { stationStatusTracker } = await importService();

    stationStatusTracker.start();

    expect(backendApiMock.getDiscoveredStations).not.toHaveBeenCalled();
    expect(stationStatusServiceMock.updateStationSeen).not.toHaveBeenCalled();
  });
});