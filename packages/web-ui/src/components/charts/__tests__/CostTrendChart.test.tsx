/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ThemeProvider } from 'next-themes'
import {
  CostTrendChart,
  CostTrendChartMini,
} from '../CostTrendChart'
import type {
  CostTrendData,
  CostTrendDataPoint,
} from '@/types/performance-metrics'

// Mock window.matchMedia (needed for next-themes)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Recharts components
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Area: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`area-${dataKey}`} data-name={name} />
  ),
  Line: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`line-${dataKey}`} data-name={name} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: { content: React.ComponentType<any> }) => (
    <div data-testid="tooltip">
      {content && React.createElement(content, {
        active: true,
        payload: [
          {
            name: 'Cost',
            value: 0.05,
            color: '#0ea5e9',
            dataKey: 'cost',
            payload: {
              timestamp: 1234567890000,
              timeLabel: '12:00',
              cost: 0.05,
              cumulativeCost: 0.25,
              projectedCost: 0.06,
              breakdown: {
                inputTokenCost: 0.03,
                outputTokenCost: 0.02,
                cacheCreationCost: 0,
                cacheReadCost: 0,
                otherCost: 0,
              },
            },
          },
        ],
        label: '12:00',
        showProjection: true,
      })}
    </div>
  ),
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ReferenceLine: ({ y, label }: { y: number; label: any }) => (
    <div data-testid="reference-line" data-y={y} data-label={label?.value} />
  ),
}))

// Mock chart utils
vi.mock('@/lib/chart-utils', () => ({
  useChartTheme: () => ({
    colors: {
      categorical: ['#0ea5e9', '#8b5cf6', '#22c55e'],
      primary: '#0ea5e9',
      secondary: '#0369a1',
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
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
  }),
  getTooltipStyle: () => ({
    contentStyle: { backgroundColor: '#f4f4f5' },
    labelStyle: { color: '#09090b' },
    itemStyle: { color: '#52525b' },
  }),
  getGridStyle: () => ({
    stroke: '#e4e4e7',
    strokeDasharray: '3 3',
    strokeOpacity: 0.6,
  }),
  getAxisStyle: () => ({
    stroke: '#d4d4d8',
    tick: { fill: '#52525b', fontSize: 12 },
    axisLine: { stroke: '#d4d4d8' },
    tickLine: { stroke: '#d4d4d8' },
  }),
  currencyFormatter: (value: number) => {
    if (value < 0.0001) return '<$0.0001'
    if (value < 1) return `$${value.toFixed(4)}`
    return `$${value.toFixed(2)}`
  },
  createAxisFormatter: () => (value: number) => value.toString(),
  createTooltipFormatter: () => (value: number) => [value.toString(), ''],
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}))

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      {children}
    </ThemeProvider>
  )
}

// Helper function to create mock data
function createMockData(override: Partial<CostTrendData> = {}): CostTrendData {
  const baseTime = new Date('2024-01-01T12:00:00Z')

  const mockDataPoints: CostTrendDataPoint[] = Array.from({ length: 10 }, (_, i) => ({
    timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000), // Hourly intervals
    cost: 0.01 + i * 0.005,
    cumulativeCost: (0.01 + i * 0.005) * (i + 1),
    breakdown: {
      inputTokenCost: (0.01 + i * 0.005) * 0.6,
      outputTokenCost: (0.01 + i * 0.005) * 0.4,
      cacheCreationCost: 0,
      cacheReadCost: 0,
      otherCost: 0,
    },
    projectedCost: i < 5 ? (0.01 + i * 0.005) * 1.2 : undefined,
  }))

  return {
    data: mockDataPoints,
    totalCost: 0.55,
    avgCostPerHour: 0.055,
    avgCostPerTask: 0.015,
    peakHourlyCost: 0.055,
    breakdown: {
      inputTokenCost: 0.33,
      outputTokenCost: 0.22,
      cacheCreationCost: 0,
      cacheReadCost: 0,
      otherCost: 0,
    },
    budgetLimit: 1.0,
    budgetUtilization: 55,
    projectedTotalCost: 0.75,
    cacheSavings: 0.05,
    timeRange: '24h',
    generatedAt: new Date(),
    trend: 1,
    changePercent: 25.5,
    ...override,
  }
}

