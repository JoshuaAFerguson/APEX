/**
 * Integration tests for useRealtimeUpdates hook
 * Tests real WebSocket scenarios and end-to-end functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtimeUpdates } from '../useRealtimeUpdates'
import type { ApexEvent, Task } from '../websocket-client'
import type { DashboardHealthMetrics } from '../../types/dashboard'

// Mock WebSocket for integration testing
class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = MockWebSocket.CLOSED
  url: string
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.(new Event('open'))
    }, 10)
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    // Mock sending data
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    setTimeout(() => {
      this.onclose?.(new CloseEvent('close', { code: code || 1000, reason }))
    }, 10)
  }

  // Simulate receiving a message
  simulateMessage(data: any) {
    if (this.readyState === MockWebSocket.OPEN && this.onmessage) {
      this.onmessage(new MessageEvent('message', {
        data: JSON.stringify(data)
      }))
    }
  }

  // Simulate connection error
  simulateError() {
    this.onerror?.(new Event('error'))
  }
}

// Mock WebSocket globally
const originalWebSocket = global.WebSocket
let mockWebSocketInstance: MockWebSocket | null = null

beforeEach(() => {
  mockWebSocketInstance = null
  global.WebSocket = class extends MockWebSocket {
    constructor(url: string) {
      super(url)
      mockWebSocketInstance = this
    }
  } as any
})

afterEach(() => {
  global.WebSocket = originalWebSocket
})

describe('useRealtimeUpdates Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Full Connection Flow', () => {
    it('should connect and receive initial state', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true,
        subscription: {
          includeHealth: true,
          includePerformance: true
        }
      }))

      // Initially should be connecting
      expect(result.current.state.connectionState).toBe('connecting')

      // Advance timers to allow connection to establish
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Simulate initial state message
      if (mockWebSocketInstance) {
        act(() => {
          mockWebSocketInstance!.simulateMessage({
            type: 'task:state',
            tasks: [
              {
                id: 'task-1',
                description: 'Test task',
                status: 'running',
                workflow: 'test-workflow',
                createdAt: new Date('2024-01-15T10:00:00Z'),
                updatedAt: new Date('2024-01-15T10:05:00Z')
              }
            ]
          })
        })
      }

      // Health should be updated
      await waitFor(() => {
        expect(result.current.state.health).toBeDefined()
      })
    })

    it('should handle real-time event stream', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true
      }))

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Simulate a sequence of events
      const events = [
        {
          type: 'task:created',
          taskId: 'task-1',
          timestamp: new Date('2024-01-15T10:00:00Z').toISOString(),
          data: { description: 'New task created' }
        },
        {
          type: 'task:started',
          taskId: 'task-1',
          timestamp: new Date('2024-01-15T10:01:00Z').toISOString(),
          data: { agentName: 'planner' }
        },
        {
          type: 'agent:thinking',
          taskId: 'task-1',
          timestamp: new Date('2024-01-15T10:02:00Z').toISOString(),
          data: { agentName: 'planner', message: 'Analyzing requirements' }
        },
        {
          type: 'agent:tool-use',
          taskId: 'task-1',
          timestamp: new Date('2024-01-15T10:03:00Z').toISOString(),
          data: { agentName: 'planner', toolName: 'Read' }
        },
        {
          type: 'tool:complete',
          taskId: 'task-1',
          timestamp: new Date('2024-01-15T10:04:00Z').toISOString(),
          data: { toolName: 'Read', result: { success: true } }
        },
        {
          type: 'task:completed',
          taskId: 'task-1',
          timestamp: new Date('2024-01-15T10:05:00Z').toISOString(),
          data: { result: 'Task completed successfully' }
        }
      ]

      if (mockWebSocketInstance) {
        act(() => {
          events.forEach(event => {
            mockWebSocketInstance!.simulateMessage(event)
          })
        })
      }

      // All events should be received and transformed
      expect(result.current.state.events).toHaveLength(6)

      // Events should be in reverse chronological order (most recent first)
      const eventTypes = result.current.state.events.map(e => e.type)
      expect(eventTypes).toEqual([
        'task:completed',
        'tool:complete',
        'agent:tool-use',
        'agent:thinking',
        'task:started',
        'task:created'
      ])

      // Verify event transformations
      const taskCompleted = result.current.state.events[0]
      expect(taskCompleted.title).toBe('Task completed')
      expect(taskCompleted.severity).toBe('success')
      expect(taskCompleted.category).toBe('task')

      const agentToolUse = result.current.state.events[2]
      expect(agentToolUse.agentName).toBe('planner')
      expect(agentToolUse.toolName).toBe('Read')
      expect(agentToolUse.title).toBe('planner using Read')
    })

    it('should handle connection loss and reconnection', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true,
        subscription: { includeHealth: true }
      }))

      // Wait for initial connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Simulate connection loss
      if (mockWebSocketInstance) {
        act(() => {
          mockWebSocketInstance!.close(1006, 'Connection lost')
        })

        vi.advanceTimersByTime(50)
      }

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('reconnecting')
      }, { timeout: 3000 })

      // Health should be marked as unhealthy
      expect(result.current.state.health?.connection.isConnected).toBe(false)
    })
  })

  describe('Health Monitoring Integration', () => {
    it('should perform health checks periodically', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true,
        subscription: {
          includeHealth: true
        },
        healthCheckInterval: 1000 // 1 second for testing
      }))

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Initial health should be set
      await waitFor(() => {
        expect(result.current.state.health).toBeDefined()
      })

      const initialHealthUpdate = result.current.state.lastUpdate

      // Advance time to trigger health check
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Health should be updated
      await waitFor(() => {
        expect(result.current.state.lastUpdate).not.toEqual(initialHealthUpdate)
      })
    })

    it('should handle ping/pong health checks', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true,
        subscription: { includeHealth: true }
      }))

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Simulate server ping
      if (mockWebSocketInstance) {
        act(() => {
          mockWebSocketInstance!.simulateMessage({
            type: 'ping',
            timestamp: Date.now()
          })
        })
      }

      // Should handle ping message (though we can't directly verify pong response in this test)
      expect(result.current.state.connectionState).toBe('connected')
    })
  })

  describe('Performance Data Integration', () => {
    it('should aggregate performance data from real events', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true,
        subscription: {
          includePerformance: true,
          performanceUpdateInterval: 500
        }
      }))

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Simulate performance-related events
      const performanceEvents = [
        {
          type: 'usage:updated',
          taskId: 'task-1',
          timestamp: new Date().toISOString(),
          data: {
            inputTokens: 100,
            outputTokens: 50,
            estimatedCost: 0.01,
            agentName: 'planner'
          }
        },
        {
          type: 'task:completed',
          taskId: 'task-1',
          timestamp: new Date().toISOString(),
          data: {
            duration: 5000,
            result: 'success'
          }
        },
        {
          type: 'tool:complete',
          taskId: 'task-1',
          timestamp: new Date().toISOString(),
          data: {
            toolName: 'Write',
            timing: { duration: 1200 },
            result: { success: true }
          }
        }
      ]

      if (mockWebSocketInstance) {
        act(() => {
          performanceEvents.forEach(event => {
            mockWebSocketInstance!.simulateMessage(event)
          })
        })
      }

      // Advance time to trigger performance aggregation
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // Events should be processed
      expect(result.current.state.events).toHaveLength(3)

      // Performance data aggregation happens internally
      // We can verify events were received and categorized correctly
      const usageEvent = result.current.state.events.find(e => e.type === 'usage:updated')
      const taskEvent = result.current.state.events.find(e => e.type === 'task:completed')
      const toolEvent = result.current.state.events.find(e => e.type === 'tool:complete')

      expect(usageEvent).toBeDefined()
      expect(taskEvent?.severity).toBe('success')
      expect(toolEvent?.toolName).toBe('Write')
    })

    it('should handle performance refresh', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true,
        subscription: { includePerformance: true }
      }))

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Trigger manual performance refresh
      expect(() => {
        act(() => {
          result.current.refreshPerformance()
        })
      }).not.toThrow()
    })
  })

  describe('Task State Management Integration', () => {
    it('should track task states through state events', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true
      }))

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Simulate task state updates
      const tasks: Task[] = [
        {
          id: 'task-1',
          description: 'First task',
          status: 'running',
          workflow: 'test',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedAt: new Date('2024-01-15T10:01:00Z')
        },
        {
          id: 'task-2',
          description: 'Second task',
          status: 'pending',
          workflow: 'test',
          createdAt: new Date('2024-01-15T10:02:00Z'),
          updatedAt: new Date('2024-01-15T10:02:00Z')
        }
      ]

      if (mockWebSocketInstance) {
        act(() => {
          mockWebSocketInstance!.simulateMessage({
            type: 'task:state',
            tasks
          })
        })
      }

      // Health metrics should reflect task counts
      await waitFor(() => {
        const health = result.current.state.health
        expect(health?.tasks.activeTasks).toBe(1) // 1 running task
        expect(health?.tasks.pendingTasks).toBe(1) // 1 pending task
      })
    })
  })

  describe('Event Management Integration', () => {
    it('should handle event read state management', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true
      }))

      // Wait for connection and add events
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Add test events
      if (mockWebSocketInstance) {
        act(() => {
          mockWebSocketInstance!.simulateMessage({
            type: 'task:created',
            taskId: 'task-1',
            timestamp: new Date().toISOString(),
            data: {}
          })
          mockWebSocketInstance!.simulateMessage({
            type: 'task:started',
            taskId: 'task-1',
            timestamp: new Date().toISOString(),
            data: {}
          })
        })
      }

      // Should have 2 unread events
      expect(result.current.state.events).toHaveLength(2)
      expect(result.current.state.events.every(e => !e.isRead)).toBe(true)

      // Mark first event as read
      act(() => {
        result.current.markEventRead(result.current.state.events[0].id)
      })

      expect(result.current.state.events[0].isRead).toBe(true)
      expect(result.current.state.events[1].isRead).toBe(false)

      // Mark all as read
      act(() => {
        result.current.markAllEventsRead()
      })

      expect(result.current.state.events.every(e => e.isRead)).toBe(true)

      // Clear all events
      act(() => {
        result.current.clearEvents()
      })

      expect(result.current.state.events).toHaveLength(0)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle WebSocket errors gracefully', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true
      }))

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Simulate WebSocket error
      if (mockWebSocketInstance) {
        act(() => {
          mockWebSocketInstance!.simulateError()
        })
      }

      // Should handle error gracefully and attempt reconnection
      expect(result.current.state.connectionState).not.toBe('connected')
    })

    it('should handle malformed messages gracefully', async () => {
      const { result } = renderHook(() => useRealtimeUpdates({
        autoConnect: true
      }))

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Send malformed message
      if (mockWebSocketInstance && mockWebSocketInstance.onmessage) {
        act(() => {
          // Simulate malformed JSON
          mockWebSocketInstance!.onmessage(new MessageEvent('message', {
            data: 'invalid-json{'
          }))
        })
      }

      // Should continue working despite malformed message
      expect(result.current.state.connectionState).toBe('connected')

      // Valid message should still work
      if (mockWebSocketInstance) {
        act(() => {
          mockWebSocketInstance!.simulateMessage({
            type: 'task:created',
            taskId: 'task-1',
            timestamp: new Date().toISOString(),
            data: {}
          })
        })
      }

      expect(result.current.state.events).toHaveLength(1)
    })
  })

  describe('Cleanup Integration', () => {
    it('should properly cleanup on unmount', async () => {
      const { result, unmount } = renderHook(() => useRealtimeUpdates({
        autoConnect: true,
        subscription: { includeHealth: true }
      }))

      // Wait for connection
      act(() => {
        vi.advanceTimersByTime(50)
      })

      await waitFor(() => {
        expect(result.current.state.connectionState).toBe('connected')
      })

      // Unmount should trigger cleanup
      unmount()

      // WebSocket should be closed
      if (mockWebSocketInstance) {
        expect(mockWebSocketInstance.readyState).toBe(MockWebSocket.CLOSED)
      }
    })
  })
})