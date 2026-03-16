/**
 * ApprovalGatePanel Constants
 *
 * Styling constants, default values, and configuration for the
 * ApprovalGatePanel component system.
 *
 * @packageDocumentation
 */

import type { GateStatus } from '@apexcli/core'
import type {
  PendingApprovalGate,
  ResourceImpactConfig,
  GateTypeConfig,
} from './approval-gate-panel'
import type { DiffViewMode } from '../components/diff/types'

// ============================================================================
// Gate Status Styling
// ============================================================================

/**
 * Gate status style configuration
 */
export interface GateStatusStyle {
  /** Background color class */
  bg: string
  /** Text color class */
  text: string
  /** Border color class */
  border: string
  /** Icon color class */
  icon: string
  /** Dot/indicator color class */
  dot: string
  /** Glow/shadow effect class */
  glow: string
}

/**
 * Status-specific styling for gate states
 */
export const GATE_STATUS_STYLES: Record<GateStatus, GateStatusStyle> = {
  pending: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-900',
    icon: 'text-yellow-500',
    dot: 'bg-yellow-500',
    glow: 'shadow-yellow-500/20',
  },
  approved: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    border: 'border-green-900',
    icon: 'text-green-500',
    dot: 'bg-green-500',
    glow: 'shadow-green-500/20',
  },
  rejected: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/20',
  },
  skipped: {
    bg: 'bg-gray-950/50',
    text: 'text-gray-400',
    border: 'border-gray-900',
    icon: 'text-gray-500',
    dot: 'bg-gray-500',
    glow: 'shadow-gray-500/20',
  },
  timeout: {
    bg: 'bg-orange-950/50',
    text: 'text-orange-400',
    border: 'border-orange-900',
    icon: 'text-orange-500',
    dot: 'bg-orange-500',
    glow: 'shadow-orange-500/20',
  },
} as const

/**
 * Human-readable labels for gate statuses
 */
export const GATE_STATUS_LABELS: Record<GateStatus, string> = {
  pending: 'Awaiting Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Skipped',
  timeout: 'Timed Out',
}

/**
 * Icons for gate statuses (using Lucide icon names)
 */
export const GATE_STATUS_ICONS: Record<GateStatus, string> = {
  pending: 'AlertTriangle',
  approved: 'CheckCircle',
  rejected: 'XCircle',
  skipped: 'MinusCircle',
  timeout: 'Clock',
}

// ============================================================================
// Resource Impact Configuration
// ============================================================================

/**
 * Resource impact level styling
 */
export const RESOURCE_IMPACT_STYLES: Record<
  PendingApprovalGate['resourceImpact'] & string,
  GateStatusStyle
> = {
  low: {
    bg: 'bg-blue-950/50',
    text: 'text-blue-400',
    border: 'border-blue-900',
    icon: 'text-blue-500',
    dot: 'bg-blue-500',
    glow: 'shadow-blue-500/20',
  },
  medium: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-900',
    icon: 'text-yellow-500',
    dot: 'bg-yellow-500',
    glow: 'shadow-yellow-500/20',
  },
  high: {
    bg: 'bg-orange-950/50',
    text: 'text-orange-400',
    border: 'border-orange-900',
    icon: 'text-orange-500',
    dot: 'bg-orange-500',
    glow: 'shadow-orange-500/20',
  },
  critical: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/20',
  },
}

/**
 * Resource impact configurations
 */
export const RESOURCE_IMPACT_CONFIG: Record<
  NonNullable<PendingApprovalGate['resourceImpact']>,
  ResourceImpactConfig
> = {
  low: {
    level: 'low',
    label: 'Low Impact',
    description: 'Minimal resource changes, safe to proceed',
    color: 'blue',
    icon: 'Info',
  },
  medium: {
    level: 'medium',
    label: 'Medium Impact',
    description: 'Moderate changes, review recommended',
    color: 'yellow',
    icon: 'AlertCircle',
  },
  high: {
    level: 'high',
    label: 'High Impact',
    description: 'Significant changes, careful review required',
    color: 'orange',
    icon: 'AlertTriangle',
  },
  critical: {
    level: 'critical',
    label: 'Critical Impact',
    description: 'Major system changes, thorough review essential',
    color: 'red',
    icon: 'ShieldAlert',
  },
}

// ============================================================================
// Gate Type Configuration
// ============================================================================

/**
 * Gate type configurations
 */
export const GATE_TYPE_CONFIG: Record<
  NonNullable<PendingApprovalGate['gateType']>,
  GateTypeConfig
