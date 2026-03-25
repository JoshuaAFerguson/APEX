/**
 * Agent Terminals Types
 *
 * Type definitions for the useAgentTerminals hook that coordinates
 * WebSocket log streaming for multiple agents (up to 12).
 *
 * @packageDocumentation
 */

import type { AgentLogEntry, LogStreamState, LogStreamStats } from './agent-log-stream'
import type { LogFilter } from './log-viewer'
import type { WebSocketConnectionStatus, WebSocketConnectionHealth } from './websocket-connection'
import { EMPTY_LOG_STREAM_STATE, EMPTY_LOG_STREAM_STATS, DEFAULT_LOG_FILTER } from './agent-log-stream'

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of agents that can be tracked simultaneously
 */
export const MAX_AGENTS = 12

/**
 * Default log buffer size per agent
 */
export const DEFAULT_LOGS_PER_AGENT = 500

/**
 * Stale event threshold - if no events received for this duration,
 * consider the agent's stream stale (in milliseconds)
 */
export const STALE_EVENT_THRESHOLD_MS = 30000 // 30 seconds

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for a single agent terminal
 */
export interface AgentTerminalConfig {
  /** Unique agent identifier */
  agentId: string

  /** Display name for the agent */
  agentName?: string

  /** Maximum logs to buffer (default: DEFAULT_LOGS_PER_AGENT) */
  maxLogs?: number

  /** Initial filter state */
  initialFilter?: Partial<LogFilter>

  /** Whether to auto-start streaming (default: true) */
  autoStart?: boolean
}

// ============================================================================
// State Types
// ============================================================================

/**
 * State for a single agent's terminal
 */
export interface AgentTerminalState {
  /** Agent configuration */
  config: AgentTerminalConfig

  /** Current logs in buffer */
  logs: AgentLogEntry[]

  /** Filtered logs based on current filter */
  filteredLogs: AgentLogEntry[]

  /** Current filter configuration */
  filter: LogFilter

  /** Stream state (idle, streaming, paused, etc.) */
  streamState: LogStreamState

  /** Stream statistics */
  stats: LogStreamStats

  /** Whether this agent's stream is paused */
  isPaused: boolean

  /** Error specific to this agent */
  error: string | null

  /** Registration timestamp */
  registeredAt: Date
}

/**
 * Connection status for an individual agent
 */
export interface AgentConnectionStatus {
  /** Agent identifier */
  agentId: string

  /** WebSocket connection status */
  status: WebSocketConnectionStatus

  /** Whether receiving events for this agent */
  isReceivingEvents: boolean

  /** Last event timestamp for this agent */
  lastEventAt: Date | null

  /** Time since last event (ms) */
  timeSinceLastEvent: number | null

  /** Whether the agent's stream is considered stale */
  isStale: boolean

  /** Number of reconnection attempts (global, shared across agents) */
  reconnectAttempts: number
}

/**
 * Aggregated statistics across all agents
 */
export interface AggregateStats {
  /** Total logs across all agents */
  totalLogs: number

  /** Number of registered agents */
  totalAgents: number

  /** Number of agents actively receiving events */
  activeAgents: number

  /** Total error count across all agents */
  errorCount: number

  /** Total paused agents */
  pausedAgents: number
}

/**
 * Global state for all agent terminals
 */
export interface AgentTerminalsState {
  /** Map of agent ID to terminal state */
  agents: Map<string, AgentTerminalState>

  /** Global WebSocket connection health */
  connectionHealth: WebSocketConnectionHealth

  /** Overall stats aggregated across all agents */
  aggregateStats: AggregateStats
}

// ============================================================================
// Hook Options and Return Types
// ============================================================================

/**
 * Options for useAgentTerminals hook
 */
export interface UseAgentTerminalsOptions {
  /**
   * Initial agent configurations
   * Can also be added dynamically via registerAgent
   */
  agents?: AgentTerminalConfig[]

  /**
   * Whether to auto-connect to WebSocket on mount
   * @default true
   */
  autoConnect?: boolean

