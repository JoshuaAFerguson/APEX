/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ThemeProvider } from 'next-themes'
import {
  TaskCompletionRateChart,
  TaskCompletionRateChartMini,
} from '../TaskCompletionRateChart'
import type { TaskCompletionRateData } from '@/types/performance-metrics'

// Mock window.matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: query.includes('(prefers-color-scheme: dark)'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver for responsive container
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock Recharts with more realistic behavior
vi.mock('recharts', () => ({
  PieChart: ({ children, ...props }: any) => (
    <div data-testid="pie-chart" data-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
  BarChart: ({ children, data, ...props }: any) => (
    <div data-testid="bar-chart" data-props={JSON.stringify(props)} data-length={data?.length || 0}>
      {children}
    </div>
  ),
  Pie: ({ data, dataKey, onClick, children, animationDuration, ...props }: any) => (
    <div
      data-testid={`pie-${dataKey}`}
      data-animation-duration={animationDuration}
      data-data-length={data?.length || 0}
      onClick={() => onClick && onClick(data?.[0] || {})}
      {...props}
    >
      {children}
    </div>
  ),
  Cell: ({ fill, stroke, strokeWidth, ...props }: any) => (
    <div
      data-testid="pie-cell"
      style={{ backgroundColor: fill, borderColor: stroke, borderWidth: strokeWidth }}
      {...props}
    />
  ),
  Bar: ({ dataKey, fill, radius, stackId, animationDuration, ...props }: any) => (
    <div
      data-testid={`bar-${dataKey}`}
      data-stack-id={stackId}
      data-animation-duration={animationDuration}
      style={{ backgroundColor: fill, borderRadius: radius }}
      {...props}
    />
  ),
  XAxis: ({ dataKey, tickMargin, width, ...props }: any) => (
    <div data-testid="x-axis" data-key={dataKey} data-tick-margin={tickMargin} data-width={width} {...props} />
  ),
  YAxis: ({ tickMargin, width, ...props }: any) => (
    <div data-testid="y-axis" data-tick-margin={tickMargin} data-width={width} {...props} />
  ),
  CartesianGrid: ({ stroke, strokeDasharray, strokeOpacity }: any) => (
    <div
      data-testid="cartesian-grid"
      style={{ stroke, strokeDasharray, strokeOpacity }}
    />
  ),
  Tooltip: ({ content, contentStyle, ...props }: any) => (
    <div
      data-testid="tooltip"
      style={{ ...contentStyle }}
      {...props}
    >
      {content}
    </div>
  ),
  Legend: ({ verticalAlign, iconType, wrapperStyle, formatter, ...props }: any) => (
    <div
      data-testid="legend"
      data-vertical-align={verticalAlign}
      data-icon-type={iconType}
      style={wrapperStyle}
      {...props}
    >
      {formatter && (
        <>
          <span>{formatter('completed')}</span>
          <span>{formatter('failed')}</span>
        </>
      )}
    </div>
  ),
  ResponsiveContainer: ({ children, width, height }: any) => (
    <div
      data-testid="responsive-container"
      data-width={width}
      data-height={height}
      style={{ width, height }}
    >
      {children}
    </div>
  ),
}))

// Mock chart utils with theme switching capability
vi.mock('@/lib/chart-utils', () => {
  const createThemeMock = (mode: 'light' | 'dark', mounted = true) => ({
    useChartTheme: () => ({
      colors: {
        categorical: mode === 'light' ? ['#22c55e', '#ef4444', '#eab308'] : ['#16a34a', '#dc2626', '#ca8a04'],
        primary: mode === 'light' ? '#0ea5e9' : '#0284c7',
        background: mode === 'light' ? '#ffffff' : '#09090b',
        border: mode === 'light' ? '#e4e4e7' : '#27272a',
      },
      mode,
      mounted,
    }),
    getTooltipStyle: ({ colors }: any) => ({
      contentStyle: {
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
      },
      labelStyle: { color: mode === 'light' ? '#09090b' : '#fafafa' },
    }),
    getGridStyle: ({ colors }: any) => ({
      stroke: colors.border,
      strokeDasharray: '3 3',
    }),
    getAxisStyle: ({ colors }: any) => ({
      stroke: colors.border,
      tick: { fill: mode === 'light' ? '#52525b' : '#a1a1aa' },
    }),
    compactNumberFormatter: (value: number) => {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
      return value.toString()
    },
  })
  return createThemeMock('light')
})

vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/types/performance-metrics', async () => {
  const actual = await vi.importActual('@/types/performance-metrics')
  return {
    ...actual,
    formatPercentage: (value: number, decimals: number = 1) => `${value.toFixed(decimals)}%`,
  }
})

