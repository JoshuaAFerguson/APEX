/**
 * Additional basic tests for AgentUtilizationWidget dashboard component
 *
 * These tests complement the existing test suite with additional coverage
 * for scenarios not fully covered in the main test files.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentUtilizationWidget } from '../AgentUtilizationWidget'
import {
  createMockAgentMetrics,
  createMockAgentMetricsData,
  createMockAgent,
} from './__mocks__/widget-test-utils'

// Mock the useAgentMetrics hook
vi.mock('@/hooks/useAgentMetrics', () => ({
  useAgentMetrics: vi.fn(),
}))

import { useAgentMetrics } from '@/hooks/useAgentMetrics'

describe('AgentUtilizationWidget - Additional Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Agent Data Sorting and Display', () => {
    it('displays agents sorted by token usage (highest first)', () => {
      const agents = [
        createMockAgent('low', 'Low Usage Agent', 1000, 0.05),
        createMockAgent('high', 'High Usage Agent', 8000, 0.40),
        createMockAgent('medium', 'Medium Usage Agent', 4000, 0.20),
      ]

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(agents),
        })
      )

      render(<AgentUtilizationWidget />)

      // Top agent should be the high usage one
      expect(screen.getByText(/Top: High Usage Agent/)).toBeInTheDocument()
      expect(screen.getByText(/62%/)).toBeInTheDocument() // 8000/(8000+4000+1000) ≈ 62%
    })

    it('handles agents with identical token counts', () => {
      const identicalAgents = [
        createMockAgent('agent1', 'Agent One', 5000, 0.25),
        createMockAgent('agent2', 'Agent Two', 5000, 0.25),
        createMockAgent('agent3', 'Agent Three', 5000, 0.25),
      ]

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(identicalAgents),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should handle ties gracefully - first agent lexicographically or by ID
      expect(screen.getByText('3 active')).toBeInTheDocument()
      expect(screen.getByText(/33%/)).toBeInTheDocument() // 5000/15000 = 33%
    })
  })

  describe('Token Count Formatting', () => {
    it('formats different token count ranges correctly', () => {
      const tokenRanges = [
        { tokens: 999, expected: '999' },
        { tokens: 1500, expected: '1.5K' },
        { tokens: 25000, expected: '25.0K' },
        { tokens: 999999, expected: '1000.0K' },
        { tokens: 1500000, expected: '1.5M' },
        { tokens: 25000000, expected: '25.0M' },
      ]

      tokenRanges.forEach(({ tokens, expected }, index) => {
        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({
            metrics: createMockAgentMetricsData([
              createMockAgent(`agent${index}`, `Agent ${index}`, tokens, 0.25),
            ]),
          })
        )

        const { unmount } = render(<AgentUtilizationWidget />)

        expect(screen.getByText(expected)).toBeInTheDocument()

        unmount()
      })
    })

    it('handles zero and negative token counts', () => {
      const edgeAgents = [
        createMockAgent('zero', 'Zero Agent', 0, 0),
        { ...createMockAgent('negative', 'Negative Agent', 0, 0), totalTokens: -1000 },
        createMockAgent('positive', 'Positive Agent', 5000, 0.25),
      ]

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(edgeAgents),
        })
      )

      render(<AgentUtilizationWidget />)

      // Only positive agent should count as active
      expect(screen.getByText('1 active')).toBeInTheDocument()
      expect(screen.getByText('Positive Agent')).toBeInTheDocument()
    })
  })

  describe('Cost Display Features', () => {
    it('toggles cost display correctly', () => {
      const agent = createMockAgent('coder', 'Coder', 5000, 0.25)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([agent]),
        })
      )

      // Test with cost display enabled
      const { rerender } = render(
        <AgentUtilizationWidget showCost={true} />
      )

      expect(screen.getByText('$0.25')).toBeInTheDocument()

      // Test with cost display disabled
      rerender(<AgentUtilizationWidget showCost={false} />)

      expect(screen.queryByText('$0.25')).not.toBeInTheDocument()
    })

    it('formats different cost ranges correctly', () => {
      const costRanges = [
        { cost: 0.001, expected: '$0.00' },
        { cost: 0.156, expected: '$0.16' },
        { cost: 1.234, expected: '$1.23' },
        { cost: 999.999, expected: '$1,000.00' },
      ]

      costRanges.forEach(({ cost, expected }, index) => {
        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({
            metrics: createMockAgentMetricsData([
              createMockAgent(`agent${index}`, `Agent ${index}`, 1000, cost),
            ]),
          })
        )

        render(<AgentUtilizationWidget showCost={true} />)

        expect(screen.getByText(expected)).toBeInTheDocument()
      })
    })
  })

  describe('Performance Metrics Display', () => {
    it('shows performance metrics when enabled', () => {
      const agentWithPerf = {
        ...createMockAgent('perf', 'Performance Agent', 5000, 0.25),
        tokensPerSecond: 42.5,
      }

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([agentWithPerf]),
        })
      )

      render(<AgentUtilizationWidget showPerformance={true} />)

      // Should show tokens per second
      expect(screen.getByText(/42\.5.*\/s/)).toBeInTheDocument()
    })

    it('hides performance metrics when disabled', () => {
      const agentWithPerf = {
        ...createMockAgent('perf', 'Performance Agent', 5000, 0.25),
        tokensPerSecond: 42.5,
      }

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([agentWithPerf]),
        })
      )

      render(<AgentUtilizationWidget showPerformance={false} />)

      // Should not show tokens per second
      expect(screen.queryByText(/\/s/)).not.toBeInTheDocument()
    })
  })

  describe('Token Breakdown Display', () => {
    it('shows input/output token breakdown when enabled', () => {
      const agent = createMockAgent('breakdown', 'Breakdown Agent', 10000, 0.50)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([agent]),
        })
      )

      render(<AgentUtilizationWidget showTokenBreakdown={true} />)

      // Should show input and output token labels
      expect(screen.getByText('Input Tokens')).toBeInTheDocument()
      expect(screen.getByText('Output Tokens')).toBeInTheDocument()
    })

    it('hides token breakdown when disabled', () => {
      const agent = createMockAgent('breakdown', 'Breakdown Agent', 10000, 0.50)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([agent]),
        })
      )

      render(<AgentUtilizationWidget showTokenBreakdown={false} />)

      // Should not show input and output token labels
      expect(screen.queryByText('Input Tokens')).not.toBeInTheDocument()
      expect(screen.queryByText('Output Tokens')).not.toBeInTheDocument()
    })
  })

  describe('MaxAgents Limitation', () => {
    it('limits display to maxAgents count', () => {
      const manyAgents = Array.from({ length: 10 }, (_, i) =>
        createMockAgent(`agent${i}`, `Agent ${i}`, (10 - i) * 1000, (10 - i) * 0.05)
      )

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(manyAgents),
        })
      )

      render(<AgentUtilizationWidget maxAgents={3} />)

      // Should show count for all active agents
      expect(screen.getByText('10 active')).toBeInTheDocument()

      // But should only display top 3 agents or group others
      expect(screen.getByText('Agent 0')).toBeInTheDocument() // Top agent
      expect(screen.getByText('Agent 1')).toBeInTheDocument() // Second agent

      // May show grouped "Others" or just limit display
      const displayedAgents = screen.queryByText('Agent 9')
      // Agent 9 (lowest usage) should not be displayed individually
      expect(displayedAgents).not.toBeInTheDocument()
    })

    it('handles maxAgents=0 gracefully', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('test', 'Test Agent', 5000, 0.25),
          ]),
        })
      )

      render(<AgentUtilizationWidget maxAgents={0} />)

      // Should still render the widget header
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })
  })

  describe('Agent Click Handling', () => {
    it('calls onAgentClick with correct agent data', () => {
      const onAgentClick = vi.fn()
      const agent = createMockAgent('clickable', 'Clickable Agent', 8000, 0.40)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([agent]),
        })
      )

      render(<AgentUtilizationWidget onAgentClick={onAgentClick} />)

      const agentElement = screen.getByText('Clickable Agent').closest('.group')
      if (agentElement) {
        fireEvent.click(agentElement)
      }

      expect(onAgentClick).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: 'Clickable Agent',
          totalTokens: 8000,
          estimatedCost: 0.40,
        })
      )
    })

    it('does not crash when onAgentClick is not provided', () => {
      const agent = createMockAgent('clickable', 'Clickable Agent', 8000, 0.40)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([agent]),
        })
      )

      render(<AgentUtilizationWidget />)

      const agentElement = screen.getByText('Clickable Agent').closest('.group')

      // Should not crash when clicking without handler
      expect(() => {
        if (agentElement) {
          fireEvent.click(agentElement)
        }
      }).not.toThrow()
    })
  })

  describe('Widget Configuration', () => {
    it('applies custom height setting', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget height={500} />)

      // Chart should exist (actual height would be set via CSS)
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      const customClass = 'my-custom-agent-widget'
      const { container } = render(
        <AgentUtilizationWidget className={customClass} />
      )

      expect(container.querySelector(`.${customClass}`)).toBeInTheDocument()
    })

    it('combines all display options correctly', () => {
      const agent = createMockAgent('full', 'Full Feature Agent', 5000, 0.25)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([agent]),
        })
      )

      render(
        <AgentUtilizationWidget
          showCost={true}
          showPerformance={true}
          showTokenBreakdown={true}
          maxAgents={5}
          height={400}
        />
      )

      // All features should be visible
      expect(screen.getByText('$0.25')).toBeInTheDocument() // Cost
      expect(screen.getByText(/\/s/)).toBeInTheDocument() // Performance
      expect(screen.getByText('Input Tokens')).toBeInTheDocument() // Token breakdown
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument() // Widget title
    })
  })

  describe('Summary Statistics Accuracy', () => {
    it('calculates active agent count correctly with mixed activity', () => {
      const mixedAgents = [
        createMockAgent('active1', 'Active Agent 1', 5000, 0.25),
        createMockAgent('inactive1', 'Inactive Agent 1', 0, 0),
        createMockAgent('active2', 'Active Agent 2', 3000, 0.15),
        createMockAgent('inactive2', 'Inactive Agent 2', 0, 0),
        createMockAgent('active3', 'Active Agent 3', 1000, 0.05),
      ]

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(mixedAgents),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should count only agents with non-zero tokens
      expect(screen.getByText('3 active')).toBeInTheDocument()
    })

    it('calculates top agent percentage correctly', () => {
      const agents = [
        createMockAgent('agent1', 'Agent 1', 2000, 0.10), // 20%
        createMockAgent('agent2', 'Agent 2', 5000, 0.25), // 50%  <- Top
        createMockAgent('agent3', 'Agent 3', 3000, 0.15), // 30%
      ]

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(agents),
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText(/Top: Agent 2/)).toBeInTheDocument()
      expect(screen.getByText(/50%/)).toBeInTheDocument() // 5000/(2000+5000+3000) = 50%
    })
  })
})