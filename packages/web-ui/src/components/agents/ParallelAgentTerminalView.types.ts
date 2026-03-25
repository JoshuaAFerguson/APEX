/**
 * ParallelAgentTerminalView Types
 *
 * Type definitions for the ParallelAgentTerminalView component that provides
 * responsive grid layout for 1-12 AgentTerminalPanel components.
 *
 * @packageDocumentation
 */

import type { AgentTerminalPanelProps } from '@/types/agent-log-stream'
import type { AgentStatus } from '@/types/agent-metrics'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for a single agent execution to display
 */
export interface AgentTerminalPanelConfig {
  /** Unique identifier for the panel */
  panelId: string

  /** Agent ID being monitored */
  agentId: string

  /** Display title for the panel */
  title?: string

  /** Current agent status */
  agentStatus?: AgentStatus

  /** Initial panel state */
  initialState?: PanelDisplayState

  /** Whether to auto-connect to log stream */
  autoConnect?: boolean

  /** Additional props to pass to AgentTerminalPanel */
  panelProps?: Partial<AgentTerminalPanelProps>
}

/**
 * Gap size options for grid layout
 */
export type GridGap = 'sm' | 'md' | 'lg'

/**
 * Display mode options for panels
 */
export type PanelDisplayMode = 'normal' | 'compact' | 'verbose'

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for ParallelAgentTerminalView component
 */
export interface ParallelAgentTerminalViewProps {
  /**
   * Array of panel configurations (1-12 panels)
   * @minItems 1
   * @maxItems 12
   */
  panels: AgentTerminalPanelConfig[]

  /**
   * Gap size between panels
   * @default 'md'
   */
  gap?: GridGap

  /**
   * Maximum height for the container
   * Enables vertical scrolling when content exceeds
   * @default 'auto'
   */
  maxHeight?: string | 'auto' | 'none'

  /**
   * Controlled panel states (optional)
   * When provided, component operates in controlled mode
   */
  panelStates?: Record<string, PanelDisplayState>

  /**
   * Callback when any panel state changes
   */
  onPanelStateChange?: (
    panelId: string,
    newState: PanelDisplayState,
    allStates: Record<string, PanelDisplayState>
  ) => void

  /**
   * Callback when a panel is closed
   */
  onPanelClose?: (panelId: string) => void

  /**
   * CSS class name for the container
   */
  className?: string

  /**
   * Test ID for testing
   */
  testId?: string

  /**
   * Display mode applied to all panels
   * @default 'normal'
   */
  displayMode?: PanelDisplayMode

  /**
   * Whether to show loading skeleton during initial connection
   * @default false
   */
  showLoadingSkeleton?: boolean
}

// ============================================================================
// Component Ref
// ============================================================================

/**
 * Imperative handle interface for ParallelAgentTerminalView
 */
export interface ParallelAgentTerminalViewRef {
  /** Minimize all panels */
  minimizeAll: () => void

  /** Restore all panels to normal state */
  restoreAll: () => void

  /** Get current state of all panels */
  getAllStates: () => Record<string, PanelDisplayState>

  /** Maximize a specific panel */
  maximizePanel: (panelId: string) => void

  /** Focus a specific panel */
  focusPanel: (panelId: string) => void
}

// ============================================================================
// Grid Configuration Types
// ============================================================================

/**
 * Grid configuration object for responsive layouts
 */
export interface GridConfig {
  /** CSS class string for the grid layout */
  className: string
  /** Maximum recommended panels for this configuration */
  maxPanels: number
  /** Description of the layout */
  description: string
}

/**
 * Extended grid configurations supporting 1-12 panels
 */
export type ExtendedGridConfigs = Record<number, string>

/**
 * Gap configuration mapping
 */
export type GapConfigs = Record<GridGap, string>

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation result for panel configurations
 */
export interface PanelConfigValidation {
  /** Whether the configuration is valid */
  isValid: boolean
  /** List of validation errors */
  errors: string[]
  /** List of validation warnings */
  warnings: string[]
  /** Validated and sanitized panel configurations */
  validatedPanels: AgentTerminalPanelConfig[]
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Panel state change event data
 */
export interface PanelStateChangeEvent {
  /** ID of the panel that changed */
  panelId: string
  /** Previous state */
  previousState: PanelDisplayState
  /** New state */
  newState: PanelDisplayState
  /** All current panel states */
  allStates: Record<string, PanelDisplayState>
  /** Timestamp of the change */
  timestamp: Date
}

/**
 * Panel close event data
 */
export interface PanelCloseEvent {
  /** ID of the panel being closed */
  panelId: string
  /** State of the panel when closed */
  finalState: PanelDisplayState
  /** Timestamp of the close */
  timestamp: Date
}