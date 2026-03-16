/**
 * ApprovalGatePanel Component Exports
 *
 * Comprehensive approval gate management system with real-time WebSocket updates,
 * filtering, sorting, and diff preview capabilities.
 *
 * @packageDocumentation
 */

// Main component
export { ApprovalGatePanel } from './ApprovalGatePanel'

// Sub-components (for advanced usage)
export { ApprovalGatePanelHeader } from './ApprovalGatePanelHeader'
export { ApprovalGateItem } from './ApprovalGateItem'
export { ApprovalGateHistoryItem } from './ApprovalGateHistoryItem'
export { ApprovalConfirmationDialog } from './ApprovalConfirmationDialog'
export { ApprovalDiffPreview } from './ApprovalDiffPreview'

// Hooks
export { useApprovalGateWebSocket } from './hooks/useApprovalGateWebSocket'
export type {
  UseApprovalGateWebSocketOptions,
  UseApprovalGateWebSocketReturn,
} from './hooks/useApprovalGateWebSocket'

// Re-export types for convenience
export type {
  // Core gate types
  PendingApprovalGate,
  ResolvedApprovalGate,
  ApprovalGate,
  isPendingGate,
  isResolvedGate,

  // Diff data types
  ApprovalDiffData,

  // Confirmation state types
  ConfirmationState,
  ConfirmationAction,
  confirmationReducer,
  INITIAL_CONFIRMATION_STATE,

  // WebSocket event types
  ApprovalGateEventType,
  ApprovalGateWebSocketEventBase,
  GateRequiredEvent,
  GateApprovedEvent,
  GateRejectedEvent,
  GateTimeoutEvent,
  GateSkippedEvent,
  ApprovalResolvedEvent,
  ApprovalGateWebSocketEvent,
  isGateRequiredEvent,
  isGateResolvedEvent,

  // Component props types
  ApprovalGatePanelProps,
  ApprovalGateItemProps,
  ApprovalDiffPreviewProps,
  ConfirmationDialogProps,
  ApprovalGateHistoryItemProps,

  // Hook return types
  UseApprovalGatePanelReturn,

  // Utility types
  ResourceImpactConfig,
  GateTypeConfig,
} from '@/types/approval-gate-panel'

// Re-export constants for convenience
export {
  // Styling constants
  GATE_STATUS_STYLES,
  GATE_STATUS_LABELS,
  GATE_STATUS_ICONS,
  RESOURCE_IMPACT_STYLES,
  RESOURCE_IMPACT_CONFIG,
  GATE_TYPE_CONFIG,
  GATE_TYPE_ICONS,

  // Default values
  APPROVAL_GATE_PANEL_DEFAULTS,
  CONFIRMATION_DIALOG_DEFAULTS,
  DIFF_PREVIEW_DEFAULTS,

  // Action styling
  ACTION_BUTTON_STYLES,

  // Animation constants
  ANIMATION_CONFIG,
  ANIMATION_CLASSES,

  // Layout constants
  LAYOUT_SPACING,
  SIZE_VARIANTS,

  // Accessibility constants
  ARIA_LABELS,
  KEYBOARD_SHORTCUTS,

  // Error and success messages
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,

  // Test IDs
  TEST_IDS,
} from '@/types/approval-gate-panel-constants'