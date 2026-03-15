/**
 * Edge Case Tests for useRealtimeUpdates Hook
 * Tests complex scenarios, error conditions, and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtimeUpdates } from '../useRealtimeUpdates'
import type { ApexEvent, Task } from '../websocket-client'
import type { DashboardActivityEvent } from '../../types/dashboard'

// Enhanced mock WebSocket client with more detailed state tracking
const createMockClient = () => {
  let isConnectedState = false
  let eventHandlers: Record<string, Function[]> = {}
  let stateHandlers: Function[] = []
  let healthHandlers: Function[] = []

  return {
    connect: vi.fn(() => {
      isConnectedState = true
    }),
    disconnect: vi.fn(() => {
      isConnectedState = false
      eventHandlers = {}
      stateHandlers = []
      healthHandlers = []
    }),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers[event]) eventHandlers[event] = []
      eventHandlers[event].push(handler)
    }),
    off: vi.fn((event: string, handler: Function) => {
      if (eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter(h => h !== handler)
      }
    }),
    onState: vi.fn((handler: Function) => {
      stateHandlers.push(handler)
    }),
    offState: vi.fn((handler: Function) => {
      stateHandlers = stateHandlers.filter(h => h !== handler)
    }),
    onHealth: vi.fn((handler: Function) => {
      healthHandlers.push(handler)
    }),
    offHealth: vi.fn((handler: Function) => {
      healthHandlers = healthHandlers.filter(h => h !== handler)
    }),
    isConnected: vi.fn(() => isConnectedState),
    getHealthState: vi.fn().mockReturnValue({
      isHealthy: true,
      consecutiveFailures: 0,
      averageLatencyMs: 50,
      lastHealthyAt: new Date(),
      lastCheckAt: new Date(),
    }),
    getHealthStatistics: vi.fn().mockReturnValue({
      totalChecks: 10,
      successfulChecks: 10,
      failedChecks: 0,
      uptimePercentage: 100,
      timeSinceLastSuccessMs: 0,
    }),
    checkHealth: vi.fn().mockResolvedValue({
      type: 'health:check',
      isHealthy: true,
    }),
    // Test utilities
    __triggerEvent: (event: ApexEvent) => {
      eventHandlers['*']?.forEach(handler => handler(event))
    },
    __triggerStateUpdate: (tasks: Task[]) => {
      stateHandlers.forEach(handler => handler(tasks))
    },
    __triggerHealthEvent: (event: any) => {
      healthHandlers.forEach(handler => handler(event))
    },
    __setConnected: (connected: boolean) => {
      isConnectedState = connected
    },
    __getEventHandlers: () => eventHandlers,
    __getStateHandlers: () => stateHandlers,
    __getHealthHandlers: () => healthHandlers,
  }
}

let mockClient: ReturnType<typeof createMockClient>

vi.mock('../websocket-client', () => ({
  ApexWebSocketClient: vi.fn(() => mockClient),
}))

describe('useRealtimeUpdates Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockClient = createMockClient()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Memory Management', () => {
    it('should handle memory cleanup when maxEvents is reached', () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        maxEvents: 5
      }))

      act(() => {
        result.current.connect()
      })

      // Add 10 events, should only keep 5
      for (let i = 0; i < 10; i++) {
        const event: ApexEvent = {
          type: 'task:created',
          taskId: `task-${i}`,
          timestamp: new Date(Date.now() + i * 1000),
          data: { index: i }
        }

        act(() => {
          mockClient.__triggerEvent(event)
        })
      }

      expect(result.current.state.events).toHaveLength(5)
      // Should keep the most recent events (5-9)
      const eventIndices = result.current.state.events.map(e => (e.data as any).index).sort()
      expect(eventIndices).toEqual([5, 6, 7, 8, 9])
    })

    it('should handle rapid event bursts without memory leaks', () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        maxEvents: 100
      }))

      act(() => {
        result.current.connect()
      })

      // Simulate rapid burst of 500 events in quick succession
      const events: ApexEvent[] = []
      for (let i = 0; i < 500; i++) {
        events.push({
          type: 'agent:message',
          taskId: 'task-1',
          timestamp: new Date(Date.now() + i),
          data: { message: `Message ${i}` }
        })
      }

      // Process all events at once
      act(() => {
        events.forEach(event => mockClient.__triggerEvent(event))
      })

      // Should limit to maxEvents
      expect(result.current.state.events).toHaveLength(100)
      // Should keep the most recent events
      expect(result.current.state.events[0].data).toEqual({ message: 'Message 499' })
    })
  })

  describe('Event Filtering Edge Cases', () => {
    it('should handle empty filter arrays correctly', () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        subscription: {
          eventTypes: [], // Empty array should allow all events
          taskIds: []     // Empty array should allow all tasks
        }
      }))

      act(() => {
        result.current.connect()
      })

      const events: ApexEvent[] = [
        { type: 'task:created', taskId: 'task-1', timestamp: new Date(), data: {} },
        { type: 'agent:message', taskId: 'task-2', timestamp: new Date(), data: {} },
        { type: 'tool:complete', taskId: 'task-3', timestamp: new Date(), data: {} }
      ]

      act(() => {
        events.forEach(event => mockClient.__triggerEvent(event))
      })

      expect(result.current.state.events).toHaveLength(3)
    })

    it('should handle events with undefined or null taskId', () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        subscription: {
          taskIds: ['task-1'] // Filter by specific task
        }
      }))

      act(() => {
        result.current.connect()
      })

      const events: ApexEvent[] = [
        { type: 'task:created', taskId: 'task-1', timestamp: new Date(), data: {} }, // Should pass
        { type: 'mcp:connected', timestamp: new Date(), data: {} }, // No taskId, should be filtered
        { type: 'health:check', taskId: null as any, timestamp: new Date(), data: {} }, // Null taskId, should be filtered
        { type: 'system:startup', taskId: undefined as any, timestamp: new Date(), data: {} } // Undefined taskId, should be filtered
      ]

      act(() => {
        events.forEach(event => mockClient.__triggerEvent(event))
      })

      expect(result.current.state.events).toHaveLength(1)
      expect(result.current.state.events[0].taskId).toBe('task-1')
    })

    it('should handle subscription updates during active connection', () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        subscription: {
          taskIds: ['task-1']
        }
      }))

      act(() => {
        result.current.connect()
      })

      // Add event for task-1
      act(() => {
        mockClient.__triggerEvent({
          type: 'task:created',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {}
        })
      })

      expect(result.current.state.events).toHaveLength(1)

      // Update subscription to include task-2
      act(() => {
        result.current.updateSubscription({
          taskIds: ['task-1', 'task-2']
        })
      })

      // Add event for task-2
      act(() => {
        mockClient.__triggerEvent({
          type: 'task:created',
          taskId: 'task-2',
          timestamp: new Date(),
          data: {}
        })
      })

      expect(result.current.state.events).toHaveLength(2)

      // Update subscription to exclude task-1
      act(() => {
        result.current.updateSubscription({
          taskIds: ['task-2']
        })
      })

      // Add event for task-1 (should be filtered out now)
      act(() => {
        mockClient.__triggerEvent({
          type: 'task:started',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {}
        })
      })

      // Should still have 2 events (the new task-1 event was filtered)
      expect(result.current.state.events).toHaveLength(2)
    })
  })

  describe('Health Monitoring Edge Cases', () => {
    it('should handle health check failures gracefully', async () => {
      mockClient.checkHealth.mockRejectedValue(new Error('Health check failed'))

      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        subscription: { includeHealth: true }
      }))

      act(() => {
        result.current.connect()
      })

      await act(async () => {
        try {
          await result.current.checkHealth()
        } catch (error) {
          // Should handle the error gracefully
        }
      })

      // Should not crash the hook
      expect(result.current.state.connectionState).toBe('connecting')
    })

    it('should handle malformed health events', () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        subscription: { includeHealth: true }
      }))

      act(() => {
        result.current.connect()
      })

      // Trigger malformed health event
      act(() => {
        mockClient.__triggerHealthEvent({
          type: 'health:unhealthy',
          // Missing required fields
        })
      })

      // Should not crash
      expect(result.current.state.connectionState).toBe('connecting')
    })

    it('should handle health statistics with extreme values', () => {
      mockClient.getHealthStatistics.mockReturnValue({
        totalChecks: Number.MAX_SAFE_INTEGER,
        successfulChecks: 0,
        failedChecks: Number.MAX_SAFE_INTEGER,
        uptimePercentage: -1, // Invalid percentage
        timeSinceLastSuccessMs: Number.MAX_SAFE_INTEGER,
      })

      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        subscription: { includeHealth: true }
      }))

      act(() => {
        result.current.connect()
      })

      // Trigger health update
      mockClient.__setConnected(true)
      act(() => {
        vi.advanceTimersByTime(100)
      })

      // Should handle extreme values without crashing
      expect(result.current.state).toBeDefined()
    })
  })

  describe('Performance Aggregation Edge Cases', () => {
    it('should handle performance events with missing or invalid data', () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        subscription: { includePerformance: true }
      }))

      act(() => {
        result.current.connect()
      })

      const invalidEvents: ApexEvent[] = [
        {
          type: 'usage:updated',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {
            inputTokens: 'invalid' as any, // Should be number
            outputTokens: null,
            estimatedCost: undefined
          }
        },
        {
          type: 'task:completed',
          taskId: 'task-2',
          timestamp: new Date(),
          data: {
            duration: 'not-a-number' as any
          }
        },
        {
          type: 'tool:complete',
          taskId: 'task-3',
          timestamp: new Date(),
          data: {
            toolName: null,
            timing: {
              duration: -1 // Negative duration
            }
          }
        }
      ]

      act(() => {
        invalidEvents.forEach(event => mockClient.__triggerEvent(event))
      })

      // Should handle invalid data gracefully
      expect(result.current.state.events).toHaveLength(3)
    })

    it('should handle performance aggregation with zero durations', () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: false,
        subscription: {
          includePerformance: true,
          performanceUpdateInterval: 100
        }
      }))

      act(() => {
        result.current.connect()
      })

      // Events with zero durations
      const zeroEvents: ApexEvent[] = [
        {
          type: 'task:completed',
          taskId: 'task-1',
          timestamp: new Date(),
          data: { duration: 0 }
        },
        {
          type: 'tool:complete',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {
            toolName: 'FastTool',
            timing: { duration: 0 }
          }
        }
      ]

      act(() => {
        zeroEvents.forEach(event => mockClient.__triggerEvent(event))
      })

      // Trigger performance aggregation
      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.state.events).toHaveLength(2)
    })
  })

  describe('Connection State Transitions', () => {
    it('should handle rapid connection state changes', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      // Rapidly toggle connection state
      act(() => {
        result.current.connect()
      })

      act(() => {
        result.current.disconnect()
      })

      act(() => {
        result.current.connect()
      })

      act(() => {
        result.current.disconnect()
      })

      // Should handle rapid changes gracefully
      expect(result.current.state.connectionState).toBe('disconnected')
    })

    it('should handle connection timeout with retry attempts', async () => {
      mockClient.isConnected.mockReturnValue(false) // Never connects

      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      act(() => {
        result.current.connect()
      })

      // Fast-forward past connection timeout
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('error')
      })

      expect(result.current.state.error).toBeDefined()
      expect(result.current.state.error?.message).toBe('Connection timeout')
    })

    it('should clean up timers on rapid unmount/remount', () => {
      const timerSpy = vi.spyOn(global, 'clearInterval')

      const { unmount, rerender } = renderHook(
        (autoConnect = true) => useRealtimeUpdates({
          autoConnect,
          subscription: { includeHealth: true },
          healthCheckInterval: 1000
        })
      )

      // Unmount and remount rapidly
      unmount()
      rerender(false)
      unmount()

      // Should have called clearInterval for cleanup
      expect(timerSpy).toHaveBeenCalled()

      timerSpy.mockRestore()
    })
  })

  describe('Event Data Validation', () => {
    it('should handle events with circular references in data', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      act(() => {
        result.current.connect()
      })

      // Create circular reference
      const circularData: any = { name: 'test' }
      circularData.self = circularData

      const eventWithCircularRef: ApexEvent = {
        type: 'task:created',
        taskId: 'task-1',
        timestamp: new Date(),
        data: circularData
      }

      // Should handle circular references without throwing
      expect(() => {
        act(() => {
          mockClient.__triggerEvent(eventWithCircularRef)
        })
      }).not.toThrow()

      expect(result.current.state.events).toHaveLength(1)
    })

    it('should handle events with very long timestamps', () => {
      const { result } = renderHook(() => useRealtimeUpdates({ autoConnect: false }))

      act(() => {
        result.current.connect()
      })

      const futureEvent: ApexEvent = {
        type: 'task:created',
        taskId: 'task-future',
        timestamp: new Date('2099-12-31T23:59:59Z'), // Far future
        data: {}
      }

      const pastEvent: ApexEvent = {
        type: 'task:created',
        taskId: 'task-past',
        timestamp: new Date('1970-01-01T00:00:00Z'), // Far past
        data: {}
      }

      act(() => {
        mockClient.__triggerEvent(futureEvent)
        mockClient.__triggerEvent(pastEvent)
      })

      expect(result.current.state.events).toHaveLength(2)
      // Future event should be first (most recent)
      expect(result.current.state.events[0].taskId).toBe('task-future')
    })
  })

  describe('Resource Cleanup', () => {
    it('should properly clean up all resources on unmount', () => {
      const { result, unmount } = renderHook(() => useRealtimeUpdates({
        autoConnect: true,
        subscription: {
          includeHealth: true,
          includePerformance: true
        },
        healthCheckInterval: 1000
      }))

      // Ensure connection is established
      act(() => {
        mockClient.__setConnected(true)
        vi.advanceTimersByTime(100)
      })

      // Add some events and state
      act(() => {
        mockClient.__triggerEvent({
          type: 'task:created',
          taskId: 'task-1',
          timestamp: new Date(),
          data: {}
        })
      })

      expect(result.current.state.events).toHaveLength(1)

      // Unmount should clean up everything
      unmount()

      expect(mockClient.disconnect).toHaveBeenCalled()
    })
  })
})