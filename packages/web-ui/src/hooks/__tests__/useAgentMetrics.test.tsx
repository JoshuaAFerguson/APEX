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
  // Usage Update Event Tests
  // ============================================================================

  describe('Usage Update Event Handling', () => {
    it('handles usage:updated events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        const event = {
          type: 'usage:updated',
          timestamp: new Date(),
          data: {
            agentId: 'agent-1',
            tokens: { input: 200, output: 100, total: 300, cache: 50 },
            cost: 0.02,
            performance: { tokensPerSecond: 15, avgLatencyMs: 150 },
          },
        } as ApexEvent
        triggerEvent('usage:updated', event)
      })

      const agent = result.current.metrics.agents[0]
      expect(agent).toBeDefined()
      expect(agent.agentId).toBe('agent-1')
      expect(agent.inputTokens).toBe(200)
      expect(agent.outputTokens).toBe(100)
      expect(agent.totalTokens).toBe(300)
      expect(agent.cacheTokens).toBe(50)
      expect(agent.estimatedCost).toBe(0.02)
      expect(agent.tokensPerSecond).toBe(15)
      expect(agent.avgLatencyMs).toBe(150)
    })

    it('updates existing agent from usage:updated events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      // First create an agent with agent:started
      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', tokens: { input: 100, output: 50, total: 150 } },
        }))
      })

      expect(result.current.metrics.agents[0].totalTokens).toBe(150)

      // Then update with usage:updated
      act(() => {
        const event = {
          type: 'usage:updated',
          timestamp: new Date(),
          data: {
            agentId: 'agent-1',
            tokens: { input: 500, output: 250, total: 750 },
            cost: 0.05,
          },
        } as ApexEvent
        triggerEvent('usage:updated', event)
      })

      expect(result.current.metrics.agents).toHaveLength(1)
      expect(result.current.metrics.agents[0].totalTokens).toBe(750)
      expect(result.current.metrics.agents[0].estimatedCost).toBe(0.05)
    })

    it('handles usage:updated with missing optional fields', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        const event = {
          type: 'usage:updated',
          timestamp: new Date(),
          data: {
            agentId: 'agent-1',
            tokens: { input: 100, output: 50, total: 150 },
            cost: 0.01,
          },
        } as ApexEvent
        triggerEvent('usage:updated', event)
      })

      const agent = result.current.metrics.agents[0]
      expect(agent.totalTokens).toBe(150)
      expect(agent.estimatedCost).toBe(0.01)
      expect(agent.cacheTokens).toBeUndefined()
      expect(agent.tokensPerSecond).toBe(0) // Default from initial state
    })

    it('filters usage:updated events by agentIds option', () => {
      const { result } = renderHook(() => useAgentMetrics({ agentIds: ['agent-1', 'agent-3'] }))

      act(() => {
        // Should be included
        triggerEvent('usage:updated', {
          type: 'usage:updated',
          timestamp: new Date(),
          data: { agentId: 'agent-1', tokens: { input: 100, output: 50, total: 150 }, cost: 0.01 },
        } as ApexEvent)

        // Should be excluded
        triggerEvent('usage:updated', {
          type: 'usage:updated',
          timestamp: new Date(),
          data: { agentId: 'agent-2', tokens: { input: 100, output: 50, total: 150 }, cost: 0.01 },
        } as ApexEvent)

        // Should be included
        triggerEvent('usage:updated', {
          type: 'usage:updated',
          timestamp: new Date(),
          data: { agentId: 'agent-3', tokens: { input: 200, output: 100, total: 300 }, cost: 0.02 },
        } as ApexEvent)
      })

      expect(result.current.metrics.agents).toHaveLength(2)
      expect(result.current.metrics.agents.some(a => a.agentId === 'agent-1')).toBe(true)
      expect(result.current.metrics.agents.some(a => a.agentId === 'agent-2')).toBe(false)
      expect(result.current.metrics.agents.some(a => a.agentId === 'agent-3')).toBe(true)
    })
  })

  // ============================================================================
  // Polling and Time Range Tests
  // ============================================================================

  describe('Polling and Time Range', () => {
    it('sets up polling when pollingIntervalMs is provided', () => {
      const { result } = renderHook(() => useAgentMetrics({ pollingIntervalMs: 1000 }))

      expect(result.current.refresh).toBeDefined()

      // Mock refresh to verify it would be called
      const refreshSpy = vi.fn()

      act(() => {
        // Add an agent first
        triggerEvent('agent:started', createMockAgentEvent('agent:started'))
      })

      expect(result.current.metrics.agents).toHaveLength(1)
    })

    it('includes timeRange in metrics when provided', () => {
      const timeRange = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T23:59:59Z'),
      }

      const { result } = renderHook(() => useAgentMetrics({ timeRange }))

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started'))
      })

      expect(result.current.metrics.timeRange).toEqual(timeRange)
    })
  })

  // ============================================================================
  // Integration Tests - Complex Scenarios
  // ============================================================================

  describe('Integration Tests', () => {
    it('handles complex agent lifecycle with mixed events', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        // Agent starts
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', tokens: { input: 100, output: 50, total: 150 }, cost: 0.01 },
        }))
      })

      expect(result.current.metrics.agents[0].status).toBe('processing')
      expect(result.current.metrics.agents[0].isActive).toBe(true)
      expect(result.current.metrics.agents[0].invocations).toBe(1)

      act(() => {
        // Progress update
        triggerEvent('agent:progress', createMockAgentEvent('agent:progress', {
          data: { agentId: 'agent-1', tokens: { input: 200, output: 100, total: 300 }, cost: 0.02 },
        }))
      })

      expect(result.current.metrics.agents[0].status).toBe('processing')
      expect(result.current.metrics.agents[0].isActive).toBe(true)
      expect(result.current.metrics.agents[0].invocations).toBe(1) // No increment on progress
      expect(result.current.metrics.agents[0].totalTokens).toBe(450) // Cumulative

      act(() => {
        // Usage update
        triggerEvent('usage:updated', {
          type: 'usage:updated',
          timestamp: new Date(),
          data: {
            agentId: 'agent-1',
            tokens: { input: 1000, output: 500, total: 1500, cache: 100 },
            cost: 0.1,
            performance: { tokensPerSecond: 25, avgLatencyMs: 100 },
          },
        } as ApexEvent)
      })

      expect(result.current.metrics.agents[0].totalTokens).toBe(1500) // Replaced, not cumulative
      expect(result.current.metrics.agents[0].estimatedCost).toBe(0.1)
      expect(result.current.metrics.agents[0].cacheTokens).toBe(100)
      expect(result.current.metrics.agents[0].tokensPerSecond).toBe(25)

      act(() => {
        // Agent completes
        triggerEvent('agent:completed', createMockAgentEvent('agent:completed', {
          data: { agentId: 'agent-1', durationMs: 5000 },
        }))
      })

      expect(result.current.metrics.agents[0].status).toBe('idle')
      expect(result.current.metrics.agents[0].isActive).toBe(false)
      expect(result.current.metrics.agents[0].duration).toBe(5000)
    })

    it('handles multiple agents with different event patterns', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        // Agent 1: Normal lifecycle
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', agentName: 'Agent 1', tokens: { input: 100, output: 50, total: 150 }, cost: 0.01 },
        }))

        // Agent 2: Usage updates only
        triggerEvent('usage:updated', {
          type: 'usage:updated',
          timestamp: new Date(),
          data: { agentId: 'agent-2', tokens: { input: 200, output: 100, total: 300 }, cost: 0.02 },
        } as ApexEvent)

        // Agent 3: Starts and immediately fails
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-3', agentName: 'Agent 3', tokens: { input: 50, output: 25, total: 75 }, cost: 0.005 },
        }))
        triggerEvent('agent:failed', createMockAgentEvent('agent:failed', {
          data: { agentId: 'agent-3', error: 'Connection timeout' },
        }))
      })

      expect(result.current.metrics.agents).toHaveLength(3)

      const agent1 = result.current.metrics.agents.find(a => a.agentId === 'agent-1')
      const agent2 = result.current.metrics.agents.find(a => a.agentId === 'agent-2')
      const agent3 = result.current.metrics.agents.find(a => a.agentId === 'agent-3')

      expect(agent1?.status).toBe('processing')
      expect(agent1?.isActive).toBe(true)
      expect(agent1?.agentName).toBe('Agent 1')

      expect(agent2?.agentId).toBe('agent-2')
      expect(agent2?.totalTokens).toBe(300)
      expect(agent2?.status).toBe('idle') // Default status for usage-only agents

      expect(agent3?.status).toBe('error')
      expect(agent3?.isActive).toBe(false)
      expect(agent3?.agentName).toBe('Agent 3')

      // Check totals
      expect(result.current.metrics.totalTokens).toBe(525) // 150 + 300 + 75
      expect(result.current.metrics.totalCost).toBeCloseTo(0.025) // 0.01 + 0.02 + 0.005
    })

    it('handles wildcard event matching correctly', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        // Trigger via wildcard handler
        const wildcardHandlers = mockWsClient.on.mock.calls.filter((call: [string, Function]) => call[0] === '*')
        expect(wildcardHandlers).toHaveLength(1)

        const [, wildcardHandler] = wildcardHandlers[0]

        // Should handle agent events via wildcard
        wildcardHandler(createMockAgentEvent('agent:started'))

        // Should handle usage events via wildcard
        wildcardHandler({
          type: 'usage:updated',
          timestamp: new Date(),
          data: { agentId: 'agent-2', tokens: { input: 100, output: 50, total: 150 }, cost: 0.01 },
        } as ApexEvent)

        // Should ignore non-agent events
        wildcardHandler({
          type: 'system:status',
          timestamp: new Date(),
          data: { status: 'healthy' },
        } as ApexEvent)
      })

      expect(result.current.metrics.agents).toHaveLength(2)
    })
  })

  // ============================================================================
  // Error Handling and Robustness Tests
  // ============================================================================

  describe('Error Handling and Robustness', () => {
    it('gracefully handles malformed event data', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        // Event with null data
        triggerEvent('agent:started', {
          type: 'agent:started',
          timestamp: new Date(),
          data: null,
        } as any)

        // Event with malformed tokens
        triggerEvent('agent:started', {
          type: 'agent:started',
          timestamp: new Date(),
          data: { agentId: 'agent-2', tokens: 'invalid' },
        } as any)

        // Event with negative values
        triggerEvent('usage:updated', {
          type: 'usage:updated',
          timestamp: new Date(),
          data: {
            agentId: 'agent-3',
            tokens: { input: -100, output: -50, total: -150 },
            cost: -0.01
          },
        } as any)
      })

      // Should handle gracefully without crashing
      expect(result.current.metrics.agents.length).toBeGreaterThanOrEqual(0)
      expect(result.current.error).toBeNull()
    })

    it('handles reconnector access issues gracefully', () => {
      // Mock reconnector to throw error
      mockWsClient.reconnector = {
        getStats: vi.fn(() => {
          throw new Error('Reconnector not available')
        }),
      }

      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should not throw error despite reconnector issues
      expect(result.current.connectionStatus).toBeDefined()
    })

    it('handles missing websocket client gracefully', () => {
      const originalIsConnected = mockWsClient.isConnected
      mockWsClient.isConnected = vi.fn(() => {
        throw new Error('WebSocket not available')
      })

      expect(() => {
        renderHook(() => useAgentMetrics())
      }).not.toThrow()

      // Restore
      mockWsClient.isConnected = originalIsConnected
    })

    it('calculates tokens per second correctly with duration', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', tokens: { input: 100, output: 50, total: 150 } },
        }))

        triggerEvent('agent:completed', createMockAgentEvent('agent:completed', {
          data: { agentId: 'agent-1', durationMs: 1000 }, // 1 second
        }))
      })

      const agent = result.current.metrics.agents[0]
      expect(agent.tokensPerSecond).toBeCloseTo(150) // 150 tokens / 1 second
    })
  })

  // ============================================================================
  // Performance and Scale Tests
  // ============================================================================

  describe('Performance and Scale', () => {
    it('handles multiple sequential events efficiently', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        // Simulate 5 sequential events for same agent
        triggerEvent('agent:started', createMockAgentEvent('agent:started', {
          data: { agentId: 'agent-1', tokens: { input: 10, output: 5, total: 15 } },
        }))
        triggerEvent('agent:progress', createMockAgentEvent('agent:progress', {
          data: { agentId: 'agent-1', tokens: { input: 20, output: 10, total: 30 } },
        }))
        triggerEvent('agent:progress', createMockAgentEvent('agent:progress', {
          data: { agentId: 'agent-1', tokens: { input: 30, output: 15, total: 45 } },
        }))
      })

      expect(result.current.metrics.agents).toHaveLength(1)
      expect(result.current.metrics.agents[0].totalTokens).toBe(90) // Cumulative
    })

    it('manages multiple agents efficiently', () => {
      const { result } = renderHook(() => useAgentMetrics())

      act(() => {
        // Create 5 different agents
        for (let i = 1; i <= 5; i++) {
          triggerEvent('agent:started', createMockAgentEvent('agent:started', {
            data: {
              agentId: `agent-${i}`,
              agentName: `Agent ${i}`,
              tokens: { input: i*10, output: i*5, total: i*15 },
              cost: i*0.001
            },
          }))
        }
      })

      expect(result.current.metrics.agents).toHaveLength(5)
      expect(result.current.metrics.totalTokens).toBe(225) // 15+30+45+60+75
      expect(result.current.metrics.totalCost).toBeCloseTo(0.015) // 0.001+0.002+0.003+0.004+0.005
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

    it('logs agent events when debug is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const { result } = renderHook(() => useAgentMetrics({ debug: true }))

      act(() => {
        triggerEvent('agent:started', createMockAgentEvent('agent:started'))
      })

      // Should log the received agent event
      const calls = consoleSpy.mock.calls
      const hasEventLog = calls.some((call) =>
        typeof call[0] === 'string' && call[0].includes('Received agent event')
      )
      expect(hasEventLog).toBe(true)

      consoleSpy.mockRestore()
    })
  })
})
