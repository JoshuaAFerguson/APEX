/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PerformanceMetricsPanel } from '../PerformanceMetricsPanel'
import type {
  AggregatedPerformanceMetrics,
  PerformanceMetricsTimeRange,
  PerformanceMetricsPanelProps,
} from '@/types/performance-metrics'
import {
  EMPTY_AGGREGATED_METRICS,
  DEFAULT_PERFORMANCE_TIME_RANGE,
  TIME_RANGE_CONFIGS,
} from '@/types/performance-metrics'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock chart components
vi.mock('@/components/charts/TokenUsageOverTimeChart', () => ({
  TokenUsageOverTimeChart: ({ data, variant, height, animated, colors, ...props }: any) => (
    <div
      data-testid="token-usage-chart"
      data-variant={variant}
      data-height={height}
      data-animated={animated}
      data-color-scheme={colors ? JSON.stringify(colors) : undefined}
      {...props}
    >
      Token Usage Chart - Data points: {data?.data?.length || 0}
    </div>
  ),
}))

vi.mock('@/components/charts/TaskCompletionRateChart', () => ({
  TaskCompletionRateChart: ({ data, variant, height, animated, colors, ...props }: any) => (
    <div
      data-testid="task-completion-chart"
      data-variant={variant}
      data-height={height}
      data-animated={animated}
      data-color-scheme={colors ? JSON.stringify(colors) : undefined}
      {...props}
    >
      Task Completion Chart - Data points: {data?.data?.length || 0}
    </div>
  ),
}))

vi.mock('@/components/charts/CostTrendChart', () => ({
  CostTrendChart: ({ data, variant, height, animated, colors, ...props }: any) => (
    <div
      data-testid="cost-trend-chart"
      data-variant={variant}
      data-height={height}
      data-animated={animated}
      data-color-scheme={colors ? JSON.stringify(colors) : undefined}
      {...props}
    >
      Cost Trend Chart - Data points: {data?.data?.length || 0}
    </div>
  ),
}))

// Mock UI components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="card-content" {...props}>
      {children}
    </div>
  ),
  CardFooter: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="card-footer" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/Select', () => ({
  Select: ({ options, value, onChange, disabled, className, ...props }: any) => (
    <select
      data-testid="time-range-selector"
      className={className}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      {...props}
    >
      {options?.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ size = 'md', ...props }: any) => (
    <div data-testid="spinner" data-size={size} {...props}>
      Loading...
    </div>
  ),
}))

// Mock utilities
vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
  getRelativeTime: (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins === 1) return '1 minute ago'
    return `${diffMins} minutes ago`
  },
}))

