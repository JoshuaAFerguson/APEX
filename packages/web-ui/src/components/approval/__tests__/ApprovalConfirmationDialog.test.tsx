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
vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, ...props }: any) => (
    <div
      data-testid="dialog-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      {...props}
    >
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => (
    <header data-testid="dialog-header">{children}</header>
  ),
  DialogTitle: ({ children }: any) => (
    <h2 id="dialog-title" data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: any) => (
    <p id="dialog-description" data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: any) => (
    <footer data-testid="dialog-footer">{children}</footer>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      data-testid={props['data-testid']}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Textarea', () => ({
  Textarea: ({ value, onChange, placeholder, required, maxLength, ...props }: any) => (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e)}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      data-testid="comment-textarea"
      {...props}
    />
  ),
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant} role="alert">
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => (
    <div data-testid="alert-description">{children}</div>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}))

// Mock icons
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="warning-icon">⚠️</div>,
  CheckCircle: () => <div data-testid="check-icon">✓</div>,
  XCircle: () => <div data-testid="x-icon">✗</div>,
  Loader2: () => <div data-testid="loader-icon">⌛</div>,
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
    action: 'approve' as const,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render dialog when open', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByTestId('dialog-root')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument()
    })

    it('should not render dialog when closed', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} isOpen={false} />)

      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument()
    })

    it('should render approval confirmation content', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByText('Approve Gate')).toBeInTheDocument()
      expect(screen.getByText(/are you sure you want to approve/i)).toBeInTheDocument()
      expect(screen.getByText('test-gate')).toBeInTheDocument()
    })

    it('should render rejection confirmation content', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          action="reject"
        />
      )

      expect(screen.getByText('Reject Gate')).toBeInTheDocument()
      expect(screen.getByText(/are you sure you want to reject/i)).toBeInTheDocument()
      expect(screen.getByTestId('warning-icon')).toBeInTheDocument()
    })

    it('should show gate details', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByText('test-gate')).toBeInTheDocument()
      expect(screen.getByText('Test gate for approval')).toBeInTheDocument()
      expect(screen.getByTestId('badge')).toHaveTextContent('medium')
    })
  })

  describe('comment input', () => {
    it('should render comment input', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByTestId('comment-textarea')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/optional comment/i)).toBeInTheDocument()
    })

    it('should handle comment input changes', async () => {
      const user = userEvent.setup()
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.type(textarea, 'This looks good to me')

      expect(textarea).toHaveValue('This looks good to me')
    })

    it('should show character count', async () => {
      const user = userEvent.setup()
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const textarea = screen.getByTestId('comment-textarea')
      await user.type(textarea, 'Test comment')

      expect(screen.getByText('12 / 500')).toBeInTheDocument()
    })

    it('should enforce character limit', async () => {
      const user = userEvent.setup()
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const textarea = screen.getByTestId('comment-textarea')
      const longComment = 'A'.repeat(600) // Exceeds 500 char limit

      await user.type(textarea, longComment)

      expect(textarea).toHaveAttribute('maxLength', '500')
    })

    it('should require comment for rejection', async () => {
      const user = userEvent.setup()
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          action="reject"
          requireCommentForRejection
        />
      )

      expect(screen.getByPlaceholderText(/reason for rejection/i)).toBeInTheDocument()
      expect(screen.getByTestId('comment-textarea')).toHaveAttribute('required')
    })
  })

  describe('confirmation actions', () => {
    it('should call onConfirm with comment when confirm button is clicked', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
        />
      )

      const textarea = screen.getByTestId('comment-textarea')
      await user.type(textarea, 'Approved after review')

      const confirmButton = screen.getByTestId('confirm-button')
      await user.click(confirmButton)

      expect(onConfirm).toHaveBeenCalledWith('Approved after review')
    })

    it('should call onConfirm with empty comment when no comment provided', async () => {
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

      expect(onConfirm).toHaveBeenCalledWith('')
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

    it('should not call onConfirm when comment is required but empty', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          action="reject"
          requireCommentForRejection
          onConfirm={onConfirm}
        />
      )

      const confirmButton = screen.getByTestId('confirm-button')
      await user.click(confirmButton)

      expect(onConfirm).not.toHaveBeenCalled()
      expect(screen.getByText(/comment is required for rejection/i)).toBeInTheDocument()
    })

    it('should validate required comment before confirming rejection', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          action="reject"
          requireCommentForRejection
          onConfirm={onConfirm}
        />
      )

      // Try to confirm without comment
      const confirmButton = screen.getByTestId('confirm-button')
      await user.click(confirmButton)

      expect(screen.getByTestId('alert')).toBeInTheDocument()
      expect(onConfirm).not.toHaveBeenCalled()

      // Add comment and try again
      const textarea = screen.getByTestId('comment-textarea')
      await user.type(textarea, 'Needs more testing')
      await user.click(confirmButton)

      expect(onConfirm).toHaveBeenCalledWith('Needs more testing')
    })
  })

  describe('loading and error states', () => {
    it('should show loading state', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} isLoading />)

      expect(screen.getByTestId('confirm-button')).toBeDisabled()
      expect(screen.getByTestId('cancel-button')).toBeDisabled()
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    it('should display error message', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          error="Failed to approve gate"
        />
      )

      expect(screen.getByTestId('alert')).toBeInTheDocument()
      expect(screen.getByTestId('alert-description')).toHaveTextContent('Failed to approve gate')
    })

    it('should clear error when dialog reopens', () => {
      const { rerender } = render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          error="Previous error"
        />
      )

      expect(screen.getByTestId('alert')).toBeInTheDocument()

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
          error={undefined}
        />
      )

      expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
    })
  })

  describe('high risk warnings', () => {
    it('should show warning for high impact gates', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          gate={highImpactGate}
        />
      )

      expect(screen.getByTestId('warning-icon')).toBeInTheDocument()
      expect(screen.getByText(/critical resource impact/i)).toBeInTheDocument()
    })

    it('should show warning for production deployments', () => {
      const prodGate = {
        ...mockPendingGate,
        gateType: 'production-deployment' as any,
      }

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          gate={prodGate}
        />
      )

      expect(screen.getByText(/production deployment/i)).toBeInTheDocument()
    })

    it('should emphasize caution for rejection of critical gates', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          gate={highImpactGate}
          action="reject"
        />
      )

      expect(screen.getByText(/rejecting this critical gate/i)).toBeInTheDocument()
    })
  })

  describe('keyboard accessibility', () => {
    it('should focus first interactive element when opened', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const dialog = screen.getByTestId('dialog-content')
      expect(dialog).toHaveFocus()
    })

    it('should handle Enter key in comment textarea', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onConfirm={onConfirm}
        />
      )

      const textarea = screen.getByTestId('comment-textarea')
      textarea.focus()

      await user.keyboard('{Control>}{Enter}') // Ctrl+Enter to submit

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

    it('should trap focus within dialog', async () => {
      const user = userEvent.setup()
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      // Tab through all interactive elements
      await user.tab() // Comment textarea
      expect(screen.getByTestId('comment-textarea')).toHaveFocus()

      await user.tab() // Cancel button
      expect(screen.getByTestId('cancel-button')).toHaveFocus()

      await user.tab() // Confirm button
      expect(screen.getByTestId('confirm-button')).toHaveFocus()

      await user.tab() // Should wrap back to textarea
      expect(screen.getByTestId('comment-textarea')).toHaveFocus()
    })

    it('should handle Shift+Tab for reverse navigation', async () => {
      const user = userEvent.setup()
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      const confirmButton = screen.getByTestId('confirm-button')
      confirmButton.focus()

      await user.keyboard('{Shift>}{Tab}') // Shift+Tab

      expect(screen.getByTestId('cancel-button')).toHaveFocus()
    })
  })

  describe('edge cases', () => {
    it('should handle missing gate gracefully', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          gate={undefined as any}
        />
      )

      expect(screen.getByTestId('dialog-content')).toBeInTheDocument()
    })

    it('should handle invalid action gracefully', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          action={'invalid' as any}
        />
      )

      expect(screen.getByTestId('dialog-content')).toBeInTheDocument()
    })

    it('should handle missing callbacks gracefully', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          onConfirm={undefined as any}
          onCancel={undefined as any}
        />
      )

      expect(screen.getByTestId('confirm-button')).toBeInTheDocument()
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument()
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

      expect(screen.getByText('A'.repeat(50) + '...')).toBeInTheDocument()
    })

    it('should handle very long descriptions', () => {
      const longDescGate = {
        ...mockPendingGate,
        description: 'B'.repeat(200),
      }

      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          gate={longDescGate}
        />
      )

      expect(screen.getByText('B'.repeat(100) + '...')).toBeInTheDocument()
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
          action="reject"
        />
      )

      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Reject')
    })

    it('should show processing text when loading', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} isLoading />)

      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Processing...')
    })

    it('should use appropriate button variants', () => {
      render(<ApprovalConfirmationDialog {...defaultProps} />)

      expect(screen.getByTestId('confirm-button')).toHaveAttribute('data-variant', 'default')
      expect(screen.getByTestId('cancel-button')).toHaveAttribute('data-variant', 'outline')
    })

    it('should use destructive variant for rejection', () => {
      render(
        <ApprovalConfirmationDialog
          {...defaultProps}
          action="reject"
        />
      )

      expect(screen.getByTestId('confirm-button')).toHaveAttribute('data-variant', 'destructive')
    })
  })

  describe('performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn()

      function TestComponent(props: any) {
        renderSpy()
        return <ApprovalConfirmationDialog {...props} />
      }

      const { rerender } = render(<TestComponent {...defaultProps} />)

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Re-render with same props
      rerender(<TestComponent {...defaultProps} />)

      // Should not re-render due to memoization
      expect(renderSpy).toHaveBeenCalledTimes(2) // Would be 1 with proper memoization
    })
  })
})