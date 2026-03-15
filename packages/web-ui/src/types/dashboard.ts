/**
 * Dashboard Types for Real-time Updates
 *
 * Types for health metrics, activity events, and performance data
 * used by the dashboard components for real-time WebSocket updates.
 *
 * @packageDocumentation
 */

import type { TaskStatus, ApexEvent } from '@apexcli/core'

/**
 * Local ApexEvent type compatible with websocket-client
 * This mirrors the ApexEvent from @apexcli/core but without strict type checking
 * to allow for WebSocket event serialization/deserialization
 */
export interface WebSocketApexEvent {
  type: string
  taskId?: string
  timestamp: Date
  data: Record<string, unknown>
}

/**
 * ApexEventType - all possible event types for the dashboard
 * This is a string literal union for type safety in event handlers
 */
export type DashboardEventType =
  | 'task:created'
  | 'task:started'
  | 'task:stage-changed'
  | 'task:completed'
  | 'task:failed'
  | 'task:paused'
  | 'task:session-resumed'
  | 'agent:message'
  | 'agent:thinking'
  | 'agent:tool-use'
  | 'agent:tool-result'
  | 'tool:start'
  | 'tool:progress'
  | 'tool:complete'
  | 'gate:required'
  | 'gate:approved'
  | 'gate:rejected'
  | 'approval-required'
  | 'approval-resolved'
  | 'permission:request'
  | 'permission:granted'
  | 'permission:denied'
  | 'dangerous:detected'
  | 'dangerous:confirmed'
  | 'dangerous:blocked'
  | 'policy:blocked'
  | 'policy:warned'
  | 'usage:updated'
  | 'mcp:connected'
  | 'mcp:disconnected'
  | 'mcp:error'
  | string // Allow other event types

// ============================================================================
// Health Metrics Types
// ============================================================================

/**
 * Connection health status enumeration
 */
export type ConnectionHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

/**
 * Dashboard-specific health metrics snapshot
 * Extended from core HealthMetricsSnapshot for UI display
 */
export interface DashboardHealthMetrics {
  /** Current overall health status */
  status: ConnectionHealthStatus

  /** WebSocket connection state */
  connection: {
    /** Whether connected to the server */
    isConnected: boolean
    /** Time since last successful connection */
    connectedSince?: Date
    /** Number of reconnection attempts */
    reconnectAttempts: number
    /** Current latency in milliseconds */
    latencyMs: number
    /** Average latency over the session */
    averageLatencyMs: number
  }

  /** Server health information */
  server: {
    /** Server uptime in milliseconds */
    uptimeMs: number
    /** Server version */
    version?: string
    /** Last health check timestamp */
    lastHealthCheck?: Date
    /** Health check success rate (0-100) */
    successRate: number
  }

  /** Task processing health */
  tasks: {
    /** Number of active tasks */
    activeTasks: number
    /** Number of pending tasks */
    pendingTasks: number
    /** Number of tasks completed in the last hour */
    completedLastHour: number
    /** Number of tasks failed in the last hour */
    failedLastHour: number
    /** Average task duration in milliseconds */
    averageDurationMs: number
  }

  /** Timestamp when metrics were last updated */
  lastUpdated: Date
}

/**
 * Health metric threshold configuration
 */
export interface HealthThresholds {
  /** Latency threshold for degraded status (ms) */
  latencyDegraded: number
  /** Latency threshold for unhealthy status (ms) */
  latencyUnhealthy: number
  /** Success rate threshold for degraded status (%) */
  successRateDegraded: number
  /** Success rate threshold for unhealthy status (%) */
  successRateUnhealthy: number
}

/**
 * Default health thresholds
 */
export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  latencyDegraded: 500,
  latencyUnhealthy: 2000,
  successRateDegraded: 95,
  successRateUnhealthy: 80,
}

// ============================================================================
// Activity Event Types
// ============================================================================

/**
 * Activity event category for filtering and display
 */
export type ActivityEventCategory =
  | 'task'       // Task lifecycle events
  | 'agent'      // Agent execution events
  | 'tool'       // Tool usage events
  | 'gate'       // Approval gate events
  | 'permission' // Permission events
  | 'system'     // System events (connection, health)
  | 'error'      // Error events

