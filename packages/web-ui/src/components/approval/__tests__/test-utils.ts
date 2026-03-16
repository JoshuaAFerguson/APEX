/**
 * Test utilities for ApprovalGatePanel integration tests
 * Provides factory functions and mock data for consistent testing
 */

import type {
  PendingApprovalGate,
  ResolvedApprovalGate,
  ApprovalDiffData,
  ApprovalGateWebSocketEvent,
  GateRequiredEvent,
  GateApprovedEvent,
  GateRejectedEvent,
  GateTimeoutEvent,
  GateSkippedEvent,
  ApprovalResolvedEvent,
  ApprovalGateEventType,
  ApprovalGatePanelProps,
} from '../../../types/approval-gate-panel'
import type { Gate, GateStatus } from '@apexcli/core'
import type { DiffViewMode } from '../../../components/diff/types'

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Creates a base mock gate with essential properties
 */
export function createMockBaseGate(
  status: GateStatus,
  overrides: Partial<Gate> = {}
): Gate {
  return {
    id: 'test-gate-1',
    name: 'Test Gate',
    status,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    taskId: 'task-123',
    ...overrides,
  }
}

/**
 * Creates a mock pending approval gate
 */
export function createMockPendingGate(
  overrides: Partial<PendingApprovalGate> = {}
): PendingApprovalGate {
  return {
    ...createMockBaseGate('pending'),
    description: 'Test pending gate requiring approval',
    resourceImpact: 'medium',
    gateType: 'pre-execution',
    diffData: createMockDiffData(),
    estimatedImpact: 'Low impact change - safe to proceed',
    affectedPaths: ['/src/test/file.ts', '/src/components/TestComponent.tsx'],
    priority: 1,
    timeoutMs: 30000,
    timeoutAt: new Date('2024-01-15T10:30:00Z'),
    ...overrides,
  }
}

/**
 * Creates a mock resolved approval gate
 */
export function createMockResolvedGate(
  status: Extract<GateStatus, 'approved' | 'rejected' | 'skipped' | 'timeout'> = 'approved',
  overrides: Partial<ResolvedApprovalGate> = {}
): ResolvedApprovalGate {
  return {
    ...createMockBaseGate(status),
    approver: 'test-user@example.com',
    respondedAt: new Date('2024-01-15T10:15:00Z'),
    comment: status === 'approved' ? 'Looks good to proceed' : 'Needs more review',
    resolutionTimeMs: 15000,
    autoResolved: status === 'timeout' || status === 'skipped',
    resolutionReason: status === 'timeout' ? 'Gate timed out after 30 seconds' : undefined,
    ...overrides,
  }
}

/**
 * Creates mock diff data for approval gates
 */
export function createMockDiffData(
  overrides: Partial<ApprovalDiffData> = {}
): ApprovalDiffData {
  return {
    diffId: 'diff-123',
    changeType: 'file-edit',
    fileDiffs: [
      {
        oldPath: '/src/test/file.ts',
        newPath: '/src/test/file.ts',
        oldContent: 'console.log("old")',
        newContent: 'console.log("new")',
        language: 'typescript',
        chunks: [
          {
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            lines: [
              { type: 'remove', content: 'console.log("old")' },
              { type: 'add', content: 'console.log("new")' },
            ],
          },
        ],
      },
    ],
    rawDiff: '@@ -1,1 +1,1 @@\n-console.log("old")\n+console.log("new")',
    summary: 'Updated console log message',
    filesChanged: 1,
    linesAdded: 1,
    linesRemoved: 1,
    ...overrides,
  }
}

/**
 * Creates mock WebSocket events for testing
 */
export function createMockWebSocketEvent<T extends ApprovalGateWebSocketEvent>(
  type: T['type'],
  data: T['data']
): T {
  return {
    type,
    taskId: 'task-123',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    eventId: `event-${Date.now()}-${Math.random()}`,
    data,
  } as T
}

/**
 * Creates a mock gate required event
 */
export function createMockGateRequiredEvent(
  overrides: Partial<GateRequiredEvent['data']> = {}
): GateRequiredEvent {
  return createMockWebSocketEvent<GateRequiredEvent>('gate:required', {
    gate: createMockPendingGate(),
    approvalId: 'approval-123',
    description: 'Gate requires approval before proceeding',
    resourceImpact: 'medium',
    diffData: createMockDiffData(),
    ...overrides,
  })
}

/**
 * Creates a mock gate approved event
 */
