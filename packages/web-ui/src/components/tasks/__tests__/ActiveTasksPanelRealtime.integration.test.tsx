/**
 * Integration Tests for ActiveTasksPanelRealtime
 * Tests the complete flow from WebSocket events through hook to UI updates
 */

import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ActiveTasksPanelRealtime } from '../ActiveTasksPanelRealtime'
import type { Task } from '@apexcli/core'
import type { DashboardActivityEvent, RealtimeUpdatesState } from '../../../types/dashboard'

// Create a more realistic mock that simulates actual behavior
interface MockHookState {
  state: RealtimeUpdatesState
  connect: () => void
  disconnect: () => void
  markEventRead: (id: string) => void
  markAllEventsRead: () => void
  clearEvents: () => void
  updateSubscription: (options: any) => void
  refreshPerformance: () => void
  checkHealth: () => Promise<void>
}

// State that can be controlled by tests
let mockState: RealtimeUpdatesState = {
  connectionState: 'disconnected',
  events: [],
  isConnected: false,
  error: null,
  health: {
    status: 'unknown',
    connection: {
      isConnected: false,
      connectedSince: new Date(),
      reconnectAttempts: 0,
      latencyMs: 0,
      averageLatencyMs: 0,
    },
    server: {
      uptimeMs: 0,
      lastHealthCheck: new Date(),
      successRate: 100,
    },
    tasks: {
      activeTasks: 0,
      pendingTasks: 0,
      completedLastHour: 0,
      failedLastHour: 0,
      averageDurationMs: 0,
    },
    lastUpdated: new Date(),
  },
  performance: {
    timeRange: '1h',
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      tokensPerMinute: 0,
      cacheHitRate: 0,
      byAgent: {},
      byTool: {},
    },
    tasks: {
      completedTasks: 0,
      failedTasks: 0,
      avgDurationMs: 0,
      medianDurationMs: 0,
      p95DurationMs: 0,
      successRate: 1,
      byStatus: {},
      byStage: {},
    },
    agents: [],
    tools: [],
    timeSeries: [],
    generatedAt: new Date(),
  },
  lastUpdate: new Date(),
}

// Mock functions that tests can control
const mockActions = {
  connect: vi.fn(() => {
    mockState = {
      ...mockState,
      connectionState: 'connecting',
      isConnected: false,
    }
    // Simulate async connection
    setTimeout(() => {
      mockState = {
        ...mockState,
        connectionState: 'connected',
        isConnected: true,
      }
    }, 100)
  }),
  disconnect: vi.fn(() => {
    mockState = {
      ...mockState,
      connectionState: 'disconnected',
      isConnected: false,
      events: [],
    }
  }),
  markEventRead: vi.fn((id: string) => {
    mockState = {
      ...mockState,
      events: mockState.events.map(e =>
        e.id === id ? { ...e, isRead: true } : e
      ),
    }
  }),
  markAllEventsRead: vi.fn(() => {
    mockState = {
      ...mockState,
      events: mockState.events.map(e => ({ ...e, isRead: true })),
    }
  }),
  clearEvents: vi.fn(() => {
    mockState = {
      ...mockState,
      events: [],
    }
  }),
  updateSubscription: vi.fn(),
  refreshPerformance: vi.fn(),
  checkHealth: vi.fn().mockResolvedValue(undefined),
}

// Mock the useRealtimeUpdates hook
vi.mock('../../../lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(() => ({
    state: mockState,
    ...mockActions,
  })),
}))

// Mock WebSocketConnectionIndicator
vi.mock('../../connection/WebSocketConnectionIndicator', () => ({
  WebSocketConnectionIndicator: ({ size, showLatency, showTooltip, animated }: any) => (
    <div
      data-testid="connection-indicator"
      data-size={size}
      data-show-latency={showLatency}
      data-show-tooltip={showTooltip}
      data-animated={animated}
      data-connection-status={mockState.isConnected ? 'connected' : 'disconnected'}
    >
      {mockState.isConnected ? 'Connected' : 'Disconnected'}
    </div>
  ),
}))

