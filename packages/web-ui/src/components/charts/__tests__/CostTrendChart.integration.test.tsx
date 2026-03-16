/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import {
  CostTrendChart,
  CostTrendChartMini,
} from '../CostTrendChart'
import type {
  CostTrendData,
  CostTrendDataPoint,
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

// Mock Recharts components with enhanced behavior for integration testing
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
  XAxis: ({ onClick }: { onClick?: () => void }) => (
    <div data-testid="x-axis" onClick={onClick} />
  ),
  YAxis: ({ onClick }: { onClick?: () => void }) => (
    <div data-testid="y-axis" onClick={onClick} />
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content, active }: { content: React.ComponentType<any>; active?: boolean }) => (
    <div data-testid="tooltip" data-active={active}>
      {content && React.createElement(content, {
        active: true,
        payload: [
          {
            name: 'Cost',
            value: 1.50,
            color: '#0ea5e9',
            dataKey: 'cost',
            payload: {
              timestamp: 1234567890000,
              timeLabel: '12:00',
              cost: 1.50,
              cumulativeCost: 5.25,
              projectedCost: 1.80,
              breakdown: {
                inputTokenCost: 0.90,
                outputTokenCost: 0.60,
                cacheCreationCost: 0,
                cacheReadCost: 0,
                otherCost: 0,
              },
            },
          },
        ],
        label: '12:00',
        showBreakdown: true,
        showProjection: true,
      })}
    </div>
  ),
  Legend: ({ onClick }: { onClick?: () => void }) => (
    <div data-testid="legend" onClick={onClick} role="button" tabIndex={0} />
  ),
  ResponsiveContainer: ({ children, width, height }: { children: React.ReactNode; width?: string | number; height?: string | number }) => (
    <div data-testid="responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
  ),
  ReferenceLine: ({ y, onClick }: { y: number; onClick?: () => void }) => (
    <div data-testid="reference-line" data-y={y} onClick={onClick} role="button" tabIndex={0} />
  ),
}))

// Mock chart utils with theme switching capability
let mockTheme = vi.fn()
vi.mock('@/lib/chart-utils', () => ({
  useChartTheme: () => mockTheme(),
  getTooltipStyle: (theme: any) => ({
    contentStyle: { backgroundColor: theme?.colors?.tooltipBackground || '#f4f4f5' },
    labelStyle: { color: theme?.colors?.text || '#09090b' },
  }),
  getGridStyle: (theme: any) => ({
    stroke: theme?.colors?.grid || '#e4e4e7',
    strokeDasharray: '3 3',
  }),
  getAxisStyle: (theme: any) => ({
    stroke: theme?.colors?.axis || '#d4d4d8',
    tick: { fill: theme?.colors?.textMuted || '#52525b' },
  }),
  currencyFormatter: (value: number) => {
    if (value < 0.0001) return '<$0.0001'
    if (value < 1) return `$${value.toFixed(4)}`
    return `$${value.toFixed(2)}`
  },
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}))

// Theme configurations for integration testing
const lightTheme = {
  colors: {
    categorical: ['#0ea5e9', '#8b5cf6', '#22c55e'],
    primary: '#0ea5e9',
    warning: '#eab308',
    error: '#ef4444',
    grid: '#e4e4e7',
    axis: '#d4d4d8',
    text: '#09090b',
    textMuted: '#52525b',
    tooltipBackground: '#f4f4f5',
  },
  mode: 'light' as const,
  mounted: true,
}

const darkTheme = {
  colors: {
    categorical: ['#38bdf8', '#a855f7', '#34d399'],
    primary: '#38bdf8',
    warning: '#fbbf24',
    error: '#f87171',
    grid: '#374151',
    axis: '#6b7280',
    text: '#f9fafb',
    textMuted: '#d1d5db',
    tooltipBackground: '#1f2937',
  },
  mode: 'dark' as const,
  mounted: true,
}

// Test wrapper component with theme switching
function TestWrapper({ children, theme = 'light' }: { children: React.ReactNode; theme?: 'light' | 'dark' }) {
  return (
    <ThemeProvider attribute="class" defaultTheme={theme}>
      {children}
    </ThemeProvider>
  )
}

