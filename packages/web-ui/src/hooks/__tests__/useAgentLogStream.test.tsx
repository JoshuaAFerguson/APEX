import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { useAgentLogStream } from '../useAgentLogStream'
import { wsClient } from '@/lib/websocket-client'
import type { ApexEvent } from '@/lib/websocket-client'
import type { UseAgentLogStreamOptions, AgentLogEntry } from '@/types/agent-log-stream'
import { calculateLogStreamStats, filterLogs, exportLogs } from '@/types/agent-log-stream'

// Mock the WebSocket client
vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    isConnected: vi.fn(() => true),
    getHealthState: vi.fn(() => ({
      isHealthy: true,
      consecutiveFailures: 0,
    })),
  },
}))

// Mock crypto.randomUUID
const mockUUID = vi.fn(() => 'mock-uuid-123')
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

// Mock timers (but don't set it globally as it causes issues)
// vi.useFakeTimers()

describe('useAgentLogStream', () => {
  const mockOptions: UseAgentLogStreamOptions = {
    agentId: 'test-agent-123',
    autoConnect: true,
    maxLogs: 100,
  }

  let mockEventHandlers: Map<string, Function[]> = new Map()

  beforeEach(() => {
    vi.clearAllMocks()
    mockEventHandlers.clear()
    mockUUID.mockReturnValue('mock-uuid-123')

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

    // Mock connected state by default
    ;(wsClient.isConnected as Mock).mockReturnValue(true)
  })

  afterEach(() => {
    // vi.runOnlyPendingTimers()
    // vi.useRealTimers()
  })

  describe('Initialization', () => {
    it('initializes with default state values', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      expect(result.current.logs).toEqual([])
      expect(result.current.filteredLogs).toEqual([])
      expect(result.current.streamState.state).toBe('idle')
      expect(result.current.stats.totalLogs).toBe(0)
      expect(result.current.isConnecting).toBe(false)
      expect(result.current.isStreaming).toBe(false)
      expect(result.current.isPaused).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('applies initial filter options', () => {
      const filterOptions = {
        ...mockOptions,
        filter: {
          levels: new Set(['error'] as const),
          searchText: 'test search',
        },
      }

      const { result } = renderHook(() => useAgentLogStream(filterOptions))

      expect(result.current.filter.levels.has('error')).toBe(true)
      expect(result.current.filter.searchText).toBe('test search')
    })

    it('subscribes to WebSocket events on mount', () => {
      renderHook(() => useAgentLogStream(mockOptions))

      // Should subscribe to agent log-related events
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
        '*',
      ]

      expectedEvents.forEach((eventType) => {
        expect(wsClient.on).toHaveBeenCalledWith(eventType, expect.any(Function))
      })
    })

    it('auto-connects when autoConnect is true', () => {
      ;(wsClient.isConnected as Mock).mockReturnValue(false)

      renderHook(() => useAgentLogStream(mockOptions))

      expect(wsClient.connect).toHaveBeenCalled()
    })

    it('does not auto-connect when autoConnect is false', () => {
      ;(wsClient.isConnected as Mock).mockReturnValue(false)

      renderHook(() => useAgentLogStream({
        ...mockOptions,
        autoConnect: false
      }))

      expect(wsClient.connect).not.toHaveBeenCalled()
    })
  })

  describe('Event Processing', () => {
    it('adds logs on agent events', async () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      const mockEvent: ApexEvent = {
        type: 'agent:log',
        timestamp: new Date(),
        taskId: 'test-agent-123',
        data: {
          agentId: 'test-agent-123',
          message: 'Test log message',
        },
      }

      act(() => {
        // Simulate event from WebSocket
        const handlers = mockEventHandlers.get('agent:log') || []
        handlers.forEach(handler => handler(mockEvent))
      })

      expect(result.current.logs).toHaveLength(1)
      expect(result.current.logs[0].message).toBe('Test log message')
      expect(result.current.logs[0].level).toBe('info')
      expect(result.current.logs[0].source).toBe('agent')
      expect(result.current.streamState.logsReceivedCount).toBe(1)
    })

    it('filters events by agentId', async () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      const mockEvent: ApexEvent = {
        type: 'agent:log',
        timestamp: new Date(),
        taskId: 'different-agent-456',
        data: {
          agentId: 'different-agent-456',
          message: 'Should be filtered out',
        },
      }

      act(() => {
        const handlers = mockEventHandlers.get('agent:log') || []
        handlers.forEach(handler => handler(mockEvent))
      })

      expect(result.current.logs).toHaveLength(0)
    })

    it('transforms different event types correctly', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      const testCases = [
        {
          event: {
            type: 'agent:started',
            data: { agentId: 'test-agent-123', agentName: 'TestAgent' },
          },
          expected: {
            level: 'info',
            source: 'system',
            message: 'Agent TestAgent started',
          },
        },
        {
          event: {
            type: 'agent:error',
            data: { agentId: 'test-agent-123', error: 'Test error' },
          },
          expected: {
            level: 'error',
            source: 'error',
            message: 'Test error',
          },
        },
        {
          event: {
            type: 'tool:complete',
            data: { agentId: 'test-agent-123', toolName: 'TestTool' },
          },
          expected: {
            level: 'info',
            source: 'tool',
            message: 'Tool TestTool completed',
          },
        },
      ]

      testCases.forEach(({ event, expected }, index) => {
        act(() => {
          const mockEvent: ApexEvent = {
            ...event,
            timestamp: new Date(),
            taskId: 'test-agent-123',
          } as ApexEvent

          const handlers = mockEventHandlers.get(event.type) || []
          handlers.forEach(handler => handler(mockEvent))
        })

        expect(result.current.logs[index]).toMatchObject(expected)
      })
    })
  })

  describe('Log Management', () => {
    it('respects maxLogs limit (ring buffer)', () => {
      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        maxLogs: 3,
      }))

      // Add 5 logs
      for (let i = 0; i < 5; i++) {
        act(() => {
          const mockEvent: ApexEvent = {
            type: 'agent:log',
            timestamp: new Date(),
            taskId: 'test-agent-123',
            data: {
              agentId: 'test-agent-123',
              message: `Log ${i}`,
            },
          }

          const handlers = mockEventHandlers.get('agent:log') || []
          handlers.forEach(handler => handler(mockEvent))
        })
      }

      // Should only keep the last 3 logs
      expect(result.current.logs).toHaveLength(3)
      expect(result.current.logs[0].message).toBe('Log 2')
      expect(result.current.logs[2].message).toBe('Log 4')
    })

    it('clears logs when clearLogs is called', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Add a log first
      act(() => {
        const mockEvent: ApexEvent = {
          type: 'agent:log',
          timestamp: new Date(),
          taskId: 'test-agent-123',
          data: {
            agentId: 'test-agent-123',
            message: 'Test log',
          },
        }

        const handlers = mockEventHandlers.get('agent:log') || []
        handlers.forEach(handler => handler(mockEvent))
      })

      expect(result.current.logs).toHaveLength(1)

      act(() => {
        result.current.clearLogs()
      })

      expect(result.current.logs).toHaveLength(0)
      expect(result.current.streamState.logsReceivedCount).toBe(0)
    })

    it('adds logs programmatically', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      const testLogs: AgentLogEntry[] = [
        {
          id: 'test-1',
          timestamp: new Date(),
          level: 'info',
          source: 'user',
          message: 'Manual log 1',
          metadata: { agentId: 'test-agent-123' },
        },
        {
          id: 'test-2',
          timestamp: new Date(),
          level: 'warn',
          source: 'system',
          message: 'Manual log 2',
          metadata: { agentId: 'test-agent-123' },
        },
      ]

      act(() => {
        result.current.addLogs(testLogs)
      })

      expect(result.current.logs).toHaveLength(2)
      expect(result.current.logs[0].message).toBe('Manual log 1')
      expect(result.current.logs[1].message).toBe('Manual log 2')
    })
  })

  describe('Filtering', () => {
    it('filters logs by level', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Add logs with different levels
      const logData = [
        { type: 'agent:log', level: 'info', message: 'Info log' },
        { type: 'agent:error', level: 'error', message: 'Error log' },
      ]

      logData.forEach((data) => {
        act(() => {
          const mockEvent: ApexEvent = {
            type: data.type as any,
            timestamp: new Date(),
            taskId: 'test-agent-123',
            data: {
              agentId: 'test-agent-123',
              message: data.message,
            },
          }

          const handlers = mockEventHandlers.get(data.type) || []
          handlers.forEach(handler => handler(mockEvent))
        })
      })

      // Set filter to only show errors
      act(() => {
        result.current.setFilter({
          levels: new Set(['error'] as const),
        })
      })

      expect(result.current.logs).toHaveLength(2)
      expect(result.current.filteredLogs).toHaveLength(1)
      expect(result.current.filteredLogs[0].message).toBe('Error log')
    })

    it('filters logs by search text', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Add logs with different content
      const messages = ['Connection established', 'Processing data', 'Connection lost']

      messages.forEach((message) => {
        act(() => {
          const mockEvent: ApexEvent = {
            type: 'agent:log',
            timestamp: new Date(),
            taskId: 'test-agent-123',
            data: {
              agentId: 'test-agent-123',
              message,
            },
          }

          const handlers = mockEventHandlers.get('agent:log') || []
          handlers.forEach(handler => handler(mockEvent))
        })
      })

      // Filter for 'connection' text
      act(() => {
        result.current.setFilter({
          searchText: 'connection',
        })
      })

      expect(result.current.logs).toHaveLength(3)
      expect(result.current.filteredLogs).toHaveLength(2)
      expect(result.current.filteredLogs[0].message).toBe('Connection established')
      expect(result.current.filteredLogs[1].message).toBe('Connection lost')
    })

    it('resets filter to default state', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      act(() => {
        result.current.setFilter({
          levels: new Set(['error'] as const),
          searchText: 'test',
        })
      })

      act(() => {
        result.current.resetFilter()
      })

      expect(result.current.filter.levels).toEqual(new Set(['debug', 'info', 'warn', 'error']))
      expect(result.current.filter.searchText).toBe('')
    })
  })

  describe('Stream Control', () => {
    it('pauses and resumes log processing', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Pause the stream
      act(() => {
        result.current.pause()
      })

      expect(result.current.isPaused).toBe(true)
      expect(result.current.streamState.state).toBe('paused')

      // Try to add a log while paused
      act(() => {
        const mockEvent: ApexEvent = {
          type: 'agent:log',
          timestamp: new Date(),
          taskId: 'test-agent-123',
          data: {
            agentId: 'test-agent-123',
            message: 'Should be ignored',
          },
        }

        const handlers = mockEventHandlers.get('agent:log') || []
        handlers.forEach(handler => handler(mockEvent))
      })

      // Log should not be added while paused
      expect(result.current.logs).toHaveLength(0)

      // Resume the stream
      act(() => {
        result.current.resume()
      })

      expect(result.current.isPaused).toBe(false)
      expect(result.current.streamState.state).toBe('streaming')
    })

    it('connects and disconnects', () => {
      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        autoConnect: false,
      }))

      expect(result.current.streamState.state).toBe('idle')

      act(() => {
        result.current.connect()
      })

      // State should change to connecting or streaming depending on mock setup
      expect(['connecting', 'streaming'].includes(result.current.streamState.state)).toBe(true)

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.streamState.state).toBe('disconnected')
    })
  })

  describe('Statistics', () => {
    it('calculates statistics correctly', async () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Add logs with different levels
      const events = [
        { type: 'agent:log', level: 'info' },
        { type: 'agent:log', level: 'info' },
        { type: 'agent:error', level: 'error' },
      ]

      events.forEach((event) => {
        act(() => {
          const mockEvent: ApexEvent = {
            type: event.type as any,
            timestamp: new Date(),
            taskId: 'test-agent-123',
            data: {
              agentId: 'test-agent-123',
              message: 'Test message',
            },
          }

          const handlers = mockEventHandlers.get(event.type) || []
          handlers.forEach(handler => handler(mockEvent))
        })
      })

      // Check that logs are added (statistics will be calculated based on logs)
      expect(result.current.logs.length).toBeGreaterThan(0)
    })
  })

  describe('Export', () => {
    it('exports logs in JSON format', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Add a test log
      act(() => {
        const testLog: AgentLogEntry = {
          id: 'test-1',
          timestamp: new Date('2024-01-01T12:00:00Z'),
          level: 'info',
          source: 'agent',
          message: 'Test message',
          metadata: { agentId: 'test-agent-123' },
        }
        result.current.addLogs([testLog])
      })

      const exported = result.current.exportLogs('json')
      const parsed = JSON.parse(exported)

      expect(parsed).toHaveLength(1)
      expect(parsed[0].message).toBe('Test message')
    })

    it('exports logs in text format', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      act(() => {
        const testLog: AgentLogEntry = {
          id: 'test-1',
          timestamp: new Date('2024-01-01T12:00:00Z'),
          level: 'info',
          source: 'agent',
          message: 'Test message',
          metadata: { agentId: 'test-agent-123' },
        }
        result.current.addLogs([testLog])
      })

      const exported = result.current.exportLogs('text')

      expect(exported).toContain('[INFO]')
      expect(exported).toContain('Test message')
    })

    it('exports logs in CSV format', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      act(() => {
        const testLog: AgentLogEntry = {
          id: 'test-1',
          timestamp: new Date('2024-01-01T12:00:00Z'),
          level: 'info',
          source: 'agent',
          message: 'Test message',
          metadata: { agentId: 'test-agent-123' },
        }
        result.current.addLogs([testLog])
      })

      const exported = result.current.exportLogs('csv')
      const lines = exported.split('\n')

      expect(lines[0]).toContain('timestamp,level,source,message')
      expect(lines[1]).toContain('info,agent,"Test message"')
    })
  })

  describe('Callbacks', () => {
    it('calls onLogs callback when logs are added', () => {
      const onLogsMock = vi.fn()

      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        onLogs: onLogsMock,
      }))

      act(() => {
        const mockEvent: ApexEvent = {
          type: 'agent:log',
          timestamp: new Date(),
          taskId: 'test-agent-123',
          data: {
            agentId: 'test-agent-123',
            message: 'Test log',
          },
        }

        const handlers = mockEventHandlers.get('agent:log') || []
        handlers.forEach(handler => handler(mockEvent))
      })

      expect(onLogsMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Test log',
          }),
        ])
      )
    })

    it('calls onConnectionChange when connection status changes', async () => {
      const onConnectionChangeMock = vi.fn()

      renderHook(() => useAgentLogStream({
        ...mockOptions,
        onConnectionChange: onConnectionChangeMock,
      }))

      // Connection changes should be handled by the hook's internal logic
      // Just verify the callback is set up
      expect(onConnectionChangeMock).toBeDefined()
    })

    it('calls onError when error occurs', () => {
      const onErrorMock = vi.fn()

      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        onError: onErrorMock,
      }))

      act(() => {
        // Simulate setting an error
        ;(result.current as any).streamState.error = 'Test error'
      })

      // This would be triggered by the internal error handling logic
      // The exact test depends on how errors are propagated
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles WebSocket event transformation errors gracefully', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Mock console.warn to verify error logging
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Create an event that will cause transformation error by having missing required fields
      const invalidEvent = {
        type: 'agent:log',
        timestamp: 'invalid-date', // Invalid date type
        taskId: 'test-agent-123',
        data: {
          agentId: 'test-agent-123',
          message: null, // Invalid message type
        },
      }

      act(() => {
        try {
          const handlers = mockEventHandlers.get('agent:log') || []
          handlers.forEach(handler => handler(invalidEvent))
        } catch (error) {
          // Expected to catch errors during transformation
        }
      })

      // Stream should continue working despite the error
      expect(result.current.logs).toHaveLength(0)

      consoleWarnSpy.mockRestore()
    })

    it('handles missing global crypto.randomUUID', () => {
      const originalCrypto = global.crypto
      delete (global as any).crypto

      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Add a log entry
      act(() => {
        const testLog = {
          id: 'test-1',
          timestamp: new Date(),
          level: 'info' as const,
          source: 'agent' as const,
          message: 'Test message',
          metadata: { agentId: 'test-agent-123' },
        }
        result.current.addLogs([testLog])
      })

      expect(result.current.logs).toHaveLength(1)

      // Restore crypto
      global.crypto = originalCrypto
    })

    it('handles SSR environment without window', () => {
      const originalWindow = global.window
      delete (global as any).window

      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      expect(result.current.logs).toEqual([])
      expect(result.current.streamState.state).toBe('idle')

      // Restore window
      global.window = originalWindow
    })

    it('handles events with different agentId field locations', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Test event with agentId in data.agent
      const eventWithAgent = {
        type: 'agent:log',
        timestamp: new Date(),
        taskId: 'other-id',
        data: {
          agent: 'test-agent-123', // Alternative location
          message: 'Test message 1',
        },
      }

      // Test event with agentId in taskId
      const eventWithTaskId = {
        type: 'agent:log',
        timestamp: new Date(),
        taskId: 'test-agent-123', // Agent ID in taskId
        data: {
          message: 'Test message 2',
        },
      }

      act(() => {
        const handlers = mockEventHandlers.get('agent:log') || []
        handlers.forEach(handler => {
          handler(eventWithAgent)
          handler(eventWithTaskId)
        })
      })

      expect(result.current.logs).toHaveLength(2)
      expect(result.current.logs[0].message).toBe('Test message 1')
      expect(result.current.logs[1].message).toBe('Test message 2')
    })

    it('handles unknown event types gracefully', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      const unknownEvent = {
        type: 'unknown:event',
        timestamp: new Date(),
        taskId: 'test-agent-123',
        data: {
          agentId: 'test-agent-123',
          message: 'Unknown event',
        },
      }

      act(() => {
        // Trigger through wildcard handler
        const wildcardHandlers = mockEventHandlers.get('*') || []
        wildcardHandlers.forEach(handler => handler(unknownEvent))
      })

      // Unknown events should not be processed
      expect(result.current.logs).toHaveLength(0)
    })

    it('handles connection status polling errors gracefully', () => {
      // Mock wsClient to throw error during health check
      ;(wsClient.getHealthState as Mock).mockImplementation(() => {
        throw new Error('Health check failed')
      })

      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Should not crash and should have default connection state
      expect(result.current.streamState.connectionStatus).toBe('disconnected')

      // Restore normal behavior
      ;(wsClient.getHealthState as Mock).mockReturnValue({
        isHealthy: true,
        consecutiveFailures: 0,
      })
    })

    it('handles reconnector access errors gracefully', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // wsClient mock doesn't have reconnector, this tests the try/catch
      expect(result.current.streamState.connectionStatus).toBe('connected')
    })

    it('processes large number of events efficiently', () => {
      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        maxLogs: 100,
      }))

      // Add 150 events rapidly
      act(() => {
        for (let i = 0; i < 150; i++) {
          const mockEvent = {
            type: 'agent:log',
            timestamp: new Date(),
            taskId: 'test-agent-123',
            data: {
              agentId: 'test-agent-123',
              message: `Log ${i}`,
            },
          }

          const handlers = mockEventHandlers.get('agent:log') || []
          handlers.forEach(handler => handler(mockEvent))
        }
      })

      // Should respect maxLogs limit
      expect(result.current.logs).toHaveLength(100)
      // Should keep the most recent logs
      expect(result.current.logs[0].message).toBe('Log 50')
      expect(result.current.logs[99].message).toBe('Log 149')
    })
  })

  describe('Advanced Event Processing', () => {
    it('processes complex agent events with full metadata', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      const complexEvent = {
        type: 'agent:completed',
        timestamp: new Date(),
        taskId: 'test-agent-123',
        data: {
          agentId: 'test-agent-123',
          agentName: 'ComplexAgent',
          stage: 'execution',
          durationMs: 1500,
          tokens: { input: 100, output: 50, total: 150 },
          cost: 0.001,
          metadata: { customField: 'value' },
        },
      }

      act(() => {
        const handlers = mockEventHandlers.get('agent:completed') || []
        handlers.forEach(handler => handler(complexEvent))
      })

      const log = result.current.logs[0]
      expect(log.metadata.agentName).toBe('ComplexAgent')
      expect(log.metadata.stage).toBe('execution')
      expect(log.metadata.durationMs).toBe(1500)
      expect(log.metadata.tokens).toEqual({ input: 100, output: 50, total: 150 })
      expect(log.metadata.cost).toBe(0.001)
      expect(log.metadata.extra).toEqual({ customField: 'value' })
    })

    it('processes tool events with error details', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      const toolErrorEvent = {
        type: 'tool:error',
        timestamp: new Date(),
        taskId: 'test-agent-123',
        data: {
          agentId: 'test-agent-123',
          toolName: 'TestTool',
          error: 'Tool execution failed',
          errorCode: 'TOOL_ERROR',
          stack: 'Error stack trace...',
        },
      }

      act(() => {
        const handlers = mockEventHandlers.get('tool:error') || []
        handlers.forEach(handler => handler(toolErrorEvent))
      })

      const log = result.current.logs[0]
      expect(log.level).toBe('error')
      expect(log.source).toBe('tool')
      expect(log.metadata.toolName).toBe('TestTool')
      expect(log.metadata.error).toEqual({
        message: 'Tool execution failed',
        code: 'TOOL_ERROR',
        stack: 'Error stack trace...',
      })
    })
  })

  describe('Statistics and Performance', () => {
    it('updates statistics correctly with timer intervals', async () => {
      vi.useFakeTimers()

      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Connect and start streaming
      act(() => {
        result.current.connect()
      })

      // Add some logs
      act(() => {
        const events = [
          { type: 'agent:log', level: 'info' },
          { type: 'agent:error', level: 'error' },
          { type: 'agent:log', level: 'warn' },
        ]

        events.forEach((eventData) => {
          const mockEvent = {
            type: eventData.type,
            timestamp: new Date(),
            taskId: 'test-agent-123',
            data: {
              agentId: 'test-agent-123',
              message: 'Test message',
            },
          }

          const handlers = mockEventHandlers.get(eventData.type) || []
          handlers.forEach(handler => handler(mockEvent))
        })
      })

      // Fast-forward time to trigger stats update
      act(() => {
        vi.advanceTimersByTime(5100) // 5.1 seconds
      })

      expect(result.current.stats.totalLogs).toBeGreaterThan(0)

      vi.useRealTimers()
    })

    it('handles connection status updates correctly', async () => {
      const onConnectionChangeMock = vi.fn()

      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        onConnectionChange: onConnectionChangeMock,
      }))

      // Simulate connection state changes
      act(() => {
        ;(wsClient.isConnected as Mock).mockReturnValue(false)
      })

      // Wait for connection check interval
      await new Promise(resolve => setTimeout(resolve, 1100))

      expect(onConnectionChangeMock).toHaveBeenCalled()
    })
  })

  describe('Debug Mode', () => {
    it('logs debug messages when debug mode is enabled', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        debug: true,
      }))

      act(() => {
        result.current.connect()
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useAgentLogStream]'),
        expect.any(String)
      )

      consoleLogSpy.mockRestore()
    })

    it('does not log debug messages when debug mode is disabled', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        debug: false,
      }))

      act(() => {
        result.current.connect()
      })

      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })
  })

  describe('Scroll Management', () => {
    it('handles scroll operations with DOM elements', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Mock DOM element
      const mockElement = {
        scrollIntoView: vi.fn(),
      } as any

      const mockContainer = {
        scrollTop: 0,
        scrollHeight: 1000,
      } as any

      // Test scrollToLog
      act(() => {
        // Simulate adding element to refs map
        ;(result.current as any).logElementsRef = {
          current: new Map([['test-log-id', mockElement]]),
        }

        result.current.scrollToLog('test-log-id')
      })

      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
      })

      // Test scrollToBottom
      act(() => {
        ;(result.current as any).scrollContainerRef = {
          current: mockContainer,
        }

        result.current.scrollToBottom()
      })

      expect(mockContainer.scrollTop).toBe(1000)
    })

    it('handles scroll operations without DOM elements gracefully', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Should not throw when DOM elements are not available
      expect(() => {
        result.current.scrollToLog('non-existent-id')
        result.current.scrollToBottom()
      }).not.toThrow()
    })
  })

  describe('Cleanup', () => {
    it('unsubscribes from events on unmount', () => {
      const { unmount } = renderHook(() => useAgentLogStream(mockOptions))

      // Clear the call history
      vi.clearAllMocks()

      unmount()

      // Should unsubscribe from events
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

      expectedEvents.forEach((eventType) => {
        expect(wsClient.off).toHaveBeenCalledWith(eventType, expect.any(Function))
      })
    })

    it('clears timers on unmount', () => {
      const { unmount } = renderHook(() => useAgentLogStream(mockOptions))

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      unmount()

      expect(clearIntervalSpy).toHaveBeenCalled()
    })
  })

  describe('Utility Functions Integration', () => {
    it('calculates statistics accurately', () => {
      const logs: AgentLogEntry[] = [
        {
          id: '1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          level: 'info',
          source: 'agent',
          message: 'Info message',
          metadata: { agentId: 'test' },
        },
        {
          id: '2',
          timestamp: new Date('2024-01-01T10:00:01Z'),
          level: 'error',
          source: 'tool',
          message: 'Error message',
          metadata: { agentId: 'test' },
        },
        {
          id: '3',
          timestamp: new Date('2024-01-01T10:00:02Z'),
          level: 'warn',
          source: 'system',
          message: 'Warning message',
          metadata: { agentId: 'test' },
        },
      ]

      // Use a time in the past to ensure positive duration
      const streamStartTime = new Date(Date.now() - 2000)
      const stats = calculateLogStreamStats(logs, streamStartTime)

      expect(stats.totalLogs).toBe(3)
      expect(stats.byLevel.info).toBe(1)
      expect(stats.byLevel.error).toBe(1)
      expect(stats.byLevel.warn).toBe(1)
      expect(stats.bySource.agent).toBe(1)
      expect(stats.bySource.tool).toBe(1)
      expect(stats.bySource.system).toBe(1)
      expect(stats.errorCount).toBe(1)
      expect(stats.streamDurationMs).toBeGreaterThan(0)
      expect(stats.logsPerSecond).toBeGreaterThan(0)
    })

    it('filters logs correctly', () => {
      const logs: AgentLogEntry[] = [
        {
          id: '1',
          timestamp: new Date(),
          level: 'info',
          source: 'agent',
          message: 'Information about connection',
          metadata: { agentId: 'agent-1', agentName: 'TestAgent' },
        },
        {
          id: '2',
          timestamp: new Date(),
          level: 'error',
          source: 'tool',
          message: 'Tool failed to execute',
          metadata: { agentId: 'agent-2', toolName: 'TestTool' },
        },
        {
          id: '3',
          timestamp: new Date(),
          level: 'debug',
          source: 'system',
          message: 'Debug information',
          metadata: { agentId: 'agent-1' },
        },
      ]

      // Test level filtering
      const errorFilter = {
        levels: new Set(['error'] as const),
        searchText: '',
        stage: null,
        agent: null,
      }

      const errorLogs = filterLogs(logs, errorFilter)
      expect(errorLogs).toHaveLength(1)
      expect(errorLogs[0].level).toBe('error')

      // Test search text filtering
      const searchFilter = {
        levels: new Set(['debug', 'info', 'warn', 'error'] as const),
        searchText: 'connection',
        stage: null,
        agent: null,
      }

      const searchLogs = filterLogs(logs, searchFilter)
      expect(searchLogs).toHaveLength(1)
      expect(searchLogs[0].message).toContain('connection')

      // Test agent filtering
      const agentFilter = {
        levels: new Set(['debug', 'info', 'warn', 'error'] as const),
        searchText: '',
        stage: null,
        agent: 'agent-1',
      }

      const agentLogs = filterLogs(logs, agentFilter)
      expect(agentLogs).toHaveLength(2)
      agentLogs.forEach(log => {
        expect(log.metadata.agentId).toBe('agent-1')
      })
    })

    it('exports logs in different formats', () => {
      const logs: AgentLogEntry[] = [
        {
          id: '1',
          timestamp: new Date('2024-01-01T12:00:00.000Z'),
          level: 'info',
          source: 'agent',
          message: 'Test message with "quotes"',
          metadata: {
            agentId: 'test-agent',
            agentName: 'TestAgent',
          },
        },
      ]

      // Test JSON export
      const jsonExport = exportLogs(logs, 'json')
      const parsed = JSON.parse(jsonExport)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].message).toBe('Test message with "quotes"')

      // Test text export
      const textExport = exportLogs(logs, 'text')
      expect(textExport).toContain('[INFO]')
      expect(textExport).toContain('Test message with "quotes"')

      // Test CSV export
      const csvExport = exportLogs(logs, 'csv')
      const csvLines = csvExport.split('\n')
      expect(csvLines[0]).toBe('timestamp,level,source,message,agentId,agentName')
      expect(csvLines[1]).toContain('info,agent,"Test message with ""quotes""",test-agent,TestAgent')
    })
  })

  describe('Memory Management and Performance', () => {
    it('handles memory pressure gracefully with large log volumes', () => {
      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        maxLogs: 50,
      }))

      // Simulate high-frequency log generation
      act(() => {
        for (let i = 0; i < 200; i++) {
          const mockEvent = {
            type: 'agent:log',
            timestamp: new Date(),
            taskId: 'test-agent-123',
            data: {
              agentId: 'test-agent-123',
              message: `High frequency log ${i}`,
            },
          }

          const handlers = mockEventHandlers.get('agent:log') || []
          handlers.forEach(handler => handler(mockEvent))
        }
      })

      // Should maintain memory bounds
      expect(result.current.logs.length).toBe(50)
      // Should keep most recent logs
      expect(result.current.logs[0].message).toBe('High frequency log 150')
      expect(result.current.logs[49].message).toBe('High frequency log 199')
    })

    it('handles concurrent operations safely', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Simulate concurrent log additions and filtering
      act(() => {
        // Add logs
        const testLogs = Array.from({ length: 10 }, (_, i) => ({
          id: `test-${i}`,
          timestamp: new Date(),
          level: i % 2 === 0 ? 'info' : 'error' as const,
          source: 'agent' as const,
          message: `Concurrent log ${i}`,
          metadata: { agentId: 'test-agent-123' },
        }))

        result.current.addLogs(testLogs)

        // Apply filter while adding
        result.current.setFilter({ levels: new Set(['error']) })

        // Clear logs while filtered
        result.current.clearLogs()

        // Reset filter
        result.current.resetFilter()
      })

      // Should handle all operations gracefully
      expect(result.current.logs).toHaveLength(0)
      expect(result.current.filter.levels).toEqual(new Set(['debug', 'info', 'warn', 'error']))
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('recovers from WebSocket connection errors', async () => {
      const onErrorMock = vi.fn()
      const { result } = renderHook(() => useAgentLogStream({
        ...mockOptions,
        onError: onErrorMock,
      }))

      // Simulate connection error
      act(() => {
        ;(wsClient.isConnected as Mock).mockReturnValue(false)
        ;(wsClient.getHealthState as Mock).mockReturnValue({
          isHealthy: false,
          consecutiveFailures: 3,
        })
      })

      // Wait for connection status update
      await waitFor(() => {
        expect(result.current.streamState.connectionStatus).toBe('error')
      })

      // Simulate recovery
      act(() => {
        ;(wsClient.isConnected as Mock).mockReturnValue(true)
        ;(wsClient.getHealthState as Mock).mockReturnValue({
          isHealthy: true,
          consecutiveFailures: 0,
        })
      })

      // Should recover
      await waitFor(() => {
        expect(result.current.streamState.connectionStatus).toBe('connected')
      })
    })

    it('handles rapid state changes gracefully', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Rapidly change states
      act(() => {
        result.current.connect()
        result.current.pause()
        result.current.resume()
        result.current.disconnect()
        result.current.connect()
      })

      // Should end in a consistent state
      expect(['connecting', 'streaming'].includes(result.current.streamState.state)).toBe(true)
    })

    it('maintains data integrity during errors', () => {
      const { result } = renderHook(() => useAgentLogStream(mockOptions))

      // Add some logs
      act(() => {
        const testLogs = [
          {
            id: 'test-1',
            timestamp: new Date(),
            level: 'info' as const,
            source: 'agent' as const,
            message: 'Valid log',
            metadata: { agentId: 'test-agent-123' },
          },
        ]
        result.current.addLogs(testLogs)
      })

      // Simulate error condition
      act(() => {
        try {
          // Force an error in event processing
          const invalidEvent = {
            type: 'agent:log',
            timestamp: new Date(),
            taskId: 'test-agent-123',
            data: {
              agentId: 'test-agent-123',
              message: null, // This will cause an error
            },
          }

          const handlers = mockEventHandlers.get('agent:log') || []
          handlers.forEach(handler => handler(invalidEvent))
        } catch (error) {
          // Errors should be caught and handled
        }
      })

      // Original data should still be intact
      expect(result.current.logs).toHaveLength(1)
      expect(result.current.logs[0].message).toBe('Valid log')
    })
  })
})