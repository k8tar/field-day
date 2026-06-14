import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QSO } from '@/store/qso';

const backendApiMock = {
  connected: { value: false },
  refreshConnectionStatus: vi.fn(),
  addQso: vi.fn(),
  updateQso: vi.fn(),
  deleteQso: vi.fn(),
  getQsos: vi.fn().mockResolvedValue([]),
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

  it('logs a QSO offline and triggers connection refresh', async () => {
    qsoStore.band.value = '20m';
    qsoStore.mode.value = 'CW';
    qsoStore.operator.value = 'K8TAR';
    backendApiMock.connected.value = false;

    await qsoStore.logQso({
      call: 'W1AW',
      class: '1A',
      section: 'CT',
      datetime: '2024-06-14T12:00:00.000Z'
    });

    expect(qsoStore.qsos.value).to.have.length(1);
    expect(qsoStore.qsos.value[0].call).to.equal('W1AW');
    expect(qsoStore.qsos.value[0].band).to.equal('20m');
    expect(qsoStore.qsos.value[0].mode).to.equal('CW');
    expect(fileStorageMock.saveQsoData).toHaveBeenCalled();
    expect(backendApiMock.refreshConnectionStatus).toHaveBeenCalledTimes(1);
    expect(mockNetworkService.networkService.broadcastQsoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ call: 'W1AW', section: 'CT' }),
      'add'
    );
  });

  it('refreshes from server only when backend is connected', async () => {
    backendApiMock.connected.value = false;
    await qsoStore.refreshQsosFromServer();
    expect(backendApiMock.getQsos).not.toHaveBeenCalled();

    backendApiMock.connected.value = true;
    await qsoStore.refreshQsosFromServer();
    expect(backendApiMock.getQsos).toHaveBeenCalledTimes(1);
  });

  it('checks log reset and processes newer backend reset', async () => {
    backendApiMock.connected.value = true;
    backendApiMock.getLastLogResetTime.mockResolvedValue('2024-06-14T12:00:00.000Z');
    fileStorageMock.getSettings.mockResolvedValue({
      band: '40m',
      operator: 'K8TAR',
      mode: 'PH',
      lastLogResetTimestamp: '2024-06-14T10:00:00.000Z'
    });

    qsoStore.qsos.value = [
      {
        id: 'qso-1',
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T11:00:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR'
      }
    ];

    await qsoStore.checkForLogReset();

    expect(fileStorageMock.saveQsoData).toHaveBeenCalledWith([]);
    expect(fileStorageMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastLogResetTimestamp: '2024-06-14T12:00:00.000Z' })
    );
  });

  it('force upload returns false when backend is disconnected', async () => {
    qsoStore.qsos.value = [
      {
        id: 'qso-1',
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T11:00:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR'
      }
    ];

    backendApiMock.connected.value = false;

    const ok = await qsoStore.forceUploadAllQsos();

    expect(ok).to.equal(false);
    expect(backendApiMock.addQso).not.toHaveBeenCalled();
  });

  it('force upload sends all id-backed QSOs when connected', async () => {
    qsoStore.qsos.value = [
      {
        id: 'qso-1',
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T11:00:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR'
      },
      {
        call: 'NOID',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T11:01:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR'
      }
    ];

    backendApiMock.connected.value = true;
    backendApiMock.addQso.mockResolvedValue(undefined);

    const ok = await qsoStore.forceUploadAllQsos();

    expect(ok).to.equal(true);
    expect(backendApiMock.addQso).toHaveBeenCalledTimes(1);
    expect(backendApiMock.addQso).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qso-1', call_sign: 'W1AW', section: 'CT' })
    );
  });

  it('updates QSO in backend when connected', async () => {
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

    backendApiMock.connected.value = true;
    backendApiMock.updateQso.mockResolvedValue(undefined);

    await qsoStore.updateQso('qso-1', {
      id: 'qso-1',
      call: 'W1AW',
      class: '1A',
      section: 'EMA',
      datetime: '2024-06-14T12:10:00.000Z',
      band: '40m',
      mode: 'CW',
      operator: 'K8TAR'
    });

    expect(backendApiMock.updateQso).toHaveBeenCalledTimes(1);
    expect(backendApiMock.updateQso).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qso-1', section: 'EMA', frequency: '40m' })
    );
  });

  it('deletes QSO in backend when connected', async () => {
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

    backendApiMock.connected.value = true;
    backendApiMock.deleteQso.mockResolvedValue(undefined);

    await qsoStore.deleteQso('qso-1');

    expect(backendApiMock.deleteQso).toHaveBeenCalledWith('qso-1');
    expect(crossOriginStorageMock.setJSON).not.toHaveBeenCalledWith('pendingDeletions', ['qso-1']);
  });

  it('adds pending deletion when backend delete fails', async () => {
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

    backendApiMock.connected.value = true;
    backendApiMock.deleteQso.mockRejectedValue(new Error('backend delete failed'));

    await qsoStore.deleteQso('qso-1');

    expect(crossOriginStorageMock.setJSON).toHaveBeenCalledWith('pendingDeletions', ['qso-1']);
    expect(backendApiMock.refreshConnectionStatus).toHaveBeenCalledTimes(1);
  });

  it('skips log reset checks when backend is disconnected', async () => {
    backendApiMock.connected.value = false;

    await qsoStore.checkForLogReset();

    expect(backendApiMock.getLastLogResetTime).not.toHaveBeenCalled();
  });

  it('does not process log reset when backend has no reset command', async () => {
    backendApiMock.connected.value = true;
    backendApiMock.getLastLogResetTime.mockResolvedValue(undefined);

    await qsoStore.checkForLogReset();

    expect(fileStorageMock.saveQsoData).not.toHaveBeenCalledWith([]);
  });

  it('does not process log reset when local reset is up to date', async () => {
    backendApiMock.connected.value = true;
    backendApiMock.getLastLogResetTime.mockResolvedValue('2024-06-14T12:00:00.000Z');
    fileStorageMock.getSettings.mockResolvedValue({
      band: '40m',
      operator: 'K8TAR',
      mode: 'PH',
      lastLogResetTimestamp: '2024-06-14T12:00:00.000Z'
    });

    await qsoStore.checkForLogReset();

    expect(fileStorageMock.saveSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastLogResetTimestamp: '2024-06-14T12:00:00.000Z' })
    );
  });

  it('returns false from force upload when backend add fails', async () => {
    qsoStore.qsos.value = [
      {
        id: 'qso-1',
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T11:00:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR'
      }
    ];

    backendApiMock.connected.value = true;
    backendApiMock.addQso.mockRejectedValue(new Error('upload failed'));

    const ok = await qsoStore.forceUploadAllQsos();

    expect(ok).to.equal(false);
  });

  it('refreshes from backend and reconciles adds, updates, and deletes', async () => {
    qsoStore.qsos.value = [
      {
        id: 'keep-update',
        call: 'OLD',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T09:00:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR',
        lastModified: Date.parse('2024-06-14T09:00:00.000Z')
      },
      {
        id: 'delete-me',
        call: 'DEL',
        class: '1A',
        section: 'EMA',
        datetime: '2024-06-14T09:05:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR'
      }
    ];

    backendApiMock.connected.value = true;
    backendApiMock.getQsos.mockResolvedValue([
      {
        id: 'keep-update',
        timestamp: '2024-06-14T10:00:00.000Z',
        frequency: '40m',
        mode: 'CW',
        call_sign: 'NEW',
        name: 'NEW',
        section: 'MA',
        class: '2A',
        station_id: 'K8TAR-1A',
        operator: 'K8TAR'
      },
      {
        id: 'new-one',
        timestamp: '2024-06-14T10:10:00.000Z',
        frequency: '15m',
        mode: 'DIG',
        call_sign: 'ADD',
        name: 'ADD',
        section: 'NH',
        class: '1D',
        station_id: 'K8TAR-1A',
        operator: 'K8TAR'
      }
    ]);

    await qsoStore.refreshQsosFromServer();

    expect(qsoStore.qsos.value.map((qso) => qso.id)).to.deep.equal(['keep-update', 'new-one']);
    expect(qsoStore.qsos.value.find((qso) => qso.id === 'keep-update')?.call).to.equal('NEW');
    expect(fileStorageMock.saveQsoData).toHaveBeenCalled();
  });

  it('keeps local QSOs when backend returns empty list', async () => {
    qsoStore.qsos.value = [
      {
        id: 'local-1',
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T12:00:00.000Z',
        band: '20m',
        mode: 'PH',
        operator: 'K8TAR'
      }
    ];

    backendApiMock.connected.value = true;
    backendApiMock.getQsos.mockResolvedValue([]);

    await qsoStore.refreshQsosFromServer();

    expect(qsoStore.qsos.value).to.have.length(1);
    expect(qsoStore.qsos.value[0].id).to.equal('local-1');
  });

  it('processes log reset locally without backend refresh when disconnected', async () => {
    qsoStore.qsos.value = [
      {
        id: 'qso-1',
        call: 'W1AW',
        class: '1A',
        section: 'CT',
        datetime: '2024-06-14T11:00:00.000Z',
        band: '20m',
        mode: 'CW',
        operator: 'K8TAR'
      }
    ];

    backendApiMock.connected.value = false;

    await qsoStore.processLogReset('2024-06-14T12:00:00.000Z');

    expect(qsoStore.qsos.value).to.deep.equal([]);
    expect(backendApiMock.getQsos).not.toHaveBeenCalled();
    expect(fileStorageMock.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastLogResetTimestamp: '2024-06-14T12:00:00.000Z' })
    );
  });

  it('handles backend reset check errors without processing reset', async () => {
    backendApiMock.connected.value = true;
    backendApiMock.getLastLogResetTime.mockRejectedValue(new Error('reset query failed'));

    await qsoStore.checkForLogReset();

    expect(fileStorageMock.saveQsoData).not.toHaveBeenCalledWith([]);
  });

  it('does not throw when deleting a non-existent QSO id', async () => {
    backendApiMock.connected.value = false;

    await expect(qsoStore.deleteQso('missing-id')).resolves.toBeUndefined();
    expect(backendApiMock.refreshConnectionStatus).toHaveBeenCalledTimes(1);
  });
});
