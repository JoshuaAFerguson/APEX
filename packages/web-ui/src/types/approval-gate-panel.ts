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
 * Validates both status and required properties for proper type narrowing
 *
 * This validates:
 * - status is 'pending'
 * - Required fields from Gate: name, taskId
 * - Optional extended fields (if present): resourceImpact must be valid, gateType must be valid
 *
 * For strict validation that requires resourceImpact and gateType, see isPendingGateStrict
 */
export function isPendingGate(gate: unknown): gate is PendingApprovalGate {
  if (!gate || typeof gate !== 'object') return false
  const g = gate as Record<string, unknown>

  // Basic required fields (from Gate interface + PendingApprovalGate)
  const hasRequiredFields = (
    g.status === 'pending' &&
    typeof g.name === 'string' &&
    typeof g.taskId === 'string'
  )

  if (!hasRequiredFields) return false

  // Optional field validation (if present, must be valid)
  const validResourceImpact = g.resourceImpact === undefined ||
    ['low', 'medium', 'high', 'critical'].includes(g.resourceImpact as string)

  const validGateType = g.gateType === undefined ||
    ['pre-execution', 'post-execution', 'resource-access', 'dangerous-operation', 'deployment', 'security-review'].includes(g.gateType as string)

  return validResourceImpact && validGateType
}

/**
 * Strict type guard for pending gates
 * Requires resourceImpact and gateType to be present and valid
 */
export function isPendingGateStrict(gate: unknown): gate is PendingApprovalGate & {
  resourceImpact: NonNullable<PendingApprovalGate['resourceImpact']>;
  gateType: NonNullable<PendingApprovalGate['gateType']>;
} {
  if (!isPendingGate(gate)) return false
  const g = gate as unknown as Record<string, unknown>
  return (
    typeof g.resourceImpact === 'string' &&
    ['low', 'medium', 'high', 'critical'].includes(g.resourceImpact as string) &&
    typeof g.gateType === 'string' &&
    ['pre-execution', 'post-execution', 'resource-access', 'dangerous-operation', 'deployment', 'security-review'].includes(g.gateType as string)
  )
}

/**
 * Type guard for resolved gates
 * Validates both status and required properties for proper type narrowing
 *
 * For base Gate interface, only status is required to determine resolved state.
 * Extended ResolvedApprovalGate requires approver, but the base check is more lenient.
 */
