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
});