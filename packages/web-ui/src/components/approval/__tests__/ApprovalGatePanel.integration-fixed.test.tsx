/**
 * @vitest-environment jsdom
 */

/**
 * Integration Tests for ApprovalGatePanel
 * Tests complete flows including WebSocket events, API interactions, and user flows
 */

import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ApprovalGatePanel } from '../ApprovalGatePanel'
import type { ApprovalGatePanelProps } from '../../../types/approval-gate-panel'
import type { MockApprovalGateRealtimeState } from './test-utils'
import {
  createDefaultProps,
  createPropsWithPendingGates,
  createPropsWithResolvedGates,
  createPropsWithLoading,
  createPropsWithError,
  createMockPendingGate,
  createMockResolvedGate,
  createMockGateRequiredEvent,
  createMockGateApprovedEvent,
  createMockGateRejectedEvent,
  createMockApprovalResolvedEvent,
  createMockRealtimeState,
  createEventSequence,
  ERROR_SCENARIOS,
  PERFORMANCE_SCENARIOS,
  TEST_IDS,
  delay,
} from './test-utils'

// ============================================================================
// Mocks Setup
// ============================================================================

// Mock WebSocket hook
vi.mock('../hooks/useApprovalGateWebSocket', () => ({
  useApprovalGateWebSocket: vi.fn(() => ({
    pendingGates: [],
    resolvedGates: [],
    isConnected: true,
    connectionStatus: 'connected' as const,
    isLoading: false,
    error: null,
    approveGate: vi.fn().mockResolvedValue(undefined),
    rejectGate: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    disconnect: vi.fn(),
    onGateReceived: vi.fn(),
    onGateResolved: vi.fn(),
  })),
}))

// Mock API client
vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    approveGate: vi.fn().mockResolvedValue(undefined),
    rejectGate: vi.fn().mockResolvedValue(undefined),
    getTask: vi.fn().mockResolvedValue({
      task: {
        id: 'task-123',
        name: 'Test Task',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    getPendingGates: vi.fn().mockResolvedValue({ gates: [] }),
    getResolvedGates: vi.fn().mockResolvedValue({ gates: [] }),
  },
}))

// Mock child components to isolate testing
vi.mock('../../diff/DiffViewer', () => ({
  DiffViewer: ({ diffData, onCopy, ...props }: any) => (
    <div
      data-testid="diff-viewer"
      data-diff-id={diffData?.diffId}
      data-change-type={diffData?.changeType}
      {...props}
    >
      <div>Mock Diff Viewer</div>
      {diffData?.summary && <div data-testid="diff-summary">{diffData.summary}</div>}
      {onCopy && (
        <button
          data-testid="copy-diff-button"
          onClick={() => onCopy(diffData?.rawDiff || '')}
        >
          Copy
        </button>
      )}
    </div>
  ),
}))

// Mock UI components
vi.mock('../../../components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('../../../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}))

vi.mock('../../../components/ui/Dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, ...props }: any) => (
    <div data-testid={TEST_IDS.confirmationDialog} role="dialog" aria-modal="true" {...props}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}))

vi.mock('../../../components/ui/Textarea', () => ({
  Textarea: ({ value, onChange, placeholder, ...props }: any) => (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e)}
      placeholder={placeholder}
      data-testid={TEST_IDS.commentInput}
      {...props}
    />
  ),
}))

vi.mock('../../../components/ui/Badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}))

vi.mock('../../../components/ui/Alert', () => ({
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant} role="alert">
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => (
    <div data-testid="alert-description">{children}</div>
  ),
}))

vi.mock('../../../components/ui/Skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => (
    <div data-testid="skeleton" className={className} {...props}>
      Loading...
    </div>
  ),
}))

// ============================================================================
// Test Setup
// ============================================================================

