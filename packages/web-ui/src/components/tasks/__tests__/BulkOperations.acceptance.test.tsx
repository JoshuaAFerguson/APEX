import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskCard } from '../TaskCard'
import { BulkSelectionProvider } from '../BulkSelectionContext'
import { BulkActionToolbar } from '../BulkActionToolbar'
import { BulkActionConfirmationDialog } from '../BulkActionConfirmationDialog'
import { BulkOperationProgress } from '../BulkOperationProgress'
import type { Task } from '@apexcli/core'
import type { BulkActionType, BulkOperationState } from '../../../types/bulk-operations'

// Mock tasks representing the acceptance criteria test cases
const testTasks: Task[] = [
  {
    id: 'cancellable-task',
    description: 'Cancellable Task - In Progress',
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
    id: 'retryable-task',
    description: 'Retryable Task - Failed',
    workflow: 'testing',
    autonomy: 'medium',
    status: 'failed',
    priority: 'medium',
    effort: 'small',
    error: 'Test failed',
    projectPath: '/project',
    retryCount: 1,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T09:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T09:30:00Z').toISOString(),
  },
  {
    id: 'deletable-task',
    description: 'Deletable Task - Completed',
    workflow: 'deployment',
    autonomy: 'high',
    status: 'completed',
    priority: 'low',
    effort: 'large',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T08:15:00Z').toISOString(),
  },
  {
    id: 'non-actionable-task',
    description: 'Non-actionable Task - Pending',
    workflow: 'review',
    autonomy: 'low',
    status: 'pending',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T07:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T07:30:00Z').toISOString(),
  },
]

// Complete acceptance test component
const AcceptanceTestApp = () => {
  const [operationState, setOperationState] = React.useState<BulkOperationState | null>(null)
  const [confirmationDialog, setConfirmationDialog] = React.useState<{
    open: boolean
    action: BulkActionType
    tasks: Task[]
  }>({ open: false, action: 'cancel', tasks: [] })

  const handleBulkAction = (action: BulkActionType, taskIds: string[]) => {
    const affectedTasks = testTasks.filter(task => taskIds.includes(task.id))

    // Check session storage for skip confirmation
    const skipConfirmation = sessionStorage.getItem(`bulk-action-skip-${action}`) === 'true'

    if (skipConfirmation || action === 'retry') {
      executeBulkAction(action, affectedTasks)
    } else {
      setConfirmationDialog({
        open: true,
        action,
        tasks: affectedTasks
      })
    }
  }

  const executeBulkAction = async (action: BulkActionType, tasks: Task[]) => {
    setConfirmationDialog({ open: false, action: 'cancel', tasks: [] })

    // Simulate real bulk operation with progress tracking
    const initialState: BulkOperationState = {
      type: action,
      total: tasks.length,
      completed: 0,
      failed: 0,
      inProgress: tasks.length,
      percentage: 0,
      results: [],
      startedAt: new Date().toISOString(),
      aborted: false,
    }
    setOperationState(initialState)

    // Simulate operation execution with realistic timing
    let completed = 0
    const results: any[] = []

    for (const task of tasks) {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 50))

      completed++
      results.push({
        taskId: task.id,
        success: true,
        updatedTask: {
          ...task,
          status: action === 'cancel' ? 'cancelled' :
                  action === 'retry' ? 'pending' :
                  'deleted' as any
        }
      })

      const percentage = Math.round((completed / tasks.length) * 100)

      setOperationState({
        type: action,
        total: tasks.length,
        completed,
        failed: 0,
        inProgress: tasks.length - completed,
        percentage,
        results: [...results],
        startedAt: initialState.startedAt,
        aborted: false,
        ...(completed === tasks.length && { completedAt: new Date().toISOString() })
      })
    }
  }

  const handleConfirmAction = (skipFuture: boolean) => {
    if (skipFuture) {
      sessionStorage.setItem(`bulk-action-skip-${confirmationDialog.action}`, 'true')
    }
    executeBulkAction(confirmationDialog.action, confirmationDialog.tasks)
  }

  const handleAbortOperation = () => {
    if (operationState && !operationState.completedAt) {
      setOperationState({
        ...operationState,
        aborted: true,
        completedAt: new Date().toISOString()
      })
    }
  }

  return (
    <BulkSelectionProvider>
      <div data-testid="acceptance-test-app">
        {/* Task Cards */}
        <div data-testid="task-cards">
          {testTasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        {/* Bulk Action Toolbar */}
        <BulkActionToolbar
          tasks={testTasks}
          visibleTaskIds={testTasks.map(t => t.id)}
          operationState={operationState}
          onBulkAction={handleBulkAction}
        />

        {/* Confirmation Dialog */}
        <BulkActionConfirmationDialog
          isOpen={confirmationDialog.open}
          onClose={() => setConfirmationDialog({ open: false, action: 'cancel', tasks: [] })}
          onConfirm={handleConfirmAction}
          actionType={confirmationDialog.action}
          affectedTasks={confirmationDialog.tasks}
        />

        {/* Operation Progress */}
        <BulkOperationProgress
          operationState={operationState}
          onAbort={handleAbortOperation}
          onClose={() => setOperationState(null)}
        />
      </div>
    </BulkSelectionProvider>
  )
}

