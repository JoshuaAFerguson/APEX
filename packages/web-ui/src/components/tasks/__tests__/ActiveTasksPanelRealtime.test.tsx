import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ActiveTasksPanelRealtime } from '../ActiveTasksPanelRealtime'
import type { Task } from '@apexcli/core'
import type { UseRealtimeUpdatesReturn } from '../../../lib/useRealtimeUpdates'

// Mock implementation reference
let mockUseRealtimeUpdatesArgs: any = null

// Mock the useRealtimeUpdates hook
vi.mock('../../../lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn((args) => {
    mockUseRealtimeUpdatesArgs = args
    return {
      state: {
        connectionState: 'connected',
        events: [],
        isConnected: true,
        error: null,
        health: {} as any,
        performance: {} as any,
        lastUpdate: new Date(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      markEventRead: vi.fn(),
      markAllEventsRead: vi.fn(),
      clearEvents: vi.fn(),
      updateSubscription: vi.fn(),
      refreshPerformance: vi.fn(),
      checkHealth: vi.fn(),
    }
  }),
}))

// Get reference to the mocked function
import { useRealtimeUpdates } from '../../../lib/useRealtimeUpdates'
const mockUseRealtimeUpdates = vi.mocked(useRealtimeUpdates)

// Mock WebSocketConnectionIndicator
vi.mock('../../connection/WebSocketConnectionIndicator', () => ({
  WebSocketConnectionIndicator: ({ size, showLatency, showTooltip, animated }: any) => (
    <div
      data-testid="connection-indicator"
      data-size={size}
      data-show-latency={showLatency}
      data-show-tooltip={showTooltip}
      data-animated={animated}
    >
      Connection Indicator
    </div>
  ),
}))

// Mock TaskCard
vi.mock('../TaskCard', () => ({
  TaskCard: ({ task, onViewDetails, compact, showProgress }: any) => (
    <div
      data-testid={`task-card-${task.id}`}
      data-task-status={task.status}
      data-compact={compact}
      data-show-progress={showProgress}
      onClick={() => onViewDetails?.(task.id)}
    >
      Task: {task.description} - Status: {task.status}
    </div>
  ),
}))

// Sample task data
const mockTasks: Task[] = [
  {
    id: 'task-1',
    description: 'Test Task 1',
    status: 'running',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:30:00Z',
    currentStage: 'processing',
  } as Task,
  {
    id: 'task-2',
    description: 'Test Task 2',
    status: 'completed',
    createdAt: '2024-01-01T09:00:00Z',
    updatedAt: '2024-01-01T11:00:00Z',
    completedAt: '2024-01-01T11:00:00Z',
  } as Task,
  {
    id: 'task-3',
    description: 'Test Task 3',
    status: 'failed',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:30:00Z',
    failedAt: '2024-01-01T08:30:00Z',
    error: 'Test error',
  } as Task,
]