> = {
  'pre-execution': {
    type: 'pre-execution',
    label: 'Pre-Execution Gate',
    description: 'Approval required before task execution begins',
    icon: 'PlayCircle',
  },
  'post-execution': {
    type: 'post-execution',
    label: 'Post-Execution Gate',
    description: 'Approval required to confirm execution results',
    icon: 'CheckSquare',
  },
  'resource-access': {
    type: 'resource-access',
    label: 'Resource Access Gate',
    description: 'Approval required for resource modification',
    icon: 'Database',
  },
  'dangerous-operation': {
    type: 'dangerous-operation',
    label: 'Dangerous Operation Gate',
    description: 'Approval required for potentially destructive action',
    icon: 'AlertOctagon',
  },
}

/**
 * Gate type icons (using Lucide icon names)
 */
export const GATE_TYPE_ICONS: Record<NonNullable<PendingApprovalGate['gateType']>, string> = {
  'pre-execution': 'PlayCircle',
  'post-execution': 'CheckSquare',
  'resource-access': 'Database',
  'dangerous-operation': 'AlertOctagon',
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default configuration for ApprovalGatePanel
 */
export const APPROVAL_GATE_PANEL_DEFAULTS = {
  /** Maximum number of history items to display */
  maxHistoryItems: 10,

  /** Default view mode for diff previews */
  diffViewMode: 'unified' as DiffViewMode,

  /** Whether to require confirmation for actions by default */
  requireConfirmation: true,

  /** Whether to show history section by default */
  showHistory: true,

  /** Whether to show diff preview by default */
  showDiffPreview: true,

  /** Default max height for diff preview (px) */
  diffPreviewMaxHeight: 400,

  /** Whether to show line numbers in diff by default */
  showLineNumbers: true,

  /** Whether to enable syntax highlighting by default */
  enableHighlighting: true,

  /** Animation duration for transitions (ms) */
  animationDuration: 200,

  /** Debounce delay for comment input (ms) */
  commentDebounceMs: 300,

  /** Maximum comment length */
  maxCommentLength: 500,

  /** Minimum comment length for rejection */
  minRejectCommentLength: 10,

  /** Auto-refresh interval for pending gates (ms) */
  autoRefreshInterval: 30000,

  /** Timeout warning threshold (show warning when X ms remain) */
  timeoutWarningThreshold: 60000,
} as const

/**
 * Default confirmation dialog configuration
 */
export const CONFIRMATION_DIALOG_DEFAULTS = {
  /** Whether comment is required for rejection */
  requireCommentForReject: true,

  /** Placeholder text for approve comment */
  approvePlaceholder: 'Add a comment (optional)...',

  /** Placeholder text for reject comment */
  rejectPlaceholder: 'Please provide a reason for rejection...',

  /** Maximum comment length */
  maxCommentLength: 500,

  /** Approve button text */
  approveButtonText: 'Approve',

  /** Reject button text */
  rejectButtonText: 'Reject',

  /** Cancel button text */
  cancelButtonText: 'Cancel',
} as const

/**
 * Default diff preview configuration
 */
export const DIFF_PREVIEW_DEFAULTS = {
  /** Default view mode */
  viewMode: 'unified' as DiffViewMode,

  /** Default max height */
  maxHeight: 400,

  /** Show line numbers */
  showLineNumbers: true,

  /** Enable syntax highlighting */
  highlighting: true,

  /** Collapsible by default */
  collapsible: true,

  /** Initially collapsed */
  defaultCollapsed: false,
} as const

// ============================================================================
// Action Styling
// ============================================================================

/**
 * Action button styling
 */
export const ACTION_BUTTON_STYLES = {
  approve: {
    variant: 'primary' as const,
    bg: 'bg-green-600 hover:bg-green-700',
    text: 'text-white',
    border: 'border-green-500',
    icon: 'ShieldCheck',
    loadingText: 'Approving...',
  },
  reject: {
    variant: 'danger' as const,
    bg: 'bg-red-600 hover:bg-red-700',
    text: 'text-white',
    border: 'border-red-500',
    icon: 'ShieldX',
    loadingText: 'Rejecting...',
  },
} as const

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Animation configuration
 */
export const ANIMATION_CONFIG = {
  /** Duration for expand/collapse animations */
  expandDuration: 200,

  /** Duration for fade animations */
  fadeDuration: 150,

  /** Duration for slide animations */
  slideDuration: 200,

  /** Pulse animation for pending gates */
  pulseDuration: 2000,

  /** Easing function for smooth animations */
  easing: 'ease-in-out',
} as const

/**
 * CSS animation classes
 */
export const ANIMATION_CLASSES = {
  /** Pulse animation for pending indicator */
  pulse: 'animate-pulse',

  /** Fade in animation */
  fadeIn: 'animate-fade-in',

  /** Fade out animation */
  fadeOut: 'animate-fade-out',

  /** Slide down animation */
  slideDown: 'animate-slide-down',

  /** Slide up animation */
  slideUp: 'animate-slide-up',

  /** Spin animation for loading */
  spin: 'animate-spin',
} as const

// ============================================================================
// Layout Constants
// ============================================================================

/**
 * Layout spacing constants
 */
export const LAYOUT_SPACING = {
  /** Panel padding */
  panelPadding: 'p-4',

  /** Item padding */
  itemPadding: 'p-3',

  /** Gap between items */
  itemGap: 'gap-3',

  /** Compact panel padding */
  compactPanelPadding: 'p-3',

  /** Compact item padding */
  compactItemPadding: 'p-2',

  /** Compact gap between items */
  compactItemGap: 'gap-2',
} as const

/**
 * Size variants for components
 */
export const SIZE_VARIANTS = {
  sm: {
    text: 'text-xs',
    icon: 'w-3.5 h-3.5',
    padding: 'px-2 py-1',
    gap: 'gap-1.5',
  },
  md: {
    text: 'text-sm',
    icon: 'w-4 h-4',
    padding: 'px-3 py-1.5',
    gap: 'gap-2',
  },
  lg: {
    text: 'text-base',
    icon: 'w-5 h-5',
    padding: 'px-4 py-2',
    gap: 'gap-3',
  },
} as const

// ============================================================================
// Accessibility Constants
// ============================================================================

/**
 * ARIA labels for accessibility
 */
export const ARIA_LABELS = {
  /** Panel label */
  panel: 'Approval Gates Panel',

  /** Pending gates section */
  pendingSection: 'Pending Approval Gates',

  /** History section */
  historySection: 'Resolved Gates History',

  /** Approve button */
  approveButton: 'Approve this gate',

  /** Reject button */
  rejectButton: 'Reject this gate',

  /** Expand button */
  expandButton: 'Expand gate details',

  /** Collapse button */
  collapseButton: 'Collapse gate details',

  /** View diff button */
  viewDiffButton: 'View code changes',

  /** Comment input */
  commentInput: 'Add a comment for this action',

  /** Confirmation dialog */
  confirmationDialog: 'Confirm gate action',

  /** Close dialog button */
  closeDialogButton: 'Close dialog',
} as const

/**
 * Keyboard shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
  /** Submit action */
  submit: 'Enter',

  /** Cancel/close */
  cancel: 'Escape',

  /** Toggle expand */
  toggleExpand: 'Space',

  /** Focus next item */
  nextItem: 'ArrowDown',

  /** Focus previous item */
  prevItem: 'ArrowUp',
} as const

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Error message templates
 */