  /**
   * Default max logs per agent (can be overridden per-agent)
   * @default DEFAULT_LOGS_PER_AGENT
   */
  defaultMaxLogs?: number

  /**
   * Callback when logs are received for any agent
   */
  onLogs?: (agentId: string, logs: AgentLogEntry[]) => void

  /**
   * Callback when an agent's connection status changes
   */
  onAgentStatusChange?: (agentId: string, status: AgentConnectionStatus) => void

  /**
   * Callback when global connection status changes
   */
  onConnectionChange?: (health: WebSocketConnectionHealth) => void

  /**
   * Callback when any error occurs
   */
  onError?: (agentId: string | null, error: string) => void

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

/**
 * Return type for useAgentTerminals hook
 */
export interface UseAgentTerminalsReturn {
  // === State ===

  /** Full state for all agents */
  state: AgentTerminalsState

  /** Map of agent ID to terminal state (convenience accessor) */
  agents: Map<string, AgentTerminalState>

  /** Global WebSocket connection health */
  connectionHealth: WebSocketConnectionHealth

  /** List of all registered agent IDs */
  agentIds: string[]

  /** Aggregated statistics */
  aggregateStats: AggregateStats

  // === Per-Agent Accessors ===

  /** Get state for a specific agent */
  getAgentState: (agentId: string) => AgentTerminalState | undefined

  /** Get logs for a specific agent */
  getAgentLogs: (agentId: string) => AgentLogEntry[]

  /** Get filtered logs for a specific agent */
  getAgentFilteredLogs: (agentId: string) => AgentLogEntry[]

  /** Get connection status for a specific agent */
  getAgentConnectionStatus: (agentId: string) => AgentConnectionStatus

  // === Registration Methods ===

  /**
   * Register a new agent terminal
   * @throws Error if MAX_AGENTS limit is reached
   */
  registerAgent: (config: AgentTerminalConfig) => void

  /**
   * Unregister an agent terminal and clean up resources
   */
  unregisterAgent: (agentId: string) => void

  /**
   * Check if an agent is registered
   */
  isAgentRegistered: (agentId: string) => boolean

  // === Per-Agent Control Methods ===

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

  /** Add logs programmatically for a specific agent (for testing) */
  addAgentLogs: (agentId: string, logs: AgentLogEntry[]) => void

  // === Bulk Control Methods ===

  /** Pause all agent streams */
  pauseAll: () => void

  /** Resume all agent streams */
  resumeAll: () => void

  /** Clear all agent logs */
  clearAll: () => void

  /** Reconnect the WebSocket connection (affects all agents) */
  reconnect: () => void

  // === Connection Methods ===

  /** Connect to WebSocket (starts receiving events) */
  connect: () => void

  /** Disconnect from WebSocket (stops all streams) */
  disconnect: () => void

  /** Check if WebSocket is connected */
  isConnected: boolean

  /** Check if currently reconnecting */
  isReconnecting: boolean
}

// ============================================================================
// Reducer Action Types
// ============================================================================

/**
 * Action types for the agent terminals reducer
 */
export type AgentTerminalsAction =
  // Agent registration
  | { type: 'REGISTER_AGENT'; config: AgentTerminalConfig }
  | { type: 'UNREGISTER_AGENT'; agentId: string }

  // Log management
  | { type: 'ADD_LOGS'; agentId: string; logs: AgentLogEntry[] }
  | { type: 'CLEAR_LOGS'; agentId: string }
  | { type: 'CLEAR_ALL_LOGS' }

  // Stream control
  | { type: 'PAUSE_AGENT'; agentId: string }
  | { type: 'RESUME_AGENT'; agentId: string }
  | { type: 'PAUSE_ALL' }
  | { type: 'RESUME_ALL' }

  // Filter management
  | { type: 'SET_AGENT_FILTER'; agentId: string; filter: Partial<LogFilter> }
  | { type: 'RESET_AGENT_FILTER'; agentId: string }

