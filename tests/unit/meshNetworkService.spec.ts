import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const logQsoMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@/services/fileStorage', () => ({
  fileStorage: {
    getNetworkId: vi.fn().mockResolvedValue('MESH-TEST-1'),
    getQsoData: vi.fn().mockResolvedValue([])
  }
}))

vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn()
}))

vi.mock('@/store/qso', () => ({
  logQso: logQsoMock
}))

interface MeshServiceLike {
  on: (event: string, callback: (...args: unknown[]) => void) => void
  off: (event: string, callback: (...args: unknown[]) => void) => void
  startMesh: () => Promise<boolean>
  stopMesh: () => Promise<void>
  refreshDiscovery: () => Promise<void>
  forceMeshSync: () => Promise<void>
  isMeshActive: () => boolean
  getMeshStatus: () => { meshHealth: 'healthy' | 'degraded' | 'isolated'; isActive: boolean }
}

describe('MeshNetworkService', () => {
  let meshService: MeshServiceLike
  let internalService: {
    initializeLocalNode: () => Promise<void>
    startPeerDiscovery: () => void
    startHeartbeat: () => void
    startPeriodicSync: () => void
    updateMeshHealth: () => void
    discoverPeers: () => Promise<void>
    performMeshSync: () => Promise<void>
    discoveredNodes: Map<string, unknown>
    connections: Map<string, unknown>
    status: { connectedNodes: number; discoveredNodes: number }
    meshActive: boolean
    removeNode: (nodeId: string) => void
  }

  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal('WebSocket', class {})
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] })
    })))

    const module = await import('@/services/meshNetworkService')
    meshService = module.meshNetworkService as unknown as MeshServiceLike
    internalService = module.meshNetworkService as unknown as typeof internalService
  })

  afterEach(async () => {
    await meshService.stopMesh()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('starts mesh mode and emits mesh:started', async () => {
    const started = vi.fn()
    meshService.on('mesh:started', started)

    vi.spyOn(internalService, 'initializeLocalNode').mockResolvedValue(undefined)
    vi.spyOn(internalService, 'startPeerDiscovery').mockImplementation(() => undefined)
    vi.spyOn(internalService, 'startHeartbeat').mockImplementation(() => undefined)
    vi.spyOn(internalService, 'startPeriodicSync').mockImplementation(() => undefined)
    vi.spyOn(internalService, 'updateMeshHealth').mockImplementation(() => undefined)

    const startedMesh = await meshService.startMesh()

    expect(startedMesh).to.equal(true)
    expect(meshService.isMeshActive()).to.equal(true)
    expect(started).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes callbacks registered with off()', async () => {
    const callback = vi.fn()
    meshService.on('mesh:started', callback)
    meshService.off('mesh:started', callback)

    vi.spyOn(internalService, 'initializeLocalNode').mockResolvedValue(undefined)
    vi.spyOn(internalService, 'startPeerDiscovery').mockImplementation(() => undefined)
    vi.spyOn(internalService, 'startHeartbeat').mockImplementation(() => undefined)
    vi.spyOn(internalService, 'startPeriodicSync').mockImplementation(() => undefined)
    vi.spyOn(internalService, 'updateMeshHealth').mockImplementation(() => undefined)

    await meshService.startMesh()

    expect(callback).not.toHaveBeenCalled()
  })

  it('refreshes discovery and sync only while mesh is active', async () => {
    const discoverSpy = vi.spyOn(internalService, 'discoverPeers').mockResolvedValue(undefined)
    const syncSpy = vi.spyOn(internalService, 'performMeshSync').mockResolvedValue(undefined)

    await meshService.refreshDiscovery()
    await meshService.forceMeshSync()

    expect(discoverSpy).not.toHaveBeenCalled()
    expect(syncSpy).not.toHaveBeenCalled()

    vi.spyOn(internalService, 'initializeLocalNode').mockResolvedValue(undefined)
    vi.spyOn(internalService, 'startPeerDiscovery').mockImplementation(() => undefined)
    vi.spyOn(internalService, 'startHeartbeat').mockImplementation(() => undefined)
    vi.spyOn(internalService, 'startPeriodicSync').mockImplementation(() => undefined)
    vi.spyOn(internalService, 'updateMeshHealth').mockImplementation(() => undefined)

    await meshService.startMesh()
    await meshService.refreshDiscovery()
    await meshService.forceMeshSync()

    expect(discoverSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledTimes(1)
  })

  it('updates mesh health based on discovered nodes versus connections', () => {
    internalService.discoveredNodes.clear()
    internalService.connections.clear()
    internalService.updateMeshHealth()
    expect(meshService.getMeshStatus().meshHealth).to.equal('isolated')

    internalService.discoveredNodes.set('n1', { id: 'n1' })
    internalService.discoveredNodes.set('n2', { id: 'n2' })
    internalService.discoveredNodes.set('n3', { id: 'n3' })
    internalService.connections.set('n1', 'http-api')
    internalService.updateMeshHealth()
    expect(meshService.getMeshStatus().meshHealth).to.equal('degraded')

    internalService.connections.set('n2', 'http-api')
    internalService.connections.set('n3', 'http-api')
    internalService.updateMeshHealth()
    expect(meshService.getMeshStatus().meshHealth).to.equal('healthy')
  })

  it('removes nodes and keeps status counts in sync', () => {
    internalService.discoveredNodes.clear()
    internalService.connections.clear()
    internalService.discoveredNodes.set('node-1', { id: 'node-1', callsign: 'K8TAR' })
    internalService.connections.set('node-1', 'http-api')

    internalService.removeNode('node-1')

    expect(internalService.discoveredNodes.has('node-1')).to.equal(false)
    expect(internalService.connections.has('node-1')).to.equal(false)
    expect(internalService.status.discoveredNodes).to.equal(0)
    expect(internalService.status.connectedNodes).to.equal(0)
  })

  it('returns false and emits mesh:error when start fails', async () => {
    const failed = vi.fn()
    meshService.on('mesh:error', failed)

    vi.spyOn(internalService, 'initializeLocalNode').mockRejectedValue(new Error('init failed'))

    const started = await meshService.startMesh()

    expect(started).to.equal(false)
    expect(failed).toHaveBeenCalledTimes(1)
    expect(meshService.isMeshActive()).to.equal(false)
  })

  it('stops mesh and clears intervals, nodes, and websocket connections', async () => {
    const close = vi.fn()
    class FakeWebSocket {
      close(): void {
        close()
      }
    }
    vi.stubGlobal('WebSocket', FakeWebSocket)

    const wsLike = new FakeWebSocket()

    internalService.discoveredNodes.set('node-a', { id: 'node-a' })
    internalService.connections.set('node-a', wsLike)
    internalService.meshActive = true

    await meshService.stopMesh()

    expect(meshService.isMeshActive()).to.equal(false)
    expect(internalService.discoveredNodes.size).to.equal(0)
    expect(internalService.connections.size).to.equal(0)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('skips station processing for self node and unreachable nodes', async () => {
    const processStation = vi.spyOn(internalService as unknown as {
      processDiscoveredStation: (station: Record<string, unknown>) => Promise<void>
    }, 'processDiscoveredStation')

    vi.spyOn(internalService as unknown as {
      testStationConnection: (node: Record<string, unknown>) => Promise<boolean>
    }, 'testStationConnection').mockResolvedValue(false)

    await (internalService as unknown as {
      processDiscoveredStation: (station: {
        id: string;
        call_sign: string;
        ip_address: string;
        port: number;
      }) => Promise<void>
    }).processDiscoveredStation({
      id: 'MESH-TEST-1',
      call_sign: 'SELF',
      ip_address: '192.168.1.1',
      port: 3030
    })

    expect(internalService.discoveredNodes.size).to.equal(0)

    await (internalService as unknown as {
      processDiscoveredStation: (station: {
        id: string;
        call_sign: string;
        ip_address: string;
        port: number;
      }) => Promise<void>
    }).processDiscoveredStation({
      id: 'NODE-2',
      call_sign: 'N2',
      ip_address: '192.168.1.2',
      port: 3030
    })

    expect(internalService.discoveredNodes.size).to.equal(0)
  })

  it('removes stale nodes on timeout checks', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    internalService.discoveredNodes.set('stale', {
      id: 'stale',
      callsign: 'S',
      designator: '1A',
      ip: '192.168.1.5',
      port: 3030,
      qsoCount: 0,
      score: 0,
      online: true,
      lastSeen: 900_000,
      version: '1.0.0',
      capabilities: []
    })

    ;(internalService as unknown as { checkNodeTimeouts: () => void }).checkNodeTimeouts()

    expect(internalService.discoveredNodes.has('stale')).to.equal(false)
    nowSpy.mockRestore()
  })

  it('syncs new remote QSOs and emits sync completion details', async () => {
    const syncEvent = vi.fn()
    meshService.on('mesh:sync-completed', syncEvent)

    vi.mocked(logQsoMock).mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        qsos: [
          {
            id: 'remote-1',
            call: 'W1AW',
            class: '1A',
            section: 'CT',
            datetime: '2024-06-14T12:00:00.000Z',
            band: '20m',
            mode: 'CW',
            operator: 'K8TAR',
            timestamp: 1718366400000
          }
        ]
      })
    })))

    await (internalService as unknown as {
      syncWithNode: (node: {
        id: string;
        callsign: string;
        ip: string;
        port: number;
        protocol: 'http';
      }) => Promise<void>
    }).syncWithNode({
      id: 'node-1',
      callsign: 'N1',
      ip: '192.168.1.20',
      port: 3030,
      protocol: 'http'
    })

    expect(logQsoMock).toHaveBeenCalledTimes(1)
    expect(syncEvent).toHaveBeenCalled()
  })

  it('handles non-ok backend response for station discovery', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({})
    })))

    const stations = await (internalService as unknown as {
      getBackendDiscoveredStations: () => Promise<Array<Record<string, unknown>>>
    }).getBackendDiscoveredStations()

    expect(stations).to.deep.equal([])
  })
})