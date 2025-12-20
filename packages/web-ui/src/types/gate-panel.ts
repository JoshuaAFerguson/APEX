/**
 * GatePanel Component Types
 *
 * Types for the gate approval panel component.
 */

import type { Gate, GateStatus } from '@apexcli/core'

/**
 * Gate action request
 */
export interface GateAction {
  type: 'approve' | 'reject'
  gateName: string
  approver: string
  comment?: string
}

/**
 * State for individual gate interaction
 */
export interface GateItemState {
  isSubmitting: boolean
  submitError: string | null
  comment: string
  showCommentInput: boolean
  actionType: 'approve' | 'reject' | null
}

/**
 * Props for the GatePanel component
 */
export interface GatePanelProps {
  /**
   * Task ID for API calls
   */
  taskId: string

  /**
   * List of pending gates requiring action
   */
  pendingGates: Gate[]

  /**
   * List of resolved gates (for history display)
   */
  resolvedGates?: Gate[]

  /**
   * Current approver identity
   */
  approver: string

  /**
   * Callback after successful gate action
   */
  onGateAction?: (gate: Gate, action: 'approve' | 'reject') => void

  /**
   * Whether the panel is in read-only mode
   * @default false
   */
  readOnly?: boolean

  /**
   * Whether to show the history section
   * @default true
   */
  showHistory?: boolean

  /**
   * Custom class name
   */
  className?: string
}

/**
 * Props for individual gate item component
 */
export interface GateItemProps {
  gate: Gate
  state: GateItemState
  onApprove: (comment?: string) => void
  onReject: (comment?: string) => void
  onCommentChange: (comment: string) => void
  onToggleComment: () => void
  readOnly: boolean
}

/**
 * Props for the gate history item
 */
export interface GateHistoryItemProps {
  gate: Gate
}

/**
 * Loading state for gate UI feedback
 */
export interface GateLoadingState {
  isSubmitting: boolean
  actionType: 'approve' | 'reject' | null
}

/**
 * Success state for gate action feedback (temporary)
 */
export interface GateSuccessState {
  gateName: string
  action: 'approve' | 'reject'
  timestamp: Date
}

/**
 * Error state for gate action feedback
 */
export interface GateErrorState {
  gateName: string
  error: string
  canRetry: boolean
}

/**
 * Reducer action types for gate panel state
 */
export type GatePanelAction =
  | { type: 'SET_COMMENT'; payload: { gateName: string; comment: string } }
  | { type: 'TOGGLE_COMMENT_INPUT'; payload: string }
  | { type: 'SUBMIT_START'; payload: { gateName: string; actionType: 'approve' | 'reject' } }
  | { type: 'SUBMIT_SUCCESS'; payload: string }
  | { type: 'SUBMIT_ERROR'; payload: { gateName: string; error: string } }
  | { type: 'RESET_GATE'; payload: string }
