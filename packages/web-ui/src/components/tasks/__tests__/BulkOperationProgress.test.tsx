import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BulkOperationProgress } from '../BulkOperationProgress'
import type { Task } from '@apexcli/core'
import type { BulkOperationState, BulkOperationResult } from '../../../types/bulk-operations'

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

// Helper to create operation state
const createOperationState = (overrides: Partial<BulkOperationState> = {}): BulkOperationState => ({
  type: 'cancel',
  total: 3,
  completed: 1,
  failed: 0,
  inProgress: 2,
  percentage: 33.33,
  results: [
    {
      taskId: 'task-1',
      success: true,
      updatedTask: { ...mockTasks[0], status: 'cancelled' }
    }
  ],
  startedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  aborted: false,
  ...overrides,
})

const defaultProps = {
  operationState: createOperationState(),
  onAbort: vi.fn(),
  onClose: vi.fn(),
}

describe('BulkOperationProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T10:01:00Z')) // 1 minute after start
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('Visibility and Basic Rendering', () => {
    it('is not visible when operationState is null', () => {
      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={null}
        />
      )

      expect(screen.queryByTestId('bulk-operation-progress')).not.toBeInTheDocument()
    })

    it('is visible when operationState is provided', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
    })

    it('has correct accessibility attributes', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      const progress = screen.getByTestId('bulk-operation-progress')
      expect(progress).toHaveAttribute('role', 'region')
      expect(progress).toHaveAttribute('aria-label', 'Bulk operation progress: 1 of 3 tasks completed')
    })
  })

  describe('Progress Display', () => {
    it('shows correct progress percentage', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '33')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('displays correct status text for in-progress operation', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      expect(screen.getByText('Cancelling 3 tasks...')).toBeInTheDocument()
    })

    it('shows duration timer', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      expect(screen.getByText('60s')).toBeInTheDocument()
    })

    it('updates duration timer over time', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      expect(screen.getByText('60s')).toBeInTheDocument()

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      expect(screen.getByText('90s')).toBeInTheDocument()
    })

    it('displays status counts correctly', () => {
      const operationState = createOperationState({
        completed: 2,
        failed: 1,
        inProgress: 0,
        percentage: 100,
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={operationState}
        />
      )

      expect(screen.getByText('2')).toBeInTheDocument() // completed count
      expect(screen.getByText('1')).toBeInTheDocument() // failed count
    })

    it('shows different action text for different operation types', () => {
      const { rerender } = render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={createOperationState({ type: 'cancel' })}
        />
      )

      expect(screen.getByText('Cancelling 3 tasks...')).toBeInTheDocument()

      rerender(
        <BulkOperationProgress
          {...defaultProps}
          operationState={createOperationState({ type: 'retry' })}
        />
      )

      expect(screen.getByText('Retrying 3 tasks...')).toBeInTheDocument()

      rerender(
        <BulkOperationProgress
          {...defaultProps}
          operationState={createOperationState({ type: 'delete' })}
        />
      )

      expect(screen.getByText('Deleting 3 tasks...')).toBeInTheDocument()
    })

    it('shows completion status when operation is finished', () => {
      const completedState = createOperationState({
        completed: 3,
        inProgress: 0,
        percentage: 100,
        completedAt: new Date('2024-01-01T10:01:30Z').toISOString(),
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={completedState}
        />
      )

      expect(screen.getByText('Successfully cancelled 3 tasks')).toBeInTheDocument()
    })

    it('shows mixed completion status when some tasks failed', () => {
      const mixedState = createOperationState({
        completed: 2,
        failed: 1,
        inProgress: 0,
        percentage: 100,
        completedAt: new Date('2024-01-01T10:01:30Z').toISOString(),
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={mixedState}
        />
      )

      expect(screen.getByText('2 succeeded, 1 failed')).toBeInTheDocument()
    })
  })

  describe('Status Indicator', () => {
    it('shows blue pulsing dot for in-progress operation', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      const statusDot = screen.getByTestId('status-indicator')
      expect(statusDot).toHaveClass('bg-blue-500')
      expect(statusDot).toHaveClass('animate-pulse')
    })

    it('shows green dot for successful completion', () => {
      const completedState = createOperationState({
        completed: 3,
        failed: 0,
        inProgress: 0,
        percentage: 100,
        completedAt: new Date().toISOString(),
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={completedState}
        />
      )

      const statusDot = screen.getByTestId('status-indicator')
      expect(statusDot).toHaveClass('bg-green-500')
      expect(statusDot).not.toHaveClass('animate-pulse')
    })

    it('shows red dot for failed completion', () => {
      const failedState = createOperationState({
        completed: 1,
        failed: 2,
        inProgress: 0,
        percentage: 100,
        completedAt: new Date().toISOString(),
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={failedState}
        />
      )

      const statusDot = screen.getByTestId('status-indicator')
      expect(statusDot).toHaveClass('bg-red-500')
    })

    it('shows yellow dot for aborted operation', () => {
      const abortedState = createOperationState({
        completed: 1,
        inProgress: 0,
        aborted: true,
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={abortedState}
        />
      )

      const statusDot = screen.getByTestId('status-indicator')
      expect(statusDot).toHaveClass('bg-yellow-500')
    })
  })

  describe('Abort Functionality', () => {
    it('shows abort button for in-progress operations', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      expect(screen.getByTestId('abort-button')).toBeInTheDocument()
      expect(screen.getByText('Abort')).toBeInTheDocument()
    })

    it('calls onAbort when abort button is clicked', () => {
      const onAbort = vi.fn()

      render(
        <BulkOperationProgress
          {...defaultProps}
          onAbort={onAbort}
        />
      )

      const abortButton = screen.getByTestId('abort-button')
      fireEvent.click(abortButton)

      expect(onAbort).toHaveBeenCalled()
    })

    it('does not show abort button for completed operations', () => {
      const completedState = createOperationState({
        completed: 3,
        inProgress: 0,
        percentage: 100,
        completedAt: new Date().toISOString(),
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={completedState}
        />
      )

      expect(screen.queryByTestId('abort-button')).not.toBeInTheDocument()
    })

    it('shows close button for completed operations', () => {
      const completedState = createOperationState({
        completed: 3,
        inProgress: 0,
        percentage: 100,
        completedAt: new Date().toISOString(),
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={completedState}
        />
      )

      expect(screen.getByTestId('close-button')).toBeInTheDocument()
      expect(screen.getByText('Close')).toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn()
      const completedState = createOperationState({
        completed: 3,
        inProgress: 0,
        percentage: 100,
        completedAt: new Date().toISOString(),
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          onClose={onClose}
          operationState={completedState}
        />
      )

      const closeButton = screen.getByTestId('close-button')
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Detailed Results', () => {
    const detailedState = createOperationState({
      completed: 2,
      failed: 1,
      inProgress: 0,
      percentage: 100,
      results: [
        {
          taskId: 'task-1',
          success: true,
          updatedTask: { ...mockTasks[0], status: 'cancelled' }
        },
        {
          taskId: 'task-2',
          success: true,
          updatedTask: { ...mockTasks[1], status: 'cancelled' }
        },
        {
          taskId: 'task-3',
          success: false,
          error: 'Operation failed'
        }
      ],
      completedAt: new Date().toISOString(),
    })

    it('shows expandable details button', () => {
      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={detailedState}
        />
      )

      expect(screen.getByTestId('expand-details-button')).toBeInTheDocument()
      expect(screen.getByText('Show Details')).toBeInTheDocument()
    })

    it('expands and collapses details when button is clicked', () => {
      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={detailedState}
        />
      )

      // Initially collapsed
      expect(screen.queryByTestId('operation-results')).not.toBeInTheDocument()

      // Click to expand
      const expandButton = screen.getByTestId('expand-details-button')
      fireEvent.click(expandButton)

      expect(screen.getByTestId('operation-results')).toBeInTheDocument()
      expect(screen.getByText('Hide Details')).toBeInTheDocument()

      // Click to collapse
      fireEvent.click(expandButton)

      expect(screen.queryByTestId('operation-results')).not.toBeInTheDocument()
      expect(screen.getByText('Show Details')).toBeInTheDocument()
    })

    it('displays individual task results correctly', () => {
      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={detailedState}
        />
      )

      // Expand details
      fireEvent.click(screen.getByTestId('expand-details-button'))

      // Check successful results
      expect(screen.getByText('Task 1 - In Progress')).toBeInTheDocument()
      expect(screen.getByText('Task 2 - Completed')).toBeInTheDocument()
      expect(screen.getByText('task-1')).toBeInTheDocument()
      expect(screen.getByText('task-2')).toBeInTheDocument()

      // Check failed result
      expect(screen.getByText('Task 3 - Failed')).toBeInTheDocument()
      expect(screen.getByText('task-3')).toBeInTheDocument()
      expect(screen.getByText('Operation failed')).toBeInTheDocument()
    })

    it('shows correct icons for success and failure', () => {
      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={detailedState}
        />
      )

      fireEvent.click(screen.getByTestId('expand-details-button'))

      // Success icons (green)
      const successItems = screen.getAllByTestId('result-success')
      expect(successItems).toHaveLength(2)
      successItems.forEach(item => {
        expect(item).toHaveClass('bg-green-50')
      })

      // Failure icon (red)
      const failureItem = screen.getByTestId('result-failure')
      expect(failureItem).toHaveClass('bg-red-50')
    })
  })

  describe('Progress Animations', () => {
    it('animates progress bar changes', () => {
      const { rerender } = render(<BulkOperationProgress {...defaultProps} />)

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '33')

      // Update progress
      const updatedState = createOperationState({
        completed: 2,
        inProgress: 1,
        percentage: 66.67,
      })

      rerender(
        <BulkOperationProgress
          {...defaultProps}
          operationState={updatedState}
        />
      )

      // Progress bar should update
      expect(progressBar).toHaveAttribute('aria-valuenow', '67') // rounded
    })

    it('shows smooth transition classes', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      const progressBar = screen.getByTestId('progress-fill')
      expect(progressBar).toHaveClass('transition-all', 'duration-300', 'ease-out')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles zero total tasks gracefully', () => {
      const zeroState = createOperationState({
        total: 0,
        completed: 0,
        failed: 0,
        inProgress: 0,
        percentage: 0,
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={zeroState}
        />
      )

      expect(screen.getByText('Cancelling 0 tasks...')).toBeInTheDocument()
    })

    it('handles missing task information in results', () => {
      const stateWithMissingTasks = createOperationState({
        results: [
          {
            taskId: 'unknown-task',
            success: true,
          },
          {
            taskId: 'task-1',
            success: false,
            error: 'Unknown error'
          }
        ]
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={stateWithMissingTasks}
        />
      )

      fireEvent.click(screen.getByTestId('expand-details-button'))

      // Should show task ID even if task not found
      expect(screen.getByText('unknown-task')).toBeInTheDocument()
      expect(screen.getByText('Unknown error')).toBeInTheDocument()
    })

    it('handles invalid dates gracefully', () => {
      const invalidDateState = createOperationState({
        startedAt: 'invalid-date',
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={invalidDateState}
        />
      )

      // Should not crash and show some duration
      expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
    })

    it('handles very long task descriptions', () => {
      const longDescState = createOperationState({
        results: [
          {
            taskId: 'task-1',
            success: true,
            updatedTask: {
              ...mockTasks[0],
              description: 'This is an extremely long task description that should be handled gracefully without breaking the layout of the progress component'
            }
          }
        ]
      })

      render(
        <BulkOperationProgress
          {...defaultProps}
          operationState={longDescState}
        />
      )

      fireEvent.click(screen.getByTestId('expand-details-button'))

      // Should render without breaking layout
      expect(screen.getByTestId('operation-results')).toBeInTheDocument()
    })

    it('handles rapid state updates', () => {
      const { rerender } = render(<BulkOperationProgress {...defaultProps} />)

      // Rapidly update state multiple times
      for (let i = 0; i < 10; i++) {
        const updatedState = createOperationState({
          completed: i,
          percentage: (i / 3) * 100,
        })

        rerender(
          <BulkOperationProgress
            {...defaultProps}
            operationState={updatedState}
          />
        )
      }

      // Should handle all updates without crashing
      expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
    })
  })

  describe('Accessibility Compliance', () => {
    it('provides comprehensive screen reader information', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      const progress = screen.getByTestId('bulk-operation-progress')
      expect(progress).toHaveAttribute('aria-label', 'Bulk operation progress: 1 of 3 tasks completed')

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', 'Cancel operation progress')
    })

    it('provides live updates for progress changes', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      const statusText = screen.getByText('Cancelling 3 tasks...')
      const parentElement = statusText.closest('[aria-live]')
      expect(parentElement).toHaveAttribute('aria-live', 'polite')
    })

    it('supports keyboard navigation for interactive elements', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      const abortButton = screen.getByTestId('abort-button')
      const expandButton = screen.getByTestId('expand-details-button')

      // Elements should be focusable
      abortButton.focus()
      expect(abortButton).toHaveFocus()

      expandButton.focus()
      expect(expandButton).toHaveFocus()
    })

    it('provides proper button descriptions', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      const abortButton = screen.getByTestId('abort-button')
      const expandButton = screen.getByTestId('expand-details-button')

      expect(abortButton).toHaveAttribute('aria-label', 'Abort bulk operation')
      expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    })

    it('updates aria-expanded when details are toggled', () => {
      render(<BulkOperationProgress {...defaultProps} />)

      const expandButton = screen.getByTestId('expand-details-button')
      expect(expandButton).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(expandButton)
      expect(expandButton).toHaveAttribute('aria-expanded', 'true')

      fireEvent.click(expandButton)
      expect(expandButton).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('Memory Management', () => {
    it('cleans up timer when component unmounts', () => {
      const { unmount } = render(<BulkOperationProgress {...defaultProps} />)

      // Timer should be running
      expect(screen.getByText('60s')).toBeInTheDocument()

      // Unmount component
      unmount()

      // Advance timers - should not update anything
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      // No memory leaks or console errors expected
    })

    it('handles component re-mounting with different states', () => {
      const { rerender } = render(<BulkOperationProgress {...defaultProps} />)

      expect(screen.getByText('Cancelling 3 tasks...')).toBeInTheDocument()

      rerender(
        <BulkOperationProgress
          {...defaultProps}
          operationState={null}
        />
      )

      expect(screen.queryByTestId('bulk-operation-progress')).not.toBeInTheDocument()

      rerender(<BulkOperationProgress {...defaultProps} />)

      expect(screen.getByTestId('bulk-operation-progress')).toBeInTheDocument()
    })
  })
})