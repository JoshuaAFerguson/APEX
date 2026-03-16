/**
 * Test Utilities for RecentActivityFeed Tests
 * Shared mock factories, helpers, and test data for activity feed component testing
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import type { DashboardActivityEvent, ActivityEventCategory, ActivityEventSeverity } from '../../../types/dashboard'

/**
 * Create a mock DashboardActivityEvent with sensible defaults
 */
export function createMockActivityEvent(
  overrides: Partial<DashboardActivityEvent> = {}
): DashboardActivityEvent {
  const id = overrides.id || `event-${Math.random().toString(36).substring(2, 9)}`
  const timestamp = overrides.timestamp || new Date()

  return {
    id,
    type: 'task:created',
    category: 'task',
    severity: 'info',
    taskId: `task-${id.split('-')[1] || '123'}`,
    title: 'Test Event',
    description: 'A test event for unit testing',
    timestamp,
    data: {},
    isRead: false,
    ...overrides,
  }
}

/**
 * Create multiple mock events with different categories
 */
export function createMockEventsByCategory(): DashboardActivityEvent[] {
  const baseTimestamp = Date.now()

  return [
    createMockActivityEvent({
      id: 'task-event',
      type: 'task:created',
      category: 'task',
      severity: 'info',
      title: 'Task Created',
      description: 'A new task was created',
      timestamp: new Date(baseTimestamp - 1000),
      agentName: 'developer',
    }),
    createMockActivityEvent({
      id: 'agent-event',
      type: 'agent:message',
      category: 'agent',
      severity: 'info',
      title: 'Agent Response',
      description: 'Agent provided a response',
      timestamp: new Date(baseTimestamp - 2000),
      agentName: 'analyzer',
    }),
    createMockActivityEvent({
      id: 'tool-event',
      type: 'tool:complete',
      category: 'tool',
      severity: 'success',
      title: 'Tool Execution Complete',
      description: 'Tool execution finished successfully',
      timestamp: new Date(baseTimestamp - 3000),
      toolName: 'file-manager',
    }),
    createMockActivityEvent({
      id: 'gate-event',
      type: 'gate:approved',
      category: 'gate',
      severity: 'success',
      title: 'Gate Approved',
      description: 'Approval gate was approved',
      timestamp: new Date(baseTimestamp - 4000),
    }),
    createMockActivityEvent({
      id: 'permission-event',
      type: 'permission:granted',
      category: 'permission',
      severity: 'success',
      title: 'Permission Granted',
      description: 'Permission request was granted',
      timestamp: new Date(baseTimestamp - 5000),
      toolName: 'file-system',
    }),
    createMockActivityEvent({
      id: 'system-event',
      type: 'mcp:connected',
      category: 'system',
      severity: 'info',
      title: 'System Connected',
      description: 'System connection established',
      timestamp: new Date(baseTimestamp - 6000),
    }),
    createMockActivityEvent({
      id: 'error-event',
      type: 'task:failed',
      category: 'error',
      severity: 'error',
      title: 'Task Failed',
      description: 'Task execution failed with error',
      timestamp: new Date(baseTimestamp - 7000),
    }),
  ]
}

/**
 * Create mock events with different severity levels
 */
export function createMockEventsBySeverity(): DashboardActivityEvent[] {
  const baseTimestamp = Date.now()

  return [
    createMockActivityEvent({
      id: 'info-event',
      severity: 'info',
      title: 'Info Event',
      description: 'An informational event',
      timestamp: new Date(baseTimestamp - 1000),
    }),
    createMockActivityEvent({
      id: 'success-event',
      severity: 'success',
      title: 'Success Event',
      description: 'A successful operation',
      timestamp: new Date(baseTimestamp - 2000),
    }),
    createMockActivityEvent({
      id: 'warning-event',
      severity: 'warning',
      title: 'Warning Event',
      description: 'A warning condition',
      timestamp: new Date(baseTimestamp - 3000),
    }),
    createMockActivityEvent({
      id: 'error-event',
      severity: 'error',
      title: 'Error Event',
      description: 'An error occurred',
      timestamp: new Date(baseTimestamp - 4000),
    }),
  ]
}

/**
 * Create a large number of mock events for performance testing
 */