// Helper function to create mock performance metrics data
function createMockPerformanceMetrics(
  override: Partial<AggregatedPerformanceMetrics> = {}
): AggregatedPerformanceMetrics {
  const baseTime = new Date('2024-01-01T12:00:00Z')

  const tokenDataPoints = Array.from({ length: 5 }, (_, i) => ({
    timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000),
    totalTokens: 1000 + i * 100,
    breakdown: {
      inputTokens: 600 + i * 60,
      outputTokens: 400 + i * 40,
      cacheCreationTokens: i > 2 ? 50 : undefined,
      cacheReadTokens: i > 2 ? 20 : undefined,
    },
    tokensPerMinute: 50 + i * 5,
    cost: 0.01 + i * 0.005,
  }))

  const taskDataPoints = Array.from({ length: 5 }, (_, i) => ({
    timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000),
    completionRate: 85 + i * 2,
    successRate: 90 + i * 1,
    completedCount: 10 + i * 2,
    failedCount: 1 + i,
    totalProcessed: 12 + i * 3,
    avgDurationMs: 2000 + i * 200,
  }))

  const costDataPoints = Array.from({ length: 5 }, (_, i) => ({
    timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000),
    cost: 0.05 + i * 0.01,
    cumulativeCost: 0.05 * (i + 1) + 0.01 * i * (i + 1) / 2,
    breakdown: {
      inputTokenCost: 0.03 + i * 0.005,
      outputTokenCost: 0.02 + i * 0.005,
      cacheCreationCost: 0,
      cacheReadCost: 0,
      otherCost: 0,
    },
    projectedCost: 0.1 + i * 0.02,
  }))

  return {
    tokenUsage: {
      data: tokenDataPoints,
      totalInputTokens: 3300,
      totalOutputTokens: 2200,
      totalTokens: 5500,
      totalCacheCreationTokens: 100,
      totalCacheReadTokens: 40,
      cacheHitRate: 15.5,
      avgTokensPerMinute: 65.2,
      peakTokensPerMinute: 75,
      totalCost: 0.055,
      timeRange: '24h',
      generatedAt: new Date(),
      trend: 1,
      changePercent: 12.5,
    },
    taskCompletion: {
      data: taskDataPoints,
      overallCompletionRate: 88.5,
      overallSuccessRate: 92.2,
      totalCompleted: 60,
      totalFailed: 8,
      totalProcessed: 68,
      statusCounts: {
        completed: 60,
        failed: 8,
        inProgress: 3,
        pending: 2,
        cancelled: 1,
        paused: 0,
      },
      byStatus: {
        completed: 60,
        failed: 8,
      },
      avgDurationMs: 2400,
      medianDurationMs: 2200,
      p95DurationMs: 3800,
      timeRange: '24h',
      generatedAt: new Date(),
      trend: 1,
      changePercent: 8.2,
    },
    costTrend: {
      data: costDataPoints,
      totalCost: 0.25,
      avgCostPerHour: 0.05,
      avgCostPerTask: 0.004,
      peakHourlyCost: 0.08,
      breakdown: {
        inputTokenCost: 0.15,
        outputTokenCost: 0.10,
        cacheCreationCost: 0,
        cacheReadCost: 0,
        otherCost: 0,
      },
      budgetLimit: 10,
      budgetUtilization: 2.5,
      projectedRemainingCost: 0.5,
      projectedTotalCost: 0.75,
      cacheSavings: 0.02,
      timeRange: '24h',
      generatedAt: new Date(),
      trend: 1,
      changePercent: 25.0,
    },
    timeRange: '24h',
    generatedAt: new Date(),
    ...override,
  }
}

// Helper function to render PerformanceMetricsPanel with default props
const renderPerformanceMetricsPanel = (
  props: Partial<PerformanceMetricsPanelProps> = {}
) => {
  const defaultProps: PerformanceMetricsPanelProps = {
    data: createMockPerformanceMetrics(),
    timeRange: '24h',
    ...props,
  }

  return render(<PerformanceMetricsPanel {...defaultProps} />)
}

