'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { apiClient } from '@/lib/api-client'
import { formatCost, getStatusVariant, formatStatus, getRelativeTime, truncateId, cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@apexcli/core'
import { Filter, RefreshCw, ChevronRight, Plus, XCircle, RotateCcw, LayoutGrid, List, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

type ViewMode = 'list' | 'kanban'

const PAGE_SIZE = 50

const STATUS_OPTIONS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Tasks' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'waiting-approval', label: 'Waiting Approval' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban') // Default to kanban view
  const [refreshKey, setRefreshKey] = useState(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadTasks = useCallback(async (pageNum?: number) => {
    const currentPage = pageNum ?? page
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.listTasks({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: PAGE_SIZE,
        offset: currentPage * PAGE_SIZE,
      })
      setTasks(response.tasks)
      setTotal(response.total || response.count || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  // Load list data when in list mode
  useEffect(() => {
    if (viewMode === 'list') {
      loadTasks()
    } else {
      // In kanban mode, just clear loading state (kanban loads its own data)
      setLoading(false)
    }
  }, [loadTasks, viewMode])

  // Reset to page 0 when filter changes
  useEffect(() => {
    setPage(0)
  }, [statusFilter])

  function handleRefresh() {
    if (viewMode === 'kanban') {
      setRefreshKey(k => k + 1)
    } else {
      loadTasks()
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasNextPage = page < totalPages - 1
  const hasPrevPage = page > 0

  function goToPage(p: number) {
    setPage(p)
    loadTasks(p)
  }

  async function handleCancel(taskId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      setActionLoading(`cancel-${taskId}`)
      await apiClient.cancelTask(taskId)
      handleRefresh()
    } catch (err) {
      console.error('Failed to cancel task:', err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRetry(taskId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      setActionLoading(`retry-${taskId}`)
      await apiClient.retryTask(taskId)
      handleRefresh()
    } catch (err) {
      console.error('Failed to retry task:', err)
    } finally {
      setActionLoading(null)
    }
  }

  function handleTaskCreated(taskId: string) {
    handleRefresh()
    router.push(`/tasks/${taskId}`)
  }

  function handleError(error: string) {
    setErrorMessage(error)
    // Auto-clear error after 5 seconds
    setTimeout(() => setErrorMessage(null), 5000)
  }

  function handleSuccess(message: string) {
    setSuccessMessage(message)
    // Auto-clear success after 3 seconds
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  if (loading && viewMode === 'list') {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <p className="text-foreground-secondary text-sm mb-4">
                Make sure the APEX API server is running:
              </p>
              <code className="bg-background-tertiary px-3 py-1 rounded text-sm">
                apex serve --port 3002
              </code>
              <div className="mt-4">
                <Button onClick={handleRefresh}>Retry</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Success/Error Notifications */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500 text-green-500 rounded-lg">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500 text-red-500 rounded-lg">
          {errorMessage}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          {viewMode === 'list' && total > 0 && (
            <p className="text-sm text-foreground-secondary mt-1">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                "p-2 transition-colors",
                viewMode === 'kanban'
                  ? "bg-apex-500 text-white"
                  : "bg-background-secondary text-foreground-secondary hover:bg-background-tertiary"
              )}
              title="Kanban view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 transition-colors",
                viewMode === 'list'
                  ? "bg-apex-500 text-white"
                  : "bg-background-secondary text-foreground-secondary hover:bg-background-tertiary"
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-foreground-secondary" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
              className="bg-background-secondary border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-apex-500"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleRefresh} disabled={loading} variant="secondary">
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleTaskCreated}
      />

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <KanbanBoard
          onCancel={handleCancel}
          onRetry={handleRetry}
          actionLoading={actionLoading}
          refreshKey={refreshKey}
          onError={handleError}
          onSuccess={handleSuccess}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-foreground-secondary">
                  {statusFilter === 'all' ? (
                    <>
                      <p>No tasks yet.</p>
                      <p className="text-sm mt-2">
                        Run <code className="bg-background-tertiary px-2 py-1 rounded">apex run "your task"</code> to create one.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>No {formatStatus(statusFilter)} tasks found.</p>
                      <p className="text-sm mt-2">
                        <button
                          onClick={() => setStatusFilter('all')}
                          className="text-apex-500 hover:underline"
                        >
                          View all tasks
                        </button>
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const isRunning = task.status === 'in-progress' || task.status === 'planning'
                const isPending = task.status === 'pending' || task.status === 'queued'
                const isFailed = task.status === 'failed'
                const isCancelled = task.status === 'cancelled'
                const canCancel = isRunning || isPending
                // Allow retry on failed, cancelled, OR stuck in-progress tasks
                const canRetry = isFailed || isCancelled || isRunning

                return (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="block">
                    <Card className="hover:border-apex-500/50 transition-colors cursor-pointer group">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium group-hover:text-apex-500 transition-colors truncate">
                              {task.description}
                            </h3>
                            <p className="text-sm text-foreground-secondary mt-1">
                              <code
                                className="bg-background-tertiary px-1.5 py-0.5 rounded cursor-pointer hover:bg-background-tertiary/80"
                                title="Click to copy full ID"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(task.id)
                                }}
                              >
                                {truncateId(task.id)}
                              </code>
                              {' · '}{task.workflow} · {getRelativeTime(task.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge variant={getStatusVariant(task.status)}>
                              {formatStatus(task.status)}
                            </Badge>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canCancel && (
                                <button
                                  onClick={(e) => handleCancel(task.id, e)}
                                  disabled={actionLoading === `cancel-${task.id}`}
                                  className="p-1.5 rounded hover:bg-red-500/10 text-foreground-secondary hover:text-red-500 transition-colors"
                                  title="Cancel task"
                                >
                                  {actionLoading === `cancel-${task.id}` ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    <XCircle className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              {canRetry && (
                                <button
                                  onClick={(e) => handleRetry(task.id, e)}
                                  disabled={actionLoading === `retry-${task.id}`}
                                  className="p-1.5 rounded hover:bg-green-500/10 text-foreground-secondary hover:text-green-500 transition-colors"
                                  title="Retry task"
                                >
                                  {actionLoading === `retry-${task.id}` ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    <RotateCcw className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>

                            <ChevronRight className="w-5 h-5 text-foreground-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6 text-sm text-foreground-secondary">
                            <span>Stage: {task.currentStage || 'N/A'}</span>
                            <span>Tokens: {task.usage?.totalTokens?.toLocaleString() || 0}</span>
                            <span>Cost: {formatCost(task.usage?.estimatedCost || 0)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Pagination (list view only) */}
      {viewMode === 'list' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            variant="secondary"
            onClick={() => goToPage(page - 1)}
            disabled={!hasPrevPage}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-foreground-secondary">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => goToPage(page + 1)}
            disabled={!hasNextPage}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
