import { beforeEach, describe, expect, it, vi } from 'vitest'
import { debugError, debugLog, debugWarn, isDebugEnabled, setDebugEnabled } from '@/utils/debug'

describe('debug utilities', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      })
    })

    vi.stubGlobal('window', {
      console: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    })
  })

  it('persists and reads debug-enabled state', () => {
    expect(isDebugEnabled()).to.equal(false)

    setDebugEnabled(true)
    expect(isDebugEnabled()).to.equal(true)

    setDebugEnabled(false)
    expect(isDebugEnabled()).to.equal(false)
  })

  it('logs only when debug mode is enabled', () => {
    debugLog('hidden log')
    debugWarn('hidden warn')
    debugError('hidden error')

    expect(window.console.log).not.toHaveBeenCalled()
    expect(window.console.warn).not.toHaveBeenCalled()
    expect(window.console.error).not.toHaveBeenCalled()

    setDebugEnabled(true)

    debugLog('visible log', { a: 1 })
    debugWarn('visible warn', { b: 2 })
    debugError('visible error', { c: 3 })

    expect(window.console.log).toHaveBeenCalledWith('visible log', { a: 1 })
    expect(window.console.warn).toHaveBeenCalledWith('visible warn', { b: 2 })
    expect(window.console.error).toHaveBeenCalledWith('visible error', { c: 3 })
  })
})