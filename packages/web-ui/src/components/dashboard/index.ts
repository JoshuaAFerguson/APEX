/**
 * Dashboard Components
 *
 * Components for visualizing project health, metrics, and system status.
 *
 * @packageDocumentation
 */

export { ProjectHealthPanel } from './ProjectHealthPanel'
export type { ProjectHealthPanelProps } from '@/types/project-health'

export { HealthStatusIndicator } from './HealthStatusIndicator'
export type { HealthStatusIndicatorProps } from '@/types/project-health'

export { MetricCard } from './MetricCard'
export type { MetricCardProps } from '@/types/project-health'

// Re-export types and utilities for convenience
export type {
  ProjectHealthStatus,
  ProjectHealthMetrics,
  HealthThresholds,
  TaskStatistics,
  ConnectionDetails,
} from '@/types/project-health'

export {
  DEFAULT_HEALTH_THRESHOLDS,
  calculateProjectHealthStatus,
  mapConnectionToProjectHealth,
  formatDuration,
  formatPercentage,
  generateMockHealthMetrics,
  generateWarningMockMetrics,
  generateCriticalMockMetrics,
  STATUS_STYLES,
  STATUS_LABELS,
} from '@/types/project-health'
