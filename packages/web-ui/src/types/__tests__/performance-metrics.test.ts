import { describe, it, expect } from 'vitest'
import type {
  // Core types
  PerformanceMetricsTimeRange,
  PerformanceMetricDataPoint,
  MetricAggregates,
  PerformanceMetricData,

  // Token usage types
  TokenTypeBreakdown,
  TokenUsageDataPoint,
  TokenUsageOverTimeData,

  // Task completion types
  TaskStatusCounts,
  TaskCompletionDataPoint,
  TaskCompletionRateData,

  // Cost trend types
  CostBreakdown,
  CostTrendDataPoint,
  CostTrendData,

  // Component props
  PerformanceMetricsPanelProps,
  TokenUsageOverTimeChartProps,
  TaskCompletionRateChartProps,
  CostTrendChartProps,
  MetricSummaryCardProps,

  // Chart configuration
  PerformanceChartVariant,
  PerformanceChartColorScheme,
  PerformanceChartSizeConfig,
} from '../performance-metrics'

import {
  // Utility functions
  formatCost,
  formatTokenCount,
  formatPercentage,
  formatDuration,
  calculateTrend,
  calculateChangePercent,
  getTimeRangeLabel,
  getTimeRangeOptions,

  // Constants and defaults
  TIME_RANGE_CONFIGS,
  EMPTY_TOKEN_USAGE_DATA,
  EMPTY_TASK_COMPLETION_DATA,
  EMPTY_COST_TREND_DATA,
  EMPTY_AGGREGATED_METRICS,
  DEFAULT_PERFORMANCE_CHART_COLORS,
  PERFORMANCE_CHART_SIZES,
  DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS,
} from '../performance-metrics'

// Mock data factories for testing
const createMockTokenTypeBreakdown = (overrides: Partial<TokenTypeBreakdown> = {}): TokenTypeBreakdown => ({
  inputTokens: 1000,
  outputTokens: 500,
  cacheCreationTokens: 100,
  cacheReadTokens: 50,
  ...overrides,
})

const createMockTokenUsageDataPoint = (overrides: Partial<TokenUsageDataPoint> = {}): TokenUsageDataPoint => ({
  timestamp: new Date('2024-01-01T00:00:00Z'),
  totalTokens: 1650,
  breakdown: createMockTokenTypeBreakdown(),
  tokensPerMinute: 82.5,
  cost: 0.015,
  ...overrides,
})

const createMockTaskStatusCounts = (overrides: Partial<TaskStatusCounts> = {}): TaskStatusCounts => ({
  completed: 85,
  failed: 5,
  inProgress: 8,
  pending: 2,
  cancelled: 1,
  paused: 0,
  ...overrides,
})

const createMockTaskCompletionDataPoint = (overrides: Partial<TaskCompletionDataPoint> = {}): TaskCompletionDataPoint => ({
  timestamp: new Date('2024-01-01T00:00:00Z'),
  completionRate: 0.85,
  successRate: 0.94,
  counts: createMockTaskStatusCounts(),
  ...overrides,
})

const createMockCostBreakdown = (overrides: Partial<CostBreakdown> = {}): CostBreakdown => ({
  inputTokenCost: 0.008,
  outputTokenCost: 0.006,
  cacheCreationCost: 0.001,
  cacheReadCost: 0.0005,
  otherCost: 0.0005,
  ...overrides,
})

const createMockCostTrendDataPoint = (overrides: Partial<CostTrendDataPoint> = {}): CostTrendDataPoint => ({
  timestamp: new Date('2024-01-01T00:00:00Z'),
  cost: 0.016,
  breakdown: createMockCostBreakdown(),
  cumulativeCost: 1.25,
  projectedCost: 0.018,
  ...overrides,
})

const createMockMetricAggregates = (overrides: Partial<MetricAggregates> = {}): MetricAggregates => ({
  min: 10,
  max: 100,
  avg: 55,
  sum: 550,
  count: 10,
  stdDev: 15.5,
  p95: 90,
  ...overrides,
})

const createMockPerformanceMetricData = (overrides: Partial<PerformanceMetricData> = {}): PerformanceMetricData => ({
  dataPoints: [
    { timestamp: new Date('2024-01-01T00:00:00Z'), value: 50, label: 'Point 1' },
    { timestamp: new Date('2024-01-01T01:00:00Z'), value: 75, label: 'Point 2' },
  ],
  aggregates: createMockMetricAggregates(),
  trend: 1,
  changePercent: 12.5,
  lastUpdated: new Date('2024-01-01T01:00:00Z'),
  ...overrides,
})

