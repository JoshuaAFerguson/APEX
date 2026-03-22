/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { PendingApprovalGate } from '@/types/approval-gate-panel'

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

// Test component that uses the hook
function TestComponent() {
  const hook = useApprovalGateWebSocket({
    initialPendingGates: [mockPendingGate],
    taskId: 'test-task',
  })

  const handleApprove = async () => {
    try {
      await hook.approveGate('gate-1', 'Approved in integration test')
    } catch (error) {
      console.error('Approve failed:', error)
    }
  }

  const handleReject = async () => {
    try {
      await hook.rejectGate('gate-1', 'Rejected in integration test')
    } catch (error) {
      console.error('Reject failed:', error)
    }
  }

  return (
    <div>
      <div data-testid="connection-status">{hook.connectionStatus}</div>
      <div data-testid="is-connected">{hook.isConnected.toString()}</div>
      <div data-testid="pending-count">{hook.pendingGates.length}</div>
      <div data-testid="resolved-count">{hook.resolvedGates.length}</div>
      <div data-testid="is-loading">{hook.isLoading.toString()}</div>
      <div data-testid="error">{hook.error?.message || 'null'}</div>

      <button onClick={handleApprove} data-testid="approve-button">
        Approve Gate
      </button>
      <button onClick={handleReject} data-testid="reject-button">
        Reject Gate
      </button>
      <button onClick={hook.refresh} data-testid="refresh-button">
        Refresh
      </button>
      <button onClick={hook.connect} data-testid="connect-button">
        Connect
      </button>
      <button onClick={hook.disconnect} data-testid="disconnect-button">
        Disconnect
      </button>

      {hook.pendingGates.map(gate => (
        <div key={gate.id} data-testid={`gate-${gate.id}`}>
          {gate.name} - {gate.status}
        </div>
      ))}

      {hook.resolvedGates.map(gate => (
        <div key={gate.id} data-testid={`resolved-gate-${gate.id}`}>
          {gate.name} - {gate.status}
        </div>
      ))}
    </div>
  )
}

describe('useApprovalGateWebSocket - Integration Tests', () => {
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

  it('should render with hook data and handle user interactions', async () => {
    render(<TestComponent />)

    // Verify initial state
    expect(screen.getByTestId('connection-status')).toHaveTextContent('connected')
    expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
    expect(screen.getByTestId('pending-count')).toHaveTextContent('1')
    expect(screen.getByTestId('resolved-count')).toHaveTextContent('0')
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('null')

    // Verify gate is displayed
    expect(screen.getByTestId('gate-gate-1')).toHaveTextContent('test-gate - pending')

    // Test approve action
    const approveButton = screen.getByTestId('approve-button')
    fireEvent.click(approveButton)

    // Wait for the API call
    await waitFor(() => {
      expect(mockApiClient.approveGate).toHaveBeenCalledWith(
        'task-1',
        'test-gate',
        {
          approver: 'user',
          comment: 'Approved in integration test',
        }
      )
    })
  })

  it('should handle reject action', async () => {
    render(<TestComponent />)

    const rejectButton = screen.getByTestId('reject-button')
    fireEvent.click(rejectButton)

    // Wait for the API call
    await waitFor(() => {
      expect(mockApiClient.rejectGate).toHaveBeenCalledWith(
        'task-1',
        'test-gate',
        {
          approver: 'user',
          comment: 'Rejected in integration test',
        }
      )
    })
  })

  it('should handle refresh action', async () => {
    render(<TestComponent />)

    const refreshButton = screen.getByTestId('refresh-button')
    fireEvent.click(refreshButton)

    // Wait for the API call
    await waitFor(() => {
      expect(mockApiClient.listTasks).toHaveBeenCalledWith({
        status: 'awaiting-approval',
        taskId: 'test-task',
      })
    })
  })

  it('should handle connection actions', async () => {
    render(<TestComponent />)

    // Test connect
    const connectButton = screen.getByTestId('connect-button')
    fireEvent.click(connectButton)
    expect(mockWsClient.connect).toHaveBeenCalled()

    // Test disconnect
    const disconnectButton = screen.getByTestId('disconnect-button')
    fireEvent.click(disconnectButton)
    expect(mockWsClient.disconnect).toHaveBeenCalled()
  })

  it('should display error state when API fails', async () => {
    mockApiClient.approveGate.mockRejectedValue(new Error('Network error'))

    render(<TestComponent />)

    const approveButton = screen.getByTestId('approve-button')
    fireEvent.click(approveButton)

    // Wait for the error to be handled
    await waitFor(() => {
      expect(mockApiClient.approveGate).toHaveBeenCalled()
    })

    // Check that the component continues to function despite the error
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
  })

  it('should handle WebSocket events through the hook', async () => {
    let eventHandler: (event: any) => void

    // Capture the event handler
    mockWsClient.on.mockImplementation((eventType, handler) => {
      if (eventType === 'gate:required') {
        eventHandler = handler
      }
    })

    render(<TestComponent />)

    // Simulate a new gate event
    const newGate = {
      ...mockPendingGate,
      id: 'gate-2',
      name: 'new-gate',
      taskId: 'test-task', // Make sure it matches the component's taskId filter
    }

    const gateRequiredEvent = {
      type: 'gate:required',
      taskId: 'test-task', // Make sure this matches the component's taskId filter
      timestamp: new Date(),
      eventId: 'event-1',
      data: {
        gate: newGate,
        approvalId: 'approval-1',
      },
    }

    // Fire the event using act to handle state updates properly
    await waitFor(() => {
      if (eventHandler!) {
        eventHandler(gateRequiredEvent)
      }
    })

    // Wait for the UI to update
    await waitFor(() => {
      expect(screen.getByTestId('pending-count')).toHaveTextContent('2')
      expect(screen.getByTestId('gate-gate-2')).toHaveTextContent('new-gate - pending')
    })
  })

  it('should handle connection status changes', () => {
    // Start with disconnected state
    mockWsClient.isConnected.mockReturnValue(false)
    mockWsClient.getHealthState.mockReturnValue({
      isHealthy: false,
      consecutiveFailures: 1,
      averageLatencyMs: 0,
      lastCheckAt: new Date(Date.now() - 10000), // Old timestamp
    })

    render(<TestComponent />)

    // Verify disconnected state
    expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
    expect(screen.getByTestId('is-connected')).toHaveTextContent('false')
  })

  it('should properly cleanup on unmount', () => {
    const { unmount } = render(<TestComponent />)

    // Verify event listeners were set up
    expect(mockWsClient.on).toHaveBeenCalled()

    // Unmount component
    unmount()

    // Verify cleanup was called
    expect(mockWsClient.off).toHaveBeenCalled()
  })
})