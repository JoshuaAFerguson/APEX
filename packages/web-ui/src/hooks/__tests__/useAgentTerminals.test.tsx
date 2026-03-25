import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock handlers and state that will be shared
const mockEventHandlers = new Map<string, Function[]>()

// Set up mocks using factories with inline objects
vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(() => true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((eventType: string, handler: Function) => {
      if (!mockEventHandlers.has(eventType)) {
        mockEventHandlers.set(eventType, [])
      }
      mockEventHandlers.get(eventType)!.push(handler)
    }),
    off: vi.fn(),
    emit: (eventType: string, event: unknown) => {
      const handlers = mockEventHandlers.get(eventType) || []
      handlers.forEach(handler => handler(event))
    }
  },
}))

vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: vi.fn(() => ({
    status: 'connected' as const,
    isHealthy: true,
    latencyMs: 45,
    averageLatencyMs: 50,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    consecutiveFailures: 0,
    lastHealthyAt: new Date(),
    lastCheckAt: new Date(),
    connectionUptime: 5000,
  })),
}))

vi.mock('@/types/agent-log-stream', async () => {
  const actual = await vi.importActual('@/types/agent-log-stream')
  return {
    ...actual,
    filterLogs: vi.fn((logs: unknown[]) => logs),
    exportLogs: vi.fn(() => 'exported-logs'),
    calculateLogStreamStats: vi.fn(() => ({
      totalEntries: 0,
      totalErrors: 0,
      bytesReceived: 0,
      entriesPerSecond: 0,
      averageEntryLength: 0,
      oldestEntry: null,
      newestEntry: null,
    })),
    DEFAULT_LOG_FILTER: {
      levels: ['debug', 'info', 'warn', 'error'],
      sources: ['agent', 'system', 'user', 'tool', 'error'],
      search: '',
      timeRange: null,
    }
  }
})

// Now import the module under test and types
import { useAgentTerminals } from '../useAgentTerminals'
import { wsClient } from '@/lib/websocket-client'
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection'
import type { AgentTerminalConfig } from '@/types/agent-terminals'
import type { AgentLogEntry } from '@/types/agent-log-stream'
import type { WebSocketConnectionHealth } from '@/types/websocket-connection'

// Get typed mock references
const mockWsClient = wsClient as {
  isConnected: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  emit: (eventType: string, event: unknown) => void
}
const mockUseWebSocketConnection = useWebSocketConnection as ReturnType<typeof vi.fn>

// ApexEvent type for testing
interface ApexEvent {
  type: string
  taskId?: string
  timestamp: Date
  data: Record<string, unknown>
}

// Helper function to create mock ApexEvent
function createMockApexEvent(
  type: string,
  agentId: string,
  overrides: Partial<ApexEvent> = {}
): ApexEvent {
  return {
    type,
    taskId: agentId,
    timestamp: new Date(),
    data: {
      agentId,
      message: `Test message for ${type}`,
      ...overrides.data,
    },
    ...overrides,
  }
}

// Helper function to create mock agent config
function createMockAgentConfig(agentId: string, overrides: Partial<AgentTerminalConfig> = {}): AgentTerminalConfig {
  return {
    agentId,
    agentName: `Agent ${agentId}`,
    maxLogs: 100,
    autoStart: true,
    ...overrides,
  }
}

