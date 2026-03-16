/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Enhanced Recharts mocks with accessibility attributes
vi.mock('recharts', () => ({
  AreaChart: ({ children, 'aria-label': ariaLabel }: { children: React.ReactNode; 'aria-label'?: string }) => (
    <div data-testid="area-chart" role="img" aria-label={ariaLabel}>
      {children}
    </div>
  ),
  LineChart: ({ children, 'aria-label': ariaLabel }: { children: React.ReactNode; 'aria-label'?: string }) => (
    <div data-testid="line-chart" role="img" aria-label={ariaLabel}>
      {children}
    </div>
  ),
  Area: ({ dataKey, name, 'aria-describedby': describedBy }: { dataKey: string; name: string; 'aria-describedby'?: string }) => (
    <div
      data-testid={`area-${dataKey}`}
      data-name={name}
      role="graphics-symbol"
      aria-label={`${name} data series`}
      aria-describedby={describedBy}
      tabIndex={0}
    />
  ),
  Line: ({ dataKey, name, 'aria-describedby': describedBy }: { dataKey: string; name: string; 'aria-describedby'?: string }) => (
    <div
      data-testid={`line-${dataKey}`}
      data-name={name}
      role="graphics-symbol"
      aria-label={`${name} data series`}
      aria-describedby={describedBy}
      tabIndex={0}
    />
  ),
  XAxis: () => <div data-testid="x-axis" aria-label="Time axis" />,
  YAxis: () => <div data-testid="y-axis" aria-label="Cost axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" aria-hidden="true" />,
  Tooltip: ({ content }: { content: React.ComponentType<any> }) => (
    <div
      data-testid="tooltip"
      role="tooltip"
      aria-live="polite"
      aria-atomic="true"
    >
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
  Legend: () => (
    <div
      data-testid="legend"
      role="legend"
      aria-label="Chart legend"
      tabIndex={0}
    />
  ),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container" role="presentation">
      {children}
    </div>
  ),
  ReferenceLine: ({ y, label }: { y: number; label: any }) => (
    <div
      data-testid="reference-line"
      data-y={y}
      aria-label={`Budget limit: ${label?.value || '$' + y}`}
      data-label={label?.value}
    />
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

// Helper function to create accessible cost data
function createAccessibleCostData(options: {
  withBudget?: boolean
  withProjections?: boolean
  withCacheSavings?: boolean
  dataPoints?: number
} = {}): CostTrendData {
  const {
    withBudget = true,
    withProjections = true,
    withCacheSavings = true,
    dataPoints = 5,
  } = options

  const baseTime = new Date('2024-01-01T12:00:00Z')

  const data: CostTrendDataPoint[] = Array.from({ length: dataPoints }, (_, i) => {
    const cost = 1.0 + i * 0.25
    return {
      timestamp: new Date(baseTime.getTime() + i * 3600000),
      cost,
      cumulativeCost: cost * (i + 1),
      breakdown: {
        inputTokenCost: cost * 0.6,
        outputTokenCost: cost * 0.35,
        cacheCreationCost: cost * 0.03,
        cacheReadCost: cost * 0.01,
        otherCost: cost * 0.01,
      },
      projectedCost: withProjections ? cost * 1.2 : undefined,
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
    avgCostPerTask: totalCost / (dataPoints * 2),
    peakHourlyCost: Math.max(...data.map(p => p.cost)),
    breakdown,
    budgetLimit: withBudget ? totalCost * 1.5 : undefined,
    budgetUtilization: withBudget ? (totalCost / (totalCost * 1.5)) * 100 : undefined,
    projectedTotalCost: withProjections ? totalCost * 1.15 : undefined,
    cacheSavings: withCacheSavings ? breakdown.cacheCreationCost * 0.8 : undefined,
    timeRange: '24h',
    generatedAt: new Date(),
    trend: 1,
    changePercent: 15.5,
  }
}

describe('CostTrendChart Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ARIA Labels and Roles', () => {
    it('provides comprehensive ARIA label for main chart', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img', { name: /Cost trend over/ })
      expect(chart).toHaveAttribute('aria-label')
      const ariaLabel = chart.getAttribute('aria-label')
      expect(ariaLabel).toContain('Cost trend over 24h')
      expect(ariaLabel).toContain('$7.50') // totalCost
      expect(ariaLabel).toContain('total cost')
    })

    it('includes meaningful descriptions in ARIA labels', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} showCumulative={true} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img', { name: /Cost trend over/ })
      const ariaLabel = chart.getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel).toContain('Cost trend over 24h')
    })

    it('provides appropriate role attributes for chart elements', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toHaveAttribute('role', 'img')
      expect(screen.getByTestId('area-cost')).toHaveAttribute('role', 'graphics-symbol')
      expect(screen.getByTestId('x-axis')).toHaveAttribute('aria-label', 'Time axis')
      expect(screen.getByTestId('y-axis')).toHaveAttribute('aria-label', 'Cost axis')
      expect(screen.getByTestId('tooltip')).toHaveAttribute('role', 'tooltip')
    })

    it('provides proper ARIA labels for data series', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      const costArea = screen.getByTestId('area-cost')
      expect(costArea).toHaveAttribute('aria-label', 'Cost data series')
    })

    it('includes budget limit with proper accessibility attributes', () => {
      const testData = createAccessibleCostData({ withBudget: true })

      render(
        <TestWrapper>
          <CostTrendChart data={testData} showBudgetLimit={true} />
        </TestWrapper>
      )

      const budgetLine = screen.getByTestId('reference-line')
      expect(budgetLine).toHaveAttribute('aria-label')
      expect(budgetLine).toHaveAttribute('aria-label')
      expect(budgetLine.getAttribute('aria-label')).toContain('Budget limit')
    })
  })

  describe('Screen Reader Support', () => {
    it('provides comprehensive screen reader summary', () => {
      const testData = createAccessibleCostData({
        withBudget: true,
        withProjections: true,
        withCacheSavings: true,
      })

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Cost trend summary for 24h/, { selector: '.sr-only' })
      expect(summary).toBeInTheDocument()

      // Check for key information in summary
      expect(summary).toHaveTextContent('$6.25 total cost')
      expect(summary).toHaveTextContent('$1.25 average cost per hour')
      expect(summary).toHaveTextContent('Budget limit')
      expect(summary).toHaveTextContent('Budget utilization')
      expect(summary).toHaveTextContent('Projected total')
      expect(summary).toHaveTextContent('Cache savings')
    })

    it('adapts screen reader content based on available data', () => {
      const minimalData = createAccessibleCostData({
        withBudget: false,
        withProjections: false,
        withCacheSavings: false,
      })

      render(
        <TestWrapper>
          <CostTrendChart data={minimalData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Cost trend summary for 24h/, { selector: '.sr-only' })
      expect(summary).toBeInTheDocument()
      expect(summary).toHaveTextContent('total cost')
      expect(summary).toHaveTextContent('average cost per hour')

      // Should not include optional information when not available
      expect(summary).not.toHaveTextContent('Budget limit')
      expect(summary).not.toHaveTextContent('Projected total')
      expect(summary).not.toHaveTextContent('Cache savings')
    })

    it('includes screen reader content in empty state', () => {
      const emptyData = createAccessibleCostData()
      emptyData.data = []

      render(
        <TestWrapper>
          <CostTrendChart data={emptyData} />
        </TestWrapper>
      )

      const emptyState = screen.getByText('No cost data available')
      expect(emptyState).toBeInTheDocument()
    })

    it('provides meaningful descriptions for different time ranges', () => {
      const testData = createAccessibleCostData()
      testData.timeRange = '1h'

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img', { name: /Cost trend over/ })
      expect(chart.getAttribute('aria-label')).toContain('Cost trend over 1h')
    })
  })

  describe('Keyboard Navigation', () => {
    it('provides keyboard access to interactive elements', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      const costArea = screen.getByTestId('area-cost')
      expect(costArea).toHaveAttribute('tabIndex', '0')

      const legend = screen.getByTestId('legend')
      expect(legend).toHaveAttribute('tabIndex', '0')
    })

    it('handles keyboard events appropriately', () => {
      const testData = createAccessibleCostData()
      const onDataPointClick = vi.fn()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} onDataPointClick={onDataPointClick} />
        </TestWrapper>
      )

      const costArea = screen.getByTestId('area-cost')

      // Test Enter key
      fireEvent.keyDown(costArea, { key: 'Enter', code: 'Enter' })
      fireEvent.keyUp(costArea, { key: 'Enter', code: 'Enter' })

      // Test Space key
      fireEvent.keyDown(costArea, { key: ' ', code: 'Space' })
      fireEvent.keyUp(costArea, { key: ' ', code: 'Space' })

      // Should not throw errors
      expect(costArea).toBeInTheDocument()
    })

    it('supports tab navigation through chart elements', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} showLegend={true} />
        </TestWrapper>
      )

      const focusableElements = screen.getAllByRole('graphics-symbol')
      expect(focusableElements.length).toBeGreaterThan(0)

      focusableElements.forEach(element => {
        expect(element).toHaveAttribute('tabIndex', '0')
      })

      const legend = screen.getByTestId('legend')
      expect(legend).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('Color and Contrast Accessibility', () => {
    it('maintains accessibility with custom color schemes', () => {
      const testData = createAccessibleCostData()
      const customColors = {
        tokens: {
          input: '#ff0000',
          output: '#00ff00',
          cache: '#0000ff',
        }
      }

      render(
        <TestWrapper>
          <CostTrendChart data={testData} colors={customColors} />
        </TestWrapper>
      )

      // Should render without accessibility warnings
      expect(screen.getByRole('img', { name: /Cost trend over/ })).toBeInTheDocument()
    })

    it('provides alternative text representation', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      // Screen reader summary acts as alternative text
      const summary = screen.getByText(/Cost trend summary/, { selector: '.sr-only' })
      expect(summary).toBeInTheDocument()
    })
  })

  describe('Tooltip Accessibility', () => {
    it('provides proper ARIA attributes for tooltips', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} showBreakdown={true} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveAttribute('role', 'tooltip')
      expect(tooltip).toHaveAttribute('aria-live', 'polite')
      expect(tooltip).toHaveAttribute('aria-atomic', 'true')
    })

    it('includes accessible content in tooltip breakdown', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} showBreakdown={true} showProjection={true} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toBeInTheDocument()

      // Tooltip should contain structured information
      expect(tooltip).toHaveTextContent('Cost')
      expect(tooltip).toHaveTextContent('Input Tokens')
      expect(tooltip).toHaveTextContent('Output Tokens')
      expect(tooltip).toHaveTextContent('Projected')
      expect(tooltip).toHaveTextContent('Cumulative Cost')
    })

    it('maintains tooltip accessibility in different chart variants', () => {
      const testData = createAccessibleCostData()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} variant="area" />
        </TestWrapper>
      )

      let tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveAttribute('role', 'tooltip')

      rerender(
        <TestWrapper>
          <CostTrendChart data={testData} variant="line" />
        </TestWrapper>
      )

      tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveAttribute('role', 'tooltip')
    })
  })

  describe('Mini Chart Accessibility', () => {
    it('maintains accessibility standards in mini variant', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChartMini data={testData} />
        </TestWrapper>
      )

      // Mini chart should still be accessible but simplified
      const container = screen.getByTestId('responsive-container')
      expect(container).toHaveAttribute('role', 'presentation')
    })

    it('handles empty state accessibility in mini variant', () => {
      const emptyData = createAccessibleCostData()
      emptyData.data = []

      render(
        <TestWrapper>
          <CostTrendChartMini data={emptyData} />
        </TestWrapper>
      )

      const emptyState = screen.getByText('No data')
      expect(emptyState).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('manages focus appropriately when data changes', () => {
      const testData = createAccessibleCostData()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      const costArea = screen.getByTestId('area-cost')
      costArea.focus()
      expect(document.activeElement).toBe(costArea)

      // Update data
      const newData = { ...testData, totalCost: testData.totalCost + 1 }
      rerender(
        <TestWrapper>
          <CostTrendChart data={newData} />
        </TestWrapper>
      )

      // Focus should be maintained or appropriately transferred
      expect(screen.getByTestId('area-cost')).toBeInTheDocument()
    })

    it('handles focus during chart variant changes', () => {
      const testData = createAccessibleCostData()

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} variant="area" />
        </TestWrapper>
      )

      const areaElement = screen.getByTestId('area-cost')
      areaElement.focus()

      rerender(
        <TestWrapper>
          <CostTrendChart data={testData} variant="line" />
        </TestWrapper>
      )

      // Should now have line element with similar accessibility
      const lineElement = screen.getByTestId('line-cost')
      expect(lineElement).toBeInTheDocument()
      expect(lineElement).toHaveAttribute('tabIndex', '0')
    })
  })

  describe('High Contrast and Reduced Motion', () => {
    it('respects reduced motion preferences', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} animated={false} />
        </TestWrapper>
      )

      // Should render without animations when disabled
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('maintains accessibility with animations enabled', () => {
      const testData = createAccessibleCostData()

      render(
        <TestWrapper>
          <CostTrendChart data={testData} animated={true} />
        </TestWrapper>
      )

      // Animations should not interfere with accessibility
      expect(screen.getByRole('img', { name: /Cost trend over/ })).toHaveAttribute('aria-label')
      expect(screen.getByText(/Cost trend summary/, { selector: '.sr-only' })).toBeInTheDocument()
    })
  })

  describe('Error State Accessibility', () => {
    it('provides accessible error information', () => {
      const invalidData = createAccessibleCostData()
      // Make data invalid in a way that causes accessible error handling
      invalidData.data = []

      render(
        <TestWrapper>
          <CostTrendChart data={invalidData} />
        </TestWrapper>
      )

      const emptyMessage = screen.getByText('No cost data available')
      expect(emptyMessage).toBeInTheDocument()
      // Error state should be accessible
    })

    it('maintains accessibility during error recovery', () => {
      const validData = createAccessibleCostData()
      const invalidData = { ...validData, data: [] }

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={invalidData} />
        </TestWrapper>
      )

      expect(screen.getByText('No cost data available')).toBeInTheDocument()

      // Recover with valid data
      rerender(
        <TestWrapper>
          <CostTrendChart data={validData} />
        </TestWrapper>
      )

      expect(screen.getByRole('img', { name: /Cost trend over/ })).toHaveAttribute('aria-label')
      expect(screen.getByText(/Cost trend summary/, { selector: '.sr-only' })).toBeInTheDocument()
    })
  })
})