// Test wrapper components
function LightThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
      {children}
    </ThemeProvider>
  )
}

function DarkThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      {children}
    </ThemeProvider>
  )
}

// Helper to create realistic mock data
function createTestData(): TaskCompletionRateData {
  const baseTime = new Date('2024-01-01T12:00:00Z')

  return {
    data: Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(baseTime.getTime() + i * 60 * 60 * 1000),
      completionRate: 75 + Math.sin(i / 4) * 10,
      successRate: 85 + Math.cos(i / 6) * 8,
      completedCount: Math.floor(50 + Math.random() * 20),
      failedCount: Math.floor(5 + Math.random() * 10),
      totalProcessed: Math.floor(60 + Math.random() * 25),
      avgDurationMs: 2000 + Math.random() * 1000,
    })),
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
      inProgress: 25,
      pending: 75,
      paused: 10,
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

describe('TaskCompletionRateChart Integration Tests', () => {
  const testData = createTestData()

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset chart utils mock to light theme
    vi.mocked(require('@/lib/chart-utils')).mockReturnValue(createThemeMock('light'))
  })

  describe('Theme Integration', () => {
    it('renders correctly with light theme', async () => {
      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} />
        </LightThemeWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toBeInTheDocument()

      // Verify chart components are present
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('renders correctly with dark theme', async () => {
      // Mock dark theme
      vi.mocked(require('@/lib/chart-utils')).mockReturnValue(createThemeMock('dark'))

      render(
        <DarkThemeWrapper>
          <TaskCompletionRateChart data={testData} />
        </DarkThemeWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toBeInTheDocument()

      // Verify chart components are present with dark theme
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('handles theme transitions gracefully', async () => {
      const { rerender } = render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} />
        </LightThemeWrapper>
      )

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()

      // Switch to dark theme
      vi.mocked(require('@/lib/chart-utils')).mockReturnValue(createThemeMock('dark'))

      rerender(
        <DarkThemeWrapper>
          <TaskCompletionRateChart data={testData} />
        </DarkThemeWrapper>
      )

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('adapts to different screen sizes', () => {
      const { rerender } = render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} height={200} />
        </LightThemeWrapper>
      )

      let chart = screen.getByRole('img')
      expect(chart).toHaveStyle({ height: '200px' })

      // Test with mobile-size height
      rerender(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} height={150} />
        </LightThemeWrapper>
      )

      chart = screen.getByRole('img')
      expect(chart).toHaveStyle({ height: '150px' })
    })

    it('maintains aspect ratio in responsive container', () => {
      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} />
        </LightThemeWrapper>
      )

      const responsiveContainer = screen.getByTestId('responsive-container')
      expect(responsiveContainer).toHaveAttribute('data-width', '100%')
      expect(responsiveContainer).toHaveAttribute('data-height', '100%')
    })

    it('adjusts legend layout for different viewport sizes', () => {
      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} showLegend={true} />
        </LightThemeWrapper>
      )

      // Check that legend is present and properly structured
      const legendContainer = screen.getByRole('img').querySelector('.flex.items-center.justify-center.flex-wrap.gap-4')
      expect(legendContainer).toBeInTheDocument()
    })
  })

  describe('Animation Integration', () => {
    it('enables animation by default', () => {
      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} />
        </LightThemeWrapper>
      )

      const pieElement = screen.getByTestId('pie-value')
      expect(pieElement).toHaveAttribute('data-animation-duration', '1000')
    })

    it('disables animation when animated=false', () => {
      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} animated={false} />
        </LightThemeWrapper>
      )

      const pieElement = screen.getByTestId('pie-value')
      expect(pieElement).toHaveAttribute('data-animation-duration', '0')
    })

    it('handles animation for mini chart variant', () => {
      render(
        <LightThemeWrapper>
          <TaskCompletionRateChartMini data={testData} />
        </LightThemeWrapper>
      )

      const pieElement = screen.getByTestId('pie-value')
      expect(pieElement).toHaveAttribute('data-animation-duration', '500')
    })
  })

  describe('Data Flow Integration', () => {
    it('processes real-time data updates', async () => {
      const initialData = createTestData()

      const { rerender } = render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={initialData} />
        </LightThemeWrapper>
      )

      expect(screen.getByText('84.2%')).toBeInTheDocument()

      // Update data
      const updatedData = {
        ...initialData,
        overallSuccessRate: 90.5,
        totalCompleted: 1350,
        statusCounts: {
          ...initialData.statusCounts,
          completed: 1350,
        },
      }

      rerender(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={updatedData} />
        </LightThemeWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('90.5%')).toBeInTheDocument()
      })
    })

    it('handles data with time series for bar chart', () => {
      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart
            data={testData}
            variant="bar"
            showStatusDistribution={true}
          />
        </LightThemeWrapper>
      )

      // Should render bar chart when time series data is available
      const barChart = screen.getByTestId('bar-chart')
      expect(barChart).toHaveAttribute('data-length', '24') // 24 hours of data
    })

    it('gracefully handles partial data updates', () => {
      const partialData = {
        ...testData,
        data: testData.data.slice(0, 5), // Only first 5 hours
      }

      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={partialData} variant="bar" showStatusDistribution={true} />
        </LightThemeWrapper>
      )

      const barChart = screen.getByTestId('bar-chart')
      expect(barChart).toHaveAttribute('data-length', '5')
    })
  })

  describe('Interaction Integration', () => {
    it('handles click interactions correctly', async () => {
      const onClickMock = vi.fn()

      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} onDataPointClick={onClickMock} />
        </LightThemeWrapper>
      )

      const pieElement = screen.getByTestId('pie-value')
      fireEvent.click(pieElement)

      await waitFor(() => {
        expect(onClickMock).toHaveBeenCalledTimes(1)
      })
    })

    it('maintains interactive state across rerenders', async () => {
      const onClickMock = vi.fn()

      const { rerender } = render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} onDataPointClick={onClickMock} />
        </LightThemeWrapper>
      )

      fireEvent.click(screen.getByTestId('pie-value'))
      expect(onClickMock).toHaveBeenCalledTimes(1)

      // Rerender with updated props
      rerender(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} onDataPointClick={onClickMock} height={300} />
        </LightThemeWrapper>
      )

      fireEvent.click(screen.getByTestId('pie-value'))
      expect(onClickMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('Performance Integration', () => {
    it('handles large datasets efficiently', () => {
      const largeData = {
        ...testData,
        data: Array.from({ length: 168 }, (_, i) => ({ // 1 week of hourly data
          timestamp: new Date(Date.now() - (168 - i) * 60 * 60 * 1000),
          completionRate: 75 + Math.sin(i / 24) * 10,
          successRate: 85 + Math.cos(i / 12) * 5,
          completedCount: Math.floor(100 + Math.random() * 50),
          failedCount: Math.floor(10 + Math.random() * 20),
          totalProcessed: Math.floor(120 + Math.random() * 60),
          avgDurationMs: 2000 + Math.random() * 1000,
        })),
        totalCompleted: 15000,
        totalFailed: 2500,
        totalProcessed: 17500,
        statusCounts: {
          completed: 15000,
          failed: 2500,
          cancelled: 500,
          inProgress: 100,
          pending: 300,
          paused: 50,
        },
      }

      const startTime = performance.now()

      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={largeData} variant="bar" showStatusDistribution={true} />
        </LightThemeWrapper>
      )

      const endTime = performance.now()

      // Should render efficiently even with large datasets
      expect(endTime - startTime).toBeLessThan(100) // Should render in under 100ms
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
      expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-length', '168')
    })

    it('efficiently updates when only some props change', () => {
      const { rerender } = render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} height={200} />
        </LightThemeWrapper>
      )

      const startTime = performance.now()

      // Update only height prop
      rerender(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} height={250} />
        </LightThemeWrapper>
      )

      const endTime = performance.now()

      // Re-render should be fast since only height changed
      expect(endTime - startTime).toBeLessThan(50)
      expect(screen.getByRole('img')).toHaveStyle({ height: '250px' })
    })
  })

  describe('Error Boundary Integration', () => {
    it('handles chart rendering errors gracefully', () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Create data that might cause rendering issues
      const problematicData = {
        ...testData,
        statusCounts: {
          completed: NaN,
          failed: -1,
          cancelled: Infinity,
          inProgress: 0,
          pending: 0,
          paused: 0,
        },
        overallSuccessRate: NaN,
        totalCompleted: NaN,
      }

      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={problematicData} />
        </LightThemeWrapper>
      )

      // Should either render empty state or handle gracefully
      expect(
        screen.getByText('No task completion data available') || screen.getByTestId('pie-chart')
      ).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })

  describe('Accessibility Integration', () => {
    it('maintains accessibility features across theme changes', () => {
      const { rerender } = render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} />
        </LightThemeWrapper>
      )

      let chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')

      // Switch themes
      vi.mocked(require('@/lib/chart-utils')).mockReturnValue(createThemeMock('dark'))

      rerender(
        <DarkThemeWrapper>
          <TaskCompletionRateChart data={testData} />
        </DarkThemeWrapper>
      )

      chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')
      expect(screen.getByText(/Task completion summary/, { selector: '.sr-only' })).toBeInTheDocument()
    })

    it('maintains keyboard navigation support', async () => {
      render(
        <LightThemeWrapper>
          <TaskCompletionRateChart data={testData} onDataPointClick={vi.fn()} />
        </LightThemeWrapper>
      )

      const chart = screen.getByRole('img')

      // Chart should be focusable for keyboard users
      chart.focus()
      expect(document.activeElement).toBe(chart)
    })
  })
})

