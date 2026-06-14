/**
 * Logging and error handling utilities for Field Day Logger
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

import { debugError, debugLog, debugWarn } from '@/utils/debug';

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = 'info';

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      debugLog(`🔍 ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      debugLog(`ℹ️ ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      debugWarn(`⚠️ ${message}`, ...args);
    }
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      debugError(`❌ ${message}`, error, ...args);
    }
  }

  success(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      debugLog(`✅ ${message}`, ...args);
    }
  }
}

// Singleton instance
export const logger = Logger.getInstance();

/**
 * Reusable error handling utility
 */
export class ErrorHandler {
  /**
   * Handle async operations with consistent error logging
   */
  static async handleAsync<T>(
    operation: () => Promise<T>,
    context: string,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (e: unknown) {
      logger.error(`Failed to ${context}`, e);
      return fallback;
    }
  }

  /**
   * Handle sync operations with consistent error logging
   */
  static handleSync<T>(
    operation: () => T,
    context: string,
    fallback?: T
  ): T | undefined {
    try {
      return operation();
    } catch (e: unknown) {
      logger.error(`Failed to ${context}`, e);
      return fallback;
    }
  }

  /**
   * Handle JSON parsing with error handling
   */
  static parseJSON<T>(
    jsonString: string | null,
    context: string,
    fallback?: T
  ): T | undefined {
    if (!jsonString) return fallback;
    
    return this.handleSync(
      () => JSON.parse(jsonString) as T,
      `parse JSON for ${context}`,
      fallback
    );
  }

  /**
   * Handle localStorage operations with error handling
   */
  static getLocalStorageItem(key: string, context?: string): string | null {
    return this.handleSync(
      () => localStorage.getItem(key),
      `get localStorage item ${context || key}`,
      null
    ) || null;
  }

  static setLocalStorageItem(key: string, value: string, context?: string): boolean {
    return !!this.handleSync(
      () => {
        localStorage.setItem(key, value);
        return true;
      },
      `set localStorage item ${context || key}`,
      false
    );
  }
}
