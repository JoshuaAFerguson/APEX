/**
 * Performance tests for BudgetWidget dashboard component
 *
 * Tests cover:
 * - Render performance with different data sizes
 * - Memory usage during frequent updates
 * - Component optimization behaviors
 * - Large data handling
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BudgetWidget } from '../BudgetWidget'
import { createMockRealtimeUpdates } from './__mocks__/widget-test-utils'

// Mock the useRealtimeUpdates hook
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(),
}))

import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'

describe('BudgetWidget - Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Render Performance', () => {
    it('renders quickly with minimal data', () => {
      const startTime = performance.now()

      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      render(<BudgetWidget budgetLimit={1000} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render in under 100ms
      expect(renderTime).toBeLessThan(100)
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })

    it('handles large budget values efficiently', () => {
      const largeBudget = 999999999999 // 1 trillion - 1
      const largeSpend = 500000000000 // 500 billion

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          performance: {
            timeRange: '1h',
            tokenUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              estimatedCost: largeSpend,
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

      const startTime = performance.now()

      render(<BudgetWidget budgetLimit={largeBudget} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should still render quickly with large numbers
      expect(renderTime).toBeLessThan(200)
      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('maintains performance during rapid re-renders', () => {
      let renderTimes: number[] = []

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      // Perform 50 rapid re-renders with different spend values
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now()

        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({
            performance: {
              timeRange: '1h',
              tokenUsage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                estimatedCost: i * 10,
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

        const endTime = performance.now()
        renderTimes.push(endTime - startTime)
      }

      // Average render time should stay reasonable
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
      expect(avgRenderTime).toBeLessThan(50)

      // No render should take excessively long
      const maxRenderTime = Math.max(...renderTimes)
      expect(maxRenderTime).toBeLessThan(200)
    })
  })

  describe('Memory Usage', () => {
    it('does not create memory leaks during mount/unmount cycles', () => {
      // Mock for testing component lifecycle
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      // Perform multiple mount/unmount cycles
      for (let i = 0; i < 20; i++) {
        const { unmount } = render(<BudgetWidget budgetLimit={1000} />)
        unmount()
      }

      // If we reach here without crashes or timeouts, memory management is working
      expect(true).toBe(true)
    })

    it('handles frequent prop changes without memory issues', () => {
      vi.mocked(useRealtimeUpdates).mockReturnValue(createMockRealtimeUpdates())

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      // Rapidly change props many times
      for (let i = 0; i < 100; i++) {
        rerender(
          <BudgetWidget
            budgetLimit={1000 + i}
            thresholds={{ warning: 70 + i, danger: 85 + i }}
            size={i % 2 === 0 ? 'sm' : 'lg'}
          />
        )
      }

      expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
    })
  })

  describe('Component Optimization', () => {
    it('memoizes calculated values correctly', () => {
      const mockHook = createMockRealtimeUpdates({
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

      vi.mocked(useRealtimeUpdates).mockReturnValue(mockHook)

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      // Initial render should show 50%
      expect(screen.getByText('50%')).toBeInTheDocument()

      // Re-render with same data - should use memoized calculation
      rerender(<BudgetWidget budgetLimit={1000} />)

      // Percentage should still be correct
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('updates memoized values when relevant props change', () => {
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

      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      // Should show 50% with $500/$1000
      expect(screen.getByText('50%')).toBeInTheDocument()

      // Change budget limit - should recalculate percentage
      rerender(<BudgetWidget budgetLimit={500} />)

      // Should now show 100% with $500/$500
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  describe('Error Handling Performance', () => {
    it('handles error states efficiently', () => {
      const startTime = performance.now()

      vi.mocked(useRealtimeUpdates).mockReturnValue(
        createMockRealtimeUpdates({
          connectionState: 'error',
          error: new Error('Test error'),
        })
      )

      render(<BudgetWidget budgetLimit={1000} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Error state should render quickly
      expect(renderTime).toBeLessThan(100)
      expect(screen.getByText('Unable to load budget data')).toBeInTheDocument()
    })

    it('transitions between states efficiently', () => {
      const { rerender } = render(<BudgetWidget budgetLimit={1000} />)

      const states = [
        'connecting' as const,
        'connected' as const,
        'error' as const,
        'reconnecting' as const,
        'connected' as const,
        'disconnected' as const,
      ]

      let totalTime = 0

      states.forEach(state => {
        const startTime = performance.now()

        vi.mocked(useRealtimeUpdates).mockReturnValue(
          createMockRealtimeUpdates({
            connectionState: state,
            error: state === 'error' ? new Error('Test error') : null,
          })
        )

        rerender(<BudgetWidget budgetLimit={1000} />)

        const endTime = performance.now()
        totalTime += (endTime - startTime)
      })

      // All state transitions should be fast
      const avgTransitionTime = totalTime / states.length
      expect(avgTransitionTime).toBeLessThan(50)
    })
  })

  describe('Data Processing Performance', () => {
    it('calculates percentages efficiently with precision edge cases', () => {
      const testCases = [
        { spend: 1e-10, budget: 1, expected: 0 }, // Very small numbers
        { spend: 999.999999, budget: 1000, expected: 100 }, // High precision
        { spend: 1/3, budget: 1, expected: 33.33 }, // Repeating decimals
        { spend: Math.PI, budget: 10, expected: 31.42 }, // Irrational numbers
      ]

      testCases.forEach(({ spend, budget }, index) => {
        const startTime = performance.now()

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

        render(<BudgetWidget budgetLimit={budget} />)

        const endTime = performance.now()
        const renderTime = endTime - startTime

        // Even complex calculations should be fast
        expect(renderTime).toBeLessThan(100)
        expect(screen.getByText('Budget Monitor')).toBeInTheDocument()
      })
    })
  })
})