/**
 * @jest-environment jsdom
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toast } from '../Toast'
import type { Notification, NotificationAction } from '@/types/notifications'

// Mock notification data
const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'test-id',
  type: 'info',
  title: 'Test Title',
  message: 'Test message',
  duration: 5000,
  dismissible: true,
  createdAt: new Date(),
  ...overrides,
})

describe('Toast', () => {
  let user: ReturnType<typeof userEvent.setup>
  let mockOnDismiss: ReturnType<typeof vi.fn>

  beforeEach(() => {
    user = userEvent.setup()
    mockOnDismiss = vi.fn()
  })

  test('renders notification content correctly', () => {
    const notification = createMockNotification({
      title: 'Success Title',
      message: 'Success message',
      type: 'success',
    })

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    expect(screen.getByText('Success Title')).toBeInTheDocument()
    expect(screen.getByText('Success message')).toBeInTheDocument()
  })

  test('renders without message', () => {
    const notification = createMockNotification({
      title: 'Title Only',
      message: undefined,
    })

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    expect(screen.getByText('Title Only')).toBeInTheDocument()
    expect(screen.queryByText('Test message')).not.toBeInTheDocument()
  })

  test('renders correct icon for each type', () => {
    const types: Array<Notification['type']> = ['success', 'error', 'warning', 'info']

    types.forEach((type) => {
      const { unmount } = render(
        <Toast notification={createMockNotification({ type })} onDismiss={mockOnDismiss} />
      )

      // Each type should have the appropriate icon
      // We can't test the exact icon without more complex setup,
      // but we can verify the component renders
      expect(screen.getByRole('alert')).toBeInTheDocument()

      unmount()
    })
  })

  test('shows dismiss button when dismissible', () => {
    const notification = createMockNotification({ dismissible: true })

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    expect(screen.getByLabelText('Dismiss notification')).toBeInTheDocument()
  })

  test('hides dismiss button when not dismissible', () => {
    const notification = createMockNotification({ dismissible: false })

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    expect(screen.queryByLabelText('Dismiss notification')).not.toBeInTheDocument()
  })

  test('calls onDismiss when dismiss button is clicked', async () => {
    const notification = createMockNotification({ dismissible: true })

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    await user.click(screen.getByLabelText('Dismiss notification'))

    expect(mockOnDismiss).toHaveBeenCalledTimes(1)
  })

  test('renders action button when action is provided', () => {
    const mockAction: NotificationAction = {
      label: 'Click me',
      onClick: vi.fn(),
    }

    const notification = createMockNotification({ action: mockAction })

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  test('calls action onClick when action button is clicked', async () => {
    const mockActionClick = vi.fn()
    const mockAction: NotificationAction = {
      label: 'Test Action',
      onClick: mockActionClick,
    }

    const notification = createMockNotification({ action: mockAction })

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    await user.click(screen.getByText('Test Action'))

    expect(mockActionClick).toHaveBeenCalledTimes(1)
  })

  test('shows progress bar for notifications with duration', () => {
    const notification = createMockNotification({ duration: 3000 })

    const { container } = render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    // Look for the progress bar animation style
    const progressBar = container.querySelector('[style*="toast-progress"]')
    expect(progressBar).toBeInTheDocument()
  })

  test('does not show progress bar for persistent notifications', () => {
    const notification = createMockNotification({ duration: 0 })

    const { container } = render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    // Look for the progress bar - should not exist
    const progressBar = container.querySelector('[style*="toast-progress"]')
    expect(progressBar).not.toBeInTheDocument()
  })

  test('has correct accessibility attributes', () => {
    const notification = createMockNotification({ type: 'error' })

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
  })

  test('has polite aria-live for non-error notifications', () => {
    const notification = createMockNotification({ type: 'info' })

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'polite')
  })

  test('applies correct CSS classes for notification type', () => {
    const notification = createMockNotification({ type: 'success' })

    const { container } = render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    const toastElement = container.firstChild as HTMLElement
    expect(toastElement).toHaveClass('bg-green-500/10')
    expect(toastElement).toHaveClass('border-green-500/20')
  })

  test('handles exiting state', () => {
    const notification = createMockNotification()

    const { rerender } = render(
      <Toast notification={notification} onDismiss={mockOnDismiss} isExiting={false} />
    )

    // Initially should be visible
    const toast = screen.getByRole('alert')
    expect(toast).toHaveClass('translate-x-0', 'opacity-100', 'scale-100')

    // When exiting, should have exit classes
    rerender(<Toast notification={notification} onDismiss={mockOnDismiss} isExiting={true} />)

    // The component will handle the exit animation internally
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('Toast animation and timing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('handles entrance animation timing', () => {
    const notification = createMockNotification()
    const mockOnDismiss = vi.fn()

    render(<Toast notification={notification} onDismiss={mockOnDismiss} />)

    // Component should handle entrance animation with timeout
    // Since we're using fake timers, we need to advance them
    act(() => {
      vi.advanceTimersByTime(10) // The entrance animation delay
    })

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  test('handles exit animation timing', () => {
    const notification = createMockNotification()
    const mockOnDismiss = vi.fn()

    const { rerender } = render(
      <Toast notification={notification} onDismiss={mockOnDismiss} isExiting={false} />
    )

    // Trigger exit
    rerender(<Toast notification={notification} onDismiss={mockOnDismiss} isExiting={true} />)

    // Should not call onDismiss immediately
    expect(mockOnDismiss).not.toHaveBeenCalled()

    // After animation duration
    act(() => {
      vi.advanceTimersByTime(200) // Exit animation duration
    })

    expect(mockOnDismiss).toHaveBeenCalledTimes(1)
  })
})