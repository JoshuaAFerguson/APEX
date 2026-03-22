/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type {
  PendingApprovalGate,
  ResolvedApprovalGate,
  GateTimeoutEvent,
  GateSkippedEvent,
  ApprovalResolvedEvent,
  GateRejectedEvent,
} from '@/types/approval-gate-panel'

// Mock modules
vi.mock('@/lib/websocket-client', () => ({
  wsClient: {
    isConnected: vi.fn(),
    getHealthState: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    approveGate: vi.fn(),
    rejectGate: vi.fn(),
    listTasks: vi.fn(),
  },
}))

// Get mock references after mocking
import { wsClient } from '@/lib/websocket-client'
import { apiClient } from '@/lib/api-client'

const mockWsClient = wsClient as any
const mockApiClient = apiClient as any

// Import the hook after mocking
import { useApprovalGateWebSocket } from '../hooks/useApprovalGateWebSocket'

// Test data
const mockPendingGate: PendingApprovalGate = {
  id: 'gate-1',
  name: 'test-gate',
  taskId: 'task-1',
  status: 'pending',
  requiredAt: new Date('2024-01-01T10:00:00Z'),
  description: 'Test gate for approval',
  resourceImpact: 'medium',
  gateType: 'pre-execution',
  priority: 5,
  timeoutMs: 300000,
  timeoutAt: new Date('2024-01-01T10:05:00Z'),
}

const mockTimeoutGate: ResolvedApprovalGate = {
  id: 'gate-1',
  name: 'test-gate',
  taskId: 'task-1',
  status: 'timeout',
  requiredAt: new Date('2024-01-01T10:00:00Z'),
  approver: 'system',
  respondedAt: new Date('2024-01-01T10:05:00Z'),
  comment: 'Gate timed out',
  resolutionTimeMs: 300000,
  autoResolved: true,
}

const mockSkippedGate: ResolvedApprovalGate = {
  id: 'gate-2',
  name: 'skipped-gate',
  taskId: 'task-1',
  status: 'skipped',
  requiredAt: new Date('2024-01-01T10:00:00Z'),
  approver: 'system',
  respondedAt: new Date('2024-01-01T10:01:00Z'),
  resolutionReason: 'Auto-skip due to configuration',
  resolutionTimeMs: 60000,
  autoResolved: true,
}

const mockRejectedGate: ResolvedApprovalGate = {
  id: 'gate-1',
  name: 'test-gate',
  taskId: 'task-1',
  status: 'rejected',
  requiredAt: new Date('2024-01-01T10:00:00Z'),
  approver: 'test-user',
  respondedAt: new Date('2024-01-01T10:02:00Z'),
  comment: 'Rejected due to security concerns',
  resolutionTimeMs: 120000,
  autoResolved: false,
}

