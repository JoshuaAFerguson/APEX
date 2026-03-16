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

// Mock WebSocket realtime state
let mockRealtimeState: MockApprovalGateRealtimeState
let mockRealtimeActions: any
let mockApiClient: any

// Initialize mock state
const initializeMocks = () => {
  mockRealtimeState = createMockRealtimeState()

  mockRealtimeActions = {
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
      }
    }),
    subscribeToGateEvents: vi.fn(),
    unsubscribeFromGateEvents: vi.fn(),
    refreshGates: vi.fn().mockResolvedValue(undefined),
  }

  mockApiClient = {
    approveGate: vi.fn(),
    rejectGate: vi.fn(),
    getTask: vi.fn(),
    getPendingGates: vi.fn(),
    getResolvedGates: vi.fn(),
  }
}

// Initialize mocks immediately
initializeMocks()

// Mock the realtime updates hook
vi.mock('../../../lib/useApprovalGateRealtime', () => ({
  useApprovalGateRealtime: vi.fn(() => ({
    get state() { return mockRealtimeState },
    get connect() { return mockRealtimeActions.connect },
    get disconnect() { return mockRealtimeActions.disconnect },
    get subscribeToGateEvents() { return mockRealtimeActions.subscribeToGateEvents },
    get unsubscribeFromGateEvents() { return mockRealtimeActions.unsubscribeFromGateEvents },
    get refreshGates() { return mockRealtimeActions.refreshGates },
  })),
}))

