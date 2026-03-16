/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import type { TaskCompletionRateData } from '@/types/performance-metrics'

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

// Mock Recharts with simple components
vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Pie: ({ dataKey }: any) => <div data-testid={`pie-${dataKey}`} />,
  Cell: () => <div data-testid="pie-cell" />,
  Bar: ({ dataKey }: any) => <div data-testid={`bar-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

// Mock chart utils
vi.mock('@/lib/chart-utils', () => ({
  useChartTheme: () => ({
    colors: { primary: '#0ea5e9', background: '#ffffff', border: '#e4e4e7' },
    mode: 'light' as const,
    mounted: true,
  }),
  getTooltipStyle: () => ({ contentStyle: {}, labelStyle: {} }),
  getGridStyle: () => ({}),
  getAxisStyle: () => ({}),
  compactNumberFormatter: (value: number) => value.toString(),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}))

// Mock formatPercentage directly from the module
vi.mock('@/types/performance-metrics', async (importOriginal) => {
  return {
    ...((await importOriginal()) as any),
    formatPercentage: (value: number, decimals: number = 1) => `${value.toFixed(decimals)}%`,
  }
})

// Import the component after mocking
const { TaskCompletionRateChart, TaskCompletionRateChartMini } = await import('../TaskCompletionRateChart')

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      {children}
    </ThemeProvider>
  )
}

function createTestData(): TaskCompletionRateData {
  return {
    data: [],
    overallCompletionRate: 78.5,
    overallSuccessRate: 84.2,
    totalCompleted: 1200,
    totalFailed: 180,
    totalProcessed: 1380,
    statusCounts: {
      completed: 1200,
      failed: 180,
      cancelled: 50,
      inProgress: 25,
      pending: 75,
      paused: 10,
    },
    byStatus: {
      completed: 1200,
      failed: 180,
      cancelled: 50,
    },
    avgDurationMs: 2500,
    medianDurationMs: 2200,
    p95DurationMs: 4500,
    timeRange: '24h',
    generatedAt: new Date(),
    trend: 1,
    changePercent: 12.5,
  }
}

describe('TaskCompletionRateChart Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders pie chart by default', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('displays success rate', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('84.2%')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
    })

    it('displays task statistics', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('1,200')).toBeInTheDocument() // Completed
      expect(screen.getByText('180')).toBeInTheDocument() // Failed
      expect(screen.getByText('1,380')).toBeInTheDocument() // Total
    })

    it('shows task status labels', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getAllByText('Completed')).toHaveLength(2) // One in stats, one in legend
      expect(screen.getAllByText('Failed')).toHaveLength(2) // One in stats, one in legend
    })

    it('renders with custom height', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} height={400} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveStyle({ height: '400px' })
    })

    it('applies custom className', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} className="custom-class" />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveClass('custom-class')
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no data', () => {
      const emptyData = {
        ...createTestData(),
        statusCounts: {
          completed: 0,
          failed: 0,
          cancelled: 0,
          inProgress: 0,
          pending: 0,
          paused: 0,
        },
        totalProcessed: 0,
        totalCompleted: 0,
        totalFailed: 0,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No task completion data available')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA label', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')

      const ariaLabel = chart.getAttribute('aria-label')
      expect(ariaLabel).toContain('Task completion chart')
      expect(ariaLabel).toContain('84.2% success rate')
    })

    it('includes screen reader summary', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Task completion summary/, { selector: '.sr-only' })
      expect(summary).toBeInTheDocument()
      expect(summary.textContent).toContain('1,380 tasks processed')
      expect(summary.textContent).toContain('1,200 completed')
      expect(summary.textContent).toContain('180 failed')
    })
  })

  describe('Bar Variant', () => {
    it('renders status distribution bars', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} variant="bar" />
        </TestWrapper>
      )

      // Should show horizontal status bars with labels
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
      expect(screen.getByText('Cancelled')).toBeInTheDocument()
    })
  })
})

describe('TaskCompletionRateChartMini Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders mini chart', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={data} />
        </TestWrapper>
      )

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('displays essential information', () => {
      const data = createTestData()

      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('84%')).toBeInTheDocument() // Success rate
      expect(screen.getByText('1,200 / 1,380 tasks')).toBeInTheDocument() // Task counts
    })

    it('handles empty state', () => {
      const emptyData = {
        ...createTestData(),
        statusCounts: {
          completed: 0,
          failed: 0,
          cancelled: 0,
          inProgress: 0,
          pending: 0,
          paused: 0,
        },
        totalProcessed: 0,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No data')).toBeInTheDocument()
    })
  })
})

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles zero success rate', () => {
    const data = {
      ...createTestData(),
      overallSuccessRate: 0,
      totalCompleted: 0,
      totalFailed: 100,
      statusCounts: {
        completed: 0,
        failed: 100,
        cancelled: 0,
        inProgress: 0,
        pending: 0,
        paused: 0,
      },
    }

    render(
      <TestWrapper>
        <TaskCompletionRateChart data={data} />
      </TestWrapper>
    )

    expect(screen.getByText('0.0%')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('handles 100% success rate', () => {
    const data = {
      ...createTestData(),
      overallSuccessRate: 100,
      totalFailed: 0,
      statusCounts: {
        completed: 100,
        failed: 0,
        cancelled: 0,
        inProgress: 0,
        pending: 0,
        paused: 0,
      },
    }

    render(
      <TestWrapper>
        <TaskCompletionRateChart data={data} />
      </TestWrapper>
    )

    expect(screen.getByText('100.0%')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('handles single task completed', () => {
    const data = {
      ...createTestData(),
      totalCompleted: 1,
      totalFailed: 0,
      totalProcessed: 1,
      overallSuccessRate: 100,
      statusCounts: {
        completed: 1,
        failed: 0,
        cancelled: 0,
        inProgress: 0,
        pending: 0,
        paused: 0,
      },
    }

    render(
      <TestWrapper>
        <TaskCompletionRateChart data={data} />
      </TestWrapper>
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('100.0%')).toBeInTheDocument()
  })
})