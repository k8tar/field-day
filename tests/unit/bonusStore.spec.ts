import { describe, expect, it, vi } from 'vitest';

const fileStorageMock = {
  getBonuses: vi.fn(),
  saveBonuses: vi.fn()
};

const achievementServiceMock = {
  checkNow: vi.fn().mockResolvedValue(undefined)
};

vi.mock('@/services/fileStorage', () => ({ fileStorage: fileStorageMock }));
vi.mock('@/services/achievementService', () => ({ achievementService: achievementServiceMock }));

describe('bonus store', () => {
  const importBonusStore = async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('@/store/bonus');
    await vi.waitFor(() => expect(fileStorageMock.getBonuses).toHaveBeenCalled());
    return module;
  };

  it('merges stored completion state onto the default bonus list', () => {
    fileStorageMock.getBonuses.mockResolvedValue([
      { id: 'emergency_power', completed: true },
      { id: 'web_submission', completed: true },
      { id: 'unknown_bonus', completed: true }
    ]);

    return importBonusStore().then(bonusStore => {
      expect(bonusStore.bonuses.value).to.have.length(10);
      expect(bonusStore.bonuses.value.find(bonus => bonus.id === 'emergency_power')?.completed).to.equal(true);
      expect(bonusStore.bonuses.value.find(bonus => bonus.id === 'web_submission')?.completed).to.equal(true);
      expect(bonusStore.bonuses.value.find(bonus => bonus.id === 'public_location')?.completed).to.equal(false);
    });
  });

  it('toggles a bonus and triggers achievement checking', async () => {
    fileStorageMock.getBonuses.mockResolvedValue([]);
    const bonusStore = await importBonusStore();

    bonusStore.toggleBonus('public_location');

    expect(bonusStore.bonuses.value.find(bonus => bonus.id === 'public_location')?.completed).to.equal(true);
    await vi.waitFor(() => expect(achievementServiceMock.checkNow).toHaveBeenCalledTimes(1));
  });

  it('ignores unknown bonus ids', async () => {
    fileStorageMock.getBonuses.mockResolvedValue([]);
    const bonusStore = await importBonusStore();

    bonusStore.toggleBonus('missing_bonus');

    expect(bonusStore.bonuses.value.every(bonus => bonus.completed === false)).to.equal(true);
  });

  it('resets all bonuses and calculates totals', async () => {
    fileStorageMock.getBonuses.mockResolvedValue([]);
    const bonusStore = await importBonusStore();

    bonusStore.bonuses.value.find(bonus => bonus.id === 'emergency_power')!.completed = true;
    bonusStore.bonuses.value.find(bonus => bonus.id === 'media_publicity')!.completed = true;

    expect(bonusStore.getCompletedBonusCount()).to.equal(2);
    expect(bonusStore.getTotalBonusPoints()).to.equal(200);

    bonusStore.resetAllBonuses();

    expect(bonusStore.getCompletedBonusCount()).to.equal(0);
    expect(bonusStore.getTotalBonusPoints()).to.equal(0);
  });
});