/**
 * ApprovalGatePanel Component Types
 *
 * Type definitions for the ApprovalGatePanel component system, including
 * extended interfaces for pending/resolved gates, diff data, confirmation
 * state, and WebSocket events.
 *
 * Integrates with the existing @apexcli/core Gate type and follows
 * established patterns from the codebase.
 *
 * @packageDocumentation
 */

import type { Gate, GateStatus, ApprovalState, ApprovalStatus } from '@apexcli/core'
import type { DashboardEventType, ActivityEventSeverity } from './dashboard'
import type { FileDiff, DiffViewMode } from '../components/diff/types'

// ============================================================================
// Extended Gate Types
// ============================================================================

/**
 * Extended gate interface with additional UI-specific properties
 * for pending approval gates
 */
export interface PendingApprovalGate extends Gate {
  /** Unique identifier for the gate (required for UI operations) */
  id: string
  /** Extended status for pending gates - always 'pending' */
  status: Extract<GateStatus, 'pending'>
  /** Description of what the gate is protecting */
  description?: string
  /** Resource impact level */
  resourceImpact?: 'low' | 'medium' | 'high' | 'critical'
  /** Type of approval checkpoint */
  gateType?: 'pre-execution' | 'post-execution' | 'resource-access' | 'dangerous-operation'
  /** Associated diff data for code changes */
  diffData?: ApprovalDiffData
  /** Estimated impact of proceeding */
  estimatedImpact?: string
  /** Related file paths affected by this gate */
  affectedPaths?: string[]
  /** Priority level for ordering */
  priority?: number
  /** Time until timeout (ms) */
  timeoutMs?: number
  /** When the timeout will occur */
  timeoutAt?: Date
}

/**
 * Extended gate interface with resolution details
 * for gates that have been approved or rejected
 */
export interface ResolvedApprovalGate extends Gate {
  /** Unique identifier for the gate (required for UI operations) */
  id: string
  /** Extended status for resolved gates */
  status: Extract<GateStatus, 'approved' | 'rejected' | 'skipped' | 'timeout'>
  /** Who approved/rejected the gate */
  approver: string
  /** When the gate was resolved */
  respondedAt: Date
  /** Comment provided with the decision */
  comment?: string
  /** Resolution reason (for skipped/timeout) */
  resolutionReason?: string
  /** Time taken to resolve (ms) */
  resolutionTimeMs?: number
  /** Whether this was auto-resolved (e.g., timeout) */
  autoResolved?: boolean
}

/**
 * Union type for any approval gate state
 */
export type ApprovalGate = PendingApprovalGate | ResolvedApprovalGate

/**
 * Type guard for pending gates
 */
export function isPendingGate(gate: Gate): gate is PendingApprovalGate {
  return gate.status === 'pending'
}

/**
 * Type guard for resolved gates
 */
export function isResolvedGate(gate: Gate): gate is ResolvedApprovalGate {
  return gate.status !== 'pending'
}

// ============================================================================
// Diff Data Types
// ============================================================================

/**
 * Diff data associated with an approval gate
 */
export interface ApprovalDiffData {
  /** Unique identifier for the diff */
  diffId: string
  /** Type of change being previewed */
  changeType: 'file-write' | 'file-edit' | 'file-delete' | 'multi-file' | 'command-execution'
  /** File diffs for code changes */
  fileDiffs?: FileDiff[]
  /** Raw diff content for fallback display */
  rawDiff?: string
  /** Summary of changes */
  summary?: string
  /** Number of files affected */
  filesChanged?: number
  /** Lines added */
  linesAdded?: number
  /** Lines removed */
  linesRemoved?: number
  /** Command being executed (for command-execution type) */
  command?: string
  /** Preview of command output (if available) */
  commandPreview?: string
}

// ============================================================================
// Confirmation State Types
// ============================================================================

/**
 * Confirmation dialog state for gate actions
 */
