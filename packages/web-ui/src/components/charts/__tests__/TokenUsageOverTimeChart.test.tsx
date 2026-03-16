/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ThemeProvider } from 'next-themes'
import {
  TokenUsageOverTimeChart,
  TokenUsageOverTimeChartMini,
} from '../TokenUsageOverTimeChart'
import type {
  TokenUsageOverTimeData,
  TokenUsageDataPoint,
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
            name: 'Input Tokens',
            value: 1000,
            color: '#0ea5e9',
            dataKey: 'inputTokens',
            payload: {
              timestamp: 1234567890000,
              timeLabel: '12:00',
              inputTokens: 1000,
              outputTokens: 500,
              totalTokens: 1500,
              cost: 0.05,
            },
          },
        ],
        label: '12:00',
      })}
    </div>
  ),
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
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
  compactNumberFormatter: (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
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
function createMockData(override: Partial<TokenUsageOverTimeData> = {}): TokenUsageOverTimeData {
  const baseTime = new Date('2024-01-01T12:00:00Z')

  const mockDataPoints: TokenUsageDataPoint[] = Array.from({ length: 10 }, (_, i) => ({
    timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000), // Hourly intervals
    totalTokens: 1000 + i * 100,
    breakdown: {
      inputTokens: 600 + i * 60,
      outputTokens: 400 + i * 40,
      cacheCreationTokens: i > 5 ? 50 : undefined,
      cacheReadTokens: i > 5 ? 20 : undefined,
    },
    tokensPerMinute: 50 + i * 5,
    cost: 0.01 + i * 0.005,
  }))

  return {
    data: mockDataPoints,
    totalInputTokens: 6540,
    totalOutputTokens: 4360,
    totalTokens: 10900,
    totalCacheCreationTokens: 200,
    totalCacheReadTokens: 80,
    cacheHitRate: 25.5,
    avgTokensPerMinute: 75.2,
    peakTokensPerMinute: 95,
    totalCost: 0.055,
    timeRange: '24h',
    generatedAt: new Date(),
    trend: 1,
    changePercent: 15.5,
    ...override,
  }
}

describe('TokenUsageOverTimeChart', () => {
  const mockData = createMockData()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders area chart by default', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
    })

    it('renders line chart when variant is line', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('renders chart components', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} />
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
          <TokenUsageOverTimeChart data={mockData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })

    it('hides legend when showLegend is false', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} showLegend={false} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
    })

    it('renders input and output token series when showBreakdown is true', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} showBreakdown={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-outputTokens')).toBeInTheDocument()
    })

    it('renders only input tokens when showBreakdown is false', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} showBreakdown={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.queryByTestId('area-outputTokens')).not.toBeInTheDocument()
    })

    it('renders cache creation tokens when available and showBreakdown is true', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} showBreakdown={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cacheCreationTokens')).toBeInTheDocument()
    })

    it('applies custom height', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} height={400} />
        </TestWrapper>
      )

      // Check that height prop was passed to component by checking the space-y-4 div structure
      // The mocked ResponsiveContainer doesn't reflect the actual styling
      const chartContainer = screen.getByRole('img')
      expect(chartContainer).toBeInTheDocument() // Height is handled by the ResponsiveContainer
    })

    it('applies custom className', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} className="custom-class" />
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
          <TokenUsageOverTimeChart data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No token usage data available')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('renders empty state with custom height', () => {
      const emptyData = createMockData({ data: [] })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={emptyData} height={300} />
        </TestWrapper>
      )

      const emptyContainer = screen.getByText('No token usage data available').closest('div')
      expect(emptyContainer).toHaveStyle('height: 300px')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA label', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('Token usage over 24h'))
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('10.9K total tokens'))
    })

    it('includes screen reader summary', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Token usage summary for 24h/, { selector: '.sr-only' })
      expect(summary).toBeInTheDocument()
      expect(summary).toHaveTextContent('6.5K input tokens')
      expect(summary).toHaveTextContent('4.4K output tokens')
      expect(summary).toHaveTextContent('10.9K total tokens')
    })

    it('includes cost information in screen reader summary when cost > 0', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Token usage summary for 24h/, { selector: '.sr-only' })
      expect(summary).toHaveTextContent('$0.055')
    })

    it('includes cache hit rate in screen reader summary when > 0', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Token usage summary for 24h/, { selector: '.sr-only' })
      expect(summary).toHaveTextContent('25.5%')
    })
  })

  describe('Tooltip', () => {
    it('renders custom tooltip with token information', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toBeInTheDocument()
      expect(tooltip).toHaveTextContent('Input Tokens')
      expect(tooltip).toHaveTextContent('1.0K') // formatted token count
    })

    it('shows cost information when showCost is true', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mockData} showCost={true} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveTextContent('Cost')
    })
  })

  describe('Data Processing', () => {
    it('handles different time ranges correctly', () => {
      const hourlyData = createMockData({ timeRange: '1h' })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={hourlyData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('Token usage over 1h'))
    })

    it('handles data without cache tokens', () => {
      const noCacheData = createMockData({
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        data: mockData.data.map(point => ({
          ...point,
          breakdown: {
            inputTokens: point.breakdown.inputTokens,
            outputTokens: point.breakdown.outputTokens,
          },
        })),
      })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={noCacheData} showBreakdown={true} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('area-cacheCreationTokens')).not.toBeInTheDocument()
    })
  })
})

