/**
 * ConnectedParallelAgentTerminalView Types
 *
 * Type definitions for the ConnectedParallelAgentTerminalView component that
 * integrates ParallelAgentTerminalView with useAgentTerminals hook.
 *
 * @packageDocumentation
 */

import type { AgentTerminalPanelConfig, GridGap, PanelDisplayMode } from './ParallelAgentTerminalView.types'
import type { AgentTerminalConfig, AggregateStats } from '@/types/agent-terminals'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'
import type { AgentLogEntry, LogFilter } from '@/types/agent-log-stream'
import type { WebSocketConnectionHealth } from '@/types/websocket-connection'

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Agent configuration for ConnectedParallelAgentTerminalView
 * Extends AgentTerminalPanelConfig with streaming options
 */
export interface ConnectedAgentConfig extends Omit<AgentTerminalPanelConfig, 'autoConnect'> {
  /**
   * Maximum logs to buffer for this agent
   * @default from useAgentTerminals defaultMaxLogs
   */
  maxLogs?: number

  /**
   * Initial log filter for this agent
   */
  initialFilter?: Partial<LogFilter>

  /**
   * Whether to auto-start streaming for this agent
   * @default true
   */
  autoStart?: boolean
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for ConnectedParallelAgentTerminalView
 */
export interface ConnectedParallelAgentTerminalViewProps {
  /**
   * Array of agent configurations (1-12 agents)
   * Agents will be automatically registered/unregistered
   */
  agents: ConnectedAgentConfig[]

  /**
   * Gap size between panels
   * @default 'md'
   */
  gap?: GridGap

  /**
   * Maximum height for the container
   * @default 'auto'
   */
  maxHeight?: string | 'auto' | 'none'

  /**
   * Controlled panel states (optional)
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
   * Note: This also unregisters the agent from streaming
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

  // === Streaming Options ===

  /**
   * Whether to auto-connect to WebSocket on mount
   * @default true
   */
  autoConnect?: boolean

  /**
   * Default max logs per agent
   * @default 500
   */
  defaultMaxLogs?: number

  /**
   * Callback when logs are received for any agent
   */
  onLogs?: (agentId: string, logs: AgentLogEntry[]) => void

  /**
   * Callback when any error occurs
   */
  onError?: (agentId: string | null, error: string) => void

  /**
   * Callback when connection status changes
   */
  onConnectionChange?: (health: WebSocketConnectionHealth) => void

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

// ============================================================================
// Component Ref
// ============================================================================

/**
 * Imperative handle interface for ConnectedParallelAgentTerminalView
 */
export interface ConnectedParallelAgentTerminalViewRef {
  // === Panel View Controls (from ParallelAgentTerminalViewRef) ===

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

  // === Per-Agent Stream Controls (from useAgentTerminals) ===

  /** Pause log streaming for a specific agent */
  pauseAgent: (agentId: string) => void

  /** Resume log streaming for a specific agent */
  resumeAgent: (agentId: string) => void

  /** Clear logs for a specific agent */
  clearAgentLogs: (agentId: string) => void

  /** Set filter for a specific agent */
  setAgentFilter: (agentId: string, filter: Partial<LogFilter>) => void

  /** Reset filter for a specific agent */
  resetAgentFilter: (agentId: string) => void

  /** Export logs for a specific agent */
  exportAgentLogs: (agentId: string, format: 'json' | 'text' | 'csv') => string

  /** Get logs for a specific agent */
  getAgentLogs: (agentId: string) => AgentLogEntry[]

  /** Get filtered logs for a specific agent */
  getAgentFilteredLogs: (agentId: string) => AgentLogEntry[]

  // === Bulk Stream Controls ===

  /** Pause all agent streams */
  pauseAll: () => void

  /** Resume all agent streams */
  resumeAll: () => void

  /** Clear all agent logs */
  clearAll: () => void

  /** Reconnect WebSocket connection */
  reconnect: () => void

  // === Agent Registration ===

  /** Register a new agent */
  registerAgent: (config: AgentTerminalConfig) => void

  /** Unregister an agent */
  unregisterAgent: (agentId: string) => void

  /** Check if agent is registered */
  isAgentRegistered: (agentId: string) => boolean

  // === Status ===

  /** Get aggregate stats across all agents */
  getAggregateStats: () => AggregateStats

  /** Check if WebSocket is connected */
  isConnected: boolean

  /** Check if currently reconnecting */
  isReconnecting: boolean
}