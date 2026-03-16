/**
 * Integration tests for AgentUtilizationWidget dashboard component
 *
 * Tests cover:
 * - Real-time agent metrics updates
 * - Agent data transformation
 * - Multiple agent aggregation
 * - Connection state handling
 * - Refresh with data reload
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentUtilizationWidget } from '../AgentUtilizationWidget'
import {
  createMockAgentMetrics,
  createMockAgentMetricsData,
  createMockAgent,
  createAgentMetricsLoadingMock,
  createAgentMetricsErrorMock,
  createAgentMetricsEmptyMock,
} from './__mocks__/widget-test-utils'

// Mock the useAgentMetrics hook
vi.mock('@/hooks/useAgentMetrics', () => ({
  useAgentMetrics: vi.fn(),
}))

import { useAgentMetrics } from '@/hooks/useAgentMetrics'

describe('AgentUtilizationWidget - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  describe('Real-time Agent Metrics Updates', () => {
    it('updates display when agent metrics change', () => {
      // Initial render with 2 agents
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('planner', 'Planner', 3000, 0.15),
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText('2 active')).toBeInTheDocument()
      expect(screen.getByText('Planner')).toBeInTheDocument()
      expect(screen.getByText('Coder')).toBeInTheDocument()

      // Simulate real-time update with new agent
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('planner', 'Planner', 4000, 0.20),
            createMockAgent('coder', 'Coder', 7000, 0.35),
            createMockAgent('reviewer', 'Reviewer', 2000, 0.10),
          ]),
        })
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.getByText('3 active')).toBeInTheDocument()
      expect(screen.getByText('Reviewer')).toBeInTheDocument()
    })

    it('updates top agent when rankings change', () => {
      // Initial: Coder is top agent
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('planner', 'Planner', 3000, 0.15),
            createMockAgent('coder', 'Coder', 7000, 0.35),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText(/Top: Coder/)).toBeInTheDocument()

      // Planner overtakes Coder
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('planner', 'Planner', 15000, 0.75),
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.getByText(/Top: Planner/)).toBeInTheDocument()
    })

    it('updates token counts in real-time', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText('5.0K')).toBeInTheDocument()

      // Token count increases
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 15000, 0.75),
          ]),
        })
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.getByText('15.0K')).toBeInTheDocument()
    })

    it('updates lastUpdated timestamp on data refresh', () => {
      const initialTime = new Date('2025-03-15T10:00:00Z')
      const updatedTime = new Date('2025-03-15T10:05:00Z')

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(undefined, { lastUpdated: initialTime }),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()

      // Simulate time update
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(undefined, { lastUpdated: updatedTime }),
        })
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })
  })

  describe('Agent Data Transformation', () => {
    it('correctly transforms metrics to utilization data', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 10000, 0.50),
          ]),
        })
      )

      render(<AgentUtilizationWidget showCost={true} />)

      // Verify transformation
      expect(screen.getByText('Coder')).toBeInTheDocument()
      expect(screen.getByText('10.0K')).toBeInTheDocument()
      expect(screen.getByText('$0.50')).toBeInTheDocument()
    })

    it('aggregates totals from multiple agents', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('agent1', 'Agent 1', 3000, 0.15),
            createMockAgent('agent2', 'Agent 2', 5000, 0.25),
            createMockAgent('agent3', 'Agent 3', 2000, 0.10),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // All 3 agents should be active (non-zero tokens)
      expect(screen.getByText('3 active')).toBeInTheDocument()
    })

    it('calculates correct percentage for top agent', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('agent1', 'Agent 1', 2000, 0.10), // 20%
            createMockAgent('agent2', 'Agent 2', 8000, 0.40), // 80% - top agent
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText(/Top: Agent 2/)).toBeInTheDocument()
      expect(screen.getByText(/80%/)).toBeInTheDocument()
    })
  })

  describe('Connection State Transitions', () => {
    it('transitions from connecting to connected', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsLoadingMock())

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText('Loading agent metrics...')).toBeInTheDocument()
      expect(screen.getByTitle('Connecting...')).toBeInTheDocument()

      // Transition to connected
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      rerender(<AgentUtilizationWidget />)

      expect(screen.queryByText('Loading agent metrics...')).not.toBeInTheDocument()
      expect(screen.getByTitle('Connected')).toBeInTheDocument()
    })

    it('transitions from connected to error', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByTitle('Connected')).toBeInTheDocument()

      // Simulate connection error
      vi.mocked(useAgentMetrics).mockReturnValue(
        createAgentMetricsErrorMock('WebSocket disconnected')
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.getByText('Unable to load agent data')).toBeInTheDocument()
      expect(screen.getByTitle('Connection Error')).toBeInTheDocument()
    })

    it('shows reconnecting state', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({ connectionStatus: 'reconnecting' })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByTitle('Reconnecting...')).toBeInTheDocument()
    })
  })

  describe('Refresh Action Flow', () => {
    it('handles complete refresh cycle', async () => {
      const onRefresh = vi.fn()
      const mockRefresh = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({ refresh: mockRefresh })
      )

      render(<AgentUtilizationWidget onRefresh={onRefresh} />)

      const refreshButton = screen.getByTitle('Refresh agent data')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1)
        expect(onRefresh).toHaveBeenCalledTimes(1)
      })
    })

    it('refreshes data and updates display', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
          refresh: mockRefresh,
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText('5.0K')).toBeInTheDocument()

      // Click refresh
      const refreshButton = screen.getByTitle('Refresh agent data')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })

      // Simulate new data after refresh
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
          refresh: mockRefresh,
        })
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.getByText('8.0K')).toBeInTheDocument()
    })
  })

  describe('Error Recovery', () => {
    it('recovers from error state after successful retry', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined)

      // Start in error state
      vi.mocked(useAgentMetrics).mockReturnValue({
        ...createAgentMetricsErrorMock('Initial error'),
        refresh: mockRefresh,
      })

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText('Unable to load agent data')).toBeInTheDocument()

      // Click retry
      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })

      // Simulate successful recovery
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.queryByText('Unable to load agent data')).not.toBeInTheDocument()
      expect(screen.getByText('Coder')).toBeInTheDocument()
    })
  })

  describe('Agent List Updates', () => {
    it('handles agents being added', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText('1 active')).toBeInTheDocument()

      // Add more agents
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
            createMockAgent('planner', 'Planner', 3000, 0.15),
            createMockAgent('reviewer', 'Reviewer', 2000, 0.10),
          ]),
        })
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.getByText('3 active')).toBeInTheDocument()
      expect(screen.getByText('Planner')).toBeInTheDocument()
      expect(screen.getByText('Reviewer')).toBeInTheDocument()
    })

    it('handles agents becoming inactive (zero tokens)', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
            createMockAgent('planner', 'Planner', 3000, 0.15),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText('2 active')).toBeInTheDocument()

      // Planner becomes inactive
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
            createMockAgent('planner', 'Planner', 0, 0), // Now inactive
          ]),
        })
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.getByText('1 active')).toBeInTheDocument()
    })

    it('transitions from empty to populated state', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsEmptyMock())

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText('No agent activity yet')).toBeInTheDocument()

      // Agents start appearing
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      rerender(<AgentUtilizationWidget />)

      expect(screen.queryByText('No agent activity yet')).not.toBeInTheDocument()
      expect(screen.getByText('Coder')).toBeInTheDocument()
    })

    it('transitions from populated to empty state', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget />)

      expect(screen.getByText('Coder')).toBeInTheDocument()

      // All agents become inactive
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsEmptyMock())

      rerender(<AgentUtilizationWidget />)

      expect(screen.getByText('No agent activity yet')).toBeInTheDocument()
    })
  })

  describe('Props Changes', () => {
    it('applies new maxAgents immediately', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('agent1', 'Agent 1', 5000, 0.25),
            createMockAgent('agent2', 'Agent 2', 4000, 0.20),
            createMockAgent('agent3', 'Agent 3', 3000, 0.15),
            createMockAgent('agent4', 'Agent 4', 2000, 0.10),
            createMockAgent('agent5', 'Agent 5', 1000, 0.05),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget maxAgents={3} />)

      // Should show top 3 or group others
      expect(screen.getByText('Agent 1')).toBeInTheDocument()

      // Change maxAgents
      rerender(<AgentUtilizationWidget maxAgents={5} />)

      // Should now show all 5
      expect(screen.getByText('Agent 5')).toBeInTheDocument()
    })

    it('toggles showCost display', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget showCost={false} />)

      expect(screen.queryByText('$0.25')).not.toBeInTheDocument()

      rerender(<AgentUtilizationWidget showCost={true} />)

      expect(screen.getByText('$0.25')).toBeInTheDocument()
    })

    it('toggles showPerformance display', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 5000, 0.25),
          ]),
        })
      )

      const { rerender } = render(<AgentUtilizationWidget showPerformance={false} />)

      // Performance metrics should not be visible
      const performanceElements = screen.queryAllByText(/\/s/)
      expect(performanceElements.length).toBe(0)

      rerender(<AgentUtilizationWidget showPerformance={true} />)

      // Performance metrics should now be visible
      expect(screen.getByText(/\/s/)).toBeInTheDocument()
    })
  })

  describe('Data Integrity', () => {
    it('maintains display integrity during rapid updates', () => {
      const { rerender } = render(<AgentUtilizationWidget />)

      // Simulate rapid updates
      for (let i = 0; i < 20; i++) {
        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({
            metrics: createMockAgentMetricsData([
              createMockAgent('agent1', 'Agent 1', (i + 1) * 1000, (i + 1) * 0.05),
              createMockAgent('agent2', 'Agent 2', (i + 2) * 500, (i + 2) * 0.025),
            ]),
          })
        )

        rerender(<AgentUtilizationWidget />)
      }

      // Final state should be consistent
      expect(screen.getByText('Agent 1')).toBeInTheDocument()
      expect(screen.getByText('2 active')).toBeInTheDocument()
    })
  })
})
