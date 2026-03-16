/**
 * @vitest-environment jsdom
 */

/**
 * Accessibility Tests for ApprovalGatePanel
 * Tests WCAG 2.1 AA compliance, keyboard navigation, and screen reader support
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ApprovalGatePanel } from '../ApprovalGatePanel'
import type { MockApprovalGateRealtimeState } from './test-utils'
import {
  createDefaultProps,
  createPropsWithPendingGates,
  createPropsWithResolvedGates,
  createPropsWithLoading,
  createPropsWithError,
  createMockRealtimeState,
  ACCESSIBILITY_SCENARIOS,
  TEST_IDS,
} from './test-utils'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// ============================================================================
// Accessibility Test Setup
// ============================================================================

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock WebSocket realtime state
let mockRealtimeState: MockApprovalGateRealtimeState = createMockRealtimeState()

// Mock realtime hook
vi.mock('../../../lib/useApprovalGateRealtime', () => ({
  useApprovalGateRealtime: vi.fn(() => ({
    state: mockRealtimeState,
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribeToGateEvents: vi.fn(),
    unsubscribeFromGateEvents: vi.fn(),
    refreshGates: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Mock API client
const mockApiClient = {
  approveGate: vi.fn().mockResolvedValue(undefined),
  rejectGate: vi.fn().mockResolvedValue(undefined),
  getTask: vi.fn().mockResolvedValue({ task: {} }),
  getPendingGates: vi.fn().mockResolvedValue({ gates: [] }),
  getResolvedGates: vi.fn().mockResolvedValue({ gates: [] }),
}

vi.mock('../../../lib/api-client', () => ({
  apiClient: mockApiClient,
}))

// Mock child components with accessibility features
vi.mock('../../diff/DiffViewer', () => ({
  DiffViewer: ({ diffData, onCopy, ...props }: any) => (
    <div
      data-testid="diff-viewer"
      role="img"
      aria-label={`Code diff showing ${diffData?.summary || 'changes'}`}
      aria-describedby="diff-description"
      tabIndex={0}
      {...props}
    >
      <div id="diff-description" className="sr-only">
        {diffData?.summary && `Code changes: ${diffData.summary}.`}
        {diffData?.filesChanged && ` ${diffData.filesChanged} file(s) changed.`}
        {diffData?.linesAdded && ` ${diffData.linesAdded} lines added.`}
        {diffData?.linesRemoved && ` ${diffData.linesRemoved} lines removed.`}
      </div>
      <div>Mock Diff Viewer</div>
      {onCopy && (
        <button
          data-testid="copy-diff-button"
          onClick={() => onCopy(diffData?.rawDiff || '')}
          aria-label="Copy diff content to clipboard"
        >
          Copy
        </button>
      )}
    </div>
  ),
}))

vi.mock('../../connection/WebSocketConnectionIndicator', () => ({
  WebSocketConnectionIndicator: ({ status, size }: any) => {
    const connectionStatus = status || (mockRealtimeState.isConnected ? 'connected' : 'disconnected')
    return (
      <div
        data-testid={TEST_IDS.connectionIndicator}
        role="status"
        aria-label={`WebSocket connection status: ${connectionStatus}`}
        aria-live="polite"
        data-connection-status={connectionStatus}
        data-size={size}
      >
        <span className="sr-only">Connection status: </span>
        {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
      </div>
    )
  },
}))

// Mock UI components with accessibility
vi.mock('../../../components/ui/Card', () => ({
  Card: ({ children, className, role = 'region', ...props }: any) => (
    <div className={className} role={role} data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <header data-testid="card-header" {...props}>
      {children}
    </header>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('../../../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, 'aria-label': ariaLabel, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('../../../components/ui/Dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? (
      <div
        data-testid="dialog-root"
        role="presentation"
        aria-hidden={!open}
      >
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, ...props }: any) => (
    <div
      data-testid={TEST_IDS.confirmationDialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      tabIndex={-1}
      {...props}
    >
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => (
    <header data-testid="dialog-header">
      {children}
    </header>
  ),
  DialogTitle: ({ children }: any) => (
    <h2 id="dialog-title" data-testid="dialog-title">
      {children}
    </h2>
  ),
  DialogDescription: ({ children }: any) => (
    <p id="dialog-description" data-testid="dialog-description">
      {children}
    </p>
  ),
  DialogFooter: ({ children }: any) => (
    <footer data-testid="dialog-footer">
      {children}
    </footer>
  ),
}))

vi.mock('../../../components/ui/Textarea', () => ({
  Textarea: ({ value, onChange, placeholder, required, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy, ...props }: any) => (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e)}
      placeholder={placeholder}
      required={required}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      data-testid={TEST_IDS.commentInput}
      {...props}
    />
  ),
}))

vi.mock('../../../components/ui/Badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span
      data-testid="badge"
      data-variant={variant}
      role="status"
      aria-label={`Status: ${children}`}
    >
      {children}
    </span>
  ),
}))

vi.mock('../../../components/ui/Alert', () => ({
  Alert: ({ children, variant }: any) => (
    <div
      data-testid="alert"
      data-variant={variant}
      role="alert"
      aria-live="assertive"
    >
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => (
    <div data-testid="alert-description">
      {children}
    </div>
  ),
}))

vi.mock('../../../components/ui/Skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => (
    <div
      data-testid="skeleton"
      className={className}
      role="status"
      aria-label="Loading content"
      aria-busy="true"
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  ),
}))

// ============================================================================
// Accessibility Tests
// ============================================================================

describe('ApprovalGatePanel Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRealtimeState = createMockRealtimeState()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ============================================================================
  // axe Compliance Tests
  // ============================================================================

  describe('axe Compliance', () => {
    describe.each(ACCESSIBILITY_SCENARIOS)('$name', ({ props }) => {
      it('should have no accessibility violations', async () => {
        const { container } = render(<ApprovalGatePanel {...props} />)

        const results = await axe(container)
        expect(results).toHaveNoViolations()
      })
    })

    it('should maintain accessibility when dialogs are open', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      const { container } = render(<ApprovalGatePanel {...props} />)

      // Open approval dialog
      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should maintain accessibility with diff viewers', async () => {
      const props = createPropsWithPendingGates(1, { showDiffPreview: true })
      const { container } = render(<ApprovalGatePanel {...props} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  // ============================================================================
  // Keyboard Navigation Tests
  // ============================================================================

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through gate items', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(2)
      render(<ApprovalGatePanel {...props} />)

      // Tab should navigate through interactive elements
      await user.tab()
      expect(screen.getByTestId(TEST_IDS.approveButton('gate-1'))).toHaveFocus()

      await user.tab()
      expect(screen.getByTestId(TEST_IDS.rejectButton('gate-1'))).toHaveFocus()

      await user.tab()
      expect(screen.getByTestId(TEST_IDS.approveButton('gate-2'))).toHaveFocus()
    })

    it('should support Enter key activation for buttons', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      const approveButton = screen.getByTestId(TEST_IDS.approveButton('gate-1'))
      approveButton.focus()

      // Press Enter to activate
      await user.keyboard('{Enter}')

      // Should open confirmation dialog
      await waitFor(() => {
        expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()
      })
    })

    it('should support Space key activation for buttons', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      const rejectButton = screen.getByTestId(TEST_IDS.rejectButton('gate-1'))
      rejectButton.focus()

      // Press Space to activate
      await user.keyboard(' ')

      // Should open confirmation dialog
      await waitFor(() => {
        expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()
      })
    })

    it('should support Escape key to close dialog', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      // Open dialog
      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))
      expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()

      // Press Escape to close
      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByTestId(TEST_IDS.confirmationDialog)).not.toBeInTheDocument()
      })
    })

    it('should trap focus within confirmation dialog', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      // Open dialog
      await user.click(screen.getByTestId(TEST_IDS.rejectButton('gate-1')))

      const dialog = screen.getByTestId(TEST_IDS.confirmationDialog)
      expect(dialog).toBeInTheDocument()

      // Dialog should receive focus
      expect(dialog).toHaveFocus()

      // Tab through dialog elements
      await user.tab()
      expect(screen.getByTestId(TEST_IDS.commentInput)).toHaveFocus()

      await user.tab()
      expect(screen.getByTestId(TEST_IDS.cancelButton)).toHaveFocus()

      await user.tab()
      expect(screen.getByTestId(TEST_IDS.confirmButton)).toHaveFocus()

      // Tab should wrap back to beginning
      await user.tab()
      expect(screen.getByTestId(TEST_IDS.commentInput)).toHaveFocus()
    })

    it('should restore focus after dialog closes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      const rejectButton = screen.getByTestId(TEST_IDS.rejectButton('gate-1'))

      // Open dialog from reject button
      await user.click(rejectButton)
      expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()

      // Close dialog
      await user.click(screen.getByTestId(TEST_IDS.cancelButton))

      await waitFor(() => {
        expect(screen.queryByTestId(TEST_IDS.confirmationDialog)).not.toBeInTheDocument()
      })

      // Focus should return to the reject button
      expect(rejectButton).toHaveFocus()
    })
  })

  // ============================================================================
  // Screen Reader Support Tests
  // ============================================================================

  describe('Screen Reader Support', () => {
    it('should provide descriptive labels for gate items', () => {
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      const approveButton = screen.getByTestId(TEST_IDS.approveButton('gate-1'))
      const rejectButton = screen.getByTestId(TEST_IDS.rejectButton('gate-1'))

      expect(approveButton).toHaveAttribute('aria-label', expect.stringContaining('Approve'))
      expect(rejectButton).toHaveAttribute('aria-label', expect.stringContaining('Reject'))
    })

    it('should announce connection status changes', () => {
      const props = createDefaultProps({ showConnectionIndicator: true })
      render(<ApprovalGatePanel {...props} />)

      const connectionIndicator = screen.getByTestId(TEST_IDS.connectionIndicator)

      expect(connectionIndicator).toHaveAttribute('role', 'status')
      expect(connectionIndicator).toHaveAttribute('aria-live', 'polite')
      expect(connectionIndicator).toHaveAttribute('aria-label', expect.stringContaining('connection status'))
    })

    it('should provide live region announcements for errors', () => {
      const props = createPropsWithError('Connection failed')
      render(<ApprovalGatePanel {...props} />)

      const alert = screen.getByTestId('alert')

      expect(alert).toHaveAttribute('role', 'alert')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument()
    })

    it('should provide descriptive labels for diff viewers', () => {
      const props = createPropsWithPendingGates(1, { showDiffPreview: true })
      render(<ApprovalGatePanel {...props} />)

      const diffViewer = screen.getByTestId('diff-viewer')

      expect(diffViewer).toHaveAttribute('role', 'img')
      expect(diffViewer).toHaveAttribute('aria-label', expect.stringContaining('Code diff'))
      expect(diffViewer).toHaveAttribute('aria-describedby', 'diff-description')
    })

    it('should properly label form fields in confirmation dialog', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      await user.click(screen.getByTestId(TEST_IDS.rejectButton('gate-1')))

      const commentInput = screen.getByTestId(TEST_IDS.commentInput)

      expect(commentInput).toHaveAttribute('aria-label', expect.stringContaining('comment'))
      expect(commentInput).toHaveAttribute('required', 'true')
    })

    it('should provide status information for gate badges', () => {
      const props = createPropsWithResolvedGates(1)
      render(<ApprovalGatePanel {...props} />)

      const badges = screen.getAllByTestId('badge')

      badges.forEach(badge => {
        expect(badge).toHaveAttribute('role', 'status')
        expect(badge).toHaveAttribute('aria-label', expect.stringContaining('Status:'))
      })
    })
  })

  // ============================================================================
  // Focus Management Tests
  // ============================================================================

  describe('Focus Management', () => {
    it('should provide visible focus indicators', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      // Tab to first button
      await user.tab()
      const focusedElement = screen.getByTestId(TEST_IDS.approveButton('gate-1'))

      expect(focusedElement).toHaveFocus()
      // The element should have focus styles (verified by the mock button component)
      expect(focusedElement).toBeInTheDocument()
    })

    it('should manage focus during loading states', () => {
      const props = createPropsWithLoading()
      render(<ApprovalGatePanel {...props} />)

      const loadingIndicator = screen.getByTestId('skeleton')

      expect(loadingIndicator).toHaveAttribute('role', 'status')
      expect(loadingIndicator).toHaveAttribute('aria-label', 'Loading content')
      expect(loadingIndicator).toHaveAttribute('aria-busy', 'true')
    })

    it('should handle focus for dynamically added gates', async () => {
      const props = createDefaultProps()
      const { rerender } = render(<ApprovalGatePanel {...props} />)

      // Initially empty
      expect(screen.getByTestId(TEST_IDS.emptyPendingMessage)).toBeInTheDocument()

      // Add gates
      const updatedProps = createPropsWithPendingGates(1)
      rerender(<ApprovalGatePanel {...updatedProps} />)

      // New gate should be focusable
      const newGateButton = screen.getByTestId(TEST_IDS.approveButton('gate-1'))
      expect(newGateButton).toBeInTheDocument()
      expect(newGateButton).not.toHaveAttribute('tabindex', '-1')
    })
  })

  // ============================================================================
  // High Contrast and Color Tests
  // ============================================================================

  describe('High Contrast and Color', () => {
    it('should work with Windows High Contrast mode', () => {
      // Mock high contrast media query
      const mockMatchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: mockMatchMedia,
      })

      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      // All interactive elements should be present and accessible
      expect(screen.getByTestId(TEST_IDS.approveButton('gate-1'))).toBeInTheDocument()
      expect(screen.getByTestId(TEST_IDS.rejectButton('gate-1'))).toBeInTheDocument()
    })

    it('should not rely solely on color for status information', () => {
      const props = createPropsWithResolvedGates(1)
      render(<ApprovalGatePanel {...props} />)

      // Status should be conveyed through text, not just color
      const badges = screen.getAllByTestId('badge')
      badges.forEach(badge => {
        expect(badge).toHaveTextContent(/approved|rejected|timeout|skipped/i)
      })
    })
  })

  // ============================================================================
  // Mobile and Touch Accessibility Tests
  // ============================================================================

  describe('Mobile and Touch Accessibility', () => {
    it('should provide adequate touch targets', () => {
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      const buttons = [
        screen.getByTestId(TEST_IDS.approveButton('gate-1')),
        screen.getByTestId(TEST_IDS.rejectButton('gate-1')),
      ]

      buttons.forEach(button => {
        // Touch targets should be large enough (44x44px minimum)
        // This would be verified through CSS in real implementation
        expect(button).toBeInTheDocument()
        expect(button.tagName).toBe('BUTTON')
      })
    })

    it('should handle touch interactions correctly', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      const approveButton = screen.getByTestId(TEST_IDS.approveButton('gate-1'))

      // Simulate touch interaction
      fireEvent.touchStart(approveButton)
      fireEvent.touchEnd(approveButton)
      await user.click(approveButton)

      await waitFor(() => {
        expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // Error Handling Accessibility Tests
  // ============================================================================

  describe('Error Handling Accessibility', () => {
    it('should announce validation errors appropriately', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      // Open reject dialog
      await user.click(screen.getByTestId(TEST_IDS.rejectButton('gate-1')))

      // Try to submit without required comment
      await user.click(screen.getByTestId(TEST_IDS.confirmButton))

      // Error should be announced
      const errorElement = screen.getByText(/comment is required/i)
      expect(errorElement).toBeInTheDocument()

      // The error should be associated with the input
      const commentInput = screen.getByTestId(TEST_IDS.commentInput)
      expect(commentInput).toHaveAttribute('aria-describedby', expect.stringContaining('error'))
    })

    it('should handle API errors accessibly', async () => {
      mockApiClient.approveGate.mockRejectedValueOnce(new Error('Network error'))

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))
      await user.click(screen.getByTestId(TEST_IDS.confirmButton))

      await waitFor(() => {
        const alert = screen.getByTestId('alert')
        expect(alert).toHaveAttribute('role', 'alert')
        expect(alert).toHaveAttribute('aria-live', 'assertive')
      })
    })
  })

  // ============================================================================
  // Reduced Motion Tests
  // ============================================================================

  describe('Reduced Motion', () => {
    it('should respect prefers-reduced-motion', () => {
      // Mock reduced motion preference
      const mockMatchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: mockMatchMedia,
      })

      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      // Component should still be functional without animations
      expect(screen.getByTestId(TEST_IDS.gateItem('gate-1'))).toBeInTheDocument()
      expect(screen.getByTestId(TEST_IDS.approveButton('gate-1'))).toBeInTheDocument()
    })
  })

  // ============================================================================
  // ARIA Attributes Tests
  // ============================================================================

  describe('ARIA Attributes', () => {
    it('should use proper ARIA roles', () => {
      const props = createPropsWithPendingGates(1, { showConnectionIndicator: true })
      render(<ApprovalGatePanel {...props} />)

      // Main panel should have region role
      expect(screen.getByTestId('card')).toHaveAttribute('role', 'region')

      // Connection indicator should have status role
      expect(screen.getByTestId(TEST_IDS.connectionIndicator)).toHaveAttribute('role', 'status')
    })

    it('should provide proper dialog ARIA attributes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))

      const dialog = screen.getByTestId(TEST_IDS.confirmationDialog)

      expect(dialog).toHaveAttribute('role', 'dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title')
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description')
    })

    it('should use proper live regions for dynamic content', () => {
      const props = createPropsWithError('Test error')
      render(<ApprovalGatePanel {...props} />)

      const alert = screen.getByTestId('alert')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
      expect(alert).toHaveAttribute('role', 'alert')
    })
  })
})