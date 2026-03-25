import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Create a more realistic WebSocket client mock for integration testing
class MockWebSocketClient {
  private _connected = false
  private _eventHandlers = new Map<string, Function[]>()
  private _pendingEvents: Array<{ type: string; event: any }> = []

  isConnected() {
    return this._connected
  }

  connect() {
    this._connected = true
    // Simulate connection delay
    setTimeout(() => {
      this._processPendingEvents()
    }, 10)
  }

  disconnect() {
    this._connected = false
  }

  on(eventType: string, handler: Function) {
    if (!this._eventHandlers.has(eventType)) {
      this._eventHandlers.set(eventType, [])
    }
    this._eventHandlers.get(eventType)!.push(handler)
  }

  off(eventType: string, handler: Function) {
    const handlers = this._eventHandlers.get(eventType)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  emit(eventType: string, event: any) {
    if (this._connected) {
      this._deliverEvent(eventType, event)
    } else {
      this._pendingEvents.push({ type: eventType, event })
    }
  }

  private _deliverEvent(eventType: string, event: any) {
    const handlers = this._eventHandlers.get(eventType) || []
    handlers.forEach(handler => {
      try {
        handler(event)
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error)
      }
    })
  }

  private _processPendingEvents() {
    if (this._connected) {
      const events = [...this._pendingEvents]
      this._pendingEvents = []
      events.forEach(({ type, event }) => {
        this._deliverEvent(type, event)
      })
    }
  }

  // Simulate network interruption
  simulateDisconnection() {
    this._connected = false
  }

  simulateReconnection() {
    this._connected = true
    this._processPendingEvents()
  }
}

// Initialize the mock client after the class definition
let mockWsClient: MockWebSocketClient

const mockUseWebSocketConnection = vi.fn(() => ({
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
}))

vi.mock('@/lib/websocket-client', () => {
  // Create mock client inside factory
  const MockWSClient = new (class {
    private _connected = false
    private _eventHandlers = new Map<string, Function[]>()
    private _pendingEvents: Array<{ type: string; event: any }> = []

    isConnected() {
      return this._connected
    }

    connect() {
      this._connected = true
      // Simulate connection delay
      setTimeout(() => {
        this._processPendingEvents()
      }, 10)
    }

    disconnect() {
      this._connected = false
    }

    on(eventType: string, handler: Function) {
      if (!this._eventHandlers.has(eventType)) {
        this._eventHandlers.set(eventType, [])
      }
      this._eventHandlers.get(eventType)!.push(handler)
    }

    off(eventType: string, handler: Function) {
      const handlers = this._eventHandlers.get(eventType)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }

    emit(eventType: string, event: any) {
      if (this._connected) {
        this._deliverEvent(eventType, event)
      } else {
        this._pendingEvents.push({ type: eventType, event })
      }
    }

    private _deliverEvent(eventType: string, event: any) {
      const handlers = this._eventHandlers.get(eventType) || []
      handlers.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error)
        }
      })
    }

    private _processPendingEvents() {
      if (this._connected) {
        const events = [...this._pendingEvents]
        this._pendingEvents = []
        events.forEach(({ type, event }) => {
          this._deliverEvent(type, event)
        })
      }
    }

    // Simulation methods
    simulateDisconnection() {
      this._connected = false
    }

    simulateReconnection() {
      this._connected = true
      this._processPendingEvents()
    }
  })()

  return {
    wsClient: MockWSClient,
  }
})

vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: mockUseWebSocketConnection,
}))

// Now import after mocks are set up
import { useAgentTerminals } from '../useAgentTerminals'
import { wsClient } from '@/lib/websocket-client'
import type { ApexEvent } from '@/lib/websocket-client'
import type {
  AgentTerminalConfig,
  UseAgentTerminalsOptions,
  AgentLogEntry,
} from '@/types/agent-terminals'

