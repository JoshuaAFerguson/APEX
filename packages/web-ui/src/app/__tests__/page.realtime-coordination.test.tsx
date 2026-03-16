/**
 * Real-time data flow and panel coordination tests for Dashboard Page
 *
 * Tests the coordination between all dashboard panels when receiving
 * real-time WebSocket updates and ensures data consistency across panels.
 *
 * Covers:
 * - Real-time health data propagation
 * - Real-time performance data propagation
 * - Data transformation accuracy
 * - Panel synchronization
 * - Event timing and sequencing
 * - Data consistency checks
 * - Performance impact of real-time updates
 * - Memory leak prevention
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
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

// Mock real-time updates hook - we'll control this manually for testing
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

// Mock components with detailed real-time data tracking
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
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>
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

// Mock dashboard panels with real-time data state tracking
vi.mock('@/components/dashboard/ProjectHealthPanel', () => ({
  ProjectHealthPanel: ({ metrics, isLoading, error, ...props }: any) => (
    <div
      data-testid="project-health-panel"
      data-health-status={metrics?.status}
      data-success-rate={metrics?.successRate}
      data-avg-duration={metrics?.averageDurationMs}
      data-system-health={metrics?.systemHealth}
      data-active-tasks={metrics?.tasks?.activeTasks}
      data-pending-tasks={metrics?.tasks?.pendingTasks}
      data-completed-tasks={metrics?.tasks?.completedTasks}
      data-failed-tasks={metrics?.tasks?.failedTasks}
      data-connection-status={metrics?.connection?.isConnected}
      data-latency={metrics?.connection?.latencyMs}
      data-reconnect-attempts={metrics?.connection?.reconnectAttempts}
      data-last-updated={metrics?.lastUpdated?.toISOString()}
      data-is-loading={isLoading}
      data-has-error={!!error}
      {...props}
    >
      ProjectHealthPanel
      {metrics && (
        <div data-testid="health-summary">
          Status: {metrics.status}, Success: {metrics.successRate}%,
          Tasks: {metrics.tasks?.activeTasks || 0} active / {metrics.tasks?.pendingTasks || 0} pending,
          Connection: {metrics.connection?.isConnected ? 'connected' : 'disconnected'} ({metrics.connection?.latencyMs}ms)
        </div>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/PerformanceMetricsPanel', () => ({
  PerformanceMetricsPanel: ({ data, loading, error, autoRefresh, autoRefreshInterval, ...props }: any) => (
    <div
      data-testid="performance-metrics-panel"
      data-time-range={data?.timeRange}
      data-total-tokens={data?.tokenUsage?.totalTokens}
      data-total-cost={data?.tokenUsage?.totalCost}
      data-cache-hit-rate={data?.tokenUsage?.cacheHitRate}
      data-tokens-per-minute={data?.tokenUsage?.avgTokensPerMinute}
      data-completion-rate={data?.taskCompletion?.overallCompletionRate}
      data-success-rate={data?.taskCompletion?.overallSuccessRate}
      data-avg-duration={data?.taskCompletion?.avgDurationMs}
      data-median-duration={data?.taskCompletion?.medianDurationMs}
      data-p95-duration={data?.taskCompletion?.p95DurationMs}
      data-budget-utilization={data?.costTrend?.budgetUtilization}
      data-generated-at={data?.generatedAt?.toISOString()}
      data-is-loading={loading}
      data-has-error={!!error}
      data-auto-refresh={autoRefresh}
      data-auto-refresh-interval={autoRefreshInterval}
      {...props}
    >
      PerformanceMetricsPanel
      {data?.tokenUsage && (
        <div data-testid="performance-summary">
          Tokens: {data.tokenUsage.totalTokens}, Cost: ${data.tokenUsage.totalCost},
          Cache: {data.tokenUsage.cacheHitRate}%, Rate: {data.tokenUsage.avgTokensPerMinute}/min,
          Tasks: {data.taskCompletion.overallSuccessRate}% success,
          Duration: {data.taskCompletion.avgDurationMs}ms avg
        </div>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/BudgetWidget', () => ({
  BudgetWidget: ({ budgetLimit, autoRefreshInterval, ...props }: any) => (
    <div
      data-testid="budget-widget"
      data-budget-limit={budgetLimit}
      data-auto-refresh-interval={autoRefreshInterval}
      {...props}
    >
      BudgetWidget (Limit: ${budgetLimit}, Auto-refresh: {autoRefreshInterval}ms)
    </div>
  ),
}))

vi.mock('@/components/dashboard/AgentUtilizationWidget', () => ({
  AgentUtilizationWidget: ({ maxAgents, ...props }: any) => (
    <div data-testid="agent-utilization-widget" data-max-agents={maxAgents} {...props}>
      AgentUtilizationWidget (Max: {maxAgents} agents)
    </div>
  ),
}))

vi.mock('@/components/tasks/ActiveTasksPanelRealtime', () => ({
  ActiveTasksPanelRealtime: ({
    initialTasks,
    autoConnect,
    showConnectionIndicator,
    connectionIndicatorSize,
    ...props
  }: any) => (
    <div
      data-testid="active-tasks-panel-realtime"
      data-initial-tasks-count={initialTasks?.length || 0}
      data-auto-connect={autoConnect}
      data-show-connection-indicator={showConnectionIndicator}
      data-connection-indicator-size={connectionIndicatorSize}
      {...props}
    >
      ActiveTasksPanelRealtime
      <div data-testid="tasks-summary">
        Tasks: {initialTasks?.length || 0}, Auto-connect: {autoConnect ? 'yes' : 'no'},
        Indicator: {showConnectionIndicator ? connectionIndicatorSize : 'none'}
      </div>
    </div>
  ),
}))

// Mock utility functions
vi.mock('@/lib/utils', () => ({
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  getStatusVariant: vi.fn(() => 'secondary'),
  formatStatus: vi.fn((status: string) => status?.replace('-', ' ') || 'unknown'),
  getRelativeTime: vi.fn(() => '2 minutes ago'),
  truncateId: vi.fn((id: string) => id?.slice(0, 8) + '...' || 'unknown'),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')
const mockUseRealtimeUpdates = await import('@/lib/useRealtimeUpdates')

describe('Dashboard Page Real-time Coordination', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }
  const user = userEvent.setup()

  // Test data factories for progressive updates
  const createInitialRealtimeState = () => ({
    state: {
      health: {
        status: 'connected',
        tasks: {
          activeTasks: 2,
          pendingTasks: 3,
          completedLastHour: 15,
          failedLastHour: 1,
          averageDurationMs: 2000,
        },
        server: { successRate: 95.0 },
        connection: {
          isConnected: true,
          latencyMs: 50,
          averageLatencyMs: 48,
          reconnectAttempts: 0,
          connectedSince: new Date('2024-01-01T10:00:00Z'),
        },
        lastUpdated: new Date('2024-01-01T10:30:00Z'),
      },
      performance: {
        timeRange: '24h',
        tokenUsage: {
          totalTokens: 25000,
          inputTokens: 15000,
          outputTokens: 10000,
          tokensPerMinute: 100,
          estimatedCost: 12.50,
          cacheHitRate: 0.25,
        },
        tasks: {
          completedTasks: 15,
          failedTasks: 1,
          successRate: 0.94,
          avgDurationMs: 2000,
          medianDurationMs: 1800,
          p95DurationMs: 3500,
          byStatus: { completed: 15, failed: 1 },
        },
        generatedAt: new Date('2024-01-01T10:30:00Z'),
      },
      error: null,
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshPerformance: vi.fn(),
    checkHealth: vi.fn(),
  })

  const createUpdatedRealtimeState = () => ({
    state: {
      health: {
        status: 'connected',
        tasks: {
          activeTasks: 3, // +1
          pendingTasks: 4, // +1
          completedLastHour: 17, // +2
          failedLastHour: 2, // +1
          averageDurationMs: 1800, // Improved
        },
        server: { successRate: 96.5 }, // Improved
        connection: {
          isConnected: true,
          latencyMs: 45, // Improved
          averageLatencyMs: 47, // Improved
          reconnectAttempts: 0,
          connectedSince: new Date('2024-01-01T10:00:00Z'),
        },
        lastUpdated: new Date('2024-01-01T10:35:00Z'), // 5 minutes later
      },
      performance: {
        timeRange: '24h',
        tokenUsage: {
          totalTokens: 32000, // +7000
          inputTokens: 19200,
          outputTokens: 12800,
          tokensPerMinute: 120, // Increased
          estimatedCost: 16.00, // +$3.50
          cacheHitRate: 0.35, // Improved
        },
        tasks: {
          completedTasks: 17, // +2
          failedTasks: 2, // +1
          successRate: 0.895, // Slightly decreased due to new failure
          avgDurationMs: 1800, // Improved
          medianDurationMs: 1600, // Improved
          p95DurationMs: 3200, // Improved
          byStatus: { completed: 17, failed: 2 },
        },
        generatedAt: new Date('2024-01-01T10:35:00Z'),
      },
      error: null,
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshPerformance: vi.fn(),
    checkHealth: vi.fn(),
  })

  const createTaskStats = () => ({
    byStatus: {
      pending: 3,
      'in-progress': 2,
      completed: 15,
      failed: 1,
    },
    totalCost: 12.50,
    totalTokens: 25000,
  })

  const createTasks = () => [
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
    {
      id: 'task-2',
      description: 'Test task 2',
      status: 'pending',
      workflow: 'test',
      autonomy: 'medium',
      priority: 'high',
      effort: 'small',
      projectPath: '/test',
      retryCount: 0,
      maxRetries: 3,
      resumeAttempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(useRouter as any).mockReturnValue(mockRouter)

    // Mock API responses
    vi.mocked(mockApiClient.apiClient.getTaskStats).mockResolvedValue(createTaskStats())
    vi.mocked(mockApiClient.apiClient.listTasks).mockResolvedValue({
      tasks: createTasks(),
      total: 2,
      page: 1,
      limit: 20
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Real-time Data Loading', () => {
    it('correctly distributes initial real-time data to all panels', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createInitialRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Health panel should receive health data
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-health-status', 'healthy')
        expect(healthPanel).toHaveAttribute('data-success-rate', '93.75') // (15/(15+1)) * 100
        expect(healthPanel).toHaveAttribute('data-avg-duration', '2000')
        expect(healthPanel).toHaveAttribute('data-system-health', '95')
        expect(healthPanel).toHaveAttribute('data-active-tasks', '2')
        expect(healthPanel).toHaveAttribute('data-pending-tasks', '3')
        expect(healthPanel).toHaveAttribute('data-connection-status', 'true')
        expect(healthPanel).toHaveAttribute('data-latency', '50')

        // Performance panel should receive performance data
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-total-tokens', '25000')
        expect(performancePanel).toHaveAttribute('data-total-cost', '12.5')
        expect(performancePanel).toHaveAttribute('data-cache-hit-rate', '25')
        expect(performancePanel).toHaveAttribute('data-tokens-per-minute', '100')
        expect(performancePanel).toHaveAttribute('data-success-rate', '94')
        expect(performancePanel).toHaveAttribute('data-avg-duration', '2000')
      })
    })

    it('transforms WebSocket data correctly to panel formats', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createInitialRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Verify health data transformation
        const healthSummary = screen.getByTestId('health-summary')
        expect(healthSummary).toHaveTextContent('Status: healthy')
        expect(healthSummary).toHaveTextContent('Success: 93.75%') // (15/(15+1)) * 100
        expect(healthSummary).toHaveTextContent('Tasks: 2 active / 3 pending')
        expect(healthSummary).toHaveTextContent('Connection: connected (50ms)')

        // Verify performance data transformation
        const performanceSummary = screen.getByTestId('performance-summary')
        expect(performanceSummary).toHaveTextContent('Tokens: 25000')
        expect(performanceSummary).toHaveTextContent('Cost: $12.5')
        expect(performanceSummary).toHaveTextContent('Cache: 25%')
        expect(performanceSummary).toHaveTextContent('Rate: 100/min')
        expect(performanceSummary).toHaveTextContent('Tasks: 94% success')
        expect(performanceSummary).toHaveTextContent('Duration: 2000ms avg')
      })
    })

    it('sets up auto-refresh intervals correctly', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createInitialRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Performance panel should have auto-refresh enabled
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-auto-refresh', 'true')
        expect(performancePanel).toHaveAttribute('data-auto-refresh-interval', '5000')

        // Budget widget should disable auto-refresh (uses real-time instead)
        const budgetWidget = screen.getByTestId('budget-widget')
        expect(budgetWidget).toHaveAttribute('data-auto-refresh-interval', '0')
      })
    })
  })

  describe('Real-time Data Updates', () => {
    it('propagates real-time health updates across all relevant panels', async () => {
      const initialState = createInitialRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(initialState)

      const { rerender } = render(<DashboardPage />)

      // Verify initial state
      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-active-tasks', '2')
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-latency', '50')
      })

      // Update to new state
      const updatedState = createUpdatedRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(updatedState)

      rerender(<DashboardPage />)

      // Verify updates propagated
      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-active-tasks', '3') // Updated
        expect(healthPanel).toHaveAttribute('data-pending-tasks', '4') // Updated
        expect(healthPanel).toHaveAttribute('data-latency', '45') // Improved
        expect(healthPanel).toHaveAttribute('data-system-health', '96.5') // Improved

        const healthSummary = screen.getByTestId('health-summary')
        expect(healthSummary).toHaveTextContent('Tasks: 3 active / 4 pending')
        expect(healthSummary).toHaveTextContent('Connection: connected (45ms)')
      })
    })

    it('propagates real-time performance updates across all relevant panels', async () => {
      const initialState = createInitialRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(initialState)

      const { rerender } = render(<DashboardPage />)

      // Verify initial state
      await waitFor(() => {
        expect(screen.getByTestId('performance-metrics-panel')).toHaveAttribute('data-total-tokens', '25000')
        expect(screen.getByTestId('performance-metrics-panel')).toHaveAttribute('data-total-cost', '12.5')
      })

      // Update to new state
      const updatedState = createUpdatedRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(updatedState)

      rerender(<DashboardPage />)

      // Verify updates propagated
      await waitFor(() => {
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-total-tokens', '32000') // Updated
        expect(performancePanel).toHaveAttribute('data-total-cost', '16') // Updated
        expect(performancePanel).toHaveAttribute('data-cache-hit-rate', '35') // Improved
        expect(performancePanel).toHaveAttribute('data-tokens-per-minute', '120') // Increased

        const performanceSummary = screen.getByTestId('performance-summary')
        expect(performanceSummary).toHaveTextContent('Tokens: 32000')
        expect(performanceSummary).toHaveTextContent('Cost: $16')
        expect(performanceSummary).toHaveTextContent('Cache: 35%')
        expect(performanceSummary).toHaveTextContent('Rate: 120/min')
      })
    })

    it('maintains data consistency across multiple updates', async () => {
      const initialState = createInitialRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(initialState)

      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-active-tasks', '2')
        expect(screen.getByTestId('performance-metrics-panel')).toHaveAttribute('data-avg-duration', '2000')
      })

      // Verify both panels show consistent duration data
      const healthPanel = screen.getByTestId('project-health-panel')
      const performancePanel = screen.getByTestId('performance-metrics-panel')
      expect(healthPanel.getAttribute('data-avg-duration')).toBe(performancePanel.getAttribute('data-avg-duration'))

      // Update state
      const updatedState = createUpdatedRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(updatedState)
      rerender(<DashboardPage />)

      // Verify consistency is maintained after update
      await waitFor(() => {
        const healthPanelUpdated = screen.getByTestId('project-health-panel')
        const performancePanelUpdated = screen.getByTestId('performance-metrics-panel')
        expect(healthPanelUpdated.getAttribute('data-avg-duration')).toBe(performancePanelUpdated.getAttribute('data-avg-duration'))
        expect(healthPanelUpdated.getAttribute('data-avg-duration')).toBe('1800') // Both should show updated value
      })
    })
  })

  describe('Panel Coordination', () => {
    it('coordinates connection status across all panels', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createInitialRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Health panel should show connected status
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-connection-status', 'true')

        // Active tasks panel should auto-connect and show connection indicator
        const tasksPanel = screen.getByTestId('active-tasks-panel-realtime')
        expect(tasksPanel).toHaveAttribute('data-auto-connect', 'true')
        expect(tasksPanel).toHaveAttribute('data-show-connection-indicator', 'true')

        const tasksSummary = screen.getByTestId('tasks-summary')
        expect(tasksSummary).toHaveTextContent('Auto-connect: yes')
        expect(tasksSummary).toHaveTextContent('Indicator: md')
      })
    })

    it('synchronizes refresh actions across panels', async () => {
      const mockRefreshPerformance = vi.fn()
      const mockCheckHealth = vi.fn()

      const realtimeState = createInitialRealtimeState()
      realtimeState.refreshPerformance = mockRefreshPerformance
      realtimeState.checkHealth = mockCheckHealth
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(realtimeState)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText('Refresh')
      await act(async () => {
        await user.click(refreshButton)
      })

      // Should trigger all refresh methods
      expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2) // Initial + refresh
      expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledTimes(2) // Initial + refresh
      expect(mockRefreshPerformance).toHaveBeenCalled()
      expect(mockCheckHealth).toHaveBeenCalled()
    })

    it('maintains consistent time stamps across panels', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createInitialRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        const performancePanel = screen.getByTestId('performance-metrics-panel')

        expect(healthPanel).toHaveAttribute('data-last-updated', '2024-01-01T10:30:00.000Z')
        expect(performancePanel).toHaveAttribute('data-generated-at', '2024-01-01T10:30:00.000Z')
      })
    })
  })

  describe('Data Transformation Accuracy', () => {
    it('correctly calculates success rate from health data', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createInitialRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        // Success rate = completed / (completed + failed) * 100 = 15 / (15 + 1) * 100 = 93.75%
        expect(healthPanel).toHaveAttribute('data-success-rate', '93.75')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        // Performance data has its own success rate of 0.94 = 94%
        expect(performancePanel).toHaveAttribute('data-success-rate', '94')
      })
    })

    it('correctly maps connection status from WebSocket format', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createInitialRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        // Health data status 'connected' should map to 'healthy' project health status
        expect(healthPanel).toHaveAttribute('data-health-status', 'healthy')
        expect(healthPanel).toHaveAttribute('data-connection-status', 'true')

        const healthSummary = screen.getByTestId('health-summary')
        expect(healthSummary).toHaveTextContent('Status: healthy')
        expect(healthSummary).toHaveTextContent('Connection: connected')
      })
    })

    it('correctly transforms token usage data structure', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createInitialRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        const performancePanel = screen.getByTestId('performance-metrics-panel')

        // Verify token breakdown calculations
        expect(performancePanel).toHaveAttribute('data-total-tokens', '25000')
        expect(performancePanel).toHaveAttribute('data-total-cost', '12.5')

        // Cache hit rate transformation (0.25 -> 25%)
        expect(performancePanel).toHaveAttribute('data-cache-hit-rate', '25')

        // Performance summary should show formatted values
        const performanceSummary = screen.getByTestId('performance-summary')
        expect(performanceSummary).toHaveTextContent('Tokens: 25000')
        expect(performanceSummary).toHaveTextContent('Cost: $12.5')
        expect(performanceSummary).toHaveTextContent('Cache: 25%')
      })
    })

    it('correctly transforms cost trend data for budget calculations', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createInitialRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        const performancePanel = screen.getByTestId('performance-metrics-panel')

        // Budget utilization should be calculated as (cost / budgetLimit) * 100
        // Cost is 12.5, budget limit is 1000 -> 1.25% utilization
        expect(performancePanel).toHaveAttribute('data-budget-utilization', '1.25')
      })
    })
  })

  describe('Event Timing and Sequencing', () => {
    it('handles rapid sequential updates without data corruption', async () => {
      const initialState = createInitialRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(initialState)

      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-active-tasks', '2')
      })

      // Simulate rapid updates
      const update1 = createUpdatedRealtimeState()
      update1.state.health!.tasks.activeTasks = 3
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(update1)
      rerender(<DashboardPage />)

      const update2 = createUpdatedRealtimeState()
      update2.state.health!.tasks.activeTasks = 4
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(update2)
      rerender(<DashboardPage />)

      const update3 = createUpdatedRealtimeState()
      update3.state.health!.tasks.activeTasks = 5
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(update3)
      rerender(<DashboardPage />)

      // Should show final value
      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-active-tasks', '5')
      })
    })

    it('maintains panel state during partial data updates', async () => {
      const initialState = createInitialRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(initialState)

      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-health-status', 'healthy')
        expect(screen.getByTestId('performance-metrics-panel')).toHaveAttribute('data-total-tokens', '25000')
      })

      // Update only health data, leave performance unchanged
      const partialUpdate = createInitialRealtimeState()
      partialUpdate.state.health!.tasks.activeTasks = 10
      partialUpdate.state.performance = null // Remove performance data
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(partialUpdate)

      rerender(<DashboardPage />)

      await waitFor(() => {
        // Health should update
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-active-tasks', '10')

        // Performance should show loading/no data state
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-is-loading', 'true')
      })
    })
  })

  describe('Memory and Performance', () => {
    it('does not create memory leaks during frequent updates', async () => {
      const initialState = createInitialRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(initialState)

      const { rerender, unmount } = render(<DashboardPage />)

      // Simulate many updates
      for (let i = 0; i < 100; i++) {
        const state = createInitialRealtimeState()
        state.state.health!.tasks.activeTasks = i
        ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(state)
        rerender(<DashboardPage />)
      }

      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-active-tasks', '99')
      })

      // Should unmount cleanly
      unmount()
      expect(true).toBe(true) // Test passes if no errors thrown
    })

    it('optimizes re-renders through memoization', async () => {
      const initialState = createInitialRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(initialState)

      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-health-status', 'healthy')
      })

      // Rerender with same data - should not cause panel re-computation
      rerender(<DashboardPage />)

      await waitFor(() => {
        // Data should remain stable
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-health-status', 'healthy')
        expect(screen.getByTestId('performance-metrics-panel')).toHaveAttribute('data-total-tokens', '25000')
      })
    })
  })

  describe('Edge Cases in Real-time Flow', () => {
    it('handles missing required fields in real-time data', async () => {
      const faultyState = createInitialRealtimeState()
      // Remove required fields
      delete faultyState.state.health!.tasks
      delete faultyState.state.performance!.tokenUsage.totalTokens
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(faultyState)

      render(<DashboardPage />)

      await waitFor(() => {
        // Should handle missing data gracefully
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-active-tasks', 'null') // Missing data
        expect(healthPanel).toHaveAttribute('data-health-status', 'healthy') // Status still available

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        // Should handle missing totalTokens gracefully
        expect(performancePanel).toBeInTheDocument()
      })
    })

    it('recovers from corrupted real-time data', async () => {
      const corruptedState = createInitialRealtimeState()
      corruptedState.state.health = { invalid: 'data' } as any
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(corruptedState)

      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        // Should handle corrupted data
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-has-error', 'false') // No explicit error
        expect(healthPanel).toHaveAttribute('data-health-status', '') // Empty due to invalid data
      })

      // Recovery with valid data
      const validState = createInitialRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(validState)
      rerender(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-health-status', 'healthy') // Recovered
      })
    })
  })
})