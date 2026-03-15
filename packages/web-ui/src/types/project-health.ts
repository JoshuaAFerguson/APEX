/**
 * Project Health Types
 *
 * Type definitions for the ProjectHealthPanel component and related
 * health metrics visualization components.
 *
 * @packageDocumentation
 */

import type React from 'react'
import type { ConnectionHealthStatus } from './dashboard'

/**
 * Health status levels for project health
 * Compatible with existing ConnectionHealthStatus but with 'critical' instead of 'unhealthy'
 */
export type ProjectHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

/**
 * Map ConnectionHealthStatus to ProjectHealthStatus
 */
export function mapConnectionToProjectHealth(status: ConnectionHealthStatus): ProjectHealthStatus {
  switch (status) {
    case 'healthy':
      return 'healthy'
    case 'degraded':
      return 'warning'
    case 'unhealthy':
      return 'critical'
    case 'unknown':
    default:
      return 'unknown'
  }
}

/**
 * Detailed task statistics for health metrics
 */
export interface TaskStatistics {
  /** Number of active/running tasks */
  activeTasks: number
  /** Number of pending tasks */
  pendingTasks: number
  /** Number of completed tasks in the time window */
  completedTasks: number
  /** Number of failed tasks in the time window */
  failedTasks: number
}

/**
 * Connection details for health metrics
 */
export interface ConnectionDetails {
  /** Whether connected to the server */
  isConnected: boolean
  /** Current latency in milliseconds */
  latencyMs: number
  /** Average latency over the session */
  averageLatencyMs: number
  /** Number of reconnection attempts */
  reconnectAttempts: number
  /** Time since last successful connection */
  connectedSince?: Date
}

/**
 * Project health metrics data structure
 * Designed to work with both mock data and real API data
 */
export interface ProjectHealthMetrics {
  /** Overall project health status */
  status: ProjectHealthStatus
  /** Success rate percentage (0-100) */
  successRate: number
  /** Average task duration in milliseconds */
  averageDurationMs: number
  /** System health percentage (0-100) */
  systemHealth: number
  /** Task statistics breakdown */
  tasks?: TaskStatistics
  /** Connection details */
  connection?: ConnectionDetails
  /** Timestamp when metrics were last updated */
  lastUpdated: Date
}

/**
 * Threshold configuration for health status determination
 */
export interface HealthThresholds {
  /** Success rate below this triggers warning (default: 90) */
  successRateWarning: number
  /** Success rate below this triggers critical (default: 70) */
  successRateCritical: number
  /** System health below this triggers warning (default: 85) */
  systemHealthWarning: number
  /** System health below this triggers critical (default: 60) */
  systemHealthCritical: number
  /** Average duration above this triggers warning in ms (default: 5000) */
  durationWarning: number
  /** Average duration above this triggers critical in ms (default: 15000) */
  durationCritical: number
}

/**
 * Default health thresholds
 */
export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  successRateWarning: 90,
  successRateCritical: 70,
  systemHealthWarning: 85,
  systemHealthCritical: 60,
  durationWarning: 5000,
  durationCritical: 15000,
}

/**
 * Calculate health status from metrics using thresholds
 */
export function calculateProjectHealthStatus(
  metrics: Pick<ProjectHealthMetrics, 'successRate' | 'systemHealth' | 'averageDurationMs'>,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS
): ProjectHealthStatus {
  // Check for critical conditions first
  if (
    metrics.successRate < thresholds.successRateCritical ||
    metrics.systemHealth < thresholds.systemHealthCritical ||
    metrics.averageDurationMs > thresholds.durationCritical
  ) {
    return 'critical'
  }

  // Check for warning conditions
  if (
    metrics.successRate < thresholds.successRateWarning ||
    metrics.systemHealth < thresholds.systemHealthWarning ||
    metrics.averageDurationMs > thresholds.durationWarning
  ) {
    return 'warning'
  }

  return 'healthy'
}

/**
 * Props for the ProjectHealthPanel component
 */
