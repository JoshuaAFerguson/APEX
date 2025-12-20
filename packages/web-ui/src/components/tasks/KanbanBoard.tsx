'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatCost, getRelativeTime, truncateId, cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@apexcli/core'
import {
  Clock,
  Coins,
  Hash,
  GitBranch,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Layers
} from 'lucide-react'

// Kanban column definitions with their associated statuses
const KANBAN_COLUMNS: {
  id: string
  title: string
  statuses: TaskStatus[]
  color: string
}[] = [
  {
    id: 'pending',
    title: 'Pending',
    statuses: ['pending', 'queued'],
    color: 'border-t-gray-500'
  },
  {
    id: 'planning',
    title: 'Planning',
    statuses: ['planning'],
    color: 'border-t-blue-500'
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    statuses: ['in-progress'],
    color: 'border-t-yellow-500'
  },
  {
    id: 'waiting',
    title: 'Waiting Approval',
    statuses: ['waiting-approval', 'paused'],
    color: 'border-t-orange-500'
  },
  {
    id: 'completed',
    title: 'Completed',
    statuses: ['completed'],
    color: 'border-t-green-500'
  },
  {
    id: 'failed',
    title: 'Failed / Cancelled',
    statuses: ['failed', 'cancelled'],
    color: 'border-t-red-500'
  },
]

interface KanbanBoardProps {
  tasks: Task[]
  onCancel: (taskId: string, e: React.MouseEvent) => void
  onRetry: (taskId: string, e: React.MouseEvent) => void
  actionLoading: string | null
}

export function KanbanBoard({ tasks, onCancel, onRetry, actionLoading }: KanbanBoardProps) {
  // Group tasks by column
  const tasksByColumn = KANBAN_COLUMNS.reduce((acc, column) => {
    acc[column.id] = tasks.filter(task => column.statuses.includes(task.status))
    return acc
  }, {} as Record<string, Task[]>)

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
      {KANBAN_COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          tasks={tasksByColumn[column.id]}
          onCancel={onCancel}
          onRetry={onRetry}
          actionLoading={actionLoading}
        />
      ))}
    </div>
  )
}

interface KanbanColumnProps {
  column: typeof KANBAN_COLUMNS[0]
  tasks: Task[]
  onCancel: (taskId: string, e: React.MouseEvent) => void
  onRetry: (taskId: string, e: React.MouseEvent) => void
  actionLoading: string | null
}

function KanbanColumn({ column, tasks, onCancel, onRetry, actionLoading }: KanbanColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className={cn(
      "flex-shrink-0 w-80 bg-background-secondary rounded-lg border border-border",
      "border-t-4",
      column.color
    )}>
      {/* Column Header */}
      <div
        className="p-3 border-b border-border flex items-center justify-between cursor-pointer hover:bg-background-tertiary/50"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-foreground-secondary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-foreground-secondary" />
          )}
          <h3 className="font-semibold text-sm">{column.title}</h3>
        </div>
        <Badge variant="default" className="text-xs">
          {tasks.length}
        </Badge>
      </div>

      {/* Column Content */}
      {!isCollapsed && (
        <div className="p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="text-center text-foreground-secondary text-sm py-8 opacity-50">
              No tasks
            </div>
          ) : (
            tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onCancel={onCancel}
                onRetry={onRetry}
                actionLoading={actionLoading}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface KanbanCardProps {
  task: Task
  onCancel: (taskId: string, e: React.MouseEvent) => void
  onRetry: (taskId: string, e: React.MouseEvent) => void
  actionLoading: string | null
}

function KanbanCard({ task, onCancel, onRetry, actionLoading }: KanbanCardProps) {
  const isRunning = task.status === 'in-progress' || task.status === 'planning'
  const isPending = task.status === 'pending' || task.status === 'queued'
  const isFailed = task.status === 'failed'
  const isCancelled = task.status === 'cancelled'
  const canCancel = isRunning || isPending
  const canRetry = isFailed || isCancelled || isRunning
  const hasSubtasks = task.subtaskIds && task.subtaskIds.length > 0

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className={cn(
        "bg-background rounded-md border border-border p-3 cursor-pointer",
        "hover:border-apex-500/50 hover:shadow-md transition-all group",
        isRunning && "border-l-2 border-l-yellow-500",
        isFailed && "border-l-2 border-l-red-500"
      )}>
        {/* Task Title */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-apex-500 transition-colors">
            {task.description}
          </h4>
          {isRunning && (
            <div className="flex-shrink-0">
              <Spinner size="sm" />
            </div>
          )}
        </div>

        {/* Task Meta */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-secondary mb-2">
          <span className="flex items-center gap-1" title="Task ID">
            <Hash className="w-3 h-3" />
            {truncateId(task.id, 8)}
          </span>
          <span className="flex items-center gap-1" title="Workflow">
            <GitBranch className="w-3 h-3" />
            {task.workflow}
          </span>
          {hasSubtasks && (
            <span className="flex items-center gap-1 text-apex-500" title="Has subtasks">
              <Layers className="w-3 h-3" />
              {task.subtaskIds?.length}
            </span>
          )}
        </div>

        {/* Current Stage (if running) */}
        {task.currentStage && (
          <div className="text-xs bg-background-tertiary rounded px-2 py-1 mb-2 truncate">
            Stage: <span className="text-foreground font-medium">{task.currentStage}</span>
          </div>
        )}

        {/* Footer with stats and actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-3 text-xs text-foreground-secondary">
            <span className="flex items-center gap-1" title="Tokens used">
              <Hash className="w-3 h-3" />
              {((task.usage?.totalTokens || 0) / 1000).toFixed(1)}k
            </span>
            <span className="flex items-center gap-1" title="Cost">
              <Coins className="w-3 h-3" />
              {formatCost(task.usage?.estimatedCost || 0)}
            </span>
            <span className="flex items-center gap-1" title="Created">
              <Clock className="w-3 h-3" />
              {getRelativeTime(task.createdAt)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canCancel && (
              <button
                onClick={(e) => onCancel(task.id, e)}
                disabled={actionLoading === `cancel-${task.id}`}
                className="p-1 rounded hover:bg-red-500/10 text-foreground-secondary hover:text-red-500 transition-colors"
                title="Cancel task"
              >
                {actionLoading === `cancel-${task.id}` ? (
                  <Spinner size="sm" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {canRetry && (
              <button
                onClick={(e) => onRetry(task.id, e)}
                disabled={actionLoading === `retry-${task.id}`}
                className="p-1 rounded hover:bg-green-500/10 text-foreground-secondary hover:text-green-500 transition-colors"
                title={isRunning ? "Restart task" : "Retry task"}
              >
                {actionLoading === `retry-${task.id}` ? (
                  <Spinner size="sm" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error indicator */}
        {task.error && (
          <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1 truncate" title={task.error}>
            {task.error}
          </div>
        )}
      </div>
    </Link>
  )
}
