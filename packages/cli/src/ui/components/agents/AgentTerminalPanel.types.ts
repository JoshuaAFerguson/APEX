/**
 * AgentTerminalPanel Types
 *
 * Type definitions for the AgentTerminalPanel component which displays
 * agent execution information with integrated status indicators.
 *
 * @packageDocumentation
 */

import type { AgentStatus } from './AgentStatusIndicator.types.js';
import type { Breakpoint } from '../../hooks/index.js';

// ============================================================================
// Agent Execution Types (local definitions compatible with web-ui types)
// ============================================================================

/**
 * Status of an agent execution
 *
 * @remarks
 * - `idle` - Agent is waiting to be assigned work
 * - `queued` - Agent is queued for execution
 * - `running` - Agent is actively executing
 * - `paused` - Agent execution is temporarily paused
 * - `completed` - Agent has finished successfully
 * - `failed` - Agent execution encountered an error
 * - `cancelled` - Agent execution was cancelled by user
 */
export type AgentExecutionStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Represents a single agent execution instance
 *
 * @remarks
 * This is a minimal interface compatible with the web-ui AgentExecution type,
 * containing only the fields needed for the AgentTerminalPanel component.
 */
export interface AgentExecution {
  /** Unique identifier for this execution instance */
  id: string;

  /** Unique identifier of the agent type/definition */
  agentId: string;

  /** Human-readable name of the agent */
  agentName: string;

  /** Current execution status */
  status: AgentExecutionStatus;

  /** Current stage or phase of execution (e.g., "planning", "implementing") */
  stage?: string;

  /** Progress percentage (0-100) */
  progress: number;

  /** Timestamp when execution started */
  startedAt?: Date;

  /** Timestamp when execution completed */
  completedAt?: Date;

  /** Duration of execution in milliseconds */
  durationMs?: number;

  /** Error message if execution failed */
  error?: string | null;

  /** Number of tokens consumed (input + output) */
  tokensUsed?: number;

  /** Task description being processed */
  taskDescription?: string;

  /** Custom metadata for the execution */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Display mode for the terminal panel
 */
export type TerminalPanelDisplayMode = 'normal' | 'compact' | 'verbose';

/**
 * Border style options for the panel
 */
export type TerminalPanelBorderStyle = 'single' | 'round' | 'double' | 'none';

/**
 * Props for the AgentTerminalPanel component
 */
export interface AgentTerminalPanelProps {
  /**
   * The agent execution data to display
   */
  execution: AgentExecution;

  /**
   * Display mode affecting layout and information density
   * @default 'normal'
   */
  displayMode?: TerminalPanelDisplayMode;

  /**
   * Whether the panel is currently focused/active
   * @default false
   */
  focused?: boolean;

  /**
   * Whether to show animation effects
   * @default true
   */
  animated?: boolean;

  /**
   * Optional explicit width (otherwise uses terminal width)
   */
  width?: number;

  /**
   * Border style for the panel
   * @default 'single'
   */
  borderStyle?: TerminalPanelBorderStyle;

  /**
   * Custom border color (uses theme colors by default)
   */
  borderColor?: string;

  /**
   * Whether to show elapsed time
   * @default true
   */
  showElapsedTime?: boolean;

  /**
   * Whether to show progress bar
   * @default true
   */
  showProgress?: boolean;

  /**
   * Callback when panel header is clicked/selected
   */
  onSelect?: (execution: AgentExecution) => void;

