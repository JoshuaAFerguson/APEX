/**
 * Additional basic tests for BudgetWidget dashboard component
 *
 * These tests complement the existing test suite with additional coverage
 * for scenarios not fully covered in the main test files.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BudgetWidget } from '../BudgetWidget'
import { createMockRealtimeUpdates } from './__mocks__/widget-test-utils'

// Mock the useRealtimeUpdates hook
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'

describe('BudgetWidget - Additional Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Zero-Data Scenarios Additional Coverage', () => {
    it('handles zero budget with positive spend gracefully', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 100, // Positive spend with zero budget
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

      // Should render without crashing, despite mathematical edge case
      render(<BudgetWidget budgetLimit={0} />)
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('handles extremely small budget values', () => {
      const tinyBudget = 0.01 // 1 cent
      const tinySpend = 0.005 // Half a cent

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: tinySpend,
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

      render(<BudgetWidget budgetLimit={tinyBudget} />)

      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument() // 0.005 / 0.01 = 50%
    })
  })

  describe('Threshold Edge Cases Additional Coverage', () => {
    it('handles floating point precision near thresholds', () => {
      const cases = [
        { spend: 74.999999999, budget: 100, expected: 'Within budget' }, // Just under 75%
        { spend: 75.000000001, budget: 100, expected: 'Approaching limit' }, // Just over 75%
        { spend: 89.999999999, budget: 100, expected: 'Approaching limit' }, // Just under 90%
        { spend: 90.000000001, budget: 100, expected: 'Over budget' }, // Just over 90%
      ]

      cases.forEach(({ spend, budget, expected }) => {
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

        const { unmount } = render(<BudgetWidget budgetLimit={budget} />)

        const statusElements = screen.getAllByText(expected)
        expect(statusElements.length).toBeGreaterThan(0)

        unmount()
      })
    })

    it('handles custom threshold values correctly', () => {
      const customThresholds = { warning: 60, danger: 80 }

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 700, // 70% of budget
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

      render(<BudgetWidget budgetLimit={1000} thresholds={customThresholds} />)

      // With custom thresholds, 70% should trigger warning
      expect(screen.getAllByText('Approaching limit').length).toBeGreaterThan(0)
    })
  })

  describe('Refresh Functionality Additional Coverage', () => {
    it('maintains visual state during refresh', async () => {
      const mockCheckHealth = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates(
          {
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
          },
          { checkHealth: mockCheckHealth }
        )
      )

      render(<BudgetWidget budgetLimit={1000} />)

      // Verify initial state
      expect(screen.getByText('50%')).toBeInTheDocument()

      // Click refresh
      const refreshButton = screen.getByTitle('Refresh budget data')
      fireEvent.click(refreshButton)

      // Budget display should remain visible during refresh
      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('calls external refresh callback when provided', async () => {
      const onRefresh = vi.fn()
      const mockCheckHealth = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates(undefined, { checkHealth: mockCheckHealth })
      )

      render(<BudgetWidget budgetLimit={1000} onRefresh={onRefresh} />)

      const refreshButton = screen.getByTitle('Refresh budget data')
      fireEvent.click(refreshButton)

      // Wait for async operations to complete
      await waitFor(() => {
        expect(mockCheckHealth).toHaveBeenCalled()
        expect(onRefresh).toHaveBeenCalled()
      })
    })
  })

  describe('Display Formatting Additional Coverage', () => {
    it('formats very large currency amounts correctly', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 123456.789,
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

      render(<BudgetWidget budgetLimit={200000} />)

      // Should format large amounts properly
      expect(screen.getByText(/\$123,456\.79|\$123456\.79/)).toBeInTheDocument()
    })

    it('handles percentage calculations with high precision', () => {
      const precisionCases = [
        { spend: 333.33, budget: 1000, expectedPercentage: '33' },
        { spend: 666.67, budget: 1000, expectedPercentage: '67' },
        { spend: 123.456, budget: 1000, expectedPercentage: '12' },
      ]

      precisionCases.forEach(({ spend, budget, expectedPercentage }) => {
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

        const { unmount } = render(<BudgetWidget budgetLimit={budget} />)

        expect(screen.getByText(`${expectedPercentage}%`)).toBeInTheDocument()

        unmount()
      })
    })
  })

  describe('Component Props Coverage', () => {
    it('handles all size variants correctly', () => {
      const sizes = ['sm', 'md', 'lg'] as const

      sizes.forEach(size => {
        vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

        const { unmount } = render(<BudgetWidget budgetLimit={1000} size={size} />)

        expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toBeInTheDocument()

        unmount()
      })
    })

    it('applies custom className correctly', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      const customClass = 'my-custom-budget-widget'
      const { container } = render(
        <BudgetWidget budgetLimit={1000} className={customClass} />
      )

      expect(container.querySelector(`.${customClass}`)).toBeInTheDocument()
    })

    it('handles autoRefreshInterval prop', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      // Test with custom auto-refresh interval
      render(<BudgetWidget budgetLimit={1000} autoRefreshInterval={60} />)

      // Component should render normally (internal behavior is tested via hook)
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })
  })
})