describe('TaskCompletionRateChartMini Integration Tests', () => {
  const testData = createTestData()

  describe('Compact Layout Integration', () => {
    it('maintains readability in minimal space', () => {
      render(
        <LightThemeWrapper>
          <TaskCompletionRateChartMini data={testData} height={60} />
        </LightThemeWrapper>
      )

      // Should display essential information even at small sizes
      expect(screen.getByText('84%')).toBeInTheDocument() // Success rate
      expect(screen.getByText('1,200 / 1,380 tasks')).toBeInTheDocument() // Task counts
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('adapts to container constraints', () => {
      const { rerender } = render(
        <LightThemeWrapper>
          <div style={{ width: '200px' }}>
            <TaskCompletionRateChartMini data={testData} height={80} />
          </div>
        </LightThemeWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()

      // Test with even smaller container
      rerender(
        <LightThemeWrapper>
          <div style={{ width: '150px' }}>
            <TaskCompletionRateChartMini data={testData} height={60} />
          </div>
        </LightThemeWrapper>
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })
  })

  describe('Dashboard Integration', () => {
    it('works well as part of a dashboard layout', () => {
      render(
        <LightThemeWrapper>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <TaskCompletionRateChartMini data={testData} />
            <TaskCompletionRateChartMini data={testData} />
            <TaskCompletionRateChartMini data={testData} />
          </div>
        </LightThemeWrapper>
      )

      const charts = screen.getAllByTestId('pie-chart')
      expect(charts).toHaveLength(3)

      const successRates = screen.getAllByText('84%')
      expect(successRates).toHaveLength(3)
    })
  })
})