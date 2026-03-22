import { useState, useEffect, useRef, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type {
  ParallelAgentViewData,
  AgentLane,
  AgentExecution,
  AgentExecutionStatus,
} from '@/types/parallel-agent-view'
import { EMPTY_PARALLEL_AGENT_VIEW_DATA } from '@/types/parallel-agent-view'

export interface UseParallelAgentViewOptions {
  /**
   * Whether to automatically refresh data
   * @default true
   */
  autoRefresh?: boolean

  /**
   * Refresh interval in milliseconds
   * @default 5000
   */
  refreshInterval?: number

  /**
   * Whether to connect to real-time updates via WebSocket
   * @default false
   */
  enableRealtime?: boolean

  /**
   * Maximum number of executions to track per lane
   * @default 50
   */
  maxExecutionsPerLane?: number

  /**
   * Whether to start fetching data immediately
   * @default true
   */
  autoStart?: boolean
}

export interface UseParallelAgentViewReturn {
  /**
   * Current parallel agent data
   */
  data: ParallelAgentViewData

  /**
   * Loading state
   */
  loading: boolean

  /**
   * Error message if any
   */
  error: string | null

  /**
   * Whether real-time updates are connected
   */
  isConnected: boolean

  /**
   * Manually refresh the data
   */
  refresh: () => Promise<void>

  /**
   * Start auto-refresh and real-time updates
   */
  start: () => void

  /**
   * Stop auto-refresh and real-time updates
   */
  stop: () => void

  /**
   * Update a specific agent execution
   */
  updateExecution: (executionId: string, update: Partial<AgentExecution>) => void

  /**
   * Add a new execution to a lane
   */
  addExecution: (laneId: string, execution: AgentExecution) => void

  /**
   * Remove an execution from its lane
   */
  removeExecution: (executionId: string) => void
}

/**
 * Custom hook for managing parallel agent view data with real-time updates
 * and auto-refresh capabilities.
 */
export function useParallelAgentView(
  options: UseParallelAgentViewOptions = {}
): UseParallelAgentViewReturn {
  const {
    autoRefresh = true,
    refreshInterval = 5000,
    enableRealtime = false,
    maxExecutionsPerLane = 50,
    autoStart = true,
  } = options

  const [data, setData] = useState<ParallelAgentViewData>(EMPTY_PARALLEL_AGENT_VIEW_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isActive, setIsActive] = useState(autoStart)

  const refreshTimeoutRef = useRef<NodeJS.Timeout>()
  const websocketRef = useRef<WebSocket>()

  /**
   * Fetch parallel agent data from the API
   */
  const fetchData = useCallback(async (): Promise<ParallelAgentViewData> => {
    try {
      // For now, generate mock data since the API endpoint doesn't exist yet
      // In a real implementation, this would be: await apiClient.getParallelAgents()
      const mockData = generateMockParallelAgentData()
      return mockData
    } catch (err) {
      console.error('Failed to fetch parallel agent data:', err)
      throw new Error('Failed to load parallel agent data')
    }
  }, [])

  /**
   * Refresh the parallel agent data
   */
  const refresh = useCallback(async () => {
    if (!isActive) return

    try {
      setLoading(true)
      setError(null)
      const newData = await fetchData()
      setData(newData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [fetchData, isActive])

  /**
   * Start auto-refresh and real-time updates
   */
  const start = useCallback(() => {
    setIsActive(true)
    refresh()
  }, [refresh])

  /**
   * Stop auto-refresh and real-time updates
   */
  const stop = useCallback(() => {
    setIsActive(false)

    // Clear refresh timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = undefined
    }

    // Close WebSocket connection
    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = undefined
      setIsConnected(false)
    }
  }, [])

  /**
   * Update a specific agent execution in the current data
   */
  const updateExecution = useCallback((executionId: string, update: Partial<AgentExecution>) => {
    setData(prevData => {
      const newLanes = prevData.lanes.map(lane => ({
        ...lane,
        executions: lane.executions.map(execution =>
          execution.id === executionId
            ? { ...execution, ...update }
            : execution
        )
      }))

      return {
        ...prevData,
        lanes: newLanes,
        lastUpdated: new Date(),
      }
    })
  }, [])

  /**
   * Add a new execution to a specific lane
   */
  const addExecution = useCallback((laneId: string, execution: AgentExecution) => {
    setData(prevData => {
      const newLanes = prevData.lanes.map(lane => {
        if (lane.id === laneId) {
          const newExecutions = [execution, ...lane.executions].slice(0, maxExecutionsPerLane)
          return {
            ...lane,
            executions: newExecutions
          }
        }
        return lane
      })

      return {
        ...prevData,
        lanes: newLanes,
        totalExecutions: prevData.totalExecutions + 1,
        lastUpdated: new Date(),
      }
    })
  }, [maxExecutionsPerLane])

  /**
   * Remove an execution from its lane
   */
  const removeExecution = useCallback((executionId: string) => {
    setData(prevData => {
      const newLanes = prevData.lanes.map(lane => ({
        ...lane,
        executions: lane.executions.filter(execution => execution.id !== executionId)
      }))

      return {
        ...prevData,
        lanes: newLanes,
        totalExecutions: Math.max(0, prevData.totalExecutions - 1),
        lastUpdated: new Date(),
      }
    })
  }, [])

  /**
   * Set up auto-refresh
   */
  useEffect(() => {
    if (!isActive || !autoRefresh) return

    const scheduleNextRefresh = () => {
      refreshTimeoutRef.current = setTimeout(() => {
        refresh().then(scheduleNextRefresh)
      }, refreshInterval)
    }

    scheduleNextRefresh()

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [isActive, autoRefresh, refreshInterval, refresh])

  /**
   * Set up WebSocket real-time updates (placeholder implementation)
   */
  useEffect(() => {
    if (!isActive || !enableRealtime) return

    // Placeholder for WebSocket implementation
    // In a real app, this would connect to a WebSocket endpoint
    // that streams parallel agent updates

    const connectWebSocket = () => {
      try {
        // This would be the actual WebSocket URL
        // const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/parallel-agents`)

        // For now, just simulate connection
        setIsConnected(true)

        // Simulate receiving updates
        const simulateUpdates = setInterval(() => {
          if (Math.random() < 0.3) { // 30% chance of update
            const mockUpdate = {
              type: 'execution:progress',
              data: {
                executionId: `exec-${Math.floor(Math.random() * 10)}`,
                progress: Math.floor(Math.random() * 100),
                status: 'running' as AgentExecutionStatus,
              }
            }

            if (mockUpdate.data.executionId) {
              updateExecution(mockUpdate.data.executionId, {
                progress: mockUpdate.data.progress,
                status: mockUpdate.data.status,
              })
            }
          }
        }, 2000)

        return () => {
          clearInterval(simulateUpdates)
          setIsConnected(false)
        }
      } catch (err) {
        console.warn('Failed to connect to real-time updates:', err)
        setIsConnected(false)
      }
    }

    const cleanup = connectWebSocket()

    return () => {
      if (cleanup) cleanup()
    }
  }, [isActive, enableRealtime, updateExecution])

  /**
   * Initial data fetch
   */
  useEffect(() => {
    if (autoStart && isActive) {
      refresh()
    }
  }, [autoStart, isActive, refresh])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    data,
    loading,
    error,
    isConnected,
    refresh,
    start,
    stop,
    updateExecution,
    addExecution,
    removeExecution,
  }
}

/**
 * Generate mock parallel agent data for development/testing
 * In a real implementation, this would be replaced by actual API calls
 */
function generateMockParallelAgentData(): ParallelAgentViewData {
  const now = new Date()
  const lanes: AgentLane[] = [
    {
      id: 'development',
      label: 'Development',
      description: 'Code implementation and development tasks',
      executions: [
        {
          id: 'exec-1',
          agentId: 'dev-001',
          agentName: 'Developer Agent',
          status: 'running',
          stage: 'implementing',
          progress: 65,
          startedAt: new Date(now.getTime() - 1000 * 60 * 15),
          tokensUsed: 12500,
          estimatedCost: 0.25,
          taskId: 'task-123',
          taskDescription: 'Implement user authentication system',
          laneId: 'development',
        },
        {
          id: 'exec-2',
          agentId: 'dev-002',
          agentName: 'Frontend Developer',
          status: 'queued',
          stage: 'pending',
          progress: 0,
          taskDescription: 'Create responsive dashboard layout',
          laneId: 'development',
        },
      ],
      color: 'var(--color-apex-500)',
    },
    {
      id: 'testing',
      label: 'Testing',
      description: 'Quality assurance and testing tasks',
      executions: [
        {
          id: 'exec-3',
          agentId: 'test-001',
          agentName: 'Test Agent',
          status: 'running',
          stage: 'testing',
          progress: 45,
          startedAt: new Date(now.getTime() - 1000 * 60 * 8),
          tokensUsed: 5800,
          estimatedCost: 0.12,
          taskDescription: 'Run integration tests for API endpoints',
          laneId: 'testing',
        },
      ],
      color: 'var(--color-green-500)',
    },
    {
      id: 'review',
      label: 'Review',
      description: 'Code review and approval tasks',
      executions: [
        {
          id: 'exec-4',
          agentId: 'review-001',
          agentName: 'Review Agent',
          status: 'completed',
          stage: 'completed',
          progress: 100,
          startedAt: new Date(now.getTime() - 1000 * 60 * 30),
          completedAt: new Date(now.getTime() - 1000 * 60 * 5),
          durationMs: 1000 * 60 * 25,
          tokensUsed: 8200,
          estimatedCost: 0.18,
          taskDescription: 'Review authentication implementation',
          laneId: 'review',
        },
      ],
      color: 'var(--color-blue-500)',
    },
  ]

  const totalExecutions = lanes.reduce((sum, lane) => sum + lane.executions.length, 0)
  const runningCount = lanes.reduce(
    (sum, lane) => sum + lane.executions.filter(e => e.status === 'running').length,
    0
  )
  const completedCount = lanes.reduce(
    (sum, lane) => sum + lane.executions.filter(e => e.status === 'completed').length,
    0
  )
  const failedCount = lanes.reduce(
    (sum, lane) => sum + lane.executions.filter(e => e.status === 'failed').length,
    0
  )

  return {
    lanes,
    totalExecutions,
    runningCount,
    completedCount,
    failedCount,
    overallProgress: totalExecutions > 0 ? (completedCount / totalExecutions) * 100 : 0,
    totalTokensUsed: lanes.reduce(
      (sum, lane) => sum + lane.executions.reduce((s, e) => s + (e.tokensUsed || 0), 0),
      0
    ),
    totalEstimatedCost: lanes.reduce(
      (sum, lane) => sum + lane.executions.reduce((s, e) => s + (e.estimatedCost || 0), 0),
      0
    ),
    startedAt: new Date(now.getTime() - 1000 * 60 * 45),
    lastUpdated: now,
  }
}