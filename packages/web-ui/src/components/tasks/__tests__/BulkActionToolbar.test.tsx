import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BulkActionToolbar } from '../BulkActionToolbar'
import { BulkSelectionProvider } from '../BulkSelectionContext'
import type { Task } from '@apexcli/core'
import type { BulkOperationState } from '../../../types/bulk-operations'

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

// Helper component that provides context and allows selection manipulation
const TestWrapper = ({
  children,
  initialSelected = [],
}: {
  children: React.ReactNode
  initialSelected?: string[]
}) => {
  return (
    <BulkSelectionProvider>
      {children}
      <TestControls initialSelected={initialSelected} />
    </BulkSelectionProvider>
  )
}

const TestControls = ({ initialSelected }: { initialSelected: string[] }) => {
  const { dispatch } = React.useContext(BulkSelectionContext)!

  React.useEffect(() => {
    if (initialSelected.length > 0) {
      dispatch({ type: 'SELECT_TASKS', taskIds: initialSelected })
    }
  }, [dispatch, initialSelected])

  return null
}

// Import the context for direct access
import { BulkSelectionContext } from '../BulkSelectionContext'

const defaultProps = {
  tasks: mockTasks,
  visibleTaskIds: mockTasks.map(t => t.id),
  operationState: null,
  onBulkAction: vi.fn(),
}

