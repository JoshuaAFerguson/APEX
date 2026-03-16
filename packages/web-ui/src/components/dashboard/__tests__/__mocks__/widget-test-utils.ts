/**
 * Test utilities and mock factories for BudgetWidget and AgentUtilizationWidget
 *
 * Provides reusable mock data generators and test helpers following
 * established patterns from ProjectHealthPanel tests.
 */
import { vi } from 'vitest'
import type { BudgetWidgetProps } from '../../BudgetWidget'
import type { AgentUtilizationWidgetProps } from '../../AgentUtilizationWidget'
import type { AgentUtilization, AgentUtilizationData } from '@/types/agent-utilization'
import type { AgentMetrics, AgentMetricsAgent } from '@/types/agent-metrics'
import type { RealtimeConnectionState, RealtimeUpdatesState, DashboardPerformanceData } from '@/types/dashboard'
import type { WebSocketConnectionStatus } from '@/types/websocket-connection'

// ============================================================================
// useRealtimeUpdates Mock Types and Factory
// ============================================================================

/**
 * Mock state for useRealtimeUpdates hook
 */
export interface MockRealtimeState extends Partial<RealtimeUpdatesState> {
  connectionState: RealtimeConnectionState
  isConnected: boolean
  performance: DashboardPerformanceData | null
  lastUpdate: Date | null
  error: Error | null
}

/**
 * Mock return value for useRealtimeUpdates hook
 */
export interface MockRealtimeUpdatesReturn {
  state: MockRealtimeState
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  markEventRead: ReturnType<typeof vi.fn>
  markAllEventsRead: ReturnType<typeof vi.fn>
  clearEvents: ReturnType<typeof vi.fn>
  updateSubscription: ReturnType<typeof vi.fn>
  refreshPerformance: ReturnType<typeof vi.fn>
  checkHealth: ReturnType<typeof vi.fn>
}

/**
 * Create a default mock state for useRealtimeUpdates
 */
export function createMockRealtimeState(overrides?: Partial<MockRealtimeState>): MockRealtimeState {
  return {
    connectionState: 'connected',
    isConnected: true,
    events: [],
    health: null,
    performance: {
      timeRange: '1h',
      tokenUsage: {
        inputTokens: 3000,
        outputTokens: 2000,
        totalTokens: 5000,
        estimatedCost: 500,
        tokensPerMinute: 100,
        cacheHitRate: 0.2,
        byAgent: {},
        byTool: {},
      },
      tasks: {
        completedTasks: 10,
        failedTasks: 1,
        avgDurationMs: 2500,
        medianDurationMs: 2000,
        p95DurationMs: 5000,
        successRate: 0.91,
        byStatus: {},
        byStage: {},
      },
      agents: [],
      tools: [],
      timeSeries: [],
      generatedAt: new Date(),
    },
    lastUpdate: new Date(),
    error: null,
    ...overrides,
  }
}

/**
 * Create a mock return value for useRealtimeUpdates hook
 */
export function createMockRealtimeUpdates(
  stateOverrides?: Partial<MockRealtimeState>,
  fnOverrides?: Partial<Omit<MockRealtimeUpdatesReturn, 'state'>>
): MockRealtimeUpdatesReturn {
  return {
    state: createMockRealtimeState(stateOverrides),
    connect: vi.fn(),
    disconnect: vi.fn(),
    markEventRead: vi.fn(),
    markAllEventsRead: vi.fn(),
    clearEvents: vi.fn(),
    updateSubscription: vi.fn(),
    refreshPerformance: vi.fn(),
    checkHealth: vi.fn().mockResolvedValue(undefined),
    ...fnOverrides,
  }
}

/**
 * Create connecting state mock
 */
export function createConnectingMock(): MockRealtimeUpdatesReturn {
  return createMockRealtimeUpdates({
    connectionState: 'connecting',
    isConnected: false,
    performance: null,
    lastUpdate: null,
  })
}

/**
 * Create error state mock
 */
export function createErrorMock(errorMessage: string = 'Connection failed'): MockRealtimeUpdatesReturn {
  return createMockRealtimeUpdates({
    connectionState: 'error',
    isConnected: false,
    error: new Error(errorMessage),
  })
}

