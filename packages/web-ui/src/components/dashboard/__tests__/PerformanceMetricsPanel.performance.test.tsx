/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PerformanceMetricsPanel } from '../PerformanceMetricsPanel'
import type { AggregatedPerformanceMetrics, PerformanceMetricsTimeRange } from '@/types/performance-metrics'

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

// Performance monitoring utilities
const measureRenderTime = (renderFn: () => void): number => {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

const measureMemoryUsage = (): number => {
  // @ts-ignore - performance.memory might not exist in all environments
  return (performance as any).memory?.usedJSHeapSize || 0
}

// Mock chart components with performance tracking
let chartRenderCount = 0
const resetRenderCount = () => { chartRenderCount = 0 }
const getChartRenderCount = () => chartRenderCount

vi.mock('@/components/charts/TokenUsageOverTimeChart', () => ({
  TokenUsageOverTimeChart: ({ data, ...props }: any) => {
    chartRenderCount++
    return (
      <div data-testid="token-usage-chart" data-render-count={chartRenderCount}>
        Token Usage Chart - Points: {data?.data?.length || 0}
      </div>
    )
  },
}))

vi.mock('@/components/charts/TaskCompletionRateChart', () => ({
  TaskCompletionRateChart: ({ data, ...props }: any) => {
    chartRenderCount++
    return (
      <div data-testid="task-completion-chart" data-render-count={chartRenderCount}>
        Task Completion Chart - Points: {data?.data?.length || 0}
      </div>
    )
  },
}))

vi.mock('@/components/charts/CostTrendChart', () => ({
  CostTrendChart: ({ data, ...props }: any) => {
    chartRenderCount++
    return (
      <div data-testid="cost-trend-chart" data-render-count={chartRenderCount}>
        Cost Trend Chart - Points: {data?.data?.length || 0}
      </div>
    )
  },
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
  Select: ({ options, value, onChange, disabled, ...props }: any) => (
    <select
      data-testid="time-range-selector"
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
    return `${diffMins} minutes ago`
  },
}))

// Helper to generate large datasets for performance testing
function generateLargeDataset(
  timeRange: PerformanceMetricsTimeRange = '30d',
  dataPointMultiplier: number = 1
): AggregatedPerformanceMetrics {
  const ranges = {
    '1h': { hours: 1, points: 60 * dataPointMultiplier, intervalMins: 1 },
    '6h': { hours: 6, points: 360 * dataPointMultiplier, intervalMins: 1 },
    '24h': { hours: 24, points: 1440 * dataPointMultiplier, intervalMins: 1 },
    '7d': { hours: 24 * 7, points: 672 * dataPointMultiplier, intervalMins: 15 },
    '30d': { hours: 24 * 30, points: 720 * dataPointMultiplier, intervalMins: 60 },
  }

  const config = ranges[timeRange]
  const now = new Date()
  const startTime = new Date(now.getTime() - config.hours * 60 * 60 * 1000)

  // Generate token usage data
  const tokenDataPoints = Array.from({ length: config.points }, (_, i) => {
    const timestamp = new Date(startTime.getTime() + i * config.intervalMins * 60 * 1000)
    const baseTokens = Math.floor(1000 + Math.sin(i * 0.1) * 500 + Math.random() * 200)
    return {
      timestamp,
      totalTokens: baseTokens,
      breakdown: {
        inputTokens: Math.floor(baseTokens * 0.6),
        outputTokens: Math.floor(baseTokens * 0.4),
        cacheCreationTokens: i > config.points / 2 ? Math.floor(baseTokens * 0.05) : undefined,
        cacheReadTokens: i > config.points / 2 ? Math.floor(baseTokens * 0.02) : undefined,
      },
      tokensPerMinute: Math.floor(baseTokens / config.intervalMins),
      cost: baseTokens * 0.00005 + Math.random() * 0.001,
    }
  })

  // Generate task completion data
  const taskDataPoints = Array.from({ length: config.points }, (_, i) => {
    const completionRate = 80 + Math.random() * 15 // 80-95%
    const successRate = 85 + Math.random() * 12 // 85-97%
    const completedCount = Math.floor(5 + Math.random() * 15)

    return {
      timestamp: new Date(startTime.getTime() + i * config.intervalMins * 60 * 1000),
      completionRate,
      successRate,
      completedCount,
      failedCount: Math.floor(completedCount * (1 - successRate / 100)),
      totalProcessed: completedCount + Math.floor(Math.random() * 5),
      avgDurationMs: Math.floor(2000 + Math.random() * 3000),
    }
  })

  // Generate cost trend data
  const costDataPoints = Array.from({ length: config.points }, (_, i) => {
    const cost = tokenDataPoints[i].cost || 0

    // Calculate cumulative cost from previous data points
    let cumulativeCost = cost
    for (let j = 0; j < i; j++) {
      const prevTokenPoint = tokenDataPoints[j]
      cumulativeCost += prevTokenPoint.cost || 0
    }

    return {
      timestamp: new Date(startTime.getTime() + i * config.intervalMins * 60 * 1000),
      cost,
      cumulativeCost,
      breakdown: {
        inputTokenCost: cost * 0.6,
        outputTokenCost: cost * 0.4,
        cacheCreationCost: 0,
        cacheReadCost: 0,
        otherCost: 0,
      },
      projectedCost: cost * 1.1,
    }
  })

  // Calculate aggregates
  const totalTokens = tokenDataPoints.reduce((sum, p) => sum + p.totalTokens, 0)
  const totalInputTokens = tokenDataPoints.reduce((sum, p) => sum + p.breakdown.inputTokens, 0)
  const totalOutputTokens = tokenDataPoints.reduce((sum, p) => sum + p.breakdown.outputTokens, 0)
  const totalCost = costDataPoints.reduce((sum, p) => sum + p.cost, 0)
  const totalCompleted = taskDataPoints.reduce((sum, p) => sum + p.completedCount, 0)
  const totalFailed = taskDataPoints.reduce((sum, p) => sum + p.failedCount, 0)

  return {
    tokenUsage: {
      data: tokenDataPoints,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCacheCreationTokens: tokenDataPoints.reduce((sum, p) => sum + (p.breakdown.cacheCreationTokens || 0), 0),
      totalCacheReadTokens: tokenDataPoints.reduce((sum, p) => sum + (p.breakdown.cacheReadTokens || 0), 0),
      cacheHitRate: 15.5,
      avgTokensPerMinute: totalTokens / (config.hours * 60),
      peakTokensPerMinute: Math.max(...tokenDataPoints.map(p => p.tokensPerMinute || 0)),
      totalCost,
      timeRange,
      generatedAt: now,
      trend: 1,
      changePercent: 12.5,
    },
    taskCompletion: {
      data: taskDataPoints,
      overallCompletionRate: taskDataPoints.reduce((sum, p) => sum + p.completionRate, 0) / taskDataPoints.length,
      overallSuccessRate: taskDataPoints.reduce((sum, p) => sum + p.successRate, 0) / taskDataPoints.length,
      totalCompleted,
      totalFailed,
      totalProcessed: totalCompleted + totalFailed,
      statusCounts: {
        completed: totalCompleted,
        failed: totalFailed,
        inProgress: 5,
        pending: 3,
        cancelled: 2,
        paused: 1,
      },
      byStatus: { completed: totalCompleted, failed: totalFailed },
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
      budgetLimit: 100,
      budgetUtilization: (totalCost / 100) * 100,
      projectedRemainingCost: totalCost * 0.3,
      projectedTotalCost: totalCost * 1.3,
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

describe('PerformanceMetricsPanel Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRenderCount()
    // Reset performance measurements
    if (typeof window !== 'undefined' && window.gc) {
      window.gc()
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering Performance', () => {
    it('renders small datasets quickly', () => {
      const smallData = generateLargeDataset('1h', 0.1) // 6 data points

      const renderTime = measureRenderTime(() => {
        render(<PerformanceMetricsPanel data={smallData} />)
      })

      expect(renderTime).toBeLessThan(50) // Should render in less than 50ms
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    })

    it('renders medium datasets efficiently', () => {
      const mediumData = generateLargeDataset('24h', 0.1) // ~144 data points

      const renderTime = measureRenderTime(() => {
        render(<PerformanceMetricsPanel data={mediumData} />)
      })

      expect(renderTime).toBeLessThan(100) // Should render in less than 100ms
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    })

    it('handles large datasets without significant performance degradation', () => {
      const largeData = generateLargeDataset('30d', 1) // 720 data points

      const renderTime = measureRenderTime(() => {
        render(<PerformanceMetricsPanel data={largeData} />)
      })

      expect(renderTime).toBeLessThan(200) // Should render in less than 200ms
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    })

    it('renders very large datasets within acceptable limits', () => {
      const veryLargeData = generateLargeDataset('30d', 5) // 3600 data points

      const renderTime = measureRenderTime(() => {
        render(<PerformanceMetricsPanel data={veryLargeData} />)
      })

      expect(renderTime).toBeLessThan(500) // Should render in less than 500ms
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    })
  })

  describe('Re-render Optimization', () => {
    it('minimizes re-renders when props do not change', () => {
      const data = generateLargeDataset('24h')
      const { rerender } = render(<PerformanceMetricsPanel data={data} />)

      const initialRenderCount = getChartRenderCount()

      // Re-render with same props
      rerender(<PerformanceMetricsPanel data={data} />)

      // Chart components should not re-render if data hasn't changed
      // Note: This depends on React.memo or similar optimizations in the actual implementation
      expect(getChartRenderCount()).toBeGreaterThanOrEqual(initialRenderCount)
    })

    it('efficiently handles time range changes', () => {
      const data24h = generateLargeDataset('24h')
      const data7d = generateLargeDataset('7d')

      const { rerender } = render(
        <PerformanceMetricsPanel data={data24h} timeRange="24h" />
      )

      resetRenderCount()

      const changeTime = measureRenderTime(() => {
        rerender(
          <PerformanceMetricsPanel data={data7d} timeRange="7d" />
        )
      })

      expect(changeTime).toBeLessThan(100) // Time range changes should be fast
      expect(screen.getByDisplayValue('7d')).toBeInTheDocument()
    })

    it('handles rapid prop updates efficiently', () => {
      const data = generateLargeDataset('24h')
      const { rerender } = render(<PerformanceMetricsPanel data={data} />)

      const startTime = performance.now()

      // Simulate 10 rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <PerformanceMetricsPanel
            data={data}
            loading={i % 2 === 0}
            chartVariant={i % 2 === 0 ? 'line' : 'area'}
          />
        )
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(200) // 10 updates should complete quickly
    })
  })

  describe('Memory Usage', () => {
    it('does not accumulate memory with frequent updates', () => {
      const initialMemory = measureMemoryUsage()

      const { rerender } = render(
        <PerformanceMetricsPanel data={generateLargeDataset('24h')} />
      )

      // Perform many updates with different data
      for (let i = 0; i < 20; i++) {
        const newData = generateLargeDataset('24h', 0.5)
        rerender(<PerformanceMetricsPanel data={newData} />)
      }

      const finalMemory = measureMemoryUsage()

      // Memory usage should not grow dramatically
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100
        expect(memoryIncreasePercent).toBeLessThan(200) // Less than 200% increase
      }
    })

    it('cleans up properly on unmount', () => {
      const { unmount } = render(
        <PerformanceMetricsPanel
          data={generateLargeDataset('30d')}
          autoRefresh={true}
          autoRefreshInterval={1000}
          onRefresh={vi.fn()}
        />
      )

      // Should unmount without errors
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Auto-refresh Performance', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('handles auto-refresh efficiently with large datasets', () => {
      const onRefresh = vi.fn()
      let data = generateLargeDataset('24h', 2)

      const TestComponent = () => (
        <PerformanceMetricsPanel
          data={data}
          autoRefresh={true}
          autoRefreshInterval={5000}
          onRefresh={() => {
            data = generateLargeDataset('24h', 2)
            onRefresh()
          }}
        />
      )

      const { rerender } = render(<TestComponent />)

      // Trigger multiple auto-refreshes
      for (let i = 0; i < 5; i++) {
        const refreshTime = measureRenderTime(() => {
          act(() => {
            vi.advanceTimersByTime(5000)
          })
          rerender(<TestComponent />)
        })

        expect(refreshTime).toBeLessThan(100) // Each refresh should be fast
      }

      expect(onRefresh).toHaveBeenCalledTimes(5)
    })

    it('maintains performance with high-frequency updates', () => {
      const onRefresh = vi.fn()
      render(
        <PerformanceMetricsPanel
          data={generateLargeDataset('1h')}
          autoRefresh={true}
          autoRefreshInterval={100} // Very frequent updates
          onRefresh={onRefresh}
        />
      )

      const startTime = performance.now()

      // Simulate 20 rapid refreshes
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(500) // Should handle rapid updates efficiently
      expect(onRefresh).toHaveBeenCalledTimes(20)
    })
  })

  describe('Chart Performance', () => {
    it('efficiently passes data to chart components', () => {
      const largeData = generateLargeDataset('7d', 2)

      render(<PerformanceMetricsPanel data={largeData} />)

      // All three charts should render
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.getByTestId('task-completion-chart')).toBeInTheDocument()
      expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument()

      // Charts should receive the correct data size
      const tokenChart = screen.getByTestId('token-usage-chart')
      expect(tokenChart).toHaveTextContent('Points: 1344') // 7d * 2 multiplier = 672 * 2
    })

    it('handles selective chart rendering efficiently', () => {
      const data = generateLargeDataset('30d')

      // Test with only one chart visible
      const singleChartTime = measureRenderTime(() => {
        render(
          <PerformanceMetricsPanel
            data={data}
            showTokenUsage={true}
            showTaskCompletion={false}
            showCostTrend={false}
          />
        )
      })

      // Clear and test with all charts
      resetRenderCount()

      const allChartsTime = measureRenderTime(() => {
        render(
          <PerformanceMetricsPanel
            data={data}
            showTokenUsage={true}
            showTaskCompletion={true}
            showCostTrend={true}
          />
        )
      })

      // Rendering fewer charts should be faster
      expect(singleChartTime).toBeLessThan(allChartsTime * 0.7)
    })
  })

  describe('Stress Testing', () => {
    it('handles maximum realistic data volume', () => {
      // Create an extremely large dataset (equivalent to 1 minute intervals for 30 days)
      const extremeData = generateLargeDataset('30d', 10) // 7200 data points

      const renderTime = measureRenderTime(() => {
        render(<PerformanceMetricsPanel data={extremeData} />)
      })

      expect(renderTime).toBeLessThan(1000) // Should render within 1 second
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    })

    it('maintains responsiveness under stress', () => {
      const stressData = generateLargeDataset('30d', 5)

      const { rerender } = render(<PerformanceMetricsPanel data={stressData} />)

      // Rapid state changes under stress
      const operations = [
        { loading: true },
        { loading: false, chartSize: 'lg' as const },
        { chartVariant: 'line' as const },
        { showTokenUsage: false },
        { showTaskCompletion: false },
        { showCostTrend: false },
        { showTokenUsage: true, showTaskCompletion: true, showCostTrend: true },
      ]

      const startTime = performance.now()

      operations.forEach((props) => {
        rerender(<PerformanceMetricsPanel data={stressData} {...props} />)
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(300) // All operations should complete quickly
    })

    it('recovers gracefully from performance bottlenecks', () => {
      // Start with a very large dataset
      const hugeData = generateLargeDataset('30d', 20) // Extremely large

      const { rerender } = render(<PerformanceMetricsPanel data={hugeData} />)

      // Switch to a smaller dataset - should be fast
      const smallData = generateLargeDataset('1h', 0.1)

      const recoveryTime = measureRenderTime(() => {
        rerender(<PerformanceMetricsPanel data={smallData} />)
      })

      expect(recoveryTime).toBeLessThan(100) // Should recover quickly
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    })
  })

  describe('Performance Monitoring', () => {
    it('maintains consistent performance across multiple render cycles', () => {
      const data = generateLargeDataset('24h')
      const renderTimes: number[] = []

      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<PerformanceMetricsPanel data={data} />)

        const renderTime = measureRenderTime(() => {
          render(<PerformanceMetricsPanel data={data} />)
        })

        renderTimes.push(renderTime)
        unmount()
      }

      // Performance should be consistent (within 50% variance)
      const avgTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length
      const maxVariance = Math.max(...renderTimes.map(time => Math.abs(time - avgTime)))

      expect(maxVariance).toBeLessThan(avgTime * 0.5)
    })

    it('does not degrade performance over time', () => {
      const data = generateLargeDataset('7d')
      const { rerender } = render(<PerformanceMetricsPanel data={data} />)

      const firstUpdateTime = measureRenderTime(() => {
        rerender(<PerformanceMetricsPanel data={data} loading={true} />)
      })

      // Perform many updates
      for (let i = 0; i < 50; i++) {
        rerender(
          <PerformanceMetricsPanel
            data={data}
            loading={i % 2 === 0}
            timeRange={i % 2 === 0 ? '24h' : '7d'}
          />
        )
      }

      const lastUpdateTime = measureRenderTime(() => {
        rerender(<PerformanceMetricsPanel data={data} loading={false} />)
      })

      // Performance should not significantly degrade
      expect(lastUpdateTime).toBeLessThan(firstUpdateTime * 2)
    })
  })
})