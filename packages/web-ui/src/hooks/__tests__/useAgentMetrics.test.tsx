/**
 * Comprehensive tests for useAgentMetrics hook
 * Tests WebSocket subscriptions, state management, and edge cases
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AgentMetricsEventType } from '@/types/agent-metrics'
import { AGENT_METRICS_EVENTS } from '@/types/agent-metrics'

// ============================================================================
// Mock Setup - Must be hoisted before imports
// ============================================================================

// Mock wsClient - vi.hoisted ensures these are available for vi.mock
const { mockWsClient } = vi.hoisted(() => ({
  mockWsClient: {
    isConnected: vi.fn(() => true),
    getHealthState: vi.fn(() => ({
      isHealthy: true,
      consecutiveFailures: 0,
      averageLatencyMs: 45,
      lastHealthyAt: new Date(),
      lastCheckAt: new Date(),
    })),
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    reconnector: {
      getStats: vi.fn(() => ({
        currentAttempt: 0,
        state: 'connected',
      })),
    },
  },
}))

vi.mock('@/lib/websocket-client', () => ({
  wsClient: mockWsClient,
}))

vi.mock('@/types/websocket-connection', () => ({
  getConnectionStatus: vi.fn((isConnected: boolean, isReconnecting: boolean, isHealthy: boolean, failures: number) => {
    if (!isConnected) {
      if (isReconnecting) return 'reconnecting'
      return failures > 0 ? 'error' : 'disconnected'
    }
    if (isReconnecting) return 'connecting'
    return isHealthy ? 'connected' : 'error'
  }),
}))

// Import after mocks are set up
import { useAgentMetrics } from '../useAgentMetrics'
import type { ApexEvent } from '@/lib/websocket-client'

// ============================================================================
// Test Utilities
// ============================================================================

function createMockAgentEvent(
  type: AgentMetricsEventType,
  overrides: Partial<ApexEvent> = {}
): ApexEvent {
  return {
    type,
    timestamp: new Date(),
    taskId: 'task-1',
    data: {
      agentId: 'agent-1',
      agentName: 'Test Agent',
      tokens: { input: 100, output: 50, total: 150 },
      cost: 0.01,
      durationMs: 1000,
      ...overrides.data,
    },
    ...overrides,
  }
}

function triggerEvent(eventType: string, event: ApexEvent) {
  // Only trigger the specific event handlers
  const handlers = mockWsClient.on.mock.calls.filter((call: [string, Function]) => call[0] === eventType)
  handlers.forEach(([, handler]: [string, Function]) => handler(event))
}

// ============================================================================
// Tests
// ============================================================================

describe('useAgentMetrics Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockWsClient.isConnected.mockReturnValue(true)
    mockWsClient.getHealthState.mockReturnValue({
      isHealthy: true,
      consecutiveFailures: 0,
      averageLatencyMs: 45,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ============================================================================
  // Initial State Tests
  // ============================================================================

  describe('Initial State', () => {
    it('returns initial metrics state', () => {
      const { result } = renderHook(() => useAgentMetrics())

      expect(result.current.metrics).toBeDefined()
      expect(result.current.metrics.agents).toEqual([])
      expect(result.current.metrics.totalTokens).toBe(0)
      expect(result.current.metrics.totalCost).toBe(0)
      expect(result.current.isLoading).toBe(true)
    })

    it('returns connected status when wsClient is connected', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.connectionStatus).toBe('connected')
    })

    it('returns disconnected status when wsClient is not connected', () => {
      mockWsClient.isConnected.mockReturnValue(false)
      mockWsClient.getHealthState.mockReturnValue({
        isHealthy: false,
        consecutiveFailures: 0,
      })

      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.connectionStatus).toBe('disconnected')
    })

    it('returns null error initially', () => {
      const { result } = renderHook(() => useAgentMetrics())
      expect(result.current.error).toBeNull()
    })

    it('provides a refresh function', () => {
      const { result } = renderHook(() => useAgentMetrics())
      expect(typeof result.current.refresh).toBe('function')
    })
  })

  // ============================================================================
  // WebSocket Subscription Tests
  // ============================================================================

  describe('WebSocket Subscriptions', () => {
    it('subscribes to all agent metrics events on mount', () => {
      renderHook(() => useAgentMetrics())

      AGENT_METRICS_EVENTS.forEach((eventType) => {
        expect(mockWsClient.on).toHaveBeenCalledWith(eventType, expect.any(Function))
      })
    })

    it('subscribes to wildcard events for agent events', () => {
      renderHook(() => useAgentMetrics())
      expect(mockWsClient.on).toHaveBeenCalledWith('*', expect.any(Function))
    })

    it('unsubscribes from events on unmount', () => {
      const { unmount } = renderHook(() => useAgentMetrics())
      unmount()

      AGENT_METRICS_EVENTS.forEach((eventType) => {
        expect(mockWsClient.off).toHaveBeenCalledWith(eventType, expect.any(Function))
      })
    })

    it('auto-connects when autoConnect is true (default)', () => {
      mockWsClient.isConnected.mockReturnValue(false)

      renderHook(() => useAgentMetrics())

      expect(mockWsClient.connect).toHaveBeenCalled()
    })

    it('does not auto-connect when autoConnect is false', () => {
      mockWsClient.isConnected.mockReturnValue(false)

      renderHook(() => useAgentMetrics({ autoConnect: false }))

      expect(mockWsClient.connect).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Event Handling Tests
  // ============================================================================

  describe('Agent Event Handling', () => {
    it('handles agent:started events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        const event = createMockAgentEvent('agent:started')
        triggerEvent('agent:started', event)
      })

      expect(result.current.metrics.agents).toHaveLength(1)
      expect(result.current.metrics.agents[0].status).toBe('processing')
      expect(result.current.metrics.agents[0].isActive).toBe(true)
    })

    it('handles agent:completed events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started'))
      })

      act(() => {
        triggerEvent('agent:completed', createMockAgentEvent('agent:completed'))
      })

      expect(result.current.metrics.agents[0].status).toBe('idle')
      expect(result.current.metrics.agents[0].isActive).toBe(false)
    })

    it('handles agent:failed events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:failed', createMockAgentEvent('agent:failed', {
          data: { agentId: 'agent-1', error: 'Test error' },
        }))
      })

      expect(result.current.metrics.agents[0].status).toBe('error')
    })

    it('handles agent:progress events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:progress', createMockAgentEvent('agent:progress'))
      })

      expect(result.current.metrics.agents[0].status).toBe('processing')
      expect(result.current.metrics.agents[0].isActive).toBe(true)
    })

    it('handles agent:idle events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:idle', createMockAgentEvent('agent:idle'))
      })

      expect(result.current.metrics.agents[0].status).toBe('idle')
    })

    it('accumulates token usage across events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', tokens: { input: 100, output: 50, total: 150 } },
        }))
      })

      act(() => {
        triggerEvent('agent:progress', createMockAgentEvent('agent:progress', {
          data: { agentId: 'agent-1', tokens: { input: 200, output: 100, total: 300 } },
        }))
      })

      expect(result.current.metrics.agents[0].inputTokens).toBe(300)
      expect(result.current.metrics.agents[0].outputTokens).toBe(150)
      expect(result.current.metrics.agents[0].totalTokens).toBe(450)
    })

    it('accumulates cost across events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', cost: 0.01 },
        }))
      })

      act(() => {
        triggerEvent('agent:completed', createMockAgentEvent('agent:completed', {
          data: { agentId: 'agent-1', cost: 0.02 },
        }))
      })

      expect(result.current.metrics.agents[0].estimatedCost).toBeCloseTo(0.03)
    })

    it('increments invocations on agent:started', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started'))
      })

      expect(result.current.metrics.agents[0].invocations).toBe(1)

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started'))
      })

      expect(result.current.metrics.agents[0].invocations).toBe(2)
    })
  })

  // ============================================================================
  // Metrics Aggregation Tests
  // ============================================================================

  describe('Metrics Aggregation', () => {
    it('calculates total tokens across all agents', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', tokens: { input: 100, output: 50, total: 150 } },
        }))
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-2', tokens: { input: 200, output: 100, total: 300 } },
        }))
      })

      expect(result.current.metrics.totalTokens).toBe(450)
    })

    it('calculates total cost across all agents', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', cost: 0.01 },
        }))
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-2', cost: 0.02 },
        }))
      })

      expect(result.current.metrics.totalCost).toBeCloseTo(0.03)
    })
  })

  // ============================================================================
  // Connection Status Tests
  // ============================================================================

  describe('Connection Status', () => {
    it('sets error when connection fails with consecutive failures', () => {
      mockWsClient.isConnected.mockReturnValue(false)
      mockWsClient.getHealthState.mockReturnValue({
        isHealthy: false,
        consecutiveFailures: 3,
      })

      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.connectionStatus).toBe('error')
    })

    it('handles reconnecting state', () => {
      mockWsClient.isConnected.mockReturnValue(false)
      mockWsClient.reconnector.getStats.mockReturnValue({
        currentAttempt: 2,
        state: 'reconnecting',
      })

      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.connectionStatus).toBe('reconnecting')
    })
  })

  // ============================================================================
  // Refresh Function Tests
  // ============================================================================

  describe('Refresh Function', () => {
    it('sets loading state on refresh', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started'))
      })

      expect(result.current.metrics.agents).toHaveLength(1)
      expect(result.current.isLoading).toBe(false)

      act(() => {
        result.current.refresh()
      })

      // Refresh resets loading state
      expect(result.current.isLoading).toBe(true)
    })

    it('triggers connect when not connected', () => {
      mockWsClient.isConnected.mockReturnValue(false)

      const { result } = renderHook(() => useAgentMetrics())

      mockWsClient.connect.mockClear()

      act(() => {
        result.current.refresh()
      })

      expect(mockWsClient.connect).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Loading State Tests
  // ============================================================================

  describe('Loading State', () => {
    it('starts in loading state', () => {
      const { result } = renderHook(() => useAgentMetrics())
      expect(result.current.isLoading).toBe(true)
    })

    it('sets loading to false after receiving first event', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started'))
      })

      expect(result.current.isLoading).toBe(false)
    })

    it('sets loading to false after timeout even with no data', () => {
      const { result } = renderHook(() => useAgentMetrics())

      expect(result.current.isLoading).toBe(true)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles events with missing agentId gracefully', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', {
          type: 'agent:started',
          timestamp: new Date(),
          data: { agentName: 'Test Agent' },
        } as ApexEvent)
      })

      expect(result.current.metrics.agents).toHaveLength(1)
      expect(result.current.metrics.agents[0].agentId).toBe('unknown')
    })

    it('handles events with missing data gracefully', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', {
          type: 'agent:started',
          timestamp: new Date(),
          data: { agentId: 'agent-1' },
        } as ApexEvent)
      })

      expect(result.current.metrics.agents).toHaveLength(1)
      expect(result.current.metrics.agents[0].inputTokens).toBe(0)
      expect(result.current.metrics.agents[0].estimatedCost).toBe(0)
    })

    it('handles multiple agents with same event types', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        for (let i = 0; i < 5; i++) {
          triggerEvent('agent:started', createMockAgentEvent('agent:started', {
            data: {
              agentId: `agent-${i}`,
              agentName: `Agent ${i}`,
              tokens: { input: 100, output: 50, total: 150 },
              cost: 0.01,
            },
          }))
        }
      })

      expect(result.current.metrics.agents).toHaveLength(5)
      expect(result.current.metrics.totalTokens).toBe(750)
      expect(result.current.metrics.totalCost).toBeCloseTo(0.05)
    })

    it('updates existing agent instead of creating duplicate', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', tokens: { input: 100, output: 50, total: 150 } },
        }))
      })

      act(() => {
        triggerEvent('agent:progress', createMockAgentEvent('agent:progress', {
          data: { agentId: 'agent-1', tokens: { input: 100, output: 50, total: 150 } },
        }))
      })

      expect(result.current.metrics.agents).toHaveLength(1)
      expect(result.current.metrics.agents[0].totalTokens).toBe(300)
    })
  })

  // ============================================================================
  // Debug Mode Tests
  // ============================================================================

  describe('Debug Mode', () => {
    it('logs debug messages when debug is true', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      renderHook(() => useAgentMetrics({ debug: true }))

      // Verify that console.log was called with a message containing [useAgentMetrics]
      expect(consoleSpy).toHaveBeenCalled()
      const calls = consoleSpy.mock.calls
      const hasDebugMessage = calls.some((call) =>
        typeof call[0] === 'string' && call[0].includes('[useAgentMetrics]')
      )
      expect(hasDebugMessage).toBe(true)

      consoleSpy.mockRestore()
    })
  })
})