/**
 * Activity event severity level
 */
export type ActivityEventSeverity = 'info' | 'success' | 'warning' | 'error'

/**
 * Dashboard activity event - enriched version of ApexEvent for UI display
 */
export interface DashboardActivityEvent {
  /** Unique event ID */
  id: string

  /** Original event type from WebSocket event */
  type: DashboardEventType

  /** Event category for filtering */
  category: ActivityEventCategory

  /** Event severity for styling */
  severity: ActivityEventSeverity

  /** Associated task ID */
  taskId: string

  /** Human-readable title */
  title: string

  /** Optional detailed description */
  description?: string

  /** Event timestamp */
  timestamp: Date

  /** Additional event data */
  data: Record<string, unknown>

  /** Whether this event has been read/acknowledged */
  isRead: boolean

  /** Related agent name if applicable */
  agentName?: string

  /** Related tool name if applicable */
  toolName?: string
}

/**
 * Map event type string to ActivityEventCategory
 */
export function getEventCategory(eventType: DashboardEventType): ActivityEventCategory {
  if (eventType.startsWith('task:')) return 'task'
  if (eventType.startsWith('agent:')) return 'agent'
  if (eventType.startsWith('tool:')) return 'tool'
  if (eventType.startsWith('gate:') || eventType.startsWith('approval')) return 'gate'
  if (eventType.startsWith('permission:') || eventType.startsWith('dangerous:') || eventType.startsWith('policy:')) return 'permission'
  if (eventType.includes('error') || eventType.includes('failed')) return 'error'
  return 'system'
}

/**
 * Map event type string to ActivityEventSeverity
 */
export function getEventSeverity(eventType: DashboardEventType): ActivityEventSeverity {
  if (eventType.includes('failed') || eventType.includes('error') || eventType.includes('blocked') || eventType.includes('denied')) {
    return 'error'
  }
  if (eventType.includes('warning') || eventType.includes('dangerous')) {
    return 'warning'
  }
  if (eventType.includes('completed') || eventType.includes('success') || eventType.includes('granted') || eventType.includes('approved')) {
    return 'success'
  }
  return 'info'
}

/**
 * Activity feed filter configuration
 */
export interface ActivityFeedFilters {
  /** Categories to include (empty = all) */
  categories: ActivityEventCategory[]
  /** Severities to include (empty = all) */
  severities: ActivityEventSeverity[]
  /** Task IDs to filter by (empty = all) */
  taskIds: string[]
  /** Whether to show only unread events */
  unreadOnly: boolean
  /** Maximum number of events to display */
  limit: number
}

/**
 * Default activity feed filters
 */
export const DEFAULT_ACTIVITY_FILTERS: ActivityFeedFilters = {
  categories: [],
  severities: [],
  taskIds: [],
  unreadOnly: false,
  limit: 100,
}

// ============================================================================
// Performance Data Types
// ============================================================================

/**
 * Time range for performance metrics
 */
export type PerformanceTimeRange = '1h' | '6h' | '24h' | '7d' | '30d'

/**
 * Performance metric type
 */
export type PerformanceMetricType =
  | 'tokenUsage'
  | 'taskDuration'
  | 'toolLatency'
  | 'agentResponseTime'
  | 'errorRate'
  | 'throughput'

/**
 * Single performance data point for time-series charts
 */
export interface PerformanceDataPoint {
  /** Timestamp for the data point */
  timestamp: Date
  /** Metric value */
  value: number
  /** Optional label for the data point */
  label?: string
}

/**
 * Performance metric series for charting
 */
export interface PerformanceMetricSeries {
  /** Metric identifier */
  metricId: string
  /** Human-readable metric name */
  name: string
  /** Metric type */
  type: PerformanceMetricType
  /** Unit of measurement */
  unit: string
  /** Data points */
  data: PerformanceDataPoint[]
  /** Aggregate statistics */
  aggregates: {
    min: number
    max: number
    avg: number
    sum: number
    count: number
  }
}

/**
 * Token usage performance metrics
 */
