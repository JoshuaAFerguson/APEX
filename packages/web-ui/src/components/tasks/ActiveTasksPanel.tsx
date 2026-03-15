import React, { useState, useMemo } from 'react'
import { TaskCard } from './TaskCard'
import { Card, CardHeader, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { isTaskRunning, cn } from '../../lib/utils'
import type { Task, TaskStatus } from '@apexcli/core'
import {
  Filter,
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Pause,
} from 'lucide-react'

export interface ActiveTasksPanelProps {
  /** Array of tasks to display */
  tasks: Task[]
  /** Optional callback when user wants to view task details */
  onViewDetails?: (taskId: string) => void
  /** Optional callback to refresh tasks */
  onRefresh?: () => void
  /** Whether the panel is loading */
  loading?: boolean
  /** Whether to show only active tasks by default */
  defaultShowActiveOnly?: boolean
  /** Maximum number of tasks to display */
  maxTasks?: number
  /** Whether to show the panel in compact mode */
  compact?: boolean
  /** Optional callback to cancel a task */
  onCancel?: (taskId: string) => Promise<void>
  /** Optional callback to retry a task */
  onRetry?: (taskId: string) => Promise<void>
  /** ID of task currently being acted upon (for loading state) */
  actionLoadingTaskId?: string | null
}

type FilterType = 'all' | 'active' | 'completed' | 'failed' | 'paused'

/**
 * ActiveTasksPanel component displays a filtered view of tasks with:
 * - Task cards showing progress, status, and elapsed time
 * - Filtering options (all, active, completed, failed, paused)
 * - Refresh functionality
 * - Task counts and statistics
 */
export function ActiveTasksPanel({
  tasks = [],
  onViewDetails,
  onRefresh,
  loading = false,
  defaultShowActiveOnly = true,
  maxTasks = 10,
  compact = false,
  onCancel,
  onRetry,
  actionLoadingTaskId,
}: ActiveTasksPanelProps) {
  const [filter, setFilter] = useState<FilterType>(defaultShowActiveOnly ? 'active' : 'all')

  // Filter tasks based on current filter
  const filteredTasks = useMemo(() => {
    let filtered: Task[] = []

    switch (filter) {
      case 'active':
        filtered = tasks.filter(task =>
          isTaskRunning(task.status) || task.status === 'queued' || task.status === 'pending'
        )
        break
      case 'completed':
        filtered = tasks.filter(task => task.status === 'completed')
        break
      case 'failed':
        filtered = tasks.filter(task => task.status === 'failed' || task.status === 'cancelled')
        break
      case 'paused':
        filtered = tasks.filter(task =>
          task.status === 'paused' || task.status === 'awaiting-approval' || task.status === 'waiting-approval'
        )
        break
      case 'all':
      default:
        filtered = tasks
        break
    }

    // Sort by most recently updated
    const sorted = filtered.sort((a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    )

    // Limit the number of tasks
    return sorted.slice(0, maxTasks)
  }, [tasks, filter, maxTasks])

  // Calculate task statistics
  const stats = useMemo(() => {
    const total = tasks.length
    const active = tasks.filter(task =>
      isTaskRunning(task.status) || task.status === 'queued' || task.status === 'pending'
    ).length
    const completed = tasks.filter(task => task.status === 'completed').length
    const failed = tasks.filter(task => task.status === 'failed' || task.status === 'cancelled').length
    const paused = tasks.filter(task =>
      task.status === 'paused' || task.status === 'awaiting-approval' || task.status === 'waiting-approval'
    ).length

    return { total, active, completed, failed, paused }
  }, [tasks])

  const filterOptions: Array<{ type: FilterType; label: string; count: number; icon: React.ComponentType<any> }> = [
    { type: 'all', label: 'All', count: stats.total, icon: Filter },
    { type: 'active', label: 'Active', count: stats.active, icon: Activity },
    { type: 'completed', label: 'Completed', count: stats.completed, icon: CheckCircle },
    { type: 'failed', label: 'Failed', count: stats.failed, icon: AlertCircle },
    { type: 'paused', label: 'Paused', count: stats.paused, icon: Pause },
  ]

  return (
    <Card className={cn('w-full', compact && 'text-sm')}>
      <CardHeader className={cn('pb-3', compact && 'p-3 pb-2')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-apex-500" />
            <h3 className={cn('font-semibold text-foreground', compact ? 'text-base' : 'text-lg')}>
              Active Tasks
            </h3>
            {stats.total > 0 && (
              <Badge variant="default" className="text-xs">
                {stats.total}
              </Badge>
            )}
          </div>

          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="gap-1"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              {!compact && 'Refresh'}
            </Button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1 mt-3">
          {filterOptions.map(({ type, label, count, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                'hover:bg-background-tertiary/50',
                filter === type
                  ? 'bg-apex-500/20 text-apex-400 border border-apex-500/30'
                  : 'text-foreground-secondary hover:text-foreground',
                compact && 'px-2 py-1 text-xs'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full text-xs',
                  filter === type
                    ? 'bg-apex-500/30 text-apex-300'
                    : 'bg-background-tertiary text-foreground-secondary'
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className={cn('pt-0', compact && 'p-3 pt-0')}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-apex-500" />
            <span className="ml-2 text-foreground-secondary">Loading tasks...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-foreground-secondary">
            <Clock className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">
              {filter === 'all' ? 'No tasks found' : `No ${filter} tasks`}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="text-xs text-apex-500 hover:text-apex-400 mt-1"
              >
                View all tasks
              </button>
            )}
          </div>
        ) : (
          <div className={cn('space-y-3', compact && 'space-y-2')}>
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onViewDetails={onViewDetails}
                compact={compact}
                showProgress={true}
                onCancel={onCancel}
                onRetry={onRetry}
                isActionLoading={actionLoadingTaskId?.includes(task.id) || false}
              />
            ))}

            {/* Show message if there are more tasks */}
            {filteredTasks.length === maxTasks && (
              <div className="text-center text-xs text-foreground-secondary py-2 border-t border-border">
                Showing {maxTasks} most recent tasks
                {filter !== 'all' && ` (${filter})`}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}