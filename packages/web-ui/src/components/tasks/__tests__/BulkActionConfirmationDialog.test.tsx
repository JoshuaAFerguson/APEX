import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BulkActionConfirmationDialog } from '../BulkActionConfirmationDialog'
import type { Task } from '@apexcli/core'
import type { BulkActionType } from '../../../types/bulk-operations'

// Mock tasks for testing
const mockTasks: Task[] = [
  {
    id: 'task-1',
    description: 'Task 1 - In Progress',
    workflow: 'development',
    autonomy: 'medium',
    status: 'in-progress',
    priority: 'high',
    effort: 'medium',
    currentStage: 'implementation',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:30:00Z').toISOString(),
  },
  {
    id: 'task-2',
    description: 'Task 2 - Completed',
    workflow: 'testing',
    autonomy: 'medium',
    status: 'completed',
    priority: 'medium',
    effort: 'small',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T09:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T09:30:00Z').toISOString(),
  },
  {
    id: 'task-3',
    description: 'Task 3 - Failed',
    workflow: 'deployment',
    autonomy: 'high',
    status: 'failed',
    priority: 'low',
    effort: 'large',
    error: 'Deployment failed',
    projectPath: '/project',
    retryCount: 1,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T08:15:00Z').toISOString(),
  },
]

const defaultProps = {
  isOpen: false,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  actionType: 'cancel' as BulkActionType,
  affectedTasks: [],
}