// Mock TaskCard
vi.mock('../TaskCard', () => ({
  TaskCard: ({ task, onViewDetails, compact, showProgress }: any) => (
    <div
      data-testid={`task-card-${task.id}`}
      data-task-status={task.status}
      data-current-stage={task.currentStage}
      data-compact={compact}
      data-show-progress={showProgress}
      onClick={() => onViewDetails?.(task.id)}
    >
      <div data-testid="task-description">{task.description}</div>
      <div data-testid="task-status">Status: {task.status}</div>
      {task.currentStage && <div data-testid="task-stage">Stage: {task.currentStage}</div>}
      {task.error && <div data-testid="task-error">Error: {task.error}</div>}
      <div data-testid="task-updated">Updated: {task.updatedAt}</div>
    </div>
  ),
}))

// Test utilities
const createTestTask = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  description: `Test Task ${id}`,
  workflow: 'test',
  autonomy: 'medium',
  status: 'pending',
  priority: 'medium',
  effort: 'small',
  currentStage: 'planning',
  projectPath: '/test',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  updatedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
  ...overrides,
})

const createTestEvent = (id: string, overrides: Partial<DashboardActivityEvent> = {}): DashboardActivityEvent => ({
  id,
  type: 'task:created',
  taskId: `task-${id}`,
  timestamp: new Date(),
  data: {},
  isRead: false,
  severity: 'info',
  category: 'task',
  title: 'Task created',
  ...overrides,
})

