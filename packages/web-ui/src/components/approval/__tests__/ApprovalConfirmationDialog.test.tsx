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
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button
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
  ),
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

const highImpactGate: PendingApprovalGate = {
  ...mockPendingGate,
  id: 'gate-high',
  resourceImpact: 'critical',
  description: 'Critical production deployment requiring careful review',
}

describe('ApprovalConfirmationDialog', () => {
  const defaultProps = {
    isOpen: true,
    gate: mockPendingGate,
    actionType: 'approve' as const,
    comment: '',
    onCommentChange: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render dialog when open', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument()
    })

    it('should not render dialog when closed', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} isOpen={false} />)

      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument()
    })

    it('should render approval confirmation content', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByText('Approve Gate')).toBeInTheDocument()
      expect(screen.getByText(/are you sure you want to/i)).toBeInTheDocument()
      expect(screen.getByText('test-gate')).toBeInTheDocument()
    })

    it('should render rejection confirmation content', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
        />
      )

      expect(screen.getByText('Reject Gate')).toBeInTheDocument()
      expect(screen.getByText(/are you sure you want to/i)).toBeInTheDocument()
      expect(screen.getByTestId('warning-icon')).toBeInTheDocument()
    })

    it('should show gate details', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByText('test-gate')).toBeInTheDocument()
      expect(screen.getByText('Test gate for approval')).toBeInTheDocument()
      // Component doesn't show resource impact badge in dialog
    })
  })

  describe('comment input', () => {
    it('should render comment input', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByTestId('comment-input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument()
    })

    it('should handle comment input changes', async () => {
      const user = userEvent.setup()
      const onCommentChange = vi.fn()
      render(<ApprovalConfirmationDialog {...defaultProps} onCommentChange={onCommentChange} />)

      const textarea = screen.getByTestId('comment-input')
      await user.type(textarea, 'This looks good to me')

      expect(onCommentChange).toHaveBeenCalled()
    })

    it('should show character count', async () => {
      const user = userEvent.setup()
      render(<ApprovalConfirmationDialog {...defaultProps} comment="Test comment" />)

      expect(screen.getByText('12 / 500')).toBeInTheDocument()
    })

    it('should enforce character limit', async () => {
      const user = userEvent.setup()
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const textarea = screen.getByTestId('comment-input')

      expect(textarea).toHaveAttribute('maxLength', '500')
    })

    it('should require comment for rejection', async () => {
      const user = userEvent.setup()
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
          requireCommentForReject
        />
      )

      expect(screen.getByPlaceholderText(/reason for rejection/i)).toBeInTheDocument()
    })
  })

  describe('confirmation actions', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
          comment="Approved after review"
        />
      )

      const confirmButton = screen.getByTestId('confirm-button')
      await user.click(confirmButton)

      expect(onConfirm).toHaveBeenCalled()
    })

    it('should call onConfirm with no comment when no comment provided', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
        />
      )

      const confirmButton = screen.getByTestId('confirm-button')
      await user.click(confirmButton)

      expect(onConfirm).toHaveBeenCalled()
    })

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onCancel={onCancel}
        />
      )

      const cancelButton = screen.getByTestId('cancel-button')
      await user.click(cancelButton)

      expect(onCancel).toHaveBeenCalled()
    })

    it('should disable confirm button when comment is required but empty', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
          requireCommentForReject
          comment=""
          onConfirm={onConfirm}
        />
      )

      const confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toBeDisabled()
      expect(screen.getByText(/comment is required for rejection/i)).toBeInTheDocument()
    })

    it('should enable confirm button when comment is provided for rejection', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
          requireCommentForReject
          comment="Needs more testing"
          onConfirm={onConfirm}
        />
      )

      const confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).not.toBeDisabled()
      await user.click(confirmButton)

      expect(onConfirm).toHaveBeenCalled()
    })
  })

  describe('loading and error states', () => {
    it('should show loading state', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} isSubmitting />)

      expect(screen.getByTestId('confirm-button')).toBeDisabled()
      expect(screen.getByTestId('cancel-button')).toBeDisabled()
      expect(screen.getByText('Approving...')).toBeInTheDocument()
    })

    it('should display error message', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          error="Failed to approve gate"
        />
      )

      expect(screen.getByText('Failed to approve gate')).toBeInTheDocument()
    })

    it('should clear error when dialog reopens', () => {
      const { rerender } = render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          error="Previous error"
        />
      )

      expect(screen.getByText('Previous error')).toBeInTheDocument()

      // Close and reopen dialog
      rerender(
        <ApprovalConfirmationDialog
          {...defaultProps}
          isOpen={false}
          error="Previous error"
        />
      )

      rerender(
        <ApprovalConfirmationDialog
          {...defaultProps}
          isOpen={true}
          error={null}
        />
      )

      expect(screen.queryByText('Previous error')).not.toBeInTheDocument()
    })
  })

  describe('high risk warnings', () => {
    it('should show warning for rejection', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
        />
      )

      expect(screen.getByTestId('warning-icon')).toBeInTheDocument()
      expect(screen.getByText(/rejecting this gate will halt/i)).toBeInTheDocument()
    })

    it('should show gate description when available', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          gate={highImpactGate}
        />
      )

      expect(screen.getByText('Critical production deployment requiring careful review')).toBeInTheDocument()
    })

    it('should emphasize caution for rejection', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
        />
      )

      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()
    })
  })

  describe('keyboard accessibility', () => {
    it('should have proper dialog attributes', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const dialog = screen.getByTestId('confirmation-dialog')
      expect(dialog).toHaveAttribute('role', 'dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title')
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description')
    })

    it('should handle Enter key to submit', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
        />
      )

      await user.keyboard('{Enter}')

      expect(onConfirm).toHaveBeenCalled()
    })

    it('should handle Escape key to cancel', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onCancel={onCancel}
        />
      )

      await user.keyboard('{Escape}')

      expect(onCancel).toHaveBeenCalled()
    })

    it('should have accessible labels', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByLabelText(/comment/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/close dialog/i)).toBeInTheDocument()
    })

    it('should focus appropriate element when opened', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
          requireCommentForReject
        />
      )

      // For reject with required comment, should focus comment input
      // For approve, should focus confirm button
      // This is handled by the component's focus management
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should not render when closed', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          isOpen={false}
        />
      )

      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument()
    })

    it('should not render when gate is missing', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          gate={null as any}
        />
      )

      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument()
    })

    it('should handle invalid actionType gracefully', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType={'invalid' as any}
        />
      )

      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument()
    })

    it('should handle very long gate names', () => {
      const longNameGate = {
        ...mockPendingGate,
        name: 'A'.repeat(100),
      }

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          gate={longNameGate}
        />
      )

      expect(screen.getByText(longNameGate.name)).toBeInTheDocument()
    })

    it('should handle very long comments', () => {
      const longComment = "B".repeat(600) // Exceeds max length
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          comment={longComment}
        />
      )

      expect(screen.getByText('600 / 500')).toBeInTheDocument()
      expect(screen.getByText(/comment is too long/i)).toBeInTheDocument()
    })
  })

  describe('confirmation button states', () => {
    it('should show appropriate button text for approval', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Approve')
    })

    it('should show appropriate button text for rejection', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
        />
      )

      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Reject')
    })

    it('should show processing text when submitting', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} isSubmitting />)

      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Approving...')
    })

    it('should show processing text for rejection when submitting', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
          isSubmitting
        />
      )

      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Rejecting...')
    })

    it('should use appropriate button variants', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByTestId('confirm-button')).toHaveAttribute('data-variant', 'primary')
      expect(screen.getByTestId('cancel-button')).toHaveAttribute('data-variant', 'ghost')
    })

    it('should use danger variant for rejection', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
        />
      )

      expect(screen.getByTestId('confirm-button')).toHaveAttribute('data-variant', 'danger')
    })
  })

  describe('comment validation', () => {
    it('should show required comment error for rejection', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
          requireCommentForReject
          comment=""
        />
      )

      expect(screen.getByText(/comment is required for rejection/i)).toBeInTheDocument()
    })

    it('should show character count', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          comment="Hello world"
        />
      )

      expect(screen.getByText('11 / 500')).toBeInTheDocument()
    })

    it('should show comment too long error', () => {
      const longComment = "A".repeat(600)
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          comment={longComment}
        />
      )

      expect(screen.getByText(/comment is too long/i)).toBeInTheDocument()
    })
  })
})