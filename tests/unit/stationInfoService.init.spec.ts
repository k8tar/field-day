import { describe, expect, it, vi } from 'vitest';

describe('StationInfoService module initialization', () => {
  it('attaches service to window when imported in browser-like context', async () => {
    vi.resetModules();
    vi.doMock('@/services/fileStorage', () => ({
      fileStorage: {
        getStationConfig: vi.fn(),
        getNetworkId: vi.fn(),
        getQsoData: vi.fn()
      }
    }));
    vi.stubGlobal('window', {
      location: { port: '8080' }
    });

    const module = await import('@/services/stationInfoService');
    const globalWindow = window as Window & {
      StationInfoService?: typeof module.StationInfoService;
    };

    expect(globalWindow.StationInfoService).to.equal(module.StationInfoService);
  });
});
