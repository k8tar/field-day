import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileStorage } from '@/services/fileStorage';
import { StationInfoService } from '@/services/stationInfoService';

vi.mock('@/services/fileStorage', () => ({
  fileStorage: {
    getStationConfig: vi.fn(),
    getNetworkId: vi.fn(),
    getQsoData: vi.fn()
  }
}));

describe('StationInfoService', () => {
  const getStationConfig = vi.mocked(fileStorage.getStationConfig);
  const getNetworkId = vi.mocked(fileStorage.getNetworkId);
  const getQsoData = vi.mocked(fileStorage.getQsoData);

  beforeEach(() => {
    StationInfoService.clearCache();
    vi.stubGlobal('window', {
      location: { port: '8080' }
    });
    getStationConfig.mockReset();
    getNetworkId.mockReset();
    getQsoData.mockReset();
  });

  it('uses fallback station config values when saved config is partial', async () => {
    getStationConfig.mockResolvedValue({ callsign: '', designator: '' });
    getNetworkId.mockResolvedValue('MESH-12345');
    getQsoData.mockResolvedValue([]);

    const stationInfo = await StationInfoService.getStationInfo(false);

    expect(stationInfo.callsign).to.equal('K8TAR');
    expect(stationInfo.designator).to.equal('1A');
    expect(stationInfo.networkId).to.equal('MESH-12345');
    expect(stationInfo.qsoCount).to.equal(0);
    expect(stationInfo.score).to.equal(0);
  });

  it('scores digital and invalid QSOs as expected', async () => {
    getStationConfig.mockResolvedValue({ callsign: 'K8TAR', designator: '1A' });
    getNetworkId.mockResolvedValue('MESH-12345');
    getQsoData.mockResolvedValue([
      {
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T12:00:00.000Z',
        band: '20m',
        mode: 'DIGITAL',
        operator: 'K8TAR'
      },
      {
        call: 'K1ABC',
        class: '1A',
        section: 'MA',
        datetime: '2024-06-14T12:05:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR'
      },
      null
    ]);

    const stationInfo = await StationInfoService.getStationInfo(false);

    expect(stationInfo.qsoCount).to.equal(3);
    expect(stationInfo.score).to.equal(3);
  });

  it('includes the active port when station info is requested with includePort enabled', async () => {
    getStationConfig.mockResolvedValue({ callsign: 'K8TAR', designator: '1A' });
    getNetworkId.mockResolvedValue('MESH-12345');
    getQsoData.mockResolvedValue([]);

    const stationInfo = await StationInfoService.getStationInfo(true);

    expect(stationInfo.port).to.equal(8080);
    expect(stationInfo.timestamp).to.be.a('number');
  });

  it('builds a complete station info response', async () => {
    getStationConfig.mockResolvedValue({ callsign: 'K8TAR', designator: '1A' });
    getNetworkId.mockResolvedValue('MESH-12345');
    getQsoData.mockResolvedValue([
      {
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T12:00:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR'
      },
      {
        call: 'K1ABC',
        class: '1A',
        section: 'MA',
        datetime: '2024-06-14T12:05:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR'
      }
    ]);

    const stationInfo = await StationInfoService.getStationInfo(true);

    expect(stationInfo.callsign).to.equal('K8TAR');
    expect(stationInfo.designator).to.equal('1A');
    expect(stationInfo.networkId).to.equal('MESH-12345');
    expect(stationInfo.qsoCount).to.equal(2);
    expect(stationInfo.score).to.equal(3);
    expect(stationInfo.port).to.equal(8080);
    expect(StationInfoService.validateStationInfo(stationInfo)).to.equal(true);
  });

  it('falls back cleanly when storage lookup fails', async () => {
    getStationConfig.mockRejectedValue(new Error('storage unavailable'));
    getNetworkId.mockRejectedValue(new Error('storage unavailable'));
    getQsoData.mockResolvedValue([]);

    const stationInfo = await StationInfoService.getStationInfo(false);

    expect(stationInfo.callsign).to.equal('K8TAR');
    expect(stationInfo.designator).to.equal('1A');
    expect(stationInfo.networkId).to.match(/^MESH-fallback-/);
    expect(stationInfo.qsoCount).to.equal(0);
    expect(stationInfo.score).to.equal(0);
  });

  it('caches network IDs until the cache is cleared', async () => {
    getStationConfig.mockResolvedValue({ callsign: 'K8TAR', designator: '1A' });
    getNetworkId.mockResolvedValue('MESH-12345');
    getQsoData.mockResolvedValue([]);

    const first = await StationInfoService.getStationInfo(false);
    const second = await StationInfoService.getStationInfo(false);

    expect(first.networkId).to.equal('MESH-12345');
    expect(second.networkId).to.equal('MESH-12345');
    expect(getNetworkId).toHaveBeenCalledTimes(1);

    StationInfoService.clearCache();
    getNetworkId.mockResolvedValueOnce('MESH-67890');

    const refreshed = await StationInfoService.getStationInfo(false);

    expect(refreshed.networkId).to.equal('MESH-67890');
    expect(getNetworkId).toHaveBeenCalledTimes(2);
  });

  it('rejects station info responses missing required fields', () => {
    expect(StationInfoService.validateStationInfo(null)).to.equal(false);
    expect(
      StationInfoService.validateStationInfo({
        callsign: 'K8TAR',
        designator: '1A',
        networkId: 'MESH-12345',
        qsoCount: 1,
        software: 'K8TAR Field Day Logger',
        timestamp: Date.now(),
        online: true
      })
    ).to.equal(false);
  });

  it('accepts fully populated station info responses', () => {
    expect(
      StationInfoService.validateStationInfo({
        callsign: 'K8TAR',
        designator: '1A',
        networkId: 'MESH-12345',
        qsoCount: 3,
        score: 5,
        software: 'K8TAR Field Day Logger',
        version: '2.0.0',
        timestamp: Date.now(),
        online: true,
        port: 8080
      })
    ).to.equal(true);
  });
});
