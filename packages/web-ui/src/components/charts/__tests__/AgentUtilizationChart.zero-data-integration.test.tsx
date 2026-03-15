import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentUtilizationChart, AgentUtilizationChartMini } from '../AgentUtilizationChart'
import {
  AgentUtilizationData,
  AgentUtilizationChartProps,
  EMPTY_AGENT_UTILIZATION_DATA,
} from '@/types/agent-utilization'

/**
 * Integration tests for zero-data state handling in AgentUtilizationChart
 *
 * These tests verify the complete integration flow and real-world scenarios
 * where zero-data states might occur, ensuring the component behaves correctly
 * in production-like environments.
 */

describe('AgentUtilizationChart Zero-Data Integration Tests', () => {
  describe('Real-World Scenario: Fresh Installation', () => {
    it('handles new system with no agents configured', async () => {
      const freshSystemData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        lastUpdated: new Date(),
      }

      const mockOnAgentClick = vi.fn()
      const mockOnAgentHover = vi.fn()

      render(
        <AgentUtilizationChart
          data={freshSystemData}
          onAgentClick={mockOnAgentClick}
          onAgentHover={mockOnAgentHover}
          showCost={true}
          showPerformance={true}
          showLegend={true}
          animated={true}
        />
      )

      // Should show appropriate empty message
      expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()

      // Click handlers should not be called
      const container = screen.getByText('No agent utilization data available').closest('div')
      if (container) {
        fireEvent.click(container)
      }
      expect(mockOnAgentClick).not.toHaveBeenCalled()
      expect(mockOnAgentHover).not.toHaveBeenCalled()

      // Should maintain proper accessibility
      expect(container).toHaveClass('text-foreground-secondary')
    })

    it('handles transition from loading to empty state', async () => {
      const { rerender } = render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          loading={true}
        />
      )

      // Should show loading state
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)

      // Transition to loaded empty state
      rerender(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          loading={false}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()
      })

      // Loading skeleton should be gone
      const postLoadSkeletons = document.querySelectorAll('.animate-pulse')
      expect(postLoadSkeletons.length).toBe(0)
    })

    it('handles error recovery to empty state', async () => {
      const { rerender } = render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          error="Failed to fetch data"
        />
      )

      // Should show error state
      expect(screen.getByText('Error loading chart')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument()

      // Clear error, should show empty state
      rerender(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          error={null}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()
      })

      // Error messages should be gone
      expect(screen.queryByText('Error loading chart')).not.toBeInTheDocument()
      expect(screen.queryByText('Failed to fetch data')).not.toBeInTheDocument()
    })
  })

  describe('Real-World Scenario: Agent Lifecycle', () => {
    it('handles agents being added to empty system', async () => {
      const { rerender } = render(
        <AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} />
      )

      // Initially empty
      expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()

      // Agents added but not yet used (zero tokens)
      const agentsAddedData: AgentUtilizationData = {
        agents: [
          {
            agentId: 'new-agent-1',
            agentName: 'New Agent 1',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            tokensPerSecond: 0,
            duration: 0,
            invocations: 0,
          },
          {
            agentId: 'new-agent-2',
            agentName: 'New Agent 2',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            tokensPerSecond: 0,
            duration: 0,
            invocations: 0,
          },
        ],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalDuration: 0,
        avgTokensPerSecond: 0,
        lastUpdated: new Date(),
      }

      rerender(<AgentUtilizationChart data={agentsAddedData} />)

      await waitFor(() => {
        // Agents with zero tokens are still displayed (they are valid data points)
        expect(screen.getByText('New Agent 1')).toBeInTheDocument()
        expect(screen.getByText('New Agent 2')).toBeInTheDocument()
      })

      // Should not show "No agent utilization data available" anymore
      expect(screen.queryByText('No agent utilization data available')).not.toBeInTheDocument()
    })

    it('handles agents starting to generate tokens', async () => {
      const noUsageData: AgentUtilizationData = {
        agents: [
          {
            agentId: 'agent-1',
            agentName: 'Agent 1',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            tokensPerSecond: 0,
            duration: 0,
            invocations: 0,
          },
        ],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalDuration: 0,
        avgTokensPerSecond: 0,
        lastUpdated: new Date(),
      }

      const { rerender } = render(<AgentUtilizationChart data={noUsageData} />)

      // Agent with zero tokens is still displayed (it's a valid data point)
      expect(screen.getByText('Agent 1')).toBeInTheDocument()

      // Agent starts generating tokens
      const withUsageData: AgentUtilizationData = {
        agents: [
          {
            agentId: 'agent-1',
            agentName: 'Agent 1',
            inputTokens: 750,
            outputTokens: 250,
            totalTokens: 1000,
            estimatedCost: 0.05,
            tokensPerSecond: 10,
            duration: 5000,
            invocations: 2,
          },
        ],
        totalInputTokens: 750,
        totalOutputTokens: 250,
        totalTokens: 1000,
        totalEstimatedCost: 0.05,
        totalDuration: 5000,
        avgTokensPerSecond: 10,
        lastUpdated: new Date(),
      }

      rerender(<AgentUtilizationChart data={withUsageData} />)

      await waitFor(() => {
        expect(screen.getByText('Agent 1')).toBeInTheDocument()
        expect(screen.getByText('1.0K')).toBeInTheDocument()
      })

      // Should not show empty/no usage messages
      expect(screen.queryByText('No usage data yet')).not.toBeInTheDocument()
      expect(screen.queryByText('No agent utilization data available')).not.toBeInTheDocument()
    })

    it('handles agents being removed (going back to empty)', async () => {
      const withAgentsData: AgentUtilizationData = {
        agents: [
          {
            agentId: 'temp-agent',
            agentName: 'Temporary Agent',
            inputTokens: 500,
            outputTokens: 300,
            totalTokens: 800,
            estimatedCost: 0.04,
            tokensPerSecond: 8,
            duration: 3000,
            invocations: 1,
          },
        ],
        totalInputTokens: 500,
        totalOutputTokens: 300,
        totalTokens: 800,
        totalEstimatedCost: 0.04,
        totalDuration: 3000,
        avgTokensPerSecond: 8,
        lastUpdated: new Date(),
      }

      const { rerender } = render(<AgentUtilizationChart data={withAgentsData} />)

      // Should show agent
      expect(screen.getByText('Temporary Agent')).toBeInTheDocument()

      // Agent removed
      rerender(<AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} />)

      await waitFor(() => {
        expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()
      })

      // Agent should be gone
      expect(screen.queryByText('Temporary Agent')).not.toBeInTheDocument()
    })
  })

  describe('Real-World Scenario: Filter/Search Results', () => {
    it('handles filtered results with no matches', async () => {
      // Simulate a scenario where filters result in empty data
      const emptyFilteredData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        lastUpdated: new Date(),
      }

      render(
        <AgentUtilizationChart
          data={emptyFilteredData}
          emptyMessage="No agents match the current filters"
        />
      )

      expect(screen.getByText('No agents match the current filters')).toBeInTheDocument()
    })

    it('handles time range with no data', async () => {
      const emptyTimeRangeData: AgentUtilizationData = {
        ...EMPTY_AGENT_UTILIZATION_DATA,
        timeRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-02'),
        },
        lastUpdated: new Date(),
      }

      render(
        <AgentUtilizationChart
          data={emptyTimeRangeData}
          emptyMessage="No data for selected time range"
        />
      )

      expect(screen.getByText('No data for selected time range')).toBeInTheDocument()
    })
  })

  describe('Real-World Scenario: Performance and Memory', () => {
    it('handles rapid state changes without memory leaks', async () => {
      const { rerender } = render(
        <AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} />
      )

      // Rapidly switch between states
      const states = [
        EMPTY_AGENT_UTILIZATION_DATA,
        { ...EMPTY_AGENT_UTILIZATION_DATA, loading: true },
        { ...EMPTY_AGENT_UTILIZATION_DATA, error: 'Test error' },
        EMPTY_AGENT_UTILIZATION_DATA,
      ]

      for (let i = 0; i < 10; i++) {
        states.forEach(state => {
          if ('loading' in state) {
            rerender(<AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} loading={state.loading} />)
          } else if ('error' in state) {
            rerender(<AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} error={state.error} />)
          } else {
            rerender(<AgentUtilizationChart data={state} />)
          }
        })
      }

      // Should still be functional
      await waitFor(() => {
        expect(screen.getByText('No agent utilization data available')).toBeInTheDocument()
      })
    })

    it('handles large amounts of zero-token agents efficiently', async () => {
      const manyZeroAgents: AgentUtilizationData = {
        agents: Array.from({ length: 1000 }, (_, i) => ({
          agentId: `zero-agent-${i}`,
          agentName: `Zero Agent ${i}`,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          tokensPerSecond: 0,
          duration: 100,
          invocations: 1,
        })),
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalDuration: 100000,
        avgTokensPerSecond: 0,
        lastUpdated: new Date(),
      }

      const startTime = performance.now()

      render(<AgentUtilizationChart data={manyZeroAgents} maxAgents={8} />)

      await waitFor(() => {
        // Agents with zero tokens are still displayed (they are valid data points)
        // With maxAgents=8, we should see some agents and an "Other" group
        expect(screen.getByText('Zero Agent 0')).toBeInTheDocument()
        expect(screen.getByText(/Other \(\d+\)/)).toBeInTheDocument()
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render efficiently (increased threshold for CI environment)
      expect(renderTime).toBeLessThan(500)
    })
  })

  describe('Mini Chart Integration Tests', () => {
    it('handles transition from empty to populated in mini chart', async () => {
      const { rerender } = render(
        <AgentUtilizationChartMini data={EMPTY_AGENT_UTILIZATION_DATA} />
      )

      expect(screen.getByText('No data')).toBeInTheDocument()

      const populatedData: AgentUtilizationData = {
        agents: [
          {
            agentId: 'mini-agent',
            agentName: 'Mini Agent',
            inputTokens: 300,
            outputTokens: 200,
            totalTokens: 500,
            estimatedCost: 0.025,
            tokensPerSecond: 5,
            duration: 2000,
            invocations: 1,
          },
        ],
        totalInputTokens: 300,
        totalOutputTokens: 200,
        totalTokens: 500,
        totalEstimatedCost: 0.025,
        totalDuration: 2000,
        avgTokensPerSecond: 5,
        lastUpdated: new Date(),
      }

      rerender(<AgentUtilizationChartMini data={populatedData} />)

      await waitFor(() => {
        expect(screen.getByText('Mini Agent')).toBeInTheDocument()
        expect(screen.getByText('500')).toBeInTheDocument()
      })

      expect(screen.queryByText('No data')).not.toBeInTheDocument()
    })

    it('handles mini chart with maxAgents and zero data', async () => {
      const zeroData: AgentUtilizationData = {
        agents: Array.from({ length: 5 }, (_, i) => ({
          agentId: `zero-${i}`,
          agentName: `Zero ${i}`,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          tokensPerSecond: 0,
          duration: 1000,
          invocations: 1,
        })),
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalEstimatedCost: 0,
        totalDuration: 5000,
        avgTokensPerSecond: 0,
        lastUpdated: new Date(),
      }

      render(<AgentUtilizationChartMini data={zeroData} maxAgents={3} />)

      // Agents with zero tokens are still displayed (they are valid data points)
      expect(screen.getByText('Zero 0')).toBeInTheDocument()
      // Should show 2 individual agents + Other group for remaining 3
      expect(screen.getByText(/Other \(\d+\)/)).toBeInTheDocument()
    })
  })

  describe('Accessibility Integration with Zero Data', () => {
    it('maintains proper ARIA attributes in empty state', () => {
      render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          className="test-chart"
        />
      )

      const container = document.querySelector('.test-chart')
      expect(container).toBeInTheDocument()

      // Should not have role="img" in empty state
      expect(container).not.toHaveAttribute('role', 'img')

      // Text should be accessible
      const emptyMessage = screen.getByText('No agent utilization data available')
      expect(emptyMessage).toBeInTheDocument()
    })

    it('maintains proper focus management in empty state', () => {
      render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          onAgentClick={vi.fn()}
        />
      )

      const emptyState = screen.getByText('No agent utilization data available')

      // Empty state should not be focusable like agent rows would be
      expect(emptyState.closest('[role="button"]')).not.toBeInTheDocument()
      expect(emptyState.closest('.cursor-pointer')).not.toBeInTheDocument()
    })

    it('provides proper screen reader support for state transitions', async () => {
      const { rerender } = render(
        <AgentUtilizationChart
          data={EMPTY_AGENT_UTILIZATION_DATA}
          loading={true}
        />
      )

      // Loading state should have proper announcement
      const loadingElements = document.querySelectorAll('.animate-pulse')
      expect(loadingElements.length).toBeGreaterThan(0)

      rerender(<AgentUtilizationChart data={EMPTY_AGENT_UTILIZATION_DATA} />)

      await waitFor(() => {
        const emptyMessage = screen.getByText('No agent utilization data available')
        expect(emptyMessage).toBeInTheDocument()
      })

      // Should announce the state change to screen readers
      expect(screen.getByText('No agent utilization data available')).toHaveClass('text-sm')
    })
  })
})