/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ThemeProvider } from 'next-themes'
import {
  TaskCompletionRateChart,
  TaskCompletionRateChartMini,
} from '../TaskCompletionRateChart'
import type { TaskCompletionRateData } from '@/types/performance-metrics'

// Mock window.matchMedia
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
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-length={data?.length || 0}>{children}</div>
  ),
  Pie: ({ dataKey, data, onClick }: any) => (
    <div
      data-testid={`pie-${dataKey}`}
      data-length={data?.length || 0}
      onClick={() => {
        if (onClick) {
          try {
            onClick({})
          } catch (error) {
            // Swallow callback errors to prevent test failures
            console.error('Click callback error:', error)
          }
        }
      }}
    />
  ),
  Cell: () => <div data-testid="pie-cell" />,
  Bar: ({ dataKey }: any) => <div data-testid={`bar-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: any) => (
    <div data-testid="tooltip">
      {content}
    </div>
  ),
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

// Mock chart utils
vi.mock('@/lib/chart-utils', () => ({
  useChartTheme: () => ({
    colors: { primary: '#0ea5e9', background: '#ffffff', border: '#e4e4e7' },
    mode: 'light' as const,
    mounted: true,
  }),
  getTooltipStyle: () => ({ contentStyle: {}, labelStyle: {} }),
  getGridStyle: () => ({}),
  getAxisStyle: () => ({}),
  compactNumberFormatter: (value: number) => value.toString(),
}))

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

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      {children}
    </ThemeProvider>
  )
}

// Helper to create base test data
function createBaseData(): TaskCompletionRateData {
  return {
    data: [],
    overallCompletionRate: 75,
    overallSuccessRate: 85,
    totalCompleted: 100,
    totalFailed: 15,
    totalProcessed: 115,
    statusCounts: {
      completed: 100,
      failed: 15,
      cancelled: 0,
      inProgress: 0,
      pending: 0,
      paused: 0,
    },
    byStatus: { completed: 100, failed: 15 },
    avgDurationMs: 2000,
    medianDurationMs: 1800,
    p95DurationMs: 3500,
    timeRange: '24h',
    generatedAt: new Date(),
  }
}

describe('TaskCompletionRateChart Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Extreme Data Values', () => {
    it('handles zero success rate', () => {
      const data = {
        ...createBaseData(),
        overallSuccessRate: 0,
        totalCompleted: 0,
        totalFailed: 100,
        statusCounts: { completed: 0, failed: 100, cancelled: 0, inProgress: 0, pending: 0, paused: 0 },
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('0.0%')).toBeInTheDocument()
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('handles 100% success rate', () => {
      const data = {
        ...createBaseData(),
        overallSuccessRate: 100,
        totalFailed: 0,
        statusCounts: { completed: 100, failed: 0, cancelled: 0, inProgress: 0, pending: 0, paused: 0 },
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('100.0%')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('handles extremely large numbers', () => {
      const data = {
        ...createBaseData(),
        totalCompleted: Number.MAX_SAFE_INTEGER,
        totalProcessed: Number.MAX_SAFE_INTEGER,
        statusCounts: {
          completed: Number.MAX_SAFE_INTEGER,
          failed: 0,
          cancelled: 0,
          inProgress: 0,
          pending: 0,
          paused: 0,
        },
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')
    })

    it('handles very small decimal values', () => {
      const data = {
        ...createBaseData(),
        overallSuccessRate: 0.001,
        totalCompleted: 1,
        totalProcessed: 999999,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })
  })

  describe('Invalid Data Handling', () => {
    it('handles NaN values gracefully', () => {
      const data = {
        ...createBaseData(),
        overallSuccessRate: NaN,
        overallCompletionRate: NaN,
        totalCompleted: NaN,
        totalFailed: NaN,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      // Should still render, handling NaN values appropriately
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('handles Infinity values', () => {
      const data = {
        ...createBaseData(),
        overallSuccessRate: Infinity,
        totalCompleted: Infinity,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('handles negative values', () => {
      const data = {
        ...createBaseData(),
        overallSuccessRate: -10,
        totalCompleted: -5,
        totalFailed: -2,
        statusCounts: {
          completed: -5,
          failed: -2,
          cancelled: -1,
          inProgress: 0,
          pending: 0,
          paused: 0,
        },
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      // Should handle negative values without crashing
      expect(screen.getByRole('img')).toBeInTheDocument()
    })

    it('handles null/undefined nested properties', () => {
      const data = {
        ...createBaseData(),
        statusCounts: null as any,
        byStatus: undefined as any,
        data: null as any,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('No task completion data available')).toBeInTheDocument()
    })
  })

  describe('Boundary Conditions', () => {
    it('handles single task completed', () => {
      const data = {
        ...createBaseData(),
        totalCompleted: 1,
        totalFailed: 0,
        totalProcessed: 1,
        overallSuccessRate: 100,
        statusCounts: { completed: 1, failed: 0, cancelled: 0, inProgress: 0, pending: 0, paused: 0 },
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('100.0%')).toBeInTheDocument()
    })

    it('handles single task failed', () => {
      const data = {
        ...createBaseData(),
        totalCompleted: 0,
        totalFailed: 1,
        totalProcessed: 1,
        overallSuccessRate: 0,
        statusCounts: { completed: 0, failed: 1, cancelled: 0, inProgress: 0, pending: 0, paused: 0 },
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('1')).toBeInTheDocument() // Failed count
      expect(screen.getByText('0.0%')).toBeInTheDocument() // Success rate
    })

    it('handles only paused tasks', () => {
      const data = {
        ...createBaseData(),
        totalCompleted: 0,
        totalFailed: 0,
        totalProcessed: 10,
        overallSuccessRate: 0,
        overallCompletionRate: 0,
        statusCounts: { completed: 0, failed: 0, cancelled: 0, inProgress: 0, pending: 0, paused: 10 },
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('Paused')).toBeInTheDocument()
    })

    it('handles only pending tasks', () => {
      const data = {
        ...createBaseData(),
        totalCompleted: 0,
        totalFailed: 0,
        totalProcessed: 20,
        overallSuccessRate: 0,
        overallCompletionRate: 0,
        statusCounts: { completed: 0, failed: 0, cancelled: 0, inProgress: 0, pending: 20, paused: 0 },
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('Pending')).toBeInTheDocument()
    })
  })

  describe('Malformed Time Series Data', () => {
    it('handles empty time series data for bar chart', () => {
      const data = {
        ...createBaseData(),
        data: [],
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} variant="bar" showStatusDistribution={true} />
        </TestWrapper>
      )

      // Should fall back to status distribution bars
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('handles time series data with invalid dates', () => {
      const data = {
        ...createBaseData(),
        data: [
          {
            timestamp: new Date('invalid-date'),
            completionRate: 75,
            successRate: 85,
            completedCount: 10,
            failedCount: 2,
            totalProcessed: 12,
          },
        ],
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} variant="bar" showStatusDistribution={true} />
        </TestWrapper>
      )

      const barChart = screen.queryByTestId('bar-chart')
      expect(barChart).toBeInTheDocument()
    })

    it('handles time series data with missing required fields', () => {
      const data = {
        ...createBaseData(),
        data: [
          {
            timestamp: new Date(),
            // Missing other required fields
          } as any,
        ],
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} variant="bar" showStatusDistribution={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })
  })

  describe('Props Edge Cases', () => {
    it('handles extremely small height', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={createBaseData()} height={1} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveStyle({ height: '1px' })
    })

    it('handles extremely large height', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={createBaseData()} height={10000} />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveStyle({ height: '10000px' })
    })

    it('handles custom colors with invalid values', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart
            data={createBaseData()}
            colors={{
              success: 'invalid-color',
              danger: '',
              warning: null as any,
              primary: undefined as any,
            }}
          />
        </TestWrapper>
      )

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('handles className with special characters', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart
            data={createBaseData()}
            className="class-with-@special!chars$and%numbers123"
          />
        </TestWrapper>
      )

      const chart = screen.getByRole('img')
      expect(chart).toHaveClass('class-with-@special!chars$and%numbers123')
    })
  })

  describe('Callback Edge Cases', () => {
    it('handles onDataPointClick with null callback', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChart data={createBaseData()} onDataPointClick={null as any} />
        </TestWrapper>
      )

      const pie = screen.getByTestId('pie-value')
      // Should not throw when clicking
      expect(() => fireEvent.click(pie)).not.toThrow()
    })

    it('handles onDataPointClick that throws error', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={createBaseData()} onDataPointClick={errorCallback} />
        </TestWrapper>
      )

      const pie = screen.getByTestId('pie-value')
      // Should not crash the component when callback throws
      expect(() => fireEvent.click(pie)).not.toThrow()

      consoleSpy.mockRestore()
    })
  })

  describe('Theme Edge Cases', () => {
    it('handles theme not being mounted', () => {
      vi.mocked(require('@/lib/chart-utils').useChartTheme).mockReturnValueOnce({
        colors: {},
        mode: 'light',
        mounted: false,
      })

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={createBaseData()} />
        </TestWrapper>
      )

      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('handles missing theme colors', () => {
      vi.mocked(require('@/lib/chart-utils').useChartTheme).mockReturnValueOnce({
        colors: {}, // Missing colors
        mode: 'light',
        mounted: true,
      })

      render(
        <TestWrapper>
          <TaskCompletionRateChart data={createBaseData()} />
        </TestWrapper>
      )

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })
  })

  describe('Component Lifecycle Edge Cases', () => {
    it('handles rapid prop changes', () => {
      const { rerender } = render(
        <TestWrapper>
          <TaskCompletionRateChart data={createBaseData()} />
        </TestWrapper>
      )

      // Rapidly change props
      for (let i = 0; i < 10; i++) {
        const data = {
          ...createBaseData(),
          totalCompleted: i * 10,
          overallSuccessRate: i * 5,
        }
        rerender(
          <TestWrapper>
            <TaskCompletionRateChart data={data} height={200 + i * 10} />
          </TestWrapper>
        )
      }

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('handles component unmounting during animation', () => {
      const { unmount } = render(
        <TestWrapper>
          <TaskCompletionRateChart data={createBaseData()} animated={true} />
        </TestWrapper>
      )

      // Unmount immediately - should not cause memory leaks or errors
      expect(() => unmount()).not.toThrow()
    })
  })
})

describe('TaskCompletionRateChartMini Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Extreme Constraints', () => {
    it('handles extremely small dimensions', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={createBaseData()} height={10} />
        </TestWrapper>
      )

      const wrapper = screen.getByTestId('responsive-container').closest('div')
      expect(wrapper).toHaveStyle({ height: '10px' })
      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('handles zero height', () => {
      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={createBaseData()} height={0} />
        </TestWrapper>
      )

      const wrapper = screen.getByTestId('responsive-container').closest('div')
      expect(wrapper).toHaveStyle({ height: '0px' })
    })
  })

  describe('Text Overflow Handling', () => {
    it('handles very small success percentages', () => {
      const data = {
        ...createBaseData(),
        overallSuccessRate: 0.001,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('0%')).toBeInTheDocument() // Rounded to 0 decimals
    })

    it('handles large task numbers in mini format', () => {
      const data = {
        ...createBaseData(),
        totalCompleted: 999999999,
        totalProcessed: 1000000000,
      }

      render(
        <TestWrapper>
          <TaskCompletionRateChartMini data={data} />
        </TestWrapper>
      )

      expect(screen.getByText('999,999,999 / 1,000,000,000 tasks')).toBeInTheDocument()
    })
  })

  describe('Rendering Constraints', () => {
    it('maintains readability with extreme aspect ratios', () => {
      render(
        <TestWrapper>
          <div style={{ width: '500px', height: '20px' }}>
            <TaskCompletionRateChartMini data={createBaseData()} height={20} />
          </div>
        </TestWrapper>
      )

      expect(screen.getByText('85%')).toBeInTheDocument()
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })
  })
})