export const ERROR_MESSAGES = {
  /** Generic action failure */
  actionFailed: 'Failed to {action} gate: {error}',

  /** Network error */
  networkError: 'Network error. Please check your connection and try again.',

  /** Timeout error */
  timeoutError: 'Request timed out. Please try again.',

  /** Authorization error */
  authError: 'You are not authorized to perform this action.',

  /** Gate not found */
  gateNotFound: 'Gate not found. It may have been resolved already.',

  /** Comment required */
  commentRequired: 'A comment is required for this action.',

  /** Comment too short */
  commentTooShort: 'Comment must be at least {minLength} characters.',

  /** Comment too long */
  commentTooLong: 'Comment must not exceed {maxLength} characters.',

  /** WebSocket connection error */
  wsConnectionError: 'Unable to connect to real-time updates.',

  /** WebSocket reconnecting */
  wsReconnecting: 'Connection lost. Reconnecting...',
} as const

/**
 * Success message templates
 */
export const SUCCESS_MESSAGES = {
  /** Gate approved */
  approved: 'Gate "{gateName}" has been approved.',

  /** Gate rejected */
  rejected: 'Gate "{gateName}" has been rejected.',

  /** Connection restored */
  connectionRestored: 'Real-time connection restored.',
} as const

// ============================================================================
// Test IDs
// ============================================================================

/**
 * Test IDs for component testing
 */
export const TEST_IDS = {
  /** Main panel */
  panel: 'approval-gate-panel',

  /** Pending gates list */
  pendingList: 'pending-gates-list',

  /** History list */
  historyList: 'resolved-gates-list',

  /** Gate item */
  gateItem: 'gate-item',

  /** Approve button */
  approveButton: 'approve-button',

  /** Reject button */
  rejectButton: 'reject-button',

  /** Comment input */
  commentInput: 'comment-input',

  /** Confirmation dialog */
  confirmationDialog: 'confirmation-dialog',

  /** Confirm button */
  confirmButton: 'confirm-button',

  /** Cancel button */
  cancelButton: 'cancel-button',

  /** Diff preview */
  diffPreview: 'diff-preview',

  /** Loading indicator */
  loadingIndicator: 'loading-indicator',

  /** Error message */
  errorMessage: 'error-message',

  /** Connection indicator */
  connectionIndicator: 'connection-indicator',
} as const
