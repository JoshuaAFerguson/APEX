/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import { PerformanceMetricsPanel } from '../PerformanceMetricsPanel'
import type { AggregatedPerformanceMetrics } from '@/types/performance-metrics'
import { EMPTY_AGGREGATED_METRICS } from '@/types/performance-metrics'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

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

// Mock chart components with accessibility features
vi.mock('@/components/charts/TokenUsageOverTimeChart', () => ({
  TokenUsageOverTimeChart: ({ data, ...props }: any) => (
    <div
      data-testid="token-usage-chart"
      role="img"
      aria-label={`Token usage chart showing ${data?.data?.length || 0} data points over ${data?.timeRange || '24h'}`}
      aria-describedby="token-usage-description"
      tabIndex={0}
      {...props}
    >
      <div id="token-usage-description" className="sr-only">
        Token usage over time chart displaying input and output token consumption patterns.
        Total tokens: {data?.totalTokens || 0}, Cost: ${data?.totalCost || 0}
      </div>
      <div>Token Usage Chart</div>
    </div>
  ),
}))

vi.mock('@/components/charts/TaskCompletionRateChart', () => ({
  TaskCompletionRateChart: ({ data, ...props }: any) => (
    <div
      data-testid="task-completion-chart"
      role="img"
      aria-label={`Task completion chart showing ${data?.data?.length || 0} data points with ${data?.overallCompletionRate || 0}% completion rate`}
      aria-describedby="task-completion-description"
      tabIndex={0}
      {...props}
    >
      <div id="task-completion-description" className="sr-only">
        Task completion rate chart showing success and failure trends.
        Total completed: {data?.totalCompleted || 0}, Success rate: {data?.overallSuccessRate || 0}%
      </div>
      <div>Task Completion Chart</div>
    </div>
  ),
}))

vi.mock('@/components/charts/CostTrendChart', () => ({
  CostTrendChart: ({ data, ...props }: any) => (
    <div
      data-testid="cost-trend-chart"
      role="img"
      aria-label={`Cost trend chart showing ${data?.data?.length || 0} data points with total cost of $${data?.totalCost || 0}`}
      aria-describedby="cost-trend-description"
      tabIndex={0}
      {...props}
    >
      <div id="cost-trend-description" className="sr-only">
        Cost trend chart displaying spending patterns over time.
        Budget utilization: {data?.budgetUtilization || 0}%, Projected cost: ${data?.projectedTotalCost || 0}
      </div>
      <div>Cost Trend Chart</div>
    </div>
  ),
}))

// Mock UI components with accessibility
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
      aria-label="Select time range for performance metrics"
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
    <div
      data-testid="spinner"
      data-size={size}
      role="status"
      aria-live="polite"
      aria-label="Loading performance metrics"
      {...props}
    >
      <span className="sr-only">Loading...</span>
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

// Helper to create accessible test data
function createAccessibleTestData(): AggregatedPerformanceMetrics {
  const baseTime = new Date('2024-01-01T12:00:00Z')

  return {
    tokenUsage: {
      data: Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000),
        totalTokens: 1000 + i * 100,
        breakdown: {
          inputTokens: 600 + i * 60,
          outputTokens: 400 + i * 40,
        },
        tokensPerMinute: 50 + i * 5,
        cost: 0.01 + i * 0.005,
      })),
      totalInputTokens: 3300,
      totalOutputTokens: 2200,
      totalTokens: 5500,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      cacheHitRate: 0,
      avgTokensPerMinute: 65.2,
      peakTokensPerMinute: 75,
      totalCost: 0.055,
      timeRange: '24h',
      generatedAt: new Date(),
      trend: 1,
      changePercent: 12.5,
    },
    taskCompletion: {
      data: Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000),
        completionRate: 85 + i * 2,
        successRate: 90 + i * 1,
        completedCount: 10 + i * 2,
        failedCount: 1 + i,
        totalProcessed: 12 + i * 3,
        avgDurationMs: 2000 + i * 200,
      })),
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
      byStatus: { completed: 60, failed: 8 },
      avgDurationMs: 2400,
      medianDurationMs: 2200,
      p95DurationMs: 3800,
      timeRange: '24h',
      generatedAt: new Date(),
      trend: 1,
      changePercent: 8.2,
    },
    costTrend: {
      data: Array.from({ length: 5 }, (_, i) => ({
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
      })),
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
  }
}