  // Connection status
  | { type: 'UPDATE_CONNECTION_HEALTH'; health: WebSocketConnectionHealth }
  | { type: 'UPDATE_AGENT_LAST_EVENT'; agentId: string; timestamp: Date }

  // Error handling
  | { type: 'SET_AGENT_ERROR'; agentId: string; error: string | null }

  // Stats
  | { type: 'UPDATE_AGENT_STATS'; agentId: string; stats: Partial<LogStreamStats> }

// ============================================================================
// Default Values and Factory Functions
// ============================================================================

/**
 * Default connection health state
 */
export const DEFAULT_CONNECTION_HEALTH: WebSocketConnectionHealth = {
  status: 'disconnected',
  isHealthy: false,
  latencyMs: null,
  averageLatencyMs: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  consecutiveFailures: 0,
  lastHealthyAt: null,
  lastCheckAt: null,
  connectionUptime: null,
}

/**
 * Empty aggregate stats
 */
export const EMPTY_AGGREGATE_STATS: AggregateStats = {
  totalLogs: 0,
  totalAgents: 0,
  activeAgents: 0,
  errorCount: 0,
  pausedAgents: 0,
}

/**
 * Empty agent terminals state
 */
export const EMPTY_AGENT_TERMINALS_STATE: AgentTerminalsState = {
  agents: new Map(),
  connectionHealth: DEFAULT_CONNECTION_HEALTH,
  aggregateStats: EMPTY_AGGREGATE_STATS,
}

/**
 * Create an empty agent terminal state
 */
export function createEmptyAgentTerminalState(config: AgentTerminalConfig): AgentTerminalState {
  const filter: LogFilter = config.initialFilter
    ? { ...DEFAULT_LOG_FILTER, ...config.initialFilter }
    : { ...DEFAULT_LOG_FILTER }

  return {
    config,
    logs: [],
    filteredLogs: [],
    filter,
    streamState: { ...EMPTY_LOG_STREAM_STATE },
    stats: { ...EMPTY_LOG_STREAM_STATS },
    isPaused: config.autoStart === false,
    error: null,
    registeredAt: new Date(),
  }
}

/**
 * Calculate aggregate stats from agent states
 */
export function calculateAggregateStats(agents: Map<string, AgentTerminalState>): AggregateStats {
  let totalLogs = 0
  let activeAgents = 0
  let errorCount = 0
  let pausedAgents = 0

  agents.forEach((agentState) => {
    totalLogs += agentState.logs.length
    if (agentState.streamState.isReceiving) {
      activeAgents++
    }
    if (agentState.error) {
      errorCount++
    }
    if (agentState.isPaused) {
      pausedAgents++
    }
  })

  return {
    totalLogs,
    totalAgents: agents.size,
    activeAgents,
    errorCount,
    pausedAgents,
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for AgentTerminalConfig
 */
export function isAgentTerminalConfig(value: unknown): value is AgentTerminalConfig {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.agentId === 'string' && v.agentId.length > 0
}

/**
 * Type guard for AgentTerminalState
 */
export function isAgentTerminalState(value: unknown): value is AgentTerminalState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    isAgentTerminalConfig(v.config) &&
    Array.isArray(v.logs) &&
    typeof v.isPaused === 'boolean'
  )
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that we haven't exceeded the maximum number of agents
 */
export function validateAgentLimit(currentCount: number): void {
  if (currentCount >= MAX_AGENTS) {
    throw new Error(
      `Cannot register more than ${MAX_AGENTS} agents. ` +
      `Please unregister an existing agent first.`
    )
  }
}

/**
 * Validate agent configuration
 */
export function validateAgentConfig(config: AgentTerminalConfig): void {
  if (!config.agentId || typeof config.agentId !== 'string') {
    throw new Error('Agent configuration must include a valid agentId string')
  }

  if (config.maxLogs !== undefined && (typeof config.maxLogs !== 'number' || config.maxLogs < 1)) {
    throw new Error('maxLogs must be a positive number')
  }
}
