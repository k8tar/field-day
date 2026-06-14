import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMock = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn()
};

vi.mock('fs', () => fsMock);

describe('NodeStationInfoService', () => {
  const importService = async () => {
    vi.resetModules();
    return import('@/services/nodeStationInfoService');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1718366400000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('reads station config and existing network ID from disk', async () => {
    fsMock.existsSync.mockImplementation((path: string) => path.endsWith('station-config.json') || path.endsWith('network-id.txt'));
    fsMock.readFileSync.mockImplementation((path: string) => {
      if (path.endsWith('station-config.json')) {
        return JSON.stringify({ callsign: 'K8TAR', designator: '1A' });
      }

      return 'MESH-node-existing-id';
    });

    const { NodeStationInfoService } = await importService();
    const stationInfo = await NodeStationInfoService.getStationInfo(8080, '/data', [
      { call: 'W1AW', class: '1A', section: 'CT', datetime: '2024-06-14T12:00:00.000Z', band: '20m', mode: 'CW', operator: 'K8TAR' },
      { call: 'K1ABC', class: '1A', section: 'MA', datetime: '2024-06-14T12:05:00.000Z', band: '20m', mode: 'PH', operator: 'K8TAR' }
    ]);

    expect(stationInfo.callsign).to.equal('K8TAR');
    expect(stationInfo.designator).to.equal('1A');
    expect(stationInfo.networkId).to.equal('MESH-node-existing-id');
    expect(stationInfo.qsoCount).to.equal(2);
    expect(stationInfo.score).to.equal(3);
    expect(stationInfo.online).to.equal(true);
    expect(stationInfo.port).to.equal(8080);
    expect(fsMock.writeFileSync).not.toHaveBeenCalled();
  });

  it('generates and persists a network ID when none exists', async () => {
    fsMock.existsSync.mockImplementation((path: string) => path.endsWith('station-config.json'));
    fsMock.readFileSync.mockImplementation((path: string) => {
      if (path.endsWith('station-config.json')) {
        return JSON.stringify({ callsign: 'W1AW', designator: '2A' });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const { NodeStationInfoService } = await importService();
    const stationInfo = await NodeStationInfoService.getStationInfo(9001, '/data', []);

    expect(stationInfo.callsign).to.equal('W1AW');
    expect(stationInfo.designator).to.equal('2A');
    expect(stationInfo.networkId).to.match(/^MESH-node-/);
    expect(stationInfo.qsoCount).to.equal(0);
    expect(stationInfo.score).to.equal(0);
    expect(fsMock.mkdirSync).toHaveBeenCalledWith('/data', { recursive: true });
    expect(fsMock.writeFileSync).toHaveBeenCalled();
  });

  it('falls back safely when config and network reads fail', async () => {
    fsMock.existsSync.mockImplementation((path: string) => {
      if (path.endsWith('station-config.json')) {
        return true;
      }
      return false;
    });

    fsMock.readFileSync.mockImplementation(() => {
      throw new Error('read failed');
    });

    fsMock.mkdirSync.mockImplementation(() => {
      throw new Error('mkdir failed');
    });

    const { NodeStationInfoService } = await importService();
    const stationInfo = await NodeStationInfoService.getStationInfo(3030, '/broken-data', [
      { call: 'W1AW', class: '1A', section: 'CT', datetime: '2024-06-14T12:00:00.000Z', band: '20m', mode: 'DIG', operator: 'K8TAR' }
    ]);

    expect(stationInfo.callsign).to.equal('K8TAR');
    expect(stationInfo.designator).to.equal('1A');
    expect(stationInfo.networkId).to.match(/^MESH-node-/);
    expect(stationInfo.score).to.equal(2);
    expect(stationInfo.online).to.equal(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it('returns error fallback when unexpected failures occur', async () => {
    const { NodeStationInfoService } = await importService();

    // @ts-expect-error Intentional invalid runtime input to exercise hard fallback path.
    const stationInfo = await NodeStationInfoService.getStationInfo(7000, '/data', null);

    expect(stationInfo.callsign).to.equal('ERROR');
    expect(stationInfo.online).to.equal(false);
    expect(stationInfo.port).to.equal(7000);
    expect(stationInfo.networkId).to.match(/^MESH-error-7000-/);
    expect(console.error).toHaveBeenCalled();
  });

  it('constructs NodeStationInfoService privately at runtime for ctor coverage', async () => {
    const { NodeStationInfoService } = await importService();

    // @ts-expect-error Runtime allows construction; private is compile-time only.
    const instance = new NodeStationInfoService();
    expect(instance).to.be.instanceOf(NodeStationInfoService);
  });
});