describe('ApprovalGatePanel Integration Tests', () => {
  let mockWebSocketHook: any
  let mockApiClient: any

  beforeEach(async () => {
    // Get access to mocks
    mockWebSocketHook = vi.mocked((await import('../hooks/useApprovalGateWebSocket')).useApprovalGateWebSocket)
    mockApiClient = vi.mocked((await import('../../../lib/api-client')).apiClient)

    // Reset all mocks
    vi.clearAllMocks()

    // Setup fake timers for controlling async behavior
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ============================================================================
  // Loading and Display Tests
  // ============================================================================

  describe('Loading and Display', () => {
    it('should render loading state correctly', () => {
      const props = createPropsWithLoading()
      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    })

    it('should render empty state when no gates are present', () => {
      const props = createDefaultProps()
      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByText(/no pending approvals/i)).toBeInTheDocument()
    })

    it('should render pending gates list correctly', () => {
      const props = createPropsWithPendingGates(2)
      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByText('Test Gate 1')).toBeInTheDocument()
      expect(screen.getByText('Test Gate 2')).toBeInTheDocument()
    })

    it('should display error state correctly', () => {
      const errorMessage = 'Failed to load approval gates'
      const props = createPropsWithError(errorMessage)
      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId('alert')).toBeInTheDocument()
      expect(screen.getByTestId('alert-description')).toHaveTextContent(errorMessage)
    })
  })

  // ============================================================================
  // Approve Flow Tests
  // ============================================================================

  describe('Approve Flow', () => {
    it('should open confirmation dialog when approve is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      const approveButtons = screen.getAllByText(/approve/i).filter(el => el.tagName === 'BUTTON')
      await user.click(approveButtons[0])

      expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()
    })

    it('should handle approval API calls correctly', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onGateAction = vi.fn()
      const props = createPropsWithPendingGates(1, { onGateAction })

      // Mock the WebSocket hook to return pending gates
      mockWebSocketHook.mockReturnValue({
        pendingGates: props.pendingGates,
        resolvedGates: [],
        isConnected: true,
        connectionStatus: 'connected',
        isLoading: false,
        error: null,
        approveGate: vi.fn().mockResolvedValue(undefined),
        rejectGate: vi.fn().mockResolvedValue(undefined),
        refresh: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onGateReceived: vi.fn(),
        onGateResolved: vi.fn(),
      })

      render(<ApprovalGatePanel {...props} />)

      const approveButtons = screen.getAllByText(/approve/i).filter(el => el.tagName === 'BUTTON')
      await user.click(approveButtons[0])

      // Confirm approval
      const confirmButton = screen.getByTestId(TEST_IDS.confirmButton)
      await user.click(confirmButton)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Should call the onGateAction callback
      expect(onGateAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gate-1' }),
        'approve',
        undefined
      )
    })
  })

  // ============================================================================
  // Reject Flow Tests
  // ============================================================================

  describe('Reject Flow', () => {
    it('should open confirmation dialog for rejection', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      const rejectButtons = screen.getAllByText(/reject/i).filter(el => el.tagName === 'BUTTON')
      await user.click(rejectButtons[0])

      expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()
    })

    it('should reject gate with comment', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onGateAction = vi.fn()
      const props = createPropsWithPendingGates(1, { onGateAction })

      // Mock the WebSocket hook to return pending gates
      mockWebSocketHook.mockReturnValue({
        pendingGates: props.pendingGates,
        resolvedGates: [],
        isConnected: true,
        connectionStatus: 'connected',
        isLoading: false,
        error: null,
        approveGate: vi.fn(),
        rejectGate: vi.fn().mockResolvedValue(undefined),
        refresh: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onGateReceived: vi.fn(),
        onGateResolved: vi.fn(),
      })

      render(<ApprovalGatePanel {...props} />)

      const rejectButtons = screen.getAllByText(/reject/i).filter(el => el.tagName === 'BUTTON')
      await user.click(rejectButtons[0])

      // Add required comment
      const commentInput = screen.getByTestId(TEST_IDS.commentInput)
      await user.type(commentInput, 'Needs more review')

      // Confirm rejection
      const confirmButton = screen.getByTestId(TEST_IDS.confirmButton)
      await user.click(confirmButton)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(onGateAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gate-1' }),
        'reject',
        'Needs more review'
      )
    })
  })

  // ============================================================================
  // WebSocket Events Tests
  // ============================================================================

  describe('WebSocket Events', () => {
    it('should handle real-time updates from WebSocket', async () => {
      // Start with empty state
      const props = createDefaultProps()
      const { rerender } = render(<ApprovalGatePanel {...props} />)

      expect(screen.getByText(/no pending approvals/i)).toBeInTheDocument()

      // Simulate WebSocket providing new gates
      const newGates = [createMockPendingGate({ id: 'new-gate-1' })]
      mockWebSocketHook.mockReturnValue({
        pendingGates: newGates,
        resolvedGates: [],
        isConnected: true,
        connectionStatus: 'connected',
        isLoading: false,
        error: null,
        approveGate: vi.fn(),
        rejectGate: vi.fn(),
        refresh: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onGateReceived: vi.fn(),
        onGateResolved: vi.fn(),
      })

      rerender(<ApprovalGatePanel {...props} />)

      await waitFor(() => {
        expect(screen.getByText('Test Gate')).toBeInTheDocument()
        expect(screen.queryByText(/no pending approvals/i)).not.toBeInTheDocument()
      })
    })

    it('should handle connection state changes', async () => {
      const props = createDefaultProps({ showConnectionIndicator: true })

      // Mock disconnected state
      mockWebSocketHook.mockReturnValue({
        pendingGates: [],
        resolvedGates: [],
        isConnected: false,
        connectionStatus: 'disconnected',
        isLoading: false,
        error: null,
        approveGate: vi.fn(),
        rejectGate: vi.fn(),
        refresh: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onGateReceived: vi.fn(),
        onGateResolved: vi.fn(),
      })

      const { rerender } = render(<ApprovalGatePanel {...props} />)

      // Should show disconnected status
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument()

      // Mock connected state
      mockWebSocketHook.mockReturnValue({
        pendingGates: [],
        resolvedGates: [],
        isConnected: true,
        connectionStatus: 'connected',
        isLoading: false,
        error: null,
        approveGate: vi.fn(),
        rejectGate: vi.fn(),
        refresh: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onGateReceived: vi.fn(),
        onGateResolved: vi.fn(),
      })

      rerender(<ApprovalGatePanel {...props} />)

      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should display WebSocket errors appropriately', () => {
      const props = createDefaultProps()

      mockWebSocketHook.mockReturnValue({
        pendingGates: [],
        resolvedGates: [],
        isConnected: false,
        connectionStatus: 'error',
        isLoading: false,
        error: new Error('WebSocket connection failed'),
        approveGate: vi.fn(),
        rejectGate: vi.fn(),
        refresh: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onGateReceived: vi.fn(),
        onGateResolved: vi.fn(),
      })

      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId('alert')).toBeInTheDocument()
      expect(screen.getByText(/websocket connection failed/i)).toBeInTheDocument()
    })

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onActionError = vi.fn()

      const mockApproveGate = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      mockWebSocketHook.mockReturnValue({
        pendingGates: [createMockPendingGate({ id: 'gate-1' })],
        resolvedGates: [],
        isConnected: true,
        connectionStatus: 'connected',
        isLoading: false,
        error: null,
        approveGate: mockApproveGate,
        rejectGate: vi.fn(),
        refresh: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onGateReceived: vi.fn(),
        onGateResolved: vi.fn(),
      })

      const props = createPropsWithPendingGates(1, { onActionError })
      render(<ApprovalGatePanel {...props} />)

      const approveButtons = screen.getAllByText(/approve/i).filter(el => el.tagName === 'BUTTON')
      await user.click(approveButtons[0])

      const confirmButton = screen.getByTestId(TEST_IDS.confirmButton)
      await user.click(confirmButton)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(onActionError).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gate-1' }),
        'approve',
        expect.any(Error)
      )
    })
  })

  // ============================================================================
  // Diff Preview Tests
  // ============================================================================

  describe('Diff Preview', () => {
    it('should show diff preview for gates with diff data', () => {
      const gateWithDiff = createMockPendingGate({
        id: 'gate-diff',
        diffData: {
          diffId: 'diff-123',
          changeType: 'file-edit',
          summary: 'Updated component logic',
          rawDiff: '@@ -1,1 +1,1 @@\n-old\n+new',
          filesChanged: 1,
          linesAdded: 1,
          linesRemoved: 1,
        },
      })

      const props = createDefaultProps({
        pendingGates: [gateWithDiff],
        showDiffPreview: true,
      })

      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('diff-summary')).toHaveTextContent('Updated component logic')
    })

    it('should hide diff preview when showDiffPreview is false', () => {
      const gateWithDiff = createMockPendingGate({
        id: 'gate-diff',
        diffData: {
          diffId: 'diff-123',
          changeType: 'file-edit',
          summary: 'Updated component logic',
        },
      })

      const props = createDefaultProps({
        pendingGates: [gateWithDiff],
        showDiffPreview: false,
      })

      render(<ApprovalGatePanel {...props} />)

      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
    })
  })
})