describe('Performance Metrics Types', () => {
  describe('Core Types', () => {
    describe('PerformanceMetricsTimeRange', () => {
      it('should include all expected time range values', () => {
        const timeRanges: PerformanceMetricsTimeRange[] = ['1h', '6h', '24h', '7d', '30d']
        expect(timeRanges).toHaveLength(5)

        // Test that each time range is a valid string literal
        timeRanges.forEach(range => {
          expect(typeof range).toBe('string')
          expect(['1h', '6h', '24h', '7d', '30d']).toContain(range)
        })
      })
    })

    describe('PerformanceMetricDataPoint', () => {
      it('should have all required fields with correct types', () => {
        const dataPoint: PerformanceMetricDataPoint = {
          timestamp: new Date(),
          value: 42,
        }

        expect(dataPoint.timestamp).toBeInstanceOf(Date)
        expect(typeof dataPoint.value).toBe('number')
      })

      it('should support optional fields', () => {
        const dataPoint: PerformanceMetricDataPoint = {
          timestamp: new Date(),
          value: 42,
          label: 'Test Point',
          metadata: { category: 'test' },
        }

        expect(typeof dataPoint.label).toBe('string')
        expect(typeof dataPoint.metadata).toBe('object')
      })
    })

    describe('MetricAggregates', () => {
      it('should have all required statistical fields', () => {
        const aggregates = createMockMetricAggregates()

        expect(typeof aggregates.min).toBe('number')
        expect(typeof aggregates.max).toBe('number')
        expect(typeof aggregates.avg).toBe('number')
        expect(typeof aggregates.sum).toBe('number')
        expect(typeof aggregates.count).toBe('number')
        expect(typeof aggregates.stdDev).toBe('number')
        expect(typeof aggregates.p95).toBe('number')
      })
    })

    describe('PerformanceMetricData', () => {
      it('should have all required fields with correct types', () => {
        const metricData = createMockPerformanceMetricData()

        expect(Array.isArray(metricData.dataPoints)).toBe(true)
        expect(typeof metricData.aggregates).toBe('object')
        expect(typeof metricData.trend).toBe('number')
        expect(typeof metricData.changePercent).toBe('number')
        expect(metricData.lastUpdated).toBeInstanceOf(Date)
      })
    })
  })

  describe('Token Usage Types', () => {
    describe('TokenTypeBreakdown', () => {
      it('should have all token type fields with correct types', () => {
        const breakdown = createMockTokenTypeBreakdown()

        expect(typeof breakdown.inputTokens).toBe('number')
        expect(typeof breakdown.outputTokens).toBe('number')
        expect(typeof breakdown.cacheCreationTokens).toBe('number')
        expect(typeof breakdown.cacheReadTokens).toBe('number')
      })

      it('should support zero values', () => {
        const breakdown = createMockTokenTypeBreakdown({
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        })

        expect(breakdown.inputTokens).toBe(0)
        expect(breakdown.outputTokens).toBe(0)
        expect(breakdown.cacheCreationTokens).toBe(0)
        expect(breakdown.cacheReadTokens).toBe(0)
      })
    })

    describe('TokenUsageDataPoint', () => {
      it('should have all required fields with correct types', () => {
        const dataPoint = createMockTokenUsageDataPoint()

        expect(dataPoint.timestamp).toBeInstanceOf(Date)
        expect(typeof dataPoint.totalTokens).toBe('number')
        expect(typeof dataPoint.breakdown).toBe('object')
        expect(typeof dataPoint.tokensPerMinute).toBe('number')
        expect(typeof dataPoint.cost).toBe('number')
      })
    })

    describe('TokenUsageOverTimeData', () => {
      it('should extend PerformanceMetricData with token-specific aggregates', () => {
        const tokenData: TokenUsageOverTimeData = {
          ...createMockPerformanceMetricData(),
          totalInputTokens: 10000,
          totalOutputTokens: 5000,
          cacheHitRate: 0.25,
          avgTokensPerMinute: 82.5,
          peakTokensPerMinute: 150,
          totalCost: 1.25,
        }

        expect(typeof tokenData.totalInputTokens).toBe('number')
        expect(typeof tokenData.totalOutputTokens).toBe('number')
        expect(typeof tokenData.cacheHitRate).toBe('number')
        expect(typeof tokenData.avgTokensPerMinute).toBe('number')
        expect(typeof tokenData.peakTokensPerMinute).toBe('number')
        expect(typeof tokenData.totalCost).toBe('number')
      })
    })
  })

  describe('Task Completion Types', () => {
    describe('TaskStatusCounts', () => {
      it('should have all task status fields with correct types', () => {
        const counts = createMockTaskStatusCounts()

        expect(typeof counts.completed).toBe('number')
        expect(typeof counts.failed).toBe('number')
        expect(typeof counts.inProgress).toBe('number')
        expect(typeof counts.pending).toBe('number')
        expect(typeof counts.cancelled).toBe('number')
        expect(typeof counts.paused).toBe('number')
      })
    })

    describe('TaskCompletionDataPoint', () => {
      it('should have all required fields with correct types', () => {
        const dataPoint = createMockTaskCompletionDataPoint()

        expect(dataPoint.timestamp).toBeInstanceOf(Date)
        expect(typeof dataPoint.completionRate).toBe('number')
        expect(typeof dataPoint.successRate).toBe('number')
        expect(typeof dataPoint.counts).toBe('object')
      })
    })

    describe('TaskCompletionRateData', () => {
      it('should extend PerformanceMetricData with task-specific aggregates', () => {
        const taskData: TaskCompletionRateData = {
          ...createMockPerformanceMetricData(),
          overallCompletionRate: 0.85,
          overallSuccessRate: 0.94,
          avgDurationMs: 5000,
          medianDurationMs: 4500,
          p95DurationMs: 12000,
        }

        expect(typeof taskData.overallCompletionRate).toBe('number')
        expect(typeof taskData.overallSuccessRate).toBe('number')
        expect(typeof taskData.avgDurationMs).toBe('number')
        expect(typeof taskData.medianDurationMs).toBe('number')
        expect(typeof taskData.p95DurationMs).toBe('number')
      })
    })
  })

  describe('Cost Trend Types', () => {
    describe('CostBreakdown', () => {
      it('should have all cost breakdown fields with correct types', () => {
        const breakdown = createMockCostBreakdown()

        expect(typeof breakdown.inputTokenCost).toBe('number')
        expect(typeof breakdown.outputTokenCost).toBe('number')
        expect(typeof breakdown.cacheCreationCost).toBe('number')
        expect(typeof breakdown.cacheReadCost).toBe('number')
        expect(typeof breakdown.otherCost).toBe('number')
      })
    })

    describe('CostTrendDataPoint', () => {
      it('should have all required fields with correct types', () => {
        const dataPoint = createMockCostTrendDataPoint()

        expect(dataPoint.timestamp).toBeInstanceOf(Date)
        expect(typeof dataPoint.cost).toBe('number')
        expect(typeof dataPoint.breakdown).toBe('object')
        expect(typeof dataPoint.cumulativeCost).toBe('number')
        expect(typeof dataPoint.projectedCost).toBe('number')
      })
    })

    describe('CostTrendData', () => {
      it('should extend PerformanceMetricData with cost-specific aggregates', () => {
        const costData: CostTrendData = {
          ...createMockPerformanceMetricData(),
          totalCost: 25.50,
          avgCostPerHour: 1.25,
          peakCostPerHour: 2.10,
          budgetLimit: 100.00,
          budgetUtilization: 0.255,
          projectedMonthlyCost: 37.50,
          projectedRemainingCost: 74.50,
        }

        expect(typeof costData.totalCost).toBe('number')
        expect(typeof costData.avgCostPerHour).toBe('number')
        expect(typeof costData.peakCostPerHour).toBe('number')
        expect(typeof costData.budgetLimit).toBe('number')
        expect(typeof costData.budgetUtilization).toBe('number')
        expect(typeof costData.projectedMonthlyCost).toBe('number')
        expect(typeof costData.projectedRemainingCost).toBe('number')
      })
    })
  })

  describe('Chart Configuration Types', () => {
    describe('PerformanceChartVariant', () => {
      it('should include all expected chart variant values', () => {
        const variants: PerformanceChartVariant[] = ['line', 'area', 'bar', 'stacked-bar']
        expect(variants).toHaveLength(4)

        variants.forEach(variant => {
          expect(typeof variant).toBe('string')
          expect(['line', 'area', 'bar', 'stacked-bar']).toContain(variant)
        })
      })
    })

    describe('PerformanceChartColorScheme', () => {
      it('should have all required color fields with correct types', () => {
        const colorScheme: PerformanceChartColorScheme = {
          primary: '#3b82f6',
          secondary: '#8b5cf6',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          grid: '#374151',
          text: '#111827',
          background: '#ffffff',
          tokens: {
            input: '#3b82f6',
            output: '#8b5cf6',
            cacheCreation: '#22c55e',
            cacheRead: '#f59e0b',
          },
        }

        expect(typeof colorScheme.primary).toBe('string')
        expect(typeof colorScheme.secondary).toBe('string')
        expect(typeof colorScheme.success).toBe('string')
        expect(typeof colorScheme.warning).toBe('string')
        expect(typeof colorScheme.danger).toBe('string')
        expect(typeof colorScheme.grid).toBe('string')
        expect(typeof colorScheme.text).toBe('string')
        expect(typeof colorScheme.background).toBe('string')
        expect(typeof colorScheme.tokens).toBe('object')
        expect(typeof colorScheme.tokens.input).toBe('string')
        expect(typeof colorScheme.tokens.output).toBe('string')
        expect(typeof colorScheme.tokens.cacheCreation).toBe('string')
        expect(typeof colorScheme.tokens.cacheRead).toBe('string')
      })
    })

    describe('PerformanceChartSizeConfig', () => {
      it('should have all required size fields with correct types', () => {
        const sizeConfig: PerformanceChartSizeConfig = {
          width: 800,
          height: 400,
          margin: { top: 20, right: 20, bottom: 20, left: 40 },
        }

        expect(typeof sizeConfig.width).toBe('number')
        expect(typeof sizeConfig.height).toBe('number')
        expect(typeof sizeConfig.margin).toBe('object')
        expect(typeof sizeConfig.margin.top).toBe('number')
        expect(typeof sizeConfig.margin.right).toBe('number')
        expect(typeof sizeConfig.margin.bottom).toBe('number')
        expect(typeof sizeConfig.margin.left).toBe('number')
      })
    })
  })

  describe('Component Props Types', () => {
    describe('PerformanceMetricsPanelProps', () => {
      it('should have all required fields with correct types', () => {
        const props: PerformanceMetricsPanelProps = {
          tokenUsageData: EMPTY_TOKEN_USAGE_DATA,
          taskCompletionData: EMPTY_TASK_COMPLETION_DATA,
          costTrendData: EMPTY_COST_TREND_DATA,
          timeRange: '24h',
          onTimeRangeChange: () => {},
        }

        expect(typeof props.tokenUsageData).toBe('object')
        expect(typeof props.taskCompletionData).toBe('object')
        expect(typeof props.costTrendData).toBe('object')
        expect(typeof props.timeRange).toBe('string')
        expect(typeof props.onTimeRangeChange).toBe('function')
      })

      it('should support all optional fields', () => {
        const props: PerformanceMetricsPanelProps = {
          tokenUsageData: EMPTY_TOKEN_USAGE_DATA,
          taskCompletionData: EMPTY_TASK_COMPLETION_DATA,
          costTrendData: EMPTY_COST_TREND_DATA,
          timeRange: '24h',
          onTimeRangeChange: () => {},
          loading: true,
          error: 'Test error',
          onRefresh: () => {},
          className: 'test-class',
          showExportButton: true,
          onExport: () => {},
          chartVariant: 'line',
          colorScheme: DEFAULT_PERFORMANCE_CHART_COLORS,
          size: 'md',
        }

        expect(typeof props.loading).toBe('boolean')
        expect(typeof props.error).toBe('string')
        expect(typeof props.onRefresh).toBe('function')
        expect(typeof props.className).toBe('string')
        expect(typeof props.showExportButton).toBe('boolean')
        expect(typeof props.onExport).toBe('function')
        expect(typeof props.chartVariant).toBe('string')
        expect(typeof props.colorScheme).toBe('object')
        expect(typeof props.size).toBe('string')
      })
    })

    describe('Component Chart Props', () => {
      it('should have correct types for TokenUsageOverTimeChartProps', () => {
        const props: TokenUsageOverTimeChartProps = {
          data: EMPTY_TOKEN_USAGE_DATA,
          variant: 'line',
        }

        expect(typeof props.data).toBe('object')
        expect(typeof props.variant).toBe('string')
      })

      it('should have correct types for TaskCompletionRateChartProps', () => {
        const props: TaskCompletionRateChartProps = {
          data: EMPTY_TASK_COMPLETION_DATA,
          variant: 'area',
        }

        expect(typeof props.data).toBe('object')
        expect(typeof props.variant).toBe('string')
      })

      it('should have correct types for CostTrendChartProps', () => {
        const props: CostTrendChartProps = {
          data: EMPTY_COST_TREND_DATA,
          variant: 'bar',
        }

        expect(typeof props.data).toBe('object')
        expect(typeof props.variant).toBe('string')
      })

      it('should have correct types for MetricSummaryCardProps', () => {
        const props: MetricSummaryCardProps = {
          title: 'Test Metric',
          value: '1,234',
          change: '+12.5%',
          trend: 1,
        }

        expect(typeof props.title).toBe('string')
        expect(typeof props.value).toBe('string')
        expect(typeof props.change).toBe('string')
        expect(typeof props.trend).toBe('number')
      })
    })
  })
})