export function isResolvedGate(gate: unknown): gate is ResolvedApprovalGate {
  if (!gate || typeof gate !== 'object') return false
  const g = gate as Record<string, unknown>
  return (
    ['approved', 'rejected', 'skipped', 'timeout'].includes(g.status as string) &&
    typeof g.name === 'string' &&
    typeof g.taskId === 'string'
  )
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
  /** Gate being acted upon (PendingApprovalGate which has the id property) */
  gate: PendingApprovalGate | null
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
  | { type: 'OPEN_DIALOG'; payload: { actionType: 'approve' | 'reject'; gate: PendingApprovalGate } }
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
  if (!event || typeof event !== 'object') return false
  return (
    (event.type === 'gate:required' || event.type === 'approval-required') &&
    'data' in event &&
    event.data !== undefined
  )
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

// ============================================================================
// Filter and Sort State Types
// ============================================================================

/**
 * Valid gate statuses for filtering
 */
export type FilterableGateStatus = GateStatus | ''

/**
 * Valid gate types for filtering (extended with additional types)
 */
export type FilterableGateType =
  | 'pre-execution'
  | 'post-execution'
  | 'resource-access'
  | 'dangerous-operation'
  | 'deployment'
  | 'security-review'
  | ''

/**
 * Valid resource impacts for filtering
 */
export type FilterableResourceImpact = 'low' | 'medium' | 'high' | 'critical' | ''

/**
 * Filter state for approval gates list
 */
export interface FilterState {
  /** Status filter */
  status: FilterableGateStatus
  /** Task ID filter */
  taskId: string
  /** Gate type filter */
  gateType: FilterableGateType
  /** Resource impact filter */
  resourceImpact: FilterableResourceImpact
  /** Search query filter */
  searchQuery: string
}

/**
 * Valid sort fields for approval gates
 */
export type SortField = 'requiredAt' | 'priority' | 'taskId' | 'name'

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Sort state for approval gates list
 */
export interface SortState {
  /** Field to sort by */
  field: SortField
  /** Sort direction */
  direction: SortDirection
}

// ============================================================================
// Validation Functions
// ============================================================================

/** Valid gate statuses for filtering */
const VALID_FILTER_STATUSES: readonly string[] = ['pending', 'approved', 'rejected', 'skipped', 'timeout', '']

/** Valid gate types including extended types */
const VALID_GATE_TYPES: readonly string[] = [
  'pre-execution',
  'post-execution',
  'resource-access',
  'dangerous-operation',
  'deployment',
  'security-review',
  '',
]

/** Valid resource impact levels */
const VALID_RESOURCE_IMPACTS: readonly string[] = ['low', 'medium', 'high', 'critical', '']

/** Valid sort fields */
const VALID_SORT_FIELDS: readonly string[] = ['requiredAt', 'priority', 'taskId', 'name']

/** Valid sort directions */
const VALID_SORT_DIRECTIONS: readonly string[] = ['asc', 'desc']

/**
 * Validates filter state structure and values
 */
export function validateFilterState(state: unknown): state is FilterState {
  if (!state || typeof state !== 'object') return false
  const s = state as Record<string, unknown>
  return (
    VALID_FILTER_STATUSES.includes(s.status as string) &&
    typeof s.taskId === 'string' &&
    VALID_GATE_TYPES.includes(s.gateType as string) &&
    VALID_RESOURCE_IMPACTS.includes(s.resourceImpact as string) &&
    typeof s.searchQuery === 'string'
  )
}

/**
 * Validates sort state structure and values
 */
export function validateSortState(state: unknown): state is SortState {
  if (!state || typeof state !== 'object') return false
  const s = state as Record<string, unknown>
  return (
    VALID_SORT_FIELDS.includes(s.field as string) &&
    VALID_SORT_DIRECTIONS.includes(s.direction as string)
  )
}

/**
 * Validates a gate type string
 */
export function validateGateType(type: unknown): boolean {
  if (typeof type !== 'string') return false
  // Only valid non-empty gate types
  return VALID_GATE_TYPES.filter(t => t !== '').includes(type)
}

/**
 * Validates a resource impact string
 */
export function validateResourceImpact(impact: unknown): boolean {
  if (typeof impact !== 'string') return false
  // Only valid non-empty impact levels
  return VALID_RESOURCE_IMPACTS.filter(i => i !== '').includes(impact)
}

/**
 * Validates a gate priority value
 * Priority must be an integer between 1 and 10
 */
export function validateGatePriority(priority: unknown): boolean {
  if (typeof priority !== 'number') return false
  return Number.isInteger(priority) && priority >= 1 && priority <= 10
}

// ============================================================================
// Additional WebSocket Event Type Guards
// ============================================================================

/**
 * Type guard for gate approved events
 */
export function isGateApprovedEvent(
  event: ApprovalGateWebSocketEvent
): event is GateApprovedEvent {
  if (!event || typeof event !== 'object') return false
  return event.type === 'gate:approved' && 'data' in event
}

/**
 * Type guard for gate rejected events
 */
export function isGateRejectedEvent(
  event: ApprovalGateWebSocketEvent
): event is GateRejectedEvent {
  if (!event || typeof event !== 'object') return false
  return event.type === 'gate:rejected' && 'data' in event
}

/**
 * Type guard for gate timeout events
 */
export function isGateTimeoutEvent(
  event: ApprovalGateWebSocketEvent
): event is GateTimeoutEvent {
  if (!event || typeof event !== 'object') return false
  return event.type === 'gate:timeout' && 'data' in event
}

/**
 * Type guard for gate skipped events
 */
export function isGateSkippedEvent(
  event: ApprovalGateWebSocketEvent
): event is GateSkippedEvent {
  if (!event || typeof event !== 'object') return false
  return event.type === 'gate:skipped' && 'data' in event
}

/**
 * Type guard for approval resolved events
 */
export function isApprovalResolvedEvent(
  event: ApprovalGateWebSocketEvent
): event is ApprovalResolvedEvent {
  if (!event || typeof event !== 'object') return false
  return event.type === 'approval-resolved' && 'data' in event
}
