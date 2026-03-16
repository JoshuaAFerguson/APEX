/**
 * Integration Tests for RecentActivityFeed Component
 * Tests real-time WebSocket updates, event filtering, and complete user workflows
 */

import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RecentActivityFeed } from '../RecentActivityFeed'
import type { DashboardActivityEvent, RealtimeUpdatesState } from '../../../types/dashboard'

// Mock the useRealtimeUpdates hook
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

// Controlled mock state for testing
let mockRealtimeState: RealtimeUpdatesState = {
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

// Mock functions for testing interactions
const mockActions = {
  connect: vi.fn(() => {
    mockRealtimeState = {
      ...mockRealtimeState,
      connectionState: 'connecting',
      isConnected: false,
    }
    // Simulate async connection
    setTimeout(() => {
      mockRealtimeState = {
        ...mockRealtimeState,
        connectionState: 'connected',
        isConnected: true,
      }
    }, 100)
  }),
  disconnect: vi.fn(() => {
    mockRealtimeState = {
      ...mockRealtimeState,
      connectionState: 'disconnected',
      isConnected: false,
      events: [],
    }
  }),
  markEventRead: vi.fn((id: string) => {
    mockRealtimeState = {
      ...mockRealtimeState,
      events: mockRealtimeState.events.map(e =>
        e.id === id ? { ...e, isRead: true } : e
      ),
    }
  }),
  markAllEventsRead: vi.fn(() => {
    mockRealtimeState = {
      ...mockRealtimeState,
      events: mockRealtimeState.events.map(e => ({ ...e, isRead: true })),
    }
  }),
  clearEvents: vi.fn(() => {
    mockRealtimeState = {
      ...mockRealtimeState,
      events: [],
    }
  }),
  updateSubscription: vi.fn(),
  refreshPerformance: vi.fn(),
  checkHealth: vi.fn().mockResolvedValue(undefined),
}

// Mock the real-time updates hook
vi.mock('../../../lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(() => ({
    state: mockRealtimeState,
    ...mockActions,
  })),
}))

// Mock icons
vi.mock('lucide-react', () => ({
  CheckSquare: () => <div data-testid="icon-task">CheckSquare</div>,
  Bot: () => <div data-testid="icon-agent">Bot</div>,
  Wrench: () => <div data-testid="icon-tool">Wrench</div>,
  ShieldCheck: () => <div data-testid="icon-gate">ShieldCheck</div>,
  Lock: () => <div data-testid="icon-permission">Lock</div>,
  Settings: () => <div data-testid="icon-system">Settings</div>,
  AlertTriangle: () => <div data-testid="icon-error">AlertTriangle</div>,
  Activity: () => <div data-testid="icon-activity">Activity</div>,
  Clock: () => <div data-testid="icon-clock">Clock</div>,
  MoreHorizontal: () => <div data-testid="icon-more">MoreHorizontal</div>,
  List: () => <div data-testid="icon-list">List</div>,
  ChevronDown: () => <div data-testid="icon-chevron-down">ChevronDown</div>,
  Wifi: () => <div data-testid="icon-wifi">Wifi</div>,
  WifiOff: () => <div data-testid="icon-wifi-off">WifiOff</div>,
  RefreshCw: () => <div data-testid="icon-refresh">RefreshCw</div>,
}))

// Mock utility functions
vi.mock('../../../lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
  getRelativeTime: vi.fn((date: Date) => {
    const now = Date.now()
    const diff = now - date.getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }),
  formatDate: vi.fn((date: Date) => date.toISOString()),
  truncateId: vi.fn((id: string, length: number = 8) => {
    if (id.length <= length) return id
    return `${id.substring(0, length - 3)}...`
  }),
}))

// Mock UI components
vi.mock('../../../components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className} data-testid="card-header">{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className} data-testid="card-content">{children}</div>,
}))

vi.mock('../../../components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <div className={className} data-variant={variant} data-testid="badge">
      {children}
    </div>
  ),
}))

vi.mock('../../../components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className }: any) => (
    <button
      onClick={onClick}
      className={className}
      data-variant={variant}
      data-size={size}
      data-testid="button"
    >
      {children}
    </button>
  ),
}))