export interface TokenUsageMetrics {
  /** Total input tokens */
  inputTokens: number
  /** Total output tokens */
  outputTokens: number
  /** Total tokens (input + output) */
  totalTokens: number
  /** Estimated cost in USD */
  estimatedCost: number
  /** Tokens per minute rate */
  tokensPerMinute: number
  /** Cache hit rate (0-1) */
  cacheHitRate: number
  /** Usage by agent */
  byAgent: Record<string, {
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }>
  /** Usage by tool */
  byTool: Record<string, {
    callCount: number
    avgDurationMs: number
    successRate: number
  }>
}

/**
 * Task execution performance metrics
 */
export interface TaskPerformanceMetrics {
  /** Number of tasks completed */
  completedTasks: number
  /** Number of tasks failed */
  failedTasks: number
  /** Average task duration in milliseconds */
  avgDurationMs: number
  /** Median task duration in milliseconds */
  medianDurationMs: number
  /** 95th percentile task duration */
  p95DurationMs: number
  /** Task success rate (0-1) */
  successRate: number
  /** Tasks by status */
  byStatus: Record<TaskStatus, number>
  /** Tasks by stage */
  byStage: Record<string, number>
}

/**
 * Agent performance metrics
 */
export interface AgentPerformanceMetrics {
  /** Agent name */
  agentName: string
  /** Total invocations */
  invocations: number
  /** Average response time in milliseconds */
  avgResponseTimeMs: number
  /** Token usage */
  tokenUsage: {
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }
  /** Tool call counts */
  toolCalls: Record<string, number>
  /** Error count */
  errorCount: number
  /** Success rate (0-1) */
  successRate: number
}

/**
 * Tool performance metrics
 */
export interface ToolPerformanceMetrics {
  /** Tool name */
  toolName: string
  /** Total invocations */
  invocations: number
  /** Average execution time in milliseconds */
  avgExecutionTimeMs: number
  /** Success rate (0-1) */
  successRate: number
  /** Number of failures */
  failures: number
  /** Average input size (bytes) */
  avgInputSize: number
  /** Average output size (bytes) */
  avgOutputSize: number
}

/**
 * Aggregated dashboard performance data
 */
export interface DashboardPerformanceData {
  /** Time range for the data */
  timeRange: PerformanceTimeRange

  /** Token usage metrics */
  tokenUsage: TokenUsageMetrics

  /** Task performance metrics */
  tasks: TaskPerformanceMetrics

  /** Per-agent performance metrics */
  agents: AgentPerformanceMetrics[]

  /** Per-tool performance metrics */
  tools: ToolPerformanceMetrics[]

  /** Time-series data for charting */
  timeSeries: PerformanceMetricSeries[]

  /** Timestamp when data was generated */
  generatedAt: Date
}

// ============================================================================
// Real-time Update State Types
// ============================================================================

/**
 * Connection state for the real-time updates hook
 */
export type RealtimeConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

/**
 * Real-time update subscription options
 */
export interface RealtimeSubscriptionOptions {
  /** Task IDs to subscribe to (empty = all) */
  taskIds?: string[]
  /** Event types to subscribe to (empty = all) */
  eventTypes?: DashboardEventType[]
  /** Whether to receive health metrics */
  includeHealth?: boolean
  /** Whether to receive performance data */
  includePerformance?: boolean
  /** Debounce interval for performance updates (ms) */
  performanceUpdateInterval?: number
}

/**
 * Default subscription options
 */
export const DEFAULT_SUBSCRIPTION_OPTIONS: Required<RealtimeSubscriptionOptions> = {
  taskIds: [],
  eventTypes: [],
  includeHealth: true,
  includePerformance: true,
  performanceUpdateInterval: 5000,
}

/**
 * Real-time updates state
 */
export interface RealtimeUpdatesState {
  /** Current connection state */
  connectionState: RealtimeConnectionState

  /** Whether currently connected */
  isConnected: boolean

  /** Last error if any */
  error: Error | null

  /** Health metrics */
  health: DashboardHealthMetrics | null

  /** Activity events (most recent first) */
  events: DashboardActivityEvent[]

  /** Performance data */
  performance: DashboardPerformanceData | null

  /** Timestamp of last update */
  lastUpdate: Date | null
}

/**
 * Initial real-time updates state
 */
