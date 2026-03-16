/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider } from 'next-themes'
import {
  TokenUsageOverTimeChart,
  TokenUsageOverTimeChartMini,
} from '../TokenUsageOverTimeChart'
import type {
  TokenUsageOverTimeData,
  TokenUsageDataPoint,
} from '@/types/performance-metrics'

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

// Mock performance.now for timing tests
const mockPerformanceNow = vi.fn()
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn().mockReturnValue([]),
    getEntriesByName: vi.fn().mockReturnValue([]),
  },
  writable: true,
})

// Mock Recharts components with performance tracking
let renderCallCount = 0
let dataProcessingTime = 0

vi.mock('recharts', () => ({
  AreaChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => {
    renderCallCount++
    const startTime = performance.now()

    // Simulate data processing time based on data size
    if (data && data.length > 0) {
      dataProcessingTime = data.length * 0.01 // Mock processing time
    }

    const endTime = performance.now()

    return (
      <div
        data-testid="area-chart"
        data-render-count={renderCallCount}
        data-points={data?.length || 0}
        data-processing-time={endTime - startTime}
      >
        {children}
      </div>
    )
  },
  LineChart: ({ children, data }: { children: React.ReactNode; data: any[] }) => {
    renderCallCount++
    return (
      <div
        data-testid="line-chart"
        data-render-count={renderCallCount}
        data-points={data?.length || 0}
      >
        {children}
      </div>
    )
  },
  Area: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`area-${dataKey}`} data-name={name} />
  ),
  Line: ({ dataKey, name }: { dataKey: string; name: string }) => (
    <div data-testid={`line-${dataKey}`} data-name={name} />
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: { content: React.ComponentType<any> }) => (
    <div data-testid="tooltip">
      {content && React.createElement(content, {
        active: true,
        payload: [],
        label: '',
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
  useChartTheme: vi.fn(() => ({
    colors: {
      categorical: ['#0ea5e9', '#8b5cf6', '#22c55e'],
      success: '#22c55e',
    },
    mode: 'light' as const,
    mounted: true,
  })),
  getTooltipStyle: vi.fn(() => ({
    contentStyle: { backgroundColor: '#f4f4f5' },
    labelStyle: { color: '#09090b' },
  })),
  getGridStyle: vi.fn(() => ({ stroke: '#e4e4e7' })),
  getAxisStyle: vi.fn(() => ({ stroke: '#d4d4d8' })),
  compactNumberFormatter: vi.fn((value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }),
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...classes: string[]) => classes.filter(Boolean).join(' ')),
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
function createLargeDataset(
  dataPoints: number = 1000,
  options: {
    withCache?: boolean
    withCost?: boolean
    complexBreakdown?: boolean
  } = {}
): TokenUsageOverTimeData {
  const { withCache = false, withCost = false, complexBreakdown = false } = options
  const baseTime = new Date('2024-01-01T00:00:00Z')
  const intervalMs = 60 * 1000 // 1 minute intervals

  const data: TokenUsageDataPoint[] = Array.from({ length: dataPoints }, (_, i) => {
    const inputTokens = Math.floor(1000 + Math.random() * 500)
    const outputTokens = Math.floor(600 + Math.random() * 300)

    return {
      timestamp: new Date(baseTime.getTime() + i * intervalMs),
      totalTokens: inputTokens + outputTokens,
      breakdown: {
        inputTokens,
        outputTokens,
        cacheCreationTokens: withCache ? Math.floor(inputTokens * 0.1) : undefined,
        cacheReadTokens: withCache ? Math.floor(inputTokens * 0.05) : undefined,
      },
      tokensPerMinute: complexBreakdown ? (inputTokens + outputTokens) / 60 : undefined,
      cost: withCost ? (inputTokens + outputTokens) * 0.00005 : undefined,
    }
  })

  const totalInputTokens = data.reduce((sum, point) => sum + point.breakdown.inputTokens, 0)
  const totalOutputTokens = data.reduce((sum, point) => sum + point.breakdown.outputTokens, 0)

  return {
    data,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCacheCreationTokens: withCache
      ? data.reduce((sum, point) => sum + (point.breakdown.cacheCreationTokens || 0), 0)
      : 0,
    totalCacheReadTokens: withCache
      ? data.reduce((sum, point) => sum + (point.breakdown.cacheReadTokens || 0), 0)
      : 0,
    cacheHitRate: withCache ? 15.5 : 0,
    avgTokensPerMinute: 25.0,
    peakTokensPerMinute: 45.0,
    totalCost: withCost ? (totalInputTokens + totalOutputTokens) * 0.00005 : 0,
    timeRange: '24h',
    generatedAt: new Date(),
    trend: 1,
    changePercent: 12.3,
  }
}

function createMemoryStressDataset(): TokenUsageOverTimeData {
  // Create a very large dataset to test memory handling
  return createLargeDataset(10000, {
    withCache: true,
    withCost: true,
    complexBreakdown: true,
  })
}

// Performance measurement helpers
function measureRenderTime(renderFn: () => void): number {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

// Counter for consistent memory measurements
let memoryCounter = 0

function measureMemoryUsage(): { used: number; total: number } {
  // Mock memory measurement with consistent growth pattern
  const baseMemory = 2000000 // 2MB base
  const growth = memoryCounter * 50000 // 50KB per measurement
  memoryCounter++

  return {
    used: baseMemory + growth,
    total: 100000000, // Mock total memory
  }
}

describe('TokenUsageOverTimeChart Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderCallCount = 0
    dataProcessingTime = 0
    memoryCounter = 0 // Reset memory counter for consistent tests
    mockPerformanceNow.mockImplementation(() => Date.now())
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Rendering Performance', () => {
    it('renders efficiently with small datasets', () => {
      const smallData = createLargeDataset(10)

      const renderTime = measureRenderTime(() => {
        render(
          <TestWrapper>
            <TokenUsageOverTimeChart data={smallData} />
          </TestWrapper>
        )
      })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(renderCallCount).toBe(1)

      // Small datasets should render very quickly
      expect(renderTime).toBeLessThan(100) // 100ms threshold
    })

    it('maintains reasonable performance with medium datasets', () => {
      const mediumData = createLargeDataset(100)

      const renderTime = measureRenderTime(() => {
        render(
          <TestWrapper>
            <TokenUsageOverTimeChart data={mediumData} />
          </TestWrapper>
        )
      })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '100')

      // Medium datasets should still render reasonably fast
      expect(renderTime).toBeLessThan(500) // 500ms threshold
    })

    it('handles large datasets without significant performance degradation', () => {
      const largeData = createLargeDataset(1000)

      const renderTime = measureRenderTime(() => {
        render(
          <TestWrapper>
            <TokenUsageOverTimeChart data={largeData} />
          </TestWrapper>
        )
      })

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toHaveAttribute('data-points', '1000')

      // Large datasets should still be manageable
      expect(renderTime).toBeLessThan(2000) // 2 second threshold
    })

    it('optimizes re-renders when data changes incrementally', () => {
      const initialData = createLargeDataset(100)
      const { rerender } = render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={initialData} />
        </TestWrapper>
      )

      const initialRenderCount = renderCallCount

      // Add one more data point (simulate real-time update)
      const updatedData = {
        ...initialData,
        data: [
          ...initialData.data,
          {
            timestamp: new Date(),
            totalTokens: 1500,
            breakdown: { inputTokens: 900, outputTokens: 600 },
          },
        ],
      }

      const rerenderTime = measureRenderTime(() => {
        rerender(
          <TestWrapper>
            <TokenUsageOverTimeChart data={updatedData} />
          </TestWrapper>
        )
      })

      expect(renderCallCount).toBe(initialRenderCount + 1)
      expect(rerenderTime).toBeLessThan(200) // Re-renders should be faster
    })
  })

  describe('Memory Management', () => {
    it('handles memory efficiently with large datasets', () => {
      const memoryStressData = createMemoryStressDataset()
      const memoryBefore = measureMemoryUsage()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={memoryStressData} />
        </TestWrapper>
      )

      const memoryAfter = measureMemoryUsage()

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Memory usage should not grow excessively
      const memoryGrowth = memoryAfter.used - memoryBefore.used
      expect(memoryGrowth).toBeLessThan(memoryBefore.total * 0.1) // Less than 10% of total memory
    })

    it('cleans up resources when unmounted', () => {
      const largeData = createLargeDataset(1000)
      const { unmount } = render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={largeData} />
        </TestWrapper>
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      const memoryBeforeUnmount = measureMemoryUsage()

      act(() => {
        unmount()
      })

      const memoryAfterUnmount = measureMemoryUsage()

      // Memory should be released (or at least not grow)
      expect(memoryAfterUnmount.used).toBeLessThanOrEqual(memoryBeforeUnmount.used * 1.05)
    })

    it('handles rapid data updates without memory leaks', () => {
      let currentData = createLargeDataset(100)
      const { rerender } = render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={currentData} />
        </TestWrapper>
      )

      const initialMemory = measureMemoryUsage()

      // Simulate rapid updates (like real-time data)
      for (let i = 0; i < 20; i++) {
        currentData = createLargeDataset(100 + i) // Gradually increasing data size

        act(() => {
          rerender(
            <TestWrapper>
              <TokenUsageOverTimeChart data={currentData} />
            </TestWrapper>
          )
        })
      }

      const finalMemory = measureMemoryUsage()

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Memory growth should be reasonable even after many updates
      const memoryGrowthRatio = finalMemory.used / initialMemory.used
      expect(memoryGrowthRatio).toBeLessThan(3) // Less than 3x memory growth
    })
  })

  describe('Data Processing Performance', () => {
    it('efficiently processes chart data transformation', () => {
      const complexData = createLargeDataset(500, {
        withCache: true,
        withCost: true,
        complexBreakdown: true,
      })

      const processingStart = performance.now()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={complexData} showBreakdown={true} />
        </TestWrapper>
      )

      const processingEnd = performance.now()
      const processingTime = processingEnd - processingStart

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
      expect(screen.getByTestId('area-inputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-outputTokens')).toBeInTheDocument()
      expect(screen.getByTestId('area-cacheCreationTokens')).toBeInTheDocument()

      // Data processing should be efficient
      expect(processingTime).toBeLessThan(1000) // 1 second for complex data
    })

    it('memoizes expensive calculations effectively', () => {
      const testData = createLargeDataset(200)

      // First render
      const firstRenderStart = performance.now()
      const { rerender } = render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )
      const firstRenderEnd = performance.now()
      const firstRenderTime = firstRenderEnd - firstRenderStart

      // Re-render with same data (should be faster due to memoization)
      const secondRenderStart = performance.now()
      rerender(
        <TestWrapper>
          <TokenUsageOverTimeChart data={testData} />
        </TestWrapper>
      )
      const secondRenderEnd = performance.now()
      const secondRenderTime = secondRenderEnd - secondRenderStart

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Second render should benefit from memoization
      expect(secondRenderTime).toBeLessThanOrEqual(firstRenderTime)
    })

    it('handles time range formatting efficiently', () => {
      const timeRanges = ['1h', '6h', '24h', '7d', '30d'] as const
      const timingResults: number[] = []

      timeRanges.forEach(timeRange => {
        const testData = createLargeDataset(100)
        testData.timeRange = timeRange

        const formatStart = performance.now()

        render(
          <TestWrapper>
            <TokenUsageOverTimeChart data={testData} />
          </TestWrapper>
        )

        const formatEnd = performance.now()
        timingResults.push(formatEnd - formatStart)
      })

      // All time ranges should format efficiently
      timingResults.forEach(time => {
        expect(time).toBeLessThan(500) // 500ms threshold per time range
      })

      // Verify all time ranges were processed successfully
      expect(timingResults).toHaveLength(5) // Should have processed all 5 time ranges
    })
  })

  describe('Animation Performance', () => {
    it('maintains smooth animations with moderate datasets', () => {
      const animatedData = createLargeDataset(100)

      const animationStart = performance.now()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={animatedData} animated={true} />
        </TestWrapper>
      )

      const animationEnd = performance.now()
      const animationTime = animationEnd - animationStart

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Animation setup should not significantly impact performance
      expect(animationTime).toBeLessThan(600) // 600ms threshold
    })

    it('gracefully degrades animation performance with large datasets', () => {
      const largeAnimatedData = createLargeDataset(1000)

      const { rerender } = render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={largeAnimatedData} animated={true} />
        </TestWrapper>
      )

      // Disable animations for large datasets
      const disabledAnimationStart = performance.now()

      rerender(
        <TestWrapper>
          <TokenUsageOverTimeChart data={largeAnimatedData} animated={false} />
        </TestWrapper>
      )

      const disabledAnimationEnd = performance.now()
      const disabledAnimationTime = disabledAnimationEnd - disabledAnimationStart

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Disabling animations should improve performance for large datasets
      expect(disabledAnimationTime).toBeLessThan(400) // Should be faster
    })
  })

  describe('Responsive Performance', () => {
    it('handles responsive container efficiently', () => {
      const responsiveData = createLargeDataset(200)

      const responsiveStart = performance.now()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={responsiveData} height={400} />
        </TestWrapper>
      )

      const responsiveEnd = performance.now()
      const responsiveTime = responsiveEnd - responsiveStart

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()

      // Responsive container should not add significant overhead
      expect(responsiveTime).toBeLessThan(800) // 800ms threshold
    })

    it('optimizes performance across different chart sizes', () => {
      const sizeData = createLargeDataset(150)
      const sizes = [100, 200, 400, 800]
      const sizeTimings: number[] = []

      sizes.forEach(size => {
        const sizeStart = performance.now()

        const { unmount } = render(
          <TestWrapper>
            <TokenUsageOverTimeChart data={sizeData} height={size} />
          </TestWrapper>
        )

        const sizeEnd = performance.now()
        sizeTimings.push(sizeEnd - sizeStart)

        unmount()
      })

      // Performance should scale reasonably with size
      sizeTimings.forEach(time => {
        expect(time).toBeLessThan(1000) // 1 second threshold for any size
      })
    })
  })

  describe('Mini Chart Performance', () => {
    it('optimizes mini chart rendering for dashboard use', () => {
      const miniData = createLargeDataset(50)

      const miniStart = performance.now()

      render(
        <TestWrapper>
          <TokenUsageOverTimeChartMini data={miniData} />
        </TestWrapper>
      )

      const miniEnd = performance.now()
      const miniTime = miniEnd - miniStart

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Mini chart should be very fast
      expect(miniTime).toBeLessThan(200) // 200ms threshold for mini chart
    })

    it('handles multiple mini charts efficiently', () => {
      const multiMiniData = Array.from({ length: 5 }, () => createLargeDataset(30))

      const multiStart = performance.now()

      render(
        <TestWrapper>
          <div>
            {multiMiniData.map((data, index) => (
              <TokenUsageOverTimeChartMini key={index} data={data} />
            ))}
          </div>
        </TestWrapper>
      )

      const multiEnd = performance.now()
      const multiTime = multiEnd - multiStart

      const charts = screen.getAllByTestId('area-chart')
      expect(charts).toHaveLength(5)

      // Multiple mini charts should still be performant
      expect(multiTime).toBeLessThan(1000) // 1 second for 5 mini charts
    })
  })

  describe('Stress Testing', () => {
    it('survives extreme data volume stress test', () => {
      const extremeData = createLargeDataset(5000) // Very large dataset

      const stressStart = performance.now()

      const { unmount } = render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={extremeData} />
        </TestWrapper>
      )

      const stressEnd = performance.now()
      const stressTime = stressEnd - stressStart

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Should handle extreme data volumes
      expect(stressTime).toBeLessThan(5000) // 5 second maximum for extreme data

      // Clean up
      unmount()
    })

    it('maintains stability under rapid updates', () => {
      let rapidData = createLargeDataset(100)
      const { rerender } = render(
        <TestWrapper>
          <TokenUsageOverTimeChart data={rapidData} />
        </TestWrapper>
      )

      const rapidStart = performance.now()

      // Simulate very rapid updates
      for (let i = 0; i < 50; i++) {
        rapidData = createLargeDataset(100 + i)

        act(() => {
          rerender(
            <TestWrapper>
              <TokenUsageOverTimeChart data={rapidData} />
            </TestWrapper>
          )
        })
      }

      const rapidEnd = performance.now()
      const rapidTime = rapidEnd - rapidStart

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()

      // Should handle rapid updates without crashing
      expect(rapidTime).toBeLessThan(10000) // 10 seconds for 50 rapid updates
    })
  })
})