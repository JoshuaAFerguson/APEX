/**
 * Unit tests for BudgetWidget dashboard component
 *
 * Tests cover:
 * - Widget rendering with various props
 * - Threshold-based color changes (safe/warning/danger)
 * - Data formatting (currency, percentages)
 * - Connection status indicators
 * - Loading and error states
 * - Refresh functionality
 * - Accessibility attributes
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BudgetWidget } from '../BudgetWidget'
import {
  createMockRealtimeUpdates,
  createConnectingMock,
  createErrorMock,
  createDisconnectedMock,
  createBudgetWidgetProps,
  BUDGET_THRESHOLD_TEST_CASES,
  CONNECTION_STATUS_TEST_CASES,
} from './__mocks__/widget-test-utils'

// Mock the useRealtimeUpdates hook
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

// Import the mocked hook for type-safe mocking
import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'

describe('BudgetWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Rendering', () => {
    it('renders with required budgetLimit prop', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('renders BudgetGauge when data is available', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      render(<BudgetWidget budgetLimit={1000} />)

      // BudgetGauge should render with progress bar role
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      const { container } = render(
        <BudgetWidget budgetLimit={1000} className="custom-budget-widget" />
      )

      expect(container.querySelector('.custom-budget-widget')).toBeInTheDocument()
    })

    it('renders with different size variants', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      const { rerender } = render(<BudgetWidget budgetLimit={1000} size="sm" />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()

      rerender(<BudgetWidget budgetLimit={1000} size="md" />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()

      rerender(<BudgetWidget budgetLimit={1000} size="lg" />)
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('displays last updated timestamp when available', () => {
      const lastUpdate = new Date('2025-03-15T10:30:00Z')
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({ lastUpdate })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })
  })

  describe('Data Formatting', () => {
    it('calculates spending percentage correctly', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 750,
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

      render(<BudgetWidget budgetLimit={1000} />)

      // 750/1000 = 75%
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('displays currency amounts correctly', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 850.5,
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

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('$850.50')).toBeInTheDocument()
      expect(screen.getByText('of $1,000.00')).toBeInTheDocument()
    })

    it('handles zero spend correctly', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 0,
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

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('0%')).toBeInTheDocument()
      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })
  })

  describe('Threshold Color Changes', () => {
    it.each(BUDGET_THRESHOLD_TEST_CASES)(
      'displays "$expectedStatus" for spend $spend of $budgetLimit budget',
      ({ spend, budgetLimit, expectedStatus }) => {
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({
            performance: {
              timeRange: '1h',
              tokenUsage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                estimatedCost: spend,
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

        render(<BudgetWidget budgetLimit={budgetLimit} />)

        // Both BudgetGauge and BudgetWidget may display the status, so use getAllByText
        const statusElements = screen.getAllByText(expectedStatus)
        expect(statusElements.length).toBeGreaterThan(0)
      }
    )

    it('respects custom threshold values', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 500, // 50% - normally safe
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

      render(
        <BudgetWidget
          budgetLimit={1000}
          thresholds={{ warning: 40, danger: 50 }}
        />
      )

      // With custom thresholds, 50% should be danger
      const overBudgetElements = screen.getAllByText('Over budget')
      expect(overBudgetElements.length).toBeGreaterThan(0)
    })

    it('shows warning icon for warning state', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 800, // 80% - warning
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

      const { container } = render(<BudgetWidget budgetLimit={1000} />)

      // Should have yellow/warning colored icon
      expect(container.querySelector('.text-yellow-500')).toBeInTheDocument()
    })

    it('shows danger icon for danger state', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 950, // 95% - danger
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

      const { container } = render(<BudgetWidget budgetLimit={1000} />)

      // Should have red/danger colored icon
      expect(container.querySelector('.text-red-500')).toBeInTheDocument()
    })
  })

  describe('Connection Status', () => {
    it.each(CONNECTION_STATUS_TEST_CASES)(
      'shows $expectedLabel status indicator for $connectionState state',
      ({ connectionState, expectedLabel }) => {
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({ connectionState })
        )

        render(<BudgetWidget budgetLimit={1000} />)

        expect(screen.getByTitle(expectedLabel)).toBeInTheDocument()
      }
    )

    it('shows screen reader text for connection status', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({ connectionState: 'connected' })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Connected')).toHaveClass('sr-only')
    })
  })

  describe('Loading State', () => {
    it('shows loading spinner when connecting and no data', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createConnectingMock())

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Loading budget data...')).toBeInTheDocument()
    })

    it('disables refresh button during loading', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createConnectingMock())

      render(<BudgetWidget budgetLimit={1000} />)

      const refreshButton = screen.getByTitle('Refresh budget data')
      expect(refreshButton).toBeDisabled()
    })

    it('shows spinning animation on refresh icon during loading', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createConnectingMock())

      const { container } = render(<BudgetWidget budgetLimit={1000} />)

      expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('displays error message', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createErrorMock('Connection failed')
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Unable to load budget data')).toBeInTheDocument()
      expect(screen.getByText('Connection failed')).toBeInTheDocument()
    })

    it('shows Try Again button on error', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createErrorMock())

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
    })

    it('shows error icon in error state', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createErrorMock())

      const { container } = render(<BudgetWidget budgetLimit={1000} />)

      // AlertTriangle icon should be present
      expect(container.querySelector('.text-red-500')).toBeInTheDocument()
    })

    it('shows default error message when error has no message', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          connectionState: 'error',
          error: new Error(),
        })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Connection error')).toBeInTheDocument()
    })
  })

  describe('Refresh Functionality', () => {
    it('calls onRefresh callback when refresh button clicked', async () => {
      const onRefresh = vi.fn()
      const mockCheckHealth = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates(undefined, { checkHealth: mockCheckHealth })
      )

      render(<BudgetWidget budgetLimit={1000} onRefresh={onRefresh} />)

      const refreshButton = screen.getByTitle('Refresh budget data')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockCheckHealth).toHaveBeenCalled()
        expect(onRefresh).toHaveBeenCalled()
      })
    })

    it('triggers checkHealth when refresh button clicked', async () => {
      const mockCheckHealth = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates(undefined, { checkHealth: mockCheckHealth })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      const refreshButton = screen.getByTitle('Refresh budget data')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockCheckHealth).toHaveBeenCalledTimes(1)
      })
    })

    it('handles refresh errors gracefully', async () => {
      const mockCheckHealth = vi.fn().mockRejectedValue(new Error('Refresh failed'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates(undefined, { checkHealth: mockCheckHealth })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      const refreshButton = screen.getByTitle('Refresh budget data')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Budget widget refresh failed:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })

    it('retry button on error state triggers refresh', async () => {
      const mockCheckHealth = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useRealtimeUpdates).mockReturnValue({
        ...createErrorMock(),
        checkHealth: mockCheckHealth,
      })

      render(<BudgetWidget budgetLimit={1000} />)

      const retryButton = screen.getByRole('button', { name: 'Try Again' })
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(mockCheckHealth).toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility', () => {
    it('has accessible refresh button', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      render(<BudgetWidget budgetLimit={1000} />)

      const refreshButton = screen.getByTitle('Refresh budget data')
      expect(refreshButton).toBeInTheDocument()
    })

    it('provides screen reader text for connection status', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      render(<BudgetWidget budgetLimit={1000} />)

      const srText = screen.getByText('Connected')
      expect(srText).toHaveClass('sr-only')
    })

    it('BudgetGauge has proper ARIA attributes', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      render(<BudgetWidget budgetLimit={1000} />)

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
    })
  })

  describe('Zero Budget Limit', () => {
    it('handles zero budget limit gracefully', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 100,
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

      render(<BudgetWidget budgetLimit={0} />)

      // BudgetGauge internally handles 0 budget by defaulting to 1
      // With 100 spend and effective limit of 1, shows over budget state
      // But we're testing it doesn't crash - component renders
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })
  })

  describe('Disconnected State', () => {
    it('shows disconnected status correctly', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createDisconnectedMock())

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByTitle('Disconnected')).toBeInTheDocument()
    })
  })
})
