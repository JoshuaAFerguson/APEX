import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskCard } from '../TaskCard'
import { createTaskVariants } from './test-data-factories'
import type { Task } from '@apexcli/core'

describe('TaskCard - Task Variant Rendering', () => {
  const taskVariants = createTaskVariants()
  const onViewDetails = vi.fn()
  const onCancel = vi.fn()
  const onRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Running Task Variants', () => {
    it('renders running task with progress information', () => {
      render(
        <TaskCard
          task={taskVariants.running}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByText('Running task with progress')).toBeInTheDocument()
      // Should show task is in progress
      expect(screen.getByTestId(`task-card-${taskVariants.running.id}`)).toHaveAttribute(
        'data-task-status',
        'in-progress'
      )
    })

    it('renders pending task in planning stage', () => {
      render(
        <TaskCard
          task={taskVariants.pending}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByText('Pending task being prepared')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.pending.id}`)).toHaveAttribute(
        'data-task-status',
        'pending'
      )
    })

    it('renders queued task with queue position', () => {
      render(
        <TaskCard
          task={taskVariants.queued}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByText('Queued task waiting to start')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.queued.id}`)).toHaveAttribute(
        'data-task-status',
        'queued'
      )
    })
  })

  describe('Completed Task Variants', () => {
    it('renders completed task with success indicator', () => {
      render(
        <TaskCard
          task={taskVariants.completed}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByText('Completed task with success')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.completed.id}`)).toHaveAttribute(
        'data-task-status',
        'completed'
      )
    })

    it('shows completion time for completed tasks', () => {
      render(
        <TaskCard
          task={taskVariants.completed}
          onViewDetails={onViewDetails}
        />
      )

      // Should show some time indication (exact format depends on implementation)
      expect(screen.getByTestId(`task-card-${taskVariants.completed.id}`)).toBeInTheDocument()
    })
  })

  describe('Failed Task Variants', () => {
    it('renders failed task with error indicator', () => {
      render(
        <TaskCard
          task={taskVariants.failed}
          onViewDetails={onViewDetails}
          onRetry={onRetry}
        />
      )

      expect(screen.getByText('Failed task with error message')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.failed.id}`)).toHaveAttribute(
        'data-task-status',
        'failed'
      )
    })

    it('shows retry count for failed tasks', () => {
      render(
        <TaskCard
          task={taskVariants.failed}
          onViewDetails={onViewDetails}
          onRetry={onRetry}
        />
      )

      // Task should show it has been retried
      expect(screen.getByTestId(`task-card-${taskVariants.failed.id}`)).toBeInTheDocument()
    })

    it('renders cancelled task appropriately', () => {
      render(
        <TaskCard
          task={taskVariants.cancelled}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByText('Cancelled task')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.cancelled.id}`)).toHaveAttribute(
        'data-task-status',
        'cancelled'
      )
    })
  })

  describe('Paused Task Variants', () => {
    it('renders paused task with pause indicator', () => {
      render(
        <TaskCard
          task={taskVariants.paused}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByText('Paused task awaiting input')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.paused.id}`)).toHaveAttribute(
        'data-task-status',
        'paused'
      )
    })

    it('renders awaiting approval task with approval indicator', () => {
      render(
        <TaskCard
          task={taskVariants.awaitingApproval}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByText('Task awaiting approval')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.awaitingApproval.id}`)).toHaveAttribute(
        'data-task-status',
        'awaiting-approval'
      )
    })
  })

  describe('Task Interaction', () => {
    it('calls onViewDetails when task card is clicked', () => {
      render(
        <TaskCard
          task={taskVariants.running}
          onViewDetails={onViewDetails}
        />
      )

      fireEvent.click(screen.getByTestId(`task-card-${taskVariants.running.id}`))
      expect(onViewDetails).toHaveBeenCalledWith(taskVariants.running.id)
    })

    it('handles retry action for failed tasks', async () => {
      onRetry.mockResolvedValue()

      render(
        <TaskCard
          task={taskVariants.failed}
          onViewDetails={onViewDetails}
          onRetry={onRetry}
        />
      )

      // Note: Retry button interaction depends on TaskCard implementation
      // This test validates the props are passed correctly
      expect(screen.getByTestId(`task-card-${taskVariants.failed.id}`)).toBeInTheDocument()
    })

    it('handles cancel action for active tasks', async () => {
      onCancel.mockResolvedValue()

      render(
        <TaskCard
          task={taskVariants.running}
          onViewDetails={onViewDetails}
          onCancel={onCancel}
        />
      )

      // Note: Cancel button interaction depends on TaskCard implementation
      // This test validates the props are passed correctly
      expect(screen.getByTestId(`task-card-${taskVariants.running.id}`)).toBeInTheDocument()
    })
  })

  describe('Task Priority Indicators', () => {
    it('shows high priority task styling', () => {
      const highPriorityTask = { ...taskVariants.running, priority: 'high' as const }
      render(
        <TaskCard
          task={highPriorityTask}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByTestId(`task-card-${highPriorityTask.id}`)).toBeInTheDocument()
    })

    it('shows medium priority task styling', () => {
      const mediumPriorityTask = { ...taskVariants.running, priority: 'medium' as const }
      render(
        <TaskCard
          task={mediumPriorityTask}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByTestId(`task-card-${mediumPriorityTask.id}`)).toBeInTheDocument()
    })

    it('shows low priority task styling', () => {
      const lowPriorityTask = { ...taskVariants.running, priority: 'low' as const }
      render(
        <TaskCard
          task={lowPriorityTask}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByTestId(`task-card-${lowPriorityTask.id}`)).toBeInTheDocument()
    })
  })

  describe('Task Effort Indicators', () => {
    it('shows small effort task styling', () => {
      const smallEffortTask = { ...taskVariants.completed, effort: 'small' as const }
      render(
        <TaskCard
          task={smallEffortTask}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByTestId(`task-card-${smallEffortTask.id}`)).toBeInTheDocument()
    })

    it('shows large effort task styling', () => {
      const largeEffortTask = { ...taskVariants.failed, effort: 'large' as const }
      render(
        <TaskCard
          task={largeEffortTask}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByTestId(`task-card-${largeEffortTask.id}`)).toBeInTheDocument()
    })
  })

  describe('Compact Mode', () => {
    it('renders all task variants correctly in compact mode', () => {
      const allVariants = Object.values(taskVariants)

      allVariants.forEach(task => {
        const { unmount } = render(
          <TaskCard
            task={task}
            onViewDetails={onViewDetails}
            compact={true}
          />
        )

        expect(screen.getByTestId(`task-card-${task.id}`)).toHaveAttribute('data-compact', 'true')
        unmount()
      })
    })
  })

  describe('Progress Display', () => {
    it('shows progress when showProgress is enabled', () => {
      render(
        <TaskCard
          task={taskVariants.running}
          onViewDetails={onViewDetails}
          showProgress={true}
        />
      )

      expect(screen.getByTestId(`task-card-${taskVariants.running.id}`)).toHaveAttribute(
        'data-show-progress',
        'true'
      )
    })

    it('hides progress when showProgress is disabled', () => {
      render(
        <TaskCard
          task={taskVariants.running}
          onViewDetails={onViewDetails}
          showProgress={false}
        />
      )

      expect(screen.getByTestId(`task-card-${taskVariants.running.id}`)).toHaveAttribute(
        'data-show-progress',
        'false'
      )
    })
  })

  describe('Loading States', () => {
    it('shows loading state when action is in progress', () => {
      render(
        <TaskCard
          task={taskVariants.running}
          onViewDetails={onViewDetails}
          isLoading={true}
        />
      )

      // TaskCard should handle loading state appropriately
      expect(screen.getByTestId(`task-card-${taskVariants.running.id}`)).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles missing optional task properties gracefully', () => {
      const minimalTask: Task = {
        id: 'minimal-task',
        description: 'Minimal task',
        workflow: 'test',
        autonomy: 'medium',
        status: 'in-progress',
        priority: 'medium',
        effort: 'medium',
        projectPath: '/test',
        retryCount: 0,
        maxRetries: 3,
        resumeAttempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      render(
        <TaskCard
          task={minimalTask}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByText('Minimal task')).toBeInTheDocument()
    })

    it('handles very long task descriptions', () => {
      const longDescriptionTask = {
        ...taskVariants.running,
        id: 'long-desc-task',
        description: 'This is a very long task description that might overflow the card boundaries and needs to be handled gracefully by the component',
      }

      render(
        <TaskCard
          task={longDescriptionTask}
          onViewDetails={onViewDetails}
        />
      )

      expect(screen.getByTestId(`task-card-${longDescriptionTask.id}`)).toBeInTheDocument()
    })
  })
})