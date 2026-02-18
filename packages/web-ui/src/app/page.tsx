'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout'
import { Card, CardHeader, CardContent } from '@/components/ui'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { apiClient } from '@/lib/api-client'
import { formatCost, getStatusVariant, formatStatus, getRelativeTime, truncateId } from '@/lib/utils'
import type { Task } from '@apexcli/core'

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    byStatus: Record<string, number>
    totalCost: number
    totalTokens: number
  } | null>(null)
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)
      const [statsData, recentData] = await Promise.all([
        apiClient.getTaskStats(),
        apiClient.listTasks({ limit: 5 }),
      ])
      setStats(statsData)
      setRecentTasks(recentData.tasks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

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

      <div className="mt-8">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Activity</h3>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <div className="text-center py-12 text-foreground-secondary">
                <p>No recent activity</p>
                <p className="text-sm mt-2">
                  Run <code className="bg-background-tertiary px-2 py-1 rounded">apex run &quot;your task&quot;</code> to create a task.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 bg-background-secondary rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.description}</p>
                      <p className="text-sm text-foreground-secondary mt-1">
                        {truncateId(task.id)} · {task.workflow} · {getRelativeTime(task.updatedAt || task.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <span className="text-sm text-foreground-secondary">
                        {formatCost(task.usage?.estimatedCost || 0)}
                      </span>
                      <Badge variant={getStatusVariant(task.status)}>
                        {formatStatus(task.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
