/**
 * Edge case tests for BudgetWidget dashboard component
 *
 * Tests cover:
 * - Zero-data scenarios
 * - Extreme values (MAX_SAFE_INTEGER, very small decimals)
 * - NaN/Infinity handling
 * - Negative values
 * - Null/undefined data fields
 * - Rapid state changes
 * - Component unmount during async operations
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BudgetWidget } from '../BudgetWidget'
import {
  createMockRealtimeUpdates,
  ZERO_DATA_SCENARIOS,
  EXTREME_VALUE_SCENARIOS,
  INVALID_DATA_SCENARIOS,
} from './__mocks__/widget-test-utils'

// Mock the useRealtimeUpdates hook
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'

describe('BudgetWidget - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Zero Data Scenarios', () => {
    it('handles zero budget limit with zero spend', () => {
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

      render(<BudgetWidget budgetLimit={0} />)

      // BudgetGauge internally handles 0 budget - component should render
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('handles zero spend with normal budget limit', () => {
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
      expect(screen.getAllByText('Within budget').length).toBeGreaterThan(0)
    })

    it('handles null performance data', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({ performance: null })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('0%')).toBeInTheDocument()
      expect(screen.getAllByText('Within budget').length).toBeGreaterThan(0)
    })

    it('handles undefined tokenUsage', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: undefined as any,
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
    })

    it('handles missing estimatedCost field', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              tokensPerMinute: 0,
              cacheHitRate: 0,
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
        })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  describe('Extreme Value Scenarios', () => {
    it('handles very large budget values', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 500000000,
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

      render(<BudgetWidget budgetLimit={1000000000} />)

      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getAllByText('Within budget').length).toBeGreaterThan(0)
    })

    it('handles very small decimal values', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 0.0001,
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

      render(<BudgetWidget budgetLimit={0.001} />)

      // 0.0001 / 0.001 = 10%
      expect(screen.getByText('10%')).toBeInTheDocument()
    })

    it('handles spend exceeding budget by large margin', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 5000,
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

      // 500% - should cap display at 100% or show actual
      expect(screen.getAllByText('Over budget').length).toBeGreaterThan(0)
    })
  })

  describe('Invalid Data Handling', () => {
    it('handles NaN spend value', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: NaN,
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

      // Should not crash
      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('handles Infinity spend value', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: Infinity,
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

      // Should not crash
      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('handles negative spend value', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: -500,
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

      // Should handle negative values gracefully
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('handles negative budget limit', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
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

      render(<BudgetWidget budgetLimit={-1000} />)

      // Should handle negative budget gracefully
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })
  })

  describe('Threshold Edge Cases', () => {
    it('handles exact warning threshold value', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 750, // Exactly 75%
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

      expect(screen.getAllByText('Approaching limit').length).toBeGreaterThan(0)
    })

    it('handles exact danger threshold value', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 900, // Exactly 90%
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

      expect(screen.getAllByText('Over budget').length).toBeGreaterThan(0)
    })

    it('handles zero thresholds', () => {
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

      render(
        <BudgetWidget
          budgetLimit={1000}
          thresholds={{ warning: 0, danger: 0 }}
        />
      )

      // With zero thresholds, any non-zero spend should be danger
      expect(screen.getAllByText('Over budget').length).toBeGreaterThan(0)
    })

    it('handles thresholds > 100', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: 950,
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
          thresholds={{ warning: 150, danger: 200 }}
        />
      )

      // With thresholds above 100%, 95% spend should be safe
      expect(screen.getAllByText('Within budget').length).toBeGreaterThan(0)
    })
  })

  describe('Rapid State Changes', () => {
    it('handles rapid prop changes without crashing', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      // Rapid budget limit changes
      for (let i = 0; i < 50; i++) {
        rerender(<BudgetWidget budgetLimit={i * 100 + 1} />)
      }

      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('handles rapid connection state changes', () => {
      const states = ['connected', 'disconnected', 'reconnecting', 'error', 'connecting'] as const

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      for (let i = 0; i < 20; i++) {
        const state = states[i % states.length]
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({ connectionState: state })
        )
        rerender(<BudgetWidget budgetLimit={1000} />)
      }

      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('handles concurrent refresh requests', async () => {
      const mockCheckHealth = vi.fn().mockResolvedValue(undefined)

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates(undefined, { checkHealth: mockCheckHealth })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      const refreshButton = screen.getByTitle('Refresh budget data')

      // Click rapidly multiple times
      for (let i = 0; i < 5; i++) {
        fireEvent.click(refreshButton)
      }

      await waitFor(() => {
        // All clicks should be processed
        expect(mockCheckHealth).toHaveBeenCalled()
      })
    })
  })

  describe('Component Lifecycle Edge Cases', () => {
    it('handles unmount during refresh operation', async () => {
      let resolveRefresh: () => void
      const mockCheckHealth = vi.fn().mockImplementation(
        () => new Promise<void>(resolve => { resolveRefresh = resolve })
      )

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates(undefined, { checkHealth: mockCheckHealth })
      )

      const { unmount } = render(<BudgetWidget budgetLimit={1000} />)

      const refreshButton = screen.getByTitle('Refresh budget data')
      fireEvent.click(refreshButton)

      // Unmount while refresh is pending
      unmount()

      // Resolve the pending promise
      resolveRefresh!()

      // Should not throw any errors
      expect(mockCheckHealth).toHaveBeenCalled()
    })

    it('handles multiple rapid mount/unmount cycles', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<BudgetWidget budgetLimit={1000} />)
        unmount()
      }

      // Final render should work
      render(<BudgetWidget budgetLimit={1000} />)
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })
  })

  describe('Date Edge Cases', () => {
    it('handles very old lastUpdate date', () => {
      const oldDate = new Date('1970-01-01T00:00:00Z')

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({ lastUpdate: oldDate })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })

    it('handles future lastUpdate date', () => {
      const futureDate = new Date('2099-12-31T23:59:59Z')

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({ lastUpdate: futureDate })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })

    it('handles invalid lastUpdate date', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({ lastUpdate: new Date('invalid') })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      // Should not crash
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('handles null lastUpdate', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({ lastUpdate: null })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      // Should not show "Last updated" when null
      expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument()
    })
  })

  describe('Error Object Edge Cases', () => {
    it('handles error with circular reference', () => {
      const circularError: any = new Error('Circular error')
      circularError.self = circularError

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          connectionState: 'error',
          error: circularError,
        })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Circular error')).toBeInTheDocument()
    })

    it('handles error with empty message', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          connectionState: 'error',
          error: new Error(''),
        })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      expect(screen.getByText('Connection error')).toBeInTheDocument()
    })

    it('handles error with very long message', () => {
      const longMessage = 'Error: '.repeat(1000)

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          connectionState: 'error',
          error: new Error(longMessage),
        })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      // Should not crash
      expect(screen.getByText('Unable to load budget data')).toBeInTheDocument()
    })
  })

  describe('Performance Edge Cases', () => {
    it('handles many re-renders without memory issues', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      // Simulate many re-renders
      for (let i = 0; i < 100; i++) {
        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({
            performance: {
              timeRange: '1h',
              tokenUsage: {
                inputTokens: i,
                outputTokens: i,
                totalTokens: i * 2,
                estimatedCost: Math.random() * 1000,
                tokensPerMinute: 0,
                cacheHitRate: 0,
                byAgent: {},
                byTool: {},
              },
              tasks: {
                completedTasks: i,
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
      }

      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })
  })
})
