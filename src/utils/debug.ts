/**
 * Debug utility for conditional console logging
 */

const DEBUG_KEY = 'fieldday_debug_enabled';

export function isDebugEnabled(): boolean {
  return localStorage.getItem(DEBUG_KEY) === 'true';
}

export function setDebugEnabled(enabled: boolean): void {
  localStorage.setItem(DEBUG_KEY, enabled.toString());
}

export function debugLog(...args: unknown[]): void {
  if (isDebugEnabled()) {
    window.console.log(...args);
  }
}

export function debugWarn(...args: unknown[]): void {
  if (isDebugEnabled()) {
    window.console.warn(...args);
  }
}

export function debugError(...args: unknown[]): void {
  if (isDebugEnabled()) {
    window.console.error(...args);
  }
}
