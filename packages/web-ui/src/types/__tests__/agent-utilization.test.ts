/**
 * Comprehensive tests for Agent Utilization types and utility functions
 * Tests type safety, default values, and edge cases
 */

import { describe, it, expect } from 'vitest'
import type {
  AgentUtilization,
  AgentUtilizationData,
  AgentUtilizationChartProps,
  AgentUtilizationChartVariant,
  AgentUtilizationMetric,
  AgentUtilizationSortDirection,
  AgentUtilizationColorConfig,
  ProcessedAgentData,
  AgentUtilizationTooltipData,
  AgentUtilizationSummary,
  AgentUtilizationChartSizeConfig,
} from '../agent-utilization'
import {
  DEFAULT_UTILIZATION_COLORS,
  AGENT_UTILIZATION_CHART_SIZES,
  DEFAULT_AGENT_UTILIZATION_CHART_PROPS,
  EMPTY_AGENT_UTILIZATION_DATA,
} from '../agent-utilization'

// ============================================================================
// Mock Data for Testing
// ============================================================================

const createMockAgentUtilization = (overrides: Partial<AgentUtilization> = {}): AgentUtilization => ({
  agentId: 'test-agent-1',
  agentName: 'Test Agent',
  inputTokens: 1000,
  outputTokens: 500,
  totalTokens: 1500,
  estimatedCost: 0.05,
  tokensPerSecond: 10.5,
  duration: 5000,
  invocations: 3,
  ...overrides,
})

const createMockAgentUtilizationData = (
  agents: AgentUtilization[] = [],
  overrides: Partial<AgentUtilizationData> = {}
): AgentUtilizationData => ({
  agents,
  totalInputTokens: agents.reduce((sum, agent) => sum + agent.inputTokens, 0),
  totalOutputTokens: agents.reduce((sum, agent) => sum + agent.outputTokens, 0),
  totalTokens: agents.reduce((sum, agent) => sum + agent.totalTokens, 0),
  totalEstimatedCost: agents.reduce((sum, agent) => sum + agent.estimatedCost, 0),
  totalDuration: agents.reduce((sum, agent) => sum + agent.duration, 0),
  avgTokensPerSecond: agents.length > 0
    ? agents.reduce((sum, agent) => sum + agent.tokensPerSecond, 0) / agents.length
    : 0,
  lastUpdated: new Date(),
  ...overrides,
})

// ============================================================================
// Interface Structure Tests
// ============================================================================

describe('AgentUtilization Interface', () => {
  it('should have all required fields with correct types', () => {
    const utilization = createMockAgentUtilization()

    expect(typeof utilization.agentId).toBe('string')
    expect(typeof utilization.agentName).toBe('string')
    expect(typeof utilization.inputTokens).toBe('number')
    expect(typeof utilization.outputTokens).toBe('number')
    expect(typeof utilization.totalTokens).toBe('number')
    expect(typeof utilization.estimatedCost).toBe('number')
    expect(typeof utilization.tokensPerSecond).toBe('number')
    expect(typeof utilization.duration).toBe('number')
    expect(typeof utilization.invocations).toBe('number')
  })

  it('should support optional fields', () => {
    const utilizationWithOptionals = createMockAgentUtilization({
      cacheTokens: 100,
      cacheHitRate: 0.85,
      avgLatencyMs: 250,
    })

    expect(typeof utilizationWithOptionals.cacheTokens).toBe('number')
    expect(typeof utilizationWithOptionals.cacheHitRate).toBe('number')
    expect(typeof utilizationWithOptionals.avgLatencyMs).toBe('number')
  })

  it('should work without optional fields', () => {
    const utilization = createMockAgentUtilization()

    expect(utilization.cacheTokens).toBeUndefined()
    expect(utilization.cacheHitRate).toBeUndefined()
    expect(utilization.avgLatencyMs).toBeUndefined()
  })
})

