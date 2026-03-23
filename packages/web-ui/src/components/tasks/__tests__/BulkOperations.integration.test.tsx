import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TaskCard } from '../TaskCard'
import { BulkSelectionProvider } from '../BulkSelectionContext'
import { BulkActionToolbar } from '../BulkActionToolbar'
import { BulkActionConfirmationDialog } from '../BulkActionConfirmationDialog'
import { BulkOperationProgress } from '../BulkOperationProgress'
import type { Task } from '@apexcli/core'
import type { BulkActionType, BulkOperationState } from '../../../types/bulk-operations'

// Mock the API client
const mockApiClient = {
  cancelTask: vi.fn(),
  retryTask: vi.fn(),
}

// Mock the useApi hook
vi.mock('../../hooks/useApi', () => ({
  useApi: () => mockApiClient,
}))

// Mock the useBulkTaskOperations hook for controlled testing
const mockUseBulkTaskOperations = {
  isOperating: false,
  currentOperation: null,
  executeBulkOperation: vi.fn(),
  abortOperation: vi.fn(),
}

vi.mock('../../hooks/useBulkTaskOperations', () => ({
  useBulkTaskOperations: () => mockUseBulkTaskOperations,
}))

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
    description: 'Task 2 - Failed',
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
    id: 'task-3',
    description: 'Task 3 - Completed',
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
    id: 'task-4',
    description: 'Task 4 - Cancelled',
    workflow: 'review',
    autonomy: 'low',
    status: 'cancelled',
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

// Full integration component that demonstrates the complete flow
const BulkOperationDemoApp = () => {
  const [operationState, setOperationState] = React.useState<BulkOperationState | null>(null)
  const [confirmationDialog, setConfirmationDialog] = React.useState<{
    open: boolean
    action: BulkActionType
    tasks: Task[]
  }>({ open: false, action: 'cancel', tasks: [] })

  const handleBulkAction = (action: BulkActionType, taskIds: string[]) => {
    const affectedTasks = mockTasks.filter(task => taskIds.includes(task.id))

    // Check if user has disabled confirmation for this action
    const skipConfirmation = sessionStorage.getItem(`bulk-action-skip-${action}`) === 'true'

    if (skipConfirmation || action === 'retry') {
      // Execute immediately
      executeBulkAction(action, affectedTasks)
    } else {
      // Show confirmation dialog
      setConfirmationDialog({
        open: true,
        action,
        tasks: affectedTasks
      })
    }
  }

  const executeBulkAction = async (action: BulkActionType, tasks: Task[]) => {
    setConfirmationDialog({ open: false, action: 'cancel', tasks: [] })

    // Start operation
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

    // Simulate operation progress
    let completed = 0
    let failed = 0
    const results: any[] = []

    for (const task of tasks) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100))

      // Simulate occasional failures
      const shouldFail = Math.random() < 0.2 // 20% failure rate

      if (shouldFail) {
        failed++
        results.push({
          taskId: task.id,
          success: false,
          error: 'Simulated API error'
        })
      } else {
        completed++
        results.push({
          taskId: task.id,
          success: true,
          updatedTask: { ...task, status: action === 'cancel' ? 'cancelled' : action === 'retry' ? 'pending' : 'deleted' }
        })
      }

      // Update progress
      const newState: BulkOperationState = {
        type: action,
        total: tasks.length,
        completed,
        failed,
        inProgress: tasks.length - completed - failed,
        percentage: Math.round(((completed + failed) / tasks.length) * 100),
        results: [...results],
        startedAt: initialState.startedAt,
        aborted: false,
      }

      if (completed + failed === tasks.length) {
        newState.completedAt = new Date().toISOString()
      }

      setOperationState(newState)
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

  const handleCloseProgress = () => {
    setOperationState(null)
  }

  return (
    <BulkSelectionProvider>
      <div className="space-y-4" data-testid="bulk-operation-demo">
        {/* Task Cards */}
        <div className="space-y-2" data-testid="task-list">
          {mockTasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        {/* Bulk Action Toolbar */}
        <BulkActionToolbar
          tasks={mockTasks}
          visibleTaskIds={mockTasks.map(t => t.id)}
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
          onClose={handleCloseProgress}
        />
      </div>
    </BulkSelectionProvider>
  )
}

