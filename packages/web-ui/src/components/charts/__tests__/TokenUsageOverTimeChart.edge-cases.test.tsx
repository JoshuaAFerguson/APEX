/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import {
  TokenUsageOverTimeChart,
  TokenUsageOverTimeChartMini,
} from '../TokenUsageOverTimeChart'
import type {
  TokenUsageOverTimeData,
  TokenUsageDataPoint,
  PerformanceMetricsTimeRange,
  TokenTypeBreakdown,
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
}))

// Mock chart utils
vi.mock('@/lib/chart-utils', () => ({
  useChartTheme: () => ({
    colors: {
      categorical: ['#0ea5e9', '#8b5cf6', '#22c55e'],
      success: '#22c55e',
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
  compactNumberFormatter: (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
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
function createExtremeTokenData(
  extreme: 'zero' | 'max' | 'negative' | 'infinity' | 'nan' | 'mixed',
  timeRange: PerformanceMetricsTimeRange = '24h'
): TokenUsageOverTimeData {
  const baseTime = new Date('2024-01-01T12:00:00Z')

  let data: TokenUsageDataPoint[]

  switch (extreme) {
    case 'zero':
      data = [
        {
          timestamp: baseTime,
          totalTokens: 0,
          breakdown: {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          },
          tokensPerMinute: 0,
          cost: 0,
        },
      ]
      break

    case 'max':
      data = [
        {
          timestamp: baseTime,
          totalTokens: Number.MAX_SAFE_INTEGER,
          breakdown: {
            inputTokens: Math.floor(Number.MAX_SAFE_INTEGER * 0.6),
            outputTokens: Math.floor(Number.MAX_SAFE_INTEGER * 0.4),
            cacheCreationTokens: 1000000,
            cacheReadTokens: 500000,
          },
          tokensPerMinute: Number.MAX_SAFE_INTEGER / 60,
          cost: Number.MAX_SAFE_INTEGER * 0.00001,
        },
      ]
      break

    case 'negative':
      data = [
        {
          timestamp: baseTime,
          totalTokens: -1000,
          breakdown: {
            inputTokens: -600,
            outputTokens: -400,
            cacheCreationTokens: -50,
            cacheReadTokens: -25,
          },
          tokensPerMinute: -16.67,
          cost: -0.05,
        },
      ]
      break

    case 'infinity':
      data = [
        {
          timestamp: baseTime,
          totalTokens: Infinity,
          breakdown: {
            inputTokens: Infinity,
            outputTokens: Infinity,
            cacheCreationTokens: Infinity,
            cacheReadTokens: Infinity,
          },
          tokensPerMinute: Infinity,
          cost: Infinity,
        },
      ]
      break

    case 'nan':
      data = [
        {
          timestamp: baseTime,
          totalTokens: NaN,
          breakdown: {
            inputTokens: NaN,
            outputTokens: NaN,
            cacheCreationTokens: NaN,
            cacheReadTokens: NaN,
          },
          tokensPerMinute: NaN,
          cost: NaN,
        },
      ]
      break

    case 'mixed':
      data = [
        {
          timestamp: new Date(baseTime.getTime()),
          totalTokens: 0,
          breakdown: { inputTokens: 0, outputTokens: 0 },
        },
        {
          timestamp: new Date(baseTime.getTime() + 3600000),
          totalTokens: 1000,
          breakdown: { inputTokens: 600, outputTokens: 400 },
        },
        {
          timestamp: new Date(baseTime.getTime() + 7200000),
          totalTokens: Number.MAX_SAFE_INTEGER,
          breakdown: {
            inputTokens: Math.floor(Number.MAX_SAFE_INTEGER * 0.6),
            outputTokens: Math.floor(Number.MAX_SAFE_INTEGER * 0.4),
          },
        },
        {
          timestamp: new Date(baseTime.getTime() + 10800000),
          totalTokens: -500,
          breakdown: { inputTokens: -300, outputTokens: -200 },
        },
      ]
      break

    default:
      data = []
  }

  const totalInputTokens = data.reduce(
    (sum, point) => sum + (isFinite(point.breakdown.inputTokens) ? Math.max(0, point.breakdown.inputTokens) : 0),
    0
  )
  const totalOutputTokens = data.reduce(
    (sum, point) => sum + (isFinite(point.breakdown.outputTokens) ? Math.max(0, point.breakdown.outputTokens) : 0),
    0
  )

  return {
    data,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCacheCreationTokens: data.reduce(
      (sum, point) => sum + (isFinite(point.breakdown.cacheCreationTokens || 0) ? Math.max(0, point.breakdown.cacheCreationTokens || 0) : 0),
      0
    ),
    totalCacheReadTokens: data.reduce(
      (sum, point) => sum + (isFinite(point.breakdown.cacheReadTokens || 0) ? Math.max(0, point.breakdown.cacheReadTokens || 0) : 0),
      0
    ),
    cacheHitRate: 0,
    avgTokensPerMinute: 0,
    peakTokensPerMinute: 0,
    totalCost: 0,
    timeRange,
    generatedAt: new Date(),
  }
}

function createMalformedData(): TokenUsageOverTimeData {
  return {
    data: [
      // Missing required fields
      {
        timestamp: new Date(),
        totalTokens: 1000,
        breakdown: {} as TokenTypeBreakdown, // Empty breakdown
      },
      // Invalid timestamp
      {
        timestamp: new Date('invalid-date'),
        totalTokens: 500,
        breakdown: {
          inputTokens: 300,
          outputTokens: 200,
        },
      },
      // Inconsistent totals
      {
        timestamp: new Date(),
        totalTokens: 1000,
        breakdown: {
          inputTokens: 2000, // Sum exceeds total
          outputTokens: 3000,
        },
      },
    ],
    totalInputTokens: 5300,
    totalOutputTokens: 3200,
    totalTokens: 2500, // Inconsistent with sum
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    cacheHitRate: 150, // Invalid percentage > 100
    avgTokensPerMinute: -10, // Negative average
    peakTokensPerMinute: 0,
    totalCost: 0,
    timeRange: '24h',
    generatedAt: new Date(),
  }
}

describe('TokenUsageOverTimeChart Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Extreme Numerical Values', () => {
    it('handles zero values gracefully', () => {
      const zeroData = createExtremeTokenData('zero')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={zeroData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('0 total tokens'))
    })

    it('handles very large numbers without crashing', () => {
      const maxData = createExtremeTokenData('max')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={maxData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should format large numbers appropriately
      const chart = screen.getByRole('img')
      expect(chart).toBeInTheDocument()
    })

    it('handles negative values appropriately', () => {
      const negativeData = createExtremeTokenData('negative')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={negativeData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should render without throwing errors
    })

    it('handles infinity values without breaking', () => {
      const infinityData = createExtremeTokenData('infinity')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={infinityData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Chart should render even with infinity values
    })

    it('handles NaN values gracefully', () => {
      const nanData = createExtremeTokenData('nan')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={nanData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should handle NaN without crashing
    })

    it('handles mixed extreme values', () => {
      const mixedData = createExtremeTokenData('mixed')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={mixedData} showBreakdown={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-outputTokens')).toBeInTheDocument()
    })
  })

  describe('Data Structure Edge Cases', () => {
    it('handles empty data array', () => {
      const emptyData: TokenUsageOverTimeData = {
        data: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        cacheHitRate: 0,
        avgTokensPerMinute: 0,
        peakTokensPerMinute: 0,
        totalCost: 0,
        timeRange: '24h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No token usage data available')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('handles single data point', () => {
      const singlePointData: TokenUsageOverTimeData = {
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
        avgTokensPerMinute: 16.67,
        peakTokensPerMinute: 16.67,
        totalCost: 0,
        timeRange: '1h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={singlePointData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '1')
    })

    it('handles malformed data structure', () => {
      const malformedData = createMalformedData()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={malformedData} />
        </TestWrapper>
      )

      // Should render without crashing even with malformed data
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles missing optional properties gracefully', () => {
      const minimalData: TokenUsageOverTimeData = {
        data: [
          {
            timestamp: new Date(),
            totalTokens: 1000,
            breakdown: {
              inputTokens: 600,
              outputTokens: 400,
              // Missing optional cache properties
            },
            // Missing optional tokensPerMinute and cost
          },
        ],
        totalInputTokens: 600,
        totalOutputTokens: 400,
        totalTokens: 1000,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        cacheHitRate: 0,
        avgTokensPerMinute: 16.67,
        peakTokensPerMinute: 16.67,
        totalCost: 0,
        timeRange: '1h',
        generatedAt: new Date(),
        // Missing optional trend and changePercent
      }

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={minimalData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should not show cache-related areas when no cache data
      expect(screen.queryByTestId('area-cacheCreationTokens')).not.toBeInTheDocument()
    })
  })

  describe('Timestamp and Time Range Edge Cases', () => {
    it('handles invalid timestamps', () => {
      const invalidTimestampData: TokenUsageOverTimeData = {
        data: [
          {
            timestamp: new Date('invalid'),
            totalTokens: 1000,
            breakdown: { inputTokens: 600, outputTokens: 400 },
          },
          {
            timestamp: new Date(NaN),
            totalTokens: 500,
            breakdown: { inputTokens: 300, outputTokens: 200 },
          },
        ],
        totalInputTokens: 900,
        totalOutputTokens: 600,
        totalTokens: 1500,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        cacheHitRate: 0,
        avgTokensPerMinute: 25,
        peakTokensPerMinute: 25,
        totalCost: 0,
        timeRange: '1h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={invalidTimestampData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      // Should handle invalid timestamps gracefully
    })

    it('handles data points with same timestamp', () => {
      const sameTimestamp = new Date()
      const duplicateTimestampData: TokenUsageOverTimeData = {
        data: [
          {
            timestamp: sameTimestamp,
            totalTokens: 1000,
            breakdown: { inputTokens: 600, outputTokens: 400 },
          },
          {
            timestamp: sameTimestamp,
            totalTokens: 500,
            breakdown: { inputTokens: 300, outputTokens: 200 },
          },
        ],
        totalInputTokens: 900,
        totalOutputTokens: 600,
        totalTokens: 1500,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        cacheHitRate: 0,
        avgTokensPerMinute: 25,
        peakTokensPerMinute: 25,
        totalCost: 0,
        timeRange: '1h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={duplicateTimestampData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles unsorted timestamps', () => {
      const now = Date.now()
      const unsortedData: TokenUsageOverTimeData = {
        data: [
          {
            timestamp: new Date(now + 7200000), // +2 hours
            totalTokens: 1000,
            breakdown: { inputTokens: 600, outputTokens: 400 },
          },
          {
            timestamp: new Date(now), // current time
            totalTokens: 500,
            breakdown: { inputTokens: 300, outputTokens: 200 },
          },
          {
            timestamp: new Date(now + 3600000), // +1 hour
            totalTokens: 750,
            breakdown: { inputTokens: 450, outputTokens: 300 },
          },
        ],
        totalInputTokens: 1350,
        totalOutputTokens: 900,
        totalTokens: 2250,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        cacheHitRate: 0,
        avgTokensPerMinute: 37.5,
        peakTokensPerMinute: 37.5,
        totalCost: 0,
        timeRange: '3h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={unsortedData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '3')
    })
  })

  describe('Display and Rendering Edge Cases', () => {
    it('handles extremely small chart dimensions', () => {
      const testData = createExtremeTokenData('mixed')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} height={1} />
        </TestWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
      // Should render even with minimal height
    })

    it('handles extremely large chart dimensions', () => {
      const testData = createExtremeTokenData('mixed')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} height={10000} />
        </TestWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('handles rapid prop changes', () => {
      const testData = createExtremeTokenData('mixed')
      const { rerender } = render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} variant="area" />
        </TestWrapper>
      )

      // Rapid variant changes
      for (let i = 0; i < 10; i++) {
        rerender(
          <TestWrapper>
            <TokenUsageOverTimeChart data={testData} variant={i % 2 === 0 ? 'area' : 'line'} />
          </TestWrapper>
        )
      }

      // Should handle rapid changes without errors
      expect(screen.getByTestId(screen.queryByTestId('area-chart') ? 'area-chart' : 'line-chart')).toBeInTheDocument()
    })
  })

  describe('Mini Chart Edge Cases', () => {
    it('handles edge case data in mini variant', () => {
      const extremeData = createExtremeTokenData('mixed')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={extremeData} height={0} />
        </TestWrapper>
      )

      // Should render even with zero height
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('handles empty data in mini variant', () => {
      const emptyData = createExtremeTokenData('zero')
      emptyData.data = []

      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('handles line variant with extreme values in mini chart', () => {
      const maxData = createExtremeTokenData('max')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={maxData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByTestId('line-totalTokens')).toBeInTheDocument()
    })
  })

  describe('Error Boundary Cases', () => {
    it('handles undefined data prop', () => {
      // TypeScript would normally prevent this, but test runtime safety
      const undefinedData = undefined as any

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={undefinedData} />
        </TestWrapper>
      )

      // Should show empty state rather than crash
      expect(screen.getByText('No token usage data available')).toBeInTheDocument()
    })

    it('handles null data prop', () => {
      const nullData = null as any

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={nullData} />
        </TestWrapper>
      )

      expect(screen.getByText('No token usage data available')).toBeInTheDocument()
    })

    it('handles circular reference in data', () => {
      const circularData: any = {
        data: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        cacheHitRate: 0,
        avgTokensPerMinute: 0,
        peakTokensPerMinute: 0,
        totalCost: 0,
        timeRange: '24h',
        generatedAt: new Date(),
      }
      circularData.self = circularData // Create circular reference

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={circularData} />
        </TestWrapper>
      )

      expect(screen.getByText('No token usage data available')).toBeInTheDocument()
    })
  })

  describe('Accessibility Edge Cases', () => {
    it('provides meaningful labels with extreme values', () => {
      const maxData = createExtremeTokenData('max')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={maxData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')
      const ariaLabel = chart.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel).toContain('Token usage over')
    })

    it('handles screen reader summary with edge case data', () => {
      const nanData = createExtremeTokenData('nan')

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={nanData} />
        </TestWrapper>
      )

      // Should have screen reader content even with NaN values
      const summary = document.querySelector('.sr-only')
      expect(summary).toBeInTheDocument()
    })
  })
})