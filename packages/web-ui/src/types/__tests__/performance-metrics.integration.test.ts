import { describe, it, expect } from 'vitest'
import type {
  PerformanceMetricsPanelProps,
  TokenUsageOverTimeData,
  TaskCompletionRateData,
  CostTrendData,
  PerformanceMetricsTimeRange,
} from '../performance-metrics'

import {
  EMPTY_TOKEN_USAGE_DATA,
  EMPTY_TASK_COMPLETION_DATA,
  EMPTY_COST_TREND_DATA,
  TIME_RANGE_CONFIGS,
  DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS,
  formatCost,
  formatTokenCount,
  formatPercentage,
  formatDuration,
  calculateTrend,
  calculateChangePercent,
  getTimeRangeLabel,
  getTimeRangeOptions,
} from '../performance-metrics'

describe('Performance Metrics Integration', () => {
  describe('Type Integration', () => {
    it('should create a valid PerformanceMetricsPanelProps object', () => {
      const props: PerformanceMetricsPanelProps = {
        tokenUsageData: EMPTY_TOKEN_USAGE_DATA,
        taskCompletionData: EMPTY_TASK_COMPLETION_DATA,
        costTrendData: EMPTY_COST_TREND_DATA,
        timeRange: '24h',
        onTimeRangeChange: (range: PerformanceMetricsTimeRange) => {
          console.log(`Time range changed to: ${range}`)
        },
        loading: false,
        showTimeRangeSelector: true,
        showTokenUsage: true,
        showTaskCompletion: true,
        showCostTrend: true,
      }

      expect(props).toBeDefined()
      expect(props.timeRange).toBe('24h')
      expect(typeof props.onTimeRangeChange).toBe('function')
      expect(props.tokenUsageData.totalTokens).toBe(0)
      expect(props.taskCompletionData.overallCompletionRate).toBe(0)
      expect(props.costTrendData.totalCost).toBe(0)
    })

    it('should work with all time range configurations', () => {
      const timeRanges: PerformanceMetricsTimeRange[] = ['1h', '6h', '24h', '7d', '30d']

      timeRanges.forEach(range => {
        const config = TIME_RANGE_CONFIGS[range]
        const label = getTimeRangeLabel(range)

        expect(config).toBeDefined()
        expect(config.value).toBe(range)
        expect(config.label).toBe(label)
        expect(config.intervalMs).toBeGreaterThan(0)
        expect(config.dataPoints).toBeGreaterThan(0)
      })
    })

    it('should create realistic data structures', () => {
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 3600000)

      // Create realistic token usage data
      const tokenData: TokenUsageOverTimeData = {
        data: [
          {
            timestamp: hourAgo,
            totalTokens: 1500,
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationTokens: 100,
            cacheReadTokens: 50,
            tokensPerMinute: 75,
            cost: 0.015,
          },
          {
            timestamp: now,
            totalTokens: 2000,
            inputTokens: 1300,
            outputTokens: 700,
            cacheCreationTokens: 150,
            cacheReadTokens: 80,
            tokensPerMinute: 100,
            cost: 0.020,
          },
        ],
        totalInputTokens: 2300,
        totalOutputTokens: 1200,
        totalTokens: 3500,
        totalCacheCreationTokens: 250,
        totalCacheReadTokens: 130,
        cacheHitRate: 0.34,
        avgTokensPerMinute: 87.5,
        peakTokensPerMinute: 100,
        totalCost: 0.035,
        timeRange: '1h',
        generatedAt: now,
      }

      expect(tokenData.data).toHaveLength(2)
      expect(tokenData.totalTokens).toBe(3500)
      expect(tokenData.cacheHitRate).toBeCloseTo(0.34, 2)

      // Create realistic task completion data
      const taskData: TaskCompletionRateData = {
        data: [
          {
            timestamp: hourAgo,
            completionRate: 0.8,
            successRate: 0.9,
            totalCompleted: 40,
            totalFailed: 5,
            totalInProgress: 10,
            averageCompletionTime: 300000, // 5 minutes
          },
          {
            timestamp: now,
            completionRate: 0.85,
            successRate: 0.94,
            totalCompleted: 45,
            totalFailed: 5,
            totalInProgress: 8,
            averageCompletionTime: 280000, // 4.67 minutes
          },
        ],
        overallCompletionRate: 0.825,
        overallSuccessRate: 0.92,
        totalTasksCompleted: 85,
        totalTasksFailed: 10,
        avgCompletionTimeMs: 290000,
        medianCompletionTimeMs: 285000,
        p95CompletionTimeMs: 450000,
        timeRange: '1h',
        generatedAt: now,
      }

      expect(taskData.data).toHaveLength(2)
      expect(taskData.overallCompletionRate).toBeCloseTo(0.825, 3)

      // Create realistic cost trend data
      const costData: CostTrendData = {
        data: [
          {
            timestamp: hourAgo,
            cost: 0.015,
            cumulativeCost: 1.50,
            projectedCost: 0.018,
            breakdown: {
              inputTokenCost: 0.010,
              outputTokenCost: 0.005,
              cacheCreationCost: 0.001,
              cacheReadCost: 0.0005,
              otherCost: 0.0005,
            },
          },
          {
            timestamp: now,
            cost: 0.020,
            cumulativeCost: 1.52,
            projectedCost: 0.022,
            breakdown: {
              inputTokenCost: 0.013,
              outputTokenCost: 0.007,
              cacheCreationCost: 0.0015,
              cacheReadCost: 0.0008,
              otherCost: 0.0007,
            },
          },
        ],
        totalCost: 1.52,
        avgCostPerHour: 0.0175,
        avgCostPerTask: 0.018,
        peakHourlyCost: 0.020,
        breakdown: {
          inputTokenCost: 0.023,
          outputTokenCost: 0.012,
          cacheCreationCost: 0.0025,
          cacheReadCost: 0.0013,
          otherCost: 0.0012,
        },
        timeRange: '1h',
        generatedAt: now,
      }

      expect(costData.data).toHaveLength(2)
      expect(costData.totalCost).toBeCloseTo(1.52, 2)
    })
  })

  describe('Utility Functions Integration', () => {
    it('should format various cost values correctly', () => {
      const costs = [0, 0.00001, 0.001, 0.15, 1.234, 12.50, 1234.567]
      const expectedFormats = [
        '<$0.0001',
        '<$0.0001',
        '$0.0010',
        '$0.1500',
        '$1.23',
        '$12.50',
        '$1234.57'
      ]

      costs.forEach((cost, index) => {
        expect(formatCost(cost)).toBe(expectedFormats[index])
      })
    })

    it('should format various token counts correctly', () => {
      const tokens = [0, 99, 999, 1000, 1234, 12345, 123456, 1234567, 12345678]
      const expectedFormats = ['0', '99', '999', '1.0K', '1.2K', '12.3K', '123.5K', '1.23M', '12.35M']

      tokens.forEach((token, index) => {
        expect(formatTokenCount(token)).toBe(expectedFormats[index])
      })
    })

    it('should calculate trends correctly', () => {
      const testCases = [
        { current: 100, previous: 90, expected: 1 }, // +11.1% increase
        { current: 90, previous: 100, expected: -1 }, // -10% decrease
        { current: 100, previous: 99.5, expected: 0 }, // +0.5% (< 1%)
        { current: 10, previous: 0, expected: 1 }, // From zero
        { current: 0, previous: 10, expected: -1 }, // To zero
        { current: 0, previous: 0, expected: 0 }, // Both zero
      ]

      testCases.forEach(({ current, previous, expected }, index) => {
        expect(calculateTrend(current, previous)).toBe(expected)
      })
    })

    it('should calculate change percentages correctly', () => {
      expect(calculateChangePercent(110, 100)).toBeCloseTo(10, 1)
      expect(calculateChangePercent(90, 100)).toBeCloseTo(-10, 1)
      expect(calculateChangePercent(100, 100)).toBeCloseTo(0, 1)
      expect(calculateChangePercent(200, 100)).toBeCloseTo(100, 1)
      expect(calculateChangePercent(0, 100)).toBeCloseTo(-100, 1)
      expect(calculateChangePercent(50, 0)).toBe(100) // From zero baseline
    })
  })

  describe('Default Values Integration', () => {
    it('should work with default props', () => {
      const props = {
        ...DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS,
        tokenUsageData: EMPTY_TOKEN_USAGE_DATA,
        taskCompletionData: EMPTY_TASK_COMPLETION_DATA,
        costTrendData: EMPTY_COST_TREND_DATA,
        onTimeRangeChange: (range: PerformanceMetricsTimeRange) => {},
      } as PerformanceMetricsPanelProps

      expect(props.timeRange).toBe('24h')
      expect(props.loading).toBe(false)
      expect(props.animated).toBe(true)
      expect(props.showTimeRangeSelector).toBe(true)
      expect(props.showTokenUsage).toBe(true)
      expect(props.showTaskCompletion).toBe(true)
      expect(props.showCostTrend).toBe(true)
    })

    it('should work with empty data constants', () => {
      expect(EMPTY_TOKEN_USAGE_DATA.data).toHaveLength(0)
      expect(EMPTY_TOKEN_USAGE_DATA.totalTokens).toBe(0)
      expect(EMPTY_TOKEN_USAGE_DATA.timeRange).toBe('24h')

      expect(EMPTY_TASK_COMPLETION_DATA.data).toHaveLength(0)
      expect(EMPTY_TASK_COMPLETION_DATA.overallCompletionRate).toBe(0)
      expect(EMPTY_TASK_COMPLETION_DATA.timeRange).toBe('24h')

      expect(EMPTY_COST_TREND_DATA.data).toHaveLength(0)
      expect(EMPTY_COST_TREND_DATA.totalCost).toBe(0)
      expect(EMPTY_COST_TREND_DATA.timeRange).toBe('24h')
    })
  })

  describe('Time Range Integration', () => {
    it('should provide consistent time range options', () => {
      const options = getTimeRangeOptions()
      const timeRanges: PerformanceMetricsTimeRange[] = ['1h', '6h', '24h', '7d', '30d']

      expect(options).toHaveLength(5)

      timeRanges.forEach((range, index) => {
        expect(options[index].value).toBe(range)
        expect(options[index].label).toBe(TIME_RANGE_CONFIGS[range].label)
      })
    })

    it('should have consistent interval progressions', () => {
      // Verify that intervals increase logically
      expect(TIME_RANGE_CONFIGS['1h'].intervalMs).toBeLessThan(TIME_RANGE_CONFIGS['6h'].intervalMs)
      expect(TIME_RANGE_CONFIGS['6h'].intervalMs).toBeLessThan(TIME_RANGE_CONFIGS['24h'].intervalMs)
      expect(TIME_RANGE_CONFIGS['24h'].intervalMs).toBeLessThan(TIME_RANGE_CONFIGS['7d'].intervalMs)
      expect(TIME_RANGE_CONFIGS['7d'].intervalMs).toBeLessThan(TIME_RANGE_CONFIGS['30d'].intervalMs)
    })
  })

  describe('Real-World Usage Scenarios', () => {
    it('should handle a typical dashboard update cycle', () => {
      // Simulate fetching new data
      const newTokenData: TokenUsageOverTimeData = {
        ...EMPTY_TOKEN_USAGE_DATA,
        totalTokens: 50000,
        totalCost: 0.50,
        cacheHitRate: 0.25,
        avgTokensPerMinute: 150,
      }

      const newTaskData: TaskCompletionRateData = {
        ...EMPTY_TASK_COMPLETION_DATA,
        overallCompletionRate: 0.95,
        overallSuccessRate: 0.98,
        totalTasksCompleted: 200,
      }

      const newCostData: CostTrendData = {
        ...EMPTY_COST_TREND_DATA,
        totalCost: 2.50,
        avgCostPerHour: 0.25,
        avgCostPerTask: 0.0125,
      }

      // Create updated props
      const updatedProps: PerformanceMetricsPanelProps = {
        tokenUsageData: newTokenData,
        taskCompletionData: newTaskData,
        costTrendData: newCostData,
        timeRange: '24h',
        onTimeRangeChange: () => {},
        loading: false,
      }

      expect(updatedProps.tokenUsageData.totalTokens).toBe(50000)
      expect(updatedProps.taskCompletionData.overallCompletionRate).toBe(0.95)
      expect(updatedProps.costTrendData.totalCost).toBe(2.50)
    })

    it('should handle formatted display values', () => {
      const metrics = {
        tokens: 1234567,
        cost: 1.234567,
        percentage: 85.67,
        duration: 125000, // 2 minutes 5 seconds
      }

      expect(formatTokenCount(metrics.tokens)).toBe('1.23M')
      expect(formatCost(metrics.cost)).toBe('$1.23')
      expect(formatPercentage(metrics.percentage)).toBe('85.7%')
      expect(formatDuration(metrics.duration)).toBe('2.1m')
    })

    it('should handle edge cases in production scenarios', () => {
      // Very high usage scenario
      const highUsageData: TokenUsageOverTimeData = {
        ...EMPTY_TOKEN_USAGE_DATA,
        totalTokens: 100000000, // 100M tokens
        totalCost: 1000.00, // $1000
        cacheHitRate: 0.95,
        peakTokensPerMinute: 50000,
      }

      expect(formatTokenCount(highUsageData.totalTokens)).toBe('100.00M')
      expect(formatCost(highUsageData.totalCost)).toBe('$1000.00')
      expect(formatPercentage(highUsageData.cacheHitRate * 100)).toBe('95.0%')

      // Very low usage scenario
      const lowUsageData: CostTrendData = {
        ...EMPTY_COST_TREND_DATA,
        totalCost: 0.00001, // Minimal cost
        avgCostPerHour: 0.000005,
      }

      expect(formatCost(lowUsageData.totalCost)).toBe('<$0.0001')
      expect(formatCost(lowUsageData.avgCostPerHour)).toBe('<$0.0001')
    })
  })
})