describe('ActiveTasksPanelRealtime', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRealtimeUpdatesArgs = null
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ActiveTasksPanelRealtime />)
      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    })

    it('displays initial tasks when provided', () => {
      render(<ActiveTasksPanelRealtime initialTasks={mockTasks} defaultShowActiveOnly={false} />)

      expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument()
      expect(screen.getByTestId('task-card-task-2')).toBeInTheDocument()
      expect(screen.getByTestId('task-card-task-3')).toBeInTheDocument()
    })

    it('shows task count badge when tasks are present', () => {
      render(<ActiveTasksPanelRealtime initialTasks={mockTasks} defaultShowActiveOnly={false} />)
      // Look for the badge specifically in the header area
      const header = screen.getByRole('heading', { name: /active tasks/i }).parentElement!
      expect(header.querySelector('.bg-background-tertiary')).toHaveTextContent('3')
    })

    it('shows connection indicator by default', () => {
      render(<ActiveTasksPanelRealtime />)
      expect(screen.getByTestId('connection-indicator')).toBeInTheDocument()
    })

    it('hides connection indicator when showConnectionIndicator is false', () => {
      render(<ActiveTasksPanelRealtime showConnectionIndicator={false} />)
      expect(screen.queryByTestId('connection-indicator')).not.toBeInTheDocument()
    })
  })

  describe('Event Processing', () => {
    // Note: Testing event processing requires a more complex setup with state changes
    // For now, we'll focus on testing that the component can handle events when they exist
    it('handles events returned from useRealtimeUpdates hook', () => {
      const mockEvents = [
        {
          id: 'event-1',
          type: 'task:created' as const,
          taskId: 'task-1',
          timestamp: new Date(),
          data: {},
          isRead: false,
          severity: 'info' as const,
          agentName: 'test',
          category: 'task' as const,
          title: 'Task created',
        },
      ]

      // Temporarily update mock to return events
      const customMock = vi.fn((args) => {
        mockUseRealtimeUpdatesArgs = args
        return {
          state: {
            connectionState: 'connected',
            events: mockEvents,
            isConnected: true,
            error: null,
            health: {} as any,
            performance: {} as any,
            lastUpdate: new Date(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
          markEventRead: vi.fn(),
          markAllEventsRead: vi.fn(),
          clearEvents: vi.fn(),
          updateSubscription: vi.fn(),
          refreshPerformance: vi.fn(),
          checkHealth: vi.fn(),
        }
      })

      mockUseRealtimeUpdates.mockImplementationOnce(customMock)

      render(<ActiveTasksPanelRealtime initialTasks={mockTasks} defaultShowActiveOnly={false} />)

      // Should render without crashing when events are present
      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    })

    // Test that the component can handle different event types without crashing
    it('handles different event types gracefully', () => {
      const mockEvents = [
        {
          id: 'event-1',
          type: 'task:started' as const,
          taskId: 'task-1',
          timestamp: new Date(),
          data: {},
          isRead: false,
          severity: 'info' as const,
          agentName: 'test',
          category: 'task' as const,
          title: 'Task started',
        },
        {
          id: 'event-2',
          type: 'task:completed' as const,
          taskId: 'task-2',
          timestamp: new Date(),
          data: {},
          isRead: false,
          severity: 'success' as const,
          agentName: 'test',
          category: 'task' as const,
          title: 'Task completed',
        },
      ]

      const customMock = vi.fn((args) => {
        mockUseRealtimeUpdatesArgs = args
        return {
          state: {
            connectionState: 'connected',
            events: mockEvents,
            isConnected: true,
            error: null,
            health: {} as any,
            performance: {} as any,
            lastUpdate: new Date(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
          markEventRead: vi.fn(),
          markAllEventsRead: vi.fn(),
          clearEvents: vi.fn(),
          updateSubscription: vi.fn(),
          refreshPerformance: vi.fn(),
          checkHealth: vi.fn(),
        }
      })

      vi.mocked(mockUseRealtimeUpdates).mockImplementationOnce(customMock)

      render(<ActiveTasksPanelRealtime initialTasks={mockTasks} defaultShowActiveOnly={false} />)

      // Should render without crashing when multiple events are present
      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
    })
  })

  describe('Connection States', () => {
    it('shows connecting state', () => {
      mockUseRealtimeUpdates.mockReturnValueOnce({
        state: {
          connectionState: 'connecting',
          events: [],
          isConnected: false,
          error: null,
          health: {} as any,
          performance: {} as any,
          lastUpdate: new Date(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        markEventRead: vi.fn(),
        markAllEventsRead: vi.fn(),
        clearEvents: vi.fn(),
        updateSubscription: vi.fn(),
        refreshPerformance: vi.fn(),
        checkHealth: vi.fn(),
      })

      render(<ActiveTasksPanelRealtime />)
      expect(screen.getByText('Connecting to real-time updates...')).toBeInTheDocument()
    })

    it('shows refresh button when disconnected', () => {
      mockUseRealtimeUpdates.mockReturnValueOnce({
        state: {
          connectionState: 'disconnected',
          events: [],
          isConnected: false,
          error: null,
          health: {} as any,
          performance: {} as any,
          lastUpdate: new Date(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        markEventRead: vi.fn(),
        markAllEventsRead: vi.fn(),
        clearEvents: vi.fn(),
        updateSubscription: vi.fn(),
        refreshPerformance: vi.fn(),
        checkHealth: vi.fn(),
      })

      render(<ActiveTasksPanelRealtime />)
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    })

    it('hides refresh button when connected', () => {
      render(<ActiveTasksPanelRealtime />)
      expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
    })

    it('calls connect when refresh button is clicked', () => {
      const mockConnect = vi.fn()
      mockUseRealtimeUpdates.mockReturnValueOnce({
        state: {
          connectionState: 'disconnected',
          events: [],
          isConnected: false,
          error: null,
          health: {} as any,
          performance: {} as any,
          lastUpdate: new Date(),
        },
        connect: mockConnect,
        disconnect: vi.fn(),
        markEventRead: vi.fn(),
        markAllEventsRead: vi.fn(),
        clearEvents: vi.fn(),
        updateSubscription: vi.fn(),
        refreshPerformance: vi.fn(),
        checkHealth: vi.fn(),
      })

      render(<ActiveTasksPanelRealtime />)
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
      expect(mockConnect).toHaveBeenCalled()
    })

    it('shows connection error when present', () => {
      const testError = new Error('Connection failed')
      mockUseRealtimeUpdates.mockReturnValueOnce({
        state: {
          connectionState: 'error',
          events: [],
          isConnected: false,
          error: testError,
          health: {} as any,
          performance: {} as any,
          lastUpdate: new Date(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        markEventRead: vi.fn(),
        markAllEventsRead: vi.fn(),
        clearEvents: vi.fn(),
        updateSubscription: vi.fn(),
        refreshPerformance: vi.fn(),
        checkHealth: vi.fn(),
      })

      render(<ActiveTasksPanelRealtime />)
      expect(screen.getByText('Connection Error')).toBeInTheDocument()
      expect(screen.getByText('Connection failed')).toBeInTheDocument()
    })
  })

  describe('Filtering', () => {
    it('filters tasks by active status', async () => {
      // Create mock tasks with in-progress, completed, and failed tasks
      // Note: isTaskRunning checks for 'in-progress' or 'planning', not 'running'
      const tasksWithActive = [
        { ...mockTasks[0], id: 'task-active', status: 'in-progress' as any }, // This should be shown as "active"
        { ...mockTasks[1], id: 'task-completed', status: 'completed' as any },
        { ...mockTasks[2], id: 'task-failed', status: 'failed' as any },
      ]

      render(<ActiveTasksPanelRealtime initialTasks={tasksWithActive} defaultShowActiveOnly={true} />)

      // Only in-progress task should be visible by default
      expect(screen.getByTestId('task-card-task-active')).toBeInTheDocument()
      expect(screen.queryByTestId('task-card-task-completed')).not.toBeInTheDocument()
      expect(screen.queryByTestId('task-card-task-failed')).not.toBeInTheDocument()
    })

    it('allows switching between filter types', async () => {
      render(<ActiveTasksPanelRealtime initialTasks={mockTasks} defaultShowActiveOnly={false} />)

      // Click on completed filter
      fireEvent.click(screen.getByRole('button', { name: /completed/i }))

      // Only completed task should be visible
      expect(screen.queryByTestId('task-card-task-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('task-card-task-2')).toBeInTheDocument()
      expect(screen.queryByTestId('task-card-task-3')).not.toBeInTheDocument()
    })
  })

  describe('Props Configuration', () => {
    it('respects maxTasks prop', () => {
      render(<ActiveTasksPanelRealtime initialTasks={mockTasks} maxTasks={2} defaultShowActiveOnly={false} />)

      // Should show message about limited tasks
      expect(screen.getByText('Showing 2 most recent tasks')).toBeInTheDocument()
    })

    it('applies compact mode', () => {
      render(<ActiveTasksPanelRealtime initialTasks={mockTasks} compact={true} defaultShowActiveOnly={false} />)

      // Check that task cards receive compact prop
      expect(screen.getByTestId('task-card-task-1')).toHaveAttribute('data-compact', 'true')
    })

    it('configures connection indicator size', () => {
      render(<ActiveTasksPanelRealtime connectionIndicatorSize="lg" />)

      expect(screen.getByTestId('connection-indicator')).toHaveAttribute('data-size', 'lg')
    })

    it('calls onViewDetails when task is clicked', () => {
      const onViewDetails = vi.fn()
      render(<ActiveTasksPanelRealtime initialTasks={mockTasks} onViewDetails={onViewDetails} defaultShowActiveOnly={false} />)

      fireEvent.click(screen.getByTestId('task-card-task-1'))
      expect(onViewDetails).toHaveBeenCalledWith('task-1')
    })
  })

  describe('Hook Configuration', () => {
    it('configures useRealtimeUpdates with correct event types', () => {
      render(<ActiveTasksPanelRealtime />)

      expect(mockUseRealtimeUpdates).toHaveBeenCalled()

      expect(mockUseRealtimeUpdatesArgs?.autoConnect).toBe(true)
      expect(mockUseRealtimeUpdatesArgs?.subscription?.eventTypes).toEqual([
        'task:created',
        'task:started',
        'task:stage-changed',
        'task:completed',
        'task:failed',
        'task:paused',
      ])
      expect(mockUseRealtimeUpdatesArgs?.subscription?.taskIds).toBeUndefined()
      expect(mockUseRealtimeUpdatesArgs?.subscription?.includeHealth).toBe(true)
      expect(mockUseRealtimeUpdatesArgs?.subscription?.includePerformance).toBe(false)
    })

    it('passes taskIds filter when provided', () => {
      render(<ActiveTasksPanelRealtime taskIds={['task-1', 'task-2']} />)

      expect(mockUseRealtimeUpdates).toHaveBeenCalled()

      expect(mockUseRealtimeUpdatesArgs?.subscription?.taskIds).toEqual(['task-1', 'task-2'])
    })

    it('disables health when connection indicator is hidden', () => {
      render(<ActiveTasksPanelRealtime showConnectionIndicator={false} />)

      expect(mockUseRealtimeUpdates).toHaveBeenCalled()

      expect(mockUseRealtimeUpdatesArgs?.subscription?.includeHealth).toBe(false)
    })
  })

  describe('Task Sorting', () => {
    it('sorts tasks by most recently updated', () => {
      const tasksWithDifferentTimes = [
        { ...mockTasks[0], id: 'task-1', updatedAt: '2024-01-01T10:00:00Z' },
        { ...mockTasks[1], id: 'task-2', updatedAt: '2024-01-01T12:00:00Z' }, // Most recent
        { ...mockTasks[2], id: 'task-3', updatedAt: '2024-01-01T08:00:00Z' },
      ]

      render(<ActiveTasksPanelRealtime initialTasks={tasksWithDifferentTimes} defaultShowActiveOnly={false} />)

      // The most recently updated task should appear first
      const taskCards = screen.getAllByTestId(/^task-card-/)
      expect(taskCards[0]).toHaveAttribute('data-testid', 'task-card-task-2')
    })
  })
})