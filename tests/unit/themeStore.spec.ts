import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface ThemeStorageApi {
  getSettings: () => Promise<{ theme?: string; operator?: string; band?: string }>
  saveSettings: (settings: Record<string, unknown>) => Promise<void>
}

interface ReactiveRef<T> {
  value: T
  watchers: Array<(value: T) => void>
}

interface MockDocument {
  documentElement: {
    classList: {
      add: (token: string) => void
      remove: (token: string) => void
      contains: (token: string) => boolean
    }
  }
  createElement: () => object
}

interface MockWindow {
  fileStorage?: ThemeStorageApi
  matchMedia?: (query: string) => { matches: boolean }
}

function waitForTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('theme store', () => {
  const classes = new Set<string>()

  function installVueMock(): void {
    vi.doMock('vue', () => {
      function ref<T>(initial: T): ReactiveRef<T> {
        const target: ReactiveRef<T> = {
          value: initial,
          watchers: []
        }

        return new Proxy(target, {
          set(state, prop, value) {
            if (prop === 'value') {
              state.value = value as T
              state.watchers.forEach(watcher => watcher(value as T))
              return true
            }

            return Reflect.set(state, prop, value)
          }
        })
      }

      function watch<T>(source: ReactiveRef<T>, callback: (value: T) => void): void {
        source.watchers.push(callback)
      }

      return { ref, watch }
    })
  }

  function installDocumentMock(): void {
    const documentMock: MockDocument = {
      documentElement: {
        classList: {
          add: (token: string) => {
            classes.add(token)
          },
          remove: (token: string) => {
            classes.delete(token)
          },
          contains: (token: string) => classes.has(token)
        }
      },
      createElement: () => ({})
    }

    vi.stubGlobal('document', documentMock)
  }

  function setWindowApis(fileStorage: ThemeStorageApi, prefersDark: boolean): void {
    const windowMock: MockWindow = {
      fileStorage,
      matchMedia: vi.fn(() => ({ matches: prefersDark }))
    }

    vi.stubGlobal('window', windowMock)
  }

  beforeEach(() => {
    vi.resetModules()
    classes.clear()
    installVueMock()
    installDocumentMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads and applies dark theme from file storage settings', async () => {
    const getSettings = vi.fn().mockResolvedValue({ theme: 'dark', operator: 'K8TAR' })
    const saveSettings = vi.fn().mockResolvedValue(undefined)

    setWindowApis({ getSettings, saveSettings }, false)

    const themeStore = await import('@/store/theme')
    await waitForTick()

    expect(themeStore.isDark.value).to.equal(true)
    expect(classes.has('dark-mode')).to.equal(true)
    expect(classes.has('light-mode')).to.equal(false)
  })

  it('falls back to system preference when no saved theme exists', async () => {
    const getSettings = vi.fn().mockResolvedValue({ operator: 'K8TAR' })
    const saveSettings = vi.fn().mockResolvedValue(undefined)

    setWindowApis({ getSettings, saveSettings }, true)

    const themeStore = await import('@/store/theme')
    await waitForTick()

    expect(themeStore.isDark.value).to.equal(true)
    expect(classes.has('dark-mode')).to.equal(true)
  })

  it('toggles theme and persists updated settings', async () => {
    const getSettings = vi.fn().mockResolvedValue({ theme: 'light', operator: 'K8TAR', band: '20m' })
    const saveSettings = vi.fn().mockResolvedValue(undefined)

    setWindowApis({ getSettings, saveSettings }, false)

    const themeStore = await import('@/store/theme')
    await waitForTick()

    expect(themeStore.isDark.value).to.equal(false)

    themeStore.toggleTheme()
    await waitForTick()

    expect(themeStore.isDark.value).to.equal(true)
    expect(classes.has('dark-mode')).to.equal(true)
    expect(saveSettings).toHaveBeenCalledWith({
      theme: 'dark',
      operator: 'K8TAR',
      band: '20m'
    })
  })
})