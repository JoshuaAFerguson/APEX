/**
 * Agent Metrics Types
 *
 * Type definitions for the useAgentMetrics hook which provides real-time
 * aggregated agent performance data via WebSocket subscriptions.
 *
 * @packageDocumentation
 */

import type { AgentUtilization } from './agent-utilization'
import type { WebSocketConnectionStatus } from './websocket-connection'

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Extended agent data with real-time status information
 */
export interface AgentMetricsAgent extends AgentUtilization {
  /** Current agent status */
  status: AgentStatus

  /** Last activity timestamp */
  lastActivityAt: Date | null

  /** Whether the agent is currently active (processing) */
  isActive: boolean
}

/**
 * Agent operational status
 */
export type AgentStatus = 'idle' | 'processing' | 'error' | 'offline'

/**
 * Aggregated agent metrics data returned by the hook
 */
export interface AgentMetrics {
  /** Array of individual agent metrics with real-time status */
  agents: AgentMetricsAgent[]

  /** Total tokens consumed across all agents */
  totalTokens: number

  /** Total cost accumulated across all agents (USD) */
  totalCost: number

  /** WebSocket connection status for the metrics feed */
  connectionStatus: WebSocketConnectionStatus

  /** Timestamp of the last data update */
  lastUpdated: Date

  /** Time range for the current metrics window (optional) */
  timeRange?: {
    start: Date
    end: Date
  }
}

// ============================================================================
// Hook Return Type
// ============================================================================

/**
 * Return type for the useAgentMetrics hook
 */
export interface UseAgentMetricsReturn {
  /** Aggregated agent metrics data */
  metrics: AgentMetrics

  /** Current connection status to the WebSocket */
  connectionStatus: WebSocketConnectionStatus

  /** Whether initial data is still loading */
  isLoading: boolean

  /** Error message if metrics fetching failed */
  error: string | null

  /** Function to manually refresh metrics data */
  refresh: () => void
}

// ============================================================================
// Hook Options
// ============================================================================

/**
 * Configuration options for the useAgentMetrics hook
 */
export interface UseAgentMetricsOptions {
  /**
   * Whether to automatically connect on mount
   * @default true
   */
  autoConnect?: boolean

  /**
   * Polling interval in milliseconds for refresh (0 = disabled)
   * @default 0
   */
  pollingIntervalMs?: number

  /**
   * Filter metrics to specific agent IDs
   */
  agentIds?: string[]

  /**
   * Time range filter for metrics
   */
  timeRange?: {
    start: Date
    end: Date
  }

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

/**
 * WebSocket event types the hook subscribes to
 */
export type AgentMetricsEventType =
  | 'agent:started'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:progress'
  | 'agent:idle'
  | 'usage:updated'

/**
 * Agent event payload from WebSocket
 */
export interface AgentEvent {
  type: AgentMetricsEventType
  timestamp: Date
  agentId: string
  agentName?: string
  data: AgentEventData
}

/**
 * Agent event data payload
 */
export interface AgentEventData {
  /** Token usage for this event */
  tokens?: {
    input: number
    output: number
    total: number
  }

  /** Cost for this event (USD) */
  cost?: number

  /** Duration in milliseconds */
  durationMs?: number

  /** Error details if failed */
  error?: string

  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Usage update event payload from WebSocket
 */
export interface UsageUpdateEvent {
  type: 'usage:updated'
  timestamp: Date
  data: {
    /** Agent ID for this update */
    agentId: string

    /** Updated token counts */
    tokens: {
      input: number
      output: number
      total: number
      cache?: number
    }

    /** Updated cost */
    cost: number

    /** Performance metrics */
    performance?: {
      tokensPerSecond: number
      avgLatencyMs: number
    }
  }
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default options for useAgentMetrics hook
 */
export const DEFAULT_AGENT_METRICS_OPTIONS: Required<
  Pick<UseAgentMetricsOptions, 'autoConnect' | 'pollingIntervalMs' | 'debug'>
> = {
  autoConnect: true,
  pollingIntervalMs: 0,
  debug: false,
}

/**
 * Empty agent metrics data for initial state
 */
export const EMPTY_AGENT_METRICS: AgentMetrics = {
  agents: [],
  totalTokens: 0,
  totalCost: 0,
  connectionStatus: 'disconnected',
  lastUpdated: new Date(),
}

/**
 * WebSocket event types to subscribe to
 */
export const AGENT_METRICS_EVENTS: AgentMetricsEventType[] = [
  'agent:started',
  'agent:completed',
  'agent:failed',
  'agent:progress',
  'agent:idle',
  'usage:updated',
]

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Agent metrics summary for dashboard display
 */
export interface AgentMetricsSummary {
  /** Total number of agents */
  agentCount: number

  /** Number of currently active agents */
  activeAgentCount: number

  /** Total tokens consumed */
  totalTokens: number

  /** Total cost (USD) */
  totalCost: number

  /** Average throughput (tokens/second) */
  avgThroughput: number

  /** Connection health indicator */
  isConnected: boolean
}

/**
 * Create a summary from full metrics
 */
export function createAgentMetricsSummary(metrics: AgentMetrics): AgentMetricsSummary {
  const activeAgentCount = metrics.agents.filter((agent) => agent.isActive).length
  const avgThroughput =
    metrics.agents.length > 0
      ? metrics.agents.reduce((sum, agent) => sum + agent.tokensPerSecond, 0) /
        metrics.agents.length
      : 0

  return {
    agentCount: metrics.agents.length,
    activeAgentCount,
    totalTokens: metrics.totalTokens,
    totalCost: metrics.totalCost,
    avgThroughput,
    isConnected: metrics.connectionStatus === 'connected',
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty agent metrics agent record
 */
export function createEmptyAgentMetricsAgent(
  agentId: string,
  agentName: string
): AgentMetricsAgent {
  return {
    agentId,
    agentName,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    tokensPerSecond: 0,
    duration: 0,
    invocations: 0,
    status: 'idle',
    lastActivityAt: null,
    isActive: false,
  }
}

/**
 * Map agent status from event type
 */
export function mapEventTypeToStatus(eventType: AgentMetricsEventType): AgentStatus {
  switch (eventType) {
    case 'agent:started':
    case 'agent:progress':
      return 'processing'
    case 'agent:completed':
    case 'agent:idle':
      return 'idle'
    case 'agent:failed':
      return 'error'
    default:
      return 'idle'
  }
}

/**
 * Calculate aggregated totals from agent list
 */
export function calculateAgentMetricsTotals(
  agents: AgentMetricsAgent[]
): Pick<AgentMetrics, 'totalTokens' | 'totalCost'> {
  return {
    totalTokens: agents.reduce((sum, agent) => sum + agent.totalTokens, 0),
    totalCost: agents.reduce((sum, agent) => sum + agent.estimatedCost, 0),
  }
}
