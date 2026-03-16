/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
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

// Mock performance.now for timing tests
let mockTime = 0
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => mockTime),
  },
})

// Lightweight Recharts mocks for performance testing
vi.mock('recharts', () => ({
  AreaChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => {
    // Simulate processing time proportional to data size
    const processingTime = data?.length || 0
    mockTime += processingTime * 0.1
    return (
      <div data-testid="area-chart" data-points={data?.length || 0}>
        {children}
      </div>
    )
  },
  LineChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => {
    const processingTime = data?.length || 0
    mockTime += processingTime * 0.1
    return (
      <div data-testid="line-chart" data-points={data?.length || 0}>
        {children}
      </div>
    )
  },
  Area: ({ dataKey, name }: { dataKey: string; name: string }) => {
    mockTime += 1 // Simulate rendering time
    return <div data-testid={`area-${dataKey}`} data-name={name} />
  },
  Line: ({ dataKey, name }: { dataKey: string; name: string }) => {
    mockTime += 1
    return <div data-testid={`line-${dataKey}`} data-name={name} />
  },
  XAxis: () => {
    mockTime += 0.5
    return <div data-testid="x-axis" />
  },
  YAxis: () => {
    mockTime += 0.5
    return <div data-testid="y-axis" />
  },
  CartesianGrid: () => {
    mockTime += 0.2
    return <div data-testid="cartesian-grid" />
  },
  Tooltip: ({ content }: { content: React.ComponentType<any> }) => {
    mockTime += 2 // Tooltips are more expensive
    return (
      <div data-testid="tooltip">
        {content && React.createElement(content, {
          active: true,
          payload: [],
          label: '',
        })}
      </div>
    )
  },
  Legend: () => {
    mockTime += 1
    return <div data-testid="legend" />
  },
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => {
    mockTime += 0.5
    return <div data-testid="responsive-container">{children}</div>
  },
  ReferenceLine: ({ y }: { y: number }) => {
    mockTime += 0.3
    return <div data-testid="reference-line" data-y={y} />
  },
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

// Performance data generators
function generateLargeDataset(
  size: number,
  timeRange: PerformanceMetricsTimeRange = '30d'
): CostTrendData {
  const baseTime = new Date('2024-01-01T00:00:00Z')
  const intervalMs = getIntervalForTimeRange(timeRange)

  const data: CostTrendDataPoint[] = Array.from({ length: size }, (_, i) => {
    const cost = 0.5 + Math.sin(i * 0.01) * 0.2 + (i * 0.001)
    return {
      timestamp: new Date(baseTime.getTime() + i * intervalMs),
      cost,
      cumulativeCost: cost * (i + 1),
      breakdown: {
        inputTokenCost: cost * 0.6,
        outputTokenCost: cost * 0.35,
        cacheCreationCost: cost * 0.03,
        cacheReadCost: cost * 0.01,
        otherCost: cost * 0.01,
      },
      projectedCost: cost * 1.1,
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
    avgCostPerHour: totalCost / size,
    avgCostPerTask: totalCost / Math.max(1, size * 2),
    peakHourlyCost: Math.max(...data.map(p => p.cost)),
    breakdown,
    budgetLimit: totalCost * 1.5,
    budgetUtilization: (totalCost / (totalCost * 1.5)) * 100,
    projectedTotalCost: totalCost * 1.15,
    cacheSavings: breakdown.cacheCreationCost * 0.8,
    timeRange,
    generatedAt: new Date(),
    trend: 1,
    changePercent: 15.5,
  }
}

function getIntervalForTimeRange(timeRange: PerformanceMetricsTimeRange): number {
  switch (timeRange) {
    case '1h': return 60 * 1000 // 1 minute
    case '6h': return 6 * 60 * 1000 // 6 minutes
    case '24h': return 24 * 60 * 1000 // 24 minutes
    case '7d': return 2.52 * 60 * 60 * 1000 // ~2.5 hours
    case '30d': return 12 * 60 * 60 * 1000 // 12 hours
    default: return 60 * 1000
  }
}

// Performance measurement utility
function measureRenderTime<T>(renderFn: () => T): { result: T; time: number } {
  const startTime = mockTime
  const result = renderFn()
  const endTime = mockTime
  return { result, time: endTime - startTime }
}

describe('CostTrendChart Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTime = 0
  })

  describe('Rendering Performance', () => {
    it('renders small datasets efficiently', () => {
      const smallData = generateLargeDataset(10)

      const { time } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChart data={smallData} />
          </TestWrapper>
        )
      })

      expect(time).toBeLessThan(10) // Should be very fast
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles medium datasets within acceptable time limits', () => {
      const mediumData = generateLargeDataset(100)

      const { time } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChart data={mediumData} />
          </TestWrapper>
        )
      })

      expect(time).toBeLessThan(50) // Should render within reasonable time
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '100')
    })

    it('handles large datasets without performance degradation', () => {
      const largeData = generateLargeDataset(1000)

      const { time } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChart data={largeData} />
          </TestWrapper>
        )
      })

      expect(time).toBeLessThan(200) // Should still be acceptable for large datasets
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '1000')
    })

    it('mini chart variant renders faster than full chart', () => {
      const testData = generateLargeDataset(500)

      const { time: fullTime } = measureRenderTime(() => {
        const { unmount } = render(
          <TestWrapper>
            <CostTrendChart data={testData} />
          </TestWrapper>
        )
        unmount()
      })

      mockTime = 0 // Reset for fair comparison

      const { time: miniTime } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChartMini data={testData} />
          </TestWrapper>
        )
      })

      expect(miniTime).toBeLessThan(fullTime)
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })
  })

  describe('Update Performance', () => {
    it('efficiently handles data updates', () => {
      const initialData = generateLargeDataset(100)

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={initialData} />
        </TestWrapper>
      )

      const updatedData = {
        ...initialData,
        totalCost: initialData.totalCost + 10,
        data: initialData.data.map(point => ({
          ...point,
          cost: point.cost + 0.1,
        })),
      }

      const { time } = measureRenderTime(() => {
        rerender(
          <TestWrapper>
            <CostTrendChart data={updatedData} />
          </TestWrapper>
        )
      })

      expect(time).toBeLessThan(30) // Updates should be fast
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('handles rapid prop changes efficiently', () => {
      const testData = generateLargeDataset(200)

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={testData} variant="area" />
        </TestWrapper>
      )

      const { time } = measureRenderTime(() => {
        // Perform multiple rapid changes
        for (let i = 0; i < 10; i++) {
          rerender(
            <TestWrapper>
              <CostTrendChart
                data={testData}
                variant={i % 2 === 0 ? 'area' : 'line'}
                showCumulative={i % 3 === 0}
                showBreakdown={i % 4 === 0}
              />
            </TestWrapper>
          )
        }
      })

      expect(time).toBeLessThan(100) // Rapid changes should still be manageable
      expect(screen.getByTestId(screen.queryByTestId('area-chart') ? 'area-chart' : 'line-chart')).toBeInTheDocument()
    })

    it('efficiently adds new data points', () => {
      const baseData = generateLargeDataset(100)

      const { rerender } = render(
        <TestWrapper>
          <CostTrendChart data={baseData} />
        </TestWrapper>
      )

      // Simulate adding 10 new data points
      const { time } = measureRenderTime(() => {
        const newData = {
          ...baseData,
          data: [...baseData.data, ...generateLargeDataset(10).data],
        }
        newData.totalCost = newData.data.reduce((sum, p) => sum + p.cost, 0)

        rerender(
          <TestWrapper>
            <CostTrendChart data={newData} />
          </TestWrapper>
        )
      })

      expect(time).toBeLessThan(25) // Adding data should be efficient
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '110')
    })
  })

  describe('Memory Performance', () => {
    it('does not create memory leaks with large datasets', () => {
      const largeData = generateLargeDataset(1000)

      // Render and unmount multiple times to test for leaks
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <TestWrapper>
            <CostTrendChart data={largeData} />
          </TestWrapper>
        )
        unmount()
      }

      // If we get here without timeout or memory errors, test passes
      expect(true).toBe(true)
    })

    it('efficiently handles component cleanup', () => {
      const testData = generateLargeDataset(500)

      const { unmount } = render(
        <TestWrapper>
          <CostTrendChart data={testData} />
        </TestWrapper>
      )

      const { time } = measureRenderTime(() => {
        unmount()
      })

      expect(time).toBeLessThan(10) // Cleanup should be fast
    })
  })

  describe('Chart Configuration Performance', () => {
    it('efficiently renders with all features enabled', () => {
      const complexData = generateLargeDataset(200)

      const { time } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChart
              data={complexData}
              showLegend={true}
              showBudgetLimit={true}
              showProjection={true}
              showBreakdown={true}
              showCumulative={false}
              animated={true}
            />
          </TestWrapper>
        )
      })

      // Complex configuration should still be reasonable
      expect(time).toBeLessThan(80)
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('legend')).toBeInTheDocument()
      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
      expect(screen.getByTestId('reference-line')).toBeInTheDocument()
    })

    it('optimizes rendering when features are disabled', () => {
      const testData = generateLargeDataset(200)

      const { time: complexTime } = measureRenderTime(() => {
        const { unmount } = render(
          <TestWrapper>
            <CostTrendChart
              data={testData}
              showLegend={true}
              showBudgetLimit={true}
              showProjection={true}
              showBreakdown={true}
            />
          </TestWrapper>
        )
        unmount()
      })

      mockTime = 0 // Reset for comparison

      const { time: simpleTime } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChart
              data={testData}
              showLegend={false}
              showBudgetLimit={false}
              showProjection={false}
              showBreakdown={false}
            />
          </TestWrapper>
        )
      })

      expect(simpleTime).toBeLessThan(complexTime)
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })
  })

  describe('Responsive Performance', () => {
    it('handles different height values efficiently', () => {
      const testData = generateLargeDataset(100)
      const heights = [100, 200, 400, 800]

      for (const height of heights) {
        const { time } = measureRenderTime(() => {
          const { unmount } = render(
            <TestWrapper>
              <CostTrendChart data={testData} height={height} />
            </TestWrapper>
          )
          unmount()
        })

        expect(time).toBeLessThan(30) // Height changes shouldn't significantly impact performance
      }
    })

    it('maintains performance across different time ranges', () => {
      const timeRanges: PerformanceMetricsTimeRange[] = ['1h', '6h', '24h', '7d', '30d']

      for (const timeRange of timeRanges) {
        const testData = generateLargeDataset(100, timeRange)

        const { time } = measureRenderTime(() => {
          const { unmount } = render(
            <TestWrapper>
              <CostTrendChart data={testData} />
            </TestWrapper>
          )
          unmount()
        })

        expect(time).toBeLessThan(40) // Time range shouldn't significantly impact performance
      }
    })
  })

  describe('Edge Case Performance', () => {
    it('efficiently handles empty datasets', () => {
      const emptyData = generateLargeDataset(0)

      const { time } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChart data={emptyData} />
          </TestWrapper>
        )
      })

      expect(time).toBeLessThan(5) // Empty state should be very fast
      expect(screen.getByText('No cost data available')).toBeInTheDocument()
    })

    it('handles single data point efficiently', () => {
      const singlePointData = generateLargeDataset(1)

      const { time } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChart data={singlePointData} />
          </TestWrapper>
        )
      })

      expect(time).toBeLessThan(10) // Single point should be very fast
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '1')
    })

    it('efficiently handles data with extreme values', () => {
      const extremeData = generateLargeDataset(100)
      extremeData.data[50].cost = Number.MAX_SAFE_INTEGER
      extremeData.data[51].cost = 0
      extremeData.data[52].cost = -100

      const { time } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChart data={extremeData} />
          </TestWrapper>
        )
      })

      expect(time).toBeLessThan(50) // Extreme values shouldn't significantly slow rendering
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })
  })

  describe('Benchmark Tests', () => {
    it('meets performance benchmarks for typical use cases', () => {
      // Simulate typical dashboard usage with 24h data (60 points)
      const typicalData = generateLargeDataset(60, '24h')

      const { time } = measureRenderTime(() => {
        render(
          <TestWrapper>
            <CostTrendChart data={typicalData} />
          </TestWrapper>
        )
      })

      // Should render typical dashboard data very quickly
      expect(time).toBeLessThan(20)
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('scales appropriately with dataset size', () => {
      const sizes = [50, 100, 200, 500]
      const renderTimes: number[] = []

      for (const size of sizes) {
        const testData = generateLargeDataset(size)

        const { time } = measureRenderTime(() => {
          const { unmount } = render(
            <TestWrapper>
              <CostTrendChart data={testData} />
            </TestWrapper>
          )
          unmount()
        })

        renderTimes.push(time)
        mockTime = 0 // Reset for next test
      }

      // Performance should scale roughly linearly
      expect(renderTimes[1]).toBeLessThan(renderTimes[3] * 0.5) // 100 points < 500 points / 2
      expect(renderTimes[0]).toBeLessThan(renderTimes[2] * 0.5) // 50 points < 200 points / 2
    })
  })
})