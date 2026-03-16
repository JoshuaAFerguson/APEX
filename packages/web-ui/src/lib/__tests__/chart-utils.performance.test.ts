/**
 * Performance Tests for Chart Utilities
 *
 * Tests the performance characteristics of chart utilities under various loads
 * to ensure they scale well for dashboard and analytics use cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({
    resolvedTheme: 'dark',
    theme: 'dark',
    setTheme: vi.fn(),
    themes: ['light', 'dark'],
    systemTheme: 'dark',
  })),
}))

import {
  useChartTheme,
  useChartColors,
  createAxisFormatter,
  createTooltipFormatter,
  getCategoricalColor,
  compactNumberFormatter,
  currencyFormatter,
  percentageFormatter,
} from '../chart-utils'

// ============================================================================
// Performance Test Helpers
// ============================================================================

/**
 * Measures the execution time of a function
 */
function measureTime<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  return { result, duration }
}

/**
 * Runs a function multiple times and measures average execution time
 */
function benchmark<T>(fn: () => T, iterations = 1000): { averageDuration: number; totalDuration: number } {
  let totalDuration = 0

  for (let i = 0; i < iterations; i++) {
    const { duration } = measureTime(fn)
    totalDuration += duration
  }

  return {
    averageDuration: totalDuration / iterations,
    totalDuration,
  }
}

/**
 * Creates large datasets for performance testing
 */
function createLargeDataset(size: number): number[] {
  return Array.from({ length: size }, (_, i) => Math.random() * 1000000 + i)
}

/**
 * React wrapper for hooks
 */
const wrapper = ({ children }: { children: ReactNode }) => children

// ============================================================================
// Performance Test Suites
// ============================================================================

