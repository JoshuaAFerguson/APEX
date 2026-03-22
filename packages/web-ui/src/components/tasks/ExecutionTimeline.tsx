import React, { HTMLAttributes, forwardRef } from 'react'
import { cn, formatStatus, getElapsedTime } from '@/lib/utils'
import type { TaskStatus } from '@apexcli/core'
import {
  Clock,
  CheckCircle,
  XCircle,
  Circle,
  Play,
  Pause,
  Users,
  GitBranch,
} from 'lucide-react'

/** Represents a single stage in the execution timeline */
export interface ExecutionStage {
  /** Unique identifier for the stage */
  id: string
  /** Display name of the stage */
  name: string
  /** Current status of this stage */
  status: ExecutionStageStatus
  /** When this stage was started */
  startedAt?: Date
  /** When this stage was completed */
  completedAt?: Date
  /** Duration in milliseconds if completed, or elapsed time if running */
  duration?: number
  /** Additional metadata or context for this stage */
  metadata?: Record<string, any>
}

/** Status of an individual execution stage */
export type ExecutionStageStatus =
  | 'pending'     // Not yet started
  | 'running'     // Currently executing
  | 'completed'   // Successfully finished
  | 'failed'      // Failed with error
  | 'skipped'     // Was skipped
  | 'paused'      // Currently paused

export interface ExecutionTimelineProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of execution stages to display */
  stages: ExecutionStage[]
  /** ID of the currently active/highlighted stage */
  currentStageId?: string
  /** Whether to show timing information for each stage */
  showTiming?: boolean
  /** Whether to show a compact version */
  compact?: boolean
  /** Optional callback when a stage is clicked */
  onStageClick?: (stageId: string) => void
  /** Whether the timeline should be animated */
  animated?: boolean
}

/**
 * ExecutionTimeline component displays a horizontal timeline showing task execution stages
 * with their current status, timing information, and visual indicators.
 *
 * Features:
 * - Horizontal timeline layout with connecting lines
 * - Visual status indicators (icons and colors)
 * - Current stage highlighting with animation
 * - Duration display for completed stages
 * - Elapsed time for running stages
 * - Responsive design that adapts to container width
 */
