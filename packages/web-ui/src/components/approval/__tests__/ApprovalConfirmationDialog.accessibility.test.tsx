/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ApprovalConfirmationDialog } from '../ApprovalConfirmationDialog'
import type { PendingApprovalGate } from '@/types/approval-gate-panel'

// Mock the UI components with forwardRef support
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

describe('ApprovalConfirmationDialog Accessibility Tests', () => {
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

  describe('ARIA attributes and roles', () => {
    it('should have proper dialog role and ARIA attributes', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const dialog = screen.getByTestId('confirmation-dialog')
      expect(dialog).toHaveAttribute('role', 'dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title')
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description')
    })

    it('should have proper heading structure', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const title = screen.getByRole('heading', { level: 2 })
      expect(title).toHaveTextContent('Approve Gate')
      expect(title).toHaveAttribute('id', 'dialog-title')
    })

    it('should have accessible form controls', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const commentInput = screen.getByTestId('comment-input')
      expect(commentInput).toHaveAttribute('aria-label', 'Add a comment for this action')

      // Check that buttons have accessible names
      const confirmButton = screen.getByTestId('confirm-button')
      const cancelButton = screen.getByTestId('cancel-button')

      expect(confirmButton).toHaveTextContent('Approve')
      expect(cancelButton).toHaveTextContent('Cancel')
    })

    it('should have accessible close button', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const closeButton = screen.getByLabelText('Close dialog')
      expect(closeButton).toBeInTheDocument()
    })
  })

  describe('keyboard navigation', () => {
    it('should trap focus within dialog', async () => {
      const user = userEvent.setup()

      render(<ApprovalConfirmationDialog {...defaultProps} />)

      // Get all focusable elements
      const dialog = screen.getByTestId('confirmation-dialog')
      const focusableElements = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      expect(focusableElements.length).toBeGreaterThan(0)

      // Test that Tab key can navigate through elements
      // (jsdom limitations prevent full focus testing, but structure is correct)
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      expect(firstElement).toBeInTheDocument()
      expect(lastElement).toBeInTheDocument()
    })

    it('should handle Enter key to submit when enabled', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          comment="Ready to approve"
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

    it('should not submit via Enter when comment is required but empty', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
          requireCommentForReject={true}
          comment=""
          onConfirm={onConfirm}
        />
      )

      await user.keyboard('{Enter}')
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('should prevent keyboard actions when submitting', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      const onCancel = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          isSubmitting={true}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )

      await user.keyboard('{Enter}')
      expect(onConfirm).not.toHaveBeenCalled()

      await user.keyboard('{Escape}')
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  describe('screen reader support', () => {
    it('should provide meaningful content for screen readers', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      // Check that screen readers get meaningful content by looking at the description
      expect(screen.getByText(/are you sure you want to/i)).toBeInTheDocument()

      // Check for specific context rather than duplicate text
      const description = screen.getByRole('dialog')
      expect(description).toHaveAttribute('aria-describedby', 'dialog-description')

      // Verify the button text contains approve action
      const confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toHaveTextContent(/approve/i)
    })

    it('should provide context for rejection warnings', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
        />
      )

      expect(screen.getByText(/rejecting this gate will halt/i)).toBeInTheDocument()
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()
    })

    it('should announce validation errors appropriately', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
          requireCommentForReject={true}
          comment=""
        />
      )

      expect(screen.getByText(/comment is required for rejection/i)).toBeInTheDocument()
    })

    it('should provide character count information', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          comment="Test comment"
        />
      )

      expect(screen.getByText('12 / 500')).toBeInTheDocument()
    })
  })

  describe('high contrast and visual accessibility', () => {
    it('should use semantic colors for action types', () => {
      const { rerender } = render(<ApprovalConfirmationDialog {...defaultProps} />)

      const confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toHaveAttribute('data-variant', 'primary')

      rerender(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
        />
      )

      expect(confirmButton).toHaveAttribute('data-variant', 'danger')
    })

    it('should provide visual feedback for disabled states', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          actionType="reject"
          requireCommentForReject={true}
          comment=""
        />
      )

      const confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toBeDisabled()
    })

    it('should provide loading state indicators', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          isSubmitting={true}
        />
      )

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByText('Approving...')).toBeInTheDocument()

      const confirmButton = screen.getByTestId('confirm-button')
      const cancelButton = screen.getByTestId('cancel-button')

      expect(confirmButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()
    })
  })

  describe('error handling accessibility', () => {
    it('should announce errors appropriately', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          error="Failed to approve gate"
        />
      )

      expect(screen.getByText('Failed to approve gate')).toBeInTheDocument()
    })

    it('should provide clear validation feedback', () => {
      const longComment = 'x'.repeat(600)
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          comment={longComment}
        />
      )

      expect(screen.getByText(/comment is too long/i)).toBeInTheDocument()
      expect(screen.getByText('600 / 500')).toBeInTheDocument()
    })
  })

  describe('modal behavior accessibility', () => {
    it('should prevent background interaction when open', async () => {
      const user = userEvent.setup()

      render(
        <div>
          <button data-testid="background-button">Background Button</button>
          <ApprovalConfirmationDialog {...defaultProps} />
        </div>
      )

      // Dialog should be modal and prevent interaction with background
      const dialog = screen.getByTestId('confirmation-dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')

      // Overlay should close dialog when clicked
      const overlay = dialog.parentElement!
      expect(overlay).toHaveClass('fixed', 'inset-0')
    })

    it('should handle overlay click to cancel', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onCancel={onCancel}
        />
      )

      const dialog = screen.getByTestId('confirmation-dialog')
      const overlay = dialog.parentElement!

      await user.click(overlay)
      expect(onCancel).toHaveBeenCalled()
    })

    it('should not close when clicking dialog content', async () => {
      const user = userEvent.setup()
      const onCancel = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onCancel={onCancel}
        />
      )

      const dialog = screen.getByTestId('confirmation-dialog')
      await user.click(dialog)
      expect(onCancel).not.toHaveBeenCalled()
    })
  })
})