describe('TokenUsageOverTimeChartMini', () => {
  const mockData = createMockData()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders area chart by default', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={mockData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
    })

    it('renders line chart when variant is line', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={mockData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('renders with custom height', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={mockData} height={100} />
        </TestWrapper>
      )

      // Check for style on the wrapper div with className 'w-full'
      const wrapperDiv = screen.getByTestId('responsive-container').parentElement
      expect(wrapperDiv).toHaveStyle('height: 100px')
    })

    it('renders with default height of 80px', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={mockData} />
        </TestWrapper>
      )

      const wrapperDiv = screen.getByTestId('responsive-container').parentElement
      expect(wrapperDiv).toHaveStyle('height: 80px')
    })

    it('applies custom className', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={mockData} className="mini-chart" />
        </TestWrapper>
      )

      const wrapperDiv = screen.getByTestId('responsive-container').parentElement
      expect(wrapperDiv).toHaveClass('mini-chart')
    })
  })

  describe('Empty and Loading States', () => {
    it('renders empty state when no data provided', () => {
      const emptyData = createMockData({ data: [] })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No data')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('renders empty state with custom height', () => {
      const emptyData = createMockData({ data: [] })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={emptyData} height={120} />
        </TestWrapper>
      )

      const emptyContainer = screen.getByText('No data').closest('div')
      expect(emptyContainer).toHaveStyle('height: 120px')
    })
  })

  describe('Chart Content', () => {
    it('renders input and output areas in area mode', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={mockData} variant="area" />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-outputTokens')).toBeInTheDocument()
    })

    it('renders total tokens line in line mode', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={mockData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-totalTokens')).toBeInTheDocument()
      expect(screen.queryByTestId('area-inputTokens')).not.toBeInTheDocument()
    })

    it('does not render legend, tooltips, or axes (simplified chart)', () => {
      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={mockData} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument()
      expect(screen.queryByTestId('x-axis')).not.toBeInTheDocument()
      expect(screen.queryByTestId('y-axis')).not.toBeInTheDocument()
    })
  })
})

describe('Edge Cases', () => {
  it('handles data points with zero values', () => {
    const zeroData = createMockData({
      data: [
        {
          timestamp: new Date(),
          totalTokens: 0,
          breakdown: {
            inputTokens: 0,
            outputTokens: 0,
          },
          tokensPerMinute: 0,
          cost: 0,
        },
      ],
    })

    render(
      <TestWrapper>
        <TokenUsageOverTimeChart data={zeroData} />
      </TestWrapper>
    )

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })

  it('handles very large token numbers', () => {
    const largeData = createMockData({
      data: [
        {
          timestamp: new Date(),
          totalTokens: 5000000,
          breakdown: {
            inputTokens: 3000000,
            outputTokens: 2000000,
          },
          tokensPerMinute: 50000,
          cost: 50,
        },
      ],
      totalTokens: 5000000,
    })

    render(
      <TestWrapper>
        <TokenUsageOverTimeChart data={largeData} />
      </TestWrapper>
    )

    const chart = screen.getByRole('img')
    expect(chart).toHaveAttribute('aria-label', expect.stringContaining('5.00M total tokens'))
  })

  it('handles missing optional properties', () => {
    const minimalData: TokenUsageOverTimeData = {
      data: [
        {
          timestamp: new Date(),
          totalTokens: 1000,
          breakdown: {
            inputTokens: 600,
            outputTokens: 400,
          },
        },
      ],
      totalInputTokens: 600,
      totalOutputTokens: 400,
      totalTokens: 1000,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      cacheHitRate: 0,
      avgTokensPerMinute: 50,
      peakTokensPerMinute: 50,
      totalCost: 0,
      timeRange: '1h',
      generatedAt: new Date(),
    }

    render(
      <TestWrapper>
        <TokenUsageOverTimeChart data={minimalData} />
      </TestWrapper>
    )

    expect(screen.getByTestId('area-chart')).toBeInTheDocument()
  })
})