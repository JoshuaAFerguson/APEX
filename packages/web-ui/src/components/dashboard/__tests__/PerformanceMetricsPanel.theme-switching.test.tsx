/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ThemeProvider } from 'next-themes'
import { PerformanceMetricsPanel } from '../PerformanceMetricsPanel'
import type {
  AggregatedPerformanceMetrics,
  PerformanceMetricsPanelProps,
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

// Mock chart components with theme-aware rendering
vi.mock('@/components/charts/TokenUsageOverTimeChart', () => ({
  TokenUsageOverTimeChart: ({ data, colors, variant, animated, showLegend, showBreakdown }: any) => (
    <div
      data-testid="token-usage-chart"
      data-colors={colors ? JSON.stringify(colors) : undefined}
      data-variant={variant}
      data-animated={animated}
      data-show-legend={showLegend}
      data-show-breakdown={showBreakdown}
      style={{
        backgroundColor: colors?.background || 'white',
        color: colors?.text || 'black',
      }}
      role="img"
      aria-label="Token Usage Chart"
    >
      Token Usage Chart - Theme: {colors?.mode || 'light'}
    </div>
  ),
}))

vi.mock('@/components/charts/TaskCompletionRateChart', () => ({
  TaskCompletionRateChart: ({ data, colors, variant, showSuccessRate }: any) => (
    <div
      data-testid="task-completion-chart"
      data-colors={colors ? JSON.stringify(colors) : undefined}
      data-variant={variant}
      data-show-success-rate={showSuccessRate}
      style={{
        backgroundColor: colors?.background || 'white',
        color: colors?.text || 'black',
      }}
      role="img"
      aria-label="Task Completion Rate Chart"
    >
      Task Completion Chart - Theme: {colors?.mode || 'light'}
    </div>
  ),
}))

vi.mock('@/components/charts/CostTrendChart', () => ({
  CostTrendChart: ({ data, colors, variant, showBudgetLimit, showProjection }: any) => (
    <div
      data-testid="cost-trend-chart"
      data-colors={colors ? JSON.stringify(colors) : undefined}
      data-variant={variant}
      data-show-budget-limit={showBudgetLimit}
      data-show-projection={showProjection}
      style={{
        backgroundColor: colors?.background || 'white',
        color: colors?.text || 'black',
      }}
      role="img"
      aria-label="Cost Trend Chart"
    >
      Cost Trend Chart - Theme: {colors?.mode || 'light'}
    </div>
  ),
}))

// Mock UI components with theme awareness
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div
      className={className}
      data-testid="card"
      data-theme-aware="true"
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

// Mock chart utilities with theme switching capability
const lightTheme = {
  colors: {
    categorical: ['#0ea5e9', '#8b5cf6', '#22c55e'],
    primary: '#0ea5e9',
    secondary: '#0369a1',
    success: '#22c55e',
    grid: '#e4e4e7',
    axis: '#d4d4d8',
    text: '#09090b',
    textMuted: '#52525b',
    background: '#ffffff',
    tooltipBackground: '#f4f4f5',
    tooltipBorder: '#e4e4e7',
  },
  mode: 'light' as const,
  mounted: true,
}

const darkTheme = {
  colors: {
    categorical: ['#38bdf8', '#a78bfa', '#4ade80'],
    primary: '#38bdf8',
    secondary: '#0284c7',
    success: '#4ade80',
    grid: '#3f3f46',
    axis: '#52525b',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    background: '#0a0a0a',
    tooltipBackground: '#1f1f23',
    tooltipBorder: '#3f3f46',
  },
  mode: 'dark' as const,
  mounted: true,
}

let currentTheme = lightTheme

vi.mock('@/lib/chart-utils', () => ({
  useChartTheme: () => currentTheme,
  getTooltipStyle: () => ({
    contentStyle: { backgroundColor: currentTheme.colors.tooltipBackground },
    labelStyle: { color: currentTheme.colors.text },
  }),
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

// Theme wrapper components
const LightThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
    {children}
  </ThemeProvider>
)

const DarkThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
    {children}
  </ThemeProvider>
)

// Test helper for rendering with theme
const renderWithTheme = (
  component: React.ReactElement,
  theme: 'light' | 'dark' = 'light'
) => {
  const Wrapper = theme === 'light' ? LightThemeWrapper : DarkThemeWrapper
  currentTheme = theme === 'light' ? lightTheme : darkTheme

  return render(<Wrapper>{component}</Wrapper>)
}

describe('PerformanceMetricsPanel - Theme Switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentTheme = lightTheme // Reset to light theme
  })

  describe('Light Theme', () => {
    it('renders correctly in light theme', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithTheme(
        <PerformanceMetricsPanel data={mockData} />,
        'light'
      )

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
      expect(screen.getByText('Token Usage Chart - Theme: light')).toBeInTheDocument()
      expect(screen.getByText('Task Completion Chart - Theme: light')).toBeInTheDocument()
      expect(screen.getByText('Cost Trend Chart - Theme: light')).toBeInTheDocument()
    })

    it('applies light theme colors to card container', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithTheme(
        <PerformanceMetricsPanel data={mockData} />,
        'light'
      )

      const card = screen.getByTestId('card')
      expect(card).toHaveAttribute('data-theme-aware', 'true')
    })

    it('passes light theme colors to chart components', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithTheme(
        <PerformanceMetricsPanel
          data={mockData}
          colors={lightTheme.colors}
        />,
        'light'
      )

      const tokenChart = screen.getByTestId('token-usage-chart')
      const taskChart = screen.getByTestId('task-completion-chart')
      const costChart = screen.getByTestId('cost-trend-chart')

      expect(tokenChart).toHaveAttribute('data-colors')
      expect(taskChart).toHaveAttribute('data-colors')
      expect(costChart).toHaveAttribute('data-colors')

      expect(tokenChart).toHaveStyle('background-color: #ffffff')
      expect(taskChart).toHaveStyle('background-color: #ffffff')
      expect(costChart).toHaveStyle('background-color: #ffffff')
    })
  })

  describe('Dark Theme', () => {
    it('renders correctly in dark theme', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithTheme(
        <PerformanceMetricsPanel
          data={mockData}
          colors={darkTheme.colors}
        />,
        'dark'
      )

      expect(screen.getByText('Performance Metrics')).toBeInTheDocument()
      expect(screen.getByText('Token Usage Chart - Theme: dark')).toBeInTheDocument()
      expect(screen.getByText('Task Completion Chart - Theme: dark')).toBeInTheDocument()
      expect(screen.getByText('Cost Trend Chart - Theme: dark')).toBeInTheDocument()
    })

    it('applies dark theme colors to card container', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithTheme(
        <PerformanceMetricsPanel data={mockData} />,
        'dark'
      )

      const card = screen.getByTestId('card')
      expect(card).toHaveAttribute('data-theme-aware', 'true')
    })

    it('passes dark theme colors to chart components', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithTheme(
        <PerformanceMetricsPanel
          data={mockData}
          colors={darkTheme.colors}
        />,
        'dark'
      )

      const tokenChart = screen.getByTestId('token-usage-chart')
      const taskChart = screen.getByTestId('task-completion-chart')
      const costChart = screen.getByTestId('cost-trend-chart')

      expect(tokenChart).toHaveAttribute('data-colors')
      expect(taskChart).toHaveAttribute('data-colors')
      expect(costChart).toHaveAttribute('data-colors')

      expect(tokenChart).toHaveStyle('background-color: #0a0a0a')
      expect(taskChart).toHaveStyle('background-color: #0a0a0a')
      expect(costChart).toHaveStyle('background-color: #0a0a0a')
    })
  })

  describe('Theme Transitions', () => {
    it('handles theme switching from light to dark gracefully', () => {
      const mockData = createMockPerformanceMetrics()

      const { rerender } = renderWithTheme(
        <PerformanceMetricsPanel
          data={mockData}
          colors={lightTheme.colors}
        />,
        'light'
      )

      // Verify light theme initial render
      expect(screen.getByText('Token Usage Chart - Theme: light')).toBeInTheDocument()

      // Switch to dark theme
      currentTheme = darkTheme
      rerender(
        <DarkThemeWrapper>
          <PerformanceMetricsPanel
            data={mockData}
            colors={darkTheme.colors}
          />
        </DarkThemeWrapper>
      )

      // Verify dark theme after transition
      expect(screen.getByText('Token Usage Chart - Theme: dark')).toBeInTheDocument()
    })

    it('handles theme switching from dark to light gracefully', () => {
      const mockData = createMockPerformanceMetrics()

      const { rerender } = renderWithTheme(
        <PerformanceMetricsPanel
          data={mockData}
          colors={darkTheme.colors}
        />,
        'dark'
      )

      // Verify dark theme initial render
      expect(screen.getByText('Token Usage Chart - Theme: dark')).toBeInTheDocument()

      // Switch to light theme
      currentTheme = lightTheme
      rerender(
        <LightThemeWrapper>
          <PerformanceMetricsPanel
            data={mockData}
            colors={lightTheme.colors}
          />
        </LightThemeWrapper>
      )

      // Verify light theme after transition
      expect(screen.getByText('Token Usage Chart - Theme: light')).toBeInTheDocument()
    })

    it('maintains functionality during theme transitions', () => {
      const mockData = createMockPerformanceMetrics()
      const onTimeRangeChange = vi.fn()

      const { rerender } = renderWithTheme(
        <PerformanceMetricsPanel
          data={mockData}
          onTimeRangeChange={onTimeRangeChange}
          colors={lightTheme.colors}
        />,
        'light'
      )

      let selector = screen.getByTestId('time-range-selector')

      // Test functionality in light theme
      fireEvent.change(selector, { target: { value: '7d' } })
      expect(onTimeRangeChange).toHaveBeenCalledWith('7d')

      // Switch to dark theme
      currentTheme = darkTheme
      rerender(
        <DarkThemeWrapper>
          <PerformanceMetricsPanel
            data={mockData}
            onTimeRangeChange={onTimeRangeChange}
            colors={darkTheme.colors}
          />
        </DarkThemeWrapper>
      )

      // Test functionality still works in dark theme
      selector = screen.getByTestId('time-range-selector')
      fireEvent.change(selector, { target: { value: '30d' } })
      expect(onTimeRangeChange).toHaveBeenCalledWith('30d')
    })

    it('preserves state across theme changes', () => {
      const mockData = createMockPerformanceMetrics()

      const { rerender } = renderWithTheme(
        <PerformanceMetricsPanel
          data={mockData}
          timeRange="7d"
        />,
        'light'
      )

      const selector = screen.getByTestId('time-range-selector')
      expect(selector).toHaveValue('7d')

      // Switch theme
      currentTheme = darkTheme
      rerender(
        <DarkThemeWrapper>
          <PerformanceMetricsPanel
            data={mockData}
            timeRange="7d"
          />
        </DarkThemeWrapper>
      )

      // State should be preserved
      expect(selector).toHaveValue('7d')
    })
  })

  describe('Theme-Specific UI States', () => {
    it('displays loading state appropriately in both themes', () => {
      const mockData = createMockPerformanceMetrics()

      // Light theme loading
      renderWithTheme(
        <PerformanceMetricsPanel
          data={mockData}
          loading={true}
          colors={lightTheme.colors}
        />,
        'light'
      )

      expect(screen.getByText('Updating...')).toBeInTheDocument()

      // Clean up before next render
      cleanup()

      // Dark theme loading
      render(
        <DarkThemeWrapper>
          <PerformanceMetricsPanel
            data={mockData}
            loading={true}
            colors={darkTheme.colors}
          />
        </DarkThemeWrapper>
      )

      expect(screen.getByText('Updating...')).toBeInTheDocument()
    })

    it('displays empty state appropriately in both themes', () => {
      // Light theme empty
      renderWithTheme(
        <PerformanceMetricsPanel data={undefined} colors={lightTheme.colors} />,
        'light'
      )

      expect(screen.getByText('No performance data available')).toBeInTheDocument()

      // Clean up before next render
      cleanup()

      // Dark theme empty
      render(
        <DarkThemeWrapper>
          <PerformanceMetricsPanel data={undefined} colors={darkTheme.colors} />
        </DarkThemeWrapper>
      )

      expect(screen.getByText('No performance data available')).toBeInTheDocument()
    })

    it('displays error state appropriately in both themes', () => {
      const errorMessage = 'Failed to load data'

      // Light theme error
      renderWithTheme(
        <PerformanceMetricsPanel error={errorMessage} colors={lightTheme.colors} />,
        'light'
      )

      expect(screen.getByText('Error Loading Performance Metrics')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()

      // Clean up before next render
      cleanup()

      // Dark theme error
      render(
        <DarkThemeWrapper>
          <PerformanceMetricsPanel error={errorMessage} colors={darkTheme.colors} />
        </DarkThemeWrapper>
      )

      expect(screen.getByText('Error Loading Performance Metrics')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  describe('Theme Color Inheritance', () => {
    it('properly passes theme colors to child charts when not explicitly provided', () => {
      const mockData = createMockPerformanceMetrics()

      renderWithTheme(
        <PerformanceMetricsPanel data={mockData} />,
        'light'
      )

      // Charts should inherit theme colors even without explicit color props
      const charts = screen.getAllByText(/Chart - Theme: light/)
      expect(charts).toHaveLength(3)
    })

    it('respects explicit color overrides in both themes', () => {
      const mockData = createMockPerformanceMetrics()
      const customColors = {
        primary: '#ff0000',
        secondary: '#00ff00',
        background: '#0000ff',
        text: '#ffff00',
        mode: 'custom' as const
      }

      renderWithTheme(
        <PerformanceMetricsPanel
          data={mockData}
          colors={customColors}
        />,
        'light'
      )

      const tokenChart = screen.getByTestId('token-usage-chart')
      expect(tokenChart).toHaveStyle('background-color: #0000ff')
      expect(tokenChart).toHaveStyle('color: #ffff00')
    })
  })

  describe('Responsive Behavior with Theme', () => {
    it('maintains responsive grid layout in both themes', () => {
      const mockData = createMockPerformanceMetrics()

      // Light theme
      renderWithTheme(
        <PerformanceMetricsPanel data={mockData} />,
        'light'
      )

      const lightGridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(lightGridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')

      // Dark theme
      const { rerender } = render(
        <DarkThemeWrapper>
          <PerformanceMetricsPanel data={mockData} />
        </DarkThemeWrapper>
      )

      const darkGridContainer = screen.getByTestId('card-content').querySelector('.grid')
      expect(darkGridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
    })
  })
})