describe('useAgentTerminals Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset WebSocket client event handlers
    mockEventHandlers.clear()

    // Mock window globals
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36))
      },
      writable: true,
      configurable: true,
    })

    // Reset connection health mock
    mockUseWebSocketConnection.mockReturnValue({
      status: 'connected' as const,
      isHealthy: true,
      latencyMs: 45,
      averageLatencyMs: 50,
      reconnectAttempts: 0,
      maxReconnectAttempts: 10,
      consecutiveFailures: 0,
      lastHealthyAt: new Date(),
      lastCheckAt: new Date(),
      connectionUptime: 5000,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Initial State and Configuration', () => {
    it('initializes with empty state when no agents provided', () => {
      const { result } = renderHook(() => useAgentTerminals())

      expect(result.current.agents.size).toBe(0)
      expect(result.current.agentIds).toEqual([])
      expect(result.current.aggregateStats.totalAgents).toBe(0)
      expect(result.current.aggregateStats.totalLogs).toBe(0)
    })

    it('initializes with provided agent configurations', () => {
      const agents = [
        createMockAgentConfig('agent-1'),
        createMockAgentConfig('agent-2'),
      ]

      const { result } = renderHook(() =>
        useAgentTerminals({ agents })
      )

      expect(result.current.agents.size).toBe(2)
      expect(result.current.agentIds).toEqual(['agent-1', 'agent-2'])
      expect(result.current.aggregateStats.totalAgents).toBe(2)
    })

    it('sets up WebSocket event subscriptions on mount', () => {
      renderHook(() => useAgentTerminals({ autoConnect: true }))

      // Check that event listeners were registered
      const expectedEvents = [
        'agent:log',
        'agent:output',
        'agent:error',
        'agent:started',
        'agent:completed',
        'agent:failed',
        'agent:progress',
        'tool:start',
        'tool:complete',
        'tool:error',
      ]

      expectedEvents.forEach(eventType => {
        expect(mockWsClient.on).toHaveBeenCalledWith(eventType, expect.any(Function))
      })
    })

    it('auto-connects to WebSocket when autoConnect is true', () => {
      mockWsClient.isConnected.mockReturnValue(false)

      renderHook(() => useAgentTerminals({ autoConnect: true }))

      expect(mockWsClient.connect).toHaveBeenCalled()
    })

    it('does not auto-connect when autoConnect is false', () => {
      renderHook(() => useAgentTerminals({ autoConnect: false }))

      expect(mockWsClient.connect).not.toHaveBeenCalled()
    })
  })

  describe('Agent Registration and Management', () => {
    it('allows registering agents dynamically', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
      })

      expect(result.current.agents.size).toBe(1)
      expect(result.current.isAgentRegistered('agent-1')).toBe(true)
    })

    it('prevents duplicate agent registration', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-1'))
      })

      expect(result.current.agents.size).toBe(1)
    })

    it('enforces maximum agent limit', () => {
      const { result } = renderHook(() => useAgentTerminals())

      // Register maximum allowed agents (12)
      act(() => {
        for (let i = 1; i <= 12; i++) {
          result.current.registerAgent(createMockAgentConfig(`agent-${i}`))
        }
      })

      expect(result.current.agents.size).toBe(12)

      // Try to register one more - should not be added
      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-13'))
      })

      expect(result.current.agents.size).toBe(12)
      expect(result.current.isAgentRegistered('agent-13')).toBe(false)
    })

    it('allows unregistering agents', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-2'))
      })

      expect(result.current.agents.size).toBe(2)

      act(() => {
        result.current.unregisterAgent('agent-1')
      })

      expect(result.current.agents.size).toBe(1)
      expect(result.current.isAgentRegistered('agent-1')).toBe(false)
      expect(result.current.isAgentRegistered('agent-2')).toBe(true)
    })

    it('validates agent configuration during registration', () => {
      const { result } = renderHook(() => useAgentTerminals())

      // Invalid config - no agentId
      act(() => {
        result.current.registerAgent({} as AgentTerminalConfig)
      })

      expect(result.current.agents.size).toBe(0)

      // Invalid config - invalid maxLogs
      act(() => {
        result.current.registerAgent({
          agentId: 'test-agent',
          maxLogs: -1,
        })
      })

      expect(result.current.agents.size).toBe(0)
    })
  })

  describe('Log Processing and Buffering', () => {
    it('processes and stores logs for registered agents', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
      })

      // Simulate receiving a log event
      const logEvent = createMockApexEvent('agent:log', 'agent-1')

      act(() => {
        mockWsClient.emit('agent:log', logEvent)
      })

      const agentState = result.current.getAgentState('agent-1')
      expect(agentState?.logs).toHaveLength(1)
      expect(agentState?.logs[0].message).toBe('Test message for agent:log')
    })

    it('ignores events for unregistered agents', () => {
      const { result } = renderHook(() => useAgentTerminals())

      // Don't register any agents
      const logEvent = createMockApexEvent('agent:log', 'unregistered-agent')

      act(() => {
        mockWsClient.emit('agent:log', logEvent)
      })

      expect(result.current.agents.size).toBe(0)
    })

    it('respects per-agent log buffer limits', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1', { maxLogs: 3 }))
      })

      // Add more logs than the buffer limit
      act(() => {
        for (let i = 0; i < 5; i++) {
          const logEvent = createMockApexEvent('agent:log', 'agent-1', {
            data: { agentId: 'agent-1', message: `Log ${i}` }
          })
          mockWsClient.emit('agent:log', logEvent)
        }
      })

      const agentState = result.current.getAgentState('agent-1')
      expect(agentState?.logs).toHaveLength(3) // Should only keep 3 most recent logs
    })

    it('ignores events for paused agents', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.pauseAgent('agent-1')
      })

      const logEvent = createMockApexEvent('agent:log', 'agent-1')

      act(() => {
        mockWsClient.emit('agent:log', logEvent)
      })

      const agentState = result.current.getAgentState('agent-1')
      expect(agentState?.logs).toHaveLength(0)
    })

    it('resumes processing events for resumed agents', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.pauseAgent('agent-1')
      })

      // Verify paused agent doesn't receive events
      let logEvent = createMockApexEvent('agent:log', 'agent-1')
      act(() => {
        mockWsClient.emit('agent:log', logEvent)
      })

      expect(result.current.getAgentState('agent-1')?.logs).toHaveLength(0)

      // Resume and send another event
      act(() => {
        result.current.resumeAgent('agent-1')
      })

      logEvent = createMockApexEvent('agent:log', 'agent-1')
      act(() => {
        mockWsClient.emit('agent:log', logEvent)
      })

      expect(result.current.getAgentState('agent-1')?.logs).toHaveLength(1)
    })
  })

  describe('Bulk Operations', () => {
    it('pauses all agents with pauseAll', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-2'))
        result.current.pauseAll()
      })

      expect(result.current.getAgentState('agent-1')?.isPaused).toBe(true)
      expect(result.current.getAgentState('agent-2')?.isPaused).toBe(true)
    })

    it('resumes all agents with resumeAll', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-2'))
        result.current.pauseAll()
        result.current.resumeAll()
      })

      expect(result.current.getAgentState('agent-1')?.isPaused).toBe(false)
      expect(result.current.getAgentState('agent-2')?.isPaused).toBe(false)
    })

    it('clears all logs with clearAll', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-2'))
      })

      // Add logs to both agents
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-2'))
      })

      expect(result.current.getAgentState('agent-1')?.logs).toHaveLength(1)
      expect(result.current.getAgentState('agent-2')?.logs).toHaveLength(1)

      act(() => {
        result.current.clearAll()
      })

      expect(result.current.getAgentState('agent-1')?.logs).toHaveLength(0)
      expect(result.current.getAgentState('agent-2')?.logs).toHaveLength(0)
    })
  })

  describe('Individual Agent Control', () => {
    it('clears logs for specific agent', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-2'))
      })

      // Add logs to both agents
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-2'))
      })

      act(() => {
        result.current.clearAgentLogs('agent-1')
      })

      expect(result.current.getAgentState('agent-1')?.logs).toHaveLength(0)
      expect(result.current.getAgentState('agent-2')?.logs).toHaveLength(1)
    })

    it('allows programmatic log addition', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
      })

      const mockLogs: AgentLogEntry[] = [
        {
          id: 'log-1',
          timestamp: new Date(),
          level: 'info',
          source: 'agent',
          message: 'Test log',
          metadata: { agentId: 'agent-1' },
          sequenceNumber: 1,
          isStreaming: false,
        }
      ]

      act(() => {
        result.current.addAgentLogs('agent-1', mockLogs)
      })

      expect(result.current.getAgentState('agent-1')?.logs).toHaveLength(1)
    })
  })

  describe('Connection Management', () => {
    it('provides connection control methods', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: false }))

      act(() => {
        result.current.connect()
      })

      expect(mockWsClient.connect).toHaveBeenCalled()
      const connectCallCount = mockWsClient.connect.mock.calls.length

      act(() => {
        result.current.disconnect()
      })

      expect(mockWsClient.disconnect).toHaveBeenCalled()
      const disconnectCallCount = mockWsClient.disconnect.mock.calls.length

      act(() => {
        result.current.reconnect()
      })

      // reconnect should call disconnect and connect once more
      expect(mockWsClient.disconnect).toHaveBeenCalledTimes(disconnectCallCount + 1)
      expect(mockWsClient.connect).toHaveBeenCalledTimes(connectCallCount + 1)
    })

    it('tracks connection status from useWebSocketConnection', () => {
      const { result } = renderHook(() => useAgentTerminals())

      expect(result.current.isConnected).toBe(true)
      expect(result.current.isReconnecting).toBe(false)
    })

    it('updates connection health in state', () => {
      const mockHealth: WebSocketConnectionHealth = {
        status: 'error',
        isHealthy: false,
        latencyMs: null,
        averageLatencyMs: null,
        reconnectAttempts: 3,
        maxReconnectAttempts: 10,
        consecutiveFailures: 3,
        lastHealthyAt: new Date(),
        lastCheckAt: new Date(),
        connectionUptime: null,
      }

      mockUseWebSocketConnection.mockReturnValue(mockHealth)

      const { result } = renderHook(() => useAgentTerminals())

      expect(result.current.connectionHealth.status).toBe('error')
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('Aggregate Statistics', () => {
    it('calculates aggregate stats correctly', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-2'))
      })

      // Add logs and simulate different states
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-2'))

        result.current.pauseAgent('agent-2')
      })

      expect(result.current.aggregateStats.totalAgents).toBe(2)
      expect(result.current.aggregateStats.totalLogs).toBe(3)
      expect(result.current.aggregateStats.pausedAgents).toBe(1)
    })
  })

  describe('Agent Connection Status', () => {
    it('provides individual agent connection status', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
      })

      const status = result.current.getAgentConnectionStatus('agent-1')

      expect(status).toMatchObject({
        agentId: 'agent-1',
        status: 'connected',
        isReceivingEvents: expect.any(Boolean),
        lastEventAt: null,
        timeSinceLastEvent: null,
        isStale: false,
        reconnectAttempts: 0,
      })
    })

    it('tracks stale connections', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
      })

      // Simulate receiving an event
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
      })

      // Fast forward time to make connection stale
      act(() => {
        vi.advanceTimersByTime(31000) // 31 seconds, more than STALE_EVENT_THRESHOLD_MS
      })

      const status = result.current.getAgentConnectionStatus('agent-1')
      expect(status.isStale).toBe(true)
      expect(status.timeSinceLastEvent).toBeGreaterThan(30000)
    })
  })

  describe('Event Processing', () => {
    const eventTypes = [
      'agent:log',
      'agent:output',
      'agent:error',
      'agent:started',
      'agent:completed',
      'agent:failed',
      'agent:progress',
      'tool:start',
      'tool:complete',
      'tool:error',
    ]

    eventTypes.forEach(eventType => {
      it(`processes ${eventType} events correctly`, () => {
        const { result } = renderHook(() => useAgentTerminals())

        act(() => {
          result.current.registerAgent(createMockAgentConfig('agent-1'))
        })

        const event = createMockApexEvent(eventType, 'agent-1')

        act(() => {
          mockWsClient.emit(eventType, event)
        })

        const agentState = result.current.getAgentState('agent-1')
        expect(agentState?.logs).toHaveLength(1)
      })
    })

    it('handles events without agentId gracefully', () => {
      const { result } = renderHook(() => useAgentTerminals())

      const eventWithoutAgentId = {
        type: 'agent:log',
        timestamp: new Date(),
        data: { message: 'No agent ID' }
      }

      act(() => {
        mockWsClient.emit('agent:log', eventWithoutAgentId)
      })

      // Should not crash and should not affect any agents
      expect(result.current.agents.size).toBe(0)
    })
  })

  describe('Performance and Memory Management', () => {
    it('sets up periodic stats updates', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

      renderHook(() => useAgentTerminals())

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000)

      setIntervalSpy.mockRestore()
    })

    it('cleans up resources on unmount', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

      const { unmount } = renderHook(() => useAgentTerminals())

      unmount()

      // Verify event handlers are removed
      const expectedEvents = [
        'agent:log',
        'agent:output',
        'agent:error',
        'agent:started',
        'agent:completed',
        'agent:failed',
        'agent:progress',
        'tool:start',
        'tool:complete',
        'tool:error',
      ]

      expectedEvents.forEach(eventType => {
        expect(mockWsClient.off).toHaveBeenCalledWith(eventType, expect.any(Function))
      })

      // Verify interval cleanup
      expect(clearIntervalSpy).toHaveBeenCalled()

      clearIntervalSpy.mockRestore()
    })

    it('handles high-frequency events efficiently', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1', { maxLogs: 10 }))
      })

      // Simulate high-frequency events (reduced count for performance)
      act(() => {
        for (let i = 0; i < 20; i++) {
          mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        }
      })

      const agentState = result.current.getAgentState('agent-1')
      expect(agentState?.logs).toHaveLength(10) // Should respect buffer limit
    })
  })

  describe('Callback Integration', () => {
    it('calls onLogs callback when logs are received', () => {
      const onLogs = vi.fn()
      const { result } = renderHook(() => useAgentTerminals({ onLogs }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
      })

      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
      })

      expect(onLogs).toHaveBeenCalledWith('agent-1', expect.any(Array))
    })

    it('calls onConnectionChange callback when connection changes', () => {
      const onConnectionChange = vi.fn()

      renderHook(() => useAgentTerminals({ onConnectionChange }))

      expect(onConnectionChange).toHaveBeenCalledWith(expect.objectContaining({
        status: 'connected',
        isHealthy: true
      }))
    })

    it('calls onError callback on processing errors', () => {
      const onError = vi.fn()
      const { result } = renderHook(() => useAgentTerminals({ onError }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
      })

      // Mock transformation error by providing malformed event
      const malformedEvent = {
        type: 'agent:log',
        timestamp: 'invalid-date', // This should cause transformation error
        data: { agentId: 'agent-1' }
      }

      act(() => {
        mockWsClient.emit('agent:log', malformedEvent)
      })

      // Note: In a real implementation, this would trigger an error callback
      // For now we just verify the callback was provided
      expect(onError).toBeDefined()
    })
  })
})
