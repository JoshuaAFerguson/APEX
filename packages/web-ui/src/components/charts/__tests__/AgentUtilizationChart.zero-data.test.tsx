import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentUtilizationChart, AgentUtilizationChartMini } from '../AgentUtilizationChart'
import {
  AgentUtilization,
  AgentUtilizationData,
  EMPTY_AGENT_UTILIZATION_DATA,
} from '@/types/agent-utilization'

/**
 * Zero-Data State Testing Suite for AgentUtilizationChart
 *
 * Tests the acceptance criteria:
 * (1) Empty agents array
 * (2) Agents with zero tokens
 * (3) Missing/undefined data fields
 * (4) Shows appropriate empty state message matching existing TokenUsageChart pattern
 */

// Helper to create agent with zero values
const createZeroAgent = (id: string, name: string): AgentUtilization => ({
  agentId: id,
  agentName: name,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  estimatedCost: 0,
  tokensPerSecond: 0,
  duration: 1000, // Non-zero to show agent was active
  invocations: 1, // Non-zero to show agent was used
})

// Helper to create agent with undefined/missing fields
const createAgentWithUndefinedFields = (id: string, name: string): AgentUtilization => ({
  agentId: id,
  agentName: name,
  inputTokens: undefined as any, // Missing field
  outputTokens: undefined as any, // Missing field
  totalTokens: undefined as any, // Missing field
  estimatedCost: undefined as any, // Missing field
  tokensPerSecond: undefined as any, // Missing field
  duration: 1000,
  invocations: 1,
})

