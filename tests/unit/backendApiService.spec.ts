import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/debug', () => ({
  debugLog: vi.fn()
}))

interface MockResponse {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
  text: () => Promise<string>
}

interface MockEvent {
  type: string
}

interface MockWindow {
  dispatchEvent: (event: MockEvent) => boolean
}

interface BackendApiLike {
  connected: { value: boolean }
  error: { value: string | null }
  refreshConnectionStatus: () => Promise<void>
  getStationInfo: () => Promise<unknown | null>
  updateStationConfig: (callSign: string, name: string, section: string, stationClass: string) => Promise<boolean>
  triggerLogReset: () => Promise<{ success: boolean; reset_timestamp?: string; error?: string }>
  getLastLogResetTime: () => Promise<string | null>
  setRetries: (retries: number) => void
}

function makeJsonResponse(payload: unknown, ok = true): MockResponse {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  }
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('BackendApiService', () => {
  const fetchMock = vi.fn<(...args: unknown[]) => Promise<MockResponse>>()
  const dispatchedEvents: string[] = []

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    dispatchedEvents.length = 0
    fetchMock.mockReset()

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('CustomEvent', class {
      type: string

      constructor(type: string) {
        this.type = type
      }
    })

    const windowMock: MockWindow = {
      dispatchEvent: (event: MockEvent) => {
        dispatchedEvents.push(event.type)
        return true
      }
    }

    vi.stubGlobal('window', windowMock)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('marks the backend connected and emits backendConnected on successful startup check', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse({ success: true }))

    const { backendApi } = await import('@/services/backendApiService')
    await flushAsyncWork()

    expect(backendApi.connected.value).to.equal(true)
    expect(backendApi.error.value).to.equal(null)
    expect(dispatchedEvents).to.include('backendConnected')
  })

  it('emits backendDisconnected when a connected backend stops responding', async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonResponse({ success: true }))
      .mockRejectedValueOnce(new Error('connection lost'))

    const { backendApi } = await import('@/services/backendApiService')
    await flushAsyncWork()

    await backendApi.refreshConnectionStatus()

    expect(backendApi.connected.value).to.equal(false)
    expect(backendApi.error.value).to.equal('connection lost')
    expect(dispatchedEvents).to.include('backendDisconnected')
  })

  it('retries failed requests and returns null for station info when all retries fail', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ success: true }))

    const module = await import('@/services/backendApiService')
    const backendApi: BackendApiLike = module.backendApi
    await flushAsyncWork()

    fetchMock.mockClear()
    backendApi.setRetries(2)
    fetchMock
      .mockRejectedValueOnce(new Error('request failed'))
      .mockRejectedValueOnce(new Error('request failed'))
      .mockResolvedValueOnce(makeJsonResponse({ success: false }, false))

    const stationInfoPromise = backendApi.getStationInfo()
    await vi.advanceTimersByTimeAsync(500)
    const stationInfo = await stationInfoPromise

    expect(stationInfo).to.equal(null)
    expect(backendApi.error.value).to.equal(null)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('maps station config payload fields to backend naming', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse({ success: true }))

    const { backendApi } = await import('@/services/backendApiService')
    await flushAsyncWork()

    fetchMock.mockClear()
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ success: true }))

    const saved = await backendApi.updateStationConfig('K8TAR', 'Field Day HQ', 'CT', '2A')

    expect(saved).to.equal(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).to.equal('http://localhost:3030/api/station')
    expect(options.method).to.equal('PUT')
    expect(options.body).to.equal(
      JSON.stringify({
        call_sign: 'K8TAR',
        name: 'Field Day HQ',
        section: 'CT',
        class: '2A'
      })
    )
  })

  it('normalizes triggerLogReset responses for success and failure', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse({ success: true }))

    const { backendApi } = await import('@/services/backendApiService')
    await flushAsyncWork()

    fetchMock.mockClear()
    fetchMock
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: true,
          data: { reset_timestamp: '2026-06-14T09:00:00.000Z' }
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          success: false,
          error: 'reset failed'
        })
      )

    const successResult = await backendApi.triggerLogReset()
    const failureResult = await backendApi.triggerLogReset()

    expect(successResult).to.deep.equal({
      success: true,
      reset_timestamp: '2026-06-14T09:00:00.000Z'
    })
    expect(failureResult).to.deep.equal({
      success: false,
      error: 'reset failed'
    })
  })

  it('converts reset status timestamps to ISO strings', async () => {
    fetchMock.mockResolvedValue(makeJsonResponse({ success: true }))

    const { backendApi } = await import('@/services/backendApiService')
    await flushAsyncWork()

    fetchMock.mockClear()
    fetchMock.mockResolvedValueOnce(
      makeJsonResponse({
        success: true,
        data: { timestamp: 1718355600000 }
      })
    )

    const lastResetTime = await backendApi.getLastLogResetTime()

    expect(lastResetTime).to.equal('2024-06-14T09:00:00.000Z')
  })
})