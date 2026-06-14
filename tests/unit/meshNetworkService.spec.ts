import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/fileStorage', () => ({
  fileStorage: {
    getNetworkId: vi.fn().mockResolvedValue('MESH-TEST-1'),
    getQsoData: vi.fn().mockResolvedValue([])
  }
}))

vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn()
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
})