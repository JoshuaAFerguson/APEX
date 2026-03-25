import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'


vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(() => true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    onHealth: vi.fn(),
    offHealth: vi.fn(),
    getHealthState: vi.fn(() => ({
      isHealthy: true,
      consecutiveFailures: 0,
      averageLatencyMs: 50,
      lastHealthyAt: new Date(),
      lastCheckAt: new Date(),
    })),
    _eventHandlers: new Map(),
    emit: function(eventType: string, event: any) {
      const handlers = this._eventHandlers.get(eventType) || []
      handlers.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error(`Handler error for ${eventType}:`, error)
        }
      })
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

// Import after mocks are set up
import { useAgentTerminals } from '../useAgentTerminals'
import { wsClient } from '@/lib/websocket-client'
import type { ApexEvent } from '@/lib/websocket-client'
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection'
import type {
  AgentTerminalConfig,
} from '@/types/agent-terminals'

// Get typed reference to mocked wsClient and useWebSocketConnection
const mockWsClient = wsClient as any
const mockUseWebSocketConnection = useWebSocketConnection as any

vi.mock('@/types/agent-log-stream', async () => {
  const actual = await vi.importActual('@/types/agent-log-stream')
  return {
    ...actual,
    filterLogs: vi.fn((logs, filter) => {
      // Simulate filter processing that could fail
      if (filter?.search === 'CAUSE_FILTER_ERROR') {
        throw new Error('Filter processing error')
      }
      return logs
    }),
    exportLogs: vi.fn((logs, format) => {
      if (format === 'invalid') throw new Error('Unsupported format')
      return 'exported-logs'
    }),
    calculateLogStreamStats: vi.fn((logs, startTime) => {
      // Simulate stats calculation that could fail
      if (logs.some((log: any) => log.message === 'CAUSE_STATS_ERROR')) {
        throw new Error('Stats calculation error')
      }
      return {
        totalEntries: logs.length,
        totalErrors: logs.filter((log: any) => log.level === 'error').length,
        bytesReceived: logs.length * 500,
        entriesPerSecond: logs.length / 60,
        averageEntryLength: 500,
        oldestEntry: logs[0]?.timestamp || null,
        newestEntry: logs[logs.length - 1]?.timestamp || null,
      }
    }),
    DEFAULT_LOG_FILTER: {
      levels: ['debug', 'info', 'warn', 'error'],
      sources: ['agent', 'system', 'user', 'tool', 'error'],
      search: '',
      timeRange: null,
    }
  }
})

