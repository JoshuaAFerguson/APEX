/**
 * Unit tests for Dashboard Page (/app/page.tsx)
 *
 * Tests the integration of ActiveTasksPanel into the dashboard page with proper layout,
 * data fetching, error handling, navigation, and action handlers.
 *
 * Covers:
 * - ActiveTasksPanel integration and positioning in dashboard grid
 * - View details navigation functionality
 * - Cancel/retry task action handlers integration
 * - API error handling in dashboard context
 * - Dashboard statistics and data flow
 * - Responsive layout behavior
 * - Real-time updates and refresh functionality
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

// Mock API client with all required methods
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTaskStats: vi.fn(),
    listTasks: vi.fn(),
    cancelTask: vi.fn(),
    retryTask: vi.fn(),
  },
}))

// Mock UI components to avoid dependency issues
vi.mock('@/components/layout', () => ({
  Header: ({ title, description, actions, ...props }: any) => (
    <div data-testid="header" {...props}>
      <h1 data-testid="header-title">{title}</h1>
      <p data-testid="header-description">{description}</p>
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}))

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="card" className={className} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div data-testid="card-content" className={className} {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span data-testid="badge" data-variant={variant} {...props}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, className, ...props }: any) => (
    <div data-testid="spinner" data-size={size} className={className} {...props}>
      Loading...
    </div>
  ),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}))

// Mock ActiveTasksPanel component
vi.mock('@/components/tasks/ActiveTasksPanel', () => ({
  ActiveTasksPanel: ({
    tasks,
    onViewDetails,
    onRefresh,
    loading,
    defaultShowActiveOnly,
    maxTasks,
    compact,
    onCancel,
    onRetry,
    actionLoadingTaskId,
    ...props
  }: any) => (
    <div
      data-testid="active-tasks-panel"
      data-tasks-count={tasks?.length || 0}
      data-loading={loading}
      data-default-show-active-only={defaultShowActiveOnly}
      data-max-tasks={maxTasks}
      data-compact={compact}
      data-action-loading-task-id={actionLoadingTaskId}
      {...props}
    >
      <div data-testid="active-tasks-panel-header">Active Tasks Panel</div>
      {tasks?.map((task: any) => (
        <div key={task.id} data-testid={`task-item-${task.id}`}>
          <span onClick={() => onViewDetails?.(task.id)} data-testid={`task-details-${task.id}`}>
            {task.description}
          </span>
          {onCancel && task.status !== 'completed' && (
            <button
              onClick={() => onCancel(task.id)}
              data-testid={`cancel-task-${task.id}`}
            >
              Cancel
            </button>
          )}
          {onRetry && task.status === 'failed' && (
            <button
              onClick={() => onRetry(task.id)}
              data-testid={`retry-task-${task.id}`}
            >
              Retry
            </button>
          )}
        </div>
      ))}
      {onRefresh && (
        <button onClick={onRefresh} data-testid="refresh-tasks">
          Refresh
        </button>
      )}
    </div>
  ),
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  getStatusVariant: vi.fn((status: string) => {
    const variants: Record<string, string> = {
      'pending': 'secondary',
      'in-progress': 'primary',
      'completed': 'success',
      'failed': 'danger',
      'cancelled': 'secondary',
    }
    return variants[status] || 'secondary'
  }),
  formatStatus: vi.fn((status: string) => status.replace('-', ' ')),
  getRelativeTime: vi.fn((date: string) => '2 hours ago'),
  truncateId: vi.fn((id: string, length: number = 8) =>
    id.length > length ? `${id.slice(0, length)}...` : id
  ),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')

describe('Dashboard Page', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }
  const user = userEvent.setup()

  // Test data factories
  const createTaskStats = (overrides = {}) => ({
    byStatus: {
      'pending': 2,
      'queued': 1,
      'planning': 1,
      'in-progress': 3,
      'waiting-approval': 1,
      'paused': 2,
      'completed': 15,
      'failed': 2,
      'cancelled': 1,
      ...overrides.byStatus
    },
    totalCost: 45.67,
    totalTokens: 125000,
    ...overrides
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

  const createTasksResponse = (count: number = 5) => ({
    tasks: Array.from({ length: count }, (_, i) =>
      createTask({
        id: `task-${i + 1}`,
        description: `Task ${i + 1} description`,
        status: ['pending', 'in-progress', 'completed', 'failed', 'paused'][i % 5] as any,
        updatedAt: new Date(`2024-01-01T${10 + i}:00:00Z`).toISOString(),
      })
    ),
    total: count,
    page: 1,
    limit: 20,
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(useRouter as any).mockReturnValue(mockRouter)

    // Default API responses
    vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
    vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(createTasksResponse())
    vi.mocked(mockApiClient.apiClient.cancelTask).mockResolvedValue(createTask({ status: 'cancelled' }))
    vi.mocked(mockApiClient.apiClient.retryTask).mockResolvedValue(createTask({ status: 'pending' }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Loading and Data Fetching', () => {
    it('shows loading spinner while fetching dashboard data', async () => {
      // Make API calls hang to test loading state
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )
      vi.mocked(mockApiClient.apiClient.listTasks).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<DashboardPage />)

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByTestId('spinner')).toHaveAttribute('data-size', 'lg')
    })

    it('loads dashboard statistics and tasks on mount', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      })

      expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledWith()
      expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledWith({ limit: 20 })
    })

    it('displays dashboard header with correct title and description', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('header-title')).toHaveTextContent('Dashboard')
        expect(screen.getByTestId('header-description')).toHaveTextContent(
          'Overview of your APEX project and recent activity'
        )
      })
    })

    it('displays refresh button in header after loading', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('header-actions')).toBeInTheDocument()
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })
    })
  })

  describe('Dashboard Statistics Grid', () => {
    it('renders all statistics cards with correct data', async () => {
      const stats = createTaskStats({
        byStatus: {
          'pending': 3,
          'queued': 2,
          'planning': 1,
          'in-progress': 4,
          'waiting-approval': 1,
          'paused': 2,
          'completed': 25,
          'failed': 3,
        },
        totalCost: 123.45,
      })

      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(stats)

      render(<DashboardPage />)

      await waitFor(() => {
        // Pending = pending + queued = 3 + 2 = 5
        expect(screen.getByText('5')).toBeInTheDocument()

        // Active = planning + in-progress + waiting-approval = 1 + 4 + 1 = 6
        expect(screen.getByText('6')).toBeInTheDocument()

        // Paused = 2
        expect(screen.getByText('2')).toBeInTheDocument()

        // Completed = 25
        expect(screen.getByText('25')).toBeInTheDocument()

        // Failed = 3
        expect(screen.getByText('3')).toBeInTheDocument()

        // Total Cost = $123.45
        expect(screen.getByText('$123.45')).toBeInTheDocument()
      })
    })

    it('renders statistics cards with responsive grid layout', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // Check for grid container with responsive classes
        const gridContainer = screen.getByText('Pending').closest('.grid')
        expect(gridContainer).toHaveClass('md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-6')
      })
    })

    it('displays correct labels and descriptions for each statistic', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByText('Waiting to start')).toBeInTheDocument()

        expect(screen.getByText('Active')).toBeInTheDocument()
        expect(screen.getByText('Currently running')).toBeInTheDocument()

        expect(screen.getByText('Paused')).toBeInTheDocument()
        expect(screen.getByText('Rate limited')).toBeInTheDocument()

        expect(screen.getByText('Completed')).toBeInTheDocument()
        expect(screen.getByText('Successfully finished')).toBeInTheDocument()

        expect(screen.getByText('Failed')).toBeInTheDocument()
        expect(screen.getByText('Need attention')).toBeInTheDocument()

        expect(screen.getByText('Total Cost')).toBeInTheDocument()
        expect(screen.getByText('Lifetime usage')).toBeInTheDocument()
      })
    })
  })

  describe('ActiveTasksPanel Integration', () => {
    it('renders ActiveTasksPanel with correct props after data loads', async () => {
      const tasks = createTasksResponse(8)
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toBeInTheDocument()
        expect(panel).toHaveAttribute('data-tasks-count', '8')
        expect(panel).toHaveAttribute('data-loading', 'false')
        expect(panel).toHaveAttribute('data-default-show-active-only', 'false')
        expect(panel).toHaveAttribute('data-max-tasks', '15')
        expect(panel).toHaveAttribute('data-compact', 'false')
      })
    })

    it('positions ActiveTasksPanel correctly in dashboard layout', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        const panelContainer = panel.closest('.mt-8')
        expect(panelContainer).toBeInTheDocument()

        // Should be positioned after the statistics grid
        const statsGrid = screen.getByText('Pending').closest('.grid')
        const statsContainer = statsGrid?.closest('div')
        expect(statsContainer?.nextElementSibling).toBe(panelContainer)
      })
    })

    it('passes tasks data correctly to ActiveTasksPanel', async () => {
      const tasks = createTasksResponse(3)
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        // Should show all 3 tasks
        expect(screen.getByTestId('task-item-task-1')).toBeInTheDocument()
        expect(screen.getByTestId('task-item-task-2')).toBeInTheDocument()
        expect(screen.getByTestId('task-item-task-3')).toBeInTheDocument()
      })
    })
  })

  describe('View Details Navigation', () => {
    it('navigates to task detail page when onViewDetails is called', async () => {
      const tasks = createTasksResponse(2)
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-details-task-1')).toBeInTheDocument()
      })

      const taskDetailsButton = screen.getByTestId('task-details-task-1')
      fireEvent.click(taskDetailsButton)

      expect(mockPush).toHaveBeenCalledWith('/tasks/task-1')
    })

    it('navigates to correct task detail page for different tasks', async () => {
      const tasks = createTasksResponse(3)
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-details-task-2')).toBeInTheDocument()
        expect(screen.getByTestId('task-details-task-3')).toBeInTheDocument()
      })

      // Test navigation to different tasks
      fireEvent.click(screen.getByTestId('task-details-task-2'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-2')

      fireEvent.click(screen.getByTestId('task-details-task-3'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-3')
    })
  })

  describe('Cancel/Retry Action Handlers', () => {
    it('handles cancel action correctly', async () => {
      const tasks = createTasksResponse(2)
      tasks.tasks[0].status = 'in-progress'
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-task-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-task-task-1')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      expect(mockApiClient.apiClient.cancelTask).toHaveBeenCalledWith('task-1')
    })

    it('handles retry action correctly', async () => {
      const tasks = createTasksResponse(2)
      tasks.tasks[0].status = 'failed'
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('retry-task-task-1')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('retry-task-task-1')
      await act(async () => {
        fireEvent.click(retryButton)
      })

      expect(mockApiClient.apiClient.retryTask).toHaveBeenCalledWith('task-1')
    })

    it('refreshes dashboard data after successful cancel action', async () => {
      const tasks = createTasksResponse(1)
      tasks.tasks[0].status = 'in-progress'
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-task-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-task-task-1')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      // Should refresh data after successful cancel
      await waitFor(() => {
        expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
        expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledTimes(2)
      })
    })

    it('refreshes dashboard data after successful retry action', async () => {
      const tasks = createTasksResponse(1)
      tasks.tasks[0].status = 'failed'
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('retry-task-task-1')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('retry-task-task-1')
      await act(async () => {
        fireEvent.click(retryButton)
      })

      // Should refresh data after successful retry
      await waitFor(() => {
        expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
        expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledTimes(2)
      })
    })

    it('shows loading state during action execution', async () => {
      const tasks = createTasksResponse(1)
      tasks.tasks[0].status = 'in-progress'
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)
      vi.mocked(mockApiClient.apiClient.cancelTask).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-task-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-task-task-1')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      // Should show action loading state
      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toHaveAttribute('data-action-loading-task-id', 'cancel-task-1')
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error message when dashboard data fetch fails', async () => {
      const errorMessage = 'Failed to load dashboard data'
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error(errorMessage))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
        expect(screen.getByText('Make sure the APEX API server is running:')).toBeInTheDocument()
        expect(screen.getByText('apex serve --port 3002')).toBeInTheDocument()
      })
    })

    it('shows retry button when error occurs', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error('Network error'))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('allows retry when dashboard fetch fails', async () => {
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

    it('displays error message when task action fails', async () => {
      const tasks = createTasksResponse(1)
      tasks.tasks[0].status = 'in-progress'
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)
      vi.mocked(mockApiClient.apiClient.cancelTask).mockRejectedValue(new Error('Failed to cancel task'))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-task-task-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-task-task-1')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Failed to cancel task')).toBeInTheDocument()
      })
    })
  })

  describe('Refresh Functionality', () => {
    it('refreshes dashboard data when header refresh button is clicked', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const headerRefreshButton = screen.getByText('Refresh')
      await act(async () => {
        await user.click(headerRefreshButton)
      })

      expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
      expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledTimes(2)
    })

    it('refreshes dashboard data when ActiveTasksPanel refresh is called', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('refresh-tasks')).toBeInTheDocument()
      })

      const panelRefreshButton = screen.getByTestId('refresh-tasks')
      await act(async () => {
        fireEvent.click(panelRefreshButton)
      })

      expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
      expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledTimes(2)
    })
  })

  describe('Loading States', () => {
    it('passes loading state to ActiveTasksPanel during data fetch', async () => {
      // Make listTasks hang to test loading state
      vi.mocked(mockApiClient.apiClient.listTasks).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.queryByTestId('active-tasks-panel')
        if (panel) {
          expect(panel).toHaveAttribute('data-loading', 'true')
        }
      })
    })

    it('shows main loading spinner when both APIs are loading', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )
      vi.mocked(mockApiClient.apiClient.listTasks).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<DashboardPage />)

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
    })
  })

  describe('Component Integration', () => {
    it('integrates all dashboard components correctly', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // Header should be present
        expect(screen.getByTestId('header')).toBeInTheDocument()

        // Statistics cards should be present
        expect(screen.getAllByTestId('card')).toHaveLength(7) // 6 stat cards + 1 ActiveTasksPanel

        // ActiveTasksPanel should be present
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })
    })

    it('passes all required props to ActiveTasksPanel', async () => {
      const tasks = createTasksResponse(5)
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasks)

      render(<DashboardPage />)

      await waitFor(() => {
        const panel = screen.getByTestId('active-tasks-panel')
        expect(panel).toHaveAttribute('data-tasks-count', '5')
        expect(panel).toHaveAttribute('data-loading', 'false')
        expect(panel).toHaveAttribute('data-default-show-active-only', 'false')
        expect(panel).toHaveAttribute('data-max-tasks', '15')
        expect(panel).toHaveAttribute('data-compact', 'false')
      })
    })
  })
})