describe('AgentUtilizationData Interface', () => {
  it('should have all required fields with correct types', () => {
    const agents = [
      createMockAgentUtilization({ agentId: '1' }),
      createMockAgentUtilization({ agentId: '2' }),
    ]
    const data = createMockAgentUtilizationData(agents)

    expect(Array.isArray(data.agents)).toBe(true)
    expect(typeof data.totalInputTokens).toBe('number')
    expect(typeof data.totalOutputTokens).toBe('number')
    expect(typeof data.totalTokens).toBe('number')
    expect(typeof data.totalEstimatedCost).toBe('number')
    expect(typeof data.totalDuration).toBe('number')
    expect(typeof data.avgTokensPerSecond).toBe('number')
    expect(data.lastUpdated).toBeInstanceOf(Date)
  })

  it('should support optional time range', () => {
    const data = createMockAgentUtilizationData([], {
      timeRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
      },
    })

    expect(data.timeRange).toBeDefined()
    expect(data.timeRange!.start).toBeInstanceOf(Date)
    expect(data.timeRange!.end).toBeInstanceOf(Date)
  })

  it('should calculate totals correctly from agents', () => {
    const agents = [
      createMockAgentUtilization({
        agentId: '1',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01,
        duration: 1000,
        tokensPerSecond: 5,
      }),
      createMockAgentUtilization({
        agentId: '2',
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
        estimatedCost: 0.02,
        duration: 2000,
        tokensPerSecond: 10,
      }),
    ]
    const data = createMockAgentUtilizationData(agents)

    expect(data.totalInputTokens).toBe(300)
    expect(data.totalOutputTokens).toBe(150)
    expect(data.totalTokens).toBe(450)
    expect(data.totalEstimatedCost).toBe(0.03)
    expect(data.totalDuration).toBe(3000)
    expect(data.avgTokensPerSecond).toBe(7.5)
  })
})

// ============================================================================
// Type Union Tests
// ============================================================================

describe('Type Unions', () => {
  describe('AgentUtilizationChartVariant', () => {
    it('should accept valid variant values', () => {
      const variants: AgentUtilizationChartVariant[] = ['bar', 'stacked-bar', 'pie', 'treemap']
      variants.forEach(variant => {
        expect(typeof variant).toBe('string')
      })
    })
  })

  describe('AgentUtilizationMetric', () => {
    it('should accept valid metric values', () => {
      const metrics: AgentUtilizationMetric[] = [
        'tokens',
        'inputTokens',
        'outputTokens',
        'cost',
        'tokensPerSecond',
        'duration',
        'invocations',
      ]
      metrics.forEach(metric => {
        expect(typeof metric).toBe('string')
      })
    })
  })

  describe('AgentUtilizationSortDirection', () => {
    it('should accept valid sort direction values', () => {
      const directions: AgentUtilizationSortDirection[] = ['asc', 'desc']
      directions.forEach(direction => {
        expect(typeof direction).toBe('string')
      })
    })
  })
})

// ============================================================================
// Default Values and Constants Tests
// ============================================================================

