import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Performance-focused WebSocket client mock
const mockWsClient = {
  isConnected: vi.fn(() => true),
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  _eventHandlers: new Map<string, Function[]>(),
  _eventQueue: [] as Array<{ type: string; event: any }>,

  emit: function(eventType: string, event: any) {
    this._eventQueue.push({ type: eventType, event })
  },

  flushEvents: function() {
    const events = [...this._eventQueue]
    this._eventQueue = []
    events.forEach(({ type, event }) => {
      const handlers = this._eventHandlers.get(type) || []
      handlers.forEach(handler => handler(event))
    })
  },

  emitDirect: function(eventType: string, event: any) {
    const handlers = this._eventHandlers.get(eventType) || []
    handlers.forEach(handler => handler(event))
  }
}

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

vi.mock('@/lib/websocket-client', () => ({
  wsClient: mockWsClient,
}))

vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: mockUseWebSocketConnection,
}))

// Import after mocks are set up
import { useAgentTerminals } from '../useAgentTerminals'
import type { ApexEvent } from '@/lib/websocket-client'
import type {
  AgentTerminalConfig,
  AgentLogEntry,
} from '@/types/agent-terminals'

vi.mock('@/types/agent-log-stream', async () => {
  const actual = await vi.importActual('@/types/agent-log-stream')
  return {
    ...actual,
    filterLogs: vi.fn((logs, filter) => {
      // Simulate realistic filtering performance
      if (logs.length > 1000) {
        // Simulate slow filtering for large datasets
        const start = performance.now()
        while (performance.now() - start < 1) {
          // Simulate work
        }
      }
      return logs
    }),
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
      message: `${type} from ${agentId}`,
      ...overrides.data,
    },
    ...overrides,
  }
}

function createMockAgentConfig(
  agentId: string,
  overrides: Partial<AgentTerminalConfig> = {}
): AgentTerminalConfig {
  return {
    agentId,
    agentName: `Agent ${agentId}`,
    maxLogs: 1000,
    autoStart: true,
    ...overrides,
  }
}

function createMockLogEntry(
  agentId: string,
  index: number,
  overrides: Partial<AgentLogEntry> = {}
): AgentLogEntry {
  return {
    id: `log-${agentId}-${index}`,
    timestamp: new Date(Date.now() + index),
    level: 'info',
    source: 'agent',
    message: `Log entry ${index} from ${agentId}`,
    metadata: { agentId },
    sequenceNumber: index,
    isStreaming: false,
    ...overrides,
  }
}

// Performance measurement utilities
function measureTime<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  return { result, duration }
}

function measureMemory(): number {
  // Mock memory measurement (in a real scenario, use performance.measureUserAgentSpecificMemory if available)
  return process.memoryUsage?.()?.heapUsed || 0
}