// Helper function to create realistic cost data for integration testing
function createIntegrationCostData(
  timeRange: PerformanceMetricsTimeRange = '24h',
  options: {
    withProjections?: boolean
    withBudget?: boolean
    withCacheSavings?: boolean
    dataPoints?: number
  } = {}
): CostTrendData {
  const {
    withProjections = true,
    withBudget = true,
    withCacheSavings = true,
    dataPoints = 24,
  } = options

  const baseTime = new Date('2024-01-01T00:00:00Z')
  const intervalMs = 60 * 60 * 1000 // 1 hour

  const data: CostTrendDataPoint[] = Array.from({ length: dataPoints }, (_, i) => {
    const baseCost = 0.5 + Math.sin(i * 0.1) * 0.2 + (i * 0.02) // Trending upward with oscillation
    const cost = Math.max(0.1, baseCost + (Math.random() - 0.5) * 0.1)
    const cumulativeCost = i === 0 ? cost : cost + (data[i - 1]?.cumulativeCost || 0)

    return {
      timestamp: new Date(baseTime.getTime() + i * intervalMs),
      cost,
      cumulativeCost,
      breakdown: {
        inputTokenCost: cost * 0.6,
        outputTokenCost: cost * 0.35,
        cacheCreationCost: cost * 0.03,
        cacheReadCost: cost * 0.01,
        otherCost: cost * 0.01,
      },
      projectedCost: withProjections ? cost * (1 + Math.random() * 0.3) : undefined,
    }
  })

  const totalCost = data.reduce((sum, point) => sum + point.cost, 0)
  const breakdown = data.reduce(
    (acc, point) => ({
      inputTokenCost: acc.inputTokenCost + point.breakdown!.inputTokenCost,
      outputTokenCost: acc.outputTokenCost + point.breakdown!.outputTokenCost,
      cacheCreationCost: acc.cacheCreationCost + point.breakdown!.cacheCreationCost,
      cacheReadCost: acc.cacheReadCost + point.breakdown!.cacheReadCost,
      otherCost: acc.otherCost + point.breakdown!.otherCost,
    }),
    { inputTokenCost: 0, outputTokenCost: 0, cacheCreationCost: 0, cacheReadCost: 0, otherCost: 0 }
  )

  return {
    data,
    totalCost,
    avgCostPerHour: totalCost / dataPoints,
    avgCostPerTask: totalCost / Math.max(1, dataPoints * 2),
    peakHourlyCost: Math.max(...data.map(p => p.cost)),
    breakdown,
    budgetLimit: withBudget ? totalCost * 1.2 : undefined,
    budgetUtilization: withBudget ? (totalCost / (totalCost * 1.2)) * 100 : undefined,
    projectedTotalCost: withProjections ? totalCost * 1.15 : undefined,
    cacheSavings: withCacheSavings ? breakdown.cacheCreationCost * 0.8 : undefined,
    timeRange,
    generatedAt: new Date(),
    trend: 1,
    changePercent: 15.5,
  }
}