vi.mock('@/types/agent-log-stream', async () => {
  const actual = await vi.importActual('@/types/agent-log-stream')
  return {
    ...actual,
    filterLogs: vi.fn((logs, filter) => logs),
    exportLogs: vi.fn((logs, format) => 'exported-logs'),
    calculateLogStreamStats: vi.fn((logs, startTime) => ({
      totalEntries: logs.length,
      totalErrors: logs.filter((log: any) => log.level === 'error').length,
      bytesReceived: logs.length * 500,
      entriesPerSecond: logs.length / 60,
      averageEntryLength: 500,
      oldestEntry: logs[0]?.timestamp || null,
      newestEntry: logs[logs.length - 1]?.timestamp || null,
    })),
    DEFAULT_LOG_FILTER: {
      levels: ['debug', 'info', 'warn', 'error'],
      sources: ['agent', 'system', 'user', 'tool', 'error'],
      search: '',
      timeRange: null,
    }
  }
})

// Helper functions
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
      agentName: `Agent ${agentId}`,
      message: `${type} message from ${agentId}`,
      ...overrides.data,
    },
    ...overrides,
  }
}

function createMockAgentConfig(agentId: string, overrides: Partial<AgentTerminalConfig> = {}): AgentTerminalConfig {
  return {
    agentId,
    agentName: `Agent ${agentId}`,
    maxLogs: 100,
    autoStart: true,
    ...overrides,
  }
}