/**
 * Create disconnected state mock
 */
export function createDisconnectedMock(): MockRealtimeUpdatesReturn {
  return createMockRealtimeUpdates({
    connectionState: 'disconnected',
    isConnected: false,
  })
}

// ============================================================================
// useAgentMetrics Mock Types and Factory
// ============================================================================

/**
 * Mock return value for useAgentMetrics hook
 */
export interface MockAgentMetricsReturn {
  metrics: AgentMetrics
  connectionStatus: WebSocketConnectionStatus
  isLoading: boolean
  error: string | null
  refresh: ReturnType<typeof vi.fn>
}

/**
 * Create a mock agent for testing
 */
export function createMockAgent(
  id: string,
  name: string,
  tokens: number = 1000,
  cost: number = 0.05
): AgentMetricsAgent {
  return {
    agentId: id,
    agentName: name,
    inputTokens: Math.floor(tokens * 0.6),
    outputTokens: Math.floor(tokens * 0.4),
    totalTokens: tokens,
    estimatedCost: cost,
    tokensPerSecond: 15.5,
    duration: 2000,
    invocations: 3,
    cacheTokens: 100,
    avgLatencyMs: 150,
    status: 'active',
    isActive: true,
    lastActivityAt: new Date(),
  }
}

/**
 * Create mock agent utilization data
 */
export function createMockAgentUtilization(
  id: string,
  name: string,
  tokens: number = 1000,
  cost: number = 0.05
): AgentUtilization {
  return {
    agentId: id,
    agentName: name,
    inputTokens: Math.floor(tokens * 0.6),
    outputTokens: Math.floor(tokens * 0.4),
    totalTokens: tokens,
    estimatedCost: cost,
    tokensPerSecond: 15.5,
    duration: 2000,
    invocations: 3,
    cacheTokens: 100,
    avgLatencyMs: 150,
  }
}

/**
 * Create mock AgentMetrics data
 */
export function createMockAgentMetricsData(
  agents?: AgentMetricsAgent[],
  overrides?: Partial<AgentMetrics>
): AgentMetrics {
  const defaultAgents = agents ?? [
    createMockAgent('planner', 'Planner', 5000, 0.25),
    createMockAgent('architect', 'Architect', 3000, 0.15),
    createMockAgent('coder', 'Coder', 8000, 0.40),
  ]

  const totalTokens = defaultAgents.reduce((sum, a) => sum + a.totalTokens, 0)
  const totalCost = defaultAgents.reduce((sum, a) => sum + a.estimatedCost, 0)

  return {
    agents: defaultAgents,
    totalTokens,
    totalCost,
    lastUpdated: new Date(),
    timeRange: undefined,
    connectionStatus: 'connected',
    ...overrides,
  }
}

/**
 * Create mock return value for useAgentMetrics hook
 */
