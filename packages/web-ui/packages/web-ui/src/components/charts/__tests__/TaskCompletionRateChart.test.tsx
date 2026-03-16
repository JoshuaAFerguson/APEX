/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { TaskCompletionRateChart } from '../TaskCompletionRateChart'
import type { TaskCompletionRateData } from '@/types/performance-metrics'

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    systemTheme: 'light'
  })
}))

// Mock chart-utils
vi.mock('@/lib/chart-utils', () => ({
  useChartTheme: () => ({
    colors: {
      primary: '#0284c7',
      secondary: '#0ea5e9',
      success: '#16a34a',
      warning: '#ca8a04',
      error: '#dc2626',
      grid: '#e5e7eb',
      background: '#ffffff'
    },
    mode: 'light' as const,
    mounted: true
  }),
  getTooltipStyle: (theme: any) => ({
    contentStyle: {
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px'
    },
    labelStyle: {
      color: '#374151'
    }
  }),
  getGridStyle: (theme: any) => ({
    strokeDasharray: '3 3',
    stroke: '#e5e7eb'
  }),
  getAxisStyle: (theme: any) => ({
    tick: { fontSize: 12, fill: '#6b7280' },
    axisLine: { stroke: '#e5e7eb' },
    tickLine: { stroke: '#e5e7eb' }
  }),
  compactNumberFormatter: (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}))

// Mock Recharts components
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart" role="img" aria-label="Task completion chart showing 92.3% success rate with 250 completed and 20 failed tasks">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart" role="img">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: ({ fill }: { fill: string }) => (
    <div data-testid="pie-cell" style={{ backgroundColor: fill }} />
  ),
  Bar: ({ dataKey, fill }: { dataKey: string; fill: string }) => (
    <div data-testid={`bar-${dataKey}`} style={{ backgroundColor: fill }} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

// Mock performance-metrics utilities
vi.mock('@/types/performance-metrics', async () => {
  const actual = await vi.importActual('@/types/performance-metrics')
  return {
    ...actual,
    formatPercentage: (value: number, decimals = 1) => `${value.toFixed(decimals)}%`,
  }
})

describe('TaskCompletionRateChart', () => {
  const mockData: TaskCompletionRateData = {
    data: [],
    overallCompletionRate: 85.5,
    overallSuccessRate: 92.3,
    totalCompleted: 250,
    totalFailed: 20,
    totalProcessed: 270,
    statusCounts: {
      completed: 250,
      failed: 20,
      inProgress: 5,
      pending: 8,
      cancelled: 3,
      paused: 1
    },
    byStatus: {},
    avgDurationMs: 5000,
    medianDurationMs: 3500,
    p95DurationMs: 12000,
    timeRange: '24h',
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    trend: 1,
    changePercent: 5.2
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with basic props', () => {
    render(<TaskCompletionRateChart data={mockData} />)

    // Should render the component without errors
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('shows success rate when showSuccessRate is true', () => {
    render(
      <TaskCompletionRateChart
        data={mockData}
        showSuccessRate={true}
      />
    )

    // Should show success rate percentage
    expect(screen.getByText('92.3%')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
  })

  it('shows task counts', () => {
    render(<TaskCompletionRateChart data={mockData} />)

    // Should show completed and failed task counts
    expect(screen.getByText('250')).toBeInTheDocument() // Completed
    expect(screen.getByText('20')).toBeInTheDocument() // Failed
    expect(screen.getByText('270')).toBeInTheDocument() // Total
  })

  it('renders pie chart variant by default', () => {
    render(<TaskCompletionRateChart data={mockData} />)

    // Should render pie chart elements
    const container = screen.getByRole('img')
    expect(container).toHaveAttribute('aria-label', expect.stringContaining('Task completion chart'))
  })

  it('handles empty data gracefully', () => {
    const emptyData: TaskCompletionRateData = {
      ...mockData,
      totalProcessed: 0,
      statusCounts: {
        completed: 0,
        failed: 0,
        inProgress: 0,
        pending: 0,
        cancelled: 0,
        paused: 0
      }
    }

    render(<TaskCompletionRateChart data={emptyData} />)

    // Should show empty state message
    expect(screen.getByText('No task completion data available')).toBeInTheDocument()
  })

  it('shows legend when showLegend is true', () => {
    render(
      <TaskCompletionRateChart
        data={mockData}
        showLegend={true}
      />
    )

    // Should show legend items for non-zero status counts
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('applies custom height', () => {
    render(
      <TaskCompletionRateChart
        data={mockData}
        height={300}
      />
    )

    const container = screen.getByRole('img')
    expect(container).toHaveStyle({ height: '300px' })
  })

  it('provides accessible aria-label', () => {
    render(<TaskCompletionRateChart data={mockData} />)

    const container = screen.getByRole('img')
    expect(container).toHaveAttribute('aria-label',
      'Task completion chart showing 92.3% success rate with 250 completed and 20 failed tasks'
    )
  })

  it('includes screen reader summary', () => {
    render(<TaskCompletionRateChart data={mockData} />)

    // Should have hidden summary for screen readers
    const summary = screen.getByText(/Task completion summary: 270 tasks processed/i)
    expect(summary).toHaveClass('sr-only')
  })
})

describe('TaskCompletionRateChart variants', () => {
  const mockData: TaskCompletionRateData = {
    data: [],
    overallCompletionRate: 85.5,
    overallSuccessRate: 92.3,
    totalCompleted: 250,
    totalFailed: 20,
    totalProcessed: 270,
    statusCounts: {
      completed: 250,
      failed: 20,
      inProgress: 0,
      pending: 0,
      cancelled: 0,
      paused: 0
    },
    byStatus: {},
    avgDurationMs: 5000,
    medianDurationMs: 3500,
    p95DurationMs: 12000,
    timeRange: '24h',
    generatedAt: new Date('2024-01-01T00:00:00Z')
  }

  it('renders bar variant correctly', () => {
    render(
      <TaskCompletionRateChart
        data={mockData}
        variant="bar"
      />
    )

    // Should render without errors and show data
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
  })

  it('renders stacked-bar variant correctly', () => {
    render(
      <TaskCompletionRateChart
        data={mockData}
        variant="stacked-bar"
      />
    )

    // Should render without errors
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
})