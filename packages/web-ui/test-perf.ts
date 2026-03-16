import type { TaskStatus } from '@apexcli/core'
import type { 
  PerformanceMetricData,
  TokenUsageOverTimeData,
  TaskCompletionRateData,
  CostTrendData,
  PerformanceMetricsTimeRange,
  PerformanceMetricsPanelProps,
  TaskStatusCounts
} from './src/types/performance-metrics'

// Test type usage
const data: PerformanceMetricData = {
  metricId: 'test',
  name: 'Test Metric',
  unit: 'tokens',
  data: [],
  aggregates: { min: 0, max: 0, avg: 0, sum: 0, count: 0 },
  timeRange: '24h',
  generatedAt: new Date()
}

const statusCounts: TaskStatusCounts = {
  completed: 10,
  failed: 2,
  inProgress: 3,
  pending: 5,
  cancelled: 0,
  paused: 1,
}

const status: TaskStatus = 'completed'
console.log(data, statusCounts, status)
