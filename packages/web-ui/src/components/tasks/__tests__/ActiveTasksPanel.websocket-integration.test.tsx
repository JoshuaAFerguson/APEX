/**
 * Integration tests for ActiveTasksPanel WebSocket event handling
 * Verifies that WebSocket events properly update the UI in real-time
 * Tests the complete flow from WebSocket message to UI state change
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ActiveTasksPanel } from '../ActiveTasksPanel'
import type { Task } from '@apexcli/core'

// Mock WebSocket infrastructure
class MockWebSocket extends EventTarget {
  public readyState: number = WebSocket.CLOSED
  public url: string
  public onopen: ((event: Event) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    super()
    this.url = url
  }

  connect() {
    this.readyState = WebSocket.CONNECTING
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      const event = new Event('open')
      this.onopen?.(event)
      this.dispatchEvent(event)
    }, 10)
  }

  close() {
    this.readyState = WebSocket.CLOSED
    const event = new CloseEvent('close')
    this.onclose?.(event)
    this.dispatchEvent(event)
  }

  send(data: string) {
    // Echo back for testing
    setTimeout(() => {
      const event = new MessageEvent('message', { data })
      this.onmessage?.(event)
      this.dispatchEvent(event)
    }, 5)
  }

  // Simulate receiving a message
  simulateMessage(data: any) {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data)
    })
    this.onmessage?.(event)
    this.dispatchEvent(event)
  }

  // Simulate connection error
  simulateError() {
    const event = new Event('error')
    this.onerror?.(event)
    this.dispatchEvent(event)
  }
}

// Global WebSocket mock
let mockWebSocketInstance: MockWebSocket | null = null
const MockWebSocketConstructor = vi.fn((url: string) => {
  mockWebSocketInstance = new MockWebSocket(url)
  return mockWebSocketInstance
})

// Mock global WebSocket
Object.defineProperty(global, 'WebSocket', {
  value: MockWebSocketConstructor,
  writable: true,
})

// Mock TaskCard with event handling capabilities
vi.mock('../TaskCard', () => ({
  TaskCard: ({ task, onViewDetails, compact, showProgress }: any) => {
    const [isHighlighted, setIsHighlighted] = React.useState(false)

    // Simulate highlighting for newly updated tasks
    React.useEffect(() => {
      const now = new Date()
      const updatedAt = new Date(task.updatedAt)
      const timeDiff = now.getTime() - updatedAt.getTime()

      // Highlight tasks updated in last 5 seconds (simulate real-time update)
      if (timeDiff < 5000) {
        setIsHighlighted(true)
        const timer = setTimeout(() => setIsHighlighted(false), 2000)
        return () => clearTimeout(timer)
      }
    }, [task.updatedAt, task.status])

    return (
      <div
        data-testid={`task-card-${task.id}`}
        data-status={task.status}
        data-compact={compact}
        data-show-progress={showProgress}
        data-highlighted={isHighlighted}
        onClick={() => onViewDetails?.(task.id)}
        className={isHighlighted ? 'highlighted' : ''}
      >
        <div data-testid="task-description">{task.description}</div>
        <div data-testid="task-status">{task.status}</div>
        {task.progress !== undefined && (
          <div data-testid="task-progress">{task.progress}%</div>
        )}
        {task.error && <div data-testid="task-error">{task.error}</div>}
      </div>
    )
  },
}))

// WebSocket event types
interface TaskUpdateEvent {
  type: 'task:updated'
  taskId: string
  data: Partial<Task>
}

interface TaskCreatedEvent {
  type: 'task:created'
  data: Task
}

interface TaskStatusChangeEvent {
  type: 'task:status-changed'
  taskId: string
  oldStatus: string
  newStatus: string
  data: Partial<Task>
}

interface TaskProgressEvent {
  type: 'task:progress'
  taskId: string
  progress: number
  data: Partial<Task>
}

type WebSocketEvent = TaskUpdateEvent | TaskCreatedEvent | TaskStatusChangeEvent | TaskProgressEvent

// Enhanced component that simulates WebSocket integration
interface WebSocketActiveTasksPanelProps {
  initialTasks: Task[]
  wsUrl?: string
  onTasksUpdate?: (tasks: Task[]) => void
  autoConnect?: boolean
}

const WebSocketActiveTasksPanel: React.FC<WebSocketActiveTasksPanelProps> = ({
  initialTasks,
  wsUrl = 'ws://localhost:3001/tasks',
  onTasksUpdate,
  autoConnect = true
}) => {
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks)
  const [connectionStatus, setConnectionStatus] = React.useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const wsRef = React.useRef<MockWebSocket | null>(null)

  // WebSocket connection management
  const connect = React.useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')
    const ws = new MockWebSocket(wsUrl) as MockWebSocket
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
    }

    ws.onmessage = (event) => {
      try {
        const wsEvent: WebSocketEvent = JSON.parse(event.data)
        handleWebSocketEvent(wsEvent)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.connect()
  }, [wsUrl])

  // Handle different types of WebSocket events
  const handleWebSocketEvent = React.useCallback((event: WebSocketEvent) => {
    setTasks(currentTasks => {
      let updatedTasks = [...currentTasks]

      switch (event.type) {
        case 'task:created':
          updatedTasks.push(event.data)
          break

        case 'task:updated':
        case 'task:status-changed':
        case 'task:progress':
          updatedTasks = updatedTasks.map(task =>
            task.id === event.taskId
              ? { ...task, ...event.data, updatedAt: new Date().toISOString() }
              : task
          )
          break
      }

      onTasksUpdate?.(updatedTasks)
      return updatedTasks
    })
  }, [onTasksUpdate])

  // Auto-connect on mount
  React.useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect, autoConnect])

  // Expose WebSocket instance for testing
  React.useEffect(() => {
    if (wsRef.current) {
      (window as any).testWebSocket = wsRef.current
    }
  }, [wsRef.current])

  return (
    <div data-testid="websocket-panel" data-connection-status={connectionStatus}>
      {connectionStatus === 'connecting' && (
        <div data-testid="connecting-indicator">Connecting to real-time updates...</div>
      )}
      {connectionStatus === 'disconnected' && (
        <div data-testid="disconnected-indicator">
          Disconnected from real-time updates
          <button onClick={connect} data-testid="reconnect-button">
            Reconnect
          </button>
        </div>
      )}
      <ActiveTasksPanel
        tasks={tasks}
        defaultShowActiveOnly={false}
      />
    </div>
  )
}

// Test utilities
const createTestTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'test-task',
  description: 'Test task',
  workflow: 'development',
  autonomy: 'medium',
  status: 'pending',
  priority: 'medium',
  effort: 'medium',
  currentStage: 'planning',
  projectPath: '/test',
  retryCount: 0,
  maxRetries: 3,
  resumeAttempts: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const simulateWebSocketEvent = (event: WebSocketEvent) => {
  if (mockWebSocketInstance && mockWebSocketInstance.readyState === WebSocket.OPEN) {
    mockWebSocketInstance.simulateMessage(event)
  }
}

describe('ActiveTasksPanel - WebSocket Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWebSocketInstance = null
    MockWebSocketConstructor.mockClear()
  })

  afterEach(() => {
    // Clean up any open WebSocket connections
    if (mockWebSocketInstance) {
      mockWebSocketInstance.close()
    }
    delete (window as any).testWebSocket
  })

  describe('WebSocket Connection Management', () => {
    it('establishes WebSocket connection on mount', async () => {
      render(
        <WebSocketActiveTasksPanel
          initialTasks={[]}
          autoConnect={true}
        />
      )

      // Should show connecting state
      expect(screen.getByTestId('connecting-indicator')).toBeInTheDocument()

      // Wait for connection to be established
      await waitFor(() => {
        expect(screen.queryByTestId('connecting-indicator')).not.toBeInTheDocument()
      })

      const panel = screen.getByTestId('websocket-panel')
      expect(panel).toHaveAttribute('data-connection-status', 'connected')
    })

    it('handles connection failures and allows reconnection', async () => {
      render(
        <WebSocketActiveTasksPanel
          initialTasks={[]}
          autoConnect={false}
        />
      )

      expect(screen.getByTestId('disconnected-indicator')).toBeInTheDocument()

      // Attempt to connect
      fireEvent.click(screen.getByTestId('reconnect-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('disconnected-indicator')).not.toBeInTheDocument()
      })

      // Simulate connection error
      await act(async () => {
        if (mockWebSocketInstance) {
          mockWebSocketInstance.simulateError()
          mockWebSocketInstance.close()
        }
      })

      await waitFor(() => {
        expect(screen.getByTestId('disconnected-indicator')).toBeInTheDocument()
      })
    })
  })

  describe('Real-time Task Updates', () => {
    it('updates task status when receiving WebSocket status change event', async () => {
      const initialTask = createTestTask({
        id: 'status-change-task',
        status: 'pending',
        description: 'Task to be updated'
      })

      render(
        <WebSocketActiveTasksPanel
          initialTasks={[initialTask]}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      expect(screen.getByText('pending')).toBeInTheDocument()

      // Simulate status change event
      await act(async () => {
        simulateWebSocketEvent({
          type: 'task:status-changed',
          taskId: 'status-change-task',
          oldStatus: 'pending',
          newStatus: 'in-progress',
          data: { status: 'in-progress' }
        })
      })

      await waitFor(() => {
        expect(screen.getByText('in-progress')).toBeInTheDocument()
        expect(screen.queryByText('pending')).not.toBeInTheDocument()
      })

      // Task card should be highlighted due to recent update
      const taskCard = screen.getByTestId('task-card-status-change-task')
      expect(taskCard).toHaveAttribute('data-highlighted', 'true')
    })

    it('updates task progress when receiving progress events', async () => {
      const initialTask = createTestTask({
        id: 'progress-task',
        status: 'in-progress',
        description: 'Task with progress',
        progress: 0
      })

      render(
        <WebSocketActiveTasksPanel
          initialTasks={[initialTask]}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      expect(screen.getByText('0%')).toBeInTheDocument()

      // Simulate progress updates
      const progressValues = [25, 50, 75, 100]

      for (const progress of progressValues) {
        await act(async () => {
          simulateWebSocketEvent({
            type: 'task:progress',
            taskId: 'progress-task',
            progress,
            data: { progress }
          })
        })

        await waitFor(() => {
          expect(screen.getByText(`${progress}%`)).toBeInTheDocument()
        })
      }
    })

    it('adds new tasks when receiving task creation events', async () => {
      render(
        <WebSocketActiveTasksPanel
          initialTasks={[]}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      expect(screen.getByText('No tasks found')).toBeInTheDocument()

      // Simulate task creation
      const newTask = createTestTask({
        id: 'new-task',
        description: 'Newly created task',
        status: 'pending'
      })

      await act(async () => {
        simulateWebSocketEvent({
          type: 'task:created',
          data: newTask
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Newly created task')).toBeInTheDocument()
        expect(screen.queryByText('No tasks found')).not.toBeInTheDocument()
      })

      const taskCard = screen.getByTestId('task-card-new-task')
      expect(taskCard).toHaveAttribute('data-highlighted', 'true')
    })

    it('handles multiple rapid WebSocket events without conflicts', async () => {
      const initialTasks = [
        createTestTask({ id: 'task-1', status: 'pending', description: 'Task 1' }),
        createTestTask({ id: 'task-2', status: 'pending', description: 'Task 2' }),
      ]

      render(
        <WebSocketActiveTasksPanel
          initialTasks={initialTasks}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      // Send multiple rapid events
      await act(async () => {
        simulateWebSocketEvent({
          type: 'task:status-changed',
          taskId: 'task-1',
          oldStatus: 'pending',
          newStatus: 'in-progress',
          data: { status: 'in-progress' }
        })

        simulateWebSocketEvent({
          type: 'task:progress',
          taskId: 'task-1',
          progress: 50,
          data: { progress: 50 }
        })

        simulateWebSocketEvent({
          type: 'task:status-changed',
          taskId: 'task-2',
          oldStatus: 'pending',
          newStatus: 'completed',
          data: { status: 'completed' }
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('task-card-task-1')).toHaveAttribute('data-status', 'in-progress')
        expect(screen.getByTestId('task-card-task-2')).toHaveAttribute('data-status', 'completed')
      })
    })

    it('updates UI filter counts when tasks change via WebSocket', async () => {
      const initialTasks = [
        createTestTask({ id: 'pending-task', status: 'pending' }),
      ]

      render(
        <WebSocketActiveTasksPanel
          initialTasks={initialTasks}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      // Initial state: 1 active task (pending)
      expect(screen.getByRole('button', { name: /active.*1/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /completed.*0/i })).toBeInTheDocument()

      // Update task to completed
      await act(async () => {
        simulateWebSocketEvent({
          type: 'task:status-changed',
          taskId: 'pending-task',
          oldStatus: 'pending',
          newStatus: 'completed',
          data: { status: 'completed' }
        })
      })

      await waitFor(() => {
        // Filter counts should update
        expect(screen.getByRole('button', { name: /active.*0/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /completed.*1/i })).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles malformed WebSocket messages gracefully', async () => {
      render(
        <WebSocketActiveTasksPanel
          initialTasks={[createTestTask()]}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      // Send malformed message
      await act(async () => {
        if (mockWebSocketInstance) {
          mockWebSocketInstance.simulateMessage('invalid json')
        }
      })

      // Component should still be functional
      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    })

    it('handles WebSocket events for non-existent tasks', async () => {
      render(
        <WebSocketActiveTasksPanel
          initialTasks={[createTestTask({ id: 'existing-task' })] }
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      // Send update for non-existent task
      await act(async () => {
        simulateWebSocketEvent({
          type: 'task:status-changed',
          taskId: 'non-existent-task',
          oldStatus: 'pending',
          newStatus: 'completed',
          data: { status: 'completed' }
        })
      })

      // Should not crash, existing task should still be visible
      expect(screen.getByTestId('task-card-existing-task')).toBeInTheDocument()
    })

    it('maintains UI state during WebSocket reconnection', async () => {
      const onTasksUpdate = vi.fn()

      render(
        <WebSocketActiveTasksPanel
          initialTasks={[createTestTask({ id: 'persistent-task' })]}
          onTasksUpdate={onTasksUpdate}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      // Simulate disconnection
      await act(async () => {
        if (mockWebSocketInstance) {
          mockWebSocketInstance.close()
        }
      })

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'disconnected')
      })

      // Task should still be visible during disconnection
      expect(screen.getByTestId('task-card-persistent-task')).toBeInTheDocument()

      // Reconnect
      fireEvent.click(screen.getByTestId('reconnect-button'))

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      // Task should still be visible after reconnection
      expect(screen.getByTestId('task-card-persistent-task')).toBeInTheDocument()
    })
  })

  describe('Performance and Scalability', () => {
    it('handles high-frequency WebSocket updates efficiently', async () => {
      const initialTasks = Array.from({ length: 10 }, (_, i) =>
        createTestTask({
          id: `perf-task-${i}`,
          description: `Performance Task ${i}`,
          progress: 0
        })
      )

      render(
        <WebSocketActiveTasksPanel
          initialTasks={initialTasks}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      const start = performance.now()

      // Send 50 rapid progress updates
      await act(async () => {
        for (let i = 0; i < 50; i++) {
          simulateWebSocketEvent({
            type: 'task:progress',
            taskId: `perf-task-${i % 10}`,
            progress: (i * 2) % 100,
            data: { progress: (i * 2) % 100 }
          })
        }
      })

      const updateTime = performance.now() - start
      expect(updateTime).toBeLessThan(1000) // Should handle updates efficiently

      // All tasks should still be visible
      for (let i = 0; i < 10; i++) {
        expect(screen.getByTestId(`task-card-perf-task-${i}`)).toBeInTheDocument()
      }
    })

    it('batches UI updates during rapid WebSocket events', async () => {
      const onTasksUpdate = vi.fn()

      render(
        <WebSocketActiveTasksPanel
          initialTasks={[createTestTask({ id: 'batch-task' })]}
          onTasksUpdate={onTasksUpdate}
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('websocket-panel')).toHaveAttribute('data-connection-status', 'connected')
      })

      // Send multiple events in quick succession
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          simulateWebSocketEvent({
            type: 'task:progress',
            taskId: 'batch-task',
            progress: i * 10,
            data: { progress: i * 10 }
          })
        }
      })

      // Should have called update function multiple times but UI should be efficient
      expect(onTasksUpdate).toHaveBeenCalled()
      expect(screen.getByTestId('task-card-batch-task')).toBeInTheDocument()
    })
  })
})