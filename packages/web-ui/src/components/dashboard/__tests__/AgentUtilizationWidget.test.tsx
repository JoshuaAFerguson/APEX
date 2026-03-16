/**
 * Unit tests for AgentUtilizationWidget dashboard component
 *
 * Tests cover:
 * - Widget rendering with various props
 * - Agent data display and formatting
 * - Summary statistics calculation
 * - Connection status indicators
 * - Loading and error states
 * - Refresh functionality
 * - Agent click handlers
 * - Accessibility attributes
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
  createAgentUtilizationWidgetProps,
  CONNECTION_STATUS_TEST_CASES,
} from './__mocks__/widget-test-utils'

// Mock the useAgentMetrics hook
vi.mock('@/hooks/useAgentMetrics', () => ({
  useAgentMetrics: vi.fn(),
}))

import { useAgentMetrics } from '@/hooks/useAgentMetrics'

describe('AgentUtilizationWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('renders with default props', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('renders agent names in the chart', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('planner', 'Planner', 5000, 0.25),
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('Planner')).toBeInTheDocument()
      expect(screen.getByText('Coder')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      const { container } = render(
        <AgentUtilizationWidget className="custom-agent-widget" />
      )

      expect(container.querySelector('.custom-agent-widget')).toBeInTheDocument()
    })

    it('renders with custom height', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget height={400} />)

      expect(screen.getByText('Agent Utilization')).toBeInTheDocument()
    })

    it('displays Users icon in header', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      const { container } = render(<AgentUtilizationWidget />)

      // Check for Users icon (lucide-react)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Summary Statistics', () => {
    it('displays active agent count', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('planner', 'Planner', 5000, 0.25),
            createMockAgent('coder', 'Coder', 8000, 0.40),
            createMockAgent('idle', 'Idle Agent', 0, 0),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should show 2 active (non-zero tokens)
      expect(screen.getByText('2 active')).toBeInTheDocument()
    })

    it('displays top agent name and percentage', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('planner', 'Planner', 3000, 0.15),
            createMockAgent('coder', 'Coder', 7000, 0.35), // Top agent
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Coder has 70% of tokens (7000/10000)
      expect(screen.getByText(/Top: Coder/)).toBeInTheDocument()
      expect(screen.getByText(/70%/)).toBeInTheDocument()
    })

    it('hides summary when loading', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsLoadingMock())

      render(<AgentUtilizationWidget />)

      expect(screen.queryByText(/active/)).not.toBeInTheDocument()
    })

    it('hides summary on error', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsErrorMock())

      render(<AgentUtilizationWidget />)

      expect(screen.queryByText(/active/)).not.toBeInTheDocument()
    })
  })

  describe('Data Display', () => {
    it('shows cost information when showCost is true', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('planner', 'Planner', 5000, 0.25),
          ]),
        })
      )

      render(<AgentUtilizationWidget showCost={true} />)

      expect(screen.getByText('$0.25')).toBeInTheDocument()
    })

    it('formats large token counts correctly', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('large', 'Large Agent', 5000000, 250.00),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      // Should show 5.0M for 5 million tokens
      expect(screen.getByText('5.0M')).toBeInTheDocument()
    })

    it('displays last updated timestamp', () => {
      const lastUpdated = new Date('2025-03-15T10:30:00Z')
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData(undefined, { lastUpdated }),
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })

    it('respects maxAgents prop', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('agent1', 'Agent 1', 1000, 0.05),
            createMockAgent('agent2', 'Agent 2', 2000, 0.10),
            createMockAgent('agent3', 'Agent 3', 3000, 0.15),
            createMockAgent('agent4', 'Agent 4', 4000, 0.20),
            createMockAgent('agent5', 'Agent 5', 5000, 0.25),
          ]),
        })
      )

      render(<AgentUtilizationWidget maxAgents={3} />)

      // Should show top 3 agents or group others
      expect(screen.getByText('Agent 5')).toBeInTheDocument() // Top agent
    })
  })

  describe('Connection Status', () => {
    it.each([
      { status: 'connected', expectedLabel: 'Connected', expectedBg: 'bg-green-500' },
      { status: 'connecting', expectedLabel: 'Connecting...', expectedBg: 'bg-yellow-500' },
      { status: 'reconnecting', expectedLabel: 'Reconnecting...', expectedBg: 'bg-yellow-500' },
      { status: 'error', expectedLabel: 'Connection Error', expectedBg: 'bg-red-500' },
      { status: 'disconnected', expectedLabel: 'Disconnected', expectedBg: 'bg-gray-500' },
    ] as const)(
      'shows $expectedLabel for $status state',
      ({ status, expectedLabel }) => {
        vi.mocked(useAgentMetrics).mockReturnValue(
          createMockAgentMetrics({ connectionStatus: status })
        )

        render(<AgentUtilizationWidget />)

        expect(screen.getByTitle(expectedLabel)).toBeInTheDocument()
      }
    )

    it('provides screen reader text for connection status', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({ connectionStatus: 'connected' })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('Connected')).toHaveClass('sr-only')
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsLoadingMock())

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('Loading agent metrics...')).toBeInTheDocument()
    })

    it('disables refresh button during loading', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsLoadingMock())

      render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByTitle('Refresh agent data')
      expect(refreshButton).toBeDisabled()
    })

    it('shows spinning animation during loading', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsLoadingMock())

      const { container } = render(<AgentUtilizationWidget />)

      expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('displays error message', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createAgentMetricsErrorMock('Failed to fetch agent data')
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('Unable to load agent data')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch agent data')).toBeInTheDocument()
    })

    it('shows Try Again button on error', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsErrorMock())

      render(<AgentUtilizationWidget />)

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
    })

    it('shows error icon in error state', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsErrorMock())

      const { container } = render(<AgentUtilizationWidget />)

      // AlertTriangle icon should be present with red color
      expect(container.querySelector('.text-red-500')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('shows empty message when no agents', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsEmptyMock())

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('No agent activity yet')).toBeInTheDocument()
    })

    it('shows zero active agents in summary for empty data', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createAgentMetricsEmptyMock())

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('0 active')).toBeInTheDocument()
    })
  })

  describe('Refresh Functionality', () => {
    it('calls onRefresh callback when refresh button clicked', async () => {
      const onRefresh = vi.fn()
      const mockRefresh = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({ refresh: mockRefresh })
      )

      render(<AgentUtilizationWidget onRefresh={onRefresh} />)

      const refreshButton = screen.getByTitle('Refresh agent data')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
        expect(onRefresh).toHaveBeenCalled()
      })
    })

    it('handles refresh errors gracefully', async () => {
      const mockRefresh = vi.fn().mockRejectedValue(new Error('Refresh failed'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({ refresh: mockRefresh })
      )

      render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByTitle('Refresh agent data')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Agent utilization widget refresh failed:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })

    it('retry button on error state triggers refresh', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useAgentMetrics).mockReturnValue({
        ...createAgentMetricsErrorMock(),
        refresh: mockRefresh,
      })

      render(<AgentUtilizationWidget />)

      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })
  })

  describe('Agent Click Handler', () => {
    it('calls onAgentClick when agent is clicked', () => {
      const onAgentClick = vi.fn()

      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      render(<AgentUtilizationWidget onAgentClick={onAgentClick} />)

      // Find and click the agent row
      const coderRow = screen.getByText('Coder').closest('.group')
      if (coderRow) {
        fireEvent.click(coderRow)
      }

      expect(onAgentClick).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: 'Coder',
          totalTokens: 8000,
        })
      )
    })
  })

  describe('Display Options', () => {
    it('shows token breakdown when showTokenBreakdown is true', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 10000, 0.50),
          ]),
        })
      )

      render(<AgentUtilizationWidget showTokenBreakdown={true} />)

      // Should show input/output token breakdown
      expect(screen.getByText('Input Tokens')).toBeInTheDocument()
      expect(screen.getByText('Output Tokens')).toBeInTheDocument()
    })

    it('shows performance metrics when showPerformance is true', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 10000, 0.50),
          ]),
        })
      )

      render(<AgentUtilizationWidget showPerformance={true} />)

      // Should show tokens per second
      expect(screen.getByText(/\/s/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has accessible refresh button', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget />)

      const refreshButton = screen.getByTitle('Refresh agent data')
      expect(refreshButton).toBeInTheDocument()
    })

    it('provides screen reader text for connection status', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(createMockAgentMetrics())

      render(<AgentUtilizationWidget />)

      const srText = screen.getByText('Connected')
      expect(srText).toHaveClass('sr-only')
    })

    it('chart has proper ARIA attributes', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('coder', 'Coder', 8000, 0.40),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      const chart = screen.getByRole('img')
      expect(chart).toHaveAttribute('aria-label')
    })
  })

  describe('Zero Agent Scenarios', () => {
    it('handles metrics with all zero-token agents', () => {
      vi.mocked(useAgentMetrics).mockReturnValue(
        createMockAgentMetrics({
          metrics: createMockAgentMetricsData([
            createMockAgent('idle1', 'Idle Agent 1', 0, 0),
            createMockAgent('idle2', 'Idle Agent 2', 0, 0),
          ]),
        })
      )

      render(<AgentUtilizationWidget />)

      expect(screen.getByText('0 active')).toBeInTheDocument()
      // Top agent should not be shown when all have 0 tokens
      expect(screen.queryByText(/Top:/)).not.toBeInTheDocument()
    })
  })
})
