'use client'

import React, { useMemo } from 'react'
import { cn, formatCost } from '@/lib/utils'
import {
  AgentUtilizationChartProps,
  AgentUtilizationData,
  AgentUtilization,
  ProcessedAgentData,
  AgentUtilizationMetric,
  AgentUtilizationSortDirection,
  AgentUtilizationColorConfig,
  DEFAULT_AGENT_UTILIZATION_CHART_PROPS,
  DEFAULT_UTILIZATION_COLORS,
} from '@/types/agent-utilization'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format large numbers for display (K, M format)
 */
function formatNumber(num: number): string {
  // Handle undefined, null, or invalid numbers
  if (typeof num !== 'number' || !isFinite(num)) {
    return '0'
  }

  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

/**
 * Format tokens per second with appropriate units
 */
function formatTokensPerSecond(tokensPerSec: number): string {
  // Handle undefined, null, or invalid numbers
  if (typeof tokensPerSec !== 'number' || !isFinite(tokensPerSec)) {
    return '0/s'
  }

  if (tokensPerSec >= 1000) {
    return `${(tokensPerSec / 1000).toFixed(1)}K/s`
  }
  return `${Math.round(tokensPerSec)}/s`
}

/**
 * Truncate agent names for display
 */
function truncateAgentName(name: string, maxLength: number = 17): string {
  if (!name || name.length <= maxLength) return name
  return `${name.slice(0, maxLength - 3)}...`
}

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Process agent utilization data for chart rendering
 */
function useProcessedAgents(
  data: AgentUtilizationData,
  options: {
    sortBy: AgentUtilizationMetric
    sortDirection: AgentUtilizationSortDirection
    maxAgents: number
    colors: AgentUtilizationColorConfig
  }
): ProcessedAgentData[] {
  return useMemo(() => {
    // Handle null or undefined data
    if (!data || !data.agents) return []

    const { agents } = data
    const { sortBy, sortDirection, maxAgents, colors } = options

    if (agents.length === 0) return []

    // Sort agents by the specified metric
    const sortedAgents = [...agents].sort((a, b) => {
      let valueA: number, valueB: number

      switch (sortBy) {
        case 'tokens':
          valueA = a.totalTokens || 0
          valueB = b.totalTokens || 0
          break
        case 'inputTokens':
          valueA = a.inputTokens || 0
          valueB = b.inputTokens || 0
          break
        case 'outputTokens':
          valueA = a.outputTokens || 0
          valueB = b.outputTokens || 0
          break
        case 'cost':
          valueA = a.estimatedCost || 0
          valueB = b.estimatedCost || 0
          break
        case 'tokensPerSecond':
          valueA = a.tokensPerSecond || 0
          valueB = b.tokensPerSecond || 0
          break
        case 'duration':
          valueA = a.duration || 0
          valueB = b.duration || 0
          break
        case 'invocations':
          valueA = a.invocations || 0
          valueB = b.invocations || 0
          break
        default:
          valueA = a.totalTokens || 0
          valueB = b.totalTokens || 0
      }

      // Handle NaN and infinite values
      if (!isFinite(valueA)) valueA = 0
      if (!isFinite(valueB)) valueB = 0

      // Primary sort by the selected metric
      const primarySort = sortDirection === 'desc' ? valueB - valueA : valueA - valueB

      // If values are equal, use agent name as a stable tiebreaker
      if (primarySort === 0) {
        return a.agentName.localeCompare(b.agentName)
      }

      return primarySort
    })

    // Take top N agents, group rest as "Other"
    let processedAgents: AgentUtilization[]
    if (sortedAgents.length > maxAgents) {
      const topAgents = sortedAgents.slice(0, maxAgents - 1)
      const otherAgents = sortedAgents.slice(maxAgents - 1)

      // Aggregate "Other" agents
      const otherAggregated: AgentUtilization = {
        agentId: 'other',
        agentName: `Other (${otherAgents.length})`,
        inputTokens: otherAgents.reduce((sum, agent) => sum + agent.inputTokens, 0),
        outputTokens: otherAgents.reduce((sum, agent) => sum + agent.outputTokens, 0),
        totalTokens: otherAgents.reduce((sum, agent) => sum + agent.totalTokens, 0),
        estimatedCost: otherAgents.reduce((sum, agent) => sum + agent.estimatedCost, 0),
        tokensPerSecond: otherAgents.length > 0
          ? otherAgents.reduce((sum, agent) => sum + (agent.tokensPerSecond || 0), 0) / otherAgents.length
          : 0,
        duration: otherAgents.reduce((sum, agent) => sum + agent.duration, 0),
        invocations: otherAgents.reduce((sum, agent) => sum + agent.invocations, 0),
      }

      processedAgents = [...topAgents, otherAggregated]
    } else {
      processedAgents = sortedAgents
    }

    // Process agents with additional data
    return processedAgents.map((agent, index) => {
      const tokenPercentage = data.totalTokens > 0
        ? ((agent.totalTokens || 0) / data.totalTokens) * 100
        : 0

      const costPercentage = data.totalEstimatedCost > 0
        ? ((agent.estimatedCost || 0) / data.totalEstimatedCost) * 100
        : 0

      // Assign colors from the color configuration
      const colorIndex = index % colors.agentColors.length
      const color = colors.agentColors[colorIndex]

      return {
        ...agent,
        tokenPercentage,
        costPercentage,
        color,
        displayName: truncateAgentName(agent.agentName),
      }
    })
  }, [data, options])
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentUtilizationChart({
  data,
  variant = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.variant,
  metric = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.metric,
  sortBy = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.sortBy,
  sortDirection = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.sortDirection,
  maxAgents = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.maxAgents,
  height = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.height,
  showLegend = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.showLegend,
  showTokenBreakdown = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.showTokenBreakdown,
  showCost = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.showCost,
  showPerformance = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.showPerformance,
  animated = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.animated,
  colors = DEFAULT_UTILIZATION_COLORS,
  className,
  onAgentClick,
  onAgentHover,
  loading = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.loading,
  error,
  emptyMessage = DEFAULT_AGENT_UTILIZATION_CHART_PROPS.emptyMessage,
}: AgentUtilizationChartProps) {

  // Merge default colors with provided colors
  const mergedColors: AgentUtilizationColorConfig = {
    ...DEFAULT_UTILIZATION_COLORS,
    ...colors,
  }

  const processedAgents = useProcessedAgents(data, {
    sortBy,
    sortDirection,
    maxAgents,
    colors: mergedColors,
  })

  // Loading state
  if (loading) {
    return (
      <div className={cn('space-y-4', className)} style={{ height }}>
        <div className="space-y-2">
          {Array.from({ length: Math.min(maxAgents, 6) }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-24 h-4 bg-background-secondary animate-pulse rounded" />
              <div className="flex-1 h-6 bg-background-secondary animate-pulse rounded" />
              {showCost && <div className="w-16 h-4 bg-background-secondary animate-pulse rounded" />}
              {showPerformance && <div className="w-12 h-4 bg-background-secondary animate-pulse rounded" />}
            </div>
          ))}
        </div>
        {showLegend && (
          <div className="flex gap-4">
            <div className="w-16 h-4 bg-background-secondary animate-pulse rounded" />
            <div className="w-16 h-4 bg-background-secondary animate-pulse rounded" />
          </div>
        )}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-error', className)} style={{ height }}>
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">Error loading chart</p>
          <p className="text-xs text-foreground-secondary">{error}</p>
        </div>
      </div>
    )
  }

  // Empty state - only when there are no agents
  if (processedAgents.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-foreground-secondary', className)} style={{ height }}>
        <p className="text-sm">
          {(!data?.agents || data.agents.length === 0)
            ? emptyMessage
            : 'No usage data yet'  // Match TokenUsageChart pattern when agents exist but no tokens
          }
        </p>
      </div>
    )
  }

  // Find the maximum token count for scaling bars
  const maxTokens = Math.max(...processedAgents.map(agent => agent.totalTokens || 0))

  return (
    <div
      className={cn('space-y-4', className)}
      style={{ height }}
      role="img"
      aria-label={`Agent utilization chart showing ${processedAgents.length} agents`}
    >
      {/* Chart Bars */}
      <div className="space-y-2 flex-1 overflow-y-auto">
        {processedAgents.map((agent, index) => {
          const barWidth = maxTokens > 0 ? (agent.totalTokens / maxTokens) * 100 : 0
          const inputPercent = agent.totalTokens > 0 ? (agent.inputTokens / agent.totalTokens) * 100 : 50
          const outputPercent = agent.totalTokens > 0 ? (agent.outputTokens / agent.totalTokens) * 100 : 50

          return (
            <div
              key={agent.agentId}
              className={cn(
                'group flex items-center gap-2 p-2 rounded-md transition-colors',
                'hover:bg-background-secondary cursor-pointer',
                onAgentClick && 'cursor-pointer'
              )}
              onClick={() => onAgentClick?.(agent)}
              onMouseEnter={() => onAgentHover?.(agent)}
              onMouseLeave={() => onAgentHover?.(null)}
              aria-label={`${agent.agentName}: ${formatNumber(agent.totalTokens)} tokens, ${formatCost(agent.estimatedCost)}`}
            >
              {/* Agent Name */}
              <div className="w-20 sm:w-24 md:w-32 flex-shrink-0">
                <p
                  className="text-xs font-medium text-foreground truncate"
                  title={agent.agentName}
                >
                  {agent.displayName}
                </p>
              </div>

              {/* Token Bar */}
              <div className="flex-1 min-w-0">
                <div className="relative h-6 bg-background-tertiary rounded-md overflow-hidden">
                  <div
                    className={cn(
                      'absolute left-0 top-0 h-full transition-all duration-500 rounded-md',
                      animated && 'transition-all duration-500'
                    )}
                    style={{ width: `${barWidth}%` }}
                  >
                    {/* Input Tokens Segment */}
                    {showTokenBreakdown ? (
                      <>
                        <div
                          className="absolute left-0 top-0 h-full bg-apex-500"
                          style={{ width: `${inputPercent}%` }}
                          title={`Input: ${formatNumber(agent.inputTokens)} tokens`}
                        />
                        {/* Output Tokens Segment */}
                        <div
                          className="absolute right-0 top-0 h-full bg-apex-700"
                          style={{ width: `${outputPercent}%` }}
                          title={`Output: ${formatNumber(agent.outputTokens)} tokens`}
                        />
                      </>
                    ) : (
                      <div
                        className="h-full bg-apex-500"
                        title={`Total: ${agent.totalTokens.toLocaleString()} tokens`}
                      />
                    )}
                  </div>

                  {/* Token Count Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-white/90 drop-shadow-sm">
                      {formatNumber(agent.totalTokens)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cost Column */}
              {showCost && (
                <div className="w-16 flex-shrink-0 text-right hidden sm:block">
                  <p className="text-xs font-medium text-foreground">
                    {formatCost(agent.estimatedCost)}
                  </p>
                </div>
              )}

              {/* Performance Column */}
              {showPerformance && (
                <div className="w-12 flex-shrink-0 text-right hidden md:block">
                  <p className="text-xs font-medium text-foreground-secondary">
                    {formatTokensPerSecond(agent.tokensPerSecond)}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      {showLegend && showTokenBreakdown && (
        <div className="flex items-center justify-center gap-6 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-apex-500" />
            <span className="text-xs text-foreground-secondary">Input Tokens</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-apex-700" />
            <span className="text-xs text-foreground-secondary">Output Tokens</span>
          </div>
        </div>
      )}

      {/* Hidden summary for screen readers */}
      <div className="sr-only">
        Agent utilization summary: {processedAgents.length} agents shown.
        Total tokens: {formatNumber(data?.totalTokens || 0)}.
        Total cost: {formatCost(data?.totalEstimatedCost || 0)}.
        Top agent: {processedAgents[0]?.agentName} with {formatNumber(processedAgents[0]?.totalTokens || 0)} tokens.
      </div>
    </div>
  )
}

// ============================================================================
// Mini Component
// ============================================================================

/**
 * Mini version of agent utilization chart for cards and dashboard widgets
 */
export function AgentUtilizationChartMini({
  data,
  maxAgents = 3,
  className
}: {
  data: AgentUtilizationData
  maxAgents?: number
  className?: string
}) {
  const processedAgents = useProcessedAgents(data, {
    sortBy: 'tokens',
    sortDirection: 'desc',
    maxAgents,
    colors: DEFAULT_UTILIZATION_COLORS,
  })

  if (processedAgents.length === 0) {
    return (
      <div className={cn('text-center py-4 text-foreground-secondary', className)}>
        <p className="text-xs">No data</p>
      </div>
    )
  }

  const maxTokens = Math.max(...processedAgents.map(agent => agent.totalTokens || 0))

  return (
    <div className={cn('space-y-2', className)}>
      {processedAgents.map((agent) => {
        const barWidth = maxTokens > 0 ? (agent.totalTokens / maxTokens) * 100 : 0

        return (
          <div key={agent.agentId} className="flex items-center gap-2">
            <div className="w-16 flex-shrink-0">
              <p className="text-xs text-foreground-secondary truncate" title={agent.agentName}>
                {agent.displayName}
              </p>
            </div>
            <div className="flex-1 h-2 bg-background-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-apex-500 to-apex-700 transition-all duration-500"
                style={{ width: `${barWidth}%` }}
                title={`${agent.agentName}: ${formatNumber(agent.totalTokens)} tokens`}
              />
            </div>
            <div className="w-12 flex-shrink-0 text-right">
              <p className="text-xs text-foreground-secondary">
                {formatNumber(agent.totalTokens)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// Exports
// ============================================================================

export default AgentUtilizationChart
export type { AgentUtilizationChartProps }