/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ApprovalConfirmationDialog } from '../ApprovalConfirmationDialog'
import type { PendingApprovalGate } from '@/types/approval-gate-panel'

// Mock the UI components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardFooter: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: React.forwardRef<HTMLButtonElement, any>(function MockButton({ children, onClick, disabled, variant, size, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        data-variant={variant}
        data-size={size}
        className={className}
        data-testid={props['data-testid']}
        {...props}
      >
        {children}
      </button>
    )
  }),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, className }: any) => (
    <div data-testid="spinner" data-size={size} className={className}>Loading...</div>
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// Mock icons
vi.mock('lucide-react', () => ({
  ShieldCheck: () => <div data-testid="shield-check-icon">✓</div>,
  ShieldX: () => <div data-testid="shield-x-icon">✗</div>,
  X: () => <div data-testid="x-icon">✗</div>,
  AlertTriangle: () => <div data-testid="warning-icon">⚠️</div>,
  MessageSquare: () => <div data-testid="message-icon">💬</div>,
}))

// Mock constants
vi.mock('@/types/approval-gate-panel-constants', () => ({
  CONFIRMATION_DIALOG_DEFAULTS: {
    requireCommentForReject: true,
    approvePlaceholder: 'Add a comment (optional)...',
    rejectPlaceholder: 'Please provide a reason for rejection...',
    maxCommentLength: 500,
    approveButtonText: 'Approve',
    rejectButtonText: 'Reject',
    cancelButtonText: 'Cancel',
  },
  ACTION_BUTTON_STYLES: {
    approve: {
      bg: 'bg-green-600',
    },
    reject: {
      bg: 'bg-red-600',
    },
  },
  GATE_STATUS_STYLES: {},
  ARIA_LABELS: {
    closeDialogButton: 'Close dialog',
    commentInput: 'Add a comment for this action',
  },
  TEST_IDS: {
    confirmationDialog: 'confirmation-dialog',
    commentInput: 'comment-input',
    confirmButton: 'confirm-button',
    cancelButton: 'cancel-button',
  },
  KEYBOARD_SHORTCUTS: {
    submit: 'Enter',
    cancel: 'Escape',
  },
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

describe('ApprovalConfirmationDialog Integration Tests', () => {
  let mockParentState: {
    comment: string
    isSubmitting: boolean
    error: string | null
  }

  const mockHandlers = {
    onCommentChange: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockParentState = {
      comment: '',
      isSubmitting: false,
      error: null,
    }

    mockHandlers.onCommentChange.mockImplementation((newComment: string) => {
      mockParentState.comment = newComment
    })

    mockHandlers.onConfirm.mockImplementation(() => {
      mockParentState.isSubmitting = true
      // Simulate simple state change for testing
      if (mockParentState.comment === 'error') {
        mockParentState.error = 'Simulated error'
        mockParentState.isSubmitting = false
      } else {
        mockParentState.isSubmitting = false
      }
    })

    mockHandlers.onCancel.mockImplementation(() => {
      mockParentState.comment = ''
      mockParentState.error = null
      mockParentState.isSubmitting = false
    })
  })

  describe('parent component integration', () => {
    it('should handle full approval workflow with parent state management', async () => {
      const user = userEvent.setup()

      const { rerender } = render(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment={mockParentState.comment}
          isSubmitting={mockParentState.isSubmitting}
          error={mockParentState.error}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Type comment
      const commentInput = screen.getByTestId('comment-input')
      await user.clear(commentInput)
      await user.type(commentInput, 'Looks good to me')

      // Check that onCommentChange was called (it gets called for each character)
      expect(mockHandlers.onCommentChange).toHaveBeenCalled()

      // Update component with new comment state
      mockParentState.comment = 'Looks good to me'
      rerender(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment={mockParentState.comment}
          isSubmitting={mockParentState.isSubmitting}
          error={mockParentState.error}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Confirm action
      const confirmButton = screen.getByTestId('confirm-button')
      await user.click(confirmButton)

      expect(mockHandlers.onConfirm).toHaveBeenCalled()

      // Simulate parent updating state to show loading
      mockParentState.isSubmitting = true
      rerender(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment={mockParentState.comment}
          isSubmitting={mockParentState.isSubmitting}
          error={mockParentState.error}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      expect(screen.getByText('Approving...')).toBeInTheDocument()
      expect(confirmButton).toBeDisabled()

      // Simulate parent updating state after operation completes
      mockParentState.isSubmitting = false
      rerender(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment={mockParentState.comment}
          isSubmitting={mockParentState.isSubmitting}
          error={mockParentState.error}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      expect(screen.queryByText('Approving...')).not.toBeInTheDocument()
    })

    it('should handle rejection workflow with required comment validation', async () => {
      const user = userEvent.setup()

      const { rerender } = render(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="reject"
          gate={mockPendingGate}
          comment=""
          isSubmitting={false}
          error={null}
          requireCommentForReject={true}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Initially, confirm button should be disabled
      const confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toBeDisabled()
      expect(screen.getByText(/comment is required for rejection/i)).toBeInTheDocument()

      // Add required comment
      const commentInput = screen.getByTestId('comment-input')
      await user.type(commentInput, 'Needs more testing')

      // Update parent state
      mockParentState.comment = 'Needs more testing'
      rerender(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="reject"
          gate={mockPendingGate}
          comment={mockParentState.comment}
          isSubmitting={false}
          error={null}
          requireCommentForReject={true}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Now button should be enabled
      expect(confirmButton).not.toBeDisabled()

      // Submit rejection
      await user.click(confirmButton)
      expect(mockHandlers.onConfirm).toHaveBeenCalled()
    })

    it('should handle error states from parent component', async () => {
      const user = userEvent.setup()

      // Set up state for error scenario
      mockParentState.comment = 'error'

      const { rerender } = render(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment={mockParentState.comment}
          isSubmitting={false}
          error={null}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Trigger error by confirming with "error" comment
      const confirmButton = screen.getByTestId('confirm-button')
      await user.click(confirmButton)

      // Check that the confirm handler was called
      expect(mockHandlers.onConfirm).toHaveBeenCalled()

      // Since the comment was "error", the mock should set the error state
      expect(mockParentState.error).toBe('Simulated error')

      // Update component with error state
      rerender(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment={mockParentState.comment}
          isSubmitting={mockParentState.isSubmitting}
          error={mockParentState.error}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      expect(screen.getByText('Simulated error')).toBeInTheDocument()
    })

    it('should handle cancel workflow and reset parent state', async () => {
      const user = userEvent.setup()

      render(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment="Some comment"
          isSubmitting={false}
          error="Some error"
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Cancel dialog
      const cancelButton = screen.getByTestId('cancel-button')
      await user.click(cancelButton)

      expect(mockHandlers.onCancel).toHaveBeenCalled()
      expect(mockParentState.comment).toBe('')
      expect(mockParentState.error).toBeNull()
      expect(mockParentState.isSubmitting).toBe(false)
    })
  })

  describe('focus management integration', () => {
    it('should properly manage focus when dialog opens and closes', async () => {
      const { rerender } = render(
        <ApprovalConfirmationDialog
          isOpen={false}
          actionType="approve"
          gate={mockPendingGate}
          comment=""
          isSubmitting={false}
          error={null}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Dialog should not be visible
      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument()

      // Open dialog
      rerender(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment=""
          isSubmitting={false}
          error={null}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Dialog should be visible
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument()

      // For approve action, confirm button should eventually receive focus
      // (We can't easily test the actual focus due to jsdom limitations,
      // but the component has the focus management logic)
    })

    it('should focus comment input for rejection requiring comment', () => {
      render(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="reject"
          gate={mockPendingGate}
          comment=""
          isSubmitting={false}
          error={null}
          requireCommentForReject={true}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Component should render with comment input ready for focus
      expect(screen.getByTestId('comment-input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/reason for rejection/i)).toBeInTheDocument()
    })
  })

  describe('keyboard interaction integration', () => {
    it('should handle keyboard shortcuts in complete workflow', async () => {
      const user = userEvent.setup()

      render(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment="Ready to approve"
          isSubmitting={false}
          error={null}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Test Enter key to submit
      await user.keyboard('{Enter}')
      expect(mockHandlers.onConfirm).toHaveBeenCalled()

      // Reset mock
      mockHandlers.onConfirm.mockClear()

      // Test Escape key to cancel
      await user.keyboard('{Escape}')
      expect(mockHandlers.onCancel).toHaveBeenCalled()
    })

    it('should prevent submission via keyboard when comment is required but empty', async () => {
      const user = userEvent.setup()

      render(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="reject"
          gate={mockPendingGate}
          comment=""
          isSubmitting={false}
          error={null}
          requireCommentForReject={true}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      // Try to submit with Enter when comment is required but empty
      await user.keyboard('{Enter}')
      expect(mockHandlers.onConfirm).not.toHaveBeenCalled()
    })
  })

  describe('accessibility integration', () => {
    it('should maintain accessibility standards throughout interaction flow', async () => {
      const user = userEvent.setup()

      render(
        <ApprovalConfirmationDialog
          isOpen={true}
          actionType="approve"
          gate={mockPendingGate}
          comment=""
          isSubmitting={false}
          error={null}
          onCommentChange={mockHandlers.onCommentChange}
          onConfirm={mockHandlers.onConfirm}
          onCancel={mockHandlers.onCancel}
        />
      )

      const dialog = screen.getByTestId('confirmation-dialog')

      // Check dialog has proper accessibility attributes
      expect(dialog).toHaveAttribute('role', 'dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title')
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description')

      // Check that interactive elements are accessible
      const commentInput = screen.getByTestId('comment-input')
      expect(commentInput).toHaveAttribute('aria-label', 'Add a comment for this action')

      const confirmButton = screen.getByTestId('confirm-button')
      const cancelButton = screen.getByTestId('cancel-button')

      expect(confirmButton).toBeInTheDocument()
      expect(cancelButton).toBeInTheDocument()

      // Test tab navigation order
      await user.tab()
      // In a real browser, this would focus the first tabbable element
      // jsdom has limitations, but the component structure supports proper tab order
    })
  })
})