describe('Default Values and Constants', () => {
  describe('DEFAULT_UTILIZATION_COLORS', () => {
    it('should have all required color properties', () => {
      expect(DEFAULT_UTILIZATION_COLORS).toHaveProperty('inputTokens')
      expect(DEFAULT_UTILIZATION_COLORS).toHaveProperty('outputTokens')
      expect(DEFAULT_UTILIZATION_COLORS).toHaveProperty('cost')
      expect(DEFAULT_UTILIZATION_COLORS).toHaveProperty('performance')
      expect(DEFAULT_UTILIZATION_COLORS).toHaveProperty('agentColors')
    })

    it('should have valid CSS color values', () => {
      expect(typeof DEFAULT_UTILIZATION_COLORS.inputTokens).toBe('string')
      expect(DEFAULT_UTILIZATION_COLORS.inputTokens).toMatch(/^var\(--color-apex-\d+\)$/)

      expect(typeof DEFAULT_UTILIZATION_COLORS.outputTokens).toBe('string')
      expect(DEFAULT_UTILIZATION_COLORS.outputTokens).toMatch(/^var\(--color-apex-\d+\)$/)

      expect(typeof DEFAULT_UTILIZATION_COLORS.cost).toBe('string')
      expect(DEFAULT_UTILIZATION_COLORS.cost).toBe('var(--color-warning)')

      expect(typeof DEFAULT_UTILIZATION_COLORS.performance).toBe('string')
      expect(DEFAULT_UTILIZATION_COLORS.performance).toBe('var(--color-success)')
    })

    it('should have multiple agent colors available', () => {
      expect(Array.isArray(DEFAULT_UTILIZATION_COLORS.agentColors)).toBe(true)
      expect(DEFAULT_UTILIZATION_COLORS.agentColors.length).toBeGreaterThan(3)

      DEFAULT_UTILIZATION_COLORS.agentColors.forEach(color => {
        expect(typeof color).toBe('string')
        expect(color.length).toBeGreaterThan(0)
      })
    })
  })

  describe('AGENT_UTILIZATION_CHART_SIZES', () => {
    it('should have all size variants', () => {
      expect(AGENT_UTILIZATION_CHART_SIZES).toHaveProperty('sm')
      expect(AGENT_UTILIZATION_CHART_SIZES).toHaveProperty('md')
      expect(AGENT_UTILIZATION_CHART_SIZES).toHaveProperty('lg')
    })

    it('should have increasing dimensions from sm to lg', () => {
      const { sm, md, lg } = AGENT_UTILIZATION_CHART_SIZES

      expect(sm.height).toBeLessThan(md.height)
      expect(md.height).toBeLessThan(lg.height)

      expect(sm.barHeight).toBeLessThan(md.barHeight)
      expect(md.barHeight).toBeLessThan(lg.barHeight)

      expect(sm.labelWidth).toBeLessThan(md.labelWidth)
      expect(md.labelWidth).toBeLessThan(lg.labelWidth)

      expect(sm.padding).toBeLessThan(md.padding)
      expect(md.padding).toBeLessThan(lg.padding)

      expect(sm.fontSize).toBeLessThan(md.fontSize)
      expect(md.fontSize).toBeLessThan(lg.fontSize)
    })

    it('should have all required size properties', () => {
      Object.values(AGENT_UTILIZATION_CHART_SIZES).forEach(size => {
        expect(size).toHaveProperty('height')
        expect(size).toHaveProperty('barHeight')
        expect(size).toHaveProperty('labelWidth')
        expect(size).toHaveProperty('padding')
        expect(size).toHaveProperty('fontSize')

        expect(typeof size.height).toBe('number')
        expect(typeof size.barHeight).toBe('number')
        expect(typeof size.labelWidth).toBe('number')
        expect(typeof size.padding).toBe('number')
        expect(typeof size.fontSize).toBe('number')
      })
    })
  })

  describe('DEFAULT_AGENT_UTILIZATION_CHART_PROPS', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.variant).toBe('bar')
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.metric).toBe('tokens')
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.sortBy).toBe('tokens')
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.sortDirection).toBe('desc')
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.maxAgents).toBe(8)
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.height).toBe(240)
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.showLegend).toBe(true)
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.showTokenBreakdown).toBe(true)
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.showCost).toBe(true)
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.showPerformance).toBe(false)
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.animated).toBe(true)
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.loading).toBe(false)
      expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS.emptyMessage).toBe('No agent utilization data available')
    })

    it('should have all required default prop keys', () => {
      const expectedKeys = [
        'variant',
        'metric',
        'sortBy',
        'sortDirection',
        'maxAgents',
        'height',
        'showLegend',
        'showTokenBreakdown',
        'showCost',
        'showPerformance',
        'animated',
        'loading',
        'emptyMessage'
      ]

      expectedKeys.forEach(key => {
        expect(DEFAULT_AGENT_UTILIZATION_CHART_PROPS).toHaveProperty(key)
      })
    })
  })

  describe('EMPTY_AGENT_UTILIZATION_DATA', () => {
    it('should have empty/zero values for all fields', () => {
      expect(EMPTY_AGENT_UTILIZATION_DATA.agents).toEqual([])
      expect(EMPTY_AGENT_UTILIZATION_DATA.totalInputTokens).toBe(0)
      expect(EMPTY_AGENT_UTILIZATION_DATA.totalOutputTokens).toBe(0)
      expect(EMPTY_AGENT_UTILIZATION_DATA.totalTokens).toBe(0)
      expect(EMPTY_AGENT_UTILIZATION_DATA.totalEstimatedCost).toBe(0)
      expect(EMPTY_AGENT_UTILIZATION_DATA.totalDuration).toBe(0)
      expect(EMPTY_AGENT_UTILIZATION_DATA.avgTokensPerSecond).toBe(0)
      expect(EMPTY_AGENT_UTILIZATION_DATA.lastUpdated).toBeInstanceOf(Date)
    })

    it('should not have a time range defined', () => {
      expect(EMPTY_AGENT_UTILIZATION_DATA.timeRange).toBeUndefined()
    })
  })
})

