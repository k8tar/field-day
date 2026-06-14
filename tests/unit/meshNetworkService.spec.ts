import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const logQsoMock = vi.fn().mockResolvedValue(undefined)
const fileStorageMock = {
  getNetworkId: vi.fn().mockResolvedValue('MESH-TEST-1'),
  getQsoData: vi.fn().mockResolvedValue([])
}

vi.mock('@/services/fileStorage', () => ({
  fileStorage: fileStorageMock
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
    fileStorageMock.getNetworkId.mockReset()
    fileStorageMock.getQsoData.mockReset()
    fileStorageMock.getNetworkId.mockResolvedValue('MESH-TEST-1')
    fileStorageMock.getQsoData.mockResolvedValue([])
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

  it('accepts backend discovery success payloads and rejects malformed payloads', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [{ id: 'node-1', call_sign: 'W1AW', ip_address: '192.168.1.40', port: 3030 }]
      })
    })))

    const okStations = await (internalService as unknown as {
      getBackendDiscoveredStations: () => Promise<Array<Record<string, string | number>>>
    }).getBackendDiscoveredStations()
    expect(okStations).to.have.length(1)

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: null })
    })))

    const malformed = await (internalService as unknown as {
      getBackendDiscoveredStations: () => Promise<Array<Record<string, string | number>>>
    }).getBackendDiscoveredStations()
    expect(malformed).to.deep.equal([])
  })

  it('processes reachable discovered station and emits node discovered', async () => {
    const discovered = vi.fn()
    meshService.on('node:discovered', discovered)

    vi.spyOn(internalService as unknown as {
      testStationConnection: (node: Record<string, string | number | boolean | string[]>) => Promise<boolean>
    }, 'testStationConnection').mockResolvedValue(true)

    vi.spyOn(internalService as unknown as {
      connectToNode: (node: Record<string, string | number | boolean | string[]>) => Promise<boolean>
    }, 'connectToNode').mockResolvedValue(true)

    await (internalService as unknown as {
      processDiscoveredStation: (station: {
        id: string;
        call_sign: string;
        ip_address: string;
        port: number;
      }) => Promise<void>
    }).processDiscoveredStation({
      id: 'NODE-OK',
      call_sign: 'W1AW',
      ip_address: '192.168.1.40',
      port: 3030
    })

    expect(internalService.discoveredNodes.has('NODE-OK')).to.equal(true)
    expect(discovered).toHaveBeenCalledTimes(1)
  })

  it('returns true immediately when connectToNode is called for existing connection', async () => {
    internalService.connections.set('node-1', 'http-api')

    const connected = await (internalService as unknown as {
      connectToNode: (node: { id: string; callsign: string; ip: string; port: number; protocol: 'http' }) => Promise<boolean>
    }).connectToNode({
      id: 'node-1',
      callsign: 'W1AW',
      ip: '192.168.1.10',
      port: 3030,
      protocol: 'http'
    })

    expect(connected).to.equal(true)
  })

  it('returns false when connectToNode receives a non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({})
    })))

    const connected = await (internalService as unknown as {
      connectToNode: (node: { id: string; callsign: string; ip: string; port: number; protocol: 'http' }) => Promise<boolean>
    }).connectToNode({
      id: 'node-2',
      callsign: 'N2',
      ip: '192.168.1.11',
      port: 3030,
      protocol: 'http'
    })

    expect(connected).to.equal(false)
  })

  it('validates private-ip and localhost helper predicates', () => {
    const isValidPrivateIP = (internalService as unknown as {
      isValidPrivateIP: (ip: string) => boolean
    }).isValidPrivateIP

    const isLocalhost = (internalService as unknown as {
      isLocalhost: (ip: string) => boolean
    }).isLocalhost

    expect(isValidPrivateIP('192.168.1.55')).to.equal(true)
    expect(isValidPrivateIP('192.168.56.1')).to.equal(false)
    expect(isValidPrivateIP('8.8.8.8')).to.equal(false)

    expect(isLocalhost('127.0.0.1')).to.equal(true)
    expect(isLocalhost('localhost')).to.equal(true)
    expect(isLocalhost('192.168.1.55')).to.equal(false)
  })

  it('falls back to generated node id when persistent id lookup fails', async () => {
    fileStorageMock.getNetworkId.mockRejectedValueOnce(new Error('id unavailable'))

    const service = internalService as unknown as {
      generateNodeId: () => Promise<void>
      status: { nodeId: string }
    }

    await service.generateNodeId()

    expect(service.status.nodeId.startsWith('MESH-node-')).to.equal(true)
  })

  it('runs discovery branches for no-local-node, empty backend list, and backend errors', async () => {
    const service = internalService as unknown as {
      localNode: Record<string, unknown> | null
      discoverPeers: () => Promise<void>
      updateMeshHealth: () => void
      getBackendDiscoveredStations: () => Promise<Array<Record<string, unknown>>>
      processDiscoveredStation: (station: Record<string, unknown>) => Promise<void>
    }

    const updateHealthSpy = vi.spyOn(service, 'updateMeshHealth')

    service.localNode = null
    await service.discoverPeers()
    expect(updateHealthSpy).not.toHaveBeenCalled()

    service.localNode = { id: 'local' }
    vi.spyOn(service, 'getBackendDiscoveredStations').mockResolvedValueOnce([])
    await service.discoverPeers()
    expect(updateHealthSpy).toHaveBeenCalled()

    const processSpy = vi.spyOn(service, 'processDiscoveredStation').mockResolvedValue(undefined)
    vi.spyOn(service, 'getBackendDiscoveredStations').mockResolvedValueOnce([{ id: 'n1' }])
    await service.discoverPeers()
    expect(processSpy).toHaveBeenCalledTimes(1)

    vi.spyOn(service, 'getBackendDiscoveredStations').mockRejectedValueOnce(new Error('discovery failed'))
    await service.discoverPeers()
    expect(updateHealthSpy).toHaveBeenCalled()
  })

  it('covers connection test success metadata update and abort timeout branches', async () => {
    const service = internalService as unknown as {
      testStationConnection: (node: { ip: string; port: number; callsign: string; designator: string }) => Promise<boolean>
    }

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          call_sign: 'W1AW',
          name: 'Station 1'
        }
      })
    })))

    const node = { ip: '192.168.1.50', port: 3030, callsign: 'OLD', designator: 'OLD' }
    const ok = await service.testStationConnection(node)
    expect(ok).to.equal(true)
    expect(node.callsign).to.equal('W1AW')
    expect(node.designator).to.equal('Station 1')

    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw abortError
    }))
    const timedOut = await service.testStationConnection(node)
    expect(timedOut).to.equal(false)
  })

  it('covers connectToNode exception path and performMeshSync early return', async () => {
    const failureEvent = vi.fn()
    meshService.on('mesh:connection-failed', failureEvent)

    const service = internalService as unknown as {
      connectToNode: (node: { id: string; callsign: string; ip: string; port: number; protocol: 'http' }) => Promise<boolean>
      performMeshSync: () => Promise<void>
      meshActive: boolean
      discoveredNodes: Map<string, unknown>
      status: { lastSync: number }
    }

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('connect failed')
    }))

    const connected = await service.connectToNode({
      id: 'node-error',
      callsign: 'NERR',
      ip: '192.168.1.60',
      port: 3030,
      protocol: 'http'
    })

    expect(connected).to.equal(false)
    expect(failureEvent).toHaveBeenCalledTimes(1)

    service.meshActive = false
    service.discoveredNodes.clear()
    const beforeSync = service.status.lastSync
    await service.performMeshSync()
    expect(service.status.lastSync).to.equal(beforeSync)
  })

  it('covers syncWithNode non-ok response and caught exception paths', async () => {
    const service = internalService as unknown as {
      syncWithNode: (node: { id: string; callsign: string; ip: string; port: number; protocol: 'http' }) => Promise<void>
    }

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({})
    })))

    await expect(service.syncWithNode({
      id: 'node-non-ok',
      callsign: 'NNOK',
      ip: '192.168.1.70',
      port: 3030,
      protocol: 'http'
    })).resolves.toBeUndefined()

    fileStorageMock.getQsoData.mockRejectedValueOnce(new Error('qso read failed'))
    await expect(service.syncWithNode({
      id: 'node-error',
      callsign: 'NERR',
      ip: '192.168.1.71',
      port: 3030,
      protocol: 'http'
    })).resolves.toBeUndefined()
  })

  it('starts peer discovery immediately and on interval ticks', async () => {
    vi.useFakeTimers()

    const service = internalService as unknown as {
      startPeerDiscovery: () => void
      discoverPeers: () => Promise<void>
    }

    const discoverSpy = vi.spyOn(service, 'discoverPeers').mockResolvedValue(undefined)

    service.startPeerDiscovery()
    expect(discoverSpy).toHaveBeenCalledTimes(1)

    vi.runOnlyPendingTimers()
    expect(discoverSpy).toHaveBeenCalledTimes(2)
  })

  it('runs heartbeat loop callbacks on interval', () => {
    vi.useFakeTimers()

    const service = internalService as unknown as {
      startHeartbeat: () => void
      sendHeartbeat: () => void
      checkNodeTimeouts: () => void
    }

    const heartbeatSpy = vi.spyOn(service, 'sendHeartbeat').mockImplementation(() => undefined)
    const timeoutSpy = vi.spyOn(service, 'checkNodeTimeouts').mockImplementation(() => undefined)

    service.startHeartbeat()
    vi.runOnlyPendingTimers()

    expect(heartbeatSpy).toHaveBeenCalledTimes(1)
    expect(timeoutSpy).toHaveBeenCalledTimes(1)
  })

  it('runs periodic sync loop on interval', async () => {
    vi.useFakeTimers()

    const service = internalService as unknown as {
      startPeriodicSync: () => void
      performMeshSync: () => Promise<void>
    }

    const syncSpy = vi.spyOn(service, 'performMeshSync').mockResolvedValue(undefined)

    service.startPeriodicSync()
    vi.runOnlyPendingTimers()

    expect(syncSpy).toHaveBeenCalledTimes(1)
  })

  it('returns false when station connection check receives non-ok response', async () => {
    const service = internalService as unknown as {
      testStationConnection: (node: { ip: string; port: number; callsign: string; designator: string }) => Promise<boolean>
    }

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => ({})
    })))

    const reachable = await service.testStationConnection({
      ip: '192.168.1.80',
      port: 3030,
      callsign: 'N80',
      designator: '1A'
    })

    expect(reachable).to.equal(false)
  })

  it('covers successful connectToNode branch and sync kickoff', async () => {
    const connectedEvent = vi.fn()
    meshService.on('mesh:node-connected', connectedEvent)

    const service = internalService as unknown as {
      connectToNode: (node: { id: string; callsign: string; ip: string; port: number; protocol: 'http' }) => Promise<boolean>
      syncWithNode: (node: { id: string; callsign: string; ip: string; port: number; protocol: 'http' }) => Promise<void>
      connections: Map<string, string>
      status: { connectedNodes: number }
    }

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    })))

    const syncSpy = vi.spyOn(service, 'syncWithNode').mockResolvedValue(undefined)

    const node = {
      id: 'node-success',
      callsign: 'NS',
      ip: '192.168.1.81',
      port: 3030,
      protocol: 'http' as const
    }

    const connected = await service.connectToNode(node)

    expect(connected).to.equal(true)
    expect(service.connections.get('node-success')).to.equal('http-api')
    expect(service.status.connectedNodes).to.equal(service.connections.size)
    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(connectedEvent).toHaveBeenCalledTimes(1)
  })

  it('returns browser hostname when it is a valid private address', async () => {
    const service = internalService as unknown as {
      getLocalIP: () => Promise<string>
    }

    vi.stubGlobal('window', {
      location: {
        hostname: '192.168.1.200'
      }
    })

    const ip = await service.getLocalIP()
    expect(ip).to.equal('192.168.1.200')
  })

  it('falls back when WebRTC setup throws during local IP detection', async () => {
    const service = internalService as unknown as {
      getLocalIP: () => Promise<string>
    }

    vi.stubGlobal('window', {
      location: {
        hostname: 'localhost'
      }
    })

    class ThrowingPeerConnection {
      constructor() {
        throw new Error('webrtc unavailable')
      }
    }

    vi.stubGlobal('RTCPeerConnection', ThrowingPeerConnection)

    const ip = await service.getLocalIP()
    expect(ip).to.equal('192.168.1.100')
  })
})