describe('PerformanceMetricsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering', () => {
    it('renders with mock data', () => {
      renderPerformanceMetricsPanel()

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.getByTestId('task-completion-chart')).toBeInTheDocument()
      expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      renderPerformanceMetricsPanel({ className: 'custom-class' })

      const card = screen.getByTestId('card')
      expect(card).toHaveClass('custom-class')
    })

    it('renders time range selector by default', () => {
      renderPerformanceMetricsPanel()

      const selector = screen.getByTestId('time-range-selector')
      expect(selector).toBeInTheDocument()
      expect(selector).toHaveValue('24h')
    })

    it('hides time range selector when showTimeRangeSelector is false', () => {
      renderPerformanceMetricsPanel({ showTimeRangeSelector: false })

      expect(screen.queryByTestId('time-range-selector')).not.toBeInTheDocument()
    })

    it('renders all three charts by default', () => {
      renderPerformanceMetricsPanel()

      expect(screen.getByText('Token Usage Over Time')).toBeInTheDocument()
      expect(screen.getByText('Task Completion Rate')).toBeInTheDocument()
      expect(screen.getByText('Cost Trend')).toBeInTheDocument()
    })

    it('hides token usage chart when showTokenUsage is false', () => {
      renderPerformanceMetricsPanel({ showTokenUsage: false })

      expect(screen.queryByText('Token Usage Over Time')).not.toBeInTheDocument()
      expect(screen.queryByTestId('token-usage-chart')).not.toBeInTheDocument()
    })

    it('hides task completion chart when showTaskCompletion is false', () => {
      renderPerformanceMetricsPanel({ showTaskCompletion: false })

      expect(screen.queryByText('Task Completion Rate')).not.toBeInTheDocument()
      expect(screen.queryByTestId('task-completion-chart')).not.toBeInTheDocument()
    })

    it('hides cost trend chart when showCostTrend is false', () => {
      renderPerformanceMetricsPanel({ showCostTrend: false })

      expect(screen.queryByText('Cost Trend')).not.toBeInTheDocument()
      expect(screen.queryByTestId('cost-trend-chart')).not.toBeInTheDocument()
    })

    it('applies responsive grid classes based on visible chart count', () => {
      const { rerender } = render(
        <PerformanceMetricsPanel
          data={createMockPerformanceMetrics()}
          showTokenUsage={true}
          showTaskCompletion={false}
          showCostTrend={false}
        />
      )

      // With 1 chart, should use single column grid
      let gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1')

      // With 2 charts
      rerender(
        <PerformanceMetricsPanel
          data={createMockPerformanceMetrics()}
          showTokenUsage={true}
          showTaskCompletion={true}
          showCostTrend={false}
        />
      )

      gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2')

      // With 3 charts
      rerender(
        <PerformanceMetricsPanel
          data={createMockPerformanceMetrics()}
          showTokenUsage={true}
          showTaskCompletion={true}
          showCostTrend={true}
        />
      )

      gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
    })
  })

  describe('Loading States', () => {
    it('renders loading state when loading is true and no data', () => {
      renderPerformanceMetricsPanel({ loading: true, data: undefined })

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByText('Loading performance metrics...')).toBeInTheDocument()
      expect(screen.queryByText('Performance Metrics')).not.toBeInTheDocument()
    })

    it('renders loading overlay when loading is true and data exists', () => {
      renderPerformanceMetricsPanel({ loading: true })

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
      expect(screen.getByText('Updating...')).toBeInTheDocument()
    })

    it('applies pulse animation to card when loading', () => {
      renderPerformanceMetricsPanel({ loading: true, data: undefined })

      const card = screen.getByTestId('card')
      expect(card).toHaveClass('animate-pulse')
    })
  })

  describe('Empty States', () => {
    it('renders empty state when no data is provided', () => {
      renderPerformanceMetricsPanel({ data: undefined })

      expect(screen.getByText('No performance data available')).toBeInTheDocument()
      expect(screen.queryByTestId('token-usage-chart')).not.toBeInTheDocument()
    })

    it('renders empty state when data arrays are empty', () => {
      const emptyData = {
        ...createMockPerformanceMetrics(),
        tokenUsage: { ...createMockPerformanceMetrics().tokenUsage, data: [] },
        taskCompletion: { ...createMockPerformanceMetrics().taskCompletion, data: [] },
        costTrend: { ...createMockPerformanceMetrics().costTrend, data: [] },
      }

      renderPerformanceMetricsPanel({ data: emptyData })

      expect(screen.getByText('No performance data available')).toBeInTheDocument()
    })

    it('renders custom empty message', () => {
      renderPerformanceMetricsPanel({
        data: undefined,
        emptyMessage: 'Custom empty message'
      })

      expect(screen.getByText('Custom empty message')).toBeInTheDocument()
    })

    it('shows refresh button in empty state when onRefresh provided', () => {
      const onRefresh = vi.fn()
      renderPerformanceMetricsPanel({
        data: undefined,
        onRefresh
      })

      const refreshButton = screen.getByRole('button', { name: 'Refresh Data' })
      expect(refreshButton).toBeInTheDocument()

      fireEvent.click(refreshButton)
      expect(onRefresh).toHaveBeenCalledOnce()
    })
  })

  describe('Error States', () => {
    it('renders error state with error message', () => {
      const errorMessage = 'Failed to load performance metrics'
      renderPerformanceMetricsPanel({ error: errorMessage })

      expect(screen.getByText('Error Loading Performance Metrics')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      expect(screen.queryByText('Performance Metrics')).not.toBeInTheDocument()
    })

    it('shows try again button in error state when onRefresh provided', () => {
      const onRefresh = vi.fn()
      const errorMessage = 'Network error'
      renderPerformanceMetricsPanel({ error: errorMessage, onRefresh })

      const tryAgainButton = screen.getByRole('button', { name: 'Try Again' })
      expect(tryAgainButton).toBeInTheDocument()

      fireEvent.click(tryAgainButton)
      expect(onRefresh).toHaveBeenCalledOnce()
    })

    it('applies error styling to card', () => {
      renderPerformanceMetricsPanel({ error: 'Error message' })

      const card = screen.getByTestId('card')
      expect(card).toHaveClass('border-red-900')
    })
  })

  describe('Time Range Selector', () => {
    it('displays all time range options', () => {
      renderPerformanceMetricsPanel()

      const selector = screen.getByTestId('time-range-selector')
      const options = selector.querySelectorAll('option')

      expect(options).toHaveLength(5) // '1h', '6h', '24h', '7d', '30d'
      expect(options[0]).toHaveTextContent('Last Hour')
      expect(options[1]).toHaveTextContent('Last 6 Hours')
      expect(options[2]).toHaveTextContent('Last 24 Hours')
      expect(options[3]).toHaveTextContent('Last 7 Days')
      expect(options[4]).toHaveTextContent('Last 30 Days')
    })

    it('calls onTimeRangeChange when selection changes', async () => {
      const onTimeRangeChange = vi.fn()
      renderPerformanceMetricsPanel({ onTimeRangeChange })

      const selector = screen.getByTestId('time-range-selector')

      await userEvent.selectOptions(selector, '7d')

      expect(onTimeRangeChange).toHaveBeenCalledWith('7d')
    })

    it('updates internal state when external timeRange changes', () => {
      const { rerender } = renderPerformanceMetricsPanel({ timeRange: '1h' })

      const selector = screen.getByTestId('time-range-selector')
      expect(selector).toHaveValue('1h')

      rerender(
        <PerformanceMetricsPanel
          data={createMockPerformanceMetrics()}
          timeRange="7d"
        />
      )

      expect(selector).toHaveValue('7d')
    })

    it('uses default time range when no timeRange prop provided', () => {
      renderPerformanceMetricsPanel({ timeRange: undefined })

      const selector = screen.getByTestId('time-range-selector')
      expect(selector).toHaveValue(DEFAULT_PERFORMANCE_TIME_RANGE)
    })

    it('disables selector when loading', () => {
      renderPerformanceMetricsPanel({ loading: true })

      const selector = screen.getByTestId('time-range-selector')
      expect(selector).toBeDisabled()
    })
  })

  describe('Refresh Functionality', () => {
    it('renders refresh button when onRefresh provided', () => {
      const onRefresh = vi.fn()
      renderPerformanceMetricsPanel({ onRefresh })

      const refreshButton = screen.getByRole('button', {
        name: 'Refresh performance metrics'
      })
      expect(refreshButton).toBeInTheDocument()
    })

    it('calls onRefresh when refresh button clicked', () => {
      const onRefresh = vi.fn()
      renderPerformanceMetricsPanel({ onRefresh })

      const refreshButton = screen.getByRole('button', {
        name: 'Refresh performance metrics'
      })
      fireEvent.click(refreshButton)

      expect(onRefresh).toHaveBeenCalledOnce()
    })

    it('disables refresh button when loading', () => {
      const onRefresh = vi.fn()
      renderPerformanceMetricsPanel({ onRefresh, loading: true })

      const refreshButton = screen.getByRole('button', {
        name: 'Refresh performance metrics'
      })
      expect(refreshButton).toBeDisabled()
    })

    it('shows spinning animation when loading', () => {
      const onRefresh = vi.fn()
      renderPerformanceMetricsPanel({ onRefresh, loading: true })

      const refreshButton = screen.getByRole('button', {
        name: 'Refresh performance metrics'
      })
      expect(refreshButton).toHaveClass('animate-spin')
    })
  })

  describe('Auto-refresh', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows auto-refresh indicator when enabled', () => {
      const onRefresh = vi.fn()
      renderPerformanceMetricsPanel({
        autoRefresh: true,
        autoRefreshInterval: 30000,
        onRefresh
      })

      expect(screen.getByText('Auto-refresh enabled (30s)')).toBeInTheDocument()
    })

    it('calls onRefresh at specified intervals when auto-refresh enabled', async () => {
      const onRefresh = vi.fn()
      renderPerformanceMetricsPanel({
        autoRefresh: true,
        autoRefreshInterval: 5000,
        onRefresh
      })

      expect(onRefresh).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(onRefresh).toHaveBeenCalledOnce()

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(onRefresh).toHaveBeenCalledTimes(2)
    })

    it('does not auto-refresh when onRefresh is not provided', () => {
      const onRefresh = vi.fn()
      renderPerformanceMetricsPanel({
        autoRefresh: true,
        autoRefreshInterval: 1000,
        onRefresh: undefined
      })

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(onRefresh).not.toHaveBeenCalled()
    })

    it('clears interval on unmount', () => {
      const onRefresh = vi.fn()
      const { unmount } = renderPerformanceMetricsPanel({
        autoRefresh: true,
        autoRefreshInterval: 1000,
        onRefresh
      })

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(onRefresh).toHaveBeenCalledOnce()

      unmount()

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(onRefresh).toHaveBeenCalledOnce() // Should not be called again
    })
  })

  describe('Chart Configuration', () => {
    it('passes correct props to chart components', () => {
      renderPerformanceMetricsPanel({
        chartVariant: 'line',
        chartSize: 'lg',
        animated: false,
        colors: { primary: '#custom-color' }
      })

      const tokenChart = screen.getByTestId('token-usage-chart')
      const taskChart = screen.getByTestId('task-completion-chart')
      const costChart = screen.getByTestId('cost-trend-chart')

      expect(tokenChart).toHaveAttribute('data-variant', 'line')
      expect(tokenChart).toHaveAttribute('data-height', '320') // lg size
      expect(tokenChart).toHaveAttribute('data-animated', 'false')

      expect(taskChart).toHaveAttribute('data-variant', 'line')
      expect(taskChart).toHaveAttribute('data-height', '320')
      expect(taskChart).toHaveAttribute('data-animated', 'false')

      expect(costChart).toHaveAttribute('data-variant', 'line')
      expect(costChart).toHaveAttribute('data-height', '320')
      expect(costChart).toHaveAttribute('data-animated', 'false')
    })

    it('uses default chart configuration', () => {
      renderPerformanceMetricsPanel()

      const tokenChart = screen.getByTestId('token-usage-chart')

      expect(tokenChart).toHaveAttribute('data-variant', 'area')
      expect(tokenChart).toHaveAttribute('data-height', '240') // md size default
      expect(tokenChart).toHaveAttribute('data-animated', 'true')
    })
  })

  describe('Footer Information', () => {
    it('shows last updated time when data has generatedAt', () => {
      const pastTime = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      const dataWithTime = {
        ...createMockPerformanceMetrics(),
        generatedAt: pastTime
      }

      renderPerformanceMetricsPanel({ data: dataWithTime })

      expect(screen.getByText(/Updated \d+ minutes? ago/)).toBeInTheDocument()
    })

    it('does not show last updated when generatedAt is not available', () => {
      const dataWithoutTime = {
        ...createMockPerformanceMetrics(),
        generatedAt: undefined as any
      }

      renderPerformanceMetricsPanel({ data: dataWithoutTime })

      expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
    })

    it('shows auto-refresh indicator in footer when enabled', () => {
      renderPerformanceMetricsPanel({
        autoRefresh: true,
        autoRefreshInterval: 45000,
        onRefresh: vi.fn()
      })

      const footer = screen.getByTestId('card-footer')
      expect(footer).toHaveTextContent('Auto-refresh enabled (45s)')
    })
  })

  describe('Accessibility', () => {
    it('has proper region role and label', () => {
      renderPerformanceMetricsPanel()

      const panel = screen.getByRole('region', { name: 'Performance Metrics Panel' })
      expect(panel).toBeInTheDocument()
    })

    it('has accessible refresh button', () => {
      const onRefresh = vi.fn()
      renderPerformanceMetricsPanel({ onRefresh })

      const refreshButton = screen.getByRole('button', {
        name: 'Refresh performance metrics'
      })
      expect(refreshButton).toBeInTheDocument()
      expect(refreshButton).toHaveAttribute('aria-label', 'Refresh performance metrics')
    })

    it('has accessible time range selector', () => {
      renderPerformanceMetricsPanel()

      const selector = screen.getByTestId('time-range-selector')
      expect(selector).toBeInTheDocument()
    })
  })

  describe('Data Handling', () => {
    it('passes correct data to each chart component', () => {
      const mockData = createMockPerformanceMetrics()
      renderPerformanceMetricsPanel({ data: mockData })

      const tokenChart = screen.getByTestId('token-usage-chart')
      const taskChart = screen.getByTestId('task-completion-chart')
      const costChart = screen.getByTestId('cost-trend-chart')

      expect(tokenChart).toHaveTextContent('Data points: 5')
      expect(taskChart).toHaveTextContent('Data points: 5')
      expect(costChart).toHaveTextContent('Data points: 5')
    })

    it('handles undefined data gracefully', () => {
      renderPerformanceMetricsPanel({ data: undefined })

      expect(screen.queryByTestId('token-usage-chart')).not.toBeInTheDocument()
      expect(screen.queryByTestId('task-completion-chart')).not.toBeInTheDocument()
      expect(screen.queryByTestId('cost-trend-chart')).not.toBeInTheDocument()
      expect(screen.getByText('No performance data available')).toBeInTheDocument()
    })
  })
})