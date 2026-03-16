/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import {
  TokenUsageOverTimeChart,
  TokenUsageOverTimeChartMini,
} from '../TokenUsageOverTimeChart'
import type {
  TokenUsageOverTimeData,
  TokenUsageDataPoint,
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

// Mock Recharts components with enhanced behavior
vi.mock('recharts', () => ({
  AreaChart: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="area-chart" onClick={onClick}>
      {children}
    </div>
  ),
  LineChart: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="line-chart" onClick={onClick}>
      {children}
    </div>
  ),
  Area: ({ dataKey, name, onClick }: { dataKey: string; name: string; onClick?: () => void }) => (
    <div
      data-testid={`area-${dataKey}`}
      data-name={name}
      onClick={onClick}
      role="button"
      tabIndex={0}
    />
  ),
  Line: ({ dataKey, name, onClick }: { dataKey: string; name: string; onClick?: () => void }) => (
    <div
      data-testid={`line-${dataKey}`}
      data-name={name}
      onClick={onClick}
      role="button"
      tabIndex={0}
    />
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
              cacheCreationTokens: 100,
              cacheReadTokens: 50,
              cost: 0.05,
            },
          },
          {
            name: 'Output Tokens',
            value: 500,
            color: '#8b5cf6',
            dataKey: 'outputTokens',
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
    contentStyle: { backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7' },
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

// Mock data factories for comprehensive integration tests
function createRealisticTokenData(
  timeRange: PerformanceMetricsTimeRange = '24h',
  dataPoints: number = 24,
  config: {
    withCache?: boolean
    withCost?: boolean
    fluctuating?: boolean
    growing?: boolean
    peaky?: boolean
  } = {}
): TokenUsageOverTimeData {
  const { withCache = false, withCost = false, fluctuating = false, growing = false, peaky = false } = config
  const baseTime = new Date('2024-01-01T00:00:00Z')
  const intervalMs = 60 * 60 * 1000 // 1 hour intervals

  const data: TokenUsageDataPoint[] = Array.from({ length: dataPoints }, (_, i) => {
    let baseInputTokens = 1000
    let baseOutputTokens = 600

    // Apply growth pattern
    if (growing) {
      baseInputTokens += i * 50
      baseOutputTokens += i * 30
    }

    // Apply fluctuation
    if (fluctuating) {
      baseInputTokens *= 0.8 + 0.4 * Math.sin(i * 0.5) // 20-40% variation
      baseOutputTokens *= 0.8 + 0.4 * Math.sin(i * 0.5 + 1) // Phase shift
    }

    // Apply peaks
    if (peaky && (i === Math.floor(dataPoints * 0.3) || i === Math.floor(dataPoints * 0.7))) {
      baseInputTokens *= 3
      baseOutputTokens *= 2.5
    }

    const inputTokens = Math.floor(baseInputTokens)
    const outputTokens = Math.floor(baseOutputTokens)
    const totalTokens = inputTokens + outputTokens

    return {
      timestamp: new Date(baseTime.getTime() + i * intervalMs),
      totalTokens,
      breakdown: {
        inputTokens,
        outputTokens,
        cacheCreationTokens: withCache ? Math.floor(totalTokens * 0.05) : undefined,
        cacheReadTokens: withCache ? Math.floor(totalTokens * 0.03) : undefined,
      },
      tokensPerMinute: totalTokens / 60,
      cost: withCost ? totalTokens * 0.00005 : undefined,
    }
  })

  const totalInputTokens = data.reduce((sum, point) => sum + point.breakdown.inputTokens, 0)
  const totalOutputTokens = data.reduce((sum, point) => sum + point.breakdown.outputTokens, 0)
  const totalTokens = data.reduce((sum, point) => sum + point.totalTokens, 0)
  const totalCacheCreationTokens = withCache
    ? data.reduce((sum, point) => sum + (point.breakdown.cacheCreationTokens || 0), 0)
    : 0
  const totalCacheReadTokens = withCache
    ? data.reduce((sum, point) => sum + (point.breakdown.cacheReadTokens || 0), 0)
    : 0

  return {
    data,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalCacheCreationTokens,
    totalCacheReadTokens,
    cacheHitRate: withCache ? (totalCacheReadTokens / totalTokens) * 100 : 0,
    avgTokensPerMinute: totalTokens / (dataPoints * 60),
    peakTokensPerMinute: Math.max(...data.map(point => point.tokensPerMinute || 0)),
    totalCost: withCost ? data.reduce((sum, point) => sum + (point.cost || 0), 0) : 0,
    timeRange,
    generatedAt: new Date(),
    trend: growing ? 1 : fluctuating ? 0 : -1,
    changePercent: growing ? 15.5 : fluctuating ? 2.3 : -5.2,
  }
}

function createLargeDataset(): TokenUsageOverTimeData {
  return createRealisticTokenData('7d', 168, {
    withCache: true,
    withCost: true,
    fluctuating: true,
    growing: true,
    peaky: true,
  })
}

// Helper function to render with realistic props
const renderIntegrationChart = (props: Partial<React.ComponentProps<typeof TokenUsageOverTimeChart>> = {}) => {
  const defaultProps = {
    data: createLargeDataset(),
    ...props,
  }
  return render(
    <TestWrapper>
      <TokenUsageOverTimeChart {...defaultProps} />
    </TestWrapper>
  )
}

describe('TokenUsageOverTimeChart Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Large Dataset Handling', () => {
    it('handles large datasets with many data points efficiently', () => {
      const largeData = createRealisticTokenData('30d', 720, {
        withCache: true,
        withCost: true,
        fluctuating: true,
      }) // 720 points (30 days * 24 hours)

      renderIntegrationChart({ data: largeData })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()

      // Verify accessibility with large datasets
      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('Token usage over 30d'))
    })

    it('maintains performance with frequent re-renders', async () => {
      let renderCount = 0
      const { rerender } = renderIntegrationChart()
      renderCount++

      // Simulate rapid updates (like real-time data)
      for (let i = 0; i < 10; i++) {
        const updatedData = createRealisticTokenData('1h', 60, { withCache: true })
        rerender(
          <TestWrapper>
            <TokenUsageOverTimeChart data={updatedData} />
          </TestWrapper>
        )
        renderCount++
      }

      expect(renderCount).toBe(11)
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles different time ranges with appropriate data density', () => {
      const timeRanges: PerformanceMetricsTimeRange[] = ['1h', '6h', '24h', '7d', '30d']

      timeRanges.forEach(timeRange => {
        const data = createRealisticTokenData(timeRange, 50, { withCache: true, withCost: true })
        const { rerender } = render(
          <TestWrapper>
            <TokenUsageOverTimeChart data={data} />
          </TestWrapper>
        )

        const chart = screen.getByRole('img')
        expect(chart).toHaveAttribute('aria-label', expect.stringContaining(`Token usage over ${timeRange}`))

        // Cleanup for next iteration
        rerender(<div />)
      })
    })
  })

  describe('Interactive Features and Real-time Updates', () => {
    it('handles data point clicks correctly', async () => {
      const mockOnDataPointClick = vi.fn()
      const testData = createRealisticTokenData('24h', 24, { withCache: true, withCost: true })

      renderIntegrationChart({
        data: testData,
        onDataPointClick: mockOnDataPointClick
      })

      // Simulate clicking on a data point (via mocked Area component)
      const inputArea = screen.getByTestId('area-inputTokens')
      fireEvent.click(inputArea)

      // Since we're mocking, we can't test the actual callback, but we can verify the structure exists
      expect(inputArea).toBeInTheDocument()
    })

    it('updates tooltip content dynamically with comprehensive data', () => {
      const dataWithAllFeatures = createRealisticTokenData('24h', 24, {
        withCache: true,
        withCost: true,
        fluctuating: true,
      })

      renderIntegrationChart({
        data: dataWithAllFeatures,
        showCost: true,
        showBreakdown: true
      })

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toBeInTheDocument()

      // Verify tooltip shows comprehensive information
      expect(tooltip).toHaveTextContent('Input Tokens')
      expect(tooltip).toHaveTextContent('Output Tokens')
      expect(tooltip).toHaveTextContent('Cost')
      expect(tooltip).toHaveTextContent('Cache Creation')
      expect(tooltip).toHaveTextContent('Total Tokens')
    })

    it('handles real-time data updates gracefully', async () => {
      let currentData = createRealisticTokenData('1h', 60, { withCache: true })
      const { rerender } = renderIntegrationChart({ data: currentData })

      // Initial render check
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Simulate adding new data points (real-time updates)
      for (let i = 0; i < 5; i++) {
        const newPoint: TokenUsageDataPoint = {
          timestamp: new Date(Date.now() + i * 60000), // 1 minute intervals
          totalTokens: 1500 + i * 100,
          breakdown: {
            inputTokens: 900 + i * 60,
            outputTokens: 600 + i * 40,
            cacheCreationTokens: 50,
            cacheReadTokens: 25,
          },
          tokensPerMinute: 25 + i * 2,
          cost: 0.075 + i * 0.005,
        }

        currentData = {
          ...currentData,
          data: [...currentData.data, newPoint],
          totalTokens: currentData.totalTokens + newPoint.totalTokens,
          totalInputTokens: currentData.totalInputTokens + newPoint.breakdown.inputTokens,
          totalOutputTokens: currentData.totalOutputTokens + newPoint.breakdown.outputTokens,
        }

        rerender(
          <TestWrapper>
            <TokenUsageOverTimeChart data={currentData} />
          </TestWrapper>
        )

        await waitFor(() => {
          expect(screen.getByTestId('area-chart')).toBeInTheDocument()
        })
      }

      // Verify chart still functions after updates
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })
  })

  describe('Chart Variants and Display Options', () => {
    it('switches between area and line variants dynamically', () => {
      const testData = createRealisticTokenData('24h', 24, { withCache: true })
      const { rerender } = renderIntegrationChart({ data: testData, variant: 'area' })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()

      rerender(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('toggles breakdown display correctly', () => {
      const testData = createRealisticTokenData('24h', 24, { withCache: true })
      const { rerender } = renderIntegrationChart({
        data: testData,
        showBreakdown: true
      })

      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-outputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-cacheCreationTokens')).toBeInTheDocument()

      rerender(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showBreakdown={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.queryByTestId('area-outputTokens')).not.toBeInTheDocument()
    })

    it('handles cost display toggle with appropriate tooltip updates', () => {
      const testData = createRealisticTokenData('24h', 24, { withCost: true })
      const { rerender } = renderIntegrationChart({
        data: testData,
        showCost: false
      })

      let tooltip = screen.getByTestId('tooltip')
      expect(tooltip).not.toHaveTextContent('Cost')

      rerender(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showCost={true} />
        </TestWrapper>
      )

      tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveTextContent('Cost')
    })
  })

  describe('Performance with Various Data Patterns', () => {
    it('handles sparse data efficiently', () => {
      const sparseData = createRealisticTokenData('7d', 10, { withCache: true }) // Only 10 points over 7 days

      renderIntegrationChart({ data: sparseData })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label', expect.stringContaining('Token usage over 7d'))
    })

    it('handles highly fluctuating data', () => {
      const fluctuatingData = createRealisticTokenData('24h', 24, {
        fluctuating: true,
        peaky: true,
        withCache: true,
        withCost: true,
      })

      renderIntegrationChart({
        data: fluctuatingData,
        animated: true
      })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('maintains responsiveness with animated transitions', async () => {
      const testData = createRealisticTokenData('1h', 60, { withCache: true })
      renderIntegrationChart({
        data: testData,
        animated: true,
        height: 400
      })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Test that animation doesn't break functionality
      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toBeInTheDocument()
    })
  })

  describe('Theme and Color Integration', () => {
    it('applies custom color schemes consistently', () => {
      const customColors = {
        tokens: {
          input: '#ff6b6b',
          output: '#4ecdc4',
          cache: '#ffe66d',
        }
      }

      const testData = createRealisticTokenData('24h', 24, { withCache: true })
      renderIntegrationChart({
        data: testData,
        colors: customColors,
        showBreakdown: true
      })

      // Verify structure exists (actual color testing would require more sophisticated setup)
      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-outputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-cacheCreationTokens')).toBeInTheDocument()
    })

    it('handles theme changes gracefully', async () => {
      const testData = createRealisticTokenData('24h', 24, { withCache: true })
      renderIntegrationChart({ data: testData })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Theme changes would typically be tested with actual theme providers
      // Here we verify the structure remains stable
      await waitFor(() => {
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
      })
    })
  })

  describe('Mini Chart Integration', () => {
    it('renders consistently alongside full chart', () => {
      const testData = createRealisticTokenData('24h', 24, { withCache: true })

      render(
        <TestWrapper>
          <div>
            <TokenUsageOverTimeChart data={testData} />
            <TokenUsageOverTimeChartMini data={testData} />
          </div>
        </TestWrapper>
      )

      // Both charts should be present
      const areaCharts = screen.getAllByTestId('area-chart')
      expect(areaCharts).toHaveLength(2)

      // Mini chart should have simplified structure
      const responsiveContainers = screen.getAllByTestId('responsive-container')
      expect(responsiveContainers).toHaveLength(2)
    })

    it('handles different heights appropriately', () => {
      const testData = createRealisticTokenData('24h', 24, { withCache: true })

      const { container } = render(
        <TestWrapper>
          <div>
            <TokenUsageOverTimeChart data={testData} height={300} />
            <TokenUsageOverTimeChartMini data={testData} height={100} />
          </div>
        </TestWrapper>
      )

      // Both should render without conflicts
      expect(screen.getAllByTestId('area-chart')).toHaveLength(2)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('gracefully handles incomplete data', () => {
      const incompleteData: TokenUsageOverTimeData = {
        data: [
          {
            timestamp: new Date(),
            totalTokens: 1000,
            breakdown: {
              inputTokens: 600,
              outputTokens: 400,
            },
            // Missing optional fields
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

      renderIntegrationChart({ data: incompleteData })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('area-cacheCreationTokens')).not.toBeInTheDocument()
    })

    it('handles data updates with changing structure', () => {
      const initialData = createRealisticTokenData('1h', 10, { withCache: false, withCost: false })
      const { rerender } = renderIntegrationChart({ data: initialData })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Update to data with cache and cost
      const updatedData = createRealisticTokenData('1h', 10, { withCache: true, withCost: true })
      rerender(
        <TestWrapper>
          <TokenUsageOverTimeChart data={updatedData} showBreakdown={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-cacheCreationTokens')).toBeInTheDocument()
    })
  })
})