describe('Bulk Task Operations - Acceptance Criteria', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  describe('AC1: Checkbox selection on task cards', () => {
    it('✓ Task cards display selection checkboxes in top-left corner', () => {
      render(<AcceptanceTestApp />)

      // Verify checkboxes are present on all task cards
      expect(screen.getByTestId('task-checkbox-cancellable-task')).toBeInTheDocument()
      expect(screen.getByTestId('task-checkbox-retryable-task')).toBeInTheDocument()
      expect(screen.getByTestId('task-checkbox-deletable-task')).toBeInTheDocument()
      expect(screen.getByTestId('task-checkbox-non-actionable-task')).toBeInTheDocument()

      // Verify checkbox positioning (top-left corner)
      const firstCheckbox = screen.getByTestId('task-checkbox-cancellable-task')
      const checkboxContainer = firstCheckbox.parentElement
      expect(checkboxContainer).toHaveClass('absolute', 'top-3', 'left-3')
    })

    it('✓ Checkboxes are properly accessible and labeled', () => {
      render(<AcceptanceTestApp />)

      const checkbox = screen.getByTestId('task-checkbox-cancellable-task')

      // Verify accessibility attributes
      expect(checkbox).toHaveAttribute('type', 'checkbox')
      expect(checkbox).toHaveAttribute('aria-label', 'Select task: Cancellable Task - In Progress')
      expect(checkbox).toHaveClass('focus:ring-2', 'focus:ring-apex-500') // Focus indicators
    })

    it('✓ Task selection works correctly through checkbox interaction', () => {
      render(<AcceptanceTestApp />)

      // Initially no tasks selected
      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()

      // Select a task
      const checkbox = screen.getByTestId('task-checkbox-cancellable-task')
      fireEvent.click(checkbox)

      // Verify selection state
      expect(checkbox).toBeChecked()

      // Deselect task
      fireEvent.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })

    it('✓ Checkbox clicks do not trigger task card navigation', () => {
      const onViewDetails = vi.fn()

      render(
        <BulkSelectionProvider>
          <TaskCard task={testTasks[0]} onViewDetails={onViewDetails} />
        </BulkSelectionProvider>
      )

      // Click checkbox - should not trigger navigation
      const checkbox = screen.getByTestId('task-checkbox-cancellable-task')
      fireEvent.click(checkbox)
      expect(onViewDetails).not.toHaveBeenCalled()

      // Click task card content - should trigger navigation
      fireEvent.click(screen.getByText('Cancellable Task - In Progress'))
      expect(onViewDetails).toHaveBeenCalledWith('cancellable-task')
    })

    it('✓ Task cards have appropriate margin/spacing for checkboxes', () => {
      render(<AcceptanceTestApp />)

      // Find task card container and verify left margin for checkbox
      const taskCard = screen.getByText('Cancellable Task - In Progress').closest('div')
      expect(taskCard).toHaveClass('ml-10') // Left margin to accommodate checkbox
    })
  })

  describe('AC2: Bulk action toolbar appears when tasks selected', () => {
    it('✓ Toolbar is hidden when no tasks are selected', () => {
      render(<AcceptanceTestApp />)

      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()
    })

    it('✓ Toolbar appears when tasks are selected', () => {
      render(<AcceptanceTestApp />)

      // Select a task
      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))

      // Toolbar should appear
      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    it('✓ Toolbar shows correct selection count', () => {
      render(<AcceptanceTestApp />)

      // Select multiple tasks
      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('task-checkbox-deletable-task'))

      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })

    it('✓ Toolbar includes Select All checkbox with correct states', () => {
      render(<AcceptanceTestApp />)

      // Select one task to show toolbar
      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))

      const selectAllCheckbox = screen.getByTestId('select-all-checkbox') as HTMLInputElement

      // Should be indeterminate (partial selection)
      expect(selectAllCheckbox.indeterminate).toBe(true)
      expect(selectAllCheckbox.checked).toBe(false)

      // Click to select all
      fireEvent.click(selectAllCheckbox)
      expect(screen.getByText('4 selected')).toBeInTheDocument()

      // Should now be fully checked
      expect(selectAllCheckbox.checked).toBe(true)
      expect(selectAllCheckbox.indeterminate).toBe(false)
    })

    it('✓ Toolbar displays action buttons with correct states', () => {
      render(<AcceptanceTestApp />)

      // Select mixed tasks
      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))  // cancellable
      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))    // retryable
      fireEvent.click(screen.getByTestId('task-checkbox-deletable-task'))    // deletable

      // Verify all action buttons are present
      expect(screen.getByTestId('bulk-cancel-button')).toBeInTheDocument()
      expect(screen.getByTestId('bulk-retry-button')).toBeInTheDocument()
      expect(screen.getByTestId('bulk-delete-button')).toBeInTheDocument()

      // Verify button states and counts
      expect(screen.getByText('Cancel (1)')).toBeInTheDocument()  // Only 1 cancellable task
      expect(screen.getByText('Retry (1)')).toBeInTheDocument()   // Only 1 retryable task
      expect(screen.getByText('Delete (1)')).toBeInTheDocument()  // Only 1 deletable task
    })

    it('✓ Toolbar has proper accessibility attributes', () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))

      const toolbar = screen.getByTestId('bulk-action-toolbar')
      expect(toolbar).toHaveAttribute('role', 'toolbar')
      expect(toolbar).toHaveAttribute('aria-label', 'Bulk task actions')
    })

    it('✓ Toolbar slides in from bottom with animation', () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))

      const toolbar = screen.getByTestId('bulk-action-toolbar')
      expect(toolbar).toHaveClass('slide-in-bottom') // Animation class
      expect(toolbar).toHaveClass('fixed', 'bottom-0') // Bottom positioning
    })
  })

  describe('AC3: Confirmation dialogs for destructive actions', () => {
    it('✓ Cancel action requires confirmation (destructive)', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })
      expect(screen.getByText('Cancel Tasks')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to cancel/)).toBeInTheDocument()
    })

    it('✓ Delete action requires confirmation (destructive)', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-deletable-task'))
      fireEvent.click(screen.getByTestId('bulk-delete-button'))

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })
      expect(screen.getByText('Delete Tasks')).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()
    })

    it('✓ Retry action does NOT require confirmation (safe)', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-retry-button'))

      // Should go directly to progress (no confirmation)
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('bulk-confirmation-dialog')).not.toBeInTheDocument()
    })

    it('✓ Confirmation dialog shows affected tasks list', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task')) // For variety
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })

      // Should show task count and affected task details
      expect(screen.getByText('1 task')).toBeInTheDocument() // Only cancellable task affected
      expect(screen.getByText('Cancellable Task - In Progress')).toBeInTheDocument()
      expect(screen.getByText('cancellable-task')).toBeInTheDocument() // Task ID
    })

    it('✓ Confirmation dialog includes "Don\'t ask again" option for destructive actions', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })

      // Should have "don't ask again" checkbox
      expect(screen.getByTestId('dont-ask-again-checkbox')).toBeInTheDocument()
      expect(screen.getByText("Don't ask again this session")).toBeInTheDocument()
    })

    it('✓ "Don\'t ask again" persists for session and skips future confirmations', async () => {
      render(<AcceptanceTestApp />)

      // First operation with "don't ask again"
      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('dont-ask-again-checkbox'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Wait for operation to complete
      await waitFor(() => {
        expect(screen.getByTestId('close-button')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('close-button'))

      // Second operation should skip confirmation
      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task')) // Deselect
      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task')) // Reselect
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))

      // Should go directly to progress
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('bulk-confirmation-dialog')).not.toBeInTheDocument()
    })

    it('✓ Confirmation dialog has proper accessibility and warning messaging', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-deletable-task'))
      fireEvent.click(screen.getByTestId('bulk-delete-button'))

      await waitFor(() => {
        const dialog = screen.getByTestId('bulk-confirmation-dialog')
        expect(dialog).toHaveAttribute('role', 'dialog')
        expect(dialog).toHaveAttribute('aria-labelledby')
        expect(dialog).toHaveAttribute('aria-describedby')
      })

      // Should have warning about consequences
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()

      // Buttons should have proper variants
      const confirmButton = screen.getByTestId('confirm-button')
      expect(confirmButton).toHaveClass('bg-red-600') // Danger variant
    })
  })

  describe('AC4: Progress indicator for bulk operations', () => {
    it('✓ Shows progress bar with percentage completion', async () => {
      render(<AcceptanceTestApp />)

      // Start an operation
      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-retry-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })

      // Should have progress bar
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('✓ Displays operation type and task count in status text', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })

      // Should show operation type and count
      expect(screen.getByText('Cancelling 1 tasks...')).toBeInTheDocument() // Only 1 cancellable task
    })

    it('✓ Shows success and failure counts with color coding', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/Successfully cancelled/)).toBeInTheDocument()
      })

      // Should show completion status with counts
      expect(screen.getByText('1')).toBeInTheDocument() // Success count badge
    })

    it('✓ Displays duration timer in seconds', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-retry-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })

      // Should show duration (will be 0s or 1s due to test timing)
      expect(screen.getByText(/\d+s/)).toBeInTheDocument()
    })

    it('✓ Shows status indicator with appropriate colors and animations', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-retry-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })

      // Should have animated status indicator during operation
      const statusDot = screen.getByTestId('status-indicator')
      expect(statusDot).toHaveClass('bg-blue-500') // Blue for in-progress
      expect(statusDot).toHaveClass('animate-pulse') // Animated

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/Successfully/)).toBeInTheDocument()
      })

      // Should change to success color
      expect(statusDot).toHaveClass('bg-green-500') // Green for success
      expect(statusDot).not.toHaveClass('animate-pulse') // No longer animated
    })

    it('✓ Provides expandable detailed results for individual tasks', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('expand-details-button')).toBeInTheDocument()
      })

      // Initially collapsed
      expect(screen.queryByTestId('operation-results')).not.toBeInTheDocument()
      expect(screen.getByText('Show Details')).toBeInTheDocument()

      // Expand details
      fireEvent.click(screen.getByTestId('expand-details-button'))

      // Should show detailed results
      expect(screen.getByTestId('operation-results')).toBeInTheDocument()
      expect(screen.getByText('Hide Details')).toBeInTheDocument()

      // Should show individual task results
      expect(screen.getByText('Cancellable Task - In Progress')).toBeInTheDocument()
      expect(screen.getByText('cancellable-task')).toBeInTheDocument()
    })

    it('✓ Shows completion message with summary', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-retry-button'))

      await waitFor(() => {
        expect(screen.getByText(/Successfully retried 1 tasks/)).toBeInTheDocument()
      })
    })

    it('✓ Includes close button after operation completes', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-retry-button'))

      await waitFor(() => {
        expect(screen.getByTestId('close-button')).toBeInTheDocument()
      })

      // Close button should work
      fireEvent.click(screen.getByTestId('close-button'))
      expect(screen.queryByTestId('bulk-operation-progress')).not.toBeInTheDocument()
    })

    it('✓ Progress indicator has proper accessibility attributes', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('bulk-retry-button'))

      await waitFor(() => {
        const progressComponent = screen.getByTestId('bulk-operation-progress')
        expect(progressComponent).toHaveAttribute('role', 'region')
        expect(progressComponent).toHaveAttribute('aria-label')
      })

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label')
    })

    it('✓ Supports aborting operations in progress', async () => {
      render(<AcceptanceTestApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('task-checkbox-retryable-task'))
      fireEvent.click(screen.getByTestId('task-checkbox-deletable-task'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })

      // Should have abort button during operation
      const abortButton = screen.getByTestId('abort-button')
      expect(abortButton).toBeInTheDocument()

      fireEvent.click(abortButton)

      // Should show aborted state
      await waitFor(() => {
        expect(screen.queryByTestId('abort-button')).not.toBeInTheDocument()
        expect(screen.getByTestId('close-button')).toBeInTheDocument()
      })
    })
  })

  describe('Complete Acceptance Criteria Integration', () => {
    it('✓ Full user journey: Select → Toolbar → Confirm → Progress → Complete', async () => {
      render(<AcceptanceTestApp />)

      // Step 1: Checkbox selection on task cards
      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))
      fireEvent.click(screen.getByTestId('task-checkbox-deletable-task'))

      const cancelCheckbox = screen.getByTestId('task-checkbox-cancellable-task')
      const deleteCheckbox = screen.getByTestId('task-checkbox-deletable-task')
      expect(cancelCheckbox).toBeChecked()
      expect(deleteCheckbox).toBeChecked()

      // Step 2: Bulk action toolbar appears when tasks selected
      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()
      expect(screen.getByText('2 selected')).toBeInTheDocument()

      // Step 3: Confirmation dialog for destructive actions
      fireEvent.click(screen.getByTestId('bulk-delete-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })
      expect(screen.getByText('Delete Tasks')).toBeInTheDocument()
      expect(screen.getByText('1 task')).toBeInTheDocument() // Only deletable task

      fireEvent.click(screen.getByTestId('confirm-button'))

      // Step 4: Progress indicator for bulk operations
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })
      expect(screen.getByText('Deleting 1 tasks...')).toBeInTheDocument()

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/Successfully deleted/)).toBeInTheDocument()
        expect(screen.getByTestId('close-button')).toBeInTheDocument()
      })

      // Complete the journey
      fireEvent.click(screen.getByTestId('close-button'))
      expect(screen.queryByTestId('bulk-operation-progress')).not.toBeInTheDocument()

      // Toolbar should still show remaining selection
      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()
      expect(screen.getByText('1 selected')).toBeInTheDocument() // Cancellable task still selected
    })

    it('✓ All acceptance criteria work together seamlessly', async () => {
      render(<AcceptanceTestApp />)

      // AC1: Checkbox selection
      fireEvent.click(screen.getByTestId('task-checkbox-cancellable-task'))

      // AC2: Toolbar appears
      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()

      // AC3: Confirmation dialog (for destructive action)
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('confirm-button'))

      // AC4: Progress indicator
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })

      // Verify all components work together
      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument() // Hidden during operation
      expect(screen.queryByTestId('bulk-confirmation-dialog')).not.toBeInTheDocument() // Closed after confirm

      await waitFor(() => {
        expect(screen.getByText(/Successfully cancelled/)).toBeInTheDocument()
      })

      // Final state verification
      expect(screen.getByTestId('close-button')).toBeInTheDocument()
    })
  })
})