describe('Utility Functions', () => {
  describe('formatCost', () => {
    it('should format cost values correctly', () => {
      expect(formatCost(0)).toBe('<$0.0001')
      expect(formatCost(1.234)).toBe('$1.23')
      expect(formatCost(1.236)).toBe('$1.24')
      expect(formatCost(0.001)).toBe('$0.0010')
      expect(formatCost(0.00005)).toBe('<$0.0001')
      expect(formatCost(1234.56)).toBe('$1234.56')
    })

    it('should handle edge cases', () => {
      expect(formatCost(0)).toBe('<$0.0001')
      expect(formatCost(-1.23)).toBe('<$0.0001') // Negative numbers are less than 0.0001
      expect(formatCost(0.5)).toBe('$0.5000')
      expect(formatCost(0.0002)).toBe('$0.0002')
    })
  })

  describe('formatTokenCount', () => {
    it('should format token counts with K/M notation', () => {
      expect(formatTokenCount(123)).toBe('123')
      expect(formatTokenCount(1234)).toBe('1.2K')
      expect(formatTokenCount(12345)).toBe('12.3K')
      expect(formatTokenCount(123456)).toBe('123.5K')
      expect(formatTokenCount(1234567)).toBe('1.23M')
    })

    it('should handle edge cases', () => {
      expect(formatTokenCount(0)).toBe('0')
      expect(formatTokenCount(-1000)).toBe('-1000')
      expect(formatTokenCount(999)).toBe('999')
      expect(formatTokenCount(1000)).toBe('1.0K')
      expect(formatTokenCount(1000000)).toBe('1.00M')
    })
  })

  describe('formatPercentage', () => {
    it('should format percentage values correctly', () => {
      expect(formatPercentage(12.34)).toBe('12.3%')
      expect(formatPercentage(12.36)).toBe('12.4%')
      expect(formatPercentage(100)).toBe('100.0%')
      expect(formatPercentage(0)).toBe('0.0%')
    })

    it('should handle custom decimal places', () => {
      expect(formatPercentage(12.34, 0)).toBe('12%')
      expect(formatPercentage(12.34, 2)).toBe('12.34%')
      expect(formatPercentage(12.34, 4)).toBe('12.3400%')
    })

    it('should handle edge cases', () => {
      expect(formatPercentage(0.1)).toBe('0.1%')
      expect(formatPercentage(-50)).toBe('-50.0%')
      expect(formatPercentage(123.456789)).toBe('123.5%')
    })
  })

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      expect(formatDuration(1000)).toBe('1.0s')
      expect(formatDuration(1500)).toBe('1.5s')
      expect(formatDuration(60000)).toBe('1.0m')
      expect(formatDuration(90000)).toBe('1.5m')
      expect(formatDuration(3600000)).toBe('1.0h')
      expect(formatDuration(5400000)).toBe('1.5h')
    })

    it('should handle small durations', () => {
      expect(formatDuration(100)).toBe('100ms')
      expect(formatDuration(500)).toBe('500ms')
      expect(formatDuration(999)).toBe('999ms')
    })

    it('should handle edge cases', () => {
      expect(formatDuration(0)).toBe('0ms')
      expect(formatDuration(-1000)).toBe('-1000ms')
      expect(formatDuration(50)).toBe('50ms')
    })
  })

  describe('calculateTrend', () => {
    it('should calculate trend direction correctly', () => {
      expect(calculateTrend(10, 5)).toBe(1)
      expect(calculateTrend(5, 10)).toBe(-1)
      expect(calculateTrend(10, 10)).toBe(0)
    })

    it('should handle edge cases', () => {
      expect(calculateTrend(0, 0)).toBe(0)
      expect(calculateTrend(10, 0)).toBe(1)
      expect(calculateTrend(0, 10)).toBe(-1) // -100% change
      expect(calculateTrend(105, 100)).toBe(1) // 5% change
      expect(calculateTrend(100.5, 100)).toBe(0) // 0.5% change (< 1%)
    })
  })

  describe('calculateChangePercent', () => {
    it('should calculate percentage change correctly', () => {
      expect(calculateChangePercent(10, 5)).toBeCloseTo(100, 1)
      expect(calculateChangePercent(5, 10)).toBeCloseTo(-50, 1)
      expect(calculateChangePercent(10, 10)).toBe(0)
    })

    it('should handle edge cases', () => {
      expect(calculateChangePercent(0, 0)).toBe(0)
      expect(calculateChangePercent(10, 0)).toBe(100)
      expect(calculateChangePercent(0, 10)).toBe(-100)
      expect(calculateChangePercent(15, 10)).toBeCloseTo(50, 1)
      expect(calculateChangePercent(5, 10)).toBeCloseTo(-50, 1)
    })
  })

  describe('getTimeRangeLabel', () => {
    it('should return correct labels for all time ranges', () => {
      expect(getTimeRangeLabel('1h')).toBe('Last Hour')
      expect(getTimeRangeLabel('6h')).toBe('Last 6 Hours')
      expect(getTimeRangeLabel('24h')).toBe('Last 24 Hours')
      expect(getTimeRangeLabel('7d')).toBe('Last 7 Days')
      expect(getTimeRangeLabel('30d')).toBe('Last 30 Days')
    })
  })

  describe('getTimeRangeOptions', () => {
    it('should return all available time range options', () => {
      const options = getTimeRangeOptions()
      expect(options).toHaveLength(5)

      const expectedOptions = [
        { value: '1h', label: 'Last Hour' },
        { value: '6h', label: 'Last 6 Hours' },
        { value: '24h', label: 'Last 24 Hours' },
        { value: '7d', label: 'Last 7 Days' },
        { value: '30d', label: 'Last 30 Days' },
      ]

      expect(options).toEqual(expectedOptions)
    })
  })
})

