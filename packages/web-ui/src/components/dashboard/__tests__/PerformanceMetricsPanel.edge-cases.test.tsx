/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PerformanceMetricsPanel } from '../PerformanceMetricsPanel'
import type {
  AggregatedPerformanceMetrics,
  PerformanceMetricsPanelProps,
} from '@/types/performance-metrics'
import {
  EMPTY_AGGREGATED_METRICS,
  EMPTY_TOKEN_USAGE_DATA,
  EMPTY_TASK_COMPLETION_DATA,
  EMPTY_COST_TREND_DATA,
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
  TokenUsageOverTimeChart: ({ data, ...props }: any) => (
    <div data-testid="token-usage-chart" {...props}>
      Token Usage Chart - Data: {JSON.stringify(data?.data?.length || 0)}
    </div>
  ),
}))

vi.mock('@/components/charts/TaskCompletionRateChart', () => ({
  TaskCompletionRateChart: ({ data, ...props }: any) => (
    <div data-testid="task-completion-chart" {...props}>
      Task Completion Chart - Data: {JSON.stringify(data?.data?.length || 0)}
    </div>
  ),
}))

vi.mock('@/components/charts/CostTrendChart', () => ({
  CostTrendChart: ({ data, ...props }: any) => (
    <div data-testid="cost-trend-chart" {...props}>
      Cost Trend Chart - Data: {JSON.stringify(data?.data?.length || 0)}
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
  getRelativeTime: (date: Date | undefined) => {
    if (!date) return 'unknown'
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins === 1) return '1 minute ago'
    return `${diffMins} minutes ago`
  },
}))

