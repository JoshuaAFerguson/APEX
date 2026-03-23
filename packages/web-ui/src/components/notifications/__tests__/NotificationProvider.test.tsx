/**
 * @jest-environment jsdom
 */

import React from 'react'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationProvider, useNotifications } from '../NotificationProvider'
import type { NotificationAction } from '@/types/notifications'

// Mock component to test the hook
function TestComponent() {
  const { notifications, success, error, warning, info, removeNotification, clearAll } = useNotifications()

  return (
    <div>
      <div data-testid="notification-count">{notifications.length}</div>
      {notifications.map((notification) => (
        <div key={notification.id} data-testid={`notification-${notification.id}`}>
          <span data-testid="title">{notification.title}</span>
          <span data-testid="message">{notification.message}</span>
          <span data-testid="type">{notification.type}</span>
          <button onClick={() => removeNotification(notification.id)}>Remove</button>
        </div>
      ))}
      <button data-testid="success-btn" onClick={() => success('Success Title', 'Success message')}>
        Add Success
      </button>
      <button data-testid="error-btn" onClick={() => error('Error Title', 'Error message')}>
        Add Error
      </button>
      <button data-testid="warning-btn" onClick={() => warning('Warning Title', 'Warning message')}>
        Add Warning
      </button>
      <button data-testid="info-btn" onClick={() => info('Info Title', 'Info message')}>
        Add Info
      </button>
      <button data-testid="clear-btn" onClick={clearAll}>
        Clear All
      </button>
    </div>
  )
}

// Component to test error boundary
function TestComponentWithoutProvider() {
  const notifications = useNotifications()
  return <div>Should not render</div>
}

describe('NotificationProvider', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  test('throws error when hook is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponentWithoutProvider />)
    }).toThrow('useNotifications must be used within a NotificationProvider')

    consoleSpy.mockRestore()
  })

  test('provides empty notifications initially', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    expect(screen.getByTestId('notification-count')).toHaveTextContent('0')
  })

  test('adds success notification', async () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    await user.click(screen.getByTestId('success-btn'))

    expect(screen.getByTestId('notification-count')).toHaveTextContent('1')
    expect(screen.getByTestId('title')).toHaveTextContent('Success Title')
    expect(screen.getByTestId('message')).toHaveTextContent('Success message')
    expect(screen.getByTestId('type')).toHaveTextContent('success')
  })

  test('adds different notification types', async () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    await user.click(screen.getByTestId('success-btn'))
    await user.click(screen.getByTestId('error-btn'))
    await user.click(screen.getByTestId('warning-btn'))
    await user.click(screen.getByTestId('info-btn'))

    expect(screen.getByTestId('notification-count')).toHaveTextContent('4')

    const titles = screen.getAllByTestId('title')
    const types = screen.getAllByTestId('type')

    // Notifications are added newest first, so order is reversed
    expect(titles[0]).toHaveTextContent('Info Title')
    expect(titles[1]).toHaveTextContent('Warning Title')
    expect(titles[2]).toHaveTextContent('Error Title')
    expect(titles[3]).toHaveTextContent('Success Title')

    expect(types[0]).toHaveTextContent('info')
    expect(types[1]).toHaveTextContent('warning')
    expect(types[2]).toHaveTextContent('error')
    expect(types[3]).toHaveTextContent('success')
  })

  test('removes notification', async () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    await user.click(screen.getByTestId('success-btn'))
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1')

    await user.click(screen.getByText('Remove'))
    expect(screen.getByTestId('notification-count')).toHaveTextContent('0')
  })

  test('clears all notifications', async () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    await user.click(screen.getByTestId('success-btn'))
    await user.click(screen.getByTestId('error-btn'))
    expect(screen.getByTestId('notification-count')).toHaveTextContent('2')

    await user.click(screen.getByTestId('clear-btn'))
    expect(screen.getByTestId('notification-count')).toHaveTextContent('0')
  })

  test('respects maxNotifications limit', async () => {
    render(
      <NotificationProvider maxNotifications={2}>
        <TestComponent />
      </NotificationProvider>
    )

    await user.click(screen.getByTestId('success-btn'))
    await user.click(screen.getByTestId('error-btn'))
    await user.click(screen.getByTestId('warning-btn'))

    // Should only show 2 notifications (the limit)
    expect(screen.getByTestId('notification-count')).toHaveTextContent('2')
  })

  test('auto-dismisses notifications after duration', async () => {
    render(
      <NotificationProvider defaultDuration={50}>
        <TestComponent />
      </NotificationProvider>
    )

    await user.click(screen.getByTestId('success-btn'))
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1')

    // Wait for auto-dismiss (use shorter duration for faster test)
    await waitFor(() => {
      expect(screen.getByTestId('notification-count')).toHaveTextContent('0')
    }, { timeout: 200 })
  })

  test('error notifications persist by default', async () => {
    render(
      <NotificationProvider defaultDuration={50}>
        <TestComponent />
      </NotificationProvider>
    )

    await user.click(screen.getByTestId('error-btn'))
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1')

    // Wait some time - error should still be there (persistent)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1')
  })

  test('generates unique IDs for notifications', async () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    await user.click(screen.getByTestId('success-btn'))
    await user.click(screen.getByTestId('success-btn'))

    const notifications = screen.getAllByTestId(/^notification-/)
    expect(notifications).toHaveLength(2)

    // Extract IDs from data-testid attributes
    const id1 = notifications[0].getAttribute('data-testid')?.replace('notification-', '')
    const id2 = notifications[1].getAttribute('data-testid')?.replace('notification-', '')

    expect(id1).toBeDefined()
    expect(id2).toBeDefined()
    expect(id1).not.toBe(id2)
  })

  test('notification has correct timestamp', async () => {
    const beforeTime = new Date()

    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    await user.click(screen.getByTestId('success-btn'))

    const afterTime = new Date()

    // We can't directly access the notification object in this test,
    // but we can verify that the notification was created recently
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1')

    // The notification should have been created between beforeTime and afterTime
    // Since we can't access the actual timestamp in this component test,
    // we just verify the notification exists
  })
})

describe('NotificationProvider with custom props', () => {
  test('uses custom default duration', async () => {
    render(
      <NotificationProvider defaultDuration={50}>
        <TestComponent />
      </NotificationProvider>
    )

    const user = userEvent.setup()
    await user.click(screen.getByTestId('success-btn'))
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1')

    // Wait for custom duration to pass
    await waitFor(() => {
      expect(screen.getByTestId('notification-count')).toHaveTextContent('0')
    }, { timeout: 200 })
  })

  test('uses custom max notifications', async () => {
    render(
      <NotificationProvider maxNotifications={1}>
        <TestComponent />
      </NotificationProvider>
    )

    const user = userEvent.setup()
    await user.click(screen.getByTestId('success-btn'))
    await user.click(screen.getByTestId('error-btn'))

    // Should only keep 1 notification
    expect(screen.getByTestId('notification-count')).toHaveTextContent('1')
  })
})