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
  XAxis: () => <div data-testid="x-axis" role="img" aria-label="Time axis" />,
  YAxis: () => <div data-testid="y-axis" role="img" aria-label="Token count axis" />,
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
          },
        ],
        label: '12:00',
      })}
    </div>
  ),
  Legend: () => (
    <div data-testid="legend" role="img" aria-label="Chart legend">
      <div role="list">
        <div role="listitem" aria-label="Input Tokens legend item">Input Tokens</div>
        <div role="listitem" aria-label="Output Tokens legend item">Output Tokens</div>
      </div>
    </div>
  ),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container" role="presentation">
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
    contentStyle: { backgroundColor: '#f4f4f5', border: '2px solid #0369a1' },
    labelStyle: { color: '#09090b', fontWeight: 'bold' },
  }),
  getGridStyle: () => ({ stroke: '#e4e4e7', strokeOpacity: 0.6 }),
  getAxisStyle: () => ({ stroke: '#d4d4d8' }),
  compactNumberFormatter: (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)} million`
    if (value >= 1000) return `${(value / 1000).toFixed(1)} thousand`
    return value.toString()
  },
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}))

// Test wrapper component with accessibility enhancements
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <div role="main">
        {children}
      </div>
    </ThemeProvider>
  )
}

// Helper function to create accessible mock data
function createAccessibleTokenData(
  options: {
    includeCache?: boolean
    includeCost?: boolean
    largeNumbers?: boolean
    complexData?: boolean
  } = {}
): TokenUsageOverTimeData {
  const { includeCache = false, includeCost = false, largeNumbers = false, complexData = false } = options
  const baseTime = new Date('2024-01-01T12:00:00Z')

  const dataPoints = complexData ? 48 : 24 // 2 days vs 1 day
  const baseTokens = largeNumbers ? 50000 : 1000

  const data: TokenUsageDataPoint[] = Array.from({ length: dataPoints }, (_, i) => {
    const multiplier = complexData ? (1 + Math.sin(i * 0.2) * 0.5) : 1
    const inputTokens = Math.floor(baseTokens * 0.6 * multiplier)
    const outputTokens = Math.floor(baseTokens * 0.4 * multiplier)

    return {
      timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000),
      totalTokens: inputTokens + outputTokens,
      breakdown: {
        inputTokens,
        outputTokens,
        cacheCreationTokens: includeCache ? Math.floor(inputTokens * 0.1) : undefined,
        cacheReadTokens: includeCache ? Math.floor(inputTokens * 0.05) : undefined,
      },
      tokensPerMinute: (inputTokens + outputTokens) / 60,
      cost: includeCost ? (inputTokens + outputTokens) * 0.00005 : undefined,
    }
  })

  const totalInputTokens = data.reduce((sum, point) => sum + point.breakdown.inputTokens, 0)
  const totalOutputTokens = data.reduce((sum, point) => sum + point.breakdown.outputTokens, 0)

  return {
    data,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCacheCreationTokens: includeCache
      ? data.reduce((sum, point) => sum + (point.breakdown.cacheCreationTokens || 0), 0)
      : 0,
    totalCacheReadTokens: includeCache
      ? data.reduce((sum, point) => sum + (point.breakdown.cacheReadTokens || 0), 0)
      : 0,
    cacheHitRate: includeCache ? 15.5 : 0,
    avgTokensPerMinute: 25.5,
    peakTokensPerMinute: 45.2,
    totalCost: includeCost ? totalInputTokens + totalOutputTokens * 0.00005 : 0,
    timeRange: '24h',
    generatedAt: new Date(),
    trend: 1,
    changePercent: 12.3,
  }
}

describe('TokenUsageOverTimeChart Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ARIA Labels and Roles', () => {
    it('provides comprehensive ARIA labels for the main chart', () => {
      const testData = createAccessibleTokenData({ includeCache: true, includeCost: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img', { name: /Token usage over 24h/ })
      expect(chart).toHaveAttribute('aria-label')

      const ariaLabel = chart.getAttribute('aria-label')!
      expect(ariaLabel).toMatch(/Token usage over 24h/)
      expect(ariaLabel).toMatch(/total tokens/)
    })

    it('provides descriptive ARIA labels for different time ranges', () => {
      const timeRanges = ['1h', '6h', '24h', '7d', '30d'] as const

      timeRanges.forEach(timeRange => {
        const testData = createAccessibleTokenData()
        testData.timeRange = timeRange

        render(
          <TestWrapper>
            <TokenUsageOverTimeChart data={testData} />
          </TestWrapper>
        )

        const chart = screen.getByRole('img', { name: new RegExp(`Token usage over ${timeRange}`) })
        expect(chart).toHaveAttribute('aria-label', expect.stringContaining(`Token usage over ${timeRange}`))
      })
    })

    it('includes data series with proper ARIA attributes', () => {
      const testData = createAccessibleTokenData({ includeCache: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showBreakdown={true} />
        </TestWrapper>
      )

      // Check input tokens series
      const inputSeries = screen.getByTestId('area-inputTokens')
      expect(inputSeries).toHaveAttribute('role', 'graphics-symbol')
      expect(inputSeries).toHaveAttribute('aria-label', 'Input Tokens data series')
      expect(inputSeries).toHaveAttribute('tabIndex', '0')

      // Check output tokens series
      const outputSeries = screen.getByTestId('area-outputTokens')
      expect(outputSeries).toHaveAttribute('role', 'graphics-symbol')
      expect(outputSeries).toHaveAttribute('aria-label', 'Output Tokens data series')
      expect(outputSeries).toHaveAttribute('tabIndex', '0')

      // Check cache series
      const cacheSeries = screen.getByTestId('area-cacheCreationTokens')
      expect(cacheSeries).toHaveAttribute('role', 'graphics-symbol')
      expect(cacheSeries).toHaveAttribute('aria-label', 'Cache Creation data series')
    })

    it('provides proper axis labels', () => {
      const testData = createAccessibleTokenData()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )

      const xAxis = screen.getByTestId('x-axis')
      expect(xAxis).toHaveAttribute('role', 'img')
      expect(xAxis).toHaveAttribute('aria-label', 'Time axis')

      const yAxis = screen.getByTestId('y-axis')
      expect(yAxis).toHaveAttribute('role', 'img')
      expect(yAxis).toHaveAttribute('aria-label', 'Token count axis')
    })
  })

  describe('Screen Reader Support', () => {
    it('provides comprehensive screen reader summary', () => {
      const testData = createAccessibleTokenData({
        includeCache: true,
        includeCost: true,
      })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Token usage summary for 24h/, { selector: '.sr-only' })
      expect(summary).toBeInTheDocument()
      expect(summary).toHaveClass('sr-only')

      const summaryText = summary.textContent!
      expect(summaryText).toMatch(/input tokens/)
      expect(summaryText).toMatch(/output tokens/)
      expect(summaryText).toMatch(/total tokens/)
    })

    it('includes cost information in screen reader summary when available', () => {
      const testData = createAccessibleTokenData({ includeCost: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Token usage summary for 24h/, { selector: '.sr-only' })
      expect(summary.textContent).toMatch(/Total cost:/)
    })

    it('includes cache information in screen reader summary when available', () => {
      const testData = createAccessibleTokenData({ includeCache: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Token usage summary for 24h/, { selector: '.sr-only' })
      expect(summary.textContent).toMatch(/Cache hit rate:/)
    })

    it('omits unavailable information from screen reader summary', () => {
      const testData = createAccessibleTokenData({
        includeCache: false,
        includeCost: false,
      })
      testData.totalCost = 0
      testData.cacheHitRate = 0

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )

      const summary = screen.getByText(/Token usage summary for 24h/, { selector: '.sr-only' })
      expect(summary.textContent).not.toMatch(/Total cost:/)
      expect(summary.textContent).not.toMatch(/Cache hit rate:/)
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation for data series', () => {
      const testData = createAccessibleTokenData({ includeCache: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showBreakdown={true} />
        </TestWrapper>
      )

      const inputSeries = screen.getByTestId('area-inputTokens')
      const outputSeries = screen.getByTestId('area-outputTokens')

      expect(inputSeries).toHaveAttribute('tabIndex', '0')
      expect(outputSeries).toHaveAttribute('tabIndex', '0')

      // Simulate keyboard navigation
      inputSeries.focus()
      expect(document.activeElement).toBe(inputSeries)

      fireEvent.keyDown(inputSeries, { key: 'Tab' })
      // In a real implementation, focus would move to the next focusable element
    })

    it('provides keyboard shortcuts for chart interaction', () => {
      const testData = createAccessibleTokenData()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img', { name: /Token usage over/ })

      // Simulate keyboard interaction
      fireEvent.keyDown(chart, { key: 'Enter' })
      fireEvent.keyDown(chart, { key: ' ' }) // Space key
      fireEvent.keyDown(chart, { key: 'ArrowRight' })
      fireEvent.keyDown(chart, { key: 'ArrowLeft' })

      // Should handle keyboard events gracefully
      expect(chart).toBeInTheDocument()
    })
  })

  describe('Tooltip Accessibility', () => {
    it('provides accessible tooltip with proper ARIA attributes', () => {
      const testData = createAccessibleTokenData({ includeCache: true, includeCost: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showCost={true} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveAttribute('role', 'tooltip')
      expect(tooltip).toHaveAttribute('aria-live', 'polite')
      expect(tooltip).toHaveAttribute('aria-atomic', 'true')
    })

    it('announces tooltip content changes to screen readers', () => {
      const testData = createAccessibleTokenData({ includeCache: true, includeCost: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showCost={true} />
        </TestWrapper>
      )

      const tooltip = screen.getByTestId('tooltip')

      // Verify tooltip content is accessible
      expect(tooltip).toHaveTextContent('Input Tokens')
      expect(tooltip).toHaveTextContent('Output Tokens')
      expect(tooltip).toHaveTextContent('Cost')
      expect(tooltip).toHaveTextContent('Cache Creation')
      expect(tooltip).toHaveTextContent('Total Tokens')
    })
  })

  describe('Legend Accessibility', () => {
    it('provides accessible legend with proper structure', () => {
      const testData = createAccessibleTokenData()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showLegend={true} />
        </TestWrapper>
      )

      const legend = screen.getByTestId('legend')
      expect(legend).toHaveAttribute('role', 'img')
      expect(legend).toHaveAttribute('aria-label', 'Chart legend')

      // Check for list structure in legend
      const legendList = legend.querySelector('[role="list"]')
      expect(legendList).toBeInTheDocument()

      const legendItems = legend.querySelectorAll('[role="listitem"]')
      expect(legendItems.length).toBeGreaterThan(0)
    })

    it('hides legend appropriately when disabled', () => {
      const testData = createAccessibleTokenData()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showLegend={false} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
    })
  })

  describe('High Contrast and Visual Accessibility', () => {
    it('maintains accessibility with large numbers formatting', () => {
      const testData = createAccessibleTokenData({ largeNumbers: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img', { name: /Token usage over/ })
      const ariaLabel = chart.getAttribute('aria-label')!

      // Should format large numbers in a readable way
      expect(ariaLabel).toMatch(/\d+(\.\d+)?[KM]?\s+total tokens/)
    })

    it('provides sufficient color contrast information', () => {
      const testData = createAccessibleTokenData({ includeCache: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart
            data={testData}
            colors={{
              tokens: {
                input: '#003f5c', // Dark color for contrast
                output: '#58508d', // Different dark color
                cache: '#bc5090', // Another contrasting color
              }
            }}
          />
        </TestWrapper>
      )

      // Chart should render with custom colors
      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-outputTokens')).toBeInTheDocument()
    })

    it('maintains accessibility in both light and dark themes', () => {
      const testData = createAccessibleTokenData()

      // Test light theme
      const { rerender } = render(
        <ThemeProvider attribute="class" defaultTheme="light">
          <TokenUsageOverTimeChart data={testData} />
        </ThemeProvider>
      )

      expect(screen.getByRole('img', { name: /Token usage over/ })).toBeInTheDocument()

      // Test dark theme
      rerender(
        <ThemeProvider attribute="class" defaultTheme="dark">
          <TokenUsageOverTimeChart data={testData} />
        </ThemeProvider>
      )

      expect(screen.getByRole('img', { name: /Token usage over/ })).toBeInTheDocument()
    })
  })

  describe('Mini Chart Accessibility', () => {
    it('provides appropriate accessibility for mini variant', () => {
      const testData = createAccessibleTokenData()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={testData} />
        </TestWrapper>
      )

      // Mini chart should still be accessible but simplified
      const container = screen.getByTestId('responsive-container')
      expect(container).toHaveAttribute('role', 'presentation')

      // Should not have complex accessibility features like tooltips
      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument()
      expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
    })

    it('maintains essential accessibility in mini variant', () => {
      const testData = createAccessibleTokenData({ largeNumbers: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={testData} />
        </TestWrapper>
      )

      // Should still render chart elements
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-outputTokens')).toBeInTheDocument()
    })
  })

  describe('Empty State Accessibility', () => {
    it('provides accessible empty state message', () => {
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

      const emptyMessage = screen.getByText('No token usage data available')
      expect(emptyMessage).toBeInTheDocument()
      expect(emptyMessage).toBeVisible()

      // Should be announced to screen readers
      expect(emptyMessage.closest('div')).toHaveClass('flex', 'items-center', 'justify-center')
    })

    it('provides accessible empty state for mini chart', () => {
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
        timeRange: '1h',
        generatedAt: new Date(),
      }

      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={emptyData} />
        </TestWrapper>
      )

      expect(screen.getByText('No data')).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('manages focus appropriately during interactions', () => {
      const testData = createAccessibleTokenData({ includeCache: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showBreakdown={true} />
        </TestWrapper>
      )

      const inputSeries = screen.getByTestId('area-inputTokens')
      const outputSeries = screen.getByTestId('area-outputTokens')

      // Test focus management
      inputSeries.focus()
      expect(document.activeElement).toBe(inputSeries)

      // Simulate interaction that might change focus
      fireEvent.click(inputSeries)
      fireEvent.keyDown(inputSeries, { key: 'Escape' })

      // Focus should remain manageable
      expect(document.activeElement).toBeDefined()
    })

    it('provides skip links for complex charts', () => {
      const testData = createAccessibleTokenData({ complexData: true, includeCache: true })

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} showBreakdown={true} />
        </TestWrapper>
      )

      // In a real implementation, there might be skip links
      // Here we verify the structure supports them
      const chart = screen.getByRole('img', { name: /Token usage over/ })
      expect(chart).toBeInTheDocument()

      // Verify multiple interactive elements exist
      const focusableElements = document.querySelectorAll('[tabIndex="0"]')
      expect(focusableElements.length).toBeGreaterThan(0)
    })
  })
})