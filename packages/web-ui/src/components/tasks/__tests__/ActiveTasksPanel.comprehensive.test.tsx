/**
 * Comprehensive tests for ActiveTasksPanel component
 * Covers all acceptance criteria scenarios including:
 * - Component rendering with various props combinations
 * - Task card variants display (all status types)
 * - Empty states for all filter types
 * - Edge cases and error handling
 * - Accessibility compliance
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ActiveTasksPanel } from '../ActiveTasksPanel'
import type { Task } from '@apexcli/core'

// Mock TaskCard component with more detailed props capture
vi.mock('../TaskCard', () => ({
  TaskCard: ({
    task,
    onViewDetails,
    compact,
    showProgress,
    onCancel,
    onRetry,
    isActionLoading
  }: any) => (
    <div
      data-testid={`task-card-${task.id}`}
      data-status={task.status}
      data-compact={compact}
      data-show-progress={showProgress}
      data-action-loading={isActionLoading}
      onClick={() => onViewDetails?.(task.id)}
      role="button"
      tabIndex={0}
      aria-label={`Task ${task.description} - ${task.status}`}
    >
      <div data-testid="task-description">{task.description}</div>
      <div data-testid="task-status">{task.status}</div>
      <div data-testid="task-workflow">{task.workflow}</div>
      {task.currentStage && <div data-testid="task-stage">{task.currentStage}</div>}
      {task.error && <div data-testid="task-error">{task.error}</div>}
      {onCancel && (
        <button
          data-testid={`cancel-${task.id}`}
          onClick={(e) => {
            e.stopPropagation()
            onCancel(task.id)
          }}
        >
          Cancel
        </button>
      )}
      {onRetry && (
        <button
          data-testid={`retry-${task.id}`}
          onClick={(e) => {
            e.stopPropagation()
            onRetry(task.id)
          }}
        >
          Retry
        </button>
      )}
    </div>
  ),
}))

// Comprehensive mock task factory
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task-1',
  description: 'Test task',
  workflow: 'development',
  autonomy: 'medium',
  status: 'pending',
  priority: 'medium',
  effort: 'medium',
  currentStage: 'planning',
  projectPath: '/test/project',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-01T10:30:00Z').toISOString(),
  ...overrides,
})

// Test data sets for various scenarios
const taskVariants: Array<{ name: string; tasks: Task[] }> = [
  {
    name: 'all status types',
    tasks: [
      createMockTask({ id: 'pending', status: 'pending', description: 'Pending task' }),
      createMockTask({ id: 'queued', status: 'queued', description: 'Queued task' }),
      createMockTask({ id: 'in-progress', status: 'in-progress', description: 'Running task' }),
      createMockTask({ id: 'completed', status: 'completed', description: 'Completed task' }),
      createMockTask({ id: 'failed', status: 'failed', description: 'Failed task', error: 'Test error' }),
      createMockTask({ id: 'cancelled', status: 'cancelled', description: 'Cancelled task' }),
      createMockTask({ id: 'paused', status: 'paused', description: 'Paused task' }),
      createMockTask({ id: 'awaiting-approval', status: 'awaiting-approval', description: 'Awaiting approval' }),
      createMockTask({ id: 'waiting-approval', status: 'waiting-approval', description: 'Waiting approval' }),
    ]
  },
  {
    name: 'priority variations',
    tasks: [
      createMockTask({ id: 'high-priority', priority: 'high', description: 'High priority task' }),
      createMockTask({ id: 'medium-priority', priority: 'medium', description: 'Medium priority task' }),
      createMockTask({ id: 'low-priority', priority: 'low', description: 'Low priority task' }),
    ]
  },
  {
    name: 'effort variations',
    tasks: [
      createMockTask({ id: 'small-effort', effort: 'small', description: 'Small effort task' }),
      createMockTask({ id: 'medium-effort', effort: 'medium', description: 'Medium effort task' }),
      createMockTask({ id: 'large-effort', effort: 'large', description: 'Large effort task' }),
    ]
  },
  {
    name: 'workflow variations',
    tasks: [
      createMockTask({ id: 'dev', workflow: 'development', description: 'Development workflow' }),
      createMockTask({ id: 'test', workflow: 'testing', description: 'Testing workflow' }),
      createMockTask({ id: 'deploy', workflow: 'deployment', description: 'Deployment workflow' }),
      createMockTask({ id: 'review', workflow: 'code-review', description: 'Code review workflow' }),
    ]
  },
]

describe('ActiveTasksPanel - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering Variations', () => {
    it('renders with all props combinations', () => {
      const mockCallbacks = {
        onViewDetails: vi.fn(),
        onRefresh: vi.fn(),
        onCancel: vi.fn(),
        onRetry: vi.fn(),
      }

      render(
        <ActiveTasksPanel
          tasks={[createMockTask()]}
          onViewDetails={mockCallbacks.onViewDetails}
          onRefresh={mockCallbacks.onRefresh}
          onCancel={mockCallbacks.onCancel}
          onRetry={mockCallbacks.onRetry}
          loading={false}
          defaultShowActiveOnly={true}
          maxTasks={20}
          compact={true}
          actionLoadingTaskId={null}
        />
      )

      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()

      const taskCard = screen.getByTestId('task-card-test-task-1')
      expect(taskCard).toHaveAttribute('data-compact', 'true')
      expect(taskCard).toHaveAttribute('data-show-progress', 'true')
    })

    it('renders without optional props', () => {
      render(<ActiveTasksPanel tasks={[]} />)

      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
      expect(screen.getByText('No active tasks')).toBeInTheDocument()
    })

    it('renders in compact mode correctly', () => {
      render(
        <ActiveTasksPanel
          tasks={[createMockTask()]}
          compact={true}
        />
      )

      const taskCard = screen.getByTestId('task-card-test-task-1')
      expect(taskCard).toHaveAttribute('data-compact', 'true')
    })
  })

  describe('Task Card Variants Display', () => {
    taskVariants.forEach(({ name, tasks }) => {
      it(`displays all ${name} correctly`, () => {
        render(
          <ActiveTasksPanel
            tasks={tasks}
            defaultShowActiveOnly={false}
            maxTasks={20}
          />
        )

        tasks.forEach(task => {
          const taskCard = screen.getByTestId(`task-card-${task.id}`)
          expect(taskCard).toBeInTheDocument()
          expect(taskCard).toHaveAttribute('data-status', task.status)
          expect(screen.getByText(task.description)).toBeInTheDocument()
        })
      })
    })

    it('displays task cards with proper props based on status', () => {
      const tasks = [
        createMockTask({ id: 'running', status: 'in-progress' }),
        createMockTask({ id: 'failed', status: 'failed', error: 'Failed' }),
      ]

      render(
        <ActiveTasksPanel
          tasks={tasks}
          defaultShowActiveOnly={false}
          onCancel={vi.fn()}
          onRetry={vi.fn()}
        />
      )

      tasks.forEach(task => {
        const taskCard = screen.getByTestId(`task-card-${task.id}`)
        expect(taskCard).toHaveAttribute('data-show-progress', 'true')
      })
    })
  })

  describe('Empty States for All Filter Types', () => {
    const emptyStateTests = [
      { filter: 'active', expectedText: 'No active tasks', tasks: [] },
      { filter: 'completed', expectedText: 'No completed tasks', tasks: [createMockTask({ status: 'pending' })] },
      { filter: 'failed', expectedText: 'No failed tasks', tasks: [createMockTask({ status: 'completed' })] },
      { filter: 'paused', expectedText: 'No paused tasks', tasks: [createMockTask({ status: 'in-progress' })] },
      { filter: 'all', expectedText: 'No tasks found', tasks: [] },
    ]

    emptyStateTests.forEach(({ filter, expectedText, tasks }) => {
      it(`shows correct empty state for ${filter} filter`, () => {
        render(
          <ActiveTasksPanel
            tasks={tasks}
            defaultShowActiveOnly={filter === 'active'}
          />
        )

        if (filter !== 'active') {
          fireEvent.click(screen.getByRole('button', { name: new RegExp(filter, 'i') }))
        }

        expect(screen.getByText(expectedText)).toBeInTheDocument()

        if (filter !== 'all') {
          expect(screen.getByText('View all tasks')).toBeInTheDocument()
        }
      })
    })

    it('allows switching from empty filter to "all" filter', () => {
      render(
        <ActiveTasksPanel
          tasks={[]}
          defaultShowActiveOnly={true}
        />
      )

      expect(screen.getByText('No active tasks')).toBeInTheDocument()

      fireEvent.click(screen.getByText('View all tasks'))

      expect(screen.getByText('No tasks found')).toBeInTheDocument()
      expect(screen.queryByText('View all tasks')).not.toBeInTheDocument()
    })
  })

  describe('Task Filtering and Statistics', () => {
    it('correctly calculates and displays task counts for each filter', () => {
      const tasks = [
        createMockTask({ id: '1', status: 'in-progress' }),
        createMockTask({ id: '2', status: 'queued' }),
        createMockTask({ id: '3', status: 'pending' }),
        createMockTask({ id: '4', status: 'completed' }),
        createMockTask({ id: '5', status: 'completed' }),
        createMockTask({ id: '6', status: 'failed' }),
        createMockTask({ id: '7', status: 'cancelled' }),
        createMockTask({ id: '8', status: 'paused' }),
        createMockTask({ id: '9', status: 'awaiting-approval' }),
      ]

      render(
        <ActiveTasksPanel
          tasks={tasks}
          defaultShowActiveOnly={false}
        />
      )

      // Check filter button counts
      expect(screen.getByRole('button', { name: /all.*9/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /active.*3/i })).toBeInTheDocument() // in-progress, queued, pending
      expect(screen.getByRole('button', { name: /completed.*2/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /failed.*2/i })).toBeInTheDocument() // failed, cancelled
      expect(screen.getByRole('button', { name: /paused.*2/i })).toBeInTheDocument() // paused, awaiting-approval
    })

    it('filters tasks correctly when switching between filters', () => {
      const tasks = [
        createMockTask({ id: 'active', status: 'in-progress', description: 'Active task' }),
        createMockTask({ id: 'completed', status: 'completed', description: 'Done task' }),
        createMockTask({ id: 'failed', status: 'failed', description: 'Failed task' }),
      ]

      render(
        <ActiveTasksPanel
          tasks={tasks}
          defaultShowActiveOnly={false}
        />
      )

      // Initially showing all
      expect(screen.getByText('Active task')).toBeInTheDocument()
      expect(screen.getByText('Done task')).toBeInTheDocument()
      expect(screen.getByText('Failed task')).toBeInTheDocument()

      // Switch to active filter
      fireEvent.click(screen.getByRole('button', { name: /active/i }))
      expect(screen.getByText('Active task')).toBeInTheDocument()
      expect(screen.queryByText('Done task')).not.toBeInTheDocument()
      expect(screen.queryByText('Failed task')).not.toBeInTheDocument()

      // Switch to completed filter
      fireEvent.click(screen.getByRole('button', { name: /completed/i }))
      expect(screen.queryByText('Active task')).not.toBeInTheDocument()
      expect(screen.getByText('Done task')).toBeInTheDocument()
      expect(screen.queryByText('Failed task')).not.toBeInTheDocument()
    })
  })

  describe('Task Sorting and Limiting', () => {
    it('sorts tasks by most recently updated', () => {
      const tasks = [
        createMockTask({
          id: 'old',
          description: 'Old task',
          updatedAt: new Date('2024-01-01T08:00:00Z').toISOString()
        }),
        createMockTask({
          id: 'recent',
          description: 'Recent task',
          updatedAt: new Date('2024-01-01T12:00:00Z').toISOString()
        }),
        createMockTask({
          id: 'newest',
          description: 'Newest task',
          updatedAt: new Date('2024-01-01T14:00:00Z').toISOString()
        }),
      ]

      render(
        <ActiveTasksPanel
          tasks={tasks}
          defaultShowActiveOnly={false}
        />
      )

      const taskCards = screen.getAllByText(/task$/)
      expect(taskCards[0]).toHaveTextContent('Newest task')
      expect(taskCards[1]).toHaveTextContent('Recent task')
      expect(taskCards[2]).toHaveTextContent('Old task')
    })

    it('respects maxTasks limit and shows appropriate message', () => {
      const tasks = Array.from({ length: 8 }, (_, i) =>
        createMockTask({
          id: `task-${i}`,
          description: `Task ${i}`,
          updatedAt: new Date(`2024-01-01T${10 + i}:00:00Z`).toISOString()
        })
      )

      render(
        <ActiveTasksPanel
          tasks={tasks}
          maxTasks={3}
          defaultShowActiveOnly={false}
        />
      )

      // Should only show 3 task cards
      const displayedTasks = screen.getAllByTestId(/task-card-/)
      expect(displayedTasks).toHaveLength(3)

      // Should show "showing X most recent tasks" message
      expect(screen.getByText('Showing 3 most recent tasks')).toBeInTheDocument()
    })

    it('shows filter-specific limit message', () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createMockTask({
          id: `task-${i}`,
          status: 'completed',
          description: `Completed Task ${i}`,
        })
      )

      render(
        <ActiveTasksPanel
          tasks={tasks}
          maxTasks={5}
          defaultShowActiveOnly={false}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /completed/i }))

      expect(screen.getByText('Showing 5 most recent tasks (completed)')).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('handles view details callback correctly', () => {
      const onViewDetails = vi.fn()
      const task = createMockTask({ id: 'interactive-task' })

      render(
        <ActiveTasksPanel
          tasks={[task]}
          onViewDetails={onViewDetails}
          defaultShowActiveOnly={false}
        />
      )

      fireEvent.click(screen.getByTestId('task-card-interactive-task'))
      expect(onViewDetails).toHaveBeenCalledWith('interactive-task')
    })

    it('handles refresh callback correctly', () => {
      const onRefresh = vi.fn()

      render(
        <ActiveTasksPanel
          tasks={[]}
          onRefresh={onRefresh}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
      expect(onRefresh).toHaveBeenCalled()
    })

    it('handles task actions (cancel/retry) correctly', async () => {
      const onCancel = vi.fn().mockResolvedValue(undefined)
      const onRetry = vi.fn().mockResolvedValue(undefined)
      const tasks = [
        createMockTask({ id: 'cancelable', status: 'in-progress' }),
        createMockTask({ id: 'retryable', status: 'failed' }),
      ]

      render(
        <ActiveTasksPanel
          tasks={tasks}
          onCancel={onCancel}
          onRetry={onRetry}
          defaultShowActiveOnly={false}
        />
      )

      fireEvent.click(screen.getByTestId('cancel-cancelable'))
      fireEvent.click(screen.getByTestId('retry-retryable'))

      await waitFor(() => {
        expect(onCancel).toHaveBeenCalledWith('cancelable')
        expect(onRetry).toHaveBeenCalledWith('retryable')
      })
    })

    it('shows loading state for action loading task', () => {
      const task = createMockTask({ id: 'loading-task' })

      render(
        <ActiveTasksPanel
          tasks={[task]}
          actionLoadingTaskId="loading-task"
          defaultShowActiveOnly={false}
        />
      )

      const taskCard = screen.getByTestId('task-card-loading-task')
      expect(taskCard).toHaveAttribute('data-action-loading', 'true')
    })
  })

  describe('Loading States', () => {
    it('displays loading spinner when loading prop is true', () => {
      render(
        <ActiveTasksPanel
          tasks={[]}
          loading={true}
        />
      )

      expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
    })

    it('disables refresh button when loading', () => {
      render(
        <ActiveTasksPanel
          tasks={[]}
          loading={true}
          onRefresh={vi.fn()}
        />
      )

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      expect(refreshButton).toBeDisabled()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('handles tasks with missing optional properties', () => {
      const task = createMockTask({
        currentStage: undefined,
        error: undefined,
        updatedAt: undefined,
      })

      expect(() => {
        render(
          <ActiveTasksPanel
            tasks={[task]}
            defaultShowActiveOnly={false}
          />
        )
      }).not.toThrow()

      expect(screen.getByTestId(`task-card-${task.id}`)).toBeInTheDocument()
    })

    it('handles empty task arrays gracefully', () => {
      render(<ActiveTasksPanel tasks={[]} />)
      expect(screen.getByText('No active tasks')).toBeInTheDocument()
    })

    it('handles very long task descriptions', () => {
      const task = createMockTask({
        description: 'A'.repeat(500), // Very long description
      })

      render(
        <ActiveTasksPanel
          tasks={[task]}
          defaultShowActiveOnly={false}
        />
      )

      expect(screen.getByText('A'.repeat(500))).toBeInTheDocument()
    })

    it('handles special characters in task properties', () => {
      const task = createMockTask({
        description: 'Task with special chars: <>{}[]()&$#@!',
        error: 'Error with <script>alert("xss")</script>',
      })

      render(
        <ActiveTasksPanel
          tasks={[task]}
          defaultShowActiveOnly={false}
        />
      )

      expect(screen.getByText('Task with special chars: <>{}[]()&$#@!')).toBeInTheDocument()
      expect(screen.getByText('Error with <script>alert("xss")</script>')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA labels and roles', () => {
      const task = createMockTask()

      render(
        <ActiveTasksPanel
          tasks={[task]}
          defaultShowActiveOnly={false}
        />
      )

      const taskCard = screen.getByRole('button')
      expect(taskCard).toHaveAttribute('aria-label')
      expect(taskCard).toHaveAttribute('tabIndex', '0')
    })

    it('maintains proper focus management', () => {
      const task = createMockTask()

      render(
        <ActiveTasksPanel
          tasks={[task]}
          defaultShowActiveOnly={false}
        />
      )

      const taskCard = screen.getByRole('button')
      taskCard.focus()
      expect(document.activeElement).toBe(taskCard)
    })

    it('supports keyboard navigation for filter buttons', () => {
      render(
        <ActiveTasksPanel
          tasks={[createMockTask()]}
          defaultShowActiveOnly={false}
        />
      )

      const filterButtons = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.match(/(All|Active|Completed|Failed|Paused)/)
      )

      filterButtons.forEach(button => {
        expect(button).toHaveAttribute('tabIndex', '0')
      })
    })
  })

  describe('Performance Considerations', () => {
    it('handles large numbers of tasks efficiently', () => {
      const start = performance.now()

      const largeTasks = Array.from({ length: 1000 }, (_, i) =>
        createMockTask({
          id: `perf-task-${i}`,
          description: `Performance Task ${i}`
        })
      )

      render(
        <ActiveTasksPanel
          tasks={largeTasks}
          maxTasks={10}
          defaultShowActiveOnly={false}
        />
      )

      const renderTime = performance.now() - start
      expect(renderTime).toBeLessThan(1000) // Should render in under 1 second

      // Should only render limited tasks
      const displayedTasks = screen.getAllByTestId(/task-card-/)
      expect(displayedTasks).toHaveLength(10)
    })
  })
})