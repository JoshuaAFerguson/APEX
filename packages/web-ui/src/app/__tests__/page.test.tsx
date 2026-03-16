/**
 * Unit tests for Dashboard Page (main page.tsx)
 *
 * Tests the integration of all 4 dashboard panels into a responsive grid layout:
 * - ProjectHealthPanel
 * - PerformanceMetricsPanel
 * - BudgetWidget & AgentUtilizationWidget
 * - ActiveTasksPanelRealtime
 *
 * Covers:
 * - Component integration and proper prop passing
 * - Responsive grid layout structure
 * - Shared WebSocket connection management
 * - Loading states handling across all panels
 * - Error states and recovery
 * - Real-time data flow and transformations
 * - Panel coordination and state management
 * - Action handling (refresh, view details)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'
import type { Task } from '@apexcli/core'
import type { ProjectHealthMetrics } from '@/types/project-health'

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

// Mock all UI components to focus on integration logic
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

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size, className, ...props }: any) => (
    <div data-testid="spinner" data-size={size} className={className} {...props}>
      Loading...
    </div>
  ),
}))

// Mock header component
vi.mock('@/components/layout/Header', () => ({
  Header: ({ title, description, actions, ...props }: any) => (
    <div data-testid="header" {...props}>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}))

// Mock all dashboard panel components
vi.mock('@/components/dashboard/ProjectHealthPanel', () => ({
  ProjectHealthPanel: ({ metrics, isLoading, error, timeRange, showDetails, showConnectionStatus, onRefresh, ...props }: any) => (
    <div
      data-testid="project-health-panel"
      data-has-metrics={!!metrics}
      data-is-loading={isLoading}
      data-has-error={!!error}
      data-time-range={timeRange}
      data-show-details={showDetails}
      data-show-connection-status={showConnectionStatus}
      {...props}
    >
      ProjectHealthPanel
      {metrics && <div data-testid="health-metrics">{metrics.status}</div>}
      {isLoading && <div data-testid="health-loading">Loading health...</div>}
      {error && <div data-testid="health-error">{typeof error === 'object' ? JSON.stringify(error) : error}</div>}
      {onRefresh && (
        <button data-testid="health-refresh" onClick={onRefresh}>
          Refresh Health
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/PerformanceMetricsPanel', () => ({
  PerformanceMetricsPanel: ({ data, timeRange, loading, error, onRefresh, autoRefresh, autoRefreshInterval, showTimeRangeSelector, showTokenUsage, showTaskCompletion, showCostTrend, chartVariant, chartSize, animated, ...props }: any) => (
    <div
      data-testid="performance-metrics-panel"
      data-has-data={!!data}
      data-is-loading={loading}
      data-has-error={!!error}
      data-time-range={timeRange}
      data-auto-refresh={autoRefresh}
      data-auto-refresh-interval={autoRefreshInterval}
      {...props}
    >
      PerformanceMetricsPanel
      {data && <div data-testid="performance-data">Performance data available</div>}
      {loading && <div data-testid="performance-loading">Loading performance...</div>}
      {error && <div data-testid="performance-error">{error}</div>}
      {onRefresh && (
        <button data-testid="performance-refresh" onClick={onRefresh}>
          Refresh Performance
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/BudgetWidget', () => ({
  BudgetWidget: ({ budgetLimit, size, thresholds, onRefresh, autoRefreshInterval, ...props }: any) => (
    <div
      data-testid="budget-widget"
      data-budget-limit={budgetLimit}
      data-size={size}
      data-warning-threshold={thresholds?.warning}
      data-danger-threshold={thresholds?.danger}
      data-auto-refresh-interval={autoRefreshInterval}
      {...props}
    >
      BudgetWidget
      {onRefresh && (
        <button data-testid="budget-refresh" onClick={onRefresh}>
          Refresh Budget
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/AgentUtilizationWidget', () => ({
  AgentUtilizationWidget: ({ maxAgents, height, showCost, showPerformance, showTokenBreakdown, onRefresh, onAgentClick, ...props }: any) => (
    <div
      data-testid="agent-utilization-widget"
      data-max-agents={maxAgents}
      data-height={height}
      data-show-cost={showCost}
      data-show-performance={showPerformance}
      data-show-token-breakdown={showTokenBreakdown}
      {...props}
    >
      AgentUtilizationWidget
      {onRefresh && (
        <button data-testid="agent-refresh" onClick={onRefresh}>
          Refresh Agent
        </button>
      )}
      {onAgentClick && (
        <button
          data-testid="agent-click"
          onClick={() => onAgentClick({ agentName: 'test-agent', id: '123' })}
        >
          Click Agent
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/tasks/ActiveTasksPanelRealtime', () => ({
  ActiveTasksPanelRealtime: ({
    initialTasks,
    onViewDetails,
    defaultShowActiveOnly,
    maxTasks,
    compact,
    showConnectionIndicator,
    connectionIndicatorSize,
    autoConnect,
    ...props
  }: any) => (
    <div
      data-testid="active-tasks-panel-realtime"
      data-initial-tasks-count={initialTasks?.length || 0}
      data-default-show-active-only={defaultShowActiveOnly}
      data-max-tasks={maxTasks}
      data-compact={compact}
      data-show-connection-indicator={showConnectionIndicator}
      data-connection-indicator-size={connectionIndicatorSize}
      data-auto-connect={autoConnect}
      {...props}
    >
      ActiveTasksPanelRealtime
      {onViewDetails && (
        <button
          data-testid="view-task-details"
          onClick={() => onViewDetails('task-123')}
        >
          View Details
        </button>
      )}
    </div>
  ),
}))

// Mock utility functions
vi.mock('@/lib/utils', () => ({
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  getStatusVariant: vi.fn((status: string) => 'secondary'),
  formatStatus: vi.fn((status: string) => status.replace('-', ' ')),
  getRelativeTime: vi.fn(() => '2 minutes ago'),
  truncateId: vi.fn((id: string) => id.slice(0, 8) + '...'),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')
const mockUseRealtimeUpdates = await import('@/lib/useRealtimeUpdates')

describe('Dashboard Page', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }
  const user = userEvent.setup()

  // Test data factories
  const createTaskStats = () => ({
    byStatus: {
      pending: 5,
      queued: 3,
      planning: 2,
      'in-progress': 4,
      'waiting-approval': 1,
      paused: 1,
      completed: 25,
      failed: 3,
    },
    totalCost: 15.75,
    totalTokens: 50000,
  })

  const createTasks = (count: number = 5): Task[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `task-${i + 1}`,
      description: `Test task ${i + 1}`,
      status: i === 0 ? 'in-progress' : i === 1 ? 'pending' : 'completed',
      workflow: 'test-workflow',
      autonomy: 'medium',
      priority: 'medium',
      effort: 'medium',
      projectPath: '/test/project',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

  const createHealthMetrics = (): ProjectHealthMetrics => ({
    status: 'healthy',
    successRate: 92.5,
    averageDurationMs: 2500,
    systemHealth: 98.7,
    tasks: {
      activeTasks: 6,
      pendingTasks: 8,
      completedTasks: 25,
      failedTasks: 3,
    },
    connection: {
      isConnected: true,
      latencyMs: 45,
      averageLatencyMs: 52,
      reconnectAttempts: 0,
      connectedSince: new Date(),
    },
    lastUpdated: new Date(),
  })

  const createPerformanceMetrics = () => ({
    timeRange: '24h',
    tokenUsage: {
      data: [{ timestamp: new Date(), totalTokens: 1000, breakdown: {}, tokensPerMinute: 50, cost: 0.05 }],
      totalInputTokens: 600,
      totalOutputTokens: 400,
      totalTokens: 1000,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      cacheHitRate: 25,
      avgTokensPerMinute: 50,
      peakTokensPerMinute: 100,
      totalCost: 0.05,
      timeRange: '24h',
      generatedAt: new Date(),
    },
    taskCompletion: {
      data: [{ timestamp: new Date(), completionRate: 90, successRate: 92, completedCount: 25, failedCount: 2, totalProcessed: 27, avgDurationMs: 2500 }],
      overallCompletionRate: 90,
      overallSuccessRate: 92,
      totalCompleted: 25,
      totalFailed: 2,
      totalProcessed: 27,
      statusCounts: { completed: 25, failed: 2, inProgress: 1, pending: 3, cancelled: 0, paused: 1 },
      byStatus: { completed: 25, failed: 2 },
      avgDurationMs: 2500,
      medianDurationMs: 2200,
      p95DurationMs: 4500,
      timeRange: '24h',
      generatedAt: new Date(),
    },
    costTrend: {
      data: [{ timestamp: new Date(), cost: 0.05, cumulativeCost: 15.75 }],
      totalCost: 15.75,
      avgCostPerHour: 0.66,
      avgCostPerTask: 0.58,
      peakHourlyCost: 1.25,
      breakdown: { inputTokenCost: 0.03, outputTokenCost: 0.02, cacheCreationCost: 0, cacheReadCost: 0, otherCost: 0 },
      budgetLimit: 1000,
      dailyBudgetLimit: 50,
      budgetUtilization: 1.58,
      projectedRemainingCost: 984.25,
      timeRange: '24h',
      generatedAt: new Date(),
    },
    generatedAt: new Date(),
  })

  const createRealtimeState = () => ({
    state: {
      health: {
        status: 'connected',
        tasks: {
          activeTasks: 6,
          pendingTasks: 8,
          completedLastHour: 25,
          failedLastHour: 3,
          averageDurationMs: 2500,
        },
        server: { successRate: 98.7 },
        connection: {
          isConnected: true,
          latencyMs: 45,
          averageLatencyMs: 52,
          reconnectAttempts: 0,
          connectedSince: new Date(),
        },
        lastUpdated: new Date(),
      },
      performance: {
        timeRange: '24h',
        tokenUsage: {
          totalTokens: 1000,
          inputTokens: 600,
          outputTokens: 400,
          tokensPerMinute: 50,
          estimatedCost: 0.05,
          cacheHitRate: 0.25,
        },
        tasks: {
          completedTasks: 25,
          failedTasks: 3,
          successRate: 0.92,
          avgDurationMs: 2500,
          medianDurationMs: 2200,
          p95DurationMs: 4500,
          byStatus: { completed: 25, failed: 3 },
        },
        generatedAt: new Date(),
      },
      error: null,
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

    // Mock API responses
    vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
    vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
      tasks: createTasks(),
      total: 5,
      page: 1,
      limit: 20
    })

    // Mock real-time updates
    ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createRealtimeState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Loading', () => {
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
    })

    it('loads dashboard data on mount', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      })

      expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(1)
      expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledWith({ limit: 20 })
    })

    it('displays dashboard content after loading', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Overview of your APEX project and recent activity')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error message when dashboard data fetch fails', async () => {
      const errorMessage = 'API server not available'
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockRejectedValue(new Error(errorMessage))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
        expect(screen.getByText('Make sure the APEX API server is running:')).toBeInTheDocument()
        expect(screen.getByText('apex serve --port 3002')).toBeInTheDocument()
      })
    })

    it('allows retry when data fetch fails', async () => {
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

  describe('Dashboard Grid Layout', () => {
    it('renders all dashboard sections in correct grid structure', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      })

      // Row 1: Task status overview cards (6 columns)
      const statusCards = screen.getAllByTestId('card')
      const headerRow = statusCards.slice(0, 6)
      expect(headerRow).toHaveLength(6)

      // Verify status card content
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Paused')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
      expect(screen.getByText('Total Cost')).toBeInTheDocument()

      // Row 2: Project Health Panel
      expect(screen.getByTestId('project-health-panel')).toBeInTheDocument()

      // Row 3: Performance Metrics Panel
      expect(screen.getByTestId('performance-metrics-panel')).toBeInTheDocument()

      // Row 4: Budget and Agent Utilization Widgets
      expect(screen.getByTestId('budget-widget')).toBeInTheDocument()
      expect(screen.getByTestId('agent-utilization-widget')).toBeInTheDocument()

      // Row 5: Active Tasks Panel
      expect(screen.getByTestId('active-tasks-panel-realtime')).toBeInTheDocument()
    })

    it('displays correct task status values from stats', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // Pending = pending + queued = 5 + 3 = 8
        expect(screen.getByText('8')).toBeInTheDocument()

        // Active = planning + in-progress + waiting-approval = 2 + 4 + 1 = 7
        expect(screen.getByText('7')).toBeInTheDocument()

        // Paused = 1
        expect(screen.getByText('1')).toBeInTheDocument()

        // Completed = 25
        expect(screen.getByText('25')).toBeInTheDocument()

        // Failed = 3
        expect(screen.getByText('3')).toBeInTheDocument()

        // Total Cost = $15.75
        expect(screen.getByText('$15.75')).toBeInTheDocument()
      })
    })

    it('applies responsive grid classes correctly', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
      })

      // Task status row should have responsive grid
      const gridContainer = screen.getByText('Pending').closest('.grid')
      expect(gridContainer).toHaveClass('gap-6', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-6')

      // Budget/Agent row should have responsive grid
      const widgetContainer = screen.getByTestId('budget-widget').closest('.grid')
      expect(widgetContainer).toHaveClass('gap-6', 'md:grid-cols-1', 'lg:grid-cols-2')
    })
  })

  describe('Panel Integration and Props', () => {
    it('passes correct props to ProjectHealthPanel', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-has-metrics', 'true')
        expect(healthPanel).toHaveAttribute('data-time-range', '1h')
        expect(healthPanel).toHaveAttribute('data-show-details', 'true')
        expect(healthPanel).toHaveAttribute('data-show-connection-status', 'true')
      })
    })

    it('passes correct props to PerformanceMetricsPanel', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-data', 'true')
        expect(performancePanel).toHaveAttribute('data-time-range', '24h')
        expect(performancePanel).toHaveAttribute('data-auto-refresh', 'true')
        expect(performancePanel).toHaveAttribute('data-auto-refresh-interval', '5000')
      })
    })

    it('passes correct props to BudgetWidget', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const budgetWidget = screen.getByTestId('budget-widget')
        expect(budgetWidget).toHaveAttribute('data-budget-limit', '1000')
        expect(budgetWidget).toHaveAttribute('data-size', 'md')
        expect(budgetWidget).toHaveAttribute('data-warning-threshold', '75')
        expect(budgetWidget).toHaveAttribute('data-danger-threshold', '90')
        expect(budgetWidget).toHaveAttribute('data-auto-refresh-interval', '0')
      })
    })

    it('passes correct props to AgentUtilizationWidget', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const agentWidget = screen.getByTestId('agent-utilization-widget')
        expect(agentWidget).toHaveAttribute('data-max-agents', '6')
        expect(agentWidget).toHaveAttribute('data-height', '300')
        expect(agentWidget).toHaveAttribute('data-show-cost', 'true')
        expect(agentWidget).toHaveAttribute('data-show-performance', 'false')
        expect(agentWidget).toHaveAttribute('data-show-token-breakdown', 'true')
      })
    })

    it('passes correct props to ActiveTasksPanelRealtime', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const tasksPanel = screen.getByTestId('active-tasks-panel-realtime')
        expect(tasksPanel).toHaveAttribute('data-initial-tasks-count', '5')
        expect(tasksPanel).toHaveAttribute('data-default-show-active-only', 'false')
        expect(tasksPanel).toHaveAttribute('data-max-tasks', '15')
        expect(tasksPanel).toHaveAttribute('data-compact', 'false')
        expect(tasksPanel).toHaveAttribute('data-show-connection-indicator', 'true')
        expect(tasksPanel).toHaveAttribute('data-connection-indicator-size', 'md')
        expect(tasksPanel).toHaveAttribute('data-auto-connect', 'true')
      })
    })
  })

  describe('Shared WebSocket Connection', () => {
    it('initializes real-time updates with correct configuration', async () => {
      render(<DashboardPage />)

      expect(mockUseRealtimeUpdates.useRealtimeUpdates).toHaveBeenCalledWith({
        autoConnect: true,
        subscription: {
          includeHealth: true,
          includePerformance: true,
          performanceUpdateInterval: 5000,
        },
      })
    })

    it('disconnects WebSocket on unmount', async () => {
      const mockDisconnect = vi.fn()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue({
        ...createRealtimeState(),
        disconnect: mockDisconnect,
      })

      const { unmount } = render(<DashboardPage />)

      unmount()

      expect(mockDisconnect).toHaveBeenCalled()
    })

    it('transforms real-time health data to ProjectHealthMetrics format', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-has-metrics', 'true')

        // Verify transformation worked
        expect(screen.getByTestId('health-metrics')).toBeInTheDocument()
      })
    })

    it('transforms real-time performance data correctly', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-data', 'true')

        // Verify transformation worked
        expect(screen.getByTestId('performance-data')).toBeInTheDocument()
      })
    })
  })

  describe('Action Handlers', () => {
    it('handles global refresh action', async () => {
      const mockRefreshPerformance = vi.fn()
      const mockCheckHealth = vi.fn()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue({
        ...createRealtimeState(),
        refreshPerformance: mockRefreshPerformance,
        checkHealth: mockCheckHealth,
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText('Refresh')
      await act(async () => {
        await user.click(refreshButton)
      })

      // Should refresh all data sources
      expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
      expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledTimes(2)
      expect(mockRefreshPerformance).toHaveBeenCalled()
      expect(mockCheckHealth).toHaveBeenCalled()
    })

    it('handles view task details navigation', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('view-task-details')).toBeInTheDocument()
      })

      const viewDetailsButton = screen.getByTestId('view-task-details')
      await act(async () => {
        await user.click(viewDetailsButton)
      })

      expect(mockPush).toHaveBeenCalledWith('/tasks/task-123')
    })

    it('handles agent click action', async () => {
      // Mock console.log since that's what the handler does
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('agent-click')).toBeInTheDocument()
      })

      const agentClickButton = screen.getByTestId('agent-click')
      await act(async () => {
        await user.click(agentClickButton)
      })

      expect(consoleSpy).toHaveBeenCalledWith('Agent clicked:', 'test-agent', { agentName: 'test-agent', id: '123' })

      consoleSpy.mockRestore()
    })
  })

  describe('Loading States', () => {
    it('handles loading states gracefully when real-time data is not available', async () => {
      // Mock API calls to be slow to ensure loading state
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(createTaskStats()), 100))
      )
      vi.mocked(mockApiClient.apiClient.listTasks).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          tasks: createTasks(),
          total: 5,
          page: 1,
          limit: 20
        }), 100))
      )

      // Mock real-time state with no data
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
        // Initially should be in loading state
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument() // Initial API loading finished

        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-has-metrics', 'false')
        expect(healthPanel).toHaveAttribute('data-is-loading', 'true')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-data', 'false')
        expect(performancePanel).toHaveAttribute('data-is-loading', 'true')
      }, { timeout: 2000 })
    })

    it('displays loading indicators in panels when appropriate', async () => {
      // Mock API calls to be slow to ensure loading state
      vi.mocked(mockApiClient.apiClient.getTaskStats).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(createTaskStats()), 100))
      )
      vi.mocked(mockApiClient.apiClient.listTasks).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          tasks: createTasks(),
          total: 5,
          page: 1,
          limit: 20
        }), 100))
      )

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
        expect(screen.getByTestId('health-loading')).toBeInTheDocument()
        expect(screen.getByTestId('performance-loading')).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('Error States', () => {
    it('handles real-time connection errors', async () => {
      const errorMessage = 'WebSocket connection failed'
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue({
        state: {
          health: null,
          performance: null,
          error: { message: errorMessage }, // Error object with message property
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        refreshPerformance: vi.fn(),
        checkHealth: vi.fn(),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-has-error', 'true')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-error', 'true')
      }, { timeout: 2000 })
    })
  })

  describe('Data Calculations', () => {
    it('correctly calculates task status totals', async () => {
      const customStats = {
        byStatus: {
          pending: 10,
          queued: 5,
          planning: 3,
          'in-progress': 7,
          'waiting-approval': 2,
          paused: 4,
          completed: 50,
          failed: 8,
        },
        totalCost: 99.99,
        totalTokens: 100000,
      }

      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(customStats)

      render(<DashboardPage />)

      await waitFor(() => {
        // Pending = pending + queued = 10 + 5 = 15
        expect(screen.getByText('15')).toBeInTheDocument()

        // Active = planning + in-progress + waiting-approval = 3 + 7 + 2 = 12
        expect(screen.getByText('12')).toBeInTheDocument()

        // Paused = 4
        expect(screen.getByText('4')).toBeInTheDocument()

        // Completed = 50
        expect(screen.getByText('50')).toBeInTheDocument()

        // Failed = 8
        expect(screen.getByText('8')).toBeInTheDocument()

        // Total Cost = $99.99
        expect(screen.getByText('$99.99')).toBeInTheDocument()
      })
    })

    it('handles empty or undefined status data', async () => {
      const emptyStats = {
        byStatus: {},
        totalCost: 0,
        totalTokens: 0,
      }

      vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(emptyStats)

      render(<DashboardPage />)

      await waitFor(() => {
        // All should default to 0
        const zeroValues = screen.getAllByText('0')
        expect(zeroValues.length).toBeGreaterThanOrEqual(5) // At least 5 status cards with 0

        // Cost should be $0.00
        expect(screen.getByText('$0.00')).toBeInTheDocument()
      })
    })
  })
})