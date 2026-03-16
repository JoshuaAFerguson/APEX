'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AgentUtilizationChart } from '@/components/charts/AgentUtilizationChart'
import { useAgentMetrics } from '@/hooks/useAgentMetrics'
import { cn } from '@/lib/utils'
import { RefreshCw, AlertTriangle, Users } from 'lucide-react'
import type {
  AgentUtilizationData,
  AgentUtilizationChartProps,
  AgentUtilization,
} from '@/types/agent-utilization'
import type { AgentMetrics } from '@/types/agent-metrics'

/**
 * Props for the AgentUtilizationWidget dashboard component
 */
export interface AgentUtilizationWidgetProps {
  /** Maximum number of agents to display */
  maxAgents?: number
  /** Chart height in pixels */
  height?: number
  /** Custom class name */
  className?: string
  /** Callback when refresh is requested */
  onRefresh?: () => void
  /** Whether to show cost information */
  showCost?: boolean
  /** Whether to show performance metrics */
  showPerformance?: boolean
  /** Whether to show token breakdown */
  showTokenBreakdown?: boolean
  /** Callback when an agent is clicked */
  onAgentClick?: (agent: AgentUtilization) => void
}

/**
 * Default props for AgentUtilizationWidget
 */
const DEFAULT_PROPS: Required<Omit<AgentUtilizationWidgetProps, 'onRefresh' | 'onAgentClick'>> = {
  maxAgents: 6,
  height: 300,
  className: '',
  showCost: true,
  showPerformance: false,
  showTokenBreakdown: true,
}

/**
 * Transform AgentMetrics to AgentUtilizationData
 */
function transformToUtilizationData(metrics: AgentMetrics): AgentUtilizationData {
  const agents: AgentUtilization[] = metrics.agents.map(agent => ({
    agentId: agent.agentId,
    agentName: agent.agentName,
    inputTokens: agent.inputTokens || 0,
    outputTokens: agent.outputTokens || 0,
    totalTokens: agent.totalTokens || 0,
    estimatedCost: agent.estimatedCost || 0,
    tokensPerSecond: agent.tokensPerSecond || 0,
    duration: agent.duration || 0,
    invocations: agent.invocations || 0,
    cacheTokens: agent.cacheTokens,
    avgLatencyMs: agent.avgLatencyMs,
  }))

  // Calculate aggregate totals
  const totalInputTokens = agents.reduce((sum, agent) => sum + agent.inputTokens, 0)
  const totalOutputTokens = agents.reduce((sum, agent) => sum + agent.outputTokens, 0)
  const totalTokens = agents.reduce((sum, agent) => sum + agent.totalTokens, 0)
  const totalEstimatedCost = agents.reduce((sum, agent) => sum + agent.estimatedCost, 0)
  const totalDuration = agents.reduce((sum, agent) => sum + agent.duration, 0)
  const avgTokensPerSecond = agents.length > 0
    ? agents.reduce((sum, agent) => sum + agent.tokensPerSecond, 0) / agents.length
    : 0

  return {
    agents,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalEstimatedCost,
    totalDuration,
    avgTokensPerSecond,
    lastUpdated: metrics.lastUpdated,
  }
}

/**
 * AgentUtilizationWidget - Dashboard component for real-time agent utilization monitoring
 *
 * Wraps the AgentUtilizationChart component in a Card with real-time data updates
 * from the useAgentMetrics hook. Shows per-agent token usage, cost, and performance.
 *
 * Features:
 * - Real-time agent metrics via WebSocket
 * - Responsive design with configurable chart height
 * - Error and loading states
 * - Connection status indicator
 * - Manual refresh capability
 * - Agent click handlers for navigation
 */