export interface ProjectHealthPanelProps {
  /** Health metrics data (can be real API or mock) */
  metrics?: ProjectHealthMetrics
  /** Override the calculated health status */
  statusOverride?: ProjectHealthStatus
  /** Whether to show loading state */
  isLoading?: boolean
  /** Error state for display */
  error?: Error | null
  /** Time range label for display */
  timeRange?: '1h' | '6h' | '24h' | '7d'
  /** Whether to show detailed metrics */
  showDetails?: boolean
  /** Whether to show connection status */
  showConnectionStatus?: boolean
  /** Custom thresholds for status calculation */
  thresholds?: Partial<HealthThresholds>
  /** Custom className for styling */
  className?: string
  /** Callback when status changes */
  onStatusChange?: (status: ProjectHealthStatus) => void
  /** Callback when refresh is requested */
  onRefresh?: () => void
}

/**
 * Props for the HealthStatusIndicator component
 */
export interface HealthStatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Health status to display */
  status: ProjectHealthStatus
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Whether to show the status label */
  showLabel?: boolean
  /** Whether to animate the indicator */
  animated?: boolean
  /** Custom className for styling */
  className?: string
}

/**
 * Props for the MetricCard component
 */
export interface MetricCardProps {
  /** Metric title/label */
  title: string
  /** Primary value to display */
  value: string | number
  /** Unit suffix (e.g., '%', 'ms') */
  unit?: string
  /** Status indicator for this specific metric */
  status?: ProjectHealthStatus
  /** Additional description text */
  description?: string
  /** Icon to display (React node) */
  icon?: React.ReactNode
  /** Trend indicator (-1, 0, 1 for down, neutral, up) */
  trend?: -1 | 0 | 1
  /** Custom className for styling */
  className?: string
}

/**
 * Status-related style mappings
 */
export const STATUS_STYLES = {
  healthy: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    border: 'border-green-900',
    icon: 'text-green-500',
    glow: 'shadow-green-500/20',
  },
  warning: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-900',
    icon: 'text-yellow-500',
    glow: 'shadow-yellow-500/20',
  },
  critical: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    glow: 'shadow-red-500/20',
  },
  unknown: {
    bg: 'bg-background-tertiary',
    text: 'text-foreground-secondary',
    border: 'border-border-secondary',
    icon: 'text-foreground-secondary',
    glow: 'shadow-none',
  },
} as const

/**
 * Status labels for display
 */
export const STATUS_LABELS: Record<ProjectHealthStatus, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  unknown: 'Unknown',
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`
  }
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Mock data generator for testing
 */
export function generateMockHealthMetrics(
  overrides?: Partial<ProjectHealthMetrics>
): ProjectHealthMetrics {
  const baseMetrics: ProjectHealthMetrics = {
    status: 'healthy',
    successRate: 95.5,
    averageDurationMs: 2500,
    systemHealth: 92.0,
    tasks: {
      activeTasks: 3,
      pendingTasks: 5,
      completedTasks: 47,
      failedTasks: 2,
    },
    connection: {
      isConnected: true,
      latencyMs: 45,
      averageLatencyMs: 52,
      reconnectAttempts: 0,
      connectedSince: new Date(Date.now() - 3600000), // 1 hour ago
    },
    lastUpdated: new Date(),
  }

  return { ...baseMetrics, ...overrides }
}

/**
 * Create warning scenario mock data
 */
export function generateWarningMockMetrics(): ProjectHealthMetrics {
  return generateMockHealthMetrics({
    status: 'warning',
    successRate: 82.0,
    averageDurationMs: 6500,
    systemHealth: 78.0,
    tasks: {
      activeTasks: 8,
      pendingTasks: 12,
      completedTasks: 35,
      failedTasks: 8,
    },
    connection: {
      isConnected: true,
      latencyMs: 650,
      averageLatencyMs: 520,
      reconnectAttempts: 2,
      connectedSince: new Date(Date.now() - 1800000), // 30 min ago
    },
  })
}

/**
 * Create critical scenario mock data
 */
export function generateCriticalMockMetrics(): ProjectHealthMetrics {
  return generateMockHealthMetrics({
    status: 'critical',
    successRate: 55.0,
    averageDurationMs: 18000,
    systemHealth: 45.0,
    tasks: {
      activeTasks: 2,
      pendingTasks: 25,
      completedTasks: 20,
      failedTasks: 18,
    },
    connection: {
      isConnected: false,
      latencyMs: 0,
      averageLatencyMs: 2500,
      reconnectAttempts: 5,
    },
  })
}