describe('CostTrendChart Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTheme.mockReturnValue(lightTheme)
  })

  describe('Theme Integration', () => {
    it('adapts styling when theme changes from light to dark', async () => {
      const testData = createIntegrationCostData()
      mockTheme.mockReturnValue(lightTheme)

      const { rerender } = render(
        <TestWrapper theme="light">
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Switch to dark theme
      mockTheme.mockReturnValue(darkTheme)

      rerender(
        <TestWrapper theme="dark">
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles theme not yet mounted state', () => {
      const testData = createIntegrationCostData()
      mockTheme.mockReturnValue({ ...lightTheme, mounted: false })

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      // Should show skeleton when theme not mounted
      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })
  })

  describe('Data Updates and Real-time Behavior', () => {
    it('handles live data updates smoothly', async () => {
      let currentData = createIntegrationCostData('1h', { dataPoints: 5 })
      const onDataPointClick = vi.fn()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={currentData} onDataPointClick={onDataPointClick} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Simulate new data point arriving
      const newPoint: CostTrendDataPoint = {
        timestamp: new Date(currentData.data[4].timestamp.getTime() + 3600000),
        cost: 1.25,
        cumulativeCost: currentData.data[4].cumulativeCost + 1.25,
        breakdown: {
          inputTokenCost: 0.75,
          outputTokenCost: 0.50,
          cacheCreationCost: 0,
          cacheReadCost: 0,
          otherCost: 0,
        },
      }

      currentData = {
        ...currentData,
        data: [...currentData.data, newPoint],
        totalCost: currentData.totalCost + 1.25,
      }

      rerender(
        <TestWrapper>
          <CostTrendChart data={currentData} onDataPointClick={onDataPointClick} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles rapid data updates without performance issues', async () => {
      const baseData = createIntegrationCostData('1h', { dataPoints: 10 })
      const onDataPointClick = vi.fn()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={baseData} onDataPointClick={onDataPointClick} />
        </TestWrapper>
      )

      // Simulate 20 rapid updates
      for (let i = 0; i < 20; i++) {
        const updatedData = {
          ...baseData,
          totalCost: baseData.totalCost + i * 0.1,
          data: baseData.data.map(point => ({
            ...point,
            cost: point.cost + Math.random() * 0.05,
          })),
        }

        rerender(
          <TestWrapper>
            <CostTrendChart data={updatedData} onDataPointClick={onDataPointClick} />
          </TestWrapper>
        )
      }

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('supports data point click interactions', async () => {
      const testData = createIntegrationCostData()
      const onDataPointClick = vi.fn()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} onDataPointClick={onDataPointClick} />
        </TestWrapper>
      )

      const areaElement = screen.getByTestId('area-cost')
      fireEvent.click(areaElement)

      expect(onDataPointClick).toHaveBeenCalled()
    })

    it('handles legend interactions', async () => {
      const testData = createIntegrationCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} showLegend={true} />
        </TestWrapper>
      )

      const legend = screen.getByTestId('legend')
      fireEvent.click(legend)

      // Should not throw errors on legend click
      expect(legend).toBeInTheDocument()
    })

    it('provides keyboard navigation support', async () => {
      const testData = createIntegrationCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      const areaElement = screen.getByTestId('area-cost')

      // Test keyboard navigation
      fireEvent.keyDown(areaElement, { key: 'Enter' })
      fireEvent.keyDown(areaElement, { key: ' ' })

      expect(areaElement).toBeInTheDocument()
    })
  })

  describe('Tooltip Integration', () => {
    it('displays comprehensive tooltip information', async () => {
      const testData = createIntegrationCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} showBreakdown={true} showProjection={true} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toBeInTheDocument()

      // Tooltip should contain cost breakdown
      expect(tooltip).toHaveTextContent('Input Tokens')
      expect(tooltip).toHaveTextContent('Output Tokens')
      expect(tooltip).toHaveTextContent('Projected')
      expect(tooltip).toHaveTextContent('Cumulative Cost')
    })

    it('adapts tooltip content based on props', async () => {
      const testData = createIntegrationCostData()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} showBreakdown={false} showProjection={false} />
        </TestWrapper>
      )

      let tooltip = screen.getByTestId('tooltip')
      expect(tooltip).not.toHaveTextContent('Input Tokens')
      expect(tooltip).not.toHaveTextContent('Projected')

      rerender(
        <TestWrapper>
          <CostTrendChart data={testData} showBreakdown={true} showProjection={true} />
        </TestWrapper>
      )

      tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveTextContent('Input Tokens')
      expect(tooltip).toHaveTextContent('Projected')
    })
  })

  describe('Chart Variants and Configuration', () => {
    it('switches between area and line variants seamlessly', async () => {
      const testData = createIntegrationCostData()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} variant="area" />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-cost')).toBeInTheDocument()

      rerender(
        <TestWrapper>
          <CostTrendChart data={testData} variant="line" />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByTestId('line-cost')).toBeInTheDocument()
    })

    it('handles cumulative view toggle correctly', async () => {
      const testData = createIntegrationCostData()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} showCumulative={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cost')).toBeInTheDocument()

      rerender(
        <TestWrapper>
          <CostTrendChart data={testData} showCumulative={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-cumulativeCost')).toBeInTheDocument()
    })

    it('manages budget limit display appropriately', async () => {
      const testData = createIntegrationCostData(undefined, { withBudget: true })

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} showBudgetLimit={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('reference-line')).toBeInTheDocument()

      rerender(
        <TestWrapper>
          <CostTrendChart data={testData} showBudgetLimit={false} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument()
    })

    it('shows projection lines in line charts when enabled', async () => {
      const testData = createIntegrationCostData(undefined, { withProjections: true })

      render(
        <TestWrapper>
          <CostTrendChart data={testData} variant="line" showProjection={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByTestId('line-cost')).toBeInTheDocument()
      expect(screen.getByTestId('line-projectedCost')).toBeInTheDocument()
    })
  })

  describe('Responsive Behavior', () => {
    it('adapts to different container sizes', async () => {
      const testData = createIntegrationCostData()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} height={200} />
        </TestWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()

      rerender(
        <TestWrapper>
          <CostTrendChart data={testData} height={500} />
        </TestWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('maintains functionality in mini variant', async () => {
      const testData = createIntegrationCostData()

      render(
        <TestWrapper>
          <CostTrendChartMini data={testData} height={80} />
        </TestWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-cost')).toBeInTheDocument()
    })
  })

  describe('Performance Metrics Integration', () => {
    it('handles different time ranges correctly', async () => {
      const timeRanges: PerformanceMetricsTimeRange[] = ['1h', '6h', '24h', '7d', '30d']

      for (const timeRange of timeRanges) {
        const testData = createIntegrationCostData(timeRange)

        const { unmount } = render(
          <TestWrapper>
            <CostTrendChart data={testData} />
          </TestWrapper>
        )

        const chart = screen.getByRole('img')
        expect(chart).toHaveAttribute('aria-label', expect.stringContaining(`Cost trend over ${timeRange}`))

        unmount()
      }
    })

    it('integrates with cost breakdown display', async () => {
      const testData = createIntegrationCostData(undefined, { withCacheSavings: true })

      render(
        <TestWrapper>
          <CostTrendChart data={testData} showBreakdown={true} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Cost trend summary/, { selector: '.sr-only' })
      expect(summary).toHaveTextContent('Cache savings')
    })
  })

  describe('Error Handling and Recovery', () => {
    it('recovers gracefully from data corruption', async () => {
      const validData = createIntegrationCostData()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={validData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Corrupt the data
      const corruptData = {
        ...validData,
        data: validData.data.map(point => ({
          ...point,
          cost: NaN,
          cumulativeCost: Infinity,
        })),
      }

      rerender(
        <TestWrapper>
          <CostTrendChart data={corruptData} />
        </TestWrapper>
      )

      // Should still render without throwing
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Recover with valid data
      rerender(
        <TestWrapper>
          <CostTrendChart data={validData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('maintains state consistency during prop changes', async () => {
      const testData = createIntegrationCostData()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} variant="area" showBreakdown={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Change multiple props simultaneously
      rerender(
        <TestWrapper>
          <CostTrendChart
            data={testData}
            variant="line"
            showBreakdown={true}
            showCumulative={true}
            showBudgetLimit={false}
            height={400}
          />
        </TestWrapper>
      )

      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      expect(screen.getByTestId('line-cumulativeCost')).toBeInTheDocument()
    })
  })

  describe('Accessibility Integration', () => {
    it('maintains accessibility across theme changes', async () => {
      const testData = createIntegrationCostData()

      const { rerender } = render(
        <TestWrapper theme="light">
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      let chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')

      rerender(
        <TestWrapper theme="dark">
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')
    })

    it('provides consistent screen reader experience', async () => {
      const testData = createIntegrationCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Cost trend summary/, { selector: '.sr-only' })
      expect(summary).toBeInTheDocument()
      expect(summary).toHaveTextContent('total cost')
      expect(summary).toHaveTextContent('average cost per hour')
    })
  })
})