export function createManyMockEvents(count: number = 50): DashboardActivityEvent[] {
  const events: DashboardActivityEvent[] = []
  const baseTimestamp = Date.now()

  const categories: ActivityEventCategory[] = ['task', 'agent', 'tool', 'gate', 'permission', 'system', 'error']
  const severities: ActivityEventSeverity[] = ['info', 'success', 'warning', 'error']

  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length]
    const severity = severities[i % severities.length]

    events.push(createMockActivityEvent({
      id: `perf-event-${i}`,
      category,
      severity,
      title: `Performance Event ${i}`,
      description: `Test event ${i} for performance testing`,
      timestamp: new Date(baseTimestamp - i * 1000), // 1 second intervals
      taskId: `task-${Math.floor(i / 5)}`, // Group every 5 events by task
    }))
  }

  return events
}

/**
 * Create mock events with mixed read/unread status
 */
export function createMockEventsWithReadStatus(): DashboardActivityEvent[] {
  const baseTimestamp = Date.now()

  return [
    createMockActivityEvent({
      id: 'read-event-1',
      title: 'Read Event 1',
      isRead: true,
      timestamp: new Date(baseTimestamp - 1000),
    }),
    createMockActivityEvent({
      id: 'unread-event-1',
      title: 'Unread Event 1',
      isRead: false,
      timestamp: new Date(baseTimestamp - 2000),
    }),
    createMockActivityEvent({
      id: 'read-event-2',
      title: 'Read Event 2',
      isRead: true,
      timestamp: new Date(baseTimestamp - 3000),
    }),
    createMockActivityEvent({
      id: 'unread-event-2',
      title: 'Unread Event 2',
      isRead: false,
      timestamp: new Date(baseTimestamp - 4000),
    }),
  ]
}

/**
 * Create events for specific task IDs
 */
export function createMockEventsForTasks(taskIds: string[]): DashboardActivityEvent[] {
  const events: DashboardActivityEvent[] = []
  const baseTimestamp = Date.now()

  taskIds.forEach((taskId, index) => {
    // Create multiple events per task
    events.push(
      createMockActivityEvent({
        id: `${taskId}-created`,
        type: 'task:created',
        category: 'task',
        severity: 'info',
        title: 'Task Created',
        description: `Task ${taskId} was created`,
        taskId,
        timestamp: new Date(baseTimestamp - (index * 3 + 0) * 1000),
      }),
      createMockActivityEvent({
        id: `${taskId}-progress`,
        type: 'task:stage-changed',
        category: 'task',
        severity: 'info',
        title: 'Task Progress',
        description: `Task ${taskId} moved to implementation`,
        taskId,
        timestamp: new Date(baseTimestamp - (index * 3 + 1) * 1000),
      }),
      createMockActivityEvent({
        id: `${taskId}-completed`,
        type: 'task:completed',
        category: 'task',
        severity: 'success',
        title: 'Task Completed',
        description: `Task ${taskId} completed successfully`,
        taskId,
        timestamp: new Date(baseTimestamp - (index * 3 + 2) * 1000),
      })
    )
  })

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // Most recent first
}

/**
 * Create events with different timestamp ranges for testing relative time formatting
 */
export function createMockEventsWithTimestamps(): DashboardActivityEvent[] {
  const now = Date.now()

  return [
    createMockActivityEvent({
      id: 'just-now',
      title: 'Just Now Event',
      timestamp: new Date(now - 30 * 1000), // 30 seconds ago
    }),
    createMockActivityEvent({
      id: 'minutes-ago',
      title: 'Minutes Ago Event',
      timestamp: new Date(now - 5 * 60 * 1000), // 5 minutes ago
    }),
    createMockActivityEvent({
      id: 'hours-ago',
      title: 'Hours Ago Event',
      timestamp: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
    }),
    createMockActivityEvent({
      id: 'days-ago',
      title: 'Days Ago Event',
      timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    }),
    createMockActivityEvent({
      id: 'weeks-ago',
      title: 'Weeks Ago Event',
      timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
    }),
  ]
}

/**
 * Event type to human-readable title mapping for testing
 */
export const EVENT_TYPE_TITLES: Record<string, string> = {
  'task:created': 'Task Created',
  'task:started': 'Task Started',
  'task:stage-changed': 'Stage Changed',
  'task:completed': 'Task Completed',
  'task:failed': 'Task Failed',
  'task:paused': 'Task Paused',
  'agent:message': 'Agent Response',
  'agent:thinking': 'Agent Thinking',
  'agent:tool-use': 'Tool Used',
  'tool:start': 'Tool Started',
  'tool:complete': 'Tool Complete',
  'tool:progress': 'Tool Progress',
  'gate:required': 'Approval Required',
  'gate:approved': 'Gate Approved',
  'gate:rejected': 'Gate Rejected',
  'permission:request': 'Permission Request',
  'permission:granted': 'Permission Granted',
  'permission:denied': 'Permission Denied',
  'dangerous:detected': 'Dangerous Operation',
  'dangerous:blocked': 'Operation Blocked',
  'mcp:connected': 'MCP Connected',
  'mcp:disconnected': 'MCP Disconnected',
  'mcp:error': 'MCP Error',
}

