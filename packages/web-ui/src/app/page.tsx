'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout'
import { Card, CardHeader, CardContent } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { ActiveTasksPanelRealtime } from '@/components/tasks/ActiveTasksPanelRealtime'
import { BudgetWidget } from '@/components/dashboard/BudgetWidget'
import { AgentUtilizationWidget } from '@/components/dashboard/AgentUtilizationWidget'
import { ProjectHealthPanel } from '@/components/dashboard/ProjectHealthPanel'
import { PerformanceMetricsPanel } from '@/components/dashboard/PerformanceMetricsPanel'
import { QuickActionsBar } from '@/components/dashboard/QuickActionsBar'
import { ParallelAgentView } from '@/components/agents/ParallelAgentView'
import { apiClient } from '@/lib/api-client'
import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'
import { useParallelAgentView } from '@/hooks/useParallelAgentView'
import { formatCost, getStatusVariant, formatStatus, getRelativeTime, truncateId } from '@/lib/utils'
import type { Task } from '@apexcli/core'
import type { ProjectHealthMetrics } from '@/types/project-health'
import type { AggregatedPerformanceMetrics } from '@/types/performance-metrics'
import { mapConnectionToProjectHealth } from '@/types/project-health'
import { useNotifications } from '@/components/notifications'

export default function DashboardPage() {
  const router = useRouter()
  const { success, error: notifyError, warning, info } = useNotifications()
  const [stats, setStats] = useState<{
    byStatus: Record<string, number>
    totalCost: number
    totalTokens: number
  } | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Real-time updates with shared WebSocket connection
  const {
    state: realtimeState,
    connect: connectRealtime,
    disconnect: disconnectRealtime,
    refreshPerformance,
    checkHealth,
  } = useRealtimeUpdates({
    autoConnect: true,
    subscription: {
      includeHealth: true,
      includePerformance: true,
      performanceUpdateInterval: 5000,
    },
  })

  // Parallel agent view with real-time updates
  const {
    data: parallelAgentData,
    loading: parallelLoading,
    error: parallelError,
    isConnected: parallelConnected,
    refresh: refreshParallelAgents,
  } = useParallelAgentView({
    autoRefresh: true,
    refreshInterval: 3000,
    enableRealtime: true,
  })

  useEffect(() => {
    loadDashboard()
  }, [])

  // Connect real-time updates on mount
  useEffect(() => {
    return () => {
      disconnectRealtime()
    }
  }, [disconnectRealtime])

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)
      const [statsData, tasksData] = await Promise.all([
        apiClient.getTaskStats(),
        apiClient.listTasks({ limit: 20 }), // Increased limit for ActiveTasksPanel
      ])
      setStats(statsData)
      setTasks(tasksData.tasks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  // Navigation handler for view details
  const handleViewDetails = (taskId: string) => {
    router.push(`/tasks/${taskId}`)
  }

  // Transform real-time health data to ProjectHealthMetrics format
  const healthMetrics: ProjectHealthMetrics | null = useMemo(() => {
    if (!realtimeState.health) return null

    const health = realtimeState.health
    const totalTasks = (health.tasks?.completedLastHour || 0) + (health.tasks?.failedLastHour || 0)
    const successRate = totalTasks > 0 ? ((health.tasks?.completedLastHour || 0) / totalTasks) * 100 : 100

    return {
      status: mapConnectionToProjectHealth(health.status),
      successRate,
      averageDurationMs: health.tasks?.averageDurationMs || 0,
      systemHealth: health.server?.successRate || 100,
      tasks: health.tasks ? {
        activeTasks: health.tasks.activeTasks,
        pendingTasks: health.tasks.pendingTasks,
        completedTasks: health.tasks.completedLastHour,
        failedTasks: health.tasks.failedLastHour,
      } : undefined,
      connection: health.connection ? {
        isConnected: health.connection.isConnected,
        latencyMs: health.connection.latencyMs,
        averageLatencyMs: health.connection.averageLatencyMs,
        reconnectAttempts: health.connection.reconnectAttempts,
        connectedSince: health.connection.connectedSince,
      } : undefined,
      lastUpdated: health.lastUpdated,
    }
  }, [realtimeState.health])

  // Transform real-time performance data to PerformanceMetricsPanel format
  const performanceMetrics: AggregatedPerformanceMetrics | null = useMemo(() => {
    if (!realtimeState.performance) return null

    const perf = realtimeState.performance

    // Transform token usage data to match TokenUsageOverTimeData interface
    const tokenUsageData = {
      data: [{
        timestamp: new Date(),
        totalTokens: perf.tokenUsage.totalTokens,
        breakdown: {
          inputTokens: perf.tokenUsage.inputTokens,
          outputTokens: perf.tokenUsage.outputTokens,
          cacheCreationTokens: 0, // No cache data available from real-time
          cacheReadTokens: 0,
        },
        tokensPerMinute: perf.tokenUsage.tokensPerMinute,
        cost: perf.tokenUsage.estimatedCost,
      }],
      totalInputTokens: perf.tokenUsage.inputTokens,
      totalOutputTokens: perf.tokenUsage.outputTokens,
      totalTokens: perf.tokenUsage.totalTokens,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      cacheHitRate: perf.tokenUsage.cacheHitRate * 100,
      avgTokensPerMinute: perf.tokenUsage.tokensPerMinute,
      peakTokensPerMinute: perf.tokenUsage.tokensPerMinute, // No historical data for peak
      totalCost: perf.tokenUsage.estimatedCost,
      timeRange: perf.timeRange,
      generatedAt: new Date(),
    }

    // Transform task completion data to match TaskCompletionRateData interface
    const totalProcessed = perf.tasks.completedTasks + perf.tasks.failedTasks
    const taskCompletionData = {
      data: [{
        timestamp: new Date(),
        completionRate: totalProcessed > 0 ? (perf.tasks.completedTasks / totalProcessed) * 100 : 0,
        successRate: perf.tasks.successRate * 100,
        completedCount: perf.tasks.completedTasks,
        failedCount: perf.tasks.failedTasks,
        totalProcessed,
        avgDurationMs: perf.tasks.avgDurationMs,
      }],
      overallCompletionRate: totalProcessed > 0 ? (perf.tasks.completedTasks / totalProcessed) * 100 : 0,
      overallSuccessRate: perf.tasks.successRate * 100,
      totalCompleted: perf.tasks.completedTasks,
      totalFailed: perf.tasks.failedTasks,
      totalProcessed,
      statusCounts: {
        completed: perf.tasks.completedTasks,
        failed: perf.tasks.failedTasks,
        inProgress: 0, // No data available from real-time
        pending: 0,
        cancelled: 0,
        paused: 0,
      },
      byStatus: perf.tasks.byStatus,
      avgDurationMs: perf.tasks.avgDurationMs,
      medianDurationMs: perf.tasks.medianDurationMs,
      p95DurationMs: perf.tasks.p95DurationMs,
      timeRange: perf.timeRange,
      generatedAt: new Date(),
    }

    // Transform cost trend data to match CostTrendData interface
    const totalTasks = perf.tasks.completedTasks + perf.tasks.failedTasks
    const costTrendData = {
      data: [{
        timestamp: new Date(),
        cost: perf.tokenUsage.estimatedCost,
        cumulativeCost: perf.tokenUsage.estimatedCost,
      }],
      totalCost: perf.tokenUsage.estimatedCost,
      avgCostPerHour: perf.tokenUsage.estimatedCost, // Would need historical data for proper calculation
      avgCostPerTask: totalTasks > 0 ? perf.tokenUsage.estimatedCost / totalTasks : 0,
      peakHourlyCost: perf.tokenUsage.estimatedCost,
      breakdown: {
        inputTokenCost: perf.tokenUsage.estimatedCost * 0.6, // Estimated breakdown
        outputTokenCost: perf.tokenUsage.estimatedCost * 0.4,
        cacheCreationCost: 0,
        cacheReadCost: 0,
        otherCost: 0,
      },
      budgetLimit: 1000, // Default budget limit
      dailyBudgetLimit: 50,
      budgetUtilization: (perf.tokenUsage.estimatedCost / 1000) * 100,
      projectedRemainingCost: perf.tokenUsage.estimatedCost * 30, // Simple projection
      timeRange: perf.timeRange,
      generatedAt: new Date(),
    }

    return {
      timeRange: perf.timeRange,
      tokenUsage: tokenUsageData,
      taskCompletion: taskCompletionData,
      costTrend: costTrendData,
      generatedAt: perf.generatedAt,
    }
  }, [realtimeState.performance])

  // Refresh handler that updates both API data and real-time data
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      loadDashboard(),
      refreshPerformance(),
      checkHealth(),
      refreshParallelAgents(),
    ])
  }, [refreshPerformance, checkHealth, refreshParallelAgents])

  // Note: Task actions (cancel/retry) are now handled by the real-time panel component itself
  // through WebSocket events and direct API calls, eliminating the need for manual refresh

  const pendingTasks = (stats?.byStatus['pending'] || 0) + (stats?.byStatus['queued'] || 0)
  const activeTasks = (stats?.byStatus['planning'] || 0) + (stats?.byStatus['in-progress'] || 0) + (stats?.byStatus['waiting-approval'] || 0)
  const pausedTasks = stats?.byStatus['paused'] || 0
  const completedTasks = stats?.byStatus['completed'] || 0
  const failedTasks = stats?.byStatus['failed'] || 0
  const totalCost = stats?.totalCost || 0

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
        <Header
          title="Dashboard"
          description="Overview of your APEX project and recent activity"
        />
        <div className="mt-8">
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
      </div>
    )
  }

  return (
    <div className="p-8">
      <Header
        title="Dashboard"
        description="Overview of your APEX project and recent activity"
        actions={<Button onClick={handleRefresh}>Refresh</Button>}
      />

      {/* Responsive dashboard layout with Quick Actions */}
      <div className="mt-8 space-y-8">
        {/* Row 0: Quick Actions Bar */}
        <QuickActionsBar
          onTaskCreated={(taskId, templateId) => {
            console.log(`Task ${taskId} created from template ${templateId}`)
            // Show success notification
            success('Task Created', `Task ${truncateId(taskId)} created successfully from ${templateId} template`)
            // Refresh dashboard data to show the new task
            handleRefresh()
            // Navigate to the task detail page
            router.push(`/tasks/${taskId}`)
          }}
          onError={(err, templateId) => {
            console.error(`Failed to create task from template ${templateId}:`, err)
            // Show error notification
            notifyError('Task Creation Failed', `Failed to create task from ${templateId} template: ${err}`)
          }}
          maxActions={6}
          showIcons={true}
          compact={false}
        />

        {/* Demo Notification Buttons (for development) */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Notification System Demo</h3>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => success('Success!', 'This is a success notification')}
                className="bg-green-600 hover:bg-green-700"
              >
                Success Toast
              </Button>
              <Button
                size="sm"
                onClick={() => notifyError('Error!', 'This is an error notification')}
                variant="danger"
              >
                Error Toast
              </Button>
              <Button
                size="sm"
                onClick={() => warning('Warning!', 'This is a warning notification')}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                Warning Toast
              </Button>
              <Button
                size="sm"
                onClick={() => info('Info', 'This is an info notification')}
              >
                Info Toast
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Row 1: Task Status Overview - 6 column metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Pending</h3>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-500">{pendingTasks}</div>
              <p className="text-sm text-foreground-secondary mt-1">
                Waiting to start
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Active</h3>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-apex-500">{activeTasks}</div>
              <p className="text-sm text-foreground-secondary mt-1">
                Currently running
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Paused</h3>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">{pausedTasks}</div>
              <p className="text-sm text-foreground-secondary mt-1">
                Rate limited
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Completed</h3>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">{completedTasks}</div>
              <p className="text-sm text-foreground-secondary mt-1">
                Successfully finished
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Failed</h3>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">{failedTasks}</div>
              <p className="text-sm text-foreground-secondary mt-1">
                Need attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Total Cost</h3>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{formatCost(totalCost)}</div>
              <p className="text-sm text-foreground-secondary mt-1">
                Lifetime usage
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Project Health Panel - Full width */}
        <div className="grid gap-6">
          <ProjectHealthPanel
            metrics={healthMetrics || undefined}
            isLoading={loading && !healthMetrics}
            error={realtimeState.error}
            timeRange="1h"
            showDetails={true}
            showConnectionStatus={true}
            onRefresh={handleRefresh}
          />
        </div>

        {/* Row 3: Performance Metrics Panel - Full width */}
        <div className="grid gap-6">
          <PerformanceMetricsPanel
            data={performanceMetrics || undefined}
            timeRange="24h"
            showTimeRangeSelector={true}
            showTokenUsage={true}
            showTaskCompletion={true}
            showCostTrend={true}
            chartVariant="line"
            chartSize="md"
            animated={true}
            loading={loading && !performanceMetrics}
            error={realtimeState.error?.message}
            onRefresh={refreshPerformance}
            autoRefresh={true}
            autoRefreshInterval={5000}
          />
        </div>

        {/* Row 3.5: Parallel Agent Execution View - Full width */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Parallel Agent Execution</h2>
                {parallelConnected && (
                  <Badge variant="success" className="text-xs">
                    Live
                  </Badge>
                )}
                {parallelAgentData.runningCount > 0 && (
                  <Badge variant="apex" className="text-xs">
                    {parallelAgentData.runningCount} active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ParallelAgentView
                data={parallelAgentData}
                config={{
                  layout: 'lanes',
                  size: 'md',
                  showProgress: true,
                  showElapsedTime: true,
                  showTokenUsage: false,
                  showCost: false,
                  showStages: true,
                  animated: true,
                  maxLanes: 4,
                  maxAgentsPerLane: 6,
                }}
                onAgentClick={(execution) => {
                  // Navigate to task detail if task ID is available
                  if (execution.taskId) {
                    router.push(`/tasks/${execution.taskId}`)
                  }
                }}
                onAgentPause={async (executionId) => {
                  // In a real implementation, this would call an API
                  console.log('Pausing execution:', executionId)
                }}
                onAgentResume={async (executionId) => {
                  console.log('Resuming execution:', executionId)
                }}
                onAgentCancel={async (executionId) => {
                  console.log('Cancelling execution:', executionId)
                }}
                onAgentRetry={async (executionId) => {
                  console.log('Retrying execution:', executionId)
                }}
                loading={parallelLoading}
                error={parallelError}
                testId="dashboard-parallel-agent-view"
              />
            </CardContent>
          </Card>
        </div>

        {/* Row 4: Budget and Agent Utilization Widgets - 2 columns */}
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <BudgetWidget
            budgetLimit={1000} // Default budget limit - could be configurable
            size="md"
            thresholds={{
              warning: 75,
              danger: 90,
            }}
            onRefresh={handleRefresh}
            autoRefreshInterval={0} // Use real-time updates
          />
          <AgentUtilizationWidget
            maxAgents={6}
            height={300}
            showCost={true}
            showPerformance={false}
            showTokenBreakdown={true}
            onRefresh={handleRefresh}
            onAgentClick={(agent) => {
              // Could navigate to agent details page if it exists
              console.log('Agent clicked:', agent.agentName, agent)
            }}
          />
        </div>

        {/* Row 5: Active Tasks Panel - Full width */}
        <div className="grid gap-6">
          <ActiveTasksPanelRealtime
            initialTasks={tasks}
            onViewDetails={handleViewDetails}
            defaultShowActiveOnly={false}
            maxTasks={15}
            compact={false}
            showConnectionIndicator={true}
            connectionIndicatorSize="md"
            autoConnect={true}
          />
        </div>
      </div>
    </div>
  )
}