export function createMockGateApprovedEvent(
  overrides: Partial<GateApprovedEvent['data']> = {}
): GateApprovedEvent {
  return createMockWebSocketEvent<GateApprovedEvent>('gate:approved', {
    gate: createMockResolvedGate('approved'),
    approver: 'test-user@example.com',
    comment: 'Approved - looks good to go',
    ...overrides,
  })
}

/**
 * Creates a mock gate rejected event
 */
export function createMockGateRejectedEvent(
  overrides: Partial<GateRejectedEvent['data']> = {}
): GateRejectedEvent {
  return createMockWebSocketEvent<GateRejectedEvent>('gate:rejected', {
    gate: createMockResolvedGate('rejected'),
    approver: 'test-user@example.com',
    comment: 'Rejected - needs more work',
    ...overrides,
  })
}

/**
 * Creates a mock gate timeout event
 */
export function createMockGateTimeoutEvent(
  overrides: Partial<GateTimeoutEvent['data']> = {}
): GateTimeoutEvent {
  return createMockWebSocketEvent<GateTimeoutEvent>('gate:timeout', {
    gate: createMockResolvedGate('timeout', {
      resolutionReason: 'Gate timed out after 30 seconds',
      autoResolved: true,
    }),
    timeoutMs: 30000,
    ...overrides,
  })
}

/**
 * Creates a mock approval resolved event
 */
export function createMockApprovalResolvedEvent(
  approved: boolean,
  overrides: Partial<ApprovalResolvedEvent['data']> = {}
): ApprovalResolvedEvent {
  return createMockWebSocketEvent<ApprovalResolvedEvent>('approval-resolved', {
    approvalId: 'approval-123',
    gateName: 'Test Gate',
    approved,
    approver: 'test-user@example.com',
    comment: approved ? 'Approved' : 'Rejected',
    gate: createMockResolvedGate(approved ? 'approved' : 'rejected'),
    ...overrides,
  })
}

// ============================================================================
// Mock Props Builders
// ============================================================================

/**
 * Creates default props for ApprovalGatePanel
 */
export function createDefaultProps(
  overrides: Partial<ApprovalGatePanelProps> = {}
): ApprovalGatePanelProps {
  return {
    taskId: 'task-123',
    pendingGates: [],
    resolvedGates: [],
    approver: 'test-user@example.com',
    useRealTimeUpdates: true,
    autoConnect: true,
    showConnectionIndicator: true,
    showHistory: true,
    maxHistoryItems: 10,
    showDiffPreview: true,
    diffViewMode: 'unified' as DiffViewMode,
    requireConfirmation: true,
    compact: false,
    loading: false,
    error: null,
    ...overrides,
  }
}

/**
 * Creates props with pending gates for testing
 */
export function createPropsWithPendingGates(
  count: number = 2,
  overrides: Partial<ApprovalGatePanelProps> = {}
): ApprovalGatePanelProps {
  const pendingGates = Array.from({ length: count }, (_, i) =>
    createMockPendingGate({
      id: `gate-${i + 1}`,
      name: `Test Gate ${i + 1}`,
      priority: i + 1,
      resourceImpact: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
      gateType: i === 0 ? 'dangerous-operation' : 'pre-execution',
    })
  )

  return createDefaultProps({
    pendingGates,
    ...overrides,
  })
}

/**
 * Creates props with resolved gates for testing history
 */
export function createPropsWithResolvedGates(
  count: number = 3,
  overrides: Partial<ApprovalGatePanelProps> = {}
): ApprovalGatePanelProps {
  const resolvedGates = Array.from({ length: count }, (_, i) => {
    const statuses = ['approved', 'rejected', 'timeout'] as const
    const status = statuses[i % statuses.length]
    return createMockResolvedGate(status, {
      id: `resolved-gate-${i + 1}`,
      name: `Resolved Gate ${i + 1}`,
      respondedAt: new Date(`2024-01-15T${10 + i}:00:00Z`),
    })
  })

  return createDefaultProps({
    resolvedGates,
    ...overrides,
  })
}

/**
 * Creates props with loading state
 */
export function createPropsWithLoading(
  overrides: Partial<ApprovalGatePanelProps> = {}
): ApprovalGatePanelProps {
  return createDefaultProps({
    loading: true,
    pendingGates: [],
    resolvedGates: [],
    ...overrides,
  })
}

/**
 * Creates props with error state
 */