// ============================================================================
// Chart Props Interface Tests
// ============================================================================

describe('AgentUtilizationChartProps Interface', () => {
  it('should accept minimal props with just data', () => {
    const minimalProps: AgentUtilizationChartProps = {
      data: EMPTY_AGENT_UTILIZATION_DATA,
    }

    expect(minimalProps.data).toBeDefined()
    expect(minimalProps.variant).toBeUndefined()
  })

  it('should accept all optional props', () => {
    const fullProps: AgentUtilizationChartProps = {
      data: EMPTY_AGENT_UTILIZATION_DATA,
      variant: 'stacked-bar',
      metric: 'cost',
      sortBy: 'tokensPerSecond',
      sortDirection: 'asc',
      maxAgents: 5,
      height: 300,
      showLegend: false,
      showTokenBreakdown: false,
      showCost: false,
      showPerformance: true,
      animated: false,
      colors: {
        inputTokens: '#custom1',
        agentColors: ['#red', '#blue'],
      },
      className: 'custom-chart',
      onAgentClick: (agent) => console.log(agent),
      onAgentHover: (agent) => console.log(agent),
      loading: true,
      error: 'Test error',
      emptyMessage: 'Custom empty message',
    }

    expect(fullProps.data).toBeDefined()
    expect(fullProps.variant).toBe('stacked-bar')
    expect(fullProps.metric).toBe('cost')
    expect(fullProps.sortBy).toBe('tokensPerSecond')
    expect(fullProps.sortDirection).toBe('asc')
    expect(fullProps.maxAgents).toBe(5)
    expect(fullProps.height).toBe(300)
    expect(fullProps.showLegend).toBe(false)
    expect(fullProps.showTokenBreakdown).toBe(false)
    expect(fullProps.showCost).toBe(false)
    expect(fullProps.showPerformance).toBe(true)
    expect(fullProps.animated).toBe(false)
    expect(fullProps.colors).toBeDefined()
    expect(fullProps.className).toBe('custom-chart')
    expect(typeof fullProps.onAgentClick).toBe('function')
    expect(typeof fullProps.onAgentHover).toBe('function')
    expect(fullProps.loading).toBe(true)
    expect(fullProps.error).toBe('Test error')
    expect(fullProps.emptyMessage).toBe('Custom empty message')
  })

  it('should support partial color configurations', () => {
    const propsWithPartialColors: AgentUtilizationChartProps = {
      data: EMPTY_AGENT_UTILIZATION_DATA,
      colors: {
        inputTokens: '#custom',
        // Other colors will use defaults
      },
    }

    expect(propsWithPartialColors.colors!.inputTokens).toBe('#custom')
    expect(propsWithPartialColors.colors!.outputTokens).toBeUndefined()
  })
})

// ============================================================================
// Helper Types Tests
// ============================================================================