const ExecutionTimeline = forwardRef<HTMLDivElement, ExecutionTimelineProps>(
  ({
    className,
    stages,
    currentStageId,
    showTiming = true,
    compact = false,
    onStageClick,
    animated = true,
    ...props
  }, ref) => {

    /**
     * Get the appropriate icon component for a stage status
     */
    const getStageIcon = (status: ExecutionStageStatus, isCurrentStage: boolean) => {
      const iconClasses = cn(
        'transition-all duration-300',
        compact ? 'w-4 h-4' : 'w-5 h-5',
        isCurrentStage && animated && 'animate-pulse'
      )

      switch (status) {
        case 'completed':
          return <CheckCircle className={cn(iconClasses, 'text-green-500')} />
        case 'failed':
          return <XCircle className={cn(iconClasses, 'text-red-500')} />
        case 'running':
          return <Play className={cn(iconClasses, 'text-apex-500')} />
        case 'paused':
          return <Pause className={cn(iconClasses, 'text-yellow-500')} />
        case 'skipped':
          return <Circle className={cn(iconClasses, 'text-foreground-tertiary')} />
        case 'pending':
        default:
          return <Circle className={cn(iconClasses, 'text-foreground-secondary')} />
      }
    }

    /**
     * Get the color classes for a stage based on its status
     */
    const getStageColors = (status: ExecutionStageStatus, isCurrentStage: boolean) => {
      const baseColors = {
        pending: 'text-foreground-secondary border-border-secondary',
        running: 'text-apex-500 border-apex-500 bg-apex-500/10',
        completed: 'text-green-500 border-green-500 bg-green-500/10',
        failed: 'text-red-500 border-red-500 bg-red-500/10',
        paused: 'text-yellow-500 border-yellow-500 bg-yellow-500/10',
        skipped: 'text-foreground-tertiary border-border-tertiary',
      }

      let colors = baseColors[status] || baseColors.pending

      if (isCurrentStage && animated) {
        colors += ' ring-2 ring-apex-500/30 ring-offset-2 ring-offset-background-primary'
      }

      return colors
    }

    /**
     * Format the timing information for a stage
     */
    const formatStageTiming = (stage: ExecutionStage): string => {
      if (stage.status === 'running' && stage.startedAt) {
        return getElapsedTime(stage.startedAt)
      }

      if (stage.status === 'completed' && stage.duration) {
        const seconds = Math.floor(stage.duration / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)

        if (hours > 0) {
          return `${hours}h ${minutes % 60}m`
        } else if (minutes > 0) {
          const remainingSeconds = seconds % 60
          return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
        } else {
          return `${seconds}s`
        }
      }

      return ''
    }

    /**
     * Get the connector line color based on the status of stages it connects
     */
    const getConnectorColor = (fromStatus: ExecutionStageStatus, toStatus: ExecutionStageStatus): string => {
      if (fromStatus === 'completed' && (toStatus === 'completed' || toStatus === 'running')) {
        return 'bg-green-500'
      }
      if (fromStatus === 'completed' || fromStatus === 'running') {
        return 'bg-apex-500'
      }
      return 'bg-border-secondary'
    }

    if (!stages || stages.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex items-center justify-center py-8 text-foreground-secondary',
            className
          )}
          {...props}
        >
          <div className="text-sm">No execution stages to display</div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          'relative w-full',
          compact ? 'py-2' : 'py-4',
          className
        )}
        {...props}
      >
        {/* Stages container */}
        <div className="relative flex items-center justify-between">
          {stages.map((stage, index) => {
            const isCurrentStage = currentStageId === stage.id
            const isLast = index === stages.length - 1
            const timing = showTiming ? formatStageTiming(stage) : ''

            return (
              <div key={stage.id} className="relative flex flex-col items-center">
                {/* Stage node */}
                <div
                  className={cn(
                    'relative flex flex-col items-center cursor-pointer group transition-all duration-300',
                    onStageClick && 'hover:scale-105'
                  )}
                  onClick={() => onStageClick?.(stage.id)}
                  role={onStageClick ? 'button' : undefined}
                  tabIndex={onStageClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onStageClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      onStageClick(stage.id)
                    }
                  }}
                >
                  {/* Stage icon/indicator */}
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-full border-2 transition-all duration-300',
                      compact ? 'w-8 h-8' : 'w-10 h-10',
                      getStageColors(stage.status, isCurrentStage)
                    )}
                  >
                    {getStageIcon(stage.status, isCurrentStage)}
                  </div>

                  {/* Stage name */}
                  <div className={cn(
                    'mt-2 text-center max-w-20 font-medium transition-colors duration-300',
                    compact ? 'text-xs' : 'text-sm',
                    isCurrentStage ? 'text-apex-500' : 'text-foreground-secondary',
                    'group-hover:text-foreground-primary'
                  )}>
                    <div className="truncate" title={stage.name}>
                      {stage.name}
                    </div>

                    {/* Timing information */}
                    {timing && (
                      <div className={cn(
                        'flex items-center justify-center gap-1 mt-1 text-foreground-tertiary',
                        compact ? 'text-xs' : 'text-xs'
                      )}>
                        <Clock className="w-3 h-3" />
                        <span>{timing}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector line to next stage */}
                {!isLast && (
                  <div
                    className={cn(
                      'absolute top-4 left-full h-0.5 transition-all duration-500',
                      compact ? 'w-12 -translate-y-4' : 'w-16 -translate-y-5',
                      getConnectorColor(stage.status, stages[index + 1]?.status || 'pending')
                    )}
                    style={{
                      width: `calc(100vw / ${stages.length} - ${compact ? '2rem' : '2.5rem'})`,
                      maxWidth: compact ? '4rem' : '6rem',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Progress indicator bar at the bottom */}
        {animated && (
          <div className={cn(
            'absolute bottom-0 left-0 right-0 h-0.5 bg-border-secondary rounded-full overflow-hidden',
            compact ? 'mt-2' : 'mt-4'
          )}>
            <div
              className="h-full bg-apex-500 rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${(stages.filter(s => s.status === 'completed').length / stages.length) * 100}%`
              }}
            />
          </div>
        )}
      </div>
    )
  }
)

ExecutionTimeline.displayName = 'ExecutionTimeline'

export { ExecutionTimeline }