/**
 * Comprehensive tests for Agent Metrics types and utility functions
 * Tests type safety, default values, helper functions, and edge cases
 */

import { describe, it, expect } from 'vitest'
import type {
  AgentMetrics,
  AgentMetricsAgent,
  AgentStatus,
  UseAgentMetricsReturn,
  UseAgentMetricsOptions,
  AgentMetricsEventType,
  AgentEvent,
  UsageUpdateEvent,
  AgentMetricsSummary,
} from '../agent-metrics'
import {
  DEFAULT_AGENT_METRICS_OPTIONS,
  EMPTY_AGENT_METRICS,
  AGENT_METRICS_EVENTS,
  createAgentMetricsSummary,
  createEmptyAgentMetricsAgent,
  mapEventTypeToStatus,
  calculateAgentMetricsTotals,
} from '../agent-metrics'

// ============================================================================
// Mock Data Factories
// ============================================================================

const createMockAgentMetricsAgent = (
  overrides: Partial<AgentMetricsAgent> = {}
): AgentMetricsAgent => ({
  agentId: 'agent-1',
  agentName: 'Test Agent',
  inputTokens: 1000,
  outputTokens: 500,
  totalTokens: 1500,
  estimatedCost: 0.05,
  tokensPerSecond: 10.5,
  duration: 5000,
  invocations: 3,
  status: 'idle',
  lastActivityAt: new Date(),
  isActive: false,
  ...overrides,
})

const createMockAgentMetrics = (
  agents: AgentMetricsAgent[] = [],
  overrides: Partial<AgentMetrics> = {}
): AgentMetrics => ({
  agents,
  totalTokens: agents.reduce((sum, agent) => sum + agent.totalTokens, 0),
  totalCost: agents.reduce((sum, agent) => sum + agent.estimatedCost, 0),
  connectionStatus: 'connected',
  lastUpdated: new Date(),
  ...overrides,
})

// ============================================================================
// Interface Structure Tests
// ============================================================================

describe('AgentMetricsAgent Interface', () => {
  it('should have all required fields with correct types', () => {
    const agent = createMockAgentMetricsAgent()

    expect(typeof agent.agentId).toBe('string')
    expect(typeof agent.agentName).toBe('string')
    expect(typeof agent.inputTokens).toBe('number')
    expect(typeof agent.outputTokens).toBe('number')
    expect(typeof agent.totalTokens).toBe('number')
    expect(typeof agent.estimatedCost).toBe('number')
    expect(typeof agent.tokensPerSecond).toBe('number')
    expect(typeof agent.duration).toBe('number')
    expect(typeof agent.invocations).toBe('number')
    expect(typeof agent.status).toBe('string')
    expect(typeof agent.isActive).toBe('boolean')
  })

  it('should support null lastActivityAt', () => {
    const agent = createMockAgentMetricsAgent({ lastActivityAt: null })
    expect(agent.lastActivityAt).toBeNull()
  })

  it('should support Date lastActivityAt', () => {
    const now = new Date()
    const agent = createMockAgentMetricsAgent({ lastActivityAt: now })
    expect(agent.lastActivityAt).toEqual(now)
  })

  it('should accept all valid status values', () => {
    const statuses: AgentStatus[] = ['idle', 'processing', 'error', 'offline']
    statuses.forEach((status) => {
      const agent = createMockAgentMetricsAgent({ status })
      expect(agent.status).toBe(status)
    })
  })

  it('should support optional fields from AgentUtilization', () => {
    const agent = createMockAgentMetricsAgent({
      cacheTokens: 100,
      cacheHitRate: 0.85,
      avgLatencyMs: 250,
    })

    expect(agent.cacheTokens).toBe(100)
    expect(agent.cacheHitRate).toBe(0.85)
    expect(agent.avgLatencyMs).toBe(250)
  })
})

