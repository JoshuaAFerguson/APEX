/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PerformanceMetricsPanel } from '../PerformanceMetricsPanel'
import type {
  AggregatedPerformanceMetrics,
  PerformanceMetricsPanelProps,
} from '@/types/performance-metrics'

// Mock window.matchMedia with responsive capability
const createMockMatchMedia = (queries: Record<string, boolean>) => {
  return vi.fn().mockImplementation((query: string) => ({
    matches: queries[query] || false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Mock chart components with responsive rendering
vi.mock('@/components/charts/TokenUsageOverTimeChart', () => ({
  TokenUsageOverTimeChart: ({ data, height, variant, animated, showLegend, showBreakdown, ...props }: any) => (
    <div
      data-testid="token-usage-chart"
      data-height={height}
      data-variant={variant}
      data-animated={animated}
      data-show-legend={showLegend}
      data-show-breakdown={showBreakdown}
      style={{ height: height || 240 }}
      role="img"
      aria-label="Token Usage Chart"
    >
      Token Usage Chart - Height: {height || 240}px
    </div>
  ),
}))

vi.mock('@/components/charts/TaskCompletionRateChart', () => ({
  TaskCompletionRateChart: ({ data, height, variant, showSuccessRate, ...props }: any) => (
    <div
      data-testid="task-completion-chart"
      data-height={height}
      data-variant={variant}
      data-show-success-rate={showSuccessRate}
      style={{ height: height || 240 }}
      role="img"
      aria-label="Task Completion Rate Chart"
    >
      Task Completion Chart - Height: {height || 240}px
    </div>
  ),
}))

vi.mock('@/components/charts/CostTrendChart', () => ({
  CostTrendChart: ({ data, height, variant, showBudgetLimit, showProjection, ...props }: any) => (
    <div
      data-testid="cost-trend-chart"
      data-height={height}
      data-variant={variant}
      data-show-budget-limit={showBudgetLimit}
      data-show-projection={showProjection}
      style={{ height: height || 240 }}
      role="img"
      aria-label="Cost Trend Chart"
    >
      Cost Trend Chart - Height: {height || 240}px
    </div>
  ),
}))

// Mock UI components with responsive awareness
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div
      className={className}
      data-testid="card"
      {...props}
    >
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

// Helper function to render component with specific viewport
const renderWithViewport = (
  component: React.ReactElement,
  viewport: 'mobile' | 'tablet' | 'desktop'
) => {
  const mediaQueries = {
    mobile: {
      '(min-width: 768px)': false,  // md
      '(min-width: 1024px)': false, // lg
      '(max-width: 767px)': true,
    },
    tablet: {
      '(min-width: 768px)': true,   // md
      '(min-width: 1024px)': false, // lg
      '(max-width: 767px)': false,
      '(max-width: 1023px)': true,
    },
    desktop: {
      '(min-width: 768px)': true,   // md
      '(min-width: 1024px)': true,  // lg
      '(max-width: 767px)': false,
      '(max-width: 1023px)': false,
    }
  }

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMockMatchMedia(mediaQueries[viewport]),
  })

  return render(component)
}

describe('PerformanceMetricsPanel - Responsive Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  afterEach(() => {
    // Reset to default matchMedia
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
  })

  describe('Grid Layout Responsiveness', () => {
    it('uses single column layout on mobile (all charts visible)', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} />,
        'mobile'
      )

      const gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1')

      // All charts should be rendered in single column
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.getByTestId('task-completion-chart')).toBeInTheDocument()
      expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument()
    })

    it('uses two-column layout on tablet with three charts', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} />,
        'tablet'
      )

      const gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2')

      // All charts should be present
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.getByTestId('task-completion-chart')).toBeInTheDocument()
      expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument()
    })

    it('uses three-column layout on desktop', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} />,
        'desktop'
      )

      const gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')

      // All charts should be present
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.getByTestId('task-completion-chart')).toBeInTheDocument()
      expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument()
    })

    it('adapts grid layout when only two charts are visible', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel
          data={mockData}
          showTokenUsage={true}
          showTaskCompletion={true}
          showCostTrend={false}
        />,
        'desktop'
      )

      const gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2')

      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.getByTestId('task-completion-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('cost-trend-chart')).not.toBeInTheDocument()
    })

    it('adapts grid layout when only one chart is visible', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel
          data={mockData}
          showTokenUsage={true}
          showTaskCompletion={false}
          showCostTrend={false}
        />,
        'desktop'
      )

      const gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1')

      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('task-completion-chart')).not.toBeInTheDocument()
      expect(screen.queryByTestId('cost-trend-chart')).not.toBeInTheDocument()
    })
  })

  describe('Chart Size Adaptations', () => {
    it('applies small chart size on mobile', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} chartSize="sm" />,
        'mobile'
      )

      const charts = [
        screen.getByTestId('token-usage-chart'),
        screen.getByTestId('task-completion-chart'),
        screen.getByTestId('cost-trend-chart')
      ]

      charts.forEach(chart => {
        expect(chart).toHaveAttribute('data-height', '160')
        expect(chart).toHaveStyle('height: 160px')
      })
    })

    it('applies medium chart size on tablet', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} chartSize="md" />,
        'tablet'
      )

      const charts = [
        screen.getByTestId('token-usage-chart'),
        screen.getByTestId('task-completion-chart'),
        screen.getByTestId('cost-trend-chart')
      ]

      charts.forEach(chart => {
        expect(chart).toHaveAttribute('data-height', '240')
        expect(chart).toHaveStyle('height: 240px')
      })
    })

    it('applies large chart size on desktop', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} chartSize="lg" />,
        'desktop'
      )

      const charts = [
        screen.getByTestId('token-usage-chart'),
        screen.getByTestId('task-completion-chart'),
        screen.getByTestId('cost-trend-chart')
      ]

      charts.forEach(chart => {
        expect(chart).toHaveAttribute('data-height', '320')
        expect(chart).toHaveStyle('height: 320px')
      })
    })
  })

  describe('Interactive Elements Responsiveness', () => {
    it('maintains time range selector functionality across viewports', () => {
      const mockData = createMockPerformanceMetrics()
      const onTimeRangeChange = vi.fn()

      // Test mobile
      renderWithViewport(
        <PerformanceMetricsPanel
          data={mockData}
          onTimeRangeChange={onTimeRangeChange}
        />,
        'mobile'
      )

      let selector = screen.getByTestId('time-range-selector')
      fireEvent.change(selector, { target: { value: '7d' } })
      expect(onTimeRangeChange).toHaveBeenCalledWith('7d')

      // Clean up before next render
      cleanup()

      // Test tablet
      renderWithViewport(
        <PerformanceMetricsPanel
          data={mockData}
          onTimeRangeChange={onTimeRangeChange}
        />,
        'tablet'
      )

      selector = screen.getByTestId('time-range-selector')
      fireEvent.change(selector, { target: { value: '30d' } })
      expect(onTimeRangeChange).toHaveBeenCalledWith('30d')

      // Clean up before next render
      cleanup()

      // Test desktop
      renderWithViewport(
        <PerformanceMetricsPanel
          data={mockData}
          onTimeRangeChange={onTimeRangeChange}
        />,
        'desktop'
      )

      selector = screen.getByTestId('time-range-selector')
      fireEvent.change(selector, { target: { value: '1h' } })
      expect(onTimeRangeChange).toHaveBeenCalledWith('1h')
    })

    it('maintains refresh button functionality across viewports', () => {
      const mockData = createMockPerformanceMetrics()
      const onRefresh = vi.fn()

      // Test all viewports
      const viewports: Array<'mobile' | 'tablet' | 'desktop'> = ['mobile', 'tablet', 'desktop']

      viewports.forEach(viewport => {
        onRefresh.mockClear()

        renderWithViewport(
          <PerformanceMetricsPanel
            data={mockData}
            onRefresh={onRefresh}
          />,
          viewport
        )

        const refreshButton = screen.getByRole('button', {
          name: 'Refresh performance metrics'
        })
        fireEvent.click(refreshButton)

        expect(onRefresh).toHaveBeenCalledOnce()

        // Clean up before next iteration
        cleanup()
      })
    })
  })

  describe('Content Overflow Handling', () => {
    it('handles long chart titles gracefully on mobile', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} />,
        'mobile'
      )

      // Chart titles should be present and not cause layout issues
      expect(screen.getByText('Token Usage Over Time')).toBeInTheDocument()
      expect(screen.getByText('Task Completion Rate')).toBeInTheDocument()
      expect(screen.getByText('Cost Trend')).toBeInTheDocument()
    })

    it('handles time range selector options on mobile', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} />,
        'mobile'
      )

      const selector = screen.getByTestId('time-range-selector')
      const options = selector.querySelectorAll('option')

      expect(options).toHaveLength(5)
      options.forEach(option => {
        expect(option.textContent).toBeTruthy()
      })
    })
  })

  describe('Viewport Transition Handling', () => {
    it('gracefully handles transitions from mobile to desktop', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} />,
        'mobile'
      )

      // Verify mobile layout
      let gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1')

      // Clean up before switching viewport
      cleanup()

      // Switch to desktop
      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} />,
        'desktop'
      )

      gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')

      // All charts should still be present
      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.getByTestId('task-completion-chart')).toBeInTheDocument()
      expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument()
    })

    it('preserves component state during viewport transitions', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} timeRange="7d" />,
        'mobile'
      )

      // Verify initial state
      let selector = screen.getByTestId('time-range-selector')
      expect(selector).toHaveValue('7d')

      // Clean up before switching viewport
      cleanup()

      // Switch viewport
      renderWithViewport(
        <PerformanceMetricsPanel data={mockData} timeRange="7d" />,
        'desktop'
      )

      // State should be preserved (via props)
      selector = screen.getByTestId('time-range-selector')
      expect(selector).toHaveValue('7d')
    })
  })

  describe('Loading and Error States Responsiveness', () => {
    it('displays loading state appropriately across viewports', () => {
      const mockData = createMockPerformanceMetrics()

      const viewports: Array<'mobile' | 'tablet' | 'desktop'> = ['mobile', 'tablet', 'desktop']

      viewports.forEach(viewport => {
        renderWithViewport(
          <PerformanceMetricsPanel data={mockData} loading={true} />,
          viewport
        )

        expect(screen.getByText('Updating...')).toBeInTheDocument()
        expect(screen.getByText('Performance Metrics')).toBeInTheDocument()

        // Clean up before next iteration
        cleanup()
      })
    })

    it('displays empty state appropriately across viewports', () => {
      const viewports: Array<'mobile' | 'tablet' | 'desktop'> = ['mobile', 'tablet', 'desktop']

      viewports.forEach(viewport => {
        renderWithViewport(
          <PerformanceMetricsPanel data={undefined} />,
          viewport
        )

        expect(screen.getByText('No performance data available')).toBeInTheDocument()

        // Clean up before next iteration
        cleanup()
      })
    })

    it('displays error state appropriately across viewports', () => {
      const errorMessage = 'Network connection failed'

      const viewports: Array<'mobile' | 'tablet' | 'desktop'> = ['mobile', 'tablet', 'desktop']

      viewports.forEach(viewport => {
        renderWithViewport(
          <PerformanceMetricsPanel error={errorMessage} />,
          viewport
        )

        expect(screen.getByText('Error Loading Performance Metrics')).toBeInTheDocument()
        expect(screen.getByText(errorMessage)).toBeInTheDocument()

        // Clean up before next iteration
        cleanup()
      })
    })
  })

  describe('Chart Visibility Controls Responsiveness', () => {
    it('handles selective chart visibility on mobile', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithViewport(
        <PerformanceMetricsPanel
          data={mockData}
          showTokenUsage={true}
          showTaskCompletion={false}
          showCostTrend={true}
        />,
        'mobile'
      )

      expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('task-completion-chart')).not.toBeInTheDocument()
      expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument()

      const gridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2')
    })

    it('adjusts grid layout based on visible charts across all viewports', () => {
      const mockData = createMockPerformanceMetrics()

      // Test with one chart on all viewports
      const viewports: Array<'mobile' | 'tablet' | 'desktop'> = ['mobile', 'tablet', 'desktop']

      viewports.forEach(viewport => {
        renderWithViewport(
          <PerformanceMetricsPanel
            data={mockData}
            showTokenUsage={true}
            showTaskCompletion={false}
            showCostTrend={false}
          />,
          viewport
        )

        const gridContainer = screen.getByTestId('card-content').querySelector('.grid')
        expect(gridContainer).toHaveClass('grid-cols-1')

        // Clean up before next iteration
        cleanup()
      })
    })
  })
})