describe('Bulk Operations Complete Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()

    // Reset mock state
    mockUseBulkTaskOperations.isOperating = false
    mockUseBulkTaskOperations.currentOperation = null
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  describe('Complete Cancel Flow', () => {
    it('executes complete cancel flow with confirmation', async () => {
      render(<BulkOperationDemoApp />)

      // 1. Select cancellable tasks
      fireEvent.click(screen.getByTestId('task-checkbox-task-1')) // in-progress (cancellable)

      // 2. Verify toolbar appears
      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()
      expect(screen.getByText('1 selected')).toBeInTheDocument()

      // 3. Click cancel button
      const cancelButton = screen.getByTestId('bulk-cancel-button')
      expect(cancelButton).not.toBeDisabled()
      fireEvent.click(cancelButton)

      // 4. Verify confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })
      expect(screen.getByText('Cancel Tasks')).toBeInTheDocument()
      expect(screen.getByText('Task 1 - In Progress')).toBeInTheDocument()

      // 5. Confirm action
      fireEvent.click(screen.getByTestId('confirm-button'))

      // 6. Verify progress indicator appears
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })
      expect(screen.getByText('Cancelling 1 tasks...')).toBeInTheDocument()

      // 7. Wait for operation to complete
      await waitFor(() => {
        expect(screen.getByText(/Successfully cancelled/)).toBeInTheDocument()
      }, { timeout: 3000 })

      // 8. Verify close button appears and works
      fireEvent.click(screen.getByTestId('close-button'))
      expect(screen.queryByTestId('bulk-operation-progress')).not.toBeInTheDocument()
    })

    it('skips confirmation when "don\'t ask again" is checked', async () => {
      render(<BulkOperationDemoApp />)

      // Select task and cancel
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))

      // Check "don't ask again" and confirm
      fireEvent.click(screen.getByTestId('dont-ask-again-checkbox'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Wait for operation to complete
      await waitFor(() => {
        expect(screen.getByText(/Successfully cancelled/)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Close progress
      fireEvent.click(screen.getByTestId('close-button'))

      // Try cancel again - should skip confirmation
      fireEvent.click(screen.getByTestId('task-checkbox-task-2')) // Select failed task first
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))

      // Should go directly to progress (no confirmation dialog)
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('bulk-confirmation-dialog')).not.toBeInTheDocument()
    })
  })

  describe('Complete Retry Flow', () => {
    it('executes complete retry flow without confirmation', async () => {
      render(<BulkOperationDemoApp />)

      // Select retryable task (failed)
      fireEvent.click(screen.getByTestId('task-checkbox-task-2'))

      // Click retry button
      const retryButton = screen.getByTestId('bulk-retry-button')
      expect(retryButton).not.toBeDisabled()
      fireEvent.click(retryButton)

      // Should skip confirmation dialog and go directly to progress
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('bulk-confirmation-dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Retrying 1 tasks...')).toBeInTheDocument()

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/Successfully retried|1 succeeded/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Complete Delete Flow', () => {
    it('executes complete delete flow with confirmation', async () => {
      render(<BulkOperationDemoApp />)

      // Select deletable tasks (completed, failed, cancelled)
      fireEvent.click(screen.getByTestId('task-checkbox-task-3')) // completed
      fireEvent.click(screen.getByTestId('task-checkbox-task-4')) // cancelled

      // Click delete button
      const deleteButton = screen.getByTestId('bulk-delete-button')
      expect(deleteButton).not.toBeDisabled()
      fireEvent.click(deleteButton)

      // Verify confirmation dialog
      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })
      expect(screen.getByText('Delete Tasks')).toBeInTheDocument()
      expect(screen.getByText('2 tasks')).toBeInTheDocument()

      // Confirm deletion
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Verify progress
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })
      expect(screen.getByText('Deleting 2 tasks...')).toBeInTheDocument()

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/Successfully deleted|succeeded/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Mixed Selection and Filtering', () => {
    it('handles mixed task selection with appropriate button states', async () => {
      render(<BulkOperationDemoApp />)

      // Select tasks with different statuses
      fireEvent.click(screen.getByTestId('task-checkbox-task-1')) // in-progress (cancellable)
      fireEvent.click(screen.getByTestId('task-checkbox-task-2')) // failed (retryable)
      fireEvent.click(screen.getByTestId('task-checkbox-task-3')) // completed (deletable)

      // Verify selection count
      expect(screen.getByText('3 selected')).toBeInTheDocument()

      // Verify button states and counts
      expect(screen.getByText('Cancel (1)')).toBeInTheDocument() // Only task-1 is cancellable
      expect(screen.getByText('Retry (1)')).toBeInTheDocument()   // Only task-2 is retryable
      expect(screen.getByText('Delete (1)')).toBeInTheDocument()  // Only task-3 is deletable

      // All buttons should be enabled because at least one task is eligible for each
      expect(screen.getByTestId('bulk-cancel-button')).not.toBeDisabled()
      expect(screen.getByTestId('bulk-retry-button')).not.toBeDisabled()
      expect(screen.getByTestId('bulk-delete-button')).not.toBeDisabled()
    })

    it('updates button states when selection changes', async () => {
      render(<BulkOperationDemoApp />)

      // Initially select only non-cancellable tasks
      fireEvent.click(screen.getByTestId('task-checkbox-task-2')) // failed
      fireEvent.click(screen.getByTestId('task-checkbox-task-3')) // completed

      // Cancel should be disabled (no cancellable tasks selected)
      expect(screen.getByTestId('bulk-cancel-button')).toBeDisabled()
      expect(screen.getByText('Cancel (0)')).toBeInTheDocument()

      // Add a cancellable task
      fireEvent.click(screen.getByTestId('task-checkbox-task-1')) // in-progress

      // Cancel should now be enabled
      expect(screen.getByTestId('bulk-cancel-button')).not.toBeDisabled()
      expect(screen.getByText('Cancel (1)')).toBeInTheDocument()
    })
  })

  describe('Select All Functionality', () => {
    it('implements select all via toolbar checkbox', async () => {
      render(<BulkOperationDemoApp />)

      // Select one task to show toolbar
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))

      // Click select all checkbox
      const selectAllCheckbox = screen.getByTestId('select-all-checkbox')
      fireEvent.click(selectAllCheckbox)

      // All tasks should now be selected
      expect(screen.getByText('4 selected')).toBeInTheDocument()

      // All individual checkboxes should be checked
      expect(screen.getByTestId('task-checkbox-task-1')).toBeChecked()
      expect(screen.getByTestId('task-checkbox-task-2')).toBeChecked()
      expect(screen.getByTestId('task-checkbox-task-3')).toBeChecked()
      expect(screen.getByTestId('task-checkbox-task-4')).toBeChecked()

      // Select all checkbox should be checked (not indeterminate)
      expect(selectAllCheckbox).toBeChecked()
    })

    it('shows indeterminate state for partial selection', async () => {
      render(<BulkOperationDemoApp />)

      // Select some but not all tasks
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-2'))

      // Select all checkbox should be indeterminate
      const selectAllCheckbox = screen.getByTestId('select-all-checkbox') as HTMLInputElement
      expect(selectAllCheckbox.indeterminate).toBe(true)
      expect(selectAllCheckbox.checked).toBe(false)

      expect(screen.getByText('2 selected')).toBeInTheDocument()
    })

    it('deselects all when clicking select all from full selection', async () => {
      render(<BulkOperationDemoApp />)

      // Select all tasks manually
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-2'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-3'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-4'))

      // Verify all selected
      expect(screen.getByText('4 selected')).toBeInTheDocument()

      // Click select all checkbox to deselect all
      const selectAllCheckbox = screen.getByTestId('select-all-checkbox')
      fireEvent.click(selectAllCheckbox)

      // Toolbar should be hidden (no selection)
      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()

      // All checkboxes should be unchecked
      expect(screen.getByTestId('task-checkbox-task-1')).not.toBeChecked()
      expect(screen.getByTestId('task-checkbox-task-2')).not.toBeChecked()
      expect(screen.getByTestId('task-checkbox-task-3')).not.toBeChecked()
      expect(screen.getByTestId('task-checkbox-task-4')).not.toBeChecked()
    })
  })

  describe('Operation Progress and Abort', () => {
    it('shows real-time progress updates', async () => {
      render(<BulkOperationDemoApp />)

      // Select multiple tasks for a longer operation
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-2'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-3'))

      // Start cancel operation
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Monitor progress updates
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })

      // Should show initial state
      expect(screen.getByText('Cancelling 3 tasks...')).toBeInTheDocument()

      // Check for progress bar
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/Successfully|succeeded/)).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('supports aborting operations', async () => {
      render(<BulkOperationDemoApp />)

      // Start a longer operation
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-2'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-3'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-4'))

      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Wait for progress to start
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })

      // Click abort button quickly
      const abortButton = screen.getByTestId('abort-button')
      fireEvent.click(abortButton)

      // Should show aborted state
      await waitFor(() => {
        expect(screen.queryByTestId('abort-button')).not.toBeInTheDocument()
      })

      // Should show close button
      expect(screen.getByTestId('close-button')).toBeInTheDocument()
    })
  })

  describe('Detailed Results and Error Handling', () => {
    it('shows detailed results for mixed success/failure', async () => {
      render(<BulkOperationDemoApp />)

      // Start operation with multiple tasks
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-2'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-3'))

      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/succeeded.*failed|Successfully/)).toBeInTheDocument()
      }, { timeout: 5000 })

      // Expand details
      const expandButton = screen.getByTestId('expand-details-button')
      fireEvent.click(expandButton)

      // Should show individual results
      await waitFor(() => {
        expect(screen.getByTestId('operation-results')).toBeInTheDocument()
      })

      // Should show task details and any errors
      expect(screen.getByText('Task 1 - In Progress')).toBeInTheDocument()
      expect(screen.getByText('Task 2 - Failed')).toBeInTheDocument()
      expect(screen.getByText('Task 3 - Completed')).toBeInTheDocument()
    })

    it('handles all failures gracefully', async () => {
      // Mock all operations to fail
      const originalMathRandom = Math.random
      Math.random = () => 0.9 // Force 100% failure rate

      render(<BulkOperationDemoApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Wait for failure result
      await waitFor(() => {
        expect(screen.getByText(/0 succeeded, 1 failed/)).toBeInTheDocument()
      }, { timeout: 3000 })

      // Expand details to see error
      fireEvent.click(screen.getByTestId('expand-details-button'))

      await waitFor(() => {
        expect(screen.getByText('Simulated API error')).toBeInTheDocument()
      })

      // Restore Math.random
      Math.random = originalMathRandom
    })
  })

  describe('Toolbar and Progress Interaction', () => {
    it('hides toolbar during operation and shows progress instead', async () => {
      render(<BulkOperationDemoApp />)

      // Select and start operation
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Toolbar should be hidden during operation
      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
        expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()
      })

      // Wait for completion and close
      await waitFor(() => {
        expect(screen.getByTestId('close-button')).toBeInTheDocument()
      }, { timeout: 3000 })

      fireEvent.click(screen.getByTestId('close-button'))

      // Progress should be hidden, but toolbar should still be hidden if no selection
      expect(screen.queryByTestId('bulk-operation-progress')).not.toBeInTheDocument()
      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()
    })

    it('maintains selection state after operation completion', async () => {
      render(<BulkOperationDemoApp />)

      // Select tasks
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('task-checkbox-task-2'))

      // Start operation
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('close-button')).toBeInTheDocument()
      }, { timeout: 3000 })

      fireEvent.click(screen.getByTestId('close-button'))

      // Tasks should still be selected (checkboxes checked)
      expect(screen.getByTestId('task-checkbox-task-1')).toBeChecked()
      expect(screen.getByTestId('task-checkbox-task-2')).toBeChecked()

      // Toolbar should reappear
      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()
      expect(screen.getByText('2 selected')).toBeInTheDocument()
    })
  })

  describe('Accessibility in Complete Flow', () => {
    it('maintains proper ARIA states throughout operation', async () => {
      render(<BulkOperationDemoApp />)

      // Select task
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))

      // Check toolbar accessibility
      const toolbar = screen.getByTestId('bulk-action-toolbar')
      expect(toolbar).toHaveAttribute('role', 'toolbar')
      expect(toolbar).toHaveAttribute('aria-label', 'Bulk task actions')

      // Start operation
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))

      // Check dialog accessibility
      await waitFor(() => {
        const dialog = screen.getByTestId('bulk-confirmation-dialog')
        expect(dialog).toHaveAttribute('role', 'dialog')
        expect(dialog).toHaveAttribute('aria-labelledby')
      })

      // Confirm
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Check progress accessibility
      await waitFor(() => {
        const progress = screen.getByTestId('bulk-operation-progress')
        expect(progress).toHaveAttribute('role', 'region')
        expect(progress).toHaveAttribute('aria-label')
      })
    })

    it('supports keyboard navigation throughout flow', async () => {
      render(<BulkOperationDemoApp />)

      // Keyboard select task
      const checkbox = screen.getByTestId('task-checkbox-task-1')
      checkbox.focus()
      fireEvent.keyDown(checkbox, { key: ' ' })

      expect(checkbox).toBeChecked()

      // Tab to cancel button and activate
      const cancelButton = screen.getByTestId('bulk-cancel-button')
      cancelButton.focus()
      expect(cancelButton).toHaveFocus()

      fireEvent.keyDown(cancelButton, { key: 'Enter' })

      // Check dialog focus management
      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirmation-dialog')).toBeInTheDocument()
      })

      // Confirm button should be focusable
      const confirmButton = screen.getByTestId('confirm-button')
      confirmButton.focus()
      expect(confirmButton).toHaveFocus()
    })

    it('provides screen reader announcements for state changes', async () => {
      render(<BulkOperationDemoApp />)

      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      // Progress should have live region for updates
      await waitFor(() => {
        const progressText = screen.getByText('Cancelling 1 tasks...')
        const liveRegion = progressText.closest('[aria-live]')
        expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      })
    })
  })

  describe('Performance and Memory Management', () => {
    it('handles rapid operation cycles without memory leaks', async () => {
      render(<BulkOperationDemoApp />)

      // Perform multiple rapid operations
      for (let i = 0; i < 3; i++) {
        // Select task
        fireEvent.click(screen.getByTestId('task-checkbox-task-1'))

        // Quick cancel (skip confirmation with session storage)
        sessionStorage.setItem('bulk-action-skip-cancel', 'true')
        fireEvent.click(screen.getByTestId('bulk-cancel-button'))

        // Wait for completion
        await waitFor(() => {
          expect(screen.getByTestId('close-button')).toBeInTheDocument()
        }, { timeout: 2000 })

        // Close and reset
        fireEvent.click(screen.getByTestId('close-button'))
        fireEvent.click(screen.getByTestId('task-checkbox-task-1')) // Deselect

        sessionStorage.clear()
      }

      // Should complete without errors
      expect(screen.getByTestId('bulk-operation-demo')).toBeInTheDocument()
    })

    it('properly cleans up when component unmounts during operation', async () => {
      const { unmount } = render(<BulkOperationDemoApp />)

      // Start operation
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      fireEvent.click(screen.getByTestId('confirm-button'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
      })

      // Unmount during operation - should not cause errors
      expect(() => unmount()).not.toThrow()
    })
  })
})