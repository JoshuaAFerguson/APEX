'use client'

import { useMemo } from 'react'
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
  if (tokensPerSec >= 1000) {
    return `${(tokensPerSec / 1000).toFixed(1)}K/s`
  }
  return `${Math.round(tokensPerSec)}/s`
}

/**
 * Truncate agent names for display
 */
function truncateAgentName(name: string, maxLength: number = 12): string {
  if (name.length <= maxLength) return name
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
    const { agents } = data
    const { sortBy, sortDirection, maxAgents, colors } = options

    if (agents.length === 0) return []

    // Sort agents by the specified metric
    const sortedAgents = [...agents].sort((a, b) => {
      let valueA: number, valueB: number

      switch (sortBy) {
        case 'tokens':
          valueA = a.totalTokens
          valueB = b.totalTokens
          break
        case 'inputTokens':
          valueA = a.inputTokens
          valueB = b.inputTokens
          break
        case 'outputTokens':
          valueA = a.outputTokens
          valueB = b.outputTokens
          break
        case 'cost':
          valueA = a.estimatedCost
          valueB = b.estimatedCost
          break
        case 'tokensPerSecond':
          valueA = a.tokensPerSecond
          valueB = b.tokensPerSecond
          break
        case 'duration':
          valueA = a.duration
          valueB = b.duration
          break
        case 'invocations':
          valueA = a.invocations
          valueB = b.invocations
          break
        default:
          valueA = a.totalTokens
          valueB = b.totalTokens
      }

      return sortDirection === 'desc' ? valueB - valueA : valueA - valueB
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
        tokensPerSecond: otherAgents.reduce((sum, agent, idx) => {
          return sum + agent.tokensPerSecond
        }, 0) / otherAgents.length,
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
        ? (agent.totalTokens / data.totalTokens) * 100
        : 0

      const costPercentage = data.totalEstimatedCost > 0
        ? (agent.estimatedCost / data.totalEstimatedCost) * 100
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

  // Empty state
  if (processedAgents.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-foreground-secondary', className)} style={{ height }}>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  // Find the maximum token count for scaling bars
  const maxTokens = Math.max(...processedAgents.map(agent => agent.totalTokens))

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
                        title={`Total: ${formatNumber(agent.totalTokens)} tokens`}
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
        Total tokens: {formatNumber(data.totalTokens)}.
        Total cost: {formatCost(data.totalEstimatedCost)}.
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

  const maxTokens = Math.max(...processedAgents.map(agent => agent.totalTokens))

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