describe('Helper Types', () => {
  describe('ProcessedAgentData', () => {
    it('should extend AgentUtilization with additional fields', () => {
      const processedData: ProcessedAgentData = {
        ...createMockAgentUtilization(),
        tokenPercentage: 25.5,
        costPercentage: 15.2,
        color: '#ff5733',
        displayName: 'Test Agent (Truncated)',
      }

      expect(typeof processedData.tokenPercentage).toBe('number')
      expect(typeof processedData.costPercentage).toBe('number')
      expect(typeof processedData.color).toBe('string')
      expect(typeof processedData.displayName).toBe('string')

      // Should still have all original AgentUtilization fields
      expect(processedData.agentId).toBeDefined()
      expect(processedData.agentName).toBeDefined()
      expect(processedData.inputTokens).toBeDefined()
    })
  })

  describe('AgentUtilizationTooltipData', () => {
    it('should have correct structure', () => {
      const tooltipData: AgentUtilizationTooltipData = {
        agent: createMockAgentUtilization(),
        position: { x: 100, y: 200 },
        visible: true,
      }

      expect(tooltipData.agent).toBeDefined()
      expect(tooltipData.position.x).toBe(100)
      expect(tooltipData.position.y).toBe(200)
      expect(tooltipData.visible).toBe(true)
    })
  })

  describe('AgentUtilizationSummary', () => {
    it('should support null top agent', () => {
      const summary: AgentUtilizationSummary = {
        agentCount: 0,
        topAgent: null,
        totalTokens: 0,
        totalCost: 0,
        avgThroughput: 0,
      }

      expect(summary.topAgent).toBe(null)
      expect(summary.agentCount).toBe(0)
    })

    it('should support defined top agent', () => {
      const summary: AgentUtilizationSummary = {
        agentCount: 3,
        topAgent: {
          name: 'Top Agent',
          tokens: 5000,
          percentage: 45.2,
        },
        totalTokens: 11000,
        totalCost: 0.25,
        avgThroughput: 15.5,
      }

      expect(summary.topAgent!.name).toBe('Top Agent')
      expect(summary.topAgent!.tokens).toBe(5000)
      expect(summary.topAgent!.percentage).toBe(45.2)
      expect(summary.agentCount).toBe(3)
    })
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  describe('Zero and Negative Values', () => {
    it('should handle zero token counts', () => {
      const utilization = createMockAgentUtilization({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        tokensPerSecond: 0,
        duration: 0,
        invocations: 0,
      })

      expect(utilization.inputTokens).toBe(0)
      expect(utilization.outputTokens).toBe(0)
      expect(utilization.totalTokens).toBe(0)
      expect(utilization.estimatedCost).toBe(0)
      expect(utilization.tokensPerSecond).toBe(0)
    })

    it('should handle very large token counts', () => {
      const utilization = createMockAgentUtilization({
        inputTokens: Number.MAX_SAFE_INTEGER,
        outputTokens: Number.MAX_SAFE_INTEGER,
        estimatedCost: 999999.99,
        duration: Number.MAX_SAFE_INTEGER,
      })

      expect(utilization.inputTokens).toBe(Number.MAX_SAFE_INTEGER)
      expect(utilization.outputTokens).toBe(Number.MAX_SAFE_INTEGER)
      expect(utilization.estimatedCost).toBe(999999.99)
    })

    it('should handle fractional values appropriately', () => {
      const utilization = createMockAgentUtilization({
        tokensPerSecond: 10.567891,
        estimatedCost: 0.00001,
        cacheHitRate: 0.8567,
        avgLatencyMs: 123.456,
      })

      expect(utilization.tokensPerSecond).toBeCloseTo(10.567891)
      expect(utilization.estimatedCost).toBeCloseTo(0.00001)
      expect(utilization.cacheHitRate).toBeCloseTo(0.8567)
      expect(utilization.avgLatencyMs).toBeCloseTo(123.456)
    })
  })

  describe('Empty Agent Collections', () => {
    it('should handle empty agents array', () => {
      const data = createMockAgentUtilizationData([])

      expect(data.agents).toEqual([])
      expect(data.totalInputTokens).toBe(0)
      expect(data.totalOutputTokens).toBe(0)
      expect(data.totalTokens).toBe(0)
      expect(data.totalEstimatedCost).toBe(0)
      expect(data.totalDuration).toBe(0)
      expect(data.avgTokensPerSecond).toBe(0)
    })

    it('should handle single agent', () => {
      const agent = createMockAgentUtilization({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01,
        duration: 1000,
        tokensPerSecond: 15,
      })
      const data = createMockAgentUtilizationData([agent])

      expect(data.agents).toHaveLength(1)
      expect(data.totalInputTokens).toBe(100)
      expect(data.totalOutputTokens).toBe(50)
      expect(data.totalTokens).toBe(150)
      expect(data.totalEstimatedCost).toBe(0.01)
      expect(data.totalDuration).toBe(1000)
      expect(data.avgTokensPerSecond).toBe(15)
    })
  })

  describe('String Length Limits', () => {
    it('should handle very long agent names', () => {
      const longName = 'a'.repeat(1000)
      const utilization = createMockAgentUtilization({
        agentName: longName,
      })

      expect(utilization.agentName).toBe(longName)
      expect(utilization.agentName.length).toBe(1000)
    })

    it('should handle empty agent names', () => {
      const utilization = createMockAgentUtilization({
        agentName: '',
        agentId: '',
      })

      expect(utilization.agentName).toBe('')
      expect(utilization.agentId).toBe('')
    })

    it('should handle special characters in names', () => {
      const specialName = 'Agent-123_v2.0 (Test) 🤖'
      const utilization = createMockAgentUtilization({
        agentName: specialName,
      })

      expect(utilization.agentName).toBe(specialName)
    })
  })

  describe('Date Handling', () => {
    it('should handle various date formats', () => {
      const now = new Date()
      const past = new Date('2023-01-01T00:00:00Z')
      const future = new Date('2025-12-31T23:59:59Z')

      const data = createMockAgentUtilizationData([], {
        timeRange: { start: past, end: future },
        lastUpdated: now,
      })

      expect(data.timeRange!.start).toEqual(past)
      expect(data.timeRange!.end).toEqual(future)
      expect(data.lastUpdated).toEqual(now)
    })

    it('should handle invalid date scenarios gracefully', () => {
      // TypeScript would prevent invalid dates, but test Date object behavior
      const invalidDate = new Date('invalid')
      const data = createMockAgentUtilizationData([], {
        lastUpdated: invalidDate,
      })

      expect(data.lastUpdated).toEqual(invalidDate)
      expect(isNaN(data.lastUpdated.getTime())).toBe(true)
    })
  })
})

// ============================================================================
// Performance and Memory Tests
// ============================================================================

describe('Performance Considerations', () => {
  it('should handle large agent collections efficiently', () => {
    const agents: AgentUtilization[] = []
    for (let i = 0; i < 1000; i++) {
      agents.push(createMockAgentUtilization({
        agentId: `agent-${i}`,
        agentName: `Agent ${i}`,
        inputTokens: Math.floor(Math.random() * 10000),
        outputTokens: Math.floor(Math.random() * 5000),
      }))
    }

    const startTime = performance.now()
    const data = createMockAgentUtilizationData(agents)
    const endTime = performance.now()

    expect(data.agents).toHaveLength(1000)
    expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
  })

  it('should maintain data consistency with many agents', () => {
    const agents = Array.from({ length: 100 }, (_, i) =>
      createMockAgentUtilization({
        agentId: `agent-${i}`,
        inputTokens: i * 10,
        outputTokens: i * 5,
        totalTokens: i * 15,
        estimatedCost: i * 0.001,
        duration: i * 100,
        tokensPerSecond: i + 1,
      })
    )

    const data = createMockAgentUtilizationData(agents)

    // Verify calculated totals
    expect(data.totalInputTokens).toBe(agents.reduce((sum, a) => sum + a.inputTokens, 0))
    expect(data.totalOutputTokens).toBe(agents.reduce((sum, a) => sum + a.outputTokens, 0))
    expect(data.totalTokens).toBe(agents.reduce((sum, a) => sum + a.totalTokens, 0))
    expect(data.totalEstimatedCost).toBeCloseTo(agents.reduce((sum, a) => sum + a.estimatedCost, 0))
    expect(data.totalDuration).toBe(agents.reduce((sum, a) => sum + a.duration, 0))
    expect(data.avgTokensPerSecond).toBeCloseTo(
      agents.reduce((sum, a) => sum + a.tokensPerSecond, 0) / agents.length
    )
  })

  it('should handle concurrent access patterns', () => {
    // Test object cloning/spreading for immutability
    const originalAgent = createMockAgentUtilization()
    const clonedAgent = { ...originalAgent }
    const modifiedAgent = { ...originalAgent, inputTokens: 999 }

    expect(originalAgent.inputTokens).not.toBe(999)
    expect(clonedAgent).toEqual(originalAgent)
    expect(modifiedAgent.inputTokens).toBe(999)
    expect(modifiedAgent.agentName).toBe(originalAgent.agentName)
  })
})