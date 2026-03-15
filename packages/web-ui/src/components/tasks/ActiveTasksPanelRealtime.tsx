'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { TaskCard } from './TaskCard'
import { Card, CardHeader, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { WebSocketConnectionIndicator } from '../connection/WebSocketConnectionIndicator'
import { useRealtimeUpdates } from '../../lib/useRealtimeUpdates'
import { isTaskRunning, cn } from '../../lib/utils'
import type { Task, TaskStatus } from '@apexcli/core'
import type { DashboardActivityEvent } from '../../types/dashboard'
import {
  Filter,
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Pause,
} from 'lucide-react'

type FilterType = 'all' | 'active' | 'completed' | 'failed' | 'paused'

/**
 * Props for the real-time Active Tasks Panel
 */
export interface ActiveTasksPanelRealtimeProps {
  /** Initial tasks to display (optional - will fetch via WebSocket if not provided) */
  initialTasks?: Task[]

  /** Optional callback when user wants to view task details */
  onViewDetails?: (taskId: string) => void

  /** Whether to show only active tasks by default */
  defaultShowActiveOnly?: boolean

  /** Maximum number of tasks to display */
  maxTasks?: number

  /** Whether to show the panel in compact mode */
  compact?: boolean

  /** Whether to show connection indicator in header */
  showConnectionIndicator?: boolean

  /** Filter to specific task IDs (for focused views) */
  taskIds?: string[]

  /** Connection indicator size */
  connectionIndicatorSize?: 'sm' | 'md' | 'lg'

  /** Whether to auto-connect on mount */
  autoConnect?: boolean

  /** Custom CSS class name */
  className?: string
}

/**
 * ActiveTasksPanelRealtime - Real-time task panel with WebSocket updates
 *
 * Enhanced version of ActiveTasksPanel that integrates with the useRealtimeUpdates hook
 * to provide automatic live updates when task events occur. Features include:
 *
 * - Automatic task updates via WebSocket events
 * - Connection status indicator in header
 * - Real-time task state synchronization
 * - Graceful fallback to static data when disconnected
 *
 * Supported events:
 * - task:created - Adds new tasks to the list
 * - task:started - Updates task status to running
 * - task:stage-changed - Updates current stage
 * - task:completed - Marks task as completed
 * - task:failed - Marks task as failed with error
 * - task:paused - Updates task status to paused
 *
 * @example
 * ```tsx
 * // Basic usage with automatic updates
 * <ActiveTasksPanelRealtime />
 *
 * // With initial data and connection indicator
 * <ActiveTasksPanelRealtime
 *   initialTasks={tasks}
 *   showConnectionIndicator={true}
 *   connectionIndicatorSize="md"
 * />
 *
 * // Focused on specific tasks
 * <ActiveTasksPanelRealtime
 *   taskIds={['task-1', 'task-2']}
 *   maxTasks={5}
 *   compact
 * />
 * ```
 */
export function ActiveTasksPanelRealtime({
  initialTasks = [],
  onViewDetails,
  defaultShowActiveOnly = true,
  maxTasks = 10,
  compact = false,
  showConnectionIndicator = true,
  taskIds,
  connectionIndicatorSize = 'md',
  autoConnect = true,
  className,
}: ActiveTasksPanelRealtimeProps) {
  // Local state
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filter, setFilter] = useState<FilterType>(defaultShowActiveOnly ? 'active' : 'all')

  // WebSocket connection state and events
  const {
    state: { connectionState, events, isConnected, error },
    connect,
    disconnect,
  } = useRealtimeUpdates({
    autoConnect,
    subscription: {
      eventTypes: [
        'task:created',
        'task:started',
        'task:stage-changed',
        'task:completed',
        'task:failed',
        'task:paused',
      ],
      taskIds, // Optional filtering
      includeHealth: showConnectionIndicator, // Only include health if showing indicator
      includePerformance: false, // Not needed for this component
    },
  })

  /**
   * Process WebSocket events to update local task state
   */
  useEffect(() => {
    if (events.length === 0) return

    const latestEvent = events[0] // Events are sorted most recent first
    const eventType = latestEvent.type

    setTasks(prevTasks => {
      // Handle task:created - add new task
      if (eventType === 'task:created' && latestEvent.data.task) {
        const newTask = latestEvent.data.task as Task
        if (!prevTasks.some(t => t.id === newTask.id)) {
          return [newTask, ...prevTasks]
        }
        return prevTasks
      }

      // Handle task status updates
      if (eventType.startsWith('task:') && latestEvent.taskId) {
        return prevTasks.map(task => {
          if (task.id !== latestEvent.taskId) return task

          const updates: Partial<Task> = {
            updatedAt: new Date(latestEvent.timestamp),
          }

          switch (eventType) {
            case 'task:started':
              updates.status = 'running' as any // Cast to match TaskStatus
              break

            case 'task:stage-changed':
              if (latestEvent.data.stageName) {
                updates.currentStage = latestEvent.data.stageName as string
              }
              break

            case 'task:completed':
              updates.status = 'completed' as any
              break

            case 'task:failed':
              updates.status = 'failed' as any
              if (latestEvent.data.error) {
                updates.error = latestEvent.data.error as string
              }
              break

            case 'task:paused':
              updates.status = 'paused' as any
              break

            default:
              // For other task events, just update the timestamp
              break
          }

          return { ...task, ...updates }
        })
      }

      return prevTasks
    })
  }, [events])

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

  /**
   * Custom refresh handler - reconnect WebSocket if disconnected
   */
  const handleRefresh = useMemo(() => {
    return isConnected
      ? undefined // Hide refresh button when connected
      : () => {
          connect()
        }
  }, [isConnected, connect])

  // Loading state
  const loading = connectionState === 'connecting'

  // Filter options with icons
  const filterOptions: Array<{ type: FilterType; label: string; count: number; icon: React.ComponentType<any> }> = [
    { type: 'all', label: 'All', count: stats.total, icon: Filter },
    { type: 'active', label: 'Active', count: stats.active, icon: Activity },
    { type: 'completed', label: 'Completed', count: stats.completed, icon: CheckCircle },
    { type: 'failed', label: 'Failed', count: stats.failed, icon: AlertCircle },
    { type: 'paused', label: 'Paused', count: stats.paused, icon: Pause },
  ]

  return (
    <div className={className}>
      {/* Connection error display */}
      {error && (
        <div className="mb-3 p-3 bg-red-950/50 border border-red-800 rounded-md text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Connection Error</span>
          </div>
          <div className="mt-1 text-xs">{error.message}</div>
        </div>
      )}

      {/* Main panel */}
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

            <div className="flex items-center gap-2">
              {/* Connection Indicator */}
              {showConnectionIndicator && (
                <WebSocketConnectionIndicator
                  size={connectionIndicatorSize}
                  showLatency={connectionIndicatorSize !== 'sm'}
                  showTooltip={true}
                  animated={true}
                />
              )}

              {/* Refresh button (only when disconnected) */}
              {handleRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="gap-1"
                >
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                  {!compact && 'Refresh'}
                </Button>
              )}
            </div>
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
              <span className="ml-2 text-foreground-secondary">Connecting to real-time updates...</span>
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
              {!isConnected && (
                <div className="text-xs text-foreground-secondary mt-2">
                  Real-time updates disconnected. Tasks may be outdated.
                </div>
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
                />
              ))}

              {/* Show message if there are more tasks */}
              {filteredTasks.length === maxTasks && (
                <div className="text-center text-xs text-foreground-secondary py-2 border-t border-border">
                  Showing {maxTasks} most recent tasks
                  {filter !== 'all' && ` (${filter})`}
                  {isConnected && (
                    <span className="text-apex-500 ml-1">• Live updates active</span>
                  )}
                </div>
              )}

              {/* Connection status footer */}
              {!isConnected && filteredTasks.length > 0 && (
                <div className="text-center text-xs text-yellow-500 py-2 border-t border-border">
                  Real-time updates disconnected. Tasks may be outdated.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Default export for convenience
 */
export default ActiveTasksPanelRealtime