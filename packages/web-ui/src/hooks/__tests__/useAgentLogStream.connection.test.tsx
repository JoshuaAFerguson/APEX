/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAgentLogStream } from '../useAgentLogStream'
import { wsClient } from '@/lib/websocket-client'
import type { ApexEvent } from '@/lib/websocket-client'
import type { UseAgentLogStreamOptions, AgentLogEntry } from '@/types/agent-log-stream'

// Mock the WebSocket client with proper connection handling
vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => false),
    getHealthState: vi.fn(() => ({
      isHealthy: false,
      consecutiveFailures: 0,
    })),
    reconnector: {
      getStats: vi.fn(() => ({
        state: 'disconnected',
        reconnectCount: 0,
      })),
    },
  },
}))

// Mock crypto.randomUUID
const mockUUID = vi.fn(() => 'connection-test-uuid')
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: mockUUID },
  writable: true,
})

// Mock window for global sequence counter
Object.defineProperty(global, 'window', {
  value: {
    __agentLogSequenceCounter: 0,
  },
  writable: true,
})

describe('useAgentLogStream - WebSocket Connection Handling', () => {
  const mockOptions: UseAgentLogStreamOptions = {
    agentId: 'connection-test-agent',
    autoConnect: false, // Manual connection control for testing
    maxLogs: 100,
  }

  let mockEventHandlers: Map<string, Function[]> = new Map()
  let isConnected = false

  beforeEach(() => {
    vi.clearAllMocks()
    mockEventHandlers.clear()
    isConnected = false
    mockUUID.mockReturnValue('connection-test-uuid')

    // Reset window sequence counter
    if (typeof window !== 'undefined') {
      window.__agentLogSequenceCounter = 0
    }

    // Mock wsClient event subscription
    ;(wsClient.on as Mock).mockImplementation((eventType: string, handler: Function) => {
      if (!mockEventHandlers.has(eventType)) {
        mockEventHandlers.set(eventType, [])
      }
      mockEventHandlers.get(eventType)!.push(handler)
      return handler
    })

    ;(wsClient.off as Mock).mockImplementation((eventType: string, handler: Function) => {
      const handlers = mockEventHandlers.get(eventType)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    })

    // Mock connection state
    ;(wsClient.isConnected as Mock).mockImplementation(() => isConnected)
    ;(wsClient.connect as Mock).mockImplementation(() => {
      isConnected = true
    })
    ;(wsClient.disconnect as Mock).mockImplementation(() => {
      isConnected = false
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('handles initial disconnected state', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    expect(result.current.streamState.state).toBe('idle')
    expect(result.current.streamState.connectionStatus).toBe('disconnected')
    expect(result.current.isConnecting).toBe(false)
    expect(result.current.isStreaming).toBe(false)
  })

  it('connects when connect() is called', async () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    act(() => {
      result.current.connect()
    })

    expect(wsClient.connect).toHaveBeenCalled()
    expect(result.current.streamState.state).toBe('connecting')
  })

  it('handles connection state changes correctly', async () => {
    const onConnectionChange = vi.fn()

    const { result, rerender } = renderHook(() =>
      useAgentLogStream({ ...mockOptions, onConnectionChange })
    )

    // Start connecting
    act(() => {
      result.current.connect()
    })

    expect(result.current.streamState.state).toBe('connecting')

    // Simulate connection success
    act(() => {
      isConnected = true
      // Simulate connection status update
      ;(wsClient.getHealthState as Mock).mockReturnValue({
        isHealthy: true,
        consecutiveFailures: 0,
      })
    })

    // Wait for connection status update
    await waitFor(() => {
      expect(onConnectionChange).toHaveBeenCalled()
    }, { timeout: 2000 })
  })

  it('handles disconnection gracefully', async () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    // Start connected
    act(() => {
      isConnected = true
      result.current.connect()
    })

    // Disconnect
    act(() => {
      result.current.disconnect()
    })

    expect(result.current.streamState.state).toBe('disconnected')
  })

  it('processes agent events when connected', async () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    // Simulate connection
    act(() => {
      isConnected = true
      result.current.connect()
    })

    // Create a test event
    const testEvent: ApexEvent = {
      type: 'agent:log',
      timestamp: new Date(),
      taskId: 'connection-test-agent',
      data: {
        agentId: 'connection-test-agent',
        message: 'Test connection message',
      },
    }

    // Simulate event received
    act(() => {
      const handlers = mockEventHandlers.get('agent:log') || []
      handlers.forEach(handler => handler(testEvent))
    })

    expect(result.current.logs).toHaveLength(1)
    expect(result.current.logs[0].message).toBe('Test connection message')
  })

  it('ignores events from other agents', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    const otherAgentEvent: ApexEvent = {
      type: 'agent:log',
      timestamp: new Date(),
      taskId: 'other-agent',
      data: {
        agentId: 'other-agent',
        message: 'Message from other agent',
      },
    }

    act(() => {
      const handlers = mockEventHandlers.get('agent:log') || []
      handlers.forEach(handler => handler(otherAgentEvent))
    })

    expect(result.current.logs).toHaveLength(0)
  })

  it('handles connection errors', () => {
    const onError = vi.fn()
    const { result } = renderHook(() =>
      useAgentLogStream({ ...mockOptions, onError })
    )

    // Simulate connection error
    act(() => {
      ;(wsClient.getHealthState as Mock).mockReturnValue({
        isHealthy: false,
        consecutiveFailures: 3,
      })
    })

    // The hook should handle this gracefully without crashing
    expect(result.current.streamState.connectionStatus).toBeDefined()
  })

  it('handles reconnection scenarios', async () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    // Initial connection
    act(() => {
      isConnected = true
      result.current.connect()
    })

    // Simulate disconnect
    act(() => {
      isConnected = false
      ;(wsClient.getHealthState as Mock).mockReturnValue({
        isHealthy: false,
        consecutiveFailures: 1,
      })
    })

    // Try to reconnect
    act(() => {
      result.current.connect()
    })

    expect(wsClient.connect).toHaveBeenCalledTimes(2)
  })

  it('properly unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useAgentLogStream(mockOptions))

    // Verify subscriptions were made
    expect(wsClient.on).toHaveBeenCalledWith('agent:log', expect.any(Function))

    // Unmount and verify cleanup
    unmount()

    expect(wsClient.off).toHaveBeenCalledWith('agent:log', expect.any(Function))
  })

  it('handles pause/resume during connection states', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    act(() => {
      result.current.connect()
    })

    // Pause while connecting
    act(() => {
      result.current.pause()
    })

    expect(result.current.streamState.state).toBe('paused')
    expect(result.current.isPaused).toBe(true)

    // Resume
    act(() => {
      result.current.resume()
    })

    expect(result.current.streamState.state).toBe('streaming')
    expect(result.current.isPaused).toBe(false)
  })

  it('respects autoConnect option', () => {
    // Test with autoConnect enabled
    const autoConnectOptions = { ...mockOptions, autoConnect: true }
    renderHook(() => useAgentLogStream(autoConnectOptions))

    expect(wsClient.connect).toHaveBeenCalled()

    vi.clearAllMocks()

    // Test with autoConnect disabled (default for these tests)
    renderHook(() => useAgentLogStream(mockOptions))

    expect(wsClient.connect).not.toHaveBeenCalled()
  })
})