describe('useAgentTerminals Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset WebSocket client
    mockWsClient._eventHandlers.clear()
    mockWsClient._eventQueue = []
    mockWsClient.on.mockImplementation((eventType: string, handler: Function) => {
      if (!mockWsClient._eventHandlers.has(eventType)) {
        mockWsClient._eventHandlers.set(eventType, [])
      }
      mockWsClient._eventHandlers.get(eventType)!.push(handler)
    })

    // Setup crypto mock
    Object.defineProperty(window, 'crypto', {
      value: {
        randomUUID: vi.fn(() => 'uuid-' + Math.random().toString(36).substr(2, 9))
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

  describe('Initialization Performance', () => {
    it('initializes quickly with maximum agents', () => {
      const { result, duration } = measureTime(() => {
        const { result } = renderHook(() => useAgentTerminals({
          agents: Array.from({ length: 12 }, (_, i) => createMockAgentConfig(`agent-${i + 1}`)),
          autoConnect: true
        }))
        return result
      })

      expect(duration).toBeLessThan(50) // Should initialize in under 50ms
      expect(result.current.agents.size).toBe(12)
    })

    it('handles large initial configuration efficiently', () => {
      const largeConfig = Array.from({ length: 12 }, (_, i) =>
        createMockAgentConfig(`agent-${i + 1}`, {
          maxLogs: 2000,
          initialFilter: {
            levels: ['info', 'warn', 'error'],
            sources: ['agent', 'tool'],
            search: 'complex search term',
          }
        })
      )

      const { result, duration } = measureTime(() => {
        const { result } = renderHook(() => useAgentTerminals({
          agents: largeConfig,
          autoConnect: true,
          defaultMaxLogs: 2000
        }))
        return result
      })

      expect(duration).toBeLessThan(100)
      expect(result.current.aggregateStats.totalAgents).toBe(12)
    })
  })

  describe('High-Volume Event Processing', () => {
    it('processes high-frequency events efficiently', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('high-volume-agent'))
      })

      // Generate 1000 events
      const events = Array.from({ length: 1000 }, (_, i) =>
        createMockApexEvent('agent:log', 'high-volume-agent', {
          data: {
            agentId: 'high-volume-agent',
            message: `High volume message ${i}`
          }
        })
      )

      const { duration } = measureTime(() => {
        act(() => {
          events.forEach(event => mockWsClient.emit('agent:log', event))
          mockWsClient.flushEvents()
        })
      })

      expect(duration).toBeLessThan(200) // Should process 1000 events in under 200ms
      expect(result.current.getAgentState('high-volume-agent')?.logs.length).toBe(1000)
    })

    it('maintains performance with multiple agents under load', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      const agentIds = Array.from({ length: 12 }, (_, i) => `load-agent-${i + 1}`)

      act(() => {
        agentIds.forEach(agentId => {
          result.current.registerAgent(createMockAgentConfig(agentId))
        })
      })

      // Generate 100 events per agent (1200 total)
      const events: ApexEvent[] = []
      agentIds.forEach(agentId => {
        for (let i = 0; i < 100; i++) {
          events.push(createMockApexEvent('agent:log', agentId, {
            data: { agentId, message: `Message ${i}` }
          }))
        }
      })

      const { duration } = measureTime(() => {
        act(() => {
          events.forEach(event => mockWsClient.emit(event.type, event))
          mockWsClient.flushEvents()
        })
      })

      expect(duration).toBeLessThan(500) // Should process 1200 events in under 500ms
      expect(result.current.aggregateStats.totalLogs).toBe(1200)
    })

    it('handles burst events efficiently', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('burst-agent'))
      })

      // Simulate burst of mixed event types
      const burstEvents = [
        'agent:log',
        'agent:output',
        'tool:start',
        'tool:complete',
        'agent:progress',
      ]

      const { duration } = measureTime(() => {
        act(() => {
          for (let burst = 0; burst < 10; burst++) {
            burstEvents.forEach(eventType => {
              for (let i = 0; i < 20; i++) {
                mockWsClient.emit(eventType, createMockApexEvent(eventType, 'burst-agent'))
              }
            })
            mockWsClient.flushEvents()
            vi.advanceTimersByTime(10) // Small delay between bursts
          }
        })
      })

      expect(duration).toBeLessThan(300)
      expect(result.current.getAgentState('burst-agent')?.logs.length).toBe(1000)
    })
  })

  describe('Memory Management Performance', () => {
    it('maintains stable memory usage with log buffer limits', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('memory-test', { maxLogs: 500 }))
      })

      const initialMemory = measureMemory()

      // Add 2000 logs (4x the buffer limit)
      act(() => {
        for (let i = 0; i < 2000; i++) {
          result.current.addAgentLogs('memory-test', [
            createMockLogEntry('memory-test', i)
          ])
        }
      })

      const finalMemory = measureMemory()
      const memoryIncrease = finalMemory - initialMemory

      // Verify logs were trimmed to buffer limit
      expect(result.current.getAgentState('memory-test')?.logs.length).toBe(500)

      // Memory increase should be reasonable (this is a rough check)
      // In a real scenario, you'd want more sophisticated memory analysis
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB
    })

    it('efficiently manages multiple agent buffers', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      const agentIds = Array.from({ length: 12 }, (_, i) => `memory-agent-${i + 1}`)

      act(() => {
        agentIds.forEach(agentId => {
          result.current.registerAgent(createMockAgentConfig(agentId, { maxLogs: 200 }))
        })
      })

      // Fill each agent's buffer
      act(() => {
        agentIds.forEach(agentId => {
          for (let i = 0; i < 300; i++) {
            result.current.addAgentLogs(agentId, [createMockLogEntry(agentId, i)])
          }
        })
      })

      // Verify all agents respect buffer limits
      agentIds.forEach(agentId => {
        expect(result.current.getAgentState(agentId)?.logs.length).toBe(200)
      })

      expect(result.current.aggregateStats.totalLogs).toBe(2400) // 12 agents * 200 logs
    })

    it('efficiently handles rapid agent registration/unregistration', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      const { duration } = measureTime(() => {
        act(() => {
          // Register and unregister many agents rapidly
          for (let cycle = 0; cycle < 100; cycle++) {
            const agentId = `cycle-agent-${cycle}`
            result.current.registerAgent(createMockAgentConfig(agentId))

            // Add some logs
            result.current.addAgentLogs(agentId, [
              createMockLogEntry(agentId, 1),
              createMockLogEntry(agentId, 2),
            ])

            // Unregister immediately
            result.current.unregisterAgent(agentId)
          }
        })
      })

      expect(duration).toBeLessThan(500) // Should complete rapid cycles in under 500ms
      expect(result.current.agents.size).toBe(0) // All agents should be cleaned up
    })
  })

  describe('Filter and Search Performance', () => {
    it('performs efficient log filtering on large datasets', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('filter-agent', { maxLogs: 5000 }))
      })

      // Add large number of logs
      const logs = Array.from({ length: 5000 }, (_, i) =>
        createMockLogEntry('filter-agent', i, {
          level: i % 2 === 0 ? 'info' : 'error',
          message: i % 10 === 0 ? 'important message' : 'regular message'
        })
      )

      act(() => {
        result.current.addAgentLogs('filter-agent', logs)
      })

      // Test filter performance
      const { duration } = measureTime(() => {
        act(() => {
          result.current.setAgentFilter('filter-agent', {
            levels: ['error'],
            search: 'important'
          })
        })
      })

      expect(duration).toBeLessThan(100) // Should filter 5000 logs in under 100ms
    })

    it('maintains good performance with complex filters', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('complex-filter-agent', { maxLogs: 2000 }))
      })

      // Add diverse logs
      const logs = Array.from({ length: 2000 }, (_, i) =>
        createMockLogEntry('complex-filter-agent', i, {
          level: ['debug', 'info', 'warn', 'error'][i % 4] as any,
          source: ['agent', 'system', 'user', 'tool', 'error'][i % 5] as any,
          message: `Test message ${i} with keyword${i % 100}`,
        })
      )

      act(() => {
        result.current.addAgentLogs('complex-filter-agent', logs)
      })

      // Apply multiple filter changes rapidly
      const { duration } = measureTime(() => {
        act(() => {
          result.current.setAgentFilter('complex-filter-agent', { levels: ['error', 'warn'] })
          result.current.setAgentFilter('complex-filter-agent', { sources: ['agent', 'tool'] })
          result.current.setAgentFilter('complex-filter-agent', { search: 'keyword5' })
          result.current.resetAgentFilter('complex-filter-agent')
        })
      })

      expect(duration).toBeLessThan(200) // Multiple filter operations in under 200ms
    })
  })

  describe('Bulk Operations Performance', () => {
    it('performs efficient bulk pause/resume operations', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      const agentIds = Array.from({ length: 12 }, (_, i) => `bulk-agent-${i + 1}`)

      act(() => {
        agentIds.forEach(agentId => {
          result.current.registerAgent(createMockAgentConfig(agentId))
        })
      })

      const { duration } = measureTime(() => {
        act(() => {
          result.current.pauseAll()
          result.current.resumeAll()
          result.current.pauseAll()
          result.current.resumeAll()
        })
      })

      expect(duration).toBeLessThan(50) // Bulk operations should be very fast
      expect(result.current.aggregateStats.pausedAgents).toBe(0)
    })

    it('efficiently clears large amounts of log data', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      const agentIds = Array.from({ length: 12 }, (_, i) => `clear-agent-${i + 1}`)

      act(() => {
        agentIds.forEach(agentId => {
          result.current.registerAgent(createMockAgentConfig(agentId, { maxLogs: 1000 }))
        })
      })

      // Fill all agents with logs
      act(() => {
        agentIds.forEach(agentId => {
          const logs = Array.from({ length: 1000 }, (_, i) =>
            createMockLogEntry(agentId, i)
          )
          result.current.addAgentLogs(agentId, logs)
        })
      })

      expect(result.current.aggregateStats.totalLogs).toBe(12000)

      const { duration } = measureTime(() => {
        act(() => {
          result.current.clearAll()
        })
      })

      expect(duration).toBeLessThan(100) // Should clear 12000 logs quickly
      expect(result.current.aggregateStats.totalLogs).toBe(0)
    })
  })

  describe('Statistics Update Performance', () => {
    it('calculates aggregate statistics efficiently', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      const agentIds = Array.from({ length: 12 }, (_, i) => `stats-agent-${i + 1}`)

      act(() => {
        agentIds.forEach(agentId => {
          result.current.registerAgent(createMockAgentConfig(agentId, { maxLogs: 500 }))
        })
      })

      // Add logs to all agents
      act(() => {
        agentIds.forEach(agentId => {
          const logs = Array.from({ length: 500 }, (_, i) =>
            createMockLogEntry(agentId, i, {
              level: i % 10 === 0 ? 'error' : 'info'
            })
          )
          result.current.addAgentLogs(agentId, logs)
        })
      })

      // Trigger multiple stats updates
      const { duration } = measureTime(() => {
        act(() => {
          vi.advanceTimersByTime(5000) // Trigger periodic stats update
          vi.advanceTimersByTime(5000)
          vi.advanceTimersByTime(5000)
        })
      })

      expect(duration).toBeLessThan(100) // Stats calculation should be fast
      expect(result.current.aggregateStats.totalLogs).toBe(6000)
      expect(result.current.aggregateStats.totalAgents).toBe(12)
    })
  })

  describe('Event Processing Optimization', () => {
    it('optimizes event processing for rapid successive events', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('optimize-agent'))
      })

      // Simulate rapid successive events from the same agent
      const { duration } = measureTime(() => {
        act(() => {
          for (let i = 0; i < 1000; i++) {
            mockWsClient.emitDirect('agent:log', createMockApexEvent('agent:log', 'optimize-agent', {
              data: {
                agentId: 'optimize-agent',
                message: `Rapid event ${i}`,
                sequence: i
              }
            }))
          }
        })
      })

      expect(duration).toBeLessThan(300) // Should process 1000 rapid events efficiently
      expect(result.current.getAgentState('optimize-agent')?.logs.length).toBe(1000)
    })

    it('maintains performance during mixed event type processing', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent(createMockAgentConfig('mixed-agent'))
      })

      const eventTypes = [
        'agent:log', 'agent:output', 'agent:error', 'agent:started',
        'agent:completed', 'agent:failed', 'agent:progress',
        'tool:start', 'tool:complete', 'tool:error'
      ]

      const { duration } = measureTime(() => {
        act(() => {
          for (let i = 0; i < 1000; i++) {
            const eventType = eventTypes[i % eventTypes.length]
            mockWsClient.emitDirect(eventType, createMockApexEvent(eventType, 'mixed-agent'))
          }
        })
      })

      expect(duration).toBeLessThan(400) // Should handle mixed event types efficiently
      expect(result.current.getAgentState('mixed-agent')?.logs.length).toBe(1000)
    })
  })

  describe('Resource Cleanup Performance', () => {
    it('cleans up resources efficiently on unmount', () => {
      const { unmount } = renderHook(() => useAgentTerminals({
        autoConnect: true,
        agents: Array.from({ length: 12 }, (_, i) => createMockAgentConfig(`cleanup-agent-${i + 1}`))
      }))

      const { duration } = measureTime(() => {
        unmount()
      })

      expect(duration).toBeLessThan(50) // Cleanup should be very fast

      // Verify all event listeners were removed
      expect(mockWsClient.off).toHaveBeenCalledTimes(120) // 10 event types * 12 agents
    })

    it('handles cleanup with large datasets efficiently', () => {
      const { result, unmount } = renderHook(() => useAgentTerminals({
        autoConnect: true,
      }))

      // Create scenario with lots of data
      act(() => {
        for (let i = 0; i < 12; i++) {
          const agentId = `cleanup-data-agent-${i + 1}`
          result.current.registerAgent(createMockAgentConfig(agentId, { maxLogs: 1000 }))

          // Fill with logs
          const logs = Array.from({ length: 1000 }, (_, j) =>
            createMockLogEntry(agentId, j)
          )
          result.current.addAgentLogs(agentId, logs)
        }
      })

      expect(result.current.aggregateStats.totalLogs).toBe(12000)

      const { duration } = measureTime(() => {
        unmount()
      })

      expect(duration).toBeLessThan(100) // Cleanup should be fast even with large datasets
    })
  })
})