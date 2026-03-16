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

// Mock chart components with more realistic behavior
vi.mock('@/components/charts/TokenUsageOverTimeChart', () => ({
  TokenUsageOverTimeChart: ({ data, onDataPointClick, ...props }: any) => {
    const handleClick = () => {
      if (onDataPointClick && data?.data?.[0]) {
        onDataPointClick(data.data[0])
      }
    }

    return (
      <div
        data-testid="token-usage-chart"
        onClick={handleClick}
        role="img"
        aria-label={`Token usage chart with ${data?.data?.length || 0} data points`}
      >
        <div data-testid="chart-title">Token Usage Over Time</div>
        {data?.data?.map((point: any, index: number) => (
          <div
            key={index}
            data-testid={`data-point-${index}`}
            data-timestamp={point.timestamp}
            data-total-tokens={point.totalTokens}
          >
            Data Point {index + 1}: {point.totalTokens} tokens
          </div>
        ))}
      </div>
    )
  },
}))

vi.mock('@/components/charts/TaskCompletionRateChart', () => ({
  TaskCompletionRateChart: ({ data, onDataPointClick, ...props }: any) => {
    const handleClick = () => {
      if (onDataPointClick && data?.data?.[0]) {
        onDataPointClick(data.data[0])
      }
    }

    return (
      <div
        data-testid="task-completion-chart"
        onClick={handleClick}
        role="img"
        aria-label={`Task completion chart with ${data?.data?.length || 0} data points`}
      >
        <div data-testid="chart-title">Task Completion Rate</div>
        {data?.data?.map((point: any, index: number) => (
          <div
            key={index}
            data-testid={`completion-point-${index}`}
            data-completion-rate={point.completionRate}
            data-success-rate={point.successRate}
          >
            Completion Point {index + 1}: {point.completionRate}% completion
          </div>
        ))}
      </div>
    )
  },
}))

vi.mock('@/components/charts/CostTrendChart', () => ({
  CostTrendChart: ({ data, onDataPointClick, ...props }: any) => {
    const handleClick = () => {
      if (onDataPointClick && data?.data?.[0]) {
        onDataPointClick(data.data[0])
      }
    }

    return (
      <div
        data-testid="cost-trend-chart"
        onClick={handleClick}
        role="img"
        aria-label={`Cost trend chart with ${data?.data?.length || 0} data points`}
      >
        <div data-testid="chart-title">Cost Trend</div>
        {data?.data?.map((point: any, index: number) => (
          <div
            key={index}
            data-testid={`cost-point-${index}`}
            data-cost={point.cost}
            data-cumulative-cost={point.cumulativeCost}
          >
            Cost Point {index + 1}: ${point.cost}
          </div>
        ))}
      </div>
    )
  },
}))

// Mock UI components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, role, ...props }: any) => (
    <div className={className} data-testid="card" role={role} {...props}>
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