export interface ConfirmationState {
  /** Whether the confirmation dialog is open */
  isOpen: boolean
  /** Type of action being confirmed */
  actionType: 'approve' | 'reject' | null
  /** Gate being acted upon */
  gate: Gate | null
  /** Comment entered for the action */
  comment: string
  /** Whether the action is being submitted */
  isSubmitting: boolean
  /** Error from the submission attempt */
  error: string | null
}

/**
 * Initial confirmation state
 */
export const INITIAL_CONFIRMATION_STATE: ConfirmationState = {
  isOpen: false,
  actionType: null,
  gate: null,
  comment: '',
  isSubmitting: false,
  error: null,
}

/**
 * Actions for confirmation state reducer
 */
export type ConfirmationAction =
  | { type: 'OPEN_DIALOG'; payload: { actionType: 'approve' | 'reject'; gate: Gate } }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'SET_COMMENT'; payload: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; payload: string }
  | { type: 'RESET' }

/**
 * Reducer for confirmation state
 */
export function confirmationReducer(
  state: ConfirmationState,
  action: ConfirmationAction
): ConfirmationState {
  switch (action.type) {
    case 'OPEN_DIALOG':
      return {
        ...INITIAL_CONFIRMATION_STATE,
        isOpen: true,
        actionType: action.payload.actionType,
        gate: action.payload.gate,
      }
    case 'CLOSE_DIALOG':
      return { ...state, isOpen: false }
    case 'SET_COMMENT':
      return { ...state, comment: action.payload }
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, error: null }
    case 'SUBMIT_SUCCESS':
      return INITIAL_CONFIRMATION_STATE
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, error: action.payload }
    case 'RESET':
      return INITIAL_CONFIRMATION_STATE
    default:
      return state
  }
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

/**
 * WebSocket event types specific to approval gates
 */
export type ApprovalGateEventType =
  | 'gate:required'
  | 'gate:approved'
  | 'gate:rejected'
  | 'gate:timeout'
  | 'gate:skipped'
  | 'approval-required'
  | 'approval-resolved'

/**
 * Base WebSocket event structure for approval gates
 */
export interface ApprovalGateWebSocketEventBase {
  /** Event type identifier */
  type: ApprovalGateEventType
  /** Task ID associated with the event */
  taskId: string
  /** Timestamp when the event occurred */
  timestamp: Date
  /** Unique event ID */
  eventId: string
}

/**
 * WebSocket event for when a gate becomes required
 */
export interface GateRequiredEvent extends ApprovalGateWebSocketEventBase {
  type: 'gate:required' | 'approval-required'
  data: {
    /** Gate information */
    gate: PendingApprovalGate
    /** Approval ID for tracking */
    approvalId: string
    /** Description of what requires approval */
    description?: string
    /** Resource impact assessment */
    resourceImpact?: 'low' | 'medium' | 'high' | 'critical'
    /** Diff data if available */
    diffData?: ApprovalDiffData
  }
}

/**
 * WebSocket event for when a gate is approved
 */
export interface GateApprovedEvent extends ApprovalGateWebSocketEventBase {
  type: 'gate:approved'
  data: {
    /** Resolved gate information */
    gate: ResolvedApprovalGate
    /** Who approved the gate */
    approver: string
    /** Comment provided */
    comment?: string
  }
}

/**
 * WebSocket event for when a gate is rejected
 */
export interface GateRejectedEvent extends ApprovalGateWebSocketEventBase {
  type: 'gate:rejected'
  data: {
    /** Resolved gate information */
    gate: ResolvedApprovalGate
    /** Who rejected the gate */
    approver: string
    /** Reason for rejection */
    comment: string
  }
}

/**
 * WebSocket event for when a gate times out
 */
export interface GateTimeoutEvent extends ApprovalGateWebSocketEventBase {
  type: 'gate:timeout'
  data: {
    /** Gate that timed out */
    gate: ResolvedApprovalGate
    /** Timeout duration in ms */
    timeoutMs: number
  }
}

/**
 * WebSocket event for when a gate is skipped
 */
export interface GateSkippedEvent extends ApprovalGateWebSocketEventBase {
  type: 'gate:skipped'
  data: {
    /** Gate that was skipped */
    gate: ResolvedApprovalGate
    /** Reason for skipping */
    reason: string
  }
}

