import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('CrossOriginStorage', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    vi.resetModules()
    storage.clear()

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key)
      })
    })
  })

  it('stores and retrieves primitive and JSON values', async () => {
    const { CrossOriginStorage } = await import('@/services/crossOriginStorage')

    CrossOriginStorage.setItem('stationCallsign', 'K8TAR')
    expect(CrossOriginStorage.getItem('stationCallsign')).to.equal('K8TAR')

    CrossOriginStorage.setJSON('pendingDeletions', [{ id: 'qso-1' }])
    expect(CrossOriginStorage.getJSON<{ id: string }[]>('pendingDeletions')).to.deep.equal([{ id: 'qso-1' }])

    CrossOriginStorage.removeItem('stationCallsign')
    expect(CrossOriginStorage.getItem('stationCallsign')).to.equal(null)
  })

  it('auto-migrates legacy keys on import without overwriting existing shared values', async () => {
    storage.set('stationCallsign', 'K8TAR')
    storage.set('stationDesignator', '1A')
    storage.set('dismissedMessages', '["m1"]')
    storage.set('fieldday_shared_station_designator', '2A')

    const { CrossOriginStorage } = await import('@/services/crossOriginStorage')

    expect(CrossOriginStorage.getItem('stationCallsign')).to.equal('K8TAR')
    expect(CrossOriginStorage.getItem('stationDesignator')).to.equal('2A')
    expect(CrossOriginStorage.getJSON<string[]>('dismissedMessages')).to.deep.equal(['m1'])
  })

  it('syncs station config values from file storage', async () => {
    const getStationConfig = vi.fn().mockResolvedValue({
      callsign: 'K8TAR',
      designator: '1A',
      stationClass: '2A',
      stationSection: 'CT'
    })

    vi.doMock('@/services/fileStorage', () => ({
      fileStorage: {
        getStationConfig
      }
    }))

    const { CrossOriginStorage } = await import('@/services/crossOriginStorage')

    await CrossOriginStorage.syncStationConfig()

    expect(CrossOriginStorage.getItem('stationCallsign')).to.equal('K8TAR')
    expect(CrossOriginStorage.getItem('stationDesignator')).to.equal('1A')
    expect(CrossOriginStorage.getItem('stationClass')).to.equal('2A')
    expect(CrossOriginStorage.getItem('stationSection')).to.equal('CT')
  })
})