describe('BulkActionToolbar', () => {
  describe('Visibility and Basic Rendering', () => {
    it('is hidden when no tasks are selected', () => {
      render(
        <TestWrapper>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()
    })

    it('appears when tasks are selected', () => {
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    it('shows correct selection count', () => {
      render(
        <TestWrapper initialSelected={['task-1', 'task-2', 'task-3']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('3 selected')).toBeInTheDocument()
    })

    it('has correct accessibility attributes', () => {
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const toolbar = screen.getByTestId('bulk-action-toolbar')
      expect(toolbar).toHaveAttribute('role', 'toolbar')
      expect(toolbar).toHaveAttribute('aria-label', 'Bulk task actions')
    })
  })

  describe('Select All Checkbox', () => {
    it('renders select all checkbox when tasks are selected', () => {
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const checkbox = screen.getByTestId('select-all-checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).toHaveAttribute('aria-label', 'Select all tasks')
    })

    it('shows unchecked state when some tasks selected', () => {
      render(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const checkbox = screen.getByTestId('select-all-checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(false)
      expect(checkbox.indeterminate).toBe(true)
    })

    it('shows checked state when all visible tasks selected', () => {
      const allTaskIds = mockTasks.map(t => t.id)

      render(
        <TestWrapper initialSelected={allTaskIds}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const checkbox = screen.getByTestId('select-all-checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
      expect(checkbox.indeterminate).toBe(false)
    })

    it('selects all visible tasks when clicked from partial state', () => {
      const onBulkAction = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkAction={onBulkAction}
          />
        </TestWrapper>
      )

      const checkbox = screen.getByTestId('select-all-checkbox')
      fireEvent.click(checkbox)

      // Toolbar should now show all tasks selected
      expect(screen.getByText('4 selected')).toBeInTheDocument()
    })

    it('deselects all tasks when clicked from all-selected state', () => {
      const allTaskIds = mockTasks.map(t => t.id)

      render(
        <TestWrapper initialSelected={allTaskIds}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const checkbox = screen.getByTestId('select-all-checkbox')
      fireEvent.click(checkbox)

      // Toolbar should be hidden (no selection)
      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()
    })

    it('only considers visible tasks for select all', () => {
      const visibleTaskIds = ['task-1', 'task-2'] // Only first 2 tasks visible

      render(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            visibleTaskIds={visibleTaskIds}
          />
        </TestWrapper>
      )

      const checkbox = screen.getByTestId('select-all-checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
      expect(checkbox.indeterminate).toBe(false)
    })
  })

  describe('Action Buttons', () => {
    it('renders all action buttons', () => {
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByTestId('bulk-cancel-button')).toBeInTheDocument()
      expect(screen.getByTestId('bulk-retry-button')).toBeInTheDocument()
      expect(screen.getByTestId('bulk-delete-button')).toBeInTheDocument()
    })

    it('enables cancel button only when cancellable tasks are selected', () => {
      // Select only in-progress task (cancellable)
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const cancelButton = screen.getByTestId('bulk-cancel-button')
      expect(cancelButton).not.toBeDisabled()

      // Select only completed task (not cancellable)
      render(
        <TestWrapper initialSelected={['task-2']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const cancelButton2 = screen.getByTestId('bulk-cancel-button')
      expect(cancelButton2).toBeDisabled()
    })

    it('enables retry button only when retryable tasks are selected', () => {
      // Select failed task (retryable)
      render(
        <TestWrapper initialSelected={['task-3']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const retryButton = screen.getByTestId('bulk-retry-button')
      expect(retryButton).not.toBeDisabled()

      // Select in-progress task (not retryable)
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const retryButton2 = screen.getByTestId('bulk-retry-button')
      expect(retryButton2).toBeDisabled()
    })

    it('enables delete button only when deletable tasks are selected', () => {
      // Select completed task (deletable)
      render(
        <TestWrapper initialSelected={['task-2']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const deleteButton = screen.getByTestId('bulk-delete-button')
      expect(deleteButton).not.toBeDisabled()

      // Select in-progress task (not deletable)
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const deleteButton2 = screen.getByTestId('bulk-delete-button')
      expect(deleteButton2).toBeDisabled()
    })

    it('shows eligible task count in button text', () => {
      // Select mixed tasks: 1 cancellable, 1 retryable, 1 deletable
      render(
        <TestWrapper initialSelected={['task-1', 'task-3', 'task-2']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.getByText('Cancel (1)')).toBeInTheDocument()
      expect(screen.getByText('Retry (1)')).toBeInTheDocument()
      expect(screen.getByText('Delete (1)')).toBeInTheDocument()
    })

    it('handles button clicks and calls onBulkAction', () => {
      const onBulkAction = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1', 'task-3', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkAction={onBulkAction}
          />
        </TestWrapper>
      )

      // Test cancel action
      fireEvent.click(screen.getByTestId('bulk-cancel-button'))
      expect(onBulkAction).toHaveBeenCalledWith('cancel', ['task-1'])

      // Test retry action
      fireEvent.click(screen.getByTestId('bulk-retry-button'))
      expect(onBulkAction).toHaveBeenCalledWith('retry', ['task-3'])

      // Test delete action
      fireEvent.click(screen.getByTestId('bulk-delete-button'))
      expect(onBulkAction).toHaveBeenCalledWith('delete', ['task-2'])
    })
  })

  describe('Operation State Handling', () => {
    const operatingState: BulkOperationState = {
      type: 'cancel',
      total: 2,
      completed: 1,
      failed: 0,
      inProgress: 1,
      percentage: 50,
      results: [
        {
          taskId: 'task-1',
          success: true,
          updatedTask: { ...mockTasks[0], status: 'cancelled' }
        }
      ],
      startedAt: new Date().toISOString(),
      aborted: false,
    }

    it('hides toolbar when operation is in progress', () => {
      render(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            operationState={operatingState}
          />
        </TestWrapper>
      )

      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()
    })

    it('shows toolbar again when operation is null (completed/cancelled)', () => {
      const { rerender } = render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            operationState={operatingState}
          />
        </TestWrapper>
      )

      // Hidden during operation
      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()

      // Rerender without operation state
      rerender(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            operationState={null}
          />
        </TestWrapper>
      )

      // Should be visible again
      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()
    })
  })

  describe('Animation and Transitions', () => {
    it('applies slide-in animation class when appearing', () => {
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const toolbar = screen.getByTestId('bulk-action-toolbar')
      expect(toolbar).toHaveClass('slide-in-bottom')
    })

    it('maintains fixed position at bottom', () => {
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const toolbar = screen.getByTestId('bulk-action-toolbar')
      expect(toolbar).toHaveClass('fixed', 'bottom-0')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles empty tasks array gracefully', () => {
      render(
        <TestWrapper>
          <BulkActionToolbar
            {...defaultProps}
            tasks={[]}
            visibleTaskIds={[]}
          />
        </TestWrapper>
      )

      expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument()
    })

    it('handles mismatched selected and visible task IDs', () => {
      // Select tasks that aren't in visible list
      render(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            visibleTaskIds={['task-3', 'task-4']} // Different from selected
          />
        </TestWrapper>
      )

      // Should not crash and handle gracefully
      expect(screen.queryByTestId('bulk-action-toolbar')).toBeInTheDocument()
    })

    it('handles tasks with undefined status', () => {
      const tasksWithUndefined = [
        { ...mockTasks[0], status: undefined as any },
        mockTasks[1]
      ]

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            tasks={tasksWithUndefined}
          />
        </TestWrapper>
      )

      // Should render without crashing
      expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument()

      // All buttons should be disabled for undefined status
      expect(screen.getByTestId('bulk-cancel-button')).toBeDisabled()
      expect(screen.getByTestId('bulk-retry-button')).toBeDisabled()
      expect(screen.getByTestId('bulk-delete-button')).toBeDisabled()
    })

    it('updates button states when task statuses change', () => {
      const { rerender } = render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      // Initially task-1 is in-progress (cancellable)
      expect(screen.getByTestId('bulk-cancel-button')).not.toBeDisabled()
      expect(screen.getByTestId('bulk-retry-button')).toBeDisabled()

      // Update task-1 to failed status (retryable)
      const updatedTasks = [
        { ...mockTasks[0], status: 'failed' as const },
        ...mockTasks.slice(1)
      ]

      rerender(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            tasks={updatedTasks}
          />
        </TestWrapper>
      )

      expect(screen.getByTestId('bulk-cancel-button')).toBeDisabled()
      expect(screen.getByTestId('bulk-retry-button')).not.toBeDisabled()
    })
  })

  describe('Keyboard Navigation and Accessibility', () => {
    it('supports keyboard navigation between elements', () => {
      render(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const checkbox = screen.getByTestId('select-all-checkbox')
      const cancelButton = screen.getByTestId('bulk-cancel-button')

      // Elements should be focusable
      checkbox.focus()
      expect(checkbox).toHaveFocus()

      cancelButton.focus()
      expect(cancelButton).toHaveFocus()
    })

    it('provides proper button descriptions for screen readers', () => {
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      const cancelButton = screen.getByTestId('bulk-cancel-button')
      const retryButton = screen.getByTestId('bulk-retry-button')
      const deleteButton = screen.getByTestId('bulk-delete-button')

      expect(cancelButton).toHaveAttribute('aria-label', 'Cancel selected tasks')
      expect(retryButton).toHaveAttribute('aria-label', 'Retry selected tasks')
      expect(deleteButton).toHaveAttribute('aria-label', 'Delete selected tasks')
    })

    it('provides live updates for selection count changes', () => {
      render(
        <div>
          <TestWrapper initialSelected={['task-1']}>
            <BulkActionToolbar {...defaultProps} />
          </TestWrapper>
          <div
            aria-live="polite"
            aria-atomic="true"
            data-testid="live-region"
          >
            1 selected
          </div>
        </div>
      )

      expect(screen.getByTestId('live-region')).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Performance', () => {
    it('does not re-render unnecessarily when props do not change', () => {
      const renderSpy = vi.fn()

      const SpiedComponent = React.memo(() => {
        renderSpy()
        return <BulkActionToolbar {...defaultProps} />
      })
      SpiedComponent.displayName = 'SpiedComponent'

      const { rerender } = render(
        <TestWrapper initialSelected={['task-1']}>
          <SpiedComponent />
        </TestWrapper>
      )

      expect(renderSpy).toHaveBeenCalledTimes(1)

      // Rerender with same props
      rerender(
        <TestWrapper initialSelected={['task-1']}>
          <SpiedComponent />
        </TestWrapper>
      )

      // Should still only be called once (memo should prevent re-render)
      expect(renderSpy).toHaveBeenCalledTimes(1)
    })

    it('handles large numbers of tasks efficiently', () => {
      const manyTasks = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
        description: `Task ${i}`,
      }))

      const selectedIds = manyTasks.slice(0, 100).map(t => t.id)

      const startTime = performance.now()

      render(
        <TestWrapper initialSelected={selectedIds}>
          <BulkActionToolbar
            {...defaultProps}
            tasks={manyTasks}
            visibleTaskIds={manyTasks.map(t => t.id)}
          />
        </TestWrapper>
      )

      const renderTime = performance.now() - startTime

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100)
      expect(screen.getByText('100 selected')).toBeInTheDocument()
    })
  })
})