describe('useAgentTerminals Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Get reference to mocked client
    mockWsClient = wsClient as any

    // Reset mock WebSocket client
    mockWsClient.disconnect()
    if (mockWsClient['_eventHandlers']) {
      mockWsClient['_eventHandlers'].clear()
    }
    if (mockWsClient['_pendingEvents']) {
      mockWsClient['_pendingEvents'] = []
    }

    // Setup window globals
    Object.defineProperty(window, 'crypto', {
      value: {
        randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36))
      },
      writable: true,
    })

    Object.defineProperty(window, '__agentLogSequenceCounter', {
      value: 0,
      writable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Multi-Agent Coordination', () => {
    it('handles multiple agents receiving logs simultaneously', async () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4']

      // Register multiple agents
      act(() => {
        agents.forEach(agentId => {
          result.current.registerAgent(createMockAgentConfig(agentId))
        })
      })

      // Connect WebSocket
      act(() => {
        mockWsClient.connect()
      })

      // Simulate simultaneous log events from all agents
      act(() => {
        agents.forEach(agentId => {
          mockWsClient.emit('agent:log', createMockApexEvent('agent:log', agentId))
          mockWsClient.emit('agent:output', createMockApexEvent('agent:output', agentId))
          mockWsClient.emit('tool:start', createMockApexEvent('tool:start', agentId, {
            data: { agentId, toolName: 'test-tool' }
          }))
        })
      })

      // Verify each agent received their logs
      agents.forEach(agentId => {
        const agentState = result.current.getAgentState(agentId)
        expect(agentState?.logs).toHaveLength(3)
        expect(agentState?.logs.every(log => log.metadata.agentId === agentId)).toBe(true)
      })
    })

    it('handles log events during connection interruption', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
      })

      // Connect and send initial logs
      act(() => {
        mockWsClient.connect()
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
      })

      expect(result.current.getAgentState('agent-1')?.logs).toHaveLength(1)

      // Simulate disconnection
      act(() => {
        mockWsClient.simulateDisconnection()
        // These events should be queued
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        mockWsClient.emit('agent:output', createMockApexEvent('agent:output', 'agent-1'))
      })

      // Events during disconnection should not be processed immediately
      expect(result.current.getAgentState('agent-1')?.logs).toHaveLength(1)

      // Simulate reconnection
      act(() => {
        mockWsClient.simulateReconnection()
        vi.advanceTimersByTime(20) // Allow pending events to process
      })

      // Now pending events should be processed
      expect(result.current.getAgentState('agent-1')?.logs).toHaveLength(3)
    })

    it('maintains separate log buffers and filters per agent', () => {
      const { result } = renderHook(() => useAgentTerminals())

      // Register agents with different configurations
      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1', {
          maxLogs: 50,
          initialFilter: { levels: ['info', 'error'] }
        }))
        result.current.registerAgent(createMockAgentConfig('agent-2', {
          maxLogs: 100,
          initialFilter: { levels: ['debug', 'info', 'warn', 'error'] }
        }))
      })

      act(() => {
        mockWsClient.connect()
      })

      // Send different types of logs to each agent
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        mockWsClient.emit('agent:error', createMockApexEvent('agent:error', 'agent-1'))
        mockWsClient.emit('agent:output', createMockApexEvent('agent:output', 'agent-2'))
        mockWsClient.emit('tool:complete', createMockApexEvent('tool:complete', 'agent-2'))
      })

      const agent1State = result.current.getAgentState('agent-1')
      const agent2State = result.current.getAgentState('agent-2')

      expect(agent1State?.logs).toHaveLength(2)
      expect(agent2State?.logs).toHaveLength(2)

      // Verify each agent only has their own logs
      expect(agent1State?.logs.every(log => log.metadata.agentId === 'agent-1')).toBe(true)
      expect(agent2State?.logs.every(log => log.metadata.agentId === 'agent-2')).toBe(true)
    })
  })

  describe('Event Processing Workflows', () => {
    it('handles complete agent lifecycle events', () => {
      const onAgentStatusChange = vi.fn()
      const { result } = renderHook(() =>
        useAgentTerminals({
          autoConnect: true,
          onAgentStatusChange
        })
      )

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        mockWsClient.connect()
      })

      // Simulate complete agent workflow
      const workflowEvents = [
        createMockApexEvent('agent:started', 'agent-1'),
        createMockApexEvent('agent:progress', 'agent-1', {
          data: { agentId: 'agent-1', stage: 'analysis' }
        }),
        createMockApexEvent('tool:start', 'agent-1', {
          data: { agentId: 'agent-1', toolName: 'file-reader' }
        }),
        createMockApexEvent('tool:complete', 'agent-1', {
          data: { agentId: 'agent-1', toolName: 'file-reader', durationMs: 150 }
        }),
        createMockApexEvent('agent:output', 'agent-1', {
          data: { agentId: 'agent-1', message: 'Analysis complete' }
        }),
        createMockApexEvent('agent:completed', 'agent-1'),
      ]

      act(() => {
        workflowEvents.forEach(event => mockWsClient.emit(event.type, event))
      })

      const agentState = result.current.getAgentState('agent-1')
      expect(agentState?.logs).toHaveLength(6)

      // Verify different event types are processed correctly
      const logTypes = agentState?.logs.map(log => log.source)
      expect(logTypes).toContain('system') // agent:started
      expect(logTypes).toContain('agent')  // agent:progress, agent:output
      expect(logTypes).toContain('tool')   // tool:start, tool:complete
    })

    it('handles error scenarios during event processing', () => {
      const onError = vi.fn()
      const { result } = renderHook(() =>
        useAgentTerminals({
          autoConnect: true,
          onError
        })
      )

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        mockWsClient.connect()
      })

      // Send error events
      act(() => {
        mockWsClient.emit('agent:error', createMockApexEvent('agent:error', 'agent-1', {
          data: {
            agentId: 'agent-1',
            error: 'Test error message',
            errorCode: 'TEST_ERROR'
          }
        }))

        mockWsClient.emit('tool:error', createMockApexEvent('tool:error', 'agent-1', {
          data: {
            agentId: 'agent-1',
            toolName: 'failing-tool',
            error: 'Tool execution failed'
          }
        }))

        mockWsClient.emit('agent:failed', createMockApexEvent('agent:failed', 'agent-1', {
          data: {
            agentId: 'agent-1',
            error: 'Agent execution failed'
          }
        }))
      })

      const agentState = result.current.getAgentState('agent-1')
      expect(agentState?.logs).toHaveLength(3)

      // Verify error logs have correct level
      const errorLogs = agentState?.logs.filter(log => log.level === 'error')
      expect(errorLogs).toHaveLength(3)
    })

    it('processes high-volume log streams efficiently', () => {
      const { result } = renderHook(() => useAgentTerminals({
        autoConnect: true,
        defaultMaxLogs: 1000 // Larger buffer for this test
      }))

      // Register multiple agents
      const agentIds = Array.from({ length: 8 }, (_, i) => `agent-${i + 1}`)

      act(() => {
        agentIds.forEach(agentId => {
          result.current.registerAgent(createMockAgentConfig(agentId, { maxLogs: 1000 }))
        })
        mockWsClient.connect()
      })

      // Simulate high-volume log stream
      act(() => {
        for (let round = 0; round < 50; round++) {
          agentIds.forEach(agentId => {
            mockWsClient.emit('agent:log', createMockApexEvent('agent:log', agentId, {
              data: {
                agentId,
                message: `Log message ${round} from ${agentId}`
              }
            }))
          })
        }
      })

      // Verify all agents received their logs
      agentIds.forEach(agentId => {
        const agentState = result.current.getAgentState(agentId)
        expect(agentState?.logs).toHaveLength(50)
      })

      // Verify aggregate stats
      expect(result.current.aggregateStats.totalLogs).toBe(400) // 8 agents * 50 logs
      expect(result.current.aggregateStats.totalAgents).toBe(8)
    })
  })

  describe('Real-time Statistics and Health Monitoring', () => {
    it('updates statistics in real-time as events are processed', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-2'))
        mockWsClient.connect()
      })

      // Initially no logs
      expect(result.current.aggregateStats.totalLogs).toBe(0)
      expect(result.current.aggregateStats.activeAgents).toBe(0)

      // Send events and verify stats update
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        mockWsClient.emit('agent:started', createMockApexEvent('agent:started', 'agent-2'))
      })

      expect(result.current.aggregateStats.totalLogs).toBe(2)

      // Pause one agent and verify stats
      act(() => {
        result.current.pauseAgent('agent-1')
      })

      expect(result.current.aggregateStats.pausedAgents).toBe(1)

      // Add error and verify error count
      act(() => {
        result.current.getAgentState('agent-1')!.error = 'Test error'
      })

      // Trigger stats recalculation
      act(() => {
        vi.advanceTimersByTime(5000) // Trigger periodic stats update
      })
    })

    it('tracks connection health per agent', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-2'))
        mockWsClient.connect()
      })

      // Send event to agent-1 only
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
      })

      const agent1Status = result.current.getAgentConnectionStatus('agent-1')
      const agent2Status = result.current.getAgentConnectionStatus('agent-2')

      expect(agent1Status.lastEventAt).toBeTruthy()
      expect(agent2Status.lastEventAt).toBeNull()

      // Fast forward time to test staleness
      act(() => {
        vi.advanceTimersByTime(31000) // 31 seconds
      })

      const updatedAgent1Status = result.current.getAgentConnectionStatus('agent-1')
      expect(updatedAgent1Status.isStale).toBe(true)
      expect(updatedAgent1Status.timeSinceLastEvent).toBeGreaterThan(30000)
    })
  })

  describe('Memory Management and Resource Cleanup', () => {
    it('properly cleans up resources when agents are unregistered', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      // Register multiple agents with logs
      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-1'))
        result.current.registerAgent(createMockAgentConfig('agent-2'))
        result.current.registerAgent(createMockAgentConfig('agent-3'))
        mockWsClient.connect()
      })

      // Add logs to all agents
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-2'))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-3'))
      })

      expect(result.current.aggregateStats.totalAgents).toBe(3)
      expect(result.current.aggregateStats.totalLogs).toBe(3)

      // Unregister middle agent
      act(() => {
        result.current.unregisterAgent('agent-2')
      })

      expect(result.current.aggregateStats.totalAgents).toBe(2)
      expect(result.current.aggregateStats.totalLogs).toBe(2)
      expect(result.current.isAgentRegistered('agent-2')).toBe(false)

      // Verify remaining agents still work
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-1'))
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-3'))
      })

      expect(result.current.aggregateStats.totalLogs).toBe(4)
    })

    it('handles maximum capacity scenarios gracefully', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      // Register maximum agents (12)
      act(() => {
        for (let i = 1; i <= 12; i++) {
          result.current.registerAgent(createMockAgentConfig(`agent-${i}`))
        }
        mockWsClient.connect()
      })

      expect(result.current.aggregateStats.totalAgents).toBe(12)

      // Try to register one more - should be rejected
      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-13'))
      })

      expect(result.current.aggregateStats.totalAgents).toBe(12)
      expect(result.current.isAgentRegistered('agent-13')).toBe(false)

      // Unregister one and then register should work
      act(() => {
        result.current.unregisterAgent('agent-1')
        result.current.registerAgent(createMockAgentConfig('agent-13'))
      })

      expect(result.current.aggregateStats.totalAgents).toBe(12)
      expect(result.current.isAgentRegistered('agent-13')).toBe(true)
      expect(result.current.isAgentRegistered('agent-1')).toBe(false)
    })

    it('maintains consistent state during rapid registration/unregistration', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        mockWsClient.connect()
      })

      // Rapid registration and unregistration
      act(() => {
        // Register agents
        for (let i = 1; i <= 5; i++) {
          result.current.registerAgent(createMockAgentConfig(`agent-${i}`))
        }

        // Add some logs
        for (let i = 1; i <= 5; i++) {
          mockWsClient.emit('agent:log', createMockApexEvent('agent:log', `agent-${i}`))
        }

        // Unregister odd-numbered agents
        result.current.unregisterAgent('agent-1')
        result.current.unregisterAgent('agent-3')
        result.current.unregisterAgent('agent-5')

        // Register new agents
        result.current.registerAgent(createMockAgentConfig('agent-6'))
        result.current.registerAgent(createMockAgentConfig('agent-7'))
      })

      // Verify final state
      expect(result.current.aggregateStats.totalAgents).toBe(4) // 2, 4, 6, 7
      expect(result.current.isAgentRegistered('agent-2')).toBe(true)
      expect(result.current.isAgentRegistered('agent-4')).toBe(true)
      expect(result.current.isAgentRegistered('agent-6')).toBe(true)
      expect(result.current.isAgentRegistered('agent-7')).toBe(true)

      // Verify old agents are gone
      expect(result.current.isAgentRegistered('agent-1')).toBe(false)
      expect(result.current.isAgentRegistered('agent-3')).toBe(false)
      expect(result.current.isAgentRegistered('agent-5')).toBe(false)
    })
  })

  describe('Cross-Agent Event Filtering', () => {
    it('ensures events only reach their intended agents', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('agent-alpha'))
        result.current.registerAgent(createMockAgentConfig('agent-beta'))
        result.current.registerAgent(createMockAgentConfig('agent-gamma'))
        mockWsClient.connect()
      })

      // Send events with different agent IDs
      act(() => {
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'agent-alpha'))
        mockWsClient.emit('agent:output', createMockApexEvent('agent:output', 'agent-beta'))
        mockWsClient.emit('tool:start', createMockApexEvent('tool:start', 'agent-gamma'))

        // Send event for non-existent agent - should be ignored
        mockWsClient.emit('agent:log', createMockApexEvent('agent:log', 'non-existent-agent'))
      })

      // Verify each agent only has their own events
      expect(result.current.getAgentState('agent-alpha')?.logs).toHaveLength(1)
      expect(result.current.getAgentState('agent-beta')?.logs).toHaveLength(1)
      expect(result.current.getAgentState('agent-gamma')?.logs).toHaveLength(1)

      // Verify event content matches agent
      expect(result.current.getAgentState('agent-alpha')?.logs[0].metadata.agentId).toBe('agent-alpha')
      expect(result.current.getAgentState('agent-beta')?.logs[0].metadata.agentId).toBe('agent-beta')
      expect(result.current.getAgentState('agent-gamma')?.logs[0].metadata.agentId).toBe('agent-gamma')

      // Total should be 3, not 4 (non-existent agent event was ignored)
      expect(result.current.aggregateStats.totalLogs).toBe(3)
    })
  })
})