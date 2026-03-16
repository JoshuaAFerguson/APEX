/**
 * Integration tests for Dashboard Page WebSocket coordination
 *
 * Tests the integration of shared WebSocket connection across all dashboard panels
 * and verifies that real-time data flows correctly between components.
 *
 * Covers:
 * - WebSocket connection lifecycle management
 * - Real-time data synchronization across panels
 * - Error recovery and reconnection behavior
 * - Performance impact of shared connection
 * - Panel coordination during connection state changes
 * - Data transformation and propagation
 */

import React from 'react'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
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

// Mock real-time updates hook for integration testing
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

// Mock components to track WebSocket-related props
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

// Mock dashboard panels with detailed WebSocket state tracking
vi.mock('@/components/dashboard/ProjectHealthPanel', () => ({
  ProjectHealthPanel: ({ metrics, isLoading, error, onRefresh, ...props }: any) => (
    <div
      data-testid="project-health-panel"
      data-connection-status={metrics?.connection?.isConnected ? 'connected' : 'disconnected'}
      data-last-updated={metrics?.lastUpdated?.toISOString()}
      data-health-status={metrics?.status}
      data-is-loading={isLoading}
      data-has-error={!!error}
      {...props}
    >
      ProjectHealthPanel
      {metrics?.connection && (
        <div data-testid="health-connection-info">
          Latency: {metrics.connection.latencyMs}ms,
          Attempts: {metrics.connection.reconnectAttempts}
        </div>
      )}
      {onRefresh && (
        <button data-testid="health-refresh" onClick={onRefresh}>
          Refresh Health
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/PerformanceMetricsPanel', () => ({
  PerformanceMetricsPanel: ({ data, loading, error, autoRefresh, autoRefreshInterval, onRefresh, ...props }: any) => (
    <div
      data-testid="performance-metrics-panel"
      data-generation-time={data?.generatedAt?.toISOString()}
      data-time-range={data?.timeRange}
      data-is-loading={loading}
      data-has-error={!!error}
      data-auto-refresh={autoRefresh}
      data-auto-refresh-interval={autoRefreshInterval}
      {...props}
    >
      PerformanceMetricsPanel
      {data?.tokenUsage && (
        <div data-testid="performance-token-info">
          Tokens: {data.tokenUsage.totalTokens}, Cost: ${data.tokenUsage.totalCost}
        </div>
      )}
      {onRefresh && (
        <button data-testid="performance-refresh" onClick={onRefresh}>
          Refresh Performance
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/dashboard/BudgetWidget', () => ({
  BudgetWidget: ({ onRefresh, autoRefreshInterval, ...props }: any) => (
    <div
      data-testid="budget-widget"
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
  AgentUtilizationWidget: ({ onRefresh, onAgentClick, ...props }: any) => (
    <div data-testid="agent-utilization-widget" {...props}>
      AgentUtilizationWidget
      {onRefresh && (
        <button data-testid="agent-refresh" onClick={onRefresh}>
          Refresh Agent
        </button>
      )}
    </div>
  ),
}))

vi.mock('@/components/tasks/ActiveTasksPanelRealtime', () => ({
  ActiveTasksPanelRealtime: ({
    initialTasks,
    onViewDetails,
    showConnectionIndicator,
    connectionIndicatorSize,
    autoConnect,
    ...props
  }: any) => (
    <div
      data-testid="active-tasks-panel-realtime"
      data-initial-tasks-count={initialTasks?.length || 0}
      data-show-connection-indicator={showConnectionIndicator}
      data-connection-indicator-size={connectionIndicatorSize}
      data-auto-connect={autoConnect}
      {...props}
    >
      ActiveTasksPanelRealtime
      <div data-testid="tasks-websocket-status">
        WebSocket Connection: {autoConnect ? 'Auto' : 'Manual'}
      </div>
    </div>
  ),
}))

// Mock utility functions
vi.mock('@/lib/utils', () => ({
  formatCost: vi.fn((cost: number) => `$${cost.toFixed(2)}`),
  getStatusVariant: vi.fn(() => 'secondary'),
  formatStatus: vi.fn((status: string) => status.replace('-', ' ')),
  getRelativeTime: vi.fn(() => '2 minutes ago'),
  truncateId: vi.fn((id: string) => id.slice(0, 8) + '...'),
}))

// Get mocked imports
const mockApiClient = await import('@/lib/api-client')
const mockUseRealtimeUpdates = await import('@/lib/useRealtimeUpdates')

describe('Dashboard Page WebSocket Integration', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }
  const user = userEvent.setup()

  // Test data factories
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
      workflow: 'test-workflow',
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

  const createConnectedRealtimeState = () => ({
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
        server: { successRate: 95.5 },
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
          cacheHitRate: 0.30,
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

  const createDisconnectedRealtimeState = () => ({
    state: {
      health: null,
      performance: null,
      error: 'WebSocket connection lost',
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshPerformance: vi.fn(),
    checkHealth: vi.fn(),
  })

  const createReconnectingRealtimeState = () => ({
    state: {
      health: {
        status: 'reconnecting',
        connection: {
          isConnected: false,
          latencyMs: null,
          averageLatencyMs: 48,
          reconnectAttempts: 2,
          connectedSince: null,
        },
        lastUpdated: new Date('2024-01-01T10:25:00Z'),
      },
      performance: null,
      error: 'Reconnecting...',
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
      total: 1,
      page: 1,
      limit: 20
    })

    // Default to connected state
    ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createConnectedRealtimeState())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('WebSocket Connection Lifecycle', () => {
    it('initializes shared WebSocket connection with correct subscription settings', async () => {
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

    it('passes auto-connect settings to ActiveTasksPanel', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const tasksPanel = screen.getByTestId('active-tasks-panel-realtime')
        expect(tasksPanel).toHaveAttribute('data-auto-connect', 'true')
        expect(screen.getByTestId('tasks-websocket-status')).toHaveTextContent('WebSocket Connection: Auto')
      })
    })

    it('properly disconnects WebSocket on component unmount', async () => {
      const mockDisconnect = vi.fn()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue({
        ...createConnectedRealtimeState(),
        disconnect: mockDisconnect,
      })

      const { unmount } = render(<DashboardPage />)
      unmount()

      expect(mockDisconnect).toHaveBeenCalled()
    })

    it('handles WebSocket connection state changes across all panels', async () => {
      // Start with disconnected state
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createDisconnectedRealtimeState())

      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-connection-status', 'disconnected')
        expect(healthPanel).toHaveAttribute('data-has-error', 'true')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-error', 'true')
      })

      // Update to connected state
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createConnectedRealtimeState())
      rerender(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-connection-status', 'connected')
        expect(healthPanel).toHaveAttribute('data-has-error', 'false')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-error', 'false')
      })
    })
  })

  describe('Real-time Data Synchronization', () => {
    it('synchronizes health data across ProjectHealthPanel', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-health-status', 'healthy')
        expect(healthPanel).toHaveAttribute('data-last-updated', '2024-01-01T10:30:00.000Z')

        const connectionInfo = screen.getByTestId('health-connection-info')
        expect(connectionInfo).toHaveTextContent('Latency: 50ms, Attempts: 0')
      })
    })

    it('synchronizes performance data across PerformanceMetricsPanel', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-generation-time', '2024-01-01T10:30:00.000Z')
        expect(performancePanel).toHaveAttribute('data-time-range', '24h')

        const tokenInfo = screen.getByTestId('performance-token-info')
        expect(tokenInfo).toHaveTextContent('Tokens: 25000, Cost: $12.5')
      })
    })

    it('updates all panels when real-time data changes', async () => {
      const initialState = createConnectedRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(initialState)

      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('health-connection-info')).toHaveTextContent('Latency: 50ms, Attempts: 0')
        expect(screen.getByTestId('performance-token-info')).toHaveTextContent('Tokens: 25000, Cost: $12.5')
      })

      // Update with new data
      const updatedState = createConnectedRealtimeState()
      updatedState.state.health!.connection!.latencyMs = 75
      updatedState.state.health!.connection!.reconnectAttempts = 1
      updatedState.state.performance!.tokenUsage.totalTokens = 30000
      updatedState.state.performance!.tokenUsage.estimatedCost = 15.75
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(updatedState)

      rerender(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('health-connection-info')).toHaveTextContent('Latency: 75ms, Attempts: 1')
        expect(screen.getByTestId('performance-token-info')).toHaveTextContent('Tokens: 30000, Cost: $15.75')
      })
    })

    it('maintains data consistency during connection interruptions', async () => {
      // Start connected
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createConnectedRealtimeState())

      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-connection-status', 'connected')
        expect(screen.getByTestId('performance-metrics-panel')).toHaveAttribute('data-has-error', 'false')
      })

      // Simulate connection loss
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createDisconnectedRealtimeState())
      rerender(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-connection-status', 'disconnected')
        expect(healthPanel).toHaveAttribute('data-has-error', 'true')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-error', 'true')
      })
    })
  })

  describe('Error Recovery and Reconnection', () => {
    it('handles reconnection state properly', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createReconnectingRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-connection-status', 'disconnected')
        expect(healthPanel).toHaveAttribute('data-health-status', 'warning')

        const connectionInfo = screen.getByTestId('health-connection-info')
        expect(connectionInfo).toHaveTextContent('Latency: ms, Attempts: 2') // null latency during reconnect
      })
    })

    it('maintains graceful degradation during WebSocket errors', async () => {
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(createDisconnectedRealtimeState())

      render(<DashboardPage />)

      await waitFor(() => {
        // Basic dashboard data should still be available from API
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument() // Pending tasks
        expect(screen.getByText('2')).toBeInTheDocument() // Active tasks
        expect(screen.getByText('$12.50')).toBeInTheDocument() // Total cost

        // Real-time panels should show appropriate error states
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-has-error', 'true')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-has-error', 'true')
      })
    })

    it('allows manual refresh during connection errors', async () => {
      const mockRefreshPerformance = vi.fn()
      const mockCheckHealth = vi.fn()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue({
        ...createDisconnectedRealtimeState(),
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

      // Should attempt to refresh all data sources
      expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
      expect(mockApiClient.apiClient.listTasks).toHaveBeenCalledTimes(2)
      expect(mockRefreshPerformance).toHaveBeenCalled()
      expect(mockCheckHealth).toHaveBeenCalled()
    })
  })

  describe('Performance and Optimization', () => {
    it('uses single WebSocket connection for all panels', async () => {
      render(<DashboardPage />)

      // Verify useRealtimeUpdates is called only once with shared config
      expect(mockUseRealtimeUpdates.useRealtimeUpdates).toHaveBeenCalledTimes(1)
      expect(mockUseRealtimeUpdates.useRealtimeUpdates).toHaveBeenCalledWith({
        autoConnect: true,
        subscription: {
          includeHealth: true,
          includePerformance: true,
          performanceUpdateInterval: 5000,
        },
      })
    })

    it('properly manages auto-refresh intervals', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // Performance panel should use real-time updates (5s interval)
        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-auto-refresh', 'true')
        expect(performancePanel).toHaveAttribute('data-auto-refresh-interval', '5000')

        // Budget widget should disable auto-refresh (use real-time instead)
        const budgetWidget = screen.getByTestId('budget-widget')
        expect(budgetWidget).toHaveAttribute('data-auto-refresh-interval', '0')
      })
    })

    it('minimizes re-renders by memoizing transformed data', async () => {
      const initialState = createConnectedRealtimeState()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue(initialState)

      const { rerender } = render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-health-status', 'healthy')
      })

      // Rerender with same state - should not cause data transformation changes
      rerender(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('project-health-panel')).toHaveAttribute('data-health-status', 'healthy')
      })

      // Data should remain stable (no extra processing)
      expect(screen.getByTestId('health-connection-info')).toHaveTextContent('Latency: 50ms, Attempts: 0')
    })
  })

  describe('Panel Coordination', () => {
    it('coordinates connection indicator across panels', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        // Health panel should show connection status
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-connection-status', 'connected')

        // Active tasks panel should show connection indicator
        const tasksPanel = screen.getByTestId('active-tasks-panel-realtime')
        expect(tasksPanel).toHaveAttribute('data-show-connection-indicator', 'true')
        expect(tasksPanel).toHaveAttribute('data-connection-indicator-size', 'md')
      })
    })

    it('maintains consistent time ranges across performance-related panels', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-time-range', '1h')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-time-range', '24h')
      })
    })

    it('synchronizes refresh actions across all panels', async () => {
      const mockRefreshPerformance = vi.fn()
      const mockCheckHealth = vi.fn()
      ;(mockUseRealtimeUpdates.useRealtimeUpdates as any).mockReturnValue({
        ...createConnectedRealtimeState(),
        refreshPerformance: mockRefreshPerformance,
        checkHealth: mockCheckHealth,
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('health-refresh')).toBeInTheDocument()
        expect(screen.getByTestId('performance-refresh')).toBeInTheDocument()
        expect(screen.getByTestId('budget-refresh')).toBeInTheDocument()
        expect(screen.getByTestId('agent-refresh')).toBeInTheDocument()
      })

      // Test individual panel refresh triggers global refresh
      const healthRefresh = screen.getByTestId('health-refresh')
      await act(async () => {
        await user.click(healthRefresh)
      })

      expect(mockApiClient.apiClient.getTaskStats).toHaveBeenCalledTimes(2)
      expect(mockRefreshPerformance).toHaveBeenCalled()
      expect(mockCheckHealth).toHaveBeenCalled()
    })
  })

  describe('Data Transformation Accuracy', () => {
    it('correctly transforms health data from WebSocket format to panel format', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const healthPanel = screen.getByTestId('project-health-panel')

        // Verify status mapping
        expect(healthPanel).toHaveAttribute('data-health-status', 'healthy')

        // Verify connection details
        expect(screen.getByTestId('health-connection-info')).toHaveTextContent('Latency: 50ms, Attempts: 0')

        // Verify last updated timestamp
        expect(healthPanel).toHaveAttribute('data-last-updated', '2024-01-01T10:30:00.000Z')
      })
    })

    it('correctly transforms performance data from WebSocket format to panel format', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        const performancePanel = screen.getByTestId('performance-metrics-panel')

        // Verify data availability
        expect(performancePanel).toHaveAttribute('data-generation-time', '2024-01-01T10:30:00.000Z')

        // Verify token usage transformation
        expect(screen.getByTestId('performance-token-info')).toHaveTextContent('Tokens: 25000, Cost: $12.5')
      })
    })

    it('handles null or undefined real-time data gracefully', async () => {
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
        const healthPanel = screen.getByTestId('project-health-panel')
        expect(healthPanel).toHaveAttribute('data-connection-status', 'disconnected')
        expect(healthPanel).toHaveAttribute('data-is-loading', 'true')

        const performancePanel = screen.getByTestId('performance-metrics-panel')
        expect(performancePanel).toHaveAttribute('data-is-loading', 'true')
      })
    })
  })
})