describe('useApprovalGateWebSocket - Additional Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup default mock implementations
    mockWsClient.isConnected.mockReturnValue(true)
    mockWsClient.getHealthState.mockReturnValue({
      isHealthy: true,
      consecutiveFailures: 0,
      averageLatencyMs: 50,
      lastHealthyAt: new Date(),
      lastCheckAt: new Date(),
    })

    mockApiClient.approveGate.mockResolvedValue(undefined)
    mockApiClient.rejectGate.mockResolvedValue(undefined)
    mockApiClient.listTasks.mockResolvedValue({ tasks: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('WebSocket event handling - additional event types', () => {
    it('should handle gate:timeout events', () => {
      let eventHandler: (event: any) => void

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:timeout') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [mockPendingGate],
        })
      )

      const gateTimeoutEvent: GateTimeoutEvent = {
        type: 'gate:timeout',
        taskId: 'task-1',
        timestamp: new Date(),
        eventId: 'event-timeout',
        data: {
          gate: mockTimeoutGate,
          timeoutMs: 300000,
        },
      }

      act(() => {
        eventHandler!(gateTimeoutEvent)
      })

      expect(result.current.pendingGates).toHaveLength(0)
      expect(result.current.resolvedGates).toContainEqual(mockTimeoutGate)
    })

    it('should handle gate:skipped events', () => {
      let eventHandler: (event: any) => void
      const mockOnGateResolved = vi.fn()

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:skipped') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [{ ...mockPendingGate, id: 'gate-2', name: 'skipped-gate' }],
        })
      )

      // Register external handler
      act(() => {
        result.current.onGateResolved(mockOnGateResolved)
      })

      const gateSkippedEvent: GateSkippedEvent = {
        type: 'gate:skipped',
        taskId: 'task-1',
        timestamp: new Date(),
        eventId: 'event-skip',
        data: {
          gate: mockSkippedGate,
          reason: 'Auto-skip due to configuration',
        },
      }

      act(() => {
        eventHandler!(gateSkippedEvent)
      })

      expect(result.current.pendingGates).toHaveLength(0)
      expect(result.current.resolvedGates).toContainEqual(mockSkippedGate)
      expect(mockOnGateResolved).toHaveBeenCalledWith(mockSkippedGate)
    })

    it('should handle approval-resolved events', () => {
      let eventHandler: (event: any) => void

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'approval-resolved') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [mockPendingGate],
        })
      )

      const approvalResolvedEvent: ApprovalResolvedEvent = {
        type: 'approval-resolved',
        taskId: 'task-1',
        timestamp: new Date(),
        eventId: 'event-resolved',
        data: {
          approvalId: 'approval-1',
          gateName: 'test-gate',
          approved: false,
          approver: 'test-user',
          comment: 'Rejected due to security concerns',
          gate: mockRejectedGate,
        },
      }

      act(() => {
        eventHandler!(approvalResolvedEvent)
      })

      expect(result.current.pendingGates).toHaveLength(0)
      expect(result.current.resolvedGates).toContainEqual(mockRejectedGate)
    })

    it('should handle gate:rejected events', () => {
      let eventHandler: (event: any) => void

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:rejected') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [mockPendingGate],
        })
      )

      const gateRejectedEvent: GateRejectedEvent = {
        type: 'gate:rejected',
        taskId: 'task-1',
        timestamp: new Date(),
        eventId: 'event-reject',
        data: {
          gate: mockRejectedGate,
          approver: 'test-user',
          comment: 'Rejected due to security concerns',
        },
      }

      act(() => {
        eventHandler!(gateRejectedEvent)
      })

      expect(result.current.pendingGates).toHaveLength(0)
      expect(result.current.resolvedGates).toContainEqual(mockRejectedGate)
    })

    it('should prevent duplicate gates when same gate is added multiple times', () => {
      let eventHandler: (event: any) => void

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:required') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [mockPendingGate],
        })
      )

      const gateRequiredEvent = {
        type: 'gate:required' as const,
        taskId: 'task-1',
        timestamp: new Date(),
        eventId: 'event-1',
        data: {
          gate: mockPendingGate,
          approvalId: 'approval-1',
        },
      }

      act(() => {
        eventHandler!(gateRequiredEvent)
      })

      // Should still only have one gate (duplicate prevention)
      expect(result.current.pendingGates).toHaveLength(1)
      expect(result.current.pendingGates[0]).toEqual(mockPendingGate)
    })

    it('should prevent duplicate resolved gates', () => {
      let eventHandler: (event: any) => void

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:approved') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialResolvedGates: [mockTimeoutGate],
        })
      )

      const gateApprovedEvent = {
        type: 'gate:approved' as const,
        taskId: 'task-1',
        timestamp: new Date(),
        eventId: 'event-1',
        data: {
          gate: mockTimeoutGate, // Same gate as initially provided
          approver: 'test-user',
          comment: 'Approved',
        },
      }

      act(() => {
        eventHandler!(gateApprovedEvent)
      })

      // Should still only have one resolved gate (duplicate prevention)
      expect(result.current.resolvedGates).toHaveLength(1)
    })
  })

  describe('connection status management', () => {
    it('should handle reconnecting status when disconnected but health check is recent', () => {
      const recentTime = new Date(Date.now() - 2000) // 2 seconds ago
      mockWsClient.isConnected.mockReturnValue(false)
      mockWsClient.getHealthState.mockReturnValue({
        isHealthy: false,
        consecutiveFailures: 1,
        averageLatencyMs: 0,
        lastCheckAt: recentTime,
      })

      const { result } = renderHook(() => useApprovalGateWebSocket())

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionStatus).toBe('reconnecting')
    })

    it('should handle disconnected status when health check is old', () => {
      const oldTime = new Date(Date.now() - 10000) // 10 seconds ago
      mockWsClient.isConnected.mockReturnValue(false)
      mockWsClient.getHealthState.mockReturnValue({
        isHealthy: false,
        consecutiveFailures: 0,
        averageLatencyMs: 0,
        lastCheckAt: oldTime,
      })

      const { result } = renderHook(() => useApprovalGateWebSocket())

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionStatus).toBe('disconnected')
    })

    it('should handle error status when connected but not healthy', () => {
      mockWsClient.isConnected.mockReturnValue(true)
      mockWsClient.getHealthState.mockReturnValue({
        isHealthy: false,
        consecutiveFailures: 3,
        averageLatencyMs: 2000,
      })

      const { result } = renderHook(() => useApprovalGateWebSocket())

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionStatus).toBe('error')
    })
  })

  describe('refresh functionality', () => {
    it('should refresh gates successfully', async () => {
      const mockTask = {
        id: 'task-1',
        status: 'awaiting-approval',
        gates: [
          mockPendingGate,
          mockTimeoutGate,
        ],
      }

      mockApiClient.listTasks.mockResolvedValue({ tasks: [mockTask] })

      const { result } = renderHook(() => useApprovalGateWebSocket())

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockApiClient.listTasks).toHaveBeenCalledWith({
        status: 'awaiting-approval',
      })
      expect(result.current.pendingGates).toHaveLength(1)
      expect(result.current.resolvedGates).toHaveLength(1)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should refresh gates with taskId filter', async () => {
      mockApiClient.listTasks.mockResolvedValue({ tasks: [] })

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({ taskId: 'specific-task' })
      )

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockApiClient.listTasks).toHaveBeenCalledWith({
        status: 'awaiting-approval',
        taskId: 'specific-task',
      })
    })

    it('should handle refresh API errors', async () => {
      const apiError = new Error('API connection failed')
      mockApiClient.listTasks.mockRejectedValue(apiError)

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({ taskId: 'task-1' })
      )

      let thrownError: Error | null = null
      try {
        await act(async () => {
          await result.current.refresh()
        })
      } catch (error) {
        thrownError = error as Error
      }

      expect(thrownError).toBeTruthy()
      expect(thrownError?.message).toBe('Failed to refresh gates for task task-1: API connection failed')
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle non-Error refresh failures', async () => {
      mockApiClient.listTasks.mockRejectedValue('String error')

      const { result } = renderHook(() => useApprovalGateWebSocket())

      let thrownError: Error | null = null
      try {
        await act(async () => {
          await result.current.refresh()
        })
      } catch (error) {
        thrownError = error as Error
      }

      expect(thrownError).toBeTruthy()
      expect(thrownError?.message).toBe('Failed to refresh gates: Unknown error')
    })

    it('should merge refreshed gates with existing ones without duplicates', async () => {
      const existingGate = { ...mockPendingGate, id: 'existing-gate' }
      const newGate = { ...mockPendingGate, id: 'new-gate' }

      const mockTask = {
        id: 'task-1',
        status: 'awaiting-approval',
        gates: [mockPendingGate, newGate], // mockPendingGate already exists, newGate is new
      }

      mockApiClient.listTasks.mockResolvedValue({ tasks: [mockTask] })

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [existingGate, mockPendingGate],
        })
      )

      await act(async () => {
        await result.current.refresh()
      })

      // Should have existing gates plus the new one, but no duplicates
      expect(result.current.pendingGates).toHaveLength(3)
      expect(result.current.pendingGates.map(g => g.id)).toContain('existing-gate')
      expect(result.current.pendingGates.map(g => g.id)).toContain('gate-1')
      expect(result.current.pendingGates.map(g => g.id)).toContain('new-gate')
    })
  })

  describe('error handling', () => {
    it('should handle WebSocket event processing errors gracefully', () => {
      let eventHandler: (event: any) => void
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:required') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() => useApprovalGateWebSocket())

      // Send malformed event that will cause an error
      const malformedEvent = {
        type: 'gate:required',
        taskId: 'task-1',
        // Missing required fields
      }

      act(() => {
        eventHandler!(malformedEvent)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ApprovalGateWebSocket] Error processing WebSocket event:',
        expect.any(Error)
      )
      expect(result.current.error).toBeInstanceOf(Error)

      consoleSpy.mockRestore()
    })

    it('should handle gate action errors with proper error states', async () => {
      mockApiClient.rejectGate.mockRejectedValue('String error')

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [mockPendingGate],
        })
      )

      let thrownError: Error | null = null
      try {
        await act(async () => {
          await result.current.rejectGate('gate-1', 'Rejection comment')
        })
      } catch (error) {
        thrownError = error as Error
      }

      expect(thrownError).toBeTruthy()
      expect(thrownError?.message).toBe('Failed to reject gate')
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('external handler registration', () => {
    it('should return unregister function from onGateReceived', () => {
      const { result } = renderHook(() => useApprovalGateWebSocket())
      const mockHandler = vi.fn()

      let unregister: (() => void) | undefined

      act(() => {
        unregister = result.current.onGateReceived(mockHandler)
      })

      expect(typeof unregister).toBe('function')

      // Test unregistration
      act(() => {
        if (unregister) {
          unregister()
        }
      })

      // Should not be called after unregistration
      // This would be tested in a more complex scenario with actual event firing
    })

    it('should return unregister function from onGateResolved', () => {
      const { result } = renderHook(() => useApprovalGateWebSocket())
      const mockHandler = vi.fn()

      let unregister: (() => void) | undefined

      act(() => {
        unregister = result.current.onGateResolved(mockHandler)
      })

      expect(typeof unregister).toBe('function')

      // Test unregistration
      act(() => {
        if (unregister) {
          unregister()
        }
      })
    })
  })

  describe('loading state management', () => {
    it('should manage loading state during approve action', async () => {
      // Make API call slow to test loading state
      let resolvePromise: () => void
      const delayedPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve
      })
      mockApiClient.approveGate.mockReturnValue(delayedPromise)

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [mockPendingGate],
        })
      )

      expect(result.current.isLoading).toBe(false)

      // Start the approve action
      act(() => {
        result.current.approveGate('gate-1')
      })

      // Should be loading during the API call
      expect(result.current.isLoading).toBe(true)

      // Resolve the promise to complete the action
      act(() => {
        resolvePromise!()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should manage loading state during refresh action', async () => {
      let resolvePromise: () => void
      const delayedPromise = new Promise<{ tasks: any[] }>((resolve) => {
        resolvePromise = () => resolve({ tasks: [] })
      })
      mockApiClient.listTasks.mockReturnValue(delayedPromise)

      const { result } = renderHook(() => useApprovalGateWebSocket())

      expect(result.current.isLoading).toBe(false)

      // Start the refresh action
      act(() => {
        result.current.refresh()
      })

      // Should be loading during the API call
      expect(result.current.isLoading).toBe(true)

      // Resolve the promise to complete the action
      act(() => {
        resolvePromise!()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})