import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

const backendApiMock = {
  getBaseUrl: vi.fn().mockReturnValue('http://localhost:3030'),
  addQso: vi.fn(),
  updateQso: vi.fn(),
  getQsos: vi.fn(),
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
  getMessages: vi.fn()
};

vi.mock('@/services/backendApiService', () => ({ backendApi: backendApiMock }));
vi.mock('@/utils/debug', () => ({ debugLog: vi.fn() }));

describe('FileStorageService', () => {
  const importService = async () => {
    vi.resetModules();
    return import('@/services/fileStorage');
  };

  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();

    vi.stubGlobal('window', {
      location: { port: '8080' }
    });

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      })
    });

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => 'text/html' },
      json: async () => ({})
    })));
  });

  it('saves and reloads station config using the local fallback', async () => {
    vi.setSystemTime(new Date('2024-06-14T12:00:00.000Z'));
    const { fileStorage } = await importService();

    await fileStorage.saveStationConfig({ callsign: 'K8TAR', designator: '1A', stationClass: '1A' });

    const storedConfig = storage.get('fieldday_shared_8080_station-config');
    expect(storedConfig).to.be.a('string');

    const loadedConfig = await fileStorage.getStationConfig();
    expect(loadedConfig.callsign).to.equal('K8TAR');
    expect(loadedConfig.designator).to.equal('1A');
    expect(loadedConfig.stationClass).to.equal('1A');
    expect(loadedConfig.port).to.equal(8080);
    expect(loadedConfig.lastUpdated).to.equal(Date.parse('2024-06-14T12:00:00.000Z'));
  });

  it('merges settings updates and preserves unspecified fields', async () => {
    vi.setSystemTime(new Date('2024-06-14T13:00:00.000Z'));
    const { fileStorage } = await importService();

    await fileStorage.saveSettings({ band: '20m', operator: 'K8TAR', networkSettings: { autoReconnect: false } });
    const savedSettings = storage.get('fieldday_shared_8080_settings');
    expect(savedSettings).to.be.a('string');

    const loadedSettings = await fileStorage.getSettings();
    expect(loadedSettings.band).to.equal('20m');
    expect(loadedSettings.operator).to.equal('K8TAR');
    expect(loadedSettings.mode).to.equal('PH');
    expect(loadedSettings.networkSettings).to.deep.equal({ autoReconnect: false });
    expect(loadedSettings.lastUpdated).to.equal(Date.parse('2024-06-14T13:00:00.000Z'));
  });

  it('migrates legacy localStorage data into file-backed storage', async () => {
    storage.set('stationCallsign', 'K8TAR');
    storage.set('stationDesignator', '1A');
    storage.set('stationClass', '1A');
    storage.set('stationSection', 'CT');
    storage.set('qso_band', '40m');
    storage.set('qso_operator', 'K8TAR');
    storage.set('qso_mode', 'CW');
    storage.set('networkSettings', JSON.stringify({ autoReconnect: true }));
    storage.set('operators', JSON.stringify(['K8TAR', 'W1AW']));

    const { fileStorage } = await importService();
    await fileStorage.migrateFromLocalStorage();

    const migratedConfig = await fileStorage.getStationConfig();
    const migratedSettings = await fileStorage.getSettings();

    expect(migratedConfig.callsign).to.equal('K8TAR');
    expect(migratedConfig.designator).to.equal('1A');
    expect(migratedConfig.stationClass).to.equal('1A');
    expect(migratedConfig.stationSection).to.equal('CT');
    expect(migratedSettings.band).to.equal('40m');
    expect(migratedSettings.operator).to.equal('K8TAR');
    expect(migratedSettings.mode).to.equal('CW');
    expect(migratedSettings.networkSettings).to.deep.equal({ autoReconnect: true });
  });

  it('converts backend QSOs to frontend shape', async () => {
    backendApiMock.getQsos.mockResolvedValue([
      {
        id: 'q1',
        call_sign: 'W1AW',
        name: 'W1AW',
        class: '1A',
        section: 'CT',
        frequency: '20m',
        mode: 'CW',
        operator: 'K8TAR',
        station_id: 'K8TAR-1A',
        timestamp: '2024-06-14T12:00:00.000Z'
      }
    ]);

    const { fileStorage } = await importService();
    const qsos = await fileStorage.getQsoData();

    expect(qsos).to.have.length(1);
    expect(qsos[0].id).to.equal('q1');
    expect(qsos[0].call).to.equal('W1AW');
    expect(qsos[0].band).to.equal('20m');
    expect(qsos[0].stationDesignator).to.equal('1A');
  });

  it('falls back to locally wrapped QSO data when backend read fails', async () => {
    backendApiMock.getQsos.mockRejectedValue(new Error('backend unavailable'));
    storage.set('fieldday_shared_8080_qsos', JSON.stringify({
      qsos: [
        {
          id: 'local-1',
          call: 'N1MM',
          class: '2A',
          section: 'EMA',
          datetime: '2024-06-14T12:01:00.000Z',
          band: '40m',
          mode: 'PH',
          operator: 'K8TAR'
        }
      ],
      lastUpdated: Date.now()
    }));

    const { fileStorage } = await importService();
    const qsos = await fileStorage.getQsoData();

    expect(qsos).to.have.length(1);
    expect(qsos[0].id).to.equal('local-1');
    expect(qsos[0].call).to.equal('N1MM');
  });

  it('falls back to wrapped local QSO storage when backend write fails', async () => {
    backendApiMock.updateQso.mockRejectedValue(new Error('write failed'));
    const { fileStorage } = await importService();

    await fileStorage.saveQsoData([
      {
        id: 'qso-1',
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T12:00:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR'
      }
    ]);

    const fallback = storage.get('fieldday_shared_8080_qso-data');
    expect(fallback).to.be.a('string');
    const parsed = JSON.parse(fallback || '{}') as { qsos?: Array<{ id: string }> };
    expect(parsed.qsos?.[0]?.id).to.equal('qso-1');
  });

  it('converts backend messages to frontend shape', async () => {
    backendApiMock.getMessages.mockResolvedValue([
      {
        id: 'm1',
        message_type: 'chat',
        text: 'hello',
        from_station_id: 'K8TAR-1A',
        target_station_id: 'all',
        timestamp: '2024-06-14T12:00:00.000Z'
      }
    ]);

    const { fileStorage } = await importService();
    const messages = await fileStorage.getMessages();

    expect(messages).to.have.length(1);
    expect(messages[0].id).to.equal('m1');
    expect(messages[0].type).to.equal('chat');
    expect(messages[0].text).to.equal('hello');
  });

  it('falls back to wrapped local messages when backend read fails', async () => {
    backendApiMock.getMessages.mockRejectedValue(new Error('messages down'));
    storage.set('fieldday_shared_8080_messages', JSON.stringify({
      messages: [
        {
          id: 'l1',
          type: 'info',
          text: 'local',
          from: 'K8TAR-1A',
          target: 'all',
          timestamp: Date.now()
        }
      ],
      lastUpdated: Date.now()
    }));

    const { fileStorage } = await importService();
    const messages = await fileStorage.getMessages();

    expect(messages).to.have.length(1);
    expect(messages[0].id).to.equal('l1');
  });

  it('returns existing network id from station config', async () => {
    const { fileStorage } = await importService();
    await fileStorage.saveStationConfig({ networkId: 'MESH-node-fixed-abcde' });

    const networkId = await fileStorage.getNetworkId();
    expect(networkId).to.equal('MESH-node-fixed-abcde');
  });

  it('generates and saves a network id when missing', async () => {
    const { FileStorageService } = await importService();
    const service = new FileStorageService(8080);

    const networkId = await service.getNetworkId();

    expect(networkId.startsWith('MESH-node-')).to.equal(true);
    const storedConfigRaw = storage.get('fieldday_shared_8080_station-config');
    expect(storedConfigRaw).to.be.a('string');
    const storedConfig = JSON.parse(storedConfigRaw || '{}') as { networkId?: string };
    expect(storedConfig.networkId).to.equal(networkId);
  });
});