describe('Chart Utils Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // Hook Performance Tests
  // ==========================================================================

  describe('Hook Performance', () => {
    it('should render useChartTheme hook quickly', () => {
      const { duration } = measureTime(() => {
        renderHook(() => useChartTheme(), { wrapper })
      })

      // Should render in reasonable time
      expect(duration).toBeLessThan(20)
    })

    it('should handle multiple useChartTheme calls efficiently', () => {
      const { averageDuration } = benchmark(() => {
        renderHook(() => useChartTheme(), { wrapper })
      }, 100)

      // Average should be very fast
      expect(averageDuration).toBeLessThan(5)
    })

    it('should render useChartColors hook quickly with various counts', () => {
      const counts = [1, 4, 8, 100]

      counts.forEach(count => {
        const { duration } = measureTime(() => {
          renderHook(() => useChartColors(count), { wrapper })
        })

        // Should render quickly regardless of count
        expect(duration).toBeLessThan(5)
      })
    })

    it('should handle rapid useChartColors calls', () => {
      const { averageDuration } = benchmark(() => {
        renderHook(() => useChartColors(8), { wrapper })
      }, 500)

      expect(averageDuration).toBeLessThan(3)
    })
  })

  // ==========================================================================
  // Formatter Performance Tests
  // ==========================================================================

  describe('Formatter Performance', () => {
    it('should create formatters quickly', () => {
      const formatterTypes = [
        { type: 'number' as const },
        { type: 'currency' as const },
        { type: 'percentage' as const },
        { type: 'compact' as const },
        { type: 'date' as const },
        { type: 'time' as const },
        { type: 'datetime' as const },
      ]

      formatterTypes.forEach(options => {
        const { duration } = measureTime(() => {
          createAxisFormatter(options)
        })

        // Formatter creation should be instant
        expect(duration).toBeLessThan(1)
      })
    })

    it('should format large datasets efficiently', () => {
      const dataset = createLargeDataset(10000)
      const formatter = createAxisFormatter({ type: 'compact' })

      const { duration } = measureTime(() => {
        dataset.forEach(value => formatter(value))
      })

      // Should format 10k values in under 100ms
      expect(duration).toBeLessThan(100)
    })

    it('should handle number formatting at scale', () => {
      const numberFormatter = createAxisFormatter({ type: 'number', precision: 2 })
      const largeNumbers = Array.from({ length: 5000 }, () => Math.random() * 1000000)

      const { averageDuration } = benchmark(() => {
        largeNumbers.forEach(num => numberFormatter(num))
      }, 10)

      // Should format 5k numbers in reasonable time on average
      expect(averageDuration).toBeLessThan(250)
    })

    it('should handle currency formatting efficiently', () => {
      const currencyFormatter = createAxisFormatter({ type: 'currency' })
      const amounts = Array.from({ length: 1000 }, () => Math.random() * 100000)

      const { duration } = measureTime(() => {
        amounts.forEach(amount => currencyFormatter(amount))
      })

      expect(duration).toBeLessThan(100)
    })

    it('should handle percentage formatting at scale', () => {
      const percentFormatter = createAxisFormatter({ type: 'percentage', precision: 1 })
      const percentages = Array.from({ length: 1000 }, () => Math.random())

      const { duration } = measureTime(() => {
        percentages.forEach(pct => percentFormatter(pct))
      })

      expect(duration).toBeLessThan(30)
    })

    it('should handle compact formatting efficiently', () => {
      const compactFormatter = createAxisFormatter({ type: 'compact' })
      const largeNumbers = [
        ...Array.from({ length: 500 }, () => Math.random() * 1000), // < 1K
        ...Array.from({ length: 500 }, () => Math.random() * 1000000), // 1K - 1M
        ...Array.from({ length: 500 }, () => Math.random() * 1000000000), // 1M - 1B
      ]

      const { duration } = measureTime(() => {
        largeNumbers.forEach(num => compactFormatter(num))
      })

      expect(duration).toBeLessThan(40)
    })

    it('should handle date formatting efficiently', () => {
      const dateFormatter = createAxisFormatter({ type: 'date' })
      const dates = Array.from({ length: 1000 }, (_, i) =>
        new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      )

      const { duration } = measureTime(() => {
        dates.forEach(date => dateFormatter(date))
      })

      expect(duration).toBeLessThan(100)
    })
  })

  // ==========================================================================
  // Pre-built Formatter Performance Tests
  // ==========================================================================

  describe('Pre-built Formatter Performance', () => {
    it('should use pre-built formatters efficiently', () => {
      const dataset = createLargeDataset(1000)
      const formatters = [
        compactNumberFormatter,
        currencyFormatter,
        percentageFormatter,
      ]

      formatters.forEach(formatter => {
        const { duration } = measureTime(() => {
          dataset.forEach(value => formatter(value))
        })

        // Pre-built formatters should be reasonably fast
        expect(duration).toBeLessThan(60)
      })
    })

    it('should handle concurrent formatter usage', () => {
      const data = createLargeDataset(500)

      const { duration } = measureTime(() => {
        data.forEach(value => {
          // Use multiple formatters on the same data
          compactNumberFormatter(value)
          currencyFormatter(value)
          percentageFormatter(value / 100)
        })
      })

      expect(duration).toBeLessThan(100)
    })
  })

  // ==========================================================================
  // Tooltip Formatter Performance Tests
  // ==========================================================================

  describe('Tooltip Formatter Performance', () => {
    it('should create tooltip formatters quickly', () => {
      const { duration } = measureTime(() => {
        const formatters = [
          createTooltipFormatter({ type: 'number', label: 'Count' }),
          createTooltipFormatter({ type: 'currency', label: 'Revenue' }),
          createTooltipFormatter({ type: 'percentage', label: 'Growth' }),
          createTooltipFormatter({ type: 'compact', label: 'Users' }),
        ]
        return formatters
      })

      expect(duration).toBeLessThan(5)
    })

    it('should format tooltip data efficiently', () => {
      const formatter = createTooltipFormatter({ type: 'currency', label: 'Sales' })
      const salesData = Array.from({ length: 1000 }, () => Math.random() * 100000)

      const { duration } = measureTime(() => {
        salesData.forEach(value => formatter(value, 'sales'))
      })

      expect(duration).toBeLessThan(40)
    })
  })

  // ==========================================================================
  // Color Function Performance Tests
  // ==========================================================================

  describe('Color Function Performance', () => {
    it('should retrieve categorical colors quickly', () => {
      const theme = { colors: { categorical: ['#ff0000', '#00ff00', '#0000ff'] } }
      const indices = Array.from({ length: 1000 }, (_, i) => i)

      const { duration } = measureTime(() => {
        indices.forEach(index => getCategoricalColor(theme as any, index))
      })

      expect(duration).toBeLessThan(10)
    })

    it('should handle large color index ranges efficiently', () => {
      const theme = {
        colors: {
          categorical: Array.from({ length: 8 }, (_, i) => `#${i}${i}${i}${i}${i}${i}`)
        }
      }

      const { averageDuration } = benchmark(() => {
        // Test wrapping with large indices
        getCategoricalColor(theme as any, 1000000)
      }, 1000)

      expect(averageDuration).toBeLessThan(1)
    })
  })

  // ==========================================================================
  // Memory Performance Tests
  // ==========================================================================

  describe('Memory Performance', () => {
    it('should not create excessive objects during formatting', () => {
      const formatter = createAxisFormatter({ type: 'compact' })
      const initialHeap = (performance as any).memory?.usedJSHeapSize || 0

      // Format a large number of values
      const dataset = createLargeDataset(5000)
      dataset.forEach(value => formatter(value))

      const finalHeap = (performance as any).memory?.usedJSHeapSize || 0
      const heapGrowth = finalHeap - initialHeap

      // Heap growth should be reasonable (less than 1MB for 5k operations)
      if (initialHeap > 0) {
        expect(heapGrowth).toBeLessThan(1024 * 1024)
      }
    })

    it('should reuse formatter instances efficiently', () => {
      // Create formatters once
      const formatters = [
        createAxisFormatter({ type: 'number' }),
        createAxisFormatter({ type: 'currency' }),
        createAxisFormatter({ type: 'compact' }),
      ]

      const dataset = createLargeDataset(1000)

      const { duration } = measureTime(() => {
        // Use the same formatter instances multiple times
        for (let i = 0; i < 10; i++) {
          dataset.forEach(value => {
            formatters[0](value)
            formatters[1](value)
            formatters[2](value)
          })
        }
      })

      // Should be efficient with reused formatters
      expect(duration).toBeLessThan(200)
    })
  })

  // ==========================================================================
  // Stress Tests
  // ==========================================================================

  describe('Stress Tests', () => {
    it('should handle extreme data volumes', () => {
      const extremeDataset = createLargeDataset(50000)
      const formatter = createAxisFormatter({ type: 'compact' })

      const { duration } = measureTime(() => {
        extremeDataset.forEach(value => formatter(value))
      })

      // Should handle 50k values in under 500ms
      expect(duration).toBeLessThan(500)
    })

    it('should handle concurrent theme and formatting operations', () => {
      const { duration } = measureTime(() => {
        // Simulate multiple charts updating simultaneously
        const operations = Array.from({ length: 10 }, () => {
          const { result } = renderHook(() => {
            const theme = useChartTheme()
            const colors = useChartColors(8)
            const formatter = createAxisFormatter({ type: 'compact' })

            // Use the results
            return {
              theme: theme.colors.primary,
              colors: colors[0],
              formatted: formatter(1000)
            }
          }, { wrapper })

          return result.current
        })

        return operations
      })

      expect(duration).toBeLessThan(100)
    })

    it('should maintain performance with complex formatter configurations', () => {
      const complexFormatters = [
        createAxisFormatter({
          type: 'number',
          precision: 4,
          prefix: '$',
          suffix: ' USD'
        }),
        createAxisFormatter({
          type: 'compact',
          compactThreshold: 100,
          prefix: '~',
          suffix: ' approx'
        }),
        createAxisFormatter({
          type: 'percentage',
          precision: 3,
          prefix: 'Growth: ',
          suffix: '%'
        }),
      ]

      const dataset = createLargeDataset(2000)

      const { duration } = measureTime(() => {
        dataset.forEach(value => {
          complexFormatters.forEach(formatter => formatter(value))
        })
      })

      // Complex formatters should still be reasonably fast
      expect(duration).toBeLessThan(200)
    })
  })

  // ==========================================================================
  // Regression Tests
  // ==========================================================================

  describe('Performance Regression Tests', () => {
    it('should maintain baseline performance for common operations', () => {
      const commonOperations = () => {
        const { result: themeResult } = renderHook(() => useChartTheme(), { wrapper })
        const { result: colorsResult } = renderHook(() => useChartColors(8), { wrapper })

        const formatters = [
          createAxisFormatter({ type: 'number' }),
          createAxisFormatter({ type: 'currency' }),
          createAxisFormatter({ type: 'compact' }),
        ]

        const sampleData = [0, 1000, 1000000, -500, 0.123]

        sampleData.forEach(value => {
          formatters.forEach(formatter => formatter(value))
        })

        return {
          theme: themeResult.current,
          colors: colorsResult.current,
          formatters
        }
      }

      const { averageDuration } = benchmark(commonOperations, 100)

      // Baseline: common operations should average under 5ms
      expect(averageDuration).toBeLessThan(5)
    })

    it('should scale linearly with data size', () => {
      const formatter = createAxisFormatter({ type: 'compact' })

      const sizes = [100, 500, 1000, 2000]
      const results = sizes.map(size => {
        const dataset = createLargeDataset(size)
        const { duration } = measureTime(() => {
          dataset.forEach(value => formatter(value))
        })
        return { size, duration }
      })

      // Check that performance scales reasonably
      for (let i = 1; i < results.length; i++) {
        const ratio = results[i].duration / results[i-1].duration
        const sizeRatio = results[i].size / results[i-1].size

        // Performance should scale roughly linearly (within 50% tolerance)
        expect(ratio).toBeLessThan(sizeRatio * 1.5)
      }
    })
  })
})