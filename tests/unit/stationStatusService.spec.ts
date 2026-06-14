import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
const dispatchedEvents: CustomEvent[] = [];

vi.mock('@/utils/debug', () => ({ debugLog: vi.fn() }));

describe('StationStatusService', () => {
  const importService = async () => {
    vi.resetModules();
    return import('@/services/stationStatusService');
  };

  beforeEach(() => {
    storage.clear();
    dispatchedEvents.length = 0;
    vi.clearAllMocks();

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      })
    });

    vi.stubGlobal('window', {
      dispatchEvent: vi.fn((event: Event) => {
        dispatchedEvents.push(event as CustomEvent);
        return true;
      })
    });
  });

  it('tracks discovered stations and updates status transitions', async () => {
    const { stationStatusService } = await importService();

    expect(stationStatusService.getTotalDiscoveredCount()).to.equal(0);

    stationStatusService.updateStationSeen({
      id: 'station-1',
      call_sign: 'K8TAR',
      ip_address: '10.0.0.2',
      port: 8080
    });

    expect(stationStatusService.getTotalDiscoveredCount()).to.equal(1);
    expect(stationStatusService.getConnectedCount()).to.equal(1);

    const station = stationStatusService.getStationStatus('station-1');
    expect(station?.status).to.equal('online');
    expect(station?.requestCount).to.equal(0);
    expect(stationStatusService.getStatusClass('online')).to.equal('status-online');
    expect(stationStatusService.getStatusColor('warning')).to.equal('#f59e0b');

    stationStatusService.updateMissedStations([]);
    stationStatusService.updateMissedStations([]);

    const warningStation = stationStatusService.getStationStatus('station-1');
    expect(warningStation?.status).to.equal('warning');
    expect(stationStatusService.getStatusDescription(warningStation!)).to.equal('Warning (2 missed)');

    stationStatusService.updateMissedStations([]);
    stationStatusService.updateMissedStations([]);

    const offlineStation = stationStatusService.getStationStatus('station-1');
    expect(offlineStation?.status).to.equal('offline');
    expect(offlineStation?.isOnline).to.equal(false);
    expect(stationStatusService.getStatusDescription(offlineStation!)).to.match(/^Offline/);
  });

  it('formats age-based labels and clears stored data', async () => {
    const { stationStatusService } = await importService();

    const now = Date.now();
    expect(stationStatusService.formatLastSeen(now - 30 * 1000)).to.equal('30s ago');
    expect(stationStatusService.formatLastSeen(now - 5 * 60 * 1000)).to.equal('5m ago');
    expect(stationStatusService.formatLastSeen(now - 2 * 60 * 60 * 1000)).to.equal('2h ago');

    stationStatusService.updateStationSeen({
      id: 'station-2',
      call_sign: 'W1AW',
      ip_address: '10.0.0.3',
      port: 8080
    });

    expect(stationStatusService.getAllStationsWithStatus()).to.have.length(1);

    stationStatusService.clearDiscoveredCount();
    expect(stationStatusService.getTotalDiscoveredCount()).to.equal(0);
  });
});