export function createMockAgentMetrics(
  overrides?: Partial<MockAgentMetricsReturn>
): MockAgentMetricsReturn {
  return {
    metrics: createMockAgentMetricsData(),
    connectionStatus: 'connected',
    isLoading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

/**
 * Create loading state mock for useAgentMetrics
 */
export function createAgentMetricsLoadingMock(): MockAgentMetricsReturn {
  return createMockAgentMetrics({
    metrics: createMockAgentMetricsData([]),
    isLoading: true,
    connectionStatus: 'connecting',
  })
}

/**
 * Create error state mock for useAgentMetrics
 */
export function createAgentMetricsErrorMock(
  errorMessage: string = 'Failed to load agent data'
): MockAgentMetricsReturn {
  return createMockAgentMetrics({
    error: errorMessage,
    connectionStatus: 'error',
  })
}

/**
 * Create empty data mock for useAgentMetrics
 */
export function createAgentMetricsEmptyMock(): MockAgentMetricsReturn {
  return createMockAgentMetrics({
    metrics: createMockAgentMetricsData([]),
  })
}

// ============================================================================
// Props Factories
// ============================================================================

/**
 * Create default BudgetWidget props
 */
export function createBudgetWidgetProps(
  overrides?: Partial<BudgetWidgetProps>
): BudgetWidgetProps {
  return {
    budgetLimit: 1000,
    size: 'md',
    className: '',
    thresholds: { warning: 75, danger: 90 },
    autoRefreshInterval: 0,
    ...overrides,
  }
}

/**
 * Create default AgentUtilizationWidget props
 */
export function createAgentUtilizationWidgetProps(
  overrides?: Partial<AgentUtilizationWidgetProps>
): AgentUtilizationWidgetProps {
  return {
    maxAgents: 6,
    height: 300,
    className: '',
    showCost: true,
    showPerformance: false,
    showTokenBreakdown: true,
    ...overrides,
  }
}

// ============================================================================
// Threshold Test Data
// ============================================================================

/**
 * Budget threshold test cases
 */
export const BUDGET_THRESHOLD_TEST_CASES = [
  {
    spend: 0,
    budgetLimit: 1000,
    expectedStatus: 'Within budget',
    expectedLevel: 'safe',
  },
  {
    spend: 500,
    budgetLimit: 1000,
    expectedStatus: 'Within budget',
    expectedLevel: 'safe',
  },
  {
    spend: 749,
    budgetLimit: 1000,
    expectedStatus: 'Within budget',
    expectedLevel: 'safe',
  },
  {
    spend: 750,
    budgetLimit: 1000,
    expectedStatus: 'Approaching limit',
    expectedLevel: 'warning',
  },
  {
    spend: 899,
    budgetLimit: 1000,
    expectedStatus: 'Approaching limit',
    expectedLevel: 'warning',
  },
  {
    spend: 900,
    budgetLimit: 1000,
    expectedStatus: 'Over budget',
    expectedLevel: 'danger',
  },
  {
    spend: 1000,
    budgetLimit: 1000,
    expectedStatus: 'Over budget',
    expectedLevel: 'danger',
  },
  {
    spend: 1200,
    budgetLimit: 1000,
    expectedStatus: 'Over budget',
    expectedLevel: 'danger',
  },
] as const

/**
 * Connection status test cases
 */
export const CONNECTION_STATUS_TEST_CASES = [
  {
    connectionState: 'connected' as const,
    expectedLabel: 'Connected',
    expectedColor: 'green',
  },
  {
    connectionState: 'connecting' as const,
    expectedLabel: 'Connecting...',
    expectedColor: 'yellow',
  },
  {
    connectionState: 'reconnecting' as const,
    expectedLabel: 'Reconnecting...',
    expectedColor: 'yellow',
  },
  {
    connectionState: 'error' as const,
    expectedLabel: 'Connection Error',
    expectedColor: 'red',
  },
  {
    connectionState: 'disconnected' as const,
    expectedLabel: 'Disconnected',
    expectedColor: 'gray',
  },
] as const

// ============================================================================
// Edge Case Test Data
// ============================================================================

/**
 * Zero and empty data scenarios
 */
export const ZERO_DATA_SCENARIOS = {
  zeroBudget: { budgetLimit: 0, spend: 0 },
  zeroSpend: { budgetLimit: 1000, spend: 0 },
  noAgents: { agents: [] },
  zeroTokenAgents: [createMockAgent('empty', 'Empty Agent', 0, 0)],
}

/**
 * Extreme value scenarios
 */
export const EXTREME_VALUE_SCENARIOS = {
  maxSafeInteger: {
    budgetLimit: Number.MAX_SAFE_INTEGER,
    spend: Number.MAX_SAFE_INTEGER / 2,
  },
  verySmallDecimals: {
    budgetLimit: 0.0001,
    spend: 0.00005,
  },
  largeTokenCounts: [
    createMockAgent('large', 'Large Agent', 10000000, 500.00),
  ],
}

/**
 * Invalid data scenarios
 */
export const INVALID_DATA_SCENARIOS = {
  nanValues: {
    budgetLimit: NaN,
    spend: NaN,
  },
  infinityValues: {
    budgetLimit: Infinity,
    spend: Infinity,
  },
  negativeValues: {
    budgetLimit: -1000,
    spend: -500,
  },
}
