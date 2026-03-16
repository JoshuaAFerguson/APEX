import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DashboardActivityEvent } from '@/types/dashboard'
import { ActivityEventItem } from '../ActivityEventItem'

// Mock the utils module
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

// Mock the ui components
vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Activity: ({ className }: any) => <div data-testid="activity-icon" className={className} />,
  Bot: ({ className }: any) => <div data-testid="bot-icon" className={className} />,
  Wrench: ({ className }: any) => <div data-testid="wrench-icon" className={className} />,
  AlertCircle: ({ className }: any) => <div data-testid="alert-circle-icon" className={className} />,
  ShieldCheck: ({ className }: any) => <div data-testid="shield-check-icon" className={className} />,
  Lock: ({ className }: any) => <div data-testid="lock-icon" className={className} />,
  Info: ({ className }: any) => <div data-testid="info-icon" className={className} />,
  CheckCircle: ({ className }: any) => <div data-testid="check-circle-icon" className={className} />,
  Clock: ({ className }: any) => <div data-testid="clock-icon" className={className} />,
}))

describe('ActivityEventItem', () => {
  const mockEvent: DashboardActivityEvent = {
    id: 'event-1',
    type: 'task:completed',
    category: 'task',
    severity: 'success',
    taskId: 'task-12345678',
    title: 'Task completed successfully',
    description: 'The task has finished running',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    data: { result: 'success' },
    isRead: false,
    agentName: 'TestAgent',
    toolName: 'TestTool',
  }

  const mockProps = {
    event: mockEvent,
    onClick: vi.fn(),
    onMarkRead: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders basic event information correctly', () => {
    render(<ActivityEventItem {...mockProps} />)

    expect(screen.getByText('Task completed successfully')).toBeInTheDocument()
    expect(screen.getByText('The task has finished running')).toBeInTheDocument()
    expect(screen.getByTestId('activity-icon')).toBeInTheDocument()
  })

  it('shows task ID when showTaskId is true', () => {
    render(<ActivityEventItem {...mockProps} showTaskId />)

    expect(screen.getByText('Task:')).toBeInTheDocument()
    expect(screen.getByText('task-123')).toBeInTheDocument() // First 8 chars
  })

  it('hides task ID when showTaskId is false', () => {
    render(<ActivityEventItem {...mockProps} showTaskId={false} />)

    expect(screen.queryByText('Task:')).not.toBeInTheDocument()
  })

  it('shows timestamp when showTimestamp is true', () => {
    render(<ActivityEventItem {...mockProps} showTimestamp />)

    expect(screen.getByTestId('clock-icon')).toBeInTheDocument()
    // Should show relative time
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  it('shows source information when showSource is true', () => {
    render(<ActivityEventItem {...mockProps} showSource />)

    expect(screen.getByTestId('bot-icon')).toBeInTheDocument()
    expect(screen.getByText('TestAgent')).toBeInTheDocument()
    expect(screen.getByTestId('wrench-icon')).toBeInTheDocument()
    expect(screen.getByText('TestTool')).toBeInTheDocument()
  })

  it('applies correct icon based on event category', () => {
    const testCases = [
      { category: 'task' as const, icon: 'activity-icon' },
      { category: 'agent' as const, icon: 'bot-icon' },
      { category: 'tool' as const, icon: 'wrench-icon' },
      { category: 'error' as const, icon: 'alert-circle-icon' },
      { category: 'gate' as const, icon: 'shield-check-icon' },
      { category: 'permission' as const, icon: 'lock-icon' },
      { category: 'system' as const, icon: 'info-icon' },
    ]

    testCases.forEach(({ category, icon }) => {
      const { unmount } = render(
        <ActivityEventItem
          {...mockProps}
          event={{ ...mockEvent, category }}
        />
      )

      expect(screen.getByTestId(icon)).toBeInTheDocument()
      unmount()
    })
  })

  it('applies correct severity styling', () => {
    const testCases = [
      { severity: 'success' as const, expectedClass: 'text-green-300' },
      { severity: 'warning' as const, expectedClass: 'text-yellow-300' },
      { severity: 'error' as const, expectedClass: 'text-red-300' },
      { severity: 'info' as const, expectedClass: 'text-foreground' },
    ]

    testCases.forEach(({ severity, expectedClass }) => {
      const { unmount } = render(
        <ActivityEventItem
          {...mockProps}
          event={{ ...mockEvent, severity }}
        />
      )

      const title = screen.getByText('Task completed successfully')
      expect(title).toHaveClass(expectedClass)
      unmount()
    })
  })

  it('shows unread indicator for unread events', () => {
    const { container } = render(
      <ActivityEventItem {...mockProps} event={{ ...mockEvent, isRead: false }} />
    )

    // Should have unread indicator (small dot)
    const unreadIndicator = container.querySelector('.bg-apex-500')
    expect(unreadIndicator).toBeInTheDocument()
  })

  it('hides unread indicator for read events', () => {
    const { container } = render(
      <ActivityEventItem {...mockProps} event={{ ...mockEvent, isRead: true }} />
    )

    // Should not have unread indicator
    const unreadIndicator = container.querySelector('.bg-apex-500')
    expect(unreadIndicator).not.toBeInTheDocument()
  })

  it('shows mark as read button for unread events when onMarkRead is provided', () => {
    render(
      <ActivityEventItem
        {...mockProps}
        event={{ ...mockEvent, isRead: false }}
        onMarkRead={vi.fn()}
      />
    )

    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument()
  })

  it('hides mark as read button for read events', () => {
    render(
      <ActivityEventItem
        {...mockProps}
        event={{ ...mockEvent, isRead: true }}
        onMarkRead={vi.fn()}
      />
    )

    expect(screen.queryByTestId('check-circle-icon')).not.toBeInTheDocument()
  })

  it('calls onClick when event is clicked', () => {
    const onClick = vi.fn()
    render(<ActivityEventItem {...mockProps} onClick={onClick} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith(mockEvent)
  })

  it('calls onMarkRead when mark as read button is clicked', () => {
    const onMarkRead = vi.fn()
    render(
      <ActivityEventItem
        {...mockProps}
        event={{ ...mockEvent, isRead: false }}
        onMarkRead={onMarkRead}
      />
    )

    const markReadButton = screen.getByTitle('Mark as read')
    fireEvent.click(markReadButton)

    expect(onMarkRead).toHaveBeenCalledWith('event-1')
  })

  it('automatically marks as read when clicked if unread', () => {
    const onMarkRead = vi.fn()
    render(
      <ActivityEventItem
        {...mockProps}
        event={{ ...mockEvent, isRead: false }}
        onMarkRead={onMarkRead}
      />
    )

    fireEvent.click(screen.getByRole('button'))

    expect(onMarkRead).toHaveBeenCalledWith('event-1')
    expect(mockProps.onClick).toHaveBeenCalledWith(mockEvent)
  })

  it('applies compact styles when compact is true', () => {
    const { container } = render(
      <ActivityEventItem {...mockProps} compact />
    )

    // Should have smaller padding and gaps
    const eventContainer = container.firstChild
    expect(eventContainer).toHaveClass('p-2', 'gap-2')
  })

  it('handles keyboard navigation', () => {
    const onClick = vi.fn()
    render(<ActivityEventItem {...mockProps} onClick={onClick} />)

    const eventButton = screen.getByRole('button')

    // Test Enter key
    fireEvent.keyDown(eventButton, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)

    // Test Space key
    fireEvent.keyDown(eventButton, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)

    // Test other keys (should not trigger)
    fireEvent.keyDown(eventButton, { key: 'Tab' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('prevents mark as read event from bubbling to onClick', () => {
    const onClick = vi.fn()
    const onMarkRead = vi.fn()

    render(
      <ActivityEventItem
        {...mockProps}
        event={{ ...mockEvent, isRead: false }}
        onClick={onClick}
        onMarkRead={onMarkRead}
      />
    )

    const markReadButton = screen.getByTitle('Mark as read')
    fireEvent.click(markReadButton)

    expect(onMarkRead).toHaveBeenCalledWith('event-1')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('handles missing optional fields gracefully', () => {
    const minimalEvent: DashboardActivityEvent = {
      id: 'event-2',
      type: 'system:info',
      category: 'system',
      severity: 'info',
      taskId: '',
      title: 'System notification',
      timestamp: new Date(),
      data: {},
      isRead: false,
    }

    render(<ActivityEventItem event={minimalEvent} />)

    expect(screen.getByText('System notification')).toBeInTheDocument()
    // Should not show source info or description
    expect(screen.queryByTestId('bot-icon')).not.toBeInTheDocument()
    expect(screen.queryByTestId('wrench-icon')).not.toBeInTheDocument()
  })

  it('truncates long task IDs to 8 characters', () => {
    const longTaskIdEvent = {
      ...mockEvent,
      taskId: 'very-long-task-id-that-should-be-truncated',
    }

    render(<ActivityEventItem event={longTaskIdEvent} showTaskId />)

    expect(screen.getByText('very-lon')).toBeInTheDocument() // First 8 chars
    expect(screen.queryByText('very-long-task-id-that-should-be-truncated')).not.toBeInTheDocument()
  })

  it('formats relative timestamps correctly', () => {
    const now = new Date()
    const testCases = [
      { timestamp: new Date(now.getTime() - 5000), expected: /Just now|[0-9]+s ago/ },
      { timestamp: new Date(now.getTime() - 65000), expected: /1m ago/ },
      { timestamp: new Date(now.getTime() - 3665000), expected: /1h ago/ },
      { timestamp: new Date(now.getTime() - 90000000), expected: /1d ago/ },
    ]

    testCases.forEach(({ timestamp, expected }) => {
      const { unmount } = render(
        <ActivityEventItem
          {...mockProps}
          event={{ ...mockEvent, timestamp }}
          showTimestamp
        />
      )

      expect(screen.getByText(expected)).toBeInTheDocument()
      unmount()
    })
  })
})