describe('PerformanceMetricsPanel Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Accessibility Compliance', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <PerformanceMetricsPanel data={createAccessibleTestData()} />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations in loading state', async () => {
      const { container } = render(
        <PerformanceMetricsPanel loading={true} data={undefined} />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations in error state', async () => {
      const { container } = render(
        <PerformanceMetricsPanel error="Test error message" />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations in empty state', async () => {
      const { container } = render(
        <PerformanceMetricsPanel data={undefined} />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Semantic Structure', () => {
    it('has proper landmark regions', () => {
      render(<PerformanceMetricsPanel data={createAccessibleTestData()} />)

      const mainRegion = screen.getByRole('region', { name: 'Performance Metrics Panel' })
      expect(mainRegion).toBeInTheDocument()
    })

    it('has proper heading hierarchy', () => {
      render(<PerformanceMetricsPanel data={createAccessibleTestData()} />)

      // Main heading
      const mainHeading = screen.getByRole('heading', { level: 2, name: 'Performance Metrics' })
      expect(mainHeading).toBeInTheDocument()

      // Chart section headings
      const chartHeadings = screen.getAllByRole('heading', { level: 3 })
      expect(chartHeadings).toHaveLength(3)
      expect(chartHeadings[0]).toHaveTextContent('Token Usage Over Time')
      expect(chartHeadings[1]).toHaveTextContent('Task Completion Rate')
      expect(chartHeadings[2]).toHaveTextContent('Cost Trend')
    })

    it('has proper button roles and labels', () => {
      const onRefresh = vi.fn()
      render(
        <PerformanceMetricsPanel
          data={createAccessibleTestData()}
          onRefresh={onRefresh}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh performance metrics' })
      expect(refreshButton).toBeInTheDocument()
      expect(refreshButton).toHaveAttribute('aria-label', 'Refresh performance metrics')
    })

    it('has proper form controls with labels', () => {
      render(<PerformanceMetricsPanel data={createAccessibleTestData()} />)

      const timeRangeSelector = screen.getByRole('combobox', { name: 'Select time range for performance metrics' })
      expect(timeRangeSelector).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation for interactive elements', async () => {
      const user = userEvent.setup()
      const onRefresh = vi.fn()
      const onTimeRangeChange = vi.fn()

      render(
        <PerformanceMetricsPanel
          data={createAccessibleTestData()}
          onRefresh={onRefresh}
          onTimeRangeChange={onTimeRangeChange}
        />
      )

      // Tab to time range selector
      await user.tab()
      const timeRangeSelector = screen.getByTestId('time-range-selector')
      expect(timeRangeSelector).toHaveFocus()

      // Change time range using keyboard
      await user.selectOptions(timeRangeSelector, '7d')
      expect(onTimeRangeChange).toHaveBeenCalledWith('7d')

      // Tab to refresh button
      await user.tab()
      const refreshButton = screen.getByRole('button', { name: 'Refresh performance metrics' })
      expect(refreshButton).toHaveFocus()

      // Activate refresh button
      await user.keyboard('{Enter}')
      expect(onRefresh).toHaveBeenCalled()
    })

    it('supports keyboard navigation for charts', async () => {
      const user = userEvent.setup()
      render(<PerformanceMetricsPanel data={createAccessibleTestData()} />)

      // Charts should be focusable
      const charts = [
        screen.getByTestId('token-usage-chart'),
        screen.getByTestId('task-completion-chart'),
        screen.getByTestId('cost-trend-chart'),
      ]

      for (const chart of charts) {
        chart.focus()
        expect(chart).toHaveFocus()
        expect(chart).toHaveAttribute('tabIndex', '0')
      }
    })

    it('maintains focus management during state changes', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <PerformanceMetricsPanel
          data={createAccessibleTestData()}
          loading={false}
        />
      )

      // Focus on time range selector
      const timeRangeSelector = screen.getByTestId('time-range-selector')
      timeRangeSelector.focus()
      expect(timeRangeSelector).toHaveFocus()

      // Trigger loading state
      rerender(
        <PerformanceMetricsPanel
          data={createAccessibleTestData()}
          loading={true}
        />
      )

      // Focus should be maintained on the selector (now disabled)
      expect(timeRangeSelector).toHaveFocus()
      expect(timeRangeSelector).toBeDisabled()
    })

    it('provides proper tab order', async () => {
      const user = userEvent.setup()
      const onRefresh = vi.fn()

      render(
        <PerformanceMetricsPanel
          data={createAccessibleTestData()}
          onRefresh={onRefresh}
        />
      )

      const focusableElements = [
        screen.getByTestId('time-range-selector'),
        screen.getByRole('button', { name: 'Refresh performance metrics' }),
        screen.getByTestId('token-usage-chart'),
        screen.getByTestId('task-completion-chart'),
        screen.getByTestId('cost-trend-chart'),
      ]

      // Verify tab order
      for (const element of focusableElements) {
        await user.tab()
        expect(element).toHaveFocus()
      }
    })
  })

  describe('Screen Reader Support', () => {
    it('provides appropriate ARIA labels for charts', () => {
      const data = createAccessibleTestData()
      render(<PerformanceMetricsPanel data={data} />)

      const tokenChart = screen.getByTestId('token-usage-chart')
      expect(tokenChart).toHaveAttribute('role', 'img')
      expect(tokenChart).toHaveAttribute('aria-label', expect.stringContaining('Token usage chart'))
      expect(tokenChart).toHaveAttribute('aria-describedby', 'token-usage-description')

      const taskChart = screen.getByTestId('task-completion-chart')
      expect(taskChart).toHaveAttribute('role', 'img')
      expect(taskChart).toHaveAttribute('aria-label', expect.stringContaining('Task completion chart'))

      const costChart = screen.getByTestId('cost-trend-chart')
      expect(costChart).toHaveAttribute('role', 'img')
      expect(costChart).toHaveAttribute('aria-label', expect.stringContaining('Cost trend chart'))
    })

    it('provides screen reader descriptions for charts', () => {
      const data = createAccessibleTestData()
      render(<PerformanceMetricsPanel data={data} />)

      const tokenDescription = screen.getByText(/Token usage over time chart displaying input and output token consumption patterns/i)
      expect(tokenDescription).toHaveClass('sr-only')

      const taskDescription = screen.getByText(/Task completion rate chart showing success and failure trends/i)
      expect(taskDescription).toHaveClass('sr-only')

      const costDescription = screen.getByText(/Cost trend chart displaying spending patterns over time/i)
      expect(costDescription).toHaveClass('sr-only')
    })

    it('announces loading states to screen readers', () => {
      render(<PerformanceMetricsPanel loading={true} data={undefined} />)

      const spinner = screen.getByTestId('spinner')
      expect(spinner).toHaveAttribute('role', 'status')
      expect(spinner).toHaveAttribute('aria-live', 'polite')
      expect(spinner).toHaveAttribute('aria-label', 'Loading performance metrics')

      const srText = screen.getByText('Loading...', { selector: '.sr-only' })
      expect(srText).toBeInTheDocument()
    })

    it('provides live updates for auto-refresh status', () => {
      render(
        <PerformanceMetricsPanel
          data={createAccessibleTestData()}
          autoRefresh={true}
          autoRefreshInterval={30000}
          onRefresh={vi.fn()}
        />
      )

      const autoRefreshIndicator = screen.getByText('Auto-refresh enabled (30s)')
      expect(autoRefreshIndicator).toBeInTheDocument()

      // Should be announced to screen readers
      const footer = screen.getByTestId('card-footer')
      expect(footer).toContainElement(autoRefreshIndicator)
    })
  })

  describe('High Contrast and Visual Support', () => {
    it('maintains accessibility in error state with proper contrast', () => {
      render(<PerformanceMetricsPanel error="Network connection failed" />)

      const errorTitle = screen.getByText('Error Loading Performance Metrics')
      expect(errorTitle).toBeInTheDocument()

      const errorMessage = screen.getByText('Network connection failed')
      expect(errorMessage).toBeInTheDocument()
    })

    it('uses proper semantic HTML for status indicators', () => {
      render(
        <PerformanceMetricsPanel
          data={createAccessibleTestData()}
          autoRefresh={true}
          autoRefreshInterval={15000}
        />
      )

      // Auto-refresh indicator should have semantic meaning
      const indicator = screen.getByText(/Auto-refresh enabled/)
      expect(indicator.parentElement).toContainHTML('w-2 h-2 bg-green-500 rounded-full animate-pulse')
    })

    it('provides accessible empty state messaging', () => {
      render(<PerformanceMetricsPanel data={undefined} />)

      const emptyMessage = screen.getByText('No performance data available')
      expect(emptyMessage).toBeInTheDocument()

      // Should have proper semantic structure for empty state
      const emptyContainer = emptyMessage.closest('div')
      expect(emptyContainer).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center')
    })
  })

  describe('State Announcements', () => {
    it('handles focus management during error recovery', () => {
      const onRefresh = vi.fn()
      const { rerender } = render(
        <PerformanceMetricsPanel
          error="Failed to load data"
          onRefresh={onRefresh}
        />
      )

      // Focus on try again button
      const tryAgainButton = screen.getByRole('button', { name: 'Try Again' })
      tryAgainButton.focus()
      expect(tryAgainButton).toHaveFocus()

      // Recover from error
      rerender(
        <PerformanceMetricsPanel
          data={createAccessibleTestData()}
          onRefresh={onRefresh}
        />
      )

      // Focus should move to a logical location (refresh button)
      const refreshButton = screen.getByRole('button', { name: 'Refresh performance metrics' })
      expect(refreshButton).toBeInTheDocument()
    })

    it('maintains accessible state during partial data updates', () => {
      const partialData = {
        ...EMPTY_AGGREGATED_METRICS,
        tokenUsage: createAccessibleTestData().tokenUsage,
      }

      render(<PerformanceMetricsPanel data={partialData} />)

      // Should still have accessible structure even with partial data
      const tokenChart = screen.getByTestId('token-usage-chart')
      expect(tokenChart).toHaveAttribute('role', 'img')

      const taskChart = screen.getByTestId('task-completion-chart')
      expect(taskChart).toHaveAttribute('role', 'img')
    })
  })

  describe('Color and Visual Accessibility', () => {
    it('does not rely solely on color for information', () => {
      const data = createAccessibleTestData()
      render(<PerformanceMetricsPanel data={data} />)

      // Charts should have text labels in addition to color coding
      expect(screen.getByText('Token Usage Over Time')).toBeInTheDocument()
      expect(screen.getByText('Task Completion Rate')).toBeInTheDocument()
      expect(screen.getByText('Cost Trend')).toBeInTheDocument()

      // Status indicators should have text descriptions
      const lastUpdated = screen.getByText(/Updated (just now|\d+ minutes? ago)/)
      expect(lastUpdated).toBeInTheDocument()
    })

    it('provides sufficient contrast for text elements', () => {
      render(<PerformanceMetricsPanel data={createAccessibleTestData()} />)

      // Main heading should have high contrast
      const mainHeading = screen.getByRole('heading', { level: 2 })
      expect(mainHeading).toHaveClass('text-foreground')

      // Chart titles should be readable
      const chartTitles = screen.getAllByRole('heading', { level: 3 })
      chartTitles.forEach(title => {
        expect(title).toHaveClass('text-foreground-secondary')
      })
    })
  })

  describe('Mobile and Touch Accessibility', () => {
    it('maintains accessibility on smaller screens', () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<PerformanceMetricsPanel data={createAccessibleTestData()} />)

      // Should maintain proper heading structure
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)

      // Interactive elements should still be accessible
      expect(screen.getByTestId('time-range-selector')).toBeInTheDocument()
    })

    it('provides adequate touch targets', () => {
      const onRefresh = vi.fn()
      render(
        <PerformanceMetricsPanel
          data={createAccessibleTestData()}
          onRefresh={onRefresh}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh performance metrics' })

      // Button should be large enough for touch interaction
      // The actual size would depend on CSS, but we can verify it exists and is clickable
      expect(refreshButton).toBeInTheDocument()
      expect(refreshButton).not.toBeDisabled()

      fireEvent.click(refreshButton)
      expect(onRefresh).toHaveBeenCalled()
    })
  })
})