describe('PerformanceMetricsPanel Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error to prevent noise in test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()
  })

  describe('Malformed Data Handling', () => {
    it('handles null data gracefully', () => {
      render(<PerformanceMetricsPanel data={null as any} />)

      expect(screen.getByText('No performance data available')).toBeInTheDocument()
      expect(screen.queryByTestId('token-usage-chart')).not.toBeInTheDocument()
    })

    it('handles undefined properties in data', () => {
      const malformedData = {
        tokenUsage: undefined,
        taskCompletion: undefined,
        costTrend: undefined,
        timeRange: '24h',
        generatedAt: new Date(),
      } as any

      render(<PerformanceMetricsPanel data={malformedData} />)

      // Should still render but show empty state
      expect(screen.getByText('No performance data available')).toBeInTheDocument()
    })

    it('handles data with missing required properties', () => {
      const incompleteData = {
        tokenUsage: {
          data: [],
          // Missing other required properties
        },
        taskCompletion: {
          data: [],
        },
        costTrend: {
          data: [],
        },
      } as any

      expect(() => {
        render(<PerformanceMetricsPanel data={incompleteData} />)
      }).not.toThrow()

      expect(screen.getByText('No performance data available')).toBeInTheDocument()
    })

    it('handles data with invalid timestamps', () => {
      const dataWithInvalidTimestamps = {
        tokenUsage: {
          ...EMPTY_TOKEN_USAGE_DATA,
          data: [
            {
              timestamp: 'invalid-date' as any,
              totalTokens: 1000,
              breakdown: { inputTokens: 600, outputTokens: 400 },
            },
          ],
        },
        taskCompletion: EMPTY_TASK_COMPLETION_DATA,
        costTrend: EMPTY_COST_TREND_DATA,
        timeRange: '24h' as const,
        generatedAt: new Date(),
      }

      expect(() => {
        render(<PerformanceMetricsPanel data={dataWithInvalidTimestamps} />)
      }).not.toThrow()

      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
    })

    it('handles negative values in metrics', () => {
      const dataWithNegativeValues = {
        tokenUsage: {
          ...EMPTY_TOKEN_USAGE_DATA,
          data: [
            {
              timestamp: new Date(),
              totalTokens: -1000, // Negative value
              breakdown: { inputTokens: -600, outputTokens: -400 },
            },
          ],
          totalTokens: -1000,
          totalCost: -0.05,
        },
        taskCompletion: EMPTY_TASK_COMPLETION_DATA,
        costTrend: EMPTY_COST_TREND_DATA,
        timeRange: '24h' as const,
        generatedAt: new Date(),
      }

      expect(() => {
        render(<PerformanceMetricsPanel data={dataWithNegativeValues} />)
      }).not.toThrow()

      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
    })

    it('handles extremely large numbers', () => {
      const dataWithLargeNumbers = {
        tokenUsage: {
          ...EMPTY_TOKEN_USAGE_DATA,
          data: [
            {
              timestamp: new Date(),
              totalTokens: Number.MAX_SAFE_INTEGER,
              breakdown: {
                inputTokens: Number.MAX_SAFE_INTEGER / 2,
                outputTokens: Number.MAX_SAFE_INTEGER / 2,
              },
            },
          ],
          totalTokens: Number.MAX_SAFE_INTEGER,
        },
        taskCompletion: EMPTY_TASK_COMPLETION_DATA,
        costTrend: EMPTY_COST_TREND_DATA,
        timeRange: '24h' as const,
        generatedAt: new Date(),
      }

      expect(() => {
        render(<PerformanceMetricsPanel data={dataWithLargeNumbers} />)
      }).not.toThrow()

      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
    })

    it('handles NaN and Infinity values', () => {
      const dataWithInvalidNumbers = {
        tokenUsage: {
          ...EMPTY_TOKEN_USAGE_DATA,
          data: [
            {
              timestamp: new Date(),
              totalTokens: NaN,
              breakdown: { inputTokens: Infinity, outputTokens: -Infinity },
            },
          ],
          totalTokens: NaN,
          avgTokensPerMinute: Infinity,
        },
        taskCompletion: EMPTY_TASK_COMPLETION_DATA,
        costTrend: EMPTY_COST_TREND_DATA,
        timeRange: '24h' as const,
        generatedAt: new Date(),
      }

      expect(() => {
        render(<PerformanceMetricsPanel data={dataWithInvalidNumbers} />)
      }).not.toThrow()

      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
    })
  })

  describe('Extreme Props Combinations', () => {
    it('handles all charts hidden', () => {
      const data = EMPTY_AGGREGATED_METRICS

      render(
        <PerformanceMetricsPanel
          data={data}
          showTokenUsage={false}
          showTaskCompletion={false}
          showCostTrend={false}
        />
      )

      expect(screen.getByText('No performance data available')).toBeInTheDocument()
      expect(screen.queryByTestId('token-usage-chart')).not.toBeInTheDocument()
      expect(screen.queryByTestId('task-completion-chart')).not.toBeInTheDocument()
      expect(screen.queryByTestId('cost-trend-chart')).not.toBeInTheDocument()
    })

    it('handles conflicting loading and error states', () => {
      render(
        <PerformanceMetricsPanel
          loading={true}
          error="Some error"
          data={EMPTY_AGGREGATED_METRICS}
        />
      )

      // Error state should take precedence
      expect(screen.getByText('Error Loading Performance Metrics')).toBeInTheDocument()
      expect(screen.getByText('Some error')).toBeInTheDocument()
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
    })

    it('handles extremely short auto-refresh interval', () => {
      vi.useFakeTimers()
      const onRefresh = vi.fn()

      render(
        <PerformanceMetricsPanel
          data={EMPTY_AGGREGATED_METRICS}
          autoRefresh={true}
          autoRefreshInterval={1} // 1ms
          onRefresh={onRefresh}
        />
      )

      act(() => {
        vi.advanceTimersByTime(10)
      })

      // Should handle rapid refreshes without breaking
      expect(onRefresh).toHaveBeenCalledTimes(10)

      vi.useRealTimers()
    })

    it('handles zero auto-refresh interval', () => {
      vi.useFakeTimers()
      const onRefresh = vi.fn()

      render(
        <PerformanceMetricsPanel
          data={EMPTY_AGGREGATED_METRICS}
          autoRefresh={true}
          autoRefreshInterval={0} // Invalid interval
          onRefresh={onRefresh}
        />
      )

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should not refresh with zero interval
      expect(onRefresh).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('handles invalid timeRange prop', () => {
      const data = EMPTY_AGGREGATED_METRICS

      expect(() => {
        render(
          <PerformanceMetricsPanel
            data={data}
            timeRange={'invalid-range' as any}
          />
        )
      }).not.toThrow()

      // Should fall back to default behavior
      expect(screen.getByTestId('time-range-selector')).toBeInTheDocument()
    })

    it('handles missing onTimeRangeChange with controlled timeRange', () => {
      const data = EMPTY_AGGREGATED_METRICS

      expect(() => {
        render(
          <PerformanceMetricsPanel
            data={data}
            timeRange="7d"
            // Missing onTimeRangeChange
          />
        )
      }).not.toThrow()

      expect(screen.getByTestId('time-range-selector')).toHaveValue('7d')
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('handles rapid prop changes without memory leaks', () => {
      const { rerender } = render(
        <PerformanceMetricsPanel data={EMPTY_AGGREGATED_METRICS} />
      )

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        rerender(
          <PerformanceMetricsPanel
            data={{
              ...EMPTY_AGGREGATED_METRICS,
              generatedAt: new Date(Date.now() + i),
            }}
            timeRange={i % 2 === 0 ? '24h' : '7d'}
            loading={i % 3 === 0}
          />
        )
      }

      // Should still be functional
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    })

    it('handles component unmounting during auto-refresh', () => {
      vi.useFakeTimers()
      const onRefresh = vi.fn()

      const { unmount } = render(
        <PerformanceMetricsPanel
          data={EMPTY_AGGREGATED_METRICS}
          autoRefresh={true}
          autoRefreshInterval={1000}
          onRefresh={onRefresh}
        />
      )

      // Start the interval
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // Unmount before interval fires
      unmount()

      // Advance past when interval would have fired
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should not crash or call onRefresh after unmount
      expect(onRefresh).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('Browser Compatibility Edge Cases', () => {
    it('handles missing window.matchMedia', () => {
      // Temporarily remove matchMedia
      const originalMatchMedia = window.matchMedia
      delete (window as any).matchMedia

      expect(() => {
        render(<PerformanceMetricsPanel data={EMPTY_AGGREGATED_METRICS} />)
      }).not.toThrow()

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()

      // Restore matchMedia
      window.matchMedia = originalMatchMedia
    })

    it('handles errors in event handlers gracefully', () => {
      const onRefresh = vi.fn().mockImplementation(() => {
        throw new Error('Refresh failed')
      })

      render(
        <PerformanceMetricsPanel
          data={EMPTY_AGGREGATED_METRICS}
          onRefresh={onRefresh}
        />
      )

      const refreshButton = screen.getByRole('button', {
        name: 'Refresh performance metrics'
      })

      // Should not crash the component when handler throws
      expect(() => {
        fireEvent.click(refreshButton)
      }).not.toThrow()
    })

    it('handles time range change errors gracefully', () => {
      const onTimeRangeChange = vi.fn().mockImplementation(() => {
        throw new Error('Time range change failed')
      })

      render(
        <PerformanceMetricsPanel
          data={EMPTY_AGGREGATED_METRICS}
          onTimeRangeChange={onTimeRangeChange}
        />
      )

      const selector = screen.getByTestId('time-range-selector')

      expect(() => {
        fireEvent.change(selector, { target: { value: '7d' } })
      }).not.toThrow()
    })
  })

  describe('Data Structure Edge Cases', () => {
    it('handles arrays with mixed data types', () => {
      const mixedData = {
        tokenUsage: {
          ...EMPTY_TOKEN_USAGE_DATA,
          data: [
            {
              timestamp: new Date(),
              totalTokens: 1000,
              breakdown: { inputTokens: 600, outputTokens: 400 },
            },
            'invalid-data-point' as any,
            {
              timestamp: new Date(),
              totalTokens: 2000,
              breakdown: { inputTokens: 1200, outputTokens: 800 },
            },
          ],
        },
        taskCompletion: EMPTY_TASK_COMPLETION_DATA,
        costTrend: EMPTY_COST_TREND_DATA,
        timeRange: '24h' as const,
        generatedAt: new Date(),
      }

      expect(() => {
        render(<PerformanceMetricsPanel data={mixedData} />)
      }).not.toThrow()

      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
    })

    it('handles circular references in data', () => {
      const circularData: any = {
        tokenUsage: EMPTY_TOKEN_USAGE_DATA,
        taskCompletion: EMPTY_TASK_COMPLETION_DATA,
        costTrend: EMPTY_COST_TREND_DATA,
        timeRange: '24h',
        generatedAt: new Date(),
      }

      // Create circular reference
      circularData.self = circularData

      expect(() => {
        render(<PerformanceMetricsPanel data={circularData} />)
      }).not.toThrow()

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
    })

    it('handles deeply nested corrupted data', () => {
      const corruptedData = {
        tokenUsage: {
          ...EMPTY_TOKEN_USAGE_DATA,
          data: [
            {
              timestamp: new Date(),
              totalTokens: 1000,
              breakdown: {
                inputTokens: {
                  toString: () => { throw new Error('Corrupted data') },
                  valueOf: () => 600,
                },
                outputTokens: 400,
              },
            },
          ],
        },
        taskCompletion: EMPTY_TASK_COMPLETION_DATA,
        costTrend: EMPTY_COST_TREND_DATA,
        timeRange: '24h' as const,
        generatedAt: new Date(),
      }

      expect(() => {
        render(<PerformanceMetricsPanel data={corruptedData} />)
      }).not.toThrow()

      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
    })
  })

  describe('State Management Edge Cases', () => {
    it('handles rapid state changes without race conditions', async () => {
      vi.useFakeTimers()

      const onTimeRangeChange = vi.fn()
      const { rerender } = render(
        <PerformanceMetricsPanel
          data={EMPTY_AGGREGATED_METRICS}
          timeRange="1h"
          onTimeRangeChange={onTimeRangeChange}
        />
      )

      // Rapid changes
      const timeRanges = ['6h', '24h', '7d', '30d', '1h'] as const

      timeRanges.forEach((range, index) => {
        act(() => {
          rerender(
            <PerformanceMetricsPanel
              data={EMPTY_AGGREGATED_METRICS}
              timeRange={range}
              onTimeRangeChange={onTimeRangeChange}
            />
          )
        })
      })

      // Should settle on the final state
      expect(screen.getByTestId('time-range-selector')).toHaveValue('1h')

      vi.useRealTimers()
    })

    it('maintains consistency when props change during loading', () => {
      const { rerender } = render(
        <PerformanceMetricsPanel
          data={undefined}
          loading={true}
        />
      )

      // Change props while loading
      rerender(
        <PerformanceMetricsPanel
          data={EMPTY_AGGREGATED_METRICS}
          loading={true}
          timeRange="7d"
          showTokenUsage={false}
        />
      )

      // Complete loading
      rerender(
        <PerformanceMetricsPanel
          data={EMPTY_AGGREGATED_METRICS}
          loading={false}
          timeRange="7d"
          showTokenUsage={false}
        />
      )

      // Should respect final prop state
      expect(screen.getByTestId('time-range-selector')).toHaveValue('7d')
      expect(screen.queryByTestId('token-usage-chart')).not.toBeInTheDocument()
    })
  })
})