/**
 * Icon mapping for testing icon rendering
 */
export const CATEGORY_ICONS: Record<ActivityEventCategory, string> = {
  task: 'icon-task',
  agent: 'icon-agent',
  tool: 'icon-tool',
  gate: 'icon-gate',
  permission: 'icon-permission',
  system: 'icon-system',
  error: 'icon-error',
}

/**
 * Severity color classes for testing styling
 */
export const SEVERITY_STYLES = {
  info: {
    text: 'text-apex-400',
    bg: 'bg-apex-950/50',
    border: 'border-apex-900',
    dot: 'bg-apex-500',
    icon: 'text-apex-500',
  },
  success: {
    text: 'text-green-400',
    bg: 'bg-green-950/50',
    border: 'border-green-900',
    dot: 'bg-green-500',
    icon: 'text-green-500',
  },
  warning: {
    text: 'text-yellow-400',
    bg: 'bg-yellow-950/50',
    border: 'border-yellow-900',
    dot: 'bg-yellow-500',
    icon: 'text-yellow-500',
  },
  error: {
    text: 'text-red-400',
    bg: 'bg-red-950/50',
    border: 'border-red-900',
    dot: 'bg-red-500',
    icon: 'text-red-500',
  },
}

/**
 * Mock filter configurations for testing
 */
export const MOCK_FILTERS = {
  all: {
    categories: [],
    severities: [],
    taskIds: [],
    unreadOnly: false,
    limit: 20,
  },
  tasksOnly: {
    categories: ['task'] as ActivityEventCategory[],
    severities: [],
    taskIds: [],
    unreadOnly: false,
    limit: 20,
  },
  errorsOnly: {
    categories: [],
    severities: ['error'] as ActivityEventSeverity[],
    taskIds: [],
    unreadOnly: false,
    limit: 20,
  },
  unreadOnly: {
    categories: [],
    severities: [],
    taskIds: [],
    unreadOnly: true,
    limit: 20,
  },
  specificTask: {
    categories: [],
    severities: [],
    taskIds: ['task-123'],
    unreadOnly: false,
    limit: 20,
  },
}

/**
 * Helper to assert event visibility in tests
 */
export function expectEventVisible(eventTitle: string, shouldBeVisible: boolean = true) {
  if (shouldBeVisible) {
    expect(screen.getByText(eventTitle)).toBeInTheDocument()
  } else {
    expect(screen.queryByText(eventTitle)).not.toBeInTheDocument()
  }
}

/**
 * Helper to assert event count in badge
 */
export function expectEventCount(count: number) {
  const badge = screen.getByTestId('badge')
  expect(badge).toHaveTextContent(count.toString())
}

/**
 * Helper to click filter button
 */
export function clickFilter(filterName: string) {
  const button = screen.getByRole('button', { name: new RegExp(filterName, 'i') })
  fireEvent.click(button)
}

/**
 * Helper to wait for filter update
 */
export async function waitForFilterUpdate() {
  await waitFor(() => {
    // Wait for any pending state updates
  }, { timeout: 100 })
}

/**
 * Mock WebSocket event data for integration tests
 */
export function createMockWebSocketEvent(overrides: Partial<DashboardActivityEvent> = {}) {
  return {
    type: 'activity:event',
    data: createMockActivityEvent(overrides),
    timestamp: new Date(),
  }
}

/**
 * Performance benchmark helper
 */
export function benchmarkRender(component: React.ReactElement): number {
  const startTime = performance.now()
  render(component)
  return performance.now() - startTime
}

/**
 * Helper to simulate scroll events
 */
export function simulateScroll(element: HTMLElement, scrollTop: number) {
  Object.defineProperty(element, 'scrollTop', {
    value: scrollTop,
    writable: true,
  })
  fireEvent.scroll(element)
}

/**
 * Helper to simulate keyboard events
 */
export function simulateKeyPress(element: HTMLElement, key: string) {
  element.focus()
  fireEvent.keyDown(element, { key })
}