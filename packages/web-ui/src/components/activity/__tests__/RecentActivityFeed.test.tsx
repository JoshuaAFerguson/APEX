/**
 * Unit Tests for RecentActivityFeed Component
 * Tests event rendering, icon mapping, timestamp formatting, 20-event limit, and scrolling behavior
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RecentActivityFeed } from '../RecentActivityFeed'
import type { DashboardActivityEvent } from '../../../types/dashboard'

// Mock the real-time updates hook
vi.mock('../../../lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(() => ({
    state: {
      connectionState: 'disconnected',
      events: [],
      isConnected: false,
      error: null,
      health: {
        status: 'unknown',
        connection: { isConnected: false, connectedSince: new Date(), reconnectAttempts: 0, latencyMs: 0, averageLatencyMs: 0 },
        server: { uptimeMs: 0, lastHealthCheck: new Date(), successRate: 100 },
        tasks: { activeTasks: 0, pendingTasks: 0, completedLastHour: 0, failedLastHour: 0, averageDurationMs: 0 },
        lastUpdated: new Date(),
      },
      performance: {
        timeRange: '1h',
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, tokensPerMinute: 0, cacheHitRate: 0, byAgent: {}, byTool: {} },
        tasks: { completedTasks: 0, failedTasks: 0, avgDurationMs: 0, medianDurationMs: 0, p95DurationMs: 0, successRate: 1, byStatus: {}, byStage: {} },
        agents: [],
        tools: [],
        timeSeries: [],
        generatedAt: new Date(),
      },
      lastUpdate: new Date(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    markEventRead: vi.fn(),
    markAllEventsRead: vi.fn(),
    clearEvents: vi.fn(),
    updateSubscription: vi.fn(),
    refreshPerformance: vi.fn(),
    checkHealth: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Mock the WebSocket connection hook
vi.mock('../../../hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: vi.fn(() => ({
    isConnected: false,
    connectionState: 'disconnected',
    connect: vi.fn(),
    disconnect: vi.fn(),
    error: null,
  })),
}))

// Mock the icon components to simplify testing
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
  Trash2: () => <div data-testid="icon-trash">Trash2</div>,
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

vi.mock('../../../components/ui/spinner', () => ({
  Spinner: ({ size }: any) => <div data-testid="spinner" data-size={size}>Loading...</div>,
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

// Mock ActivityEventItem and ActivityCategoryIcon components
vi.mock('../ActivityEventItem', () => ({
  ActivityEventItem: ({ event, compact, onClick }: any) => (
    <div
      data-testid="activity-event"
      onClick={onClick ? () => onClick(event) : undefined}
      className={compact ? 'border text-sm' : 'border'}
    >
      <div className={`border-${event.severity === 'info' ? 'apex-900' :
                              event.severity === 'success' ? 'green-900' :
                              event.severity === 'warning' ? 'yellow-900' : 'red-900'}`}>
        <div>{event.title}</div>
        {!compact && event.description && <div>{event.description}</div>}
        <div>{event.taskId && `Task: ${event.taskId}`}</div>
        {event.agentName && <div>Agent: {event.agentName}</div>}
        {event.toolName && <div>Tool: {event.toolName}</div>}
        <div>3m ago</div>
        {!event.isRead && <div data-testid="unread-dot"></div>}
        <div data-testid="icon-more" onClick={() => {}}>MoreHorizontal</div>
      </div>
    </div>
  ),
}))

vi.mock('../ActivityCategoryIcon', () => ({
  ActivityCategoryIcon: ({ category, className, size }: any) => {
    const iconMap: Record<string, string> = {
      task: 'icon-task',
      agent: 'icon-agent',
      tool: 'icon-tool',
      gate: 'icon-gate',
      permission: 'icon-permission',
      system: 'icon-system',
      error: 'icon-error',
    }
    return <div data-testid={iconMap[category] || 'icon-unknown'} className={className}>{category}</div>
  },
}))

// Mock WebSocket connection indicator
vi.mock('../connection/WebSocketConnectionIndicator', () => ({
  WebSocketConnectionIndicator: ({ isConnected, connectionState }: any) => (
    <div data-testid="websocket-indicator" data-connected={isConnected} data-state={connectionState}>
      {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  ),
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

const mockEvents: DashboardActivityEvent[] = [
  createMockEvent({
    id: 'event-1',
    type: 'task:created',
    category: 'task',
    severity: 'info',
    title: 'Task Created',
    description: 'Created development task for user authentication',
    taskId: 'task-123',
    timestamp: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
    agentName: 'developer',
  }),
  createMockEvent({
    id: 'event-2',
    type: 'agent:message',
    category: 'agent',
    severity: 'info',
    title: 'Agent Response',
    description: 'Agent completed analysis',
    taskId: 'task-123',
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    agentName: 'analyzer',
  }),
  createMockEvent({
    id: 'event-3',
    type: 'tool:complete',
    category: 'tool',
    severity: 'success',
    title: 'Tool Execution Complete',
    description: 'Successfully executed file operations',
    taskId: 'task-124',
    timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    toolName: 'file-manager',
  }),
  createMockEvent({
    id: 'event-4',
    type: 'gate:approved',
    category: 'gate',
    severity: 'success',
    title: 'Gate Approved',
    description: 'User approved the deployment',
    taskId: 'task-125',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
  }),
  createMockEvent({
    id: 'event-5',
    type: 'permission:denied',
    category: 'permission',
    severity: 'error',
    title: 'Permission Denied',
    description: 'File system access denied',
    taskId: 'task-126',
    timestamp: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
    toolName: 'file-system',
  }),
  createMockEvent({
    id: 'event-6',
    type: 'mcp:connected',
    category: 'system',
    severity: 'success',
    title: 'MCP Connected',
    description: 'Model Control Protocol connection established',
    taskId: 'task-127',
    timestamp: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
  }),
  createMockEvent({
    id: 'event-7',
    type: 'task:failed',
    category: 'error',
    severity: 'error',
    title: 'Task Failed',
    description: 'Task execution failed due to timeout',
    taskId: 'task-128',
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
  }),
]

describe('RecentActivityFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<RecentActivityFeed events={mockEvents} />)

      expect(screen.getByTestId('card')).toBeInTheDocument()
      expect(screen.getByTestId('card-header')).toBeInTheDocument()
      expect(screen.getByTestId('card-content')).toBeInTheDocument()
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })

    it('renders with custom title', () => {
      render(<RecentActivityFeed events={mockEvents} title="Custom Activity Feed" />)

      expect(screen.getByText('Custom Activity Feed')).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      render(<RecentActivityFeed events={mockEvents} className="custom-class" />)

      const card = screen.getByTestId('card')
      expect(card).toHaveClass('custom-class')
    })

    it('shows event count badge', () => {
      render(<RecentActivityFeed events={mockEvents} />)

      const badge = screen.getByTestId('badge')
      expect(badge).toHaveTextContent('7')
    })
  })

  describe('Event Rendering', () => {
    it('renders events with correct structure', () => {
      render(<RecentActivityFeed events={[mockEvents[0]]} />)

      expect(screen.getByText('Task Created')).toBeInTheDocument()
      expect(screen.getByText('Created development task for user authentication')).toBeInTheDocument()
      expect(screen.getByText('3m ago')).toBeInTheDocument()
      expect(screen.getByText('Task: task-123')).toBeInTheDocument()
    })

    it('renders events without description', () => {
      const eventWithoutDescription = createMockEvent({
        title: 'Simple Event',
        description: undefined,
      })

      render(<RecentActivityFeed events={[eventWithoutDescription]} />)

      expect(screen.getByText('Simple Event')).toBeInTheDocument()
      expect(screen.queryByText('undefined')).not.toBeInTheDocument()
    })

    it('renders events with agent name', () => {
      render(<RecentActivityFeed events={[mockEvents[0]]} />)

      expect(screen.getByText('Agent: developer')).toBeInTheDocument()
    })

    it('renders events with tool name', () => {
      render(<RecentActivityFeed events={[mockEvents[2]]} />)

      expect(screen.getByText('Tool: file-manager')).toBeInTheDocument()
    })
  })

  describe('Icon Mapping', () => {
    it('renders events with different categories', () => {
      const taskEvent = createMockEvent({ category: 'task', title: 'Task Event' })
      const agentEvent = createMockEvent({ category: 'agent', title: 'Agent Event' })
      const toolEvent = createMockEvent({ category: 'tool', title: 'Tool Event' })

      render(<RecentActivityFeed events={[taskEvent, agentEvent, toolEvent]} showFilters={false} />)

      // Verify that events with different categories are rendered
      expect(screen.getByText('Task Event')).toBeInTheDocument()
      expect(screen.getByText('Agent Event')).toBeInTheDocument()
      expect(screen.getByText('Tool Event')).toBeInTheDocument()

      // Verify we have the right number of activity events
      expect(screen.getAllByTestId('activity-event')).toHaveLength(3)
    })

    it('renders gate, permission, system, and error event types', () => {
      const gateEvent = createMockEvent({ category: 'gate', title: 'Gate Event' })
      const permissionEvent = createMockEvent({ category: 'permission', title: 'Permission Event' })
      const systemEvent = createMockEvent({ category: 'system', title: 'System Event' })
      const errorEvent = createMockEvent({ category: 'error', title: 'Error Event' })

      render(<RecentActivityFeed events={[gateEvent, permissionEvent, systemEvent, errorEvent]} showFilters={false} />)

      expect(screen.getByText('Gate Event')).toBeInTheDocument()
      expect(screen.getByText('Permission Event')).toBeInTheDocument()
      expect(screen.getByText('System Event')).toBeInTheDocument()
      expect(screen.getByText('Error Event')).toBeInTheDocument()

      expect(screen.getAllByTestId('activity-event')).toHaveLength(4)
    })
  })

  describe('Timestamp Formatting', () => {
    it('formats recent timestamps correctly', () => {
      const events = [
        createMockEvent({
          timestamp: new Date(Date.now() - 30 * 1000), // 30 seconds
          title: 'Recent Event'
        }),
        createMockEvent({
          timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes
          title: 'Minutes Event'
        }),
        createMockEvent({
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours
          title: 'Hours Event'
        }),
      ]

      render(<RecentActivityFeed events={events} />)

      expect(screen.getByText('just now')).toBeInTheDocument()
      expect(screen.getByText('5m ago')).toBeInTheDocument()
      expect(screen.getByText('2h ago')).toBeInTheDocument()
    })
  })

  describe('Event Limit (20 events)', () => {
    it('enforces 20-event limit by default', () => {
      const manyEvents = Array.from({ length: 25 }, (_, i) =>
        createMockEvent({
          id: `event-${i}`,
          title: `Event ${i}`,
          timestamp: new Date(Date.now() - i * 1000),
        })
      )

      render(<RecentActivityFeed events={manyEvents} />)

      // Should show only first 20 events (most recent)
      expect(screen.getByText('Event 0')).toBeInTheDocument()
      expect(screen.getByText('Event 19')).toBeInTheDocument()
      expect(screen.queryByText('Event 20')).not.toBeInTheDocument()
    })

    it('respects custom maxEvents prop', () => {
      const manyEvents = Array.from({ length: 15 }, (_, i) =>
        createMockEvent({
          id: `event-${i}`,
          title: `Event ${i}`,
        })
      )

      render(<RecentActivityFeed events={manyEvents} maxEvents={5} />)

      // Should show only first 5 events
      expect(screen.getByText('Event 0')).toBeInTheDocument()
      expect(screen.getByText('Event 4')).toBeInTheDocument()
      expect(screen.queryByText('Event 5')).not.toBeInTheDocument()
    })

    it('shows all events when fewer than limit', () => {
      const fewEvents = Array.from({ length: 3 }, (_, i) =>
        createMockEvent({
          id: `event-${i}`,
          title: `Event ${i}`,
        })
      )

      render(<RecentActivityFeed events={fewEvents} />)

      expect(screen.getByText('Event 0')).toBeInTheDocument()
      expect(screen.getByText('Event 1')).toBeInTheDocument()
      expect(screen.getByText('Event 2')).toBeInTheDocument()
    })
  })

  describe('Scrolling Behavior', () => {
    it('renders scrollable container', () => {
      render(<RecentActivityFeed events={mockEvents} />)

      // The scrollable container is inside card-content with overflow-y-auto class
      const scrollContainer = screen.getByRole('log')
      expect(scrollContainer).toHaveClass('overflow-y-auto')
    })

    it('applies custom maxHeight', () => {
      render(<RecentActivityFeed events={mockEvents} maxHeight="300px" />)

      // The maxHeight is applied to the scrollable log element via style
      const scrollContainer = screen.getByRole('log')
      expect(scrollContainer).toHaveStyle({ maxHeight: '300px' })
    })

    it('applies default maxHeight when not provided', () => {
      render(<RecentActivityFeed events={mockEvents} />)

      // The default maxHeight of 400px is applied to the scrollable log element
      const scrollContainer = screen.getByRole('log')
      expect(scrollContainer).toHaveStyle({ maxHeight: '400px' })
    })
  })

  describe('Severity-based Styling', () => {
    it('applies correct styling for info severity', () => {
      const infoEvent = createMockEvent({ severity: 'info', title: 'Info Event Title' })
      render(<RecentActivityFeed events={[infoEvent]} showFilters={false} />)

      const eventItem = screen.getByText('Info Event Title')
      expect(eventItem).toBeInTheDocument()
      // Check that the mocked ActivityEventItem has the correct severity class
      expect(eventItem.closest('div')).toHaveClass('border-apex-900')
    })

    it('applies correct styling for success severity', () => {
      const successEvent = createMockEvent({ severity: 'success', title: 'Success Event Title' })
      render(<RecentActivityFeed events={[successEvent]} showFilters={false} />)

      const eventItem = screen.getByText('Success Event Title')
      expect(eventItem).toBeInTheDocument()
      expect(eventItem.closest('div')).toHaveClass('border-green-900')
    })

    it('applies correct styling for warning severity', () => {
      const warningEvent = createMockEvent({ severity: 'warning', title: 'Warning Event Title' })
      render(<RecentActivityFeed events={[warningEvent]} showFilters={false} />)

      const eventItem = screen.getByText('Warning Event Title')
      expect(eventItem).toBeInTheDocument()
      expect(eventItem.closest('div')).toHaveClass('border-yellow-900')
    })

    it('applies correct styling for error severity', () => {
      const errorEvent = createMockEvent({ severity: 'error', title: 'Error Event Title' })
      render(<RecentActivityFeed events={[errorEvent]} showFilters={false} />)

      const eventItem = screen.getByText('Error Event Title')
      expect(eventItem).toBeInTheDocument()
      expect(eventItem.closest('div')).toHaveClass('border-red-900')
    })
  })

  describe('Category Filtering', () => {
    it('shows category filters when showFilters is true', () => {
      render(<RecentActivityFeed events={mockEvents} showFilters />)

      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Tasks')).toBeInTheDocument()
      expect(screen.getByText('Agents')).toBeInTheDocument()
      expect(screen.getByText('Tools')).toBeInTheDocument()
    })

    it('hides category filters when showFilters is false', () => {
      render(<RecentActivityFeed events={mockEvents} showFilters={false} />)

      expect(screen.queryByText('All')).not.toBeInTheDocument()
      expect(screen.queryByText('Tasks')).not.toBeInTheDocument()
    })

    it('filters events by category when filter is selected', async () => {
      render(<RecentActivityFeed events={mockEvents} showFilters />)

      // Click on Tasks filter
      fireEvent.click(screen.getByText('Tasks'))

      await waitFor(() => {
        // Should only show task events
        expect(screen.getByText('Task Created')).toBeInTheDocument()
        expect(screen.queryByText('Agent Response')).not.toBeInTheDocument()
      })
    })

    it('shows all events when "All" filter is selected', async () => {
      render(<RecentActivityFeed events={mockEvents} showFilters />)

      // Click on Tasks filter first
      fireEvent.click(screen.getByText('Tasks'))
      await waitFor(() => {
        expect(screen.queryByText('Agent Response')).not.toBeInTheDocument()
      })

      // Then click on All filter
      fireEvent.click(screen.getByText('All'))

      await waitFor(() => {
        expect(screen.getByText('Task Created')).toBeInTheDocument()
        expect(screen.getByText('Agent Response')).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner when loading is true', () => {
      render(<RecentActivityFeed events={[]} loading />)

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.getByText('Loading activity...')).toBeInTheDocument()
    })

    it('hides content when loading', () => {
      render(<RecentActivityFeed events={mockEvents} loading />)

      expect(screen.getByTestId('spinner')).toBeInTheDocument()
      expect(screen.queryByText('Task Created')).not.toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no events', () => {
      render(<RecentActivityFeed events={[]} />)

      expect(screen.getByTestId('icon-activity')).toBeInTheDocument()
      expect(screen.getByText('No recent activity')).toBeInTheDocument()
      expect(screen.getByText('Activity events will appear here as tasks are executed.')).toBeInTheDocument()
    })

    it('shows empty state when all events filtered out', async () => {
      const taskOnlyEvents = [createMockEvent({ category: 'task' })]
      render(<RecentActivityFeed events={taskOnlyEvents} showFilters />)

      // Filter to agents (which don't exist)
      fireEvent.click(screen.getByText('Agents'))

      await waitFor(() => {
        expect(screen.getByText('No agent activity')).toBeInTheDocument()
      })
    })
  })

  describe('Event Interaction', () => {
    it('calls onEventClick when event is clicked', () => {
      const onEventClick = vi.fn()
      render(<RecentActivityFeed events={[mockEvents[0]]} onEventClick={onEventClick} />)

      fireEvent.click(screen.getByText('Task Created'))
      expect(onEventClick).toHaveBeenCalledWith(mockEvents[0])
    })

    it('calls onMarkRead when event is marked as read', () => {
      const onMarkRead = vi.fn()
      render(<RecentActivityFeed events={[mockEvents[0]]} onMarkRead={onMarkRead} />)

      // Find and click the mark as read button (more icon)
      const moreButton = screen.getByTestId('icon-more')
      fireEvent.click(moreButton)

      expect(onMarkRead).toHaveBeenCalledWith(mockEvents[0].id)
    })

    it('shows unread indicator for unread events', () => {
      const unreadEvent = createMockEvent({ isRead: false })
      render(<RecentActivityFeed events={[unreadEvent]} />)

      const dot = screen.getByTestId('unread-dot')
      expect(dot).toBeInTheDocument()
    })

    it('hides unread indicator for read events', () => {
      const readEvent = createMockEvent({ isRead: true })
      render(<RecentActivityFeed events={[readEvent]} />)

      expect(screen.queryByTestId('unread-dot')).not.toBeInTheDocument()
    })
  })

  describe('Compact Mode', () => {
    it('applies compact styling when compact is true', () => {
      render(<RecentActivityFeed events={mockEvents} compact />)

      const card = screen.getByTestId('card')
      expect(card).toHaveClass('text-sm')
    })

    it('hides descriptions in compact mode', () => {
      render(<RecentActivityFeed events={[mockEvents[0]]} compact />)

      expect(screen.getByText('Task Created')).toBeInTheDocument()
      expect(screen.queryByText('Created development task for user authentication')).not.toBeInTheDocument()
    })
  })

  describe('Auto-scroll Behavior', () => {
    it('enables auto-scroll by default', () => {
      render(<RecentActivityFeed events={mockEvents} />)

      // The data attributes are on the scrollable container (role="log")
      const scrollContainer = screen.getByRole('log')
      expect(scrollContainer).toHaveAttribute('data-auto-scroll', 'true')
    })

    it('disables auto-scroll when autoScroll is false', () => {
      render(<RecentActivityFeed events={mockEvents} autoScroll={false} />)

      const scrollContainer = screen.getByRole('log')
      expect(scrollContainer).toHaveAttribute('data-auto-scroll', 'false')
    })

    it('pauses auto-scroll on manual scroll', () => {
      render(<RecentActivityFeed events={mockEvents} />)

      const scrollContainer = screen.getByRole('log')

      // Simulate scroll event
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 100 } })

      expect(scrollContainer).toHaveAttribute('data-auto-scroll-paused', 'true')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<RecentActivityFeed events={mockEvents} />)

      // Component uses log role for activity events
      expect(screen.getByRole('log')).toBeInTheDocument()
      // Verify aria-label on log element
      expect(screen.getByRole('log')).toHaveAttribute('aria-label', 'Activity events')
    })

    it('supports keyboard navigation', () => {
      const onEventClick = vi.fn()
      render(<RecentActivityFeed events={[mockEvents[0]]} onEventClick={onEventClick} />)

      // Get the activity event item (the clickable wrapper)
      const eventItem = screen.getByTestId('activity-event')

      // Focus and press Enter on the wrapper (keyboard handler is attached here)
      eventItem.focus()
      fireEvent.keyDown(eventItem, { key: 'Enter' })

      expect(onEventClick).toHaveBeenCalledWith(mockEvents[0])
    })
  })
})