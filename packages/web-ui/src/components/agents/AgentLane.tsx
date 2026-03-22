import React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react'
import { AgentExecutionCard } from './AgentExecutionCard'
import type {
  AgentLane as AgentLaneType,
  AgentExecution,
  ParallelAgentViewSize,
  AgentSortCriteria,
  AgentSortDirection,
} from '@/types/parallel-agent-view'
import { sortAgentExecutions, calculateParallelExecutionSummary } from '@/types/parallel-agent-view'

export interface AgentLaneProps {
  /**
   * The lane data to display
   */
  lane: AgentLaneType

  /**
   * Size variant for the lane cards
   */
  size?: ParallelAgentViewSize

  /**
   * Sort criteria for agents within the lane
   */
  sortBy?: AgentSortCriteria

  /**
   * Sort direction for agents within the lane
   */
  sortDirection?: AgentSortDirection

  /**
   * Maximum agents to display in the lane
   */
  maxAgents?: number

  /**
   * Whether to show progress bars on cards
   */
  showProgress?: boolean

  /**
   * Whether to show elapsed time
   */
  showElapsedTime?: boolean

  /**
   * Whether to show token usage
   */
  showTokenUsage?: boolean

  /**
   * Whether to show cost information
   */
  showCost?: boolean

  /**
   * Whether to show stage labels
   */
  showStages?: boolean

  /**
   * Whether to animate status transitions
   */
  animated?: boolean

  /**
   * Callback when a lane header is clicked
   */
  onLaneClick?: (lane: AgentLaneType) => void

  /**
   * Callback when lane collapse toggle is clicked
   */
  onLaneToggle?: (laneId: string, collapsed: boolean) => void

  /**
   * Callback when an agent execution is clicked
   */
  onAgentClick?: (execution: AgentExecution) => void

  /**
   * Callback when an agent execution is hovered
   */
  onAgentHover?: (execution: AgentExecution | null) => void

  /**
   * Callback when an agent is paused
   */
  onAgentPause?: (executionId: string) => void

  /**
   * Callback when an agent is resumed
   */
  onAgentResume?: (executionId: string) => void

  /**
   * Callback when an agent is cancelled
   */
  onAgentCancel?: (executionId: string) => void

  /**
   * Callback when an agent is retried
   */
  onAgentRetry?: (executionId: string) => void

  /**
   * Custom CSS class name
   */
  className?: string

  /**
   * Test ID for testing purposes
   */
  testId?: string
}

/**
 * AgentLane component displays a swim lane containing agent executions
 * with a collapsible header and scrollable content area.
 */
