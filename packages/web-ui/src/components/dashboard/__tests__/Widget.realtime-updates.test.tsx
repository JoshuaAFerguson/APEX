/**
 * Real-time updates integration tests for both BudgetWidget and AgentUtilizationWidget
 *
 * Tests cover:
 * - Real-time data streaming simulation
 * - WebSocket connection management
 * - Cross-widget data consistency
 * - Throttling and debouncing of updates
 * - Network interruption recovery
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { BudgetWidget } from '../BudgetWidget'
import { AgentUtilizationWidget } from '../AgentUtilizationWidget'
import {
  createMockRealtimeUpdates,
  createMockAgentMetrics,
  createMockAgentMetricsData,
  createMockAgent,
} from './__mocks__/widget-test-utils'

// Mock both hooks
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

vi.mock('@/hooks/useAgentMetrics', () => ({
  useAgentMetrics: vi.fn(),
}))

import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'
import { useAgentMetrics } from '@/hooks/useAgentMetrics'

describe('Widget Real-time Updates Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  describe('Budget Widget Real-time Updates', () => {
    it('processes streaming cost updates correctly', async () => {
      const initialCost = 100
      const updatedCosts = [150, 200, 275, 350, 500]

      // Start with initial cost
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: initialCost,
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

      expect(screen.getByText('10%')).toBeInTheDocument()
      expect(screen.getAllByText('Within budget').length).toBeGreaterThan(0)

      // Simulate real-time cost increases
      for (const cost of updatedCosts) {
        await act(async () => {
          vi.mocked(useRealtimeUpdates).mockReturnValue(
            createMockRealtimeUpdates({
              performance: {
                timeRange: '1h',
                tokenUsage: {
                  inputTokens: 0,
                  outputTokens: 0,
                  totalTokens: 0,
                  estimatedCost: cost,
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
        })

        // Verify percentage and status update
        const percentage = Math.floor((cost / 1000) * 100)
        expect(screen.getByText(`${percentage}%`)).toBeInTheDocument()
      }

      // Final state should show 50% and within budget
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('handles cost data with sub-second precision', async () => {
      const preciseCosts = [
        12.345,
        12.346,
        12.347,
        12.348,
        12.349,
      ]

      for (const cost of preciseCosts) {
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({
            performance: {
              timeRange: '1h',
              tokenUsage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                estimatedCost: cost,
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

        const { rerender } = render(<BudgetWidget budgetLimit={100} />)

        // Should handle micro-updates without performance issues
        expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
      }
    })
  })

  describe('Agent Utilization Widget Real-time Updates', () => {
    it('processes agent metric streams correctly', async () => {
      const agentProgressions = [
        [createMockAgent('coder', 'Coder', 1000, 0.05)],
        [
          createMockAgent('coder', 'Coder', 2000, 0.10),
          createMockAgent('planner', 'Planner', 1500, 0.075),
        ],
        [
          createMockAgent('coder', 'Coder', 3000, 0.15),
          createMockAgent('planner', 'Planner', 2500, 0.125),
          createMockAgent('reviewer', 'Reviewer', 1000, 0.05),
        ],
      ]

      const { rerender } = render(<AgentUtilizationWidget />)

      for (const agents of agentProgressions) {
        await act(async () => {
          vi.mocked(useAgentMetrics).mockReturnValue(
            createMockAgentMetrics({
              metrics: createMockAgentMetricsData(agents),
            })
          )

          rerender(<AgentUtilizationWidget />)
        })

        // Verify agent count updates
        expect(screen.getByText(`${agents.length} active`)).toBeInTheDocument()

        // Verify top agent tracking
        const topAgent = agents.reduce((max, agent) =>
          agent.totalTokens > max.totalTokens ? agent : max
        )
        expect(screen.getByText(new RegExp(`Top: ${topAgent.agentName}`))).toBeInTheDocument()
      }
    })

    it('handles rapid agent status changes', async () => {
      const baseAgents = [
        createMockAgent('agent1', 'Agent 1', 5000, 0.25),
        createMockAgent('agent2', 'Agent 2', 3000, 0.15),
        createMockAgent('agent3', 'Agent 3', 2000, 0.10),
      ]

      // Simulate agents going idle and active rapidly
      const statusUpdates = [
        // All active
        baseAgents,
        // Agent 3 goes idle
        [
          baseAgents[0],
          baseAgents[1],
          { ...baseAgents[2], totalTokens: 0, estimatedCost: 0 },
        ],
        // Agent 2 also goes idle
        [
          baseAgents[0],
          { ...baseAgents[1], totalTokens: 0, estimatedCost: 0 },
          { ...baseAgents[2], totalTokens: 0, estimatedCost: 0 },
        ],
        // All come back online
        baseAgents,
      ]

      const { rerender } = render(<AgentUtilizationWidget />)

      for (const agents of statusUpdates) {
        await act(async () => {
          vi.mocked(useAgentMetrics).mockReturnValue(
            createMockAgentMetrics({
              metrics: createMockAgentMetricsData(agents),
            })
          )

          rerender(<AgentUtilizationWidget />)
        })

        // Count active agents (non-zero tokens)
        const activeCount = agents.filter(a => a.totalTokens > 0).length
        expect(screen.getByText(`${activeCount} active`)).toBeInTheDocument()
      }
    })
  })

  describe('Cross-Widget Data Consistency', () => {
    it('maintains data consistency between budget and agent widgets', async () => {
      const totalCost = 500
      const agents = [
        createMockAgent('coder', 'Coder', 8000, 200), // $2.00
        createMockAgent('planner', 'Planner', 5000, 150), // $1.50
        createMockAgent('reviewer', 'Reviewer', 3000, 150), // $1.50
      ]

      // Total agent costs should match budget spend
      const totalAgentCost = agents.reduce((sum, a) => sum + a.estimatedCost, 0)

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: totalAgentCost,
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

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(agents),
        })
      )

      render(
        <div>
          <BudgetWidget budgetLimit={1000} />
          <AgentUtilizationWidget showCost={true} />
        </div>
      )

      // Budget widget should show consistent total
      expect(screen.getByText('50%')).toBeInTheDocument() // 500/1000 = 50%

      // Agent widget should show individual agents
      expect(screen.getByText('3 active')).toBeInTheDocument()
      expect(screen.getByText('Coder')).toBeInTheDocument()

      // Costs should be consistent (though formatted differently)
      expect(screen.getByText('$200')).toBeInTheDocument() // Coder cost
    })
  })

  describe('Connection State Synchronization', () => {
    it('synchronizes connection states between widgets', async () => {
      const connectionStates = ['connecting', 'connected', 'error', 'reconnecting', 'connected'] as const

      render(
        <div>
          <BudgetWidget budgetLimit={1000} />
          <AgentUtilizationWidget />
        </div>
      )

      for (const state of connectionStates) {
        await act(async () => {
          // Both widgets should reflect the same connection state
          vi.mocked(useRealtimeUpdates).mockReturnValue(
            createMockRealtimeUpdates({ connectionState: state })
          )

          vi.mocked(useAgentMetrics).mockReturnValue(
            createMockAgentMetrics({
              connectionStatus: state,
              isLoading: state === 'connecting',
            })
          )
        })

        // Wait for updates to process
        await waitFor(() => {
          const expectedLabels = {
            connecting: 'Connecting...',
            connected: 'Connected',
            error: 'Connection Error',
            reconnecting: 'Reconnecting...',
          }

          const expectedLabel = expectedLabels[state]

          // Both widgets should show the same connection state
          const statusIndicators = screen.getAllByTitle(expectedLabel)
          expect(statusIndicators.length).toBeGreaterThanOrEqual(2) // At least one per widget
        })
      }
    })
  })

  describe('Update Throttling and Performance', () => {
    it('handles high-frequency updates efficiently', async () => {
      const updateCount = 100
      const startCost = 100

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      // Simulate rapid updates
      for (let i = 0; i < updateCount; i++) {
        const cost = startCost + i

        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({
            performance: {
              timeRange: '1h',
              tokenUsage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                estimatedCost: cost,
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

        // Advance timers slightly to simulate time passage
        await act(async () => {
          vi.advanceTimersByTime(10)
        })
      }

      // Final update should be reflected
      const finalPercentage = Math.floor(((startCost + updateCount - 1) / 1000) * 100)
      expect(screen.getByText(`${finalPercentage}%`)).toBeInTheDocument()
    })

    it('debounces rapid threshold state changes', async () => {
      const costs = [740, 750, 760, 750, 740, 750] // Oscillating around warning threshold

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      for (const cost of costs) {
        await act(async () => {
          vi.mocked(useRealtimeUpdates).mockReturnValue(
            createMockRealtimeUpdates({
              performance: {
                timeRange: '1h',
                tokenUsage: {
                  inputTokens: 0,
                  outputTokens: 0,
                  totalTokens: 0,
                  estimatedCost: cost,
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
          vi.advanceTimersByTime(100)
        })
      }

      // Should handle rapid state changes without issues
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })
  })

  describe('Network Interruption Recovery', () => {
    it('handles temporary connection loss gracefully', async () => {
      // Start connected
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({ connectionState: 'connected' })
      )

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByTitle('Connected')).toBeInTheDocument()

      // Simulate connection loss
      await act(async () => {
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({ connectionState: 'disconnected' })
        )

        rerender(<BudgetWidget budgetLimit={1000} />)
      })

      expect(screen.getByTitle('Disconnected')).toBeInTheDocument()

      // Simulate reconnection
      await act(async () => {
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({ connectionState: 'reconnecting' })
        )

        rerender(<BudgetWidget budgetLimit={1000} />)
      })

      expect(screen.getByTitle('Reconnecting...')).toBeInTheDocument()

      // Back to connected
      await act(async () => {
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({ connectionState: 'connected' })
        )

        rerender(<BudgetWidget budgetLimit={1000} />)
      })

      expect(screen.getByTitle('Connected')).toBeInTheDocument()
    })
  })
})