/**
 * WebSocket event for approval resolution (covers approve/reject)
 */
export interface ApprovalResolvedEvent extends ApprovalGateWebSocketEventBase {
  type: 'approval-resolved'
  data: {
    /** Approval ID */
    approvalId: string
    /** Gate name */
    gateName: string
    /** Whether approved or denied */
    approved: boolean
    /** Who made the decision */
    approver: string
    /** Comment provided */
    comment?: string
    /** Resolved gate information */
    gate: ResolvedApprovalGate
  }
}

/**
 * Union type for all approval gate WebSocket events
 */
export type ApprovalGateWebSocketEvent =
  | GateRequiredEvent
  | GateApprovedEvent
  | GateRejectedEvent
  | GateTimeoutEvent
  | GateSkippedEvent
  | ApprovalResolvedEvent

/**
 * Type guard for gate required events
 */
export function isGateRequiredEvent(
  event: ApprovalGateWebSocketEvent
): event is GateRequiredEvent {
  return event.type === 'gate:required' || event.type === 'approval-required'
}

/**
 * Type guard for gate resolved events (approved, rejected, timeout, skipped, approval-resolved)
 */
export function isGateResolvedEvent(
  event: ApprovalGateWebSocketEvent
): event is GateApprovedEvent | GateRejectedEvent | GateTimeoutEvent | GateSkippedEvent | ApprovalResolvedEvent {
  return (
    event.type === 'gate:approved' ||
    event.type === 'gate:rejected' ||
    event.type === 'gate:timeout' ||
    event.type === 'gate:skipped' ||
    event.type === 'approval-resolved'
  )
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for the main ApprovalGatePanel component
 */
export interface ApprovalGatePanelProps {
  /** Task ID for API calls */
  taskId: string

  /** List of pending gates requiring approval */
  pendingGates: PendingApprovalGate[]

  /** List of resolved gates for history display */
  resolvedGates?: ResolvedApprovalGate[]

  /** Current approver identity */
  approver: string

  /** Whether to use real-time WebSocket updates */
  useRealTimeUpdates?: boolean

  /** Whether to auto-connect WebSocket on mount */
  autoConnect?: boolean

  /** Show WebSocket connection indicator */
  showConnectionIndicator?: boolean

  /** Callback when a gate action is performed */
  onGateAction?: (
    gate: Gate,
    action: 'approve' | 'reject',
    comment?: string
  ) => void | Promise<void>

  /** Callback when a gate action succeeds */
  onActionSuccess?: (gate: Gate, action: 'approve' | 'reject') => void

  /** Callback when a gate action fails */
  onActionError?: (gate: Gate, action: 'approve' | 'reject', error: Error) => void

  /** Callback when a new gate arrives via WebSocket */
  onGateReceived?: (gate: PendingApprovalGate) => void

  /** Callback when a gate is resolved via WebSocket */
  onGateResolved?: (gate: ResolvedApprovalGate) => void

  /** Whether the panel is in read-only mode */
  readOnly?: boolean

  /** Whether to show the history section */
  showHistory?: boolean

  /** Maximum number of history items to show */
  maxHistoryItems?: number

  /** Whether to show diff previews inline */
  showDiffPreview?: boolean

  /** Default view mode for diff previews */
  diffViewMode?: DiffViewMode

  /** Whether to require confirmation for actions */
  requireConfirmation?: boolean

  /** Whether the panel is in compact mode */
  compact?: boolean

  /** Whether the panel is loading */
  loading?: boolean

  /** Error state for display */
  error?: Error | string | null

  /** Custom className for styling */
  className?: string
}

/**
 * Props for individual approval gate item component
 */
export interface ApprovalGateItemProps {
  /** The gate to display */
  gate: PendingApprovalGate

  /** Whether this item is expanded */
  isExpanded?: boolean

  /** Whether the item is in a loading state */
  isLoading?: boolean

  /** Loading action type (approve/reject) */
  loadingAction?: 'approve' | 'reject' | null

  /** Error message for this item */
  error?: string | null

  /** Callback when approve is clicked */
  onApprove?: (comment?: string) => void | Promise<void>

  /** Callback when reject is clicked */
  onReject?: (comment?: string) => void | Promise<void>

  /** Callback when expand/collapse is toggled */
  onToggleExpand?: () => void

  /** Callback when view diff is clicked */
  onViewDiff?: () => void

  /** Whether the item is in read-only mode */
  readOnly?: boolean

  /** Whether to show the diff preview */
  showDiffPreview?: boolean

  /** View mode for diff preview */
  diffViewMode?: DiffViewMode

  /** Whether the item is in compact mode */
  compact?: boolean

  /** Custom className for styling */
  className?: string
}

/**
 * Props for the diff preview component within approval gates
 */
export interface ApprovalDiffPreviewProps {
  /** Diff data to display */
  diffData: ApprovalDiffData

  /** View mode for the diff */
  viewMode?: DiffViewMode

  /** Whether to show line numbers */
  showLineNumbers?: boolean

  /** Whether to enable syntax highlighting */
  highlighting?: boolean

  /** Maximum height before scrolling */
  maxHeight?: number | string

  /** Whether the diff is collapsible */
  collapsible?: boolean

  /** Whether the diff is initially collapsed */
  defaultCollapsed?: boolean

  /** Whether the preview is loading */
  loading?: boolean

  /** Error state for the preview */
  error?: string | null

  /** Callback when copy is triggered */
  onCopy?: (content: string) => void

  /** Custom className for styling */
  className?: string
}

/**
 * Props for the confirmation dialog component
 */
export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean

  /** Action type being confirmed */
  actionType: 'approve' | 'reject'

  /** Gate being acted upon */
  gate: Gate

  /** Current comment value */
  comment: string

  /** Whether the action is being submitted */
  isSubmitting?: boolean

  /** Error message to display */
  error?: string | null

  /** Whether comment is required for rejection */
  requireCommentForReject?: boolean

  /** Placeholder text for comment input */
  commentPlaceholder?: string

  /** Maximum comment length */
  maxCommentLength?: number

  /** Callback when comment changes */
  onCommentChange: (comment: string) => void

  /** Callback when confirm is clicked */
  onConfirm: () => void | Promise<void>

  /** Callback when cancel is clicked */
  onCancel: () => void

  /** Custom className for styling */
  className?: string
}