describe('AgentUtilizationChart Zero-Data State Tests', () => {
  describe('Acceptance Criteria: (1) Empty agents array', () => {
    it('shows custom empty message when no agents exist', () => {
      const customMessage = 'No agents configured'

      render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          emptyMessage={customMessage}
        />
      )

      expect(screen.getByText(customMessage)).toBeInTheDocument()

      // Should not show any agent-related content
      expect(screen.queryByRole('img', { name: /Agent utilization chart/ })).not.toBeInTheDocument()
    })

    it('shows default empty message when no agents exist and no custom message provided', () => {
      render(<AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} />)

      expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()
    })

    it('maintains proper styling and layout when no agents exist', () => {
      const { container } = render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          height={300}
          className="custom-class"
        />
      )

      const emptyStateContainer = container.firstChild as HTMLElement
      expect(emptyStateContainer).toHaveClass('custom-class')
      expect(emptyStateContainer).toHaveStyle({ height: '300px' })
      expect(emptyStateContainer).toHaveClass('flex', 'items-center', 'justify-center')
    })

    it('handles empty agents array with various chart configurations', () => {
      const configs = [
        { showCost: true, showPerformance: true, showLegend: true },
        { showTokenBreakdown: false, animated: false },
        { maxAgents: 10, sortBy: 'cost' as const },
      ]

      configs.forEach((config, index) => {
        const { unmount } = render(
          <AgentUtilizationChart
            data={EMPTY_AGENT_UTILIZATION_DATA}
            {...config}
          />
        )

        // Should show empty message regardless of configuration
        expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()

        unmount()
      })
    })
  })

  describe('Acceptance Criteria: (2) Agents with zero tokens', () => {
    it('displays agents with zero tokens in the chart', () => {
      const zeroTokenData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [
          createZeroAgent('agent1', 'Agent One'),
          createZeroAgent('agent2', 'Agent Two'),
        ],
        totalTokens: 0,
        totalEstimatedCost: 0,
      }

      render(<AgentUtilizationChart data={zeroTokenData} />)

      // Component shows agents even with zero tokens - they are valid data points
      expect(screen.getByText('Agent One')).toBeInTheDocument()
      expect(screen.getByText('Agent Two')).toBeInTheDocument()

      // Should show the chart with zero values displayed
      const chartContainer = screen.getByRole('img')
      expect(chartContainer).toBeInTheDocument()
    })

    it('handles mixed scenario: some agents with zero tokens, some with data', () => {
      const mixedData: AgentUtilizationData = {
        agents: [
          createZeroAgent('zero1', 'Zero Agent 1'),
          createZeroAgent('zero2', 'Zero Agent 2'),
          {
            agentId: 'active1',
            agentName: 'Active Agent',
            inputTokens: 500,
            outputTokens: 300,
            totalTokens: 800,
            estimatedCost: 0.04,
            tokensPerSecond: 10,
            duration: 2000,
            invocations: 2,
          },
        ],
        totalInputTokens: 500,
        totalOutputTokens: 300,
        totalTokens: 800,
        totalEstimatedCost: 0.04,
        totalDuration: 5000,
        avgTokensPerSecond: 10,
        lastUpdated: new Date(),
      }

      render(<AgentUtilizationChart data={mixedData} showCost={true} />)

      // Should show the chart with all agents
      expect(screen.getByText('Zero Agent 1')).toBeInTheDocument()
      expect(screen.getByText('Zero Agent 2')).toBeInTheDocument()
      expect(screen.getByText('Active Agent')).toBeInTheDocument()

      // Should display zero values properly
      const zeroTokensElements = screen.getAllByText('0')
      expect(zeroTokensElements.length).toBeGreaterThan(0)

      // Should display zero costs properly
      const zeroCostElements = screen.getAllByText('$0.00')
      expect(zeroCostElements.length).toBeGreaterThan(0)
    })

    it('handles zero tokens with percentage calculations', () => {
      const zeroWithTotalData: AgentUtilizationData = {
        agents: [
          createZeroAgent('zero', 'Zero Agent'),
          {
            agentId: 'active',
            agentName: 'Active Agent',
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            estimatedCost: 0.075,
            tokensPerSecond: 15,
            duration: 2000,
            invocations: 3,
          },
        ],
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        totalTokens: 1500,
        totalEstimatedCost: 0.075,
        totalDuration: 4000,
        avgTokensPerSecond: 15,
        lastUpdated: new Date(),
      }

      render(<AgentUtilizationChart data={zeroWithTotalData} />)

      // Zero agent should still be displayed
      expect(screen.getByText('Zero Agent')).toBeInTheDocument()
      expect(screen.getByText('Active Agent')).toBeInTheDocument()

      // Bars should handle zero width gracefully
      const zeroAgentBar = screen.getByText('Zero Agent').closest('.group')
      expect(zeroAgentBar).toBeInTheDocument()
    })

    it('handles zero tokens with token breakdown enabled', () => {
      const zeroData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [createZeroAgent('zero', 'Zero Agent')],
      }

      render(
        <AgentUtilizationChart
          data={zeroData}
          showTokenBreakdown={true}
          showLegend={true}
        />
      )

      // Agent with zero tokens is still displayed (valid data point)
      expect(screen.getByText('Zero Agent')).toBeInTheDocument()

      // Legend should be shown when showLegend and showTokenBreakdown are both true
      expect(screen.getByText('Input Tokens')).toBeInTheDocument()
      expect(screen.getByText('Output Tokens')).toBeInTheDocument()
    })
  })

  describe('Acceptance Criteria: (3) Missing/undefined data fields', () => {
    it('handles undefined numeric fields gracefully', () => {
      const undefinedFieldsData: AgentUtilizationData = {
        agents: [
          createAgentWithUndefinedFields('undefined1', 'Undefined Agent 1'),
          createAgentWithUndefinedFields('undefined2', 'Undefined Agent 2'),
        ],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalDuration: 2000,
        avgTokensPerSecond: 0,
        lastUpdated: new Date(),
      }

      // Component should handle undefined numeric fields gracefully by defaulting to 0
      render(
        <AgentUtilizationChart
          data={undefinedFieldsData}
          showCost={true}
          showPerformance={true}
        />
      )

      // Should display the agents with zero values
      expect(screen.getByText('Undefined Agent 1')).toBeInTheDocument()
      expect(screen.getByText('Undefined Agent 2')).toBeInTheDocument()

      // Should show zero values for undefined fields
      const zeroElements = screen.getAllByText('0')
      expect(zeroElements.length).toBeGreaterThan(0)
    })

    it('handles agents with consistent zero values', () => {
      // Use valid data with zero values (not undefined)
      const zeroValueAgent: AgentUtilization = {
        agentId: 'zero-values',
        agentName: 'Zero Value Agent',
        inputTokens: 500,
        outputTokens: 0, // Zero, not undefined
        totalTokens: 500,
        estimatedCost: 0, // Zero, not undefined
        tokensPerSecond: 10,
        duration: 1000,
        invocations: 1,
      }

      const zeroValueData: AgentUtilizationData = {
        agents: [zeroValueAgent],
        totalInputTokens: 500,
        totalOutputTokens: 0,
        totalTokens: 500,
        totalEstimatedCost: 0,
        totalDuration: 1000,
        avgTokensPerSecond: 10,
        lastUpdated: new Date(),
      }

      render(
        <AgentUtilizationChart
          data={zeroValueData}
          showCost={true}
          showPerformance={true}
        />
      )

      // Should display the agent
      expect(screen.getByText('Zero Value Agent')).toBeInTheDocument()

      // Should display zero cost correctly
      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })

    it('handles null agent names', () => {
      const nullNameAgent: AgentUtilization = {
        agentId: 'null-name',
        agentName: null as any, // Null name
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01,
        tokensPerSecond: 5,
        duration: 1000,
        invocations: 1,
      }

      const nullNameData: AgentUtilizationData = {
        agents: [nullNameAgent],
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalTokens: 150,
        totalEstimatedCost: 0.01,
        totalDuration: 1000,
        avgTokensPerSecond: 5,
        lastUpdated: new Date(),
      }

      render(<AgentUtilizationChart data={nullNameData} />)

      // Should handle null name gracefully
      const agentRows = document.querySelectorAll('[aria-label*="tokens"]')
      expect(agentRows.length).toBe(1)
    })

    it('handles undefined/null data gracefully', () => {
      // Component should handle undefined/null data gracefully by showing empty state
      const { rerender } = render(<AgentUtilizationChart data={undefined as any} />)
      expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()

      rerender(<AgentUtilizationChart data={null as any} />)
      expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()
    })
  })

  describe('Acceptance Criteria: (4) Shows appropriate empty state message matching TokenUsageChart pattern', () => {
    it('matches TokenUsageChart pattern for no data', () => {
      // Empty agents array shows default empty message
      const { rerender } = render(
        <AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} />
      )

      expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()

      // Agents with zero tokens are still displayed (they are valid data points)
      const zeroTokenData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [createZeroAgent('test', 'Test Agent')],
      }

      rerender(<AgentUtilizationChart data={zeroTokenData} />)

      // Agent is displayed even with zero tokens
      expect(screen.getByText('Test Agent')).toBeInTheDocument()
    })

    it('uses consistent styling with TokenUsageChart empty state', () => {
      render(<AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} />)

      const emptyState = screen.getByText('No agent utilization data available')
      const container = emptyState.closest('div')

      // Should have similar classes to TokenUsageChart empty state
      expect(container).toHaveClass('text-foreground-secondary')
      expect(container).toHaveClass('flex', 'items-center', 'justify-center')
      expect(emptyState).toHaveClass('text-sm')
    })

    it('maintains consistent empty state behavior across different props', () => {
      const testConfigs = [
        { loading: false, error: null },
        { showCost: true, showPerformance: true },
        { animated: false, showLegend: false },
        { height: 400, maxAgents: 5 },
      ]

      testConfigs.forEach((config, index) => {
        const { unmount } = render(
          <AgentUtilizationChart
            data={EMPTY_AGENT_UTILIZATION_DATA}
            {...config}
          />
        )

        // Should consistently show the same empty message
        expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()

        unmount()
      })
    })
  })

  describe('Mini Chart Zero-Data State Tests', () => {
    it('shows "No data" for empty agents array', () => {
      render(<AgentUtilizationChartMini data={EMPTY_AGENT_UTILIZATION_DATA} />)

      expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('displays agents with zero tokens in mini chart', () => {
      const zeroData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        agents: [createZeroAgent('zero', 'Zero Agent')],
      }

      render(<AgentUtilizationChartMini data={zeroData} />)

      // Agent with zero tokens is still displayed
      expect(screen.getByText('Zero Agent')).toBeInTheDocument()
    })

    it('handles undefined data gracefully', () => {
      // Mini chart should handle undefined data gracefully
      render(<AgentUtilizationChartMini data={undefined as any} />)
      expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('maintains consistent mini chart styling for empty state', () => {
      const { container } = render(
        <AgentUtilizationChartMini
          data={EMPTY_AGENT_UTILIZATION_DATA}
          className="custom-mini-class"
        />
      )

      const emptyState = container.firstChild as HTMLElement
      expect(emptyState).toHaveClass('text-center', 'py-4', 'text-foreground-secondary')
      expect(emptyState).toHaveClass('custom-mini-class')
    })
  })

  describe('Error State vs Empty State Distinction', () => {
    it('shows error state instead of empty state when error prop is provided', () => {
      render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          error="Network error"
        />
      )

      // Should show error, not empty state
      expect(screen.getByText('Error loading chart')).toBeInTheDocument()
      expect(screen.getByText('Network error')).toBeInTheDocument()
      expect(screen.queryByText('No agent utilization data available')).not.toBeInTheDocument()
    })

    it('shows loading state instead of empty state when loading is true', () => {
      render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          loading={true}
        />
      )

      // Should show loading skeleton, not empty state
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
      expect(screen.queryByText('No agent utilization data available')).not.toBeInTheDocument()
    })
  })

  describe('Sorting and Filtering with Zero Data', () => {
    it('handles sorting when all agents have zero tokens', () => {
      const allZeroData: AgentUtilizationData = {
        agents: [
          createZeroAgent('zero1', 'Alpha Agent'),
          createZeroAgent('zero2', 'Beta Agent'),
          createZeroAgent('zero3', 'Gamma Agent'),
        ],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalDuration: 3000,
        avgTokensPerSecond: 0,
        lastUpdated: new Date(),
      }

      const sortingConfigs = [
        'tokens', 'cost', 'tokensPerSecond', 'duration', 'invocations'
      ] as const

      sortingConfigs.forEach(sortBy => {
        const { unmount } = render(
          <AgentUtilizationChart
            data={allZeroData}
            sortBy={sortBy}
            sortDirection="desc"
          />
        )

        // Agents with zero tokens are still displayed and sorted
        expect(screen.getByText('Alpha Agent')).toBeInTheDocument()
        expect(screen.getByText('Beta Agent')).toBeInTheDocument()
        expect(screen.getByText('Gamma Agent')).toBeInTheDocument()

        unmount()
      })
    })

    it('handles maxAgents when all agents have zero tokens', () => {
      const manyZeroAgents: AgentUtilizationData = {
        agents: Array.from({ length: 10 }, (_, i) =>
          createZeroAgent(`zero${i}`, `Zero Agent ${i}`)
        ),
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalDuration: 10000,
        avgTokensPerSecond: 0,
        lastUpdated: new Date(),
      }

      render(
        <AgentUtilizationChart
          data={manyZeroAgents}
          maxAgents={3}
        />
      )

      // Should show top 2 agents and an "Other" group (maxAgents=3)
      expect(screen.getByText('Zero Agent 0')).toBeInTheDocument()
      expect(screen.getByText(/Other \(\d+\)/)).toBeInTheDocument()
    })
  })
})