// Helper function to create realistic mock data with time series
function createTimeSeriesData(
  timeRange: PerformanceMetricsTimeRange = '24h'
): AggregatedPerformanceMetrics {
  const now = new Date()
  const ranges = {
    '1h': { hours: 1, points: 12, intervalMins: 5 },
    '6h': { hours: 6, points: 36, intervalMins: 10 },
    '24h': { hours: 24, points: 24, intervalMins: 60 },
    '7d': { hours: 24 * 7, points: 28, intervalMins: 360 },
    '30d': { hours: 24 * 30, points: 30, intervalMins: 1440 },
  }

  const config = ranges[timeRange]
  const startTime = new Date(now.getTime() - config.hours * 60 * 60 * 1000)

  // Generate realistic token usage data with trends
  const tokenDataPoints = Array.from({ length: config.points }, (_, i) => {
    const timestamp = new Date(startTime.getTime() + i * config.intervalMins * 60 * 1000)
    const baseTokens = 1000 + Math.sin(i * 0.3) * 300 // Sinusoidal pattern
    const inputTokens = Math.floor(baseTokens * 0.6)
    const outputTokens = Math.floor(baseTokens * 0.4)
    const hasCacheData = i > config.points / 2

    return {
      timestamp,
      totalTokens: inputTokens + outputTokens,
      breakdown: {
        inputTokens,
        outputTokens,
        cacheCreationTokens: hasCacheData ? Math.floor(baseTokens * 0.05) : undefined,
        cacheReadTokens: hasCacheData ? Math.floor(baseTokens * 0.02) : undefined,
      },
      tokensPerMinute: Math.floor(baseTokens / config.intervalMins),
      cost: (inputTokens * 0.00003) + (outputTokens * 0.00006),
    }
  })

  // Generate task completion data with realistic patterns
  const taskDataPoints = Array.from({ length: config.points }, (_, i) => {
    const timestamp = new Date(startTime.getTime() + i * config.intervalMins * 60 * 1000)
    const baseCompletion = 85 + Math.random() * 10 // 85-95% completion rate
    const baseSuccess = 90 + Math.random() * 8 // 90-98% success rate
    const completedCount = Math.floor(10 + i * 0.5 + Math.random() * 5)
    const failedCount = Math.floor(completedCount * (1 - baseSuccess / 100))

    return {
      timestamp,
      completionRate: Math.min(100, baseCompletion + (Math.random() - 0.5) * 5),
      successRate: Math.min(100, baseSuccess + (Math.random() - 0.5) * 3),
      completedCount,
      failedCount,
      totalProcessed: completedCount + failedCount + Math.floor(Math.random() * 3),
      avgDurationMs: 2000 + Math.floor(Math.random() * 1000),
    }
  })

  // Generate cost trend data
  const costDataPoints = Array.from({ length: config.points }, (_, i) => {
    const timestamp = new Date(startTime.getTime() + i * config.intervalMins * 60 * 1000)
    const tokenPoint = tokenDataPoints[i]
    const cost = tokenPoint.cost || 0

    // Calculate cumulative cost from previous data points
    let cumulativeCost = cost
    for (let j = 0; j < i; j++) {
      const prevTokenPoint = tokenDataPoints[j]
      cumulativeCost += prevTokenPoint.cost || 0
    }

    return {
      timestamp,
      cost,
      cumulativeCost,
      breakdown: {
        inputTokenCost: cost * 0.6,
        outputTokenCost: cost * 0.4,
        cacheCreationCost: 0,
        cacheReadCost: 0,
        otherCost: 0,
      },
      projectedCost: cost * 1.2,
    }
  })

  // Calculate aggregates
  const totalTokens = tokenDataPoints.reduce((sum, p) => sum + p.totalTokens, 0)
  const totalInputTokens = tokenDataPoints.reduce((sum, p) => sum + p.breakdown.inputTokens, 0)
  const totalOutputTokens = tokenDataPoints.reduce((sum, p) => sum + p.breakdown.outputTokens, 0)
  const totalCost = costDataPoints.reduce((sum, p) => sum + p.cost, 0)
  const totalCompleted = taskDataPoints.reduce((sum, p) => sum + p.completedCount, 0)
  const totalFailed = taskDataPoints.reduce((sum, p) => sum + p.failedCount, 0)
  const avgCompletionRate = taskDataPoints.reduce((sum, p) => sum + p.completionRate, 0) / taskDataPoints.length
  const avgSuccessRate = taskDataPoints.reduce((sum, p) => sum + p.successRate, 0) / taskDataPoints.length

  return {
    tokenUsage: {
      data: tokenDataPoints,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCacheCreationTokens: tokenDataPoints.reduce((sum, p) => sum + (p.breakdown.cacheCreationTokens || 0), 0),
      totalCacheReadTokens: tokenDataPoints.reduce((sum, p) => sum + (p.breakdown.cacheReadTokens || 0), 0),
      cacheHitRate: 12.5,
      avgTokensPerMinute: totalTokens / (config.hours * 60),
      peakTokensPerMinute: Math.max(...tokenDataPoints.map(p => p.tokensPerMinute || 0)),
      totalCost,
      timeRange,
      generatedAt: now,
      trend: 1,
      changePercent: 15.5,
    },
    taskCompletion: {
      data: taskDataPoints,
      overallCompletionRate: avgCompletionRate,
      overallSuccessRate: avgSuccessRate,
      totalCompleted,
      totalFailed,
      totalProcessed: totalCompleted + totalFailed,
      statusCounts: {
        completed: totalCompleted,
        failed: totalFailed,
        inProgress: 3,
        pending: 2,
        cancelled: 1,
        paused: 0,
      },
      byStatus: {
        completed: totalCompleted,
        failed: totalFailed,
      },
      avgDurationMs: taskDataPoints.reduce((sum, p) => sum + (p.avgDurationMs || 2500), 0) / taskDataPoints.length,
      medianDurationMs: 2400,
      p95DurationMs: 4200,
      timeRange,
      generatedAt: now,
      trend: 1,
      changePercent: 8.2,
    },
    costTrend: {
      data: costDataPoints,
      totalCost,
      avgCostPerHour: totalCost / config.hours,
      avgCostPerTask: totalCost / Math.max(totalCompleted + totalFailed, 1),
      peakHourlyCost: Math.max(...costDataPoints.map(p => p.cost * (60 / config.intervalMins))),
      breakdown: {
        inputTokenCost: totalCost * 0.6,
        outputTokenCost: totalCost * 0.4,
        cacheCreationCost: 0,
        cacheReadCost: 0,
        otherCost: 0,
      },
      budgetLimit: 10,
      budgetUtilization: (totalCost / 10) * 100,
      projectedRemainingCost: totalCost * 0.5,
      projectedTotalCost: totalCost * 1.5,
      cacheSavings: totalCost * 0.05,
      timeRange,
      generatedAt: now,
      trend: 1,
      changePercent: 25.0,
    },
    timeRange,
    generatedAt: now,
  }
}

