import type { Task } from '@apexcli/core'
import type { DashboardActivityEvent, WebSocketConnectionHealth, WebSocketConnectionStatus } from '@/types/websocket-connection'

/**
 * Factory for creating test tasks with realistic data
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  const baseTask: Task = {
    id: `task-${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test Task',
    workflow: 'development',
    autonomy: 'medium',
    status: 'in-progress',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStage: 'implementation',
    ...overrides,
  }
  return baseTask
}

/**
 * Creates tasks with different statuses for variant testing
 */
export const createTaskVariants = () => ({
  running: createMockTask({
    id: 'task-running',
    description: 'Running task with progress',
    status: 'in-progress',
    currentStage: 'implementation',
    priority: 'high',
    effort: 'medium',
    progress: {
      percentage: 65,
      currentStep: 'Writing tests',
      totalSteps: 5,
      completedSteps: 3,
    },
  }),

  completed: createMockTask({
    id: 'task-completed',
    description: 'Completed task with success',
    status: 'completed',
    priority: 'medium',
    effort: 'small',
    completedAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    result: {
      success: true,
      summary: 'Task completed successfully',
      filesModified: ['src/components/Test.tsx'],
    },
  }),

  failed: createMockTask({
    id: 'task-failed',
    description: 'Failed task with error message',
    status: 'failed',
    priority: 'high',
    effort: 'large',
    error: 'Build failed: TypeScript compilation error',
    failedAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
    retryCount: 2,
  }),

  paused: createMockTask({
    id: 'task-paused',
    description: 'Paused task awaiting input',
    status: 'paused',
    priority: 'medium',
    effort: 'medium',
    pausedAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
    pauseReason: 'Waiting for user confirmation',
  }),

  queued: createMockTask({
    id: 'task-queued',
    description: 'Queued task waiting to start',
    status: 'queued',
    priority: 'low',
    effort: 'small',
    queuePosition: 2,
  }),

  pending: createMockTask({
    id: 'task-pending',
    description: 'Pending task being prepared',
    status: 'pending',
    priority: 'medium',
    effort: 'medium',
    currentStage: 'planning',
  }),

  awaitingApproval: createMockTask({
    id: 'task-awaiting',
    description: 'Task awaiting approval',
    status: 'awaiting-approval',
    priority: 'high',
    effort: 'large',
    approvalRequired: {
      reason: 'High-risk operation requires approval',
      requester: 'development-agent',
      requestedAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
    },
  }),

  cancelled: createMockTask({
    id: 'task-cancelled',
    description: 'Cancelled task',
    status: 'cancelled',
    priority: 'low',
    effort: 'medium',
    cancelledAt: new Date(Date.now() - 1200000).toISOString(), // 20 minutes ago
    cancellationReason: 'User requested cancellation',
  }),
})

/**
 * Factory for creating WebSocket task events
 */
export function createTaskEvent(
  type: 'task:created' | 'task:started' | 'task:stage-changed' | 'task:completed' | 'task:failed' | 'task:paused',
  taskId: string,
  data: Record<string, any> = {}
): DashboardActivityEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    taskId,
    timestamp: new Date(),
    data,
    isRead: false,
    severity: type.includes('failed') ? 'error' : type.includes('completed') ? 'success' : 'info',
    agentName: 'test-agent',
    category: 'task',
    title: `Task ${type.split(':')[1]}`,
    description: `Task ${taskId} ${type.split(':')[1]}`,
  }
}

/**
 * Factory for creating WebSocket connection health states
 */
export function createHealthState(
  status: WebSocketConnectionStatus,
  overrides: Partial<WebSocketConnectionHealth> = {}
): WebSocketConnectionHealth {
  const baseStates: Record<WebSocketConnectionStatus, Partial<WebSocketConnectionHealth>> = {
    connected: {
      isHealthy: true,
      latencyMs: 45,
      averageLatencyMs: 52,
      reconnectAttempts: 0,
      consecutiveFailures: 0,
      lastHealthyAt: new Date(Date.now() - 300000), // 5 minutes ago
      connectionUptime: 3600000, // 1 hour
    },
    disconnected: {
      isHealthy: false,
      latencyMs: null,
      averageLatencyMs: null,
      reconnectAttempts: 0,
      consecutiveFailures: 1,
      lastHealthyAt: new Date(Date.now() - 600000), // 10 minutes ago
      connectionUptime: null,
    },
    connecting: {
      isHealthy: false,
      latencyMs: null,
      averageLatencyMs: null,
      reconnectAttempts: 1,
      consecutiveFailures: 0,
      connectionUptime: null,
    },
    reconnecting: {
      isHealthy: false,
      latencyMs: null,
      averageLatencyMs: null,
      reconnectAttempts: 3,
      consecutiveFailures: 2,
      lastHealthyAt: new Date(Date.now() - 900000), // 15 minutes ago
      connectionUptime: null,
    },
    error: {
      isHealthy: false,
      latencyMs: null,
      averageLatencyMs: null,
      reconnectAttempts: 10, // Max attempts reached
      consecutiveFailures: 5,
      lastHealthyAt: new Date(Date.now() - 1800000), // 30 minutes ago
      connectionUptime: null,
    },
  }

  return {
    status,
    isHealthy: false,
    latencyMs: null,
    averageLatencyMs: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    consecutiveFailures: 0,
    lastHealthyAt: new Date(),
    lastCheckAt: new Date(),
    connectionUptime: null,
    ...baseStates[status],
    ...overrides,
  }
}

/**
 * Creates a large dataset of tasks for performance testing
 */
export function createLargeTaskDataset(count: number = 100): Task[] {
  const statuses: Task['status'][] = ['in-progress', 'completed', 'failed', 'paused', 'queued', 'pending']
  const priorities: Task['priority'][] = ['low', 'medium', 'high']
  const efforts: Task['effort'][] = ['small', 'medium', 'large']

  return Array.from({ length: count }, (_, i) => {
    const status = statuses[i % statuses.length]
    const priority = priorities[i % priorities.length]
    const effort = efforts[i % efforts.length]

    return createMockTask({
      id: `task-${i.toString().padStart(3, '0')}`,
      description: `Task ${i}: ${status} priority ${priority} effort ${effort}`,
      status,
      priority,
      effort,
      updatedAt: new Date(Date.now() - (i * 60000)).toISOString(), // Spread over time
      createdAt: new Date(Date.now() - ((i + 100) * 60000)).toISOString(),
    })
  })
}

/**
 * Utility for generating mock event sequences
 */
export function createEventSequence(taskId: string): DashboardActivityEvent[] {
  const now = Date.now()
  return [
    createTaskEvent('task:created', taskId, {
      task: createMockTask({ id: taskId, status: 'pending' }),
      timestamp: new Date(now - 180000), // 3 minutes ago
    }),
    createTaskEvent('task:started', taskId, {
      previousStatus: 'pending',
      newStatus: 'in-progress',
      timestamp: new Date(now - 120000), // 2 minutes ago
    }),
    createTaskEvent('task:stage-changed', taskId, {
      previousStage: 'planning',
      newStage: 'implementation',
      timestamp: new Date(now - 60000), // 1 minute ago
    }),
  ]
}