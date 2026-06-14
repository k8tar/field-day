import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AsyncLock,
  SafeInterval,
  SafeTimeout,
  TTLCache,
  debounce,
  throttle
} from '@/utils/performance';

describe('performance utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('debounces calls and supports immediate mode', () => {
    const calls: number[] = [];
    const fn = (value: number) => {
      calls.push(value);
    };

    const debounced = debounce(fn, 100);
    debounced(1);
    debounced(2);
    vi.advanceTimersByTime(99);
    expect(calls).to.deep.equal([]);
    vi.advanceTimersByTime(1);
    expect(calls).to.deep.equal([2]);

    const immediateCalls: number[] = [];
    const immediateDebounced = debounce((value: number) => immediateCalls.push(value), 100, true);
    immediateDebounced(7);
    immediateDebounced(8);
    expect(immediateCalls).to.deep.equal([7]);
    vi.advanceTimersByTime(100);
    immediateDebounced(9);
    expect(immediateCalls).to.deep.equal([7, 9]);
  });

  it('throttles calls during the limit window', () => {
    const calls: number[] = [];
    const throttled = throttle((value: number) => calls.push(value), 100);

    throttled(1);
    throttled(2);
    expect(calls).to.deep.equal([1]);

    vi.advanceTimersByTime(100);
    throttled(3);
    expect(calls).to.deep.equal([1, 3]);
  });

  it('runs SafeInterval callbacks, catches errors, and stops cleanly', async () => {
    let count = 0;
    const interval = new SafeInterval(async () => {
      count += 1;
      if (count === 2) {
        throw new Error('interval boom');
      }
    }, 50, true);

    await vi.advanceTimersByTimeAsync(120);
    expect(count).to.be.greaterThan(1);
    expect(console.error).toHaveBeenCalledWith('SafeInterval callback error:', expect.any(Error));

    interval.stop();
    const stoppedCount = count;
    await vi.advanceTimersByTimeAsync(100);
    expect(count).to.equal(stoppedCount);

    interval.destroy();
    interval.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(count).to.equal(stoppedCount);

    // Exercise destroyed guard in executeCallback.
    // @ts-expect-error Private method is invoked intentionally for branch coverage.
    await interval.executeCallback();
    expect(count).to.equal(stoppedCount);
  });

  it('runs SafeTimeout callback once and supports cancel/destroy/error paths', async () => {
    let count = 0;
    const timeout = new SafeTimeout(() => {
      count += 1;
    }, 50);

    await vi.advanceTimersByTimeAsync(60);
    expect(count).to.equal(1);

    timeout.start();
    await vi.advanceTimersByTimeAsync(60);
    expect(count).to.equal(2);

    timeout.cancel();
    timeout.start();
    timeout.destroy();
    await vi.advanceTimersByTimeAsync(60);
    expect(count).to.equal(2);

    const failing = new SafeTimeout(async () => {
      throw new Error('timeout boom');
    }, 10);
    await vi.advanceTimersByTimeAsync(20);
    expect(console.error).toHaveBeenCalledWith('SafeTimeout callback error:', expect.any(Error));

    // Exercise the start guard while a timeout is already scheduled.
    failing.start();

    failing.destroy();

    // Exercise destroyed guard in executeCallback and start().
    // @ts-expect-error Private method is invoked intentionally for branch coverage.
    await failing.executeCallback();
    failing.start();
  });

  it('handles TTL cache expiry and cleanup', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    const cache = new TTLCache<string, number>(100);

    nowSpy.mockReturnValue(1000);
    cache.set('a', 1);
    cache.set('b', 2, 50);
    expect(cache.get('a')).to.equal(1);
    expect(cache.has('a')).to.equal(true);

    nowSpy.mockReturnValue(1060);
    expect(cache.get('b')).to.equal(undefined);

    cache.set('c', 3, 10);
    nowSpy.mockReturnValue(1200);
    cache.cleanup();
    expect(cache.has('c')).to.equal(false);

    expect(cache.delete('a')).to.equal(false);
    cache.clear();
    expect(cache.has('a')).to.equal(false);
  });

  it('deduplicates async work by key via AsyncLock', async () => {
    const lock = new AsyncLock();
    let runCount = 0;

    const op = async () => {
      runCount += 1;
      return 'value';
    };

    const p1 = lock.execute('k', op);
    const p2 = lock.execute('k', op);

    expect(lock.isRunning('k')).to.equal(true);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).to.equal('value');
    expect(r2).to.equal('value');
    expect(runCount).to.equal(1);
    expect(lock.isRunning('k')).to.equal(false);
  });
});
