import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsyncLock, SafeInterval, SafeTimeout, TTLCache, debounce, throttle } from '@/utils/performance';

describe('Performance utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debounces immediately when configured', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const debounced = debounce(handler, 100, true);

    debounced('first');
    debounced('second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');

    await vi.advanceTimersByTimeAsync(100);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('debounces repeated invocations', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const debounced = debounce(handler, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    await vi.advanceTimersByTimeAsync(99);
    expect(handler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('third');
  });

  it('throttles repeated invocations', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    const throttled = throttle(handler, 100);

    throttled('initial');
    throttled('suppressed');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('initial');

    await vi.advanceTimersByTimeAsync(100);
    throttled('allowed');

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith('allowed');
  });

  it('expires TTL cache entries', async () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string, number>(1000);

    cache.set('score', 42);
    expect(cache.get('score')).to.equal(42);

    expect(cache.has('score')).to.equal(true);

    cache.set('short', 7, 500);

    await vi.advanceTimersByTimeAsync(1001);
    expect(cache.get('score')).to.equal(undefined);
    expect(cache.get('short')).to.equal(undefined);

    cache.set('keep', 11);
    expect(cache.delete('keep')).to.equal(true);
    expect(cache.has('keep')).to.equal(false);

    cache.set('clear', 99);
    cache.clear();
    expect(cache.has('clear')).to.equal(false);
  });

  it('runs safe intervals until destroyed', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const interval = new SafeInterval(callback, 100);

    await vi.advanceTimersByTimeAsync(100);
    expect(callback).toHaveBeenCalledTimes(1);

    interval.destroy();
    await vi.advanceTimersByTimeAsync(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('logs and continues when a safe interval callback throws', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const interval = new SafeInterval(() => {
      throw new Error('boom');
    }, 100);

    await vi.advanceTimersByTimeAsync(100);
    expect(errorSpy).toHaveBeenCalledWith('SafeInterval callback error:', expect.any(Error));

    interval.destroy();
  });

  it('allows safe timeouts to be cancelled before firing', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const timeout = new SafeTimeout(callback, 100);

    timeout.cancel();
    await vi.advanceTimersByTimeAsync(100);
    expect(callback).not.toHaveBeenCalled();
  });

  it('invokes safe timeout callbacks and clears them afterward', async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const timeout = new SafeTimeout(callback, 100);

    await vi.advanceTimersByTimeAsync(100);

    expect(callback).toHaveBeenCalledTimes(1);
    timeout.cancel();
    timeout.destroy();
  });

  it('cleans up expired TTL cache entries', async () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string, string>(1000);

    cache.set('active', 'keep', 2000);
    cache.set('expired', 'drop', 500);

    await vi.advanceTimersByTimeAsync(750);
    cache.cleanup();

    expect(cache.get('active')).to.equal('keep');
    expect(cache.get('expired')).to.equal(undefined);
  });

  it('handles async lock failures and releases the key', async () => {
    const lock = new AsyncLock();
    const error = new Error('failed');

    await expect(
      lock.execute('sync', () => Promise.reject(error))
    ).rejects.to.equal(error);

    expect(lock.isRunning('sync')).to.equal(false);
  });

  it('reuses the same pending lock promise', async () => {
    const lock = new AsyncLock();
    let resolveOperation: ((value: string) => void) | null = null;

    const first = lock.execute('station-sync', () => new Promise<string>(resolve => {
      resolveOperation = resolve;
    }));
    const second = lock.execute('station-sync', () => Promise.resolve('ignored'));

    expect(lock.isRunning('station-sync')).to.equal(true);

    resolveOperation?.('done');
    await expect(first).resolves.to.equal('done');
    await expect(second).resolves.to.equal('done');
    expect(lock.isRunning('station-sync')).to.equal(false);
  });
});
