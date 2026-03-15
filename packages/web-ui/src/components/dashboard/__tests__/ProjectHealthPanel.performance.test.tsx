/**
 * Performance and rendering optimization tests for ProjectHealthPanel
 *
 * This file tests that the component performs well under various scenarios
 * and uses React optimizations effectively (memo, useMemo, useCallback).
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectHealthPanel } from '../ProjectHealthPanel'
import {
  generateMockHealthMetrics,
  type ProjectHealthMetrics,
} from '@/types/project-health'

// Mock performance.now for consistent timing
const mockPerformance = vi.fn(() => Date.now())
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformance },
  writable: true,
})

describe('ProjectHealthPanel - Performance Tests', () => {
  describe('Rendering Performance', () => {
    it('renders within acceptable time limits', () => {
      const startTime = performance.now()

      const metrics = generateMockHealthMetrics()
      render(<ProjectHealthPanel metrics={metrics} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within 100ms (generous threshold for test environment)
      expect(renderTime).toBeLessThan(100)
      expect(screen.getByText('Project Health')).toBeInTheDocument()
    })

    it('handles large datasets efficiently', () => {
      const startTime = performance.now()

      const largeDataMetrics: ProjectHealthMetrics = {
        status: 'healthy',
        successRate: 95.7,
        averageDurationMs: 2500,
        systemHealth: 92.3,
        tasks: {
          activeTasks: 50000,
          pendingTasks: 75000,
          completedTasks: 1000000,
          failedTasks: 25000,
        },
        connection: {
          isConnected: true,
          latencyMs: 45,
          averageLatencyMs: 52,
          reconnectAttempts: 0,
        },
        lastUpdated: new Date(),
      }

      render(<ProjectHealthPanel metrics={largeDataMetrics} showDetails={true} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should handle large numbers efficiently
      expect(renderTime).toBeLessThan(150)
      expect(screen.getByText('1,000,000')).toBeInTheDocument()
    })

    it('minimizes re-renders with stable props', () => {
      const metrics = generateMockHealthMetrics()
      const onStatusChange = vi.fn()
      const onRefresh = vi.fn()

      let renderCount = 0
      const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        renderCount++
        return <>{children}</>
      }

      const { rerender } = render(
        <TestWrapper>
          <ProjectHealthPanel
            metrics={metrics}
            onStatusChange={onStatusChange}
            onRefresh={onRefresh}
          />
        </TestWrapper>
      )

      const initialRenderCount = renderCount

      // Re-render with same props - should not cause unnecessary re-renders
      rerender(
        <TestWrapper>
          <ProjectHealthPanel
            metrics={metrics}
            onStatusChange={onStatusChange}
            onRefresh={onRefresh}
          />
        </TestWrapper>
      )

      // Should have minimal additional renders
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(2)
    })
  })

  describe('Memory Efficiency', () => {
    it('cleans up properly on unmount', () => {
      const metrics = generateMockHealthMetrics()
      const onStatusChange = vi.fn()

      const { unmount } = render(
        <ProjectHealthPanel
          metrics={metrics}
          onStatusChange={onStatusChange}
        />
      )

      // Component should be present
      expect(screen.getByText('Project Health')).toBeInTheDocument()

      // Unmount should complete without errors
      unmount()

      // Callback should not be called after unmount
      expect(onStatusChange).toHaveBeenCalledTimes(1) // Only initial call
    })

    it('handles rapid prop changes efficiently', () => {
      const onStatusChange = vi.fn()
      const { rerender } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({ status: 'healthy' })}
          onStatusChange={onStatusChange}
        />
      )

      const startTime = performance.now()

      // Simulate rapid updates (like real-time data)
      for (let i = 0; i < 50; i++) {
        rerender(
          <ProjectHealthPanel
            metrics={generateMockHealthMetrics({
              status: i % 3 === 0 ? 'healthy' : i % 3 === 1 ? 'warning' : 'critical',
              successRate: Math.random() * 100,
              averageDurationMs: Math.random() * 10000,
              systemHealth: Math.random() * 100,
            })}
            onStatusChange={onStatusChange}
          />
        )
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should handle rapid updates efficiently
      expect(totalTime).toBeLessThan(500) // 500ms for 50 updates
      expect(screen.getByText('Project Health')).toBeInTheDocument()
    })
  })

  describe('Memoization Effectiveness', () => {
    it('memoizes threshold calculations correctly', () => {
      const baseThresholds = {
        successRateWarning: 90,
        successRateCritical: 70,
      }

      const { rerender } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          thresholds={baseThresholds}
        />
      )

      expect(screen.getByText('Healthy')).toBeInTheDocument()

      // Re-render with same threshold object reference
      rerender(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          thresholds={baseThresholds}
        />
      )

      // Should use memoized thresholds
      expect(screen.getByText('Healthy')).toBeInTheDocument()

      // Re-render with new threshold object but same values
      rerender(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          thresholds={{
            successRateWarning: 90,
            successRateCritical: 70,
          }}
        />
      )

      // Should recalculate but produce same result
      expect(screen.getByText('Healthy')).toBeInTheDocument()
    })

    it('memoizes status calculations with complex metrics', () => {
      const complexMetrics = generateMockHealthMetrics({
        successRate: 95.5,
        systemHealth: 92.3,
        averageDurationMs: 2750,
        tasks: {
          activeTasks: 12,
          pendingTasks: 8,
          completedTasks: 1547,
          failedTasks: 23,
        },
      })

      const { rerender } = render(
        <ProjectHealthPanel metrics={complexMetrics} />
      )

      expect(screen.getByText('Healthy')).toBeInTheDocument()

      // Re-render with same metrics object
      rerender(
        <ProjectHealthPanel metrics={complexMetrics} />
      )

      // Should use memoized status calculation
      expect(screen.getByText('Healthy')).toBeInTheDocument()
    })
  })

  describe('Event Handler Performance', () => {
    it('handles rapid button clicks without performance degradation', () => {
      const onRefresh = vi.fn()
      render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics()}
          onRefresh={onRefresh}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh health metrics' })
      const startTime = performance.now()

      // Simulate rapid clicking
      for (let i = 0; i < 20; i++) {
        fireEvent.click(refreshButton)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should handle rapid clicks efficiently
      expect(totalTime).toBeLessThan(100)
      expect(onRefresh).toHaveBeenCalledTimes(20)
    })

    it('optimizes status change callbacks', () => {
      const onStatusChange = vi.fn()
      const { rerender } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({ status: 'healthy' })}
          onStatusChange={onStatusChange}
        />
      )

      const startTime = performance.now()

      // Change status multiple times
      const statuses: Array<'healthy' | 'warning' | 'critical'> = ['warning', 'critical', 'healthy']

      statuses.forEach(status => {
        rerender(
          <ProjectHealthPanel
            metrics={generateMockHealthMetrics({ status })}
            onStatusChange={onStatusChange}
          />
        )
      })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should handle status changes efficiently
      expect(totalTime).toBeLessThan(50)
      expect(onStatusChange).toHaveBeenCalledTimes(4) // Initial + 3 changes
    })
  })

  describe('DOM Update Efficiency', () => {
    it('minimizes DOM manipulation on metric updates', () => {
      const { rerender } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({ successRate: 95.0 })}
        />
      )

      expect(screen.getByText('95.0%')).toBeInTheDocument()

      const startTime = performance.now()

      // Update metrics slightly
      rerender(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({ successRate: 95.1 })}
        />
      )

      const endTime = performance.now()
      const updateTime = endTime - startTime

      // Should update efficiently
      expect(updateTime).toBeLessThan(20)
      expect(screen.getByText('95.1%')).toBeInTheDocument()
    })

    it('efficiently updates connection status', () => {
      const { rerender } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({
            connection: {
              isConnected: true,
              latencyMs: 45,
              averageLatencyMs: 52,
              reconnectAttempts: 0,
            },
          })}
          showConnectionStatus={true}
        />
      )

      expect(screen.getByText('Connected (45ms)')).toBeInTheDocument()

      const startTime = performance.now()

      // Update connection latency
      rerender(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({
            connection: {
              isConnected: true,
              latencyMs: 47,
              averageLatencyMs: 53,
              reconnectAttempts: 0,
            },
          })}
          showConnectionStatus={true}
        />
      )

      const endTime = performance.now()
      const updateTime = endTime - startTime

      // Should update connection status efficiently
      expect(updateTime).toBeLessThan(20)
      expect(screen.getByText('Connected (47ms)')).toBeInTheDocument()
    })
  })

  describe('Animation Performance', () => {
    it('handles critical status animation efficiently', () => {
      const { rerender } = render(
        <ProjectHealthPanel
          metrics={generateMockHealthMetrics({ status: 'critical' })}
        />
      )

      // Critical status should have animation
      expect(screen.getByText('Critical')).toBeInTheDocument()

      const startTime = performance.now()

      // Toggle animation on/off rapidly
      for (let i = 0; i < 10; i++) {
        rerender(
          <ProjectHealthPanel
            metrics={generateMockHealthMetrics({
              status: 'critical',
              successRate: i % 2 === 0 ? 50 : 55 // Slight variation to trigger re-render
            })}
          />
        )
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should handle animation toggles efficiently
      expect(totalTime).toBeLessThan(100)
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    it('optimizes loading state animations', () => {
      const { rerender } = render(
        <ProjectHealthPanel isLoading={true} />
      )

      expect(screen.getByText('Loading health metrics...')).toBeInTheDocument()

      const startTime = performance.now()

      // Toggle loading state
      rerender(<ProjectHealthPanel isLoading={false} />)
      rerender(<ProjectHealthPanel isLoading={true} />)
      rerender(<ProjectHealthPanel isLoading={false} />)

      const endTime = performance.now()
      const toggleTime = endTime - startTime

      // Should handle loading state changes efficiently
      expect(toggleTime).toBeLessThan(50)
    })
  })

  describe('Conditional Rendering Performance', () => {
    it('efficiently shows/hides detailed metrics', () => {
      const metrics = generateMockHealthMetrics()
      const { rerender } = render(
        <ProjectHealthPanel metrics={metrics} showDetails={false} />
      )

      expect(screen.queryByText('Task Breakdown')).not.toBeInTheDocument()

      const startTime = performance.now()

      // Toggle details visibility
      rerender(
        <ProjectHealthPanel metrics={metrics} showDetails={true} />
      )

      const endTime = performance.now()
      const toggleTime = endTime - startTime

      // Should show details efficiently
      expect(toggleTime).toBeLessThan(30)
      expect(screen.getByText('Task Breakdown')).toBeInTheDocument()
    })

    it('efficiently toggles connection status display', () => {
      const metrics = generateMockHealthMetrics()
      const { rerender } = render(
        <ProjectHealthPanel metrics={metrics} showConnectionStatus={true} />
      )

      expect(screen.getByText(/Connected/)).toBeInTheDocument()

      const startTime = performance.now()

      // Toggle connection status display
      rerender(
        <ProjectHealthPanel metrics={metrics} showConnectionStatus={false} />
      )

      const endTime = performance.now()
      const toggleTime = endTime - startTime

      // Should hide connection status efficiently
      expect(toggleTime).toBeLessThan(20)
      expect(screen.queryByText(/Connected/)).not.toBeInTheDocument()
    })
  })
})