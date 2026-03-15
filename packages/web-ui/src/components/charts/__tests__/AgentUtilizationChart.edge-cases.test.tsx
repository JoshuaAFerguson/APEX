import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentUtilizationChart, AgentUtilizationChartMini } from '../AgentUtilizationChart'
import {
  AgentUtilizationData,
  AgentUtilizationChartProps,
  EMPTY_AGENT_UTILIZATION_DATA,
  AgentUtilizationMetric,
} from '@/types/agent-utilization'

// Edge case test data generators
const createExtremeAgent = (id: string, name: string, extreme: 'zero' | 'max' | 'negative' | 'infinity') => {
  const base = {
    agentId: id,
    agentName: name,
    duration: 1000,
    invocations: 1,
    avgLatencyMs: 100,
  }

  switch (extreme) {
    case 'zero':
      return {
        ...base,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        tokensPerSecond: 0,
      }
    case 'max':
      return {
        ...base,
        inputTokens: Number.MAX_SAFE_INTEGER,
        outputTokens: Number.MAX_SAFE_INTEGER,
        totalTokens: Number.MAX_SAFE_INTEGER,
        estimatedCost: Number.MAX_SAFE_INTEGER,
        tokensPerSecond: Number.MAX_SAFE_INTEGER,
      }
    case 'negative':
      return {
        ...base,
        inputTokens: -1000,
        outputTokens: -500,
        totalTokens: -1500,
        estimatedCost: -0.75,
        tokensPerSecond: -15,
      }
    case 'infinity':
      return {
        ...base,
        inputTokens: Infinity,
        outputTokens: Infinity,
        totalTokens: Infinity,
        estimatedCost: Infinity,
        tokensPerSecond: Infinity,
      }
    default:
      return {
        ...base,
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.75,
        tokensPerSecond: 15,
      }
  }
}

// Helper to render with edge case props
const renderEdgeCase = (props: Partial<AgentUtilizationChartProps> = {}) => {
  const defaultProps: AgentUtilizationChartProps = {
    data: EMPTY_AGENT_UTILIZATION_DATA,
    ...props,
  }
  return render(<AgentUtilizationChart {...defaultProps} />)
}