describe('CostTrendChart', () => {
  const mockData = createMockData()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders area chart by default', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
    })

    it('renders line chart when variant is line', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('renders chart components', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
      expect(screen.getByTestId('x-axis')).toBeInTheDocument()
      expect(screen.getByTestId('y-axis')).toBeInTheDocument()
      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('renders legend by default', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })

    it('hides legend when showLegend is false', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} showLegend={false} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
    })

    it('renders cost series by default', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cost')).toBeInTheDocument()
    })

    it('renders cumulative cost when showCumulative is true', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} showCumulative={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cumulativeCost')).toBeInTheDocument()
    })

    it('renders budget limit reference line when budget is set and showBudgetLimit is true', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} showBudgetLimit={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('reference-line')).toBeInTheDocument()
      expect(screen.getByTestId('reference-line')).toHaveAttribute('data-y', '1')
    })

    it('hides budget limit when showBudgetLimit is false', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} showBudgetLimit={false} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument()
    })

    it('renders projected cost line when variant is line and showProjection is true', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} variant="line" showProjection={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-projectedCost')).toBeInTheDocument()
    })

    it('applies custom height', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} height={400} />
        </TestWrapper>
      )

      const chartContainer = screen.getByRole('img')
      expect(chartContainer).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} className="custom-class" />
        </TestWrapper>
      )

      const chartContainer = screen.getByRole('img')
      expect(chartContainer).toHaveClass('custom-class')
    })
  })

  describe('Empty and Loading States', () => {
    it('renders empty state when no data provided', () => {
      const emptyData = createMockData({ data: [] })

      render(
        <TestWrapper>
          <CostTrendChart data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No cost data available')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('renders empty state with custom height', () => {
      const emptyData = createMockData({ data: [] })

      render(
        <TestWrapper>
          <CostTrendChart data={emptyData} height={300} />
        </TestWrapper>
      )

      const emptyContainer = screen.getByText('No cost data available').closest('div')
      expect(emptyContainer).toHaveStyle('height: 300px')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA label for regular cost view', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('Cost trend over 24h'))
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('$0.55'))
    })

    it('has proper ARIA label for cumulative view', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} showCumulative={true} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('Cost trend over 24h'))
    })

    it('includes screen reader summary', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Cost trend summary for 24h/, { selector: '.sr-only' })
      expect(summary).toBeInTheDocument()
      expect(summary).toHaveTextContent('$0.5500 total cost')
      expect(summary).toHaveTextContent('$0.0550 average cost per hour')
    })

    it('includes budget information in screen reader summary', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Cost trend summary for 24h/, { selector: '.sr-only' })
      expect(summary).toHaveTextContent('Budget limit: $1.00')
      expect(summary).toHaveTextContent('Budget utilization: 55.0%')
    })

    it('includes projection information in screen reader summary', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Cost trend summary for 24h/, { selector: '.sr-only' })
      expect(summary).toHaveTextContent('Projected total: $0.75')
    })

    it('includes cache savings in screen reader summary when > 0', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Cost trend summary for 24h/, { selector: '.sr-only' })
      expect(summary).toHaveTextContent('Cache savings: $0.05')
    })
  })

  describe('Tooltip', () => {
    it('renders custom tooltip with cost information', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toBeInTheDocument()
      expect(tooltip).toHaveTextContent('Cost')
      expect(tooltip).toHaveTextContent('$0.05') // formatted cost
    })

    it('shows cost breakdown when showBreakdown is true', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} showBreakdown={true} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveTextContent('Breakdown:')
      expect(tooltip).toHaveTextContent('Input Tokens')
      expect(tooltip).toHaveTextContent('Output Tokens')
    })

    it('shows projection when showProjection is true and projection data exists', () => {
      const dataWithProjection = createMockData({
        data: mockData.data.map(point => ({
          ...point,
          projectedCost: point.cost * 1.2,
        })),
      })

      render(
        <TestWrapper>
          <CostTrendChart data={dataWithProjection} showProjection={true} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveTextContent('Projected')
    })

    it('shows cumulative cost in tooltip', () => {
      render(
        <TestWrapper>
          <CostTrendChart data={mockData} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveTextContent('Cumulative Cost')
      expect(tooltip).toHaveTextContent('$0.25')
    })
  })

  describe('Data Processing', () => {
    it('handles different time ranges correctly', () => {
      const hourlyData = createMockData({ timeRange: '1h' })

      render(
        <TestWrapper>
          <CostTrendChart data={hourlyData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('Cost trend over 1h'))
    })

    it('handles data without budget limit', () => {
      const noBudgetData = createMockData({ budgetLimit: undefined, budgetUtilization: undefined })

      render(
        <TestWrapper>
          <CostTrendChart data={noBudgetData} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument()
    })

    it('handles data without projections', () => {
      const noProjectionData = createMockData({
        projectedTotalCost: undefined,
        data: mockData.data.map(point => ({ ...point, projectedCost: undefined })),
      })

      render(
        <TestWrapper>
          <CostTrendChart data={noProjectionData} variant="line" showProjection={true} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('line-projectedCost')).not.toBeInTheDocument()
    })
  })
})