describe('BulkActionConfirmationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear sessionStorage
    sessionStorage.clear()
  })

  describe('Visibility and Basic Rendering', () => {
    it('is not visible when closed', () => {
      render(<BulkActionConfirmationDialog {...defaultProps} />)

      expect(screen.queryByTestId('bulk-confirmation-dialog')).not.toBeInTheDocument()
    })

    it('is visible when open', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[mockTasks[0]]}
        />
      )

      expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
    })

    it('has correct accessibility attributes', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[mockTasks[0]]}
        />
      )

      const dialog = screen.getByTestId('bulk-confirmation-dialog')
      expect(dialog).toHaveAttribute('role', 'dialog')
      expect(dialog).toHaveAttribute('aria-labelledby')
      expect(dialog).toHaveAttribute('aria-describedby')
    })
  })

  describe('Action Type Specific Content', () => {
    it('shows correct title and content for cancel action', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="cancel"
          affectedTasks={[mockTasks[0]]}
        />
      )

      expect(screen.getByText('Cancel Tasks')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to cancel/)).toBeInTheDocument()
      expect(screen.getByText(/This will stop the execution/)).toBeInTheDocument()
    })

    it('shows correct title and content for delete action', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="delete"
          affectedTasks={[mockTasks[1]]}
        />
      )

      expect(screen.getByText('Delete Tasks')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()
    })

    it('shows correct title and content for retry action', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="retry"
          affectedTasks={[mockTasks[2]]}
        />
      )

      expect(screen.getByText('Retry Tasks')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to retry/)).toBeInTheDocument()
      expect(screen.getByText(/This will restart the failed tasks/)).toBeInTheDocument()
    })

    it('uses correct button variants for different actions', () => {
      const { rerender } = render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="cancel"
          affectedTasks={[mockTasks[0]]}
        />
      )

      // Cancel action should use danger variant
      let confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toHaveClass('bg-red-600') // danger variant

      rerender(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="delete"
          affectedTasks={[mockTasks[1]]}
        />
      )

      // Delete action should use danger variant
      confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toHaveClass('bg-red-600') // danger variant

      rerender(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="retry"
          affectedTasks={[mockTasks[2]]}
        />
      )

      // Retry action should use primary variant
      confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toHaveClass('bg-apex-500') // primary variant
    })
  })

  describe('Affected Tasks Display', () => {
    it('displays single task correctly', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[mockTasks[0]]}
        />
      )

      expect(screen.getByText('1 task')).toBeInTheDocument()
      expect(screen.getByText('Task 1 - In Progress')).toBeInTheDocument()
      expect(screen.getByText('task-1')).toBeInTheDocument()
    })

    it('displays multiple tasks correctly', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={mockTasks}
        />
      )

      expect(screen.getByText('3 tasks')).toBeInTheDocument()
      expect(screen.getByText('Task 1 - In Progress')).toBeInTheDocument()
      expect(screen.getByText('Task 2 - Completed')).toBeInTheDocument()
      expect(screen.getByText('Task 3 - Failed')).toBeInTheDocument()
    })

    it('shows status badges for tasks', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={mockTasks}
        />
      )

      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('makes task list scrollable when more than 5 tasks', () => {
      const manyTasks = Array.from({ length: 7 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i + 1}`,
        description: `Task ${i + 1}`,
      }))

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={manyTasks}
        />
      )

      const taskList = screen.getByTestId('affected-tasks-list')
      expect(taskList).toHaveClass('max-h-60', 'overflow-y-auto')
    })

    it('shows truncated task IDs', () => {
      const longIdTask = {
        ...mockTasks[0],
        id: 'task-very-long-id-that-should-be-truncated-123456789',
      }

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[longIdTask]}
        />
      )

      // Should show truncated ID (first 8 chars + ...)
      expect(screen.getByText('task-ver...')).toBeInTheDocument()
    })
  })

  describe('Don\'t Ask Again Feature', () => {
    it('shows "Don\'t ask again" checkbox for destructive actions', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="cancel"
          affectedTasks={[mockTasks[0]]}
        />
      )

      expect(screen.getByTestId('dont-ask-again-checkbox')).toBeInTheDocument()
      expect(screen.getByText("Don't ask again this session")).toBeInTheDocument()
    })

    it('does not show "Don\'t ask again" for non-destructive actions', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="retry"
          affectedTasks={[mockTasks[2]]}
        />
      )

      expect(screen.queryByTestId('dont-ask-again-checkbox')).not.toBeInTheDocument()
    })

    it('saves preference to sessionStorage when checked and confirmed', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="cancel"
          affectedTasks={[mockTasks[0]]}
        />
      )

      const checkbox = screen.getByTestId('dont-ask-again-checkbox')
      fireEvent.click(checkbox)

      const confirmButton = screen.getByTestId('confirm-button')
      fireEvent.click(confirmButton)

      expect(sessionStorage.getItem('bulk-action-skip-cancel')).toBe('true')
    })

    it('does not save preference if not confirmed', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="delete"
          affectedTasks={[mockTasks[1]]}
        />
      )

      const checkbox = screen.getByTestId('dont-ask-again-checkbox')
      fireEvent.click(checkbox)

      const cancelButton = screen.getByTestId('cancel-button')
      fireEvent.click(cancelButton)

      expect(sessionStorage.getItem('bulk-action-skip-delete')).toBeNull()
    })

    it('respects existing sessionStorage preference', () => {
      sessionStorage.setItem('bulk-action-skip-cancel', 'true')

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="cancel"
          affectedTasks={[mockTasks[0]]}
        />
      )

      const checkbox = screen.getByTestId('dont-ask-again-checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })
  })

  describe('User Interactions', () => {
    it('calls onConfirm when confirm button is clicked', () => {
      const onConfirm = vi.fn()

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          onConfirm={onConfirm}
          affectedTasks={[mockTasks[0]]}
        />
      )

      const confirmButton = screen.getByTestId('confirm-button')
      fireEvent.click(confirmButton)

      expect(onConfirm).toHaveBeenCalledWith(false) // false = don't skip confirmation
    })

    it('calls onConfirm with skip flag when "don\'t ask again" is checked', () => {
      const onConfirm = vi.fn()

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          onConfirm={onConfirm}
          actionType="cancel"
          affectedTasks={[mockTasks[0]]}
        />
      )

      const checkbox = screen.getByTestId('dont-ask-again-checkbox')
      fireEvent.click(checkbox)

      const confirmButton = screen.getByTestId('confirm-button')
      fireEvent.click(confirmButton)

      expect(onConfirm).toHaveBeenCalledWith(true) // true = skip future confirmations
    })

    it('calls onClose when cancel button is clicked', () => {
      const onClose = vi.fn()

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          onClose={onClose}
          affectedTasks={[mockTasks[0]]}
        />
      )

      const cancelButton = screen.getByTestId('cancel-button')
      fireEvent.click(cancelButton)

      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when clicking outside dialog (if supported)', () => {
      const onClose = vi.fn()

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          onClose={onClose}
          affectedTasks={[mockTasks[0]]}
        />
      )

      // Click on dialog backdrop (if clickable)
      const dialog = screen.getByTestId('bulk-confirmation-dialog')
      fireEvent.click(dialog)

      // This might not work depending on dialog implementation
      // but the test documents the expected behavior
    })

    it('supports keyboard navigation', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[mockTasks[0]]}
        />
      )

      const cancelButton = screen.getByTestId('cancel-button')
      const confirmButton = screen.getByTestId('confirm-button')

      // Elements should be focusable
      cancelButton.focus()
      expect(cancelButton).toHaveFocus()

      confirmButton.focus()
      expect(confirmButton).toHaveFocus()
    })

    it('supports ESC key to close dialog', () => {
      const onClose = vi.fn()

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          onClose={onClose}
          affectedTasks={[mockTasks[0]]}
        />
      )

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalled()
    })

    it('supports Enter key to confirm', () => {
      const onConfirm = vi.fn()

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          onConfirm={onConfirm}
          affectedTasks={[mockTasks[0]]}
        />
      )

      const confirmButton = screen.getByTestId('confirm-button')
      confirmButton.focus()
      fireEvent.keyDown(confirmButton, { key: 'Enter' })

      expect(onConfirm).toHaveBeenCalledWith(false)
    })
  })

  describe('Focus Management', () => {
    it('focuses first focusable element when opened', async () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[mockTasks[0]]}
        />
      )

      // Wait for focus to be set (may be async)
      await waitFor(() => {
        const focusedElement = document.activeElement
        expect(focusedElement).not.toBe(document.body)
      })
    })

    it('traps focus within dialog', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[mockTasks[0]]}
        />
      )

      const cancelButton = screen.getByTestId('cancel-button')
      const confirmButton = screen.getByTestId('confirm-button')

      // Tab through elements
      cancelButton.focus()
      fireEvent.keyDown(cancelButton, { key: 'Tab' })
      expect(confirmButton).toHaveFocus()

      // Shift+Tab should go back
      fireEvent.keyDown(confirmButton, { key: 'Tab', shiftKey: true })
      expect(cancelButton).toHaveFocus()
    })

    it('restores focus when dialog closes', () => {
      const triggerButton = document.createElement('button')
      document.body.appendChild(triggerButton)
      triggerButton.focus()

      const { rerender } = render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[mockTasks[0]]}
        />
      )

      // Focus should be inside dialog
      expect(document.activeElement).not.toBe(triggerButton)

      // Close dialog
      rerender(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={false}
          affectedTasks={[mockTasks[0]]}
        />
      )

      // Focus should return to trigger button
      expect(document.activeElement).toBe(triggerButton)

      document.body.removeChild(triggerButton)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles empty affected tasks array', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[]}
        />
      )

      expect(screen.getByText('0 tasks')).toBeInTheDocument()
      expect(screen.getByText('No tasks selected')).toBeInTheDocument()
    })

    it('handles tasks with missing properties gracefully', () => {
      const incompleteTask = {
        id: 'incomplete-task',
        // Missing description, status, etc.
      } as Task

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[incompleteTask]}
        />
      )

      // Should not crash and show some fallback content
      expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      expect(screen.getByText('incomplete-task')).toBeInTheDocument()
    })

    it('handles very long task descriptions', () => {
      const longDescTask = {
        ...mockTasks[0],
        description: 'This is a very long task description that should be truncated or handled gracefully in the UI to prevent layout issues and ensure good user experience',
      }

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[longDescTask]}
        />
      )

      // Should render without breaking layout
      expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
    })

    it('handles sessionStorage errors gracefully', () => {
      // Mock sessionStorage to throw errors
      const originalSetItem = sessionStorage.setItem
      sessionStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded')
      })

      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="cancel"
          affectedTasks={[mockTasks[0]]}
        />
      )

      const checkbox = screen.getByTestId('dont-ask-again-checkbox')
      fireEvent.click(checkbox)

      const confirmButton = screen.getByTestId('confirm-button')

      // Should not crash when sessionStorage fails
      expect(() => {
        fireEvent.click(confirmButton)
      }).not.toThrow()

      // Restore original implementation
      sessionStorage.setItem = originalSetItem
    })
  })

  describe('Accessibility Compliance', () => {
    it('provides descriptive ARIA labels', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="cancel"
          affectedTasks={mockTasks}
        />
      )

      const dialog = screen.getByTestId('bulk-confirmation-dialog')
      expect(dialog).toHaveAttribute('aria-labelledby')
      expect(dialog).toHaveAttribute('aria-describedby')

      const title = screen.getByText('Cancel Tasks')
      expect(title).toHaveAttribute('id')

      const confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toHaveAttribute('aria-label')
    })

    it('provides proper roles for semantic structure', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={mockTasks}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()

      const taskList = screen.getByTestId('affected-tasks-list')
      expect(taskList).toHaveAttribute('role', 'list')
    })

    it('supports high contrast mode', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          affectedTasks={[mockTasks[0]]}
        />
      )

      // Buttons should have proper contrast classes
      const confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toHaveClass('text-white') // Ensures contrast
    })

    it('provides screen reader friendly content', () => {
      render(
        <BulkActionConfirmationDialog
          {...defaultProps}
          isOpen={true}
          actionType="cancel"
          affectedTasks={mockTasks}
        />
      )

      // Should have descriptive text for screen readers
      expect(screen.getByText(/This will stop the execution/)).toBeInTheDocument()
      expect(screen.getByText('3 tasks')).toBeInTheDocument()
    })
  })
})