export function createPropsWithError(
  error: string = 'Failed to load approval gates',
  overrides: Partial<ApprovalGatePanelProps> = {}
): ApprovalGatePanelProps {
  return createDefaultProps({
    loading: false,
    error,
    ...overrides,
  })
}

// ============================================================================
// Mock State Utilities
// ============================================================================

/**
 * Mock realtime state for testing WebSocket functionality
 */
export interface MockApprovalGateRealtimeState {
  connectionState: 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'error'
  pendingGates: PendingApprovalGate[]
  resolvedGates: ResolvedApprovalGate[]
  isConnected: boolean
  error: string | null
  lastUpdate: Date
}

/**
 * Creates initial mock realtime state
 */
export function createMockRealtimeState(
  overrides: Partial<MockApprovalGateRealtimeState> = {}
): MockApprovalGateRealtimeState {
  return {
    connectionState: 'disconnected',
    pendingGates: [],
    resolvedGates: [],
    isConnected: false,
    error: null,
    lastUpdate: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  }
}

// ============================================================================
// Test Scenario Builders
// ============================================================================

/**
 * Common error scenarios for testing
 */
export const ERROR_SCENARIOS = [
  {
    name: 'network connection failed',
    error: new Error('Network connection failed'),
    shouldRetry: true,
  },
  {
    name: 'request timeout',
    error: new Error('Request timed out'),
    shouldRetry: true,
  },
  {
    name: 'unauthorized access',
    error: { message: 'Unauthorized', status: 401 },
    shouldRetry: false,
  },
  {
    name: 'gate not found',
    error: { message: 'Gate not found', status: 404 },
    shouldRetry: false,
  },
  {
    name: 'server error',
    error: { message: 'Internal server error', status: 500 },
    shouldRetry: true,
  },
] as const

/**
 * Performance test scenarios with different gate counts
 */
export const PERFORMANCE_SCENARIOS = [
  { name: 'small dataset', pendingCount: 5, resolvedCount: 10 },
  { name: 'medium dataset', pendingCount: 25, resolvedCount: 50 },
  { name: 'large dataset', pendingCount: 100, resolvedCount: 200 },
] as const

/**
 * Accessibility test scenarios with different states
 */
export const ACCESSIBILITY_SCENARIOS = [
  { name: 'empty state', props: createDefaultProps() },
  { name: 'with pending gates', props: createPropsWithPendingGates(3) },
  { name: 'with resolved gates', props: createPropsWithResolvedGates(5) },
  { name: 'with both pending and resolved', props: {
    ...createPropsWithPendingGates(2),
    ...createPropsWithResolvedGates(3),
  }},
  { name: 'loading state', props: createPropsWithLoading() },
  { name: 'error state', props: createPropsWithError() },
  { name: 'compact mode', props: createPropsWithPendingGates(2, { compact: true }) },
] as const

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Simulates a delay for async operations in tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Creates a sequence of WebSocket events for testing flows
 */
export function createEventSequence(): ApprovalGateWebSocketEvent[] {
  const pendingGate = createMockPendingGate({ id: 'gate-1', name: 'Test Sequence Gate' })

  return [
    createMockGateRequiredEvent({ gate: pendingGate }),
    createMockGateApprovedEvent({
      gate: createMockResolvedGate('approved', {
        id: 'gate-1',
        name: 'Test Sequence Gate',
      }),
    }),
  ]
}

/**
 * Generates test IDs following the established convention
 */
export const TEST_IDS = {
  // Main panel
  approvalGatePanel: 'approval-gate-panel',
  pendingGatesList: 'pending-gates-list',
  resolvedGatesList: 'resolved-gates-list',

  // Gate items
  gateItem: (id: string) => `gate-item-${id}`,
  approveButton: (id: string) => `approve-button-${id}`,
  rejectButton: (id: string) => `reject-button-${id}`,
  viewDiffButton: (id: string) => `view-diff-button-${id}`,

  // Dialog
  confirmationDialog: 'confirmation-dialog',
  commentInput: 'comment-input',
  confirmButton: 'confirm-button',
  cancelButton: 'cancel-button',

  // Diff preview
  diffPreview: (id: string) => `diff-preview-${id}`,

  // Status indicators
  loadingIndicator: 'loading-indicator',
  errorMessage: 'error-message',
  connectionIndicator: 'connection-indicator',

  // Empty states
  emptyPendingMessage: 'empty-pending-message',
  emptyResolvedMessage: 'empty-resolved-message',
} as const