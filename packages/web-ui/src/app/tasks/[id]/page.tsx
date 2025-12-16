'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { LogViewer } from '@/components/tasks/LogViewer'
import { GatePanel } from '@/components/tasks/GatePanel'
import { SubtaskList, ParentTaskInfo } from '@/components/tasks/SubtaskList'
import { TokenUsageChart } from '@/components/charts/TokenUsageChart'
import { apiClient } from '@/lib/api-client'
import { useTaskStream } from '@/lib/websocket-client'
import { formatCost, getStatusVariant, formatStatus, formatDate, truncateId } from '@/lib/utils'
import { ChevronLeft, RefreshCw, XCircle, RotateCcw, Clock, GitBranch, User, Play } from 'lucide-react'
import type { Task, ApexEvent } from '@apex/core'

interface LogEntry {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  agent?: string
  stage?: string
}

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = params.id as string

  const [task, setTask] = useState<Task | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [hasSubtasks, setHasSubtasks] = useState(false)

  // WebSocket streaming for real-time updates
  const { events, isConnected } = useTaskStream(taskId)

  // Load initial task data
  const loadTask = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getTask(taskId) as unknown as Task & { logs?: Array<{ timestamp: string; level: string; message: string; agent?: string; stage?: string }> }
      setTask(response as Task)

      // Load initial logs from task response
      if (response.logs && response.logs.length > 0) {
        const initialLogs: LogEntry[] = response.logs.map(log => ({
          timestamp: new Date(log.timestamp),
          level: (log.level || 'info') as LogEntry['level'],
          message: log.message || '',
          agent: log.agent,
          stage: log.stage,
        }))
        // Show most recent logs first (reverse order), limit to last 100
        setLogs(initialLogs.slice(0, 100).reverse())
      }

      // Check if task has subtasks
      try {
        const subtaskResponse = await apiClient.getSubtasks(taskId)
        setHasSubtasks(subtaskResponse.count > 0)
      } catch {
        setHasSubtasks(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    loadTask()
  }, [loadTask])

  // Process WebSocket events to update task and logs
  useEffect(() => {
    if (events.length === 0) return

    const latestEvent = events[events.length - 1]

    // Update task state from events
    if (latestEvent.type.startsWith('task:') && latestEvent.data) {
      setTask(prev => {
        if (!prev) return prev
        return {
          ...prev,
          ...(latestEvent.data as Partial<Task>),
        }
      })
    }

    // Add log entries
    if (latestEvent.type === 'log:entry') {
      const logData = latestEvent.data as { level?: string; message?: string; agent?: string }
      setLogs(prev => [...prev, {
        timestamp: latestEvent.timestamp,
        level: (logData.level || 'info') as LogEntry['level'],
        message: logData.message || '',
        agent: logData.agent,
      }])
    }

    // Add agent messages as info logs
    if (latestEvent.type === 'agent:message') {
      const msgData = latestEvent.data as { message?: string }
      setLogs(prev => [...prev, {
        timestamp: latestEvent.timestamp,
        level: 'info',
        message: msgData.message || '',
      }])
    }

    // Add tool use as debug logs
    if (latestEvent.type === 'agent:tool-use') {
      const toolData = latestEvent.data as { tool?: string; input?: unknown }
      setLogs(prev => [...prev, {
        timestamp: latestEvent.timestamp,
        level: 'debug',
        message: `Tool: ${toolData.tool || 'unknown'}`,
      }])
    }

    // Update usage from usage events
    if (latestEvent.type === 'usage:updated') {
      setTask(prev => {
        if (!prev) return prev
        const usageData = latestEvent.data as Record<string, unknown>
        return {
          ...prev,
          usage: {
            inputTokens: (usageData.inputTokens as number) || prev.usage.inputTokens,
            outputTokens: (usageData.outputTokens as number) || prev.usage.outputTokens,
            totalTokens: (usageData.totalTokens as number) || prev.usage.totalTokens,
            estimatedCost: (usageData.estimatedCost as number) || prev.usage.estimatedCost,
          },
        }
      })
    }
  }, [events])

  // Task actions
  const handleCancel = async () => {
    try {
      setActionLoading('cancel')
      await apiClient.cancelTask(taskId)
      await loadTask()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRetry = async () => {
    try {
      setActionLoading('retry')
      await apiClient.retryTask(taskId)
      await loadTask()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry task')
    } finally {
      setActionLoading(null)
    }
  }

  const handleResume = async () => {
    try {
      setActionLoading('resume')
      await apiClient.resumeTask(taskId)
      await loadTask()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume task')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Link
          href="/tasks"
          className="flex items-center gap-2 text-foreground-secondary hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Tasks
        </Link>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={loadTask}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="p-8">
        <Link
          href="/tasks"
          className="flex items-center gap-2 text-foreground-secondary hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Tasks
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-foreground-secondary">Task not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isRunning = task.status === 'in-progress' || task.status === 'planning'
  const isFailed = task.status === 'failed'
  const isCancelled = task.status === 'cancelled'
  const isPending = task.status === 'pending' || task.status === 'queued'
  const isPaused = task.status === 'paused'
  const isWaitingApproval = task.status === 'waiting-approval'
  // Can retry failed, cancelled, or stuck in-progress tasks
  const canRetry = isFailed || isCancelled || isRunning
  // Can resume paused or pending tasks (pending tasks can be started)
  const canResume = isPaused || isPending

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/tasks"
          className="flex items-center gap-2 text-foreground-secondary hover:text-foreground mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Tasks
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold truncate">{task.description}</h1>
              <Badge variant={getStatusVariant(task.status)}>
                {formatStatus(task.status)}
              </Badge>
              {isConnected && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-foreground-secondary">
              <span
                className="font-mono cursor-pointer hover:text-foreground"
                onClick={() => navigator.clipboard.writeText(task.id)}
                title="Click to copy"
              >
                {truncateId(task.id, 12)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(task.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                {task.workflow}
              </span>
              {task.parentTaskId && (
                <ParentTaskInfo parentTaskId={task.parentTaskId} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={loadTask}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            {(isRunning || isPending) && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancel}
                disabled={actionLoading === 'cancel'}
              >
                {actionLoading === 'cancel' ? (
                  <Spinner size="sm" className="mr-1" />
                ) : (
                  <XCircle className="w-4 h-4 mr-1" />
                )}
                Cancel
              </Button>
            )}
            {canRetry && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRetry}
                disabled={actionLoading === 'retry'}
              >
                {actionLoading === 'retry' ? (
                  <Spinner size="sm" className="mr-1" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-1" />
                )}
                {isRunning ? 'Restart' : 'Retry'}
              </Button>
            )}
            {canResume && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleResume}
                disabled={actionLoading === 'resume'}
              >
                {actionLoading === 'resume' ? (
                  <Spinner size="sm" className="mr-1" />
                ) : (
                  <Play className="w-4 h-4 mr-1" />
                )}
                {isPending ? 'Start' : 'Resume'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Approval Gate Panel */}
          {isWaitingApproval && (
            <GatePanel
              taskId={task.id}
              onApproved={loadTask}
              onRejected={loadTask}
            />
          )}

          {/* Subtasks Panel */}
          {hasSubtasks && (
            <SubtaskList taskId={task.id} />
          )}

          {/* Live Logs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Live Logs</h2>
                {logs.length > 0 && (
                  <span className="text-sm text-foreground-secondary">
                    {logs.length} entries
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <LogViewer logs={logs} maxHeight={400} />
            </CardContent>
          </Card>

          {/* Task Details */}
          {task.acceptanceCriteria && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Acceptance Criteria</h2>
              </CardHeader>
              <CardContent>
                <p className="text-foreground-secondary whitespace-pre-wrap">
                  {task.acceptanceCriteria}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Token Usage */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Token Usage</h2>
            </CardHeader>
            <CardContent>
              <TokenUsageChart usage={task.usage} />
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground-secondary">Estimated Cost</span>
                  <span className="font-medium">{formatCost(task.usage?.estimatedCost || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Info */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Details</h2>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-foreground-secondary">Current Stage</dt>
                  <dd className="font-medium">{task.currentStage || 'N/A'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground-secondary">Workflow</dt>
                  <dd className="font-medium">{task.workflow}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground-secondary">Autonomy</dt>
                  <dd className="font-medium">{task.autonomy || 'default'}</dd>
                </div>
                {task.branchName && (
                  <div className="flex justify-between">
                    <dt className="text-foreground-secondary">Branch</dt>
                    <dd className="font-mono text-xs">{task.branchName}</dd>
                  </div>
                )}
                {task.prUrl && (
                  <div className="flex justify-between">
                    <dt className="text-foreground-secondary">Pull Request</dt>
                    <dd>
                      <a
                        href={task.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-apex-500 hover:underline"
                      >
                        View PR
                      </a>
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-foreground-secondary">Created</dt>
                  <dd>{formatDate(task.createdAt)}</dd>
                </div>
                {task.updatedAt && (
                  <div className="flex justify-between">
                    <dt className="text-foreground-secondary">Updated</dt>
                    <dd>{formatDate(task.updatedAt)}</dd>
                  </div>
                )}
                {task.completedAt && (
                  <div className="flex justify-between">
                    <dt className="text-foreground-secondary">Completed</dt>
                    <dd>{formatDate(task.completedAt)}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Error Details */}
          {task.error && (
            <Card className="border-red-500/50">
              <CardHeader>
                <h2 className="text-lg font-semibold text-red-500">Error</h2>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-red-400 whitespace-pre-wrap break-words">
                  {task.error}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
