import React from 'react'
import { cn, formatCost } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressIndicator } from '@/components/ui/ProgressIndicator'
import {
  Play,
  Pause,
  XCircle,
  RotateCcw,
  Clock,
  DollarSign,
  Zap,
  ExternalLink,
} from 'lucide-react'
import type {
  AgentExecution,
  AgentExecutionStatus,
  ParallelAgentViewSize,
} from '@/types/parallel-agent-view'
import {
  formatElapsedTime,
  truncateAgentDescription,
  AGENT_EXECUTION_STATUS_STYLES,
  AGENT_EXECUTION_STATUS_LABELS,
} from '@/types/parallel-agent-view'

export interface AgentExecutionCardProps {
  /**
   * The agent execution data to display
   */
  execution: AgentExecution

  /**
   * Size variant for the card
   */
  size?: ParallelAgentViewSize

  /**
   * Whether to show progress bar
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
   * Callback when the card is clicked
   */
  onClick?: (execution: AgentExecution) => void

  /**
   * Callback when the card is hovered
   */
  onHover?: (execution: AgentExecution | null) => void

  /**
   * Callback when pause button is clicked
   */
  onPause?: (executionId: string) => void

  /**
   * Callback when resume button is clicked
   */
  onResume?: (executionId: string) => void

  /**
   * Callback when cancel button is clicked
   */
  onCancel?: (executionId: string) => void

  /**
   * Callback when retry button is clicked
   */
  onRetry?: (executionId: string) => void

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
 * AgentExecutionCard component displays a single agent execution
 * in a compact card format with status, progress, and action buttons.
 */
export const AgentExecutionCard: React.FC<AgentExecutionCardProps> = ({
  execution,
  size = 'md',
  showProgress = true,
  showElapsedTime = true,
  showTokenUsage = false,
  showCost = false,
  showStages = true,
  animated = true,
  onClick,
  onHover,
  onPause,
  onResume,
  onCancel,
  onRetry,
  className,
  testId,
}) => {
  const statusStyles = AGENT_EXECUTION_STATUS_STYLES[execution.status]
  const statusLabel = AGENT_EXECUTION_STATUS_LABELS[execution.status]

  const sizeClasses = {
    sm: 'w-44 h-20 text-xs',
    md: 'w-60 h-24 text-sm',
    lg: 'w-80 h-28 text-sm',
  }

  const elapsedTime = formatElapsedTime(execution.startedAt, execution.completedAt)
  const truncatedDescription = truncateAgentDescription(
    execution.taskDescription,
    size === 'sm' ? 25 : size === 'md' ? 35 : 50
  )

  const canPause = execution.status === 'running'
  const canResume = execution.status === 'paused'
  const canCancel = execution.status === 'running' || execution.status === 'queued' || execution.status === 'paused'
  const canRetry = execution.status === 'failed'

  const handleClick = () => {
    if (onClick) {
      onClick(execution)
    }
  }

  const handleMouseEnter = () => {
    if (onHover) {
      onHover(execution)
    }
  }

  const handleMouseLeave = () => {
    if (onHover) {
      onHover(null)
    }
  }

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onPause && canPause) {
      onPause(execution.id)
    }
  }

  const handleResume = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onResume && canResume) {
      onResume(execution.id)
    }
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onCancel && canCancel) {
      onCancel(execution.id)
    }
  }

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRetry && canRetry) {
      onRetry(execution.id)
    }
  }

  return (
    <div
      className={cn(
        'relative flex flex-col justify-between rounded-lg border p-3 transition-all duration-200 cursor-pointer group',
        statusStyles.bg,
        statusStyles.border,
        sizeClasses[size],
        animated && 'hover:scale-105 hover:shadow-lg',
        animated && statusStyles.glow,
        className
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid={testId}
    >
      {/* Header with status and agent name */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                statusStyles.dot,
                animated && execution.status === 'running' && 'animate-pulse'
              )}
            />
            <span
              className={cn('font-medium truncate', statusStyles.text)}
              title={execution.agentName}
            >
              {execution.agentName}
            </span>
            {execution.taskId && (
              <ExternalLink
                className={cn('w-3 h-3 flex-shrink-0 opacity-50', statusStyles.icon)}
              />
            )}
          </div>
          <Badge
            variant="secondary"
            className={cn('text-xs px-1.5 py-0.5', statusStyles.text)}
          >
            {statusLabel}
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 ml-2">
          {canPause && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handlePause}
              className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Pause execution"
            >
              <Pause className="w-3 h-3" />
            </Button>
          )}
          {canResume && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleResume}
              className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Resume execution"
            >
              <Play className="w-3 h-3" />
            </Button>
          )}
          {canRetry && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleRetry}
              className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Retry execution"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleCancel}
              className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Cancel execution"
            >
              <XCircle className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Task description */}
      <div className="mb-2 flex-1">
        <p
          className={cn(
            'text-xs opacity-80 line-clamp-2',
            statusStyles.text
          )}
          title={execution.taskDescription}
        >
          {truncatedDescription}
        </p>
      </div>

      {/* Stage label */}
      {showStages && execution.stage && (
        <div className="mb-2">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full bg-opacity-20 border',
              statusStyles.text,
              statusStyles.border
            )}
          >
            {execution.stage}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {showProgress && execution.status === 'running' && (
        <div className="mb-2">
          <ProgressIndicator
            value={execution.progress}
            variant="info"
            size="sm"
            className="h-1.5"
          />
          <div className="flex justify-between mt-1">
            <span className={cn('text-xs opacity-70', statusStyles.text)}>
              {execution.progress}%
            </span>
          </div>
        </div>
      )}

      {/* Footer with metrics */}
      <div className="flex items-center justify-between text-xs">
        {/* Elapsed time */}
        {showElapsedTime && (
          <div className={cn('flex items-center gap-1 opacity-70', statusStyles.text)}>
            <Clock className="w-3 h-3" />
            <span>{elapsedTime}</span>
          </div>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Token usage */}
          {showTokenUsage && execution.tokensUsed && (
            <div className={cn('flex items-center gap-1 opacity-70', statusStyles.text)}>
              <Zap className="w-3 h-3" />
              <span>{execution.tokensUsed.toLocaleString()}</span>
            </div>
          )}

          {/* Cost */}
          {showCost && execution.estimatedCost && (
            <div className={cn('flex items-center gap-1 opacity-70', statusStyles.text)}>
              <DollarSign className="w-3 h-3" />
              <span>{formatCost(execution.estimatedCost)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Error overlay for failed executions */}
      {execution.status === 'failed' && execution.error && (
        <div
          className="absolute inset-0 bg-red-500/10 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity p-2"
          title={`Error: ${execution.error}`}
        >
          <p className="text-xs text-red-400 text-center line-clamp-3">
            {execution.error}
          </p>
        </div>
      )}
    </div>
  )
}