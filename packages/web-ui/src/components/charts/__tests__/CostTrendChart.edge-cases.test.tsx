/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import {
  CostTrendChart,
  CostTrendChartMini,
} from '../CostTrendChart'
import type {
  CostTrendData,
  CostTrendDataPoint,
  CostBreakdown,
  PerformanceMetricsTimeRange,
} from '@/types/performance-metrics'

// Mock window.matchMedia (needed for next-themes)
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

// Mock Recharts components
vi.mock('recharts', () => ({
  AreaChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => (
    <div data-testid="area-chart" data-points={data?.length || 0}>
      {children}
    </div>
  ),
  LineChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => (
    <div data-testid="line-chart" data-points={data?.length || 0}>
      {children}
    </div>
  ),
  Area: ({ dataKey, name, stroke, fill }: { dataKey: string; name: string; stroke?: string; fill?: string }) => (
    <div
      data-testid={`area-${dataKey}`}
      data-name={name}
      data-stroke={stroke}
      data-fill={fill}
    />
  ),
  Line: ({ dataKey, name, stroke }: { dataKey: string; name: string; stroke?: string }) => (
    <div
      data-testid={`line-${dataKey}`}
      data-name={name}
      data-stroke={stroke}
    />
  ),
  XAxis: ({ dataKey }: { dataKey?: string }) => (
    <div data-testid="x-axis" data-key={dataKey} />
  ),
  YAxis: ({ tickFormatter }: { tickFormatter?: (value: any) => string }) => (
    <div data-testid="y-axis" data-has-formatter={!!tickFormatter} />
  ),
  CartesianGrid: ({ stroke }: { stroke?: string }) => (
    <div data-testid="cartesian-grid" data-stroke={stroke} />
  ),
  Tooltip: ({ content }: { content: React.ComponentType<any> }) => (
    <div data-testid="tooltip">
      {content && React.createElement(content, {
        active: true,
        payload: [],
        label: '',
      })}
    </div>
  ),
  Legend: ({ formatter }: { formatter?: (value: any) => React.ReactNode }) => (
    <div data-testid="legend" data-has-formatter={!!formatter} />
  ),
  ResponsiveContainer: ({ children, width, height }: { children: React.ReactNode; width?: string | number; height?: string | number }) => (
    <div data-testid="responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
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
      warning: '#eab308',
      error: '#ef4444',
    },
    mode: 'light' as const,
    mounted: true,
  }),
  getTooltipStyle: () => ({
    contentStyle: { backgroundColor: '#f4f4f5' },
    labelStyle: { color: '#09090b' },
  }),
  getGridStyle: () => ({ stroke: '#e4e4e7' }),
  getAxisStyle: () => ({ stroke: '#d4d4d8' }),
  currencyFormatter: (value: number) => {
    if (!isFinite(value)) return '$0.0000'
    if (value < 0.0001) return '<$0.0001'
    if (value < 1) return `$${value.toFixed(4)}`
    return `$${value.toFixed(2)}`
  },
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

// Edge case data generators
function createExtremeCostData(
  extreme: 'zero' | 'max' | 'negative' | 'infinity' | 'nan' | 'mixed',
  timeRange: PerformanceMetricsTimeRange = '24h'
): CostTrendData {
  const baseTime = new Date('2024-01-01T12:00:00Z')

  let data: CostTrendDataPoint[]

  const createCostBreakdown = (cost: number): CostBreakdown => ({
    inputTokenCost: cost * 0.6,
    outputTokenCost: cost * 0.4,
    cacheCreationCost: 0,
    cacheReadCost: 0,
    otherCost: 0,
  })

  switch (extreme) {
    case 'zero':
      data = [
        {
          timestamp: baseTime,
          cost: 0,
          cumulativeCost: 0,
          breakdown: createCostBreakdown(0),
          projectedCost: 0,
        },
      ]
      break

    case 'max':
      data = [
        {
          timestamp: baseTime,
          cost: Number.MAX_SAFE_INTEGER,
          cumulativeCost: Number.MAX_SAFE_INTEGER,
          breakdown: createCostBreakdown(Number.MAX_SAFE_INTEGER),
          projectedCost: Number.MAX_SAFE_INTEGER * 1.1,
        },
      ]
      break

    case 'negative':
      data = [
        {
          timestamp: baseTime,
          cost: -100,
          cumulativeCost: -100,
          breakdown: {
            inputTokenCost: -60,
            outputTokenCost: -40,
            cacheCreationCost: 0,
            cacheReadCost: 0,
            otherCost: 0,
          },
          projectedCost: -120,
        },
      ]
      break

    case 'infinity':
      data = [
        {
          timestamp: baseTime,
          cost: Infinity,
          cumulativeCost: Infinity,
          breakdown: {
            inputTokenCost: Infinity,
            outputTokenCost: Infinity,
            cacheCreationCost: 0,
            cacheReadCost: 0,
            otherCost: 0,
          },
          projectedCost: Infinity,
        },
      ]
      break

    case 'nan':
      data = [
        {
          timestamp: baseTime,
          cost: NaN,
          cumulativeCost: NaN,
          breakdown: {
            inputTokenCost: NaN,
            outputTokenCost: NaN,
            cacheCreationCost: NaN,
            cacheReadCost: NaN,
            otherCost: NaN,
          },
          projectedCost: NaN,
        },
      ]
      break

    case 'mixed':
      data = [
        {
          timestamp: new Date(baseTime.getTime()),
          cost: 0,
          cumulativeCost: 0,
          breakdown: createCostBreakdown(0),
        },
        {
          timestamp: new Date(baseTime.getTime() + 3600000),
          cost: 1.5,
          cumulativeCost: 1.5,
          breakdown: createCostBreakdown(1.5),
        },
        {
          timestamp: new Date(baseTime.getTime() + 7200000),
          cost: Number.MAX_SAFE_INTEGER,
          cumulativeCost: Number.MAX_SAFE_INTEGER + 1.5,
          breakdown: createCostBreakdown(Number.MAX_SAFE_INTEGER),
        },
        {
          timestamp: new Date(baseTime.getTime() + 10800000),
          cost: -50,
          cumulativeCost: Number.MAX_SAFE_INTEGER - 48.5,
          breakdown: createCostBreakdown(-50),
        },
      ]
      break

    default:
      data = []
  }

  const totalCost = data.reduce(
    (sum, point) => sum + (isFinite(point.cost) ? Math.max(0, point.cost) : 0),
    0
  )

  return {
    data,
    totalCost,
    avgCostPerHour: totalCost / Math.max(1, data.length),
    avgCostPerTask: totalCost / Math.max(1, data.length),
    peakHourlyCost: Math.max(...data.map(p => isFinite(p.cost) ? p.cost : 0)),
    breakdown: data.reduce(
      (acc, point) => ({
        inputTokenCost: acc.inputTokenCost + (isFinite(point.breakdown?.inputTokenCost || 0) ? Math.max(0, point.breakdown?.inputTokenCost || 0) : 0),
        outputTokenCost: acc.outputTokenCost + (isFinite(point.breakdown?.outputTokenCost || 0) ? Math.max(0, point.breakdown?.outputTokenCost || 0) : 0),
        cacheCreationCost: acc.cacheCreationCost,
        cacheReadCost: acc.cacheReadCost,
        otherCost: acc.otherCost,
      }),
      { inputTokenCost: 0, outputTokenCost: 0, cacheCreationCost: 0, cacheReadCost: 0, otherCost: 0 }
    ),
    budgetLimit: extreme === 'max' ? Number.MAX_SAFE_INTEGER : 100,
    budgetUtilization: totalCost / 100 * 100,
    timeRange,
    generatedAt: new Date(),
  }
}

function createMalformedCostData(): CostTrendData {
  return {
    data: [
      // Missing required fields
      {
        timestamp: new Date(),
        cost: 1.5,
        cumulativeCost: 1.5,
        breakdown: {} as CostBreakdown, // Empty breakdown
      },
      // Invalid timestamp
      {
        timestamp: new Date('invalid-date'),
        cost: 2.5,
        cumulativeCost: 4.0,
        breakdown: {
          inputTokenCost: 1.5,
          outputTokenCost: 1.0,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
      },
      // Inconsistent cumulative
      {
        timestamp: new Date(),
        cost: 3.0,
        cumulativeCost: 2.0, // Should be 7.0 based on previous
        breakdown: {
          inputTokenCost: 1.8,
          outputTokenCost: 1.2,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
      },
    ],
    totalCost: 7.0,
    avgCostPerHour: -1.5, // Invalid negative
    avgCostPerTask: 0,
    peakHourlyCost: 3.0,
    breakdown: {
      inputTokenCost: 4.8,
      outputTokenCost: 3.2,
      cacheCreationCost: -1, // Invalid negative
      cacheReadCost: 0,
      otherCost: 0,
    },
    budgetLimit: -50, // Invalid negative budget
    budgetUtilization: 150, // Invalid > 100%
    projectedTotalCost: NaN,
    timeRange: '24h',
    generatedAt: new Date(),
  }
}

describe('CostTrendChart Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Extreme Numerical Values', () => {
    it('handles zero costs gracefully', () => {
      const zeroData = createExtremeCostData('zero')

      render(
        <TestWrapper>
          <CostTrendChart data={zeroData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('$0.00'))
    })

    it('handles very large cost numbers without crashing', () => {
      const maxData = createExtremeCostData('max')

      render(
        <TestWrapper>
          <CostTrendChart data={maxData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should format large numbers appropriately
      const chart = screen.getByRole('img')
      expect(chart).toBeInTheDocument()
    })

    it('handles negative cost values appropriately', () => {
      const negativeData = createExtremeCostData('negative')

      render(
        <TestWrapper>
          <CostTrendChart data={negativeData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should render without throwing errors
    })

    it('handles infinity values without breaking', () => {
      const infinityData = createExtremeCostData('infinity')

      render(
        <TestWrapper>
          <CostTrendChart data={infinityData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Chart should render even with infinity values
    })

    it('handles NaN values gracefully', () => {
      const nanData = createExtremeCostData('nan')

      render(
        <TestWrapper>
          <CostTrendChart data={nanData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should handle NaN without crashing
    })

    it('handles mixed extreme values', () => {
      const mixedData = createExtremeCostData('mixed')

      render(
        <TestWrapper>
          <CostTrendChart data={mixedData} showBreakdown={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-cost')).toBeInTheDocument()
    })
  })

  describe('Data Structure Edge Cases', () => {
    it('handles empty data array', () => {
      const emptyData: CostTrendData = {
        data: [],
        totalCost: 0,
        avgCostPerHour: 0,
        avgCostPerTask: 0,
        peakHourlyCost: 0,
        breakdown: {
          inputTokenCost: 0,
          outputTokenCost: 0,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
        timeRange: '24h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <CostTrendChart data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No cost data available')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('handles single data point', () => {
      const singlePointData: CostTrendData = {
        data: [
          {
            timestamp: new Date(),
            cost: 1.5,
            cumulativeCost: 1.5,
            breakdown: {
              inputTokenCost: 0.9,
              outputTokenCost: 0.6,
              cacheCreationCost: 0,
              cacheReadCost: 0,
              otherCost: 0,
            },
          },
        ],
        totalCost: 1.5,
        avgCostPerHour: 1.5,
        avgCostPerTask: 1.5,
        peakHourlyCost: 1.5,
        breakdown: {
          inputTokenCost: 0.9,
          outputTokenCost: 0.6,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
        timeRange: '1h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <CostTrendChart data={singlePointData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '1')
    })

    it('handles malformed data structure', () => {
      const malformedData = createMalformedCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={malformedData} />
        </TestWrapper>
      )

      // Should render without crashing even with malformed data
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles missing optional properties gracefully', () => {
      const minimalData: CostTrendData = {
        data: [
          {
            timestamp: new Date(),
            cost: 1.5,
            cumulativeCost: 1.5,
            // Missing optional breakdown and projectedCost
          },
        ],
        totalCost: 1.5,
        avgCostPerHour: 1.5,
        avgCostPerTask: 1.5,
        peakHourlyCost: 1.5,
        breakdown: {
          inputTokenCost: 0.9,
          outputTokenCost: 0.6,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
        timeRange: '1h',
        generatedAt: new Date(),
        // Missing optional budgetLimit, projectedTotalCost, etc.
      }

      render(
        <TestWrapper>
          <CostTrendChart data={minimalData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should not show budget reference line when no budget
      expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument()
    })
  })

  describe('Budget and Projection Edge Cases', () => {
    it('handles extreme budget values', () => {
      const extremeBudgetData = createExtremeCostData('zero')
      extremeBudgetData.budgetLimit = Number.MAX_SAFE_INTEGER
      extremeBudgetData.budgetUtilization = 0

      render(
        <TestWrapper>
          <CostTrendChart data={extremeBudgetData} showBudgetLimit={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('reference-line')).toBeInTheDocument()
    })

    it('handles negative budget limits', () => {
      const negativeBudgetData = createExtremeCostData('zero')
      negativeBudgetData.budgetLimit = -100

      render(
        <TestWrapper>
          <CostTrendChart data={negativeBudgetData} showBudgetLimit={true} />
        </TestWrapper>
      )

      // Should handle negative budget gracefully
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles invalid budget utilization', () => {
      const invalidUtilizationData = createExtremeCostData('zero')
      invalidUtilizationData.budgetUtilization = NaN

      render(
        <TestWrapper>
          <CostTrendChart data={invalidUtilizationData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles projections with extreme values', () => {
      const extremeProjectionData = createExtremeCostData('mixed')
      extremeProjectionData.projectedTotalCost = Infinity
      extremeProjectionData.data = extremeProjectionData.data.map(point => ({
        ...point,
        projectedCost: Infinity,
      }))

      render(
        <TestWrapper>
          <CostTrendChart data={extremeProjectionData} variant="line" showProjection={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })
  })

  describe('Timestamp and Time Range Edge Cases', () => {
    it('handles invalid timestamps', () => {
      const invalidTimestampData: CostTrendData = {
        data: [
          {
            timestamp: new Date('invalid'),
            cost: 1.5,
            cumulativeCost: 1.5,
            breakdown: {
              inputTokenCost: 0.9,
              outputTokenCost: 0.6,
              cacheCreationCost: 0,
              cacheReadCost: 0,
              otherCost: 0,
            },
          },
          {
            timestamp: new Date(NaN),
            cost: 2.0,
            cumulativeCost: 3.5,
            breakdown: {
              inputTokenCost: 1.2,
              outputTokenCost: 0.8,
              cacheCreationCost: 0,
              cacheReadCost: 0,
              otherCost: 0,
            },
          },
        ],
        totalCost: 3.5,
        avgCostPerHour: 1.75,
        avgCostPerTask: 1.75,
        peakHourlyCost: 2.0,
        breakdown: {
          inputTokenCost: 2.1,
          outputTokenCost: 1.4,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
        timeRange: '1h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <CostTrendChart data={invalidTimestampData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should handle invalid timestamps gracefully
    })

    it('handles data points with same timestamp', () => {
      const sameTimestamp = new Date()
      const duplicateTimestampData: CostTrendData = {
        data: [
          {
            timestamp: sameTimestamp,
            cost: 1.5,
            cumulativeCost: 1.5,
            breakdown: {
              inputTokenCost: 0.9,
              outputTokenCost: 0.6,
              cacheCreationCost: 0,
              cacheReadCost: 0,
              otherCost: 0,
            },
          },
          {
            timestamp: sameTimestamp,
            cost: 2.0,
            cumulativeCost: 3.5,
            breakdown: {
              inputTokenCost: 1.2,
              outputTokenCost: 0.8,
              cacheCreationCost: 0,
              cacheReadCost: 0,
              otherCost: 0,
            },
          },
        ],
        totalCost: 3.5,
        avgCostPerHour: 1.75,
        avgCostPerTask: 1.75,
        peakHourlyCost: 2.0,
        breakdown: {
          inputTokenCost: 2.1,
          outputTokenCost: 1.4,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
        timeRange: '1h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <CostTrendChart data={duplicateTimestampData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles unsorted timestamps', () => {
      const now = Date.now()
      const unsortedData: CostTrendData = {
        data: [
          {
            timestamp: new Date(now + 7200000), // +2 hours
            cost: 3.0,
            cumulativeCost: 6.5,
            breakdown: {
              inputTokenCost: 1.8,
              outputTokenCost: 1.2,
              cacheCreationCost: 0,
              cacheReadCost: 0,
              otherCost: 0,
            },
          },
          {
            timestamp: new Date(now), // current time
            cost: 1.5,
            cumulativeCost: 1.5,
            breakdown: {
              inputTokenCost: 0.9,
              outputTokenCost: 0.6,
              cacheCreationCost: 0,
              cacheReadCost: 0,
              otherCost: 0,
            },
          },
          {
            timestamp: new Date(now + 3600000), // +1 hour
            cost: 2.0,
            cumulativeCost: 3.5,
            breakdown: {
              inputTokenCost: 1.2,
              outputTokenCost: 0.8,
              cacheCreationCost: 0,
              cacheReadCost: 0,
              otherCost: 0,
            },
          },
        ],
        totalCost: 6.5,
        avgCostPerHour: 2.17,
        avgCostPerTask: 2.17,
        peakHourlyCost: 3.0,
        breakdown: {
          inputTokenCost: 3.9,
          outputTokenCost: 2.6,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
        timeRange: '3h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <CostTrendChart data={unsortedData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '3')
    })
  })

  describe('Display and Rendering Edge Cases', () => {
    it('handles extremely small chart dimensions', () => {
      const testData = createExtremeCostData('mixed')

      render(
        <TestWrapper>
          <CostTrendChart data={testData} height={1} />
        </TestWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
      // Should render even with minimal height
    })

    it('handles extremely large chart dimensions', () => {
      const testData = createExtremeCostData('mixed')

      render(
        <TestWrapper>
          <CostTrendChart data={testData} height={10000} />
        </TestWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('handles rapid prop changes', () => {
      const testData = createExtremeCostData('mixed')
      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} variant="area" />
        </TestWrapper>
      )

      // Rapid variant changes
      for (let i = 0; i < 10; i++) {
        rerender(
          <TestWrapper>
            <CostTrendChart data={testData} variant={i % 2 === 0 ? 'area' : 'line'} />
          </TestWrapper>
        )
      }

      // Should handle rapid changes without errors
      expect(screen.getByTestId(screen.queryByTestId('area-chart') ? 'area-chart' : 'line-chart')).toBeInTheDocument()
    })

    it('handles cumulative view toggle with extreme data', () => {
      const extremeData = createExtremeCostData('max')
      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={extremeData} showCumulative={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cost')).toBeInTheDocument()

      rerender(
        <TestWrapper>
          <CostTrendChart data={extremeData} showCumulative={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cumulativeCost')).toBeInTheDocument()
    })
  })

  describe('Mini Chart Edge Cases', () => {
    it('handles edge case data in mini variant', () => {
      const extremeData = createExtremeCostData('mixed')

      render(
        <TestWrapper>
          <CostTrendChartMini data={extremeData} height={0} />
        </TestWrapper>
      )

      // Should render even with zero height
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('handles empty data in mini variant', () => {
      const emptyData = createExtremeCostData('zero')
      emptyData.data = []

      render(
        <TestWrapper>
          <CostTrendChartMini data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('handles line variant with extreme values in mini chart', () => {
      const maxData = createExtremeCostData('max')

      render(
        <TestWrapper>
          <CostTrendChartMini data={maxData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByTestId('line-cost')).toBeInTheDocument()
    })

    it('handles cumulative view in mini chart with extreme data', () => {
      const extremeData = createExtremeCostData('infinity')

      render(
        <TestWrapper>
          <CostTrendChartMini data={extremeData} showCumulative={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-cumulativeCost')).toBeInTheDocument()
    })
  })

  describe('Error Boundary Cases', () => {
    it('handles undefined data prop', () => {
      // TypeScript would normally prevent this, but test runtime safety
      const undefinedData = undefined as any

      render(
        <TestWrapper>
          <CostTrendChart data={undefinedData} />
        </TestWrapper>
      )

      // Should show empty state rather than crash
      expect(screen.getByText('No cost data available')).toBeInTheDocument()
    })

    it('handles null data prop', () => {
      const nullData = null as any

      render(
        <TestWrapper>
          <CostTrendChart data={nullData} />
        </TestWrapper>
      )

      expect(screen.getByText('No cost data available')).toBeInTheDocument()
    })

    it('handles circular reference in data', () => {
      const circularData: any = {
        data: [],
        totalCost: 0,
        avgCostPerHour: 0,
        avgCostPerTask: 0,
        peakHourlyCost: 0,
        breakdown: {
          inputTokenCost: 0,
          outputTokenCost: 0,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
        timeRange: '24h',
        generatedAt: new Date(),
      }
      circularData.self = circularData // Create circular reference

      render(
        <TestWrapper>
          <CostTrendChart data={circularData} />
        </TestWrapper>
      )

      expect(screen.getByText('No cost data available')).toBeInTheDocument()
    })
  })

  describe('Accessibility Edge Cases', () => {
    it('provides meaningful labels with extreme values', () => {
      const maxData = createExtremeCostData('max')

      render(
        <TestWrapper>
          <CostTrendChart data={maxData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')
      const ariaLabel = chart.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel).toContain('Cost trend over')
    })

    it('handles screen reader summary with edge case data', () => {
      const nanData = createExtremeCostData('nan')

      render(
        <TestWrapper>
          <CostTrendChart data={nanData} />
        </TestWrapper>
      )

      // Should have screen reader content even with NaN values
      const summary = document.querySelector('.sr-only')
      expect(summary).toBeInTheDocument()
    })

    it('provides accessible descriptions for budget overages', () => {
      const overBudgetData = createExtremeCostData('mixed')
      overBudgetData.budgetLimit = 1.0
      overBudgetData.totalCost = 10.0
      overBudgetData.budgetUtilization = 1000

      render(
        <TestWrapper>
          <CostTrendChart data={overBudgetData} showBudgetLimit={true} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')
    })
  })
})