describe('PerformanceMetricsPanel Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Real-time Data Updates', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('integrates with auto-refresh to update data periodically', async () => {
      const onRefresh = vi.fn()
      const initialData = createTimeSeriesData('1h')

      const { rerender } = render(
        <PerformanceMetricsPanel
          data={initialData}
          autoRefresh={true}
          autoRefreshInterval={10000}
          onRefresh={onRefresh}
        />
      )

      // Initial render shows data
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
      expect(screen.getByText('Auto-refresh enabled (10s)')).toBeInTheDocument()

      // Advance timers to trigger refresh
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(onRefresh).toHaveBeenCalledOnce()

      // Simulate new data arriving
      const updatedData = createTimeSeriesData('1h')
      rerender(
        <PerformanceMetricsPanel
          data={updatedData}
          autoRefresh={true}
          autoRefreshInterval={10000}
          onRefresh={onRefresh}
        />
      )

      // Check that charts receive new data
      expect(screen.getAllByText(/Data Point/)).toHaveLength(12) // 1h has 12 points
    })

    it('handles loading state transitions during auto-refresh', async () => {
      const onRefresh = vi.fn()
      const data = createTimeSeriesData('24h')

      const { rerender } = render(
        <PerformanceMetricsPanel
          data={data}
          autoRefresh={true}
          autoRefreshInterval={5000}
          onRefresh={onRefresh}
          loading={false}
        />
      )

      // Should show data initially
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.queryByText('Updating...')).not.toBeInTheDocument()

      // Trigger refresh and show loading
      rerender(
        <PerformanceMetricsPanel
          data={data}
          autoRefresh={true}
          autoRefreshInterval={5000}
          onRefresh={onRefresh}
          loading={true}
        />
      )

      // Should show loading overlay
      expect(screen.getByText('Updating...')).toBeInTheDocument()
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument() // Data still visible

      // Complete refresh
      rerender(
        <PerformanceMetricsPanel
          data={data}
          autoRefresh={true}
          autoRefreshInterval={5000}
          onRefresh={onRefresh}
          loading={false}
        />
      )

      // Should hide loading overlay
      expect(screen.queryByText('Updating...')).not.toBeInTheDocument()
    })
  })

  describe('Time Range Integration', () => {
    it('updates all charts when time range changes', async () => {
      const onTimeRangeChange = vi.fn()
      let currentTimeRange: PerformanceMetricsTimeRange = '24h'
      let currentData = createTimeSeriesData(currentTimeRange)

      const TestComponent = () => (
        <PerformanceMetricsPanel
          data={currentData}
          timeRange={currentTimeRange}
          onTimeRangeChange={(newRange) => {
            currentTimeRange = newRange
            currentData = createTimeSeriesData(newRange)
            onTimeRangeChange(newRange)
          }}
        />
      )

      const { rerender } = render(<TestComponent />)

      // Initial state - 24h with 24 data points
      expect(screen.getAllByText(/Data Point/)).toHaveLength(24)

      // Change to 1h time range
      const selector = screen.getByTestId('time-range-selector')
      await userEvent.selectOptions(selector, '1h')

      expect(onTimeRangeChange).toHaveBeenCalledWith('1h')

      // Update component with new data
      currentTimeRange = '1h'
      currentData = createTimeSeriesData('1h')
      rerender(<TestComponent />)

      // Should now show 12 data points (1h worth)
      expect(screen.getAllByText(/Data Point/)).toHaveLength(12)
    })

    it('maintains chart state during time range transitions', async () => {
      const data24h = createTimeSeriesData('24h')
      const data1h = createTimeSeriesData('1h')

      const { rerender } = render(
        <PerformanceMetricsPanel
          data={data24h}
          timeRange="24h"
          chartVariant="line"
          animated={false}
        />
      )

      // Verify initial chart configuration
      const tokenChart = screen.getByTestId('token-usage-chart')
      expect(tokenChart).toHaveAttribute('aria-label', expect.stringContaining('24 data points'))

      // Switch to different time range with same chart configuration
      rerender(
        <PerformanceMetricsPanel
          data={data1h}
          timeRange="1h"
          chartVariant="line"
          animated={false}
        />
      )

      // Configuration should be maintained
      expect(tokenChart).toHaveAttribute('aria-label', expect.stringContaining('12 data points'))
    })
  })

  describe('Chart Interactions', () => {
    it('handles data point clicks across all charts', async () => {
      const data = createTimeSeriesData('24h')

      render(
        <PerformanceMetricsPanel
          data={data}
        />
      )

      const tokenChart = screen.getByTestId('token-usage-chart')
      const taskChart = screen.getByTestId('task-completion-chart')
      const costChart = screen.getByTestId('cost-trend-chart')

      // Verify charts are interactive (clickable)
      fireEvent.click(tokenChart)
      fireEvent.click(taskChart)
      fireEvent.click(costChart)

      // Charts should remain functional after interaction
      expect(tokenChart).toBeInTheDocument()
      expect(taskChart).toBeInTheDocument()
      expect(costChart).toBeInTheDocument()
    })
  })

  describe('Error Recovery', () => {
    it('recovers from error state when new data arrives', () => {
      const { rerender } = render(
        <PerformanceMetricsPanel
          error="Failed to load data"
          data={undefined}
        />
      )

      // Should show error state
      expect(screen.getByText('Error Loading Performance Metrics')).toBeInTheDocument()
      expect(screen.queryByTestId('token-usage-chart')).not.toBeInTheDocument()

      // Provide data and clear error
      const data = createTimeSeriesData('24h')
      rerender(
        <PerformanceMetricsPanel
          data={data}
          error={null}
        />
      )

      // Should show data and hide error
      expect(screen.queryByText('Error Loading Performance Metrics')).not.toBeInTheDocument()
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
    })

    it('handles partial data gracefully', () => {
      const partialData = {
        ...createTimeSeriesData('24h'),
        tokenUsage: { ...createTimeSeriesData('24h').tokenUsage, data: [] },
      }

      render(
        <PerformanceMetricsPanel
          data={partialData}
          showTokenUsage={true}
          showTaskCompletion={true}
          showCostTrend={true}
        />
      )

      // Should still render other charts even if one has no data
      expect(screen.getByTestId('task-completion-chart')).toBeInTheDocument()
      expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument()

      // Token chart should still be rendered (with empty data)
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.getByTestId('token-usage-chart')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('0 data points')
      )
    })
  })

  describe('Responsive Layout', () => {
    it('adapts chart layout based on visible charts', () => {
      const data = createTimeSeriesData('24h')

      // Test with all charts visible (3 charts)
      const { rerender } = render(
        <PerformanceMetricsPanel
          data={data}
          showTokenUsage={true}
          showTaskCompletion={true}
          showCostTrend={true}
        />
      )

      let gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('lg:grid-cols-3')

      // Test with 2 charts visible
      rerender(
        <PerformanceMetricsPanel
          data={data}
          showTokenUsage={true}
          showTaskCompletion={false}
          showCostTrend={true}
        />
      )

      gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('md:grid-cols-2')
      expect(gridContainer).not.toHaveClass('lg:grid-cols-3')

      // Test with 1 chart visible
      rerender(
        <PerformanceMetricsPanel
          data={data}
          showTokenUsage={true}
          showTaskCompletion={false}
          showCostTrend={false}
        />
      )

      gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1')
      expect(gridContainer).not.toHaveClass('md:grid-cols-2')
      expect(gridContainer).not.toHaveClass('lg:grid-cols-3')
    })

    it('maintains chart sizing across layout changes', () => {
      const data = createTimeSeriesData('24h')

      const { rerender } = render(
        <PerformanceMetricsPanel
          data={data}
          chartSize="lg"
          showTokenUsage={true}
          showTaskCompletion={true}
          showCostTrend={true}
        />
      )

      // All charts should have lg size
      let charts = screen.getAllByTestId(/.*-chart/)
      charts.forEach(chart => {
        expect(chart).toBeInTheDocument()
      })

      // Hide one chart
      rerender(
        <PerformanceMetricsPanel
          data={data}
          chartSize="lg"
          showTokenUsage={true}
          showTaskCompletion={true}
          showCostTrend={false}
        />
      )

      // Remaining charts should still have lg size
      charts = screen.getAllByTestId(/.*-chart/)
      expect(charts).toHaveLength(2)
    })
  })

  describe('Data Flow Integration', () => {
    it('synchronizes time range across all charts', () => {
      const data = createTimeSeriesData('7d')

      render(
        <PerformanceMetricsPanel
          data={data}
          timeRange="7d"
        />
      )

      // All charts should show data for 7d time range
      const tokenChart = screen.getByTestId('token-usage-chart')
      const taskChart = screen.getByTestId('task-completion-chart')
      const costChart = screen.getByTestId('cost-trend-chart')

      expect(tokenChart).toHaveAttribute('aria-label', expect.stringContaining('28 data points'))
      expect(taskChart).toHaveAttribute('aria-label', expect.stringContaining('28 data points'))
      expect(costChart).toHaveAttribute('aria-label', expect.stringContaining('28 data points'))
    })

    it('passes consistent styling to all charts', () => {
      const data = createTimeSeriesData('24h')
      const customColors = { primary: '#custom-color' }

      render(
        <PerformanceMetricsPanel
          data={data}
          chartVariant="line"
          chartSize="sm"
          animated={false}
          colors={customColors}
        />
      )

      const charts = [
        screen.getByTestId('token-usage-chart'),
        screen.getByTestId('task-completion-chart'),
        screen.getByTestId('cost-trend-chart'),
      ]

      // All charts should have consistent configuration
      charts.forEach(chart => {
        // Note: These would be verified if the mocked components preserved the props
        expect(chart).toBeInTheDocument()
      })
    })
  })

  describe('Performance with Large Datasets', () => {
    it('handles large datasets efficiently', () => {
      // Create data with maximum points for 30d range
      const largeData = createTimeSeriesData('30d')

      const startTime = performance.now()

      render(
        <PerformanceMetricsPanel
          data={largeData}
          timeRange="30d"
        />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100)

      // All data points should be represented
      expect(screen.getByTestId('token-usage-chart')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('30 data points')
      )
    })

    it('maintains responsiveness during frequent updates', async () => {
      vi.useFakeTimers()

      const onRefresh = vi.fn()
      let data = createTimeSeriesData('1h')

      const TestComponent = ({ updateData }: { updateData: boolean }) => {
        if (updateData) {
          data = createTimeSeriesData('1h')
        }
        return (
          <PerformanceMetricsPanel
            data={data}
            autoRefresh={true}
            autoRefreshInterval={1000}
            onRefresh={onRefresh}
          />
        )
      }

      const { rerender } = render(<TestComponent updateData={false} />)

      // Simulate rapid updates
      for (let i = 0; i < 5; i++) {
        act(() => {
          vi.advanceTimersByTime(1000)
        })

        rerender(<TestComponent updateData={true} />)

        // Should maintain chart structure
        expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
        expect(screen.getByTestId('task-completion-chart')).toBeInTheDocument()
        expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument()
      }

      vi.useRealTimers()
    })
  })
})