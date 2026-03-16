'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout'
import { Card, CardHeader, CardContent } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { ActiveTasksPanelRealtime } from '@/components/tasks/ActiveTasksPanelRealtime'
import { BudgetWidget } from '@/components/dashboard/BudgetWidget'
import { AgentUtilizationWidget } from '@/components/dashboard/AgentUtilizationWidget'
import { apiClient } from '@/lib/api-client'
import { formatCost, getStatusVariant, formatStatus, getRelativeTime, truncateId } from '@/lib/utils'
import type { Task } from '@apexcli/core'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<{
    byStatus: Record<string, number>
    totalCost: number
    totalTokens: number
  } | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

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
                  <Button onClick={loadDashboard}>Retry</Button>
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
        actions={<Button onClick={loadDashboard}>Refresh</Button>}
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

      {/* Budget and Agent Utilization Widgets */}
      <div className="mt-8 grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <BudgetWidget
          budgetLimit={1000} // Default budget limit - could be configurable
          size="md"
          thresholds={{
            warning: 75,
            danger: 90,
          }}
          onRefresh={loadDashboard}
          autoRefreshInterval={0} // Use real-time updates
        />
        <AgentUtilizationWidget
          maxAgents={6}
          height={300}
          showCost={true}
          showPerformance={false}
          showTokenBreakdown={true}
          onRefresh={loadDashboard}
          onAgentClick={(agent) => {
            // Could navigate to agent details page if it exists
            console.log('Agent clicked:', agent.agentName, agent)
          }}
        />
      </div>

      <div className="mt-8">
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
  )
}