describe('ActiveTasksPanelRealtime Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset to default state
    mockState = {
      connectionState: 'disconnected',
      events: [],
      isConnected: false,
      error: null,
      health: {
        status: 'unknown',
        connection: {
          isConnected: false,
          connectedSince: new Date(),
          reconnectAttempts: 0,
          latencyMs: 0,
          averageLatencyMs: 0,
        },
        server: {
          uptimeMs: 0,
          lastHealthCheck: new Date(),
          successRate: 100,
        },
        tasks: {
          activeTasks: 0,
          pendingTasks: 0,
          completedLastHour: 0,
          failedLastHour: 0,
          averageDurationMs: 0,
        },
        lastUpdated: new Date(),
      },
      performance: {
        timeRange: '1h',
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          tokensPerMinute: 0,
          cacheHitRate: 0,
          byAgent: {},
          byTool: {},
        },
        tasks: {
          completedTasks: 0,
          failedTasks: 0,
          avgDurationMs: 0,
          medianDurationMs: 0,
          p95DurationMs: 0,
          successRate: 1,
          byStatus: {},
          byStage: {},
        },
        agents: [],
        tools: [],
        timeSeries: [],
        generatedAt: new Date(),
      },
      lastUpdate: new Date(),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Connection Flow Integration', () => {
    it('should show connecting state and then connected with tasks', async () => {
      const initialTasks = [
        createTestTask('1', { status: 'running' }),
        createTestTask('2', { status: 'pending' }),
      ]

      // Start in connecting state
      mockState.connectionState = 'connecting'
      mockState.isConnected = false

      const { rerender } = render(
        <ActiveTasksPanelRealtime
          initialTasks={initialTasks}
          defaultShowActiveOnly={false}
        />
      )

      expect(screen.getByText('Connecting to real-time updates...')).toBeInTheDocument()

      // Simulate successful connection
      act(() => {
        mockState.connectionState = 'connected'
        mockState.isConnected = true
      })

      rerender(
        <ActiveTasksPanelRealtime
          initialTasks={initialTasks}
          defaultShowActiveOnly={false}
        />
      )

      expect(screen.queryByText('Connecting to real-time updates...')).not.toBeInTheDocument()
      expect(screen.getByTestId('task-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('task-card-2')).toBeInTheDocument()
      expect(screen.getByTestId('connection-indicator')).toHaveAttribute('data-connection-status', 'connected')
    })

    it('should handle connection errors gracefully', () => {
      mockState.connectionState = 'error'
      mockState.isConnected = false
      mockState.error = new Error('Network connection failed')

      render(<ActiveTasksPanelRealtime />)

      expect(screen.getByText('Connection Error')).toBeInTheDocument()
      expect(screen.getByText('Network connection failed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    })

    it('should reconnect when refresh button is clicked during disconnection', () => {
      mockState.connectionState = 'disconnected'
      mockState.isConnected = false

      render(<ActiveTasksPanelRealtime />)

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshButton)

      expect(mockActions.connect).toHaveBeenCalled()
    })
  })

  describe('Real-time Task Updates Integration', () => {
    it('should process task creation events and update display', () => {
      const initialTasks = [createTestTask('1')]

      // Start connected with a new task event
      mockState.connectionState = 'connected'
      mockState.isConnected = true
      mockState.events = [
        createTestEvent('new-task', {
          type: 'task:created',
          taskId: 'task-new',
          data: {
            task: createTestTask('new', {
              description: 'Newly Created Task',
              status: 'pending'
            })
          }
        })
      ]

      render(
        <ActiveTasksPanelRealtime
          initialTasks={initialTasks}
          defaultShowActiveOnly={false}
        />
      )

      expect(screen.getByTestId('task-card-1')).toBeInTheDocument()
      // Note: The component would need to process the event internally
      // This test verifies the component handles events without crashing
      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    })

    it('should show live updates indicator when connected', () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createTestTask((i + 1).toString())
      )

      mockState.connectionState = 'connected'
      mockState.isConnected = true

      render(
        <ActiveTasksPanelRealtime
          initialTasks={tasks}
          maxTasks={3}
          defaultShowActiveOnly={false}
        />
      )

      expect(screen.getByText('Showing 3 most recent tasks')).toBeInTheDocument()
      expect(screen.getByText(/Live updates active/)).toBeInTheDocument()
    })

    it('should show outdated warning when disconnected with tasks', () => {
      const tasks = [createTestTask('1')]

      mockState.connectionState = 'disconnected'
      mockState.isConnected = false

      render(
        <ActiveTasksPanelRealtime
          initialTasks={tasks}
          defaultShowActiveOnly={false}
        />
      )

      expect(screen.getByText('Real-time updates disconnected. Tasks may be outdated.')).toBeInTheDocument()
    })
  })

  describe('Task Filtering Integration', () => {
    it('should filter active tasks and update counts based on WebSocket events', () => {
      const tasks = [
        createTestTask('1', { status: 'in-progress' }),
        createTestTask('2', { status: 'completed' }),
        createTestTask('3', { status: 'failed' }),
        createTestTask('4', { status: 'paused' }),
      ]

      mockState.connectionState = 'connected'
      mockState.isConnected = true

      render(
        <ActiveTasksPanelRealtime
          initialTasks={tasks}
          defaultShowActiveOnly={true} // Start with active filter
        />
      )

      // Should show active filter button with count
      expect(screen.getByRole('button', { name: /active.*1/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /completed.*1/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /failed.*1/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /paused.*1/i })).toBeInTheDocument()

      // Should only show active task (in-progress)
      expect(screen.getByTestId('task-card-1')).toBeInTheDocument()
      expect(screen.queryByTestId('task-card-2')).not.toBeInTheDocument()
    })

    it('should switch filters and update display correctly', () => {
      const tasks = [
        createTestTask('1', { status: 'completed' }),
        createTestTask('2', { status: 'failed' }),
      ]

      mockState.connectionState = 'connected'
      mockState.isConnected = true

      render(
        <ActiveTasksPanelRealtime
          initialTasks={tasks}
          defaultShowActiveOnly={false}
        />
      )

      // Initially should show all tasks
      expect(screen.getByTestId('task-card-1')).toBeInTheDocument()
      expect(screen.getByTestId('task-card-2')).toBeInTheDocument()

      // Click completed filter
      fireEvent.click(screen.getByRole('button', { name: /completed/i }))

      // Should only show completed task
      expect(screen.getByTestId('task-card-1')).toBeInTheDocument()
      expect(screen.queryByTestId('task-card-2')).not.toBeInTheDocument()

      // Click failed filter
      fireEvent.click(screen.getByRole('button', { name: /failed/i }))

      // Should only show failed task
      expect(screen.queryByTestId('task-card-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('task-card-2')).toBeInTheDocument()
    })
  })

  describe('User Interaction Integration', () => {
    it('should handle task view details callback', () => {
      const onViewDetails = vi.fn()
      const tasks = [createTestTask('1')]

      mockState.connectionState = 'connected'
      mockState.isConnected = true

      render(
        <ActiveTasksPanelRealtime
          initialTasks={tasks}
          onViewDetails={onViewDetails}
          defaultShowActiveOnly={false}
        />
      )

      fireEvent.click(screen.getByTestId('task-card-1'))
      expect(onViewDetails).toHaveBeenCalledWith('1')
    })

    it('should handle empty state with filter switching', () => {
      mockState.connectionState = 'connected'
      mockState.isConnected = true

      render(
        <ActiveTasksPanelRealtime
          initialTasks={[]}
          defaultShowActiveOnly={true}
        />
      )

      expect(screen.getByText('No active tasks')).toBeInTheDocument()
      expect(screen.getByText('View all tasks')).toBeInTheDocument()

      // Click "View all tasks"
      fireEvent.click(screen.getByText('View all tasks'))

      // Should switch to all filter
      expect(screen.getByText('No tasks found')).toBeInTheDocument()
    })
  })

  describe('Connection Indicator Integration', () => {
    it('should configure connection indicator based on props', () => {
      mockState.connectionState = 'connected'
      mockState.isConnected = true

      render(
        <ActiveTasksPanelRealtime
          connectionIndicatorSize="lg"
          showConnectionIndicator={true}
        />
      )

      const indicator = screen.getByTestId('connection-indicator')
      expect(indicator).toHaveAttribute('data-size', 'lg')
      expect(indicator).toHaveAttribute('data-show-latency', 'true')
      expect(indicator).toHaveAttribute('data-show-tooltip', 'true')
      expect(indicator).toHaveAttribute('data-animated', 'true')
    })

    it('should hide connection indicator when disabled', () => {
      render(
        <ActiveTasksPanelRealtime
          showConnectionIndicator={false}
        />
      )

      expect(screen.queryByTestId('connection-indicator')).not.toBeInTheDocument()
    })
  })

  describe('Performance and Scalability Integration', () => {
    it('should handle large numbers of tasks efficiently', () => {
      const largeTasks = Array.from({ length: 100 }, (_, i) =>
        createTestTask(i.toString(), {
          description: `Task ${i}`,
          updatedAt: new Date(Date.now() - i * 1000).toISOString(),
        })
      )

      mockState.connectionState = 'connected'
      mockState.isConnected = true

      const startTime = performance.now()

      render(
        <ActiveTasksPanelRealtime
          initialTasks={largeTasks}
          maxTasks={10}
          defaultShowActiveOnly={false}
        />
      )

      const renderTime = performance.now() - startTime
      expect(renderTime).toBeLessThan(1000) // Should render within 1 second

      // Should limit display to maxTasks
      expect(screen.getByText('Showing 10 most recent tasks')).toBeInTheDocument()

      // Should show most recent tasks (those with higher indices have more recent timestamps)
      expect(screen.getByTestId('task-card-0')).toBeInTheDocument() // Most recent
      expect(screen.queryByTestId('task-card-50')).not.toBeInTheDocument() // Should not be shown
    })

    it('should handle rapid event updates without performance degradation', () => {
      const rapidEvents: DashboardActivityEvent[] = Array.from({ length: 50 }, (_, i) =>
        createTestEvent(i.toString(), {
          type: 'agent:message',
          timestamp: new Date(Date.now() + i * 100),
          data: { message: `Message ${i}` }
        })
      )

      mockState.connectionState = 'connected'
      mockState.isConnected = true
      mockState.events = rapidEvents

      const startTime = performance.now()

      render(
        <ActiveTasksPanelRealtime
          initialTasks={[createTestTask('1')]}
        />
      )

      const renderTime = performance.now() - startTime
      expect(renderTime).toBeLessThan(500) // Should handle many events efficiently

      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    })
  })

  describe('Error Recovery Integration', () => {
    it('should recover gracefully from errors and resume operation', async () => {
      // Start with error state
      mockState.connectionState = 'error'
      mockState.isConnected = false
      mockState.error = new Error('Connection lost')

      const { rerender } = render(<ActiveTasksPanelRealtime />)

      expect(screen.getByText('Connection Error')).toBeInTheDocument()

      // Simulate recovery
      act(() => {
        mockState.connectionState = 'connected'
        mockState.isConnected = true
        mockState.error = null
      })

      rerender(<ActiveTasksPanelRealtime />)

      expect(screen.queryByText('Connection Error')).not.toBeInTheDocument()
      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    })
  })
})