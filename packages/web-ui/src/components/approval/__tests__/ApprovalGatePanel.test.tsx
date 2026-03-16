/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ApprovalGatePanel } from '../ApprovalGatePanel'
import type { PendingApprovalGate, ResolvedApprovalGate } from '@/types/approval-gate-panel'

// Mock the WebSocket hook
const mockUseApprovalGateWebSocket = {
  pendingGates: [],
  resolvedGates: [],
  isConnected: true,
  connectionStatus: 'connected' as const,
  isLoading: false,
  error: null,
  approveGate: vi.fn(),
  rejectGate: vi.fn(),
  refresh: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  onGateReceived: vi.fn(),
  onGateResolved: vi.fn(),
}

vi.mock('../hooks/useApprovalGateWebSocket', () => ({
  useApprovalGateWebSocket: () => mockUseApprovalGateWebSocket,
}))

// Mock child components for simpler testing
vi.mock('../ApprovalGatePanelHeader', () => ({
  ApprovalGatePanelHeader: ({ pendingCount, onRefresh }: any) => (
    <div data-testid="approval-gate-panel-header">
      <span>Pending: {pendingCount}</span>
      <button onClick={onRefresh}>Refresh</button>
    </div>
  ),
}))

vi.mock('../ApprovalGateItem', () => ({
  ApprovalGateItem: ({ gate, onApprove, onReject }: any) => (
    <div data-testid="approval-gate-item">
      <span>{gate.name}</span>
      <button onClick={() => onApprove('test comment')}>Approve</button>
      <button onClick={() => onReject('test rejection')}>Reject</button>
    </div>
  ),
}))

vi.mock('../ApprovalGateHistoryItem', () => ({
  ApprovalGateHistoryItem: ({ gate }: any) => (
    <div data-testid="approval-gate-history-item">
      <span>{gate.name} - {gate.status}</span>
    </div>
  ),
}))