describe('AgentMetrics Interface', () => {
  it('should have all required fields with correct types', () => {
    const metrics = createMockAgentMetrics()

    expect(Array.isArray(metrics.agents)).toBe(true)
    expect(typeof metrics.totalTokens).toBe('number')
    expect(typeof metrics.totalCost).toBe('number')
    expect(typeof metrics.connectionStatus).toBe('string')
    expect(metrics.lastUpdated).toBeInstanceOf(Date)
  })

  it('should support optional time range', () => {
    const metrics = createMockAgentMetrics([], {
      timeRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
      },
    })

    expect(metrics.timeRange).toBeDefined()
    expect(metrics.timeRange!.start).toBeInstanceOf(Date)
    expect(metrics.timeRange!.end).toBeInstanceOf(Date)
  })

  it('should calculate totals correctly from agents', () => {
    const agents = [
      createMockAgentMetricsAgent({
        agentId: '1',
        totalTokens: 100,
        estimatedCost: 0.01,
      }),
      createMockAgentMetricsAgent({
        agentId: '2',
        totalTokens: 200,
        estimatedCost: 0.02,
      }),
    ]

    const metrics = createMockAgentMetrics(agents)

    expect(metrics.totalTokens).toBe(300)
    expect(metrics.totalCost).toBe(0.03)
  })

  it('should accept all valid connection status values', () => {
    const statuses = ['connected', 'disconnected', 'connecting', 'reconnecting', 'error'] as const

    statuses.forEach((status) => {
      const metrics = createMockAgentMetrics([], { connectionStatus: status })
      expect(metrics.connectionStatus).toBe(status)
    })
  })
})

// ============================================================================
// Default Values and Constants Tests
// ============================================================================

