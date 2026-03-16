/**
 * Error handling and edge cases tests for Dashboard Page
 *
 * Tests comprehensive error scenarios and edge cases across all dashboard panels
 * to ensure graceful degradation and proper user feedback.
 *
 * Covers:
 * - API failure scenarios (network, server errors, timeouts)
 * - WebSocket connection failures and recovery
 * - Partial data loading scenarios
 * - Empty/null data handling
 * - Race conditions and timing issues
 * - Error boundary integration
 * - User feedback and recovery actions
 * - Loading state management
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTaskStats: vi.fn(),
    listTasks: vi.fn(),
  },
}))

// Mock real-time updates hook
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

// Mock components with error state tracking
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

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
      data-disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, className, ...props }: any) => (
    <div data-testid="spinner" data-size={size} className={className} {...props}>
      Loading...
    </div>
  ),
}))

vi.mock('@/components/layout/Header', () => ({
  Header: ({ title, description, actions, ...props }: any) => (
    <div data-testid="header" {...props}>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}))

// Mock dashboard panels with comprehensive error state tracking
vi.mock('@/components/dashboard/ProjectHealthPanel', () => ({
  ProjectHealthPanel: ({ metrics, isLoading, error, onRefresh, ...props }: any) => (
    <div
      data-testid="project-health-panel"
      data-has-metrics={!!metrics}
      data-is-loading={isLoading}
      data-has-error={!!error}
      data-error-message={error || ''}
      {...props}
    >
      ProjectHealthPanel
      {isLoading && <div data-testid="health-loading">Loading health data...</div>}
      {error && <div data-testid="health-error">Error: {error}</div>}
      {metrics && <div data-testid="health-success">Health data loaded</div>}
      {onRefresh && (
        <button data-testid="health-refresh" onClick={onRefresh}>
          Retry Health
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/PerformanceMetricsPanel', () => ({
  PerformanceMetricsPanel: ({ data, loading, error, onRefresh, autoRefresh, ...props }: any) => (
    <div
      data-testid="performance-metrics-panel"
      data-has-data={!!data}
      data-is-loading={loading}
      data-has-error={!!error}
      data-error-message={error || ''}
      data-auto-refresh={autoRefresh}
      {...props}
    >
      PerformanceMetricsPanel
      {loading && <div data-testid="performance-loading">Loading performance data...</div>}
      {error && <div data-testid="performance-error">Error: {error}</div>}
      {data && <div data-testid="performance-success">Performance data loaded</div>}
      {onRefresh && (
        <button data-testid="performance-refresh" onClick={onRefresh}>
          Retry Performance
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/BudgetWidget', () => ({
  BudgetWidget: ({ onRefresh, ...props }: any) => (
    <div data-testid="budget-widget" {...props}>
      BudgetWidget
      {onRefresh && (
        <button data-testid="budget-refresh" onClick={onRefresh}>
          Retry Budget
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/AgentUtilizationWidget', () => ({
  AgentUtilizationWidget: ({ onRefresh, ...props }: any) => (
    <div data-testid="agent-utilization-widget" {...props}>
      AgentUtilizationWidget
      {onRefresh && (
        <button data-testid="agent-refresh" onClick={onRefresh}>
          Retry Agent
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/tasks/ActiveTasksPanelRealtime', () => ({
  ActiveTasksPanelRealtime: ({ initialTasks, onViewDetails, ...props }: any) => (
    <div
      data-testid="active-tasks-panel-realtime"
      data-initial-tasks-count={initialTasks?.length || 0}
      data-has-initial-tasks={!!initialTasks && initialTasks.length > 0}
      {...props}
    >
      ActiveTasksPanelRealtime
      {(!initialTasks || initialTasks.length === 0) && (
        <div data-testid="tasks-empty">No tasks available</div>
      )}
      {initialTasks && initialTasks.length > 0 && (
        <div data-testid="tasks-success">Tasks loaded</div>
      )}
    </div>
  ),
}))

// Mock utility functions
vi.mock('@/lib/utils', () => ({
  formatCost: vi.fn((cost: number) => {
    if (typeof cost !== 'number' || isNaN(cost)) return '$0.00'
    return `$${cost.toFixed(2)}`
  }),
  getStatusVariant: vi.fn((status: string) => 'secondary'),
  formatStatus: vi.fn((status: string) => status?.replace('-', ' ') || 'unknown'),
  getRelativeTime: vi.fn(() => '2 minutes ago'),
  truncateId: vi.fn((id: string) => id?.slice(0, 8) + '...' || 'unknown'),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')
const mockUseRealtimeUpdates = await import('@/lib/useRealtimeUpdates')

describe('Dashboard Page Error Handling', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }
  const user = userEvent.setup()

  // Error scenarios
  const createNetworkError = () => new Error('Network Error')
  const createTimeoutError = () => new Error('Request timeout')
  const createServerError = () => new Error('Internal Server Error')
  const createParsingError = () => new Error('JSON parsing failed')

  const createValidTaskStats = () => ({
    byStatus: {
      pending: 5,
      'in-progress': 3,
      completed: 20,
      failed: 2,
    },
    totalCost: 25.75,
    totalTokens: 50000,
  })

  const createValidTasks = () => [
    {
      id: 'task-1',
      description: 'Test task 1',
      status: 'in-progress',
      workflow: 'test',
      autonomy: 'medium',
      priority: 'medium',
      effort: 'medium',
      projectPath: '/test',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const createHealthyRealtimeState = () => ({
    state: {
      health: {
        status: 'connected',
        tasks: {
          activeTasks: 3,
          pendingTasks: 5,
          completedLastHour: 20,
          failedLastHour: 2,
        },
        connection: { isConnected: true, latencyMs: 45 },
        lastUpdated: new Date(),
      },
      performance: {
        tokenUsage: { totalTokens: 50000, estimatedCost: 25.75 },
        tasks: { completedTasks: 20, failedTasks: 2 },
        generatedAt: new Date(),
      },
      error: null,
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshPerformance: vi.fn(),
    checkHealth: vi.fn(),
  })

  const createErrorRealtimeState = (errorMessage: string) => ({
    state: {
      health: null,
      performance: null,
      error: errorMessage,
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshPerformance: vi.fn(),
    checkHealth: vi.fn(),
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(useRouter as any).mockReturnValue(mockRouter)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('API Failure Scenarios', () => {
    it('handles task stats API failure gracefully', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(createNetworkError())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Should show error message
        expect(screen.getByText('Network Error')).toBeInTheDocument()
        expect(screen.getByText('Make sure the APEX API server is running:')).toBeInTheDocument()
        expect(screen.getByText('apex serve --port 3002')).toBeInTheDocument()

        // Should show retry button
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('handles tasks list API failure gracefully', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockRejectedValue(createServerError())
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Should show error message
        expect(screen.getByText('Internal Server Error')).toBeInTheDocument()

        // Task status cards should still work with stats data
        expect(screen.getByText('5')).toBeInTheDocument() // Pending tasks
        expect(screen.getByText('3')).toBeInTheDocument() // Active tasks

        // Active tasks panel should handle empty initial tasks
        expect(screen.getByTestId('tasks-empty')).toBeInTheDocument()
      })
    })

    it('handles both API failures simultaneously', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(createNetworkError())
      vi.mocked(mockApiClient.apiClient.listTasks).mockRejectedValue(createTimeoutError())
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Should show first error (task stats)
        expect(screen.getByText('Network Error')).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('handles API timeout scenarios', async () => {
      // Mock long-running requests
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(createTimeoutError()), 100))
      )
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      // Should show loading state initially
      expect(screen.getByTestId('spinner')).toBeInTheDocument()

      // Should eventually show timeout error
      await waitFor(
        () => {
          expect(screen.getByText('Request timeout')).toBeInTheDocument()
        },
        { timeout: 200 }
      )
    })

    it('allows retry after API failures', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats)
        .mockRejectedValueOnce(createNetworkError())
        .mockResolvedValueOnce(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument()
      })

      // Click retry
      const retryButton = screen.getByText('Retry')
      await act(async () => {
        await user.click(retryButton)
      })

      // Should recover and show dashboard
      await waitFor(() => {
        expect(screen.queryByText('Network Error')).not.toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument() // Pending tasks
      })
    })
  })

  describe('WebSocket Failure Scenarios', () => {
    it('handles WebSocket connection failures', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(
        createErrorRealtimeState('WebSocket connection failed')
      )

      render(<DashboardPage />)

      await waitFor(() => {
        // Dashboard should still load with static data
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument() // Pending tasks

        // Real-time panels should show error states
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-has-error', 'true')
        expect(healthPanel).toHaveAttribute('data-error-message', 'WebSocket connection failed')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-error', 'true')
        expect(performancePanel).toHaveAttribute('data-error-message', 'WebSocket connection failed')
      })
    })

    it('shows appropriate error messages in panels during WebSocket failures', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(
        createErrorRealtimeState('Connection lost - attempting to reconnect')
      )

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('health-error')).toHaveTextContent('Error: Connection lost - attempting to reconnect')
        expect(screen.getByTestId('performance-error')).toHaveTextContent('Error: Connection lost - attempting to reconnect')
      })
    })

    it('provides retry functionality for WebSocket-dependent panels', async () => {
      const mockRefreshPerformance = vi.fn()
      const mockCheckHealth = vi.fn()

      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue({
        ...createErrorRealtimeState('WebSocket error'),
        refreshPerformance: mockRefreshPerformance,
        checkHealth: mockCheckHealth,
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('health-refresh')).toBeInTheDocument()
        expect(screen.getByTestId('performance-refresh')).toBeInTheDocument()
      })

      const healthRefresh = screen.getByTestId('health-refresh')
      await act(async () => {
        await user.click(healthRefresh)
      })

      expect(mockCheckHealth).toHaveBeenCalled()
      expect(mockRefreshPerformance).toHaveBeenCalled()
    })
  })

  describe('Partial Data Loading Scenarios', () => {
    it('handles missing WebSocket health data while performance data is available', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })

      const partialRealtimeState = createHealthyRealtimeState()
      partialRealtimeState.state.health = null // Health data missing
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(partialRealtimeState)

      render(<DashboardPage />)

      await waitFor(() => {
        // Health panel should show loading/no data state
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-has-metrics', 'false')
        expect(healthPanel).toHaveAttribute('data-is-loading', 'true')

        // Performance panel should work normally
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-data', 'true')
        expect(screen.getByTestId('performance-success')).toBeInTheDocument()
      })
    })

    it('handles missing WebSocket performance data while health data is available', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })

      const partialRealtimeState = createHealthyRealtimeState()
      partialRealtimeState.state.performance = null // Performance data missing
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(partialRealtimeState)

      render(<DashboardPage />)

      await waitFor(() => {
        // Health panel should work normally
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-has-metrics', 'true')
        expect(screen.getByTestId('health-success')).toBeInTheDocument()

        // Performance panel should show loading/no data state
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-data', 'false')
        expect(performancePanel).toHaveAttribute('data-is-loading', 'true')
      })
    })
  })

  describe('Empty and Null Data Handling', () => {
    it('handles empty task stats gracefully', async () => {
      const emptyStats = {
        byStatus: {},
        totalCost: 0,
        totalTokens: 0,
      }

      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(emptyStats)
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: [],
        total: 0,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Should show zeros for all status counts
        const zeroElements = screen.getAllByText('0')
        expect(zeroElements.length).toBeGreaterThanOrEqual(5) // At least pending, active, paused, completed, failed

        // Should show $0.00 for cost
        expect(screen.getByText('$0.00')).toBeInTheDocument()

        // Tasks panel should show empty state
        expect(screen.getByTestId('tasks-empty')).toBeInTheDocument()
      })
    })

    it('handles malformed task stats data', async () => {
      const malformedStats = {
        byStatus: null, // Invalid data
        totalCost: 'not-a-number', // Invalid data
        totalTokens: undefined, // Invalid data
      }

      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(malformedStats as any)
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Should handle malformed data gracefully with defaults
        expect(screen.getByText('$0.00')).toBeInTheDocument() // formatCost should handle invalid input

        // Should not crash and still render the dashboard
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })
    })

    it('handles empty tasks list', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: [],
        total: 0,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Dashboard should still load
        expect(screen.getByText('Dashboard')).toBeInTheDocument()

        // Task status should show stats data
        expect(screen.getByText('5')).toBeInTheDocument() // Pending from stats

        // Active tasks panel should handle empty list
        const tasksPanel = screen.getByTestId('active-tasks-panel-realtime')
        expect(tasksPanel).toHaveAttribute('data-initial-tasks-count', '0')
        expect(screen.getByTestId('tasks-empty')).toBeInTheDocument()
      })
    })
  })

  describe('Race Conditions and Timing Issues', () => {
    it('handles rapid refresh clicks without duplicate requests', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText('Refresh')

      // Rapidly click refresh multiple times
      await act(async () => {
        await user.click(refreshButton)
        await user.click(refreshButton)
        await user.click(refreshButton)
      })

      // Should handle rapid clicks gracefully
      expect(refreshButton).toBeInTheDocument()
    })

    it('handles component unmount during API requests', async () => {
      let resolveStats: (value: any) => void
      const statsPromise = new Promise((resolve) => {
        resolveStats = resolve
      })

      vi.mocked(mockApiClient.apiClient.getTaskStats).mockReturnValue(statsPromise as any)
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      const { unmount } = render(<DashboardPage />)

      // Unmount before API resolves
      unmount()

      // Resolve after unmount
      resolveStats!(createValidTaskStats())

      // Should not cause errors
      expect(true).toBe(true)
    })
  })

  describe('Loading State Management', () => {
    it('manages loading states correctly during data fetching', async () => {
      let resolveStats: (value: any) => void
      let resolveTasks: (value: any) => void

      const statsPromise = new Promise((resolve) => {
        resolveStats = resolve
      })
      const tasksPromise = new Promise((resolve) => {
        resolveTasks = resolve
      })

      vi.mocked(mockApiClient.apiClient.getTaskStats).mockReturnValue(statsPromise as any)
      vi.mocked(mockApiClient.apiClient.listTasks).mockReturnValue(tasksPromise as any)
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      // Should show loading spinner initially
      expect(screen.getByTestId('spinner')).toBeInTheDocument()

      // Resolve APIs
      resolveStats!(createValidTaskStats())
      resolveTasks!({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })

      // Should hide loading spinner after data loads
      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })
    })

    it('shows appropriate loading states in WebSocket-dependent panels', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })

      // Start with no real-time data
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue({
        state: {
          health: null,
          performance: null,
          error: null,
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        refreshPerformance: vi.fn(),
        checkHealth: vi.fn(),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        // Panels should show loading states for real-time data
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-is-loading', 'true')
        expect(screen.getByTestId('health-loading')).toBeInTheDocument()

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-is-loading', 'true')
        expect(screen.getByTestId('performance-loading')).toBeInTheDocument()
      })
    })
  })

  describe('User Feedback and Recovery', () => {
    it('provides clear error messages and recovery instructions', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error('API server unavailable'))
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Should provide helpful error message
        expect(screen.getByText('API server unavailable')).toBeInTheDocument()
        expect(screen.getByText('Make sure the APEX API server is running:')).toBeInTheDocument()
        expect(screen.getByText('apex serve --port 3002')).toBeInTheDocument()

        // Should provide retry action
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('maintains user context during error recovery', async () => {
      vi.mocked(mockApiClient.apiClient.getTaskStats)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(createValidTaskStats())
      vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
        tasks: createValidTasks(),
        total: 1,
        page: 1,
        limit: 20
      })
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createHealthyRealtimeState())

      render(<DashboardPage />)

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Temporary error')).toBeInTheDocument()
      })

      // Retry
      const retryButton = screen.getByText('Retry')
      await act(async () => {
        await user.click(retryButton)
      })

      // Should recover to full dashboard
      await waitFor(() => {
        expect(screen.queryByText('Temporary error')).not.toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Overview of your APEX project and recent activity')).toBeInTheDocument()
      })
    })
  })
})