describe('CostTrendChartMini', () => {
  const mockData = createMockData()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders area chart by default', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
    })

    it('renders line chart when variant is line', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('renders with custom height', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} height={100} />
        </TestWrapper>
      )

      const wrapperDiv = screen.getByTestId('responsive-container').parentElement
      expect(wrapperDiv).toHaveStyle('height: 100px')
    })

    it('renders with default height of 80px', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} />
        </TestWrapper>
      )

      const wrapperDiv = screen.getByTestId('responsive-container').parentElement
      expect(wrapperDiv).toHaveStyle('height: 80px')
    })

    it('applies custom className', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} className="mini-chart" />
        </TestWrapper>
      )

      const wrapperDiv = screen.getByTestId('responsive-container').parentElement
      expect(wrapperDiv).toHaveClass('mini-chart')
    })

    it('renders cost data by default', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cost')).toBeInTheDocument()
    })

    it('renders cumulative cost when showCumulative is true', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} showCumulative={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cumulativeCost')).toBeInTheDocument()
    })
  })

  describe('Empty and Loading States', () => {
    it('renders empty state when no data provided', () => {
      const emptyData = createMockData({ data: [] })

      render(
        <TestWrapper>
          <CostTrendChartMini data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No data')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('renders empty state with custom height', () => {
      const emptyData = createMockData({ data: [] })

      render(
        <TestWrapper>
          <CostTrendChartMini data={emptyData} height={120} />
        </TestWrapper>
      )

      const emptyContainer = screen.getByText('No data').closest('div')
      expect(emptyContainer).toHaveStyle('height: 120px')
    })
  })

  describe('Chart Content', () => {
    it('renders cost area in area mode', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} variant="area" />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cost')).toBeInTheDocument()
    })

    it('renders cost line in line mode', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-cost')).toBeInTheDocument()
    })

    it('does not render legend, tooltips, or axes (simplified chart)', () => {
      render(
        <TestWrapper>
          <CostTrendChartMini data={mockData} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument()
      expect(screen.queryByTestId('x-axis')).not.toBeInTheDocument()
      expect(screen.queryByTestId('y-axis')).not.toBeInTheDocument()
      expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument()
    })
  })
})

describe('Edge Cases', () => {
  it('handles data points with zero values', () => {
    const zeroData = createMockData({
      data: [
        {
          timestamp: new Date(),
          cost: 0,
          cumulativeCost: 0,
          breakdown: {
            inputTokenCost: 0,
            outputTokenCost: 0,
            cacheCreationCost: 0,
            cacheReadCost: 0,
            otherCost: 0,
          },
        },
      ],
    })

    render(
      <TestWrapper>
        <CostTrendChart data={zeroData} />
      </TestWrapper>
    )

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('handles very large cost numbers', () => {
    const largeData = createMockData({
      data: [
        {
          timestamp: new Date(),
          cost: 1000,
          cumulativeCost: 5000,
          breakdown: {
            inputTokenCost: 600,
            outputTokenCost: 400,
            cacheCreationCost: 0,
            cacheReadCost: 0,
            otherCost: 0,
          },
        },
      ],
      totalCost: 5000,
    })

    render(
      <TestWrapper>
        <CostTrendChart data={largeData} />
      </TestWrapper>
    )

    const chart = screen.getByRole('img')
    expect(chart).toHaveAttribute('aria-label', expect.stringContaining('$5000.00'))
  })

  it('handles missing optional properties', () => {
    const minimalData: CostTrendData = {
      data: [
        {
          timestamp: new Date(),
          cost: 0.05,
          cumulativeCost: 0.05,
        },
      ],
      totalCost: 0.05,
      avgCostPerHour: 0.05,
      avgCostPerTask: 0.05,
      peakHourlyCost: 0.05,
      breakdown: {
        inputTokenCost: 0.03,
        outputTokenCost: 0.02,
        cacheCreationCost: 0,
        cacheReadCost: 0,
        otherCost: 0,
      },
      timeRange: '1h',
      generatedAt: new Date(),
    }

    render(
      <TestWrapper>
        <CostTrendChart data={minimalData} />
      </TestWrapper>
    )

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('handles data without cache savings', () => {
    const noCacheData = createMockData({ cacheSavings: undefined })

    render(
      <TestWrapper>
        <CostTrendChart data={noCacheData} />
      </TestWrapper>
    )

    const summary = screen.getByText(/Cost trend summary for 24h/, { selector: '.sr-only' })
    expect(summary).not.toHaveTextContent('Cache savings')
  })
})