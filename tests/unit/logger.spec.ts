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

  it('emits debug, info, and success logs when level allows them', () => {
    const logger = Logger.getInstance();
    logger.setLevel('debug');

    logger.debug('visible debug', { test: true });
    logger.info('visible info');
    logger.success('visible success');

    expect(debugLog).toHaveBeenCalledWith('🔍 visible debug', { test: true });
    expect(debugLog).toHaveBeenCalledWith('ℹ️ visible info');
    expect(debugLog).toHaveBeenCalledWith('✅ visible success');
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

  it('returns values for successful async and sync operations', async () => {
    const asyncResult = await ErrorHandler.handleAsync(async () => 'ok', 'run async task');
    const syncResult = ErrorHandler.handleSync(() => 'sync-ok', 'run sync task');

    expect(asyncResult).to.equal('ok');
    expect(syncResult).to.equal('sync-ok');
    expect(debugError).not.toHaveBeenCalled();
  });

  it('parses JSON and accesses localStorage safely', () => {
    expect(ErrorHandler.parseJSON('{"ok":true}', 'parse config')).to.deep.equal({ ok: true });
    expect(ErrorHandler.parseJSON('not-json', 'parse config', { ok: false })).to.deep.equal({ ok: false });
    expect(ErrorHandler.parseJSON(null, 'parse config', { ok: false })).to.deep.equal({ ok: false });

    localStorage.setItem('station', 'K8TAR');

    expect(ErrorHandler.getLocalStorageItem('station')).to.equal('K8TAR');
    expect(ErrorHandler.setLocalStorageItem('station', 'W1AW')).to.equal(true);
    expect(ErrorHandler.getLocalStorageItem('station')).to.equal('W1AW');
  });

  it('handles localStorage exceptions and returns safe fallbacks', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => {
        throw new Error('read failed');
      }),
      setItem: vi.fn(() => {
        throw new Error('write failed');
      })
    });

    expect(ErrorHandler.getLocalStorageItem('broken')).to.equal(null);
    expect(ErrorHandler.setLocalStorageItem('broken', 'value')).to.equal(false);
    expect(debugError).toHaveBeenCalledWith('❌ Failed to get localStorage item broken', expect.any(Error));
    expect(debugError).toHaveBeenCalledWith('❌ Failed to set localStorage item broken', expect.any(Error));
  });

  it('constructs ErrorHandler privately at runtime to keep ctor covered', () => {
    // @ts-expect-error Runtime allows construction; private is compile-time only.
    const instance = new ErrorHandler();
    expect(instance).to.be.instanceOf(ErrorHandler);
  });
});