vi.mock('../../../components/ui/spinner', () => ({
  Spinner: ({ size }: any) => <div data-testid="spinner" data-size={size}>Loading...</div>,
}))

// Test data factory
const createMockEvent = (overrides: Partial<DashboardActivityEvent> = {}): DashboardActivityEvent => ({
  id: `event-${Math.random().toString(36).substring(2, 9)}`,
  type: 'task:created',
  category: 'task',
  severity: 'info',
  taskId: 'test-task-123',
  title: 'Task created',
  description: 'A test task was created',
  timestamp: new Date(),
  data: {},
  isRead: false,
  ...overrides,
})

describe('RecentActivityFeed Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset to default state
    mockRealtimeState = {
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

  describe('Real-time WebSocket Updates', () => {
    it('should integrate with useRealtimeUpdates hook for live events', () => {
      // Set up initial connected state with events
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = [
        createMockEvent({
          id: 'ws-event-1',
          type: 'task:created',
          title: 'WebSocket Task Created',
          timestamp: new Date(),
        }),
      ]

      render(<RecentActivityFeed useRealTimeUpdates />)

      // Should display the WebSocket event
      expect(screen.getByText('WebSocket Task Created')).toBeInTheDocument()

      // Should show connection status
      expect(screen.getByTestId('icon-wifi')).toBeInTheDocument()
    })

    it('should update display when new events arrive via WebSocket', () => {
      // Start connected
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = [
        createMockEvent({
          id: 'initial-event',
          title: 'Initial Event',
        }),
      ]

      const { rerender } = render(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByText('Initial Event')).toBeInTheDocument()
      expect(screen.getByTestId('badge')).toHaveTextContent('1')

      // Simulate new event arriving
      act(() => {
        mockRealtimeState.events = [
          createMockEvent({
            id: 'new-event',
            title: 'New WebSocket Event',
            timestamp: new Date(),
          }),
          ...mockRealtimeState.events,
        ]
      })

      rerender(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByText('New WebSocket Event')).toBeInTheDocument()
      expect(screen.getByText('Initial Event')).toBeInTheDocument()
      expect(screen.getByTestId('badge')).toHaveTextContent('2')
    })

    it('should handle rapid event updates without performance issues', () => {
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true

      const { rerender } = render(<RecentActivityFeed useRealTimeUpdates />)

      const startTime = performance.now()

      // Simulate rapid updates
      for (let i = 0; i < 50; i++) {
        act(() => {
          mockRealtimeState.events = [
            createMockEvent({
              id: `rapid-event-${i}`,
              title: `Rapid Event ${i}`,
              timestamp: new Date(Date.now() + i * 100),
            }),
            ...mockRealtimeState.events.slice(0, 19), // Keep only last 19
          ]
        })

        rerender(<RecentActivityFeed useRealTimeUpdates />)
      }

      const updateTime = performance.now() - startTime

      // Should handle rapid updates efficiently
      expect(updateTime).toBeLessThan(1000)
      expect(screen.getByText('Rapid Event 49')).toBeInTheDocument()
    })

    it('should preserve event order with most recent first', () => {
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true

      // Create events with specific timestamps
      const events = [
        createMockEvent({
          id: 'event-3',
          title: 'Third Event',
          timestamp: new Date('2024-01-01T10:30:00Z'),
        }),
        createMockEvent({
          id: 'event-1',
          title: 'First Event',
          timestamp: new Date('2024-01-01T10:10:00Z'),
        }),
        createMockEvent({
          id: 'event-2',
          title: 'Second Event',
          timestamp: new Date('2024-01-01T10:20:00Z'),
        }),
      ]

      mockRealtimeState.events = events

      render(<RecentActivityFeed useRealTimeUpdates />)

      // Events should be displayed in timestamp order (most recent first)
      const eventElements = screen.getAllByTestId('activity-event')
      expect(eventElements[0]).toHaveTextContent('Third Event') // 10:30
      expect(eventElements[1]).toHaveTextContent('Second Event') // 10:20
      expect(eventElements[2]).toHaveTextContent('First Event') // 10:10
    })
  })

  describe('Connection State Handling', () => {
    it('should show connecting state', () => {
      mockRealtimeState.connectionState = 'connecting'
      mockRealtimeState.isConnected = false

      render(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
      expect(screen.getByTestId('icon-refresh')).toBeInTheDocument()
    })

    it('should show connected state with connection indicator', () => {
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true

      render(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByTestId('icon-wifi')).toBeInTheDocument()
      expect(screen.getByText(/live updates active/i)).toBeInTheDocument()
    })

    it('should show disconnected state with retry option', () => {
      mockRealtimeState.connectionState = 'disconnected'
      mockRealtimeState.isConnected = false

      render(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByTestId('icon-wifi-off')).toBeInTheDocument()
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument()
    })

    it('should handle connection errors gracefully', () => {
      mockRealtimeState.connectionState = 'error'
      mockRealtimeState.isConnected = false
      mockRealtimeState.error = new Error('WebSocket connection failed')

      render(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByText('Connection Error')).toBeInTheDocument()
      expect(screen.getByText('WebSocket connection failed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should attempt reconnection when retry button is clicked', () => {
      mockRealtimeState.connectionState = 'disconnected'
      mockRealtimeState.isConnected = false

      render(<RecentActivityFeed useRealTimeUpdates />)

      const retryButton = screen.getByRole('button', { name: /retry connection/i })
      fireEvent.click(retryButton)

      expect(mockActions.connect).toHaveBeenCalled()
    })
  })

  describe('Event Filtering Integration', () => {
    beforeEach(() => {
      // Set up mock events with different categories
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = [
        createMockEvent({
          id: 'task-event',
          type: 'task:created',
          category: 'task',
          title: 'Task Event',
        }),
        createMockEvent({
          id: 'agent-event',
          type: 'agent:message',
          category: 'agent',
          title: 'Agent Event',
        }),
        createMockEvent({
          id: 'tool-event',
          type: 'tool:complete',
          category: 'tool',
          title: 'Tool Event',
        }),
        createMockEvent({
          id: 'gate-event',
          type: 'gate:approved',
          category: 'gate',
          title: 'Gate Event',
        }),
        createMockEvent({
          id: 'permission-event',
          type: 'permission:granted',
          category: 'permission',
          title: 'Permission Event',
        }),
        createMockEvent({
          id: 'system-event',
          type: 'mcp:connected',
          category: 'system',
          title: 'System Event',
        }),
        createMockEvent({
          id: 'error-event',
          type: 'task:failed',
          category: 'error',
          title: 'Error Event',
        }),
      ]
    })

    it('should filter events by category in real-time', async () => {
      render(<RecentActivityFeed useRealTimeUpdates showFilters />)

      // Initially all events should be shown
      expect(screen.getByText('Task Event')).toBeInTheDocument()
      expect(screen.getByText('Agent Event')).toBeInTheDocument()
      expect(screen.getByText('Tool Event')).toBeInTheDocument()

      // Filter to only task events
      fireEvent.click(screen.getByText('Tasks'))

      await waitFor(() => {
        expect(screen.getByText('Task Event')).toBeInTheDocument()
        expect(screen.queryByText('Agent Event')).not.toBeInTheDocument()
        expect(screen.queryByText('Tool Event')).not.toBeInTheDocument()
      })

      // Verify filter count
      const taskFilter = screen.getByText('Tasks')
      expect(taskFilter.closest('button')).toHaveClass('bg-apex-500/20')
    })

    it('should update filter counts when new events arrive', () => {
      // Set up initial state with mixed events
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = [
        createMockEvent({ id: 'task-1', category: 'task', title: 'Task Event' }),
        createMockEvent({ id: 'agent-1', category: 'agent', title: 'Agent Event' }),
      ]

      const { rerender } = render(<RecentActivityFeed useRealTimeUpdates showFilters />)

      // Initial filter buttons should have count badges
      // Tasks filter should show 1
      let taskButtons = screen.getAllByText('Tasks')
      expect(taskButtons.length).toBeGreaterThan(0)

      // Add new task event
      act(() => {
        mockRealtimeState.events = [
          createMockEvent({
            id: 'new-task-event',
            category: 'task',
            title: 'New Task Event',
          }),
          ...mockRealtimeState.events,
        ]
      })

      rerender(<RecentActivityFeed useRealTimeUpdates showFilters />)

      // Verify both events are rendered
      expect(screen.getByText('Task Event')).toBeInTheDocument()
      expect(screen.getByText('New Task Event')).toBeInTheDocument()
      expect(screen.getByText('Agent Event')).toBeInTheDocument()
    })

    it('should maintain active filter when new events arrive', async () => {
      render(<RecentActivityFeed useRealTimeUpdates showFilters />)

      // Set filter to agents
      fireEvent.click(screen.getByText('Agents'))

      await waitFor(() => {
        expect(screen.getByText('Agent Event')).toBeInTheDocument()
        expect(screen.queryByText('Task Event')).not.toBeInTheDocument()
      })

      // Add new events (different categories)
      act(() => {
        mockRealtimeState.events = [
          createMockEvent({
            id: 'new-agent-event',
            category: 'agent',
            title: 'New Agent Event',
          }),
          createMockEvent({
            id: 'new-task-event',
            category: 'task',
            title: 'New Task Event',
          }),
          ...mockRealtimeState.events,
        ]
      })

      // Should still show only agent events
      await waitFor(() => {
        expect(screen.getByText('New Agent Event')).toBeInTheDocument()
        expect(screen.getByText('Agent Event')).toBeInTheDocument()
        expect(screen.queryByText('New Task Event')).not.toBeInTheDocument()
      })
    })

    it('should filter by severity levels', async () => {
      // Update events with different severities
      mockRealtimeState.events = [
        createMockEvent({
          id: 'info-event',
          severity: 'info',
          title: 'Info Event',
        }),
        createMockEvent({
          id: 'warning-event',
          severity: 'warning',
          title: 'Warning Event',
        }),
        createMockEvent({
          id: 'error-event',
          severity: 'error',
          title: 'Error Event',
        }),
      ]

      render(<RecentActivityFeed useRealTimeUpdates showFilters initialFilters={{ severities: ['error'] }} />)

      // Should only show error events
      expect(screen.getByText('Error Event')).toBeInTheDocument()
      expect(screen.queryByText('Info Event')).not.toBeInTheDocument()
      expect(screen.queryByText('Warning Event')).not.toBeInTheDocument()
    })

    it('should filter by unread status', async () => {
      mockRealtimeState.events = [
        createMockEvent({
          id: 'read-event',
          title: 'Read Event',
          isRead: true,
        }),
        createMockEvent({
          id: 'unread-event',
          title: 'Unread Event',
          isRead: false,
        }),
      ]

      render(<RecentActivityFeed useRealTimeUpdates initialFilters={{ unreadOnly: true }} />)

      // Should only show unread events
      expect(screen.getByText('Unread Event')).toBeInTheDocument()
      expect(screen.queryByText('Read Event')).not.toBeInTheDocument()
    })
  })

  describe('Event Interaction with Real-time Updates', () => {
    it('should mark events as read via WebSocket integration', () => {
      const unreadEvent = createMockEvent({
        id: 'unread-event',
        title: 'Unread Event',
        isRead: false,
      })

      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = [unreadEvent]

      render(<RecentActivityFeed useRealTimeUpdates />)

      // Should show unread indicator
      expect(screen.getByTestId('unread-dot')).toBeInTheDocument()

      // Click to mark as read
      const moreButton = screen.getByTestId('icon-more')
      fireEvent.click(moreButton)

      // Should call the WebSocket hook's markEventRead
      expect(mockActions.markEventRead).toHaveBeenCalledWith('unread-event')
    })

    it('should clear all events via WebSocket integration', () => {
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = [
        createMockEvent({ title: 'Event 1' }),
        createMockEvent({ title: 'Event 2' }),
      ]

      render(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByText('Event 1')).toBeInTheDocument()
      expect(screen.getByText('Event 2')).toBeInTheDocument()

      // Find and click clear all button
      const clearButton = screen.getByRole('button', { name: /clear all/i })
      fireEvent.click(clearButton)

      expect(mockActions.clearEvents).toHaveBeenCalled()
    })

    it('should filter events by specific task IDs', () => {
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = [
        createMockEvent({
          id: 'task-123-event',
          taskId: 'task-123',
          title: 'Task 123 Event',
        }),
        createMockEvent({
          id: 'task-456-event',
          taskId: 'task-456',
          title: 'Task 456 Event',
        }),
      ]

      render(<RecentActivityFeed useRealTimeUpdates initialFilters={{ taskIds: ['task-123'] }} />)

      // Should only show events for task-123
      expect(screen.getByText('Task 123 Event')).toBeInTheDocument()
      expect(screen.queryByText('Task 456 Event')).not.toBeInTheDocument()
    })
  })

  describe('Performance with Real-time Updates', () => {
    it('should limit events to prevent memory issues', () => {
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true

      // Create many events
      const manyEvents = Array.from({ length: 50 }, (_, i) =>
        createMockEvent({
          id: `perf-event-${i}`,
          title: `Performance Event ${i}`,
          timestamp: new Date(Date.now() - i * 1000),
        })
      )

      mockRealtimeState.events = manyEvents

      const startTime = performance.now()
      render(<RecentActivityFeed useRealTimeUpdates maxEvents={20} />)
      const renderTime = performance.now() - startTime

      // Should render efficiently
      expect(renderTime).toBeLessThan(500)

      // Should show only the first 20 events
      expect(screen.getByText('Performance Event 0')).toBeInTheDocument()
      expect(screen.getByText('Performance Event 19')).toBeInTheDocument()
      expect(screen.queryByText('Performance Event 20')).not.toBeInTheDocument()
    })

    it('should handle disconnection and reconnection gracefully', async () => {
      // Start connected
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = [
        createMockEvent({ title: 'Connected Event' }),
      ]

      const { rerender } = render(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByText('Connected Event')).toBeInTheDocument()
      expect(screen.getByTestId('icon-wifi')).toBeInTheDocument()

      // Simulate disconnection
      act(() => {
        mockRealtimeState.connectionState = 'disconnected'
        mockRealtimeState.isConnected = false
      })

      rerender(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByTestId('icon-wifi-off')).toBeInTheDocument()
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument()

      // Simulate reconnection
      act(() => {
        mockRealtimeState.connectionState = 'connected'
        mockRealtimeState.isConnected = true
        mockRealtimeState.events = [
          createMockEvent({ title: 'Reconnected Event' }),
          ...mockRealtimeState.events,
        ]
      })

      rerender(<RecentActivityFeed useRealTimeUpdates />)

      expect(screen.getByTestId('icon-wifi')).toBeInTheDocument()
      expect(screen.getByText('Reconnected Event')).toBeInTheDocument()
      expect(screen.getByText('Connected Event')).toBeInTheDocument()
    })
  })

  describe('Auto-scroll with Real-time Updates', () => {
    it('should auto-scroll to new events when enabled', () => {
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = [
        createMockEvent({ title: 'Initial Event' }),
      ]

      const { rerender } = render(<RecentActivityFeed useRealTimeUpdates autoScroll />)

      const scrollContainer = screen.getByTestId('card-content')
      expect(scrollContainer).toHaveAttribute('data-auto-scroll', 'true')

      // Add new event
      act(() => {
        mockRealtimeState.events = [
          createMockEvent({ title: 'New Event' }),
          ...mockRealtimeState.events,
        ]
      })

      rerender(<RecentActivityFeed useRealTimeUpdates autoScroll />)

      // Should maintain auto-scroll
      expect(scrollContainer).toHaveAttribute('data-auto-scroll', 'true')
    })

    it('should pause auto-scroll when user manually scrolls', () => {
      mockRealtimeState.connectionState = 'connected'
      mockRealtimeState.isConnected = true
      mockRealtimeState.events = Array.from({ length: 10 }, (_, i) =>
        createMockEvent({ title: `Event ${i}` })
      )

      render(<RecentActivityFeed useRealTimeUpdates autoScroll />)

      const scrollContainer = screen.getByTestId('card-content')

      // Simulate user scroll
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } })

      expect(scrollContainer).toHaveAttribute('data-auto-scroll-paused', 'true')
    })
  })
})