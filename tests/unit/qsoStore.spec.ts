import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QSO } from '@/store/qso';

const backendApiMock = {
  connected: { value: false },
  refreshConnectionStatus: vi.fn(),
  addQso: vi.fn(),
  updateQso: vi.fn(),
  deleteQso: vi.fn(),
  getLastLogResetTime: vi.fn(),
  sendMessage: vi.fn(),
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
  deleteMessage: vi.fn(),
  triggerLogReset: vi.fn(),
  getMessages: vi.fn(),
  getBaseUrl: vi.fn(),
};

const fileStorageMock = {
  getQsoData: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ band: '40m', operator: '', mode: 'PH' }),
  saveSettings: vi.fn(),
  getStationConfig: vi.fn().mockResolvedValue({ callsign: 'K8TAR', designator: '1A' }),
  saveQsoData: vi.fn(),
};

const crossOriginStorageMock = {
  getItem: vi.fn().mockResolvedValue('[]'),
  setItem: vi.fn().mockResolvedValue(undefined),
  getJSON: vi.fn().mockReturnValue([]),
  setJSON: vi.fn()
};

const mockAchievementService = {
  checkNow: vi.fn().mockResolvedValue(undefined)
};

const mockNetworkService = {
  networkService: {
    broadcastQsoUpdate: vi.fn().mockResolvedValue(undefined)
  }
};