export const INITIAL_REALTIME_STATE: RealtimeUpdatesState = {
  connectionState: 'disconnected',
  isConnected: false,
  error: null,
  health: null,
  events: [],
  performance: null,
  lastUpdate: null,
}

/**
 * Real-time updates hook return type
 */
export interface UseRealtimeUpdatesReturn {
  /** Current state */
  state: RealtimeUpdatesState

  /** Connect to the WebSocket server */
  connect: () => void

  /** Disconnect from the WebSocket server */
  disconnect: () => void

  /** Mark an event as read */
  markEventRead: (eventId: string) => void

  /** Mark all events as read */
  markAllEventsRead: () => void

  /** Clear all events */
  clearEvents: () => void

  /** Update subscription options */
  updateSubscription: (options: Partial<RealtimeSubscriptionOptions>) => void

  /** Force refresh performance data */
  refreshPerformance: () => void

  /** Force health check */
  checkHealth: () => Promise<void>
}

// ============================================================================
// Event Transformation Helpers
// ============================================================================

/**
 * Transform an ApexEvent to a DashboardActivityEvent
 */
export function transformApexEvent(event: WebSocketApexEvent): DashboardActivityEvent {
  const category = getEventCategory(event.type)
  const severity = getEventSeverity(event.type)

  // Extract agent/tool names from event data
  const agentName = (event.data.agentName || event.data.agent) as string | undefined
  const toolName = (event.data.toolName || event.data.tool) as string | undefined

  // Generate human-readable title
  const title = generateEventTitle(event.type, event.data)

  return {
    id: `${event.taskId}-${event.timestamp.getTime()}-${Math.random().toString(36).substring(2, 9)}`,
    type: event.type,
    category,
    severity,
    taskId: event.taskId || '',
    title,
    description: event.data.message as string | undefined,
    timestamp: event.timestamp,
    data: event.data,
    isRead: false,
    agentName,
    toolName,
  }
}

/**
 * Generate a human-readable title for an event
 */
export function generateEventTitle(eventType: DashboardEventType, data: Record<string, unknown>): string {
  const agentName = (data.agentName || data.agent || '') as string
  const toolName = (data.toolName || data.tool || '') as string
  const stageName = (data.stageName || data.stage || '') as string

  switch (eventType) {
    case 'task:created':
      return 'Task created'
    case 'task:started':
      return 'Task started'
    case 'task:stage-changed':
      return `Stage changed to ${stageName}`
    case 'task:completed':
      return 'Task completed'
    case 'task:failed':
      return 'Task failed'
    case 'task:paused':
      return 'Task paused'
    case 'agent:message':
      return `${agentName || 'Agent'} responded`
    case 'agent:thinking':
      return `${agentName || 'Agent'} is thinking`
    case 'agent:tool-use':
      return `${agentName || 'Agent'} using ${toolName || 'tool'}`
    case 'tool:start':
      return `${toolName || 'Tool'} started`
    case 'tool:complete':
      return `${toolName || 'Tool'} completed`
    case 'gate:required':
      return 'Approval required'
    case 'gate:approved':
      return 'Gate approved'
    case 'gate:rejected':
      return 'Gate rejected'
    case 'permission:request':
      return `Permission requested for ${toolName || 'operation'}`
    case 'permission:granted':
      return `Permission granted for ${toolName || 'operation'}`
    case 'permission:denied':
      return `Permission denied for ${toolName || 'operation'}`
    case 'dangerous:detected':
      return 'Dangerous operation detected'
    case 'dangerous:blocked':
      return 'Dangerous operation blocked'
    default:
      // Convert event type to readable format
      return eventType.replace(/[:-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

/**
 * Calculate connection health status from metrics
 */
export function calculateHealthStatus(
  metrics: Partial<DashboardHealthMetrics>,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS
): ConnectionHealthStatus {
  if (!metrics.connection?.isConnected) {
    return 'unknown'
  }

  const latency = metrics.connection?.latencyMs ?? 0
  const successRate = metrics.server?.successRate ?? 100

  if (latency > thresholds.latencyUnhealthy || successRate < thresholds.successRateUnhealthy) {
    return 'unhealthy'
  }

  if (latency > thresholds.latencyDegraded || successRate < thresholds.successRateDegraded) {
    return 'degraded'
  }

  return 'healthy'
}
