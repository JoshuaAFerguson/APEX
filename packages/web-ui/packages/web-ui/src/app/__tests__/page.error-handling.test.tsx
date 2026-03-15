/**
 * Error Handling tests for Dashboard Page
 *
 * Tests comprehensive error handling scenarios in the dashboard context,
 * ensuring robust behavior when API calls fail, network issues occur,
 * and various error states are encountered.
 *
 * Covers:
 * - API error handling for dashboard data loading
 * - Network failure scenarios and recovery
 * - Error display and user feedback
 * - Retry functionality and error recovery
 * - Graceful degradation when services are unavailable
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

// Mock API client
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
      <p>{description}</p>
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
  CardContent: ({ children, className, ...props }: any) => (
    <div data-testid="card-content" className={className} {...props}>{children}</div>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, ...props }: any) => <div data-testid="spinner" data-size={size} {...props}>Loading...</div>,
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>{children}</button>
  ),
}))

// Mock ActiveTasksPanel for error scenarios
vi.mock('@/components/tasks/ActiveTasksPanel', () => ({
  ActiveTasksPanel: ({
    tasks,
    onViewDetails,
    onRefresh,
    loading,
    onCancel,
    onRetry,
    ...props
  }: any) => (
    <div data-testid="active-tasks-panel" data-loading={loading} {...props}>
      <div data-testid="panel-header">Active Tasks Panel</div>
      {loading ? (
        <div data-testid="panel-loading">Loading tasks...</div>
      ) : tasks?.length > 0 ? (
        <div data-testid="tasks-list">
          {tasks.map((task: any) => (
            <div key={task.id} data-testid={`task-${task.id}`}>
              <span onClick={() => onViewDetails?.(task.id)}>{task.description}</span>
              {onCancel && <button onClick={() => onCancel(task.id)} data-testid={`cancel-${task.id}`}>Cancel</button>}
              {onRetry && <button onClick={() => onRetry(task.id)} data-testid={`retry-${task.id}`}>Retry</button>}
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="no-tasks">No tasks available</div>
      )}
      {onRefresh && <button onClick={onRefresh} data-testid="refresh-tasks">Refresh</button>}
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

describe('Dashboard Page Error Handling', () => {
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

  const createTasksResponse = () => ({
    tasks: [
      createTask({ id: 'task-1', description: 'Task 1', status: 'pending' }),
      createTask({ id: 'task-2', description: 'Task 2', status: 'in-progress' }),
    ],
    total: 2,
    page: 1,
    limit: 20,
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup router mock
    ;(useRouter as any).mockReturnValue(mockRouter)

    // Setup default successful responses (will be overridden in individual tests)
    vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
    vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(createTasksResponse())
    vi.mocked(mockApiClient.apiClient.cancelTask).mockResolvedValue(createTask({ status: 'cancelled' }))
    vi.mocked(mockApiClient.apiClient.retryTask).mockResolvedValue(createTask({ status: 'pending' }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Dashboard Data Loading Errors', () => {
    it('displays error message when getTaskStats fails', async () => {
      const errorMessage = 'Failed to load task statistics'
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error(errorMessage))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
        expect(screen.getByText('Make sure the APEX API server is running:')).toBeInTheDocument()
        expect(screen.getByText('apex serve --port 3002')).toBeInTheDocument()
      })
    })

    it('displays error message when listTasks fails', async () => {
      const errorMessage = 'Failed to load tasks'
      vi.mocked(mockApiClient.apiClient.listTasks).mockRejectedValue(new Error(errorMessage))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('displays error when both API calls fail', async () => {
      const statsError = 'Stats service unavailable'
      const tasksError = 'Tasks service unavailable'

      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error(statsError))
      vi.mocked(mockApiClient.apiClient.listTasks).mockRejectedValue(new Error(tasksError))

      render(<DashboardPage />)

      await waitFor(() => {
        // Should show the first error that occurred
        expect(screen.getByText(statsError)).toBeInTheDocument()
      })
    })

    it('shows retry button in error state', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error('Network error'))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('allows retry after error', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createTaskStats())

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Retry')
      await act(async () => {
        await user.click(retryButton)
      })

      await waitFor(() => {
        expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
        expect(screen.queryByText('Network error')).not.toBeInTheDocument()
      })
    })
  })

  describe('Network and Connectivity Errors', () => {
    it('handles network timeout errors', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(timeoutError)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Request timeout')).toBeInTheDocument()
      })
    })

    it('handles connection refused errors', async () => {
      const connectionError = new Error('Connection refused')
      connectionError.name = 'NetworkError'
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(connectionError)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Connection refused')).toBeInTheDocument()
      })
    })

    it('handles DNS resolution errors', async () => {
      const dnsError = new Error('DNS resolution failed')
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(dnsError)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('DNS resolution failed')).toBeInTheDocument()
      })
    })

    it('provides helpful message for server unavailable', async () => {
      const serverError = new Error('ECONNREFUSED')
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(serverError)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('ECONNREFUSED')).toBeInTheDocument()
        expect(screen.getByText('Make sure the APEX API server is running:')).toBeInTheDocument()
        expect(screen.getByText('apex serve --port 3002')).toBeInTheDocument()
      })
    })
  })

  describe('Task Action Errors', () => {
    it('handles cancel task errors gracefully', async () => {
      const cancelError = 'Task cannot be cancelled in current state'
      vi.mocked(mockApiClient.apiClient.cancelTask).mockRejectedValue(new Error(cancelError))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-task-1')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        expect(screen.getByText(cancelError)).toBeInTheDocument()
      })

      // Dashboard should still be functional
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
    })

    it('handles retry task errors gracefully', async () => {
      const retryError = 'Task has exceeded maximum retry attempts'
      vi.mocked(mockApiClient.apiClient.retryTask).mockRejectedValue(new Error(retryError))

      // Setup a failed task for retry
      const tasksWithFailed = {
        tasks: [createTask({ id: 'failed-task', description: 'Failed task', status: 'failed' })],
        total: 1,
        page: 1,
        limit: 20,
      }
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasksWithFailed)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('retry-failed-task')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('retry-failed-task')
      await act(async () => {
        fireEvent.click(retryButton)
      })

      await waitFor(() => {
        expect(screen.getByText(retryError)).toBeInTheDocument()
      })
    })

    it('handles 403 authorization errors', async () => {
      const authError = new Error('Forbidden: Insufficient permissions')
      authError.name = 'ForbiddenError'
      vi.mocked(mockApiClient.apiClient.cancelTask).mockRejectedValue(authError)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-task-1')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Forbidden: Insufficient permissions')).toBeInTheDocument()
      })
    })

    it('handles 404 task not found errors', async () => {
      const notFoundError = new Error('Task not found')
      notFoundError.name = 'NotFoundError'
      vi.mocked(mockApiClient.apiClient.cancelTask).mockRejectedValue(notFoundError)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-task-1')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Task not found')).toBeInTheDocument()
      })
    })
  })

  describe('Partial Data Loading Scenarios', () => {
    it('shows statistics when stats load but tasks fail', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockRejectedValue(new Error('Tasks service down'))

      render(<DashboardPage />)

      await waitFor(() => {
        // Statistics should still be visible
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByText('Active')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()

        // Error message should be shown
        expect(screen.getByText('Tasks service down')).toBeInTheDocument()
      })
    })

    it('shows tasks panel when tasks load but stats fail', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error('Stats service down'))
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(createTasksResponse())

      render(<DashboardPage />)

      await waitFor(() => {
        // Error should be shown for failed stats
        expect(screen.getByText('Stats service down')).toBeInTheDocument()
      })
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('recovers gracefully after network restoration', async () => {
      // Start with network error
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error('Network unavailable'))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Network unavailable')).toBeInTheDocument()
      })

      // Simulate network recovery
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(createTasksResponse())

      const retryButton = screen.getByText('Retry')
      await act(async () => {
        await user.click(retryButton)
      })

      await waitFor(() => {
        expect(screen.queryByText('Network unavailable')).not.toBeInTheDocument()
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })
    })

    it('maintains user context across error recovery', async () => {
      // Start successfully
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Overview of your APEX project and recent activity')).toBeInTheDocument()
      })

      // Simulate refresh failure
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error('Refresh failed'))

      const headerRefreshButton = screen.getByText('Refresh')
      await act(async () => {
        await user.click(headerRefreshButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Refresh failed')).toBeInTheDocument()
      })

      // Context should be preserved
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Overview of your APEX project and recent activity')).toBeInTheDocument()
    })

    it('handles intermittent failures during refresh', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('refresh-tasks')).toBeInTheDocument()
      })

      // Make refresh fail intermittently
      vi.mocked(mockApiClient.apiClient.getTaskStats)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(createTaskStats())

      const refreshButton = screen.getByTestId('refresh-tasks')
      await act(async () => {
        fireEvent.click(refreshButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Temporary failure')).toBeInTheDocument()
      })

      // Retry should work
      const retryButton = screen.getByText('Retry')
      await act(async () => {
        await user.click(retryButton)
      })

      await waitFor(() => {
        expect(screen.queryByText('Temporary failure')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Message Display', () => {
    it('displays user-friendly error messages', async () => {
      const technicalError = new Error('ERR_CONNECTION_RESET')
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(technicalError)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('ERR_CONNECTION_RESET')).toBeInTheDocument()
        expect(screen.getByText('Make sure the APEX API server is running:')).toBeInTheDocument()
      })
    })

    it('shows appropriate error context and help', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error('Service unavailable'))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Service unavailable')).toBeInTheDocument()
        expect(screen.getByText('Make sure the APEX API server is running:')).toBeInTheDocument()
        expect(screen.getByText('apex serve --port 3002')).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('preserves header and layout during error states', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error('Error occurred'))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Error occurred')).toBeInTheDocument()
      })

      // Header should still be present
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Overview of your APEX project and recent activity')).toBeInTheDocument()
    })
  })

  describe('Error Logging and Monitoring', () => {
    it('does not expose sensitive error details', async () => {
      const sensitiveError = new Error('Database connection failed: password=secret123')
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(sensitiveError)

      render(<DashboardPage />)

      await waitFor(() => {
        // Should show the error message but not expose sensitive details
        expect(screen.getByText(/Database connection failed/)).toBeInTheDocument()
      })
    })

    it('handles malformed error objects gracefully', async () => {
      const malformedError = { message: undefined, stack: null } as any
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(malformedError)

      render(<DashboardPage />)

      await waitFor(() => {
        // Should show generic error message
        expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument()
      })
    })
  })
})