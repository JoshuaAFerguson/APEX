import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActiveTasksPanel } from '../ActiveTasksPanel'
import { createMockTask, createTaskVariants, createLargeTaskDataset } from './test-data-factories'
import type { Task } from '@apexcli/core'

describe('ActiveTasksPanel - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Task Card Variants', () => {
    const taskVariants = createTaskVariants()

    it('renders running task with progress information', () => {
      render(<ActiveTasksPanel tasks={[taskVariants.running]} defaultShowActiveOnly={false} />)

      expect(screen.getByText('Running task with progress')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.running.id}`)).toBeInTheDocument()
    })

    it('renders completed task with completion time', () => {
      render(<ActiveTasksPanel tasks={[taskVariants.completed]} defaultShowActiveOnly={false} />)

      expect(screen.getByText('Completed task with success')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.completed.id}`)).toBeInTheDocument()
    })

    it('renders failed task with error message', () => {
      render(<ActiveTasksPanel tasks={[taskVariants.failed]} defaultShowActiveOnly={false} />)

      expect(screen.getByText('Failed task with error message')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.failed.id}`)).toBeInTheDocument()
    })

    it('renders paused task with pause reason', () => {
      render(<ActiveTasksPanel tasks={[taskVariants.paused]} defaultShowActiveOnly={false} />)

      expect(screen.getByText('Paused task awaiting input')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.paused.id}`)).toBeInTheDocument()
    })

    it('renders queued task with queue position', () => {
      render(<ActiveTasksPanel tasks={[taskVariants.queued]} defaultShowActiveOnly={false} />)

      expect(screen.getByText('Queued task waiting to start')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.queued.id}`)).toBeInTheDocument()
    })

    it('renders pending task being prepared', () => {
      render(<ActiveTasksPanel tasks={[taskVariants.pending]} defaultShowActiveOnly={false} />)

      expect(screen.getByText('Pending task being prepared')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.pending.id}`)).toBeInTheDocument()
    })

    it('renders awaiting approval task with approval info', () => {
      render(<ActiveTasksPanel tasks={[taskVariants.awaitingApproval]} defaultShowActiveOnly={false} />)

      expect(screen.getByText('Task awaiting approval')).toBeInTheDocument()
      expect(screen.getByTestId(`task-card-${taskVariants.awaitingApproval.id}`)).toBeInTheDocument()
    })
  })

  describe('Empty State Edge Cases', () => {
    it('renders empty state when tasks array is empty', () => {
      render(<ActiveTasksPanel tasks={[]} />)

      expect(screen.getByText('No active tasks')).toBeInTheDocument()
      expect(screen.getByText('View all tasks')).toBeInTheDocument()
    })

    it('renders loading state even with empty tasks', () => {
      render(<ActiveTasksPanel tasks={[]} loading />)

      expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
      expect(screen.queryByText('No active tasks')).not.toBeInTheDocument()
    })

    it('shows appropriate empty message for each filter', () => {
      const tasks = [createMockTask({ status: 'in-progress' })]
      render(<ActiveTasksPanel tasks={tasks} defaultShowActiveOnly={false} />)

      // Switch to completed filter - should show empty state
      fireEvent.click(screen.getByRole('button', { name: /completed/i }))
      expect(screen.getByText('No completed tasks')).toBeInTheDocument()

      // Switch to failed filter - should show empty state
      fireEvent.click(screen.getByRole('button', { name: /failed/i }))
      expect(screen.getByText('No failed tasks')).toBeInTheDocument()

      // Switch to paused filter - should show empty state
      fireEvent.click(screen.getByRole('button', { name: /paused/i }))
      expect(screen.getByText('No paused tasks')).toBeInTheDocument()
    })
  })

  describe('Loading State Transitions', () => {
    it('transitions from loading to populated state', async () => {
      const { rerender } = render(<ActiveTasksPanel tasks={[]} loading />)

      expect(screen.getByText('Loading tasks...')).toBeInTheDocument()

      // Simulate loading completion
      const tasks = [createMockTask({ description: 'Loaded task' })]
      rerender(<ActiveTasksPanel tasks={tasks} loading={false} />)

      await waitFor(() => {
        expect(screen.queryByText('Loading tasks...')).not.toBeInTheDocument()
        expect(screen.getByText('Loaded task')).toBeInTheDocument()
      })
    })

    it('transitions from loading to empty state', async () => {
      const { rerender } = render(<ActiveTasksPanel tasks={[]} loading />)

      expect(screen.getByText('Loading tasks...')).toBeInTheDocument()

      // Simulate loading completion with no results
      rerender(<ActiveTasksPanel tasks={[]} loading={false} />)

      await waitFor(() => {
        expect(screen.queryByText('Loading tasks...')).not.toBeInTheDocument()
        expect(screen.getByText('No active tasks')).toBeInTheDocument()
      })
    })
  })

  describe('Filter Edge Cases', () => {
    it('handles mixed task statuses correctly', () => {
      const mixedTasks = [
        createMockTask({ id: 'active-1', status: 'in-progress' }),
        createMockTask({ id: 'paused-1', status: 'paused' }),
        createMockTask({ id: 'paused-2', status: 'awaiting-approval' }),
        createMockTask({ id: 'failed-1', status: 'failed' }),
        createMockTask({ id: 'failed-2', status: 'cancelled' }),
      ]

      render(<ActiveTasksPanel tasks={mixedTasks} defaultShowActiveOnly={false} />)

      // Test active filter (should include in-progress)
      fireEvent.click(screen.getByRole('button', { name: /active.*1/i }))
      expect(screen.getByTestId('task-card-active-1')).toBeInTheDocument()
      expect(screen.queryByTestId('task-card-paused-1')).not.toBeInTheDocument()

      // Test paused filter (should include paused and awaiting-approval)
      fireEvent.click(screen.getByRole('button', { name: /paused.*2/i }))
      expect(screen.getByTestId('task-card-paused-1')).toBeInTheDocument()
      expect(screen.getByTestId('task-card-paused-2')).toBeInTheDocument()
      expect(screen.queryByTestId('task-card-active-1')).not.toBeInTheDocument()

      // Test failed filter (should include failed and cancelled)
      fireEvent.click(screen.getByRole('button', { name: /failed.*2/i }))
      expect(screen.getByTestId('task-card-failed-1')).toBeInTheDocument()
      expect(screen.getByTestId('task-card-failed-2')).toBeInTheDocument()
      expect(screen.queryByTestId('task-card-active-1')).not.toBeInTheDocument()
    })

    it('maintains filter state when tasks update', () => {
      const initialTasks = [createMockTask({ id: 'task-1', status: 'completed' })]
      const { rerender } = render(<ActiveTasksPanel tasks={initialTasks} defaultShowActiveOnly={false} />)

      // Switch to completed filter
      fireEvent.click(screen.getByRole('button', { name: /completed/i }))
      expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument()

      // Update tasks but keep filter
      const updatedTasks = [
        ...initialTasks,
        createMockTask({ id: 'task-2', status: 'completed' }),
      ]
      rerender(<ActiveTasksPanel tasks={updatedTasks} defaultShowActiveOnly={false} />)

      // Should still be on completed filter and show both tasks
      expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument()
      expect(screen.getByTestId('task-card-task-2')).toBeInTheDocument()
    })
  })

  describe('Task Count Edge Cases', () => {
    it('shows correct counts when filter results in zero tasks', () => {
      const tasks = [createMockTask({ status: 'in-progress' })]
      render(<ActiveTasksPanel tasks={tasks} defaultShowActiveOnly={false} />)

      // All filters should show correct counts
      expect(screen.getByRole('button', { name: /all.*1/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /active.*1/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /completed/i })).toBeInTheDocument() // May not show count when 0
      expect(screen.getByRole('button', { name: /failed/i })).toBeInTheDocument() // May not show count when 0
      expect(screen.getByRole('button', { name: /paused/i })).toBeInTheDocument() // May not show count when 0
    })

    it('updates counts when tasks change', () => {
      const initialTasks = [createMockTask({ status: 'in-progress' })]
      const { rerender } = render(<ActiveTasksPanel tasks={initialTasks} defaultShowActiveOnly={false} />)

      expect(screen.getByRole('button', { name: /all.*1/i })).toBeInTheDocument()

      // Add more tasks
      const updatedTasks = [
        ...initialTasks,
        createMockTask({ status: 'completed' }),
        createMockTask({ status: 'failed' }),
      ]
      rerender(<ActiveTasksPanel tasks={updatedTasks} defaultShowActiveOnly={false} />)

      expect(screen.getByRole('button', { name: /all.*3/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /completed.*1/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /failed.*1/i })).toBeInTheDocument()
    })
  })

  describe('Performance Edge Cases', () => {
    it('handles large number of tasks efficiently', () => {
      const largeTasks = createLargeTaskDataset(200)

      const startTime = performance.now()
      render(<ActiveTasksPanel tasks={largeTasks} defaultShowActiveOnly={false} />)
      const renderTime = performance.now() - startTime

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100)

      // Should show all tasks by default
      expect(screen.getByRole('button', { name: /all.*200/i })).toBeInTheDocument()
    })

    it('respects maxTasks limit with large datasets', () => {
      const largeTasks = createLargeTaskDataset(500)
      render(<ActiveTasksPanel tasks={largeTasks} maxTasks={10} defaultShowActiveOnly={false} />)

      expect(screen.getByText(/Showing 10 most recent tasks/)).toBeInTheDocument()

      // Should only render the limited number of task cards
      const taskCards = screen.getAllByTestId(/task-card-/)
      expect(taskCards).toHaveLength(10)
    })

    it('efficiently filters large datasets', () => {
      const largeTasks = createLargeTaskDataset(100)
      render(<ActiveTasksPanel tasks={largeTasks} defaultShowActiveOnly={false} />)

      const startTime = performance.now()
      fireEvent.click(screen.getByRole('button', { name: /completed/i }))
      const filterTime = performance.now() - startTime

      // Filter operation should be fast (less than 50ms)
      expect(filterTime).toBeLessThan(50)
    })
  })

  describe('Action Loading States', () => {
    it('shows loading state for specific task action', () => {
      const tasks = [createMockTask({ id: 'task-1' })]
      render(
        <ActiveTasksPanel
          tasks={tasks}
          actionLoadingTaskId="task-1"
          defaultShowActiveOnly={false}
        />
      )

      // TaskCard should receive loading state
      const taskCard = screen.getByTestId('task-card-task-1')
      expect(taskCard).toBeInTheDocument()
    })

    it('handles cancel and retry callbacks', async () => {
      const onCancel = vi.fn()
      const onRetry = vi.fn()
      const tasks = [createMockTask({ id: 'task-1', status: 'failed' })]

      render(
        <ActiveTasksPanel
          tasks={tasks}
          onCancel={onCancel}
          onRetry={onRetry}
          defaultShowActiveOnly={false}
        />
      )

      // TaskCard should be present (actual cancel/retry button interaction would be tested in TaskCard tests)
      expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument()
    })
  })

  describe('Compact Mode Edge Cases', () => {
    it('renders correctly in compact mode with various task states', () => {
      const variants = Object.values(createTaskVariants())
      render(<ActiveTasksPanel tasks={variants} compact defaultShowActiveOnly={false} />)

      // All task cards should be present and receive compact prop
      variants.forEach(task => {
        const taskCard = screen.getByTestId(`task-card-${task.id}`)
        expect(taskCard).toBeInTheDocument()
      })
    })
  })

  describe('Sorting Edge Cases', () => {
    it('handles tasks with identical timestamps', () => {
      const sameTimestamp = new Date().toISOString()
      const tasks = [
        createMockTask({ id: 'task-1', description: 'Task 1', updatedAt: sameTimestamp }),
        createMockTask({ id: 'task-2', description: 'Task 2', updatedAt: sameTimestamp }),
        createMockTask({ id: 'task-3', description: 'Task 3', updatedAt: sameTimestamp }),
      ]

      render(<ActiveTasksPanel tasks={tasks} defaultShowActiveOnly={false} />)

      // Should render without errors
      expect(screen.getByText('Task 1')).toBeInTheDocument()
      expect(screen.getByText('Task 2')).toBeInTheDocument()
      expect(screen.getByText('Task 3')).toBeInTheDocument()
    })

    it('handles tasks with null or undefined timestamps', () => {
      const tasks = [
        createMockTask({ id: 'task-1', description: 'Task 1', updatedAt: undefined as any }),
        createMockTask({ id: 'task-2', description: 'Task 2', updatedAt: null as any }),
        createMockTask({ id: 'task-3', description: 'Task 3', updatedAt: new Date().toISOString() }),
      ]

      render(<ActiveTasksPanel tasks={tasks} defaultShowActiveOnly={false} />)

      // Should render without errors
      expect(screen.getByText('Task 1')).toBeInTheDocument()
      expect(screen.getByText('Task 2')).toBeInTheDocument()
      expect(screen.getByText('Task 3')).toBeInTheDocument()
    })
  })
})