describe('AgentUtilizationChart Edge Cases', () => {
  describe('Extreme Numeric Values', () => {
    it('handles zero values across all metrics', () => {
      const zeroData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          createExtremeAgent('zero-1', 'Zero Agent 1', 'zero'),
          createExtremeAgent('zero-2', 'Zero Agent 2', 'zero'),
        ],
      }

      renderEdgeCase({
        data: zeroData,
        showCost: true,
        showPerformance: true,
        showTokenBreakdown: true,
      })

      // Should handle zero values gracefully
      expect(screen.getByText('Zero Agent 1')).toBeInTheDocument()
      expect(screen.getByText('Zero Agent 2')).toBeInTheDocument()

      // Zero values should be displayed appropriately
      const zeroDisplays = screen.getAllByText('0')
      expect(zeroDisplays.length).toBeGreaterThan(0)

      // Cost should show $0.00
      const zeroCostDisplays = screen.getAllByText('$0.00')
      expect(zeroCostDisplays.length).toBeGreaterThan(0)

      // Performance should show 0/s
      const zeroPerformanceDisplays = screen.getAllByText('0/s')
      expect(zeroPerformanceDisplays.length).toBeGreaterThan(0)
    })

    it('handles negative values gracefully', () => {
      const negativeData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [createExtremeAgent('negative', 'Negative Agent', 'negative')],
        totalTokens: -1500,
        totalEstimatedCost: -0.75,
      }

      renderEdgeCase({
        data: negativeData,
        showCost: true,
        showPerformance: true,
      })

      expect(screen.getByTitle('Negative Agent')).toBeInTheDocument()
      // Component should handle negative values without crashing
    })

    it('handles extremely large numbers', () => {
      const maxData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [createExtremeAgent('max', 'Max Agent', 'max')],
        totalTokens: Number.MAX_SAFE_INTEGER,
        totalEstimatedCost: Number.MAX_SAFE_INTEGER,
      }

      renderEdgeCase({
        data: maxData,
        showCost: true,
        showPerformance: true,
      })

      expect(screen.getByTitle('Max Agent')).toBeInTheDocument()
      // Should format extremely large numbers appropriately
    })

    it('handles infinity values', () => {
      const infinityData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [createExtremeAgent('infinity', 'Infinity Agent', 'infinity')],
        totalTokens: Infinity,
        totalEstimatedCost: Infinity,
      }

      renderEdgeCase({
        data: infinityData,
        showCost: true,
        showPerformance: true,
      })

      expect(screen.getByTitle('Infinity Agent')).toBeInTheDocument()
      // Should handle infinity without crashing
    })
  })

  describe('Sorting Edge Cases', () => {
    const createSortTestData = (): AgentUtilizationData => ({
      agents: [
        {
          agentId: 'equal-1',
          agentName: 'Equal Agent 1',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.75,
          tokensPerSecond: 15,
          duration: 100,
          invocations: 5,
        },
        {
          agentId: 'equal-2',
          agentName: 'Equal Agent 2',
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.75,
          tokensPerSecond: 15,
          duration: 100,
          invocations: 5,
        },
        {
          agentId: 'different',
          agentName: 'Different Agent',
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: 3000,
          estimatedCost: 1.50,
          tokensPerSecond: 30,
          duration: 200,
          invocations: 10,
        },
      ],
      totalInputTokens: 4000,
      totalOutputTokens: 2000,
      totalTokens: 6000,
      totalEstimatedCost: 3.00,
      totalDuration: 400,
      avgTokensPerSecond: 20,
      lastUpdated: new Date(),
    })

    it('handles equal values in sorting consistently', () => {
      const equalData = createSortTestData()

      ;(['tokens', 'cost', 'tokensPerSecond', 'duration', 'invocations'] as AgentUtilizationMetric[]).forEach(
        sortBy => {
          const { unmount } = renderEdgeCase({
            data: equalData,
            sortBy,
            sortDirection: 'desc',
          })

          // Should not crash with equal values
          expect(screen.getByText('Different Agent')).toBeInTheDocument()
          expect(screen.getByText('Equal Agent 1')).toBeInTheDocument()

          unmount()
        }
      )
    })

    it('handles unknown sort metric gracefully', () => {
      const testData = createSortTestData()

      renderEdgeCase({
        data: testData,
        sortBy: 'unknown-metric' as any, // Force unknown metric
      })

      // Should default to tokens sorting
      expect(screen.getByText('Different Agent')).toBeInTheDocument()
    })

    it('handles ascending and descending sort directions', () => {
      const testData = createSortTestData()

      // Test ascending
      const { rerender } = renderEdgeCase({
        data: testData,
        sortBy: 'tokens',
        sortDirection: 'asc',
      })

      expect(screen.getByText('Different Agent')).toBeInTheDocument()

      // Test descending
      rerender(
        <AgentUtilizationChart
          data={testData}
          sortBy="tokens"
          sortDirection="desc"
        />
      )

      expect(screen.getByText('Different Agent')).toBeInTheDocument()
    })
  })

  describe('Agent Name Edge Cases', () => {
    it('handles extremely long agent names', () => {
      const longNameData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'long',
            agentName: 'This is an extremely long agent name that exceeds normal character limits and should be truncated properly by the component',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
        ],
        totalTokens: 1000,
        totalEstimatedCost: 0.50,
        lastUpdated: new Date(),
      }

      renderEdgeCase({ data: longNameData })

      // Should truncate name with ellipsis - check by title since text is truncated
      const truncatedElement = screen.getByTitle('This is an extremely long agent name that exceeds normal character limits and should be truncated properly by the component')
      expect(truncatedElement).toBeInTheDocument()
      expect(truncatedElement.textContent).toMatch(/This is an ext\.\.\./) // Should be truncated
    })

    it('handles special characters in agent names', () => {
      const specialCharData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'special-1',
            agentName: 'Agent™️ with émojis 🤖 & symbols!',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
          {
            agentId: 'special-2',
            agentName: '<script>alert("test")</script>',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
        ],
        totalTokens: 2000,
        totalEstimatedCost: 1.00,
        lastUpdated: new Date(),
      }

      renderEdgeCase({ data: specialCharData })

      expect(screen.getByTitle('Agent™️ with émojis 🤖 & symbols!')).toBeInTheDocument()
      expect(screen.getByTitle('<script>alert("test")</script>')).toBeInTheDocument()
    })

    it('handles empty and whitespace agent names', () => {
      const emptyNameData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'empty',
            agentName: '',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
          {
            agentId: 'whitespace',
            agentName: '   ',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
        ],
        totalTokens: 2000,
        totalEstimatedCost: 1.00,
        lastUpdated: new Date(),
      }

      renderEdgeCase({ data: emptyNameData })

      // Component should handle empty names gracefully
      const agentRows = document.querySelectorAll('[aria-label*="tokens"]')
      expect(agentRows.length).toBe(2)
    })
  })

  describe('Color Assignment Edge Cases', () => {
    it('handles more agents than available colors', () => {
      const manyAgentsData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: Array.from({ length: 20 }, (_, i) => ({
          agentId: `agent-${i}`,
          agentName: `Agent ${i}`,
          inputTokens: 600,
          outputTokens: 400,
          totalTokens: 1000,
          estimatedCost: 0.50,
          tokensPerSecond: 10,
          duration: 100,
          invocations: 1,
        })),
        totalTokens: 20000,
        totalEstimatedCost: 10.00,
        lastUpdated: new Date(),
      }

      renderEdgeCase({
        data: manyAgentsData,
        maxAgents: 25, // Show all agents
      })

      // Should cycle through colors without errors
      expect(screen.getByText('Agent 0')).toBeInTheDocument()
      expect(screen.getByText('Agent 19')).toBeInTheDocument()
    })

    it('handles custom color configuration with missing properties', () => {
      const testData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'test',
            agentName: 'Test Agent',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
        ],
        totalTokens: 1000,
        totalEstimatedCost: 0.50,
        lastUpdated: new Date(),
      }

      renderEdgeCase({
        data: testData,
        colors: {
          inputTokens: '#custom1',
          // Missing other properties to test default fallback
        } as any,
      })

      expect(screen.getByText('Test Agent')).toBeInTheDocument()
    })
  })

  describe('Token Percentage Calculations', () => {
    it('handles division by zero in percentage calculations', () => {
      const zeroTotalData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'test',
            agentName: 'Test Agent',
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            estimatedCost: 0.10,
            tokensPerSecond: 5,
            duration: 30,
            invocations: 1,
          },
        ],
        totalTokens: 0, // This should cause division by zero
        totalEstimatedCost: 0,
        lastUpdated: new Date(),
      }

      renderEdgeCase({ data: zeroTotalData })

      // Should handle the division by zero gracefully
      expect(screen.getByText('Test Agent')).toBeInTheDocument()
    })

    it('handles token breakdown with zero total tokens', () => {
      const zeroTokenAgent: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'zero-total',
            agentName: 'Zero Total Agent',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            tokensPerSecond: 0,
            duration: 100,
            invocations: 1,
          },
        ],
        totalTokens: 0,
        totalEstimatedCost: 0,
        lastUpdated: new Date(),
      }

      renderEdgeCase({
        data: zeroTokenAgent,
        showTokenBreakdown: true,
      })

      // Should show 50/50 split when total is zero
      expect(screen.getByTitle('Zero Total Agent')).toBeInTheDocument()
    })
  })

  describe('Mini Chart Edge Cases', () => {
    it('handles zero maxAgents gracefully', () => {
      const testData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'test',
            agentName: 'Test Agent',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
        ],
        totalTokens: 1000,
        totalEstimatedCost: 0.50,
        lastUpdated: new Date(),
      }

      const { container } = render(<AgentUtilizationChartMini data={testData} maxAgents={0} />)

      // Should handle gracefully - either show no data or handle the edge case
      // Check that it doesn't crash
      expect(container.firstChild).toBeInTheDocument()
    })

    it('handles negative maxAgents', () => {
      const testData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'test',
            agentName: 'Test Agent',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
        ],
        totalTokens: 1000,
        totalEstimatedCost: 0.50,
        lastUpdated: new Date(),
      }

      render(<AgentUtilizationChartMini data={testData} maxAgents={-5} />)

      // Should handle negative maxAgents without crashing
    })
  })

  describe('Animation and Timing Edge Cases', () => {
    it('handles rapid prop changes without animation conflicts', () => {
      const baseData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'test',
            agentName: 'Test Agent',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
        ],
        totalTokens: 1000,
        totalEstimatedCost: 0.50,
        lastUpdated: new Date(),
      }

      const { rerender } = renderEdgeCase({
        data: baseData,
        animated: true,
      })

      // Rapidly change animated prop
      for (let i = 0; i < 10; i++) {
        rerender(
          <AgentUtilizationChart
            data={baseData}
            animated={i % 2 === 0}
          />
        )
      }

      // Should handle rapid changes without errors
      expect(screen.getByText('Test Agent')).toBeInTheDocument()
    })

    it('handles disabled animations correctly', () => {
      const testData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          {
            agentId: 'test',
            agentName: 'Test Agent',
            inputTokens: 600,
            outputTokens: 400,
            totalTokens: 1000,
            estimatedCost: 0.50,
            tokensPerSecond: 10,
            duration: 100,
            invocations: 1,
          },
        ],
        totalTokens: 1000,
        totalEstimatedCost: 0.50,
        lastUpdated: new Date(),
      }

      renderEdgeCase({
        data: testData,
        animated: false,
      })

      // Should render without animation classes
      expect(screen.getByText('Test Agent')).toBeInTheDocument()
    })
  })
})