export function AgentUtilizationWidget({
  maxAgents = DEFAULT_PROPS.maxAgents,
  height = DEFAULT_PROPS.height,
  className = DEFAULT_PROPS.className,
  onRefresh,
  showCost = DEFAULT_PROPS.showCost,
  showPerformance = DEFAULT_PROPS.showPerformance,
  showTokenBreakdown = DEFAULT_PROPS.showTokenBreakdown,
  onAgentClick,
}: AgentUtilizationWidgetProps) {
  // State for manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Agent metrics hook
  const { metrics, connectionStatus, isLoading, error, refresh } = useAgentMetrics({
    autoConnect: true,
    pollingIntervalMs: 0, // Use real-time updates only
  })

  // Transform metrics to chart data
  const chartData = useMemo(() => {
    return transformToUtilizationData(metrics)
  }, [metrics])

  // Calculate summary statistics
  const summary = useMemo(() => {
    const { agents, totalTokens, totalEstimatedCost } = chartData
    const activeAgents = agents.filter(agent => agent.totalTokens > 0)

    const topAgent = activeAgents.length > 0
      ? activeAgents.reduce((max, agent) =>
          agent.totalTokens > max.totalTokens ? agent : max, activeAgents[0])
      : null

    return {
      agentCount: agents.length,
      activeAgentCount: activeAgents.length,
      topAgent: topAgent ? {
        name: topAgent.agentName,
        tokens: topAgent.totalTokens,
        percentage: totalTokens > 0 ? (topAgent.totalTokens / totalTokens) * 100 : 0,
      } : null,
      totalTokens,
      totalCost: totalEstimatedCost,
      avgThroughput: chartData.avgTokensPerSecond,
    }
  }, [chartData])

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refresh()
      onRefresh?.()
    } catch (error) {
      console.warn('Agent utilization widget refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [refresh, onRefresh])

  // Connection status indicator
  const connectionInfo = useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return { color: 'text-green-500', label: 'Connected', bgColor: 'bg-green-500' }
      case 'connecting':
        return { color: 'text-yellow-500', label: 'Connecting...', bgColor: 'bg-yellow-500' }
      case 'reconnecting':
        return { color: 'text-yellow-500', label: 'Reconnecting...', bgColor: 'bg-yellow-500' }
      case 'error':
        return { color: 'text-red-500', label: 'Connection Error', bgColor: 'bg-red-500' }
      case 'disconnected':
      default:
        return { color: 'text-gray-500', label: 'Disconnected', bgColor: 'bg-gray-500' }
    }
  }, [connectionStatus])

  return (
    <Card className={cn('relative', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-foreground-secondary" />
            <h3 className="text-lg font-semibold">Agent Utilization</h3>
          </div>
          {/* Summary stats */}
          {!isLoading && !error && (
            <div className="flex items-center gap-3 text-sm text-foreground-secondary">
              <span>{summary.activeAgentCount} active</span>
              {summary.topAgent && (
                <span className="text-foreground">
                  Top: {summary.topAgent.name} ({Math.round(summary.topAgent.percentage)}%)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className="flex items-center gap-1">
            <div
              className={cn('h-2 w-2 rounded-full', connectionInfo.bgColor)}
              title={connectionInfo.label}
            />
            <span className="sr-only">{connectionInfo.label}</span>
          </div>
          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            title="Refresh agent data"
          >
            <RefreshCw className={cn('h-4 w-4', (isRefreshing || isLoading) && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
            <div className="text-center space-y-2">
              <Spinner size="md" />
              <p className="text-sm text-foreground-secondary">
                Loading agent metrics...
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
            <div className="text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
              <p className="text-sm font-medium text-red-600">
                Unable to load agent data
              </p>
              <p className="text-xs text-foreground-secondary">
                {error}
              </p>
              <Button variant="secondary" size="sm" onClick={handleRefresh}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Agent utilization chart */}
        {!isLoading && !error && (
          <div className="space-y-3">
            <AgentUtilizationChart
              data={chartData}
              maxAgents={maxAgents}
              height={height}
              showCost={showCost}
              showPerformance={showPerformance}
              showTokenBreakdown={showTokenBreakdown}
              showLegend={showTokenBreakdown}
              onAgentClick={onAgentClick}
              loading={false}
              error={null}
              emptyMessage="No agent activity yet"
              animated={true}
              sortBy="tokens"
              sortDirection="desc"
            />

            {/* Footer with last updated */}
            {metrics.lastUpdated && (
              <div className="text-center pt-2 border-t border-border">
                <p className="text-xs text-foreground-secondary">
                  Last updated: {metrics.lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Connection status badge for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
              connectionInfo.color,
              'bg-background-secondary border border-border'
            )}
            title={`WebSocket: ${connectionInfo.label}`}
          >
            {connectionInfo.label}
          </span>
        </div>
      )}
    </Card>
  )
}

AgentUtilizationWidget.displayName = 'AgentUtilizationWidget'

export default AgentUtilizationWidget