vi.mock('../ApprovalConfirmationDialog', () => ({
  ApprovalConfirmationDialog: ({ isOpen, onConfirm, onCancel }: any) => (
    isOpen ? (
      <div data-testid="confirmation-dialog">
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
  ),
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
}

const mockResolvedGate: ResolvedApprovalGate = {
  id: 'gate-2',
  name: 'resolved-gate',
  taskId: 'task-1',
  status: 'approved',
  requiredAt: new Date('2024-01-01T10:00:00Z'),
  approver: 'test-user',
  respondedAt: new Date('2024-01-01T10:02:00Z'),
  comment: 'Approved for testing',
  resolutionTimeMs: 120000,
  autoResolved: false,
}

describe('ApprovalGatePanel', () => {
  const defaultProps = {
    taskId: 'task-1',
    approver: 'test-user',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseApprovalGateWebSocket.pendingGates = []
    mockUseApprovalGateWebSocket.resolvedGates = []
    mockUseApprovalGateWebSocket.isLoading = false
    mockUseApprovalGateWebSocket.error = null
    mockUseApprovalGateWebSocket.approveGate.mockResolvedValue(undefined)
    mockUseApprovalGateWebSocket.rejectGate.mockResolvedValue(undefined)
  })

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<ApprovalGatePanel {...defaultProps} />)

      expect(screen.getByText('Pending Approvals')).toBeInTheDocument()
      expect(screen.getByTestId('approval-gate-panel-header')).toBeInTheDocument()
    })

    it('should render pending gates', () => {
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(<ApprovalGatePanel {...defaultProps} />)

      expect(screen.getByTestId('approval-gate-item')).toBeInTheDocument()
      expect(screen.getByText('test-gate')).toBeInTheDocument()
    })

    it('should render resolved gates in history section', () => {
      mockUseApprovalGateWebSocket.resolvedGates = [mockResolvedGate]

      render(<ApprovalGatePanel {...defaultProps} />)

      expect(screen.getByText('History')).toBeInTheDocument()
      expect(screen.getByTestId('approval-gate-history-item')).toBeInTheDocument()
      expect(screen.getByText('resolved-gate - approved')).toBeInTheDocument()
    })

    it('should show empty state for no pending gates', () => {
      render(<ApprovalGatePanel {...defaultProps} />)

      expect(screen.getByText('No Pending Approvals')).toBeInTheDocument()
      expect(screen.getByText('All gates have been resolved. New gates requiring approval will appear here.')).toBeInTheDocument()
    })

    it('should show loading state', () => {
      mockUseApprovalGateWebSocket.isLoading = true

      render(<ApprovalGatePanel {...defaultProps} />)

      expect(screen.getByText('Loading approval gates...')).toBeInTheDocument()
    })

    it('should show error state', () => {
      mockUseApprovalGateWebSocket.error = new Error('Test error')

      render(<ApprovalGatePanel {...defaultProps} />)

      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })
  })

  describe('gate interactions', () => {
    it('should handle gate approval without confirmation', async () => {
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          requireConfirmation={false}
        />
      )

      const approveButton = screen.getByText('Approve')
      await userEvent.click(approveButton)

      expect(mockUseApprovalGateWebSocket.approveGate).toHaveBeenCalledWith('gate-1', 'test comment')
    })

    it('should handle gate rejection without confirmation', async () => {
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          requireConfirmation={false}
        />
      )

      const rejectButton = screen.getByText('Reject')
      await userEvent.click(rejectButton)

      expect(mockUseApprovalGateWebSocket.rejectGate).toHaveBeenCalledWith('gate-1', 'test rejection')
    })

    it('should show confirmation dialog when requireConfirmation is true', async () => {
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          requireConfirmation={true}
        />
      )

      const approveButton = screen.getByText('Approve')
      await userEvent.click(approveButton)

      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument()
    })

    it('should handle confirmation dialog submission', async () => {
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          requireConfirmation={true}
        />
      )

      // Open confirmation dialog
      const approveButton = screen.getByText('Approve')
      await userEvent.click(approveButton)

      // Confirm the action
      const confirmButton = screen.getByText('Confirm')
      await userEvent.click(confirmButton)

      expect(mockUseApprovalGateWebSocket.approveGate).toHaveBeenCalledWith('gate-1', '')
    })

    it('should handle confirmation dialog cancellation', async () => {
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          requireConfirmation={true}
        />
      )

      // Open confirmation dialog
      const approveButton = screen.getByText('Approve')
      await userEvent.click(approveButton)

      // Cancel the action
      const cancelButton = screen.getByText('Cancel')
      await userEvent.click(cancelButton)

      expect(mockUseApprovalGateWebSocket.approveGate).not.toHaveBeenCalled()
      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument()
    })
  })

  describe('callback handling', () => {
    it('should call onGateAction callback', async () => {
      const onGateAction = vi.fn()
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          onGateAction={onGateAction}
          requireConfirmation={false}
        />
      )

      const approveButton = screen.getByText('Approve')
      await userEvent.click(approveButton)

      expect(onGateAction).toHaveBeenCalledWith(mockPendingGate, 'approve', 'test comment')
    })

    it('should call onActionSuccess callback on successful action', async () => {
      const onActionSuccess = vi.fn()
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          onActionSuccess={onActionSuccess}
          requireConfirmation={false}
        />
      )

      const approveButton = screen.getByText('Approve')
      await userEvent.click(approveButton)

      await waitFor(() => {
        expect(onActionSuccess).toHaveBeenCalledWith(mockPendingGate, 'approve')
      })
    })

    it('should call onActionError callback on failed action', async () => {
      const onActionError = vi.fn()
      const testError = new Error('Approval failed')
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]
      mockUseApprovalGateWebSocket.approveGate.mockRejectedValue(testError)

      render(
        <ApprovalGatePanel
          {...defaultProps}
          onActionError={onActionError}
          requireConfirmation={false}
        />
      )

      const approveButton = screen.getByText('Approve')
      await userEvent.click(approveButton)

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith(mockPendingGate, 'approve', testError)
      })
    })
  })

  describe('history section', () => {
    it('should hide history section when showHistory is false', () => {
      mockUseApprovalGateWebSocket.resolvedGates = [mockResolvedGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          showHistory={false}
        />
      )

      expect(screen.queryByText('History')).not.toBeInTheDocument()
    })

    it('should toggle history section visibility', async () => {
      mockUseApprovalGateWebSocket.resolvedGates = [mockResolvedGate]

      render(<ApprovalGatePanel {...defaultProps} />)

      expect(screen.getByTestId('approval-gate-history-item')).toBeInTheDocument()

      const collapseButton = screen.getByText('Collapse')
      await userEvent.click(collapseButton)

      expect(screen.queryByTestId('approval-gate-history-item')).not.toBeInTheDocument()

      const expandButton = screen.getByText('Expand')
      await userEvent.click(expandButton)

      expect(screen.getByTestId('approval-gate-history-item')).toBeInTheDocument()
    })
  })

  describe('read-only mode', () => {
    it('should not show action buttons in read-only mode', () => {
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          readOnly={true}
        />
      )

      expect(screen.queryByText('Approve')).not.toBeInTheDocument()
      expect(screen.queryByText('Reject')).not.toBeInTheDocument()
    })
  })

  describe('real-time updates', () => {
    it('should use WebSocket data when useRealTimeUpdates is true', () => {
      mockUseApprovalGateWebSocket.pendingGates = [mockPendingGate]

      render(
        <ApprovalGatePanel
          {...defaultProps}
          useRealTimeUpdates={true}
        />
      )

      expect(screen.getByText('test-gate')).toBeInTheDocument()
    })

    it('should use prop data when useRealTimeUpdates is false', () => {
      const propPendingGate = {
        ...mockPendingGate,
        name: 'prop-gate',
      }

      render(
        <ApprovalGatePanel
          {...defaultProps}
          pendingGates={[propPendingGate]}
          useRealTimeUpdates={false}
        />
      )

      expect(screen.getByText('prop-gate')).toBeInTheDocument()
      expect(screen.queryByText('test-gate')).not.toBeInTheDocument()
    })
  })

  describe('compact mode', () => {
    it('should render in compact mode', () => {
      render(
        <ApprovalGatePanel
          {...defaultProps}
          compact={true}
        />
      )

      // Component should still render, compact mode affects styling
      expect(screen.getByText('Pending Approvals')).toBeInTheDocument()
    })
  })
})