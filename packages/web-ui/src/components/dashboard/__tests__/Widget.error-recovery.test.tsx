/**
 * Error recovery and resilience tests for dashboard widgets
 *
 * Tests cover:
 * - Network failure recovery
 * - Data corruption handling
 * - Memory pressure scenarios
 * - Partial data states
 * - Cascading error prevention
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BudgetWidget } from '../BudgetWidget'
import { AgentUtilizationWidget } from '../AgentUtilizationWidget'
import {
  createMockRealtimeUpdates,
  createMockAgentMetrics,
  createMockAgentMetricsData,
  createMockAgent,
} from './__mocks__/widget-test-utils'

// Mock hooks
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

vi.mock('@/hooks/useAgentMetrics', () => ({
  useAgentMetrics: vi.fn(),
}))

import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'
import { useAgentMetrics } from '@/hooks/useAgentMetrics'

describe('Widget Error Recovery and Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetAllMocks()
  })

  describe('Network Failure Recovery', () => {
    it('recovers from intermittent network failures', async () => {
      // Start with successful connection
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          connectionState: 'connected',
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 500,
              tokensPerMinute: 0,
              cacheHitRate: 0,
              byAgent: {},
              byTool: {},
            },
            tasks: {
              completedTasks: 0,
              failedTasks: 0,
              avgDurationMs: 0,
              medianDurationMs: 0,
              p95DurationMs: 0,
              successRate: 1,
              byStatus: {},
              byStage: {},
            },
            agents: [],
            tools: [],
            timeSeries: [],
            generatedAt: new Date(),
          },
        })
      )

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByTitle('Connected')).toBeInTheDocument()

      // Simulate network failure
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          connectionState: 'error',
          error: new Error('Network timeout'),
        })
      )

      rerender(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Unable to load budget data')).toBeInTheDocument()
      expect(screen.getByText('Network timeout')).toBeInTheDocument()

      // User attempts retry
      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      fireEvent.click(retryButton)

      // Simulate successful reconnection
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          connectionState: 'connected',
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 500,
              tokensPerMinute: 0,
              cacheHitRate: 0,
              byAgent: {},
              byTool: {},
            },
            tasks: {
              completedTasks: 0,
              failedTasks: 0,
              avgDurationMs: 0,
              medianDurationMs: 0,
              p95DurationMs: 0,
              successRate: 1,
              byStatus: {},
              byStage: {},
            },
            agents: [],
            tools: [],
            timeSeries: [],
            generatedAt: new Date(),
          },
        })
      )

      rerender(<BudgetWidget budgetLimit={1000} />)

      // Should return to normal operation
      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.queryByText('Unable to load budget data')).not.toBeInTheDocument()
    })

    it('handles multiple consecutive failures gracefully', async () => {
      const errors = [
        'Connection timeout',
        'Server unavailable',
        'Network error',
        'Service temporarily unavailable',
      ]

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          connectionStatus: 'error',
          error: errors[0],
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      for (let i = 0; i < errors.length; i++) {
        const error = errors[i]

        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({
            connectionStatus: 'error',
            error,
          })
        )

        rerender(<AgentUtilizationWidget />)

        expect(screen.getByText('Unable to load agent data')).toBeInTheDocument()
        expect(screen.getByText(error)).toBeInTheDocument()

        // Try to retry
        const retryButton = screen.getByRole('button', { name: 'Try Again' })
        fireEvent.click(retryButton)

        await waitFor(() => {
          expect(retryButton).toBeInTheDocument()
        })
      }

      // Component should remain stable despite multiple failures
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })
  })

  describe('Data Corruption Handling', () => {
    it('handles malformed performance data', () => {
      // Test various malformed data scenarios
      const malformedDataCases = [
        {
          description: 'null tokenUsage',
          data: {
            performance: {
              timeRange: '1h',
              tokenUsage: null as any,
              tasks: {
                completedTasks: 0,
                failedTasks: 0,
                avgDurationMs: 0,
                medianDurationMs: 0,
                p95DurationMs: 0,
                successRate: 1,
                byStatus: {},
                byStage: {},
              },
              agents: [],
              tools: [],
              timeSeries: [],
              generatedAt: new Date(),
            },
          },
        },
        {
          description: 'undefined estimatedCost',
          data: {
            performance: {
              timeRange: '1h',
              tokenUsage: {
                inputTokens: 1000,
                outputTokens: 500,
                totalTokens: 1500,
                estimatedCost: undefined as any,
                tokensPerMinute: 0,
                cacheHitRate: 0,
                byAgent: {},
                byTool: {},
              },
              tasks: {
                completedTasks: 0,
                failedTasks: 0,
                avgDurationMs: 0,
                medianDurationMs: 0,
                p95DurationMs: 0,
                successRate: 1,
                byStatus: {},
                byStage: {},
              },
              agents: [],
              tools: [],
              timeSeries: [],
              generatedAt: new Date(),
            },
          },
        },
        {
          description: 'string instead of number',
          data: {
            performance: {
              timeRange: '1h',
              tokenUsage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                estimatedCost: 'invalid' as any,
                tokensPerMinute: 0,
                cacheHitRate: 0,
                byAgent: {},
                byTool: {},
              },
              tasks: {
                completedTasks: 0,
                failedTasks: 0,
                avgDurationMs: 0,
                medianDurationMs: 0,
                p95DurationMs: 0,
                successRate: 1,
                byStatus: {},
                byStage: {},
              },
              agents: [],
              tools: [],
              timeSeries: [],
              generatedAt: new Date(),
            },
          },
        },
      ]

      malformedDataCases.forEach(({ description, data }) => {
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates(data)
        )

        // Should not crash with malformed data
        render(<BudgetWidget budgetLimit={1000} />)

        expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
      })
    })

    it('handles corrupted agent metrics gracefully', () => {
      const corruptedAgentCases = [
        {
          description: 'agent with missing required fields',
          agents: [
            {
              agentId: 'corrupt',
              agentName: undefined as any,
              totalTokens: NaN,
              estimatedCost: undefined as any,
              inputTokens: 0,
              outputTokens: 0,
              tokensPerSecond: 0,
              duration: 0,
              invocations: 0,
              cacheTokens: 0,
              avgLatencyMs: 0,
              status: 'active',
              isActive: true,
              lastActivityAt: new Date(),
            },
          ],
        },
        {
          description: 'agent with circular reference',
          agents: (() => {
            const agent: any = createMockAgent('circular', 'Circular Agent', 1000, 0.05)
            agent.self = agent
            return [agent]
          })(),
        },
        {
          description: 'agent with null values',
          agents: [
            {
              ...createMockAgent('null', 'Null Agent', 1000, 0.05),
              agentId: null as any,
              totalTokens: null as any,
              estimatedCost: null as any,
            },
          ],
        },
      ]

      corruptedAgentCases.forEach(({ description, agents }) => {
        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({
            metrics: createMockAgentMetricsData(agents),
          })
        )

        // Should not crash with corrupted data
        render(<AgentUtilizationWidget />)

        expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
      })
    })
  })

  describe('Memory Pressure Scenarios', () => {
    it('handles large amounts of historical data', () => {
      // Simulate very large historical datasets
      const largeAgentList = Array.from({ length: 1000 }, (_, i) =>
        createMockAgent(`agent${i}`, `Agent ${i}`, Math.random() * 10000, Math.random() * 0.5)
      )

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(largeAgentList),
        })
      )

      // Should handle large datasets without crashing
      render(<AgentUtilizationWidget maxAgents={10} />)

      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()

      // Should show limited number of agents due to maxAgents prop
      const activeCount = largeAgentList.filter(a => a.totalTokens > 0).length
      expect(screen.getByText(`${activeCount} active`)).toBeInTheDocument()
    })

    it('manages memory during rapid data updates', () => {
      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      // Simulate memory pressure with many rapid updates
      for (let i = 0; i < 500; i++) {
        const randomCost = Math.random() * 1000

        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({
            performance: {
              timeRange: '1h',
              tokenUsage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                estimatedCost: randomCost,
                tokensPerMinute: 0,
                cacheHitRate: 0,
                byAgent: {},
                byTool: {},
              },
              tasks: {
                completedTasks: 0,
                failedTasks: 0,
                avgDurationMs: 0,
                medianDurationMs: 0,
                p95DurationMs: 0,
                successRate: 1,
                byStatus: {},
                byStage: {},
              },
              agents: [],
              tools: [],
              timeSeries: [],
              generatedAt: new Date(),
            },
          })
        )

        rerender(<BudgetWidget budgetLimit={1000} />)

        // Every 50 iterations, verify component is still functional
        if (i % 50 === 0) {
          expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
        }
      }

      // Final verification
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })
  })

  describe('Partial Data States', () => {
    it('handles partially loaded performance data', () => {
      const partialDataCases = [
        {
          description: 'performance data without tokenUsage',
          performance: {
            timeRange: '1h',
            tokenUsage: undefined as any,
            tasks: {
              completedTasks: 5,
              failedTasks: 1,
              avgDurationMs: 2000,
              medianDurationMs: 1500,
              p95DurationMs: 3000,
              successRate: 0.83,
              byStatus: {},
              byStage: {},
            },
            agents: [],
            tools: [],
            timeSeries: [],
            generatedAt: new Date(),
          },
        },
        {
          description: 'incomplete tokenUsage object',
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 1000,
              // Missing outputTokens, totalTokens, estimatedCost
              tokensPerMinute: 50,
              cacheHitRate: 0.2,
              byAgent: {},
              byTool: {},
            } as any,
            tasks: {
              completedTasks: 0,
              failedTasks: 0,
              avgDurationMs: 0,
              medianDurationMs: 0,
              p95DurationMs: 0,
              successRate: 1,
              byStatus: {},
              byStage: {},
            },
            agents: [],
            tools: [],
            timeSeries: [],
            generatedAt: new Date(),
          },
        },
      ]

      partialDataCases.forEach(({ description, performance }) => {
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({ performance })
        )

        render(<BudgetWidget budgetLimit={1000} />)

        // Should gracefully handle partial data
        expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
        // Should default to 0% when cost data is unavailable
        expect(screen.getByText('0%')).toBeInTheDocument()
      })
    })

    it('handles mixed valid and invalid agent data', () => {
      const mixedAgents = [
        createMockAgent('valid1', 'Valid Agent 1', 5000, 0.25), // Valid
        {
          ...createMockAgent('invalid', 'Invalid Agent', 0, 0),
          totalTokens: NaN,
          estimatedCost: Infinity,
        }, // Invalid
        createMockAgent('valid2', 'Valid Agent 2', 3000, 0.15), // Valid
        {
          agentId: '',
          agentName: '',
          totalTokens: -1000,
          estimatedCost: -0.5,
          inputTokens: 0,
          outputTokens: 0,
          tokensPerSecond: 0,
          duration: 0,
          invocations: 0,
          cacheTokens: 0,
          avgLatencyMs: 0,
          status: 'active',
          isActive: true,
          lastActivityAt: new Date(),
        }, // Invalid
      ]

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(mixedAgents),
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()

      // Should show the valid agents
      expect(screen.getByText('Valid Agent 1')).toBeInTheDocument()
      expect(screen.getByText('Valid Agent 2')).toBeInTheDocument()

      // Should count only valid active agents
      expect(screen.getByText('2 active')).toBeInTheDocument()
    })
  })

  describe('Cascading Error Prevention', () => {
    it('prevents error propagation between widgets', () => {
      // Create a scenario where one widget has errors but the other doesn't
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          connectionState: 'error',
          error: new Error('Budget service unavailable'),
        })
      )

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      render(
        <div>
          <BudgetWidget budgetLimit={1000} />
          <AgentUtilizationWidget />
        </div>
      )

      // Budget widget should show error
      expect(screen.getByText('Unable to load budget data')).toBeInTheDocument()
      expect(screen.getByText('Budget service unavailable')).toBeInTheDocument()

      // Agent widget should work normally
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
      expect(screen.getByText('Coder')).toBeInTheDocument()
      expect(screen.getByText('1 active')).toBeInTheDocument()
    })

    it('isolates refresh failures between widgets', () => {
      const failingCheckHealth = vi.fn().mockRejectedValue(new Error('Health check failed'))
      const workingRefresh = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({}, { checkHealth: failingCheckHealth })
      )

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({ refresh: workingRefresh })
      )

      render(
        <div>
          <BudgetWidget budgetLimit={1000} />
          <AgentUtilizationWidget />
        </div>
      )

      const budgetRefresh = screen.getByTitle('Refresh budget data')
      const agentRefresh = screen.getByTitle('Refresh agent data')

      // Budget refresh should fail
      fireEvent.click(budgetRefresh)
      expect(failingCheckHealth).toHaveBeenCalled()

      // Agent refresh should still work
      fireEvent.click(agentRefresh)
      expect(workingRefresh).toHaveBeenCalled()

      // Both widgets should remain functional
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })
  })

  describe('Error Boundary Simulation', () => {
    it('handles rendering errors gracefully', () => {
      // Test that errors in data processing don't crash the component
      const problematicData = {
        performance: {
          timeRange: '1h',
          tokenUsage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: Object.create(null), // Object without prototype
            tokensPerMinute: 0,
            cacheHitRate: 0,
            byAgent: {},
            byTool: {},
          },
          tasks: {
            completedTasks: 0,
            failedTasks: 0,
            avgDurationMs: 0,
            medianDurationMs: 0,
            p95DurationMs: 0,
            successRate: 1,
            byStatus: {},
            byStage: {},
          },
          agents: [],
          tools: [],
          timeSeries: [],
          generatedAt: new Date(),
        },
      }

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates(problematicData)
      )

      // Should not crash even with problematic data
      expect(() => {
        render(<BudgetWidget budgetLimit={1000} />)
      }).not.toThrow()

      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })
  })
})