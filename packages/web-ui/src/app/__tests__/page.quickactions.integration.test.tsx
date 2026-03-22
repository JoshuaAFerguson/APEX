/**
 * Integration tests for Dashboard page with QuickActionsBar
 *
 * Tests the integration between the dashboard page and QuickActionsBar component:
 * - QuickActionsBar positioning and display
 * - Task creation flow integration
 * - Dashboard refresh after task creation
 * - Error handling in context
 * - Real-time updates interaction
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DashboardPage from '../page'
import { apiClient } from '@/lib/api-client'
import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'
import type { TaskTemplate } from '@/types/task-template'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTaskStats: vi.fn(),
    listTasks: vi.fn(),
    getQuickActionTemplates: vi.fn(),
    createTaskFromTemplate: vi.fn(),
  },
}))

// Mock the real-time updates hook
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

// Mock router
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}))

// Mock child components to focus on integration
vi.mock('@/components/dashboard/BudgetWidget', () => ({
  BudgetWidget: () => <div data-testid="budget-widget">Budget Widget</div>,
}))

vi.mock('@/components/dashboard/AgentUtilizationWidget', () => ({
  AgentUtilizationWidget: () => <div data-testid="agent-utilization-widget">Agent Utilization Widget</div>,
}))

vi.mock('@/components/dashboard/ProjectHealthPanel', () => ({
  ProjectHealthPanel: () => <div data-testid="project-health-panel">Project Health Panel</div>,
}))

vi.mock('@/components/dashboard/PerformanceMetricsPanel', () => ({
  PerformanceMetricsPanel: () => <div data-testid="performance-metrics-panel">Performance Metrics Panel</div>,
}))

vi.mock('@/components/tasks/ActiveTasksPanelRealtime', () => ({
  ActiveTasksPanelRealtime: () => <div data-testid="active-tasks-panel">Active Tasks Panel</div>,
}))

// Simplified QuickActionsBar mock for integration testing
vi.mock('@/components/dashboard/QuickActionsBar', () => ({
  QuickActionsBar: ({ onTaskCreated, onError, maxActions, showIcons, compact }: any) => (
    <div data-testid="quick-actions-bar" data-max-actions={maxActions} data-show-icons={showIcons} data-compact={compact}>
      <h3>Quick Actions</h3>
      <button
        data-testid="quick-action-test"
        onClick={() => {
          // Simulate successful task creation
          try {
            onTaskCreated?.('task_123', 'template_123')
          } catch (error) {
            onError?.(new Error('Task creation failed'), 'template_123')
          }
        }}
      >
        Test Quick Action
      </button>
      <button
        data-testid="quick-action-error"
        onClick={() => {
          onError?.(new Error('Template error'), 'template_error')
        }}
      >
        Error Quick Action
      </button>
    </div>
  ),
}))

const mockApiClient = vi.mocked(apiClient)
const mockUseRealtimeUpdates = vi.mocked(useRealtimeUpdates)

// Mock data
const mockTaskStats = {
  byStatus: {
    pending: 3,
    queued: 2,
    'in-progress': 4,
    'waiting-approval': 1,
    paused: 2,
    completed: 15,
    failed: 1,
  },
  totalCost: 42.50,
  totalTokens: 125000,
}

const mockTasks = [
  {
    id: 'task_1',
    description: 'Test task 1',
    status: 'in-progress',
    priority: 'normal',
    effort: 'medium',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'task_2',
    description: 'Test task 2',
    status: 'completed',
    priority: 'high',
    effort: 'small',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

const mockRealtimeState = {
  state: {
    health: null,
    performance: null,
    error: null,
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  refreshPerformance: vi.fn(),
  checkHealth: vi.fn(),
}

const defaultMockQuickActionTemplates: TaskTemplate[] = [
  {
    id: 'template_123',
    name: 'Test Template',
    description: 'Test template description',
    category: 'feature',
    workflow: 'feature',
    autonomy: 'review-before-commit',
    descriptionTemplate: 'Create test feature',
    tags: ['test'],
    isQuickAction: true,
    priority: 'normal',
    effort: 'medium',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
]

describe('Dashboard Page Integration with QuickActionsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockClear()

    // Set up default API responses
    mockApiClient.getTaskStats.mockResolvedValue(mockTaskStats)
    mockApiClient.listTasks.mockResolvedValue({ tasks: mockTasks, total: mockTasks.length })
    mockApiClient.getQuickActionTemplates.mockResolvedValue(defaultMockQuickActionTemplates)
    mockApiClient.createTaskFromTemplate.mockResolvedValue({ taskId: 'task_123' })

    // Set up real-time updates mock
    mockUseRealtimeUpdates.mockReturnValue(mockRealtimeState)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Layout and Positioning', () => {
    it('renders QuickActionsBar above the metrics cards', async () => {
      render(<DashboardPage />)

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // QuickActionsBar should be present
      const quickActionsBar = screen.getByTestId('quick-actions-bar')
      expect(quickActionsBar).toBeInTheDocument()

      // Should be positioned before the metrics grid
      const dashboardContent = screen.getByText('Dashboard').closest('div')
      const quickActions = screen.getByTestId('quick-actions-bar')
      const pendingCard = screen.getByText('Pending')

      // QuickActions should come before the metrics cards in the DOM
      expect(dashboardContent?.innerHTML.indexOf('quick-actions-bar'))
        .toBeLessThan(dashboardContent?.innerHTML.indexOf('Pending') || Infinity)
    })

    it('passes correct props to QuickActionsBar', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      })

      const quickActionsBar = screen.getByTestId('quick-actions-bar')

      // Check that props are passed correctly
      expect(quickActionsBar).toHaveAttribute('data-max-actions', '6')
      expect(quickActionsBar).toHaveAttribute('data-show-icons', 'true')
      expect(quickActionsBar).toHaveAttribute('data-compact', 'false')
    })
  })

  describe('Task Creation Integration', () => {
    it('handles successful task creation and navigation', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      })

      // Mock a successful API call for stats refresh
      mockApiClient.getTaskStats.mockResolvedValue({
        ...mockTaskStats,
        byStatus: { ...mockTaskStats.byStatus, 'in-progress': 5 }, // One more task
      })

      // Click the quick action button
      const quickActionButton = screen.getByTestId('quick-action-test')
      fireEvent.click(quickActionButton)

      // Should navigate to the created task
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/tasks/task_123')
      })

      // Should trigger a dashboard refresh
      await waitFor(() => {
        expect(mockApiClient.getTaskStats).toHaveBeenCalledTimes(2) // Initial + refresh
        expect(mockApiClient.listTasks).toHaveBeenCalledTimes(2) // Initial + refresh
      })
    })

    it('handles task creation errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      })

      // Click the error quick action button
      const errorActionButton = screen.getByTestId('quick-action-error')
      fireEvent.click(errorActionButton)

      // Should log the error (in a real app, might show a toast)
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to create task from template template_error'),
          expect.any(Error)
        )
      })

      // Should not navigate on error
      expect(mockPush).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('refreshes dashboard data after task creation', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      })

      // Track initial API calls
      const initialStatsCallCount = mockApiClient.getTaskStats.mock.calls.length
      const initialTasksCallCount = mockApiClient.listTasks.mock.calls.length

      // Click quick action button
      const quickActionButton = screen.getByTestId('quick-action-test')
      fireEvent.click(quickActionButton)

      // Should call refresh APIs
      await waitFor(() => {
        expect(mockApiClient.getTaskStats).toHaveBeenCalledTimes(initialStatsCallCount + 1)
        expect(mockApiClient.listTasks).toHaveBeenCalledTimes(initialTasksCallCount + 1)
      })

      // Should also call real-time refresh functions
      await waitFor(() => {
        expect(mockRealtimeState.refreshPerformance).toHaveBeenCalled()
        expect(mockRealtimeState.checkHealth).toHaveBeenCalled()
      })
    })
  })

  describe('Loading States', () => {
    it('shows loading state while dashboard data loads', async () => {
      // Mock delayed API responses
      let resolveStats: (value: any) => void
      mockApiClient.getTaskStats.mockReturnValue(
        new Promise((resolve) => {
          resolveStats = resolve
        })
      )

      render(<DashboardPage />)

      // Should show loading spinner initially
      expect(screen.getByRole('status')).toBeInTheDocument()

      // Resolve the API call
      resolveStats!(mockTaskStats)

      // Should hide loading spinner
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      })
    })

    it('shows QuickActionsBar after dashboard loads', async () => {
      render(<DashboardPage />)

      // QuickActionsBar should be present after loading
      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('still shows QuickActionsBar when dashboard API fails', async () => {
      mockApiClient.getTaskStats.mockRejectedValue(new Error('API failure'))
      mockApiClient.listTasks.mockRejectedValue(new Error('API failure'))

      render(<DashboardPage />)

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText('API failure')).toBeInTheDocument()
      })

      // QuickActionsBar should still be rendered (it has its own data loading)
      expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
    })

    it('handles dashboard refresh from error state', async () => {
      mockApiClient.getTaskStats.mockRejectedValue(new Error('API failure'))

      render(<DashboardPage />)

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('API failure')).toBeInTheDocument()
      })

      // Mock successful retry
      mockApiClient.getTaskStats.mockResolvedValue(mockTaskStats)
      mockApiClient.listTasks.mockResolvedValue({ tasks: mockTasks, total: mockTasks.length })

      // Click retry button
      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      // Should show normal dashboard content
      await waitFor(() => {
        expect(screen.queryByText('API failure')).not.toBeInTheDocument()
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // QuickActionsBar should be present
      expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
    })
  })

  describe('Real-time Updates Integration', () => {
    it('connects real-time updates on mount', () => {
      render(<DashboardPage />)

      // useRealtimeUpdates should be called with correct config
      expect(mockUseRealtimeUpdates).toHaveBeenCalledWith({
        autoConnect: true,
        subscription: {
          includeHealth: true,
          includePerformance: true,
          performanceUpdateInterval: 5000,
        },
      })
    })

    it('disconnects real-time updates on unmount', () => {
      const { unmount } = render(<DashboardPage />)

      // Unmount the component
      unmount()

      // Should call disconnect
      expect(mockRealtimeState.disconnect).toHaveBeenCalled()
    })

    it('integrates real-time updates with QuickActionsBar refresh', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      })

      // Click quick action to trigger refresh
      const quickActionButton = screen.getByTestId('quick-action-test')
      fireEvent.click(quickActionButton)

      // Should trigger both dashboard and real-time refresh
      await waitFor(() => {
        expect(mockRealtimeState.refreshPerformance).toHaveBeenCalled()
        expect(mockRealtimeState.checkHealth).toHaveBeenCalled()
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('renders all dashboard sections with QuickActionsBar', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
      })

      // Check that all main dashboard sections are present
      expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument() // Metrics cards
      expect(screen.getByTestId('project-health-panel')).toBeInTheDocument()
      expect(screen.getByTestId('performance-metrics-panel')).toBeInTheDocument()
      expect(screen.getByTestId('budget-widget')).toBeInTheDocument()
      expect(screen.getByTestId('agent-utilization-widget')).toBeInTheDocument()
      expect(screen.getByTestId('active-tasks-panel')).toBeInTheDocument()
    })

    it('maintains layout order with QuickActionsBar first', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      })

      // Get the main dashboard container
      const dashboardContainer = screen.getByText('Dashboard').closest('div')
      const childElements = Array.from(dashboardContainer?.querySelectorAll('[data-testid]') || [])

      // QuickActionsBar should be the first data-testid element
      expect(childElements[0]).toHaveAttribute('data-testid', 'quick-actions-bar')
    })
  })

  describe('Accessibility Integration', () => {
    it('maintains accessible structure with QuickActionsBar', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      })

      // Should have main heading
      expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()

      // QuickActionsBar should be accessible
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()

      // All sections should be keyboard navigable
      const interactiveElements = screen.getAllByRole('button')
      expect(interactiveElements.length).toBeGreaterThan(0)
    })

    it('supports keyboard navigation throughout dashboard', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      })

      // Quick action buttons should be focusable
      const quickActionButton = screen.getByTestId('quick-action-test')
      quickActionButton.focus()
      expect(quickActionButton).toHaveFocus()

      // Other buttons should also be focusable
      const refreshButton = screen.getByText('Refresh')
      refreshButton.focus()
      expect(refreshButton).toHaveFocus()
    })
  })

  describe('Performance Integration', () => {
    it('does not cause excessive re-renders', async () => {
      const renderSpy = vi.fn()

      const TestWrapper = () => {
        renderSpy()
        return <DashboardPage />
      }

      render(<TestWrapper />)

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-bar')).toBeInTheDocument()
      })

      // Initial render + completion of loading
      expect(renderSpy).toHaveBeenCalledTimes(2)

      // Trigger a quick action
      const quickActionButton = screen.getByTestId('quick-action-test')
      fireEvent.click(quickActionButton)

      // Should not cause excessive re-renders during task creation
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })

      // Should only render a reasonable number of times
      expect(renderSpy).toHaveBeenCalledTimes(4) // Initial + loading complete + refresh start + refresh complete
    })
  })
})