vi.mock('@/services/backendApiService', () => ({ backendApi: backendApiMock }));
vi.mock('@/services/fileStorage', () => ({ fileStorage: fileStorageMock }));
vi.mock('@/services/crossOriginStorage', () => ({ CrossOriginStorage: crossOriginStorageMock }));
vi.mock('@/utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn(), debugError: vi.fn() }));
vi.mock('@/services/achievementService', () => ({ achievementService: mockAchievementService }));
vi.mock('@/services/networkService', () => mockNetworkService);

describe('QSO store helpers', () => {
  let qsoStore: typeof import('@/store/qso');

  beforeAll(async () => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn()
    });

    qsoStore = await import('@/store/qso');
  });

  beforeEach(() => {
    qsoStore.qsos.value = [];
    backendApiMock.connected.value = false;
    qsoStore.stopPeriodicQsoRefresh();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scores QSOs by mode', () => {
    const qso: QSO = {
      call: 'W1AW',
      class: '1A',
      section: 'CT',
      datetime: '2024-06-14T12:00:00.000Z',
      band: '20m',
      mode: 'CW',
      operator: 'K8TAR'
    };

    expect(qsoStore.getQsoPoints(qso)).to.equal(2);
    expect(qsoStore.getQsoPoints({ ...qso, mode: 'DIG' })).to.equal(2);
    expect(qsoStore.getQsoPoints({ ...qso, mode: 'PH' })).to.equal(1);
  });

  it('totals points and grouped mode totals from the current store', () => {
    qsoStore.qsos.value = [
      { call: 'W1AW', class: '1A', section: 'CT', datetime: '2024-06-14T12:00:00.000Z', band: '20m', mode: 'CW', operator: 'K8TAR' },
      { call: 'K1ABC', class: '1A', section: 'MA', datetime: '2024-06-14T12:05:00.000Z', band: '20m', mode: 'DIG', operator: 'K8TAR' },
      { call: 'N1MM', class: '1A', section: 'CT', datetime: '2024-06-14T12:10:00.000Z', band: '20m', mode: 'PH', operator: 'K8TAR' }
    ];

    expect(qsoStore.getTotalQsoPoints()).to.equal(5);
    expect(qsoStore.getQsoPointsByMode()).to.deep.equal({ cw: 2, dig: 2, ph: 1, total: 5 });
  });

  it('returns completed sections without duplicates or blanks', () => {
    qsoStore.qsos.value = [
      { call: 'W1AW', class: '1A', section: 'ct', datetime: '2024-06-14T12:00:00.000Z', band: '20m', mode: 'CW', operator: 'K8TAR' },
      { call: 'K1ABC', class: '1A', section: 'EMA', datetime: '2024-06-14T12:05:00.000Z', band: '20m', mode: 'PH', operator: 'K8TAR' },
      { call: 'N1MM', class: '1A', section: 'ct', datetime: '2024-06-14T12:10:00.000Z', band: '20m', mode: 'PH', operator: 'K8TAR' },
      { call: 'AA1A', class: '1A', section: '', datetime: '2024-06-14T12:15:00.000Z', band: '20m', mode: 'PH', operator: 'K8TAR' }
    ];

    expect(qsoStore.getCompletedSections()).to.deep.equal(['CT', 'EMA']);
  });

  it('orders DX last and zero-prefixed sections first', () => {
    expect(qsoStore.getSectionOrder('0A')).to.equal(0);
    expect(qsoStore.getSectionOrder('CT')).to.equal(500);
    expect(qsoStore.getSectionOrder('DX')).to.equal(999);
  });

  it('clears QSOs and persists the empty log', async () => {
    qsoStore.qsos.value = [
      { call: 'W1AW', class: '1A', section: 'CT', datetime: '2024-06-14T12:00:00.000Z', band: '20m', mode: 'CW', operator: 'K8TAR' },
      { call: 'K1ABC', class: '1A', section: 'MA', datetime: '2024-06-14T12:05:00.000Z', band: '20m', mode: 'PH', operator: 'K8TAR' }
    ];

    await qsoStore.clearAllQsos();

    expect(qsoStore.qsos.value).to.deep.equal([]);
    expect(fileStorageMock.saveQsoData).toHaveBeenCalledWith([]);
    await vi.waitFor(() => expect(mockAchievementService.checkNow).toHaveBeenCalledTimes(1));
  });

  it('keeps only QSOs before the reset timestamp', async () => {
    qsoStore.qsos.value = [
      {
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T11:55:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR',
        lastModified: new Date('2024-06-14T11:54:00.000Z').getTime()
      },
      {
        call: 'K1ABC',
        class: '1A',
        section: 'MA',
        datetime: '2024-06-14T11:56:00.000Z',
        band: '20m',
        mode: 'DIG',
        operator: 'K8TAR',
        timestamp: new Date('2024-06-14T11:55:30.000Z').getTime()
      },
      {
        call: 'N1MM',
        class: '1A',
        section: 'EMA',
        datetime: '2024-06-14T11:57:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR'
      },
      {
        call: 'AA1A',
        class: '1A',
        section: 'RI',
        datetime: '2024-06-14T12:05:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR',
        lastModified: new Date('2024-06-14T12:05:00.000Z').getTime()
      }
    ];

    await qsoStore.clearQsosAfterTimestamp('2024-06-14T12:00:00.000Z');

    expect(qsoStore.qsos.value.map(qso => qso.call)).to.deep.equal(['W1AW', 'K1ABC', 'N1MM']);
    expect(fileStorageMock.saveQsoData).toHaveBeenCalledWith(qsoStore.qsos.value);
    await vi.waitFor(() => expect(mockAchievementService.checkNow).toHaveBeenCalledTimes(1));
  });

  it('starts and stops periodic refresh only when connected', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    qsoStore.startPeriodicQsoRefresh();
    expect(setIntervalSpy).not.toHaveBeenCalled();

    backendApiMock.connected.value = true;
    qsoStore.startPeriodicQsoRefresh();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    qsoStore.stopPeriodicQsoRefresh();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('updates an existing QSO and broadcasts the change', async () => {
    qsoStore.qsos.value = [
      {
        id: 'qso-1',
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T12:00:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR',
        lastModified: 1718366400000
      }
    ];

    backendApiMock.connected.value = false;

    await qsoStore.updateQso('qso-1', {
      call: 'W1AW',
      class: '1A',
      section: 'MA',
      datetime: '2024-06-14T12:05:00.000Z',
      band: '40m',
      mode: 'CW',
      operator: 'K8TAR'
    });

    expect(qsoStore.qsos.value).to.have.length(1);
    expect(qsoStore.qsos.value[0].section).to.equal('MA');
    expect(qsoStore.qsos.value[0].band).to.equal('40m');
    expect(qsoStore.qsos.value[0].mode).to.equal('CW');
    expect(qsoStore.qsos.value[0].lastModified).to.be.a('number');
    expect(fileStorageMock.saveQsoData).toHaveBeenCalled();
    expect(mockNetworkService.networkService.broadcastQsoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'MA', band: '40m', mode: 'CW' }),
      'update'
    );
  });

  it('deletes a QSO and records the pending deletion when offline', async () => {
    qsoStore.qsos.value = [
      {
        id: 'qso-1',
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T12:00:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR'
      }
    ];

    backendApiMock.connected.value = false;

    await qsoStore.deleteQso('qso-1');

    expect(qsoStore.qsos.value).to.deep.equal([]);
    expect(crossOriginStorageMock.setJSON).toHaveBeenCalledWith('pendingDeletions', ['qso-1']);
    expect(mockNetworkService.networkService.broadcastQsoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qso-1', section: 'CT' }),
      'delete'
    );
  });
});