/**
 * Props for the gate history item component
 */
export interface ApprovalGateHistoryItemProps {
  /** Resolved gate to display */
  gate: ResolvedApprovalGate

  /** Whether to show detailed information */
  showDetails?: boolean

  /** Whether the item is in compact mode */
  compact?: boolean

  /** Custom className for styling */
  className?: string
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for the useApprovalGatePanel hook
 */
export interface UseApprovalGatePanelReturn {
  /** Pending gates state */
  pendingGates: PendingApprovalGate[]

  /** Resolved gates state */
  resolvedGates: ResolvedApprovalGate[]

  /** Confirmation dialog state */
  confirmationState: ConfirmationState

  /** Whether currently loading */
  isLoading: boolean

  /** Current error state */
  error: string | null

  /** WebSocket connection status */
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'error'

  /** Open confirmation dialog for approve */
  openApproveDialog: (gate: Gate) => void

  /** Open confirmation dialog for reject */
  openRejectDialog: (gate: Gate) => void

  /** Close confirmation dialog */
  closeDialog: () => void

  /** Set confirmation comment */
  setComment: (comment: string) => void

  /** Submit the confirmation action */
  submitAction: () => Promise<void>

  /** Dismiss error */
  dismissError: () => void

  /** Refresh gates list */
  refresh: () => Promise<void>
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Resource impact configuration
 */
export interface ResourceImpactConfig {
  level: 'low' | 'medium' | 'high' | 'critical'
  label: string
  description: string
  color: string
  icon: string
}

/**
 * Gate type configuration
 */
export interface GateTypeConfig {
  type: PendingApprovalGate['gateType']
  label: string
  description: string
  icon: string
}
