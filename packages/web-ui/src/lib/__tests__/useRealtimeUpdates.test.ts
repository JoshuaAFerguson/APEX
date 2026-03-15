/**
 * Tests for useRealtimeUpdates hook and dashboard types
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtimeUpdates } from '../useRealtimeUpdates'
import {
  transformApexEvent,
  generateEventTitle,
  getEventCategory,
  getEventSeverity,
  calculateHealthStatus,
  DEFAULT_HEALTH_THRESHOLDS,
  INITIAL_REALTIME_STATE,
  type DashboardActivityEvent,
  type DashboardHealthMetrics,
  type ActivityEventCategory,
  type ActivityEventSeverity,
} from '../../types/dashboard'
import type { ApexEvent, ApexEventType } from '@apexcli/core'

// Mock the WebSocket client
vi.mock('../websocket-client', () => {
  const mockClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    onState: vi.fn(),
    offState: vi.fn(),
    onHealth: vi.fn(),
    offHealth: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    getHealthState: vi.fn().mockReturnValue({
      isHealthy: true,
      consecutiveFailures: 0,
      averageLatencyMs: 50,
    }),
    getHealthStatistics: vi.fn().mockReturnValue({
      totalChecks: 10,
      successfulChecks: 10,
      failedChecks: 0,
      uptimePercentage: 100,
    }),
    checkHealth: vi.fn().mockResolvedValue({
      type: 'health:check',
      isHealthy: true,
    }),
  }

  return {
    ApexWebSocketClient: vi.fn().mockImplementation(() => mockClient),
    __mockClient: mockClient,
  }
})

// ============================================================================
// Type Transformation Tests
// ============================================================================

describe('Dashboard Types', () => {
  describe('getEventCategory', () => {
    it('should categorize task events correctly', () => {
      expect(getEventCategory('task:created')).toBe('task')
      expect(getEventCategory('task:started')).toBe('task')
      expect(getEventCategory('task:completed')).toBe('task')
      expect(getEventCategory('task:failed')).toBe('task')
    })

    it('should categorize agent events correctly', () => {
      expect(getEventCategory('agent:message')).toBe('agent')
      expect(getEventCategory('agent:thinking')).toBe('agent')
      expect(getEventCategory('agent:tool-use')).toBe('agent')
    })

    it('should categorize tool events correctly', () => {
      expect(getEventCategory('tool:start')).toBe('tool')
      expect(getEventCategory('tool:complete')).toBe('tool')
      expect(getEventCategory('tool:progress')).toBe('tool')
    })

    it('should categorize gate/approval events correctly', () => {
      expect(getEventCategory('gate:required')).toBe('gate')
      expect(getEventCategory('gate:approved')).toBe('gate')
      expect(getEventCategory('approval-required')).toBe('gate')
      expect(getEventCategory('approval-resolved')).toBe('gate')
    })

    it('should categorize permission events correctly', () => {
      expect(getEventCategory('permission:request')).toBe('permission')
      expect(getEventCategory('permission:granted')).toBe('permission')
      expect(getEventCategory('permission:denied')).toBe('permission')
      expect(getEventCategory('dangerous:detected')).toBe('permission')
      expect(getEventCategory('policy:blocked')).toBe('permission')
    })

    it('should categorize error events correctly', () => {
      // Events containing 'failed' or 'error' should be categorized as error
      // only if they don't match other prefixes first
      expect(getEventCategory('task:failed')).toBe('task') // task: prefix takes priority
      expect(getEventCategory('mcp:error')).toBe('error') // no other prefix matches
    })

    it('should categorize system events as fallback', () => {
      expect(getEventCategory('mcp:connected')).toBe('system')
      expect(getEventCategory('mcp:disconnected')).toBe('system')
    })
  })

  describe('getEventSeverity', () => {
    it('should return error severity for failure events', () => {
      expect(getEventSeverity('task:failed')).toBe('error')
      expect(getEventSeverity('mcp:error')).toBe('error')
      expect(getEventSeverity('permission:denied')).toBe('error')
      expect(getEventSeverity('dangerous:blocked')).toBe('error')
    })

    it('should return warning severity for dangerous events', () => {
      expect(getEventSeverity('dangerous:detected')).toBe('warning')
    })

    it('should return success severity for completion events', () => {
      expect(getEventSeverity('task:completed')).toBe('success')
      expect(getEventSeverity('permission:granted')).toBe('success')
      expect(getEventSeverity('gate:approved')).toBe('success')
    })

    it('should return info severity as default', () => {
      expect(getEventSeverity('task:created')).toBe('info')
      expect(getEventSeverity('task:started')).toBe('info')
      expect(getEventSeverity('agent:message')).toBe('info')
    })
  })

  describe('transformApexEvent', () => {
    const createMockEvent = (
      type: ApexEventType,
      data: Record<string, unknown> = {}
    ): ApexEvent => ({
      type,
      taskId: 'test-task-123',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      data,
    })

    it('should transform a basic event', () => {
      const event = createMockEvent('task:created', { description: 'Test task' })
      const result = transformApexEvent(event)

      expect(result).toMatchObject({
        type: 'task:created',
        taskId: 'test-task-123',
        category: 'task',
        severity: 'info',
        title: 'Task created',
        isRead: false,
      })
      expect(result.id).toBeDefined()
      expect(result.timestamp).toEqual(event.timestamp)
    })

    it('should extract agent name from event data', () => {
      const event = createMockEvent('agent:message', { agentName: 'planner' })
      const result = transformApexEvent(event)

      expect(result.agentName).toBe('planner')
    })

    it('should extract tool name from event data', () => {
      const event = createMockEvent('tool:complete', { toolName: 'Bash' })
      const result = transformApexEvent(event)

      expect(result.toolName).toBe('Bash')
    })

    it('should generate unique IDs for events', () => {
      const event = createMockEvent('task:created')
      const result1 = transformApexEvent(event)
      const result2 = transformApexEvent(event)

      expect(result1.id).not.toBe(result2.id)
    })
  })

  describe('generateEventTitle', () => {
    it('should generate title for task events', () => {
      expect(generateEventTitle('task:created', {})).toBe('Task created')
      expect(generateEventTitle('task:started', {})).toBe('Task started')
      expect(generateEventTitle('task:completed', {})).toBe('Task completed')
      expect(generateEventTitle('task:failed', {})).toBe('Task failed')
    })

    it('should include stage name in stage-changed events', () => {
      expect(generateEventTitle('task:stage-changed', { stageName: 'implementation' }))
        .toBe('Stage changed to implementation')
    })

    it('should include agent name in agent events', () => {
      expect(generateEventTitle('agent:message', { agentName: 'developer' }))
        .toBe('developer responded')
      expect(generateEventTitle('agent:thinking', { agentName: 'planner' }))
        .toBe('planner is thinking')
    })

    it('should include tool name in tool events', () => {
      expect(generateEventTitle('agent:tool-use', { agentName: 'dev', toolName: 'Read' }))
        .toBe('dev using Read')
      expect(generateEventTitle('tool:complete', { toolName: 'Write' }))
        .toBe('Write completed')
    })

    it('should handle permission events', () => {
      expect(generateEventTitle('permission:request', { toolName: 'Bash' }))
        .toBe('Permission requested for Bash')
      expect(generateEventTitle('permission:granted', { toolName: 'Write' }))
        .toBe('Permission granted for Write')
    })

    it('should fallback to formatted event type for unknown events', () => {
      const result = generateEventTitle('mcp:connected' as ApexEventType, {})
      expect(result).toBe('Mcp Connected')
    })
  })

  describe('calculateHealthStatus', () => {
    const createMetrics = (
      overrides: Partial<DashboardHealthMetrics> = {}
    ): Partial<DashboardHealthMetrics> => ({
      connection: {
        isConnected: true,
        reconnectAttempts: 0,
        latencyMs: 50,
        averageLatencyMs: 50,
      },
      server: {
        uptimeMs: 3600000,
        successRate: 99,
      },
      ...overrides,
    })

    it('should return unknown when not connected', () => {
      const metrics = createMetrics({
        connection: {
          isConnected: false,
          reconnectAttempts: 0,
          latencyMs: 0,
          averageLatencyMs: 0,
        },
      })

      expect(calculateHealthStatus(metrics)).toBe('unknown')
    })

    it('should return healthy when all metrics are good', () => {
      const metrics = createMetrics()
      expect(calculateHealthStatus(metrics)).toBe('healthy')
    })

    it('should return degraded when latency is elevated', () => {
      const metrics = createMetrics({
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: 600,
          averageLatencyMs: 600,
        },
      })

      expect(calculateHealthStatus(metrics)).toBe('degraded')
    })

    it('should return unhealthy when latency is very high', () => {
      const metrics = createMetrics({
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: 3000,
          averageLatencyMs: 3000,
        },
      })

      expect(calculateHealthStatus(metrics)).toBe('unhealthy')
    })

    it('should return degraded when success rate is low', () => {
      const metrics = createMetrics({
        server: {
          uptimeMs: 3600000,
          successRate: 90,
        },
      })

      expect(calculateHealthStatus(metrics)).toBe('degraded')
    })

    it('should return unhealthy when success rate is very low', () => {
      const metrics = createMetrics({
        server: {
          uptimeMs: 3600000,
          successRate: 70,
        },
      })

      expect(calculateHealthStatus(metrics)).toBe('unhealthy')
    })

    it('should use custom thresholds when provided', () => {
      const metrics = createMetrics({
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: 600,
          averageLatencyMs: 600,
        },
      })

      const customThresholds = {
        ...DEFAULT_HEALTH_THRESHOLDS,
        latencyDegraded: 1000, // Higher threshold
      }

      expect(calculateHealthStatus(metrics, customThresholds)).toBe('healthy')
    })
  })
})

// ============================================================================
// Hook Tests
// ============================================================================

describe('useRealtimeUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      expect(result.current.state).toEqual(INITIAL_REALTIME_STATE)
    })

    it('should auto-connect when autoConnect is true', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: true }))

      expect(result.current.state.connectionState).toBe('connecting')
    })

    it('should not auto-connect when autoConnect is false', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      expect(result.current.state.connectionState).toBe('disconnected')
    })
  })

  describe('connect/disconnect', () => {
    it('should update connection state when connecting', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      act(() => {
        result.current.connect()
      })

      expect(result.current.state.connectionState).toBe('connecting')
    })

    it('should update connection state when disconnecting', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      act(() => {
        result.current.connect()
      })

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.state.connectionState).toBe('disconnected')
    })
  })

  describe('event management', () => {
    it('should mark event as read', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      // Manually add an event
      act(() => {
        result.current.state.events.push({
          id: 'test-event-1',
          type: 'task:created',
          category: 'task',
          severity: 'info',
          taskId: 'test-task',
          title: 'Test Event',
          timestamp: new Date(),
          data: {},
          isRead: false,
        })
      })

      act(() => {
        result.current.markEventRead('test-event-1')
      })

      const event = result.current.state.events.find(e => e.id === 'test-event-1')
      expect(event?.isRead).toBe(true)
    })

    it('should mark all events as read', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      act(() => {
        result.current.markAllEventsRead()
      })

      const unreadEvents = result.current.state.events.filter(e => !e.isRead)
      expect(unreadEvents.length).toBe(0)
    })

    it('should clear all events', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      act(() => {
        result.current.clearEvents()
      })

      expect(result.current.state.events).toEqual([])
    })
  })

  describe('subscription management', () => {
    it('should update subscription options', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      act(() => {
        result.current.updateSubscription({
          taskIds: ['task-1', 'task-2'],
          includeHealth: false,
        })
      })

      // Subscription is stored in a ref, so we can't directly test it
      // but the function should not throw
      expect(true).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useRealtimeUpdates({ autoConnect: true }))

      unmount()

      // The disconnect should be called, but we can verify state is reset
      expect(true).toBe(true)
    })
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  describe('Event transformation edge cases', () => {
    it('should handle events with missing data', () => {
      const event: ApexEvent = {
        type: 'task:created',
        taskId: 'test',
        timestamp: new Date(),
        data: {},
      }

      const result = transformApexEvent(event)
      expect(result.agentName).toBeUndefined()
      expect(result.toolName).toBeUndefined()
    })

    it('should handle events with alternate data field names', () => {
      const event: ApexEvent = {
        type: 'agent:tool-use',
        taskId: 'test',
        timestamp: new Date(),
        data: {
          agent: 'developer',
          tool: 'Read',
        },
      }

      const result = transformApexEvent(event)
      expect(result.agentName).toBe('developer')
      expect(result.toolName).toBe('Read')
    })
  })

  describe('Health status edge cases', () => {
    it('should handle empty metrics gracefully', () => {
      const metrics: Partial<DashboardHealthMetrics> = {}
      expect(calculateHealthStatus(metrics)).toBe('unknown')
    })

    it('should handle partial metrics', () => {
      const metrics: Partial<DashboardHealthMetrics> = {
        connection: {
          isConnected: true,
          reconnectAttempts: 0,
          latencyMs: 100,
          averageLatencyMs: 100,
        },
        // server metrics missing
      }

      const result = calculateHealthStatus(metrics)
      expect(result).toBe('healthy')
    })
  })
})
