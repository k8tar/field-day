import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandler, Logger } from '@/utils/logger';
import { debugError, debugLog, debugWarn } from '@/utils/debug';

vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn()
}));

describe('logger utilities', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      })
    });
    Logger.getInstance().setLevel('info');
    vi.clearAllMocks();
  });

  it('routes messages through debug helpers by log level', () => {
    const logger = Logger.getInstance();

    logger.setLevel('warn');
    logger.debug('hidden debug');
    logger.info('hidden info');
    logger.warn('visible warning');
    logger.error('visible error', new Error('boom'));
    logger.success('hidden success');

    expect(debugLog).not.toHaveBeenCalledWith('🔍 hidden debug');
    expect(debugLog).not.toHaveBeenCalledWith('ℹ️ hidden info');
    expect(debugWarn).toHaveBeenCalledWith('⚠️ visible warning');
    expect(debugError).toHaveBeenCalledWith('❌ visible error', new Error('boom'));
    expect(debugLog).not.toHaveBeenCalledWith('✅ hidden success');
  });

  it('handles async and sync errors with fallbacks', async () => {
    const asyncResult = await ErrorHandler.handleAsync(async () => {
      throw new Error('async failure');
    }, 'run async task', 'fallback');

    const syncResult = ErrorHandler.handleSync(() => {
      throw new Error('sync failure');
    }, 'run sync task', 'fallback-sync');

    expect(asyncResult).to.equal('fallback');
    expect(syncResult).to.equal('fallback-sync');
    expect(debugError).toHaveBeenCalledWith('❌ Failed to run async task', expect.any(Error));
    expect(debugError).toHaveBeenCalledWith('❌ Failed to run sync task', expect.any(Error));
  });

  it('parses JSON and accesses localStorage safely', () => {
    expect(ErrorHandler.parseJSON('{"ok":true}', 'parse config')).to.deep.equal({ ok: true });
    expect(ErrorHandler.parseJSON('not-json', 'parse config', { ok: false })).to.deep.equal({ ok: false });

    localStorage.setItem('station', 'K8TAR');

    expect(ErrorHandler.getLocalStorageItem('station')).to.equal('K8TAR');
    expect(ErrorHandler.setLocalStorageItem('station', 'W1AW')).to.equal(true);
    expect(ErrorHandler.getLocalStorageItem('station')).to.equal('W1AW');
  });
});