// Mock API client
vi.mock('../../../lib/api-client', () => ({
  get apiClient() { return mockApiClient },
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

vi.mock('../../connection/WebSocketConnectionIndicator', () => ({
  WebSocketConnectionIndicator: ({ status, size }: any) => (
    <div
      data-testid={TEST_IDS.connectionIndicator}
      data-connection-status={status || (mockRealtimeState.isConnected ? 'connected' : 'disconnected')}
      data-size={size}
    >
      Connection: {status || (mockRealtimeState.isConnected ? 'Connected' : 'Disconnected')}
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
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Reset state
    mockRealtimeState = createMockRealtimeState()

    // Reset API client mocks
    mockApiClient.approveGate.mockResolvedValue(undefined)
    mockApiClient.rejectGate.mockResolvedValue(undefined)
    mockApiClient.getPendingGates.mockResolvedValue({ gates: [] })
    mockApiClient.getResolvedGates.mockResolvedValue({ gates: [] })

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
      expect(screen.queryByTestId(TEST_IDS.pendingGatesList)).not.toBeInTheDocument()
    })

    it('should render empty state when no gates are present', () => {
      const props = createDefaultProps()
      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId(TEST_IDS.emptyPendingMessage)).toBeInTheDocument()
      expect(screen.getByText(/no pending approval gates/i)).toBeInTheDocument()
    })

    it('should render pending gates list correctly', () => {
      const props = createPropsWithPendingGates(2)
      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId(TEST_IDS.pendingGatesList)).toBeInTheDocument()
      expect(screen.getByTestId(TEST_IDS.gateItem('gate-1'))).toBeInTheDocument()
      expect(screen.getByTestId(TEST_IDS.gateItem('gate-2'))).toBeInTheDocument()

      // Verify gate details
      expect(screen.getByText('Test Gate 1')).toBeInTheDocument()
      expect(screen.getByText('Test Gate 2')).toBeInTheDocument()
      expect(screen.getByTestId(TEST_IDS.approveButton('gate-1'))).toBeInTheDocument()
      expect(screen.getByTestId(TEST_IDS.rejectButton('gate-1'))).toBeInTheDocument()
    })

    it('should render resolved gates history when provided', () => {
      const props = createPropsWithResolvedGates(3)
      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId(TEST_IDS.resolvedGatesList)).toBeInTheDocument()
      expect(screen.getByText('Resolved Gate 1')).toBeInTheDocument()
      expect(screen.getByText('Resolved Gate 2')).toBeInTheDocument()
      expect(screen.getByText('Resolved Gate 3')).toBeInTheDocument()
    })

    it('should display error state correctly', () => {
      const errorMessage = 'Failed to load approval gates'
      const props = createPropsWithError(errorMessage)
      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId('alert')).toBeInTheDocument()
      expect(screen.getByTestId('alert-description')).toHaveTextContent(errorMessage)
    })

    it('should show connection indicator when enabled', () => {
      const props = createDefaultProps({ showConnectionIndicator: true })
      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId(TEST_IDS.connectionIndicator)).toBeInTheDocument()
      expect(screen.getByText(/connection: disconnected/i)).toBeInTheDocument()
    })

    it('should hide history section when showHistory is false', () => {
      const props = createPropsWithResolvedGates(2, { showHistory: false })
      render(<ApprovalGatePanel {...props} />)

      expect(screen.queryByTestId(TEST_IDS.resolvedGatesList)).not.toBeInTheDocument()
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

      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))

      expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()
      expect(screen.getByText(/approve this gate/i)).toBeInTheDocument()
    })

    it('should approve gate without comment when confirmed', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onGateAction = vi.fn()
      const props = createPropsWithPendingGates(1, { onGateAction })

      render(<ApprovalGatePanel {...props} />)

      // Click approve
      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))
      expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()

      // Confirm approval
      await user.click(screen.getByTestId(TEST_IDS.confirmButton))

      // Advance timers to handle async operations
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(mockApiClient.approveGate).toHaveBeenCalledWith(
          'task-123',
          'gate-1',
          expect.objectContaining({
            comment: undefined,
          })
        )
      })

      expect(onGateAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gate-1' }),
        'approve',
        undefined
      )
    })

    it('should approve gate with comment when provided', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)

      render(<ApprovalGatePanel {...props} />)

      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))

      // Add comment
      const commentInput = screen.getByTestId(TEST_IDS.commentInput)
      await user.type(commentInput, 'Looks good to proceed')

      await user.click(screen.getByTestId(TEST_IDS.confirmButton))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(mockApiClient.approveGate).toHaveBeenCalledWith(
          'task-123',
          'gate-1',
          expect.objectContaining({
            comment: 'Looks good to proceed',
          })
        )
      })
    })

    it('should handle approval API errors gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onActionError = vi.fn()

      mockApiClient.approveGate.mockRejectedValueOnce(new Error('Network error'))

      const props = createPropsWithPendingGates(1, { onActionError })
      render(<ApprovalGatePanel {...props} />)

      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))
      await user.click(screen.getByTestId(TEST_IDS.confirmButton))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'gate-1' }),
          'approve',
          expect.any(Error)
        )
      })
    })

    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)
      render(<ApprovalGatePanel {...props} />)

      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))
      expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()

      await user.click(screen.getByTestId(TEST_IDS.cancelButton))

      await waitFor(() => {
        expect(screen.queryByTestId(TEST_IDS.confirmationDialog)).not.toBeInTheDocument()
      })
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

      await user.click(screen.getByTestId(TEST_IDS.rejectButton('gate-1')))

      expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()
      expect(screen.getByText(/reject this gate/i)).toBeInTheDocument()
    })

    it('should require comment for rejection', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1, { requireConfirmation: true })
      render(<ApprovalGatePanel {...props} />)

      await user.click(screen.getByTestId(TEST_IDS.rejectButton('gate-1')))

      // Try to confirm without comment
      await user.click(screen.getByTestId(TEST_IDS.confirmButton))

      // Should show validation error
      expect(screen.getByText(/comment is required for rejection/i)).toBeInTheDocument()
      expect(mockApiClient.rejectGate).not.toHaveBeenCalled()
    })

    it('should reject gate with comment', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onGateAction = vi.fn()
      const props = createPropsWithPendingGates(1, { onGateAction })

      render(<ApprovalGatePanel {...props} />)

      await user.click(screen.getByTestId(TEST_IDS.rejectButton('gate-1')))

      // Add required comment
      const commentInput = screen.getByTestId(TEST_IDS.commentInput)
      await user.type(commentInput, 'Needs more review before proceeding')

      await user.click(screen.getByTestId(TEST_IDS.confirmButton))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(mockApiClient.rejectGate).toHaveBeenCalledWith(
          'task-123',
          'gate-1',
          expect.objectContaining({
            comment: 'Needs more review before proceeding',
          })
        )
      })

      expect(onGateAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'gate-1' }),
        'reject',
        'Needs more review before proceeding'
      )
    })
  })

  // ============================================================================
  // WebSocket Events Tests
  // ============================================================================

  describe('WebSocket Events', () => {
    it('should update UI when new gate arrives via WebSocket', async () => {
      // Start with empty state
      const props = createDefaultProps()
      const { rerender } = render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId(TEST_IDS.emptyPendingMessage)).toBeInTheDocument()

      // Simulate WebSocket event adding a new gate
      const newGate = createMockPendingGate({ id: 'new-gate-1' })

      act(() => {
        mockRealtimeState.pendingGates = [newGate]
        mockRealtimeState.lastUpdate = new Date()
      })

      rerender(<ApprovalGatePanel {...{ ...props, pendingGates: [newGate] }} />)

      await waitFor(() => {
        expect(screen.getByTestId(TEST_IDS.gateItem('new-gate-1'))).toBeInTheDocument()
        expect(screen.queryByTestId(TEST_IDS.emptyPendingMessage)).not.toBeInTheDocument()
      })
    })

    it('should update UI when gate is approved via WebSocket', async () => {
      const pendingGate = createMockPendingGate({ id: 'gate-1' })
      const props = createDefaultProps({ pendingGates: [pendingGate] })
      const { rerender } = render(<ApprovalGatePanel {...props} />)

      // Initially should show pending gate
      expect(screen.getByTestId(TEST_IDS.gateItem('gate-1'))).toBeInTheDocument()

      // Simulate WebSocket approval event
      const resolvedGate = createMockResolvedGate('approved', { id: 'gate-1' })

      act(() => {
        mockRealtimeState.pendingGates = []
        mockRealtimeState.resolvedGates = [resolvedGate]
        mockRealtimeState.lastUpdate = new Date()
      })

      rerender(<ApprovalGatePanel {...{ ...props, pendingGates: [], resolvedGates: [resolvedGate] }} />)

      await waitFor(() => {
        expect(screen.queryByTestId(TEST_IDS.gateItem('gate-1'))).not.toBeInTheDocument()
        expect(screen.getByTestId(TEST_IDS.resolvedGatesList)).toBeInTheDocument()
        expect(screen.getByText(/approved/i)).toBeInTheDocument()
      })
    })

    it('should handle connection state changes', async () => {
      const props = createDefaultProps({ showConnectionIndicator: true })
      const { rerender } = render(<ApprovalGatePanel {...props} />)

      // Initially disconnected
      expect(screen.getByText(/connection: disconnected/i)).toBeInTheDocument()

      // Simulate connection
      act(() => {
        mockRealtimeState.connectionState = 'connected'
        mockRealtimeState.isConnected = true
      })

      rerender(<ApprovalGatePanel {...props} />)

      await waitFor(() => {
        expect(screen.getByText(/connection: connected/i)).toBeInTheDocument()
      })

      // Simulate connection error
      act(() => {
        mockRealtimeState.connectionState = 'error'
        mockRealtimeState.isConnected = false
        mockRealtimeState.error = 'Connection failed'
      })

      rerender(<ApprovalGatePanel {...{ ...props, error: 'Connection failed' }} />)

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument()
      })
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    describe.each(ERROR_SCENARIOS)('$name', ({ error, shouldRetry }) => {
      it('should handle API error gracefully', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
        const onActionError = vi.fn()

        mockApiClient.approveGate.mockRejectedValueOnce(error)

        const props = createPropsWithPendingGates(1, { onActionError })
        render(<ApprovalGatePanel {...props} />)

        await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))
        await user.click(screen.getByTestId(TEST_IDS.confirmButton))

        await act(async () => {
          vi.advanceTimersByTime(100)
        })

        await waitFor(() => {
          expect(onActionError).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'gate-1' }),
            'approve',
            expect.objectMatching(
              typeof error === 'object' && 'status' in error
                ? { message: error.message }
                : error
            )
          )
        })
      })
    })

    it('should handle WebSocket errors', async () => {
      const props = createDefaultProps()
      const { rerender } = render(<ApprovalGatePanel {...props} />)

      // Simulate WebSocket error
      act(() => {
        mockRealtimeState.connectionState = 'error'
        mockRealtimeState.error = 'WebSocket connection failed'
      })

      rerender(<ApprovalGatePanel {...{ ...props, error: 'WebSocket connection failed' }} />)

      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeInTheDocument()
        expect(screen.getByText(/websocket connection failed/i)).toBeInTheDocument()
      })
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

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    describe.each(PERFORMANCE_SCENARIOS)('$name', ({ pendingCount, resolvedCount }) => {
      it('should handle large datasets efficiently', () => {
        const startTime = performance.now()

        const props = {
          ...createPropsWithPendingGates(pendingCount),
          ...createPropsWithResolvedGates(resolvedCount),
        }

        render(<ApprovalGatePanel {...props} />)

        const renderTime = performance.now() - startTime

        // Should render within reasonable time (1 second for even large datasets)
        expect(renderTime).toBeLessThan(1000)

        // Verify all gates are rendered
        expect(screen.getByTestId(TEST_IDS.pendingGatesList)).toBeInTheDocument()
        if (resolvedCount > 0) {
          expect(screen.getByTestId(TEST_IDS.resolvedGatesList)).toBeInTheDocument()
        }
      })
    })

    it('should handle rapid WebSocket events efficiently', async () => {
      const props = createDefaultProps()
      const { rerender } = render(<ApprovalGatePanel {...props} />)

      const events = createEventSequence()
      const startTime = performance.now()

      // Simulate rapid events
      for (let i = 0; i < 10; i++) {
        act(() => {
          mockRealtimeState.lastUpdate = new Date()
        })

        rerender(<ApprovalGatePanel {...props} />)
      }

      const processingTime = performance.now() - startTime

      // Should handle rapid events efficiently
      expect(processingTime).toBeLessThan(500)
    })
  })

  // ============================================================================
  // Integration Flow Tests
  // ============================================================================

  describe('Integration Flows', () => {
    it('should handle complete approve workflow', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const onActionSuccess = vi.fn()
      const onGateReceived = vi.fn()

      const props = createDefaultProps({
        pendingGates: [createMockPendingGate({ id: 'flow-gate-1' })],
        onActionSuccess,
        onGateReceived,
      })

      render(<ApprovalGatePanel {...props} />)

      // 1. Verify initial state
      expect(screen.getByTestId(TEST_IDS.gateItem('flow-gate-1'))).toBeInTheDocument()

      // 2. Click approve
      await user.click(screen.getByTestId(TEST_IDS.approveButton('flow-gate-1')))
      expect(screen.getByTestId(TEST_IDS.confirmationDialog)).toBeInTheDocument()

      // 3. Add comment
      await user.type(screen.getByTestId(TEST_IDS.commentInput), 'Approved after review')

      // 4. Confirm approval
      await user.click(screen.getByTestId(TEST_IDS.confirmButton))

      // 5. Wait for API call
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(mockApiClient.approveGate).toHaveBeenCalledWith(
          'task-123',
          'flow-gate-1',
          expect.objectContaining({
            comment: 'Approved after review',
          })
        )
      })

      // 6. Verify success callback
      expect(onActionSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'flow-gate-1' }),
        'approve'
      )
    })

    it('should handle connection state management flow', async () => {
      const props = createDefaultProps({
        autoConnect: true,
        showConnectionIndicator: true,
      })

      render(<ApprovalGatePanel {...props} />)

      // 1. Should start connecting
      expect(mockRealtimeActions.connect).toHaveBeenCalled()

      // 2. Simulate successful connection
      act(() => {
        mockRealtimeState.connectionState = 'connected'
        mockRealtimeState.isConnected = true
      })

      await waitFor(() => {
        expect(screen.getByText(/connection: connected/i)).toBeInTheDocument()
      })

      // 3. Simulate connection loss
      act(() => {
        mockRealtimeState.connectionState = 'reconnecting'
        mockRealtimeState.isConnected = false
      })

      // 4. Should attempt to reconnect
      expect(mockRealtimeActions.connect).toHaveBeenCalledTimes(1) // Initial call
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty comment gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const props = createPropsWithPendingGates(1)

      render(<ApprovalGatePanel {...props} />)

      await user.click(screen.getByTestId(TEST_IDS.approveButton('gate-1')))

      // Leave comment empty and confirm
      await user.click(screen.getByTestId(TEST_IDS.confirmButton))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(mockApiClient.approveGate).toHaveBeenCalledWith(
          'task-123',
          'gate-1',
          expect.objectContaining({
            comment: undefined,
          })
        )
      })
    })

    it('should handle gates without diff data', () => {
      const gateWithoutDiff = createMockPendingGate({
        id: 'gate-no-diff',
        diffData: undefined,
      })

      const props = createDefaultProps({
        pendingGates: [gateWithoutDiff],
      })

      render(<ApprovalGatePanel {...props} />)

      expect(screen.getByTestId(TEST_IDS.gateItem('gate-no-diff'))).toBeInTheDocument()
      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
    })

    it('should handle disabled state correctly', () => {
      const props = createPropsWithPendingGates(1, { readOnly: true })
      render(<ApprovalGatePanel {...props} />)

      const approveButton = screen.getByTestId(TEST_IDS.approveButton('gate-1'))
      const rejectButton = screen.getByTestId(TEST_IDS.rejectButton('gate-1'))

      expect(approveButton).toBeDisabled()
      expect(rejectButton).toBeDisabled()
    })

    it('should handle compact mode display', () => {
      const props = createPropsWithPendingGates(2, { compact: true })
      render(<ApprovalGatePanel {...props} />)

      const panel = screen.getByTestId(TEST_IDS.approvalGatePanel)
      expect(panel).toHaveAttribute('data-compact', 'true')
    })
  })
})