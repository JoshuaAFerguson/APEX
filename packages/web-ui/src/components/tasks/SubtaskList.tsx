'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import { getStatusVariant, formatStatus, truncateId } from '@/lib/utils'
import {
  GitBranch,
  ChevronRight,
  Play,
  RefreshCw,
  ListTree,
  ArrowUpRight,
} from 'lucide-react'
import type { Task } from '@apexcli/core'
import { cn } from '@/lib/utils'

interface SubtaskListProps {
  taskId: string
  className?: string
  onSubtaskClick?: (subtaskId: string) => void
}

interface SubtaskStatus {
  total: number
  completed: number
  failed: number
  pending: number
  inProgress: number
}

export function SubtaskList({ taskId, className, onSubtaskClick }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [status, setStatus] = useState<SubtaskStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSubtasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [subtasksResponse, statusResponse] = await Promise.all([
        apiClient.getSubtasks(taskId),
        apiClient.getSubtaskStatus(taskId),
      ])

      setSubtasks(subtasksResponse.subtasks)
      setStatus(statusResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subtasks')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    loadSubtasks()
  }, [loadSubtasks])

  const handleExecuteSubtasks = async () => {
    try {
      setExecuting(true)
      await apiClient.executeSubtasks(taskId)
      // Reload to show updated status
      await loadSubtasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute subtasks')
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <Spinner size="sm" />
            <span className="ml-2 text-sm text-foreground-secondary">Loading subtasks...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn('border-red-500/50', className)}>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <Button variant="secondary" size="sm" onClick={loadSubtasks}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (subtasks.length === 0) {
    return null // Don't render if there are no subtasks
  }

  const completionPercent = status ? Math.round((status.completed / status.total) * 100) : 0
  const hasRunningTasks = status ? status.inProgress > 0 : false
  const hasPendingTasks = status ? status.pending > 0 : false
  const allCompleted = status ? status.completed === status.total : false

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTree className="w-5 h-5 text-apex-500" />
            <h2 className="text-lg font-semibold">Subtasks</h2>
            {status && (
              <span className="text-sm text-foreground-secondary">
                ({status.completed}/{status.total})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadSubtasks}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {hasPendingTasks && !hasRunningTasks && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteSubtasks}
                disabled={executing}
              >
                {executing ? (
                  <Spinner size="sm" className="mr-1" />
                ) : (
                  <Play className="w-4 h-4 mr-1" />
                )}
                Execute
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Progress bar */}
        {status && status.total > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-foreground-secondary">Progress</span>
              <span className="font-medium">{completionPercent}%</span>
            </div>
            <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  allCompleted ? 'bg-green-500' : 'bg-apex-500'
                )}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className="flex gap-3 mt-2 text-xs text-foreground-secondary">
              {status.completed > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {status.completed} completed
                </span>
              )}
              {status.inProgress > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  {status.inProgress} running
                </span>
              )}
              {status.pending > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  {status.pending} pending
                </span>
              )}
              {status.failed > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {status.failed} failed
                </span>
              )}
            </div>
          </div>
        )}

        {/* Subtask list */}
        <div className="space-y-2">
          {subtasks.map((subtask) => (
            <SubtaskItem
              key={subtask.id}
              subtask={subtask}
              onClick={() => onSubtaskClick?.(subtask.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface SubtaskItemProps {
  subtask: Task
  onClick?: () => void
}

function SubtaskItem({ subtask, onClick }: SubtaskItemProps) {
  return (
    <Link
      href={`/tasks/${subtask.id}`}
      className="block group"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="flex items-center justify-between p-3 rounded-lg bg-background-secondary hover:bg-background-tertiary transition-colors">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <GitBranch className="w-4 h-4 text-foreground-secondary flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{subtask.description}</p>
            <p className="text-xs text-foreground-secondary font-mono">
              {truncateId(subtask.id, 12)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <Badge variant={getStatusVariant(subtask.status)} className="text-xs">
            {formatStatus(subtask.status)}
          </Badge>
          <ArrowUpRight className="w-4 h-4 text-foreground-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Link>
  )
}

/**
 * Component to show parent task info on a subtask page
 */
interface ParentTaskInfoProps {
  parentTaskId: string
  className?: string
}

export function ParentTaskInfo({ parentTaskId, className }: ParentTaskInfoProps) {
  const [parentTask, setParentTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadParent() {
      try {
        const task = await apiClient.getTask(parentTaskId)
        setParentTask(task as unknown as Task)
      } catch {
        // Ignore errors - parent might not exist
      } finally {
        setLoading(false)
      }
    }
    loadParent()
  }, [parentTaskId])

  if (loading || !parentTask) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm text-foreground-secondary', className)}>
      <ListTree className="w-4 h-4" />
      <span>Subtask of</span>
      <Link
        href={`/tasks/${parentTaskId}`}
        className="text-apex-500 hover:underline flex items-center gap-1"
      >
        {truncateId(parentTaskId, 8)}
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