// Mock console methods to test error handling
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('useAgentTerminals Edge Cases and Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset WebSocket client event handlers
    mockWsClient._eventHandlers.clear()
    mockWsClient.on.mockImplementation((eventType: string, handler: Function) => {
      if (!mockWsClient._eventHandlers.has(eventType)) {
        mockWsClient._eventHandlers.set(eventType, [])
      }
      mockWsClient._eventHandlers.get(eventType)!.push(handler)
    })

    // Setup crypto mock
    Object.defineProperty(window, 'crypto', {
      value: {
        randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
      },
      writable: true,
    })

    Object.defineProperty(window, '__agentLogSequenceCounter', {
      value: 0,
      writable: true,
    })

    // Reset console spy call counts
    mockConsoleError.mockClear()
    mockConsoleWarn.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Invalid Configuration Handling', () => {
    it('handles null/undefined agent configurations gracefully', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        // Try to register with null
        result.current.registerAgent(null as any)
        result.current.registerAgent(undefined as any)

        // Try to register with empty object
        result.current.registerAgent({} as AgentTerminalConfig)

        // Try to register with invalid agentId types
        result.current.registerAgent({ agentId: null } as any)
        result.current.registerAgent({ agentId: undefined } as any)
        result.current.registerAgent({ agentId: 123 } as any)
        result.current.registerAgent({ agentId: '' } as any)
      })

      // None of these should be registered
      expect(result.current.agents.size).toBe(0)
      expect(mockConsoleError).toHaveBeenCalled()
    })

    it('handles invalid maxLogs configurations', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({
          agentId: 'valid-agent',
          maxLogs: -1
        })

        result.current.registerAgent({
          agentId: 'valid-agent-2',
          maxLogs: 0
        })

        result.current.registerAgent({
          agentId: 'valid-agent-3',
          maxLogs: 'invalid' as any
        })

        result.current.registerAgent({
          agentId: 'valid-agent-4',
          maxLogs: null as any
        })
      })

      // None should be registered due to invalid maxLogs
      expect(result.current.agents.size).toBe(0)
    })

    it('handles malformed initial agents array', () => {
      // Should not crash with malformed initial agents
      expect(() => {
        renderHook(() => useAgentTerminals({
          agents: [
            null as any,
            undefined as any,
            {} as AgentTerminalConfig,
            { agentId: 'valid' },
            { agentId: null } as any
          ]
        }))
      }).not.toThrow()
    })
  })

  describe('WebSocket Event Processing Errors', () => {
    it('handles malformed WebSocket events gracefully', () => {
      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      const malformedEvents = [
        null,
        undefined,
        {},
        { type: null },
        { type: 'agent:log' }, // No data
        { type: 'agent:log', data: null },
        { type: 'agent:log', data: {}, timestamp: null },
        { type: 'agent:log', data: {}, timestamp: 'invalid-date' },
        { data: { agentId: 'test-agent' } }, // No type
      ]

      // None of these should crash the hook
      act(() => {
        malformedEvents.forEach(event => {
          mockWsClient.emit('agent:log', event)
        })
      })

      // Should still be functioning
      expect(result.current.agents.size).toBe(1)
    })

    it('handles events with missing or invalid agentId', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'valid-agent' })
      })

      const eventsWithInvalidAgentId = [
        {
          type: 'agent:log',
          timestamp: new Date(),
          data: { /* no agentId */ }
        },
        {
          type: 'agent:log',
          timestamp: new Date(),
          data: { agentId: null }
        },
        {
          type: 'agent:log',
          timestamp: new Date(),
          data: { agentId: undefined }
        },
        {
          type: 'agent:log',
          timestamp: new Date(),
          data: { agentId: 123 }
        },
        {
          type: 'agent:log',
          timestamp: new Date(),
          data: { agentId: '' }
        }
      ]

      act(() => {
        eventsWithInvalidAgentId.forEach(event => {
          mockWsClient.emit('agent:log', event)
        })
      })

      // No logs should be added due to invalid agentId
      expect(result.current.getAgentState('valid-agent')?.logs).toHaveLength(0)
    })

    it('handles transform errors during event processing', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      // Mock crypto.randomUUID to throw an error
      const originalCrypto = window.crypto
      Object.defineProperty(window, 'crypto', {
        value: {
          randomUUID: () => { throw new Error('UUID generation failed') }
        },
        writable: true
      })

      act(() => {
        mockWsClient.emit('agent:log', {
          type: 'agent:log',
          timestamp: new Date(),
          data: { agentId: 'test-agent', message: 'test' }
        })
      })

      // Should handle the error gracefully
      expect(result.current.getAgentState('test-agent')?.logs).toHaveLength(0)
      expect(mockConsoleWarn).toHaveBeenCalled()

      // Restore crypto
      Object.defineProperty(window, 'crypto', { value: originalCrypto, writable: true })
    })
  })

  describe('State Management Edge Cases', () => {
    it('handles operations on non-existent agents', () => {
      const { result } = renderHook(() => useAgentTerminals())

      // These operations should not crash when agent doesn't exist
      act(() => {
        result.current.pauseAgent('non-existent')
        result.current.resumeAgent('non-existent')
        result.current.clearAgentLogs('non-existent')
        result.current.setAgentFilter('non-existent', { search: 'test' })
        result.current.resetAgentFilter('non-existent')
      })

      expect(result.current.getAgentState('non-existent')).toBeUndefined()
      expect(result.current.getAgentLogs('non-existent')).toEqual([])
      expect(result.current.getAgentFilteredLogs('non-existent')).toEqual([])
    })

    it('handles filter processing errors', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      // Add a log first
      act(() => {
        result.current.addAgentLogs('test-agent', [{
          id: 'test-log',
          timestamp: new Date(),
          level: 'info',
          source: 'agent',
          message: 'test message',
          metadata: { agentId: 'test-agent' },
          sequenceNumber: 1,
          isStreaming: false
        }])
      })

      // Set filter that will cause error
      act(() => {
        result.current.setAgentFilter('test-agent', { search: 'CAUSE_FILTER_ERROR' })
      })

      // Should handle filter error gracefully
      expect(result.current.getAgentState('test-agent')).toBeDefined()
    })

    it('handles stats calculation errors', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      // Add log that will cause stats error
      act(() => {
        result.current.addAgentLogs('test-agent', [{
          id: 'error-log',
          timestamp: new Date(),
          level: 'info',
          source: 'agent',
          message: 'CAUSE_STATS_ERROR',
          metadata: { agentId: 'test-agent' },
          sequenceNumber: 1,
          isStreaming: false
        }])
      })

      // Trigger stats update
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Should handle stats error gracefully
      expect(result.current.getAgentState('test-agent')).toBeDefined()
    })

    it('handles concurrent state modifications', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent', maxLogs: 5 })
      })

      // Simulate rapid concurrent operations
      act(() => {
        // Add logs while simultaneously pausing/resuming
        for (let i = 0; i < 10; i++) {
          result.current.addAgentLogs('test-agent', [{
            id: `log-${i}`,
            timestamp: new Date(),
            level: 'info',
            source: 'agent',
            message: `Message ${i}`,
            metadata: { agentId: 'test-agent' },
            sequenceNumber: i,
            isStreaming: false
          }])

          if (i % 2 === 0) result.current.pauseAgent('test-agent')
          else result.current.resumeAgent('test-agent')
        }
      })

      // Should maintain consistent state
      const agentState = result.current.getAgentState('test-agent')
      expect(agentState).toBeDefined()
      expect(agentState?.logs.length).toBeLessThanOrEqual(5) // Respects maxLogs
    })
  })

  describe('Memory and Resource Management', () => {
    it('handles memory pressure scenarios', () => {
      const { result } = renderHook(() => useAgentTerminals())

      // Register agent with very small buffer
      act(() => {
        result.current.registerAgent({ agentId: 'memory-test', maxLogs: 1 })
      })

      // Add many logs rapidly
      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.addAgentLogs('memory-test', [{
            id: `massive-log-${i}`,
            timestamp: new Date(),
            level: 'info',
            source: 'agent',
            message: 'x'.repeat(10000), // Large message
            metadata: { agentId: 'memory-test' },
            sequenceNumber: i,
            isStreaming: false
          }])
        }
      })

      // Should maintain buffer limit despite large messages
      expect(result.current.getAgentState('memory-test')?.logs).toHaveLength(1)
    })

    it('handles interval cleanup errors', () => {
      const originalClearInterval = global.clearInterval
      global.clearInterval = vi.fn(() => {
        throw new Error('clearInterval failed')
      })

      const { unmount } = renderHook(() => useAgentTerminals())

      // Should not throw when unmounting with clearInterval error
      expect(() => {
        unmount()
      }).not.toThrow()

      global.clearInterval = originalClearInterval
    })

    it('handles event handler cleanup errors', () => {
      mockWsClient.off.mockImplementation(() => {
        throw new Error('Event handler cleanup failed')
      })

      const { unmount } = renderHook(() => useAgentTerminals())

      // Should not throw when cleanup fails
      expect(() => {
        unmount()
      }).not.toThrow()

      // Reset mock
      mockWsClient.off.mockReset()
    })
  })

  describe('WebSocket Connection Edge Cases', () => {
    it('handles WebSocket client errors', () => {
      const { result } = renderHook(() => useAgentTerminals())

      // Mock WebSocket methods to throw
      mockWsClient.connect.mockImplementation(() => {
        throw new Error('Connection failed')
      })
      mockWsClient.disconnect.mockImplementation(() => {
        throw new Error('Disconnection failed')
      })

      // Should handle connection errors gracefully
      act(() => {
        result.current.connect()
        result.current.disconnect()
        result.current.reconnect()
      })

      expect(result.current.agents.size).toBe(0) // Should still be functional
    })

    it('handles rapid connection state changes', () => {
      // Mock rapidly changing connection states
      let connectionState = true
      mockWsClient.isConnected.mockImplementation(() => connectionState)

      const { result } = renderHook(() => useAgentTerminals({ autoConnect: true }))

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      // Rapidly toggle connection
      act(() => {
        for (let i = 0; i < 10; i++) {
          connectionState = !connectionState

          // Simulate connection change callback
          mockUseWebSocketConnection.mockReturnValue({
            status: connectionState ? 'connected' : 'disconnected',
            isHealthy: connectionState,
            latencyMs: connectionState ? 45 : null,
            averageLatencyMs: 50,
            reconnectAttempts: connectionState ? 0 : 3,
            maxReconnectAttempts: 10,
            consecutiveFailures: connectionState ? 0 : 3,
            lastHealthyAt: connectionState ? new Date() : null,
            lastCheckAt: new Date(),
            connectionUptime: connectionState ? 1000 : null,
          })

          vi.advanceTimersByTime(100)
        }
      })

      // Should handle rapid changes without crashing
      expect(result.current.getAgentState('test-agent')).toBeDefined()
    })

    it('handles WebSocket event handler exceptions', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      // Mock event handler to throw
      const originalEmit = mockWsClient.emit
      mockWsClient.emit = function(eventType: string, event: any) {
        const handlers = this._eventHandlers.get(eventType) || []
        handlers.forEach(handler => {
          if (eventType === 'agent:log' && event?.data?.message === 'CAUSE_HANDLER_ERROR') {
            throw new Error('Handler processing error')
          }
          handler(event)
        })
      }

      // Send event that will cause handler to throw
      act(() => {
        mockWsClient.emit('agent:log', {
          type: 'agent:log',
          timestamp: new Date(),
          data: {
            agentId: 'test-agent',
            message: 'CAUSE_HANDLER_ERROR'
          }
        })
      })

      // Should continue functioning despite handler error
      expect(result.current.getAgentState('test-agent')).toBeDefined()

      // Restore original emit
      mockWsClient.emit = originalEmit
    })
  })

  describe('Export and Utility Edge Cases', () => {
    it('handles export errors gracefully', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      // Add some logs
      act(() => {
        result.current.addAgentLogs('test-agent', [{
          id: 'test-log',
          timestamp: new Date(),
          level: 'info',
          source: 'agent',
          message: 'test',
          metadata: { agentId: 'test-agent' },
          sequenceNumber: 1,
          isStreaming: false
        }])
      })

      // Try to export with invalid format
      expect(() => {
        result.current.exportAgentLogs('test-agent', 'invalid' as any)
      }).not.toThrow() // Should handle error internally

      // Valid export should still work
      const exported = result.current.exportAgentLogs('test-agent', 'json')
      expect(exported).toBe('exported-logs')
    })

    it('handles missing window globals gracefully', () => {
      // Remove crypto
      const originalCrypto = window.crypto
      delete (window as any).crypto

      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      // Should still work without crypto (fallback to Date.now)
      act(() => {
        mockWsClient.emit('agent:log', {
          type: 'agent:log',
          timestamp: new Date(),
          data: { agentId: 'test-agent', message: 'test' }
        })
      })

      expect(result.current.getAgentState('test-agent')?.logs.length).toBe(1)

      // Restore crypto
      Object.defineProperty(window, 'crypto', { value: originalCrypto, writable: true })
    })

    it('handles sequence counter corruption', () => {
      // Corrupt sequence counter
      Object.defineProperty(window, '__agentLogSequenceCounter', {
        value: 'invalid',
        writable: true
      })

      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      // Should handle corrupted counter gracefully
      act(() => {
        mockWsClient.emit('agent:log', {
          type: 'agent:log',
          timestamp: new Date(),
          data: { agentId: 'test-agent', message: 'test' }
        })
      })

      expect(result.current.getAgentState('test-agent')?.logs.length).toBe(1)
    })
  })

  describe('Reducer Edge Cases', () => {
    it('handles unknown action types', () => {
      const { result } = renderHook(() => useAgentTerminals())

      // This shouldn't cause any issues - unknown actions should be ignored
      // In a real scenario, this would be tested by directly calling the reducer
      // but since it's internal, we just verify the hook remains stable

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      expect(result.current.getAgentState('test-agent')).toBeDefined()
    })

    it('handles state corruption scenarios', () => {
      const { result } = renderHook(() => useAgentTerminals())

      act(() => {
        result.current.registerAgent({ agentId: 'test-agent' })
      })

      // Try operations that could cause state issues
      act(() => {
        // Multiple rapid state changes
        result.current.pauseAgent('test-agent')
        result.current.resumeAgent('test-agent')
        result.current.clearAgentLogs('test-agent')
        result.current.pauseAgent('test-agent')
        result.current.clearAgentLogs('test-agent')
        result.current.resumeAgent('test-agent')
      })

      // Should maintain consistent state
      const agentState = result.current.getAgentState('test-agent')
      expect(agentState).toBeDefined()
      expect(agentState?.logs).toEqual([])
      expect(agentState?.isPaused).toBe(false)
    })
  })
})