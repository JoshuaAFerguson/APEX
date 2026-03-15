/**
 * Navigation tests for Dashboard Page
 *
 * Tests the view details navigation functionality specifically, ensuring
 * that clicking on tasks in the ActiveTasksPanel correctly navigates to
 * the task detail page as per acceptance criteria.
 *
 * Covers:
 * - View details navigation from ActiveTasksPanel
 * - Navigation with different task types and statuses
 * - Navigation error handling and edge cases
 * - Router integration and URL generation
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'
import type { Task } from '@apexcli/core'

// Mock Next.js router with detailed mock implementation
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockBack = vi.fn()
const mockForward = vi.fn()
const mockRefresh = vi.fn()
const mockPrefetch = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    forward: mockForward,
    refresh: mockRefresh,
    prefetch: mockPrefetch,
  })),
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

// Mock layout components
vi.mock('@/components/layout', () => ({
  Header: ({ title, description, actions, ...props }: any) => (
    <div data-testid="header" {...props}>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}))

// Mock UI components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="card" className={className} {...props}>
      {children}
    </div>
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

// Mock ActiveTasksPanel with detailed navigation simulation
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
    <div data-testid="active-tasks-panel" {...props}>
      <div data-testid="active-tasks-header">Active Tasks Panel</div>
      {loading ? (
        <div data-testid="panel-loading">Loading tasks...</div>
      ) : (
        <div data-testid="tasks-list">
          {tasks?.map((task: any) => (
            <div key={task.id} data-testid={`task-item-${task.id}`}>
              {/* Primary click area for view details */}
              <div
                data-testid={`task-view-details-${task.id}`}
                onClick={() => onViewDetails?.(task.id)}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer', padding: '8px', border: '1px solid #ccc', marginBottom: '4px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onViewDetails?.(task.id)
                  }
                }}
              >
                <h4 data-testid={`task-title-${task.id}`}>{task.description}</h4>
                <span data-testid={`task-status-${task.id}`}>Status: {task.status}</span>
                <span data-testid={`task-id-${task.id}`}>ID: {task.id}</span>
              </div>

              {/* Action buttons */}
              <div data-testid={`task-actions-${task.id}`}>
                {onCancel && task.status !== 'completed' && task.status !== 'failed' && (
                  <button
                    data-testid={`cancel-btn-${task.id}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onCancel(task.id)
                    }}
                  >
                    Cancel
                  </button>
                )}
                {onRetry && task.status === 'failed' && (
                  <button
                    data-testid={`retry-btn-${task.id}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRetry(task.id)
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {onRefresh && (
        <button data-testid="panel-refresh" onClick={onRefresh}>
          Refresh Panel
        </button>
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

describe('Dashboard Page Navigation', () => {
  const user = userEvent.setup()

  // Test data factories
  const createTaskStats = () => ({
    byStatus: {
      'pending': 2,
      'in-progress': 3,
      'completed': 15,
      'failed': 2,
      'paused': 1,
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

  const createTasksWithDifferentStatuses = () => {
    const statuses = ['pending', 'in-progress', 'completed', 'failed', 'paused']
    return {
      tasks: statuses.map((status, i) =>
        createTask({
          id: `task-${status}-${i + 1}`,
          description: `Task with ${status} status`,
          status: status as any,
        })
      ),
      total: 5,
      page: 1,
      limit: 20,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset router mocks
    mockPush.mockClear()
    mockReplace.mockClear()
    mockBack.mockClear()
    mockForward.mockClear()
    mockRefresh.mockClear()
    mockPrefetch.mockClear()

    // Setup default API responses
    vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
    vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(createTasksWithDifferentStatuses())
    vi.mocked(mockApiClient.apiClient.cancelTask).mockResolvedValue(createTask({ status: 'cancelled' }))
    vi.mocked(mockApiClient.apiClient.retryTask).mockResolvedValue(createTask({ status: 'pending' }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Navigation Functionality', () => {
    it('navigates to task detail page when task is clicked', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-pending-1')).toBeInTheDocument()
      })

      const taskItem = screen.getByTestId('task-view-details-task-pending-1')
      fireEvent.click(taskItem)

      expect(mockPush).toHaveBeenCalledWith('/tasks/task-pending-1')
      expect(mockPush).toHaveBeenCalledTimes(1)
    })

    it('navigates to correct task detail page for each task', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-pending-1')).toBeInTheDocument()
        expect(screen.getByTestId('task-view-details-task-in-progress-2')).toBeInTheDocument()
        expect(screen.getByTestId('task-view-details-task-completed-3')).toBeInTheDocument()
      })

      // Test navigation to different tasks
      fireEvent.click(screen.getByTestId('task-view-details-task-pending-1'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-pending-1')

      fireEvent.click(screen.getByTestId('task-view-details-task-in-progress-2'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-in-progress-2')

      fireEvent.click(screen.getByTestId('task-view-details-task-completed-3'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-completed-3')

      expect(mockPush).toHaveBeenCalledTimes(3)
    })

    it('supports keyboard navigation for accessibility', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-pending-1')).toBeInTheDocument()
      })

      const taskItem = screen.getByTestId('task-view-details-task-pending-1')

      // Test Enter key
      taskItem.focus()
      fireEvent.keyDown(taskItem, { key: 'Enter' })
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-pending-1')

      // Test Space key
      fireEvent.keyDown(taskItem, { key: ' ' })
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-pending-1')

      expect(mockPush).toHaveBeenCalledTimes(2)
    })

    it('properly handles task IDs with special characters', async () => {
      const specialTasks = {
        tasks: [
          createTask({
            id: 'task-with-dash_and_underscore.123',
            description: 'Task with special ID',
            status: 'pending',
          }),
          createTask({
            id: 'TASK-UPPERCASE-456',
            description: 'Uppercase task ID',
            status: 'in-progress',
          }),
        ],
        total: 2,
        page: 1,
        limit: 20,
      }

      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(specialTasks)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-with-dash_and_underscore.123')).toBeInTheDocument()
        expect(screen.getByTestId('task-view-details-TASK-UPPERCASE-456')).toBeInTheDocument()
      })

      // Test navigation with special characters
      fireEvent.click(screen.getByTestId('task-view-details-task-with-dash_and_underscore.123'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-with-dash_and_underscore.123')

      fireEvent.click(screen.getByTestId('task-view-details-TASK-UPPERCASE-456'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/TASK-UPPERCASE-456')
    })
  })

  describe('Navigation with Different Task Statuses', () => {
    it('navigates correctly for pending tasks', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-pending-1')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('task-view-details-task-pending-1'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-pending-1')
    })

    it('navigates correctly for in-progress tasks', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-in-progress-2')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('task-view-details-task-in-progress-2'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-in-progress-2')
    })

    it('navigates correctly for completed tasks', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-completed-3')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('task-view-details-task-completed-3'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-completed-3')
    })

    it('navigates correctly for failed tasks', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-failed-4')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('task-view-details-task-failed-4'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-failed-4')
    })

    it('navigates correctly for paused tasks', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-paused-5')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('task-view-details-task-paused-5'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-paused-5')
    })
  })

  describe('Navigation vs Action Button Interaction', () => {
    it('does not trigger navigation when cancel button is clicked', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('cancel-btn-task-pending-1')).toBeInTheDocument()
      })

      const cancelButton = screen.getByTestId('cancel-btn-task-pending-1')
      fireEvent.click(cancelButton)

      // Should call cancel API but not navigate
      expect(mockApiClient.apiClient.cancelTask).toHaveBeenCalledWith('task-pending-1')
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('does not trigger navigation when retry button is clicked', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('retry-btn-task-failed-4')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('retry-btn-task-failed-4')
      fireEvent.click(retryButton)

      // Should call retry API but not navigate
      expect(mockApiClient.apiClient.retryTask).toHaveBeenCalledWith('task-failed-4')
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('navigation works correctly when clicking outside action buttons', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-title-task-pending-1')).toBeInTheDocument()
      })

      // Click on task title (not action button)
      const taskTitle = screen.getByTestId('task-title-task-pending-1')
      fireEvent.click(taskTitle)

      expect(mockPush).toHaveBeenCalledWith('/tasks/task-pending-1')
    })
  })

  describe('Navigation Error Scenarios', () => {
    it('handles navigation when router.push fails', async () => {
      // Mock router.push to throw an error
      mockPush.mockImplementationOnce(() => {
        throw new Error('Navigation failed')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-pending-1')).toBeInTheDocument()
      })

      // This should not crash the app
      expect(() => {
        fireEvent.click(screen.getByTestId('task-view-details-task-pending-1'))
      }).not.toThrow()

      consoleSpy.mockRestore()
    })

    it('handles navigation with undefined task ID gracefully', async () => {
      // Create task with undefined ID (edge case)
      const tasksWithUndefinedId = {
        tasks: [
          {
            ...createTask(),
            id: undefined as any,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      }

      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(tasksWithUndefinedId)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      })

      // Should render without crashing
      expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
    })
  })

  describe('Navigation Performance', () => {
    it('does not cause unnecessary re-renders during navigation', async () => {
      const renderSpy = vi.fn()

      // Wrap component to track renders
      const WrappedDashboard = () => {
        renderSpy()
        return <DashboardPage />
      }

      render(<WrappedDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-pending-1')).toBeInTheDocument()
      })

      const initialRenderCount = renderSpy.mock.calls.length

      // Click to navigate
      fireEvent.click(screen.getByTestId('task-view-details-task-pending-1'))

      // Should not cause additional renders
      expect(renderSpy.mock.calls.length).toBe(initialRenderCount)
    })

    it('handles rapid navigation clicks appropriately', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-pending-1')).toBeInTheDocument()
      })

      const taskItem = screen.getByTestId('task-view-details-task-pending-1')

      // Rapid clicks
      fireEvent.click(taskItem)
      fireEvent.click(taskItem)
      fireEvent.click(taskItem)

      // Should call push for each click
      expect(mockPush).toHaveBeenCalledTimes(3)
      expect(mockPush).toHaveBeenCalledWith('/tasks/task-pending-1')
    })
  })

  describe('Navigation State Management', () => {
    it('maintains dashboard state after navigation', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-pending-1')).toBeInTheDocument()
      })

      // Navigate
      fireEvent.click(screen.getByTestId('task-view-details-task-pending-1'))

      // Dashboard should still be rendered (navigation doesn't unmount it)
      expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('preserves task data during navigation interactions', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-task-pending-1')).toBeInTheDocument()
      })

      // Verify task data is present
      expect(screen.getByTestId('task-title-task-pending-1')).toHaveTextContent('Task with pending status')
      expect(screen.getByTestId('task-status-task-pending-1')).toHaveTextContent('Status: pending')

      // Navigate
      fireEvent.click(screen.getByTestId('task-view-details-task-pending-1'))

      // Task data should still be present
      expect(screen.getByTestId('task-title-task-pending-1')).toHaveTextContent('Task with pending status')
      expect(screen.getByTestId('task-status-task-pending-1')).toHaveTextContent('Status: pending')
    })
  })

  describe('URL Generation', () => {
    it('generates correct URLs for different task ID formats', async () => {
      const variedTasks = {
        tasks: [
          createTask({ id: 'simple-123', description: 'Simple ID' }),
          createTask({ id: 'complex-task-with-many-parts-456', description: 'Complex ID' }),
          createTask({ id: '789', description: 'Numeric ID' }),
        ],
        total: 3,
        page: 1,
        limit: 20,
      }

      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue(variedTasks)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('task-view-details-simple-123')).toBeInTheDocument()
        expect(screen.getByTestId('task-view-details-complex-task-with-many-parts-456')).toBeInTheDocument()
        expect(screen.getByTestId('task-view-details-789')).toBeInTheDocument()
      })

      // Test URL generation for each type
      fireEvent.click(screen.getByTestId('task-view-details-simple-123'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/simple-123')

      fireEvent.click(screen.getByTestId('task-view-details-complex-task-with-many-parts-456'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/complex-task-with-many-parts-456')

      fireEvent.click(screen.getByTestId('task-view-details-789'))
      expect(mockPush).toHaveBeenCalledWith('/tasks/789')
    })
  })
})