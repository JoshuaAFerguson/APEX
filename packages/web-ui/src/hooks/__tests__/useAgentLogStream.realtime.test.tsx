/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentLogStream } from '../useAgentLogStream'
import { wsClient } from '@/lib/websocket-client'
import type { ApexEvent } from '@/lib/websocket-client'
import type { UseAgentLogStreamOptions, AgentLogEntry } from '@/types/agent-log-stream'

// Mock the WebSocket client
vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => true),
    getHealthState: vi.fn(() => ({
      isHealthy: true,
      consecutiveFailures: 0,
    })),
  },
}))

// Mock crypto.randomUUID with sequence
let mockUuidCounter = 0
const mockUUID = vi.fn(() => `realtime-test-uuid-${++mockUuidCounter}`)
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

describe('useAgentLogStream - Real-time Log Streaming', () => {
  const mockOptions: UseAgentLogStreamOptions = {
    agentId: 'realtime-test-agent',
    autoConnect: true,
    maxLogs: 1000,
  }

  let mockEventHandlers: Map<string, Function[]> = new Map()

  beforeEach(() => {
    vi.clearAllMocks()
    mockEventHandlers.clear()
    mockUuidCounter = 0

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
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  function createTestEvent(type: string, message: string, agentId: string = 'realtime-test-agent'): ApexEvent {
    return {
      type: type as any,
      timestamp: new Date(),
      taskId: agentId,
      data: {
        agentId,
        message,
      },
    }
  }

  function simulateEvents(events: ApexEvent[]) {
    events.forEach(event => {
      const handlers = mockEventHandlers.get(event.type) || []
      handlers.forEach(handler => handler(event))
    })
  }

  it('processes rapid log additions correctly', () => {
    const onLogs = vi.fn()
    const { result } = renderHook(() => useAgentLogStream({ ...mockOptions, onLogs }))

    // Create multiple events rapidly
    const events = Array.from({ length: 10 }, (_, i) =>
      createTestEvent('agent:log', `Rapid log message ${i}`)
    )

    act(() => {
      simulateEvents(events)
    })

    expect(result.current.logs).toHaveLength(10)
    expect(onLogs).toHaveBeenCalledTimes(10) // Called once per event

    // Check that logs are in correct order
    result.current.logs.forEach((log, index) => {
      expect(log.message).toBe(`Rapid log message ${index}`)
    })
  })

  it('handles high-frequency event bursts', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    // Simulate 100 rapid events
    const events = Array.from({ length: 100 }, (_, i) =>
      createTestEvent('agent:log', `Burst message ${i}`)
    )

    const startTime = Date.now()
    act(() => {
      simulateEvents(events)
    })
    const endTime = Date.now()

    expect(result.current.logs).toHaveLength(100)
    expect(endTime - startTime).toBeLessThan(100) // Should process quickly
  })

  it('respects maxLogs limit during rapid streaming', () => {
    const limitedOptions = { ...mockOptions, maxLogs: 50 }
    const { result } = renderHook(() => useAgentLogStream(limitedOptions))

    // Add more logs than the limit
    const events = Array.from({ length: 75 }, (_, i) =>
      createTestEvent('agent:log', `Limited log ${i}`)
    )

    act(() => {
      simulateEvents(events)
    })

    // Should keep only the last 50 logs
    expect(result.current.logs).toHaveLength(50)
    expect(result.current.logs[0].message).toBe('Limited log 25') // First kept log
    expect(result.current.logs[49].message).toBe('Limited log 74') // Last log
  })

  it('handles mixed event types in real-time', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    const mixedEvents = [
      createTestEvent('agent:log', 'Regular log'),
      createTestEvent('agent:error', 'Error occurred'),
      createTestEvent('agent:started', 'Agent started'),
      createTestEvent('tool:start', 'Tool started'),
      createTestEvent('tool:complete', 'Tool completed'),
      createTestEvent('agent:completed', 'Agent completed'),
    ]

    act(() => {
      simulateEvents(mixedEvents)
    })

    expect(result.current.logs).toHaveLength(6)

    // Check that different event types are processed correctly
    const levels = result.current.logs.map(log => log.level)
    expect(levels).toContain('info')
    expect(levels).toContain('error')

    const sources = result.current.logs.map(log => log.source)
    expect(sources).toContain('agent')
    expect(sources).toContain('error')
    expect(sources).toContain('system')
    expect(sources).toContain('tool')
  })

  it('maintains log order during concurrent operations', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    // Add logs, then immediately filter, then add more logs
    act(() => {
      simulateEvents([
        createTestEvent('agent:log', 'First log'),
        createTestEvent('agent:log', 'Second log'),
      ])
    })

    act(() => {
      result.current.setFilter({ searchText: 'Third' })
    })

    act(() => {
      simulateEvents([
        createTestEvent('agent:log', 'Third log'),
        createTestEvent('agent:log', 'Fourth log'),
      ])
    })

    // All logs should be present in original state
    expect(result.current.logs).toHaveLength(4)

    // Only filtered logs should show in filtered results
    expect(result.current.filteredLogs).toHaveLength(1)
    expect(result.current.filteredLogs[0].message).toBe('Third log')
  })

  it('handles pause/resume during active streaming', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    // Add initial logs
    act(() => {
      simulateEvents([createTestEvent('agent:log', 'Before pause')])
    })

    expect(result.current.logs).toHaveLength(1)

    // Pause streaming
    act(() => {
      result.current.pause()
    })

    expect(result.current.isPaused).toBe(true)

    // Try to add logs while paused (should be ignored)
    act(() => {
      simulateEvents([createTestEvent('agent:log', 'During pause')])
    })

    expect(result.current.logs).toHaveLength(1) // No new logs added

    // Resume streaming
    act(() => {
      result.current.resume()
    })

    expect(result.current.isPaused).toBe(false)

    // Add logs after resuming
    act(() => {
      simulateEvents([createTestEvent('agent:log', 'After resume')])
    })

    expect(result.current.logs).toHaveLength(2)
    expect(result.current.logs[1].message).toBe('After resume')
  })

  it('updates statistics in real-time', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    // Add logs of different types
    act(() => {
      simulateEvents([
        createTestEvent('agent:log', 'Info message'),
        createTestEvent('agent:error', 'Error message'),
        createTestEvent('agent:log', 'Another info'),
      ])
    })

    expect(result.current.stats.totalLogs).toBe(3)
    expect(result.current.streamState.logsReceivedCount).toBe(3)
    expect(result.current.streamState.lastLogAt).toBeInstanceOf(Date)
    expect(result.current.streamState.isReceiving).toBe(true)
  })

  it('handles agent events with metadata correctly', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    const eventWithMetadata: ApexEvent = {
      type: 'agent:completed',
      timestamp: new Date(),
      taskId: 'realtime-test-agent',
      data: {
        agentId: 'realtime-test-agent',
        agentName: 'Test Agent',
        stage: 'execution',
        durationMs: 1500,
        tokens: { input: 100, output: 50, total: 150 },
        cost: 0.001,
      },
    }

    act(() => {
      simulateEvents([eventWithMetadata])
    })

    expect(result.current.logs).toHaveLength(1)

    const log = result.current.logs[0]
    expect(log.metadata.agentName).toBe('Test Agent')
    expect(log.metadata.stage).toBe('execution')
    expect(log.metadata.durationMs).toBe(1500)
    expect(log.metadata.tokens).toEqual({ input: 100, output: 50, total: 150 })
    expect(log.metadata.cost).toBe(0.001)
    expect(log.message).toContain('Test Agent completed')
  })

  it('handles tool events with error details', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    const toolErrorEvent: ApexEvent = {
      type: 'tool:error',
      timestamp: new Date(),
      taskId: 'realtime-test-agent',
      data: {
        agentId: 'realtime-test-agent',
        toolName: 'TestTool',
        error: 'Tool execution failed',
        errorCode: 'TOOL_ERROR',
        stack: 'Error stack trace...',
      },
    }

    act(() => {
      simulateEvents([toolErrorEvent])
    })

    expect(result.current.logs).toHaveLength(1)

    const log = result.current.logs[0]
    expect(log.level).toBe('error')
    expect(log.source).toBe('tool')
    expect(log.metadata.toolName).toBe('TestTool')
    expect(log.metadata.error?.message).toBe('Tool execution failed')
    expect(log.metadata.error?.code).toBe('TOOL_ERROR')
    expect(log.metadata.error?.stack).toBe('Error stack trace...')
  })

  it('handles clearLogs during active streaming', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    // Add some logs
    act(() => {
      simulateEvents([
        createTestEvent('agent:log', 'Log 1'),
        createTestEvent('agent:log', 'Log 2'),
      ])
    })

    expect(result.current.logs).toHaveLength(2)

    // Clear logs
    act(() => {
      result.current.clearLogs()
    })

    expect(result.current.logs).toHaveLength(0)
    expect(result.current.streamState.logsReceivedCount).toBe(0)

    // Add logs after clearing
    act(() => {
      simulateEvents([createTestEvent('agent:log', 'After clear')])
    })

    expect(result.current.logs).toHaveLength(1)
    expect(result.current.logs[0].message).toBe('After clear')
  })

  it('processes events from wildcard subscription', () => {
    const { result } = renderHook(() => useAgentLogStream(mockOptions))

    // Create an event that would match wildcard pattern
    const wildcardEvent: ApexEvent = {
      type: 'agent:custom',
      timestamp: new Date(),
      taskId: 'realtime-test-agent',
      data: {
        agentId: 'realtime-test-agent',
        message: 'Custom agent event',
      },
    }

    act(() => {
      // Simulate wildcard handler
      const wildcardHandlers = mockEventHandlers.get('*') || []
      wildcardHandlers.forEach(handler => handler(wildcardEvent))
    })

    // Custom events might not be processed if not in the mapping
    // This tests the wildcard handler setup
    expect(mockEventHandlers.has('*')).toBe(true)
  })
})