describe('Constants and Defaults', () => {
  describe('TIME_RANGE_CONFIGS', () => {
    it('should have configurations for all time ranges', () => {
      const timeRanges: PerformanceMetricsTimeRange[] = ['1h', '6h', '24h', '7d', '30d']

      timeRanges.forEach(range => {
        expect(TIME_RANGE_CONFIGS).toHaveProperty(range)
        const config = TIME_RANGE_CONFIGS[range]

        expect(typeof config.intervalMs).toBe('number')
        expect(typeof config.dataPoints).toBe('number')
        expect(typeof config.value).toBe('string')
        expect(typeof config.label).toBe('string')
        expect(config.intervalMs).toBeGreaterThan(0)
        expect(config.dataPoints).toBeGreaterThan(0)
        expect(config.value).toBe(range)
      })
    })

    it('should have reasonable interval values', () => {
      // 1 hour should have intervals of 1-5 minutes (60000-300000ms)
      expect(TIME_RANGE_CONFIGS['1h'].intervalMs).toBeGreaterThanOrEqual(60000)
      expect(TIME_RANGE_CONFIGS['1h'].intervalMs).toBeLessThanOrEqual(300000)

      // 30 days should have larger intervals than 1 hour
      expect(TIME_RANGE_CONFIGS['30d'].intervalMs).toBeGreaterThan(TIME_RANGE_CONFIGS['1h'].intervalMs)
    })
  })

  describe('Empty Data Constants', () => {
    it('should have valid empty token usage data', () => {
      expect(Array.isArray(EMPTY_TOKEN_USAGE_DATA.data)).toBe(true)
      expect(EMPTY_TOKEN_USAGE_DATA.data).toHaveLength(0)
      expect(EMPTY_TOKEN_USAGE_DATA.totalInputTokens).toBe(0)
      expect(EMPTY_TOKEN_USAGE_DATA.totalOutputTokens).toBe(0)
      expect(EMPTY_TOKEN_USAGE_DATA.totalTokens).toBe(0)
      expect(EMPTY_TOKEN_USAGE_DATA.cacheHitRate).toBe(0)
      expect(EMPTY_TOKEN_USAGE_DATA.totalCost).toBe(0)
      expect(EMPTY_TOKEN_USAGE_DATA.timeRange).toBe('24h')
      expect(EMPTY_TOKEN_USAGE_DATA.generatedAt).toBeInstanceOf(Date)
    })

    it('should have valid empty task completion data', () => {
      expect(Array.isArray(EMPTY_TASK_COMPLETION_DATA.data)).toBe(true)
      expect(EMPTY_TASK_COMPLETION_DATA.data).toHaveLength(0)
      expect(EMPTY_TASK_COMPLETION_DATA.overallCompletionRate).toBe(0)
      expect(EMPTY_TASK_COMPLETION_DATA.overallSuccessRate).toBe(0)
      expect(EMPTY_TASK_COMPLETION_DATA.timeRange).toBe('24h')
      expect(EMPTY_TASK_COMPLETION_DATA.generatedAt).toBeInstanceOf(Date)
    })

    it('should have valid empty cost trend data', () => {
      expect(Array.isArray(EMPTY_COST_TREND_DATA.data)).toBe(true)
      expect(EMPTY_COST_TREND_DATA.data).toHaveLength(0)
      expect(EMPTY_COST_TREND_DATA.totalCost).toBe(0)
      expect(EMPTY_COST_TREND_DATA.avgCostPerHour).toBe(0)
      expect(EMPTY_COST_TREND_DATA.avgCostPerTask).toBe(0)
      expect(EMPTY_COST_TREND_DATA.peakHourlyCost).toBe(0)
      expect(typeof EMPTY_COST_TREND_DATA.breakdown).toBe('object')
      expect(EMPTY_COST_TREND_DATA.timeRange).toBe('24h')
      expect(EMPTY_COST_TREND_DATA.generatedAt).toBeInstanceOf(Date)
    })

    it('should have valid empty aggregated metrics', () => {
      expect(typeof EMPTY_AGGREGATED_METRICS.tokenUsage).toBe('object')
      expect(typeof EMPTY_AGGREGATED_METRICS.taskCompletion).toBe('object')
      expect(typeof EMPTY_AGGREGATED_METRICS.costTrend).toBe('object')
      expect(EMPTY_AGGREGATED_METRICS.tokenUsage.totalTokens).toBe(0)
      expect(EMPTY_AGGREGATED_METRICS.taskCompletion.overallCompletionRate).toBe(0)
      expect(EMPTY_AGGREGATED_METRICS.costTrend.totalCost).toBe(0)
    })
  })

  describe('Chart Configuration Constants', () => {
    it('should have valid default chart colors', () => {
      expect(typeof DEFAULT_PERFORMANCE_CHART_COLORS.primary).toBe('string')
      expect(typeof DEFAULT_PERFORMANCE_CHART_COLORS.secondary).toBe('string')
      expect(typeof DEFAULT_PERFORMANCE_CHART_COLORS.tokens).toBe('object')
      expect(typeof DEFAULT_PERFORMANCE_CHART_COLORS.tokens.input).toBe('string')

      // Colors should be CSS custom property names
      expect(DEFAULT_PERFORMANCE_CHART_COLORS.primary).toMatch(/^var\(--/)
      expect(DEFAULT_PERFORMANCE_CHART_COLORS.secondary).toMatch(/^var\(--/)
    })

    it('should have valid performance chart sizes', () => {
      expect(PERFORMANCE_CHART_SIZES).toHaveProperty('sm')
      expect(PERFORMANCE_CHART_SIZES).toHaveProperty('md')
      expect(PERFORMANCE_CHART_SIZES).toHaveProperty('lg')

      // Small should be smaller than medium, medium smaller than large
      expect(PERFORMANCE_CHART_SIZES.sm.height).toBeLessThan(PERFORMANCE_CHART_SIZES.md.height)
      expect(PERFORMANCE_CHART_SIZES.md.height).toBeLessThan(PERFORMANCE_CHART_SIZES.lg.height)
      expect(PERFORMANCE_CHART_SIZES.sm.labelSize).toBeLessThan(PERFORMANCE_CHART_SIZES.md.labelSize)
      expect(PERFORMANCE_CHART_SIZES.md.labelSize).toBeLessThan(PERFORMANCE_CHART_SIZES.lg.labelSize)
    })

    it('should have valid default panel props', () => {
      expect(typeof DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.timeRange).toBe('string')
      expect(DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.timeRange).toBe('24h')
      expect(typeof DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.showTimeRangeSelector).toBe('boolean')
      expect(typeof DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.showTokenUsage).toBe('boolean')
      expect(typeof DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.showTaskCompletion).toBe('boolean')
      expect(typeof DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.showCostTrend).toBe('boolean')
      expect(typeof DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.loading).toBe('boolean')
      expect(typeof DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.animated).toBe('boolean')
    })
  })
})

describe('Edge Cases and Validation', () => {
  describe('Data Consistency', () => {
    it('should handle empty data arrays gracefully', () => {
      const emptyTokenData = EMPTY_TOKEN_USAGE_DATA

      expect(Array.isArray(emptyTokenData.data)).toBe(true)
      expect(emptyTokenData.data).toHaveLength(0)
      expect(emptyTokenData.totalTokens).toBe(0)
    })

    it('should handle very large token counts', () => {
      const largeTokenData = createMockTokenUsageDataPoint({
        totalTokens: 1000000000, // 1 billion tokens
        tokensPerMinute: 10000000, // 10 million per minute
      })

      expect(largeTokenData.totalTokens).toBe(1000000000)
      expect(largeTokenData.tokensPerMinute).toBe(10000000)
    })

    it('should handle very high cost values', () => {
      const highCostData = createMockCostTrendDataPoint({
        cost: 999.99,
        cumulativeCost: 50000.00,
        projectedCost: 1200.50,
      })

      expect(highCostData.cost).toBe(999.99)
      expect(highCostData.cumulativeCost).toBe(50000.00)
      expect(highCostData.projectedCost).toBe(1200.50)
    })

    it('should handle extreme completion rates', () => {
      const extremeTaskData = createMockTaskCompletionDataPoint({
        completionRate: 1.0, // 100% completion
        successRate: 0.0, // 0% success (all completed tasks failed)
        counts: createMockTaskStatusCounts({
          completed: 100,
          failed: 100,
          inProgress: 0,
          pending: 0,
          cancelled: 0,
          paused: 0,
        }),
      })

      expect(extremeTaskData.completionRate).toBe(1.0)
      expect(extremeTaskData.successRate).toBe(0.0)
    })
  })

  describe('Date Handling', () => {
    it('should handle various date formats', () => {
      const dates = [
        new Date(),
        new Date('2024-01-01'),
        new Date('2024-12-31T23:59:59Z'),
        new Date(Date.now() - 86400000), // Yesterday
      ]

      dates.forEach(date => {
        const dataPoint = createMockTokenUsageDataPoint({ timestamp: date })
        expect(dataPoint.timestamp).toBeInstanceOf(Date)
        expect(dataPoint.timestamp.getTime()).toBe(date.getTime())
      })
    })

    it('should maintain chronological order assumptions', () => {
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 3600000)

      const dataPoints = [
        createMockTokenUsageDataPoint({ timestamp: hourAgo }),
        createMockTokenUsageDataPoint({ timestamp: now }),
      ]

      expect(dataPoints[0].timestamp.getTime()).toBeLessThan(dataPoints[1].timestamp.getTime())
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large datasets efficiently', () => {
      const startTime = performance.now()

      // Create a large dataset
      const largeDataPoints = Array.from({ length: 1000 }, (_, i) =>
        createMockTokenUsageDataPoint({
          timestamp: new Date(Date.now() - i * 60000),
          totalTokens: Math.random() * 10000,
        })
      )

      const endTime = performance.now()

      expect(largeDataPoints).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
    })

    it('should handle concurrent access patterns', () => {
      // Test that objects can be safely spread/copied
      const original = createMockTokenUsageDataPoint()
      const copy1 = { ...original }
      const copy2 = { ...original, totalTokens: 999 }

      expect(copy1.totalTokens).toBe(original.totalTokens)
      expect(copy2.totalTokens).toBe(999)
      expect(original.totalTokens).not.toBe(999) // Original unchanged
    })
  })

  describe('String Limits and Validation', () => {
    it('should handle very long metadata strings', () => {
      const longString = 'a'.repeat(1000)
      const dataPoint = createMockTokenUsageDataPoint({
        metadata: { description: longString },
      })

      expect(dataPoint.metadata?.description).toBe(longString)
      expect(dataPoint.metadata?.description.length).toBe(1000)
    })

    it('should handle special characters in labels', () => {
      const specialChars = '!@#$%^&*()_+{}|:<>?[]\\;\'",./`~'
      const dataPoint: PerformanceMetricDataPoint = {
        timestamp: new Date(),
        value: 42,
        label: specialChars,
      }

      expect(dataPoint.label).toBe(specialChars)
    })

    it('should handle unicode characters', () => {
      const unicodeLabel = '🚀 Performance Metrics 📊 成功率 🎯'
      const dataPoint: PerformanceMetricDataPoint = {
        timestamp: new Date(),
        value: 42,
        label: unicodeLabel,
      }

      expect(dataPoint.label).toBe(unicodeLabel)
    })
  })
})