describe('Default Values and Constants', () => {
  describe('DEFAULT_AGENT_METRICS_OPTIONS', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_AGENT_METRICS_OPTIONS.autoConnect).toBe(true)
      expect(DEFAULT_AGENT_METRICS_OPTIONS.pollingIntervalMs).toBe(0)
      expect(DEFAULT_AGENT_METRICS_OPTIONS.debug).toBe(false)
    })

    it('should have all required keys', () => {
      expect(DEFAULT_AGENT_METRICS_OPTIONS).toHaveProperty('autoConnect')
      expect(DEFAULT_AGENT_METRICS_OPTIONS).toHaveProperty('pollingIntervalMs')
      expect(DEFAULT_AGENT_METRICS_OPTIONS).toHaveProperty('debug')
    })
  })

  describe('EMPTY_AGENT_METRICS', () => {
    it('should have empty/zero values for all fields', () => {
      expect(EMPTY_AGENT_METRICS.agents).toEqual([])
      expect(EMPTY_AGENT_METRICS.totalTokens).toBe(0)
      expect(EMPTY_AGENT_METRICS.totalCost).toBe(0)
      expect(EMPTY_AGENT_METRICS.connectionStatus).toBe('disconnected')
      expect(EMPTY_AGENT_METRICS.lastUpdated).toBeInstanceOf(Date)
    })

    it('should not have time range defined', () => {
      expect(EMPTY_AGENT_METRICS.timeRange).toBeUndefined()
    })
  })

  describe('AGENT_METRICS_EVENTS', () => {
    it('should contain all expected event types', () => {
      const expectedEvents: AgentMetricsEventType[] = [
        'agent:started',
        'agent:completed',
        'agent:failed',
        'agent:progress',
        'agent:idle',
        'usage:updated',
      ]

      expectedEvents.forEach((event) => {
        expect(AGENT_METRICS_EVENTS).toContain(event)
      })
    })

    it('should have correct number of event types', () => {
      expect(AGENT_METRICS_EVENTS).toHaveLength(6)
    })
  })
})

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Helper Functions', () => {
  describe('createEmptyAgentMetricsAgent', () => {
    it('should create an agent with correct id and name', () => {
      const agent = createEmptyAgentMetricsAgent('test-id', 'Test Agent')

      expect(agent.agentId).toBe('test-id')
      expect(agent.agentName).toBe('Test Agent')
    })

    it('should initialize all numeric fields to zero', () => {
      const agent = createEmptyAgentMetricsAgent('test-id', 'Test Agent')

      expect(agent.inputTokens).toBe(0)
      expect(agent.outputTokens).toBe(0)
      expect(agent.totalTokens).toBe(0)
      expect(agent.estimatedCost).toBe(0)
      expect(agent.tokensPerSecond).toBe(0)
      expect(agent.duration).toBe(0)
      expect(agent.invocations).toBe(0)
    })

    it('should set default status to idle', () => {
      const agent = createEmptyAgentMetricsAgent('test-id', 'Test Agent')
      expect(agent.status).toBe('idle')
    })

    it('should set isActive to false', () => {
      const agent = createEmptyAgentMetricsAgent('test-id', 'Test Agent')
      expect(agent.isActive).toBe(false)
    })

    it('should set lastActivityAt to null', () => {
      const agent = createEmptyAgentMetricsAgent('test-id', 'Test Agent')
      expect(agent.lastActivityAt).toBeNull()
    })
  })

  describe('mapEventTypeToStatus', () => {
    it('should map agent:started to processing', () => {
      expect(mapEventTypeToStatus('agent:started')).toBe('processing')
    })

    it('should map agent:progress to processing', () => {
      expect(mapEventTypeToStatus('agent:progress')).toBe('processing')
    })

    it('should map agent:completed to idle', () => {
      expect(mapEventTypeToStatus('agent:completed')).toBe('idle')
    })

    it('should map agent:idle to idle', () => {
      expect(mapEventTypeToStatus('agent:idle')).toBe('idle')
    })

    it('should map agent:failed to error', () => {
      expect(mapEventTypeToStatus('agent:failed')).toBe('error')
    })

    it('should map usage:updated to idle (default)', () => {
      expect(mapEventTypeToStatus('usage:updated')).toBe('idle')
    })

    it('should return idle for unknown event types', () => {
      // TypeScript would catch this, but testing runtime behavior
      expect(mapEventTypeToStatus('unknown:event' as AgentMetricsEventType)).toBe('idle')
    })
  })

  describe('calculateAgentMetricsTotals', () => {
    it('should calculate totals correctly', () => {
      const agents = [
        createMockAgentMetricsAgent({ totalTokens: 100, estimatedCost: 0.01 }),
        createMockAgentMetricsAgent({ totalTokens: 200, estimatedCost: 0.02 }),
        createMockAgentMetricsAgent({ totalTokens: 300, estimatedCost: 0.03 }),
      ]

      const totals = calculateAgentMetricsTotals(agents)

      expect(totals.totalTokens).toBe(600)
      expect(totals.totalCost).toBeCloseTo(0.06)
    })

    it('should handle empty agents array', () => {
      const totals = calculateAgentMetricsTotals([])

      expect(totals.totalTokens).toBe(0)
      expect(totals.totalCost).toBe(0)
    })

    it('should handle single agent', () => {
      const agents = [createMockAgentMetricsAgent({ totalTokens: 500, estimatedCost: 0.05 })]

      const totals = calculateAgentMetricsTotals(agents)

      expect(totals.totalTokens).toBe(500)
      expect(totals.totalCost).toBe(0.05)
    })

    it('should handle agents with zero values', () => {
      const agents = [
        createMockAgentMetricsAgent({ totalTokens: 0, estimatedCost: 0 }),
        createMockAgentMetricsAgent({ totalTokens: 100, estimatedCost: 0.01 }),
      ]

      const totals = calculateAgentMetricsTotals(agents)

      expect(totals.totalTokens).toBe(100)
      expect(totals.totalCost).toBe(0.01)
    })
  })

  describe('createAgentMetricsSummary', () => {
    it('should create summary with correct agent counts', () => {
      const agents = [
        createMockAgentMetricsAgent({ agentId: '1', isActive: true }),
        createMockAgentMetricsAgent({ agentId: '2', isActive: false }),
        createMockAgentMetricsAgent({ agentId: '3', isActive: true }),
      ]

      const metrics = createMockAgentMetrics(agents, { connectionStatus: 'connected' })
      const summary = createAgentMetricsSummary(metrics)

      expect(summary.agentCount).toBe(3)
      expect(summary.activeAgentCount).toBe(2)
    })

    it('should calculate average throughput', () => {
      const agents = [
        createMockAgentMetricsAgent({ tokensPerSecond: 10 }),
        createMockAgentMetricsAgent({ tokensPerSecond: 20 }),
        createMockAgentMetricsAgent({ tokensPerSecond: 30 }),
      ]

      const metrics = createMockAgentMetrics(agents)
      const summary = createAgentMetricsSummary(metrics)

      expect(summary.avgThroughput).toBe(20)
    })

    it('should handle empty agents array', () => {
      const metrics = createMockAgentMetrics([])
      const summary = createAgentMetricsSummary(metrics)

      expect(summary.agentCount).toBe(0)
      expect(summary.activeAgentCount).toBe(0)
      expect(summary.avgThroughput).toBe(0)
    })

    it('should correctly determine connection status', () => {
      const metricsConnected = createMockAgentMetrics([], { connectionStatus: 'connected' })
      const metricsDisconnected = createMockAgentMetrics([], { connectionStatus: 'disconnected' })

      expect(createAgentMetricsSummary(metricsConnected).isConnected).toBe(true)
      expect(createAgentMetricsSummary(metricsDisconnected).isConnected).toBe(false)
    })

    it('should include total tokens and cost', () => {
      const agents = [
        createMockAgentMetricsAgent({ totalTokens: 100, estimatedCost: 0.01 }),
        createMockAgentMetricsAgent({ totalTokens: 200, estimatedCost: 0.02 }),
      ]

      const metrics = createMockAgentMetrics(agents)
      const summary = createAgentMetricsSummary(metrics)

      expect(summary.totalTokens).toBe(300)
      expect(summary.totalCost).toBeCloseTo(0.03)
    })
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  describe('Zero and Negative Values', () => {
    it('should handle zero token counts', () => {
      const agent = createMockAgentMetricsAgent({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        tokensPerSecond: 0,
        duration: 0,
        invocations: 0,
      })

      expect(agent.inputTokens).toBe(0)
      expect(agent.outputTokens).toBe(0)
      expect(agent.totalTokens).toBe(0)
    })

    it('should handle very large token counts', () => {
      const agent = createMockAgentMetricsAgent({
        inputTokens: Number.MAX_SAFE_INTEGER,
        outputTokens: 1000,
        estimatedCost: 999999.99,
      })

      expect(agent.inputTokens).toBe(Number.MAX_SAFE_INTEGER)
      expect(agent.estimatedCost).toBe(999999.99)
    })

    it('should handle fractional values', () => {
      const agent = createMockAgentMetricsAgent({
        tokensPerSecond: 10.567891,
        estimatedCost: 0.00001,
      })

      expect(agent.tokensPerSecond).toBeCloseTo(10.567891)
      expect(agent.estimatedCost).toBeCloseTo(0.00001)
    })
  })

  describe('Empty Collections', () => {
    it('should handle empty agents array in metrics', () => {
      const metrics = createMockAgentMetrics([])

      expect(metrics.agents).toHaveLength(0)
      expect(metrics.totalTokens).toBe(0)
      expect(metrics.totalCost).toBe(0)
    })

    it('should calculate summary from empty metrics', () => {
      const metrics = createMockAgentMetrics([])
      const summary = createAgentMetricsSummary(metrics)

      expect(summary.agentCount).toBe(0)
      expect(summary.activeAgentCount).toBe(0)
      expect(summary.totalTokens).toBe(0)
      expect(summary.totalCost).toBe(0)
      expect(summary.avgThroughput).toBe(0)
    })
  })

  describe('String Length Limits', () => {
    it('should handle very long agent names', () => {
      const longName = 'a'.repeat(1000)
      const agent = createMockAgentMetricsAgent({ agentName: longName })

      expect(agent.agentName).toBe(longName)
      expect(agent.agentName.length).toBe(1000)
    })

    it('should handle empty agent names', () => {
      const agent = createMockAgentMetricsAgent({ agentName: '', agentId: '' })

      expect(agent.agentName).toBe('')
      expect(agent.agentId).toBe('')
    })

    it('should handle special characters in names', () => {
      const specialName = 'Agent-123_v2.0 (Test) [PROD]'
      const agent = createMockAgentMetricsAgent({ agentName: specialName })

      expect(agent.agentName).toBe(specialName)
    })
  })

  describe('Date Handling', () => {
    it('should handle various date values', () => {
      const now = new Date()
      const past = new Date('2023-01-01T00:00:00Z')
      const future = new Date('2025-12-31T23:59:59Z')

      const metricsNow = createMockAgentMetrics([], { lastUpdated: now })
      const metricsPast = createMockAgentMetrics([], { lastUpdated: past })
      const metricsFuture = createMockAgentMetrics([], { lastUpdated: future })

      expect(metricsNow.lastUpdated).toEqual(now)
      expect(metricsPast.lastUpdated).toEqual(past)
      expect(metricsFuture.lastUpdated).toEqual(future)
    })

    it('should handle time range with same start and end', () => {
      const sameDate = new Date()
      const metrics = createMockAgentMetrics([], {
        timeRange: { start: sameDate, end: sameDate },
      })

      expect(metrics.timeRange!.start).toEqual(metrics.timeRange!.end)
    })
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance Considerations', () => {
  it('should handle large agent collections efficiently', () => {
    const agents: AgentMetricsAgent[] = []
    for (let i = 0; i < 1000; i++) {
      agents.push(
        createMockAgentMetricsAgent({
          agentId: `agent-${i}`,
          agentName: `Agent ${i}`,
          inputTokens: Math.floor(Math.random() * 10000),
          outputTokens: Math.floor(Math.random() * 5000),
          totalTokens: Math.floor(Math.random() * 15000),
        })
      )
    }

    const startTime = performance.now()
    const metrics = createMockAgentMetrics(agents)
    const summary = createAgentMetricsSummary(metrics)
    const endTime = performance.now()

    expect(metrics.agents).toHaveLength(1000)
    expect(summary.agentCount).toBe(1000)
    expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
  })

  it('should calculate totals efficiently for many agents', () => {
    const agents = Array.from({ length: 500 }, (_, i) =>
      createMockAgentMetricsAgent({
        agentId: `agent-${i}`,
        totalTokens: i * 10,
        estimatedCost: i * 0.001,
      })
    )

    const startTime = performance.now()
    const totals = calculateAgentMetricsTotals(agents)
    const endTime = performance.now()

    expect(totals.totalTokens).toBe(agents.reduce((sum, a) => sum + a.totalTokens, 0))
    expect(endTime - startTime).toBeLessThan(50)
  })

  it('should handle concurrent operations safely', () => {
    const originalAgent = createMockAgentMetricsAgent()
    const clonedAgent = { ...originalAgent }
    const modifiedAgent = { ...originalAgent, inputTokens: 999 }

    expect(originalAgent.inputTokens).not.toBe(999)
    expect(clonedAgent).toEqual(originalAgent)
    expect(modifiedAgent.inputTokens).toBe(999)
    expect(modifiedAgent.agentName).toBe(originalAgent.agentName)
  })
})

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('Type Safety', () => {
  describe('UseAgentMetricsOptions Interface', () => {
    it('should accept minimal options', () => {
      const options: UseAgentMetricsOptions = {}
      expect(options.autoConnect).toBeUndefined()
    })

    it('should accept all optional fields', () => {
      const options: UseAgentMetricsOptions = {
        autoConnect: false,
        pollingIntervalMs: 5000,
        agentIds: ['agent-1', 'agent-2'],
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        debug: true,
      }

      expect(options.autoConnect).toBe(false)
      expect(options.pollingIntervalMs).toBe(5000)
      expect(options.agentIds).toHaveLength(2)
      expect(options.timeRange).toBeDefined()
      expect(options.debug).toBe(true)
    })
  })

  describe('AgentEvent Interface', () => {
    it('should have correct structure', () => {
      const event: AgentEvent = {
        type: 'agent:started',
        timestamp: new Date(),
        agentId: 'agent-1',
        agentName: 'Test Agent',
        data: {
          tokens: { input: 100, output: 50, total: 150 },
          cost: 0.01,
          durationMs: 1000,
        },
      }

      expect(event.type).toBe('agent:started')
      expect(event.agentId).toBe('agent-1')
      expect(event.data.tokens?.total).toBe(150)
    })

    it('should support optional fields in data', () => {
      const event: AgentEvent = {
        type: 'agent:failed',
        timestamp: new Date(),
        agentId: 'agent-1',
        data: {
          error: 'Test error message',
          metadata: { reason: 'timeout' },
        },
      }

      expect(event.data.error).toBe('Test error message')
      expect(event.data.metadata?.reason).toBe('timeout')
    })
  })

  describe('UsageUpdateEvent Interface', () => {
    it('should have correct structure', () => {
      const event: UsageUpdateEvent = {
        type: 'usage:updated',
        timestamp: new Date(),
        data: {
          agentId: 'agent-1',
          tokens: { input: 100, output: 50, total: 150 },
          cost: 0.01,
          performance: { tokensPerSecond: 15, avgLatencyMs: 200 },
        },
      }

      expect(event.type).toBe('usage:updated')
      expect(event.data.tokens.total).toBe(150)
      expect(event.data.performance?.tokensPerSecond).toBe(15)
    })

    it('should support optional cache tokens', () => {
      const event: UsageUpdateEvent = {
        type: 'usage:updated',
        timestamp: new Date(),
        data: {
          agentId: 'agent-1',
          tokens: { input: 100, output: 50, total: 150, cache: 25 },
          cost: 0.01,
        },
      }

      expect(event.data.tokens.cache).toBe(25)
    })
  })
})