  /**
   * Test ID for testing purposes
   */
  testId?: string;
}

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Maps AgentExecutionStatus to AgentStatus for the indicator component
 *
 * This mapping translates the detailed execution status into the simplified
 * three-state status used by the AgentStatusIndicator:
 * - idle: Agent is not actively working (queued, paused, completed, cancelled)
 * - active: Agent is currently executing tasks (running)
 * - error: Agent has encountered an error (failed)
 */
export const EXECUTION_STATUS_TO_AGENT_STATUS: Record<AgentExecutionStatus, AgentStatus> = {
  idle: 'idle',
  queued: 'idle',
  running: 'active',
  paused: 'idle',
  completed: 'idle',
  failed: 'error',
  cancelled: 'idle',
} as const;

/**
 * Maps AgentExecutionStatus to AgentStatus for the indicator component
 *
 * @param executionStatus - The detailed execution status
 * @returns The simplified agent status for the indicator
 */
export function mapExecutionStatusToAgentStatus(executionStatus: AgentExecutionStatus): AgentStatus {
  return EXECUTION_STATUS_TO_AGENT_STATUS[executionStatus];
}

// ============================================================================
// Responsive Configuration
// ============================================================================

/**
 * Responsive configuration for the terminal panel
 */
export interface ResponsiveTerminalPanelConfig {
  /** Whether to show the panel border */
  showBorder: boolean;

  /** Whether to show the progress bar */
  showProgress: boolean;

  /** Whether to show the stage label */
  showStage: boolean;

  /** Whether to show elapsed time */
  showElapsedTime: boolean;

  /** Maximum length for agent name before truncation */
  maxNameLength: number;

  /** Width of the progress bar in characters */
  progressBarWidth: number;

  /** Whether to show error messages */
  showError: boolean;

  /** Maximum length for error message */
  maxErrorLength: number;
}

/**
 * Responsive configurations by terminal breakpoint
 */
export const RESPONSIVE_TERMINAL_PANEL_CONFIGS: Record<Breakpoint, ResponsiveTerminalPanelConfig> = {
  narrow: {
    showBorder: false,
    showProgress: false,
    showStage: false,
    showElapsedTime: true,
    maxNameLength: 12,
    progressBarWidth: 0,
    showError: true,
    maxErrorLength: 20,
  },
  compact: {
    showBorder: true,
    showProgress: false,
    showStage: true,
    showElapsedTime: true,
    maxNameLength: 16,
    progressBarWidth: 0,
    showError: true,
    maxErrorLength: 40,
  },
  normal: {
    showBorder: true,
    showProgress: true,
    showStage: true,
    showElapsedTime: true,
    maxNameLength: 24,
    progressBarWidth: 30,
    showError: true,
    maxErrorLength: 60,
  },
  wide: {
    showBorder: true,
    showProgress: true,
    showStage: true,
    showElapsedTime: true,
    maxNameLength: 32,
    progressBarWidth: 40,
    showError: true,
    maxErrorLength: 100,
  },
} as const;

/**
 * Get responsive configuration based on breakpoint
 *
 * @param breakpoint - The current terminal breakpoint
 * @returns Configuration for the terminal panel
 */
export function getResponsiveTerminalPanelConfig(breakpoint: Breakpoint): ResponsiveTerminalPanelConfig {
  return RESPONSIVE_TERMINAL_PANEL_CONFIGS[breakpoint];
}

// ============================================================================
// Default Props
// ============================================================================

/**
 * Default props for AgentTerminalPanel
 */
export const DEFAULT_TERMINAL_PANEL_PROPS: Required<
  Pick<
    AgentTerminalPanelProps,
    'displayMode' | 'focused' | 'animated' | 'borderStyle' | 'showElapsedTime' | 'showProgress'
  >
> = {
  displayMode: 'normal',
  focused: false,
  animated: true,
  borderStyle: 'single',
  showElapsedTime: true,
  showProgress: true,
} as const;

// ============================================================================
// Visual State Configuration
// ============================================================================

/**
 * Visual state configuration for each execution status
 */
export interface ExecutionVisualState {
  /** Color for the border when focused */
  focusedBorderColor: string;

  /** Color for the border when not focused */
  unfocusedBorderColor: string;

  /** Whether to show pulsing animation */
  showPulse: boolean;

  /** Text color for the agent name */
  nameColor: string;