export const AgentLane: React.FC<AgentLaneProps> = ({
  lane,
  size = 'md',
  sortBy = 'startTime',
  sortDirection = 'asc',
  maxAgents = 10,
  showProgress = true,
  showElapsedTime = true,
  showTokenUsage = false,
  showCost = false,
  showStages = true,
  animated = true,
  onLaneClick,
  onLaneToggle,
  onAgentClick,
  onAgentHover,
  onAgentPause,
  onAgentResume,
  onAgentCancel,
  onAgentRetry,
  className,
  testId,
}) => {
  const isCollapsed = lane.collapsed || false
  const sortedExecutions = sortAgentExecutions(lane.executions, sortBy, sortDirection)
  const displayedExecutions = sortedExecutions.slice(0, maxAgents)
  const hasMore = sortedExecutions.length > maxAgents

  // Calculate lane statistics
  const runningCount = lane.executions.filter(e => e.status === 'running').length
  const completedCount = lane.executions.filter(e => e.status === 'completed').length
  const failedCount = lane.executions.filter(e => e.status === 'failed').length
  const totalCount = lane.executions.length

  const laneColor = lane.color || 'var(--color-apex-500)'

  const sizeClasses = {
    sm: 'min-h-24',
    md: 'min-h-32',
    lg: 'min-h-40',
  }

  const handleLaneClick = () => {
    if (onLaneClick) {
      onLaneClick(lane)
    }
  }

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onLaneToggle) {
      onLaneToggle(lane.id, !isCollapsed)
    }
  }

  const getProgressPercentage = () => {
    if (totalCount === 0) return 0
    return Math.round((completedCount / totalCount) * 100)
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-background-secondary border border-border-secondary rounded-lg overflow-hidden',
        sizeClasses[size],
        className
      )}
      data-testid={testId}
    >
      {/* Lane Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b border-border-secondary cursor-pointer hover:bg-background-tertiary transition-colors',
          size === 'sm' && 'px-3 py-2',
          size === 'lg' && 'px-5 py-4'
        )}
        onClick={handleLaneClick}
        style={{
          borderLeftColor: laneColor,
          borderLeftWidth: '4px',
        }}
      >
        {/* Lane info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleToggleCollapse}
            className="w-6 h-6 p-0 hover:bg-background-primary"
            title={isCollapsed ? 'Expand lane' : 'Collapse lane'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </Button>

          {/* Lane title and description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className={cn(
                  'font-semibold truncate text-foreground-primary',
                  size === 'sm' ? 'text-sm' : 'text-base'
                )}
                title={lane.label}
              >
                {lane.label}
              </h3>
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs flex-shrink-0',
                  size === 'sm' && 'text-xs px-1.5 py-0.5'
                )}
              >
                {totalCount}
              </Badge>
            </div>
            {lane.description && (
              <p
                className={cn(
                  'text-xs text-foreground-secondary truncate',
                  size === 'lg' && 'text-sm'
                )}
                title={lane.description}
              >
                {lane.description}
              </p>
            )}
          </div>
        </div>

        {/* Lane statistics */}
        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {runningCount > 0 && (
                  <Badge variant="apex" className="text-xs px-2 py-0.5">
                    {runningCount} running
                  </Badge>
                )}
                {completedCount > 0 && (
                  <Badge variant="success" className="text-xs px-2 py-0.5">
                    {completedCount} done
                  </Badge>
                )}
                {failedCount > 0 && (
                  <Badge variant="danger" className="text-xs px-2 py-0.5">
                    {failedCount} failed
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* More actions */}
          <Button
            variant="ghost"
            size="xs"
            className="w-6 h-6 p-0 opacity-50 hover:opacity-100"
            title="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Lane Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          {/* Empty state */}
          {lane.executions.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-foreground-secondary">
              <p className="text-sm">No agents in this lane</p>
            </div>
          ) : (
            <div className={cn(
              'p-4 space-y-3',
              size === 'sm' && 'p-3 space-y-2',
              size === 'lg' && 'p-5 space-y-4'
            )}>
              {/* Agent execution cards */}
              {displayedExecutions.map((execution) => (
                <AgentExecutionCard
                  key={execution.id}
                  execution={execution}
                  size={size}
                  showProgress={showProgress}
                  showElapsedTime={showElapsedTime}
                  showTokenUsage={showTokenUsage}
                  showCost={showCost}
                  showStages={showStages}
                  animated={animated}
                  onClick={onAgentClick}
                  onHover={onAgentHover}
                  onPause={onAgentPause}
                  onResume={onAgentResume}
                  onCancel={onAgentCancel}
                  onRetry={onAgentRetry}
                  testId={`agent-card-${execution.id}`}
                />
              ))}

              {/* "Show more" indicator */}
              {hasMore && (
                <div className="flex items-center justify-center py-2">
                  <Badge
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-background-primary transition-colors"
                    onClick={() => onLaneClick?.(lane)}
                  >
                    +{sortedExecutions.length - maxAgents} more
                  </Badge>
                </div>
              )}

              {/* Lane constraints info */}
              {lane.maxConcurrent && runningCount >= lane.maxConcurrent && (
                <div className="mt-3 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Lane at capacity ({runningCount}/{lane.maxConcurrent} concurrent)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}