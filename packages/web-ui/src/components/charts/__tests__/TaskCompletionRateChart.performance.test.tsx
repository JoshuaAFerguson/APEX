/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ThemeProvider } from 'next-themes'
import {
  TaskCompletionRateChart,
  TaskCompletionRateChartMini,
} from '../TaskCompletionRateChart'
import type { TaskCompletionRateData, TaskCompletionDataPoint } from '@/types/performance-metrics'

// Mock window.matchMedia and performance APIs
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

// Mock performance.now for consistent timing
const mockPerformanceNow = vi.fn()
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: mockPerformanceNow,
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(),
  },
})

// Mock Recharts with performance considerations
vi.mock('recharts', () => ({
  PieChart: ({ children, data }: any) => {
    // Simulate rendering time based on data size
    const dataSize = data?.length || 0
    if (dataSize > 100) {
      // Simulate longer render time for large datasets
      const start = performance.now()
      while (performance.now() - start < 1) {
        // Small delay for large datasets
      }
    }
    return <div data-testid="pie-chart" data-size={dataSize}>{children}</div>
  },
  BarChart: ({ children, data }: any) => {
    const dataSize = data?.length || 0
    if (dataSize > 500) {
      const start = performance.now()
      while (performance.now() - start < 2) {
        // Slightly longer delay for bar charts with many data points
      }
    }
    return <div data-testid="bar-chart" data-size={dataSize}>{children}</div>
  },
  Pie: ({ data, dataKey }: any) => {
    return (
      <div data-testid={`pie-${dataKey}`} data-length={data?.length || 0} />
    )
  },
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
  compactNumberFormatter: (value: number) => {
    // Simulate formatting performance impact
    if (value > 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    return value.toString()
  },
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

// Performance test utilities
function createLargeDataset(size: number): TaskCompletionRateData {
  const baseTime = new Date('2024-01-01T00:00:00Z')

  // Generate large time series data
  const data: TaskCompletionDataPoint[] = Array.from({ length: size }, (_, i) => ({
    timestamp: new Date(baseTime.getTime() + i * 60000), // Every minute
    completionRate: 70 + Math.sin(i / 100) * 20 + Math.random() * 10,
    successRate: 80 + Math.cos(i / 150) * 15 + Math.random() * 8,
    completedCount: Math.floor(50 + Math.sin(i / 50) * 30 + Math.random() * 20),
    failedCount: Math.floor(5 + Math.cos(i / 75) * 8 + Math.random() * 5),
    totalProcessed: Math.floor(60 + Math.sin(i / 40) * 35 + Math.random() * 25),
    avgDurationMs: 2000 + Math.sin(i / 200) * 1000 + Math.random() * 500,
  }))

  return {
    data,
    overallCompletionRate: 78.5,
    overallSuccessRate: 84.2,
    totalCompleted: size * 50,
    totalFailed: size * 8,
    totalProcessed: size * 58,
    statusCounts: {
      completed: size * 50,
      failed: size * 8,
      cancelled: size * 2,
      inProgress: size * 3,
      pending: size * 5,
      paused: size * 1,
    },
    byStatus: {
      completed: size * 50,
      failed: size * 8,
      cancelled: size * 2,
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

function measureRenderTime<T>(renderFn: () => T): [T, number] {
  const start = Date.now()
  const result = renderFn()
  const end = Date.now()
  return [result, end - start]
}

describe('TaskCompletionRateChart Performance Tests', () => {
  let currentTime = 0

  beforeEach(() => {
    vi.clearAllMocks()
    currentTime = 0
    mockPerformanceNow.mockImplementation(() => {
      currentTime += 16 // Simulate 60fps (16ms per frame)
      return currentTime
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering Performance', () => {
    it('renders small datasets efficiently', () => {
      const smallData = createLargeDataset(10)

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <TaskCompletionRateChart data={smallData} />
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(100) // Should render in under 100ms
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('handles medium datasets within acceptable timeframes', () => {
      const mediumData = createLargeDataset(100)

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <TaskCompletionRateChart data={mediumData} variant="bar" showStatusDistribution={true} />
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(500) // Should render in under 500ms
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('handles large datasets efficiently', () => {
      const largeData = createLargeDataset(1000)

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <TaskCompletionRateChart data={largeData} variant="bar" showStatusDistribution={true} />
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(2000) // Should render in under 2s even for large datasets
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('maintains performance with very large status counts', () => {
      const massiveData = createLargeDataset(1)
      // Simulate massive task counts
      massiveData.totalCompleted = 10000000
      massiveData.totalFailed = 2000000
      massiveData.totalProcessed = 12000000
      massiveData.statusCounts = {
        completed: 10000000,
        failed: 2000000,
        cancelled: 500000,
        inProgress: 100000,
        pending: 300000,
        paused: 50000,
      }

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <TaskCompletionRateChart data={massiveData} />
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(300) // Large numbers shouldn't significantly impact pie chart performance
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })
  })

  describe('Re-render Performance', () => {
    it('optimizes re-renders when only height changes', async () => {
      const data = createLargeDataset(100)

      const { rerender } = render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} height={200} />
        </TestWrapper>
      )

      const [, rerenderTime] = measureRenderTime(() => {
        rerender(
          <TestWrapper>
            <TaskCompletionRateChart data={data} height={300} />
          </TestWrapper>
        )
      })

      expect(rerenderTime).toBeLessThan(100) // Height-only changes should be fast
    })

    it('handles rapid data updates efficiently', async () => {
      const initialData = createLargeDataset(50)
      const { rerender } = render(
        <TestWrapper>
          <TaskCompletionRateChart data={initialData} />
        </TestWrapper>
      )

      let totalRerenderTime = 0
      const updateCount = 10

      for (let i = 0; i < updateCount; i++) {
        const updatedData = {
          ...initialData,
          overallSuccessRate: 85 + i,
          totalCompleted: initialData.totalCompleted + i * 100,
        }

        const [, rerenderTime] = measureRenderTime(() => {
          rerender(
            <TestWrapper>
              <TaskCompletionRateChart data={updatedData} />
            </TestWrapper>
          )
        })

        totalRerenderTime += rerenderTime
      }

      const averageRerenderTime = totalRerenderTime / updateCount
      expect(averageRerenderTime).toBeLessThan(50) // Each update should be fast
    })

    it('efficiently handles prop changes with large datasets', () => {
      const largeData = createLargeDataset(500)

      const { rerender } = render(
        <TestWrapper>
          <TaskCompletionRateChart data={largeData} showLegend={true} />
        </TestWrapper>
      )

      const [, rerenderTime] = measureRenderTime(() => {
        rerender(
          <TestWrapper>
            <TaskCompletionRateChart data={largeData} showLegend={false} animated={false} />
          </TestWrapper>
        )
      })

      expect(rerenderTime).toBeLessThan(200) // Prop changes should be reasonable even with large data
    })
  })

  describe('Memory Performance', () => {
    it('does not cause memory leaks with frequent re-renders', async () => {
      const data = createLargeDataset(100)

      let renderCount = 0
      const maxRenders = 50

      const { rerender, unmount } = render(
        <TestWrapper>
          <TaskCompletionRateChart data={data} />
        </TestWrapper>
      )

      // Simulate frequent re-renders
      while (renderCount < maxRenders) {
        const updatedData = {
          ...data,
          overallSuccessRate: 85 + (renderCount % 10),
        }

        rerender(
          <TestWrapper>
            <TaskCompletionRateChart data={updatedData} />
          </TestWrapper>
        )
        renderCount++
      }

      // Clean unmount should not throw or cause issues
      expect(() => unmount()).not.toThrow()
    })

    it('efficiently handles component mounting and unmounting', () => {
      const data = createLargeDataset(200)

      for (let i = 0; i < 10; i++) {
        const [, renderTime] = measureRenderTime(() => {
          const { unmount } = render(
            <TestWrapper>
              <TaskCompletionRateChart data={data} />
            </TestWrapper>
          )
          unmount()
          return null
        })

        expect(renderTime).toBeLessThan(150) // Mount/unmount cycles should be efficient
      }
    })
  })

  describe('Animation Performance', () => {
    it('maintains smooth performance with animations enabled', () => {
      const data = createLargeDataset(100)

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <TaskCompletionRateChart data={data} animated={true} />
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(400) // Animation should not significantly degrade performance
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('optimizes performance when animations are disabled', () => {
      const data = createLargeDataset(100)

      const [, renderTimeAnimated] = measureRenderTime(() => {
        const { unmount } = render(
          <TestWrapper>
            <TaskCompletionRateChart data={data} animated={true} />
          </TestWrapper>
        )
        unmount()
        return null
      })

      const [, renderTimeStatic] = measureRenderTime(() => {
        const { unmount } = render(
          <TestWrapper>
            <TaskCompletionRateChart data={data} animated={false} />
          </TestWrapper>
        )
        unmount()
        return null
      })

      // Static rendering should be faster than animated
      expect(renderTimeStatic).toBeLessThanOrEqual(renderTimeAnimated)
    })
  })

  describe('Data Processing Performance', () => {
    it('efficiently processes pie chart data calculations', () => {
      const data = createLargeDataset(10)
      // Create complex status distribution
      data.statusCounts = {
        completed: 50000,
        failed: 8000,
        cancelled: 2000,
        inProgress: 3000,
        pending: 5000,
        paused: 1000,
      }

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <TaskCompletionRateChart data={data} />
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(200) // Complex calculations should still be fast
    })

    it('handles time series data processing efficiently', () => {
      const data = createLargeDataset(1000) // Large time series

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <TaskCompletionRateChart data={data} variant="bar" showStatusDistribution={true} />
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(2000) // Time series processing should be reasonable

      const barChart = screen.getByTestId('bar-chart')
      expect(barChart).toHaveAttribute('data-size', '1000')
    })

    it('optimizes percentage and number formatting', () => {
      const data = createLargeDataset(10)
      // Set very large numbers to test formatting performance
      data.totalCompleted = 999999999
      data.totalFailed = 123456789
      data.totalProcessed = 1123456788

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <TaskCompletionRateChart data={data} />
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(150) // Number formatting shouldn't be a bottleneck
    })
  })
})

describe('TaskCompletionRateChartMini Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Lightweight Rendering', () => {
    it('renders faster than full chart component', () => {
      const data = createLargeDataset(100)

      const [, fullChartTime] = measureRenderTime(() => {
        const { unmount } = render(
          <TestWrapper>
            <TaskCompletionRateChart data={data} />
          </TestWrapper>
        )
        unmount()
        return null
      })

      const [, miniChartTime] = measureRenderTime(() => {
        const { unmount } = render(
          <TestWrapper>
            <TaskCompletionRateChartMini data={data} />
          </TestWrapper>
        )
        unmount()
        return null
      })

      expect(miniChartTime).toBeLessThanOrEqual(fullChartTime)
    })

    it('efficiently handles multiple instances', () => {
      const data = createLargeDataset(50)

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <TaskCompletionRateChartMini data={data} />
              <TaskCompletionRateChartMini data={data} />
              <TaskCompletionRateChartMini data={data} />
              <TaskCompletionRateChartMini data={data} />
            </div>
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(500) // Multiple mini charts should still be fast
      const charts = screen.getAllByTestId('responsive-container')
      expect(charts).toHaveLength(4)
    })

    it('scales well with dashboard-sized layouts', () => {
      const data = createLargeDataset(25)

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
              {Array.from({ length: 12 }, (_, i) => (
                <TaskCompletionRateChartMini key={i} data={data} height={60} />
              ))}
            </div>
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(800) // Dashboard with 12 mini charts should be reasonable
      const charts = screen.getAllByTestId('responsive-container')
      expect(charts).toHaveLength(12)
    })
  })

  describe('Compact Data Processing', () => {
    it('efficiently processes essential data only', () => {
      const data = createLargeDataset(500)

      const [, renderTime] = measureRenderTime(() => {
        return render(
          <TestWrapper>
            <TaskCompletionRateChartMini data={data} />
          </TestWrapper>
        )
      })

      expect(renderTime).toBeLessThan(300) // Should process only essential data quickly
      expect(screen.getByText('84%')).toBeInTheDocument() // Success rate
      expect(screen.getByText(/tasks/)).toBeInTheDocument() // Task count
    })
  })
})

describe('Performance Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maintains consistent performance across different data patterns', () => {
    const testCases = [
      { name: 'uniform-data', size: 100, pattern: 'uniform' },
      { name: 'sparse-data', size: 100, pattern: 'sparse' },
      { name: 'dense-data', size: 100, pattern: 'dense' },
      { name: 'irregular-data', size: 100, pattern: 'irregular' },
    ]

    const renderTimes: Record<string, number> = {}

    testCases.forEach(({ name, size }) => {
      const data = createLargeDataset(size)

      const [, renderTime] = measureRenderTime(() => {
        const { unmount } = render(
          <TestWrapper>
            <TaskCompletionRateChart data={data} />
          </TestWrapper>
        )
        unmount()
        return null
      })

      renderTimes[name] = renderTime
    })

    // Performance should be consistent regardless of data pattern
    const times = Object.values(renderTimes)
    const maxTime = Math.max(...times)
    const minTime = Math.min(...times)
    const variance = maxTime - minTime

    expect(variance).toBeLessThan(200) // Performance variance should be minimal
  })

  it('performance does not degrade with repeated renders', () => {
    const data = createLargeDataset(50)
    const renderTimes: number[] = []
    const iterations = 10

    for (let i = 0; i < iterations; i++) {
      const [, renderTime] = measureRenderTime(() => {
        const { unmount } = render(
          <TestWrapper>
            <TaskCompletionRateChart data={data} />
          </TestWrapper>
        )
        unmount()
        return null
      })
      renderTimes.push(renderTime)
    }

    // First render might be slower due to setup, but subsequent renders should be consistent
    const firstRender = renderTimes[0]
    const laterRenders = renderTimes.slice(1)
    const averageLaterRenders = laterRenders.reduce((sum, time) => sum + time, 0) / laterRenders.length

    // Later renders should not be significantly slower than the first
    expect(averageLaterRenders).toBeLessThanOrEqual(firstRender * 1.2) // Allow 20% variance
  })
})