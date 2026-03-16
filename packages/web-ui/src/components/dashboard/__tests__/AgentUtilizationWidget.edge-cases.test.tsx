/**
 * Edge case tests for AgentUtilizationWidget dashboard component
 *
 * Tests cover:
 * - Zero-data scenarios (no agents, zero tokens)
 * - Extreme values (very large token counts, many agents)
 * - Invalid data handling (NaN, Infinity, negative)
 * - Rapid state changes
 * - Component lifecycle edge cases
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentUtilizationWidget } from '../AgentUtilizationWidget'
import {
  createMockAgentMetrics,
  createMockAgentMetricsData,
  createMockAgent,
  createAgentMetricsEmptyMock,
} from './__mocks__/widget-test-utils'

// Mock the useAgentMetrics hook
vi.mock('@/hooks/useAgentMetrics', () => ({
  useAgentMetrics: vi.fn(),
}))

import { useAgentMetrics } from '@/hooks/useAgentMetrics'

describe('AgentUtilizationWidget - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Zero Data Scenarios', () => {
    it('handles empty agents array', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsEmptyMock())

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('No agent activity yet')).toBeInTheDocument()
      expect(screen.getByText('0 active')).toBeInTheDocument()
    })

    it('handles agents with all zero tokens', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('idle1', 'Idle Agent 1', 0, 0),
            createMockAgent('idle2', 'Idle Agent 2', 0, 0),
            createMockAgent('idle3', 'Idle Agent 3', 0, 0),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('0 active')).toBeInTheDocument()
      // Should not show top agent when all have 0 tokens
      expect(screen.queryByText(/Top:/)).not.toBeInTheDocument()
    })

    it('handles null metrics', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: null as any,
        })
      )

      render(<AgentUtilizationWidget />)

      // Should not crash
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles undefined agents array', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: {
            agents: undefined as any,
            totalTokens: 0,
            totalCost: 0,
            lastUpdated: new Date(),
          },
        })
      )

      render(<AgentUtilizationWidget />)

      // Should not crash
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles missing lastUpdated', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(undefined, { lastUpdated: undefined as any }),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should not show "Last updated" when undefined
      expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument()
    })
  })

  describe('Extreme Value Scenarios', () => {
    it('handles very large token counts', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('large', 'Large Agent', 999999999999, 50000.00),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should format large numbers appropriately
      expect(screen.getByText('Large Agent')).toBeInTheDocument()
    })

    it('handles very small decimal cost values', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('small', 'Small Agent', 100, 0.0001),
          ]),
        })
      )

      render(<AgentUtilizationWidget showCost={true} />)

      // Should handle small decimals
      expect(screen.getByText('Small Agent')).toBeInTheDocument()
    })

    it('handles many agents (exceeding maxAgents)', () => {
      const manyAgents = Array.from({ length: 20 }, (_, i) =>
        createMockAgent(`agent${i}`, `Agent ${i}`, (20 - i) * 1000, (20 - i) * 0.05)
      )

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(manyAgents),
        })
      )

      render(<AgentUtilizationWidget maxAgents={5} />)

      // Should show top agents and group others
      expect(screen.getByText('Agent 0')).toBeInTheDocument() // Top agent
      expect(screen.getByText(/Other/)).toBeInTheDocument() // Others grouped
    })

    it('handles agent with very long name', () => {
      const longName = 'A'.repeat(200)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('long', longName, 5000, 0.25),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should render without crashing (name may be truncated)
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })
  })

  describe('Invalid Data Handling', () => {
    it('handles NaN token count', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            { ...createMockAgent('nan', 'NaN Agent', 0, 0), totalTokens: NaN },
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should not crash
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles Infinity token count', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            { ...createMockAgent('inf', 'Infinity Agent', 0, 0), totalTokens: Infinity },
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should not crash
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles negative token count', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            { ...createMockAgent('neg', 'Negative Agent', 0, 0), totalTokens: -1000 },
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should not crash
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles negative cost', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            { ...createMockAgent('neg', 'Negative Cost Agent', 5000, 0), estimatedCost: -0.50 },
          ]),
        })
      )

      render(<AgentUtilizationWidget showCost={true} />)

      // Should not crash
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles invalid agentId', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            { ...createMockAgent('', '', 5000, 0.25), agentId: '', agentName: '' },
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should not crash
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })
  })

  describe('Rapid State Changes', () => {
    it('handles rapid prop changes without crashing', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      const { rerender } = render(<AgentUtilizationWidget maxAgents={3} />)

      // Rapid prop changes
      for (let i = 1; i <= 10; i++) {
        rerender(<AgentUtilizationWidget maxAgents={i} />)
      }

      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles rapid connection state changes', () => {
      const states = ['connected', 'disconnected', 'reconnecting', 'error', 'connecting'] as const

      const { rerender } = render(<AgentUtilizationWidget />)

      for (let i = 0; i < 20; i++) {
        const state = states[i % states.length]
        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({ connectionStatus: state })
        )
        rerender(<AgentUtilizationWidget />)
      }

      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles rapid agent list changes', () => {
      const { rerender } = render(<AgentUtilizationWidget />)

      for (let i = 0; i < 10; i++) {
        const agents = Array.from({ length: i + 1 }, (_, j) =>
          createMockAgent(`agent${j}`, `Agent ${j}`, (j + 1) * 1000, (j + 1) * 0.05)
        )

        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({
            metrics: createMockAgentMetricsData(agents),
          })
        )

        rerender(<AgentUtilizationWidget />)
      }

      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles concurrent refresh requests', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({ refresh: mockRefresh })
      )

      render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByTitle('Refresh agent data')

      // Click rapidly multiple times
      for (let i = 0; i < 5; i++) {
        fireEvent.click(refreshButton)
      }

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })
  })

  describe('Component Lifecycle Edge Cases', () => {
    it('handles unmount during refresh operation', async () => {
      let resolveRefresh: () => void
      const mockRefresh = vi.fn().mockImplementation(
        () => new Promise<void>(resolve => { resolveRefresh = resolve })
      )

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({ refresh: mockRefresh })
      )

      const { unmount } = render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByTitle('Refresh agent data')
      fireEvent.click(refreshButton)

      // Unmount while refresh is pending
      unmount()

      // Resolve the pending promise
      resolveRefresh!()

      // Should not throw any errors
      expect(mockRefresh).toHaveBeenCalled()
    })

    it('handles multiple rapid mount/unmount cycles', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<AgentUtilizationWidget />)
        unmount()
      }

      // Final render should work
      render(<AgentUtilizationWidget />)
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })
  })

  describe('Date Edge Cases', () => {
    it('handles very old lastUpdated date', () => {
      const oldDate = new Date('1970-01-01T00:00:00Z')

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(undefined, { lastUpdated: oldDate }),
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })

    it('handles future lastUpdated date', () => {
      const futureDate = new Date('2099-12-31T23:59:59Z')

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(undefined, { lastUpdated: futureDate }),
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })

    it('handles invalid lastUpdated date', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(undefined, { lastUpdated: new Date('invalid') }),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should not crash
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })
  })

  describe('Error Object Edge Cases', () => {
    it('handles error with very long message', () => {
      const longMessage = 'Error: '.repeat(500)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          error: longMessage,
          connectionStatus: 'error',
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('Unable to load agent data')).toBeInTheDocument()
    })

    it('handles error with empty message', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          error: '',
          connectionStatus: 'error',
        })
      )

      render(<AgentUtilizationWidget />)

      // Should still show the widget header
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles error with special characters', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          error: '<script>alert("xss")</script>',
          connectionStatus: 'error',
        })
      )

      render(<AgentUtilizationWidget />)

      // Should escape and display safely
      expect(screen.getByText('Unable to load agent data')).toBeInTheDocument()
    })
  })

  describe('Agent Click Handler Edge Cases', () => {
    it('handles click on agent with undefined fields', () => {
      const onAgentClick = vi.fn()

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            {
              agentId: 'partial',
              agentName: 'Partial Agent',
              totalTokens: 5000,
              inputTokens: undefined as any,
              outputTokens: undefined as any,
              estimatedCost: undefined as any,
              tokensPerSecond: undefined as any,
              duration: undefined as any,
              invocations: undefined as any,
            },
          ]),
        })
      )

      render(<AgentUtilizationWidget onAgentClick={onAgentClick} />)

      const agentRow = screen.getByText('Partial Agent').closest('.group')
      if (agentRow) {
        fireEvent.click(agentRow)
      }

      // Should call handler without crashing
      expect(onAgentClick).toHaveBeenCalled()
    })
  })

  describe('Performance Edge Cases', () => {
    it('handles many re-renders without issues', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      const { rerender } = render(<AgentUtilizationWidget />)

      // Simulate many re-renders
      for (let i = 0; i < 100; i++) {
        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({
            metrics: createMockAgentMetricsData([
              createMockAgent('agent', 'Agent', i * 100, i * 0.005),
            ]),
          })
        )
        rerender(<AgentUtilizationWidget />)
      }

      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles large number of agents efficiently', () => {
      const manyAgents = Array.from({ length: 100 }, (_, i) =>
        createMockAgent(`agent${i}`, `Agent ${i}`, (100 - i) * 100, (100 - i) * 0.005)
      )

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(manyAgents),
        })
      )

      render(<AgentUtilizationWidget maxAgents={6} />)

      // Should render without crashing
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
      expect(screen.getByText('Agent 0')).toBeInTheDocument() // Top agent
    })
  })

  describe('Display Option Edge Cases', () => {
    it('handles all display options disabled', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      render(
        <AgentUtilizationWidget
          showCost={false}
          showPerformance={false}
          showTokenBreakdown={false}
        />
      )

      // Should still render basic widget
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
      expect(screen.getByText('Coder')).toBeInTheDocument()
    })

    it('handles all display options enabled', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      render(
        <AgentUtilizationWidget
          showCost={true}
          showPerformance={true}
          showTokenBreakdown={true}
        />
      )

      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
      expect(screen.getByText('$0.25')).toBeInTheDocument()
    })

    it('handles height of 0', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget height={0} />)

      // Should still render header
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles maxAgents of 0', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      render(<AgentUtilizationWidget maxAgents={0} />)

      // Should handle gracefully
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('handles negative maxAgents', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      render(<AgentUtilizationWidget maxAgents={-5} />)

      // Should handle gracefully
      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })
  })
})