  /** Text color for the stage */
  stageColor: string;
}

/**
 * Visual state configurations for each execution status
 * Uses theme color keys that will be resolved at render time
 */
export const EXECUTION_VISUAL_STATES: Record<AgentExecutionStatus, ExecutionVisualState> = {
  idle: {
    focusedBorderColor: 'gray',
    unfocusedBorderColor: 'gray',
    showPulse: false,
    nameColor: 'gray',
    stageColor: 'gray',
  },
  queued: {
    focusedBorderColor: 'cyan',
    unfocusedBorderColor: 'gray',
    showPulse: false,
    nameColor: 'cyan',
    stageColor: 'gray',
  },
  running: {
    focusedBorderColor: 'cyan',
    unfocusedBorderColor: 'cyan',
    showPulse: true,
    nameColor: 'cyan',
    stageColor: 'white',
  },
  paused: {
    focusedBorderColor: 'yellow',
    unfocusedBorderColor: 'gray',
    showPulse: false,
    nameColor: 'yellow',
    stageColor: 'gray',
  },
  completed: {
    focusedBorderColor: 'green',
    unfocusedBorderColor: 'gray',
    showPulse: false,
    nameColor: 'green',
    stageColor: 'gray',
  },
  failed: {
    focusedBorderColor: 'red',
    unfocusedBorderColor: 'red',
    showPulse: false,
    nameColor: 'red',
    stageColor: 'red',
  },
  cancelled: {
    focusedBorderColor: 'gray',
    unfocusedBorderColor: 'gray',
    showPulse: false,
    nameColor: 'gray',
    stageColor: 'gray',
  },
} as const;

/**
 * Get visual state configuration for an execution status
 *
 * @param status - The execution status
 * @returns Visual state configuration
 */
export function getExecutionVisualState(status: AgentExecutionStatus): ExecutionVisualState {
  return EXECUTION_VISUAL_STATES[status];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TerminalPanelDisplayMode
 */
export function isValidDisplayMode(value: unknown): value is TerminalPanelDisplayMode {
  return typeof value === 'string' && ['normal', 'compact', 'verbose'].includes(value);
}

/**
 * Type guard for TerminalPanelBorderStyle
 */
export function isValidBorderStyle(value: unknown): value is TerminalPanelBorderStyle {
  return typeof value === 'string' && ['single', 'round', 'double', 'none'].includes(value);
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Processed execution data ready for rendering
 */
export interface ProcessedExecutionData {
  /** Display name (possibly truncated) */
  displayName: string;

  /** Display stage (possibly truncated) */
  displayStage: string | null;

  /** Formatted elapsed time string */
  elapsedTime: string | null;

  /** Progress percentage (0-100) */
  progress: number;

  /** Error message (possibly truncated) */
  errorMessage: string | null;

  /** Mapped agent status for indicator */
  indicatorStatus: AgentStatus;

  /** Visual state configuration */
  visualState: ExecutionVisualState;
}

/**
 * Process execution data for rendering based on configuration
 *
 * @param execution - The agent execution data
 * @param config - Responsive configuration
 * @returns Processed data ready for rendering
 */
export function processExecutionData(
  execution: AgentExecution,
  config: ResponsiveTerminalPanelConfig
): ProcessedExecutionData {
  const visualState = getExecutionVisualState(execution.status);
  const indicatorStatus = mapExecutionStatusToAgentStatus(execution.status);

  // Truncate agent name if needed
  let displayName = execution.agentName;
  if (displayName.length > config.maxNameLength) {
    displayName = displayName.slice(0, config.maxNameLength - 2) + '..';
  }

  // Process stage
  let displayStage: string | null = null;
  if (config.showStage && execution.stage) {
    displayStage = execution.stage;
  }

  // Process error message
  let errorMessage: string | null = null;
  if (config.showError && execution.error) {
    errorMessage = execution.error;
    if (errorMessage.length > config.maxErrorLength) {
      errorMessage = errorMessage.slice(0, config.maxErrorLength - 3) + '...';
    }
  }

  return {
    displayName,
    displayStage,
    elapsedTime: null, // Calculated by useElapsedTime hook
    progress: execution.progress,
    errorMessage,
    indicatorStatus,
    visualState,
  };
}
