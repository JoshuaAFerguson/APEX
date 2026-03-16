/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useApprovalGateWebSocket } from '../hooks/useApprovalGateWebSocket'
import type {
  PendingApprovalGate,
  ResolvedApprovalGate,
  GateRequiredEvent,
  GateApprovedEvent,
} from '@/types/approval-gate-panel'

// Mock the WebSocket client
const mockWsClient = {
  isConnected: vi.fn(),
  getHealthState: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}

// Mock the API client
const mockApiClient = {
  approveGate: vi.fn(),
  rejectGate: vi.fn(),
  listTasks: vi.fn(),
}

// Mock modules
vi.mock('@/lib/websocket-client', () => ({
  wsClient: mockWsClient,
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient,
}))

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

const mockResolvedGate: ResolvedApprovalGate = {
  id: 'gate-1',
  name: 'test-gate',
  taskId: 'task-1',
  status: 'approved',
  requiredAt: new Date('2024-01-01T10:00:00Z'),
  approver: 'test-user',
  respondedAt: new Date('2024-01-01T10:02:00Z'),
  comment: 'Approved for testing',
  resolutionTimeMs: 120000,
  autoResolved: false,
}

describe('useApprovalGateWebSocket', () => {
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
    mockApiClient.listTasks.mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useApprovalGateWebSocket())

      expect(result.current.pendingGates).toEqual([])
      expect(result.current.resolvedGates).toEqual([])
      expect(result.current.isConnected).toBe(true)
      expect(result.current.connectionStatus).toBe('connected')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should initialize with provided initial gates', () => {
      const initialPending = [mockPendingGate]
      const initialResolved = [mockResolvedGate]

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: initialPending,
          initialResolvedGates: initialResolved,
        })
      )

      expect(result.current.pendingGates).toEqual(initialPending)
      expect(result.current.resolvedGates).toEqual(initialResolved)
    })

    it('should not auto-connect when autoConnect is false', () => {
      renderHook(() =>
        useApprovalGateWebSocket({
          autoConnect: false,
        })
      )

      expect(mockWsClient.connect).not.toHaveBeenCalled()
    })

    it('should set up WebSocket event listeners', () => {
      renderHook(() => useApprovalGateWebSocket())

      const expectedEvents = [
        'gate:required',
        'gate:approved',
        'gate:rejected',
        'gate:timeout',
        'gate:skipped',
        'approval-required',
        'approval-resolved',
      ]

      expectedEvents.forEach(eventType => {
        expect(mockWsClient.on).toHaveBeenCalledWith(eventType, expect.any(Function))
      })
    })
  })

  describe('WebSocket event handling', () => {
    it('should add new pending gate on gate:required event', () => {
      let eventHandler: (event: any) => void

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:required') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() => useApprovalGateWebSocket())

      const gateRequiredEvent: GateRequiredEvent = {
        type: 'gate:required',
        taskId: 'task-1',
        timestamp: new Date(),
        eventId: 'event-1',
        data: {
          gate: mockPendingGate,
          approvalId: 'approval-1',
          description: 'Test approval required',
        },
      }

      act(() => {
        eventHandler!(gateRequiredEvent)
      })

      expect(result.current.pendingGates).toContainEqual(mockPendingGate)
    })

    it('should move gate from pending to resolved on gate:approved event', () => {
      let gateRequiredHandler: (event: any) => void
      let gateApprovedHandler: (event: any) => void

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:required') {
          gateRequiredHandler = handler
        } else if (eventType === 'gate:approved') {
          gateApprovedHandler = handler
        }
      })

      const { result } = renderHook(() => useApprovalGateWebSocket())

      // First add a pending gate
      const gateRequiredEvent: GateRequiredEvent = {
        type: 'gate:required',
        taskId: 'task-1',
        timestamp: new Date(),
        eventId: 'event-1',
        data: {
          gate: mockPendingGate,
          approvalId: 'approval-1',
        },
      }

      act(() => {
        gateRequiredHandler!(gateRequiredEvent)
      })

      expect(result.current.pendingGates).toHaveLength(1)

      // Then approve it
      const gateApprovedEvent: GateApprovedEvent = {
        type: 'gate:approved',
        taskId: 'task-1',
        timestamp: new Date(),
        eventId: 'event-2',
        data: {
          gate: mockResolvedGate,
          approver: 'test-user',
          comment: 'Approved for testing',
        },
      }

      act(() => {
        gateApprovedHandler!(gateApprovedEvent)
      })

      expect(result.current.pendingGates).toHaveLength(0)
      expect(result.current.resolvedGates).toContainEqual(mockResolvedGate)
    })

    it('should filter events by taskId when provided', () => {
      let eventHandler: (event: any) => void

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:required') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({ taskId: 'task-specific' })
      )

      const gateRequiredEvent: GateRequiredEvent = {
        type: 'gate:required',
        taskId: 'different-task',
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

      // Should not add the gate because taskId doesn't match
      expect(result.current.pendingGates).toHaveLength(0)
    })
  })

  describe('gate actions', () => {
    it('should approve gate successfully', async () => {
      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [mockPendingGate],
        })
      )

      await act(async () => {
        await result.current.approveGate('gate-1', 'Test approval comment')
      })

      expect(mockApiClient.approveGate).toHaveBeenCalledWith('task-1', 'test-gate', {
        approver: 'user',
        comment: 'Test approval comment',
      })
    })

    it('should reject gate successfully', async () => {
      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [mockPendingGate],
        })
      )

      await act(async () => {
        await result.current.rejectGate('gate-1', 'Test rejection comment')
      })

      expect(mockApiClient.rejectGate).toHaveBeenCalledWith('task-1', 'test-gate', {
        approver: 'user',
        comment: 'Test rejection comment',
      })
    })

    it('should handle API errors gracefully', async () => {
      mockApiClient.approveGate.mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() =>
        useApprovalGateWebSocket({
          initialPendingGates: [mockPendingGate],
        })
      )

      await expect(
        act(async () => {
          await result.current.approveGate('gate-1', 'Test comment')
        })
      ).rejects.toThrow('API Error')

      expect(result.current.error).toEqual(expect.any(Error))
    })

    it('should throw error for non-existent gate', async () => {
      const { result } = renderHook(() => useApprovalGateWebSocket())

      await expect(
        act(async () => {
          await result.current.approveGate('non-existent', 'Test comment')
        })
      ).rejects.toThrow('Gate not found')
    })
  })

  describe('connection management', () => {
    it('should handle connection state changes', () => {
      // Mock disconnected state
      mockWsClient.isConnected.mockReturnValue(false)
      mockWsClient.getHealthState.mockReturnValue({
        isHealthy: false,
        consecutiveFailures: 3,
        averageLatencyMs: 0,
      })

      const { result } = renderHook(() => useApprovalGateWebSocket())

      expect(result.current.isConnected).toBe(false)
      expect(result.current.connectionStatus).toBe('disconnected')
    })

    it('should connect when connect() is called', () => {
      const { result } = renderHook(() => useApprovalGateWebSocket())

      act(() => {
        result.current.connect()
      })

      expect(mockWsClient.connect).toHaveBeenCalled()
    })

    it('should disconnect when disconnect() is called', () => {
      const { result } = renderHook(() => useApprovalGateWebSocket())

      act(() => {
        result.current.disconnect()
      })

      expect(mockWsClient.disconnect).toHaveBeenCalled()
    })
  })

  describe('external event handlers', () => {
    it('should register and call external gate received handlers', () => {
      let eventHandler: (event: any) => void
      const mockHandler = vi.fn()

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:required') {
          eventHandler = handler
        }
      })

      const { result } = renderHook(() => useApprovalGateWebSocket())

      // Register external handler
      act(() => {
        result.current.onGateReceived(mockHandler)
      })

      const gateRequiredEvent: GateRequiredEvent = {
        type: 'gate:required',
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

      expect(mockHandler).toHaveBeenCalledWith(mockPendingGate)
    })

    it('should handle errors in external handlers gracefully', () => {
      let eventHandler: (event: any) => void
      const mockHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error')
      })

      mockWsClient.on.mockImplementation((eventType, handler) => {
        if (eventType === 'gate:required') {
          eventHandler = handler
        }
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useApprovalGateWebSocket())

      act(() => {
        result.current.onGateReceived(mockHandler)
      })

      const gateRequiredEvent: GateRequiredEvent = {
        type: 'gate:required',
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

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ApprovalGateWebSocket] Error in gate received handler:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useApprovalGateWebSocket())

      unmount()

      const expectedEvents = [
        'gate:required',
        'gate:approved',
        'gate:rejected',
        'gate:timeout',
        'gate:skipped',
        'approval-required',
        'approval-resolved',
      ]

      expectedEvents.forEach(eventType => {
        expect(mockWsClient.off).toHaveBeenCalledWith(eventType, expect.any(Function))
      })
    })
  })
})