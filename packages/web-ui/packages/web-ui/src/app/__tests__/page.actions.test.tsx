/**
 * Action Handler tests for Dashboard Page
 *
 * Tests the cancel/retry action handlers integration specifically, ensuring
 * that action buttons work correctly with proper error handling, loading states,
 * and data refresh as per acceptance criteria.
 *
 * Covers:
 * - Cancel task action integration
 * - Retry task action integration
 * - Action loading states and UI feedback
 * - Error handling for failed actions
 * - Data refresh after successful actions
 * - Action button availability based on task status
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'
import type { Task } from '@apexcli/core'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock API client with detailed action responses
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTaskStats: vi.fn(),
    listTasks: vi.fn(),
    cancelTask: vi.fn(),
    retryTask: vi.fn(),
  },
}))

// Mock layout and UI components
vi.mock('@/components/layout', () => ({
  Header: ({ title, description, actions, ...props }: any) => (
    <div data-testid="header" {...props}>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}))

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="card" className={className} {...props}>{children}</div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>{children}</div>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, ...props }: any) => <div data-testid="spinner" data-size={size} {...props}>Loading...</div>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid="button" {...props}>{children}</button>
  ),
}))

// Mock ActiveTasksPanel with detailed action handling
vi.mock('@/components/tasks/ActiveTasksPanel', () => ({
  ActiveTasksPanel: ({
    tasks,
    onViewDetails,
    onRefresh,
    loading,
    onCancel,
    onRetry,
    actionLoadingTaskId,
    ...props
  }: any) => (
    <div
      data-testid="active-tasks-panel"
      data-action-loading-task-id={actionLoadingTaskId || 'none'}
      data-loading={loading}
      {...props}
    >
      <div data-testid="panel-header">Active Tasks Panel</div>
      {loading ? (
        <div data-testid="panel-loading">Loading tasks...</div>
      ) : (
        <div data-testid="tasks-list">
          {tasks?.map((task: any) => (
            <div key={task.id} data-testid={`task-${task.id}`} className="task-item">
              <div
                data-testid={`task-details-${task.id}`}
                onClick={() => onViewDetails?.(task.id)}
                style={{ cursor: 'pointer', padding: '8px' }}
              >
                <h4>{task.description}</h4>
                <span data-testid={`task-status-${task.id}`}>Status: {task.status}</span>
              </div>

              <div data-testid={`task-actions-${task.id}`} className="task-actions">
                {/* Cancel button for cancellable tasks */}
                {onCancel && (task.status === 'pending' || task.status === 'queued' || task.status === 'in-progress' || task.status === 'planning') && (
                  <button
                    data-testid={`cancel-action-${task.id}`}
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        await onCancel(task.id)
                      } catch (error) {
                        console.error('Cancel action failed:', error)
                      }
                    }}
                    disabled={actionLoadingTaskId?.includes(`cancel-${task.id}`)}
                    style={{
                      opacity: actionLoadingTaskId?.includes(`cancel-${task.id}`) ? 0.5 : 1,
                      cursor: actionLoadingTaskId?.includes(`cancel-${task.id}`) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {actionLoadingTaskId?.includes(`cancel-${task.id}`) ? 'Cancelling...' : 'Cancel'}
                  </button>
                )}

                {/* Retry button for failed tasks */}
                {onRetry && (task.status === 'failed' || task.status === 'cancelled') && (
                  <button
                    data-testid={`retry-action-${task.id}`}
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        await onRetry(task.id)
                      } catch (error) {
                        console.error('Retry action failed:', error)
                      }
                    }}
                    disabled={actionLoadingTaskId?.includes(`retry-${task.id}`)}
                    style={{
                      opacity: actionLoadingTaskId?.includes(`retry-${task.id}`) ? 0.5 : 1,
                      cursor: actionLoadingTaskId?.includes(`retry-${task.id}`) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {actionLoadingTaskId?.includes(`retry-${task.id}`) ? 'Retrying...' : 'Retry'}
                  </button>
                )}
              </div>

              {/* Loading indicator for specific task actions */}
              {actionLoadingTaskId?.includes(task.id) && (
                <div data-testid={`action-loading-${task.id}`} className="action-loading">
                  Action in progress...
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  ),
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  getStatusVariant: vi.fn(() => 'primary'),
  formatStatus: vi.fn((status: string) => status),
  getRelativeTime: vi.fn(() => '2 hours ago'),
  truncateId: vi.fn((id: string) => id.slice(0, 8)),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')

describe('Dashboard Page Action Handlers', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }
  const user = userEvent.setup()

  // Test data factories
  const createTaskStats = () => ({
    byStatus: {
      'pending': 2,
      'in-progress': 3,
      'completed': 10,
      'failed': 2,
      'cancelled': 1,
    },
    totalCost: 45.67,
    totalTokens: 125000,
  })

  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-123',
    description: 'Test task description',
    status: 'pending',
    workflow: 'test-workflow',
    autonomy: 'medium',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/test/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    ...overrides,
  })

  const createActionableTasksResponse = () => ({
    tasks: [
      createTask({
        id: 'pending-task-1',
        description: 'Pending task for cancel test',
        status: 'pending',
      }),
      createTask({
        id: 'running-task-1',
        description: 'Running task for cancel test',
        status: 'in-progress',
      }),
      createTask({
        id: 'failed-task-1',
        description: 'Failed task for retry test',
        status: 'failed',
        error: 'Task execution failed',
      }),
      createTask({
        id: 'completed-task-1',
        description: 'Completed task (no actions)',
        status: 'completed',
      }),
    ],
    total: 4,
    page: 1,
    limit: 20,
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup router mock
    ;(useRouter as any).mockReturnValue(mockRouter)

    // Setup default API responses
    vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
    vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(createActionableTasksResponse())
    vi.mocked(mockApiClient.apiClient.cancelTask).mockResolvedValue(createTask({ status: 'cancelled' }))
    vi.mocked(mockApiClient.apiClient.retryTask).mockResolvedValue(createTask({ status: 'pending' }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Cancel Task Action', () => {
    it('successfully cancels a pending task', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      expect(mockApiClient.apiClient.cancelTask).toHaveBeenCalledWith('pending-task-1')
    })

    it('successfully cancels a running task', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-running-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-running-task-1')

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      expect(mockApiClient.apiClient.cancelTask).toHaveBeenCalledWith('running-task-1')
    })

    it('shows loading state during cancel operation', async () => {
      // Make cancel API hang to test loading state
      vi.mocked(mockApiClient.apiClient.cancelTask).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      // Button should show loading state
      expect(cancelButton).toHaveTextContent('Cancelling...')
      expect(cancelButton).toBeDisabled()

      // Panel should show loading task ID
      const panel = screen.getByTestId('active-tasks-panel')
      expect(panel).toHaveAttribute('data-action-loading-task-id', 'cancel-pending-task-1')

      // Loading indicator should be visible
      expect(screen.getByTestId('action-loading-pending-task-1')).toBeInTheDocument()
    })

    it('refreshes dashboard data after successful cancel', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        // Should refresh both stats and tasks after successful cancel
        expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
        expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledTimes(2)
      })
    })

    it('handles cancel action failure gracefully', async () => {
      const errorMessage = 'Failed to cancel task'
      vi.mocked(mockApiClient.apiClient.cancelTask).mockRejectedValue(new Error(errorMessage))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        // Error should be displayed
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })

      // Button should be re-enabled after error
      expect(cancelButton).toHaveTextContent('Cancel')
      expect(cancelButton).not.toBeDisabled()
    })

    it('does not show cancel button for completed tasks', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-completed-task-1')).toBeInTheDocument()
      })

      // Should not show cancel button for completed task
      expect(screen.queryByTestId('cancel-action-completed-task-1')).not.toBeInTheDocument()
    })

    it('prevents navigation when cancel button is clicked', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      // Should not trigger navigation
      expect(mockPush).not.toHaveBeenCalled()

      // Should call cancel API
      expect(mockApiClient.apiClient.cancelTask).toHaveBeenCalledWith('pending-task-1')
    })
  })

  describe('Retry Task Action', () => {
    it('successfully retries a failed task', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('retry-action-failed-task-1')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('retry-action-failed-task-1')

      await act(async () => {
        fireEvent.click(retryButton)
      })

      expect(mockApiClient.apiClient.retryTask).toHaveBeenCalledWith('failed-task-1')
    })

    it('shows loading state during retry operation', async () => {
      // Make retry API hang to test loading state
      vi.mocked(mockApiClient.apiClient.retryTask).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('retry-action-failed-task-1')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('retry-action-failed-task-1')

      await act(async () => {
        fireEvent.click(retryButton)
      })

      // Button should show loading state
      expect(retryButton).toHaveTextContent('Retrying...')
      expect(retryButton).toBeDisabled()

      // Panel should show loading task ID
      const panel = screen.getByTestId('active-tasks-panel')
      expect(panel).toHaveAttribute('data-action-loading-task-id', 'retry-failed-task-1')

      // Loading indicator should be visible
      expect(screen.getByTestId('action-loading-failed-task-1')).toBeInTheDocument()
    })

    it('refreshes dashboard data after successful retry', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('retry-action-failed-task-1')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('retry-action-failed-task-1')

      await act(async () => {
        fireEvent.click(retryButton)
      })

      await waitFor(() => {
        // Should refresh both stats and tasks after successful retry
        expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
        expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledTimes(2)
      })
    })

    it('handles retry action failure gracefully', async () => {
      const errorMessage = 'Failed to retry task'
      vi.mocked(mockApiClient.apiClient.retryTask).mockRejectedValue(new Error(errorMessage))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('retry-action-failed-task-1')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('retry-action-failed-task-1')

      await act(async () => {
        fireEvent.click(retryButton)
      })

      await waitFor(() => {
        // Error should be displayed
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })

      // Button should be re-enabled after error
      expect(retryButton).toHaveTextContent('Retry')
      expect(retryButton).not.toBeDisabled()
    })

    it('does not show retry button for non-failed tasks', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-pending-task-1')).toBeInTheDocument()
        expect(screen.getByTestId('task-running-task-1')).toBeInTheDocument()
        expect(screen.getByTestId('task-completed-task-1')).toBeInTheDocument()
      })

      // Should not show retry button for non-failed tasks
      expect(screen.queryByTestId('retry-action-pending-task-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('retry-action-running-task-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('retry-action-completed-task-1')).not.toBeInTheDocument()
    })

    it('prevents navigation when retry button is clicked', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('retry-action-failed-task-1')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('retry-action-failed-task-1')

      await act(async () => {
        fireEvent.click(retryButton)
      })

      // Should not trigger navigation
      expect(mockPush).not.toHaveBeenCalled()

      // Should call retry API
      expect(mockApiClient.apiClient.retryTask).toHaveBeenCalledWith('failed-task-1')
    })
  })

  describe('Action Button Availability', () => {
    it('shows correct action buttons based on task status', async () => {
      const mixedStatusTasks = {
        tasks: [
          createTask({ id: 'pending-1', status: 'pending' }),
          createTask({ id: 'queued-1', status: 'queued' }),
          createTask({ id: 'planning-1', status: 'planning' }),
          createTask({ id: 'in-progress-1', status: 'in-progress' }),
          createTask({ id: 'completed-1', status: 'completed' }),
          createTask({ id: 'failed-1', status: 'failed' }),
          createTask({ id: 'cancelled-1', status: 'cancelled' }),
          createTask({ id: 'paused-1', status: 'paused' }),
        ],
        total: 8,
        page: 1,
        limit: 20,
      }

      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(mixedStatusTasks)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-pending-1')).toBeInTheDocument()
      })

      // Cancel buttons should be available for cancellable statuses
      expect(screen.getByTestId('cancel-action-pending-1')).toBeInTheDocument()
      expect(screen.getByTestId('cancel-action-queued-1')).toBeInTheDocument()
      expect(screen.getByTestId('cancel-action-planning-1')).toBeInTheDocument()
      expect(screen.getByTestId('cancel-action-in-progress-1')).toBeInTheDocument()

      // Cancel buttons should NOT be available for non-cancellable statuses
      expect(screen.queryByTestId('cancel-action-completed-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('cancel-action-failed-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('cancel-action-cancelled-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('cancel-action-paused-1')).not.toBeInTheDocument()

      // Retry buttons should be available for retriable statuses
      expect(screen.getByTestId('retry-action-failed-1')).toBeInTheDocument()
      expect(screen.getByTestId('retry-action-cancelled-1')).toBeInTheDocument()

      // Retry buttons should NOT be available for non-retriable statuses
      expect(screen.queryByTestId('retry-action-pending-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('retry-action-in-progress-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('retry-action-completed-1')).not.toBeInTheDocument()
    })
  })

  describe('Multiple Action Handling', () => {
    it('prevents multiple actions on the same task simultaneously', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')

      // Start first action
      fireEvent.click(cancelButton)

      // Try to click again while first is in progress
      fireEvent.click(cancelButton)

      // Should only call API once
      expect(mockApiClient.apiClient.cancelTask).toHaveBeenCalledTimes(1)
    })

    it('allows actions on different tasks simultaneously', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
        expect(screen.getByTestId('retry-action-failed-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')
      const retryButton = screen.getByTestId('retry-action-failed-task-1')

      // Start actions on different tasks
      await act(async () => {
        fireEvent.click(cancelButton)
        fireEvent.click(retryButton)
      })

      // Should call both APIs
      expect(mockApiClient.apiClient.cancelTask).toHaveBeenCalledWith('pending-task-1')
      expect(mockApiClient.apiClient.retryTask).toHaveBeenCalledWith('failed-task-1')
    })
  })

  describe('Action Loading State Management', () => {
    it('tracks loading state for specific task actions', async () => {
      let cancelResolve: (value: any) => void
      const cancelPromise = new Promise(resolve => { cancelResolve = resolve })

      vi.mocked(mockApiClient.apiClient.cancelTask).mockReturnValue(cancelPromise)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      // Should show loading state for specific task
      const panel = screen.getByTestId('active-tasks-panel')
      expect(panel).toHaveAttribute('data-action-loading-task-id', 'cancel-pending-task-1')

      // Resolve the promise
      await act(async () => {
        cancelResolve!(createTask({ status: 'cancelled' }))
      })

      // Loading state should be cleared
      await waitFor(() => {
        expect(panel).toHaveAttribute('data-action-loading-task-id', 'none')
      })
    })

    it('clears loading state after action completion', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        // Loading state should be cleared after completion
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toHaveAttribute('data-action-loading-task-id', 'none')
      })
    })

    it('clears loading state after action failure', async () => {
      vi.mocked(mockApiClient.apiClient.cancelTask).mockRejectedValue(new Error('Cancel failed'))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-action-pending-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-action-pending-task-1')

      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        // Loading state should be cleared after failure
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toHaveAttribute('data-action-loading-task-id', 'none')
      })
    })
  })
})