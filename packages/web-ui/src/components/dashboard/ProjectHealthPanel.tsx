'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { HealthStatusIndicator } from './HealthStatusIndicator'
import { MetricCard } from './MetricCard'
import type {
  ProjectHealthPanelProps,
  ProjectHealthMetrics,
  ProjectHealthStatus,
  HealthThresholds,
} from '@/types/project-health'
import {
  DEFAULT_HEALTH_THRESHOLDS,
  calculateProjectHealthStatus,
  formatDuration,
  formatPercentage,
  STATUS_STYLES,
} from '@/types/project-health'
import { getRelativeTime } from '@/lib/utils'

/**
 * Icons for metric cards
 */
const SuccessRateIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const DurationIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const SystemHealthIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const ConnectionIcon = ({ connected }: { connected: boolean }) => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {connected ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
    )}
  </svg>
)

/**
 * Get individual metric status based on value and thresholds
 */
function getMetricStatus(
  value: number,
  warningThreshold: number,
  criticalThreshold: number,
  isHigherBetter: boolean = true
): ProjectHealthStatus {
  if (isHigherBetter) {
    if (value < criticalThreshold) return 'critical'
    if (value < warningThreshold) return 'warning'
    return 'healthy'
  } else {
    if (value > criticalThreshold) return 'critical'
    if (value > warningThreshold) return 'warning'
    return 'healthy'
  }
}

/**
 * Time range labels
 */
const TIME_RANGE_LABELS = {
  '1h': 'Last hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
} as const

/**
 * ProjectHealthPanel - Main dashboard panel for project health metrics
 *
 * Displays overall project health status with visual indicators (healthy/warning/critical),
 * along with key metrics including success rate, average duration, and system health.
 * Supports both mock data for testing and real API data via WebSocket integration.
 *
 * @example
 * ```tsx
 * // With real-time data
 * const { state } = useRealtimeUpdates({ includeHealth: true });
 * <ProjectHealthPanel metrics={transformHealthMetrics(state.health)} />
 *
 * // With mock data
 * import { generateMockHealthMetrics } from '@/types/project-health';
 * <ProjectHealthPanel metrics={generateMockHealthMetrics()} />
 * ```
 */
export const ProjectHealthPanel: React.FC<ProjectHealthPanelProps> = ({
  metrics,
  statusOverride,
  isLoading = false,
  error = null,
  timeRange = '1h',
  showDetails = false,
  showConnectionStatus = true,
  thresholds: customThresholds,
  className,
  onStatusChange,
  onRefresh,
}) => {
  // Merge custom thresholds with defaults
  const thresholds: HealthThresholds = useMemo(
    () => ({ ...DEFAULT_HEALTH_THRESHOLDS, ...customThresholds }),
    [customThresholds]
  )

  // Calculate overall status
  const status: ProjectHealthStatus = useMemo(() => {
    if (statusOverride) return statusOverride
    if (!metrics) return 'unknown'
    return calculateProjectHealthStatus(metrics, thresholds)
  }, [metrics, statusOverride, thresholds])

  // Call status change callback when status changes
  React.useEffect(() => {
    onStatusChange?.(status)
  }, [status, onStatusChange])

  // Calculate individual metric statuses
  const successRateStatus = metrics
    ? getMetricStatus(metrics.successRate, thresholds.successRateWarning, thresholds.successRateCritical, true)
    : 'unknown'

  const durationStatus = metrics
    ? getMetricStatus(metrics.averageDurationMs, thresholds.durationWarning, thresholds.durationCritical, false)
    : 'unknown'

  const systemHealthStatus = metrics
    ? getMetricStatus(metrics.systemHealth, thresholds.systemHealthWarning, thresholds.systemHealthCritical, true)
    : 'unknown'

  const statusStyles = STATUS_STYLES[status]

  // Error state
  if (error) {
    return (
      <Card className={cn('border-red-900', className)}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-400">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold">Error Loading Health Metrics</h3>
              <p className="text-sm text-red-300">{error.message}</p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 px-3 py-1.5 text-sm rounded-md bg-red-950 text-red-400 hover:bg-red-900 transition-colors"
            >
              Try Again
            </button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (isLoading && !metrics) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
            <span className="ml-3 text-foreground-secondary">Loading health metrics...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'transition-all duration-300',
        status !== 'unknown' && `border-t-4 ${statusStyles.border}`,
        className
      )}
      role="region"
      aria-label="Project Health Panel"
    >
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">Project Health</h2>
          <HealthStatusIndicator
            status={status}
            size="md"
            animated={status === 'critical'}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Time range badge */}
          <span className="px-2 py-1 text-xs rounded-md bg-background-tertiary text-foreground-secondary">
            {TIME_RANGE_LABELS[timeRange]}
          </span>

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                'hover:bg-background-tertiary text-foreground-secondary',
                isLoading && 'animate-spin'
              )}
              aria-label="Refresh health metrics"
              disabled={isLoading}
            >
              <RefreshIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>

      {/* Metrics Grid */}
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            title="Success Rate"
            value={metrics ? formatPercentage(metrics.successRate) : '--'}
            status={successRateStatus}
            icon={<SuccessRateIcon />}
            description={metrics?.tasks ? `${metrics.tasks.completedTasks} completed, ${metrics.tasks.failedTasks} failed` : undefined}
          />

          <MetricCard
            title="Avg Duration"
            value={metrics ? formatDuration(metrics.averageDurationMs) : '--'}
            status={durationStatus}
            icon={<DurationIcon />}
            description={metrics?.tasks ? `${metrics.tasks.activeTasks} active tasks` : undefined}
          />

          <MetricCard
            title="System Health"
            value={metrics ? formatPercentage(metrics.systemHealth) : '--'}
            status={systemHealthStatus}
            icon={<SystemHealthIcon />}
            description={metrics?.connection ? `${metrics.connection.latencyMs}ms latency` : undefined}
          />
        </div>

        {/* Detailed task breakdown (optional) */}
        {showDetails && metrics?.tasks && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground-secondary mb-3">Task Breakdown</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-background-tertiary">
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {metrics.tasks.activeTasks}
                </div>
                <div className="text-xs text-foreground-secondary">Active</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background-tertiary">
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {metrics.tasks.pendingTasks}
                </div>
                <div className="text-xs text-foreground-secondary">Pending</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background-tertiary">
                <div className="text-xl font-bold text-green-400 tabular-nums">
                  {metrics.tasks.completedTasks}
                </div>
                <div className="text-xs text-foreground-secondary">Completed</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-background-tertiary">
                <div className="text-xl font-bold text-red-400 tabular-nums">
                  {metrics.tasks.failedTasks}
                </div>
                <div className="text-xs text-foreground-secondary">Failed</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer with connection status and last updated */}
      <CardFooter className="flex items-center justify-between pt-0 text-xs text-foreground-secondary">
        {/* Connection status */}
        {showConnectionStatus && metrics?.connection && (
          <div className="flex items-center gap-1.5">
            <ConnectionIcon connected={metrics.connection.isConnected} />
            <span>
              {metrics.connection.isConnected
                ? `Connected (${metrics.connection.latencyMs}ms)`
                : `Disconnected (${metrics.connection.reconnectAttempts} attempts)`
              }
            </span>
          </div>
        )}

        {/* Last updated */}
        {metrics?.lastUpdated && (
          <span>
            Updated {getRelativeTime(metrics.lastUpdated)}
          </span>
        )}
      </CardFooter>
    </Card>
  )
}

ProjectHealthPanel.displayName = 'ProjectHealthPanel'

export default ProjectHealthPanel
