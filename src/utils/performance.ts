/**
 * Performance utilities for Field Day Logger
 */

/**
 * Debounce function to limit how often a function can fire
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

/**
 * Throttle function to limit execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function throttledFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Create a safe interval that automatically cleans up
 */
export class SafeInterval {
  private intervalId: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(
    private callback: () => void | Promise<void>,
    private delay: number,
    private immediate = false
  ) {
    if (immediate) {
      this.executeCallback();
    }
    this.start();
  }

  private async executeCallback() {
    if (this.isDestroyed) return;
    
    try {
      await this.callback();
    } catch (error) {
      console.error('SafeInterval callback error:', error);
    }
  }

  start(): void {
    if (this.isDestroyed || this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.executeCallback();
    }, this.delay);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  destroy(): void {
    this.stop();
    this.isDestroyed = true;
  }
}

/**
 * Create a safe timeout that can be easily managed
 */
export class SafeTimeout {
  private timeoutId: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(
    private callback: () => void | Promise<void>,
    private delay: number
  ) {
    this.start();
  }

  private async executeCallback() {
    if (this.isDestroyed) return;
    
    try {
      await this.callback();
    } catch (error) {
      console.error('SafeTimeout callback error:', error);
    }
  }

  start(): void {
    if (this.isDestroyed || this.timeoutId) return;
    
    this.timeoutId = setTimeout(() => {
      this.executeCallback();
      this.timeoutId = null;
    }, this.delay);
  }

  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  destroy(): void {
    this.cancel();
    this.isDestroyed = true;
  }
}

/**
 * Cache with TTL (Time To Live) support
 */
export class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTTL = defaultTTL;
  }

  set(key: K, value: V, ttl?: number): void {
    const expiry = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiry });
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Async operation manager to prevent multiple simultaneous calls
 */
export class AsyncLock {
  private pending = new Map<string, Promise<any>>();

  async execute<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // If operation is already running, return the existing promise
    if (this.pending.has(key)) {
      return this.pending.get(key) as Promise<T>;
    }

    // Start new operation
    const promise = operation().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  isRunning(key: string): boolean {
    return this.pending.has(key);
  }
}
